"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const tabs = [
  {
    href: "/",
    label: "首页",
    icon: (active: boolean) => (
      <svg className="w-6 h-6" viewBox="0 0 24 24" fill={active ? "currentColor" : "none"} stroke="currentColor" strokeWidth="1.5">
        <path d="M3 12l9-9 9 9" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M5 10v9a1 1 0 001 1h3v-5h6v5h3a1 1 0 001-1v-9" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
  },
  {
    href: "/plans",
    label: "计划",
    icon: (active: boolean) => (
      <svg className="w-6 h-6" viewBox="0 0 24 24" fill={active ? "currentColor" : "none"} stroke="currentColor" strokeWidth="1.5">
        <rect x="4" y="4" width="7" height="7" rx="1" />
        <rect x="13" y="4" width="7" height="7" rx="1" />
        <rect x="4" y="13" width="7" height="7" rx="1" />
        <rect x="13" y="13" width="7" height="7" rx="1" />
      </svg>
    ),
  },
  {
    href: "/videos",
    label: "发现",
    icon: (active: boolean) => (
      <svg className="w-6 h-6" viewBox="0 0 24 24" fill={active ? "currentColor" : "none"} stroke="currentColor" strokeWidth="1.5">
        <circle cx="12" cy="12" r="10" />
        <path d="M10.5 8.5l6 3.5-6 3.5v-7z" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
  },
  {
    href: "/profile",
    label: "我的",
    icon: (active: boolean) => (
      <svg className="w-6 h-6" viewBox="0 0 24 24" fill={active ? "currentColor" : "none"} stroke="currentColor" strokeWidth="1.5">
        <circle cx="12" cy="8" r="4" />
        <path d="M4 22c0-4.418 3.582-8 8-8s8 3.582 8 8" strokeLinecap="round" />
      </svg>
    ),
  },
];

export default function MobileTabBar() {
  const pathname = usePathname();

  return (
    <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-50 glass flex items-center justify-around safe-area-bottom"
      style={{ height: "49px", paddingBottom: "env(safe-area-inset-bottom, 0px)", borderTop: "0.5px solid var(--color-border)" }}>
      {tabs.map((tab) => {
        const isActive = tab.href === "/"
          ? pathname === "/"
          : pathname === tab.href || pathname.startsWith(tab.href + "/");
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={`flex flex-col items-center justify-center gap-0.5 px-3 py-1 min-w-0 transition-colors ${
              isActive
                ? "text-[#3b73ff]"
                : "text-[var(--color-text-tertiary)] hover:text-[var(--color-text-secondary)]"
            }`}
          >
            {tab.icon(isActive)}
            <span className={`text-[10px] font-medium leading-none ${isActive ? "text-[#3b73ff]" : ""}`}>
              {tab.label}
            </span>
          </Link>
        );
      })}
    </nav>
  );
}
