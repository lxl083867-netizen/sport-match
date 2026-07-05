import { PrismaClient } from "../app/generated/prisma/client";
import { PrismaLibSql } from "@prisma/adapter-libsql";
import bcrypt from "bcryptjs";

const adapter = new PrismaLibSql({ url: "file:./dev.db" });
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log("Seeding database...");

  // 1. Create tag dictionary from TAG_CATEGORIES
  const TAG_CATEGORIES = {
    goal: ["减脂", "增肌", "康复", "体能提升", "柔韧性"],
    muscle: ["核心", "臀腿", "肩背", "全身", "上肢", "下肢"],
    type: ["热身", "HIIT", "瑜伽", "普拉提", "力量训练", "拉伸", "有氧", "放松"],
    phase: ["热身激活", "主体训练", "冷身拉伸"],
    intensity: ["低强度", "中强度", "高强度"],
    contraindication: ["含跳跃", "含深蹲", "需仰卧", "需跪姿", "膝部禁忌", "腰部禁忌"],
    equipment: ["无器材", "弹力带", "哑铃", "瑜伽垫"],
    audience: ["零基础", "有经验", "大基数", "产后恢复", "康复期", "办公室久坐"],
    duration: ["15分钟以内", "15-30分钟", "30分钟以上"],
  };

  console.log("Creating tags...");
  for (const [category, tagNames] of Object.entries(TAG_CATEGORIES)) {
    for (const name of tagNames) {
      await prisma.tag.upsert({
        where: { name_category: { name, category } },
        update: {},
        create: { name, category, nameZh: name },
      });
    }
  }

  // 2. Create test user
  console.log("Creating test user...");
  const passwordHash = await bcrypt.hash("test123", 10);
  const user = await prisma.user.upsert({
    where: { email: "test@sportmatch.com" },
    update: {},
    create: {
      email: "test@sportmatch.com",
      name: "运动小白",
      passwordHash,
    },
  });

  // 3. Create test profile
  await prisma.userProfile.upsert({
    where: { userId: user.id },
    update: {},
    create: {
      userId: user.id,
      goals: JSON.stringify(["减脂", "体能提升"]),
      fitnessLevel: "beginner",
      bodyConditions: JSON.stringify(["办公室久坐"]),
      equipment: JSON.stringify(["无器材", "瑜伽垫"]),
      availableTime: "30",
      contraindications: JSON.stringify(["不能跳跃"]),
    },
  });

  // 4. Create sample videos
  console.log("Creating sample videos...");
  const sampleVideos = [
    {
      title: "【帕梅拉】10分钟全身燃脂 HIIT 无跳跃 零基础友好",
      url: "https://www.bilibili.com/video/BV1xx411N7xx",
      platform: "bilibili",
      duration: 600,
      sourceAuthor: "帕梅拉PamelaReif",
      tags: ["减脂", "全身", "HIIT", "中强度", "零基础", "15分钟以内"],
    },
    {
      title: "15分钟核心训练 腹肌撕裂 无需器械",
      url: "https://www.bilibili.com/video/BV1xx422N7yy",
      platform: "bilibili",
      duration: 900,
      sourceAuthor: "周六野Zoey",
      tags: ["增肌", "核心", "力量训练", "中强度", "无器材", "有经验", "15-30分钟"],
    },
    {
      title: "30分钟流瑜伽 全身拉伸放松 适合办公室久坐",
      url: "https://www.xiaohongshu.com/explore/abc123",
      platform: "xiaohongshu",
      duration: 1800,
      sourceAuthor: "瑜伽小雅",
      tags: ["柔韧性", "全身", "瑜伽", "低强度", "瑜伽垫", "办公室久坐", "30分钟以上"],
    },
    {
      title: "5分钟晨间热身 激活全身 运动前必做",
      url: "https://www.bilibili.com/video/BV1xx433N8zz",
      platform: "bilibili",
      duration: 300,
      sourceAuthor: "FitMen",
      tags: ["体能提升", "全身", "热身", "低强度", "无器材", "零基础", "热身激活", "15分钟以内"],
    },
    {
      title: "20分钟臀腿训练 弹力带跟练 蜜桃臀养成",
      url: "https://www.douyin.com/video/xyz789",
      platform: "douyin",
      duration: 1200,
      sourceAuthor: "辣妈健身日记",
      tags: ["增肌", "臀腿", "力量训练", "中强度", "弹力带", "有经验", "15-30分钟"],
    },
    {
      title: "8分钟拉伸放松 运动后冷身 缓解肌肉酸痛",
      url: "https://www.bilibili.com/video/BV1xx544N0aa",
      platform: "bilibili",
      duration: 480,
      sourceAuthor: "健身营养师Li",
      tags: ["柔韧性", "全身", "拉伸", "低强度", "无器材", "零基础", "冷身拉伸", "15分钟以内"],
    },
    {
      title: "产后恢复盆底肌训练 温和修复 适合产后妈妈",
      url: "https://www.xiaohongshu.com/explore/def456",
      platform: "xiaohongshu",
      duration: 900,
      sourceAuthor: "产后康复师小王",
      tags: ["康复", "核心", "普拉提", "低强度", "瑜伽垫", "产后恢复", "15-30分钟"],
    },
    {
      title: "HIIT暴汗燃脂 30分钟高效减脂 高强度间歇",
      url: "https://www.bilibili.com/video/BV1xx655N1bb",
      platform: "bilibili",
      duration: 1800,
      sourceAuthor: "Keep官方",
      tags: ["减脂", "全身", "HIIT", "高强度", "无器材", "有经验", "30分钟以上"],
    },
  ];

  for (const videoData of sampleVideos) {
    const { tags: tagNames, ...videoFields } = videoData;
    const existing = await prisma.video.findFirst({ where: { url: videoFields.url } });
    if (!existing) {
      const video = await prisma.video.create({ data: videoFields });
      for (const tagName of tagNames) {
        const tag = await prisma.tag.findFirst({ where: { nameZh: tagName } });
        if (tag) {
          await prisma.videoTag.create({
            data: {
              videoId: video.id,
              tagId: tag.id,
              confidence: 0.85 + Math.random() * 0.15,
              source: "ai",
              evidence: "AI 自动标注",
            },
          });
        }
      }
    }
  }

  console.log("Seed completed!");
  console.log("Test account: test@sportmatch.com / test123");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
