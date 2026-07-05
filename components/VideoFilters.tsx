"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import TagBadge from "./TagBadge";
import PlatformLogo from "./PlatformLogo";

const PLATFORMS = [
  { value: "", label: "全部" },
  { value: "bilibili", label: "B站", logo: "B" },
  { value: "xiaohongshu", label: "小红书", logo: "红" },
  { value: "douyin", label: "抖音", logo: "抖" },
];

const CATEGORIES = [
  { value: "", label: "全部类型", color: "default" },
  { value: "HIIT", label: "HIIT", color: "purple" },
  { value: "瑜伽", label: "瑜伽", color: "green" },
  { value: "力量训练", label: "力量训练", color: "blue" },
  { value: "拉伸", label: "拉伸", color: "lime" },
  { value: "热身", label: "热身", color: "coral" },
  { value: "普拉提", label: "普拉提", color: "purple" },
] as const;

interface Props {
  search: string;
  platform: string;
  tag: string;
  mine?: boolean;
  showMineToggle?: boolean;
  activeFilterCount?: number;
  embedded?: boolean;
}

export default function VideoFilters({ search, platform, tag, mine, showMineToggle = false, activeFilterCount = 0, embedded = false }: Props) {
  const router = useRouter();

  function pushParams(updates: Record<string, string>) {
    const params = new URLSearchParams();
    const next = { search, platform, tag, ...updates };
    if (next.search) params.set("search", next.search);
    if (next.platform) params.set("platform", next.platform);
    if (next.tag) params.set("tag", next.tag);
    if (mine) params.set("mine", "true");
    router.push(`/videos?${params.toString()}`);
  }

  function handleSearch(val: string) {
    pushParams({ search: val });
  }

  function viewHref(nextMine: boolean) {
    const params = new URLSearchParams();
    if (search) params.set("search", search);
    if (platform) params.set("platform", platform);
    if (tag) params.set("tag", tag);
    if (nextMine) params.set("mine", "true");
    const query = params.toString();
    return query ? `/videos?${query}` : "/videos";
  }

  return (
    <div className={embedded ? "relative mt-6 border-t border-[var(--color-border)] pt-5" : "mb-6 rounded-[24px] bg-[var(--color-surface)] p-4 shadow-[0_8px_24px_rgba(149,157,165,0.08)] md:p-5"}>
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <p className="text-[15px] font-semibold text-[var(--color-text-primary)]">筛选视频素材</p>
          <p className="mt-0.5 text-[12px] text-[var(--color-text-tertiary)]">先找内容，再组合成训练路线</p>
        </div>
        {activeFilterCount > 0 && (
          <span className="hidden rounded-full bg-[var(--color-surface-secondary)] px-3 py-1.5 text-[12px] font-semibold text-[var(--color-text-tertiary)] sm:inline-flex">
            已启用 {activeFilterCount} 个筛选
          </span>
        )}
      </div>

      <div className="space-y-4">
        {showMineToggle && (
          <div className="flex flex-wrap items-center gap-6">
            <Link
              href={viewHref(false)}
              className={`relative text-[15px] font-semibold transition-colors after:absolute after:-bottom-1.5 after:left-0 after:h-0.5 after:rounded-full after:transition-all ${
                !mine
                  ? "text-[#6C57FF] after:w-full after:bg-[#6C57FF]"
                  : "text-[var(--color-text-secondary)] after:w-0 after:bg-transparent hover:text-[var(--color-text-primary)]"
              }`}
            >
              全部
            </Link>
            <Link
              href={viewHref(true)}
              className={`relative text-[15px] font-semibold transition-colors after:absolute after:-bottom-1.5 after:left-0 after:h-0.5 after:rounded-full after:transition-all ${
                mine
                  ? "text-[#6C57FF] after:w-full after:bg-[#6C57FF]"
                  : "text-[var(--color-text-secondary)] after:w-0 after:bg-transparent hover:text-[var(--color-text-primary)]"
              }`}
            >
              我的导入
            </Link>
          </div>
        )}

        <input
          type="text"
          placeholder="搜索视频标题或作者..."
          defaultValue={search}
          onKeyDown={(e) => {
            if (e.key === "Enter") handleSearch((e.target as HTMLInputElement).value);
          }}
          onBlur={(e) => handleSearch(e.target.value)}
          className="w-full rounded-2xl border-0 bg-[var(--color-surface-secondary)] px-4 py-3 text-[15px] text-[var(--color-text-primary)] placeholder:text-[var(--color-text-tertiary)] shadow-inner outline-none ring-1 ring-transparent transition-all focus:bg-[var(--color-surface)] focus:ring-[#6C57FF]/25"
        />

        <div className="flex flex-wrap gap-2">
          {PLATFORMS.map((p) => (
            <button
              key={p.value}
              onClick={() => pushParams({ platform: p.value })}
              className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[12px] font-semibold transition-all hover:-translate-y-0.5 hover:scale-[1.03] active:scale-[0.97] ${
                platform === p.value
                  ? "bg-[#6C57FF] text-white shadow-[0_8px_18px_rgba(108,87,255,0.18)]"
                  : "bg-[var(--color-surface-secondary)] text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]"
              }`}
            >
              {p.value ? <PlatformLogo platform={p.value} size={18} /> : null}
              {p.label}
            </button>
          ))}
        </div>

        <div className="flex flex-wrap gap-2">
          {CATEGORIES.map((c) => (
            <TagBadge
              key={c.value}
              label={c.label}
              selected={tag === c.value}
              color={c.color}
              size="sm"
              onClick={() => pushParams({ tag: c.value })}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
