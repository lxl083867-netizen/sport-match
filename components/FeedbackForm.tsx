"use client";

import { useState } from "react";
import TagBadge from "./TagBadge";
import { api } from "@/lib/api";
import { useToast } from "./Toast";

interface FeedbackFormProps {
  videoId: string;
  existingFeedback?: {
    difficultyRating: string;
    bodyFeeling: string | null;
    completionRate: string;
    recommend: boolean;
    notes: string | null;
  } | null;
}

const difficultyOptions = [
  { v: "too_easy", l: "太简单" },
  { v: "just_right", l: "刚好" },
  { v: "too_hard", l: "太难" },
];

const bodyFeelingOptions = [
  { v: "no_discomfort", l: "无不适" },
  { v: "knee_pain", l: "膝盖不适" },
  { v: "back_pain", l: "腰部不适" },
  { v: "shoulder_pain", l: "肩部不适" },
];

const completionOptions = [
  { v: "fully", l: "完整跟完" },
  { v: "partial", l: "部分完成" },
  { v: "abandoned", l: "中途放弃" },
];

function labelOf(options: Array<{ v: string; l: string }>, value: string | null): string | null {
  return options.find((item) => item.v === value)?.l || null;
}

function nextAdjustment(difficulty: string, completion: string, recommend: boolean, bodyFeeling: string): string {
  if (completion === "abandoned") return "下次会降低相似内容权重，优先安排更容易完成的训练。";
  if (difficulty === "too_hard") return "下次会减少高强度和超长内容，优先选择更稳的训练。";
  if (difficulty === "too_easy") return "下次会适当提高主训练强度，减少过低门槛内容。";
  if (bodyFeeling && bodyFeeling !== "no_discomfort") return "下次会避开可能加重不适的相似动作。";
  if (!recommend) return "下次会减少相似视频出现，换成更匹配你偏好的内容。";
  return "下次会优先保留类似强度和节奏的训练。";
}

export default function FeedbackForm({ videoId, existingFeedback }: FeedbackFormProps) {
  const [difficulty, setDifficulty] = useState(existingFeedback?.difficultyRating || "");
  const [bodyFeeling, setBodyFeeling] = useState(existingFeedback?.bodyFeeling || "");
  const [completion, setCompletion] = useState(existingFeedback?.completionRate || "");
  const [recommend, setRecommend] = useState<boolean | null>(
    existingFeedback ? existingFeedback.recommend : null
  );
  const [notes, setNotes] = useState(existingFeedback?.notes || "");
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const { toast } = useToast();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!difficulty || !completion || recommend === null) return;
    setSubmitting(true);
    try {
      await api("/api/feedback", {
        method: "POST",
        body: JSON.stringify({
          videoId,
          difficultyRating: difficulty,
          bodyFeeling: bodyFeeling || null,
          completionRate: completion,
          recommend,
          notes: notes || null,
        }),
      });
      toast("反馈已记录", "success");
      setSuccess(true);
    } catch (e) {
      toast(e instanceof Error ? e.message : "提交失败，请稍后重试", "error");
    } finally {
      setSubmitting(false);
    }
  }

  const feedbackSummary = [
    labelOf(difficultyOptions, difficulty),
    bodyFeeling ? labelOf(bodyFeelingOptions, bodyFeeling) : null,
    labelOf(completionOptions, completion),
    recommend === null ? null : recommend ? "推荐" : "不推荐",
  ].filter(Boolean);

  if (success) {
    return (
      <div className="rounded-[20px] bg-[var(--color-surface)] p-6 shadow-[0_8px_24px_rgba(149,157,165,0.08)]">
        <p className="text-[17px] font-semibold text-[var(--color-text-primary)]">反馈已记录</p>
        <div className="mt-3 flex flex-wrap gap-2">
          {feedbackSummary.map((item) => (
            <span key={item} className="rounded-full bg-[var(--color-surface-secondary)] px-3 py-1.5 text-[12px] font-medium text-[var(--color-text-secondary)]">
              {item}
            </span>
          ))}
        </div>
        <p className="mt-4 text-[14px] leading-relaxed text-[var(--color-text-secondary)]">
          {nextAdjustment(difficulty, completion, recommend ?? true, bodyFeeling)}
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5 rounded-[20px] bg-[var(--color-surface)] p-6 shadow-[0_8px_24px_rgba(149,157,165,0.08)]">
      <h3 className="text-[17px] font-semibold">{existingFeedback ? "更新反馈" : "跟练后反馈"}</h3>

      <div>
        <p className="mb-2 text-[13px] text-[var(--color-text-secondary)]">难度感知</p>
        <div className="flex gap-2">
          {difficultyOptions.map((o) => (
            <TagBadge key={o.v} label={o.l} selected={difficulty === o.v} color="blue" onClick={() => setDifficulty(o.v)} />
          ))}
        </div>
      </div>

      <div>
        <p className="mb-2 text-[13px] text-[var(--color-text-secondary)]">身体感受</p>
        <div className="flex flex-wrap gap-2">
          {bodyFeelingOptions.map((o) => (
            <TagBadge key={o.v} label={o.l} selected={bodyFeeling === o.v} color="orange" onClick={() => setBodyFeeling(o.v === bodyFeeling ? "" : o.v)} />
          ))}
        </div>
      </div>

      <div>
        <p className="mb-2 text-[13px] text-[var(--color-text-secondary)]">完成度</p>
        <div className="flex gap-2">
          {completionOptions.map((o) => (
            <TagBadge key={o.v} label={o.l} selected={completion === o.v} color="green" onClick={() => setCompletion(o.v)} />
          ))}
        </div>
      </div>

      <div>
        <p className="mb-2 text-[13px] text-[var(--color-text-secondary)]">是否推荐这个视频？</p>
        <div className="flex gap-2">
          <TagBadge label="推荐" selected={recommend === true} color="green" onClick={() => setRecommend(true)} />
          <TagBadge label="不推荐" selected={recommend === false} color="gray" onClick={() => setRecommend(false)} />
        </div>
      </div>

      <textarea
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        placeholder="补充评价（可选）"
        rows={3}
        className="w-full resize-none rounded-2xl bg-[var(--color-surface-secondary)] px-4 py-3 text-[14px] text-[var(--color-text-primary)] placeholder:text-[var(--color-text-tertiary)] outline-none transition-colors"
      />

      <button
        type="submit"
        disabled={submitting || !difficulty || !completion || recommend === null}
        className="w-full rounded-full bg-[#3b73ff] py-3 text-[15px] font-medium text-white transition-colors hover:bg-[#2f64e8] active:scale-[0.97] active:bg-[#2952c4] disabled:opacity-30"
      >
        {submitting ? "提交中..." : existingFeedback ? "更新反馈" : "提交反馈"}
      </button>
    </form>
  );
}
