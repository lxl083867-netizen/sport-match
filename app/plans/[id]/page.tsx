"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import TagBadge from "@/components/TagBadge";
import PlanWorkout from "@/components/PlanWorkout";
import ConfirmDialog from "@/components/ConfirmDialog";
import { getPlaybackLabel, isEmbeddablePlatform } from "@/lib/platform";
import { api } from "@/lib/api";
import { useToast } from "@/components/Toast";

function formatDuration(seconds: number | null): string {
  if (!seconds) return "";
  const m = Math.floor(seconds / 60);
  return `${m} 分钟`;
}

export default function PlanDetailPage() {
  const { id } = useParams();
  const [plan, setPlan] = useState<{
    id: string; title: string; description: string | null;
    targetAudience: string[]; authorName: string; authorId: string; isOwner: boolean;
    likesCount: number; favoritesCount: number; followCount: number;
    items: Array<{
      id: string; order: number; note: string | null; repeatCount: number;
      video: { id: string; title: string; url: string; platform: string; duration: number | null; sourceAuthor: string; tags: Array<{ name: string; category: string; nameZh: string }> } | null;
    }>;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [workoutMode, setWorkoutMode] = useState(false);

  // Interaction state
  const [liked, setLiked] = useState(false);
  const [favorited, setFavorited] = useState(false);
  const [followed, setFollowed] = useState(false);
  const [interacting, setInteracting] = useState<string | null>(null);

  // Edit state
  const [isEditing, setIsEditing] = useState(false);
  const [editTitle, setEditTitle] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editItems, setEditItems] = useState<Array<{
    id: string; order: number; note: string | null; repeatCount: number;
    video: { id: string; title: string; url: string; platform: string; duration: number | null; sourceAuthor: string; tags: Array<{ name: string; category: string; nameZh: string }> } | null;
  }>>([]);
  const [saving, setSaving] = useState(false);
  const [editError, setEditError] = useState("");

  // Delete state
  const [showDeletePlan, setShowDeletePlan] = useState(false);
  const [deletingPlan, setDeletingPlan] = useState(false);
  const [showDeleteItem, setShowDeleteItem] = useState<string | null>(null);
  const [deletingItem, setDeletingItem] = useState(false);
  const router = useRouter();
  const searchParams = useSearchParams();
  const fromHome = searchParams.get("from") === "home";
  const { toast } = useToast();

  useEffect(() => {
    Promise.all([
      fetch(`/api/plans/${id}`).then((r) => r.json()),
      fetch(`/api/plans/${id}/interact`).then((r) => r.json()),
    ]).then(([planData, interactData]) => {
      setPlan(planData);
      setLiked(interactData.liked);
      setFavorited(interactData.favorited);
      setFollowed(interactData.followed);
    }).finally(() => setLoading(false));
  }, [id]);

  async function handleInteract(type: "like" | "favorite" | "follow") {
    if (interacting) return;
    setInteracting(type);
    try {
      const data = await api<{ active: boolean }>(`/api/plans/${id}/interact`, {
        method: "POST",
        body: JSON.stringify({ type }),
      });

      if (type === "like") {
        setLiked(data.active);
        setPlan((prev) => prev ? { ...prev, likesCount: prev.likesCount + (data.active ? 1 : -1) } : prev);
      } else if (type === "favorite") {
        setFavorited(data.active);
        setPlan((prev) => prev ? { ...prev, favoritesCount: prev.favoritesCount + (data.active ? 1 : -1) } : prev);
      } else {
        setFollowed(data.active);
        setPlan((prev) => prev ? { ...prev, followCount: prev.followCount + (data.active ? 1 : -1) } : prev);
      }
    } catch (e) {
      toast(e instanceof Error ? e.message : "操作失败", "error");
    } finally {
      setInteracting(null);
    }
  }

  async function handleDeletePlan() {
    setDeletingPlan(true);
    try {
      await api(`/api/plans/${id}`, { method: "DELETE" });
      toast("计划已删除", "success");
      router.back();
    } catch (e) {
      toast(e instanceof Error ? e.message : "删除失败", "error");
      setDeletingPlan(false);
    }
  }

  async function handleUpdateItem(itemId: string, data: { repeatCount?: number }) {
    try {
      await api(`/api/plans/${id}/items/${itemId}`, {
        method: "PATCH",
        body: JSON.stringify(data),
      });
      setPlan((prev) => prev ? {
        ...prev,
        items: prev.items.map((it) => it.id === itemId ? { ...it, repeatCount: data.repeatCount ?? it.repeatCount } : it),
      } : prev);
    } catch {
      toast("更新失败，请稍后重试", "error");
    }
  }

  async function handleDeleteItem(itemId: string) {
    setDeletingItem(true);
    try {
      await api(`/api/plans/${id}/items/${itemId}`, { method: "DELETE" });
      setPlan((prev) => prev ? {
        ...prev,
        items: prev.items.filter((it) => it.id !== itemId),
      } : prev);
      toast("视频已从计划中移除", "success");
    } catch {
      toast("移除失败", "error");
    } finally {
      setDeletingItem(false);
      setShowDeleteItem(null);
    }
  }

  function enterEditMode() {
    if (!plan) return;
    setEditTitle(plan.title);
    setEditDescription(plan.description || "");
    setEditItems(plan.items.map((it) => ({ ...it })));
    setEditError("");
    setIsEditing(true);
  }

  function cancelEdit() {
    setIsEditing(false);
    setEditError("");
  }

  function moveItem(index: number, direction: "up" | "down") {
    const newItems = [...editItems];
    const target = direction === "up" ? index - 1 : index + 1;
    if (target < 0 || target >= newItems.length) return;
    [newItems[index], newItems[target]] = [newItems[target], newItems[index]];
    // Re-assign order
    setEditItems(newItems.map((it, i) => ({ ...it, order: i })));
  }

  function removeEditItem(index: number) {
    const newItems = editItems.filter((_, i) => i !== index);
    setEditItems(newItems.map((it, i) => ({ ...it, order: i })));
  }

  async function handleSaveEdit() {
    if (!editTitle.trim()) { setEditError("训练名称不能为空"); return; }
    setSaving(true);
    setEditError("");
    const body: Record<string, unknown> = {
      title: editTitle.trim(),
      description: editDescription.trim() || null,
    };
    // Only include items if they changed
    body.items = editItems.map((it, i) => ({
      videoId: it.video!.id,
      order: i,
      note: it.note,
      repeatCount: it.repeatCount,
    }));

    try {
      const data = await api<{
        id: string; title: string; description: string | null; targetAudience: string[];
        favoritesCount: number;
        items: Array<{ id: string; order: number; note: string | null; repeatCount: number; video: { id: string; title: string; url: string; platform: string; duration: number | null; sourceAuthor: string; tags: Array<{ name: string; category: string; nameZh: string }> } | null }>;
      }>(`/api/plans/${id}`, {
        method: "PATCH",
        body: JSON.stringify(body),
      });
      setPlan({
        id: data.id,
        title: data.title,
        description: data.description,
        targetAudience: data.targetAudience,
        authorName: plan!.authorName,
        authorId: plan!.authorId,
        isOwner: true,
        likesCount: plan!.likesCount,
        favoritesCount: data.favoritesCount,
        followCount: plan!.followCount,
        items: data.items,
      });
      setIsEditing(false);
      toast("计划已更新", "success");
    } catch (e) {
      setEditError(e instanceof Error ? e.message : "保存失败");
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <div className="text-center text-[var(--color-text-tertiary)] py-20">加载中...</div>;
  if (!plan) return <div className="text-center text-[var(--color-text-tertiary)] py-20">计划不存在</div>;

  const noteLabels: Record<string, string> = { warmup: "热身", main: "主训练", stretch: "拉伸" };
  const validItems = plan.items.filter(
    (i): i is (typeof plan.items)[number] & { video: NonNullable<(typeof plan.items)[number]["video"]> } => i.video !== null,
  );
  const brokenCount = plan.items.length - validItems.length;

  if (workoutMode) {
    return <PlanWorkout items={validItems} onClose={() => setWorkoutMode(false)} />;
  }
  const totalDuration = validItems.reduce((sum, i) => sum + (i.video!.duration || 0), 0);
  const embeddableCount = validItems.filter((i) => isEmbeddablePlatform(i.video!.platform)).length;
  const externalCount = validItems.length - embeddableCount;
  const allEmbeddable = externalCount === 0 && validItems.length > 0;

  return (
    <div className="max-w-[880px] mx-auto px-4 md:px-6 py-6 md:py-8">
      <Link
        href={fromHome ? "/" : "/plans"}
        className="mb-4 inline-flex items-center rounded-full bg-[var(--color-surface)] px-3 py-1.5 text-[13px] font-medium text-[var(--color-text-secondary)] shadow-[0_8px_20px_rgba(15,23,42,0.05)] transition-all duration-200 hover:-translate-y-0.5 hover:text-[var(--color-brand)]"
      >
        ← {fromHome ? "返回首页" : "返回计划广场"}
      </Link>

      {/* Plan header */}
      <div
        className="relative mb-8 overflow-hidden bg-[var(--color-surface)] p-6 shadow-[0_16px_36px_rgba(15,23,42,0.07)]"
        style={{ borderRadius: "24px" }}
      >
        <div className="absolute inset-x-0 top-0 h-1.5 bg-[linear-gradient(90deg,#6C57FF,#0F86AD,#B2DD5A,#FF5E32)]" />
        <div className="absolute -right-12 -top-14 h-36 w-36 rounded-[42px] bg-[#c9ecfb] opacity-80 rotate-12" />
        <div className="absolute right-14 top-12 h-3 w-5 rounded-[6px] bg-[#FF5E32] rotate-[-10deg]" />

        <div className="relative">
          {isEditing ? (
            <>
              <input
                value={editTitle}
                onChange={(e) => setEditTitle(e.target.value)}
                className="mb-3 w-full rounded-[16px] bg-[var(--color-surface-secondary)] px-4 py-3 text-[24px] font-semibold tracking-[-0.022em] text-[var(--color-text-primary)] outline-none ring-1 ring-[var(--color-border)] transition focus:ring-[3px] focus:ring-[#6C57FF]/20"
                placeholder="训练名称"
              />
              <textarea
                value={editDescription}
                onChange={(e) => setEditDescription(e.target.value)}
                rows={2}
                className="mb-4 w-full resize-none rounded-[16px] bg-[var(--color-surface-secondary)] px-4 py-3 text-[14px] text-[var(--color-text-secondary)] outline-none ring-1 ring-[var(--color-border)] transition focus:ring-[3px] focus:ring-[#6C57FF]/20"
                placeholder="训练描述（可选）"
              />
            </>
          ) : (
            <>
              <div className="mb-3 inline-flex rounded-full bg-[#f1edff] px-3 py-1 text-[12px] font-semibold text-[#6C57FF]">
                训练计划路线
              </div>
              <h1 className="max-w-[620px] text-[30px] font-semibold leading-tight tracking-[-0.035em] text-[var(--color-text-primary)] md:text-[36px]">{plan.title}</h1>
              {plan.description && <p className="mt-3 max-w-[650px] text-[14px] leading-relaxed text-[var(--color-text-secondary)]">{plan.description}</p>}
            </>
          )}

          <div className="mt-5 flex flex-wrap items-center gap-x-4 gap-y-1 text-[13px] font-medium text-[var(--color-text-secondary)]">
            <span>创建者 · {plan.authorName}</span>
            <span className="text-[#3f56df]">{plan.items.length} 个视频</span>
            <span className="text-[#b44725]">{formatDuration(totalDuration)}</span>
          </div>

        {plan.targetAudience.length > 0 && !isEditing && (
          <div className="mt-4 flex flex-wrap gap-1.5">
            {plan.targetAudience.map((t) => (
              <TagBadge key={t} label={t} size="sm" color="blue" />
            ))}
          </div>
        )}

        {/* Playback fluency summary */}
        <div className="my-5">
          <div className="flex flex-wrap items-center gap-2 text-[13px] text-[var(--color-text-secondary)]">
            <span className="font-medium text-[var(--color-text-primary)]">播放连续性</span>
            <span>包含 {embeddableCount} 个站内播放视频，{externalCount} 个需跳转</span>
            {allEmbeddable && (
              <span className="inline-flex items-center gap-1 rounded-full bg-[#eefbd7] px-2.5 py-1 text-[12px] font-semibold text-[#527400]">
                <svg className="w-3 h-3" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" /></svg>
                适合连续跟练
              </span>
            )}
          </div>
        </div>

        {/* Action buttons */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => setWorkoutMode(true)}
            className="flex items-center gap-2 rounded-full bg-[#3b73ff] px-6 py-3 text-[14px] font-semibold text-white shadow-[0_14px_30px_rgba(59,115,255,0.24)] transition-all duration-200 hover:-translate-y-0.5 hover:bg-[#2f64e8] active:scale-[0.97]"
          >
            <svg className="w-4 h-4" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clipRule="evenodd" />
            </svg>
            开始跟练
          </button>

          <button
            onClick={() => handleInteract("like")}
            disabled={interacting === "like"}
            className={`flex items-center gap-1.5 rounded-full px-4 py-2.5 text-[13px] font-medium transition-all duration-200 hover:-translate-y-0.5 active:scale-95 ${
              liked
                ? "bg-[#f1edff] text-[#6C57FF] shadow-[0_10px_20px_rgba(108,87,255,0.12)]"
                : "bg-[var(--color-surface-secondary)] text-[var(--color-text-secondary)] hover:bg-[#f1edff] hover:text-[#6C57FF]"
            }`}
          >
            <svg className="w-4 h-4" viewBox="0 0 20 20" fill={liked ? "currentColor" : "none"} stroke="currentColor" strokeWidth="1.5">
              <path d="M10.29 4.09l.21.23.21-.23a4.71 4.71 0 016.66 6.66l-6.87 7.11-6.87-7.11a4.71 4.71 0 016.66-6.66z" />
            </svg>
            {plan.likesCount}
          </button>

          <button
            onClick={() => handleInteract("favorite")}
            disabled={interacting === "favorite"}
            className={`flex items-center gap-1.5 rounded-full px-4 py-2.5 text-[13px] font-medium transition-all duration-200 hover:-translate-y-0.5 active:scale-95 ${
              favorited
                ? "bg-[#fff0e8] text-[#FF5E32] shadow-[0_10px_20px_rgba(255,94,50,0.12)]"
                : "bg-[var(--color-surface-secondary)] text-[var(--color-text-secondary)] hover:bg-[#fff0e8] hover:text-[#FF5E32]"
            }`}
          >
            <svg className="w-4 h-4" viewBox="0 0 20 20" fill={favorited ? "currentColor" : "none"} stroke="currentColor" strokeWidth="1.5">
              <path d="M9.05 2.93l1.06 2.14 2.36.34c.86.12 1.2 1.18.58 1.78l-1.71 1.66.4 2.35c.15.85-.75 1.5-1.52 1.1L8 11.24l-2.11 1.11c-.77.4-1.67-.25-1.52-1.1l.4-2.35-1.71-1.66c-.62-.6-.28-1.66.58-1.78l2.36-.34 1.06-2.14a1.06 1.06 0 011.9 0z" />
            </svg>
            收藏 {plan.favoritesCount}
          </button>

          {plan.isOwner && !isEditing && (
            <>
              {plan.favoritesCount > 0 ? (
                <span
                  className="ml-auto self-center rounded-full bg-[var(--color-surface-secondary)] px-3 py-2 text-[12px] text-[var(--color-text-tertiary)] cursor-not-allowed"
                  title="该计划已被他人收藏，无法编辑"
                >
                  编辑计划
                </span>
              ) : (
                <button
                  onClick={enterEditMode}
                  className="ml-auto self-center rounded-full bg-[var(--color-surface-secondary)] px-3 py-2 text-[13px] font-medium text-[var(--color-text-secondary)] transition-all hover:-translate-y-0.5 hover:text-[var(--color-brand)]"
                >
                  编辑计划
                </button>
              )}
              <button
                onClick={() => setShowDeletePlan(true)}
                className="self-center rounded-full bg-[var(--color-surface-secondary)] px-3 py-2 text-[13px] font-medium text-[var(--color-text-secondary)] transition-all hover:-translate-y-0.5 hover:text-[#FF5E32]"
              >
                删除计划
              </button>
            </>
          )}

          {isEditing && (
            <div className="ml-auto flex items-center gap-2">
              {editError && <span className="text-[12px] text-[var(--color-error)]">{editError}</span>}
              <button
                onClick={cancelEdit}
                className="text-[13px] text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] transition-colors px-3 py-1.5"
              >
                取消
              </button>
              <button
                onClick={handleSaveEdit}
                disabled={saving}
                className="text-[13px] bg-[#3b73ff] hover:bg-[#2f64e8] text-white font-medium px-5 py-1.5 rounded-full transition-all active:scale-[0.97] disabled:opacity-40"
              >
                {saving ? "保存中..." : "保存"}
              </button>
            </div>
          )}
        </div>
        </div>
      </div>

      {/* Video list */}
      <div className="space-y-3">
        <h2 className="mb-3 flex items-center gap-2 text-[20px] font-semibold tracking-[-0.02em] text-[var(--color-text-primary)]">
          训练路线
          {brokenCount > 0 && (
            <span className="text-[12px] font-normal text-[#FF5E32]">
              （{brokenCount} 个已失效）
            </span>
          )}
        </h2>
        {(isEditing ? editItems.filter((it) => it.video !== null) : plan.items).map((item, i) => {
          if (!item.video) {
            return (
              <div
                key={item.id}
                className="bg-[var(--color-surface-secondary)] p-5 opacity-70 shadow-[0_10px_24px_rgba(15,23,42,0.04)]"
                style={{ borderRadius: "20px" }}
              >
                <div className="flex items-start gap-3">
                  <div className="shrink-0 w-10 h-10 rounded-full bg-[var(--color-text-tertiary)]/15 text-[var(--color-text-tertiary)] flex items-center justify-center text-sm font-semibold">
                    {i + 1}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-medium text-[15px] text-[var(--color-text-tertiary)]">
                        ⚠ 视频已失效
                      </span>
                      {item.note && (
                        <span className="shrink-0 text-[11px] bg-[var(--color-text-tertiary)]/10 text-[var(--color-text-tertiary)] px-2 py-0.5 rounded-full">
                          {noteLabels[item.note] || item.note}
                        </span>
                      )}
                    </div>
                    <p className="text-[12px] text-[var(--color-text-tertiary)] mb-2">
                      该视频已被原作者删除
                    </p>
                    {plan?.isOwner && !isEditing && (
                      <div className="flex items-center gap-2">
                        <Link
                          href={`/videos?platform=bilibili`}
                          className="rounded-full bg-[#edf1ff] px-2.5 py-1 text-[12px] font-medium text-[#3f56df] transition hover:bg-[#dfe6ff]"
                        >
                          找替代视频
                        </Link>
                        <button
                          onClick={() => setShowDeleteItem(item.id)}
                          className="rounded-full bg-[var(--color-surface)] px-2.5 py-1 text-[12px] font-medium text-[var(--color-text-tertiary)] transition-colors hover:text-[var(--color-error)]"
                        >
                          从计划中移除
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          }
          const embeddable = isEmbeddablePlatform(item.video.platform);
          const videoId = item.video.id;
          const openVideoDetail = () => {
            if (!isEditing) router.push(`/videos/${videoId}`);
          };
          return (
          <div
            key={item.id}
            role={isEditing ? undefined : "link"}
            tabIndex={isEditing ? undefined : 0}
            onClick={openVideoDetail}
            onKeyDown={(e) => {
              if (!isEditing && (e.key === "Enter" || e.key === " ")) {
                e.preventDefault();
                openVideoDetail();
              }
            }}
            className={`group bg-[var(--color-surface)] p-5 shadow-[0_10px_26px_rgba(15,23,42,0.05)] transition-all duration-200 hover:-translate-y-1 hover:shadow-[0_16px_34px_rgba(15,23,42,0.09)] ${isEditing ? "" : "cursor-pointer"}`}
            style={{ borderRadius: "20px" }}
          >
            <div className="flex items-start gap-4">
              <div className={`shrink-0 flex h-11 w-11 items-center justify-center rounded-full text-sm font-bold shadow-[0_10px_22px_rgba(15,23,42,0.08)] ${
                item.note === "warmup"
                  ? "bg-[#fff0e8] text-[#FF5E32]"
                  : item.note === "stretch"
                    ? "bg-[#eefbd7] text-[#527400]"
                    : "bg-[#edf1ff] text-[#3f56df]"
              }`}>
                {i + 1}
              </div>
              <div className="flex-1 min-w-0">
                <div className="mb-2 flex min-w-0 flex-wrap items-center gap-2">
                  {isEditing ? (
                    <span className="min-w-0 flex-1 text-[17px] font-semibold leading-snug text-[var(--color-text-primary)]">{item.video.title}</span>
                  ) : (
                    <span className="min-w-0 flex-1 text-[17px] font-semibold leading-snug text-[var(--color-text-primary)] transition-colors group-hover:text-[var(--color-brand)]">{item.video.title}</span>
                  )}
                  {item.note && (
                    <span className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-semibold ${
                      item.note === "warmup"
                        ? "bg-[#fff0e8] text-[#b44725]"
                        : item.note === "stretch"
                          ? "bg-[#eefbd7] text-[#527400]"
                          : "bg-[#edf1ff] text-[#3f56df]"
                    }`}>
                      {noteLabels[item.note] || item.note}
                    </span>
                  )}
                  {item.repeatCount > 1 && (
                    <span className="shrink-0 rounded-full bg-[var(--color-surface-secondary)] px-2.5 py-1 text-[11px] font-semibold text-[var(--color-text-tertiary)]">
                      ×{item.repeatCount}
                    </span>
                  )}
                </div>
                <div className="flex flex-wrap items-center gap-2 text-[12px] text-[var(--color-text-tertiary)]">
                  <span>@{item.video.sourceAuthor} · {formatDuration(item.video.duration)}</span>
                  <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold ${
                    embeddable
                      ? "bg-[#eefbd7] text-[#527400]"
                      : "bg-[var(--color-surface-secondary)] text-[var(--color-text-secondary)]"
                  }`}>
                    {!embeddable && (
                      <svg className="w-2.5 h-2.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                        <path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6" />
                        <polyline points="15 3 21 3 21 9" />
                        <line x1="10" y1="14" x2="21" y2="3" />
                      </svg>
                    )}
                    {getPlaybackLabel(item.video.platform)}
                  </span>
                </div>
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  {isEditing ? (
                    <>
                      <span className="text-[12px] text-[var(--color-text-tertiary)]">{embeddable ? "站内播放" : "需跳转"}</span>
                      <div className="flex items-center gap-1 ml-auto">
                        <span className="text-[11px] text-[var(--color-text-tertiary)]">次数</span>
                        <input
                          type="number"
                          min={1}
                          max={99}
                          value={item.repeatCount}
                          onChange={(e) => {
                            const newItems = [...editItems];
                            newItems[i] = { ...newItems[i], repeatCount: parseInt(e.target.value) || 1 };
                            setEditItems(newItems);
                          }}
                          className="w-10 text-center text-[12px] border border-[var(--color-border)] rounded-[6px] py-0.5 bg-[var(--color-surface-secondary)] text-[var(--color-text-primary)] [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                        />
                      </div>
                      <div className="ml-auto flex items-center gap-1">
                        <button
                          onClick={() => moveItem(i, "up")}
                          disabled={i === 0}
                          className="p-1 text-[var(--color-text-tertiary)] hover:text-[var(--color-text-primary)] disabled:opacity-30 transition-colors"
                          title="上移"
                        >
                          <svg className="w-4 h-4" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M14.707 12.707a1 1 0 01-1.414 0L10 9.414l-3.293 3.293a1 1 0 01-1.414-1.414l4-4a1 1 0 011.414 0l4 4a1 1 0 010 1.414z" clipRule="evenodd" /></svg>
                        </button>
                        <button
                          onClick={() => moveItem(i, "down")}
                          disabled={i === editItems.length - 1}
                          className="p-1 text-[var(--color-text-tertiary)] hover:text-[var(--color-text-primary)] disabled:opacity-30 transition-colors"
                          title="下移"
                        >
                          <svg className="w-4 h-4" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" /></svg>
                        </button>
                        <button
                          onClick={() => removeEditItem(i)}
                          className="p-1 text-[var(--color-text-tertiary)] hover:text-[var(--color-error)] transition-colors ml-2"
                          title="移除"
                        >
                          <svg className="w-4 h-4" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" /></svg>
                        </button>
                      </div>
                    </>
                  ) : (
                    <>
                      {embeddable ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-[#edf1ff] px-2.5 py-1 text-[12px] font-semibold text-[#3f56df] transition-all group-hover:scale-105">
                          <svg className="w-3 h-3" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clipRule="evenodd" /></svg>
                          播放
                        </span>
                      ) : null}
                      {!embeddable && (
                        <Link
                          href={`/videos?platform=bilibili`}
                          onClick={(e) => e.stopPropagation()}
                          className="rounded-full bg-[#f1edff] px-2.5 py-1 text-[12px] font-semibold text-[#6C57FF] transition-all hover:-translate-y-0.5"
                        >
                          找可站内播放的替代视频
                        </Link>
                      )}
                      {plan?.isOwner && !isEditing && (
                        <div className="flex items-center gap-1 ml-auto">
                          <span className="rounded-full bg-[var(--color-surface-secondary)] px-2.5 py-1 text-[11px] font-medium text-[var(--color-text-tertiary)]">
                            重复 {item.repeatCount} 次
                          </span>
                        </div>
                      )}
                    </>
                  )}
                </div>
              </div>
            </div>
          </div>
          );
        })}
      </div>

      {/* Delete plan confirmation */}
      <ConfirmDialog
        open={showDeletePlan}
        title="删除计划"
        message="确定要删除这个训练计划吗？此操作不可撤销。"
        confirmLabel={deletingPlan ? "删除中..." : "确认删除"}
        danger
        onConfirm={handleDeletePlan}
        onCancel={() => setShowDeletePlan(false)}
      />

      {/* Remove plan item confirmation */}
      <ConfirmDialog
        open={!!showDeleteItem}
        title="移除视频"
        message="确定要从计划中移除此视频吗？"
        confirmLabel={deletingItem ? "移除中..." : "确认移除"}
        onConfirm={() => showDeleteItem && handleDeleteItem(showDeleteItem)}
        onCancel={() => setShowDeleteItem(null)}
      />
    </div>
  );
}
