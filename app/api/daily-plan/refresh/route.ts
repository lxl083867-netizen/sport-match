import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { generateTodayPlan, extractCollectionProfile, getFeedbackHash, TODAY_PLAN_VERSION, type VideoWithTags } from "@/lib/today-plan";
import crypto from "crypto";
import { requireUser } from "@/lib/guards";
import { err, handleApiError } from "@/lib/responses";
import { countBy, logEvent } from "@/lib/events";

const MAX_REFRESH = 3;

function computeProfileHash(profile: Record<string, unknown>, feedbackHash: string): string {
  const str = JSON.stringify({
    v: TODAY_PLAN_VERSION,
    fh: feedbackHash,
    g: profile.goals,
    f: profile.fitnessLevel,
    e: profile.equipment,
    b: profile.bodyConditions,
    t: profile.availableTime,
  });
  return crypto.createHash("sha256").update(str).digest("hex").slice(0, 16);
}

function parseVideoIds(value: string | null | undefined): string[] {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.filter((id): id is string => typeof id === "string") : [];
  } catch {
    return [];
  }
}

export async function POST() {
  try {
    const userId = await requireUser();
    const today = new Date().toISOString().slice(0, 10);

    const existing = await prisma.dailyRecommendation.findUnique({
      where: { userId_date: { userId, date: today } },
    });

    if (existing && existing.refreshCount >= MAX_REFRESH) {
      return err(429, "今日已用完 3 次更换机会，明天再来吧", "RATE_LIMITED");
    }

    const profile = await prisma.userProfile.findUnique({ where: { userId } });
    if (!profile) {
      return err(400, "请先设置运动画像", "INVALID_PARAMS");
    }

    const myVideoIds = (await prisma.userVideo.findMany({
      where: { userId },
      select: { videoId: true },
    })).map((uv) => uv.videoId);

    const userVideos: NonNullable<VideoWithTags>[] = myVideoIds.length > 0
      ? await prisma.video.findMany({
          where: { id: { in: myVideoIds } },
          include: { tags: { include: { tag: true } } },
          orderBy: { createdAt: "desc" },
          take: 30,
        })
      : [];

    const collectionProfile = extractCollectionProfile(userVideos);
    const profileFields = {
      goals: profile.goals,
      equipment: profile.equipment,
      bodyConditions: profile.bodyConditions,
      fitnessLevel: profile.fitnessLevel,
      availableTime: profile.availableTime || "30",
    };

    const currentVideoIds = parseVideoIds(existing?.videoIds);
    const newCount = existing ? existing.refreshCount + 1 : 0;

    const result = await generateTodayPlan(userId, profileFields, userVideos, collectionProfile, {
      currentVideoIds,
      refreshCount: newCount,
    });
    const profileHash = computeProfileHash(profileFields, await getFeedbackHash(userId));

    const planDataStr = JSON.stringify(result);
    const totalDuration = result.todayVideos.reduce((s, v) => s + (v.duration || 0), 0);

    await prisma.dailyRecommendation.upsert({
      where: { userId_date: { userId, date: today } },
      update: {
        planData: planDataStr,
        profileHash,
        refreshCount: newCount,
        videoIds: JSON.stringify(result.todayVideos.map((v) => v.id)),
        reason: `${result.goalText} · ${result.sourceText}`,
      },
      create: {
        userId,
        date: today,
        planData: planDataStr,
        profileHash,
        refreshCount: 0,
        videoIds: JSON.stringify(result.todayVideos.map((v) => v.id)),
        reason: `${result.goalText} · ${result.sourceText}`,
      },
    });

    logEvent("plan_refreshed", {
      userId,
      refreshCount: newCount,
      previousVideoCount: currentVideoIds.length,
      newVideoCount: result.todayVideos.length,
      totalDuration,
      collectionVideoCount: userVideos.length,
      hasCollection: userVideos.length > 0,
      platforms: JSON.stringify(countBy(result.todayVideos, (v) => v.platform)),
    });

    return NextResponse.json({
      plan: result,
      totalDuration,
      canRefresh: newCount < MAX_REFRESH,
      refreshCount: newCount,
    });
  } catch (e) {
    return handleApiError(e);
  }
}
