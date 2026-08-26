import { getApiBaseSafe } from "./apiBase";

/**
 * API media fields may contain either an external URL or a server-relative
 * App Storage URL. React Native Image requires an absolute URL for the latter.
 */
export function resolveMediaUrl(url?: string | null): string | undefined {
  if (!url) return undefined;
  if (/^[a-z][a-z\d+\-.]*:/i.test(url)) return url;
  return `${getApiBaseSafe()}${url.startsWith("/") ? url : `/${url}`}`;
}