const platformConfig: Record<string, { label: string }> = {
  bilibili: { label: "B站" },
  xiaohongshu: { label: "小红书" },
  douyin: { label: "抖音" },
};

export default function PlatformLogo({ platform, size = 18 }: { platform: string; size?: number }) {
  const config = platformConfig[platform] || { label: platform };

  return (
    <span
      className="inline-flex items-center justify-center font-semibold bg-[var(--color-surface-tertiary)] text-[var(--color-text-secondary)]"
      style={{ width: size, height: size, fontSize: size * 0.45, borderRadius: 3 }}
    >
      {config.label.charAt(0)}
    </span>
  );
}

export function PlatformLabel({ platform }: { platform: string }) {
  const config = platformConfig[platform] || { label: platform };
  return (
    <span className="inline-flex text-[11px] font-medium text-[var(--color-text-secondary)]">
      {config.label}
    </span>
  );
}

export { platformConfig };
