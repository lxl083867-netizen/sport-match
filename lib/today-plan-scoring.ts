import type { PlanVideo, VideoWithTags } from "./today-plan";

export const PHASE_TAGS = {
  warmup: ["热身激活", "热身"],
  stretch: ["冷身拉伸", "拉伸", "放松"],
};

export interface FeedbackSignals {
  summary: string | null;
  dislikedVideoIds: Set<string>;
  likedVideoIds: Set<string>;
  hardTagCounts: Record<string, number>;
  easyTagCounts: Record<string, number>;
  dislikedTagCounts: Record<string, number>;
  likedTagCounts: Record<string, number>;
  painContraTags: Set<string>;
  recentTooHard: boolean;
  recentTooEasy: boolean;
}

export function getReasons(
  video: NonNullable<VideoWithTags>,
  profile: { goals: string; equipment: string; bodyConditions: string; fitnessLevel: string },
  note: string,
): { matchReasons: string[]; phaseReason: string } {
  const matchReasons: string[] = [];
  const goals = JSON.parse(profile.goals) as string[];
  const equipment = JSON.parse(profile.equipment) as string[];
  const bodyConditions = JSON.parse(profile.bodyConditions) as string[];

  for (const vt of video.tags) {
    if (vt.tag.category === "goal" && goals.includes(vt.tag.nameZh)) {
      matchReasons.push(`匹配${vt.tag.nameZh}目标`);
    }
    if (vt.tag.category === "audience" && profile.fitnessLevel === "beginner" && vt.tag.nameZh === "零基础") {
      matchReasons.push("适合零基础");
    }
    if (vt.tag.category === "equipment" && equipment.includes(vt.tag.nameZh)) {
      matchReasons.push(`可用${vt.tag.nameZh}`);
    }
    if (vt.tag.category === "audience" && bodyConditions.length > 0 && vt.tag.nameZh === "康复期") {
      matchReasons.push("适配身体条件");
    }
  }

  const phaseLabels: Record<string, string> = {
    warmup: "热身激活，为后续训练做准备",
    main: "核心训练，匹配你的目标强度",
    stretch: "冷身拉伸，帮助恢复",
  };
  const phaseReason = phaseLabels[note] || "";

  return { matchReasons: matchReasons.slice(0, 2), phaseReason };
}

export function scoreVideo(
  v: NonNullable<VideoWithTags>,
  profile: { goals: string; equipment: string; fitnessLevel: string; bodyConditions: string; availableTime?: string },
  feedbackSignals?: FeedbackSignals,
): number {
  let s = 0;
  const goals = JSON.parse(profile.goals) as string[];
  const equipment = JSON.parse(profile.equipment) as string[];
  const bodyConditions = JSON.parse(profile.bodyConditions) as string[];
  const availableTime = profile.availableTime || "30";

  for (const vt of v.tags) {
    const tag = vt.tag;
    const conf = vt.confidence;

    if (feedbackSignals) {
      const hardCount = Math.min(feedbackSignals.hardTagCounts[tag.nameZh] || 0, 3);
      const easyCount = Math.min(feedbackSignals.easyTagCounts[tag.nameZh] || 0, 3);
      const dislikedCount = Math.min(feedbackSignals.dislikedTagCounts[tag.nameZh] || 0, 3);
      const likedCount = Math.min(feedbackSignals.likedTagCounts[tag.nameZh] || 0, 3);

      s -= hardCount * 4 * conf;
      s -= dislikedCount * 6 * conf;
      s += likedCount * 4 * conf;
      s += easyCount * 2 * conf;

      if (tag.category === "contraindication" && feedbackSignals.painContraTags.has(tag.nameZh)) {
        s -= 28 * conf;
      }
      if (tag.category === "intensity" && tag.nameZh === "高强度" && feedbackSignals.recentTooHard) {
        s -= 12 * conf;
      }
      if (tag.category === "intensity" && tag.nameZh === "低强度" && feedbackSignals.recentTooHard) {
        s += 5 * conf;
      }
      if (tag.category === "intensity" && tag.nameZh === "中强度" && feedbackSignals.recentTooEasy) {
        s += 6 * conf;
      }
    }

    if (tag.category === "contraindication" && bodyConditions.length > 0) {
      if ((bodyConditions.includes("膝盖不适") && tag.nameZh === "膝部禁忌") ||
          (bodyConditions.includes("腰椎问题") && tag.nameZh === "腰部禁忌")) {
        s -= 30;
      }
    }
    if (tag.category === "audience" && bodyConditions.length > 0 &&
        (tag.nameZh === "康复期" || tag.nameZh === "产后恢复")) {
      s += 12 * conf;
    }

    if (tag.category === "duration") {
      const userMin = parseInt(availableTime) || 30;
      const tagMinMap: Record<string, number> = {
        "15分钟以下": 10, "15分钟以内": 10, "15-30分钟": 20,
        "30-60分钟": 45, "30分钟以上": 60, "60分钟以上": 90,
      };
      const tagMins = tagMinMap[tag.nameZh] || 30;
      if (tagMins <= userMin) s += 20 * conf;
      else if (tagMins <= userMin * 1.5) s += 10 * conf;
      else s -= 8 * conf;
    }

    if (tag.category === "goal" && goals.includes(tag.nameZh)) s += 8 * conf;
    if (tag.category === "muscle") s += 3 * conf;
    if (tag.category === "equipment" && equipment.includes(tag.nameZh)) s += 5 * conf;
    if (tag.category === "audience" && profile.fitnessLevel === "beginner" && tag.nameZh === "零基础") s += 5;
    if (tag.category === "audience" && profile.fitnessLevel === "intermediate" && tag.nameZh === "有经验") s += 5;
  }
  if (feedbackSignals?.dislikedVideoIds.has(v.id)) s -= 80;
  if (feedbackSignals?.likedVideoIds.has(v.id)) s += 4;
  return s;
}

export function classifyVideos(userVideos: NonNullable<VideoWithTags>[]) {
  const warmups: typeof userVideos = [];
  const mains: typeof userVideos = [];
  const stretches: typeof userVideos = [];

  for (const v of userVideos) {
    const tagNames = v.tags.map((vt) => vt.tag.nameZh);
    if (tagNames.some((t) => PHASE_TAGS.warmup.includes(t))) {
      warmups.push(v);
    } else if (tagNames.some((t) => PHASE_TAGS.stretch.includes(t))) {
      stretches.push(v);
    } else {
      mains.push(v);
    }
  }

  return { warmups, mains, stretches };
}

export function pick<T extends { id: string }>(arr: T[], count: number, excludeIds?: string[]): T[] {
  if (arr.length <= count) return [...arr];

  const exclude = new Set(excludeIds ?? []);
  const sorted = [...arr].sort((a, b) => {
    const aEx = exclude.has(a.id) ? 1 : 0;
    const bEx = exclude.has(b.id) ? 1 : 0;
    return aEx - bEx;
  });

  const poolSize = Math.min(Math.max(count * 3, count + 5), sorted.length);
  const pool = sorted.slice(0, poolSize);
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  return pool.slice(0, count);
}

export function trimToBudget(videos: PlanVideo[], timeBudgetSeconds: number): PlanVideo[] {
  const warmups = videos.filter((v) => v.note === "warmup");
  const stretches = videos.filter((v) => v.note === "stretch");
  const mains = videos.filter((v) => v.note === "main");

  const fixedDuration = warmups.reduce((s, v) => s + (v.duration || 0), 0)
    + stretches.reduce((s, v) => s + (v.duration || 0), 0);

  let budgetForMains = timeBudgetSeconds - fixedDuration;
  if (budgetForMains < 60) budgetForMains = 60;

  const keptMains: typeof mains = [];
  let running = 0;
  for (const m of mains) {
    const d = m.duration || 0;
    if (keptMains.length === 0 || running + d <= budgetForMains) {
      keptMains.push(m);
      running += d;
    }
  }

  return [...warmups, ...keptMains, ...stretches];
}

export function parseTimeBudget(availableTime: string): number {
  const minutes = parseInt(availableTime) || 30;
  return minutes * 60;
}
