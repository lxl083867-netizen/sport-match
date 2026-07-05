"use client";

import { useState } from "react";
import { api } from "@/lib/api";
import { useToast } from "./Toast";

interface CheckInButtonProps {
  videoId: string;
  initialRecentCount: number;
  initialTotalCount: number;
  userId: string | null;
}

export default function CheckInButton({ videoId, initialRecentCount, initialTotalCount, userId }: CheckInButtonProps) {
  const [recentCount, setRecentCount] = useState(initialRecentCount);
  const [totalCount, setTotalCount] = useState(initialTotalCount);
  const [loading, setLoading] = useState(false);
  const [checkedIn, setCheckedIn] = useState(false);
  const { toast } = useToast();

  async function handleCheckIn() {
    if (!userId || loading) return;
    setLoading(true);
    try {
      const data = await api<{ recentCount: number; totalCount: number }>("/api/checkin", {
        method: "POST",
        body: JSON.stringify({ videoId }),
      });
      setRecentCount(data.recentCount);
      setTotalCount(data.totalCount);
      setCheckedIn(true);
      toast("已完成跟练打卡", "success");
      setTimeout(() => setCheckedIn(false), 1500);
    } catch {
      toast("打卡失败，请稍后重试", "error");
    } finally {
      setLoading(false);
    }
  }

  if (!userId) return null;

  return (
    <div className="flex items-center gap-4">
      <div className="flex items-center gap-3 text-[13px] text-[var(--color-text-secondary)]">
        <div className="flex items-center gap-1">
          <span className="text-[11px] text-[var(--color-text-tertiary)]">近7天</span>
          <span className="font-semibold text-[var(--color-brand)]">{recentCount}</span>
          <span className="text-[11px] text-[var(--color-text-tertiary)]">次</span>
        </div>
        <span className="text-[var(--color-border)]">|</span>
        <div className="flex items-center gap-1">
          <span className="text-[11px] text-[var(--color-text-tertiary)]">累计</span>
          <span className="font-semibold text-[var(--color-text-primary)]">{totalCount}</span>
          <span className="text-[11px] text-[var(--color-text-tertiary)]">次</span>
        </div>
      </div>

      <button
        onClick={handleCheckIn}
        disabled={loading || checkedIn}
        className={`px-4 py-2 text-[13px] font-medium transition-all active:scale-[0.97] ${
          checkedIn
            ? "bg-[#e8f8ed] text-[#1d7a3f]"
            : "bg-[#3b73ff] text-white hover:bg-[#2f64e8] disabled:opacity-30"
        }`}
        style={{ borderRadius: "var(--radius-md)" }}
      >
        {checkedIn ? "已记录" : loading ? "..." : "完成跟练"}
      </button>
    </div>
  );
}
