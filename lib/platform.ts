/**
 * Extract the embeddable video ID from a platform URL.
 * - B站: BVid from bilibili.com/video/{BVid}
 * - 小红书/抖音: no official embed, returns null
 */
export function extractVideoId(url: string, platform: string): string | null {
  if (platform === "bilibili") {
    const bvMatch = url.match(/bilibili\.com\/video\/(BV[a-zA-Z0-9]+)/i);
    if (bvMatch) return bvMatch[1];
    const avMatch = url.match(/bilibili\.com\/video\/av(\d+)/i);
    if (avMatch) return avMatch[1];
    const shortMatch = url.match(/b23\.tv\/([a-zA-Z0-9]+)/);
    if (shortMatch) return shortMatch[1];
    return null;
  }
  return null;
}

/** Whether this platform supports direct iframe embedding. */
export function supportsEmbed(platform: string): boolean {
  return platform === "bilibili";
}

export type PlaybackMode = "embedded" | "external";

/** Get the playback mode for a given platform. */
export function getPlaybackMode(platform: string): PlaybackMode {
  return platform === "bilibili" ? "embedded" : "external";
}

const playbackLabels: Record<string, string> = {
  bilibili: "站内播放",
  xiaohongshu: "跳转小红书",
  douyin: "跳转抖音",
};

/** Get a user-facing label describing how this platform's videos play. */
export function getPlaybackLabel(platform: string): string {
  return playbackLabels[platform] || "跳转原平台";
}

/** Shorthand for getPlaybackMode(platform) === "embedded". */
export function isEmbeddablePlatform(platform: string): boolean {
  return getPlaybackMode(platform) === "embedded";
}

/** Get the embed URL for supported platforms. */
export function getEmbedUrl(url: string, platform: string): string | null {
  if (platform === "bilibili") {
    const vid = extractVideoId(url, platform);
    if (!vid) return null;
    // BV ids are alphanumeric starting with BV; AV ids are numeric
    const param = /^BV/i.test(vid) ? `bvid=${vid}` : `aid=${vid}`;
    return `https://player.bilibili.com/player.html?${param}&page=1&high_quality=1&danmaku=0`;
  }
  return null;
}
