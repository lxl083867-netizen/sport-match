"use client";

import { useState } from "react";
import VideoCard from "./VideoCard";
import Link from "next/link";
import type { FitnessLevel } from "@/lib/tag-display";

interface VideoData {
  videoId?: string;
  id?: string;
  title: string;
  url?: string;
  platform: string;
  sourceAuthor: string;
  duration: number | null;
  thumbnailUrl?: string | null;
  tags: Array<{ name: string; category: string; nameZh: string; confidence?: number }>;
  matchScore?: number;
  matchReasons?: string[];
}

interface Props {
  personalized: VideoData[];
  hotVideos: VideoData[];
  fitnessLevel: FitnessLevel | null;
  hasProfile: boolean;
  isLoggedIn: boolean;
}

type TabKey = "for-you" | "hot";

export default function HomeTabs({ personalized, hotVideos, fitnessLevel, hasProfile, isLoggedIn }: Props) {
  const [activeTab, setActiveTab] = useState<TabKey>(isLoggedIn ? "for-you" : "hot");

  const tabs: { key: TabKey; label: string; show: boolean }[] = [
    { key: "for-you", label: "为你推荐", show: isLoggedIn },
    { key: "hot", label: "热门推荐", show: true },
  ];

  return (
    <section className="max-w-[980px] mx-auto px-6 py-12">
      {/* ── Section header ── */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between mb-8">
        <div>
          <p className="text-[11px] text-[var(--color-text-tertiary)] font-semibold tracking-widest uppercase mb-1">
            训练补给
          </p>
          <h2 className="text-[24px] font-semibold tracking-[-0.01em] text-[var(--color-text-primary)]">
            为你补齐训练缺口
          </h2>
        </div>
        {isLoggedIn ? (
          <div
            className="inline-flex p-0.5"
            style={{ background: "var(--color-surface-secondary)", borderRadius: "var(--radius-md)" }}
          >
            {tabs.filter((t) => t.show).map((tab) => {
              const isActive = activeTab === tab.key;
              return (
                <button
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key)}
                  className={`relative px-5 py-1.5 text-[13px] font-medium transition-all ${
                    isActive
                      ? "text-[var(--color-text-primary)] bg-[var(--color-surface)] shadow-[var(--shadow-sm)]"
                      : "text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]"
                  }`}
                  style={{ borderRadius: "calc(var(--radius-md) - 2px)" }}
                >
                  {tab.label}
                </button>
              );
            })}
          </div>
        ) : (
          <span className="text-[13px] text-[var(--color-text-tertiary)]">按社区打卡热度排序</span>
        )}
      </div>

      {/* ── For You ── */}
      {activeTab === "for-you" && (
        <div className="overflow-hidden">
          {!hasProfile ? (
            <EmptyState message="完成运动画像，获取个性化推荐" action="设置画像" href="/profile/setup" />
          ) : personalized.length === 0 ? (
            <EmptyState message="还没有个性化推荐，多练几次就有了" action="去发现视频" href="/videos" />
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {personalized.slice(0, 3).map((v) => (
                <VideoCard
                  key={v.videoId || v.id}
                  id={v.videoId || v.id!}
                  title={v.title}
                  platform={v.platform}
                  duration={v.duration}
                  sourceAuthor={v.sourceAuthor}
                  thumbnailUrl={v.thumbnailUrl}
                  tags={v.tags}
                  matchScore={v.matchScore !== undefined ? Math.round(v.matchScore) : undefined}
                  matchReasons={v.matchReasons}
                  fitnessLevel={fitnessLevel}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Hot ── */}
      {activeTab === "hot" && (
        <div className="overflow-hidden">
          {hotVideos.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {hotVideos.slice(0, 3).map((v) => (
                <VideoCard
                  key={v.videoId || v.id}
                  id={v.videoId || v.id!}
                  title={v.title}
                  platform={v.platform}
                  duration={v.duration}
                  sourceAuthor={v.sourceAuthor}
                  thumbnailUrl={v.thumbnailUrl}
                  tags={v.tags}
                />
              ))}
            </div>
          ) : (
            <EmptyState message="还没有热门视频数据" action="发现视频" href="/videos" />
          )}
        </div>
      )}
    </section>
  );
}

function EmptyState({ message, action, href }: { message: string; action: string; href: string }) {
  return (
    <div className="text-center py-16">
      <p className="text-[15px] text-[var(--color-text-secondary)] mb-4">{message}</p>
      <Link
        href={href}
        className="inline-block px-5 py-2.5 bg-[#3b73ff] text-white rounded-full text-[14px] font-medium hover:opacity-90 transition-opacity"
      >
        {action}
      </Link>
    </div>
  );
}
