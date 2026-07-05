"use client";

import { useState } from "react";
import { api } from "@/lib/api";
import { useToast } from "./Toast";

interface Props {
  open: boolean;
  videoId: string;
  initialTitle: string;
  initialAuthor: string;
  onClose: () => void;
  onSaved: (title: string, author: string) => void;
}

export default function EditVideoModal({ open, videoId, initialTitle, initialAuthor, onClose, onSaved }: Props) {
  const [title, setTitle] = useState(initialTitle);
  const [author, setAuthor] = useState(initialAuthor);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const { toast } = useToast();

  if (!open) return null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    setSaving(true);
    setError("");

    try {
      const data = await api<{ title: string; sourceAuthor: string }>(`/api/videos/${videoId}`, {
        method: "PATCH",
        body: JSON.stringify({ title: title.trim(), sourceAuthor: author.trim() || undefined }),
      });
      onSaved(data.title, data.sourceAuthor);
      toast("视频信息已更新", "success");
      onClose();
    } catch (e) {
      const msg = e instanceof Error ? e.message : "保存失败";
      setError(msg);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-[var(--color-surface)] rounded-[20px] shadow-[var(--shadow-xl)] w-full max-w-md mx-4 p-6 animate-fade-up">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-[17px] font-semibold tracking-[-0.005em]">编辑视频信息</h2>
          <button onClick={onClose} className="w-7 h-7 flex items-center justify-center rounded-full hover:bg-[var(--color-surface-secondary)] transition-colors text-[var(--color-text-secondary)]">
            <svg className="w-4 h-4" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <label className="block text-[13px] text-[var(--color-text-secondary)] mb-2">视频标题</label>
          <input
            type="text"
            value={title}
            onChange={(e) => { setTitle(e.target.value); setError(""); }}
            className="w-full h-11 px-4 text-[14px] bg-[var(--color-surface-secondary)] text-[var(--color-text-primary)] placeholder:text-[var(--color-text-tertiary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-brand)]/20 focus:border-[var(--color-brand)] transition-all"
            style={{ borderRadius: "var(--radius-sm)", border: "1px solid var(--color-border)" }}
            autoFocus
            disabled={saving}
          />

          <label className="block text-[13px] text-[var(--color-text-secondary)] mt-3 mb-2">作者 / 来源</label>
          <input
            type="text"
            value={author}
            onChange={(e) => { setAuthor(e.target.value); setError(""); }}
            className="w-full h-11 px-4 text-[14px] bg-[var(--color-surface-secondary)] text-[var(--color-text-primary)] placeholder:text-[var(--color-text-tertiary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-brand)]/20 focus:border-[var(--color-brand)] transition-all"
            style={{ borderRadius: "var(--radius-sm)", border: "1px solid var(--color-border)" }}
            disabled={saving}
          />

          {error && <p className="mt-2 text-[12px] text-[var(--color-error)]">{error}</p>}

          <div className="mt-4 flex justify-end gap-2">
            <button type="button" onClick={onClose} className="px-4 py-2 text-[14px] text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] transition-colors">
              取消
            </button>
            <button
              type="submit"
              disabled={saving || !title.trim()}
              className="px-5 py-2 bg-[#3b73ff] text-white rounded-full text-[14px] font-medium hover:bg-[#2f64e8] active:scale-[0.97] disabled:opacity-40 transition-all"
            >
              {saving ? "保存中..." : "保存"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
