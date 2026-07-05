"use client";

import { useUIStore } from "@/lib/store";
import TagBadge from "./TagBadge";

export default function TagThemeToggle({ compact = false }: { compact?: boolean }) {
  const { tagTheme, setTagTheme } = useUIStore();

  const content = (
    <>
      <div className={compact ? "mb-3" : "mb-4"}>
        <h2 className="text-[15px] font-semibold text-[var(--color-text-primary)]">
          标签显示
        </h2>
        <p className="text-[12px] text-[var(--color-text-secondary)]">
          调整视频标签的视觉风格
        </p>
      </div>

      <div className="grid grid-cols-2 gap-2.5">
        <button
          onClick={() => setTagTheme("colorful")}
          className={`min-w-0 p-3 text-left transition-colors ${
            tagTheme === "colorful"
              ? "ring-2 ring-[var(--color-brand)] bg-[var(--color-brand-subtle)]"
              : "ring-1 ring-[var(--color-border)] hover:ring-[var(--color-border-strong)] bg-[var(--color-surface)]"
          }`}
          style={{ borderRadius: "var(--radius-md)" }}
        >
          <p className="font-medium text-[12px] mb-2 text-[var(--color-text-primary)]">
            彩色分类
          </p>
          <div className="flex flex-wrap gap-1">
            <TagBadge label="减脂" size="sm" color="orange" forceTheme="colorful" />
            <TagBadge label="HIIT" size="sm" color="purple" forceTheme="colorful" />
            <TagBadge label="核心" size="sm" color="blue" forceTheme="colorful" />
          </div>
        </button>

        <button
          onClick={() => setTagTheme("mono")}
          className={`min-w-0 p-3 text-left transition-colors ${
            tagTheme === "mono"
              ? "ring-2 ring-[var(--color-brand)] bg-[var(--color-brand-subtle)]"
              : "ring-1 ring-[var(--color-border)] hover:ring-[var(--color-border-strong)] bg-[var(--color-surface)]"
          }`}
          style={{ borderRadius: "var(--radius-md)" }}
        >
          <p className="font-medium text-[12px] mb-2 text-[var(--color-text-primary)]">
            同色系
          </p>
          <div className="flex flex-wrap gap-1">
            <TagBadge label="减脂" size="sm" color="default" forceTheme="mono" />
            <TagBadge label="HIIT" size="sm" color="default" forceTheme="mono" />
            <TagBadge label="核心" size="sm" color="default" forceTheme="mono" />
          </div>
        </button>
      </div>
    </>
  );

  if (compact) return <div>{content}</div>;

  return (
    <div className="bg-[var(--color-surface)] p-6 mb-6" style={{ border: "1px solid var(--color-border)", borderRadius: "20px" }}>
      {content}
    </div>
  );
}
