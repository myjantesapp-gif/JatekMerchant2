/**
 * Expo Push Notification dispatcher.
 *
 * Uses the Expo Push API (https://exp.host/--/api/v2/push/send) to deliver
 * remote notifications to drivers even when the app is fully closed.
 * Chunks are capped at 100 recipients per request (Expo limit). Tickets are
 * followed by bounded receipt polling so token-specific failures can be
 * cleaned up without making API requests wait indefinitely.
 *
 * This module is intentionally best-effort: individual ticket/receipt errors
 * are logged but never thrown so they never break the calling request flow.
 * A successful result means Expo accepted the ticket; receipt outcomes are
 * reported asynchronously and never prove APNs/FCM delivery to a device.
 */

const EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send";
const EXPO_RECEIPTS_URL = "https://exp.host/--/api/v2/push/getReceipts";
const MAX_RECEIPT_IDS_PER_REQUEST = 300;
const MAX_RECEIPT_QUEUE_LENGTH = 1_000;
// Expo asks callers to wait before querying receipts. This worker is
// intentionally in-memory; a process restart drops queued receipt checks,
// while the ticket acceptance response remains correct.
const DEFAULT_RECEIPT_DELAY_MS = 15_000;
const DEFAULT_RECEIPT_POLL_INTERVAL_MS = 1_000;
const DEFAULT_RECEIPT_TIMEOUT_MS = 10_000;
const DEFAULT_REQUEST_TIMEOUT_MS = 10_000;

/** Expo has used both spellings for push tokens over time. */
export function isExpoPushToken(token: unknown): token is string {
  return typeof token === "string" &&
    /^(?:Expo|Exponent)PushToken\[[^\]\s]+\]$/.test(token);
}

export type PushMessage = {
  to: string | string[];
  title: string;
  body: string;
  data?: Record<string, unknown>;
  sound?: "default" | null;
  badge?: number;
  priority?: "default" | "normal" | "high";
  channelId?: string;
  ttl?: number;
};

type ExpoTicket =
  | { status: "ok"; id: string }
  | { status: "error"; message: string; details?: { error?: string } };

type ExpoReceipt =
  | { status: "ok" }
  | { status: "error"; message: string; details?: { error?: string } };

export type ExpoPushOptions = {
  /**
   * Called for tokens that Expo reports as permanently invalid. Callers should
   * clear only a row that still contains this exact token.
   */
  onInvalidToken?: (token: string) => Promise<void> | void;
  /** Called later by the bounded in-memory receipt worker. */
  onReceiptStatus?: (status: ExpoReceiptStatus) => Promise<void> | void;
  /** Primarily useful for deterministic unit tests. */
  receiptDelayMs?: number;
  /** Primarily useful for deterministic unit tests. */
  receiptPollIntervalMs?: number;
  /** Primarily useful for deterministic unit tests. */
  receiptTimeoutMs?: number;
};

export type ExpoReceiptStatus = "ok" | "error" | "timed_out";

export type ExpoPushResult = {
  /** True when Expo returned an accepted ticket for every expected message. */
  ticketAccepted: boolean;
  expectedTicketCount: number;
  ticketCount: number;
  /** Receipt checks are asynchronous and normally start as pending. */
  receiptStatus: "pending" | "not_requested" | "queue_full";
};

type TicketWithToken = { ticketId: string; token: string };

async function notifyInvalidToken(
  token: string,
  onInvalidToken?: (token: string) => Promise<void> | void,
): Promise<void> {
  if (!onInvalidToken) return;
  try {
    await onInvalidToken(token);
  } catch (error) {
    console.warn("[expoPush] invalid-token cleanup failed:", error);
  }
}

function receiptErrorCode(receipt: Extract<ExpoReceipt, { status: "error" }>): string {
  return receipt.details?.error ?? "UNKNOWN";
}

async function pollExpoReceipts(
  tickets: TicketWithToken[],
  options: ExpoPushOptions,
): Promise<ExpoReceiptStatus> {
  if (!tickets.length) return "ok";

  const pollIntervalMs = Math.max(0, options.receiptPollIntervalMs ?? DEFAULT_RECEIPT_POLL_INTERVAL_MS);
  const timeoutMs = Math.max(0, options.receiptTimeoutMs ?? DEFAULT_RECEIPT_TIMEOUT_MS);
  const pending = new Map(tickets.map((ticket) => [ticket.ticketId, ticket.token]));
  const deadline = Date.now() + timeoutMs;
  let allKnownReceiptsSucceeded = true;

  while (pending.size > 0) {
    if (Date.now() >= deadline) {
      console.warn(`[expoPush] receipt polling timed out with ${pending.size} pending receipt(s)`);
      return "timed_out";
    }

    const ids = Array.from(pending.keys());
    for (let i = 0; i < ids.length; i += MAX_RECEIPT_IDS_PER_REQUEST) {
      const remainingBeforeRequest = deadline - Date.now();
      if (remainingBeforeRequest <= 0) break;
      const chunkIds = ids.slice(i, i + MAX_RECEIPT_IDS_PER_REQUEST);
      try {
        const res = await fetch(EXPO_RECEIPTS_URL, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Accept: "application/json",
          },
          body: JSON.stringify({ ids: chunkIds }),
          signal: AbortSignal.timeout(Math.min(DEFAULT_REQUEST_TIMEOUT_MS, remainingBeforeRequest)),
        });
        if (!res.ok) {
          console.warn(`[expoPush] receipt HTTP ${res.status}:`, await res.text());
          continue;
        }

        const json = (await res.json()) as { data?: Record<string, ExpoReceipt> };
        for (const [ticketId, receipt] of Object.entries(json.data ?? {})) {
          const token = pending.get(ticketId);
          if (!token) continue;
          pending.delete(ticketId);
          if (receipt.status === "error") {
            allKnownReceiptsSucceeded = false;
            const code = receiptErrorCode(receipt);
            console.warn("[expoPush] receipt error:", {
              message: receipt.message,
              code,
            });
            if (code === "DeviceNotRegistered") {
              await notifyInvalidToken(token, options.onInvalidToken);
            }
          }
        }
      } catch (error) {
        // Ticket acceptance is still useful when the receipt service is
        // temporarily unavailable. Keep pending IDs until the bounded
        // deadline rather than turning a transient poll failure into a
        // potentially misleading delivery failure.
        console.warn("[expoPush] receipt polling failed:", error);
      }
    }

    if (pending.size === 0) break;
    const remainingMs = deadline - Date.now();
    if (remainingMs <= 0) break;
    await new Promise((resolve) => setTimeout(resolve, Math.min(pollIntervalMs, remainingMs)));
  }

  return pending.size > 0
    ? "timed_out"
    : allKnownReceiptsSucceeded
      ? "ok"
      : "error";
}

type ReceiptJob = {
  tickets: TicketWithToken[];
  options: ExpoPushOptions;
};

const receiptQueue: ReceiptJob[] = [];
let receiptWorkerRunning = false;

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, Math.max(0, ms)));
}

async function drainReceiptQueue(): Promise<void> {
  if (receiptWorkerRunning) return;
  receiptWorkerRunning = true;
  try {
    while (receiptQueue.length > 0) {
      const job = receiptQueue.shift()!;
      await delay(job.options.receiptDelayMs ?? DEFAULT_RECEIPT_DELAY_MS);
      let status: ExpoReceiptStatus;
      try {
        status = await pollExpoReceipts(job.tickets, job.options);
      } catch (error) {
        status = "error";
        console.warn("[expoPush] receipt worker failed:", error);
      }
      try {
        await job.options.onReceiptStatus?.(status);
      } catch (error) {
        console.warn("[expoPush] receipt status callback failed:", error);
      }
    }
  } finally {
    receiptWorkerRunning = false;
    if (receiptQueue.length > 0) void drainReceiptQueue();
  }
}

function enqueueReceiptPolling(tickets: TicketWithToken[], options: ExpoPushOptions): boolean {
  if (!tickets.length) return true;
  if (receiptQueue.length >= MAX_RECEIPT_QUEUE_LENGTH) {
    console.warn("[expoPush] receipt queue is full; tickets will not be polled");
    return false;
  }
  receiptQueue.push({ tickets, options });
  void drainReceiptQueue();
  return true;
}

/**
 * Send one or more push messages. `to` may be a single token or an array.
 * Returns ticket acceptance immediately. Receipt polling happens in the
 * bounded in-memory worker, after Expo's recommended delay; a ticket result
 * must not be described as APNs/FCM delivery.
 */
export async function sendExpoPush(
  messages: PushMessage | PushMessage[],
  options: ExpoPushOptions = {},
): Promise<ExpoPushResult> {
  const batch = Array.isArray(messages) ? messages : [messages];
  if (!batch.length) {
    return {
      ticketAccepted: true,
      expectedTicketCount: 0,
      ticketCount: 0,
      receiptStatus: "not_requested",
    };
  }

  // Expo allows max 100 messages per request
  const chunks: PushMessage[][] = [];
  for (let i = 0; i < batch.length; i += 100) {
    chunks.push(batch.slice(i, i + 100));
  }

  let ticketAccepted = true;
  let ticketCount = 0;
  let receiptStatus: ExpoPushResult["receiptStatus"] = "not_requested";
  for (const chunk of chunks) {
    try {
      const res = await fetch(EXPO_PUSH_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify(chunk),
        signal: AbortSignal.timeout(DEFAULT_REQUEST_TIMEOUT_MS),
      });

      if (!res.ok) {
        console.error(`[expoPush] HTTP ${res.status}:`, await res.text());
        ticketAccepted = false;
        continue;
      }

      const json = (await res.json()) as { data?: ExpoTicket[] };
      const ticketsInResponse = Array.isArray(json.data) ? json.data : [];
      ticketCount += ticketsInResponse.length;
      if (ticketsInResponse.length !== chunk.length) {
        ticketAccepted = false;
        console.warn("[expoPush] ticket count mismatch:", {
          expected: chunk.length,
          received: ticketsInResponse.length,
        });
      }
      const tickets: TicketWithToken[] = [];
      for (const [index, ticket] of ticketsInResponse.entries()) {
        if (ticket.status === "error") {
          ticketAccepted = false;
          console.warn("[expoPush] ticket error:", {
            message: ticket.message,
            code: ticket.details?.error ?? "UNKNOWN",
          });
          const token = chunk[index]?.to;
          const tokenValue = Array.isArray(token) ? token[0] : token;
          if (
            ticket.details?.error === "DeviceNotRegistered" &&
            typeof tokenValue === "string"
          ) {
            await notifyInvalidToken(tokenValue, options.onInvalidToken);
          }
        } else if (typeof ticket.id === "string") {
          const token = chunk[index]?.to;
          const tokenValue = Array.isArray(token) ? token[0] : token;
          if (typeof tokenValue === "string") {
            tickets.push({ ticketId: ticket.id, token: tokenValue });
          }
        } else {
          ticketAccepted = false;
          console.warn("[expoPush] malformed success ticket:", { index });
        }
      }
      if (tickets.length > 0) {
        receiptStatus = enqueueReceiptPolling(tickets, options) ? "pending" : "queue_full";
      }
    } catch (err) {
      console.error("[expoPush] dispatch failed:", err);
      ticketAccepted = false;
    }
  }
  return {
    ticketAccepted,
    expectedTicketCount: batch.length,
    ticketCount,
    receiptStatus,
  };
}

/**
 * Convenience — notify a list of drivers with their push tokens.
 * Filters out blank/invalid tokens automatically.
 */
export async function notifyDrivers(
  tokens: (string | null | undefined)[],
  title: string,
  body: string,
  data?: Record<string, unknown>,
  opts?: Partial<Omit<PushMessage, "to" | "title" | "body" | "data">> & ExpoPushOptions,
): Promise<boolean> {
  const valid = Array.from(new Set(tokens.filter(isExpoPushToken)));
  if (!valid.length) return false;

  const {
    onInvalidToken,
    onReceiptStatus,
    receiptDelayMs,
    receiptPollIntervalMs,
    receiptTimeoutMs,
    ...messageOptions
  } = opts ?? {};
  const messages: PushMessage[] = valid.map((token) => ({
    to: token,
    title,
    body,
    data: data ?? {},
    sound: "default",
    priority: "high",
    channelId: "incoming-order",
    ttl: 60,
    ...messageOptions,
  }));

  const result = await sendExpoPush(messages, {
    onInvalidToken,
    onReceiptStatus,
    receiptDelayMs,
    receiptPollIntervalMs,
    receiptTimeoutMs,
  });
  return result.ticketAccepted;
}
