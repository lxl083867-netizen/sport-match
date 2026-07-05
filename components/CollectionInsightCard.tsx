import Link from "next/link";

export interface CollectionInsight {
  topGoals: string[];
  preferredDurations: string[];
  missingPhases: string[];
  riskWarnings: string[];
  trainingTendency: string;
  systemJudgment: string;
  gapText: string;
  nextAction: string;
  actionLabel: string;
  actionLink: string;
}

interface Props {
  insights: CollectionInsight;
}

const phaseLabels: Record<string, string> = {
  warmup: "热身偏少",
  stretch: "拉伸偏少",
};

function compactText(value: string) {
  return value.replace(/[。；，]$/u, "");
}

function buildHeadline(insights: CollectionInsight) {
  const goals = insights.topGoals.slice(0, 2);
  if (goals.length > 0) {
    return `你最近更像是在练：${goals.join(" + ")}`;
  }
  return "你的收藏已经露出训练倾向";
}

function buildPreferenceChips(insights: CollectionInsight) {
  return [
    ...insights.topGoals.slice(0, 3).map((label) => ({ label, tone: "goal" })),
    ...insights.preferredDurations.slice(0, 1).map((label) => ({ label, tone: "time" })),
    ...insights.riskWarnings.slice(0, 1).map((label) => ({ label: compactText(label), tone: "risk" })),
  ];
}

function buildHandledItems(insights: CollectionInsight) {
  const items: Array<{ label: string; detail: string }> = [];

  if (insights.missingPhases.length > 0) {
    items.push({
      label: "已补齐",
      detail: insights.missingPhases.map((phase) => phaseLabels[phase] || phase).join("、"),
    });
  }

  if (insights.riskWarnings.length > 0) {
    items.push({
      label: "已避开",
      detail: "膝盖或腰背压力较高的内容",
    });
  }

  items.push({
    label: "已优先",
    detail: "低门槛、可完成的组合",
  });

  return items.slice(0, 3);
}

function chipClass(tone: string) {
  if (tone === "time") {
    return "bg-[#fff7e8] text-[#9a5a00]";
  }
  if (tone === "risk") {
    return "bg-[#fff1f0] text-[#b42318]";
  }
  return "bg-[var(--color-brand-subtle)] text-[var(--color-brand)]";
}

export default function CollectionInsightCard({ insights }: Props) {
  const chips = buildPreferenceChips(insights);
  const handledItems = buildHandledItems(insights);

  return (
    <section className="max-w-[980px] mx-auto px-4 md:px-6 py-6">
      <div
        className="relative overflow-hidden bg-[var(--color-surface)] px-5 py-5 md:px-7 md:py-7"
        style={{ border: "0.5px solid var(--color-border)", borderRadius: "var(--radius-lg)" }}
      >
        <div className="absolute inset-x-0 top-0 h-1 bg-[linear-gradient(90deg,var(--color-brand),var(--color-success),var(--color-warning))]" />

        <div className="grid gap-6 md:grid-cols-[1.15fr_0.85fr] md:items-start">
          <div>
            <div className="flex items-center gap-2 mb-4">
              <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-[var(--color-brand-subtle)] text-[var(--color-brand)]">
                <svg className="h-3.5 w-3.5" viewBox="0 0 20 20" fill="none" aria-hidden="true">
                  <path d="M4 11.5 8 15l8-10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </span>
              <p className="text-[11px] text-[var(--color-text-tertiary)] font-semibold tracking-widest uppercase">
                收藏洞察
              </p>
            </div>

            <p className="text-[12px] text-[var(--color-text-tertiary)] mb-1.5">基于你收藏的视频</p>
            <h2 className="text-[24px] md:text-[28px] font-semibold leading-tight text-[var(--color-text-primary)]">
              {buildHeadline(insights)}
            </h2>

            <p className="mt-3 text-[15px] leading-relaxed text-[var(--color-text-secondary)] max-w-[620px]">
              {insights.trainingTendency}
            </p>

            {chips.length > 0 && (
              <div className="mt-4 flex flex-wrap gap-2">
                {chips.map((chip, index) => (
                  <span
                    key={`${chip.label}-${index}`}
                    className={`inline-flex items-center rounded-full px-3 py-1 text-[12px] font-medium ${chipClass(chip.tone)}`}
                  >
                    {chip.label}
                  </span>
                ))}
              </div>
            )}
          </div>

          <div className="md:border-l md:border-[var(--color-border)] md:pl-6">
            <p className="text-[13px] font-semibold text-[var(--color-text-primary)] mb-3">
              今日方案已自动处理
            </p>

            <div className="space-y-3">
              {handledItems.map((item) => (
                <div key={item.label} className="flex gap-3">
                  <span className="mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[rgba(52,199,89,0.12)] text-[var(--color-success)]">
                    <svg className="h-3 w-3" viewBox="0 0 20 20" fill="none" aria-hidden="true">
                      <path d="m5 10 3 3 7-7" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </span>
                  <p className="text-[14px] leading-relaxed text-[var(--color-text-secondary)]">
                    <span className="font-medium text-[var(--color-text-primary)]">{item.label}</span>
                    <span className="mx-1 text-[var(--color-text-tertiary)]">·</span>
                    {item.detail}
                  </p>
                </div>
              ))}
            </div>

            <p className="mt-4 border-t border-[var(--color-border)] pt-4 text-[13px] leading-relaxed text-[var(--color-text-secondary)]">
              {insights.systemJudgment}
            </p>
          </div>
        </div>

        <div className="mt-6 flex flex-col gap-3 border-t border-[var(--color-border)] pt-5 md:flex-row md:items-center md:justify-between">
          <div className="min-w-0">
            <p className="text-[12px] font-medium text-[var(--color-text-tertiary)] mb-1">下一步建议</p>
            <p className="text-[14px] leading-relaxed text-[var(--color-text-secondary)]">
              {insights.nextAction}
            </p>
          </div>
          <Link
            href={insights.actionLink}
            className="inline-flex shrink-0 items-center justify-center rounded-full bg-[#3b73ff] px-5 py-2.5 text-[14px] font-semibold text-white shadow-[0_14px_30px_rgba(59,115,255,0.24)] hover:bg-[#2f64e8] active:scale-[0.97]"
          >
            {insights.actionLabel}
          </Link>
        </div>
      </div>
    </section>
  );
}
