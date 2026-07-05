"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import TagBadge from "./TagBadge";
import posthog from "posthog-js";
import { api } from "@/lib/api";
import { useToast } from "./Toast";

const STEPS = [
  {
    title: "你的运动目标是什么？",
    subtitle: "可多选，影响推荐内容的优先级",
    field: "goals",
    options: [
      { value: "减脂", color: "orange" as const },
      { value: "增肌", color: "blue" as const },
      { value: "康复", color: "green" as const },
      { value: "体能提升", color: "purple" as const },
      { value: "柔韧性", color: "blue" as const },
    ],
  },
  {
    title: "身体状况和运动经验",
    subtitle: "帮我们筛选适合你身体条件的视频",
    fields: [
      {
        field: "bodyConditions",
        label: "身体状况（可多选）",
        options: [
          { value: "健康", color: "green" as const },
          { value: "办公室久坐", color: "orange" as const },
          { value: "膝部不适", color: "red" as const },
          { value: "腰部不适", color: "red" as const },
          { value: "肩颈不适", color: "red" as const },
          { value: "产后恢复", color: "purple" as const },
          { value: "大基数", color: "orange" as const },
        ],
      },
      {
        field: "fitnessLevel",
        label: "运动经验",
        single: true,
        options: [
          { value: "beginner", label: "零基础 — 刚开始接触运动", color: "green" as const },
          { value: "intermediate", label: "有规律运动 1 年以上", color: "blue" as const },
          { value: "professional", label: "专业/半专业背景", color: "purple" as const },
        ],
      },
    ],
  },
  {
    title: "可用器材和训练时长",
    subtitle: "确保推荐的视频你都有条件完成",
    fields: [
      {
        field: "equipment",
        label: "可用器材（可多选）",
        options: [
          { value: "无器材", color: "green" as const },
          { value: "瑜伽垫", color: "blue" as const },
          { value: "弹力带", color: "purple" as const },
          { value: "哑铃", color: "orange" as const },
        ],
      },
      {
        field: "availableTime",
        label: "单次训练时长",
        single: true,
        options: [
          { value: "15", label: "15 分钟以内", color: "green" as const },
          { value: "30", label: "15-30 分钟", color: "blue" as const },
          { value: "60", label: "30 分钟以上", color: "purple" as const },
        ],
      },
    ],
  },
  {
    title: "有哪些动作需要避免？",
    subtitle: "如有膝盖/腰部问题，系统会自动避开相关训练",
    field: "contraindications",
    options: [
      { value: "不能跳跃", color: "red" as const },
      { value: "不能深蹲", color: "red" as const },
      { value: "不能仰卧", color: "orange" as const },
      { value: "不能跪姿", color: "orange" as const },
      { value: "无特殊禁忌", color: "green" as const },
    ],
  },
];

export default function ProfileWizard() {
  const router = useRouter();
  const { toast } = useToast();
  const [step, setStep] = useState(0);
  const [data, setData] = useState<Record<string, string | string[]>>({
    goals: [],
    bodyConditions: [],
    fitnessLevel: "beginner",
    equipment: [],
    availableTime: "30",
    contraindications: [],
  });
  const [saving, setSaving] = useState(false);

  const currentStep = STEPS[step];

  function toggleMulti(field: string, value: string) {
    setData((prev) => {
      const arr = (prev[field] as string[]) || [];
      if (arr.includes(value)) return { ...prev, [field]: arr.filter((v) => v !== value) };
      return { ...prev, [field]: [...arr, value] };
    });
  }

  function setSingle(field: string, value: string) {
    setData((prev) => ({ ...prev, [field]: value }));
  }

  function handleNext() {
    if (step < STEPS.length - 1) {
      setStep(step + 1);
    } else {
      handleSave();
    }
  }

  async function handleSave() {
    setSaving(true);
    try {
      await api("/api/profile", {
        method: "POST",
        body: JSON.stringify(data),
      });
      posthog.capture("profile_completed", {
        goals: data.goals,
        fitnessLevel: data.fitnessLevel,
        availableTime: data.availableTime,
      });
      toast("画像设置完成", "success");
      router.push("/");
      router.refresh();
    } catch (e) {
      toast(e instanceof Error ? e.message : "保存失败，请稍后重试", "error");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="min-h-[80vh] flex items-center justify-center px-4 py-8">
      <div className="w-full max-w-lg">
        {/* Progress — thin, minimal */}
        <div className="flex gap-1 mb-10">
          {STEPS.map((_, i) => (
            <div
              key={i}
              className="h-[2px] flex-1 transition-colors duration-300"
              style={{
                borderRadius: "var(--radius-none)",
                background: i <= step ? "var(--color-brand)" : "var(--color-border)",
              }}
            />
          ))}
        </div>

        <div className="bg-[var(--color-surface)] p-8 animate-fade-up">
          <h2 className="text-[22px] font-semibold tracking-[-0.022em] text-[var(--color-text-primary)]">
            {currentStep.title}
          </h2>
          <p className="text-[14px] text-[var(--color-text-secondary)] mt-1.5">
            {currentStep.subtitle}
          </p>

          <div className="mt-8 space-y-6">
            {"fields" in currentStep ? (
              (currentStep as { fields: Array<{ field: string; label: string; single?: boolean; options: Array<{ value: string; label?: string; color: string }> }> }).fields.map((f) => (
                <div key={f.field}>
                  <p className="text-[13px] font-medium text-[var(--color-text-secondary)] mb-2.5">
                    {f.label}
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {f.options.map((opt) => {
                      const label = opt.label || opt.value;
                      if (f.single) {
                        return (
                          <TagBadge
                            key={opt.value}
                            label={label}
                            selected={(data[f.field] as string) === opt.value}
                            color={opt.color as "green" | "blue" | "orange" | "red" | "purple"}
                            onClick={() => setSingle(f.field, opt.value)}
                          />
                        );
                      }
                      return (
                        <TagBadge
                          key={opt.value}
                          label={label}
                          selected={(data[f.field] as string[]).includes(opt.value)}
                          color={opt.color as "green" | "blue" | "orange" | "red" | "purple"}
                          onClick={() => toggleMulti(f.field, opt.value)}
                        />
                      );
                    })}
                  </div>
                </div>
              ))
            ) : (
              <div className="flex flex-wrap gap-2">
                {("options" in currentStep ? currentStep.options : []).map(
                  (opt: { value: string; label?: string; color: string }) => {
                    const label = opt.label || opt.value;
                    return (
                      <TagBadge
                        key={opt.value}
                        label={label}
                        selected={(data[currentStep.field as string] as string[]).includes(opt.value)}
                        color={opt.color as "green" | "blue" | "orange" | "red" | "purple"}
                        onClick={() => toggleMulti(currentStep.field as string, opt.value)}
                      />
                    );
                  }
                )}
              </div>
            )}
          </div>

          <div className="mt-10 flex gap-3">
            {step > 0 && (
              <button
                onClick={() => setStep(step - 1)}
                className="px-6 py-2.5 text-[14px] text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] transition-colors"
                style={{ borderRadius: "var(--radius-md)", border: "0.5px solid var(--color-border)" }}
              >
                上一步
              </button>
            )}
            <button
              onClick={handleNext}
              disabled={saving}
              className="flex-1 py-2.5 bg-[#3b73ff] hover:bg-[#2f64e8] active:bg-[#2952c4] disabled:opacity-30 text-white font-medium transition-colors active:scale-[0.97] text-[14px]"
              style={{ borderRadius: "var(--radius-md)" }}
            >
              {step === STEPS.length - 1 ? (saving ? "保存中..." : "完成设置") : "下一步"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
