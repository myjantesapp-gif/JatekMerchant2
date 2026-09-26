// Customer and merchant business data must use the canonical remote API. Never
// route requests through Metro, localhost, or a Replit preview server.
export const REMOTE_API_BASE = "https://api.jatek.app";

/** Resolves the only permitted mobile API host. */
export function getApiBase(): string {
  return REMOTE_API_BASE;
}

/** Safe variant retained for callers that should not crash during render. */
export function getApiBaseSafe(): string {
  return getApiBase();
}
