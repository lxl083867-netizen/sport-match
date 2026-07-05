"use client";

import PlatformLogo from "./PlatformLogo";

interface VideoThumbnailProps {
  title: string;
  platform: string;
  duration: number | null;
  thumbnailUrl?: string | null;
  size?: "sm" | "md" | "lg";
}

const sizeStyles = {
  sm: "h-20",
  md: "h-36",
  lg: "h-48",
};

const platformAccent: Record<string, { primary: string; secondary: string; chip: string }> = {
  bilibili: { primary: "#4F68FD", secondary: "#C7FF45", chip: "#eaf0ff" },
  xiaohongshu: { primary: "#FF5E32", secondary: "#6C37FF", chip: "#fff0e8" },
  douyin: { primary: "#6C37FF", secondary: "#B2DD5A", chip: "#f1ecff" },
};

function formatDuration(seconds: number | null): string {
  if (!seconds) return "";
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export default function VideoThumbnail({ title, platform, duration, thumbnailUrl, size = "md" }: VideoThumbnailProps) {
  const accent = platformAccent[platform] ?? platformAccent.bilibili;
  const initial = title.replace(/[【】\[\]（）()\s]/g, "").charAt(0) || "练";

  return (
    <div className={`relative w-full overflow-hidden ${sizeStyles[size]} bg-[#f6f7fb]`}>
      {/* Real thumbnail */}
      {thumbnailUrl ? (
        <img
          src={thumbnailUrl}
          alt={title}
          className="absolute inset-0 w-full h-full object-cover"
          loading="lazy"
          onError={(e) => {
            (e.target as HTMLImageElement).style.display = "none";
          }}
        />
      ) : null}

      {/* Placeholder (visible when no image or image failed to load) */}
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_85%,rgba(79,104,253,0.055),transparent_30%),radial-gradient(circle_at_82%_12%,rgba(255,94,50,0.045),transparent_28%)]" />

        {/* Brand sticker shapes */}
        <div
          className="absolute -right-7 -top-10 h-32 w-32 rotate-12 rounded-[42%] opacity-90"
          style={{ background: `${accent.primary}22` }}
        />
        <div
          className="absolute -left-8 -bottom-7 h-24 w-24 rounded-full opacity-80"
          style={{ background: `${accent.secondary}35` }}
        />
        <div
          className="absolute right-11 bottom-8 h-3.5 w-3.5 rounded-full shadow-[0_4px_10px_rgba(255,94,50,0.18)]"
          style={{ background: accent.primary }}
        />
        <div
          className="absolute left-10 top-8 h-2 w-2 rounded-full"
          style={{ background: accent.secondary }}
        />
        <div
          className="absolute left-[18%] top-[32%] h-8 w-1.5 -rotate-12 rounded-full opacity-45"
          style={{ background: accent.primary }}
        />
        <div
          className="absolute right-[20%] bottom-[28%] h-10 w-1.5 rotate-[28deg] rounded-full opacity-35"
          style={{ background: accent.secondary }}
        />

        {/* Title initial watermark */}
        <div className="relative flex h-20 w-20 items-center justify-center rounded-[28px] bg-white/45 shadow-[0_12px_30px_rgba(79,104,253,0.08)] ring-1 ring-white/70">
          <span
            className="text-6xl font-black tracking-tighter select-none opacity-80"
            style={{ color: accent.primary }}
          >
            {initial}
          </span>
        </div>
      </div>

      {/* Platform label — top left */}
      <div className="absolute top-3 left-3 z-10">
        <div
          className="flex h-8 w-8 items-center justify-center rounded-xl shadow-[0_8px_18px_rgba(40,40,60,0.08)] ring-1 ring-white/70"
          style={{ background: accent.chip }}
        >
          <PlatformLogo platform={platform} size={22} />
        </div>
      </div>

      {/* Duration badge — bottom right */}
      {duration != null && duration > 0 && (
        <div className="absolute bottom-3 right-3 bg-[#3a3a40]/72 backdrop-blur-sm text-white text-[11px] font-semibold px-2 py-0.5 z-10 shadow-[0_8px_18px_rgba(0,0,0,0.18)]" style={{ borderRadius: "var(--radius-sm)" }}>
          {formatDuration(duration)}
        </div>
      )}
    </div>
  );
}
