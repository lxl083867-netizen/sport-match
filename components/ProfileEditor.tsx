"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import TagBadge from "./TagBadge";
import { api } from "@/lib/api";
import { useToast } from "./Toast";

interface ProfileData {
  goals: string;
  fitnessLevel: string;
  bodyConditions: string;
  equipment: string;
  availableTime: string;
  contraindications: string;
}

export default function ProfileEditor({ initialProfile }: { initialProfile: ProfileData | null }) {
  const router = useRouter();
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);
  const [goals, setGoals] = useState<string[]>(
    initialProfile ? JSON.parse(initialProfile.goals) : []
  );
  const [fitnessLevel, setFitnessLevel] = useState(initialProfile?.fitnessLevel || "beginner");
  const [bodyConditions, setBodyConditions] = useState<string[]>(
    initialProfile ? JSON.parse(initialProfile.bodyConditions) : []
  );
  const [equipment, setEquipment] = useState<string[]>(
    initialProfile ? JSON.parse(initialProfile.equipment) : []
  );
  const [availableTime, setAvailableTime] = useState(initialProfile?.availableTime || "30");
  const [contraindications, setContraindications] = useState<string[]>(
    initialProfile ? JSON.parse(initialProfile.contraindications) : []
  );

  async function handleSave() {
    setSaving(true);
    try {
      await api("/api/profile", {
        method: "POST",
        body: JSON.stringify({ goals, fitnessLevel, bodyConditions, equipment, availableTime, contraindications }),
      });
      toast("画像已更新", "success");
      router.refresh();
    } catch (e) {
      toast(e instanceof Error ? e.message : "保存失败，请稍后重试", "error");
    } finally {
      setSaving(false);
    }
  }

  const sections = [
    {
      label: "运动目标",
      field: goals,
      setter: setGoals,
      options: ["减脂", "增肌", "康复", "体能提升", "柔韧性"],
      colors: ["orange", "blue", "green", "purple", "blue"] as const,
    },
    {
      label: "身体状况",
      field: bodyConditions,
      setter: setBodyConditions,
      options: ["健康", "办公室久坐", "膝部不适", "腰部不适", "肩颈不适", "产后恢复", "大基数"],
      colors: ["green", "orange", "red", "red", "red", "purple", "orange"] as const,
    },
    {
      label: "可用器材",
      field: equipment,
      setter: setEquipment,
      options: ["无器材", "瑜伽垫", "弹力带", "哑铃"],
      colors: ["green", "blue", "purple", "orange"] as const,
    },
    {
      label: "禁忌动作",
      field: contraindications,
      setter: setContraindications,
      options: ["不能跳跃", "不能深蹲", "不能仰卧", "不能跪姿", "无特殊禁忌"],
      colors: ["red", "red", "orange", "orange", "green"] as const,
    },
  ];

  return (
    <div className="space-y-4">
      {/* Fitness level */}
      <div className="bg-[var(--color-surface)] p-5" style={{ borderRadius: "var(--radius-lg)", border: "0.5px solid var(--color-border)" }}>
        <p className="text-[13px] font-medium text-[var(--color-text-secondary)] mb-3">运动经验</p>
        <div className="flex flex-wrap gap-2">
          {[
            { value: "beginner", label: "零基础" },
            { value: "intermediate", label: "有规律运动 1 年以上" },
            { value: "professional", label: "专业背景" },
          ].map((opt) => (
            <TagBadge
              key={opt.value}
              label={opt.label}
              selected={fitnessLevel === opt.value}
              color="green"
              onClick={() => setFitnessLevel(opt.value)}
            />
          ))}
        </div>
      </div>

      {/* Available time */}
      <div className="bg-[var(--color-surface)] p-5" style={{ borderRadius: "var(--radius-lg)", border: "0.5px solid var(--color-border)" }}>
        <p className="text-[13px] font-medium text-[var(--color-text-secondary)] mb-3">单次训练时长</p>
        <div className="flex flex-wrap gap-2">
          {[
            { value: "15", label: "15 分钟以内" },
            { value: "30", label: "15-30 分钟" },
            { value: "60", label: "30 分钟以上" },
          ].map((opt) => (
            <TagBadge
              key={opt.value}
              label={opt.label}
              selected={availableTime === opt.value}
              color="blue"
              onClick={() => setAvailableTime(opt.value)}
            />
          ))}
        </div>
      </div>

      {/* Multi-select sections */}
      {sections.map((section) => (
        <div key={section.label} className="bg-[var(--color-surface)] p-5" style={{ borderRadius: "var(--radius-lg)", border: "0.5px solid var(--color-border)" }}>
          <p className="text-[13px] font-medium text-[var(--color-text-secondary)] mb-3">{section.label}</p>
          <div className="flex flex-wrap gap-2">
            {section.options.map((opt, i) => (
              <TagBadge
                key={opt}
                label={opt}
                selected={section.field.includes(opt)}
                color={section.colors[i]}
                onClick={() => {
                  if (section.field.includes(opt)) {
                    section.setter(section.field.filter((v) => v !== opt));
                  } else {
                    section.setter([...section.field, opt]);
                  }
                }}
              />
            ))}
          </div>
        </div>
      ))}

      <button
        onClick={handleSave}
        disabled={saving}
        className="w-full py-3 bg-[#3b73ff] hover:bg-[#2f64e8] active:bg-[#2952c4] disabled:opacity-30 text-white font-medium transition-colors active:scale-[0.97] text-[15px]"
        style={{ borderRadius: "var(--radius-md)" }}
      >
        {saving ? "保存中..." : "保存画像"}
      </button>
    </div>
  );
}
