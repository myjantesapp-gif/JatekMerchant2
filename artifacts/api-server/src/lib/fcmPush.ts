/**
 * Firebase Cloud Messaging (FCM) push dispatcher.
 *
 * Initialises firebase-admin once from the FIREBASE_SERVICE_ACCOUNT env var
 * (JSON string of the service account credentials).  Falls back to a local
 * credentials file at .secrets/firebase-adminsdk.json when the env var is
 * absent (local development only).
 *
 * Fire-and-forget: errors are logged but never thrown so they never break the
 * calling request flow, consistent with expoPush.ts.
 */

import * as fs from "fs";
import * as path from "path";

let _app: import("firebase-admin/app").App | null = null;

function getApp(): import("firebase-admin/app").App {
  if (_app) return _app;

  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const admin = require("firebase-admin");

  let credential: import("firebase-admin").ServiceAccount;

  const envJson = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (envJson) {
    credential = JSON.parse(envJson);
  } else {
    const localPath = path.join(__dirname, "../../.secrets/firebase-adminsdk.json");
    if (fs.existsSync(localPath)) {
      credential = JSON.parse(fs.readFileSync(localPath, "utf-8"));
    } else {
      throw new Error(
        "Firebase Admin SDK credentials not found. " +
          "Set FIREBASE_SERVICE_ACCOUNT env var or create .secrets/firebase-adminsdk.json",
      );
    }
  }

  _app = admin.initializeApp({
    credential: admin.credential.cert(credential),
  });

  return _app!;
}

export type FcmMessage = {
  /** FCM registration token (device token). */
  token: string;
  title: string;
  body: string;
  data?: Record<string, string>;
  /** Android-specific channel (default: "incoming-order") */
  channelId?: string;
};

/**
 * Send a single FCM push to one device token.
 * Returns true on success.
 */
export async function sendFcmPush(msg: FcmMessage): Promise<boolean> {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { getMessaging } = require("firebase-admin/messaging");
    const app = getApp();
    await getMessaging(app).send({
      token: msg.token,
      notification: { title: msg.title, body: msg.body },
      data: msg.data ?? {},
      android: {
        priority: "high",
        notification: {
          channelId: msg.channelId ?? "incoming-order",
          sound: "default",
        },
      },
      apns: {
        payload: {
          aps: { sound: "default", badge: 1 },
        },
      },
    });
    return true;
  } catch (err) {
    console.error("[fcmPush] send failed:", err);
    return false;
  }
}

/**
 * Send FCM pushes to multiple device tokens (in parallel, fire-and-forget).
 * Filters out blank/invalid tokens.
 */
export async function sendFcmToMany(
  tokens: (string | null | undefined)[],
  title: string,
  body: string,
  data?: Record<string, string>,
  channelId?: string,
): Promise<void> {
  const valid = tokens.filter((t): t is string => typeof t === "string" && t.length > 10);
  if (!valid.length) return;

  await Promise.allSettled(
    valid.map((token) => sendFcmPush({ token, title, body, data, channelId })),
  );
}
