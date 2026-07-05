import { prisma } from "./prisma";

// 推荐上下文：不同场景对平台嵌入性有不同偏好
export type RecommendationContext = "workout_plan" | "discovery" | "single_video";

// 用户画像接口
interface UserProfileTags {
  goals: string[];
  fitnessLevel: string;
  bodyConditions: string[];
  equipment: string[];
  availableTime: string;
  contraindications: string[];
}

// 收藏意图标签画像
export interface CollectionTagProfile {
  topTags: string[];
  tagFreq: Record<string, number>;
  dominantCategories: string[]; // goal, muscle, type tags with highest freq
}

// 推荐结果
interface RecommendationResult {
  videoId: string;
  title: string;
  url: string;
  platform: string;
  sourceAuthor: string;
  thumbnailUrl: string | null;
  duration: number | null;
  tags: { name: string; category: string; nameZh: string }[];
  matchScore: number;
  matchReasons: string[];
}

// ── Completability-first scoring weights ──
// Tier 1: Safety (hard filters, highest magnitude)
const W_CONTRAINDICATION = -30;       // absolute blocker penalty
const W_BODY_SIGNAL = -25;            // past knee/back pain → avoid similar
const W_BODY_CONDITION = 12;          // rehab-appropriate videos

// Tier 2: Completable (duration fit is king)
const W_DURATION_EXACT = 20;          // exact time-range match
const W_DURATION_ADJACENT = 10;       // adjacent time-range
const W_DURATION_TOO_LONG = -10;      // video longer than user's available time
const W_COMPLETION_TAG = 8;           // tag matches user's historically completed videos
const W_ABANDONED_TAG = -6;           // tag matches user's historically abandoned videos

// Tier 3: Goal alignment
const W_GOAL = 8;                     // goal tag match (down from 10)
const W_MUSCLE = 3;                   // muscle tag match (down from 5)

// Tier 4: Accessibility
const W_EMBEDDABLE = 10;              // bilibili embeddable bonus (up from 8)
const W_EXTERNAL = -6;                // external link penalty (stronger than -4)
const W_EQUIPMENT = 5;                // equipment match (slightly down from 6)

// Tier 5: Experience fit
const W_FITNESS_LEVEL = 5;            // audience/fitness match (down from 8)

// Tier 6: Content affinity (lowest weight)
const W_COLLECTION_INTENT = 3;        // collection intent tag similarity (down from 7)
const W_COLLECTION_OTHER = 2;         // non-intent collection tag (down from 4)
const W_POPULARITY = 1;               // per checkIn count, capped

// ── User historical completion profile ──

interface CompletionProfile {
  completedTagCounts: Record<string, number>;  // tags from fully-completed videos
  abandonedTagCounts: Record<string, number>;  // tags from abandoned videos
  completedVideoIds: Set<string>;
  abandonedVideoIds: Set<string>;
}

async function getCompletionProfile(userId: string): Promise<CompletionProfile> {
  const feedbacks = await prisma.userFeedback.findMany({
    where: { userId },
    include: { video: { include: { tags: { include: { tag: true } } } } },
  });

  const completedTagCounts: Record<string, number> = {};
  const abandonedTagCounts: Record<string, number> = {};
  const completedVideoIds = new Set<string>();
  const abandonedVideoIds = new Set<string>();

  for (const fb of feedbacks) {
    if (fb.completionRate === "fully") {
      completedVideoIds.add(fb.videoId);
      for (const vt of fb.video.tags) {
        completedTagCounts[vt.tag.nameZh] = (completedTagCounts[vt.tag.nameZh] || 0) + 1;
      }
    } else if (fb.completionRate === "abandoned") {
      abandonedVideoIds.add(fb.videoId);
      for (const vt of fb.video.tags) {
        abandonedTagCounts[vt.tag.nameZh] = (abandonedTagCounts[vt.tag.nameZh] || 0) + 1;
      }
    }
  }

  return { completedTagCounts, abandonedTagCounts, completedVideoIds, abandonedVideoIds };
}

// ── Duration match scoring ──

function scoreDuration(durationTags: string[], availableTime: string): { score: number; reason: string | null } {
  if (durationTags.length === 0 || !availableTime) return { score: 0, reason: null };

  const userMinutes = parseInt(availableTime) || 30;
  const tagMinutesMap: Record<string, { min: number; max: number }> = {
    "15分钟以下": { min: 0, max: 15 },
    "15分钟以内": { min: 0, max: 15 },
    "15-30分钟": { min: 15, max: 30 },
    "30-60分钟": { min: 30, max: 60 },
    "30分钟以上": { min: 30, max: 999 },
    "60分钟以上": { min: 60, max: 999 },
  };

  let bestScore = 0;
  let bestReason: string | null = null;

  for (const dt of durationTags) {
    const range = tagMinutesMap[dt];
    if (!range) continue;

    if (userMinutes >= range.min && userMinutes <= range.max) {
      // Exact match: user's available time falls within this video's duration range
      bestScore = Math.max(bestScore, W_DURATION_EXACT);
      bestReason = `时长${dt}刚好适合你`;
    } else if (userMinutes >= range.max && range.max < 999) {
      // Adjacent: user has more time than this range needs
      bestScore = Math.max(bestScore, W_DURATION_ADJACENT);
      bestReason = `时长${dt}可轻松完成`;
    } else if (userMinutes < range.min) {
      // Video is longer than user's available time
      bestScore = Math.min(bestScore, W_DURATION_TOO_LONG);
      bestReason = `时长${dt}可能超出你的时间`;
    }
  }

  return { score: bestScore, reason: bestReason };
}

// 从用户收藏视频中提取意图标签画像
export async function getCollectionTagProfile(userId: string): Promise<CollectionTagProfile | null> {
  const myVideoIds = (await prisma.userVideo.findMany({ where: { userId }, select: { videoId: true }, take: 50 })).map((uv) => uv.videoId);
  if (myVideoIds.length === 0) return null;
  const userVideos = await prisma.video.findMany({
    where: { id: { in: myVideoIds } },
    include: { tags: { include: { tag: true } } },
    take: 50,
  });

  if (userVideos.length === 0) return null;

  const tagFreq: Record<string, number> = {};
  const catTags: Record<string, string[]> = {};

  for (const v of userVideos) {
    for (const vt of v.tags) {
      const name = vt.tag.nameZh;
      tagFreq[name] = (tagFreq[name] || 0) + 1;
      if (!catTags[vt.tag.category]) catTags[vt.tag.category] = [];
      if (!catTags[vt.tag.category].includes(name)) {
        catTags[vt.tag.category].push(name);
      }
    }
  }

  // Top tags by frequency (exclude structural phase tags)
  const topTags = Object.entries(tagFreq)
    .filter(([name]) => !["热身激活", "热身", "冷身拉伸", "拉伸", "放松"].includes(name))
    .sort(([, a], [, b]) => b - a)
    .slice(0, 10)
    .map(([name]) => name);

  // Dominant categories: goal, muscle, type (categories that define "what" the user trains)
  const intentCategories = ["goal", "muscle", "type"];
  const dominantCategories = intentCategories.filter((c) => catTags[c] && catTags[c].length > 0);

  return { topTags, tagFreq, dominantCategories };
}

export async function getRecommendations(
  userId: string,
  limit = 10,
  context: RecommendationContext = "discovery",
  collectionProfile: CollectionTagProfile | null = null
): Promise<RecommendationResult[]> {
  // 1. 获取用户画像
  const profile = await prisma.userProfile.findUnique({ where: { userId } });
  if (!profile) return [];

  const profileTags: UserProfileTags = {
    goals: JSON.parse(profile.goals),
    fitnessLevel: profile.fitnessLevel,
    bodyConditions: JSON.parse(profile.bodyConditions),
    equipment: JSON.parse(profile.equipment),
    availableTime: profile.availableTime,
    contraindications: JSON.parse(profile.contraindications),
  };

  // 2. 获取用户历史完成数据（completability-first）
  const completionProfile = await getCompletionProfile(userId);

  // 3. 获取用户已反馈的视频（排除/降权）
  const feedbacks = await prisma.userFeedback.findMany({ where: { userId } });
  const fedbackVideoIds = new Set(feedbacks.map((f) => f.videoId));
  const dislikedVideoIds = new Set(
    feedbacks.filter((f) => !f.recommend).map((f) => f.videoId)
  );

  // 从反馈中提取身体禁忌信号
  const contraSignals = new Set<string>();
  for (const fb of feedbacks) {
    if (fb.bodyFeeling === "knee_pain") contraSignals.add("膝部禁忌");
    if (fb.bodyFeeling === "back_pain") contraSignals.add("腰部禁忌");
    if (fb.bodyFeeling === "shoulder_pain") contraSignals.add("肩部禁忌");
  }

  // 4. 获取所有视频及其标签 + checkin counts
  const allVideos = await prisma.video.findMany({
    include: {
      tags: { include: { tag: true } },
      _count: { select: { checkins: true } },
    },
  });

  // 5. 可完成性优先的匹配打分
  const scored = allVideos
    .map((video) => {
      let score = 0;
      const reasons: string[] = [];

      // Collect duration tags for separate scoring
      const durationTagNames: string[] = [];

      for (const vt of video.tags) {
        const tag = vt.tag;
        const confidence = vt.confidence;

        // ── Tier 1: Safety ──

        // 禁忌动作 → 硬惩罚
        if (tag.category === "contraindication") {
          if (contraSignals.has(tag.nameZh)) {
            score += W_CONTRAINDICATION * confidence;
            reasons.push(`⚠ 含不适合你的动作`);
          }
          // Also check profile-level contraindications
          if (profileTags.contraindications.includes(tag.nameZh)) {
            score += W_CONTRAINDICATION * confidence;
            reasons.push(`⚠ 与你的身体限制冲突`);
          }
        }

        // 身体信号匹配（既往膝盖/腰部不适）
        if (tag.category === "contraindication" && contraSignals.has(tag.nameZh)) {
          score += W_BODY_SIGNAL * confidence;
        }

        // 康复适配
        if (
          tag.category === "audience" &&
          profileTags.bodyConditions.length > 0 &&
          (tag.nameZh === "康复期" || tag.nameZh === "产后恢复")
        ) {
          score += W_BODY_CONDITION * confidence;
          reasons.push(`适配你的身体状况`);
        }

        // ── Tier 2: Completability ──

        // 历史完成标签匹配
        if (completionProfile.completedTagCounts[tag.nameZh]) {
          const freq = Math.min(completionProfile.completedTagCounts[tag.nameZh], 3);
          score += W_COMPLETION_TAG * freq * confidence;
          if (freq >= 2) reasons.push(`你之前顺利完成过类似${tag.nameZh}训练`);
        }

        // 历史放弃标签惩罚
        if (completionProfile.abandonedTagCounts[tag.nameZh]) {
          const freq = Math.min(completionProfile.abandonedTagCounts[tag.nameZh], 3);
          score += W_ABANDONED_TAG * freq * confidence;
        }

        // 收集时长标签
        if (tag.category === "duration") {
          durationTagNames.push(tag.nameZh);
        }

        // ── Tier 3: Goal alignment ──

        if (tag.category === "goal" && profileTags.goals.includes(tag.nameZh)) {
          score += W_GOAL * confidence;
          reasons.push(`匹配目标：${tag.nameZh}`);
        }

        if (tag.category === "muscle" && profileTags.goals.length > 0) {
          score += W_MUSCLE * confidence;
        }

        // ── Tier 4: Accessibility ──

        if (tag.category === "equipment" && profileTags.equipment.includes(tag.nameZh)) {
          score += W_EQUIPMENT * confidence;
          reasons.push(`器材匹配：${tag.nameZh}`);
        }

        // ── Tier 5: Experience fit ──
        if (tag.category === "audience") {
          if (
            (profileTags.fitnessLevel === "beginner" && tag.nameZh === "零基础") ||
            (profileTags.fitnessLevel === "intermediate" && tag.nameZh === "有经验") ||
            profileTags.fitnessLevel === "professional"
          ) {
            score += W_FITNESS_LEVEL * confidence;
            reasons.push(`适合${tag.nameZh}人群`);
          }
        }

        // 强度匹配
        if (tag.category === "intensity") {
          const level = profileTags.fitnessLevel;
          if (tag.nameZh === "高强度") {
            if (level === "beginner") score -= 12;
            else if (level === "intermediate") score += 3;
            else score += 8;
          } else if (tag.nameZh === "中强度") {
            if (level === "beginner") score += 6;
            else if (level === "intermediate") score += 5;
            else score -= 2;
          } else if (tag.nameZh === "低强度") {
            if (level === "beginner") score += 8;
            else if (level === "intermediate") score += 2;
            else score -= 6;
          }
          // 如果用户反馈过"太难"，避开高强度
          if (contraSignals.has("高强度") && tag.nameZh === "高强度") {
            score -= 15;
          }
        }
      }

      // ── Duration match (computed after tag loop) ──
      const durResult = scoreDuration(durationTagNames, profileTags.availableTime);
      score += durResult.score;
      if (durResult.reason) reasons.push(durResult.reason);

      // ── Tier 6: Content affinity (lowest weight) ──
      if (collectionProfile) {
        for (const vt of video.tags) {
          if (collectionProfile.topTags.includes(vt.tag.nameZh)) {
            const isIntentTag = ["goal", "muscle", "type"].includes(vt.tag.category);
            score += (isIntentTag ? W_COLLECTION_INTENT : W_COLLECTION_OTHER) * vt.confidence;
            if (isIntentTag) reasons.push(`与你收藏的「${vt.tag.nameZh}」相似`);
          }
        }
      }

      // ── Popularity boost (checkin count) ──
      const checkinCount = (video as any)._count?.checkins || 0;
      score += Math.min(checkinCount, 5) * W_POPULARITY;

      // ── Embeddable weighting (workout_plan only) ──
      if (context === "workout_plan") {
        if (video.platform === "bilibili") {
          score += W_EMBEDDABLE;
        } else {
          score += W_EXTERNAL;
        }
      }

      // ── Feedback-based adjustments ──
      // Previously completed → mild re-recommend boost
      if (completionProfile.completedVideoIds.has(video.id)) {
        score += 3;
      }
      // Previously abandoned → avoid
      if (completionProfile.abandonedVideoIds.has(video.id)) {
        score -= 15;
      }
      // Previously fed back → mild demotion (variety)
      if (fedbackVideoIds.has(video.id)) {
        score *= 0.3;
      }
      // Disliked → exclude
      if (dislikedVideoIds.has(video.id)) {
        score = -999;
      }

      return {
        videoId: video.id,
        title: video.title,
        url: video.url,
        platform: video.platform,
        sourceAuthor: video.sourceAuthor,
        thumbnailUrl: video.thumbnailUrl,
        duration: video.duration,
        tags: video.tags.map((vt) => ({
          name: vt.tag.name,
          category: vt.tag.category,
          nameZh: vt.tag.nameZh,
        })),
        matchScore: Math.round(score * 100) / 100,
        matchReasons: reasons.slice(0, 3),
      };
    })
    .filter((v) => v.matchScore > -100)
    .sort((a, b) => b.matchScore - a.matchScore)
    .slice(0, limit);

  return scored;
}

export async function generateDailyPlan(
  userId: string,
  context: RecommendationContext = "workout_plan"
): Promise<{
  videos: RecommendationResult[];
  reason: string;
}> {
  const profile = await prisma.userProfile.findUnique({ where: { userId } });
  if (!profile) return { videos: [], reason: "请先完成运动画像设置" };

  const goals = JSON.parse(profile.goals);
  const videos = await getRecommendations(userId, 5, context);

  const goalText = goals.length > 0 ? goals.join("、") : "综合训练";
  const today = new Date().toLocaleDateString("zh-CN", { weekday: "long" });

  return {
    videos,
    reason: `今天是${today}，根据你的「${goalText}」目标，为你推荐以下 ${videos.length} 个训练视频`,
  };
}
