import { db, driversTable, notificationPrefsTable } from "@workspace/db";
import { eq } from "drizzle-orm";

/**
 * Clear only rows that still contain the rejected token. A token can be
 * replaced while Expo is processing a receipt, so an unconditional clear
 * would remove a newer registration.
 */
export async function clearInvalidExpoPushToken(token: string): Promise<void> {
  await Promise.all([
    db.update(notificationPrefsTable)
      .set({ pushToken: null })
      .where(eq(notificationPrefsTable.pushToken, token)),
    db.update(driversTable)
      .set({ pushToken: null })
      .where(eq(driversTable.pushToken, token)),
  ]);
}