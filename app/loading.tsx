export default function Loading() {
  return (
    <div className="max-w-[980px] mx-auto px-6 pt-8 pb-2 animate-fade-in">
      {/* Greeting skeleton */}
      <div className="mb-6">
        <div className="h-10 w-48 bg-[var(--color-surface-secondary)] animate-pulse" />
        <div className="h-5 w-72 bg-[var(--color-surface-secondary)] animate-pulse mt-2" />
      </div>

      {/* Plan card skeleton */}
      <div className="bg-[var(--color-surface)] p-5 md:p-8" style={{ border: "0.5px solid var(--color-border)", borderRadius: "var(--radius-lg)" }}>
        <div className="text-center py-12">
          <div className="w-12 h-12 rounded-full bg-[var(--color-brand-subtle)] flex items-center justify-center mx-auto mb-4">
            <svg className="w-6 h-6 text-[var(--color-brand)]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10" />
              <path d="M12 6v6l4 2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
          <p className="text-[15px] font-medium text-[var(--color-text-secondary)]">正在生成今日训练方案</p>
          <p className="text-[13px] text-[var(--color-text-tertiary)] mt-1">根据你的画像和收藏，为你匹配最适合的训练</p>
        </div>
      </div>
    </div>
  );
}
