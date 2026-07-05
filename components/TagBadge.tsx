"use client";

import { useUIStore } from "@/lib/store";

interface TagBadgeProps {
  label: string;
  selected?: boolean;
  onClick?: () => void;
  size?: "sm" | "md";
  color?: "default" | "green" | "blue" | "orange" | "red" | "purple" | "lime" | "coral" | "gray";
  count?: number;
  forceTheme?: "colorful" | "mono";
}

// Soft sticker pills inspired by BuddyUp: playful accents without turning dense tag rows into a rainbow strip.
const colorMap: Record<string, { bg: string; text: string; selBg: string; selText: string; shadow: string; ring: string }> = {
  default: {
    bg: "bg-[#f5f3ee]",
    text: "text-[#6a675d]",
    selBg: "bg-[var(--color-text-primary)]",
    selText: "text-[var(--color-surface)]",
    shadow: "shadow-[0_4px_10px_rgba(80,76,65,0.07)]",
    ring: "ring-1 ring-black/5",
  },
  green: {
    bg: "bg-[#eefbd7]",
    text: "text-[#527400]",
    selBg: "bg-[#B2DD5A]",
    selText: "text-[#213500]",
    shadow: "shadow-[0_4px_10px_rgba(178,221,90,0.12)]",
    ring: "ring-1 ring-[#8db93a]/20",
  },
  blue: {
    bg: "bg-[#edf1ff]",
    text: "text-[#3f56df]",
    selBg: "bg-[#4F68FD]",
    selText: "text-white",
    shadow: "shadow-[0_4px_10px_rgba(79,104,253,0.12)]",
    ring: "ring-1 ring-[#4f68fd]/12",
  },
  orange: {
    bg: "bg-[#fff0e8]",
    text: "text-[#d94c25]",
    selBg: "bg-[#FF5E32]",
    selText: "text-white",
    shadow: "shadow-[0_4px_10px_rgba(255,94,50,0.12)]",
    ring: "ring-1 ring-[#ff5e32]/12",
  },
  red: {
    bg: "bg-[#ffecef]",
    text: "text-[#d63a51]",
    selBg: "bg-[#FF4E64]",
    selText: "text-white",
    shadow: "shadow-[0_4px_10px_rgba(255,78,100,0.12)]",
    ring: "ring-1 ring-[#ff4e64]/12",
  },
  purple: {
    bg: "bg-[#f1ecff]",
    text: "text-[#6334e8]",
    selBg: "bg-[#6C37FF]",
    selText: "text-white",
    shadow: "shadow-[0_4px_10px_rgba(108,55,255,0.13)]",
    ring: "ring-1 ring-[#6c37ff]/12",
  },
  lime: {
    bg: "bg-[#f0ffd2]",
    text: "text-[#5f8200]",
    selBg: "bg-[#C7FF45]",
    selText: "text-[#233400]",
    shadow: "shadow-[0_4px_10px_rgba(199,255,69,0.12)]",
    ring: "ring-1 ring-[#9fcf31]/20",
  },
  coral: {
    bg: "bg-[#fff0eb]",
    text: "text-[#d85b3f]",
    selBg: "bg-[#FF765C]",
    selText: "text-white",
    shadow: "shadow-[0_4px_10px_rgba(255,118,92,0.11)]",
    ring: "ring-1 ring-[#ff765c]/12",
  },
  gray: {
    bg: "bg-[#f1f2f5]",
    text: "text-[#68707d]",
    selBg: "bg-[#dfe3ea]",
    selText: "text-[#3f4652]",
    shadow: "shadow-[0_4px_10px_rgba(80,86,104,0.08)]",
    ring: "ring-1 ring-[#b9c0cc]/25",
  },
};

export default function TagBadge({
  label,
  selected = false,
  onClick,
  size = "md",
  color = "default",
  count,
  forceTheme,
}: TagBadgeProps) {
  const globalTheme = useUIStore((state) => state.tagTheme);
  const visualTheme = forceTheme ?? globalTheme;
  const useMono = visualTheme === "mono" && !onClick;
  const c = colorMap[color] || colorMap.default;
  const sizeClass =
    size === "sm"
      ? "px-2.5 py-1 text-[11px]"
      : "px-3.5 py-1.5 text-[13px]";
  const cursorClass = onClick ? "cursor-pointer" : "";

  return (
    <span
      className={`inline-flex items-center rounded-full font-semibold leading-none tracking-normal transition-all duration-200 ${sizeClass} ${cursorClass} ${
        useMono
          ? "bg-white text-[#3f4652] shadow-none ring-1 ring-[#d9dbe3]"
          : selected
            ? `${c.selBg} ${c.selText} ${c.shadow} ${c.ring} scale-[1.03]`
            : `${c.bg} ${c.text} ${c.shadow} ${c.ring}`
      } ${onClick ? "hover:-translate-y-0.5 hover:scale-[1.04] active:scale-[0.97]" : ""}`}
      onClick={onClick}
    >
      {label}
      {count !== undefined && (
        <span className="ml-1 opacity-60">{count}</span>
      )}
    </span>
  );
}
