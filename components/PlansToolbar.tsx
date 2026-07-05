"use client";

import { useRouter } from "next/navigation";

interface Props {
  tab: string;
  isLoggedIn: boolean;
}

const TABS = [
  { key: "hot", label: "热门", auth: false },
  { key: "new", label: "最新", auth: false },
  { key: "mine", label: "我的", auth: true },
];

export default function PlansToolbar({ tab, isLoggedIn }: Props) {
  const router = useRouter();

  function switchTab(key: string) {
    router.push(`/plans?tab=${key}`);
  }

  const visibleTabs = TABS.filter((t) => !t.auth || isLoggedIn);

  return (
    <section className="mb-5">
      <div className="flex flex-wrap items-center gap-6">
        {visibleTabs.map((item) => {
          const isActive = tab === item.key;
          return (
            <button
              key={item.key}
              onClick={() => switchTab(item.key)}
              className={`relative text-[15px] font-semibold transition-colors after:absolute after:-bottom-1.5 after:left-0 after:h-0.5 after:rounded-full after:transition-all ${
                isActive
                  ? "text-[#6C57FF] after:w-full after:bg-[#6C57FF]"
                  : "text-[var(--color-text-secondary)] after:w-0 after:bg-transparent hover:text-[var(--color-text-primary)]"
              }`}
            >
              {item.label}
            </button>
          );
        })}
      </div>
    </section>
  );
}
