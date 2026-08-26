export const BACKEND_TOKEN_KEY = "jatek_backend_token";
export const BACKEND_SESSION_EXPIRED_EVENT = "jatek:backend-session-expired";
const BACKEND_SESSION_EXPIRED_FLAG = "jatek:backend-session-expired-message";

/** Clears an intentionally ended session without showing an expiry message. */
export function clearBackendSession(): void {
  localStorage.removeItem(BACKEND_TOKEN_KEY);
}

/**
 * Ends the session exactly once after a protected API answers 401. Later
 * failing requests are ignored because the token has already been removed.
 */
export function endBackendSession(): void {
  if (!localStorage.getItem(BACKEND_TOKEN_KEY)) return;
  clearBackendSession();
  sessionStorage.setItem(BACKEND_SESSION_EXPIRED_FLAG, "true");
  window.dispatchEvent(new CustomEvent(BACKEND_SESSION_EXPIRED_EVENT));
}

/** Returns whether the login page should show the one-time expiry message. */
export function consumeBackendSessionExpiredMessage(): boolean {
  if (sessionStorage.getItem(BACKEND_SESSION_EXPIRED_FLAG) !== "true") return false;
  sessionStorage.removeItem(BACKEND_SESSION_EXPIRED_FLAG);
  return true;
}

export function isUnauthorizedError(error: unknown): boolean {
  return Boolean(
    error &&
      typeof error === "object" &&
      "status" in error &&
      (error as { status?: unknown }).status === 401,
  );
}