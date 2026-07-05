"use client";

import Link from "next/link";
import { useSession, signOut } from "next-auth/react";
import { usePathname } from "next/navigation";
import ThemeToggle from "@/components/ThemeToggle";

const navLinks = [
  { href: "/videos", label: "发现" },
  { href: "/plans", label: "计划" },
];

export default function NavBar() {
  const { data: session } = useSession();
  const pathname = usePathname();

  return (
    <nav className="sticky top-0 z-50 glass">
      <div className="max-w-[980px] mx-auto px-4 md:px-6 h-11 flex items-center justify-between">
        <Link
          href="/"
          className="text-[17px] font-semibold tracking-[-0.022em] text-[var(--color-text-primary)] hover:opacity-70 transition-opacity"
        >
          SportMatch
        </Link>

        <div className="flex items-center gap-0.5">
          <ThemeToggle />

          {/* Desktop nav links — hidden on mobile */}
          <div className="hidden md:flex items-center gap-0.5">
            {session ? (
              <>
                {navLinks.map((link) => {
                  const isActive = pathname === link.href || pathname.startsWith(link.href + "/");
                  return (
                    <Link
                      key={link.href}
                      href={link.href}
                      className={`px-3 py-1.5 text-[13px] font-medium transition-colors ${
                        isActive
                          ? "text-[var(--color-brand)]"
                          : "text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]"
                      }`}
                    >
                      {link.label}
                    </Link>
                  );
                })}

                <div className="w-px h-4 bg-[var(--color-border)] mx-2" />

                <Link
                  href="/profile"
                  className={`w-7 h-7 flex items-center justify-center text-[11px] font-semibold transition-colors ${
                    pathname.startsWith("/profile")
                      ? "bg-[#3b73ff] text-white"
                      : "bg-[var(--color-surface-tertiary)] text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]"
                  }`}
                  title={session.user?.name || "个人"}
                >
                  {(session.user?.name || "U").charAt(0)}
                </Link>

                <button
                  onClick={() => signOut()}
                  className="ml-1 text-[12px] text-[var(--color-text-tertiary)] hover:text-[var(--color-text-primary)] transition-colors px-2 py-1"
                >
                  退出
                </button>
              </>
            ) : (
              <>
                <Link
                  href="/auth/login"
                  className="text-[13px] text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] transition-colors px-3 py-1.5"
                >
                  登录
                </Link>
                <Link
                  href="/auth/register"
                  className="text-[13px] font-medium px-4 py-1.5 bg-[#3b73ff] text-white hover:bg-[#2f64e8] transition-colors ml-1"
                >
                  免费开始
                </Link>
              </>
            )}
          </div>
        </div>
      </div>
    </nav>
  );
}
