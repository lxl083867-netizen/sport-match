import "dotenv/config";
import { prisma } from "../lib/prisma";
import { fetchMetadata, parseVideoUrl, resolveShortLink } from "../lib/video-import";

const seeds = [
  { title: "帕梅拉 - 10分钟拜拜圆肩驼背｜拉伸训练 改善不良体态 (Pamela Reif Official)", url: "https://b23.tv/nqgKYTI" },
  { title: "帕梅拉 - 8分钟天鹅颈直角肩 拉伸+淡化颈纹无器械（Pamela Reif Official）", url: "https://b23.tv/cV4i82g" },
  { title: "【Pamela Reif 帕梅拉】 10分钟手臂训练 | 新手友好 | 摆脱拜拜肉 | 帕老师带你运动燃脂", url: "https://b23.tv/FMu8Mj9" },
  { title: "夏日拒绝虎背熊腰，摆脱拜拜肉：帕梅拉10分钟美背+10分钟手臂、核心训练+T25第二阶段上半身训练+美丽芭蕾体态塑造训练", url: "https://b23.tv/p5f4evZ" },
  { title: "帕梅拉 - 30分钟经典燃脂三部曲｜暴汗内啡肽+最佳HIIT+站立腹肌HIIT - 怒燃200-350卡", url: "https://b23.tv/lYoXeo9" },
  { title: "帕梅拉 - 40分钟有氧踏步三部曲｜新手大基数友好", url: "https://b23.tv/wpIZDi2" },
  { title: "【Pamela Reif 帕梅拉】15分钟舞蹈全身燃脂 | 新手友好 | 无深蹲 无卧撑 | 甩走脂肪 | 帕老师带你运动燃脂", url: "https://b23.tv/OSiiWpS" },
  { title: "MIZI 15分钟高效早晨晨练 每天一遍！无跳跃、唤醒全身活力", url: "https://b23.tv/0S2d0jY" },
  { title: "MIZI 15分钟打造纸片身型 全程无跳跃/零蹲跌 全身高效塑形", url: "https://b23.tv/P79uGjU" },
  { title: "MIZI 20分钟下腹脂肪粉碎 [无跳跃、无深蹲、无弓箭步]", url: "https://b23.tv/yd4OBZD" },
  { title: "MIZI 30分钟饭后运动 | 燃烧腹部脂肪 & 减少腹胀（无跳跃、无深蹲、无弓步）", url: "https://b23.tv/0mDQGRw" },
  { title: "MIZI 30分钟全身哑铃训练 燃脂塑形（无跳跃）", url: "https://b23.tv/TvNXzIt" },
  { title: "【B站独家】MIZI 12分钟BLACKPINK热舞派对暴汗有氧 | 无器械，全身塑形", url: "https://b23.tv/OLRyXAf" },
  { title: "MIZI 2周瘦手臂＋瘦背 告别副乳＋内衣赘肉", url: "https://b23.tv/Qa6Csym" },
  { title: "MIZI 改善驼背和头前倾姿势｜10分钟每日颈肩体态训练", url: "https://b23.tv/LdZe1T1" },
  { title: "MIZI 15分钟消除副乳和背部赘肉训练", url: "https://b23.tv/lstl1E9" },
  { title: "体态大师气场女王2024：圆肩驼肩、真假性驼背、头前伸、富贵包、斜方肌大、瘦背、脖子拉长、面部提升", url: "https://b23.tv/lLE3a81" },
];

type TagSeed = { name: string; category: string };

function uniqTags(tags: TagSeed[]) {
  const seen = new Set<string>();
  return tags.filter((tag) => {
    const key = `${tag.category}:${tag.name}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function durationTag(seconds: number | null): TagSeed {
  if (!seconds || seconds <= 15 * 60) return { name: "15分钟以内", category: "duration" };
  if (seconds <= 30 * 60) return { name: "15-30分钟", category: "duration" };
  return { name: "30-60分钟", category: "duration" };
}

function inferTags(title: string, duration: number | null): TagSeed[] {
  const text = title.toLowerCase();
  const tags: TagSeed[] = [
    { name: "基础补位库", category: "library" },
    durationTag(duration),
  ];

  if (/燃脂|脂肪|暴汗|有氧|hiit|卡|塑形|纸片|踏步|舞蹈|热舞/.test(text)) {
    tags.push({ name: "减脂", category: "goal" });
  }
  if (/体态|圆肩|驼背|头前伸|富贵包|直角肩|天鹅颈|颈肩|斜方肌|拉伸/.test(text)) {
    tags.push({ name: "康复", category: "goal" }, { name: "柔韧性", category: "goal" });
  }
  if (/手臂|拜拜肉|上半身|副乳/.test(text)) {
    tags.push({ name: "手臂", category: "muscle" }, { name: "上肢", category: "muscle" });
  }
  if (/背|肩|颈|斜方肌|天鹅颈|直角肩|圆肩|驼背/.test(text)) {
    tags.push({ name: "肩背", category: "muscle" });
  }
  if (/核心|腹|下腹|肚|hiit/.test(text)) {
    tags.push({ name: "核心", category: "muscle" });
  }
  if (/全身|有氧|舞蹈|热舞|踏步|晨练|塑形/.test(text)) {
    tags.push({ name: "全身", category: "muscle" });
  }
  if (/拉伸|体态|天鹅颈|直角肩|圆肩|驼背|头前伸|富贵包/.test(text)) {
    tags.push({ name: "拉伸", category: "type" });
  }
  if (/hiit/.test(text)) {
    tags.push({ name: "HIIT", category: "type" }, { name: "高强度", category: "intensity" });
  }
  if (/有氧|踏步|舞蹈|热舞|晨练/.test(text)) {
    tags.push({ name: "有氧", category: "type" });
  }
  if (/哑铃/.test(text)) {
    tags.push({ name: "力量训练", category: "type" }, { name: "哑铃", category: "equipment" });
  }
  if (/新手|大基数|无跳跃|无深蹲|无卧撑|无弓/.test(text)) {
    tags.push({ name: "零基础", category: "audience" }, { name: "膝盖友好", category: "audience" });
  }
  if (!/哑铃/.test(text)) {
    tags.push({ name: "无器材", category: "equipment" });
  }
  if (!tags.some((tag) => tag.category === "intensity")) {
    tags.push(duration && duration > 25 * 60 ? { name: "中强度", category: "intensity" } : { name: "低强度", category: "intensity" });
  }
  tags.push(/拉伸|体态|颈肩|圆肩|驼背|天鹅颈|直角肩/.test(text) ? { name: "拉伸", category: "phase" } : { name: "主训练", category: "phase" });

  return uniqTags(tags);
}

async function upsertTag(name: string, category: string) {
  return prisma.tag.upsert({
    where: { name_category: { name, category } },
    update: { nameZh: name },
    create: { name, category, nameZh: name },
  });
}

async function resolveToParsed(rawUrl: string) {
  const parsed = parseVideoUrl(rawUrl);
  if (!parsed) throw new Error(`Unsupported URL: ${rawUrl}`);
  if (parsed.platform !== "bilibili_short") return parsed;

  const resolved = await resolveShortLink(parsed.canonicalUrl);
  const reparsed = resolved ? parseVideoUrl(resolved) : null;
  return reparsed && reparsed.platform === "bilibili" ? reparsed : parsed;
}

async function main() {
  let created = 0;
  let updated = 0;

  for (const seed of seeds) {
    const parsed = await resolveToParsed(seed.url);
    const meta = await fetchMetadata(parsed);
    const title = meta.title && meta.title !== "B站视频" ? meta.title : seed.title;
    const url = meta.url;

    const existing = await prisma.video.findFirst({
      where: {
        OR: [
          { url },
          { url: { contains: parsed.videoId } },
          { title },
        ],
      },
    });

    const video = existing
      ? await prisma.video.update({
          where: { id: existing.id },
          data: {
            title,
            url,
            platform: "bilibili",
            sourceAuthor: meta.sourceAuthor || "B站精选",
            duration: meta.duration,
            thumbnailUrl: meta.thumbnailUrl,
          },
        })
      : await prisma.video.create({
          data: {
            title,
            url,
            platform: "bilibili",
            sourceAuthor: meta.sourceAuthor || "B站精选",
            duration: meta.duration,
            thumbnailUrl: meta.thumbnailUrl,
            userId: null,
          },
        });

    if (existing) updated += 1;
    else created += 1;

    for (const tagSeed of inferTags(title, meta.duration)) {
      const tag = await upsertTag(tagSeed.name, tagSeed.category);
      await prisma.videoTag.upsert({
        where: { videoId_tagId: { videoId: video.id, tagId: tag.id } },
        update: { confidence: 0.92, source: "manual", evidence: "基础补位库第二批导入" },
        create: {
          videoId: video.id,
          tagId: tag.id,
          confidence: 0.92,
          source: "manual",
          evidence: "基础补位库第二批导入",
        },
      });
    }
  }

  console.log(`Imported curated Bilibili batch 2: created=${created}, updated=${updated}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
