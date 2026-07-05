"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { useToast } from "./Toast";

const GOAL_OPTIONS = [
  { value: "减脂", label: "减脂" },
  { value: "增肌", label: "增肌" },
  { value: "康复", label: "康复" },
  { value: "体能提升", label: "体能提升" },
  { value: "柔韧性", label: "柔韧性" },
];

const TIME_OPTIONS = [
  { value: "15", label: "15 分钟" },
  { value: "30", label: "30 分钟" },
  { value: "60", label: "60 分钟" },
];

const BODY_OPTIONS = [
  { value: "膝盖不适", label: "膝盖不适" },
  { value: "腰椎问题", label: "腰椎问题" },
  { value: "产后恢复", label: "产后恢复" },
  { value: "无特殊限制", label: "无特殊限制" },
];

export default function QuickStartCard() {
  const router = useRouter();
  const { toast } = useToast();
  const [step, setStep] = useState(0); // 0: goal, 1: time, 2: body, 3: saving
  const [goal, setGoal] = useState("");
  const [time, setTime] = useState("30");
  const [body, setBody] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  function toggleBody(b: string) {
    if (b === "无特殊限制") {
      setBody(["无特殊限制"]);
    } else {
      const filtered = body.filter((x) => x !== "无特殊限制");
      if (filtered.includes(b)) {
        setBody(filtered.filter((x) => x !== b));
      } else {
        setBody([...filtered, b]);
      }
    }
  }

  async function handleSubmit() {
    setSaving(true);
    const bodyConditions = body.includes("无特殊限制") ? [] : body;

    try {
      await api("/api/profile", {
        method: "POST",
        body: JSON.stringify({
          goals: [goal],
          availableTime: time,
          bodyConditions,
          fitnessLevel: "beginner",
          equipment: ["无器材"],
          contraindications: [],
        }),
      });
      toast("画像已设置，正在生成今日训练方案", "success");
      router.refresh();
    } catch (e) {
      toast(e instanceof Error ? e.message : "保存失败，请稍后重试", "error");
    } finally {
      setSaving(false);
    }
  }

  if (saving) {
    return (
      <section className="max-w-[980px] mx-auto px-6 py-12">
        <div className="bg-[var(--color-surface)] p-12 text-center" style={{ border: "0.5px solid var(--color-border)", borderRadius: "var(--radius-lg)" }}>
          <div className="w-12 h-12 rounded-full bg-[var(--color-brand-subtle)] flex items-center justify-center mx-auto mb-4">
            <svg className="w-6 h-6 text-[var(--color-brand)] animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10" strokeDasharray="32" strokeDashoffset="32" />
            </svg>
          </div>
          <h2 className="text-[20px] font-semibold mb-2">正在生成你的今日训练方案</h2>
          <p className="text-[14px] text-[var(--color-text-secondary)]">根据你的选择匹配最适合的训练内容</p>
        </div>
      </section>
    );
  }

  return (
    <section className="max-w-[980px] mx-auto px-6 py-12">
      <div className="bg-[var(--color-surface)] p-8" style={{ border: "0.5px solid var(--color-border)", borderRadius: "var(--radius-lg)" }}>
        {/* Progress indicator */}
        <div className="flex items-center gap-2 mb-8">
          {[0, 1, 2].map((s) => (
            <div
              key={s}
              className={`h-1 flex-1 rounded-full transition-colors ${
                step > s ? "bg-[#3b73ff]" : step === s ? "bg-[#3b73ff]" : "bg-[var(--color-surface-secondary)]"
              }`}
            />
          ))}
        </div>

        {/* Step 0: Goal */}
        {step === 0 && (
          <div>
            <p className="text-[11px] text-[var(--color-text-tertiary)] font-medium tracking-widest uppercase mb-1">第 1 步 / 共 3 步</p>
            <h2 className="text-[22px] font-semibold mb-2">今天想练什么？</h2>
            <p className="text-[14px] text-[var(--color-text-secondary)] mb-6">选一个你最想专注的方向</p>
            <div className="flex flex-wrap gap-2 mb-8">
              {GOAL_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => { setGoal(opt.value); setStep(1); }}
                  className={`inline-flex items-center gap-2 px-5 py-3 text-[14px] font-medium rounded-full transition-all active:scale-[0.97] ${
                    goal === opt.value
                      ? "bg-[#3b73ff] text-white"
                      : "bg-[var(--color-surface-secondary)] text-[var(--color-text-primary)] hover:bg-[var(--color-brand-subtle)]"
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
            <button
              onClick={() => setStep(1)}
              className="px-5 py-2.5 text-[13px] text-[var(--color-text-tertiary)] hover:text-[var(--color-text-secondary)]"
            >
              跳过 →
            </button>
          </div>
        )}

        {/* Step 1: Time */}
        {step === 1 && (
          <div>
            <p className="text-[11px] text-[var(--color-text-tertiary)] font-medium tracking-widest uppercase mb-1">第 2 步 / 共 3 步</p>
            <h2 className="text-[22px] font-semibold mb-2">今天有多久？</h2>
            <p className="text-[14px] text-[var(--color-text-secondary)] mb-6">选一个你有的空档时长</p>
            <div className="flex gap-3 mb-8">
              {TIME_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => { setTime(opt.value); setStep(2); }}
                  className={`px-6 py-4 text-[15px] font-medium rounded-full transition-all active:scale-[0.97] ${
                    time === opt.value
                      ? "bg-[#3b73ff] text-white"
                      : "bg-[var(--color-surface-secondary)] text-[var(--color-text-primary)] hover:bg-[var(--color-brand-subtle)]"
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
            <button
              onClick={() => setStep(2)}
              className="px-5 py-2.5 text-[13px] text-[var(--color-text-tertiary)] hover:text-[var(--color-text-secondary)]"
            >
              跳过 →
            </button>
            <button
              onClick={() => setStep(0)}
              className="px-5 py-2.5 text-[13px] text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]"
            >
              ← 返回
            </button>
          </div>
        )}

        {/* Step 2: Body */}
        {step === 2 && (
          <div>
            <p className="text-[11px] text-[var(--color-text-tertiary)] font-medium tracking-widest uppercase mb-1">第 3 步 / 共 3 步</p>
            <h2 className="text-[22px] font-semibold mb-2">有没有身体限制？</h2>
            <p className="text-[14px] text-[var(--color-text-secondary)] mb-6">系统会避开不适合你的动作（可多选）</p>
            <div className="flex flex-wrap gap-2 mb-8">
              {BODY_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => toggleBody(opt.value)}
                  className={`px-5 py-3 text-[14px] font-medium rounded-full transition-all active:scale-[0.97] ${
                    body.includes(opt.value)
                      ? "bg-[#3b73ff] text-white"
                      : "bg-[var(--color-surface-secondary)] text-[var(--color-text-primary)] hover:bg-[var(--color-brand-subtle)]"
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={handleSubmit}
                className="px-6 py-3 text-[15px] font-medium bg-[#3b73ff] hover:bg-[#2f64e8] active:bg-[#2952c4] text-white rounded-full transition-all active:scale-[0.97]"
              >
                生成今日方案
              </button>
              <button
                onClick={() => setStep(1)}
                className="px-5 py-2.5 text-[13px] text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]"
              >
                ← 返回
              </button>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
