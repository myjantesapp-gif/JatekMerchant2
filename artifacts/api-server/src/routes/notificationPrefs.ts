import { Router, type IRouter } from "express";
import { db, notificationPrefsTable, usersTable, driversTable } from "@workspace/db";
import { eq, inArray } from "drizzle-orm";
import { z } from "@workspace/api-zod";
import { requireAuth, requireRole, type AuthedRequest } from "../middlewares/auth";
import { vapidPublicKey } from "../lib/vapid";
import { sendExpoPush } from "../lib/expoPush";
import { sendFcmPush } from "../lib/fcmPush";
import { sendWebPush } from "../lib/vapid";
import { notificationsTable } from "@workspace/db";

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

const sendNotificationBody = z.object({
  userId: z.number().int().positive().optional(),
  userIds: z.array(z.number().int().positive()).max(100).optional(),
  title: z.string().trim().min(1).max(160),
  body: z.string().trim().min(1).max(2000),
  data: z.record(z.unknown()).optional(),
}).refine((value) => Boolean(value.userId || value.userIds?.length), {
  message: "userId or userIds is required",
});

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

  const [saved] = await db
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
  await db.update(driversTable)
    .set({ pushToken: token })
    .where(eq(driversTable.userId, req.userId!));
  res.json(saved);
});

router.delete("/notifications/push-token", requireAuth, async (req: AuthedRequest, res): Promise<void> => {
  await db.update(notificationPrefsTable)
    .set({ pushToken: null })
    .where(eq(notificationPrefsTable.userId, req.userId!));
  await db.update(driversTable)
    .set({ pushToken: null })
    .where(eq(driversTable.userId, req.userId!));
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

  const prefs = await db.select().from(notificationPrefsTable)
    .where(inArray(notificationPrefsTable.userId, existingIds));
  const prefsByUser = new Map(prefs.map((pref) => [pref.userId, pref]));
  const payload = { title: parsed.data.title, body: parsed.data.body, data: parsed.data.data ?? {} };
  let remoteSent = 0;
  let inAppSaved = 0;

  for (const userId of existingIds) {
    await db.insert(notificationsTable).values({
      userId,
      type: "admin",
      title: payload.title,
      body: payload.body,
      data: payload.data,
    });
    inAppSaved++;

    const pref = prefsByUser.get(userId);
    if (!pref) continue;
    if (pref.pushToken?.startsWith("ExponentPushToken[")) {
      if (await sendExpoPush({ to: pref.pushToken, ...payload, sound: "default", priority: "high" })) remoteSent++;
    } else if (pref.pushToken) {
      if (await sendFcmPush({ token: pref.pushToken, ...payload, data: Object.fromEntries(
        Object.entries(payload.data).map(([key, value]) => [key, String(value)]),
      ) })) remoteSent++;
    }
    if (pref.webPushSub) {
      await sendWebPush(pref.webPushSub, payload);
    }
  }

  res.json({ success: true, recipients: existingIds.length, inAppSaved, remoteSent });
});

export default router;
