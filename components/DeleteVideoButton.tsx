"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import ConfirmDialog from "./ConfirmDialog";
import { api } from "@/lib/api";
import { useToast } from "./Toast";

interface Props {
  videoId: string;
  isImported: boolean;
}

export default function DeleteVideoButton({ videoId, isImported }: Props) {
  const [showConfirm, setShowConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState("");
  const router = useRouter();
  const { toast } = useToast();

  if (!isImported) return null;

  async function handleDelete() {
    setDeleting(true);
    setError("");
    try {
      await api(`/api/videos/${videoId}`, { method: "DELETE" });
      router.refresh();
      setShowConfirm(false);
      toast("已从收藏中移除", "success");
    } catch (e) {
      const msg = e instanceof Error ? e.message : "移除失败";
      setError(msg);
      toast(msg, "error");
      setShowConfirm(false);
    } finally {
      setDeleting(false);
    }
  }

  return (
    <>
      <button
        onClick={() => setShowConfirm(true)}
        className="text-[12px] text-[var(--color-text-tertiary)] hover:text-[var(--color-error)] transition-colors"
      >
        从收藏中移除
      </button>

      {error && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl px-5 py-3 shadow-[var(--shadow-lg)] text-[13px] text-[var(--color-error)] max-w-sm text-center">
          {error}
          <button onClick={() => setError("")} className="ml-3 text-[var(--color-text-tertiary)] hover:text-[var(--color-text-primary)]">✕</button>
        </div>
      )}

      <ConfirmDialog
        open={showConfirm}
        title="从收藏中移除"
        message="确定要从收藏中移除这个视频吗？不会影响其他用户的训练计划。"
        confirmLabel={deleting ? "移除中..." : "确认移除"}
        danger
        onConfirm={handleDelete}
        onCancel={() => setShowConfirm(false)}
      />
    </>
  );
}
