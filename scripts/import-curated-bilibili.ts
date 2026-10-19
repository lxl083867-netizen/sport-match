import "dotenv/config";
import { prisma } from "../lib/prisma";

type SeedVideo = {
  bvid: string;
  title: string;
  author: string;
  duration: number;
  thumbnailUrl: string;
  tags: Array<{ name: string; category: string }>;
};

const videos: SeedVideo[] = [
  {
    bvid: "BV1SCCxBcEGz",
    title: "急性子改善悬垂腹 葫芦肚！强化你体内的天然束腰【真空腹教学】",
    author: "欧阳春晓Aurora",
    duration: 191,
    thumbnailUrl: "http://i2.hdslb.com/bfs/archive/71bbebf6912ef843dc66251b004966d6f9773237.jpg",
    tags: [
      { name: "康复", category: "goal" },
      { name: "核心", category: "muscle" },
      { name: "呼吸训练", category: "type" },
      { name: "低强度", category: "intensity" },
      { name: "无器材", category: "equipment" },
      { name: "零基础", category: "audience" },
      { name: "办公室久坐", category: "audience" },
      { name: "15分钟以内", category: "duration" },
      { name: "主训练", category: "phase" },
      { name: "体态改善", category: "theme" },
      { name: "基础补位库", category: "library" },
    ],
  },
  {
    bvid: "BV1UovWBNENi",
    title: "睡前10min胸椎x髋部筋膜拉伸｜极度舒适的身体spa | 含呼吸口令指导",
    author: "欧阳春晓Aurora",
    duration: 747,
    thumbnailUrl: "http://i0.hdslb.com/bfs/archive/705ea0f816aa93efbc48944cee345c25eb0d32fa.jpg",
    tags: [
      { name: "柔韧性", category: "goal" },
      { name: "康复", category: "goal" },
      { name: "肩背", category: "muscle" },
      { name: "拉伸", category: "type" },
      { name: "放松", category: "type" },
      { name: "低强度", category: "intensity" },
      { name: "瑜伽垫", category: "equipment" },
      { name: "办公室久坐", category: "audience" },
      { name: "15分钟以内", category: "duration" },
      { name: "拉伸", category: "phase" },
      { name: "睡前放松", category: "theme" },
      { name: "基础补位库", category: "library" },
    ],
  },
  {
    bvid: "BV1XdrHBSEAM",
    title: "如果解决骨盆前倾 肋骨外翻只能选一个动作—那一定是9090呼吸法！【三腔对位基本功】",
    author: "欧阳春晓Aurora",
    duration: 226,
    thumbnailUrl: "http://i1.hdslb.com/bfs/archive/810921c070ed9e7b1498236fa4d9b3661fcd8d4e.jpg",
    tags: [
      { name: "康复", category: "goal" },
      { name: "核心", category: "muscle" },
      { name: "呼吸训练", category: "type" },
      { name: "低强度", category: "intensity" },
      { name: "无器材", category: "equipment" },
      { name: "零基础", category: "audience" },
      { name: "办公室久坐", category: "audience" },
      { name: "15分钟以内", category: "duration" },
      { name: "主训练", category: "phase" },
      { name: "骨盆前倾", category: "theme" },
      { name: "肋骨外翻", category: "theme" },
      { name: "基础补位库", category: "library" },
    ],
  },
  {
    bvid: "BV14w411h7rj",
    title: "躺练8分钟骨盆回正了？！不愧是哈佛出品",
    author: "欧阳春晓Aurora",
    duration: 487,
    thumbnailUrl: "http://i2.hdslb.com/bfs/archive/4f88c3c038e98661290976b633eb0c7bc52f13b6.jpg",
    tags: [
      { name: "康复", category: "goal" },
      { name: "核心", category: "muscle" },
      { name: "普拉提", category: "type" },
      { name: "低强度", category: "intensity" },
      { name: "瑜伽垫", category: "equipment" },
      { name: "零基础", category: "audience" },
      { name: "办公室久坐", category: "audience" },
      { name: "15分钟以内", category: "duration" },
      { name: "主训练", category: "phase" },
      { name: "骨盆前倾", category: "theme" },
      { name: "基础补位库", category: "library" },
    ],
  },
  {
    bvid: "BV1AV41167Pr",
    title: "10分钟get直角肩少女背/改善含胸驼背7天见效/女神气质必修课",
    author: "欧阳春晓Aurora",
    duration: 842,
    thumbnailUrl: "http://i0.hdslb.com/bfs/archive/0f58fb572103b707e1baba03d158510707417b35.jpg",
    tags: [
      { name: "康复", category: "goal" },
      { name: "柔韧性", category: "goal" },
      { name: "肩背", category: "muscle" },
      { name: "拉伸", category: "type" },
      { name: "低强度", category: "intensity" },
      { name: "无器材", category: "equipment" },
      { name: "零基础", category: "audience" },
      { name: "办公室久坐", category: "audience" },
      { name: "15分钟以内", category: "duration" },
      { name: "主训练", category: "phase" },
      { name: "直角肩", category: "theme" },
      { name: "少女背", category: "theme" },
      { name: "基础补位库", category: "library" },
    ],
  },
  {
    bvid: "BV1Ha4y147Sd",
    title: "最新版，更改版欧阳春晓本人已授权 少女背 直角肩 斜方肌 去头尾 自用侵删",
    author: "心想事成的蓝桉",
    duration: 897,
    thumbnailUrl: "http://i2.hdslb.com/bfs/archive/2aae75bb96b7cf1ce0c2aa42021c900ba00e9b82.jpg",
    tags: [
      { name: "康复", category: "goal" },
      { name: "柔韧性", category: "goal" },
      { name: "肩背", category: "muscle" },
      { name: "拉伸", category: "type" },
      { name: "低强度", category: "intensity" },
      { name: "无器材", category: "equipment" },
      { name: "办公室久坐", category: "audience" },
      { name: "15分钟以内", category: "duration" },
      { name: "主训练", category: "phase" },
      { name: "直角肩", category: "theme" },
      { name: "少女背", category: "theme" },
      { name: "基础补位库", category: "library" },
    ],
  },
];

async function upsertTag(name: string, category: string) {
  return prisma.tag.upsert({
    where: { name_category: { name, category } },
    update: { nameZh: name },
    create: { name, category, nameZh: name },
  });
}

async function main() {
  let created = 0;
  let updated = 0;

  for (const seed of videos) {
    const url = `https://www.bilibili.com/video/${seed.bvid}`;
    const existing = await prisma.video.findFirst({
      where: {
        OR: [
          { url },
          { url: { contains: seed.bvid } },
        ],
      },
    });

    const video = existing
      ? await prisma.video.update({
          where: { id: existing.id },
          data: {
            title: seed.title,
            url,
            platform: "bilibili",
            sourceAuthor: seed.author,
            duration: seed.duration,
            thumbnailUrl: seed.thumbnailUrl,
          },
        })
      : await prisma.video.create({
          data: {
            title: seed.title,
            url,
            platform: "bilibili",
            sourceAuthor: seed.author,
            duration: seed.duration,
            thumbnailUrl: seed.thumbnailUrl,
            userId: null,
          },
        });

    if (existing) updated += 1;
    else created += 1;

    for (const tagSeed of seed.tags) {
      const tag = await upsertTag(tagSeed.name, tagSeed.category);
      await prisma.videoTag.upsert({
        where: { videoId_tagId: { videoId: video.id, tagId: tag.id } },
        update: {
          confidence: 0.95,
          source: "manual",
          evidence: "基础补位库人工导入",
        },
        create: {
          videoId: video.id,
          tagId: tag.id,
          confidence: 0.95,
          source: "manual",
          evidence: "基础补位库人工导入",
        },
      });
    }
  }

  console.log(`Imported curated Bilibili videos: created=${created}, updated=${updated}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
