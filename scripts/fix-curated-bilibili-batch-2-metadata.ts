import "dotenv/config";
import { prisma } from "../lib/prisma";

const videos = [
  { bvid: "BV1gF411A7fW", title: "帕梅拉 - 10分钟拜拜圆肩驼背｜拉伸训练 改善不良体态 (Pamela Reif Official)", author: "帕梅拉PamelaReif", duration: 734, thumbnailUrl: "http://i2.hdslb.com/bfs/archive/c75d56fcbf1ee9d74d25fafd4351f31ffc0877cd.jpg" },
  { bvid: "BV1MT4y1772p", title: "帕梅拉 - 8分钟天鹅颈直角肩 拉伸+淡化颈纹无器械（Pamela Reif Official）", author: "帕梅拉PamelaReif", duration: 590, thumbnailUrl: "http://i0.hdslb.com/bfs/archive/d0c99371407596feb8ae975266d7300330c16411.jpg" },
  { bvid: "BV1Kp4y1D78t", title: "【Pamela Reif 帕梅拉】 10分钟手臂训练 | 新手友好 | 摆脱拜拜肉 | 帕老师带你运动燃脂", author: "绝味鱼腿", duration: 673, thumbnailUrl: "http://i0.hdslb.com/bfs/archive/5244c36ee6744d0cc44e38f8e62f7f00961e1907.jpg" },
  { bvid: "BV1Ht4y117pi", title: "【夏日拒绝虎背熊腰，摆脱拜拜肉】魔鬼帕梅拉10分钟美背+10分钟手臂、核心训练+T25第二阶段上半身训练+美丽芭蕾体态塑造训练", author: "赵肉肉Rou", duration: 3666, thumbnailUrl: "http://i0.hdslb.com/bfs/archive/8b3c593e886997d6b6856be16146e9791f16d36c.png" },
  { bvid: "BV1VTddBHEDE", title: "帕梅拉 - 30分钟经典燃脂三部曲｜暴汗内啡肽+最佳HIIT+站立腹肌HIIT - 怒燃200-350卡", author: "帕梅拉PamelaReif", duration: 2023, thumbnailUrl: "http://i1.hdslb.com/bfs/archive/68a62fbf7517d148afe717532c61b20fb3dce88c.jpg" },
  { bvid: "BV12TRrBcEP8", title: "帕梅拉 - 40分钟有氧踏步三部曲｜新手大基数友好", author: "帕梅拉PamelaReif", duration: 2611, thumbnailUrl: "http://i2.hdslb.com/bfs/archive/415f728d9ba50b8d7fa6d7a4efb7175c02b237b3.jpg" },
  { bvid: "BV13g4y1q7pt", title: "【Pamela Reif 帕梅拉】15分钟舞蹈全身燃脂 | 新手友好 | 无深蹲 无卧撑 | 甩走脂肪 | 帕老师带你运动燃脂", author: "绝味鱼腿", duration: 902, thumbnailUrl: "http://i1.hdslb.com/bfs/archive/77d9a7ba73c5f5e91bf27822738a5094bf02e146.jpg" },
  { bvid: "BV163KD6bErT", title: "MIZI 15分钟高效早晨晨练 🔥 每天一遍！无跳跃、唤醒全身活力", author: "MIZI", duration: 921, thumbnailUrl: "http://i2.hdslb.com/bfs/archive/5e0e57e284fb181ddc01f16ed5373394760a71b5.jpg" },
  { bvid: "BV1skjx6tE2p", title: "MIZI 15分钟打造纸片身型 ✨ 全程无跳跃/零蹲跌 全身高效塑形", author: "MIZI", duration: 1040, thumbnailUrl: "http://i1.hdslb.com/bfs/archive/eab58b7a26f4230478a338351dfc40a2043ba91d.jpg" },
  { bvid: "BV1nLREB4Efb", title: "MIZI 20分钟下腹脂肪粉碎 [无跳跃、无深蹲、无弓箭步]", author: "MIZI", duration: 1281, thumbnailUrl: "http://i0.hdslb.com/bfs/archive/62907ec2266b29a178c03d75745fa50560a2528b.jpg" },
  { bvid: "BV1uUwezvEPF", title: "MIZI 30分钟饭后运动 | 燃烧腹部脂肪 & 减少腹胀（无跳跃、无深蹲、无弓步）", author: "MIZI", duration: 1848, thumbnailUrl: "http://i1.hdslb.com/bfs/archive/520f943849a6b99e8f273a97a9fa06e38aa38761.jpg" },
  { bvid: "BV1yQZtBeEZm", title: "MIZI 30分钟全身哑铃训练 🔥 燃脂塑形（无跳跃）", author: "MIZI", duration: 1852, thumbnailUrl: "http://i1.hdslb.com/bfs/archive/294a85fb71a43ea9e9d07209f9afbc567f7a76b3.jpg" },
  { bvid: "BV1sHbzzkE8w", title: "【B站独家】MIZI 12分钟BLACKPINK热舞派对暴汗有氧 | 无器械，全身塑形", author: "MIZI", duration: 758, thumbnailUrl: "http://i1.hdslb.com/bfs/archive/bfded90c358490942fc262e36fb6ad27c948ecbc.jpg" },
  { bvid: "BV1G9hHzyEPq", title: "MIZI 2周瘦手臂＋瘦背🔥 告别副乳＋内衣赘肉", author: "MIZI", duration: 1271, thumbnailUrl: "http://i0.hdslb.com/bfs/archive/05913d70e6d3ec5d305ed155406bd69e00df31c5.jpg" },
  { bvid: "BV1QMhJzqE6e", title: "MIZI 改善驼背和头前倾姿势｜10分钟每日颈肩体态训练", author: "MIZI", duration: 622, thumbnailUrl: "http://i2.hdslb.com/bfs/archive/e5264b5b686588a046952626915b4671c2a48bc6.jpg" },
  { bvid: "BV1jcbXzeEWM", title: "MIZI 15分钟消除副乳和背部赘肉训练", author: "MIZI", duration: 989, thumbnailUrl: "http://i2.hdslb.com/bfs/archive/38b7647da7ec994ccd02dea2684d219147005b91.jpg" },
  { bvid: "BV1aJ4m187Kk", title: "体态大师气场女王2024：圆肩驼肩、真假性驼背、头前伸、富贵包、斜方肌大、瘦背、脖子拉长、面部提升", author: "体态大师-正版", duration: 799, thumbnailUrl: "http://i2.hdslb.com/bfs/archive/c7b1eb9e10b1dacc65ad388a42dbb237db574707.jpg" },
];

async function main() {
  let updated = 0;

  for (const item of videos) {
    const existing = await prisma.video.findFirst({
      where: {
        OR: [
          { title: item.title },
          { url: { contains: item.bvid } },
        ],
      },
    });
    if (!existing) continue;

    await prisma.video.update({
      where: { id: existing.id },
      data: {
        title: item.title,
        url: `https://www.bilibili.com/video/${item.bvid}`,
        platform: "bilibili",
        sourceAuthor: item.author,
        duration: item.duration,
        thumbnailUrl: item.thumbnailUrl,
      },
    });
    updated += 1;
  }

  console.log(`Fixed curated Bilibili batch 2 metadata: updated=${updated}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
