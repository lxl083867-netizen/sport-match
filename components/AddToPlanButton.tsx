"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";

interface AddToPlanButtonProps {
  videoId: string;
  videoTitle: string;
  userId: string | null;
}

export default function AddToPlanButton({ videoId, videoTitle, userId }: AddToPlanButtonProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [plans, setPlans] = useState<Array<{ id: string; title: string; videoCount: number }>>([]);
  const [loading, setLoading] = useState(false);
  const [adding, setAdding] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open && userId) {
      setLoading(true);
      fetch("/api/plans?my=1&limit=20")
        .then((r) => r.json())
        .then((data) => setPlans(data.plans || []))
        .finally(() => setLoading(false));
    }
  }, [open, userId]);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    if (open) document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  async function addToPlan(planId: string, planTitle: string) {
    setAdding(planId);
    const res = await fetch(`/api/plans/${planId}/add-video`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ videoId }),
    });
    if (res.ok) {
      setDone(planTitle);
      setTimeout(() => {
        setOpen(false);
        setDone(null);
      }, 1200);
    }
    setAdding(null);
  }

  if (!userId) return null;

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="px-4 py-2 text-[13px] font-medium text-[var(--color-text-secondary)] hover:text-[var(--color-brand)] transition-colors active:scale-[0.97]"
        style={{ borderRadius: "var(--radius-md)", border: "0.5px solid var(--color-border)" }}
      >
        {done ? "已添加到「" + done + "」" : "+ 添加到计划"}
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-72 bg-[var(--color-surface)] z-50 overflow-hidden shadow-[var(--shadow-md)]"
          style={{ borderRadius: "var(--radius-lg)", border: "0.5px solid var(--color-border)" }}>
          <div className="p-3" style={{ borderBottom: "0.5px solid var(--color-border)" }}>
            <p className="text-[13px] font-medium text-[var(--color-text-primary)]">添加到训练计划</p>
          </div>

          <div className="max-h-64 overflow-y-auto">
            {loading ? (
              <p className="text-[13px] text-[var(--color-text-tertiary)] text-center py-6">加载中...</p>
            ) : plans.length === 0 ? (
              <div className="p-4 text-center">
                <p className="text-[13px] text-[var(--color-text-tertiary)] mb-3">还没有训练计划</p>
                <button
                  onClick={() => { router.push(`/plans/create?videoId=${videoId}&title=${encodeURIComponent(videoTitle)}`); }}
                  className="text-[13px] font-medium text-[var(--color-brand)] hover:underline"
                >
                  创建第一个计划 →
                </button>
              </div>
            ) : (
              plans.map((plan) => (
                <button
                  key={plan.id}
                  onClick={() => addToPlan(plan.id, plan.title)}
                  disabled={adding === plan.id}
                  className="w-full text-left px-4 py-3 hover:bg-[var(--color-brand-subtle)] transition-colors flex items-center justify-between disabled:opacity-50"
                >
                  <div className="min-w-0">
                    <p className="text-[13px] font-medium text-[var(--color-text-primary)] truncate">{plan.title}</p>
                    <p className="text-[11px] text-[var(--color-text-tertiary)]">{plan.videoCount} 个视频</p>
                  </div>
                  {adding === plan.id && (
                    <span className="text-[11px] text-[var(--color-text-tertiary)] shrink-0 ml-2">添加中...</span>
                  )}
                </button>
              ))
            )}
          </div>

          {plans.length > 0 && (
            <div className="p-2" style={{ borderTop: "0.5px solid var(--color-border)" }}>
              <button
                onClick={() => { router.push(`/plans/create?videoId=${videoId}&title=${encodeURIComponent(videoTitle)}`); }}
                className="w-full text-center py-2 text-[13px] font-medium text-[var(--color-brand)] hover:bg-[var(--color-brand-subtle)] transition-colors"
                style={{ borderRadius: "var(--radius-sm)" }}
              >
                + 创建新计划
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
