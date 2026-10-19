import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  extractCollectionProfile,
  generateTodayPlan,
  getFeedbackHash,
  type PlanVideo,
  type VideoWithTags,
} from "@/lib/today-plan";

export const dynamic = "force-dynamic";

type JsonRecord = Record<string, unknown>;

function parseJsonArray(value: string | null | undefined): string[] {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.map(String) : [];
  } catch {
    return [];
  }
}

function formatDuration(seconds: number | null): string {
  if (!seconds) return "未知";
  return `${Math.round(seconds / 60)} 分钟`;
}

function tagSummary(videos: NonNullable<VideoWithTags>[]) {
  const counts: Record<string, { count: number; category: string }> = {};
  for (const video of videos) {
    for (const vt of video.tags) {
      const key = vt.tag.nameZh;
      counts[key] = {
        count: (counts[key]?.count || 0) + 1,
        category: vt.tag.category,
      };
    }
  }
  return Object.entries(counts)
    .sort(([, a], [, b]) => b.count - a.count)
    .slice(0, 16)
    .map(([name, item]) => ({ name, ...item }));
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-[24px] bg-[var(--color-surface)] p-5 shadow-[0_8px_24px_rgba(149,157,165,0.08)] md:p-6">
      <h2 className="mb-4 text-[18px] font-semibold tracking-[-0.02em] text-[var(--color-text-primary)]">{title}</h2>
      {children}
    </section>
  );
}

function Pill({ children, tone = "neutral" }: { children: React.ReactNode; tone?: "neutral" | "good" | "warn" | "blue" | "purple" }) {
  const toneClass = {
    neutral: "bg-[var(--color-surface-secondary)] text-[var(--color-text-secondary)]",
    good: "bg-[#eefbd7] text-[#527400]",
    warn: "bg-[#fff0e8] text-[#b44725]",
    blue: "bg-[#edf1ff] text-[#3f56df]",
    purple: "bg-[#f1edff] text-[#6C57FF]",
  }[tone];
  return <span className={`rounded-full px-2.5 py-1 text-[12px] font-medium ${toneClass}`}>{children}</span>;
}

function EvidenceBlock({ item }: { item: NonNullable<PlanVideo["scoreBreakdown"]>[number] }) {
  return (
    <div className="grid gap-2 rounded-2xl bg-[var(--color-surface-secondary)] px-3 py-2.5 md:grid-cols-[1fr_auto] md:items-center">
      <div className="min-w-0">
        <p className="text-[13px] font-medium text-[var(--color-text-primary)]">{item.label}</p>
        <p className="mt-0.5 text-[11px] text-[var(--color-text-tertiary)]">
          rule: {item.rule}{item.field ? ` · field: ${item.field}` : ""}{item.value ? ` · value: ${item.value}` : ""}
        </p>
      </div>
      <span className={`justify-self-start rounded-full px-2.5 py-1 text-[12px] font-semibold md:justify-self-end ${
        item.delta >= 0 ? "bg-[#eefbd7] text-[#527400]" : "bg-[#fff0e8] text-[#b44725]"
      }`}>
        {item.delta >= 0 ? "+" : ""}{Math.round(item.delta * 10) / 10}
      </span>
    </div>
  );
}

export default async function RecommendationDebugPage() {
  if (process.env.NODE_ENV === "production") {
    notFound();
  }

  const session = await auth();
  if (!session?.user) redirect("/auth/login");
  const userId = (session.user as { id: string }).id;
  const today = new Date().toISOString().slice(0, 10);

  const profile = await prisma.userProfile.findUnique({ where: { userId } });
  if (!profile) {
    return (
      <main className="mx-auto max-w-[980px] px-5 py-8">
        <Section title="推荐调试面板">
          <p className="text-[14px] text-[var(--color-text-secondary)]">当前用户还没有运动画像，无法生成调试方案。</p>
          <Link href="/profile/setup" className="mt-4 inline-flex rounded-full bg-[#3b73ff] px-4 py-2 text-[14px] font-medium text-white">去设置画像</Link>
        </Section>
      </main>
    );
  }

  const myVideoIds = (await prisma.userVideo.findMany({
    where: { userId },
    select: { videoId: true },
  })).map((uv) => uv.videoId);

  const userVideos: NonNullable<VideoWithTags>[] = myVideoIds.length > 0
    ? await prisma.video.findMany({
        where: { id: { in: myVideoIds } },
        include: { tags: { include: { tag: true } } },
        orderBy: { createdAt: "desc" },
        take: 50,
      }) as NonNullable<VideoWithTags>[]
    : [];

  const [dailyRecommendation, feedbackHash, feedbacks, checkinCount] = await Promise.all([
    prisma.dailyRecommendation.findUnique({ where: { userId_date: { userId, date: today } } }),
    getFeedbackHash(userId),
    prisma.userFeedback.findMany({
      where: { userId },
      include: {
        video: {
          select: {
            id: true,
            title: true,
            tags: { include: { tag: true } },
          },
        },
      },
      orderBy: { createdAt: "desc" },
      take: 20,
    }),
    prisma.videoCheckIn.count({ where: { userId } }),
  ]);

  const collectionProfile = extractCollectionProfile(userVideos);
  const livePlan = await generateTodayPlan(
    userId,
    {
      goals: profile.goals,
      equipment: profile.equipment,
      bodyConditions: profile.bodyConditions,
      fitnessLevel: profile.fitnessLevel,
      availableTime: profile.availableTime || "30",
    },
    userVideos,
    collectionProfile,
  );

  const parsedStoredPlan = (() => {
    if (!dailyRecommendation?.planData) return null;
    try {
      return JSON.parse(dailyRecommendation.planData) as JsonRecord;
    } catch {
      return null;
    }
  })();

  const profileChips = [
    ...parseJsonArray(profile.goals).map((item) => ({ label: item, tone: "purple" as const })),
    ...parseJsonArray(profile.equipment).map((item) => ({ label: item, tone: "blue" as const })),
    ...parseJsonArray(profile.bodyConditions).map((item) => ({ label: item, tone: "warn" as const })),
    { label: `${profile.availableTime || "30"} 分钟`, tone: "neutral" as const },
    { label: profile.fitnessLevel, tone: "neutral" as const },
  ];

  return (
    <main className="mx-auto max-w-[1080px] space-y-6 px-4 py-6 md:px-6 md:py-8">
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-[12px] font-semibold text-[#6C57FF]">仅开发环境可见</p>
          <h1 className="mt-1 text-[32px] font-semibold tracking-[-0.04em] text-[var(--color-text-primary)]">推荐调试面板</h1>
          <p className="mt-2 text-[14px] text-[var(--color-text-secondary)]">
            这页不写入数据库，用来验收今日方案的输入、规则、打分和解释证据链。
          </p>
        </div>
        <Link href="/" className="inline-flex rounded-full bg-[var(--color-surface)] px-4 py-2 text-[13px] font-medium text-[var(--color-text-secondary)] shadow-[0_8px_20px_rgba(149,157,165,0.08)]">
          返回首页
        </Link>
      </div>

      <div className="grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
        <Section title="输入信号">
          <div className="space-y-4">
            <div>
              <p className="mb-2 text-[13px] font-medium text-[var(--color-text-primary)]">画像字段</p>
              <div className="flex flex-wrap gap-2">
                {profileChips.map((item) => <Pill key={`${item.label}-${item.tone}`} tone={item.tone}>{item.label}</Pill>)}
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div className="rounded-2xl bg-[var(--color-surface-secondary)] p-3">
                <p className="text-[22px] font-semibold text-[#3f56df]">{checkinCount}</p>
                <p className="text-[12px] text-[var(--color-text-tertiary)]">打卡</p>
              </div>
              <div className="rounded-2xl bg-[var(--color-surface-secondary)] p-3">
                <p className="text-[22px] font-semibold text-[#6C57FF]">{userVideos.length}</p>
                <p className="text-[12px] text-[var(--color-text-tertiary)]">导入视频</p>
              </div>
              <div className="rounded-2xl bg-[var(--color-surface-secondary)] p-3">
                <p className="text-[22px] font-semibold text-[#FF5E32]">{feedbacks.length}</p>
                <p className="text-[12px] text-[var(--color-text-tertiary)]">近期反馈</p>
              </div>
            </div>

            <div>
              <p className="mb-2 text-[13px] font-medium text-[var(--color-text-primary)]">导入标签 Top</p>
              <div className="flex flex-wrap gap-2">
                {tagSummary(userVideos).map((tag) => (
                  <Pill key={tag.name} tone={tag.category === "goal" ? "purple" : tag.category === "duration" ? "good" : "neutral"}>
                    {tag.name} ×{tag.count}
                  </Pill>
                ))}
                {userVideos.length === 0 && <p className="text-[13px] text-[var(--color-text-tertiary)]">暂无导入视频。</p>}
              </div>
            </div>

            <div>
              <p className="mb-2 text-[13px] font-medium text-[var(--color-text-primary)]">缓存状态</p>
              <div className="space-y-1 text-[12px] text-[var(--color-text-secondary)]">
                <p>今日缓存：{dailyRecommendation ? "存在" : "不存在"}</p>
                <p>refreshCount：{dailyRecommendation?.refreshCount ?? 0}</p>
                <p>feedbackHash：{feedbackHash}</p>
                <p>缓存是否已有 evidence：{parsedStoredPlan && JSON.stringify(parsedStoredPlan).includes('"evidence"') ? "是" : "否"}</p>
              </div>
            </div>
          </div>
        </Section>

        <Section title="今日方案解释证据">
          <div className="space-y-3">
            <div className="rounded-2xl bg-[var(--color-surface-secondary)] p-4">
              <p className="text-[15px] font-semibold text-[var(--color-text-primary)]">{livePlan.goalText}</p>
              <p className="mt-1 text-[13px] text-[var(--color-text-secondary)]">{livePlan.sourceText}</p>
              <p className="mt-2 text-[12px] text-[var(--color-text-tertiary)]">{livePlan.explanation?.summary || "暂无解释摘要"}</p>
            </div>

            {livePlan.quality && (
              <div className="rounded-2xl bg-[var(--color-surface-secondary)] p-4">
                <div className="flex flex-wrap items-center gap-2">
                  <Pill tone={livePlan.quality.passed ? "good" : "warn"}>
                    {livePlan.quality.passed ? "质检通过" : "质检需关注"}
                  </Pill>
                  <Pill tone="blue">score {livePlan.quality.score}</Pill>
                </div>
                <p className="mt-2 text-[13px] text-[var(--color-text-primary)]">{livePlan.quality.summary}</p>
                <div className="mt-3 space-y-2">
                  {livePlan.quality.issues.map((issue) => (
                    <div key={issue.code} className="rounded-xl bg-[var(--color-surface)] px-3 py-2 text-[12px]">
                      <div className="flex flex-wrap items-center gap-2">
                        <Pill tone={issue.severity === "pass" ? "good" : issue.severity === "notice" ? "neutral" : "warn"}>
                          {issue.label}
                        </Pill>
                        <span className="text-[var(--color-text-primary)]">{issue.detail}</span>
                      </div>
                      <p className="mt-1 text-[11px] text-[var(--color-text-tertiary)]">
                        code: {issue.code} 路 field: {issue.evidence.field} 路 value: {issue.evidence.value} 路 rule: {issue.evidence.rule}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {livePlan.explanation?.items.map((item, index) => (
              <div key={`${item.label}-${index}`} className="rounded-2xl bg-[var(--color-surface-secondary)] p-3">
                <div className="flex flex-wrap items-center gap-2">
                  <Pill tone={item.tone === "warn" ? "warn" : item.tone === "feedback" ? "purple" : item.tone === "fill" ? "good" : "blue"}>
                    {item.label}
                  </Pill>
                  <p className="text-[13px] text-[var(--color-text-primary)]">{item.detail}</p>
                </div>
                {item.evidence && (
                  <div className="mt-2 rounded-xl bg-[var(--color-surface)] px-3 py-2 text-[11px] text-[var(--color-text-tertiary)]">
                    type: {item.evidence.type}
                    {item.evidence.field ? ` · field: ${item.evidence.field}` : ""}
                    {item.evidence.value ? ` · value: ${item.evidence.value}` : ""}
                    {item.evidence.sourceCount !== undefined ? ` · sourceCount: ${item.evidence.sourceCount}` : ""}
                    {item.evidence.rule ? ` · rule: ${item.evidence.rule}` : ""}
                  </div>
                )}
              </div>
            ))}
          </div>
        </Section>
      </div>

      <Section title="视频打分拆解">
        <div className="space-y-4">
          {livePlan.todayVideos.map((video, index) => {
            const totalScore = (video.scoreBreakdown || []).reduce((sum, item) => sum + item.delta, 0);
            const imported = userVideos.some((item) => item.id === video.id);
            return (
              <div key={video.id} className="rounded-[20px] bg-[var(--color-surface-secondary)] p-4">
                <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <Pill tone="blue">#{index + 1} {video.note}</Pill>
                      <Pill tone={imported ? "purple" : "good"}>{imported ? "来自导入" : "推荐补位"}</Pill>
                      <Pill>{formatDuration(video.duration)}</Pill>
                    </div>
                    <p className="mt-2 text-[16px] font-semibold leading-snug text-[var(--color-text-primary)]">{video.title}</p>
                    <p className="mt-1 text-[12px] text-[var(--color-text-tertiary)]">@{video.sourceAuthor}</p>
                  </div>
                  <div className="shrink-0 rounded-full bg-[var(--color-surface)] px-3 py-1.5 text-[13px] font-semibold text-[var(--color-text-primary)]">
                    score {Math.round(totalScore * 10) / 10}
                  </div>
                </div>
                <div className="mt-3 grid gap-2">
                  {(video.scoreBreakdown || []).length > 0 ? (
                    video.scoreBreakdown.map((item) => <EvidenceBlock key={`${video.id}-${item.rule}-${item.value}`} item={item} />)
                  ) : (
                    <p className="text-[13px] text-[var(--color-text-tertiary)]">没有命中可解释的加减分规则。</p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </Section>

      <Section title="最近反馈原始信号">
        <div className="space-y-2">
          {feedbacks.length === 0 && <p className="text-[13px] text-[var(--color-text-tertiary)]">暂无反馈。</p>}
          {feedbacks.map((feedback) => (
            <div key={feedback.id} className="rounded-2xl bg-[var(--color-surface-secondary)] px-3 py-2.5">
              <p className="text-[13px] font-medium text-[var(--color-text-primary)]">{feedback.video.title}</p>
              <p className="mt-1 text-[11px] text-[var(--color-text-tertiary)]">
                difficulty={feedback.difficultyRating} · completion={feedback.completionRate} · recommend={String(feedback.recommend)}
                {feedback.bodyFeeling ? ` · body=${feedback.bodyFeeling}` : ""}
              </p>
            </div>
          ))}
        </div>
      </Section>
    </main>
  );
}
