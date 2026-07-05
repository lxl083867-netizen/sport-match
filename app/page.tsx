import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getRecommendations } from "@/lib/recommendation";
import { generateTodayPlan, extractCollectionProfile, getFeedbackHash, TODAY_PLAN_VERSION, type PlanVideo, type CollectionInsight, type VideoWithTags } from "@/lib/today-plan";
import Link from "next/link";
import HomeTabs from "@/components/HomeTabs";
import TodayPlanCard from "@/components/TodayPlanCard";
import QuickStartCard from "@/components/QuickStartCard";
import CollectionInsightCard from "@/components/CollectionInsightCard";
import HomeHero from "@/components/HomeHero";
import crypto from "crypto";

const MAX_REFRESH = 3;

function computeProfileHash(goals: string, fitnessLevel: string, equipment: string, bodyConditions: string, availableTime: string, feedbackHash: string): string {
  const str = `${TODAY_PLAN_VERSION}|${goals}|${fitnessLevel}|${equipment}|${bodyConditions}|${availableTime}|${feedbackHash}`;
  return crypto.createHash("sha256").update(str).digest("hex").slice(0, 16);
}

function dateKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function computeRecentStreak(dateSet: Set<string>): number {
  if (dateSet.size === 0) return 0;
  const today = new Date();
  const start = new Date(today);
  if (!dateSet.has(dateKey(start))) {
    start.setDate(start.getDate() - 1);
  }

  let streak = 0;
  for (let i = 0; i < 365; i++) {
    const cursor = new Date(start);
    cursor.setDate(start.getDate() - i);
    if (!dateSet.has(dateKey(cursor))) break;
    streak++;
  }
  return streak;
}

function normalizeTrainingLabel(label: string): string {
  return label.endsWith("训练") ? label : `${label}训练`;
}

function pickCompletedLabel(tags: Array<{ tag: { category: string; nameZh: string } }>): string | null {
  const priority = ["muscle", "goal", "type"];
  for (const category of priority) {
    const match = tags.find((item) => item.tag.category === category);
    if (match) return normalizeTrainingLabel(match.tag.nameZh);
  }
  return null;
}

export default async function HomePage() {
  const session = await auth();
  const userId = session?.user ? (session.user as { id: string }).id : null;
  const userName = session?.user?.name || "用户";

  // Fetch user profile
  const profile = userId
    ? await prisma.userProfile.findUnique({ where: { userId } })
    : null;
  const goals: string[] = profile ? JSON.parse(profile.goals) : [];
  const hasProfile = !!profile && goals.length > 0;

  // Fetch user's own videos (collections) — via UserVideo
  const myVideoIds = userId
    ? (await prisma.userVideo.findMany({ where: { userId }, select: { videoId: true } })).map((uv) => uv.videoId)
    : [];
  const userVideos: NonNullable<VideoWithTags>[] = userId && myVideoIds.length > 0
    ? await prisma.video.findMany({
        where: { id: { in: myVideoIds } },
        include: { tags: { include: { tag: true } } },
        orderBy: { createdAt: "desc" },
        take: 30,
      })
    : [];
  const hasCollection = userVideos.length > 0;

  const collectionProfile = extractCollectionProfile(userVideos);

  // ── Today's plan with persistence (like QQ Music "Daily 30") ──
  let todayVideos: PlanVideo[] = [];
  let sourceText = "";
  let goalText = "今日训练";
  let insights: CollectionInsight | null = null;
  let feedbackAdjustment: string | null = null;
  let explanation: { summary: string; items: Array<{ label: string; detail: string; tone: "collection"|"fill"|"warn"|"playback"|"feedback"; videoId?: string }>; goal: string } | null = null;
  let refreshCount = 0;
  let canRefresh = true;
  const today = new Date().toISOString().slice(0, 10);

  if (hasProfile) {
    const feedbackHash = await getFeedbackHash(userId!);
    const profileHash = computeProfileHash(
      profile!.goals,
      profile!.fitnessLevel,
      profile!.equipment,
      profile!.bodyConditions,
      profile!.availableTime || "30",
      feedbackHash,
    );

    const existing = await prisma.dailyRecommendation.findUnique({
      where: { userId_date: { userId: userId!, date: today } },
    });

    const needsRegen = !existing || existing.profileHash !== profileHash;

    if (needsRegen) {
      // Generate new plan: first time today, or profile changed
      const plan = await generateTodayPlan(
        userId!,
        {
          goals: profile!.goals,
          equipment: profile!.equipment,
          bodyConditions: profile!.bodyConditions,
          fitnessLevel: profile!.fitnessLevel,
          availableTime: profile!.availableTime || "30",
        },
        userVideos,
        collectionProfile,
      );

      if (existing) {
        // Profile changed → auto-refresh, keep refreshCount
        await prisma.dailyRecommendation.update({
          where: { userId_date: { userId: userId!, date: today } },
          data: {
            planData: JSON.stringify(plan),
            profileHash,
            videoIds: JSON.stringify(plan.todayVideos.map((v) => v.id)),
            reason: `${plan.goalText} · ${plan.sourceText}`,
          },
        });
        refreshCount = existing.refreshCount;
      } else {
        await prisma.dailyRecommendation.create({
          data: {
            userId: userId!,
            date: today,
            planData: JSON.stringify(plan),
            profileHash,
            refreshCount: 0,
            videoIds: JSON.stringify(plan.todayVideos.map((v) => v.id)),
            reason: `${plan.goalText} · ${plan.sourceText}`,
          },
        });
        refreshCount = 0;
      }

      todayVideos = plan.todayVideos;
      goalText = plan.goalText;
      sourceText = plan.sourceText;
      insights = plan.insights;
      feedbackAdjustment = plan.feedbackAdjustment ?? null;
      explanation = plan.explanation ?? null;
    } else {
      // Hit: reuse today's plan
      const stored = JSON.parse(existing.planData || "{}");
      todayVideos = stored.todayVideos || [];
      goalText = stored.goalText || "今日训练";
      sourceText = stored.sourceText || "";
      insights = stored.insights || null;
      feedbackAdjustment = stored.feedbackAdjustment ?? null;
      explanation = stored.explanation ?? null;
      refreshCount = existing.refreshCount;
    }

    canRefresh = refreshCount < MAX_REFRESH;
  }

  const totalDuration = todayVideos.reduce((s, v) => s + (v.duration || 0), 0);

  // Hot videos for discovery
  const hotVideos = await prisma.video.findMany({
    include: {
      tags: { include: { tag: true } },
      _count: { select: { checkins: true } },
    },
    orderBy: { checkins: { _count: "desc" } },
    take: 6,
  });

  // Recent checkins
  let recentCheckins: Array<{
    id: string; createdAt: Date;
    video: {
      id: string; title: string; platform: string; duration: number | null;
      sourceAuthor: string; thumbnailUrl: string | null;
    };
  }> = [];
  let trainingProgress: { trainingDayCount: number; streakDays: number; lastCompletedLabel: string | null } | null = null;
  let generationBasis: { checkinCount: number; importedVideoCount: number; feedbackCount: number } | null = null;
  if (userId) {
    const [checkinCount, feedbackCount] = await Promise.all([
      prisma.videoCheckIn.count({ where: { userId } }),
      prisma.userFeedback.count({ where: { userId } }),
    ]);
    generationBasis = {
      checkinCount,
      importedVideoCount: myVideoIds.length,
      feedbackCount,
    };

    recentCheckins = await prisma.videoCheckIn.findMany({
      where: { userId },
      include: {
        video: {
          select: { id: true, title: true, platform: true, duration: true, sourceAuthor: true, thumbnailUrl: true },
        },
      },
      orderBy: { createdAt: "desc" },
      take: 8,
      distinct: ["videoId"],
    });

    const progressCheckins = await prisma.videoCheckIn.findMany({
      where: { userId },
      include: {
        video: {
          select: {
            tags: { include: { tag: true } },
          },
        },
      },
      orderBy: { createdAt: "desc" },
      take: 200,
    });
    const trainingDateSet = new Set(progressCheckins.map((checkin) => dateKey(checkin.createdAt)));
    trainingProgress = {
      trainingDayCount: trainingDateSet.size,
      streakDays: computeRecentStreak(trainingDateSet),
      lastCompletedLabel: progressCheckins[0] ? pickCompletedLabel(progressCheckins[0].video.tags) : null,
    };
  }

  // Personalized recommendations for discovery section
  let personalized: Array<{
    videoId: string; title: string; url: string; platform: string;
    sourceAuthor: string; thumbnailUrl: string | null; duration: number | null;
    tags: Array<{ name: string; category: string; nameZh: string }>;
    matchScore: number; matchReasons: string[];
  }> = [];
  if (userId && hasProfile) {
    personalized = await getRecommendations(userId, 6, "discovery", collectionProfile);
  }

  return (
    <div>
      {!session ? (
        <section className="bg-[var(--color-surface)]">
          <div className="max-w-[980px] mx-auto px-6 py-28 md:py-40 flex flex-col items-center text-center">
            <h1 className="text-[40px] md:text-[56px] font-semibold leading-[1.08] tracking-[-0.025em] text-[var(--color-text-primary)] max-w-2xl animate-fade-up">
              收藏夹里的运动视频，该动起来了
            </h1>
            <p className="mt-5 text-[17px] leading-relaxed text-[var(--color-text-secondary)] max-w-lg animate-fade-up stagger-1">
              把收藏的运动视频变成今天能完成的训练。画像匹配 · AI 筛选 · 补齐热身拉伸。
            </p>
            <div className="mt-8 flex gap-3 animate-fade-up stagger-2">
              <Link
                href="/auth/register"
                className="inline-flex items-center px-6 py-3 text-[15px] font-medium bg-[#3b73ff] text-white hover:bg-[#2f64e8] active:bg-[#2952c4] transition-colors active:scale-[0.97]"
                style={{ borderRadius: "var(--radius-md)" }}
              >
                免费开始
              </Link>
              <Link
                href="/videos"
                className="inline-flex items-center px-6 py-3 text-[15px] font-medium bg-[var(--color-surface-tertiary)] text-[var(--color-text-primary)] hover:bg-[var(--color-border-strong)] transition-colors"
                style={{ borderRadius: "var(--radius-md)" }}
              >
                发现视频
              </Link>
            </div>
          </div>
          <div className="h-32 bg-gradient-to-t from-[var(--color-surface-secondary)] to-transparent pointer-events-none" />
        </section>
      ) : !hasProfile ? (
        /* ── Logged-in, no profile: quick-start onboarding ── */
        <QuickStartCard />
      ) : (
        <section id="today-plan" className="max-w-[980px] mx-auto px-4 md:px-6 pt-6 md:pt-8 pb-7 scroll-mt-24">
          <div
            className="overflow-hidden bg-[var(--color-surface)]"
            style={{ border: "0.5px solid var(--color-border)", borderRadius: "22px" }}
          >
            <HomeHero
              userName={userName}
              hasCollection={hasCollection}
              topGoals={insights?.topGoals || goals}
            />
            <TodayPlanCard
              videos={todayVideos}
              totalDuration={totalDuration}
              goalText={goalText}
              sourceText={sourceText}
              hasProfile={hasProfile}
              hasCollection={hasCollection}
              insights={insights}
              feedbackAdjustment={feedbackAdjustment}
              explanation={explanation}
              refreshCount={refreshCount}
              canRefresh={canRefresh}
              trainingProgress={trainingProgress}
              generationBasis={generationBasis}
              embedded
            />
          </div>
        </section>
      )}

      {/* ── Collection Insight Card ── */}
      {session && hasCollection && insights && (
        <CollectionInsightCard insights={insights} />
      )}

      {/* ── Discovery: video recommendations ── */}
      {session && (
        <HomeTabs
          personalized={personalized}
          hotVideos={hotVideos.map((v) => ({
            id: v.id, title: v.title, platform: v.platform,
            duration: v.duration, sourceAuthor: v.sourceAuthor,
            tags: v.tags.map((vt) => ({
              name: vt.tag.name, category: vt.tag.category, nameZh: vt.tag.nameZh,
            })),
          }))}
          fitnessLevel={profile?.fitnessLevel as "beginner" | "intermediate" | "professional" | null}
          hasProfile={!!profile}
          isLoggedIn={!!userId}
        />
      )}

      {/* ── Recently practiced ── */}
      {userId && recentCheckins.length > 0 && (
        <section className="max-w-[980px] mx-auto px-6 pb-10">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-[20px] font-semibold tracking-[-0.015em] text-[var(--color-text-primary)]">最近练过</h2>
            <Link href="/profile" className="text-[13px] text-[var(--color-brand)] hover:underline">查看全部</Link>
          </div>
          <div className="flex gap-3 overflow-x-auto pb-2 -mx-1 px-1 scroll-smooth"
            style={{ scrollbarWidth: "none", WebkitOverflowScrolling: "touch" }}>
            {recentCheckins.map((ci) => (
              <Link
                key={ci.id}
                href={`/videos/${ci.video.id}`}
                className="shrink-0 w-[200px] bg-[var(--color-surface)] hover:shadow-[var(--shadow-sm)] transition-shadow group"
                style={{ border: "0.5px solid var(--color-border)" }}
              >
                <div className="aspect-video bg-[var(--color-surface-secondary)] flex items-center justify-center">
                  {ci.video.thumbnailUrl ? (
                    <img src={ci.video.thumbnailUrl} alt="" className="w-full h-full object-cover" loading="lazy" />
                  ) : (
                    <svg className="w-8 h-8 text-[var(--color-border)]" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M8 5v14l11-7z" />
                    </svg>
                  )}
                </div>
                <div className="p-3">
                  <p className="text-[13px] font-medium text-[var(--color-text-primary)] truncate group-hover:text-[var(--color-brand)] transition-colors">
                    {ci.video.title}
                  </p>
                  <p className="text-[11px] text-[var(--color-text-tertiary)] mt-1">
                    @{ci.video.sourceAuthor}
                    {ci.video.duration && ` · ${Math.floor(ci.video.duration / 60)} 分钟`}
                  </p>
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* ── Value props (non-logged-in) ── */}
      {!session && (
        <section className="bg-[var(--color-surface)]" style={{ borderTop: "0.5px solid var(--color-border)" }}>
          <div className="max-w-[980px] mx-auto px-6 py-20">
            <div className="text-center mb-14">
              <h2 className="text-[32px] font-semibold tracking-[-0.022em] mb-3">
                不只是收藏，更要行动
              </h2>
              <p className="text-[17px] text-[var(--color-text-secondary)]">
                把收藏的运动视频变成今天能完成的训练
              </p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-10">
              {[
                {
                  icon: (
                    <svg className="w-10 h-10" viewBox="0 0 40 40" fill="none">
                      <circle cx="20" cy="14" r="5" stroke="currentColor" strokeWidth="1.5" />
                      <path d="M8 34c0-6.627 5.373-12 12-12s12 5.373 12 12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                      <path d="M4 34h32" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                    </svg>
                  ),
                  title: "今日训练方案",
                  desc: "设置目标后，系统自动从你的收藏中生成今天能完成的训练，缺热身拉伸时智能补齐。",
                },
                {
                  icon: (
                    <svg className="w-10 h-10" viewBox="0 0 40 40" fill="none">
                      <rect x="6" y="8" width="28" height="24" rx="3" stroke="currentColor" strokeWidth="1.5" />
                      <path d="M14 18l4 4 8-8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  ),
                  title: "收藏意图诊断",
                  desc: "分析你收藏的视频，告诉你偏好什么、缺少什么、哪些动作可能不适合你的身体条件。",
                },
                {
                  icon: (
                    <svg className="w-10 h-10" viewBox="0 0 40 40" fill="none">
                      <path d="M20 8v24M8 20h24" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                      <circle cx="20" cy="20" r="12" stroke="currentColor" strokeWidth="1.5" />
                      <path d="M14 20c0 6 3 10 6 10s6-4 6-10-3-10-6-10-6 4-6 10z" stroke="currentColor" strokeWidth="1.5" />
                    </svg>
                  ),
                  title: "反馈持续优化",
                  desc: "每次跟练后反馈，系统越用越懂你——太难降强度、膝盖不适就避开相关动作。",
                },
              ].map((item, i) => (
                <div key={i} className="text-center">
                  <div className="inline-flex items-center justify-center w-16 h-16 mb-5 text-[var(--color-text-primary)]">
                    {item.icon}
                  </div>
                  <h3 className="text-[17px] font-semibold mb-2">{item.title}</h3>
                  <p className="text-[14px] leading-relaxed text-[var(--color-text-secondary)] max-w-xs mx-auto">
                    {item.desc}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ── Footer ── */}
      <footer className="bg-[var(--color-surface)]" style={{ borderTop: "0.5px solid var(--color-border)" }}>
        <div className="max-w-[980px] mx-auto px-6 py-8 flex items-center justify-between text-[12px] text-[var(--color-text-tertiary)]">
          <span>SportMatch</span>
          <span>数据来源：B站 · 小红书 · 抖音</span>
        </div>
      </footer>
    </div>
  );
}
