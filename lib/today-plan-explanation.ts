import { isEmbeddablePlatform } from "./platform";
import type { CollectionInsight, PlanVideo, TodayPlanResult, VideoWithTags } from "./today-plan";

type PlanExplanation = NonNullable<TodayPlanResult["explanation"]>;

function getVideoPhaseLabel(note: string): string {
  if (note === "warmup") return "热身";
  if (note === "stretch") return "拉伸";
  return "主训练";
}

function getVideoGoalTags(video: NonNullable<VideoWithTags> | undefined, goals: string[]): string[] {
  return video?.tags
    ?.filter((vt) => vt.tag.category === "goal" && goals.includes(vt.tag.nameZh))
    .map((vt) => vt.tag.nameZh) ?? [];
}

function getRiskVideoCount(userVideos: NonNullable<VideoWithTags>[], bodyConditions: string[]): number {
  if (bodyConditions.length === 0) return 0;

  return userVideos.filter((video) => video.tags.some((vt) => {
    if (vt.tag.category !== "contraindication") return false;
    return (bodyConditions.includes("膝盖不适") && vt.tag.nameZh === "膝部禁忌") ||
      (bodyConditions.includes("腰椎问题") && vt.tag.nameZh === "腰部禁忌");
  })).length;
}

export function buildPlanExplanation(params: {
  finalVideos: PlanVideo[];
  userVideos: NonNullable<VideoWithTags>[];
  recommendations: NonNullable<VideoWithTags>[];
  insights: CollectionInsight;
  goals: string[];
  bodyConditions: string[];
  availableMinutes: number;
  feedbackAdjustment: string | null;
}): PlanExplanation {
  const { finalVideos, userVideos, recommendations, insights, goals, bodyConditions, availableMinutes, feedbackAdjustment } = params;
  const userVideoIdSet = new Set(userVideos.map((v) => v.id));
  const allVideosMap = new Map([...userVideos, ...recommendations].map((v) => [v.id, v]));
  const actualMinutes = Math.max(1, Math.round(finalVideos.reduce((sum, video) => sum + (video.duration || 0), 0) / 60));

  const items: PlanExplanation["items"] = [];

  if (feedbackAdjustment) {
    items.push({
      label: "反馈调整",
      detail: feedbackAdjustment,
      tone: "feedback",
    });
  }

  items.push(...finalVideos.map((video) => {
    const phaseLabel = getVideoPhaseLabel(video.note);
    const fullVideo = allVideosMap.get(video.id);
    const goalTags = getVideoGoalTags(fullVideo, goals);

    if (userVideoIdSet.has(video.id)) {
      const detail = goalTags.length > 0
        ? `${phaseLabel}来自你的收藏，匹配${goalTags.slice(0, 2).join("+")}目标`
        : `${phaseLabel}来自你的收藏，放在这里用于衔接完整训练`;
      return { label: "来自收藏", detail, tone: "collection" as const, videoId: video.id };
    }

    const missingText = video.note === "warmup"
      ? "你的收藏中缺少热身内容，系统补齐开场激活"
      : video.note === "stretch"
        ? "你的收藏中缺少拉伸内容，系统补齐训练后的恢复环节"
        : "你的收藏中主训练数量不足，系统用相近目标内容补位";
    return { label: "推荐补位", detail: missingText, tone: "fill" as const, videoId: video.id };
  }));

  const riskCount = getRiskVideoCount(userVideos, bodyConditions);
  if (bodyConditions.length > 0) {
    items.push({
      label: "风险避开",
      detail: riskCount > 0
        ? `考虑到${bodyConditions.join("、")}，已避开 ${riskCount} 个可能不适合的收藏视频`
        : `考虑到${bodyConditions.join("、")}，优先选择低冲击、可完成的内容`,
      tone: "warn",
    });
  } else if (insights.riskWarnings.length > 0) {
    items.push({
      label: "风险避开",
      detail: `收藏中存在${insights.riskWarnings.slice(0, 2).join("、")}，今日方案已降低相关风险`,
      tone: "warn",
    });
  }

  const embeddableCount = finalVideos.filter((v) => isEmbeddablePlatform(v.platform)).length;
  if (embeddableCount === finalVideos.length && finalVideos.length > 0) {
    items.push({ label: "播放优化", detail: "本次方案全部支持站内播放，适合连续跟练", tone: "playback" });
  } else if (embeddableCount > 0 && embeddableCount >= Math.ceil(finalVideos.length / 2)) {
    items.push({ label: "播放优化", detail: `优先保留 ${embeddableCount} 个站内可播放视频，减少跟练中断`, tone: "playback" });
  }

  const topGoalText = insights.topGoals.length > 0
    ? insights.topGoals.slice(0, 2).join("和")
    : (goals.length > 0 ? goals.slice(0, 2).join("和") : "运动");
  const timeText = actualMinutes <= availableMinutes
    ? `方案约 ${actualMinutes} 分钟，落在你的 ${availableMinutes} 分钟空档内`
    : `方案约 ${actualMinutes} 分钟，略高于你的 ${availableMinutes} 分钟空档`;
  const summary = `你的收藏最近更偏向${topGoalText}训练，${timeText}，所以今天优先安排低门槛、可连续跟练的组合。`;

  return {
    summary,
    items,
    goal: `约 ${actualMinutes} 分钟内完成一次完整训练`,
  };
}
