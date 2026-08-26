import { Router, type IRouter } from "express";
import { z } from "@workspace/api-zod";
import {
  db,
  cartsTable,
  cartItemsTable,
  menuItemsTable,
  menuItemSizesTable,
  menuItemExtrasTable,
} from "@workspace/db";
import { and, eq, inArray } from "drizzle-orm";
import { requireAuth, type AuthedRequest } from "../middlewares/auth";

const router: IRouter = Router();

const updateCartItemBody = z.object({
  quantity: z.number().int().min(1).max(99).optional(),
  selectedSizeId: z.number().int().positive().nullable().optional(),
  selectedExtraIds: z.array(z.number().int().positive()).max(30).optional(),
});

async function pricedCartItem(itemId: number, userId: number, updates: z.infer<typeof updateCartItemBody>) {
  return db.transaction(async (tx) => {
    const [row] = await tx
      .select({ item: cartItemsTable, cart: cartsTable, product: menuItemsTable })
      .from(cartItemsTable)
      .innerJoin(cartsTable, eq(cartsTable.id, cartItemsTable.cartId))
      .innerJoin(menuItemsTable, eq(menuItemsTable.id, cartItemsTable.menuItemId))
      .where(and(eq(cartItemsTable.id, itemId), eq(cartsTable.userId, userId)))
      .limit(1);

    if (!row) return { kind: "not_found" as const };
    if (!row.product.isAvailable) return { kind: "unavailable" as const };

    const sizeId = updates.selectedSizeId === undefined ? row.item.selectedSizeId : updates.selectedSizeId;
    const extraIds = updates.selectedExtraIds === undefined
      ? (row.item.selectedExtraIds ?? [])
      : Array.from(new Set(updates.selectedExtraIds));

    let sizeAdjustment = 0;
    if (sizeId !== null && sizeId !== undefined) {
      const [size] = await tx
        .select()
        .from(menuItemSizesTable)
        .where(and(eq(menuItemSizesTable.id, sizeId), eq(menuItemSizesTable.menuItemId, row.product.id), eq(menuItemSizesTable.isAvailable, true)))
        .limit(1);
      if (!size) return { kind: "invalid_size" as const };
      sizeAdjustment = size.priceAdjustment;
    }

    const extras = extraIds.length
      ? await tx.select().from(menuItemExtrasTable).where(and(
          eq(menuItemExtrasTable.menuItemId, row.product.id),
          eq(menuItemExtrasTable.isAvailable, true),
          inArray(menuItemExtrasTable.id, extraIds),
        ))
      : [];
    if (extras.length !== extraIds.length) return { kind: "invalid_extras" as const };

    const quantity = updates.quantity ?? row.item.quantity;
    const unitPrice = Math.round((row.product.price + sizeAdjustment + extras.reduce((sum, extra) => sum + extra.price, 0)) * 100) / 100;
    const subtotal = Math.round(unitPrice * quantity * 100) / 100;
    const [updated] = await tx
      .update(cartItemsTable)
      .set({ quantity, selectedSizeId: sizeId, selectedExtraIds: extraIds, unitPrice, subtotal })
      .where(and(eq(cartItemsTable.id, itemId), eq(cartItemsTable.cartId, row.cart.id)))
      .returning();
    await tx.update(cartsTable).set({ updatedAt: new Date() }).where(eq(cartsTable.id, row.cart.id));

    return { kind: "ok" as const, item: updated, cartId: row.cart.id, restaurantId: row.cart.restaurantId };
  });
}

/**
 * Update a cart line only when it belongs to the authenticated user's cart.
 * Prices are always recalculated from the current catalog; client prices are ignored.
 */
router.put("/cart/items/:id", requireAuth, async (req: AuthedRequest, res): Promise<void> => {
  const itemId = Number(req.params.id);
  if (!Number.isInteger(itemId) || itemId <= 0) {
    res.status(400).json({ error: "Invalid cart item id" });
    return;
  }
  const parsed = updateCartItemBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() });
    return;
  }

  const result = await pricedCartItem(itemId, req.userId!, parsed.data);
  if (result.kind === "not_found") { res.status(404).json({ error: "Cart item not found" }); return; }
  if (result.kind === "unavailable") { res.status(409).json({ error: "Product is no longer available" }); return; }
  if (result.kind === "invalid_size") { res.status(400).json({ error: "Selected size is invalid or unavailable" }); return; }
  if (result.kind === "invalid_extras") { res.status(400).json({ error: "One or more selected extras are invalid or unavailable" }); return; }
  res.json(result.item);
});

export default router;