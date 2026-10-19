import { prisma } from "./prisma";
import { isEmbeddablePlatform } from "./platform";
import type { PlanVideo, VideoWithTags } from "./today-plan";

export type PlanQualitySeverity = "pass" | "notice" | "warning" | "critical";

export interface PlanQualityIssue {
  code: string;
  severity: PlanQualitySeverity;
  label: string;
  detail: string;
  evidence: {
    field: string;
    value: string;
    rule: string;
  };
}

export interface PlanQualityReport {
  passed: boolean;
  score: number;
  summary: string;
  issues: PlanQualityIssue[];
}

function parseJsonArray(value: string): string[] {
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function planSignals(video: PlanVideo): string[] {
  return video.scoreBreakdown.map((item) => item.value).filter((value): value is string => Boolean(value));
}

function totalMinutes(videos: PlanVideo[]): number {
  return Math.round(videos.reduce((sum, video) => sum + (video.duration || 0), 0) / 60);
}

async function getRecentPlanVideoIds(userId: string): Promise<Set<string>> {
  const records = await prisma.dailyRecommendation.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    take: 2,
  });

  const ids = new Set<string>();
  for (const record of records) {
    try {
      const parsed = JSON.parse(record.planData || "{}") as { todayVideos?: Array<{ id?: string }> };
      for (const video of parsed.todayVideos ?? []) {
        if (video.id) ids.add(video.id);
      }
    } catch {
      try {
        const fallback = JSON.parse(record.videoIds || "[]") as string[];
        fallback.forEach((id) => ids.add(id));
      } catch {
        // Ignore malformed historical cache.
      }
    }
  }

  return ids;
}

function pushIssue(
  issues: PlanQualityIssue[],
  issue: PlanQualityIssue,
) {
  issues.push(issue);
}

export async function assessPlanQuality(params: {
  userId: string;
  finalVideos: PlanVideo[];
  userVideos: NonNullable<VideoWithTags>[];
  profile: {
    goals: string;
    bodyConditions: string;
    fitnessLevel: string;
    availableTime: string;
  };
  timeBudgetSeconds: number;
}): Promise<PlanQualityReport> {
  const { userId, finalVideos, userVideos, profile, timeBudgetSeconds } = params;
  const issues: PlanQualityIssue[] = [];
  const userVideoIds = new Set(userVideos.map((video) => video.id));
  const goals = parseJsonArray(profile.goals);
  const bodyConditions = parseJsonArray(profile.bodyConditions);
  const budgetMinutes = Math.max(1, Math.round(timeBudgetSeconds / 60));
  const actualMinutes = totalMinutes(finalVideos);
  const fromImported = finalVideos.filter((video) => userVideoIds.has(video.id)).length;
  const fillCount = finalVideos.length - fromImported;
  const fillRatio = finalVideos.length > 0 ? fillCount / finalVideos.length : 0;
  const phases = new Set(finalVideos.map((video) => video.note));
  const recentVideoIds = await getRecentPlanVideoIds(userId);
  const repeatCount = finalVideos.filter((video) => recentVideoIds.has(video.id)).length;
  const highIntensity = finalVideos.filter((video) => planSignals(video).includes("高强度"));
  const embeddableCount = finalVideos.filter((video) => isEmbeddablePlatform(video.platform)).length;

  if (finalVideos.length === 0) {
    pushIssue(issues, {
      code: "empty_plan",
      severity: "critical",
      label: "方案为空",
      detail: "没有生成可执行的视频，今日方案不能直接给用户。",
      evidence: { field: "todayVideos.length", value: "0", rule: "must_have_videos" },
    });
  }

  if (actualMinutes > Math.ceil(budgetMinutes * 1.25)) {
    pushIssue(issues, {
      code: "over_time_budget",
      severity: "warning",
      label: "时长偏长",
      detail: `当前约 ${actualMinutes} 分钟，明显超过用户 ${budgetMinutes} 分钟的可用时间。`,
      evidence: { field: "profile.availableTime", value: `${budgetMinutes}->${actualMinutes}`, rule: "actual_minutes <= budget * 1.25" },
    });
  } else {
    pushIssue(issues, {
      code: "time_budget_ok",
      severity: "pass",
      label: "时长可完成",
      detail: `当前约 ${actualMinutes} 分钟，落在用户可接受时间附近。`,
      evidence: { field: "profile.availableTime", value: `${budgetMinutes}->${actualMinutes}`, rule: "actual_minutes <= budget * 1.25" },
    });
  }

  if (!phases.has("main")) {
    pushIssue(issues, {
      code: "missing_main",
      severity: "critical",
      label: "缺少主训练",
      detail: "方案没有主训练，只能算素材拼接，不能算一次完整训练。",
      evidence: { field: "todayVideos.note", value: [...phases].join(","), rule: "must_have_main" },
    });
  }
  if (!phases.has("warmup")) {
    pushIssue(issues, {
      code: "missing_warmup",
      severity: "notice",
      label: "缺少热身",
      detail: "当前方案缺少热身，适合后续用基础补位库补齐。",
      evidence: { field: "todayVideos.note", value: [...phases].join(","), rule: "prefer_warmup" },
    });
  }
  if (!phases.has("stretch")) {
    pushIssue(issues, {
      code: "missing_stretch",
      severity: "notice",
      label: "缺少拉伸",
      detail: "当前方案缺少拉伸，训练闭环感会弱一些。",
      evidence: { field: "todayVideos.note", value: [...phases].join(","), rule: "prefer_stretch" },
    });
  }

  if (userVideos.length > 0 && fromImported === 0) {
    pushIssue(issues, {
      code: "no_collection_anchor",
      severity: "critical",
      label: "缺少收藏锚点",
      detail: "用户已经导入内容，但今日方案没有使用任何一条导入视频，会削弱“懂我收藏”的感受。",
      evidence: { field: "UserVideo", value: `${userVideos.length}->0`, rule: "from_imported >= 1" },
    });
  } else if (userVideos.length > 0) {
    pushIssue(issues, {
      code: "collection_anchor_ok",
      severity: "pass",
      label: "保留收藏锚点",
      detail: `方案中有 ${fromImported} 条来自用户导入，仍然围绕用户自己的收藏展开。`,
      evidence: { field: "UserVideo", value: `${fromImported}/${finalVideos.length}`, rule: "from_imported >= 1" },
    });
  }

  if (fillRatio > 0.6 && userVideos.length > 0) {
    pushIssue(issues, {
      code: "too_much_fill",
      severity: "warning",
      label: "补位比例偏高",
      detail: `本次 ${fillCount} 条来自基础库/推荐补位，可能会显得不像从收藏生成。`,
      evidence: { field: "todayVideos.source", value: `${fillCount}/${finalVideos.length}`, rule: "fill_ratio <= 0.6" },
    });
  }

  if ((profile.fitnessLevel === "beginner" || bodyConditions.length > 0) && highIntensity.length > 0) {
    pushIssue(issues, {
      code: "high_intensity_risk",
      severity: "warning",
      label: "强度风险",
      detail: "当前方案包含高强度内容，但用户基础或身体条件可能不适合。",
      evidence: { field: "video.tags.intensity", value: highIntensity.map((video) => video.title).join(" | "), rule: "avoid_high_intensity_for_beginner_or_body_condition" },
    });
  }

  if (goals.length > 0) {
    const matchedGoalCount = finalVideos.filter((video) =>
      video.scoreBreakdown.some((item) => item.rule === "goal_match") ||
      planSignals(video).some((tag) => goals.includes(tag))
    ).length;
    if (matchedGoalCount === 0) {
      pushIssue(issues, {
        code: "goal_mismatch",
        severity: "warning",
        label: "目标响应不足",
        detail: `用户目标是 ${goals.slice(0, 2).join("、")}，但方案中没有明显目标匹配视频。`,
        evidence: { field: "profile.goals", value: goals.join(","), rule: "matched_goal_count >= 1" },
      });
    } else {
      pushIssue(issues, {
        code: "goal_match_ok",
        severity: "pass",
        label: "目标有响应",
        detail: `至少 ${matchedGoalCount} 条视频响应了用户目标。`,
        evidence: { field: "profile.goals", value: goals.join(","), rule: "matched_goal_count >= 1" },
      });
    }
  }

  if (repeatCount >= Math.max(2, finalVideos.length - 1) && finalVideos.length > 1) {
    pushIssue(issues, {
      code: "recent_repetition",
      severity: "warning",
      label: "近期重复偏高",
      detail: `有 ${repeatCount} 条视频和最近方案重复，可能降低第二天打开的新鲜感。`,
      evidence: { field: "DailyRecommendation.planData", value: `${repeatCount}/${finalVideos.length}`, rule: "repeat_count < plan_size - 1" },
    });
  }

  if (embeddableCount < finalVideos.length && finalVideos.length > 0) {
    pushIssue(issues, {
      code: "external_playback_present",
      severity: "notice",
      label: "存在外跳播放",
      detail: `有 ${finalVideos.length - embeddableCount} 条需要跳转原平台，连续跟练流畅度会弱一些。`,
      evidence: { field: "video.platform", value: `${embeddableCount}/${finalVideos.length}`, rule: "prefer_embeddable" },
    });
  }

  const criticalCount = issues.filter((issue) => issue.severity === "critical").length;
  const warningCount = issues.filter((issue) => issue.severity === "warning").length;
  const noticeCount = issues.filter((issue) => issue.severity === "notice").length;
  const score = Math.max(0, 100 - criticalCount * 35 - warningCount * 15 - noticeCount * 5);
  const passed = criticalCount === 0 && warningCount <= 1;
  const summary = passed
    ? `方案质检通过：${actualMinutes} 分钟，${fromImported} 条来自导入，${fillCount} 条补位。`
    : `方案质检需关注：${criticalCount} 个严重问题，${warningCount} 个风险项。`;

  return {
    passed,
    score,
    summary,
    issues,
  };
}
