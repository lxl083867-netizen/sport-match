import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import Link from "next/link";
import VideoCard from "@/components/VideoCard";
import VideoFilters from "@/components/VideoFilters";
import AddVideoButton from "@/components/AddVideoButton";

type SearchParams = Promise<{ search?: string; platform?: string; tag?: string; mine?: string }>;

export default async function VideosPage({ searchParams }: { searchParams: SearchParams }) {
  const sp = await searchParams;
  const search = sp.search || "";
  const platform = sp.platform || "";
  const tag = sp.tag || "";
  const mine = sp.mine === "true";

  const session = await auth();
  const userId = session?.user ? (session.user as { id: string }).id : null;

  // User's collection (via UserVideo, not Video.userId)
  const myVideoIds = userId
    ? (await prisma.userVideo.findMany({ where: { userId }, select: { videoId: true } })).map((uv) => uv.videoId)
    : [];

  const where: Record<string, unknown> = {};
  if (platform) where.platform = platform;
  if (search) {
    where.OR = [
      { title: { contains: search } },
      { sourceAuthor: { contains: search } },
    ];
  }
  if (tag) {
    where.tags = { some: { tag: { nameZh: tag } } };
  }
  if (mine && userId) {
    where.id = { in: myVideoIds };
  }

  const videos = await prisma.video.findMany({
    include: {
      tags: { include: { tag: true } },
    },
    where,
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  const mapped = videos.map((v) => ({
    id: v.id,
    title: v.title,
    platform: v.platform,
    duration: v.duration,
    thumbnailUrl: v.thumbnailUrl,
    sourceAuthor: v.sourceAuthor,
    tags: v.tags.map((vt) => ({
      name: vt.tag.name,
      category: vt.tag.category,
      nameZh: vt.tag.nameZh,
      confidence: vt.confidence,
    })),
    isOwner: myVideoIds.includes(v.id),
  }));
  const embeddableCount = mapped.filter((v) => v.platform === "bilibili").length;
  const importedCount = mapped.filter((v) => v.isOwner).length;
  const activeFilterCount = [search, platform, tag, mine ? "mine" : ""].filter(Boolean).length;

  return (
    <div className="mx-auto max-w-6xl px-5 py-8 md:px-6 md:py-10">
      <div className="relative mb-6 overflow-hidden rounded-[28px] bg-[var(--color-surface)] p-6 shadow-[0_8px_24px_rgba(149,157,165,0.08)] md:p-8">
        <div className="absolute -right-16 -top-16 h-48 w-48 rounded-full bg-[#c7ecff]" />
        <div className="absolute right-20 top-16 h-3 w-3 rounded-full bg-[#ff5e32]" />
        <div className="absolute bottom-8 right-8 hidden rotate-[-4deg] rounded-[18px] bg-[var(--color-surface)] px-5 py-4 shadow-[0_12px_30px_rgba(80,86,104,0.14)] md:block">
          <p className="text-[12px] font-semibold text-[var(--color-text-tertiary)]">收藏</p>
          <p className="text-[22px] font-bold text-[#4F68FD]">变成路线</p>
        </div>

        <div className="relative flex items-start justify-between gap-4">
          <div className="min-w-0 max-w-[620px]">
            <h1 className="text-[34px] font-semibold leading-tight tracking-[-0.025em] text-[var(--color-text-primary)] md:text-[42px]">
              发现运动视频
            </h1>
          </div>
          <div className="shrink-0">
            <AddVideoButton />
          </div>
        </div>

        <div className="relative mt-7 grid grid-cols-3 gap-3">
          {[
            { label: "筛选结果", value: mapped.length },
            { label: "站内播放", value: embeddableCount },
            { label: mine ? "已导入" : "我的导入", value: userId ? importedCount : myVideoIds.length },
          ].map((stat) => (
            <div key={stat.label} className="rounded-2xl bg-[var(--color-surface-secondary)] px-4 py-3">
              <p className="text-[22px] font-bold text-[var(--color-text-primary)]">{stat.value}</p>
              <p className="mt-1 text-[12px] text-[var(--color-text-tertiary)]">{stat.label}</p>
            </div>
          ))}
        </div>

        <VideoFilters
          search={search}
          platform={platform}
          tag={tag}
          mine={mine}
          showMineToggle={!!userId}
          activeFilterCount={activeFilterCount}
          embedded
        />
      </div>

      {mapped.length === 0 ? (
        <div className="rounded-[24px] bg-[var(--color-surface)] py-20 text-center text-[var(--color-text-tertiary)] shadow-[0_8px_24px_rgba(149,157,165,0.08)]">
          {mine ? "还没有导入视频，" : "暂无视频，换个筛选条件试试"}
          {mine && (
            <Link href="/videos" className="text-[var(--color-brand)] hover:underline ml-1">
              去发现
            </Link>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {mapped.map((v) => (
            <VideoCard key={v.id} {...v} />
          ))}
        </div>
      )}
    </div>
  );
}
