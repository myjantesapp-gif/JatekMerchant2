/**
 * Generators for order references and codes.
 *
 * - reference: human-friendly unique key (e.g. #CMD123456).
 * - kitchenCode: 3-digit numeric, used by the in-store counter when calling out
 *                ready orders. Not unique long-term, but unique within "active".
 * - pickupCode: 4-digit numeric handed to the customer at acceptance — the driver
 *               must enter this code at delivery to confirm hand-off.
 */
import { db, ordersTable } from "./index";
import { eq } from "drizzle-orm";

/** Generate a reference string like "#CMD123456" guaranteed to be unique. */
export async function generateUniqueOrderReference(maxAttempts = 100): Promise<string> {
  for (let i = 0; i < maxAttempts; i++) {
    const candidate = `#CMD${randomDigits(6)}`;
    const existing = await db
      .select({ id: ordersTable.id })
      .from(ordersTable)
      .where(eq(ordersTable.reference, candidate))
      .limit(1);
    if (existing.length === 0) return candidate;
  }
  throw new Error("Impossible de générer un numéro de commande unique.");
}

function randomDigits(n: number): string {
  let out = "";
  for (let i = 0; i < n; i++) out += Math.floor(Math.random() * 10);
  return out;
}

export function generateKitchenCode(): string {
  return randomDigits(3);
}

export function generatePickupCode(): string {
  return randomDigits(4);
}
