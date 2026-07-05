"use client";

import { getEmbedUrl } from "@/lib/platform";
import VideoThumbnail from "./VideoThumbnail";

interface VideoPlayerProps {
  title: string;
  url: string;
  platform: string;
  duration: number | null;
}

export default function VideoPlayer({ title, url, platform, duration }: VideoPlayerProps) {
  const embedUrl = getEmbedUrl(url, platform);

  if (embedUrl) {
    return (
      <div className="relative w-full bg-black" style={{ paddingBottom: "56.25%" }}>
        <iframe
          key={embedUrl}
          src={embedUrl}
          allowFullScreen
          className="absolute inset-0 w-full h-full border-0"
          title={title}
        />
      </div>
    );
  }

  return (
    <div className="relative">
      <VideoThumbnail title={title} platform={platform} duration={duration} size="lg" />
      <div className="absolute inset-0 flex items-center justify-center bg-black/20">
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 px-6 py-3 bg-[var(--color-surface)]/92 text-[var(--color-text-primary)] text-[14px] font-medium hover:bg-[var(--color-surface)] transition-colors active:scale-[0.97] shadow-[var(--shadow-md)] ring-1 ring-[var(--color-border)] backdrop-blur-sm"
          style={{ borderRadius: "var(--radius-md)" }}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polygon points="5 3 19 12 5 21 5 3" />
          </svg>
          在 {platform === "bilibili" ? "B站" : platform === "xiaohongshu" ? "小红书" : platform === "douyin" ? "抖音" : "原平台"} 观看
        </a>
      </div>
    </div>
  );
}
