import { getApiBaseSafe } from "./apiBase";

/**
 * API media fields may contain either an external URL or a server-relative
 * App Storage URL. React Native Image requires an absolute URL for the latter.
 */
export function resolveMediaUrl(url?: string | null): string | undefined {
  const value = url?.trim();
  if (!value) return undefined;
  if (value.startsWith("//")) return `https:${value}`;
  if (/^[a-z][a-z\d+\-.]*:/i.test(value)) return value;

  // Dashboard users often paste a YouTube URL without the scheme. Treat it as
  // an external URL instead of accidentally requesting it from the API host.
  if (/^(?:www\.)?(?:youtube\.com|youtu\.be)\//i.test(value)) {
    return `https://${value}`;
  }

  return `${getApiBaseSafe()}${value.startsWith("/") ? value : `/${value}`}`;
}

/** Extracts a YouTube video id from watch, Shorts, embed, or short URLs. */
export function getYouTubeVideoId(url?: string | null): string | null {
  const resolved = resolveMediaUrl(url);
  if (!resolved) return null;

  try {
    const parsed = new URL(resolved);
    const host = parsed.hostname.toLowerCase().replace(/^www\./, "");
    if (host !== "youtu.be" && host !== "youtube.com" && !host.endsWith(".youtube.com")) return null;

    const path = parsed.pathname.replace(/\/+/g, "/");
    const segments = path.split("/").filter(Boolean);
    let videoId = parsed.searchParams.get("v");
    if (host === "youtu.be") videoId = segments[0] ?? null;
    if (segments[0]?.toLowerCase() === "embed" || segments[0]?.toLowerCase() === "shorts" || segments[0]?.toLowerCase() === "live") {
      videoId = segments[1] ?? null;
    }

    return videoId && /^[\w-]{6,}$/.test(videoId) ? videoId : null;
  } catch {
    return null;
  }
}

/** Real YouTube poster used when a Short has no readable App Storage image. */
export function getYouTubeThumbnailUrl(url?: string | null): string | undefined {
  const videoId = getYouTubeVideoId(url);
  return videoId ? `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg` : undefined;
}