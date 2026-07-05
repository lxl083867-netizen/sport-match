import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import Link from "next/link";
import TagBadge from "@/components/TagBadge";
import PlansToolbar from "@/components/PlansToolbar";

type SearchParams = Promise<{ tab?: string }>;

interface PlanData {
  id: string; title: string; description: string | null;
  targetAudience: string[]; authorName: string;
  likesCount: number; favoritesCount: number; followCount: number;
  videoCount: number; totalDuration: number;
  items: { id: string; title: string; duration: number | null; platform: string; order: number; note: string | null; repeatCount: number }[];
}

interface RawPlanItem {
  id: string;
  order: number | null;
  note: string | null;
  repeatCount: number | null;
  video: { title: string | null; duration: number | null; platform: string | null } | null;
}

interface RawPlan {
  id: string;
  title: string;
  description: string | null;
  targetAudience: string | string[] | null;
  user: { name: string | null } | null;
  likesCount: number;
  favoritesCount: number;
  followCount: number;
  _count?: { items: number };
  items?: RawPlanItem[];
}

function PlanCard({ plan }: { plan: PlanData }) {
  const minutes = Math.max(1, Math.floor(plan.totalDuration / 60));
  const phaseTone = (note: string | null) => {
    if (note === "warmup") return "bg-[#fff0e8] text-[#d94c25]";
    if (note === "main") return "bg-[#edf1ff] text-[#3f56df]";
    return "bg-[#eefbd7] text-[#527400]";
  };

  return (
    <Link
      href={`/plans/${plan.id}`}
      className="group relative block overflow-hidden rounded-[22px] bg-[var(--color-surface)] p-5 shadow-[0_8px_24px_rgba(149,157,165,0.08)] transition-all duration-200 hover:-translate-y-1 hover:scale-[1.01] hover:shadow-[0_14px_34px_rgba(80,86,104,0.12)]"
    >
      <div className="absolute -right-10 -top-10 h-28 w-28 rounded-full bg-[#c7ecff] opacity-70" />
      <div className="absolute right-8 top-8 h-2.5 w-2.5 rounded-full bg-[#ff5e32]" />

      <div className="relative">
        <div className="mb-4 flex items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="mb-1 text-[12px] font-semibold text-[var(--color-text-tertiary)]">@{plan.authorName}</p>
            <h3 className="line-clamp-2 text-[19px] font-semibold leading-snug tracking-[-0.01em] text-[var(--color-text-primary)]">
              {plan.title}
            </h3>
          </div>
          <div className="shrink-0 rounded-full bg-[#f0ffd2] px-3 py-1.5 text-[12px] font-bold text-[#5f8200] shadow-[0_6px_14px_rgba(178,221,90,0.16)]">
            {minutes} 分钟
          </div>
        </div>

        {plan.description && (
          <p className="mb-4 line-clamp-2 text-[13px] leading-relaxed text-[var(--color-text-secondary)]">{plan.description}</p>
        )}

        {plan.targetAudience.length > 0 && (
          <div className="mb-4 flex flex-wrap gap-1.5">
            {plan.targetAudience.slice(0, 4).map((t) => (
              <TagBadge key={t} label={t} size="sm" color="blue" />
            ))}
          </div>
        )}

        <div className="space-y-2.5">
          {plan.items.slice(0, 3).map((item, i) => (
            <div key={item.id} className="flex items-center gap-3 rounded-2xl bg-[var(--color-surface-secondary)] px-3 py-2.5">
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[var(--color-surface)] text-[12px] font-bold text-[#6C57FF] shadow-[0_4px_12px_rgba(108,87,255,0.12)]">
                {i + 1}
              </span>
              <span className="min-w-0 flex-1 truncate text-[13px] font-medium text-[var(--color-text-primary)]">{item.title}</span>
              {item.note && (
                <span className={`shrink-0 rounded-full px-2 py-1 text-[11px] font-semibold ${phaseTone(item.note)}`}>
                  {item.note === "warmup" ? "热身" : item.note === "main" ? "主训练" : "拉伸"}
                </span>
              )}
            </div>
          ))}
          {plan.items.length > 3 && (
            <p className="pl-10 text-[12px] font-medium text-[var(--color-text-tertiary)]">还有 {plan.items.length - 3} 个动作视频</p>
          )}
        </div>

        <div className="mt-4 flex items-center justify-between border-t border-[var(--color-border)] pt-4">
          <div className="flex gap-2 text-[12px] text-[var(--color-text-tertiary)]">
            <span className="rounded-full bg-[var(--color-surface-secondary)] px-2.5 py-1">{plan.followCount} 次跟练</span>
          </div>
          <div className="flex gap-3 text-[12px] font-semibold text-[var(--color-text-secondary)]">
            <span>{plan.likesCount} 赞</span>
            <span>{plan.favoritesCount} 收藏</span>
          </div>
        </div>
      </div>
    </Link>
  );
}

function parseTargetAudience(value: string | string[] | null): string[] {
  if (Array.isArray(value)) return value;
  if (!value) return [];
  try {
    const parsed: unknown = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === "string") : [];
  } catch {
    return [];
  }
}

function mapPlan(p: RawPlan): PlanData {
  const items = p.items || [];
  return {
    id: p.id,
    title: p.title,
    description: p.description,
    targetAudience: parseTargetAudience(p.targetAudience),
    authorName: p.user?.name || "匿名",
    likesCount: p.likesCount,
    favoritesCount: p.favoritesCount,
    followCount: p.followCount,
    videoCount: p._count?.items || items.length,
    totalDuration: items.reduce((s, i) => s + (i.video?.duration || 0) * (i.repeatCount || 1), 0),
    items: items.map((item, i) => ({
      id: item.id,
      title: item.video?.title || "",
      duration: item.video?.duration || null,
      platform: item.video?.platform || "",
      order: item.order || i + 1,
      note: item.note,
      repeatCount: item.repeatCount || 1,
    })),
  };
}

export default async function PlansPage({ searchParams }: { searchParams: SearchParams }) {
  const sp = await searchParams;
  const tab = sp.tab || "hot";

  const session = await auth();
  const userId = session?.user ? (session.user as { id: string }).id : null;

  let plans: PlanData[] = [];
  let noAuth = false;

  if (tab === "mine") {
    if (!userId) {
      noAuth = true;
    } else {
      const raw = await prisma.trainingPlan.findMany({
        where: { userId, isDaily: false },
        include: {
          user: { select: { name: true } },
          items: { include: { video: { select: { id: true, title: true, duration: true, platform: true } } } },
          _count: { select: { items: true } },
        },
        orderBy: { createdAt: "desc" },
        take: 50,
      });
      plans = raw.map(mapPlan);
    }
  } else {
    const raw = await prisma.trainingPlan.findMany({
      where: { isPublic: true },
      include: {
        user: { select: { name: true } },
        items: { include: { video: { select: { id: true, title: true, duration: true, platform: true } } } },
        _count: { select: { items: true } },
      },
      orderBy: tab === "new" ? { createdAt: "desc" } : { likesCount: "desc" },
      take: 50,
    });
    plans = raw.map(mapPlan);
  }

  const totalVideos = plans.reduce((sum, plan) => sum + plan.videoCount, 0);
  const totalMinutes = plans.reduce((sum, plan) => sum + Math.floor(plan.totalDuration / 60), 0);

  return (
    <div className="mx-auto max-w-[1060px] px-5 py-8 md:px-6 md:py-10">
      <div className="relative mb-6 overflow-hidden rounded-[28px] bg-[var(--color-surface)] p-6 shadow-[0_8px_24px_rgba(149,157,165,0.08)] md:p-8">
        <div className="absolute -right-14 -top-14 h-44 w-44 rounded-full bg-[#c7ecff]" />
        <div className="absolute right-16 top-14 h-3 w-3 rounded-full bg-[#ff5e32]" />
        <div className="absolute bottom-8 right-8 hidden rounded-full bg-[#B2DD5A] px-5 py-3 text-[15px] font-bold text-[#233400] shadow-[0_12px_26px_rgba(178,221,90,0.22)] md:block">
          组合成路线
        </div>

        <div className="relative flex items-start justify-between gap-4">
          <div className="min-w-0 max-w-[620px]">
            <h1 className="text-[34px] font-semibold leading-tight tracking-[-0.025em] text-[var(--color-text-primary)] md:text-[42px]">
              训练计划广场
            </h1>
          </div>
          <Link
            href="/plans/create"
            className="inline-flex shrink-0 items-center gap-2 rounded-full bg-[#6C57FF] px-4 py-2.5 text-[13px] font-semibold text-white shadow-[0_12px_24px_rgba(108,87,255,0.22)] transition-all hover:-translate-y-0.5 hover:scale-[1.03] active:scale-[0.98] sm:px-5 sm:py-3 sm:text-[14px]"
          >
            <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clipRule="evenodd" />
            </svg>
            创建计划
          </Link>
        </div>

        <div className="relative mt-7 grid grid-cols-3 gap-3">
          {[
            { label: "当前方案", value: plans.length },
            { label: "动作视频", value: totalVideos },
            { label: "累计分钟", value: totalMinutes },
          ].map((stat) => (
            <div key={stat.label} className="rounded-2xl bg-[var(--color-surface-secondary)] px-4 py-3">
              <p className="text-[22px] font-bold text-[var(--color-text-primary)]">{stat.value}</p>
              <p className="mt-1 text-[12px] text-[var(--color-text-tertiary)]">{stat.label}</p>
            </div>
          ))}
        </div>
      </div>

      <PlansToolbar tab={tab} isLoggedIn={!!userId} />

      {noAuth ? (
        <div className="rounded-[24px] bg-[var(--color-surface)] py-16 text-center shadow-[0_8px_24px_rgba(149,157,165,0.08)]">
          <p className="text-[15px] text-[var(--color-text-secondary)] mb-4">请先登录查看自己的计划</p>
          <Link href="/auth/login" className="inline-flex rounded-full bg-[#6C57FF] px-6 py-2.5 text-[14px] font-semibold text-white transition-all hover:-translate-y-0.5 hover:scale-[1.03] active:scale-[0.98]">
            去登录
          </Link>
        </div>
      ) : plans.length > 0 ? (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {plans.map((plan) => <PlanCard key={plan.id} plan={plan} />)}
        </div>
      ) : (
        <div className="rounded-[24px] bg-[var(--color-surface)] py-16 text-center shadow-[0_8px_24px_rgba(149,157,165,0.08)]">
          <p className="text-[15px] text-[var(--color-text-secondary)] mb-4">
            {tab === "mine" ? "还没有创建训练计划" : "还没有训练计划，成为第一个创建的人"}
          </p>
          <Link href="/plans/create" className="inline-flex rounded-full bg-[#6C57FF] px-6 py-2.5 text-[14px] font-semibold text-white transition-all hover:-translate-y-0.5 hover:scale-[1.03] active:scale-[0.98]">
            创建第一个计划
          </Link>
        </div>
      )}
    </div>
  );
}
