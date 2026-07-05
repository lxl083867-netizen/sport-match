export type VideoQualityLevel = "high" | "medium" | "low";

export interface VideoQualityResult {
  level: VideoQualityLevel;
  message: string;
  reasons: string[];
}

const STRONG_SPORT_TERMS = [
  "健身", "训练", "跟练", "燃脂", "减脂", "塑形", "瘦身", "暴汗", "有氧", "无氧",
  "力量", "拉伸", "热身", "核心", "腹肌", "臀腿", "肩背", "上肢", "下肢", "全身",
  "hiit", "tabata", "barre", "pilates", "普拉提", "瑜伽", "yoga", "帕梅拉",
  "刘畊宏", "keep", "尊巴", "zumba", "康复", "体态", "圆肩", "驼背",
];

const SOFT_SPORT_TERMS = [
  "舞蹈", "跳舞", "操", "运动", "活动", "燃", "出汗", "新手", "零基础", "教程",
  "站立", "拉筋", "开肩", "美背", "马甲线", "小蛮腰", "大基数",
];

const NON_SPORT_TERMS = [
  "美食", "吃播", "探店", "做饭", "穿搭", "妆容", "化妆", "护肤", "游戏", "解说",
  "电影", "电视剧", "综艺", "音乐", "翻唱", "mv", "开箱", "测评", "旅游", "vlog",
  "搞笑", "宠物", "猫", "狗", "学习", "英语", "编程", "股票", "新闻", "直播回放",
];

function countMatches(text: string, terms: string[]) {
  return terms.filter((term) => text.includes(term.toLowerCase())).length;
}

export function assessVideoQuality(video: {
  title: string;
  sourceAuthor?: string | null;
  platform?: string | null;
  duration?: number | null;
}): VideoQualityResult {
  const text = `${video.title || ""} ${video.sourceAuthor || ""} ${video.platform || ""}`.toLowerCase();
  const strongMatches = countMatches(text, STRONG_SPORT_TERMS);
  const softMatches = countMatches(text, SOFT_SPORT_TERMS);
  const nonSportMatches = countMatches(text, NON_SPORT_TERMS);
  const reasons: string[] = [];

  if (strongMatches > 0) reasons.push(`命中 ${strongMatches} 个明确运动关键词`);
  if (softMatches > 0) reasons.push(`命中 ${softMatches} 个弱运动线索`);
  if (nonSportMatches > 0) reasons.push(`命中 ${nonSportMatches} 个非运动关键词`);
  if (video.duration && video.duration > 7200) reasons.push("视频时长超过 2 小时，可能不是跟练教程");

  if (strongMatches >= 2 || (strongMatches >= 1 && nonSportMatches === 0)) {
    return {
      level: "high",
      message: "高置信运动内容",
      reasons: reasons.length > 0 ? reasons : ["标题和来源看起来符合运动教程"],
    };
  }

  if (nonSportMatches >= 2 && strongMatches === 0) {
    return {
      level: "low",
      message: "疑似非运动内容",
      reasons: reasons.length > 0 ? reasons : ["没有识别到运动相关线索"],
    };
  }

  if (softMatches > 0 || strongMatches > 0) {
    return {
      level: "medium",
      message: "疑似运动内容，标签待确认",
      reasons: reasons.length > 0 ? reasons : ["有运动相关线索，但不够明确"],
    };
  }

  return {
    level: "low",
    message: "疑似非运动内容",
    reasons: reasons.length > 0 ? reasons : ["没有识别到运动相关线索"],
  };
}
