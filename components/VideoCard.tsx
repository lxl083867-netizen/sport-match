import Link from "next/link";
import TagBadge from "./TagBadge";
import VideoThumbnail from "./VideoThumbnail";
import { PlatformLabel } from "./PlatformLogo";
import { prioritizeTags, categoryColorMap, type FitnessLevel } from "@/lib/tag-display";
import { getPlaybackLabel } from "@/lib/platform";

interface VideoCardProps {
  id: string;
  title: string;
  platform: string;
  duration: number | null;
  sourceAuthor: string;
  thumbnailUrl?: string | null;
  tags: { name: string; category: string; nameZh: string; confidence?: number }[];
  matchScore?: number;
  matchReasons?: string[];
  showThumbnail?: boolean;
  tagTheme?: "colorful" | "mono";
  fitnessLevel?: FitnessLevel | null;
  isOwner?: boolean;
}

export default function VideoCard({
  id, title, platform, duration, sourceAuthor, thumbnailUrl, tags,
  matchScore, matchReasons, showThumbnail = true, tagTheme = "colorful",
  fitnessLevel = null, isOwner = false,
}: VideoCardProps) {
  const displayTags = prioritizeTags(tags, fitnessLevel, 4);
  const overflow = tags.length > 4 ? tags.length - 4 : 0;
  const color = (cat: string) =>
    tagTheme === "mono" ? "default" : (categoryColorMap[cat] || "default");

  return (
    <Link
      href={`/videos/${id}`}
      className="group block overflow-hidden rounded-[22px] bg-[var(--color-surface)] shadow-[0_8px_24px_rgba(149,157,165,0.08)] transition-all duration-200 hover:-translate-y-1 hover:scale-[1.01] hover:shadow-[0_14px_34px_rgba(80,86,104,0.12)]"
    >
      {showThumbnail && (
        <VideoThumbnail title={title} platform={platform} duration={duration} thumbnailUrl={thumbnailUrl} size="md" />
      )}

      <div className="p-4">
        <div className="flex items-start justify-between gap-2 mb-2">
          <h3 className="min-w-0 flex-1 line-clamp-2 text-[16px] font-semibold leading-snug text-[var(--color-text-primary)]">
            {isOwner && (
              <span className="mr-1.5 inline-block rounded-full bg-[#f0ffd2] px-1.5 py-0.5 align-middle text-[10px] font-semibold text-[#5f8200]">
                已导入
              </span>
            )}
            {title}
          </h3>
          <span className={`shrink-0 playback-badge text-[11px] px-2 py-1 ${
            platform === "bilibili"
              ? "playback-badge--embed"
              : "playback-badge--external"
          }`}>
            {platform !== "bilibili" && (
              <svg className="w-2.5 h-2.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                <path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6" />
                <polyline points="15 3 21 3 21 9" />
                <line x1="10" y1="14" x2="21" y2="3" />
              </svg>
            )}
            {getPlaybackLabel(platform)}
          </span>
        </div>

        <div className="flex items-center gap-2 mb-3">
          <PlatformLabel platform={platform} />
          <span className="text-[12px] text-[var(--color-text-tertiary)]">@{sourceAuthor}</span>
        </div>

        <div className="flex flex-wrap gap-1">
          {displayTags.map((t) => (
            <TagBadge key={t.name} label={t.displayLabel} size="sm" color={color(t.category)} />
          ))}
          {overflow > 0 && (
            <span className="text-[11px] text-[var(--color-text-tertiary)] self-center ml-1">
              +{overflow}
            </span>
          )}
        </div>

        {((matchReasons && matchReasons.length > 0) || matchScore !== undefined) && (
          <div className="mt-3 flex items-end justify-between gap-3 border-t border-[var(--color-border)] pt-3">
            <div className="min-w-0 space-y-1">
              {matchReasons?.slice(0, 2).map((r, i) => (
                <p key={i} className="text-[12px] font-medium text-[#4F68FD]">{r}</p>
              ))}
            </div>
            {matchScore !== undefined && (
              <span className="shrink-0 rounded-full bg-[#edf1ff] px-2.5 py-1 text-[11px] font-semibold text-[#3f56df]">
                匹配得分 {matchScore}
              </span>
            )}
          </div>
        )}
      </div>
    </Link>
  );
}
