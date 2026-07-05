"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { getEmbedUrl, supportsEmbed, getPlaybackLabel, isEmbeddablePlatform } from "@/lib/platform";
import posthog from "posthog-js";
import { api } from "@/lib/api";
import { useToast } from "./Toast";

interface WorkoutVideo {
  id: string;
  order: number;
  note: string | null;
  repeatCount: number;
  repeatIndex?: number;
  video: {
    id: string;
    title: string;
    url: string;
    platform: string;
    duration: number | null;
    sourceAuthor: string;
  };
}

interface PlanWorkoutProps {
  items: WorkoutVideo[];
  onClose: () => void;
}

const noteLabels: Record<string, string> = {
  warmup: "热身", main: "主训练", stretch: "拉伸",
};

function fmtTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function fmtDuration(seconds: number | null): string {
  if (!seconds) return "";
  const m = Math.floor(seconds / 60);
  return `${m} 分钟`;
}

// ── Session persistence (localStorage) ──

interface SessionData {
  planFingerprint: string;
  completedIndices: number[];
  skippedIndices: number[];
  currentIndex: number;
  elapsedTotal: number;
  timestamp: number;
}

function planFingerprint(items: WorkoutVideo[]): string {
  const str = items.map((i) => `${i.video.id}:${i.repeatCount}`).join("|");
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const ch = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + ch;
    hash |= 0;
  }
  return `wp-${Math.abs(hash).toString(36)}`;
}

function saveSession(data: SessionData) {
  try { localStorage.setItem("workout-session", JSON.stringify(data)); } catch { /* quota exceeded */ }
}

function loadSession(items: WorkoutVideo[]): SessionData | null {
  try {
    const raw = localStorage.getItem("workout-session");
    if (!raw) return null;
    const data = JSON.parse(raw) as SessionData;
    if (data.planFingerprint !== planFingerprint(items)) return null;
    if (Date.now() - data.timestamp > 60 * 60 * 1000) return null;
    return data;
  } catch { return null; }
}

function clearSession() {
  try { localStorage.removeItem("workout-session"); } catch { /* non-critical */ }
}

// ── Component ──

export default function PlanWorkout({ items, onClose }: PlanWorkoutProps) {
  const { toast } = useToast();
  const fp = planFingerprint(items);
  const saved = loadSession(items);

  // Flatten items by repeat count
  const flatItems: WorkoutVideo[] = items.flatMap((item) =>
    Array.from({ length: item.repeatCount || 1 }, (_, ri) => ({ ...item, repeatIndex: ri }))
  );

  function firstIncomplete(completedSet: Set<number>, skippedSet: Set<number>): number {
    for (let i = 0; i < flatItems.length; i++) {
      if (!completedSet.has(i) && !skippedSet.has(i)) return i;
    }
    return flatItems.length - 1;
  }

  const [currentIndex, setCurrentIndex] = useState(() =>
    saved ? firstIncomplete(new Set(saved.completedIndices), new Set(saved.skippedIndices)) : 0
  );
  const [completed, setCompleted] = useState<Set<number>>(() => new Set(saved?.completedIndices ?? []));
  const [skipped, setSkipped] = useState<Set<number>>(() => new Set(saved?.skippedIndices ?? []));
  // If restored and session was fully done, show completion dialog instead of auto-entering
  const restoredAllDone = !!(saved && (saved.completedIndices.length + saved.skippedIndices.length) >= flatItems.length);
  const [showSummary, setShowSummary] = useState(restoredAllDone);
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [elapsedTotal, setElapsedTotal] = useState(saved?.elapsedTotal ?? 0);
  const [elapsedVideo, setElapsedVideo] = useState(0);
  const [checkingIn, setCheckingIn] = useState(false);
  const [completedFlash, setCompletedFlash] = useState(false); // brief glow after completion
  const [listOpen, setListOpen] = useState(false);
  const [restoredFromSession] = useState(!!saved && !restoredAllDone);

  // Post-workout feedback
  const [feedbackKeys, setFeedbackKeys] = useState<Set<string>>(new Set());
  const [feedbackSaving, setFeedbackSaving] = useState(false);
  const allFeedbackDone = feedbackKeys.has("difficulty") && feedbackKeys.has("recommend");

  // External playback state
  const [externalOpenTime, setExternalOpenTime] = useState<number | null>(null);
  const [showReturnPrompt, setShowReturnPrompt] = useState(false);
  const [awayDuration, setAwayDuration] = useState(0);

  const totalTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const videoTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const sessionStartRef = useRef(0);
  const videoStartRef = useRef(0);
  const restoredElapsedRef = useRef(saved?.elapsedTotal ?? 0);
  // Refs for real-time values used inside callbacks to avoid stale closures
  const completedRef = useRef(completed);
  const skippedRef = useRef(skipped);
  const currentIndexRef = useRef(currentIndex);
  const checkingInRef = useRef(checkingIn);

  // Sync refs in effects, not during render
  useEffect(() => {
    if (sessionStartRef.current === 0) sessionStartRef.current = Date.now();
    if (videoStartRef.current === 0) videoStartRef.current = Date.now();
  }, []);
  useEffect(() => { completedRef.current = completed; }, [completed]);
  useEffect(() => { skippedRef.current = skipped; }, [skipped]);
  useEffect(() => { currentIndexRef.current = currentIndex; }, [currentIndex]);
  useEffect(() => { checkingInRef.current = checkingIn; }, [checkingIn]);

  const current = flatItems[currentIndex];
  const isLast = currentIndex >= flatItems.length - 1;
  const allDone = (completed.size + skipped.size) >= flatItems.length;
  const isSolo = flatItems.length === 1;
  const embeddable = isEmbeddablePlatform(current.video.platform);
  const embedUrl = supportsEmbed(current.video.platform)
    ? getEmbedUrl(current.video.url, current.video.platform)
    : null;

  const isWaitingReturn = externalOpenTime !== null;

  // Live elapsed total (restored + current session)
  function liveElapsed(): number {
    return restoredElapsedRef.current + Math.floor((Date.now() - sessionStartRef.current) / 1000);
  }

  // Persist session — uses latest refs, not stale closures
  function persistState() {
    saveSession({
      planFingerprint: fp,
      completedIndices: [...completedRef.current],
      skippedIndices: [...skippedRef.current],
      currentIndex: currentIndexRef.current,
      elapsedTotal: liveElapsed(),
      timestamp: Date.now(),
    });
  }

  // Total session timer — accumulates from restored value
  useEffect(() => {
    const interval = setInterval(() => {
      setElapsedTotal(liveElapsed());
    }, 1000);
    totalTimerRef.current = interval;
    return () => clearInterval(interval);
  }, []);

  // Per-video timer (resets on index change)
  useEffect(() => {
    videoStartRef.current = Date.now();
    // eslint-disable-next-line react-hooks/set-state-in-effect -- reset on step change
    setElapsedVideo(0);
    const interval = setInterval(() => {
      setElapsedVideo(Math.floor((Date.now() - videoStartRef.current) / 1000));
    }, 1000);
    videoTimerRef.current = interval;
    return () => { if (videoTimerRef.current) clearInterval(videoTimerRef.current); };
  }, [currentIndex]);

  // Notify on restored session — partial restore only; full done shows summary directly
  const didRestoreToast = useRef(false);
  useEffect(() => {
    if (restoredFromSession && (completed.size > 0 || skipped.size > 0) && !didRestoreToast.current) {
      didRestoreToast.current = true;
      toast(`已恢复上次训练进度（已完成 ${completed.size} 项）`, "info");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- runs once on mount
  }, []);

  // Stop timers when all done
  useEffect(() => {
    if (allDone) {
      if (totalTimerRef.current) clearInterval(totalTimerRef.current);
      if (videoTimerRef.current) clearInterval(videoTimerRef.current);
    }
  }, [allDone]);

  // Show summary when all done
  useEffect(() => {
    if (allDone && !showSummary) {
      const t = setTimeout(() => {
        const embeddableCount = flatItems.filter((item) => isEmbeddablePlatform(item.video.platform)).length;
        posthog.capture("workout_completed", {
          video_count: items.length,
          total_steps: flatItems.length,
          completed_count: completed.size,
          skipped_count: skipped.size,
          elapsed_total: liveElapsed(),
          embeddable_count: embeddableCount,
          external_count: flatItems.length - embeddableCount,
        });
        setShowSummary(true);
      }, 800);
      return () => clearTimeout(t);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- completion analytics should fire once per finished session
  }, [allDone, showSummary]);

  // Visibility / focus detection for external video return
  const handleReturnRef = useRef<() => void>(() => {});

  useEffect(() => {
    handleReturnRef.current = () => {
      if (!externalOpenTime) return;
      const away = Math.floor((Date.now() - externalOpenTime) / 1000);
      setAwayDuration(away);
      const videoDur = current.video.duration;
      if (videoDur && away >= videoDur * 0.8) {
        setShowReturnPrompt(true);
      }
    };
  });

  useEffect(() => {
    const onVisibility = () => {
      if (document.visibilityState === "visible") handleReturnRef.current();
    };
    const onFocus = () => handleReturnRef.current();

    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("focus", onFocus);

    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("focus", onFocus);
    };
  }, [externalOpenTime, current.video.duration]);

  const handleExternalPlay = useCallback(() => {
    window.open(current.video.url, "_blank", "noopener,noreferrer");
    setExternalOpenTime(Date.now());
  }, [current.video.url, setExternalOpenTime]);

  // ── markCompleted: check in first, then advance. Stay on current if checkin fails. ──
  const markCompleted = useCallback(async () => {
    setShowReturnPrompt(false);
    setExternalOpenTime(null);

    if (checkingInRef.current) return;
    setCheckingIn(true);
    checkingInRef.current = true;

    try {
      await api("/api/checkin", {
        method: "POST",
        body: JSON.stringify({ videoId: current.video.id }),
      });
    } catch {
      toast("打卡记录失败，请重试", "error");
      setCheckingIn(false);
      checkingInRef.current = false;
      persistState();
      return; // STAY on current item — don't advance
    }

    const next = new Set(completedRef.current);
    next.add(currentIndexRef.current);
    setCompleted(next);
    completedRef.current = next;
    setCheckingIn(false);
    checkingInRef.current = false;
    persistState();

    // Brief completion feedback before advancing — gives a sense of accomplishment
    if (currentIndexRef.current < flatItems.length - 1) {
      setCompletedFlash(true);
      setTimeout(() => {
        setCompletedFlash(false);
        setCurrentIndex((prev) => prev + 1);
        currentIndexRef.current = currentIndexRef.current + 1;
      }, 600);
    } else {
      // Last item — flash then let the allDone effect transition to summary
      setCompletedFlash(true);
      setTimeout(() => setCompletedFlash(false), 600);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- runs once on mount
  }, [current.video.id, flatItems.length]);

  // ── skipCurrent: records as SKIPPED, not completed ──
  const skipCurrent = useCallback(() => {
    setShowReturnPrompt(false);
    setExternalOpenTime(null);

    const nextSkipped = new Set(skippedRef.current);
    nextSkipped.add(currentIndexRef.current);
    setSkipped(nextSkipped);
    skippedRef.current = nextSkipped;
    persistState();

    if (currentIndexRef.current < flatItems.length - 1) {
      setCurrentIndex((prev) => prev + 1);
      currentIndexRef.current = currentIndexRef.current + 1;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- runs once on mount
  }, [flatItems.length]);

  const stayOnCurrent = useCallback(() => {
    setShowReturnPrompt(false);
    setExternalOpenTime(null);
  }, [setShowReturnPrompt, setExternalOpenTime]);

  // ── Reset training: clear session, restart from step 1 ──
  function handleReset() {
    clearSession();
    setCurrentIndex(0);
    setCompleted(new Set());
    setSkipped(new Set());
    setShowSummary(false);
    setElapsedTotal(0);
    setElapsedVideo(0);
    restoredElapsedRef.current = 0;
    sessionStartRef.current = Date.now();
    videoStartRef.current = Date.now();
    setFeedbackKeys(new Set());
    setShowResetConfirm(false);
  }

  // ── submitFeedback: only mark done on SUCCESS ──
  const submitFeedback = useCallback(async (key: string, value: string) => {
    if (feedbackSaving) return;
    setFeedbackSaving(true);
    try {
      const body: Record<string, unknown> = {
        videoIds: items.map((it) => it.video.id),
        completionRate: skipped.size === 0 ? "fully" : completed.size === 0 ? "abandoned" : "partial",
      };
      if (key === "difficulty") body.difficultyRating = value;
      if (key === "recommend") body.recommend = value === "yes";
      await api("/api/feedback/batch", {
        method: "POST",
        body: JSON.stringify(body),
      });
      posthog.capture("feedback_given", { key, value, video_ids: items.map((it) => it.video.id) });
      setFeedbackKeys((prev) => new Set(prev).add(key));
    } catch {
      toast("反馈记录失败，请重试", "error");
    } finally {
      setFeedbackSaving(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- runs once on mount
  }, [feedbackSaving, skipped.size, completed.size, items]);

  function handleClose() {
    const touchedWorkout = elapsedTotal >= 10 || completed.size > 0 || skipped.size > 0 || currentIndex > 0;
    if (!allDone && touchedWorkout) {
      const embeddableCount = flatItems.filter((item) => isEmbeddablePlatform(item.video.platform)).length;
      posthog.capture("workout_abandoned", {
        completed_count: completed.size,
        skipped_count: skipped.size,
        total_steps: flatItems.length,
        current_index: currentIndex,
        elapsed_total: elapsedTotal,
        embeddable_count: embeddableCount,
        external_count: flatItems.length - embeddableCount,
      });
      persistState();
    }
    onClose();
  }

  const nextItem = !isLast ? flatItems[currentIndex + 1] : null;

  // ── Reset confirmation overlay (global — available in both summary and workout views)
  const resetOverlay = showResetConfirm && (
    <div className="fixed inset-0 z-30 bg-black/70 backdrop-blur-sm flex items-end justify-center pb-10" onClick={() => setShowResetConfirm(false)}>
      <div
        className="bg-[#1c1c1e] w-full max-w-sm mx-4 rounded-2xl p-6 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <p className="text-[16px] font-semibold text-white text-center mb-2">重置训练</p>
        <p className="text-[13px] text-white/60 text-center mb-6">
          当前进度将被清除，从头开始训练
        </p>
        <div className="space-y-2">
          <button
            onClick={handleReset}
            className="w-full py-3 bg-[#ff3b30] hover:bg-[#ff3b30]/80 text-white font-medium rounded-full transition-all active:scale-[0.97] text-[14px]"
          >
            确认重置
          </button>
          <button
            onClick={() => setShowResetConfirm(false)}
            className="w-full py-3 text-[14px] text-white/70 hover:text-white transition-colors rounded-full"
          >
            取消
          </button>
        </div>
      </div>
    </div>
  );

  // ── Summary screen ──
  if (showSummary) {
    const totalDur = items.reduce((s, i) => s + (i.video.duration || 0) * (i.repeatCount || 1), 0);
    return (
      <div className="fixed inset-0 z-50 bg-[#000] flex flex-col items-center justify-center p-8 text-white overflow-y-auto">
        {resetOverlay}
        <div className="text-center max-w-md">
          <div className="w-20 h-20 rounded-full bg-[#34c759]/20 flex items-center justify-center mx-auto mb-6">
            <svg className="w-10 h-10 text-[#34c759]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M20 6L9 17l-5-5" />
            </svg>
          </div>

          <h2 className="text-[28px] font-semibold tracking-[-0.022em] mb-1">训练完成</h2>
          <p className="text-[14px] text-white/50 mb-8">今天的努力都会被记住</p>

          <div className="flex justify-center gap-6 mb-10">
            {[
              { v: completed.size, l: "已完成" },
              { v: fmtDuration(totalDur), l: "计划时长" },
              { v: fmtTime(elapsedTotal), l: "实际用时" },
            ].map((s, i) => (
              <div key={i} className="text-center">
                <p className="text-[32px] font-semibold tracking-tight tabular-nums">{s.v}</p>
                <p className="text-[12px] text-white/40 mt-1">{s.l}</p>
              </div>
            ))}
          </div>
          {skipped.size > 0 && (
            <p className="text-[12px] text-white/30 mb-6">跳过 {skipped.size} 项（共 {flatItems.length} 项）</p>
          )}

          {/* Item list — completed ✓ vs skipped — */}
          <div className="space-y-2 mb-10 text-left">
            {flatItems.map((item, i) => {
              const isComp = completed.has(i);
              const isSkip = skipped.has(i);
              return (
                <div key={`${item.id}-${item.repeatIndex}`} className="flex items-center gap-3 text-[13px] text-white/60">
                  <span className={`shrink-0 w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold ${
                    isComp ? "bg-[#34c759]/20 text-[#34c759]" :
                    isSkip ? "bg-white/10 text-white/30" :
                    "bg-white/5 text-white/20"
                  }`}>
                    {isComp ? "✓" : isSkip ? "—" : "?"}
                  </span>
                  <span className={isSkip ? " line-through" : "truncate"}>{item.video.title}</span>
                  {item.repeatCount > 1 && (
                    <span className="shrink-0 text-white/30">×{item.repeatCount}</span>
                  )}
                  <span className="shrink-0 text-white/30">{fmtDuration(item.video.duration)}</span>
                </div>
              );
            })}
          </div>

          {/* ── Quick feedback ── */}
          {!allFeedbackDone ? (
            <div className="mb-6 space-y-4">
              <p className="text-[13px] text-white/40">快速反馈，下次推荐更准</p>

              {!feedbackKeys.has("difficulty") ? (
                <div className="flex items-center justify-center gap-2">
                  <span className="text-[12px] text-white/30 shrink-0">难度</span>
                  {[
                    { v: "too_easy", l: "太简单" },
                    { v: "just_right", l: "刚好" },
                    { v: "too_hard", l: "太难" },
                  ].map((opt) => (
                    <button
                      key={opt.v}
                      onClick={() => submitFeedback("difficulty", opt.v)}
                      disabled={feedbackSaving}
                      className="px-4 py-2 text-[13px] bg-white/10 hover:bg-white/20 disabled:opacity-40 rounded-full transition-colors"
                    >
                      {opt.l}
                    </button>
                  ))}
                </div>
              ) : (
                <p className="text-[12px] text-white/30">难度反馈已记录</p>
              )}

              {!feedbackKeys.has("recommend") ? (
                <div className="flex items-center justify-center gap-2">
                  <span className="text-[12px] text-white/30 shrink-0">推荐</span>
                  {[
                    { v: "yes", l: "下次还想练" },
                    { v: "no", l: "不太想" },
                  ].map((opt) => (
                    <button
                      key={opt.v}
                      onClick={() => submitFeedback("recommend", opt.v)}
                      disabled={feedbackSaving}
                      className="px-4 py-2 text-[13px] bg-white/10 hover:bg-white/20 disabled:opacity-40 rounded-full transition-colors"
                    >
                      {opt.l}
                    </button>
                  ))}
                </div>
              ) : (
                <p className="text-[12px] text-white/30">推荐反馈已记录</p>
              )}
            </div>
          ) : (
            <p className="text-[13px] text-[#34c759] mb-6">反馈已记录，下次训练会更适合你</p>
          )}

          <div className="flex items-center justify-center gap-3">
            <button
              onClick={() => setShowResetConfirm(true)}
              className="px-8 py-3 bg-white/10 text-white/80 font-medium rounded-full hover:bg-white/20 active:scale-[0.97] transition-all text-[15px]"
            >
              重置训练
            </button>
            <button
              onClick={onClose}
              className="px-8 py-3 bg-white text-black font-medium rounded-full hover:bg-white/90 active:scale-[0.97] transition-all text-[15px]"
            >
              返回计划
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── Workout screen: step control console ──
  return (
    <div className="fixed inset-0 z-50 bg-[#000] flex flex-col text-white select-none overflow-y-auto">

      {/* ── Top bar ── */}
      <div className="flex items-center gap-3 px-5 py-3" style={{ paddingTop: "max(12px, env(safe-area-inset-top))" }}>
        <button onClick={handleClose} className="text-[14px] text-white/50 hover:text-white transition-colors shrink-0">
          ← 退出
        </button>

        {/* Reset — always available, requires confirmation */}
        <button
          onClick={() => setShowResetConfirm(true)}
          className="text-[14px] text-white/50 hover:text-white transition-colors shrink-0"
        >
          重置训练
        </button>

        {/* Progress dots (hidden in solo mode) */}
        {!isSolo && (
          <div className="flex-1 flex items-center justify-center gap-1.5">
            {flatItems.map((_, i) => (
              <div
                key={i}
                className={`h-1 rounded-full transition-all duration-300 ${
                  completed.has(i) ? "w-4 bg-[#34c759]" :
                  skipped.has(i) ? "w-1.5 bg-white/15" :
                  i === currentIndex ? "w-4 bg-white" :
                  "w-1.5 bg-white/20"
                }`}
              />
            ))}
          </div>
        )}
        {isSolo && <div className="flex-1" />}

        <span className="text-[13px] text-white/40 tabular-nums shrink-0 w-12 text-right">
          {fmtTime(elapsedTotal)}
        </span>
      </div>

      {/* ── Step info header ── */}
      <div className="px-5 py-3 flex items-center gap-3 text-[12px] text-white/40">
        {!isSolo && (
          <span>第 {currentIndex + 1}/{flatItems.length} 项</span>
        )}
        {current.note && (
          <span className="text-[11px] bg-white/10 text-white/50 px-2 py-0.5 rounded-full">
            {noteLabels[current.note] || current.note}
          </span>
        )}
        <span className="ml-auto">{getPlaybackLabel(current.video.platform)}</span>
      </div>

      {/* ── Timer — hero ── */}
      <div className="flex flex-col items-center pt-4 pb-4">
        <p className="text-[11px] text-white/30 font-medium mb-2 tracking-widest uppercase">
          {isWaitingReturn ? "播放中" : "进行中"}
        </p>
        <p className="text-[72px] font-semibold tracking-[-0.03em] tabular-nums leading-none">
          {fmtTime(elapsedVideo)}
        </p>
        {current.video.duration && (
          <div className="mt-2 h-0.5 w-24 bg-white/10 rounded-full overflow-hidden">
            <div
              className="h-full bg-white/40 rounded-full transition-all duration-1000"
              style={{ width: `${Math.min(100, (elapsedVideo / current.video.duration) * 100)}%` }}
            />
          </div>
        )}
        {isWaitingReturn && (
          <p className="mt-3 text-[13px] text-white/40 flex items-center gap-1.5">
            <span className="inline-block w-1.5 h-1.5 rounded-full bg-white/40 animate-pulse" />
            等你回来
          </p>
        )}
      </div>

      {/* ── Media zone ── */}
      <div className="px-4 mb-4">
        {embeddable && embedUrl ? (
          <div className="relative w-full rounded-xl overflow-hidden bg-black" style={{ aspectRatio: "16/9" }}>
            <iframe
              src={embedUrl}
              allowFullScreen
              className="absolute inset-0 w-full h-full border-0"
            />
          </div>
        ) : (
          <button
            onClick={handleExternalPlay}
            className="flex items-center justify-center gap-3 w-full py-8 rounded-xl border border-white/10 hover:border-white/25 bg-white/5 hover:bg-white/10 transition-all active:scale-[0.98]"
          >
            <svg className="w-6 h-6 text-white/60" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
              <polyline points="15 3 21 3 21 9" />
              <line x1="10" y1="14" x2="21" y2="3" />
            </svg>
            <span className="text-[15px] text-white/80 font-medium">
              去{current.video.platform === "xiaohongshu" ? "小红书" : current.video.platform === "douyin" ? "抖音" : "原平台"}播放
            </span>
          </button>
        )}
      </div>

      {/* ── Current video info ── */}
      <div className="px-5 mb-5 text-center">
        <h2 className="text-[17px] font-semibold text-white/90 leading-snug mb-1.5">
          {current.video.title}
        </h2>
        <p className="text-[12px] text-white/30">
          @{current.video.sourceAuthor} · {fmtDuration(current.video.duration)}
        </p>
      </div>

      {/* ── Primary actions ── */}
      <div className="px-5 mb-3 space-y-2">
        <button
          onClick={markCompleted}
          disabled={checkingIn || completedFlash}
          className={`w-full py-4 font-semibold rounded-full transition-all active:scale-[0.97] text-[16px] ${
          completedFlash
            ? "bg-[#34c759] text-white scale-[1.02]"
            : "bg-white hover:bg-white/90 active:bg-white/75 text-black"
        } disabled:opacity-40`}
        >
          {completedFlash ? "已完成 ✓" : checkingIn ? "打卡中..." : isLast ? "完成训练" : "完成此项"}
        </button>
        <button
          onClick={skipCurrent}
          className="w-full py-3 text-[14px] text-white/30 hover:text-white/50 transition-colors rounded-full"
        >
          跳过
        </button>
      </div>

      {/* ── Up next preview ── */}
      {nextItem && (
        <div className="px-5 mb-2">
          <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-white/5 border border-white/5">
            <span className="text-[11px] text-white/30 shrink-0">接下来</span>
            <span className="text-[13px] text-white/60 truncate flex-1">
              {nextItem.video.title}
              {nextItem.repeatCount > 1 && (
                <span className="text-white/30 ml-1">{nextItem.repeatIndex! + 1}/{nextItem.repeatCount}</span>
              )}
            </span>
            <span className="text-[12px] text-white/40 shrink-0">
              {getPlaybackLabel(nextItem.video.platform)}
            </span>
            <span className="text-[12px] text-white/30 shrink-0">{fmtDuration(nextItem.video.duration)}</span>
          </div>
        </div>
      )}

      {/* ── Video list drawer (hidden in solo mode) ── */}
      {!isSolo && (
        <div className="flex-1 overflow-hidden flex flex-col">
        <button
          onClick={() => setListOpen(!listOpen)}
          className="flex items-center justify-center gap-2 px-5 py-2 text-[12px] text-white/30 hover:text-white/50 transition-colors"
        >
          训练列表 ({completed.size + skipped.size}/{flatItems.length})
          <svg className={`w-3 h-3 transition-transform ${listOpen ? "rotate-180" : ""}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </button>

        {listOpen && (
          <div className="flex-1 overflow-auto px-5 pb-6 space-y-1">
            {flatItems.map((item, i) => {
              const isCompleted = completed.has(i);
              const isSkipped = skipped.has(i);
              const isCurrent = i === currentIndex;
              return (
                <div
                  key={`${item.id}-${item.repeatIndex}`}
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors ${
                    isCurrent ? "bg-white/10" : ""
                  }`}
                >
                  <span className={`shrink-0 w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold ${
                    isCompleted ? "bg-[#34c759]/20 text-[#34c759]" :
                    isSkipped ? "bg-white/10 text-white/20" :
                    isCurrent ? "bg-white text-black" :
                    "text-white/20"
                  }`}>
                    {isCompleted ? "✓" : isSkipped ? "—" : i + 1}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className={`text-[12px] truncate ${
                      isSkipped ? "text-white/20 line-through" :
                      isCurrent ? "text-white font-medium" :
                      isCompleted ? "text-white/30" :
                      "text-white/50"
                    }`}>
                      {item.video.title}
                      {item.repeatCount > 1 && (
                        <span className="text-white/20 ml-1">{item.repeatIndex! + 1}/{item.repeatCount}</span>
                      )}
                    </p>
                  </div>
                  <span className="text-[11px] text-white/20 shrink-0">
                    {fmtDuration(item.video.duration)}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>
      )}

      {/* ── Return prompt overlay ── */}
      {showReturnPrompt && (
        <div className="absolute inset-0 z-10 bg-black/70 backdrop-blur-sm flex items-end justify-center pb-10" onClick={() => setShowReturnPrompt(false)}>
          <div
            className="bg-[#1c1c1e] w-full max-w-sm mx-4 rounded-2xl p-6 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <p className="text-[16px] font-semibold text-white text-center mb-2">完成了吗？</p>
            <p className="text-[13px] text-white/60 text-center mb-6">
              已离开约 {Math.floor(awayDuration / 60)} 分钟，这段训练预计 {fmtDuration(current.video.duration)}
            </p>
            <div className="space-y-2">
              <button
                onClick={markCompleted}
                className="w-full py-3 bg-white hover:bg-white/90 text-black font-medium rounded-full transition-all active:scale-[0.97] text-[14px]"
              >
                已完成
              </button>
              <button
                onClick={stayOnCurrent}
                className="w-full py-3 text-[14px] text-white/70 hover:text-white transition-colors rounded-full"
              >
                继续这一项
              </button>
              <button
                onClick={skipCurrent}
                className="w-full py-3 text-[14px] text-white/40 hover:text-white/60 transition-colors rounded-full"
              >
                跳过
              </button>
            </div>
          </div>
        </div>
      )}

      {resetOverlay}
    </div>
  );
}
