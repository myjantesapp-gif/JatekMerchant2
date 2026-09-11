import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import {
  notificationResponseKey,
  orderIdFromNotificationResponse,
} from "../lib/pushNotificationUtils";
import {
  createPushOperationQueue,
  withManualAbortTimeout,
} from "../lib/pushOperationQueue";

const testDirectory = dirname(fileURLToPath(import.meta.url));

function response(identifier: string, orderId: string | number) {
  return {
    notification: {
      request: {
        identifier,
        content: { data: { orderId } },
      },
    },
  };
}

test("uses the native response identifier for notification dedupe", () => {
  assert.equal(
    notificationResponseKey(response("response-1", 42)),
    "id:response-1",
  );
  assert.equal(
    notificationResponseKey(response("response-1", 42)),
    notificationResponseKey(response("response-1", 42)),
  );
  assert.notEqual(
    notificationResponseKey(response("response-1", 42)),
    notificationResponseKey(response("response-2", 42)),
  );
});

test("extracts only positive integer order IDs from response data", () => {
  assert.equal(orderIdFromNotificationResponse(response("response-1", "42")), 42);
  assert.equal(orderIdFromNotificationResponse(response("response-2", 0)), null);
  assert.equal(orderIdFromNotificationResponse({
    notification: { request: { content: { data: { orderId: "not-an-id" } } } },
  }), null);
});

test("serializes registration before detach across identity changes", async () => {
  const queue = createPushOperationQueue();
  const events: string[] = [];
  const registration = queue(async () => {
    events.push("register:start");
    await new Promise((resolve) => setTimeout(resolve, 5));
    events.push("register:end");
  });
  const detach = queue(async () => {
    events.push("detach");
  });

  await Promise.all([registration, detach]);
  assert.deepEqual(events, ["register:start", "register:end", "detach"]);
});

test("uses a manual abort timer compatible with React Native 0.81", async () => {
  await assert.rejects(
    withManualAbortTimeout(
      (signal) => new Promise<never>((_resolve, reject) => {
        signal.addEventListener("abort", () => reject(new Error("aborted")), { once: true });
      }),
      5,
    ),
    /aborted/,
  );

  const source = readFileSync(resolve(testDirectory, "../hooks/usePushNotifications.ts"), "utf8");
  assert.equal(source.includes("AbortSignal.timeout"), false);
  assert.match(source, /getExpoPushTokenAsync/);
  assert.match(source, /registerPushToken/);
});
