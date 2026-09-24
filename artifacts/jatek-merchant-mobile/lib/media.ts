import { getApiUrl } from '@/lib/api';

export function mediaUri(path: string | null | undefined): string | undefined {
  if (!path) return undefined;
  if (/^https?:\/\//i.test(path)) return path;
  return new URL(path.replace(/^\/+/, ''), `${getApiUrl()}/`).toString();
}