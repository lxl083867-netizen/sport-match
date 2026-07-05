"use client";

import { useTheme } from "@/components/ThemeProvider";

export default function ThemeToggle() {
  const { theme, toggleTheme } = useTheme();

  return (
    <button
      onClick={toggleTheme}
      className="w-7 h-7 flex items-center justify-center rounded-full text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-surface-tertiary)] transition-all active:scale-90"
      aria-label={theme === "dark" ? "切换浅色模式" : "切换深色模式"}
      title={theme === "dark" ? "切换浅色模式" : "切换深色模式"}
    >
      {/* Sun icon */}
      <svg
        className={`w-4 h-4 transition-transform duration-300 ${theme === "dark" ? "scale-0 absolute" : "scale-100"}`}
        viewBox="0 0 20 20"
        fill="currentColor"
      >
        <path d="M10 2.5a.5.5 0 0 1 .5.5v1a.5.5 0 0 1-1 0V3a.5.5 0 0 1 .5-.5ZM10 15.5a.5.5 0 0 1 .5.5v1a.5.5 0 0 1-1 0v-1a.5.5 0 0 1 .5-.5ZM4.4 4.4a.5.5 0 0 1 .7 0l.7.7a.5.5 0 1 1-.7.7l-.7-.7a.5.5 0 0 1 0-.7ZM13.5 13.5a.5.5 0 0 1 .7 0l.7.7a.5.5 0 0 1-.7.7l-.7-.7a.5.5 0 0 1 0-.7ZM2.5 10a.5.5 0 0 1 .5-.5h1a.5.5 0 0 1 0 1H3a.5.5 0 0 1-.5-.5ZM15.5 10a.5.5 0 0 1 .5-.5h1a.5.5 0 0 1 0 1h-1a.5.5 0 0 1-.5-.5ZM4.4 15.6a.5.5 0 0 1 0-.7l.7-.7a.5.5 0 0 1 .7.7l-.7.7a.5.5 0 0 1-.7 0ZM13.5 6.5a.5.5 0 0 1 0-.7l.7-.7a.5.5 0 1 1 .7.7l-.7.7a.5.5 0 0 1-.7 0ZM10 7a3 3 0 1 0 0 6 3 3 0 0 0 0-6Z" />
      </svg>
      {/* Moon icon */}
      <svg
        className={`w-4 h-4 transition-transform duration-300 ${theme === "dark" ? "scale-100" : "scale-0 absolute"}`}
        viewBox="0 0 20 20"
        fill="currentColor"
      >
        <path d="M16.76 13.29a6.5 6.5 0 0 1-8.05-8.05 6.5 6.5 0 1 0 8.05 8.05Z" />
      </svg>
    </button>
  );
}
