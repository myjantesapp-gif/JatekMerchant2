import assert from "node:assert/strict";
import test from "node:test";
import { isExpoPushToken, sendExpoPush } from "./expoPush";

function response(body: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    text: async () => JSON.stringify(body),
    json: async () => body,
  } as Response;
}

test("recognizes both Expo push token spellings", () => {
  assert.equal(isExpoPushToken("ExpoPushToken[abc123]"), true);
  assert.equal(isExpoPushToken("ExponentPushToken[abc123]"), true);
  assert.equal(isExpoPushToken("ExpoPushToken[abc 123]"), false);
  assert.equal(isExpoPushToken("not-an-expo-token"), false);
});

test("polls receipts and clears a token reported as not registered", async () => {
  const originalFetch = globalThis.fetch;
  const calls: string[] = [];
  const invalidTokens: string[] = [];
  let resolveReceipt: ((status: string) => void) | null = null;
  const receiptDone = new Promise<string>((resolve) => {
    resolveReceipt = resolve;
  });

  globalThis.fetch = (async (input: unknown) => {
    const url = String(input);
    calls.push(url);
    if (url.endsWith("/push/send")) {
      return response({ data: [{ status: "ok", id: "ticket-1" }] });
    }
    return response({
      data: {
        "ticket-1": {
          status: "error",
          message: "The device is no longer registered",
          details: { error: "DeviceNotRegistered" },
        },
      },
    });
  }) as typeof fetch;

  try {
    const startedAt = Date.now();
    const result = await sendExpoPush(
      {
        to: "ExpoPushToken[device-1]",
        title: "Test",
        body: "Test",
      },
      {
        onInvalidToken: (token) => {
          invalidTokens.push(token);
        },
        onReceiptStatus: (status) => {
          resolveReceipt?.(status);
        },
        receiptDelayMs: 0,
        receiptPollIntervalMs: 0,
      },
    );
    assert.ok(Date.now() - startedAt < 1_000, "receipt polling must not block dispatch");
    assert.equal(result.ticketAccepted, true);
    assert.equal(result.ticketCount, 1);
    assert.equal(result.expectedTicketCount, 1);
    assert.equal(result.receiptStatus, "pending");
    assert.equal(await receiptDone, "error");
    assert.deepEqual(invalidTokens, ["ExpoPushToken[device-1]"]);
    assert.deepEqual(calls, [
      "https://exp.host/--/api/v2/push/send",
      "https://exp.host/--/api/v2/push/getReceipts",
    ]);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("does not report ticket acceptance when Expo returns a mismatched ticket count", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async () =>
    response({
      data: [{
        status: "error",
        message: "one recipient rejected",
        details: { error: "MessageTooBig" },
      }],
    })) as typeof fetch;

  try {
    const result = await sendExpoPush([
      { to: "ExpoPushToken[device-1]", title: "Test", body: "One" },
      { to: "ExpoPushToken[device-2]", title: "Test", body: "Two" },
    ]);
    assert.equal(result.ticketAccepted, false);
    assert.equal(result.expectedTicketCount, 2);
    assert.equal(result.ticketCount, 1);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
