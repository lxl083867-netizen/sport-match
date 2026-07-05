import Link from "next/link";

type HomeHeroProps = {
  userName: string;
  hasCollection: boolean;
  topGoals: string[];
};

export default function HomeHero({
  userName,
  hasCollection,
  topGoals,
}: HomeHeroProps) {
  const goalChips = topGoals.length > 0 ? topGoals.slice(0, 3) : ["低门槛", "可完成", "今天开始"];

  return (
    <div className="relative overflow-hidden bg-[var(--color-surface)] text-[var(--color-text-primary)]">
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute -top-16 -right-16 h-52 w-52 rounded-full bg-[#b9e8ff]" />
        <div className="absolute top-10 right-24 h-3 w-3 rounded-full bg-[#ff6847]" />
        <div className="absolute bottom-10 left-8 h-2.5 w-2.5 rounded-full bg-[#b8f24b]" />
        <div className="absolute bottom-0 left-0 right-0 h-28 bg-[linear-gradient(180deg,transparent,var(--color-surface))]" />
      </div>

      <div className="relative grid gap-7 md:grid-cols-[1.04fr_0.96fr] md:items-center px-5 pt-7 pb-8 md:px-9 md:pt-9 md:pb-10">
        <div>
          <p className="inline-flex max-w-full flex-wrap items-center gap-2 text-[20px] md:text-[24px] font-semibold leading-none tracking-[-0.02em]">
            <span className="text-[var(--color-text-secondary)]">Hi，</span>
            <span className="max-w-[260px] truncate text-[#315bd8] md:max-w-[360px]">
              {userName}
            </span>
            <span
              className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-[#f2ffd6] text-[#5c7e08]"
              aria-hidden="true"
            >
              <svg className="h-4 w-4" viewBox="0 0 20 20" fill="none">
                <path
                  d="M10 2.5 11.45 7.2 16 8.75 11.45 10.3 10 15 8.55 10.3 4 8.75 8.55 7.2 10 2.5Z"
                  fill="currentColor"
                />
              </svg>
            </span>
          </p>
          <h1 className="mt-4 max-w-[640px] text-[36px] md:text-[52px] font-semibold leading-[1.02] tracking-[-0.025em]">
            别让收藏夹里的视频继续吃灰啦！
          </h1>
          <p className="mt-5 max-w-[580px] text-[15px] md:text-[16px] leading-[1.8] text-[var(--color-text-secondary)]">
            已根据你的收藏夹推荐今日的训练方案，系统会根据您的训练反馈调整推荐，快来体验你的专属训练方案吧
          </p>

          <div className="mt-5 flex flex-wrap gap-2">
            {goalChips.map((chip, index) => (
              <span
                key={`${chip}-${index}`}
                className={[
                  "rounded-full px-3 py-1 text-[12px] font-medium",
                  index === 0 ? "bg-[#eaf0ff] text-[#315bd8]" : "",
                  index === 1 ? "bg-[#f2ffd6] text-[#5c7e08]" : "",
                  index >= 2 ? "bg-[#fff0e8] text-[#b44725]" : "",
                ].join(" ")}
              >
                {chip}
              </span>
            ))}
          </div>

          <p className="mt-6 text-[13px] text-[var(--color-text-secondary)]">
            {hasCollection ? "收藏还不够？" : "还没导入收藏？"}{" "}
            <Link href="/videos" className="font-semibold text-[#315bd8] hover:underline">
              继续导入收藏视频
            </Link>
          </p>
        </div>

        <div className="relative min-h-[260px] md:min-h-[330px]">
          <svg
            className="absolute inset-0 h-full w-full"
            viewBox="0 0 420 340"
            fill="none"
            aria-hidden="true"
          >
            <path
              d="M32 244C92 172 126 282 190 218C252 154 290 210 382 108"
              stroke="#9fb8ff"
              strokeWidth="3"
              strokeLinecap="round"
              strokeDasharray="8 12"
            />
            <circle cx="50" cy="236" r="15" fill="#3B73FF" />
            <circle cx="194" cy="216" r="15" fill="#B8F24B" />
            <circle cx="374" cy="112" r="15" fill="#FF6847" />
          </svg>

          <div className="home-float-pop absolute left-2 top-7 [--float-rotate:-6deg] rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)]/90 px-4 py-3 shadow-[var(--shadow-md)]">
            <p className="text-[11px] font-medium text-[var(--color-text-tertiary)]">收藏</p>
            <p className="mt-1 text-[16px] font-semibold text-[#3b73ff]">变成路线</p>
          </div>

          <div className="home-float-pop absolute right-3 top-16 [--float-rotate:4deg] rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)]/90 px-4 py-3 shadow-[var(--shadow-md)]">
            <p className="text-[11px] font-medium text-[var(--color-text-tertiary)]">跟练</p>
            <p className="mt-1 text-[16px] font-semibold text-[#ff6847]">自动记录</p>
          </div>

          <div className="absolute bottom-5 left-1/2 h-36 w-36 -translate-x-1/2 rounded-[42%] bg-[#6f35ff] shadow-[0_22px_50px_rgba(92,55,220,0.25)]">
            <div className="absolute -top-3 left-6 h-8 w-24 rounded-full bg-[#6f35ff]" />
            <div className="absolute -top-7 left-7 h-4 w-24 rotate-[8deg] rounded-full bg-[#ff6847]" />
            <div className="absolute left-8 top-12 h-9 w-9 rounded-full bg-white">
              <div className="absolute left-2 top-2 h-5 w-5 rounded-full bg-[#222326]" />
            </div>
            <div className="absolute right-8 top-12 h-9 w-9 rounded-full bg-white">
              <div className="absolute left-2 top-2 h-5 w-5 rounded-full bg-[#222326]" />
            </div>
            <div className="absolute -left-8 top-20 h-4 w-12 rotate-[-28deg] rounded-full bg-[#222326]" />
            <div className="absolute -right-7 top-16 h-4 w-11 rotate-[34deg] rounded-full bg-[#222326]" />
            <div className="absolute -bottom-3 left-7 h-5 w-9 rounded-full bg-[#ff6847]" />
            <div className="absolute -bottom-3 right-7 h-5 w-9 rounded-full bg-[#ff6847]" />
          </div>

          <div className="home-float-pop absolute bottom-7 right-8 [--float-rotate:-7deg] rounded-full bg-[#b8f24b] px-4 py-2 text-[13px] font-semibold text-[#2d3f05] shadow-[0_12px_28px_rgba(96,126,16,0.16)]">
            今天动起来
          </div>
          <div className="home-float-pop absolute right-8 top-4 [--float-rotate:0deg] text-[#3b73ff]">
            <svg className="h-12 w-12" viewBox="0 0 48 48" fill="none" aria-hidden="true">
              <path d="M25 4 9 26h13l-2 18 19-25H26l-1-15Z" fill="currentColor" />
            </svg>
          </div>
        </div>
      </div>
    </div>
  );
}
