import {
  activityLogsTable,
  chatMessagesTable,
  db,
  notificationsTable,
  ordersTable,
  otpCodesTable,
  quotesTable,
  referralsTable,
  refundsTable,
  reviewsTable,
  usersTable,
} from "@workspace/db";
import { eq, or } from "drizzle-orm";

/**
 * Removes a customer's account data in one transaction.
 *
 * Operational and accounting records are retained only in anonymized form so
 * deleting an account cannot break restaurant/driver order history.
 */
export async function deleteUserAccount(userId: number): Promise<boolean> {
  return db.transaction(async (tx) => {
    const [user] = await tx
      .select({ id: usersTable.id, phone: usersTable.phone })
      .from(usersTable)
      .where(eq(usersTable.id, userId))
      .limit(1);

    if (!user) return false;

    await tx.delete(notificationsTable).where(eq(notificationsTable.userId, userId));
    await tx.delete(chatMessagesTable).where(eq(chatMessagesTable.senderId, userId));
    await tx.delete(reviewsTable).where(eq(reviewsTable.userId, userId));
    await tx.delete(quotesTable).where(eq(quotesTable.userId, userId));
    await tx
      .delete(referralsTable)
      .where(or(eq(referralsTable.referrerId, userId), eq(referralsTable.referredId, userId)));

    if (user.phone) {
      await tx.delete(otpCodesTable).where(eq(otpCodesTable.phone, user.phone));
    }

    await tx
      .update(ordersTable)
      .set({
        userId: 0,
        userName: "Compte supprimé",
        deliveryAddress: "[adresse supprimée]",
        notes: null,
        pickupCode: null,
        pickupCodeExpiresAt: null,
        pickupCodeUsedAt: null,
        proofPhotoUrl: null,
        customerRating: null,
      })
      .where(eq(ordersTable.userId, userId));

    await tx
      .update(refundsTable)
      .set({ userId: 0 })
      .where(eq(refundsTable.userId, userId));

    await tx
      .update(activityLogsTable)
      .set({
        userId: null,
        userEmail: null,
        userName: null,
        details: null,
        ip: null,
      })
      .where(eq(activityLogsTable.userId, userId));

    const deleted = await tx
      .delete(usersTable)
      .where(eq(usersTable.id, userId))
      .returning({ id: usersTable.id });

    return deleted.length > 0;
  });
}