import { prisma } from "./prisma";
import { getRecommendations, type CollectionTagProfile } from "./recommendation";
import {
  PHASE_TAGS,
  classifyVideos,
  getScoreBreakdown,
  getReasons,
  parseTimeBudget,
  pick,
  scoreVideo,
  trimToBudget,
} from "./today-plan-scoring";
import { getFeedbackHash, getFeedbackSignals } from "./today-plan-feedback";
import { buildPlanExplanation } from "./today-plan-explanation";
import { extractCollectionProfile, getCollectionInsights } from "./today-plan-insights";
import { assessPlanQuality, type PlanQualityReport } from "./today-plan-quality";

export { extractCollectionProfile, getCollectionInsights, getFeedbackHash };

export const TODAY_PLAN_VERSION = "feedback-loop-v1";

export interface PlanVideo {
  id: string;
  title: string;
  url: string;
  platform: string;
  duration: number | null;
  sourceAuthor: string;
  note: string;
  repeatCount: number;
  matchReasons: string[];
  phaseReason: string;
  scoreBreakdown: Array<{
    rule: string;
    label: string;
    delta: number;
    field?: string;
    value?: string;
  }>;
}

export interface CollectionInsight {
  topGoals: string[];
  preferredDurations: string[];
  missingPhases: string[];
  riskWarnings: string[];
  trainingTendency: string;
  systemJudgment: string;
  gapText: string;
  nextAction: string;
  actionLabel: string;
  actionLink: string;
}

export type VideoWithTags = Awaited<ReturnType<typeof prisma.video.findFirst<{ include: { tags: { include: { tag: true } } } }>>>;

export interface TodayPlanResult {
  todayVideos: PlanVideo[];
  goalText: string;
  sourceText: string;
  insights: CollectionInsight | null;
  feedbackAdjustment?: string | null;
  quality?: PlanQualityReport | null;
  explanation?: {
    summary: string;
    items: Array<{
      label: string;
      detail: string;
      tone: "collection" | "fill" | "warn" | "playback" | "feedback";
      videoId?: string;
      evidence?: {
        type: string;
        field?: string;
        value?: string;
        sourceCount?: number;
        rule?: string;
      };
    }>;
    goal: string;
  } | null;
}

function toPlanVideo(
  video: NonNullable<VideoWithTags> & { note: string; repeatCount?: number },
  profile: { goals: string; equipment: string; bodyConditions: string; fitnessLevel: string },
  feedbackSignals?: Awaited<ReturnType<typeof getFeedbackSignals>>,
): PlanVideo {
  const reasons = getReasons(video, profile, video.note);
  return {
    id: video.id,
    title: video.title,
    url: video.url,
    platform: video.platform,
    duration: video.duration,
    sourceAuthor: video.sourceAuthor,
    note: video.note,
    repeatCount: video.repeatCount || 1,
    matchReasons: reasons.matchReasons,
    phaseReason: reasons.phaseReason,
    scoreBreakdown: getScoreBreakdown(video, profile, feedbackSignals).slice(0, 6),
  };
}

async function getRecommendationVideos(userId: string, collectionProfile: CollectionTagProfile | null) {
  const recs = await getRecommendations(userId, 5, "workout_plan", collectionProfile);
  return prisma.video.findMany({
    where: { id: { in: recs.map((r) => r.videoId) } },
    include: { tags: { include: { tag: true } } },
  }) as Promise<NonNullable<VideoWithTags>[]>;
}

export async function generateTodayPlan(
  userId: string,
  profile: { goals: string; equipment: string; bodyConditions: string; fitnessLevel: string; availableTime: string },
  userVideos: NonNullable<VideoWithTags>[],
  collectionProfile: CollectionTagProfile | null,
  options?: { currentVideoIds?: string[]; refreshCount?: number },
): Promise<TodayPlanResult> {
  const goals = JSON.parse(profile.goals) as string[];
  const goalText = goals.length > 0 ? `${goals.join("·")}训练` : "综合训练";
  const timeBudget = parseTimeBudget(profile.availableTime);
  const feedbackSignals = await getFeedbackSignals(userId);

  if (userVideos.length === 0) {
    const recVideos = await getRecommendationVideos(userId, null);
    const phaseOrder = ["warmup", "main", "main", "main", "stretch"];
    const todayVideos = recVideos.slice(0, 5).map((v, i) => (
      toPlanVideo({ ...v, note: phaseOrder[i] || "main", repeatCount: 1 }, profile, feedbackSignals)
    ));
    const finalVideos = trimToBudget(todayVideos, timeBudget);
    const quality = await assessPlanQuality({
      userId,
      finalVideos,
      userVideos,
      profile,
      timeBudgetSeconds: timeBudget,
    });

    return {
      todayVideos: finalVideos,
      goalText,
      sourceText: "基于你的运动画像自动生成，添加收藏后会优先使用你真正想练的内容",
      insights: null,
      feedbackAdjustment: feedbackSignals.summary,
      quality,
      explanation: null,
    };
  }

  const userVideoIds = new Set(userVideos.map((v) => v.id));
  const { currentVideoIds, refreshCount } = options || {};
  const allExcludeIds = currentVideoIds;
  const libExcludeIds = currentVideoIds?.filter((id) => !userVideoIds.has(id));
  const excludeIds = refreshCount !== undefined && refreshCount >= 2 ? allExcludeIds : libExcludeIds;

  const { warmups, mains, stretches } = classifyVideos(userVideos);
  const sortedWarmups = [...warmups].sort((a, b) => scoreVideo(b, profile, feedbackSignals) - scoreVideo(a, profile, feedbackSignals));
  const sortedStretches = [...stretches].sort((a, b) => scoreVideo(b, profile, feedbackSignals) - scoreVideo(a, profile, feedbackSignals));
  const sortedMains = [...mains].sort((a, b) => {
    const diff = scoreVideo(b, profile, feedbackSignals) - scoreVideo(a, profile, feedbackSignals);
    if (diff !== 0) return diff;
    return (a.duration || 9999) - (b.duration || 9999);
  });

  const selectedWarmup = pick(sortedWarmups, 1, excludeIds);
  const selectedMain = pick(sortedMains, 2, excludeIds);
  const selectedStretch = pick(sortedStretches, 1, excludeIds);

  let recommendations: NonNullable<VideoWithTags>[] = [];
  if (selectedWarmup.length === 0 || selectedStretch.length === 0 || selectedMain.length < 2) {
    recommendations = await getRecommendationVideos(userId, collectionProfile);
  }

  const finalWarmup = selectedWarmup.length > 0
    ? selectedWarmup
    : pick(recommendations.filter((v) => v.tags.some((vt) => PHASE_TAGS.warmup.includes(vt.tag.nameZh))), 1, excludeIds);
  const finalStretch = selectedStretch.length > 0
    ? selectedStretch
    : pick(recommendations.filter((v) => v.tags.some((vt) => PHASE_TAGS.stretch.includes(vt.tag.nameZh))), 1, excludeIds);
  const finalMain = selectedMain.length >= 2
    ? selectedMain
    : [
        ...selectedMain,
        ...pick(recommendations.filter((v) =>
          !v.tags.some((vt) => [...PHASE_TAGS.warmup, ...PHASE_TAGS.stretch].includes(vt.tag.nameZh))
        ), 2 - selectedMain.length, excludeIds),
      ];

  const todayVideos = [
    ...finalWarmup.map((v) => ({ ...v, note: "warmup", repeatCount: 1 })),
    ...finalMain.map((v) => ({ ...v, note: "main", repeatCount: 1 })),
    ...finalStretch.map((v) => ({ ...v, note: "stretch", repeatCount: 1 })),
  ].map((v) => toPlanVideo(v, profile, feedbackSignals));

  const finalVideos = trimToBudget(todayVideos, timeBudget);
  const fromCollection = finalVideos.filter((v) => userVideos.some((uv) => uv.id === v.id)).length;
  const sourceText = `基于你收藏的 ${userVideos.length} 个视频生成，其中 ${fromCollection} 个来自你的收藏`;
  const insights = getCollectionInsights(userVideos, warmups, stretches, profile);
  const quality = await assessPlanQuality({
    userId,
    finalVideos,
    userVideos,
    profile,
    timeBudgetSeconds: timeBudget,
  });
  const explanation = buildPlanExplanation({
    finalVideos,
    userVideos,
    recommendations,
    insights,
    goals,
    bodyConditions: JSON.parse(profile.bodyConditions) as string[],
    availableMinutes: Math.floor(timeBudget / 60),
    feedbackAdjustment: feedbackSignals.summary,
  });
  const qualityItems = quality.issues
    .filter((issue) => issue.severity === "critical" || issue.severity === "warning")
    .map((issue) => ({
      label: issue.severity === "critical" ? "质检拦截" : "质检提醒",
      detail: issue.detail,
      tone: "warn" as const,
      evidence: {
        type: "plan_quality",
        field: issue.evidence.field,
        value: issue.evidence.value,
        rule: issue.evidence.rule,
      },
    }));
  const explanationWithQuality = explanation
    ? { ...explanation, items: [...qualityItems, ...explanation.items] }
    : explanation;

  return {
    todayVideos: finalVideos,
    goalText,
    sourceText,
    insights,
    feedbackAdjustment: feedbackSignals.summary,
    quality,
    explanation: explanationWithQuality,
  };
}
