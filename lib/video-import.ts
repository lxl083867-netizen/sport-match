/**
 * Video import: parse platform URLs → fetch metadata → create DB records.
 *
 * Supported platforms: bilibili (full), xiaohongshu/douyin (basic).
 */

interface VideoMetadata {
  title: string;
  url: string;
  platform: string;
  sourceAuthor: string;
  duration: number | null;
  thumbnailUrl: string | null;
}

interface ParseResult {
  platform: string;
  videoId: string; // platform-native identifier (bvid for B站)
  canonicalUrl: string;
}

/**
 * Detect platform and extract video identifier from a URL.
 */
export function parseVideoUrl(raw: string): ParseResult | null {
  const url = raw.trim();

  // Raw BV/AV numbers (no URL wrapper)
  const rawBv = url.match(/^(BV[\w]+)$/i);
  if (rawBv) {
    const bvid = rawBv[1];
    return { platform: "bilibili", videoId: bvid, canonicalUrl: `https://www.bilibili.com/video/${bvid}` };
  }
  const rawAv = url.match(/^(?:av|AV)(\d+)$/);
  if (rawAv) {
    const avid = rawAv[1];
    return { platform: "bilibili", videoId: `av${avid}`, canonicalUrl: `https://www.bilibili.com/video/av${avid}` };
  }

  // B站: https://www.bilibili.com/video/BV1xx...  or  https://b23.tv/xxxxx
  const bvMatch = url.match(/bilibili\.com\/video\/(BV[\w]+)/i);
  if (bvMatch) {
    const bvid = bvMatch[1];
    return { platform: "bilibili", videoId: bvid, canonicalUrl: `https://www.bilibili.com/video/${bvid}` };
  }
  // B站 AV号 URL
  const avMatch = url.match(/bilibili\.com\/video\/av(\d+)/i);
  if (avMatch) {
    const avid = avMatch[1];
    return { platform: "bilibili", videoId: `av${avid}`, canonicalUrl: `https://www.bilibili.com/video/av${avid}` };
  }
  // Short B站 links
  const b23Match = url.match(/b23\.tv\/([\w]+)/i);
  if (b23Match) {
    return { platform: "bilibili_short", videoId: b23Match[1], canonicalUrl: url };
  }

  // 小红书: 多种格式
  //   https://www.xiaohongshu.com/explore/xxxxx
  //   https://www.xiaohongshu.com/discovery/item/xxxxx
  //   https://xhslink.com/xxxxx  (分享短链)
  const xhsMatch = url.match(/xiaohongshu\.com\/(?:explore|discovery\/item)\/([\w-]+)/i);
  if (xhsMatch) {
    return { platform: "xiaohongshu", videoId: xhsMatch[1], canonicalUrl: url };
  }
  const xhsShort = url.match(/xhslink\.com\/([\w-]+)/i);
  if (xhsShort) {
    return { platform: "xiaohongshu", videoId: xhsShort[1], canonicalUrl: url };
  }

  // 抖音: https://www.douyin.com/video/xxxxx  or  https://v.douyin.com/xxxxx/
  const dyMatch = url.match(/douyin\.com\/video\/(\d+)/i);
  if (dyMatch) {
    return { platform: "douyin", videoId: dyMatch[1], canonicalUrl: `https://www.douyin.com/video/${dyMatch[1]}` };
  }
  const dyShort = url.match(/v\.douyin\.com\/([\w]+)/i);
  if (dyShort) {
    return { platform: "douyin_short", videoId: dyShort[1], canonicalUrl: url };
  }

  return null;
}

/**
 * Fetch video metadata from platform APIs.
 */
export async function fetchMetadata(parsed: ParseResult): Promise<VideoMetadata> {
  if (parsed.platform === "bilibili") {
    return fetchBilibiliMeta(parsed.videoId, parsed.canonicalUrl);
  }
  if (parsed.platform === "bilibili_short") {
    const resolved = await resolveB23Url(parsed.canonicalUrl);
    if (resolved) {
      const reparsed = parseVideoUrl(resolved);
      if (reparsed && reparsed.platform === "bilibili") {
        return fetchBilibiliMeta(reparsed.videoId, reparsed.canonicalUrl);
      }
    }
    return {
      title: "B站视频",
      url: parsed.canonicalUrl,
      platform: "bilibili",
      sourceAuthor: "未知",
      duration: null,
      thumbnailUrl: null,
    };
  }

  // 小红书
  if (parsed.platform === "xiaohongshu") {
    const meta = await scrapeWebMeta(parsed.canonicalUrl, "xiaohongshu");
    return {
      title: meta.title, url: parsed.canonicalUrl, platform: "xiaohongshu",
      sourceAuthor: meta.author, duration: null, thumbnailUrl: null,
    };
  }

  // 抖音 (douyin_short resolved by caller before reaching here)
  const meta = await scrapeWebMeta(parsed.canonicalUrl, "douyin");
  return {
    title: meta.title, url: parsed.canonicalUrl, platform: "douyin",
    sourceAuthor: meta.author, duration: null, thumbnailUrl: null,
  };
}

/**
 * Resolve a short link (b23.tv, xhslink.com, v.douyin.com) to the actual URL.
 */
export async function resolveShortLink(shortUrl: string): Promise<string | null> {
  const headers = { "User-Agent": "SportMatch/1.0" };
  try {
    // Try HEAD first
    const headRes = await fetch(shortUrl, { method: "HEAD", redirect: "manual", headers });
    const loc = headRes.headers.get("location");
    if (loc) return loc;
  } catch { /* ignore */ }

  // xhslink.com returns 404 for HEAD — try GET with redirect:manual
  try {
    const getRes = await fetch(shortUrl, { method: "GET", redirect: "manual", headers });
    const loc = getRes.headers.get("location");
    if (loc) return loc;
    // If no redirect header, consume body to free resources
    await getRes.body?.cancel();
  } catch { /* ignore */ }

  return null;
}

/**
 * Extract a JSON object from window.__INITIAL_STATE__ using bracket counting.
 */
function extractInitialState(html: string): Record<string, unknown> | null {
  const prefix = "window.__INITIAL_STATE__=";
  const startIdx = html.indexOf(prefix);
  if (startIdx === -1) return null;

  const jsonStart = startIdx + prefix.length;
  if (html[jsonStart] !== "{") return null;

  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let i = jsonStart; i < html.length; i++) {
    const ch = html[i];
    if (escaped) { escaped = false; continue; }
    if (ch === "\\") { escaped = true; continue; }
    if (ch === '"' && !escaped) { inString = !inString; continue; }
    if (inString) continue;
    if (ch === "{") depth++;
    if (ch === "}") {
      depth--;
      if (depth === 0) {
        try {
          return JSON.parse(html.slice(jsonStart, i + 1).replace(/undefined/g, "null"));
        } catch { return null; }
      }
    }
  }
  return null;
}

/**
 * Scrape a web page for video title and author metadata.
 * Used for platforms without public APIs (小红书, 抖音).
 */
async function scrapeWebMeta(url: string, platform: "xiaohongshu" | "douyin"): Promise<{ title: string; author: string }> {
  const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);

  try {
    const res = await fetch(url, {
      headers: { "User-Agent": UA, "Accept": "text/html", "Accept-Language": "zh-CN,zh;q=0.9" },
      signal: controller.signal,
      redirect: "follow",
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const html = await res.text();

    // Title: prefer __INITIAL_STATE__ (most accurate), then OG meta, then <title>
    let title = "";
    let author = "未知";

    if (platform === "xiaohongshu") {
      const state = extractInitialState(html);
      if (state) {
        const note = (state as any)?.note;
        if (note?.title) title = note.title;
        const user = note?.user;
        if (user?.nickname) author = user.nickname;
        else if (user?.name) author = user.name;
      }
      if (author === "未知") {
        const nm = html.match(/"nickname"\s*:\s*"([^"]+)"/);
        if (nm) author = nm[1];
      }
    } else {
      const dm = html.match(/"nickname"\s*:\s*"([^"]+)"/);
      if (dm) author = dm[1];
    }

    // Fall back to <title> / OG meta if __INITIAL_STATE__ didn't have title
    if (!title) {
      const ogTitle = html.match(/<meta[^>]+property="og:title"[^>]+content="([^"]+)"/i);
      if (ogTitle) {
        title = ogTitle[1];
      } else {
        const tm = html.match(/<title[^>]*>([^<]+)<\/title>/i);
        title = tm ? tm[1].trim() : "";
      }
    }
    title = title.replace(/\s*[-–—|｜]\s*(小红书|抖音|Douyin|Xiaohongshu|RED|西瓜视频).*$/i, "").trim();

    return {
      title: title || `${platform === "xiaohongshu" ? "小红书" : "抖音"}视频`,
      author,
    };
  } catch (e) {
    console.warn("[scrapeWebMeta] failed for", url, e instanceof Error ? e.message : e);
    return {
      title: `${platform === "xiaohongshu" ? "小红书" : "抖音"}视频`,
      author: "未知",
    };
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * Resolve a b23.tv short link to the actual B站 video URL.
 */
async function resolveB23Url(shortUrl: string): Promise<string | null> {
  try {
    const res = await fetch(shortUrl, {
      method: "HEAD",
      redirect: "manual",
      headers: { "User-Agent": "SportMatch/1.0" },
    });
    const location = res.headers.get("location");
    if (location) return location;
  } catch {
    // ignore
  }
  return null;
}

async function fetchBilibiliMeta(videoId: string, fallbackUrl: string): Promise<VideoMetadata> {
  try {
    const isAv = /^av\d+$/i.test(videoId);
    const param = isAv ? `aid=${videoId.replace(/^av/i, "")}` : `bvid=${videoId}`;
    const res = await fetch(
      `https://api.bilibili.com/x/web-interface/view?${param}`,
      { headers: { "User-Agent": "SportMatch/1.0", Referer: "https://www.bilibili.com" } }
    );
    if (res.ok) {
      const json = await res.json();
      if (json.code === 0) {
        const d = json.data;
        return {
          title: d.title || "未知标题",
          url: fallbackUrl,
          platform: "bilibili",
          sourceAuthor: d.owner?.name || "未知",
          duration: d.duration || null,
          thumbnailUrl: d.pic || null,
        };
      }
    }
  } catch {
    // API call failed, fall through to basic metadata
  }
  return {
    title: "B站视频",
    url: fallbackUrl,
    platform: "bilibili",
    sourceAuthor: "未知",
    duration: null,
    thumbnailUrl: null,
  };
}
