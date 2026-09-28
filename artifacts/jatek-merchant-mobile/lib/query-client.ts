import { AppState, Platform } from 'react-native';
import { QueryClient, focusManager, type QueryFunction } from '@tanstack/react-query';
import { API_BASE_URL, ApiError, requestJson, type RequestOptions } from '@/lib/api-core';

/** Pinned to https://api.jatek.app by explicit user requirement (no env override). */
export function getApiUrl(): string {
  return API_BASE_URL;
}

let currentToken: string | null = null;
let onUnauthorized: ((staleToken: string) => void) | null = null;

export function setSessionToken(token: string | null) { currentToken = token; }
export function getSessionToken() { return currentToken; }
export function setUnauthorizedHandler(fn: ((staleToken: string) => void) | null) { onUnauthorized = fn; }
/** Notify auth only when a raw request receives a 401 for its captured token. */
export function notifyUnauthorized(staleToken: string | null | undefined) {
  if (staleToken) onUnauthorized?.(staleToken);
}

/** Performs a request on the fixed host using the token captured at call time. */
export async function apiRequest(path: string, opts: Omit<RequestOptions, 'token'> & { token?: string | null } = {}) {
  const token = opts.token !== undefined ? opts.token : currentToken;
  try {
    return await requestJson(fetch, path, { ...opts, token });
  } catch (e) {
    // Only the token that actually received the 401 can be invalidated.
    if (e instanceof ApiError && e.status === 401) notifyUnauthorized(token);
    throw e;
  }
}

/** Private query key: [fullApiPath, { session }]. The token is sent as a header, never in the URL. */
export type SessionKey = readonly [string, { session: string | null }];
export function sessionKey(path: string, session: string | null): SessionKey {
  return [path, { session }] as const;
}

const defaultQueryFn: QueryFunction = async ({ queryKey, signal }) => {
  const [path, meta] = queryKey as unknown as SessionKey;
  if (typeof path !== 'string') throw new ApiError(-1, 'Clé de requête invalide.');
  const session = meta && typeof meta === 'object' && 'session' in meta ? meta.session : null;
  if (!session) throw new ApiError(401, 'Session absente.');
  return apiRequest(path, { signal, token: session });
};

// Tie React Query "focus" to app foreground on native so polling pauses in background.
if (Platform.OS !== 'web') {
  focusManager.setEventListener((setFocused) => {
    const sub = AppState.addEventListener('change', (s) => setFocused(s === 'active'));
    return () => sub.remove();
  });
}

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryFn: defaultQueryFn,
      staleTime: 30_000,
      // Show failed refreshes immediately; users can retry explicitly and orders
      // also refresh on their next foreground polling interval.
      retry: false,
    },
    mutations: { retry: false },
  },
});
