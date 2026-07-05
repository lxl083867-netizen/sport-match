import { prisma } from "./prisma";
import type { FeedbackSignals } from "./today-plan-scoring";

function bumpTagCount(target: Record<string, number>, name: string) {
  target[name] = (target[name] || 0) + 1;
}

export async function getFeedbackHash(userId: string): Promise<string> {
  const feedbacks = await prisma.userFeedback.findMany({
    where: { userId },
    select: {
      videoId: true,
      difficultyRating: true,
      bodyFeeling: true,
      completionRate: true,
      recommend: true,
      notes: true,
    },
    orderBy: { videoId: "asc" },
  });

  let hash = 0;
  const str = JSON.stringify(feedbacks);
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash) + str.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash).toString(36);
}

export async function getFeedbackSignals(userId: string): Promise<FeedbackSignals> {
  const feedbacks = await prisma.userFeedback.findMany({
    where: { userId },
    include: { video: { include: { tags: { include: { tag: true } } } } },
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  const signals: FeedbackSignals = {
    summary: null,
    dislikedVideoIds: new Set(),
    likedVideoIds: new Set(),
    hardTagCounts: {},
    easyTagCounts: {},
    dislikedTagCounts: {},
    likedTagCounts: {},
    painContraTags: new Set(),
    recentTooHard: false,
    recentTooEasy: false,
  };

  const recent = feedbacks[0];
  if (recent) {
    signals.recentTooHard = recent.difficultyRating === "too_hard";
    signals.recentTooEasy = recent.difficultyRating === "too_easy";

    if (!recent.recommend) {
      signals.summary = "上次你标记了不太想练，今天已降低相似内容权重。";
    } else if (recent.difficultyRating === "too_hard") {
      signals.summary = "上次你觉得强度偏高，今天已降低高强度和超长视频权重。";
    } else if (recent.difficultyRating === "too_easy") {
      signals.summary = "上次你觉得偏轻，今天会提高主训练和中等强度内容权重。";
    } else if (recent.recommend) {
      signals.summary = "上次你表示还想练类似内容，今天会保留相近目标和节奏。";
    }
  }

  for (const fb of feedbacks) {
    if (!fb.recommend) signals.dislikedVideoIds.add(fb.videoId);
    if (fb.recommend) signals.likedVideoIds.add(fb.videoId);
    if (fb.bodyFeeling === "knee_pain") signals.painContraTags.add("膝部禁忌");
    if (fb.bodyFeeling === "back_pain") signals.painContraTags.add("腰部禁忌");
    if (fb.bodyFeeling === "shoulder_pain") signals.painContraTags.add("肩部禁忌");

    for (const vt of fb.video.tags) {
      const tagName = vt.tag.nameZh;
      if (fb.difficultyRating === "too_hard" || fb.completionRate === "abandoned") {
        bumpTagCount(signals.hardTagCounts, tagName);
      }
      if (fb.difficultyRating === "too_easy") {
        bumpTagCount(signals.easyTagCounts, tagName);
      }
      if (!fb.recommend) {
        bumpTagCount(signals.dislikedTagCounts, tagName);
      }
      if (fb.recommend && fb.completionRate === "fully") {
        bumpTagCount(signals.likedTagCounts, tagName);
      }
    }
  }

  return signals;
}
