import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import Link from "next/link";
import TagBadge from "@/components/TagBadge";
import TagThemeToggle from "@/components/TagThemeToggle";

function getBadges(stats: { totalFeedbacks: number; totalPlans: number; totalLikes: number; streak: number }) {
  return [
    { name: "初来乍到", icon: "👋", desc: "完成第一次反馈", earned: stats.totalFeedbacks >= 1 },
    { name: "反馈达人", icon: "📝", desc: "完成 10 次反馈", earned: stats.totalFeedbacks >= 10 },
    { name: "运动专家", icon: "🏅", desc: "完成 50 次反馈", earned: stats.totalFeedbacks >= 50 },
    { name: "计划创造者", icon: "📋", desc: "发布第一个训练计划", earned: stats.totalPlans >= 1 },
    { name: "社区贡献者", icon: "🌟", desc: "发布的计划获得 10 个赞", earned: stats.totalLikes >= 10 },
    { name: "运动新星", icon: "🔥", desc: "连续 7 天跟练", earned: stats.streak >= 7 },
  ];
}

function formatMinutes(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} 分钟`;
  return `${Math.floor(minutes / 60)} 小时 ${minutes % 60} 分钟`;
}

function parseList(value: string | null | undefined): string[] {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.filter((item) => typeof item === "string") : [];
  } catch {
    return [];
  }
}

export default async function ProfilePage() {
  const session = await auth();
  if (!session?.user) redirect("/auth/login");

  const userId = (session.user as { id: string }).id;
  const userName = session.user?.name || "用户";

  const [profile, user, feedbacks, myPlans, likedInteractions, checkins, myVideoCount] = await Promise.all([
    prisma.userProfile.findUnique({ where: { userId } }),
    prisma.user.findUnique({ where: { id: userId } }),
    prisma.userFeedback.findMany({
      where: { userId },
      include: { video: { select: { id: true, title: true, platform: true } } },
      orderBy: { createdAt: "desc" },
    }),
    prisma.trainingPlan.findMany({
      where: { userId },
      include: {
        items: { include: { video: { select: { id: true, title: true, duration: true, platform: true } } } },
      },
      orderBy: { createdAt: "desc" },
    }),
    prisma.planInteraction.findMany({
      where: { userId, type: { in: ["like", "favorite"] } },
      include: {
        plan: {
          include: {
            user: { select: { name: true } },
            items: { include: { video: { select: { id: true, title: true, duration: true, platform: true } } } },
          },
        },
      },
      orderBy: { createdAt: "desc" },
    }),
    prisma.videoCheckIn.findMany({
      where: { userId },
      include: {
        video: {
          select: { id: true, title: true, duration: true, platform: true, tags: { include: { tag: true } } },
        },
      },
      orderBy: { createdAt: "desc" },
    }),
    prisma.userVideo.count({ where: { userId } }),
  ]);

  const totalFeedbacks = feedbacks.length;
  const totalPlans = myPlans.length;
  const totalLikesOnMyPlans = myPlans.reduce((sum, plan) => sum + plan.likesCount, 0);
  const favoritedPlans = likedInteractions.filter((interaction) => interaction.type === "favorite");
  const totalCheckins = checkins.length;
  const totalDuration = checkins.reduce((sum, checkin) => sum + (checkin.video.duration || 0), 0);

  const now = new Date();
  const dayLabels: string[] = [];
  const dayCounts: number[] = [];
  for (let i = 6; i >= 0; i--) {
    const date = new Date(now);
    date.setDate(date.getDate() - i);
    dayLabels.push(date.toLocaleDateString("zh-CN", { weekday: "short" }));
    const dateKey = date.toISOString().slice(0, 10);
    dayCounts.push(checkins.filter((checkin) => checkin.createdAt.toISOString().slice(0, 10) === dateKey).length);
  }
  let streak = 0;
  const checkinDates = new Set(checkins.map((checkin) => checkin.createdAt.toISOString().slice(0, 10)));
  for (let i = 0; i < 365; i++) {
    const date = new Date(now);
    date.setDate(date.getDate() - i);
    if (checkinDates.has(date.toISOString().slice(0, 10))) {
      streak++;
    } else if (i > 0) {
      break;
    }
  }

  const typeCounts: Record<string, number> = {};
  for (const checkin of checkins) {
    for (const videoTag of checkin.video.tags) {
      const category = videoTag.tag.category;
      if (category === "type" || category === "goal" || category === "muscle") {
        typeCounts[videoTag.tag.nameZh] = (typeCounts[videoTag.tag.nameZh] || 0) + 1;
      }
    }
  }
  const sortedTypes = Object.entries(typeCounts).sort((a, b) => b[1] - a[1]).slice(0, 5);
  const maxTypeCount = Math.max(...sortedTypes.map(([, count]) => count), 1);

  const weeklyGoal = 5;
  const weeklyCount = dayCounts.reduce((sum, count) => sum + count, 0);
  const weeklyProgress = Math.min(weeklyCount / weeklyGoal, 1);
  const weeklyProgressPercent = Math.round(weeklyProgress * 100);

  const goals = parseList(profile?.goals);
  const bodyConditions = parseList(profile?.bodyConditions);
  const equipment = parseList(profile?.equipment);
  const badges = getBadges({ totalFeedbacks, totalPlans, totalLikes: totalLikesOnMyPlans, streak });
  const earnedBadges = badges.filter((badge) => badge.earned);
  const topType = sortedTypes[0]?.[0] || goals[0] || "训练";
  const missingHint = sortedTypes.length > 0 && !sortedTypes.some(([name]) => name.includes("拉伸"))
    ? "拉伸内容偏少，可以在计划里保留收尾环节。"
    : "训练结构相对均衡，可以继续保持节奏。";
  const insightText = totalCheckins > 0
    ? `你最近更偏向${topType}，累计训练 ${formatMinutes(totalDuration)}。${missingHint}`
    : "还没有足够训练记录。先完成几次跟练，系统会开始整理你的运动偏好。";

  const recentActivities: Array<{
    id: string;
    date: Date;
    href: string;
    kind: string;
    title: string;
    meta: string;
    tone: string;
  }> = [
    ...checkins.slice(0, 8).map((checkin) => ({
      id: `checkin-${checkin.id}`,
      date: checkin.createdAt,
      href: `/videos/${checkin.video.id}`,
      kind: "打卡",
      title: checkin.video.title,
      meta: checkin.video.duration ? formatMinutes(checkin.video.duration) : "已完成一次训练",
      tone: "blue",
    })),
    ...feedbacks.slice(0, 8).map((feedback) => ({
      id: `feedback-${feedback.id}`,
      date: feedback.createdAt,
      href: `/videos/${feedback.video.id}`,
      kind: "反馈",
      title: feedback.video.title,
      meta: `${feedback.difficultyRating === "too_easy" ? "太简单" : feedback.difficultyRating === "just_right" ? "刚好" : "太难"} · ${
        feedback.completionRate === "fully" ? "完整跟练" : feedback.completionRate === "partial" ? "部分完成" : "中途放弃"
      }`,
      tone: "green",
    })),
  ].sort((a, b) => b.date.getTime() - a.date.getTime()).slice(0, 9);

  const workbenchPlans = myPlans.map((plan) => {
    const duration = plan.items.reduce((sum, item) => sum + (item.video.duration || 0), 0);
    return {
      id: plan.id,
      title: plan.title,
      durationText: formatMinutes(duration),
      likesCount: plan.likesCount,
      favoritesCount: plan.favoritesCount,
      items: plan.items.map((item) => ({ id: item.id, title: item.video.title })),
    };
  });

  const cardClass = "profile-card";
  const progressGradients = [
    "linear-gradient(90deg,#FF5E32,#ff2f5f)",
    "linear-gradient(90deg,#6C57FF,#0F86AD)",
    "linear-gradient(90deg,#0F86AD,#B2DD5A)",
    "linear-gradient(90deg,#FF5E32,#6C57FF)",
    "linear-gradient(90deg,#B2DD5A,#0F86AD)",
  ];

  return (
    <div className="profile-page mx-auto max-w-7xl px-4 py-6 md:px-6 md:py-8">
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        <aside className="space-y-5 lg:col-span-4 lg:sticky lg:top-6 lg:self-start">
          <section className={`relative overflow-hidden animate-fade-up ${cardClass} p-5`}>
            <div className="pointer-events-none absolute -right-12 -top-16 h-44 w-44 rounded-full bg-[#b9e8ff] opacity-70" />
            <div className="pointer-events-none absolute right-[72px] top-9 h-3 w-3 rounded-full bg-[#FF5E32]" />
            <div className="pointer-events-none absolute bottom-5 left-8 h-2.5 w-2.5 rounded-full bg-[#B2DD5A]" />

            <div className="relative flex items-start gap-4">
              <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-[20px] bg-[#6C57FF] text-[22px] font-semibold text-white shadow-[0_14px_30px_rgba(108,87,255,0.24)]">
                {userName.charAt(0)}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h1 className="truncate text-[26px] font-semibold leading-tight tracking-[-0.022em] text-[var(--color-text-primary)]">
                    {userName}
                  </h1>
                  {profile && (
                    <span className="spring-hover rounded-full bg-[var(--profile-green-soft)] px-2.5 py-1 text-[11px] font-semibold text-[#5c7e08]">
                      {profile.fitnessLevel === "beginner" ? "运动小白" : profile.fitnessLevel === "intermediate" ? "有经验" : "专业"}
                    </span>
                  )}
                </div>
                <p className="mt-1 truncate text-[13px] text-[var(--color-text-secondary)]">{user?.email}</p>
              </div>
              <Link
                href="/profile/setup"
                className="spring-hover relative z-10 shrink-0 rounded-full bg-[var(--profile-soft)] px-4 py-2 text-[13px] font-medium text-[var(--color-text-secondary)]"
              >
                编辑画像
              </Link>
            </div>

            <p className="relative mt-4 text-[14px] leading-relaxed text-[var(--color-text-secondary)]">
              {insightText}
            </p>

            {profile && (
              <div className="relative mt-5 flex flex-wrap gap-2">
                {goals.slice(0, 3).map((goal) => <TagBadge key={goal} label={goal} size="sm" color="orange" />)}
                {bodyConditions.slice(0, 2).map((condition) => <TagBadge key={condition} label={condition} size="sm" color="red" />)}
                {equipment.slice(0, 2).map((item) => <TagBadge key={item} label={item} size="sm" color="purple" />)}
              </div>
            )}

            <div className="relative mt-6 grid grid-cols-2 gap-3">
              {[
                { label: "总打卡", value: totalCheckins, tone: "text-[#0F86AD]" },
                { label: "累计时长", value: formatMinutes(totalDuration), tone: "text-[#6C57FF]" },
                { label: "连续天数", value: streak, tone: "text-[#FF5E32]" },
                { label: "创建计划", value: totalPlans, tone: "text-[#0F86AD]" },
              ].map((stat) => (
                <button key={stat.label} type="button" className="stat-bounce rounded-[18px] bg-[var(--profile-soft)] px-4 py-3 text-left">
                  <p className={`text-[24px] font-semibold leading-tight tracking-tight ${stat.tone}`}>{stat.value}</p>
                  <p className="mt-1 text-[12px] text-[var(--color-text-tertiary)]">{stat.label}</p>
                </button>
              ))}
            </div>

            <div className="relative mt-6 rounded-[20px] bg-[var(--profile-soft)] p-4">
              <div className="mb-3 flex items-center justify-between gap-4">
              <div>
                <h2 className="text-[16px] font-semibold text-[var(--color-text-primary)]">近 7 天训练路线</h2>
                <p className="text-[12px] text-[var(--color-text-tertiary)]">本周 {weeklyCount}/{weeklyGoal} 次</p>
              </div>
              <span className="rounded-full bg-[var(--profile-purple-soft)] px-3 py-1 text-[12px] font-semibold text-[#6C57FF]">
                {weeklyProgressPercent}%
              </span>
              </div>
              <div className="grid grid-cols-7 gap-2">
                {dayLabels.map((label, index) => (
                  <div key={`${label}-${index}`} className="min-w-0 text-center">
                    <div
                      className={[
                        "mx-auto flex h-9 w-9 items-center justify-center rounded-full text-[11px] font-semibold transition-all duration-200 hover:scale-105",
                        dayCounts[index] > 0
                          ? "bg-[#FF5E32] text-white shadow-[0_10px_22px_rgba(255,94,50,0.28)]"
                          : "border border-dashed border-[var(--profile-line)] bg-[var(--profile-raised)] text-[var(--color-text-tertiary)]",
                      ].join(" ")}
                    >
                      {dayCounts[index] > 0 ? (
                        <svg className="h-4 w-4" viewBox="0 0 20 20" fill="none" aria-hidden="true">
                          <path d="m5 10 3 3 7-7" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      ) : (
                        label
                      )}
                    </div>
                    <p className={dayCounts[index] > 0 ? "mt-1 text-[10px] font-semibold text-[#FF5E32]" : "mt-1 text-[10px] text-[var(--color-text-tertiary)]"}>
                      {dayCounts[index] > 0 ? `${dayCounts[index]} 次` : "未打卡"}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </section>

          <section className={`${cardClass} p-5`}>
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-[16px] font-semibold text-[var(--color-text-primary)]">成就进度</h2>
              <span className="text-[12px] text-[var(--color-text-tertiary)]">{earnedBadges.length}/{badges.length}</span>
            </div>
            <div className="mb-4 h-2 overflow-hidden rounded-full bg-[var(--profile-soft)]">
              <div
                className="h-full rounded-full bg-[#FF5E32]"
                style={{ width: `${Math.max((earnedBadges.length / badges.length) * 100, 8)}%` }}
              />
            </div>
            <div className="grid grid-cols-3 gap-2">
              {badges.slice(0, 6).map((badge) => (
                <div
                  key={badge.name}
                  className={`min-w-0 rounded-[16px] px-2 py-2.5 text-center transition-all duration-200 hover:-translate-y-1 hover:scale-105 ${
                    badge.earned ? "bg-[var(--profile-orange-soft)] shadow-[0_8px_22px_rgba(255,94,50,0.16)]" : "bg-[var(--profile-soft)] opacity-50"
                  }`}
                >
                  <div className="text-[18px] leading-none">{badge.icon}</div>
                  <p className={`mt-1 truncate text-[11px] font-semibold ${badge.earned ? "text-[#FF5E32]" : "text-[var(--color-text-tertiary)]"}`}>
                    {badge.name}
                  </p>
                </div>
              ))}
            </div>
            <div className="mt-5 pt-3">
              <TagThemeToggle compact />
            </div>
          </section>

          <section className={`relative overflow-hidden ${cardClass} p-5`}>
            <div className="absolute -right-8 bottom-0 h-24 w-24 rounded-full bg-[var(--profile-green-soft)]" />
            <div className="relative mb-4 flex items-start justify-between gap-3">
              <div>
                <h2 className="text-[16px] font-semibold text-[var(--color-text-primary)]">视频收藏库</h2>
                <p className="text-[12px] text-[var(--color-text-secondary)]">分散收藏的素材池</p>
              </div>
              <Link
                href="/plans/create"
                className="spring-hover shrink-0 rounded-full bg-[#6C57FF] px-3 py-1.5 text-[12px] font-semibold text-white shadow-[0_10px_22px_rgba(108,87,255,0.22)]"
              >
                + 快速生成计划
              </Link>
            </div>
            <div className="relative flex items-end justify-between gap-4">
              <div>
                <p className="stat-bounce text-[40px] font-semibold leading-none tracking-tight text-[#0F86AD]">{myVideoCount}</p>
                <p className="mt-1 text-[12px] text-[var(--color-text-tertiary)]">个收藏源</p>
              </div>
              <Link href="/videos?mine=true" className="spring-hover rounded-full bg-[var(--profile-blue-soft)] px-3 py-2 text-[13px] font-semibold text-[#0F86AD]">
                查看全部 →
              </Link>
            </div>
            <div className="relative mt-5 flex items-center gap-2 rounded-full bg-[var(--profile-soft)] px-3 py-2 text-[12px] font-semibold text-[var(--color-text-secondary)]">
              <span className="h-2 w-2 rounded-full bg-[#FF5E32]" />
              <span>收藏视频</span>
              <span className="h-px flex-1 border-t border-dashed border-[var(--profile-line)]" />
              <span className="text-[#6C57FF]">训练计划</span>
            </div>
          </section>
        </aside>

        <main className="space-y-5 lg:col-span-8">
          <section className={`${cardClass} p-5 md:p-6`}>
            <div className="mb-5 flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
              <div>
                <span className="rounded-full bg-[var(--profile-orange-soft)] px-3 py-1 text-[12px] font-semibold text-[#FF5E32]">
                  动态反馈
                </span>
                <h2 className="mt-3 text-[24px] font-semibold text-[var(--color-text-primary)]">我的运动画像</h2>
                <p className="mt-1 max-w-2xl text-[14px] leading-relaxed text-[var(--color-text-secondary)]">{insightText}</p>
              </div>
              <div className="flex w-full items-center justify-between rounded-[18px] bg-[var(--profile-soft)] px-4 py-3 text-left md:w-auto md:block md:text-right">
                <p className="text-[12px] text-[var(--color-text-tertiary)]">当前偏向</p>
                <p className="text-[22px] font-semibold text-[#6C57FF] md:mt-1">{topType}</p>
              </div>
            </div>

            {sortedTypes.length > 0 ? (
              <>
                <div className="space-y-2 md:hidden">
                  {sortedTypes.map(([name, count], index) => (
                    <div key={name} className="grid grid-cols-[64px_minmax(0,1fr)_40px] items-center gap-3 rounded-[16px] bg-[var(--profile-soft)] px-3 py-2.5">
                      <span className="truncate text-[13px] font-semibold text-[var(--color-text-primary)]">{name}</span>
                      <div className="h-2.5 overflow-hidden rounded-full bg-[var(--profile-raised)]">
                        <div
                          className="h-full rounded-full"
                          style={{
                            width: `${Math.max((count / maxTypeCount) * 100, 8)}%`,
                            background: progressGradients[index % progressGradients.length],
                          }}
                        />
                      </div>
                      <span className="rounded-full bg-[var(--profile-raised)] px-2 py-0.5 text-center text-[11px] font-semibold text-[#6C57FF]">{count}</span>
                    </div>
                  ))}
                </div>

                <div className="hidden gap-3 md:grid md:grid-cols-5">
                  {sortedTypes.map(([name, count], index) => (
                    <div key={name} className="min-w-0 rounded-[18px] bg-[var(--profile-soft)] p-3">
                      <div className="mb-3 flex items-center justify-between gap-2">
                        <span className="truncate text-[13px] font-semibold text-[var(--color-text-primary)]">{name}</span>
                        <span className="rounded-full bg-[var(--profile-raised)] px-2 py-0.5 text-[11px] font-semibold text-[#6C57FF]">{count}</span>
                      </div>
                      <div className="flex h-24 items-end rounded-[14px] bg-[var(--profile-raised)] px-2 pb-2">
                        <div
                          className="w-full rounded-t-[12px]"
                          style={{
                            height: `${Math.max((count / maxTypeCount) * 100, 12)}%`,
                            background: progressGradients[index % progressGradients.length],
                          }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <p className="rounded-[14px] bg-[var(--profile-soft)] px-4 py-5 text-center text-[13px] text-[var(--color-text-tertiary)]">
                完成几次跟练后，这里会显示你的训练偏好。
              </p>
            )}

            <div className="mt-5 flex flex-wrap gap-2 pt-1">
              {[...goals, ...bodyConditions, ...equipment].slice(0, 8).map((tag, index) => (
                <TagBadge key={`${tag}-${index}`} label={tag} size="sm" color={index % 3 === 0 ? "orange" : index % 3 === 1 ? "blue" : "purple"} />
              ))}
            </div>
          </section>

          <section className={`relative overflow-hidden ${cardClass} p-5 md:p-6`}>
            <div className="pointer-events-none absolute -right-10 top-8 h-32 w-32 rounded-full bg-[var(--profile-purple-soft)]" />
            <div className="relative mb-5 flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
              <div>
                <div className="mb-2 flex flex-wrap items-center gap-2">
                  <span className="rounded-full bg-[var(--profile-blue-soft)] px-3 py-1 text-[12px] font-semibold text-[#0F86AD]">
                    收藏库 → 可执行计划
                  </span>
                  <span className="rounded-full bg-[var(--profile-green-soft)] px-3 py-1 text-[12px] font-semibold text-[#5c7e08]">
                    Quest Timeline
                  </span>
                </div>
                <h2 className="text-[24px] font-semibold text-[var(--color-text-primary)]">训练计划工作台</h2>
                <p className="mt-1 text-[14px] text-[var(--color-text-secondary)]">管理你创建和收藏的训练方案。</p>
              </div>
              <Link href="/plans/create" className="spring-hover shrink-0 rounded-full bg-[#6C57FF] px-4 py-2 text-[13px] font-semibold text-white shadow-[0_10px_22px_rgba(108,87,255,0.22)]">
                新建计划
              </Link>
            </div>

            <div className="relative">
              {workbenchPlans.length === 0 ? (
                <p className="rounded-[18px] bg-[var(--profile-soft)] px-4 py-8 text-center text-[14px] text-[var(--color-text-tertiary)]">
                  还没有创建计划，先把收藏视频整理成一套路线。
                </p>
              ) : (
                <div className="space-y-3">
                  {workbenchPlans.slice(0, 7).map((plan) => (
                    <Link
                      key={plan.id}
                      href={`/plans/${plan.id}`}
                      className="group block rounded-[18px] bg-[var(--profile-raised)] px-4 py-3 shadow-[var(--profile-shadow)] transition-all duration-200 hover:-translate-y-1 hover:scale-[1.01] hover:shadow-[var(--profile-shadow-hover)]"
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="min-w-0">
                          <h3 className="truncate text-[16px] font-semibold text-[var(--color-text-primary)]">
                            {plan.title}
                          </h3>
                          <p className="mt-1 text-[12px] text-[var(--color-text-tertiary)]">
                            {plan.items.length} 个视频 · {plan.durationText}
                          </p>
                        </div>
                        <div className="shrink-0 rounded-full bg-[var(--profile-soft)] px-2.5 py-1 text-right text-[11px] font-medium text-[var(--color-text-tertiary)]">
                          {plan.likesCount} 赞 · {plan.favoritesCount} 收藏
                        </div>
                      </div>

                      {plan.items.length > 0 && (
                        <div className="mt-3 flex gap-1.5 overflow-hidden">
                          {plan.items.slice(0, 3).map((item) => (
                            <span
                              key={item.id}
                              className="min-w-0 truncate rounded-full bg-[var(--profile-soft)] px-2 py-0.5 text-[11px] text-[var(--color-text-tertiary)] transition-transform duration-200 group-hover:scale-105"
                            >
                              {item.title}
                            </span>
                          ))}
                        </div>
                      )}
                    </Link>
                  ))}
                </div>
              )}
            </div>

            {favoritedPlans.length > 0 && (
              <div className="mt-6 pt-1">
                <p className="mb-3 text-[13px] font-semibold text-[var(--color-text-primary)]">收藏的计划</p>
                <div className="grid gap-2 md:grid-cols-2">
                  {favoritedPlans.slice(0, 4).map((interaction) => (
                    <Link
                      key={interaction.id}
                      href={`/plans/${interaction.plan.id}`}
                      className="spring-hover min-w-0 rounded-[16px] bg-[var(--profile-soft)] px-3 py-2.5"
                    >
                      <p className="truncate text-[13px] font-semibold text-[var(--color-text-primary)]">{interaction.plan.title}</p>
                      <p className="mt-1 text-[11px] text-[var(--color-text-tertiary)]">@{interaction.plan.user.name} · {interaction.plan.items.length} 个视频</p>
                    </Link>
                  ))}
                </div>
              </div>
            )}
          </section>

          <section className={`${cardClass} p-5 md:p-6`}>
            <div className="mb-4 flex items-center justify-between gap-4">
              <div>
                <h2 className="text-[20px] font-semibold text-[var(--color-text-primary)]">最近打卡</h2>
              </div>
              <span className="rounded-full bg-[var(--profile-soft)] px-3 py-1 text-[12px] font-semibold text-[var(--color-text-tertiary)]">
                {recentActivities.length} 条
              </span>
            </div>
            {recentActivities.length === 0 ? (
              <p className="rounded-[16px] bg-[var(--profile-soft)] px-4 py-8 text-center text-[14px] text-[var(--color-text-tertiary)]">
                暂时还没有训练动态。
              </p>
            ) : (
              <div className="grid gap-3 md:grid-cols-2">
                {recentActivities.map((activity) => (
                  <Link key={activity.id} href={activity.href} className="grid grid-cols-[32px_minmax(0,1fr)] gap-3 rounded-[16px] bg-[var(--profile-soft)] px-3 py-3">
                    <span className={`mt-0.5 flex h-8 w-8 items-center justify-center rounded-full text-[11px] font-semibold ${
                      activity.tone === "blue" ? "bg-[var(--profile-blue-soft)] text-[#0F86AD]" : "bg-[var(--profile-green-soft)] text-[#5c7e08]"
                    }`}>
                      {activity.kind.slice(0, 1)}
                    </span>
                    <span className="min-w-0">
                      <span className="flex items-center gap-2 text-[12px] text-[var(--color-text-tertiary)]">
                        <span>{activity.kind}</span>
                        <span>{activity.date.toLocaleDateString("zh-CN", { month: "numeric", day: "numeric" })}</span>
                      </span>
                      <span className="mt-0.5 block truncate text-[13px] font-medium text-[var(--color-text-primary)]">{activity.title}</span>
                      <span className="mt-0.5 block truncate text-[12px] text-[var(--color-text-tertiary)]">{activity.meta}</span>
                    </span>
                  </Link>
                ))}
              </div>
            )}
          </section>
        </main>
      </div>
    </div>
  );
}
