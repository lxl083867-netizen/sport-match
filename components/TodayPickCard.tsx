"use client";

import { useState } from "react";
import Link from "next/link";
import TagBadge from "./TagBadge";
import VideoThumbnail from "./VideoThumbnail";
import { PlatformLabel } from "./PlatformLogo";
import { prioritizeTags, categoryColorMap, type FitnessLevel } from "@/lib/tag-display";

interface Props {
  id: string;
  title: string;
  platform: string;
  duration: number | null;
  sourceAuthor: string;
  tags: Array<{ name: string; category: string; nameZh: string; confidence?: number }>;
  matchScore?: number;
  matchReasons?: string[];
  fitnessLevel: FitnessLevel | null;
}

type FeedbackState = "none" | "liked" | "disliked" | "writing";

export default function TodayPickCard({
  id, title, platform, duration, sourceAuthor, tags,
  matchScore, matchReasons, fitnessLevel,
}: Props) {
  const [feedback, setFeedback] = useState<FeedbackState>("none");
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const displayTags = prioritizeTags(tags, fitnessLevel, 3);
  const color = (cat: string) => categoryColorMap[cat] || "default";

  async function handleFeedback(liked: boolean) {
    if (liked) {
      setFeedback("liked");
      setSubmitting(true);
      await fetch("/api/recommend/today", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ videoId: id, liked: true }),
      });
      setSubmitting(false);
    } else {
      setFeedback("writing");
    }
  }

  async function submitReason() {
    setSubmitting(true);
    await fetch("/api/recommend/today", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ videoId: id, liked: false, reason: reason || null }),
    });
    setSubmitting(false);
    setFeedback("disliked");
  }

  return (
    <div className="group block bg-[var(--color-surface)] overflow-hidden hover:shadow-[var(--shadow-sm)] hover:-translate-y-0.5 transition-all border border-[var(--color-border)] rounded-xl">
      <Link href={`/videos/${id}`}>
        <VideoThumbnail title={title} platform={platform} duration={duration} size="md" />

        <div className="p-4">
          <div className="flex items-start justify-between gap-2 mb-2">
            <h3 className="text-[15px] font-semibold leading-snug text-[var(--color-text-primary)] line-clamp-2">
              {title}
            </h3>
            {matchScore !== undefined && (
              <span className="shrink-0 text-[11px] font-semibold bg-[var(--color-brand-subtle)] text-[var(--color-brand)] px-2 py-0.5 rounded-full">
                {matchScore}%
              </span>
            )}
          </div>

          <div className="flex items-center gap-2 mb-2">
            <PlatformLabel platform={platform} />
            <span className="text-[12px] text-[var(--color-text-tertiary)]">@{sourceAuthor}</span>
          </div>

          <div className="flex flex-wrap gap-1">
            {displayTags.map((t) => (
              <TagBadge key={t.name} label={t.displayLabel} size="sm" color={color(t.category)} />
            ))}
          </div>

          {matchReasons && matchReasons.length > 0 && (
            <div className="mt-2 pt-2 space-y-0.5" style={{ borderTop: "0.5px solid var(--color-border)" }}>
              {matchReasons.slice(0, 2).map((r, i) => (
                <p key={i} className="text-[11px] text-[var(--color-brand)]">{r}</p>
              ))}
            </div>
          )}
        </div>
      </Link>

      {/* ── Feedback bar ── */}
      <div className="px-4 pb-3" onClick={(e) => e.preventDefault()}>
        {feedback === "none" && (
          <div className="flex items-center gap-2 pt-2" style={{ borderTop: "0.5px solid var(--color-border)" }}>
            <span className="text-[11px] text-[var(--color-text-tertiary)] mr-1">符合心意？</span>
            <button
              onClick={() => handleFeedback(true)}
              disabled={submitting}
              className="flex items-center gap-1 px-2.5 py-1 rounded-full text-[12px] bg-[#e8f8ed] text-[#1d7a3f] hover:bg-[#d0f0d8] transition-colors"
            >
              <svg className="w-3.5 h-3.5" viewBox="0 0 20 20" fill="currentColor">
                <path d="M2 10.5a1.5 1.5 0 113 0v6a1.5 1.5 0 01-3 0v-6zM6 10.333v5.43a2 2 0 001.106 1.79l.05.025A4 4 0 008.943 18h5.416a2 2 0 001.962-1.608l1.2-6A2 2 0 0015.56 8H12V4a2 2 0 00-2-2 1 1 0 00-1 1v.667a4 4 0 01-.8 2.4L6.8 7.933a4 4 0 00-.8 2.4z" />
              </svg>
              合适
            </button>
            <button
              onClick={() => handleFeedback(false)}
              disabled={submitting}
              className="flex items-center gap-1 px-2.5 py-1 rounded-full text-[12px] bg-[#fde8ec] text-[#b01030] hover:bg-[#fad0d8] transition-colors"
            >
              <svg className="w-3.5 h-3.5 rotate-180" viewBox="0 0 20 20" fill="currentColor">
                <path d="M2 10.5a1.5 1.5 0 113 0v6a1.5 1.5 0 01-3 0v-6zM6 10.333v5.43a2 2 0 001.106 1.79l.05.025A4 4 0 008.943 18h5.416a2 2 0 001.962-1.608l1.2-6A2 2 0 0015.56 8H12V4a2 2 0 00-2-2 1 1 0 00-1 1v.667a4 4 0 01-.8 2.4L6.8 7.933a4 4 0 00-.8 2.4z" />
              </svg>
              不合适
            </button>
          </div>
        )}

        {feedback === "writing" && (
          <div className="pt-2 space-y-2" style={{ borderTop: "0.5px solid var(--color-border)" }}>
            <p className="text-[11px] text-[var(--color-text-secondary)]">哪里不满意？</p>
            <div className="flex gap-2">
              <input
                type="text"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="太简单 / 太难 / 不感兴趣..."
                className="flex-1 px-3 py-1.5 text-[12px] rounded-lg bg-[var(--color-surface-secondary)] border border-[var(--color-border)] text-[var(--color-text-primary)] placeholder:text-[var(--color-text-tertiary)] focus:outline-none focus:border-[var(--color-brand)]"
                onKeyDown={(e) => { if (e.key === "Enter") submitReason(); }}
              />
              <button
                onClick={submitReason}
                disabled={submitting}
                className="px-3 py-1.5 text-[12px] font-medium bg-[#3b73ff] text-white rounded-lg hover:opacity-90 disabled:opacity-40 transition-opacity"
              >
                {submitting ? "..." : "提交"}
              </button>
            </div>
          </div>
        )}

        {feedback === "liked" && (
          <p className="text-[11px] text-[#1d7a3f] pt-2 text-center" style={{ borderTop: "0.5px solid var(--color-border)" }}>
            ✓ 已反馈：合适
          </p>
        )}

        {feedback === "disliked" && (
          <p className="text-[11px] text-[#b01030] pt-2 text-center" style={{ borderTop: "0.5px solid var(--color-border)" }}>
            ✓ 已反馈：不合适{reason ? ` — ${reason}` : ""}
          </p>
        )}
      </div>
    </div>
  );
}
