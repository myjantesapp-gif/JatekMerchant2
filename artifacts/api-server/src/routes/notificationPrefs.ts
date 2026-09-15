import { Router, type IRouter } from "express";
import { db, notificationPrefsTable, usersTable, driversTable } from "@workspace/db";
import { and, eq, inArray, ne } from "drizzle-orm";
import { z } from "@workspace/api-zod";
import { requireAuth, requireRole, type AuthedRequest } from "../middlewares/auth";
import { vapidPublicKey } from "../lib/vapid";
import { isExpoPushToken, sendExpoPush } from "../lib/expoPush";
import { clearInvalidExpoPushToken } from "../lib/pushTokenCleanup";
import { sendFcmPush } from "../lib/fcmPush";
import { sendWebPush } from "../lib/vapid";
import { notificationsTable } from "@workspace/db";
import { publish } from "../lib/sse";

const router: IRouter = Router();

const DEFAULTS = {
  pushOrders: true,
  pushPromos: true,
  emailReceipts: true,
  emailNewsletter: false,
  smsAlerts: false,
  language: "fr" as const,
  pushToken: null as string | null,
  webPushSub: null as string | null,
};

const pushTokenBody = z.object({
  token: z.string().trim().min(10).max(4096),
  platform: z.enum(["ios", "android", "web", "fcm"]).optional(),
});
const deletePushTokenBody = z.object({
  token: z.string().trim().min(10).max(4096).optional(),
});

const sendNotificationBody = z.object({
  userId: z.number().int().positive().optional(),
  userIds: z.array(z.number().int().positive()).max(100).optional(),
  title: z.string().trim().min(1).max(160),
  body: z.string().trim().min(1).max(2000),
  data: z.record(z.unknown()).optional(),
}).refine((value) => Boolean(value.userId || value.userIds?.length), {
  message: "userId or userIds is required",
});

export type UserNotificationPayload = {
  title: string;
  body: string;
  data: Record<string, unknown>;
};

type RemotePreference = "pushPromos" | "pushOrders";

/**
 * Persist and deliver a notification to known app users.
 * The in-app row is the source of truth; remote push is best-effort.
 */
export async function dispatchNotificationToUsers(
  userIds: number[],
  payload: UserNotificationPayload,
  options: { preference?: RemotePreference } = {},
): Promise<{ recipients: number; inAppSaved: number; remoteSent: number; receiptsPending: number }> {
  const uniqueIds = Array.from(new Set(userIds));
  if (uniqueIds.length === 0) {
    return { recipients: 0, inAppSaved: 0, remoteSent: 0, receiptsPending: 0 };
  }

  const users = await db.select({ id: usersTable.id })
    .from(usersTable)
    .where(inArray(usersTable.id, uniqueIds));
  const existingIds = users.map((user) => user.id);
  const [prefs, driverTokens] = await Promise.all([
    db.select().from(notificationPrefsTable)
      .where(inArray(notificationPrefsTable.userId, existingIds)),
    db.select({ userId: driversTable.userId, pushToken: driversTable.pushToken })
      .from(driversTable)
      .where(inArray(driversTable.userId, existingIds)),
  ]);
  const prefsByUser = new Map(prefs.map((pref) => [pref.userId, pref]));
  const driverTokenByUser = new Map(
    driverTokens
      .filter((driver) => driver.pushToken)
      .map((driver) => [driver.userId, driver.pushToken as string]),
  );
  // Admin and promotional broadcasts are marketing messages. Users who have
  // not opened the preferences screen yet have the DEFAULTS (including
  // pushPromos=true), rather than being silently excluded from remote push.
  const preference = options.preference ?? "pushPromos";
  let inAppSaved = 0;
  let remoteSent = 0;
  let receiptsPending = 0;

  for (const userId of existingIds) {
    await db.insert(notificationsTable).values({
      userId,
      type: "admin",
      title: payload.title,
      body: payload.body,
      data: payload.data,
    });
    inAppSaved++;
    publish(`user:${userId}`, "notification", {
      type: "admin",
      title: payload.title,
      body: payload.body,
      data: payload.data,
    });

    const pref = prefsByUser.get(userId);
    const pushEnabled = !pref || pref[preference] !== false;
    const pushToken = pref?.pushToken ?? driverTokenByUser.get(userId) ?? null;
    if (pushEnabled && pushToken && isExpoPushToken(pushToken)) {
      const result = await sendExpoPush(
        { to: pushToken, ...payload, sound: "default", priority: "high" },
        {
          onInvalidToken: clearInvalidExpoPushToken,
          onReceiptStatus: (status) => {
            if (status !== "ok") {
              console.warn("[notifications] Expo receipt status:", { userId, status });
            }
          },
        },
      );
      if (result.ticketAccepted) remoteSent++;
      if (result.receiptStatus === "pending") receiptsPending++;
    } else if (pushEnabled && pushToken) {
      if (await sendFcmPush({
        token: pushToken,
        ...payload,
        data: Object.fromEntries(Object.entries(payload.data).map(([key, value]) => [key, String(value)])),
      })) remoteSent++;
    }
    if (pushEnabled && pref?.webPushSub) {
      await sendWebPush(pref.webPushSub, payload);
    }
  }

  return { recipients: existingIds.length, inAppSaved, remoteSent, receiptsPending };
}

router.get("/notification-prefs", requireAuth, async (req: AuthedRequest, res): Promise<void> => {
  const userId = req.userId!;
  const [row] = await db
    .select()
    .from(notificationPrefsTable)
    .where(eq(notificationPrefsTable.userId, userId))
    .limit(1);
  if (!row) {
    const [created] = await db
      .insert(notificationPrefsTable)
      .values({ userId, ...DEFAULTS })
      .returning();
    res.json(created);
    return;
  }
  res.json(row);
});

router.get("/notification-prefs/vapid-key", requireAuth, (_req, res): void => {
  res.json({ publicKey: vapidPublicKey });
});

/** Register or replace the authenticated user's mobile push token. */
router.put("/notifications/push-token", requireAuth, async (req: AuthedRequest, res): Promise<void> => {
  const parsed = pushTokenBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() });
    return;
  }
  const token = parsed.data.token;
  if (/\s/.test(token)) {
    res.status(400).json({ error: "Invalid push token" });
    return;
  }

  const saved = await db.transaction(async (tx) => {
    // The schema intentionally remains single-token-per-user. Before assigning
    // a device token, atomically detach it from any older user/driver rows so
    // one device cannot receive another account's notifications.
    await tx.update(notificationPrefsTable)
      .set({ pushToken: null, updatedAt: new Date() })
      .where(and(eq(notificationPrefsTable.pushToken, token), ne(notificationPrefsTable.userId, req.userId!)));
    await tx.update(driversTable)
      .set({ pushToken: null })
      .where(and(eq(driversTable.pushToken, token), ne(driversTable.userId, req.userId!)));

    const [row] = await tx
      .insert(notificationPrefsTable)
      .values({ userId: req.userId!, ...DEFAULTS, pushToken: token })
      .onConflictDoUpdate({
        target: notificationPrefsTable.userId,
        set: { pushToken: token, updatedAt: new Date() },
      })
      .returning({ userId: notificationPrefsTable.userId, pushToken: notificationPrefsTable.pushToken });
    // Drivers are also read from drivers.pushToken when new delivery jobs are
    // broadcast. Keep both stores in sync regardless of which mobile client
    // registered the token.
    await tx.update(driversTable)
      .set({ pushToken: token })
      .where(eq(driversTable.userId, req.userId!));
    return row;
  });
  res.json(saved);
});

router.delete("/notifications/push-token", requireAuth, async (req: AuthedRequest, res): Promise<void> => {
  const parsed = deletePushTokenBody.safeParse(req.body ?? {});
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() });
    return;
  }
  const expectedToken = parsed.data.token;
  const prefsWhere = expectedToken
    ? and(eq(notificationPrefsTable.userId, req.userId!), eq(notificationPrefsTable.pushToken, expectedToken))
    : eq(notificationPrefsTable.userId, req.userId!);
  const driverWhere = expectedToken
    ? and(eq(driversTable.userId, req.userId!), eq(driversTable.pushToken, expectedToken))
    : eq(driversTable.userId, req.userId!);
  await db.update(notificationPrefsTable)
    .set({ pushToken: null })
    .where(prefsWhere);
  await db.update(driversTable)
    .set({ pushToken: null })
    .where(driverWhere);
  res.json({ success: true });
});

router.patch("/notification-prefs", requireAuth, async (req: AuthedRequest, res): Promise<void> => {
  const userId = req.userId!;
  const patch = req.body ?? {};
  const allowed = ["pushOrders", "pushPromos", "emailReceipts", "emailNewsletter", "smsAlerts", "language", "pushToken", "webPushSub"];
  const data: Record<string, unknown> = {};
  for (const k of allowed) if (k in patch) data[k] = patch[k];

  const [existing] = await db
    .select()
    .from(notificationPrefsTable)
    .where(eq(notificationPrefsTable.userId, userId))
    .limit(1);

  if (!existing) {
    const [created] = await db
      .insert(notificationPrefsTable)
      .values({ userId, ...DEFAULTS, ...data })
      .returning();
    res.json(created);
    return;
  }

  const [updated] = await db
    .update(notificationPrefsTable)
    .set(data)
    .where(eq(notificationPrefsTable.userId, userId))
    .returning();
  res.json(updated);
});

/**
 * Send an in-app and remote notification to one or more users.
 * This is deliberately staff-only; clients can only register their own token.
 */
router.post("/notifications/send", requireRole("admin", "super_admin", "manager"), async (req: AuthedRequest, res): Promise<void> => {
  const parsed = sendNotificationBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() });
    return;
  }

  const userIds = Array.from(new Set([
    ...(parsed.data.userId ? [parsed.data.userId] : []),
    ...(parsed.data.userIds ?? []),
  ]));
  const users = await db.select({ id: usersTable.id })
    .from(usersTable)
    .where(inArray(usersTable.id, userIds));
  const existingIds = users.map((user) => user.id);
  if (!existingIds.length) {
    res.status(404).json({ error: "No recipients found" });
    return;
  }

  const payload = { title: parsed.data.title, body: parsed.data.body, data: parsed.data.data ?? {} };
  const delivery = await dispatchNotificationToUsers(existingIds, payload, { preference: "pushPromos" });

  res.json({ success: true, ...delivery });
});

export default router;
