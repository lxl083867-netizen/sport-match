import { ApiError } from "@/lib/api";
import { tagVideo, saveTagsToDb } from "@/lib/ai-tagging";
import { logEvent } from "@/lib/events";
import { assertVideoImported, assertVideoOwner } from "@/lib/guards";
import { prisma } from "@/lib/prisma";
import { assessVideoQuality } from "@/lib/video-quality";
import { parseVideoUrl, fetchMetadata, resolveShortLink } from "@/lib/video-import";

type VideoImportInput = {
  url?: unknown;
  title?: unknown;
  author?: unknown;
  confirmQuality?: unknown;
};

type VideoUpdateInput = {
  title?: unknown;
  sourceAuthor?: unknown;
};

export type ListVideosOptions = {
  tag: string | null;
  platform: string | null;
  search: string | null;
  page: number;
  limit: number;
};

export async function importVideo(userId: string, input: VideoImportInput) {
  const { url: rawUrl, title: manualTitle, author: manualAuthor, confirmQuality } = input;

  try {
    if (!rawUrl || typeof rawUrl !== "string" || rawUrl.length > 2000) {
      logEvent("video_import_failed", {
        userId,
        reason: "invalid_url_param",
        inputLength: typeof rawUrl === "string" ? rawUrl.length : 0,
        hasManualTitle: typeof manualTitle === "string" && manualTitle.trim().length > 0,
      });
      throw new ApiError(400, "请提供有效的视频链接", "INVALID_PARAMS");
    }
    if (manualTitle !== undefined && (typeof manualTitle !== "string" || manualTitle.length > 200)) {
      throw new ApiError(400, "标题不能超过 200 字", "INVALID_PARAMS");
    }
    if (manualAuthor !== undefined && (typeof manualAuthor !== "string" || manualAuthor.length > 60)) {
      throw new ApiError(400, "作者名不能超过 60 字", "INVALID_PARAMS");
    }

    let cleanUrl = rawUrl.trim();
    const match = cleanUrl.match(/https?:\/\/\S+/i);
    if (match) cleanUrl = match[0];

    const parsed = parseVideoUrl(cleanUrl);
    if (!parsed) {
      logEvent("video_import_failed", {
        userId,
        reason: "unsupported_link",
        inputLength: cleanUrl.length,
        hasManualTitle: typeof manualTitle === "string" && manualTitle.trim().length > 0,
      });
      throw new ApiError(400, "不支持的链接格式。请粘贴 B站、小红书或抖音链接", "INVALID_PARAMS");
    }

    let effectiveUrl = parsed.canonicalUrl;
    let effectiveVideoId = parsed.videoId;
    let resolvedParsed = parsed;

    if (
      parsed.platform === "bilibili_short" ||
      parsed.platform === "douyin_short" ||
      /xhslink\.com/i.test(parsed.canonicalUrl)
    ) {
      const location = await resolveShortLink(parsed.canonicalUrl);
      if (location) {
        const reparsed = parseVideoUrl(location);
        if (reparsed) {
          effectiveUrl = reparsed.canonicalUrl;
          effectiveVideoId = reparsed.videoId;
          resolvedParsed = reparsed;
        }
      }
    }

    let existing = await prisma.video.findFirst({
      where: { url: effectiveUrl },
    });

    if (!existing && (resolvedParsed.platform === "bilibili" || resolvedParsed.platform === "bilibili_short")) {
      const bvId = effectiveVideoId.replace(/^av/i, "");
      const all = await prisma.video.findMany({
        where: { platform: "bilibili" },
      });
      existing = all.find((video) => {
        const bv2 = video.url.match(/BV([\w]+)/i)?.[1] || video.url.match(/av(\d+)/i)?.[1];
        return bv2 && bvId.toUpperCase() === bv2.toUpperCase();
      }) || null;
    }

    if (existing) {
      await prisma.userVideo.upsert({
        where: { userId_videoId: { userId, videoId: existing.id } },
        update: {},
        create: { userId, videoId: existing.id },
      });
      return { video: existing, existed: true, quality: { level: "high", message: "已存在的视频", reasons: ["该视频已在内容库中"] } };
    }

    const meta = await fetchMetadata(resolvedParsed);
    const quality = assessVideoQuality({
      title: manualTitle?.trim() || meta.title,
      sourceAuthor: manualAuthor?.trim() || meta.sourceAuthor,
      platform: meta.platform,
      duration: meta.duration,
    });

    if (quality.level === "low" && confirmQuality !== true) {
      logEvent("video_import_quality_confirmation_required", {
        userId,
        platform: meta.platform,
        title: manualTitle?.trim() || meta.title,
        reasons: JSON.stringify(quality.reasons),
      });
      return {
        requiresConfirmation: true,
        quality,
        preview: {
          title: manualTitle?.trim() || meta.title,
          platform: meta.platform,
          sourceAuthor: manualAuthor?.trim() || meta.sourceAuthor,
        },
      };
    }

    const video = await prisma.video.create({
      data: {
        title: manualTitle?.trim() || meta.title,
        url: meta.url,
        platform: meta.platform,
        thumbnailUrl: meta.thumbnailUrl,
        duration: meta.duration,
        sourceAuthor: manualAuthor?.trim() || meta.sourceAuthor,
        userId,
      },
    });

    await prisma.userVideo.create({ data: { userId, videoId: video.id } });

    tagVideo({
      id: video.id,
      title: video.title,
      platform: video.platform,
      duration: video.duration,
      sourceAuthor: video.sourceAuthor,
    }).then((result) => {
      if (result) saveTagsToDb(video.id, result.tags);
    }).catch((error) => console.warn("[ai-tagging] bg job failed:", error));

    logEvent("video_import_quality_checked", {
      userId,
      videoId: video.id,
      platform: video.platform,
      qualityLevel: quality.level,
      confirmed: confirmQuality === true,
    });

    return { video, existed: false, quality };
  } catch (error) {
    if (!(error instanceof ApiError)) {
      logEvent("video_import_failed", {
        userId,
        reason: "server_exception",
        error: error instanceof Error ? error.message : "unknown",
      });
    }
    throw error;
  }
}

export async function listVideos(options: ListVideosOptions) {
  const where: Record<string, unknown> = {};

  if (options.platform) {
    where.platform = options.platform;
  }

  if (options.search) {
    where.OR = [
      { title: { contains: options.search } },
      { sourceAuthor: { contains: options.search } },
    ];
  }

  if (options.tag) {
    where.tags = {
      some: {
        tag: { nameZh: options.tag },
      },
    };
  }

  const [videos, total] = await Promise.all([
    prisma.video.findMany({
      where,
      include: {
        tags: {
          include: { tag: true },
        },
      },
      orderBy: { createdAt: "desc" },
      skip: (options.page - 1) * options.limit,
      take: options.limit,
    }),
    prisma.video.count({ where }),
  ]);

  return {
    videos: videos.map((video) => ({
      id: video.id,
      title: video.title,
      url: video.url,
      platform: video.platform,
      duration: video.duration,
      thumbnailUrl: video.thumbnailUrl,
      sourceAuthor: video.sourceAuthor,
      tags: video.tags.map((videoTag) => ({
        id: videoTag.tag.id,
        name: videoTag.tag.name,
        category: videoTag.tag.category,
        nameZh: videoTag.tag.nameZh,
        confidence: videoTag.confidence,
      })),
    })),
    total,
    page: options.page,
    totalPages: Math.ceil(total / options.limit),
  };
}

export async function removeVideoFromCollection(userId: string, videoId: string) {
  const userVideo = await assertVideoImported(videoId, userId);
  await prisma.userVideo.delete({ where: { id: userVideo.id } });
  return { success: true };
}

export async function updateVideo(userId: string, videoId: string, input: VideoUpdateInput) {
  await assertVideoOwner(videoId, userId);

  const data: Record<string, string> = {};

  if (input.title !== undefined) {
    if (typeof input.title !== "string" || input.title.trim().length === 0 || input.title.length > 200) {
      throw new ApiError(400, "标题为必填且不能超过 200 字", "INVALID_PARAMS");
    }
    data.title = input.title.trim();
  }

  if (input.sourceAuthor !== undefined) {
    if (
      typeof input.sourceAuthor !== "string" ||
      input.sourceAuthor.trim().length === 0 ||
      input.sourceAuthor.length > 60
    ) {
      throw new ApiError(400, "作者名为必填且不能超过 60 字", "INVALID_PARAMS");
    }
    data.sourceAuthor = input.sourceAuthor.trim();
  }

  if (Object.keys(data).length === 0) {
    throw new ApiError(400, "没有可更新的字段", "INVALID_PARAMS");
  }

  return prisma.video.update({ where: { id: videoId }, data });
}

export async function getVideo(videoId: string, userId: string | null) {
  const video = await prisma.video.findUnique({
    where: { id: videoId },
    include: {
      tags: { include: { tag: true } },
      collections: { select: { userId: true } },
      feedbacks: {
        include: { user: { select: { name: true } } },
        orderBy: { createdAt: "desc" },
        take: 10,
      },
      _count: { select: { feedbacks: true, collections: true } },
    },
  });

  if (!video) {
    throw new ApiError(404, "视频不存在", "NOT_FOUND");
  }

  const totalFeedbacks = video._count.feedbacks;
  const recommendCount = video.feedbacks.filter((feedback) => feedback.recommend).length;
  const difficultyCounts = { too_easy: 0, just_right: 0, too_hard: 0 };

  for (const feedback of video.feedbacks) {
    difficultyCounts[feedback.difficultyRating as keyof typeof difficultyCounts]++;
  }

  return {
    id: video.id,
    title: video.title,
    url: video.url,
    platform: video.platform,
    duration: video.duration,
    thumbnailUrl: video.thumbnailUrl,
    sourceAuthor: video.sourceAuthor,
    isImported: userId ? video.collections.some((userVideo) => userVideo.userId === userId) : false,
    importCount: video._count.collections,
    tags: video.tags.map((videoTag) => ({
      id: videoTag.tag.id,
      name: videoTag.tag.name,
      category: videoTag.tag.category,
      nameZh: videoTag.tag.nameZh,
      confidence: videoTag.confidence,
      source: videoTag.source,
      evidence: videoTag.evidence,
    })),
    feedbackSummary: {
      total: totalFeedbacks,
      recommendRate: totalFeedbacks > 0 ? Math.round((recommendCount / totalFeedbacks) * 100) : 0,
      difficultyCounts,
    },
    recentFeedbacks: video.feedbacks.map((feedback) => ({
      id: feedback.id,
      userName: feedback.user.name,
      difficultyRating: feedback.difficultyRating,
      bodyFeeling: feedback.bodyFeeling,
      completionRate: feedback.completionRate,
      recommend: feedback.recommend,
      notes: feedback.notes,
      createdAt: feedback.createdAt,
    })),
  };
}
