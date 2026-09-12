import { Router, type IRouter } from "express";
import {
  db,
  menuItemCategoriesTable,
  menuItemsTable,
  restaurantsTable,
  usersTable,
} from "@workspace/db";
import { and, asc, eq, or, sql } from "drizzle-orm";
import { resolveLegacyMediaPath } from "../lib/objectStorage";
import {
  selectAvailableRecommendations,
  type AvailableProductCandidate,
} from "../lib/recommendations";

const router: IRouter = Router();
const DEFAULT_LIMIT = 6;
const MAX_LIMIT = 30;
const MAX_CANDIDATES = MAX_LIMIT * 4;

export type HomeRecommendedProduct = {
  id: number;
  restaurantId: number;
  restaurantName: string;
  restaurantImageUrl: string | null | undefined;
  restaurantLogoUrl: string | null | undefined;
  name: string;
  description: string | null;
  price: number;
  imageUrl: string;
  category: string;
  deliveryTime: number | null;
  deliveryFee: number | null;
  rating: number | null;
};

/**
 * Public, bounded Home catalog endpoint.
 *
 * The query intentionally joins the merchant owner so a disabled owner
 * account cannot leak its products through a public recommendation feed.
 * Product-category visibility mirrors the public restaurant menu endpoint.
 */
router.get("/recommendations/products", async (req, res): Promise<void> => {
  const requestedLimit = Number(req.query.limit ?? DEFAULT_LIMIT);
  if (!Number.isInteger(requestedLimit) || requestedLimit < 1 || requestedLimit > MAX_LIMIT) {
    res.status(400).json({ error: `limit must be an integer between 1 and ${MAX_LIMIT}` });
    return;
  }

  const businessType = typeof req.query.businessType === "string"
    ? req.query.businessType.trim().slice(0, 80)
    : "";
  const filters = [
    eq(menuItemsTable.isAvailable, true),
    sql`${menuItemsTable.imageUrl} IS NOT NULL AND length(trim(${menuItemsTable.imageUrl})) > 0`,
    eq(restaurantsTable.isOpen, true),
    eq(restaurantsTable.isVerified, true),
    eq(usersTable.isActive, true),
    // A null category is the legacy-compatible public menu path. A linked
    // category must remain active before its product can be recommended.
    or(
      sql`${menuItemsTable.menuItemCategoryId} IS NULL`,
      eq(menuItemCategoriesTable.isActive, true),
    )!,
  ];
  if (businessType) filters.push(eq(restaurantsTable.businessType, businessType));

  const rows = await db
    .select({
      id: menuItemsTable.id,
      restaurantId: menuItemsTable.restaurantId,
      restaurantName: restaurantsTable.name,
      restaurantImageUrl: restaurantsTable.imageUrl,
      restaurantLogoUrl: restaurantsTable.logoUrl,
      name: menuItemsTable.name,
      description: menuItemsTable.description,
      price: menuItemsTable.price,
      imageUrl: menuItemsTable.imageUrl,
      category: menuItemsTable.category,
      deliveryTime: restaurantsTable.deliveryTime,
      deliveryFee: restaurantsTable.deliveryFee,
      rating: restaurantsTable.rating,
    })
    .from(menuItemsTable)
    .innerJoin(restaurantsTable, eq(menuItemsTable.restaurantId, restaurantsTable.id))
    .innerJoin(usersTable, eq(restaurantsTable.ownerId, usersTable.id))
    .leftJoin(
      menuItemCategoriesTable,
      and(
        eq(menuItemsTable.menuItemCategoryId, menuItemCategoriesTable.id),
        // A product may use a global category or one owned by its own
        // merchant. Do not let a stale cross-merchant category assignment
        // make that product look eligible on Home.
        or(
          sql`${menuItemCategoriesTable.restaurantId} IS NULL`,
          eq(menuItemCategoriesTable.restaurantId, menuItemsTable.restaurantId),
        )!,
      ),
    )
    .where(and(...filters))
    // Catalog order is intentionally deterministic and never uses isPopular,
    // ratings, clicks or order history as a hidden recommendation score.
    .orderBy(asc(menuItemsTable.sortOrder), asc(menuItemsTable.createdAt), asc(menuItemsTable.id))
    .limit(Math.min(requestedLimit * 4, MAX_CANDIDATES));

  const candidates: AvailableProductCandidate[] = rows
    .filter((row): row is typeof row & { imageUrl: string } =>
      typeof row.imageUrl === "string" && row.imageUrl.trim().length > 0,
    )
    .map((row) => ({
      ...row,
      imageUrl: resolveLegacyMediaPath(row.imageUrl, "images") ?? row.imageUrl,
    }));

  const items = selectAvailableRecommendations(candidates, requestedLimit).map((item) => ({
    id: item.id,
    restaurantId: item.restaurantId,
    restaurantName: String(item.restaurantName),
    restaurantImageUrl: resolveLegacyMediaPath(item.restaurantImageUrl, "banners"),
    restaurantLogoUrl: resolveLegacyMediaPath(item.restaurantLogoUrl, "logos"),
    name: String(item.name),
    description: typeof item.description === "string" ? item.description : null,
    price: Number(item.price),
    imageUrl: item.imageUrl as string,
    category: String(item.category),
    deliveryTime: typeof item.deliveryTime === "number" ? item.deliveryTime : null,
    deliveryFee: typeof item.deliveryFee === "number" ? item.deliveryFee : null,
    rating: typeof item.rating === "number" ? item.rating : null,
  })) satisfies HomeRecommendedProduct[];

  res.json(items);
});

export default router;