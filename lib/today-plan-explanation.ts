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
  const {
    finalVideos,
    userVideos,
    recommendations,
    insights,
    goals,
    bodyConditions,
    availableMinutes,
    feedbackAdjustment,
  } = params;
  const userVideoIdSet = new Set(userVideos.map((v) => v.id));
  const allVideosMap = new Map([...userVideos, ...recommendations].map((v) => [v.id, v]));
  const actualMinutes = Math.max(1, Math.round(finalVideos.reduce((sum, video) => sum + (video.duration || 0), 0) / 60));

  const items: PlanExplanation["items"] = [];

  if (feedbackAdjustment) {
    items.push({
      label: "反馈调整",
      detail: feedbackAdjustment,
      tone: "feedback",
      evidence: {
        type: "feedback_signal",
        field: "userFeedback",
        rule: "getFeedbackSignals.summary",
      },
    });
  }

  items.push(...finalVideos.map((video) => {
    const phaseLabel = getVideoPhaseLabel(video.note);
    const fullVideo = allVideosMap.get(video.id);
    const goalTags = getVideoGoalTags(fullVideo, goals);
    const strongestRule = video.scoreBreakdown[0];

    if (userVideoIdSet.has(video.id)) {
      const detail = goalTags.length > 0
        ? `${phaseLabel}来自你的导入内容，匹配${goalTags.slice(0, 2).join("+")}目标`
        : `${phaseLabel}来自你的导入内容，放在这里用于衔接完整训练`;
      return {
        label: "来自导入",
        detail,
        tone: "collection" as const,
        videoId: video.id,
        evidence: {
          type: "user_video",
          field: goalTags.length > 0 ? "profile.goals" : "userVideos",
          value: goalTags.join(",") || video.id,
          sourceCount: userVideos.length,
          rule: strongestRule?.rule,
        },
      };
    }

    const missingText = video.note === "warmup"
      ? "你的导入内容中缺少热身，系统补齐开场激活"
      : video.note === "stretch"
        ? "你的导入内容中缺少拉伸，系统补齐训练后的恢复环节"
        : "你的导入内容中主训练数量不足，系统用相近目标内容补位";
    return {
      label: "推荐补位",
      detail: missingText,
      tone: "fill" as const,
      videoId: video.id,
      evidence: {
        type: "phase_gap",
        field: "insights.missingPhases",
        value: video.note,
        sourceCount: recommendations.length,
        rule: strongestRule?.rule || "phase_gap_fill",
      },
    };
  }));

  const riskCount = getRiskVideoCount(userVideos, bodyConditions);
  if (bodyConditions.length > 0) {
    items.push({
      label: "风险避开",
      detail: riskCount > 0
        ? `考虑到${bodyConditions.join("、")}，已避开 ${riskCount} 个可能不适合的导入视频`
        : `考虑到${bodyConditions.join("、")}，优先选择低冲击、可完成的内容`,
      tone: "warn",
      evidence: {
        type: "body_condition",
        field: "profile.bodyConditions",
        value: bodyConditions.join(","),
        sourceCount: riskCount,
        rule: "profile_contraindication",
      },
    });
  } else if (insights.riskWarnings.length > 0) {
    items.push({
      label: "风险避开",
      detail: `导入内容中存在${insights.riskWarnings.slice(0, 2).join("、")}，今日方案已降低相关风险`,
      tone: "warn",
      evidence: {
        type: "collection_insight",
        field: "insights.riskWarnings",
        value: insights.riskWarnings.slice(0, 2).join(","),
        sourceCount: insights.riskWarnings.length,
        rule: "collection_risk_warning",
      },
    });
  }

  const embeddableCount = finalVideos.filter((v) => isEmbeddablePlatform(v.platform)).length;
  if (embeddableCount === finalVideos.length && finalVideos.length > 0) {
    items.push({
      label: "播放优化",
      detail: "本次方案全部支持站内播放，适合连续跟练",
      tone: "playback",
      evidence: {
        type: "platform_capability",
        field: "video.platform",
        value: "embeddable",
        sourceCount: embeddableCount,
        rule: "embeddable_all",
      },
    });
  } else if (embeddableCount > 0 && embeddableCount >= Math.ceil(finalVideos.length / 2)) {
    items.push({
      label: "播放优化",
      detail: `优先保留 ${embeddableCount} 个站内可播放视频，减少跟练中断`,
      tone: "playback",
      evidence: {
        type: "platform_capability",
        field: "video.platform",
        value: "embeddable",
        sourceCount: embeddableCount,
        rule: "embeddable_majority",
      },
    });
  }

  const topGoalText = insights.topGoals.length > 0
    ? insights.topGoals.slice(0, 2).join("和")
    : (goals.length > 0 ? goals.slice(0, 2).join("和") : "运动");
  const timeText = actualMinutes <= availableMinutes
    ? `方案约 ${actualMinutes} 分钟，落在你的 ${availableMinutes} 分钟空档内`
    : `方案约 ${actualMinutes} 分钟，略高于你的 ${availableMinutes} 分钟空档`;
  const summary = `你的导入内容最近更偏向${topGoalText}训练，${timeText}，所以今天优先安排低门槛、可连续跟练的组合。`;

  return {
    summary,
    items,
    goal: `约 ${actualMinutes} 分钟内完成一次完整训练`,
  };
}
