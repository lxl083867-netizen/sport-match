export const TAG_CATEGORIES = {
  goal: { label: "运动目标", tags: ["减脂", "增肌", "康复", "体能提升", "柔韧性"] },
  muscle: { label: "目标肌群", tags: ["核心", "臀腿", "肩背", "全身", "上肢", "下肢"] },
  type: { label: "运动类型", tags: ["热身", "HIIT", "瑜伽", "普拉提", "力量训练", "拉伸", "有氧", "放松"] },
  phase: { label: "训练阶段", tags: ["热身激活", "主体训练", "冷身拉伸"] },
  intensity: { label: "强度", tags: ["低强度", "中强度", "高强度"] },
  contraindication: { label: "禁忌动作", tags: ["含跳跃", "含深蹲", "需仰卧", "需跪姿", "膝部禁忌", "腰部禁忌"] },
  equipment: { label: "器材需求", tags: ["无器材", "弹力带", "哑铃", "瑜伽垫"] },
  audience: { label: "适合人群", tags: ["零基础", "有经验", "大基数", "产后恢复", "康复期", "办公室久坐"] },
  duration: { label: "时长", tags: ["15分钟以内", "15-30分钟", "30分钟以上"] },
} as const;

export type TagCategory = keyof typeof TAG_CATEGORIES;

export function getTagCategory(tagName: string): TagCategory | null {
  for (const [category, info] of Object.entries(TAG_CATEGORIES)) {
    if ((info.tags as readonly string[]).includes(tagName)) return category as TagCategory;
  }
  return null;
}

export function getAllTagNames(): string[] {
  return Object.values(TAG_CATEGORIES).flatMap((c) => c.tags);
}
