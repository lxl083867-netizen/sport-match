import type { CollectionTagProfile } from "./recommendation";
import type { CollectionInsight, VideoWithTags } from "./today-plan";
import { PHASE_TAGS } from "./today-plan-scoring";

export function extractCollectionProfile(userVideos: NonNullable<VideoWithTags>[]): CollectionTagProfile | null {
  if (userVideos.length === 0) return null;

  const tagFreq: Record<string, number> = {};
  for (const v of userVideos) {
    for (const vt of v.tags) {
      tagFreq[vt.tag.nameZh] = (tagFreq[vt.tag.nameZh] || 0) + 1;
    }
  }

  const phaseNames = [...PHASE_TAGS.warmup, ...PHASE_TAGS.stretch];
  const topTags = Object.entries(tagFreq)
    .filter(([name]) => !phaseNames.includes(name))
    .sort(([, a], [, b]) => b - a)
    .slice(0, 10)
    .map(([name]) => name);

  return { topTags, tagFreq, dominantCategories: [] };
}

export function getCollectionInsights(
  userVideos: NonNullable<VideoWithTags>[],
  warmups: NonNullable<VideoWithTags>[],
  stretches: NonNullable<VideoWithTags>[],
  profile: { bodyConditions: string },
): CollectionInsight {
  const allUserTags = userVideos.flatMap((v) => v.tags.map((vt) => vt.tag));
  const tagCount: Record<string, number> = {};
  for (const t of allUserTags) {
    tagCount[t.nameZh] = (tagCount[t.nameZh] || 0) + 1;
  }

  const topGoals = Object.entries(tagCount)
    .filter(([name]) => allUserTags.find((t) => t.nameZh === name && t.category === "goal"))
    .sort(([, a], [, b]) => b - a)
    .slice(0, 3)
    .map(([name]) => name);

  const preferredDurations = Object.entries(tagCount)
    .filter(([name]) => allUserTags.find((t) => t.nameZh === name && t.category === "duration"))
    .sort(([, a], [, b]) => b - a)
    .slice(0, 1)
    .map(([name]) => name);

  const missingPhases: string[] = [];
  if (warmups.length === 0) missingPhases.push("warmup");
  if (stretches.length === 0) missingPhases.push("stretch");

  const riskWarnings: string[] = [];
  for (const v of userVideos) {
    for (const vt of v.tags) {
      if (vt.tag.category === "contraindication" && ["膝部禁忌", "腰部禁忌"].includes(vt.tag.nameZh)) {
        if (!riskWarnings.includes(vt.tag.nameZh)) riskWarnings.push(vt.tag.nameZh);
      }
    }
  }
  const bodyConditions = JSON.parse(profile.bodyConditions) as string[];
  for (const bc of bodyConditions) {
    if (bc === "膝盖不适" && !riskWarnings.includes("膝部禁忌")) riskWarnings.push("含膝部高风险动作");
    if (bc === "腰椎问题" && !riskWarnings.includes("腰部禁忌")) riskWarnings.push("含腰部高风险动作");
  }

  const goalProblems: Record<string, string> = {
    "减脂": "控制体脂", "燃脂": "想动起来", "增肌": "增加力量",
    "核心": "提升核心稳定性", "拉伸": "改善柔韧性", "康复": "身体恢复",
    "瑜伽": "放松身心", "体能提升": "提升体能", "HIIT": "高效燃脂",
  };

  const bodyStrategies: Record<string, string> = {
    "膝盖不适": "避开膝关节冲击",
    "腰椎问题": "避免腰部高强度动作",
    "产后恢复": "优先低强度恢复训练",
  };

  const goalsText = topGoals.length > 0 ? topGoals.join("、") : "运动健身";
  const durationText = preferredDurations.length > 0 ? preferredDurations[0] : "";
  const equipmentTags = Object.entries(tagCount)
    .filter(([name]) => allUserTags.find((t) => t.nameZh === name && t.category === "equipment"))
    .sort(([, a], [, b]) => b - a)
    .slice(0, 2)
    .map(([name]) => name);

  let trainingTendency: string;
  if (topGoals.length === 0 && equipmentTags.length === 0) {
    trainingTendency = `你已收藏了 ${userVideos.length} 个运动视频，以下是根据这些内容分析的训练倾向。`;
  } else {
    const parts: string[] = [];
    if (topGoals.length > 0) parts.push(`你最近收藏更多集中在${goalsText}`);
    if (durationText) parts.push(`偏好${durationText}时长`);
    if (equipmentTags.length > 0) parts.push(`${equipmentTags.join("、")}为主`);
    trainingTendency = parts.join("，") + "。";
  }

  const problemClues: string[] = [];
  for (const g of topGoals) {
    const clue = goalProblems[g];
    if (clue && !problemClues.includes(clue)) problemClues.push(clue);
  }
  if (problemClues.length === 0) problemClues.push("科学安排训练结构");

  const strategyParts: string[] = ["低门槛、可完成的组合"];
  const bodyConds = JSON.parse(profile.bodyConditions) as string[];
  for (const bc of bodyConds) {
    const s = bodyStrategies[bc];
    if (s && !strategyParts.includes(s)) strategyParts.push(s);
  }

  const systemJudgment = `这些收藏更像是在解决：${problemClues.join("、")}。今日方案会优先安排${strategyParts.join("，")}。`;

  const phaseLabelMap: Record<string, string> = { warmup: "热身", stretch: "拉伸" };
  let gapText: string;
  if (missingPhases.length > 0) {
    const missingLabels = missingPhases.map((p) => phaseLabelMap[p] || p);
    gapText = `你的收藏里${missingLabels.join("和")}内容偏少，系统已在今日方案中自动补齐。`;
  } else {
    gapText = "你的收藏在热身、主体、拉伸上都比较均衡。";
  }

  let nextAction: string;
  let actionLabel: string;
  let actionLink = "/videos";
  if (riskWarnings.length > 0) {
    nextAction = "收藏中有身体限制相关的风险动作，建议优先找低冲击、无跳跃训练。";
    actionLabel = "找低冲击训练";
    actionLink = "/videos?tag=低冲击";
  } else if (missingPhases.includes("warmup")) {
    nextAction = "补充 2-3 个低冲击热身视频，可以让后续方案更好地保护关节。";
    actionLabel = "补充热身视频";
    actionLink = "/videos?tag=热身激活";
  } else if (missingPhases.includes("stretch")) {
    nextAction = "补充几个拉伸视频，可以帮助训练后更好地恢复。";
    actionLabel = "补充拉伸视频";
    actionLink = "/videos?tag=拉伸";
  } else {
    nextAction = "继续导入更多你感兴趣的运动视频，系统会更懂你的训练偏好。";
    actionLabel = "发现视频";
    actionLink = "/videos";
  }

  return {
    topGoals, preferredDurations, missingPhases, riskWarnings,
    trainingTendency, systemJudgment, gapText, nextAction, actionLabel, actionLink,
  };
}
