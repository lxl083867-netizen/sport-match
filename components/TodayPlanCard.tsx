"use client";

import { useState } from "react";
import PlanWorkout from "./PlanWorkout";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { getPlaybackLabel, isEmbeddablePlatform } from "@/lib/platform";
import posthog from "posthog-js";
import { api } from "@/lib/api";
import { useToast } from "./Toast";

interface PlanVideo {
  id: string;
  title: string;
  url: string;
  platform: string;
  duration: number | null;
  sourceAuthor: string;
  note: string; // warmup/main/stretch
  repeatCount: number;
  matchReasons: string[];
  phaseReason: string;
  scoreBreakdown?: Array<{
    rule: string;
    label: string;
    delta: number;
    field?: string;
    value?: string;
  }>;
}

interface CollectionInsight {
  topGoals: string[];
  preferredDurations: string[];
  missingPhases: string[];
  riskWarnings: string[];
}

interface TrainingProgress {
  trainingDayCount: number;
  streakDays: number;
  lastCompletedLabel: string | null;
}

interface GenerationBasis {
  checkinCount: number;
  importedVideoCount: number;
  feedbackCount: number;
}

interface Props {
  videos: PlanVideo[];
  totalDuration: number;
  goalText: string;
  sourceText: string;
  hasProfile: boolean;
  hasCollection: boolean;
  insights: CollectionInsight | null;
  feedbackAdjustment?: string | null;
  explanation?: {
    summary: string;
    items: Array<{
      label: string;
      detail: string;
      tone: "collection" | "fill" | "warn" | "playback" | "feedback";
      videoId?: string;
      evidence?: {
        type: string;
        field?: string;
        value?: string;
        sourceCount?: number;
        rule?: string;
      };
    }>;
    goal: string;
  } | null;
  refreshCount: number;
  canRefresh: boolean;
  trainingProgress?: TrainingProgress | null;
  generationBasis?: GenerationBasis | null;
  embedded?: boolean;
}

function fmtDuration(seconds: number | null): string {
  if (!seconds) return "";
  const m = Math.floor(seconds / 60);
  return `${m} 分钟`;
}

const phaseLabels: Record<string, string> = { warmup: "热身", main: "主训练", stretch: "拉伸" };

const confettiPieces = [
  { x: -24, y: -28, r: -28, color: "#6C37FF", delay: "0ms" },
  { x: -8, y: -38, r: 22, color: "#4F68FD", delay: "45ms" },
  { x: 13, y: -34, r: -14, color: "#FF5E32", delay: "70ms" },
  { x: 30, y: -20, r: 32, color: "#B2DD5A", delay: "95ms" },
  { x: 23, y: 10, r: -34, color: "#C7FF45", delay: "130ms" },
  { x: -20, y: 8, r: 36, color: "#FF765C", delay: "85ms" },
];

function RefreshConfetti() {
  return (
    <span className="pointer-events-none absolute left-1/2 top-1/2 z-20 h-1 w-1" aria-hidden="true">
      {confettiPieces.map((piece, index) => (
        <span
          key={index}
          className="refresh-confetti-piece absolute h-1.5 w-1.5 rounded-[2px]"
          style={{
            backgroundColor: piece.color,
            ["--x" as string]: `${piece.x}px`,
            ["--y" as string]: `${piece.y}px`,
            ["--r" as string]: `${piece.r}deg`,
            animationDelay: piece.delay,
          }}
        />
      ))}
    </span>
  );
}

function explanationToneClass(tone: "collection" | "fill" | "warn" | "playback" | "feedback"): string {
  if (tone === "collection") return "bg-[var(--color-brand-subtle)] text-[var(--color-brand)]";
  if (tone === "fill") return "bg-[#e8f8ed] text-[#1d7a3f]";
  if (tone === "warn") return "bg-[#fff1f0] text-[#b42318]";
  if (tone === "feedback") return "bg-[#fff7d6] text-[#9a5b00]";
  return "bg-[#eaf0ff] text-[#315bd8]";
}

function progressSignalToneClass(tone: "training" | "feedback" | "fill"): string {
  if (tone === "training") return "bg-[#edf1ff] text-[#3f56df] shadow-[0_6px_14px_rgba(79,104,253,0.10)]";
  if (tone === "feedback") return "bg-[#fff7d6] text-[#9a5b00] shadow-[0_6px_14px_rgba(255,214,107,0.12)]";
  return "bg-[#eefbd7] text-[#527400] shadow-[0_6px_14px_rgba(178,221,90,0.12)]";
}

function phaseName(phase: string): string {
  if (phase === "warmup") return "热身";
  if (phase === "stretch") return "拉伸";
  return phase;
}

export default function TodayPlanCard({
  videos: initialVideos,
  totalDuration: initialTotalDuration,
  goalText: initialGoalText,
  sourceText: initialSourceText,
  hasProfile,
  hasCollection,
  insights: initialInsights,
  feedbackAdjustment: initialFeedbackAdjustment,
  explanation: initialExplanation,
  refreshCount: initialRefreshCount,
  canRefresh: initialCanRefresh,
  trainingProgress,
  generationBasis,
  embedded = false,
}: Props) {
  // Plan state — mutable on "换一个" refresh
  const [videos, setVideos] = useState(initialVideos);
  const [totalDuration, setTotalDuration] = useState(initialTotalDuration);
  const [goalText, setGoalText] = useState(initialGoalText);
  const [sourceText, setSourceText] = useState(initialSourceText);
  const [insights, setInsights] = useState(initialInsights);
  const [feedbackAdjustment, setFeedbackAdjustment] = useState(initialFeedbackAdjustment ?? null);
  const [explanation, setExplanation] = useState(initialExplanation);
  const [canRefresh, setCanRefresh] = useState(initialCanRefresh);
  const [refreshCount, setRefreshCount] = useState(initialRefreshCount);
  const [refreshing, setRefreshing] = useState(false);
  const { toast } = useToast();

  const [workoutMode, setWorkoutMode] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savedPlanId, setSavedPlanId] = useState<string | null>(null);
  const [showDetail, setShowDetail] = useState(false);
  const [showExplanation, setShowExplanation] = useState(false);
  const [confettiBurst, setConfettiBurst] = useState(0);
  const router = useRouter();

  const embeddableCount = videos.filter((v) => isEmbeddablePlatform(v.platform)).length;
  const externalCount = videos.length - embeddableCount;
  const allEmbeddable = externalCount === 0 && videos.length > 0;
  const missingPhaseNames = (insights?.missingPhases || []).map(phaseName);
  const basisParts = [
    generationBasis && generationBasis.checkinCount > 0 ? `${generationBasis.checkinCount} 次打卡` : null,
    generationBasis && generationBasis.importedVideoCount > 0 ? `${generationBasis.importedVideoCount} 个导入视频` : null,
    generationBasis && generationBasis.feedbackCount > 0 ? "最近反馈" : null,
  ].filter(Boolean);
  const progressSignals = [
    {
      label: "连续训练",
      detail: trainingProgress && trainingProgress.trainingDayCount > 0
        ? `${trainingProgress.streakDays > 1 ? `已连续 ${trainingProgress.streakDays} 天训练` : `这是你第 ${trainingProgress.trainingDayCount} 天训练`}${trainingProgress.lastCompletedLabel ? `，上次完成了${trainingProgress.lastCompletedLabel}` : ""}`
        : "完成今天训练后，系统会开始记录你的进展",
      tone: "training" as const,
    },
    {
      label: "反馈适配",
      detail: feedbackAdjustment || "练后反馈会用于调整下次方案强度",
      tone: "feedback" as const,
    },
    {
      label: "内容补齐",
      detail: missingPhaseNames.length > 0
        ? `已自动补齐${missingPhaseNames.slice(0, 2).join("、")}环节`
        : hasCollection
          ? "已优先使用你的收藏内容编排路线"
          : "导入收藏后可自动补齐训练路线",
      tone: "fill" as const,
    },
  ];

  async function handleRefresh() {
    if (refreshing || !canRefresh) return;
    setConfettiBurst((prev) => prev + 1);
    setRefreshing(true);

    try {
      const data = await api<{
        plan: { todayVideos: PlanVideo[]; goalText: string; sourceText: string; insights: CollectionInsight | null; feedbackAdjustment?: string | null; explanation?: Props["explanation"] };
        totalDuration: number;
        refreshCount: number;
        canRefresh: boolean;
      }>("/api/daily-plan/refresh", { method: "POST" });

      const refreshedVideos = data.plan.todayVideos || [];
      const refreshedEmbeddableCount = refreshedVideos.filter((v) => isEmbeddablePlatform(v.platform)).length;

      posthog.capture("plan_refreshed", {
        refresh_count: data.refreshCount,
        previous_video_count: videos.length,
        video_count: refreshedVideos.length,
        embeddable_count: refreshedEmbeddableCount,
        external_count: refreshedVideos.length - refreshedEmbeddableCount,
      });

      setVideos(refreshedVideos);
      setTotalDuration(data.totalDuration || 0);
      setGoalText(data.plan.goalText || "今日训练");
      setSourceText(data.plan.sourceText || "");
      setInsights(data.plan.insights || null);
      setFeedbackAdjustment(data.plan.feedbackAdjustment ?? null);
      setExplanation(data.plan.explanation ?? null);
      setRefreshCount(data.refreshCount);
      setCanRefresh(data.canRefresh);
      toast("方案已刷新", "success");
    } catch (e) {
      toast(e instanceof Error ? e.message : "网络异常，请稍后重试", "error");
    } finally {
      setRefreshing(false);
    }
  }

  async function saveCurrentPlan() {
    const today = new Date().toISOString().slice(0, 10);
    const plan = await api<{ id: string }>("/api/plans", {
      method: "POST",
      body: JSON.stringify({
        title: `${today} 今日训练`,
        description: `${goalText} · ${sourceText}`,
        targetAudience: [],
        items: videos.map((v, i) => ({
          videoId: v.id,
          order: i + 1,
          note: v.note,
          repeatCount: v.repeatCount,
        })),
      }),
    });
    setSavedPlanId(plan.id);
    posthog.capture("plan_saved", { plan_id: plan.id, video_count: videos.length });
    return plan.id;
  }

  async function handleSaveToggle() {
    if (saving) return;
    setSaving(true);

    try {
      if (savedPlanId) {
        await api(`/api/plans/${savedPlanId}`, { method: "DELETE" });
        setSavedPlanId(null);
        toast("已从计划中移除", "success");
      } else {
        await saveCurrentPlan();
        toast("已加入我的计划", "success");
      }
    } catch {
      toast(savedPlanId ? "移除失败，请稍后重试" : "保存失败，请稍后重试", "error");
    } finally {
      setSaving(false);
    }
  }

  async function handleOpenPlanDetail() {
    if (savedPlanId) {
      router.push(`/plans/${savedPlanId}?from=home`);
      return;
    }
    if (saving) return;
    setSaving(true);
    try {
      const planId = await saveCurrentPlan();
      router.push(`/plans/${planId}?from=home`);
    } catch {
      toast("打开计划详情失败，请稍后重试", "error");
    } finally {
      setSaving(false);
    }
  }

  // No profile — show setup CTA
  if (!hasProfile) {
    return (
      <section className="max-w-[980px] mx-auto px-6 py-12">
        <div className="bg-[var(--color-brand-subtle)] p-10 text-center" style={{ borderRadius: "var(--radius-lg)" }}>
          <h2 className="text-[22px] font-semibold mb-2 text-[var(--color-brand)]">
            完成运动画像，获取今日训练方案
          </h2>
          <p className="text-[15px] text-[var(--color-text-secondary)] mb-6">
            告诉我们你的目标、身体条件和可用器材，系统帮你生成今天能完成的训练
          </p>
          <Link
            href="/profile/setup"
            className="inline-flex px-6 py-3 text-[15px] font-medium bg-[#3b73ff] text-white hover:bg-[#2f64e8] transition-colors active:scale-[0.97]"
            style={{ borderRadius: "var(--radius-md)" }}
          >
            设置画像
          </Link>
        </div>
      </section>
    );
  }

  if (videos.length === 0) {
    return (
      <section className="max-w-[980px] mx-auto px-6 py-12">
        <div className="bg-[var(--color-surface)] p-8 text-center" style={{ border: "0.5px solid var(--color-border)", borderRadius: "var(--radius-lg)" }}>
          <h2 className="text-[22px] font-semibold mb-2">暂无可用于训练的今日方案</h2>
          <p className="text-[15px] text-[var(--color-text-secondary)] mb-6">
            添加一些运动视频后，系统会为你生成每日训练方案
          </p>
          <Link
            href="/videos"
            className="inline-flex px-6 py-3 text-[15px] font-medium bg-[#3b73ff] text-white hover:bg-[#2f64e8] transition-colors active:scale-[0.97]"
            style={{ borderRadius: "var(--radius-md)" }}
          >
            浏览视频
          </Link>
        </div>
      </section>
    );
  }

  if (workoutMode) {
    return (
      <PlanWorkout
        items={videos.map((v) => ({ id: v.id, order: 1, note: v.note, repeatCount: v.repeatCount, video: v }))}
        onClose={() => setWorkoutMode(false)}
      />
    );
  }

  if (showDetail) {
    return (
      <section className="max-w-[980px] mx-auto px-4 md:px-6 py-10 md:py-12">
        {/* Back button */}
        <button
          onClick={() => setShowDetail(false)}
          className="inline-flex items-center gap-1.5 text-[14px] text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] transition-colors mb-6"
        >
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polyline points="15 18 9 12 15 6" /></svg>
          返回首页
        </button>

        {/* Plan header */}
        <div className="mb-8">
          <p className="text-[11px] text-[var(--color-text-tertiary)] font-medium tracking-widest uppercase mb-1">今日训练方案</p>
          <h1 className="text-[26px] md:text-[32px] font-semibold tracking-[-0.022em] text-[var(--color-text-primary)] mb-2">{goalText}</h1>
          <p className="text-[14px] md:text-[15px] text-[var(--color-text-secondary)]">{sourceText}</p>
        </div>

        {feedbackAdjustment && (
          <div className="mb-5 flex items-start gap-2 rounded-2xl bg-[#fff9e8] px-4 py-3 text-[13px] leading-relaxed text-[#7a4b00] dark:bg-[#2a2414] dark:text-[#f2c66d]">
            <span className="shrink-0 rounded-full bg-[#ffd66b]/35 px-2 py-0.5 text-[11px] font-semibold text-[#8a5200] dark:text-[#f7d98b]">
              根据反馈
            </span>
            <span>{feedbackAdjustment}</span>
          </div>
        )}

        {/* Quick stats */}
        <div className="flex flex-wrap gap-4 md:gap-6 mb-8 text-[13px] md:text-[14px] text-[var(--color-text-secondary)]">
          <span>{videos.length} 个视频</span>
          <span>共 {Math.floor(totalDuration / 60)} 分钟</span>
          <span className={allEmbeddable ? "text-[var(--color-success)]" : ""}>
            {allEmbeddable ? "全部可站内播放" : `${embeddableCount} 站内 · ${externalCount} 需跳转`}
          </span>
        </div>

        {/* Why this plan — collapsible explanation */}
        {explanation && explanation.items.length > 0 && (
          <div className="mb-6">
            <button
              onClick={() => setShowExplanation(!showExplanation)}
              className="inline-flex items-center gap-1.5 text-[13px] text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] transition-colors"
            >
              <span>为什么这样排</span>
              <svg className={`w-3 h-3 transition-transform ${showExplanation ? "rotate-180" : ""}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                <polyline points="6 9 12 15 18 9" />
              </svg>
            </button>
            {showExplanation && (
              <div className="mt-3 bg-[var(--color-surface-secondary)] rounded-xl p-4 space-y-3 animate-fade-in">
                <p className="text-[14px] text-[var(--color-text-secondary)] leading-relaxed">{explanation.summary}</p>
                <div className="space-y-1.5">
                  {explanation.items.map((item, i) => (
                    <div key={i} className="flex items-center gap-2 text-[13px]">
                      <span className={`shrink-0 text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${explanationToneClass(item.tone)}`}>{item.label}</span>
                      <span className="text-[var(--color-text-tertiary)]">{item.detail}</span>
                    </div>
                  ))}
                </div>
                <p className="text-[13px] text-[var(--color-text-primary)] font-medium">{explanation.goal}</p>
              </div>
            )}
          </div>
        )}

        {/* Video list — detailed */}
        <div className="space-y-2 mb-10">
          {videos.map((v, i) => {
            const embeddable = isEmbeddablePlatform(v.platform);
            return (
              <div
                key={v.id}
                className="px-3 md:px-4 py-2.5 md:py-3 bg-[var(--color-surface-secondary)]"
                style={{ borderRadius: "var(--radius-md)" }}
              >
                <div className="flex items-center gap-2 md:gap-3">
                  <span className="shrink-0 w-6 h-6 md:w-7 md:h-7 rounded-full bg-[var(--color-brand-subtle)] text-[var(--color-brand)] flex items-center justify-center text-[11px] md:text-xs font-semibold">
                    {i + 1}
                  </span>
                  <span className={`shrink-0 text-[10px] md:text-[11px] px-1.5 py-0.5 rounded-full ${
                    v.note === "warmup" ? "bg-[#fef3e8] text-[#b05a10]" :
                    v.note === "stretch" ? "bg-[var(--color-success)]/10 text-[var(--color-success)]" :
                    "bg-[var(--color-brand-subtle)] text-[var(--color-brand)]"
                  }`}>
                    {phaseLabels[v.note] || "主训练"}
                  </span>
                  <span className="flex-1 text-[13px] md:text-[15px] text-[var(--color-text-primary)] truncate min-w-0">{v.title}</span>
                  <span className="text-[11px] md:text-[13px] text-[var(--color-text-tertiary)] shrink-0 hidden sm:inline">
                    @{v.sourceAuthor} · {fmtDuration(v.duration)}
                  </span>
                  {v.repeatCount > 1 && (
                    <span className="text-[11px] text-[var(--color-text-tertiary)] shrink-0 hidden sm:inline">×{v.repeatCount}</span>
                  )}
                  <span className={`shrink-0 playback-badge text-[10px] md:text-[11px] px-2 py-1 max-sm:hidden ${
                    embeddable
                      ? "playback-badge--embed"
                      : "playback-badge--external"
                  }`}>
                    {getPlaybackLabel(v.platform)}
                  </span>
                </div>
                {(v.matchReasons.length > 0 || v.phaseReason) && (
                  <div className="flex items-center gap-2 mt-2 ml-8 md:ml-10 text-[11px] md:text-[12px]">
                    {v.matchReasons.map((r, j) => (
                      <span key={j} className="text-[var(--color-text-tertiary)] bg-[var(--color-background)]/50 px-1.5 py-0.5 rounded-full">
                        {r}
                      </span>
                    ))}
                    {v.phaseReason && (
                      <span className="text-[var(--color-text-tertiary)]">{v.phaseReason}</span>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => { posthog.capture("workout_started", { source: "plan_detail", video_count: videos.length }); setWorkoutMode(true); }}
            className="inline-flex items-center gap-2 px-8 py-3 bg-[#3b73ff] hover:bg-[#2f64e8] active:bg-[#2952c4] text-white font-medium rounded-full transition-all active:scale-[0.97] text-[15px]"
          >
            <svg className="w-4 h-4" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clipRule="evenodd" />
            </svg>
            开始跟练
          </button>
          <button
            onClick={handleSaveToggle}
            disabled={saving}
            className="inline-flex items-center justify-center gap-1.5 px-5 py-3 text-[15px] font-medium bg-[var(--color-surface-secondary)] text-[var(--color-text-primary)] border border-[var(--color-border)] hover:bg-[var(--color-border-strong)] disabled:opacity-50 rounded-full transition-all active:scale-[0.97]"
          >
            {savedPlanId ? (
              <>
                <svg className="w-4 h-4 text-[var(--color-success)]" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" /></svg>
                已加入
              </>
            ) : saving ? "..." : (<><svg className="w-4 h-4" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M5 4a2 2 0 012-2h6a2 2 0 012 2v12l-5-2.5L5 16V4z" clipRule="evenodd" /></svg>加入我的计划</>)}
          </button>
          <span className="relative inline-flex">
            {confettiBurst > 0 && <RefreshConfetti key={`detail-${confettiBurst}`} />}
            <button
              onClick={handleRefresh}
              disabled={!canRefresh || refreshing}
              className={`text-[13px] transition-colors ml-1 ${
                canRefresh
                  ? "text-[var(--color-text-tertiary)] hover:text-[var(--color-brand)] cursor-pointer"
                  : "text-[var(--color-text-quaternary)] cursor-not-allowed"
              }`}
            >
              {refreshing ? "刷新中..." : canRefresh ? `↻ 换一个 (剩${3 - refreshCount}次)` : "今日已用完更换机会"}
            </button>
          </span>
        </div>

        {/* Refreshing indicator — old plan stays visible, only a banner shows */}
        {refreshing && (
          <div className="mt-4 flex items-center gap-2 text-[13px] text-[var(--color-text-secondary)] animate-fade-in">
            <svg className="w-4 h-4 text-[var(--color-brand)] animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10" strokeOpacity="0.25" />
              <path d="M12 2a10 10 0 019.95 9" strokeLinecap="round" />
            </svg>
            正在生成新的训练方案，请稍候...
          </div>
        )}
      </section>
    );
  }

  return (
    <section className={embedded ? "pt-0" : "max-w-[980px] mx-auto px-4 md:px-6 pt-0 pb-7"}>
      <div
        className={embedded ? "relative bg-[var(--color-surface)] border-t border-[var(--color-border)]" : "relative bg-[var(--color-surface)]"}
        style={embedded ? undefined : { border: "0.5px solid var(--color-border)", borderRadius: "22px" }}
      >
        {!embedded && (
          <div className="absolute left-1/2 top-0 z-10 h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-[3px] border-[var(--color-surface)] bg-[#3b73ff] shadow-[0_8px_20px_rgba(59,115,255,0.28)]" />
        )}
        <div className="absolute inset-x-0 top-0 h-1.5 bg-[linear-gradient(90deg,#3b73ff,#b8f24b,#ff6847)]" />

        <div className="relative px-5 py-5 md:px-7 md:py-7">
          <div className="flex flex-col gap-5 md:flex-row md:items-start md:justify-between">
            <div className="min-w-0 flex-1">
              <div className="mb-3 flex flex-wrap items-center gap-2">
                <span className="rounded-full bg-[#eaf0ff] px-3 py-1 text-[11px] font-semibold text-[#315bd8]">
                  今日训练路线
                </span>
                <span className="rounded-full bg-[#f2ffd6] px-3 py-1 text-[11px] font-semibold text-[#5c7e08]">
                  {videos.length} 步 · {Math.floor(totalDuration / 60)} 分钟
                </span>
                <span className={`playback-badge px-3 py-1 text-[11px] ${allEmbeddable ? "playback-badge--embed" : "playback-badge--external"}`}>
                  {allEmbeddable ? "连续跟练友好" : `${embeddableCount} 站内 · ${externalCount} 外跳`}
                </span>
                {hasCollection && insights?.topGoals?.[0] && (
                  <span className="rounded-full bg-[var(--color-surface-secondary)] px-3 py-1 text-[11px] font-semibold text-[var(--color-text-secondary)]">
                    收藏偏好 · {insights.topGoals[0]}
                  </span>
                )}
              </div>

              {savedPlanId ? (
                <Link
                  href={`/plans/${savedPlanId}?from=home`}
                  className="block text-[28px] md:text-[34px] font-semibold leading-tight tracking-[-0.025em] text-[var(--color-text-primary)] hover:text-[var(--color-brand)] transition-colors"
                >
                  {goalText}
                </Link>
              ) : (
                <button
                  onClick={handleOpenPlanDetail}
                  disabled={saving}
                  className="block cursor-pointer text-left text-[28px] md:text-[34px] font-semibold leading-tight tracking-[-0.025em] text-[var(--color-text-primary)] hover:text-[var(--color-brand)] disabled:opacity-50 transition-colors"
                >
                  {goalText}
                </button>
              )}

              <p className="mt-3 max-w-[660px] text-[14px] md:text-[15px] leading-relaxed text-[var(--color-text-secondary)]">
                {sourceText}
              </p>

              <p className="mt-2 text-[12px] text-[var(--color-text-tertiary)]">
                生成依据：{basisParts.length > 0 ? basisParts.join(" · ") : "你的运动画像"}
              </p>

              <div className="mt-4 flex flex-wrap gap-2">
                {progressSignals.map((signal) => (
                  <span
                    key={signal.label}
                    className={`inline-flex max-w-full items-center gap-2 rounded-full px-3 py-1.5 text-[12px] font-medium leading-none ${progressSignalToneClass(signal.tone)}`}
                  >
                    <span className="font-semibold">{signal.label}</span>
                    <span className="min-w-0 truncate opacity-80">{signal.detail}</span>
                  </span>
                ))}
              </div>

              {/* Why this plan — compact collapsible */}
              {explanation && explanation.items.length > 0 && (
                <div className="mt-3">
                  <button
                    onClick={() => setShowExplanation(!showExplanation)}
                    className="inline-flex items-center gap-1.5 text-[12px] text-[var(--color-text-tertiary)] hover:text-[var(--color-text-secondary)] transition-colors"
                  >
                    <span>为什么这样排</span>
                    <svg className={`w-2.5 h-2.5 transition-transform ${showExplanation ? "rotate-180" : ""}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                      <polyline points="6 9 12 15 18 9" />
                    </svg>
                  </button>
                  {showExplanation && (
                    <div className="mt-2 bg-[var(--color-surface-secondary)] rounded-xl p-3 space-y-2 animate-fade-in">
                      <p className="text-[13px] text-[var(--color-text-secondary)] leading-relaxed">{explanation.summary}</p>
                      <div className="space-y-1">
                        {explanation.items.map((item, i) => (
                          <div key={i} className="flex items-center gap-2 text-[12px]">
                            <span className={`shrink-0 text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${explanationToneClass(item.tone)}`}>{item.label}</span>
                            <span className="text-[var(--color-text-tertiary)]">{item.detail}</span>
                            {item.evidence?.field && (
                              <span className="hidden shrink-0 rounded-full bg-[var(--color-surface)] px-1.5 py-0.5 text-[10px] text-[var(--color-text-quaternary)] sm:inline">
                                依据：{item.evidence.field}
                              </span>
                            )}
                          </div>
                        ))}
                      </div>
                      <p className="text-[12px] text-[var(--color-text-primary)] font-medium">{explanation.goal}</p>
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="flex shrink-0 flex-col gap-2 sm:flex-row md:flex-col">
              <button
                onClick={() => { posthog.capture("workout_started", { source: "plan_card", video_count: videos.length }); setWorkoutMode(true); }}
                className="inline-flex items-center justify-center gap-2 rounded-full bg-[#3b73ff] px-6 py-3 text-[14px] font-semibold text-white shadow-[0_14px_30px_rgba(59,115,255,0.24)] hover:bg-[#2f64e8] active:scale-[0.97]"
              >
                <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clipRule="evenodd" />
                </svg>
                开始跟练
              </button>
              <button
                onClick={handleSaveToggle}
                disabled={saving}
                className="inline-flex items-center justify-center gap-1.5 rounded-full border border-[var(--color-border)] bg-[var(--color-surface-secondary)] px-5 py-3 text-[14px] font-semibold text-[var(--color-text-primary)] hover:bg-[var(--color-border-strong)] disabled:opacity-50 active:scale-[0.97]"
              >
                {savedPlanId ? (
                  <>
                    <svg className="h-4 w-4 text-[var(--color-success)]" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" /></svg>
                    已加入
                  </>
                ) : saving ? "..." : (
                  <>
                    <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true"><path fillRule="evenodd" d="M5 4a2 2 0 012-2h6a2 2 0 012 2v12l-5-2.5L5 16V4z" clipRule="evenodd" /></svg>
                    加入我的计划
                  </>
                )}
              </button>
            </div>
          </div>

          <div className="mt-6 flex items-center justify-between gap-4 border-t border-[var(--color-border)] pt-4">
            <p className="text-[12px] text-[var(--color-text-tertiary)]">
              按顺序完成，系统会记录每一步并用于下次推荐。
            </p>
            <span className="relative inline-flex shrink-0">
              {confettiBurst > 0 && <RefreshConfetti key={`embedded-${confettiBurst}`} />}
              <button
                onClick={handleRefresh}
                disabled={!canRefresh || refreshing}
                className={`text-[12px] font-medium transition-colors ${
                  canRefresh
                    ? "text-[var(--color-brand)] hover:text-[var(--color-brand-hover)] cursor-pointer"
                    : "text-[var(--color-text-quaternary)] cursor-not-allowed"
                }`}
                title={canRefresh ? "换一个方案" : "今日已用完 3 次更换机会"}
              >
                {refreshing ? "刷新中..." : canRefresh ? `换一套 · 剩 ${3 - refreshCount} 次` : "今日已用完"}
              </button>
            </span>
          </div>

          {refreshing && (
            <div className="mt-4 flex items-center gap-2 rounded-full bg-[var(--color-brand-subtle)] px-3 py-2 text-[12px] text-[var(--color-brand)] animate-fade-in">
              <svg className="h-3.5 w-3.5 animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                <circle cx="12" cy="12" r="10" strokeOpacity="0.25" />
                <path d="M12 2a10 10 0 019.95 9" strokeLinecap="round" />
              </svg>
              正在生成新的训练方案，旧方案会先保留。
            </div>
          )}

          <div className="mt-6 space-y-3">
            {videos.map((v, i) => {
              const embeddable = isEmbeddablePlatform(v.platform);
              const isWarmup = v.note === "warmup";
              const isStretch = v.note === "stretch";
              const phaseClass = isWarmup
                ? "bg-[#fff0e8] text-[#b44725]"
                : isStretch
                  ? "bg-[#f2ffd6] text-[#5c7e08]"
                  : "bg-[#eaf0ff] text-[#315bd8]";
              const dotClass = isWarmup ? "bg-[#ff6847]" : isStretch ? "bg-[#b8f24b]" : "bg-[#3b73ff]";

              const itemCardClass = "min-w-0 overflow-hidden rounded-2xl border-0 bg-[var(--color-surface)] px-4 py-3 shadow-[0_8px_24px_rgba(149,157,165,0.10)] transition-transform duration-200 ease-out hover:-translate-y-0.5 hover:scale-[1.01] hover:shadow-[0_12px_30px_rgba(149,157,165,0.16)]";

              return (
                <div key={v.id} className="relative grid grid-cols-[32px_minmax(0,1fr)] gap-3">
                  <div className="relative flex justify-center">
                    {i < videos.length - 1 && (
                      <span className="absolute top-8 bottom-[-18px] w-px bg-[var(--color-border-strong)]" />
                    )}
                    <span className={`relative z-10 flex h-8 w-8 items-center justify-center rounded-full ${dotClass} text-[12px] font-semibold text-white shadow-[0_8px_18px_rgba(0,0,0,0.12)]`}>
                      {i + 1}
                    </span>
                  </div>

                  <div className={itemCardClass}>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${phaseClass}`}>
                        {phaseLabels[v.note] || "主训练"}
                      </span>
                      <span className={`playback-badge px-2.5 py-1 text-[11px] ${
                        embeddable
                          ? "playback-badge--embed"
                          : "playback-badge--external"
                      }`}>
                        {getPlaybackLabel(v.platform)}
                      </span>
                      {v.repeatCount > 1 && (
                        <span className="rounded-full bg-[var(--color-surface)] px-2.5 py-1 text-[11px] text-[var(--color-text-secondary)]">
                          重复 {v.repeatCount} 次
                        </span>
                      )}
                    </div>

                    <div className="mt-2 flex min-w-0 items-start gap-3">
                      <div className="min-w-0 flex-1">
                        <p className="line-clamp-2 break-words text-[14px] md:text-[15px] font-medium leading-snug text-[var(--color-text-primary)]">
                          {v.title}
                        </p>
                        <p className="mt-1 text-[12px] text-[var(--color-text-tertiary)]">
                          @{v.sourceAuthor} · {fmtDuration(v.duration)}
                        </p>
                      </div>
                    </div>

                    {(v.matchReasons.length > 0 || v.phaseReason) && (
                      <div className="mt-3 flex flex-wrap gap-1.5 text-[11px]">
                        {v.matchReasons.slice(0, 2).map((reason, index) => (
                          <span key={`${reason}-${index}`} className="rounded-full bg-[var(--color-surface)] px-2 py-1 text-[var(--color-text-tertiary)]">
                            {reason}
                          </span>
                        ))}
                        {v.phaseReason && (
                          <span className="rounded-full bg-[var(--color-surface)] px-2 py-1 text-[var(--color-text-tertiary)]">
                            {v.phaseReason}
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}
