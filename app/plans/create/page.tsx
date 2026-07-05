"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import TagBadge from "@/components/TagBadge";
import { api } from "@/lib/api";
import { useToast } from "@/components/Toast";

interface VideoItem {
  videoId: string;
  title: string;
  order: number;
  note: string;
  repeatCount: number;
}

const PHASE_OPTIONS = [
  { value: "warmup", label: "热身" },
  { value: "main", label: "主训练" },
  { value: "stretch", label: "拉伸" },
];

const AUDIENCE_TAG_COLORS: Record<string, "green" | "blue" | "orange" | "red" | "purple"> = {
  "零基础": "green", "有经验": "blue", "大基数": "orange",
  "产后恢复": "purple", "康复期": "red", "办公室久坐": "orange",
};

function CreatePlanForm() {
  const router = useRouter();
  const { toast } = useToast();
  const searchParams = useSearchParams();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [targetAudience, setTargetAudience] = useState<string[]>([]);
  const [search, setSearch] = useState("");
  const [searchResults, setSearchResults] = useState<Array<{ id: string; title: string; sourceAuthor: string; duration: number | null }>>([]);
  const [items, setItems] = useState<VideoItem[]>([]);
  const [saving, setSaving] = useState(false);
  const [tagUsage, setTagUsage] = useState<Array<{ label: string; count: number }>>([]);

  // Pre-fill from query params (when adding video from detail page)
  useEffect(() => {
    const videoId = searchParams.get("videoId");
    const videoTitle = searchParams.get("title");
    if (videoId && videoTitle) {
      setItems([{ videoId, title: videoTitle, order: 1, note: "main", repeatCount: 1 }]);
    }
  }, []);

  // Fetch tag usage counts
  useEffect(() => {
    fetch("/api/plans/tags")
      .then((r) => r.json())
      .then((data) => setTagUsage(data.tags || []));
  }, []);

  // Search videos
  useEffect(() => {
    if (search.length < 2) { setSearchResults([]); return; }
    const timer = setTimeout(() => {
      fetch(`/api/videos?search=${encodeURIComponent(search)}&limit=6`)
        .then((r) => r.json())
        .then((data) => setSearchResults(data.videos));
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);

  function addVideo(video: { id: string; title: string }) {
    setItems([...items, { videoId: video.id, title: video.title, order: items.length + 1, note: "main", repeatCount: 1 }]);
    setSearch("");
    setSearchResults([]);
  }

  function removeVideo(index: number) {
    const newItems = items.filter((_, i) => i !== index).map((item, i) => ({ ...item, order: i + 1 }));
    setItems(newItems);
  }

  function setPhase(index: number, phase: string) {
    const newItems = [...items];
    newItems[index].note = phase;
    setItems(newItems);
  }

  function setRepeatCount(index: number, count: number) {
    const newItems = [...items];
    newItems[index].repeatCount = Math.max(1, Math.min(99, count));
    setItems(newItems);
  }

  function moveUp(index: number) {
    if (index === 0) return;
    const newItems = [...items];
    [newItems[index - 1], newItems[index]] = [newItems[index], newItems[index - 1]];
    setItems(newItems.map((item, i) => ({ ...item, order: i + 1 })));
  }

  function moveDown(index: number) {
    if (index === items.length - 1) return;
    const newItems = [...items];
    [newItems[index], newItems[index + 1]] = [newItems[index + 1], newItems[index]];
    setItems(newItems.map((item, i) => ({ ...item, order: i + 1 })));
  }

  function moveToTop(index: number) {
    if (index === 0) return;
    const newItems = [...items];
    const [item] = newItems.splice(index, 1);
    newItems.unshift(item);
    setItems(newItems.map((item, i) => ({ ...item, order: i + 1 })));
  }

  function toggleTag(tag: string) {
    setTargetAudience((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
    );
  }

  async function handleSubmit() {
    if (!title || items.length === 0) return;
    setSaving(true);
    try {
      const plan = await api<{ id: string }>("/api/plans", {
        method: "POST",
        body: JSON.stringify({ title, description: description || null, targetAudience, items }),
      });
      toast("计划创建成功", "success");
      router.push(`/plans/${plan.id}`);
    } catch (e) {
      toast(e instanceof Error ? e.message : "创建失败，请稍后重试", "error");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="max-w-2xl mx-auto px-5 py-8">
      <h1 className="text-[28px] font-semibold tracking-[-0.022em] text-[var(--color-text-primary)] mb-6">创建训练计划</h1>

      <div className="space-y-5">
        <div>
          <label className="block text-[13px] font-medium text-[var(--color-text-secondary)] mb-1.5">计划名称</label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="比如：办公室久坐30分钟全身激活"
            className="w-full px-4 py-3 rounded-xl bg-[var(--color-surface-secondary)] border border-[var(--color-border)] text-[15px] text-[var(--color-text-primary)] placeholder:text-[var(--color-text-tertiary)] focus:outline-none focus:border-[var(--color-brand)] focus:ring-2 focus:ring-[var(--color-brand-subtle)] transition-colors"
          />
        </div>

        <div>
          <label className="block text-[13px] font-medium text-[var(--color-text-secondary)] mb-1.5">描述（可选）</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="描述这个计划的适用人群和效果..."
            rows={2}
            className="w-full px-4 py-3 rounded-xl bg-[var(--color-surface-secondary)] border border-[var(--color-border)] text-[15px] text-[var(--color-text-primary)] placeholder:text-[var(--color-text-tertiary)] focus:outline-none focus:border-[var(--color-brand)] focus:ring-2 focus:ring-[var(--color-brand-subtle)] resize-none transition-colors"
          />
        </div>

        {/* Tags for plan */}
        <div>
          <label className="block text-[13px] font-medium text-[var(--color-text-secondary)] mb-1.5">
            适用人群标签（可选）
            <span className="text-[var(--color-text-tertiary)] font-normal ml-1">标签后数字为该标签被多少计划使用</span>
          </label>
          <div className="flex flex-wrap gap-2">
            {tagUsage.map((t) => (
              <TagBadge
                key={t.label}
                label={t.label}
                selected={targetAudience.includes(t.label)}
                color={AUDIENCE_TAG_COLORS[t.label] || "blue"}
                count={t.count}
                onClick={() => toggleTag(t.label)}
              />
            ))}
          </div>
        </div>

        <div>
          <label className="block text-[13px] font-medium text-[var(--color-text-secondary)] mb-1.5">导入视频</label>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="搜索视频..."
            className="w-full px-4 py-3 rounded-xl bg-[var(--color-surface-secondary)] border border-[var(--color-border)] text-[15px] text-[var(--color-text-primary)] placeholder:text-[var(--color-text-tertiary)] focus:outline-none focus:border-[var(--color-brand)] focus:ring-2 focus:ring-[var(--color-brand-subtle)] transition-colors"
          />
          {searchResults.length > 0 && (
            <div className="mt-2 border border-[var(--color-border)] rounded-[16px] overflow-hidden bg-[var(--color-surface)]">
              {searchResults.map((v) => (
                <button
                  key={v.id}
                  onClick={() => addVideo(v)}
                  className="w-full text-left px-4 py-3 hover:bg-[var(--color-brand-subtle)] border-b border-[var(--color-border)] last:border-0 transition-colors"
                >
                  <p className="text-[14px] font-medium text-[var(--color-text-primary)] truncate">{v.title}</p>
                  <p className="text-[12px] text-[var(--color-text-tertiary)]">@{v.sourceAuthor}</p>
                </button>
              ))}
            </div>
          )}
        </div>

        {items.length > 0 && (
          <div>
            <label className="block text-[13px] font-medium text-[var(--color-text-secondary)] mb-2">
              已选视频 ({items.length})
            </label>
            <div className="space-y-2">
              {items.map((item, i) => (
                <div
                  key={i}
                  className="flex items-center gap-3 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-[16px] p-3"
                >
                  <span className="w-6 h-6 rounded-full bg-[var(--color-brand-subtle)] text-[var(--color-brand)] flex items-center justify-center text-xs font-bold shrink-0">
                    {i + 1}
                  </span>
                  <span className="flex-1 text-[14px] text-[var(--color-text-primary)] truncate">{item.title}</span>
                  <select
                    value={item.note}
                    onChange={(e) => setPhase(i, e.target.value)}
                    className="text-[12px] border border-[var(--color-border)] rounded-[8px] px-2 py-1 bg-[var(--color-surface-secondary)] text-[var(--color-text-primary)]"
                  >
                    {PHASE_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                  </select>
                  <div className="flex items-center gap-1">
                    <span className="text-[11px] text-[var(--color-text-tertiary)]">×</span>
                    <input
                      type="number"
                      min={1}
                      max={99}
                      value={item.repeatCount}
                      onChange={(e) => setRepeatCount(i, parseInt(e.target.value) || 1)}
                      className="w-10 text-center text-[12px] border border-[var(--color-border)] rounded-[8px] py-1 bg-[var(--color-surface-secondary)] text-[var(--color-text-primary)] [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                    />
                  </div>
                  <div className="flex items-center gap-0.5 shrink-0">
                    <button onClick={() => moveToTop(i)} disabled={i === 0} title="置顶"
                      className="text-[11px] text-[var(--color-text-tertiary)] hover:text-[var(--color-brand)] disabled:opacity-25 px-0.5 transition-colors">⤒</button>
                    <button onClick={() => moveUp(i)} disabled={i === 0} title="上移"
                      className="text-[11px] text-[var(--color-text-tertiary)] hover:text-[var(--color-brand)] disabled:opacity-25 px-0.5 transition-colors">▲</button>
                    <button onClick={() => moveDown(i)} disabled={i === items.length - 1} title="下移"
                      className="text-[11px] text-[var(--color-text-tertiary)] hover:text-[var(--color-brand)] disabled:opacity-25 px-0.5 transition-colors">▼</button>
                  </div>
                  <button
                    onClick={() => removeVideo(i)}
                    className="text-[var(--color-text-tertiary)] hover:text-[#b01030] text-[13px] shrink-0 transition-colors"
                  >
                    移除
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        <button
          onClick={handleSubmit}
          disabled={saving || !title || items.length === 0}
          className="w-full py-3 bg-[#3b73ff] hover:opacity-90 disabled:opacity-30 text-white font-medium rounded-full transition-opacity text-[15px]"
        >
          {saving ? "创建中..." : "发布训练计划"}
        </button>
      </div>
    </div>
  );
}

export default function CreatePlanPage() {
  return (
    <Suspense fallback={<div className="text-center py-20 text-[var(--color-text-tertiary)]">加载中...</div>}>
      <CreatePlanForm />
    </Suspense>
  );
}
