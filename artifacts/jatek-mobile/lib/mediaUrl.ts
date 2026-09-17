import { getApiBaseSafe } from "./apiBase";

/**
 * API media fields may contain either an external URL or a server-relative
 * App Storage URL. React Native Image requires an absolute URL for the latter.
 */
export function resolveMediaUrl(url?: string | null): string | undefined {
  const value = url?.trim();
  if (!value) return undefined;
  const normalizedValue = value.startsWith("//") ? `https:${value}` : value;

  // Dashboard users often paste a YouTube URL without the scheme. Treat it as
  // an external URL instead of accidentally requesting it from the API host.
  if (/^(?:www\.)?(?:youtube\.com|youtu\.be)\//i.test(normalizedValue)) {
    return `https://${normalizedValue}`;
  }

  const canonicalPath = (pathname: string) =>
    pathname.replace(/^\/?objects\/(?=(?:images|logos|banners|medias|shorts|splash|uploads)\/)/i, "/api/storage/objects/");

  // Only network URLs are valid backend-driven media. Reject persisted blob,
  // file, javascript and other schemes instead of handing unsafe/invalid
  // sources to native Image or WebView.
  if (/^[a-z][a-z\d+\-.]*:/i.test(normalizedValue)) {
    try {
      const parsed = new URL(normalizedValue);
      if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return undefined;
      const pathname = canonicalPath(parsed.pathname);
      return pathname === parsed.pathname
        ? parsed.toString()
        : `${parsed.origin}${pathname}${parsed.search}${parsed.hash}`;
    } catch {
      return undefined;
    }
  }

  if (normalizedValue.startsWith("#") || normalizedValue.startsWith("?")) return undefined;
  const path = canonicalPath(normalizedValue.startsWith("/") ? normalizedValue : `/${normalizedValue}`);
  return `${getApiBaseSafe()}${path}`;
}

/** Resolves and de-duplicates fallback media sources in priority order. */
export function getMediaUrlCandidates(
  ...urls: Array<string | null | undefined>
): string[] {
  return [...new Set(urls.map(resolveMediaUrl).filter((url): url is string => Boolean(url)))];
}

/** Extracts a YouTube video id from watch, Shorts, embed, live, or short URLs. */
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

    return videoId && /^[\w-]{11}$/.test(videoId) ? videoId : null;
  } catch {
    return null;
  }
}

/** Real YouTube poster used when a Short has no readable App Storage image. */
export function getYouTubeThumbnailUrl(url?: string | null): string | undefined {
  const videoId = getYouTubeVideoId(url);
  return videoId ? `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg` : undefined;
}