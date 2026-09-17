const VIEW_SESSION_TTL_MS = 30 * 60 * 1000;
const MAX_DEDUPE_ENTRIES = 10_000;

export function normalizeShortViewCount(value: unknown): number {
  const count = Number(value);
  return Number.isSafeInteger(count) && count >= 0 ? count : 0;
}

/** Process-local retry dedupe; the mobile also sends only once per player session. */
export class ShortViewDeduper {
  private readonly seen = new Map<string, number>();

  claim(shortId: number, sessionId: string, now = Date.now()): boolean {
    const key = `${shortId}:${sessionId}`;
    const expiry = this.seen.get(key);
    if (expiry !== undefined && expiry > now) return false;

    if (this.seen.size >= MAX_DEDUPE_ENTRIES) {
      for (const [candidate, candidateExpiry] of this.seen) {
        if (candidateExpiry <= now) this.seen.delete(candidate);
      }
      if (this.seen.size >= MAX_DEDUPE_ENTRIES) {
        const oldest = this.seen.keys().next().value;
        if (oldest) this.seen.delete(oldest);
      }
    }
    this.seen.set(key, now + VIEW_SESSION_TTL_MS);
    return true;
  }

  release(shortId: number, sessionId: string): void {
    this.seen.delete(`${shortId}:${sessionId}`);
  }
}