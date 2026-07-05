"use client";

import { useState, useMemo, useRef, useEffect } from "react";
import { parseVideoUrl } from "@/lib/video-import";
import posthog from "posthog-js";
import { api } from "@/lib/api";
import { useToast } from "./Toast";

interface Props {
  open: boolean;
  onClose: () => void;
  onAdded: (video: { id: string; title: string }, existed?: boolean) => void;
}

type VideoQuality = {
  level: "high" | "medium" | "low";
  message: string;
  reasons: string[];
};

type ImportResponse =
  | { requiresConfirmation?: false; video: { id: string; title: string; platform: string }; existed: boolean; quality?: VideoQuality }
  | { requiresConfirmation: true; quality: VideoQuality; preview: { title: string; platform: string; sourceAuthor: string } };

type BatchResult = {
  url: string;
  status: "imported" | "existed" | "failed" | "needs_confirmation";
  video?: { id: string; title: string; platform: string };
  error?: string;
  quality?: VideoQuality;
};

/** Extract title/author hints from sharing text surrounding a URL. */
function extractInfo(raw: string): { titleHint: string; authorHint: string } {
  const m = raw.match(/https?:\/\/[^\s⺀-鿿　-〿＀-￯]+/i);
  if (!m) return { titleHint: "", authorHint: "" };
  const cu = m[0];
  const idx = raw.indexOf(cu);
  const before = raw.slice(0, idx).trim();
  if (!before) return { titleHint: "", authorHint: "" };

  // 抖音: 【作者名的作品】标题文字
  const dy = before.match(/【(.+?)的作品】\s*(.+)/);
  if (dy) return { authorHint: dy[1].trim(), titleHint: dy[2].trim() };

  // B站: 【视频标题】UP主名
  const bk = before.match(/【(.+?)】/);
  if (bk) return { titleHint: bk[1].trim(), authorHint: "" };

  // Strip trailing separators / author handles
  let hint = before
    .replace(/[@\s]+$/g, "")
    .replace(/[-–—:|｜]+\s*$/g, "")
    .trim();

  // Remove common sharing prefixes
  hint = hint.replace(/^\d+\s*/, "").trim();

  if (hint.length < 3) return { titleHint: "", authorHint: "" };
  return { titleHint: hint.slice(0, 150), authorHint: "" };
}

export default function AddVideoModal({ open, onClose, onAdded }: Props) {
  // ── Single mode ──
  const [url, setUrl] = useState("");
  const [title, setTitle] = useState("");
  const [author, setAuthor] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  // ── Batch mode ──
  const [batchMode, setBatchMode] = useState(false);
  const [batchUrls, setBatchUrls] = useState("");
  const [batchResults, setBatchResults] = useState<BatchResult[] | null>(null);
  const [pendingQuality, setPendingQuality] = useState<{ quality: VideoQuality; preview: { title: string; platform: string; sourceAuthor: string } } | null>(null);
  const prevTitleHint = useRef("");
  const prevAuthorHint = useRef("");
  const { toast } = useToast();

  // Detect platform + extract hints
  const { detected, titleHint, authorHint, cleanUrl } = useMemo(() => {
    const raw = url.trim();
    if (!raw) return { detected: null, titleHint: "", authorHint: "", cleanUrl: "" };
    const m = raw.match(/https?:\/\/[^\s⺀-鿿　-〿＀-￯]+/i);
    const cu = m ? m[0] : raw;
    const info = m ? extractInfo(raw) : { titleHint: "", authorHint: "" };
    return {
      detected: parseVideoUrl(cu),
      titleHint: info.titleHint,
      authorHint: info.authorHint,
      cleanUrl: cu,
    };
  }, [url]);

  const isDouyin = detected?.platform === "douyin" || detected?.platform === "douyin_short";
  const canAutoDetect = detected && !isDouyin;
  const isDouyinBareUrl = isDouyin && !titleHint;

  // Auto-fill title from hint (don't overwrite manual edits)
  useEffect(() => {
    if (!titleHint || prevTitleHint.current === titleHint) return;
    setTitle((current) => (!current || current === prevTitleHint.current ? titleHint : current));
    prevTitleHint.current = titleHint;
  }, [titleHint]);

  // Auto-fill author from hint
  useEffect(() => {
    if (!authorHint || prevAuthorHint.current === authorHint) return;
    setAuthor((current) => (!current || current === prevAuthorHint.current ? authorHint : current));
    prevAuthorHint.current = authorHint;
  }, [authorHint]);

  async function handleBatchSubmit() {
    const lines = batchUrls
      .split("\n")
      .map((l) => l.trim())
      .filter((l) => l.length > 0 && (l.startsWith("http") || l.includes("http")));
    if (lines.length === 0) { setError("请粘贴至少一条视频链接"); return; }
    if (lines.length > 20) { setError("单次最多导入 20 条链接"); return; }

    setLoading(true);
    setError("");
    setPendingQuality(null);
    setBatchResults(null);
    try {
      const data = await api<{
        results: BatchResult[];
        imported: number; existed: number; failed: number; needsConfirmation?: number;
      }>("/api/videos/batch", {
        method: "POST",
        body: JSON.stringify({ urls: lines }),
      });
      setBatchResults(data.results);
      if (data.imported > 0) toast(`成功导入 ${data.imported} 个视频`, "success");
      if (data.existed > 0) toast(`${data.existed} 个视频已存在`, "info");
      if (data.failed > 0) toast(`${data.failed} 个导入失败`, "error");
      if ((data.needsConfirmation || 0) > 0) toast(`${data.needsConfirmation} 个疑似非运动内容需单条确认`, "info");
      // Fire onAdded for each successfully imported/existing video
      for (const r of data.results) {
        if (r.status !== "failed" && r.video) {
          onAdded(r.video, r.status === "existed");
        }
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : "批量导入失败";
      setError(msg);
      toast(msg, "error");
    } finally {
      setLoading(false);
    }
  }

  if (!open) return null;

  async function submitSingle(confirmQuality = false) {
    if (!url.trim()) return;
    if (isDouyin && !title.trim()) {
      setError("抖音视频请填写标题");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const data = await api<ImportResponse>("/api/videos", {
        method: "POST",
        body: JSON.stringify({ url: cleanUrl, title: title.trim() || undefined, author: author.trim() || undefined, confirmQuality }),
      });
      if (data.requiresConfirmation) {
        setPendingQuality({ quality: data.quality, preview: data.preview });
        setLoading(false);
        return;
      }
      if (data.existed) {
        posthog.capture("video_imported", { platform: data.video.platform, existed: true });
        onAdded(data.video, true);
        toast("该视频已存在，已加入你的收藏", "info");
      } else {
        posthog.capture("video_imported", { platform: data.video.platform, existed: false, quality_level: data.quality?.level });
        onAdded(data.video, false);
        toast(data.quality?.level === "medium" ? "已导入，标签待确认" : "导入成功", "success");
      }
      setUrl("");
      setTitle("");
      setAuthor("");
      setPendingQuality(null);
      onClose();
    } catch (e) {
      const msg = e instanceof Error ? e.message : "网络错误，请重试";
      setError(msg);
      toast(msg, "error");
    } finally {
      setLoading(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    await submitSingle(false);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-[var(--color-surface)] rounded-[20px] shadow-[var(--shadow-xl)] w-full max-w-md mx-4 p-6 animate-fade-up">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-[17px] font-semibold tracking-[-0.005em]">导入视频</h2>
          <button onClick={onClose} className="w-7 h-7 flex items-center justify-center rounded-full hover:bg-[var(--color-surface-secondary)] transition-colors text-[var(--color-text-secondary)]">
            <svg className="w-4 h-4" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
            </svg>
          </button>
        </div>

        {/* ── Mode toggle ── */}
        <div className="flex items-center gap-2 mb-4">
          <button
            type="button"
            onClick={() => { setBatchMode(false); setError(""); setBatchResults(null); }}
            className={`px-3 py-1.5 text-[13px] font-medium rounded-full transition-colors ${!batchMode ? "bg-[#3b73ff] text-white" : "bg-[var(--color-surface-secondary)] text-[var(--color-text-secondary)]"}`}
          >
            单条导入
          </button>
          <button
            type="button"
            onClick={() => { setBatchMode(true); setError(""); }}
            className={`px-3 py-1.5 text-[13px] font-medium rounded-full transition-colors ${batchMode ? "bg-[#3b73ff] text-white" : "bg-[var(--color-surface-secondary)] text-[var(--color-text-secondary)]"}`}
          >
            批量导入
          </button>
        </div>

        {batchMode ? (
          <>
            <label className="block text-[13px] text-[var(--color-text-secondary)] mb-2">
              每行粘贴一条 B站 / 小红书 / 抖音链接，最多 20 条
            </label>
            <textarea
              value={batchUrls}
              onChange={(e) => { setBatchUrls(e.target.value); setError(""); setBatchResults(null); }}
              placeholder={`https://www.bilibili.com/video/BV1xx411c7mD\nhttps://www.bilibili.com/video/BV1xx411c7mE\nhttps://www.xiaohongshu.com/explore/...`}
              rows={6}
              className="w-full px-4 py-3 text-[14px] bg-[var(--color-surface-secondary)] text-[var(--color-text-primary)] placeholder:text-[var(--color-text-tertiary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-brand)]/20 focus:border-[var(--color-brand)] transition-all resize-none"
              style={{ borderRadius: "var(--radius-sm)", border: "1px solid var(--color-border)" }}
              autoFocus
              disabled={loading}
            />

            {/* Batch results */}
            {batchResults && (
              <div className="mt-3 max-h-40 overflow-auto rounded-xl bg-[var(--color-surface-secondary)] p-3 space-y-1">
                {batchResults.map((r, i) => (
                  <div key={i} className="flex items-center gap-2 text-[12px]">
                    <span className={`shrink-0 w-4 h-4 rounded-full flex items-center justify-center text-[10px] font-bold ${
                      r.status === "imported" ? "bg-[#e8f8ed] text-[#1d7a3f]" :
                      r.status === "existed" ? "bg-[var(--color-brand-subtle)] text-[var(--color-brand)]" :
                      r.status === "needs_confirmation" ? "bg-[#fff7d6] text-[#9a5b00]" :
                      "bg-[#ffeaea] text-[var(--color-error)]"
                    }`}>
                      {r.status === "imported" ? "✓" : r.status === "existed" ? "=" : r.status === "needs_confirmation" ? "!" : "✗"}
                    </span>
                    <span className="truncate flex-1 text-[var(--color-text-secondary)]">
                      {r.video ? r.video.title : r.url.slice(0, 60)}
                    </span>
                    <span className={`shrink-0 text-[11px] font-medium ${
                      r.status === "imported" ? "text-[#1d7a3f]" :
                      r.status === "existed" ? "text-[var(--color-brand)]" :
                      r.status === "needs_confirmation" ? "text-[#9a5b00]" :
                      "text-[var(--color-error)]"
                    }`}>
                      {r.status === "imported" ? "已导入" : r.status === "existed" ? "已存在" : r.status === "needs_confirmation" ? "需确认" : r.error || "失败"}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </>
        ) : (
          <form onSubmit={handleSubmit}>
            <label className="block text-[13px] text-[var(--color-text-secondary)] mb-2">
              粘贴 B站 / 小红书 / 抖音的视频链接（可直接粘贴分享文本）
            </label>
            <input
              type="text"
              value={url}
              onChange={(e) => { setUrl(e.target.value); setError(""); setPendingQuality(null); }}
              placeholder="粘贴链接或分享文本..."
              className="w-full h-11 px-4 text-[14px] bg-[var(--color-surface-secondary)] text-[var(--color-text-primary)] placeholder:text-[var(--color-text-tertiary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-brand)]/20 focus:border-[var(--color-brand)] transition-all"
              style={{ borderRadius: "var(--radius-sm)", border: "1px solid var(--color-border)" }}
              autoFocus
              disabled={loading}
            />

            {isDouyin ? (
            <>
              <label className="block text-[13px] text-[var(--color-text-secondary)] mt-3 mb-2">
                视频标题 <span className="text-[var(--color-error)]">*</span>
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => { setTitle(e.target.value); setError(""); setPendingQuality(null); }}
                placeholder={isDouyinBareUrl ? "纯链接，请手动填写标题" : "可修改自动识别的标题"}
                className="w-full h-11 px-4 text-[14px] bg-[var(--color-surface-secondary)] text-[var(--color-text-primary)] placeholder:text-[var(--color-text-tertiary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-brand)]/20 focus:border-[var(--color-brand)] transition-all"
                style={{ borderRadius: "var(--radius-sm)", border: "1px solid var(--color-border)" }}
                disabled={loading}
              />
              <label className="block text-[13px] text-[var(--color-text-secondary)] mt-3 mb-2">
                作者 / 来源
              </label>
              <input
                type="text"
                value={author}
                onChange={(e) => { setAuthor(e.target.value); setError(""); setPendingQuality(null); }}
                placeholder={authorHint ? "可修改自动识别的作者" : "选填，如识别不到可手动填"}
                className="w-full h-11 px-4 text-[14px] bg-[var(--color-surface-secondary)] text-[var(--color-text-primary)] placeholder:text-[var(--color-text-tertiary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-brand)]/20 focus:border-[var(--color-brand)] transition-all"
                style={{ borderRadius: "var(--radius-sm)", border: "1px solid var(--color-border)" }}
                disabled={loading}
              />
            </>
          ) : canAutoDetect ? (
            <p className="mt-3 text-[12px] text-[var(--color-text-tertiary)]">
              标题和作者将自动识别，无需手动填写
            </p>
          ) : (
            <>
              <label className="block text-[13px] text-[var(--color-text-secondary)] mt-3 mb-2">
                视频标题（选填）
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => { setTitle(e.target.value); setError(""); setPendingQuality(null); }}
                placeholder="例如：30分钟全身燃脂 HIIT"
                className="w-full h-11 px-4 text-[14px] bg-[var(--color-surface-secondary)] text-[var(--color-text-primary)] placeholder:text-[var(--color-text-tertiary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-brand)]/20 focus:border-[var(--color-brand)] transition-all"
                style={{ borderRadius: "var(--radius-sm)", border: "1px solid var(--color-border)" }}
                disabled={loading}
              />
            </>
          )}

          {pendingQuality && (
            <div className="mt-4 rounded-2xl bg-[#fff7d6] px-4 py-3 text-[13px] text-[#7a4b00] shadow-[0_8px_18px_rgba(255,214,107,0.12)]">
              <div className="flex items-start gap-2">
                <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#ffd66b]/60 text-[12px] font-bold">!</span>
                <div className="min-w-0">
                  <p className="font-semibold">这条视频可能不是运动教程</p>
                  <p className="mt-1 truncate text-[#8a5a0a]">{pendingQuality.preview.title}</p>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {pendingQuality.quality.reasons.slice(0, 3).map((reason) => (
                      <span key={reason} className="rounded-full bg-white/60 px-2 py-1 text-[11px] text-[#8a5a0a]">
                        {reason}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
              <div className="mt-3 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setPendingQuality(null)}
                  className="rounded-full bg-white/70 px-3 py-1.5 text-[12px] font-medium text-[#7a4b00] hover:bg-white"
                >
                  返回修改
                </button>
                <button
                  type="button"
                  onClick={() => submitSingle(true)}
                  disabled={loading}
                  className="rounded-full bg-[#FF5E32] px-3 py-1.5 text-[12px] font-semibold text-white hover:bg-[#e94f27] disabled:opacity-50"
                >
                  仍然导入
                </button>
              </div>
            </div>
          )}

          {error && (
            <p className="mt-2 text-[12px] text-[var(--color-error)]">{error}</p>
          )}

          <div className="mt-4 flex justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-[14px] text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] transition-colors"
            >
              取消
            </button>
            <button
              type="submit"
              disabled={loading || !!pendingQuality || !url.trim() || (isDouyin && !title.trim())}
              className="px-5 py-2 bg-[#3b73ff] text-white rounded-full text-[14px] font-medium hover:bg-[#2f64e8] active:scale-[0.97] disabled:opacity-40 transition-all"
            >
              {loading ? "导入中..." : "导入视频"}
            </button>
          </div>
        </form>
        )}

        {/* Batch mode controls — outside the single form */}
        {batchMode && (
          <>
            {error && (
              <p className="mt-2 text-[12px] text-[var(--color-error)]">{error}</p>
            )}
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-[14px] text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] transition-colors"
              >
                取消
              </button>
              <button
                type="button"
                onClick={handleBatchSubmit}
                disabled={loading || !batchUrls.trim()}
                className="px-5 py-2 bg-[#3b73ff] text-white rounded-full text-[14px] font-medium hover:bg-[#2f64e8] active:scale-[0.97] disabled:opacity-40 transition-all"
              >
                {loading ? "导入中..." : batchResults ? "重新导入" : `导入 ${batchUrls.split("\n").filter((l) => l.trim().length > 0 && (l.startsWith("http") || l.includes("http"))).length || 0} 个视频`}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
