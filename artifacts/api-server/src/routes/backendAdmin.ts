/**
 * backendAdmin.ts — Extended admin endpoints
 *
 * Ads/Banners CRUD, Restaurant Hours (+ auto-close), Order Actions (refund/cancel/gesture),
 * User Admin Actions (reset-password, assign-shop, wallet-credit), Activity Audit Log,
 * Data Export (CSV/JSON), Data Import (JSON), System Monitoring, DB Backup.
 */
import { Router, type IRouter } from "express";
import bcrypt from "bcryptjs";
import os from "os";
import path from "node:path";
import { mkdtemp, rm } from "node:fs/promises";
import { exec } from "child_process";
import { promisify } from "util";
import {
  db,
  usersTable,
  restaurantsTable,
  ordersTable,
  menuItemsTable,
  menuItemCategoriesTable,
  adsTable,
  promoCodesTable,
  driversTable,
  activityLogsTable,
  restaurantHoursTable,
  refundsTable,
  appConfigTable,
} from "@workspace/db";
import { eq, and, asc, desc, sql, count, inArray } from "drizzle-orm";
import {
  homeOrderSchema,
  homeSectionsSchema,
  legalContentSchema,
  splashLogoUrlSchema,
  splashVideoUrlSchema,
  getDefaultHomeSections,
  getDefaultLegalContent,
  appConfigPatchSchema,
  type AppConfig,
} from "../lib/appConfig";
import { requireAuth, type AuthedRequest } from "../middlewares/auth";
import { closeUserSubscriptions, publish } from "../lib/sse";
import { parseEmployeeCloseTimes } from "../lib/employeeShopPermissions";
import * as tracking from "../lib/trackingService";
import { normalizeStoredMediaPath, resolveLegacyMediaPath } from "../lib/objectStorage";
import { migrateLegacyMedia } from "../scripts/migrate-media-storage";
import { createMediaBackup } from "../scripts/backup-prepublish";
import { calculateRefundJatekEarning } from "../lib/orderPricing";

const router: IRouter = Router();
const execAsync = promisify(exec);

// ─── helpers ────────────────────────────────────────────────────────────────

function isAdmin(role?: string): boolean {
  return !!role && ["super_admin", "admin", "manager"].includes(role);
}
function isSuperAdmin(role?: string): boolean {
  return !!role && ["super_admin", "admin"].includes(role);
}
function parseDecimal(value: unknown): number {
  const parsed = Number(String(value ?? "").trim().replace(",", "."));
  return Number.isFinite(parsed) ? parsed : 0;
}

router.post("/backend/media/migrate-legacy", requireAuth, async (req: AuthedRequest, res, next): Promise<void> => {
  if (req.userRole !== "super_admin") {
    res.status(403).json({ error: "Cette migration est réservée au super-administrateur." });
    return;
  }

  try {
    const summary = await migrateLegacyMedia();
    if (summary.failures > 0 || summary.retainedLegacyObjects > 0) {
      res.status(409).json({
        error: "Migration partiellement terminée. Les objets non migrés ont été conservés.",
        summary,
      });
      return;
    }
    res.json(summary);
  } catch (error) {
    next(error);
  }
});

async function logActivity(params: {
  userId?: number;
  userEmail?: string;
  userName?: string;
  action: string;
  entity?: string;
  entityId?: number;
  details?: Record<string, unknown>;
  ip?: string;
}) {
  try {
    await db.insert(activityLogsTable).values({
      userId: params.userId ?? null,
      userEmail: params.userEmail ?? null,
      userName: params.userName ?? null,
      action: params.action,
      entity: params.entity ?? null,
      entityId: params.entityId ?? null,
      details: (params.details ?? null) as any,
      ip: params.ip ?? null,
    });
  } catch (e) {
    console.error("[audit] logActivity failed", e);
  }
}

function formatUptime(s: number): string {
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = Math.floor(s % 60);
  if (d > 0) return `${d}j ${h}h ${m}m`;
  if (h > 0) return `${h}h ${m}m ${sec}s`;
  return `${m}m ${sec}s`;
}

function toCSV(data: Record<string, unknown>[]): string {
  if (!data.length) return "";
  const headers = Object.keys(data[0]);
  const rows = data.map((row) =>
    headers
      .map((h) => {
        const v = row[h];
        if (v === null || v === undefined) return "";
        const s = typeof v === "object" ? JSON.stringify(v) : String(v);
        return s.includes(",") || s.includes('"') || s.includes("\n")
          ? `"${s.replace(/"/g, '""')}"`
          : s;
      })
      .join(","),
  );
  return [headers.join(","), ...rows].join("\n");
}

// ────────────────────────────────────────────────────────────────────────────
// ADS / BANNERS CRUD
// ────────────────────────────────────────────────────────────────────────────

// ────────────────────────────────────────────────────────────────────────────
// RECOMMENDATIONS
// ────────────────────────────────────────────────────────────────────────────

/**
 * Recommendations deliberately reuse the existing product/restaurant flags.
 * This keeps old catalog data and older clients compatible while giving the
 * dashboard one place to control the public Home feeds.
 */
router.get("/backend/recommendations", requireAuth, async (req: AuthedRequest, res, next): Promise<void> => {
  if (!isAdmin(req.userRole)) { res.status(403).json({ error: "Forbidden" }); return; }
  try {
    const products = await db
      .select({
        id: menuItemsTable.id,
        restaurantId: menuItemsTable.restaurantId,
        restaurantName: restaurantsTable.name,
        name: menuItemsTable.name,
        imageUrl: menuItemsTable.imageUrl,
        price: menuItemsTable.price,
        isAvailable: menuItemsTable.isAvailable,
        isRecommended: menuItemsTable.isPopular,
        menuItemCategoryId: menuItemsTable.menuItemCategoryId,
        sortOrder: menuItemsTable.sortOrder,
        categorySortOrder: menuItemCategoriesTable.sortOrder,
      })
      .from(menuItemsTable)
      .innerJoin(restaurantsTable, eq(menuItemsTable.restaurantId, restaurantsTable.id))
      .leftJoin(menuItemCategoriesTable, eq(menuItemsTable.menuItemCategoryId, menuItemCategoriesTable.id))
      .orderBy(
        desc(menuItemsTable.isPopular),
        asc(menuItemCategoriesTable.sortOrder),
        asc(menuItemCategoriesTable.id),
        asc(menuItemsTable.sortOrder),
        asc(menuItemsTable.id),
      );
    const restaurants = await db
      .select({
        id: restaurantsTable.id,
        name: restaurantsTable.name,
        imageUrl: restaurantsTable.imageUrl,
        logoUrl: restaurantsTable.logoUrl,
        businessType: restaurantsTable.businessType,
        isOpen: restaurantsTable.isOpen,
        isVerified: restaurantsTable.isVerified,
        isRecommended: restaurantsTable.isFeatured,
      })
      .from(restaurantsTable)
      .orderBy(desc(restaurantsTable.isFeatured), asc(restaurantsTable.name), asc(restaurantsTable.id));
    res.json({
      products: products.map((product) => ({
        ...product,
        imageUrl: resolveLegacyMediaPath(product.imageUrl, "medias"),
      })),
      restaurants: restaurants.map((restaurant) => ({
        ...restaurant,
        imageUrl: resolveLegacyMediaPath(restaurant.imageUrl, "banners"),
        logoUrl: resolveLegacyMediaPath(restaurant.logoUrl, "logos"),
      })),
    });
  } catch (err) { next(err); }
});

router.patch("/backend/recommendations/products/:id", requireAuth, async (req: AuthedRequest, res, next): Promise<void> => {
  if (!isAdmin(req.userRole)) { res.status(403).json({ error: "Forbidden" }); return; }
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0 || typeof req.body?.isRecommended !== "boolean") {
      res.status(400).json({ error: "id et isRecommended booléen requis" }); return;
    }
    const [product] = await db.update(menuItemsTable)
      .set({ isPopular: req.body.isRecommended })
      .where(eq(menuItemsTable.id, id))
      .returning({ id: menuItemsTable.id, isRecommended: menuItemsTable.isPopular });
    if (!product) { res.status(404).json({ error: "Produit introuvable" }); return; }
    res.json(product);
  } catch (err) { next(err); }
});

router.patch("/backend/recommendations/restaurants/:id", requireAuth, async (req: AuthedRequest, res, next): Promise<void> => {
  if (!isAdmin(req.userRole)) { res.status(403).json({ error: "Forbidden" }); return; }
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0 || typeof req.body?.isRecommended !== "boolean") {
      res.status(400).json({ error: "id et isRecommended booléen requis" }); return;
    }
    const [restaurant] = await db.update(restaurantsTable)
      .set({ isFeatured: req.body.isRecommended })
      .where(eq(restaurantsTable.id, id))
      .returning({ id: restaurantsTable.id, isRecommended: restaurantsTable.isFeatured });
    if (!restaurant) { res.status(404).json({ error: "Restaurant introuvable" }); return; }
    res.json(restaurant);
  } catch (err) { next(err); }
});

router.get("/backend/ads", requireAuth, async (req: AuthedRequest, res, next): Promise<void> => {
  if (!isAdmin(req.userRole)) { res.status(403).json({ error: "Forbidden" }); return; }
  try {
     const ads = await db.select().from(adsTable).orderBy(adsTable.sortOrder, adsTable.id);
    res.json(ads.map((ad) => ({
      ...ad,
      imageUrl: resolveLegacyMediaPath(ad.imageUrl, "banners"),
    })));
  } catch (err) { next(err); }
});

router.post("/backend/ads", requireAuth, async (req: AuthedRequest, res, next): Promise<void> => {
  if (!isAdmin(req.userRole)) { res.status(403).json({ error: "Forbidden" }); return; }
  try {
    const {
      type, title, subtitle, badge, bgColor, accentColor, icon, imageUrl, linkUrl,
      restaurantId, productId, normalPrice, promoPrice, isActive, sortOrder,
    } = req.body;
    if (!title) { res.status(400).json({ error: "title requis" }); return; }
     const parsedSortOrder = sortOrder === undefined ? 0 : Number(sortOrder);
     if (!Number.isInteger(parsedSortOrder) || parsedSortOrder < 0) {
       res.status(400).json({ error: "sortOrder doit être un entier positif ou nul" }); return;
     }
    const parsedRestaurantId = restaurantId === undefined || restaurantId === null || restaurantId === "" ? null : Number(restaurantId);
    const parsedProductId = productId === undefined || productId === null || productId === "" ? null : Number(productId);
    const parsedNormalPrice = normalPrice === undefined || normalPrice === null || normalPrice === "" ? null : parseDecimal(normalPrice);
    const parsedPromoPrice = promoPrice === undefined || promoPrice === null || promoPrice === "" ? null : parseDecimal(promoPrice);
    if (type === "promo_product") {
      const validRestaurantId = parsedRestaurantId === null ? NaN : parsedRestaurantId;
      const validProductId = parsedProductId === null ? NaN : parsedProductId;
      if (!Number.isInteger(validRestaurantId) || validRestaurantId <= 0 || !Number.isInteger(validProductId) || validProductId <= 0) {
        res.status(400).json({ error: "restaurantId et productId requis pour une promotion produit" }); return;
      }
      if (parsedNormalPrice === null || parsedPromoPrice === null || parsedNormalPrice <= 0 || parsedPromoPrice < 0 || parsedPromoPrice >= parsedNormalPrice) {
        res.status(400).json({ error: "Le prix promo doit être inférieur au prix normal" }); return;
      }
      const [product] = await db.select({ id: menuItemsTable.id, restaurantId: menuItemsTable.restaurantId })
        .from(menuItemsTable)
        .where(eq(menuItemsTable.id, validProductId))
        .limit(1);
      if (!product || product.restaurantId !== validRestaurantId) {
        res.status(400).json({ error: "Produit introuvable dans ce restaurant" }); return;
      }
    }
    const [ad] = await db.insert(adsTable).values({
      type: type ?? "vip_banner",
      title,
      subtitle: subtitle ?? null,
      badge: badge ?? null,
      bgColor: bgColor ?? "#E91E63",
      accentColor: accentColor ?? null,
      icon: icon ?? "star",
      imageUrl: normalizeStoredMediaPath(imageUrl) ?? null,
      linkUrl: linkUrl ?? null,
      restaurantId: Number.isInteger(parsedRestaurantId) ? parsedRestaurantId : null,
      productId: Number.isInteger(parsedProductId) ? parsedProductId : null,
      normalPrice: parsedNormalPrice,
      promoPrice: parsedPromoPrice,
      isActive: isActive ?? true,
       sortOrder: parsedSortOrder,
    }).returning();
    const [u] = await db.select({ name: usersTable.name, email: usersTable.email }).from(usersTable).where(eq(usersTable.id, req.userId!)).limit(1);
    await logActivity({ userId: req.userId, userEmail: u?.email, userName: u?.name, action: "create", entity: "ad", entityId: ad.id, ip: req.ip });
    res.status(201).json(ad);
  } catch (err) { next(err); }
});

router.patch("/backend/ads/:id", requireAuth, async (req: AuthedRequest, res, next): Promise<void> => {
  if (!isAdmin(req.userRole)) { res.status(403).json({ error: "Forbidden" }); return; }
  try {
    const id = parseInt(String(req.params.id), 10);
    if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }
    const allowed = ["type", "title", "subtitle", "badge", "bgColor", "accentColor", "icon", "imageUrl", "linkUrl", "restaurantId", "productId", "normalPrice", "promoPrice", "isActive", "sortOrder"];
    const updates: Record<string, unknown> = {};
    const body = req.body ?? {};
    for (const k of allowed) if (body[k] !== undefined) updates[k] = body[k];
    const [current] = await db.select().from(adsTable).where(eq(adsTable.id, id)).limit(1);
    if (!current) { res.status(404).json({ error: "Not found" }); return; }
    const nextType = String(updates.type ?? current.type);
    const nextRestaurantId = updates.restaurantId === undefined ? current.restaurantId : (updates.restaurantId === null || updates.restaurantId === "" ? null : Number(updates.restaurantId));
    const nextProductId = updates.productId === undefined ? current.productId : (updates.productId === null || updates.productId === "" ? null : Number(updates.productId));
    const nextNormalPrice = updates.normalPrice === undefined ? current.normalPrice : (updates.normalPrice === null || updates.normalPrice === "" ? null : parseDecimal(updates.normalPrice));
    const nextPromoPrice = updates.promoPrice === undefined ? current.promoPrice : (updates.promoPrice === null || updates.promoPrice === "" ? null : parseDecimal(updates.promoPrice));
    if (nextType === "promo_product") {
      const validRestaurantId = nextRestaurantId === null ? NaN : nextRestaurantId;
      const validProductId = nextProductId === null ? NaN : nextProductId;
      if (!Number.isInteger(validRestaurantId) || validRestaurantId <= 0 || !Number.isInteger(validProductId) || validProductId <= 0) {
        res.status(400).json({ error: "restaurantId et productId requis pour une promotion produit" }); return;
      }
      if (nextNormalPrice === null || nextPromoPrice === null || nextNormalPrice <= 0 || nextPromoPrice < 0 || nextPromoPrice >= nextNormalPrice) {
        res.status(400).json({ error: "Le prix promo doit être inférieur au prix normal" }); return;
      }
      const [product] = await db.select({ id: menuItemsTable.id, restaurantId: menuItemsTable.restaurantId })
        .from(menuItemsTable)
        .where(eq(menuItemsTable.id, validProductId))
        .limit(1);
      if (!product || product.restaurantId !== validRestaurantId) {
        res.status(400).json({ error: "Produit introuvable dans ce restaurant" }); return;
      }
    }
    if ("restaurantId" in updates) updates.restaurantId = nextRestaurantId;
    if ("productId" in updates) updates.productId = nextProductId;
    if ("normalPrice" in updates) updates.normalPrice = nextNormalPrice;
    if ("promoPrice" in updates) updates.promoPrice = nextPromoPrice;
     if ("sortOrder" in updates) {
       const parsedSortOrder = Number(updates.sortOrder);
       if (!Number.isInteger(parsedSortOrder) || parsedSortOrder < 0) {
         res.status(400).json({ error: "sortOrder doit être un entier positif ou nul" }); return;
       }
       updates.sortOrder = parsedSortOrder;
     }
    if ("imageUrl" in updates) updates.imageUrl = normalizeStoredMediaPath(updates.imageUrl);
    const [ad] = await db.update(adsTable).set(updates as any).where(eq(adsTable.id, id)).returning();
    const [u] = await db.select({ name: usersTable.name, email: usersTable.email }).from(usersTable).where(eq(usersTable.id, req.userId!)).limit(1);
    await logActivity({ userId: req.userId, userEmail: u?.email, userName: u?.name, action: "update", entity: "ad", entityId: id, ip: req.ip });
    res.json(ad);
  } catch (err) { next(err); }
});

router.delete("/backend/ads/:id", requireAuth, async (req: AuthedRequest, res, next): Promise<void> => {
  if (!isSuperAdmin(req.userRole)) { res.status(403).json({ error: "Forbidden" }); return; }
  try {
    const id = parseInt(String(req.params.id), 10);
    if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }
    await db.delete(adsTable).where(eq(adsTable.id, id));
    const [u] = await db.select({ name: usersTable.name, email: usersTable.email }).from(usersTable).where(eq(usersTable.id, req.userId!)).limit(1);
    await logActivity({ userId: req.userId, userEmail: u?.email, userName: u?.name, action: "delete", entity: "ad", entityId: id, ip: req.ip });
    res.json({ success: true });
  } catch (err) { next(err); }
});

// ────────────────────────────────────────────────────────────────────────────
// RESTAURANT HOURS
// ────────────────────────────────────────────────────────────────────────────

router.get("/backend/shops/:id/hours", requireAuth, async (req: AuthedRequest, res, next): Promise<void> => {
  const isEmployee = req.userRole === "employee";
  if (!isAdmin(req.userRole) && req.userRole !== "restaurant_owner" && !isEmployee) { res.status(403).json({ error: "Forbidden" }); return; }
  try {
    const shopId = parseInt(String(req.params.id), 10);
    if (isNaN(shopId)) { res.status(400).json({ error: "Invalid id" }); return; }
    // restaurant_owner: verify they own this shop
    if (req.userRole === "restaurant_owner") {
      const owned = await db.select({ id: restaurantsTable.id }).from(restaurantsTable)
        .where(and(eq(restaurantsTable.id, shopId), eq(restaurantsTable.ownerId, req.userId!)));
      if (owned.length === 0) { res.status(403).json({ error: "Forbidden: not your restaurant" }); return; }
    }
    if (isEmployee) {
      const [employee] = await db.select({ assignedShopId: usersTable.assignedShopId })
        .from(usersTable).where(eq(usersTable.id, req.userId!)).limit(1);
      if (employee?.assignedShopId !== shopId) { res.status(403).json({ error: "Forbidden: not your assigned restaurant" }); return; }
    }
    const hours = await db.select().from(restaurantHoursTable)
      .where(eq(restaurantHoursTable.restaurantId, shopId))
      .orderBy(restaurantHoursTable.dayOfWeek);
    res.json(hours);
  } catch (err) { next(err); }
});

/** Upsert full weekly schedule — body: { hours: [{dayOfWeek,openTime,closeTime,isClosed}] } */
router.put("/backend/shops/:id/hours", requireAuth, async (req: AuthedRequest, res, next): Promise<void> => {
  const isEmployee = req.userRole === "employee";
  if (!isAdmin(req.userRole) && req.userRole !== "restaurant_owner" && !isEmployee) { res.status(403).json({ error: "Forbidden" }); return; }
  try {
    const shopId = parseInt(String(req.params.id), 10);
    if (isNaN(shopId)) { res.status(400).json({ error: "Invalid id" }); return; }
    // restaurant_owner: verify they own this shop
    if (req.userRole === "restaurant_owner") {
      const owned = await db.select({ id: restaurantsTable.id }).from(restaurantsTable)
        .where(and(eq(restaurantsTable.id, shopId), eq(restaurantsTable.ownerId, req.userId!)));
      if (owned.length === 0) { res.status(403).json({ error: "Forbidden: not your restaurant" }); return; }
    }
    const { hours } = req.body ?? {};
    if (!Array.isArray(hours)) { res.status(400).json({ error: "hours[] requis" }); return; }

    if (isEmployee) {
      const [employee] = await db.select({ assignedShopId: usersTable.assignedShopId })
        .from(usersTable).where(eq(usersTable.id, req.userId!)).limit(1);
      if (employee?.assignedShopId !== shopId) { res.status(403).json({ error: "Forbidden: not your assigned restaurant" }); return; }
      const parsed = parseEmployeeCloseTimes(req.body);
      if (!parsed.ok) { res.status(400).json({ error: parsed.error }); return; }

      const existingDays = await db.select({ dayOfWeek: restaurantHoursTable.dayOfWeek })
        .from(restaurantHoursTable).where(eq(restaurantHoursTable.restaurantId, shopId));
      if (parsed.hours.some((hour) => !existingDays.some((row) => row.dayOfWeek === hour.dayOfWeek))) {
        res.status(409).json({ error: "Les horaires hebdomadaires doivent d’abord être configurés par le propriétaire." });
        return;
      }

      await db.transaction(async (tx) => {
        for (const hour of parsed.hours) {
          await tx.update(restaurantHoursTable)
            .set({ closeTime: hour.closeTime })
            .where(and(
              eq(restaurantHoursTable.restaurantId, shopId),
              eq(restaurantHoursTable.dayOfWeek, hour.dayOfWeek),
            ));
        }
      });
      const updated = await db.select().from(restaurantHoursTable)
        .where(eq(restaurantHoursTable.restaurantId, shopId))
        .orderBy(restaurantHoursTable.dayOfWeek);
      res.json(updated);
      return;
    }

    await db.transaction(async (tx) => {
      for (const h of hours) {
        const day = Number(h.dayOfWeek);
        if (isNaN(day) || day < 0 || day > 6) continue;
        const existing = await tx.select({ id: restaurantHoursTable.id })
          .from(restaurantHoursTable)
          .where(and(eq(restaurantHoursTable.restaurantId, shopId), eq(restaurantHoursTable.dayOfWeek, day)))
          .limit(1);
        if (existing.length > 0) {
          await tx.update(restaurantHoursTable).set({
            openTime: h.openTime ?? "09:00",
            closeTime: h.closeTime ?? "22:00",
            isClosed: h.isClosed ?? false,
          }).where(eq(restaurantHoursTable.id, existing[0].id));
        } else {
          await tx.insert(restaurantHoursTable).values({
            restaurantId: shopId, dayOfWeek: day,
            openTime: h.openTime ?? "09:00",
            closeTime: h.closeTime ?? "22:00",
            isClosed: h.isClosed ?? false,
          });
        }
      }
    });

    const result = await db.select().from(restaurantHoursTable)
      .where(eq(restaurantHoursTable.restaurantId, shopId))
      .orderBy(restaurantHoursTable.dayOfWeek);
    res.json(result);
  } catch (err) { next(err); }
});

// ────────────────────────────────────────────────────────────────────────────
// ORDER ACTIONS
// ────────────────────────────────────────────────────────────────────────────

/** POST /backend/orders/:id/refund — credit user wallet */
router.post("/backend/orders/:id/refund", requireAuth, async (req: AuthedRequest, res, next): Promise<void> => {
  if (!isAdmin(req.userRole)) { res.status(403).json({ error: "Forbidden" }); return; }
  try {
    const orderId = parseInt(String(req.params.id), 10);
    if (isNaN(orderId)) { res.status(400).json({ error: "Invalid id" }); return; }
    const { amount, reason, notes } = req.body;
    if (!amount || Number(amount) <= 0 || !reason) { res.status(400).json({ error: "amount (positif) et reason requis" }); return; }

    const [order] = await db.select().from(ordersTable).where(eq(ordersTable.id, orderId)).limit(1);
    if (!order) { res.status(404).json({ error: "Commande introuvable" }); return; }

    const remainingRefundable = Math.max(0, Number(order.total) - Number(order.refundedAmount ?? 0));
    const refundAmount = Math.min(Number(amount), remainingRefundable);
    if (refundAmount <= 0) { res.status(400).json({ error: "Cette commande a déjà été entièrement remboursée" }); return; }
    const [adminUser] = await db.select({ name: usersTable.name, email: usersTable.email })
      .from(usersTable).where(eq(usersTable.id, req.userId!)).limit(1);

    const commissionableBase = Math.max(0, Number(order.subtotal) - Number(order.discountAmount ?? 0));
    const requestedCommissionableAmount = Number(req.body.commissionableAmount);
    const refundedJatekEarning = calculateRefundJatekEarning({
      orderTotal: order.total,
      commissionableBase,
      originalJatekEarning: order.jatekEarning,
      alreadyRefundedAmount: order.refundedAmount ?? 0,
      alreadyRefundedJatekEarning: order.refundedJatekEarning ?? 0,
      refundAmount,
      commissionableRefundAmount: Number.isFinite(requestedCommissionableAmount)
        ? Math.max(0, requestedCommissionableAmount)
        : undefined,
    });

    await db.transaction(async (tx) => {
      await tx.update(usersTable).set({
        walletBalance: sql`${usersTable.walletBalance} + ${refundAmount}`,
      }).where(eq(usersTable.id, order.userId));
      await tx.insert(refundsTable).values({
        orderId, userId: order.userId,
        amount: refundAmount, reason,
        type: "wallet_credit",
        adminId: req.userId!,
        adminName: adminUser?.name ?? null,
        notes: notes ?? null,
      });
      await tx.update(ordersTable).set({
        refundedAmount: Number(order.refundedAmount ?? 0) + refundAmount,
        refundedJatekEarning: Number(order.refundedJatekEarning ?? 0) + refundedJatekEarning,
      }).where(eq(ordersTable.id, orderId));
    });

    await logActivity({ userId: req.userId, userEmail: adminUser?.email, userName: adminUser?.name, action: "refund", entity: "order", entityId: orderId, details: { amount: refundAmount, reason }, ip: req.ip });

    res.json({ success: true, refundedAmount: refundAmount, message: `${refundAmount} DH crédité sur le wallet du client` });
  } catch (err) { next(err); }
});

/** POST /backend/orders/:id/gesture — commercial gesture (wallet credit, no refund record) */
router.post("/backend/orders/:id/gesture", requireAuth, async (req: AuthedRequest, res, next): Promise<void> => {
  if (!isAdmin(req.userRole)) { res.status(403).json({ error: "Forbidden" }); return; }
  try {
    const orderId = parseInt(String(req.params.id), 10);
    if (isNaN(orderId)) { res.status(400).json({ error: "Invalid id" }); return; }
    const { amount, reason } = req.body;
    if (!amount || Number(amount) <= 0 || !reason) { res.status(400).json({ error: "amount (positif) et reason requis" }); return; }

    const [order] = await db.select({ userId: ordersTable.userId }).from(ordersTable).where(eq(ordersTable.id, orderId)).limit(1);
    if (!order) { res.status(404).json({ error: "Commande introuvable" }); return; }

    await db.update(usersTable).set({
      walletBalance: sql`${usersTable.walletBalance} + ${Number(amount)}`,
    }).where(eq(usersTable.id, order.userId));

    const [adminUser] = await db.select({ name: usersTable.name, email: usersTable.email })
      .from(usersTable).where(eq(usersTable.id, req.userId!)).limit(1);
    await logActivity({ userId: req.userId, userEmail: adminUser?.email, userName: adminUser?.name, action: "gesture", entity: "order", entityId: orderId, details: { amount: Number(amount), reason }, ip: req.ip });

    res.json({ success: true, creditedAmount: Number(amount), message: `Geste commercial: ${amount} DH crédité` });
  } catch (err) { next(err); }
});

/** PATCH /backend/orders/:id/cancel — cancel + optional wallet refund */
router.patch("/backend/orders/:id/cancel", requireAuth, async (req: AuthedRequest, res, next): Promise<void> => {
  if (!isAdmin(req.userRole)) { res.status(403).json({ error: "Forbidden" }); return; }
  try {
    const orderId = parseInt(String(req.params.id), 10);
    if (isNaN(orderId)) { res.status(400).json({ error: "Invalid id" }); return; }
    const { reason, refundToWallet } = req.body;

    const [order] = await db.select().from(ordersTable).where(eq(ordersTable.id, orderId)).limit(1);
    if (!order) { res.status(404).json({ error: "Commande introuvable" }); return; }
    if (["delivered", "cancelled"].includes(order.status)) {
      res.status(400).json({ error: "Cette commande ne peut plus être annulée" }); return;
    }

    const [cancelledOrder] = await db
      .update(ordersTable)
      .set({ status: "cancelled" })
      .where(and(eq(ordersTable.id, orderId), eq(ordersTable.status, order.status)))
      .returning({ id: ordersTable.id });
    if (!cancelledOrder) {
      res.status(409).json({ error: "Cette commande a déjà été mise à jour. Actualisez la page." });
      return;
    }
    if (order.driverId) {
      tracking.detachOrder(order.driverId, orderId);
      publish(`driver:${order.driverId}`, "order_status", { orderId, status: "cancelled" });
    }
    publish(`order:${orderId}`, "order_status", { orderId, status: "cancelled" });
    publish(`restaurant:${order.restaurantId}`, "order_status", { orderId, status: "cancelled" });
    publish("admin_tracking", "order_status", { orderId, status: "cancelled", driverId: order.driverId });

     if (refundToWallet) {
       const refundAmount = Math.max(0, Number(order.total) - Number(order.refundedAmount ?? 0));
       const commissionableBase = Math.max(0, Number(order.subtotal) - Number(order.discountAmount ?? 0));
       const refundedJatekEarning = calculateRefundJatekEarning({
         orderTotal: order.total,
         commissionableBase,
         originalJatekEarning: order.jatekEarning,
         alreadyRefundedAmount: order.refundedAmount ?? 0,
         alreadyRefundedJatekEarning: order.refundedJatekEarning ?? 0,
         refundAmount,
         commissionableRefundAmount: commissionableBase,
       });
       await db.transaction(async (tx) => {
         if (refundAmount > 0) {
           await tx.update(usersTable).set({
             walletBalance: sql`${usersTable.walletBalance} + ${refundAmount}`,
           }).where(eq(usersTable.id, order.userId));
           await tx.update(ordersTable).set({
             refundedAmount: Number(order.refundedAmount ?? 0) + refundAmount,
             refundedJatekEarning: Number(order.refundedJatekEarning ?? 0) + refundedJatekEarning,
           }).where(eq(ordersTable.id, orderId));
         }
       });
    }

    const [adminUser] = await db.select({ name: usersTable.name, email: usersTable.email })
      .from(usersTable).where(eq(usersTable.id, req.userId!)).limit(1);
    await logActivity({ userId: req.userId, userEmail: adminUser?.email, userName: adminUser?.name, action: "cancel", entity: "order", entityId: orderId, details: { reason, refundToWallet, total: order.total }, ip: req.ip });

    res.json({ success: true, refunded: !!refundToWallet, message: refundToWallet ? `Commande annulée et ${order.total} DH remboursé` : "Commande annulée" });
  } catch (err) { next(err); }
});

// ────────────────────────────────────────────────────────────────────────────
// USER ADMIN ACTIONS
// ────────────────────────────────────────────────────────────────────────────

/** Admin reset a user's password */
router.patch("/backend/users/:id/reset-password", requireAuth, async (req: AuthedRequest, res, next): Promise<void> => {
  if (!isSuperAdmin(req.userRole)) { res.status(403).json({ error: "Forbidden: super_admin requis" }); return; }
  try {
    const userId = parseInt(String(req.params.id), 10);
    if (isNaN(userId)) { res.status(400).json({ error: "Invalid id" }); return; }
    const { newPassword } = req.body;
    if (!newPassword || String(newPassword).length < 8) {
      res.status(400).json({ error: "Le mot de passe doit faire au moins 8 caractères" }); return;
    }
    const hashed = await bcrypt.hash(String(newPassword), 12);
    const [user] = await db.update(usersTable).set({ password: hashed })
      .where(eq(usersTable.id, userId))
      .returning({ id: usersTable.id, name: usersTable.name, email: usersTable.email });
    if (!user) { res.status(404).json({ error: "Utilisateur introuvable" }); return; }

    const [adminUser] = await db.select({ name: usersTable.name, email: usersTable.email })
      .from(usersTable).where(eq(usersTable.id, req.userId!)).limit(1);
    await logActivity({ userId: req.userId, userEmail: adminUser?.email, userName: adminUser?.name, action: "reset_password", entity: "user", entityId: userId, ip: req.ip });

    res.json({ success: true, message: `Mot de passe réinitialisé pour ${user.name}` });
  } catch (err) { next(err); }
});

/** Assign a user as owner of a restaurant */
router.patch("/backend/users/:id/assign-restaurant", requireAuth, async (req: AuthedRequest, res, next): Promise<void> => {
  if (!isSuperAdmin(req.userRole)) { res.status(403).json({ error: "Forbidden: super_admin requis" }); return; }
  try {
    const userId = parseInt(String(req.params.id), 10);
    if (isNaN(userId)) { res.status(400).json({ error: "Invalid id" }); return; }
    const { restaurantId } = req.body; // null = unassign

    if (restaurantId) {
      await db.update(restaurantsTable).set({ ownerId: userId }).where(eq(restaurantsTable.id, Number(restaurantId)));
      await db.update(usersTable).set({ role: "restaurant_owner" }).where(eq(usersTable.id, userId));
    }
    await db.update(usersTable).set({ assignedShopId: restaurantId ? Number(restaurantId) : null }).where(eq(usersTable.id, userId));

    const [user] = await db.select({ name: usersTable.name }).from(usersTable).where(eq(usersTable.id, userId)).limit(1);
    const [adminUser] = await db.select({ name: usersTable.name, email: usersTable.email })
      .from(usersTable).where(eq(usersTable.id, req.userId!)).limit(1);
    await logActivity({ userId: req.userId, userEmail: adminUser?.email, userName: adminUser?.name, action: "assign_shop", entity: "user", entityId: userId, details: { restaurantId }, ip: req.ip });

    res.json({ success: true, message: restaurantId ? `${user?.name} assigné au restaurant #${restaurantId}` : `${user?.name} désassigné` });
  } catch (err) { next(err); }
});

/** Credit or debit a user's wallet */
router.patch("/backend/users/:id/wallet-credit", requireAuth, async (req: AuthedRequest, res, next): Promise<void> => {
  if (!isAdmin(req.userRole)) { res.status(403).json({ error: "Forbidden" }); return; }
  try {
    const userId = parseInt(String(req.params.id), 10);
    if (isNaN(userId)) { res.status(400).json({ error: "Invalid id" }); return; }
    const { amount, reason } = req.body;
    if (amount === undefined) { res.status(400).json({ error: "amount requis" }); return; }

    const [user] = await db.update(usersTable).set({
      walletBalance: sql`${usersTable.walletBalance} + ${Number(amount)}`,
    }).where(eq(usersTable.id, userId))
      .returning({ id: usersTable.id, name: usersTable.name, walletBalance: usersTable.walletBalance });
    if (!user) { res.status(404).json({ error: "Utilisateur introuvable" }); return; }

    const [adminUser] = await db.select({ name: usersTable.name, email: usersTable.email })
      .from(usersTable).where(eq(usersTable.id, req.userId!)).limit(1);
    await logActivity({ userId: req.userId, userEmail: adminUser?.email, userName: adminUser?.name, action: "wallet_credit", entity: "user", entityId: userId, details: { amount: Number(amount), reason }, ip: req.ip });

    res.json({ success: true, newBalance: user.walletBalance, message: `${amount} DH crédité sur le wallet de ${user.name}` });
  } catch (err) { next(err); }
});

const ASSIGNABLE_ROLES = ["super_admin", "admin", "manager", "restaurant_owner", "employee", "customer", "driver", "other"] as const;
type AssignableRole = typeof ASSIGNABLE_ROLES[number];

/** Update any user's role (super_admin only) */
router.patch("/backend/users/:id/role", requireAuth, async (req: AuthedRequest, res, next): Promise<void> => {
  if (!isSuperAdmin(req.userRole)) { res.status(403).json({ error: "Forbidden: super_admin requis" }); return; }
  try {
    const userId = parseInt(String(req.params.id), 10);
    if (isNaN(userId)) { res.status(400).json({ error: "Invalid id" }); return; }
    const { role } = req.body ?? {};
    if (!role) { res.status(400).json({ error: "role requis" }); return; }
    if (!(ASSIGNABLE_ROLES as readonly string[]).includes(role)) {
      res.status(400).json({ error: `Rôle invalide. Valeurs acceptées: ${ASSIGNABLE_ROLES.join(", ")}` }); return;
    }
    const [user] = await db.update(usersTable).set({ role: role as AssignableRole }).where(eq(usersTable.id, userId))
      .returning({ id: usersTable.id, name: usersTable.name, role: usersTable.role });
    if (!user) { res.status(404).json({ error: "Utilisateur introuvable" }); return; }
    res.json(user);
  } catch (err) { next(err); }
});

// ────────────────────────────────────────────────────────────────────────────
// FULL USER CRUD (for admin panel)
// ────────────────────────────────────────────────────────────────────────────

router.get("/backend/users", requireAuth, async (req: AuthedRequest, res, next): Promise<void> => {
  if (!isAdmin(req.userRole)) { res.status(403).json({ error: "Forbidden" }); return; }
  try {
    const { search, role } = req.query;
    let query = db.select({
      id: usersTable.id, name: usersTable.name, email: usersTable.email,
      role: usersTable.role, phone: usersTable.phone, isActive: usersTable.isActive,
      walletBalance: usersTable.walletBalance, loyaltyPoints: usersTable.loyaltyPoints,
      assignedShopId: usersTable.assignedShopId, createdAt: usersTable.createdAt,
    }).from(usersTable).$dynamic();

    const conditions = [];
    if (role) conditions.push(eq(usersTable.role, String(role)));
    if (search) conditions.push(sql`(${usersTable.name} ILIKE ${'%' + search + '%'} OR ${usersTable.email} ILIKE ${'%' + search + '%'})`);
    if (conditions.length > 0) query = query.where(and(...conditions)) as any;

    const users = await query.orderBy(desc(usersTable.createdAt)).limit(500);
    res.json(users);
  } catch (err) { next(err); }
});

router.post("/backend/users", requireAuth, async (req: AuthedRequest, res, next): Promise<void> => {
  if (!isSuperAdmin(req.userRole)) { res.status(403).json({ error: "Forbidden" }); return; }
  try {
    const { name, email, password, role, phone, isActive } = req.body;
    if (!name || !email || !password) { res.status(400).json({ error: "name, email, password requis" }); return; }
    const hashed = await bcrypt.hash(String(password), 12);
    const [user] = await db.insert(usersTable).values({
      name, email: String(email).toLowerCase().trim(),
      password: hashed, role: role ?? "customer",
      phone: phone ?? null, isActive: isActive ?? true,
    }).returning({ id: usersTable.id, name: usersTable.name, email: usersTable.email, role: usersTable.role });

    const [adminUser] = await db.select({ name: usersTable.name, email: usersTable.email })
      .from(usersTable).where(eq(usersTable.id, req.userId!)).limit(1);
    await logActivity({ userId: req.userId, userEmail: adminUser?.email, userName: adminUser?.name, action: "create", entity: "user", entityId: user.id, ip: req.ip });

    res.status(201).json(user);
  } catch (err: any) {
    if (err?.code === "23505") { res.status(409).json({ error: "Cet email est déjà utilisé" }); return; }
    next(err);
  }
});

router.patch("/backend/users/:id", requireAuth, async (req: AuthedRequest, res, next): Promise<void> => {
  if (!isAdmin(req.userRole)) { res.status(403).json({ error: "Forbidden" }); return; }
  try {
    const userId = parseInt(String(req.params.id), 10);
    if (isNaN(userId)) { res.status(400).json({ error: "Invalid id" }); return; }
    const allowed = ["name", "email", "phone", "address", "isActive", "avatarUrl", "loyaltyPoints", "walletBalance"];
    const updates: Record<string, unknown> = {};
    const body = req.body ?? {};
    for (const k of allowed) if (body[k] !== undefined) updates[k] = body[k];
    const [user] = await db.update(usersTable).set(updates as any).where(eq(usersTable.id, userId))
      .returning({ id: usersTable.id, name: usersTable.name, email: usersTable.email, role: usersTable.role });
    if (!user) { res.status(404).json({ error: "Utilisateur introuvable" }); return; }
    if (updates.isActive === false) closeUserSubscriptions(userId);
    res.json(user);
  } catch (err) { next(err); }
});

router.delete("/backend/users/:id", requireAuth, async (req: AuthedRequest, res, next): Promise<void> => {
  if (!isSuperAdmin(req.userRole)) { res.status(403).json({ error: "Forbidden" }); return; }
  try {
    const userId = parseInt(String(req.params.id), 10);
    if (isNaN(userId)) { res.status(400).json({ error: "Invalid id" }); return; }
    if (userId === req.userId) { res.status(400).json({ error: "Vous ne pouvez pas supprimer votre propre compte" }); return; }
    const [adminUser] = await db.select({ name: usersTable.name, email: usersTable.email })
      .from(usersTable).where(eq(usersTable.id, req.userId!)).limit(1);
    const deleted = await db.delete(usersTable).where(eq(usersTable.id, userId))
      .returning({ id: usersTable.id });
    if (deleted.length > 0) closeUserSubscriptions(userId);
    await logActivity({ userId: req.userId, userEmail: adminUser?.email, userName: adminUser?.name, action: "delete", entity: "user", entityId: userId, ip: req.ip });
    res.json({ success: true });
  } catch (err: any) {
    if (err?.code === "23503") { res.status(409).json({ error: "Cet utilisateur est référencé par des données existantes" }); return; }
    next(err);
  }
});

// ────────────────────────────────────────────────────────────────────────────
// ACTIVITY AUDIT LOG
// ────────────────────────────────────────────────────────────────────────────

router.get("/backend/audit", requireAuth, async (req: AuthedRequest, res, next): Promise<void> => {
  if (!isAdmin(req.userRole)) { res.status(403).json({ error: "Forbidden" }); return; }
  try {
    const page = Math.max(1, parseInt(String(req.query.page ?? "1"), 10));
    const limit = Math.min(200, parseInt(String(req.query.limit ?? "50"), 10));
    const offset = (page - 1) * limit;

    const conditions: any[] = [];
    if (req.query.action) conditions.push(eq(activityLogsTable.action, String(req.query.action)));
    if (req.query.entity) conditions.push(eq(activityLogsTable.entity, String(req.query.entity)));
    if (req.query.userId) conditions.push(eq(activityLogsTable.userId, parseInt(String(req.query.userId), 10)));

    const where = conditions.length > 0 ? and(...conditions) : undefined;

    const [rows, totalRow] = await Promise.all([
      db.select().from(activityLogsTable).where(where).orderBy(desc(activityLogsTable.createdAt)).limit(limit).offset(offset),
      db.select({ count: count() }).from(activityLogsTable).where(where),
    ]);

    res.json({ rows, total: totalRow[0]?.count ?? 0, page, limit });
  } catch (err) { next(err); }
});

// ────────────────────────────────────────────────────────────────────────────
// DATA EXPORT  (CSV | JSON)
// ────────────────────────────────────────────────────────────────────────────

router.get("/backend/export/:entity", requireAuth, async (req: AuthedRequest, res, next): Promise<void> => {
  if (!isAdmin(req.userRole)) { res.status(403).json({ error: "Forbidden" }); return; }
  try {
    const { entity } = req.params;
    const fmt = String(req.query.format ?? "json").toLowerCase();
    const dateStr = new Date().toISOString().split("T")[0];

    let data: Record<string, unknown>[] = [];

    switch (entity) {
      case "orders":
        data = (await db.select().from(ordersTable).orderBy(desc(ordersTable.createdAt)).limit(10000)) as any;
        break;
      case "customers":
        data = (await db.select({
          id: usersTable.id, name: usersTable.name, email: usersTable.email, phone: usersTable.phone,
          address: usersTable.address, loyaltyPoints: usersTable.loyaltyPoints,
          walletBalance: usersTable.walletBalance, isActive: usersTable.isActive, createdAt: usersTable.createdAt,
        }).from(usersTable).where(eq(usersTable.role, "customer")).orderBy(desc(usersTable.createdAt)).limit(10000)) as any;
        break;
      case "products":
        data = (await db.select().from(menuItemsTable).orderBy(menuItemsTable.name).limit(10000)) as any;
        break;
      case "staff":
        data = (await db.select({
          id: usersTable.id, name: usersTable.name, email: usersTable.email, role: usersTable.role,
          phone: usersTable.phone, isActive: usersTable.isActive, assignedShopId: usersTable.assignedShopId, createdAt: usersTable.createdAt,
        }).from(usersTable).where(sql`${usersTable.role} NOT IN ('customer', 'driver')`).orderBy(usersTable.name).limit(10000)) as any;
        break;
      case "restaurants":
        data = (await db.select().from(restaurantsTable).orderBy(restaurantsTable.name).limit(10000)) as any;
        break;
      case "promo-codes":
        data = (await db.select().from(promoCodesTable).orderBy(desc(promoCodesTable.createdAt)).limit(10000)) as any;
        break;
      case "drivers":
        data = (await db.select({
          id: driversTable.id, userId: driversTable.userId, vehicleType: driversTable.vehicleType,
          vehiclePlate: driversTable.vehiclePlate, isAvailable: driversTable.isAvailable,
          totalDeliveries: driversTable.totalDeliveries, rating: driversTable.rating,
          createdAt: driversTable.createdAt,
        }).from(driversTable).orderBy(desc(driversTable.createdAt)).limit(10000)) as any;
        break;
      case "refunds":
        data = (await db.select().from(refundsTable).orderBy(desc(refundsTable.createdAt)).limit(10000)) as any;
        break;
      case "audit":
        data = (await db.select().from(activityLogsTable).orderBy(desc(activityLogsTable.createdAt)).limit(10000)) as any;
        break;
      default:
        res.status(400).json({ error: `Entité inconnue: ${entity}` }); return;
    }

    if (fmt === "csv") {
      const csv = toCSV(data);
      res.setHeader("Content-Type", "text/csv; charset=utf-8");
      res.setHeader("Content-Disposition", `attachment; filename="${entity}-${dateStr}.csv"`);
      res.send(csv);
    } else {
      res.setHeader("Content-Type", "application/json");
      res.setHeader("Content-Disposition", `attachment; filename="${entity}-${dateStr}.json"`);
      res.send(JSON.stringify(data, null, 2));
    }

    const [adminUser] = await db.select({ name: usersTable.name, email: usersTable.email })
      .from(usersTable).where(eq(usersTable.id, req.userId!)).limit(1);
    await logActivity({ userId: req.userId, userEmail: adminUser?.email, userName: adminUser?.name, action: "export", entity, details: { format: fmt, count: data.length }, ip: req.ip });
  } catch (err) { next(err); }
});

// ────────────────────────────────────────────────────────────────────────────
// DATA IMPORT  (JSON body)
// ────────────────────────────────────────────────────────────────────────────

router.post("/backend/import/menu-items", requireAuth, async (req: AuthedRequest, res, next): Promise<void> => {
  if (!isAdmin(req.userRole)) { res.status(403).json({ error: "Forbidden" }); return; }
  try {
    const { items, restaurantId } = req.body;
    if (!Array.isArray(items) || !restaurantId) {
      res.status(400).json({ error: "items[] et restaurantId requis" }); return;
    }
    let created = 0;
    const errors: { row: number; error: string }[] = [];
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (!item.name || item.price === undefined) { errors.push({ row: i + 1, error: "name et price requis" }); continue; }
      try {
        await db.insert(menuItemsTable).values({
          restaurantId: Number(restaurantId),
          name: String(item.name),
          description: item.description ?? null,
          price: Number(item.price),
          category: item.category ?? "Main",
          imageUrl: item.imageUrl ?? null,
          isAvailable: item.isAvailable !== false,
          isPopular: item.isPopular === true,
          allergens: item.allergens ?? null,
          tags: item.tags ? (Array.isArray(item.tags) ? item.tags : String(item.tags).split(",").map((s: string) => s.trim())) : null,
          prepTimeMinutes: item.prepTimeMinutes ? Number(item.prepTimeMinutes) : null,
          calories: item.calories ? Number(item.calories) : null,
        });
        created++;
      } catch (e: any) {
        errors.push({ row: i + 1, error: e?.message ?? "Erreur" });
      }
    }

    const [adminUser] = await db.select({ name: usersTable.name, email: usersTable.email })
      .from(usersTable).where(eq(usersTable.id, req.userId!)).limit(1);
    await logActivity({ userId: req.userId, userEmail: adminUser?.email, userName: adminUser?.name, action: "import", entity: "product", details: { created, errors: errors.length, restaurantId }, ip: req.ip });

    res.json({ success: true, created, errors, total: items.length });
  } catch (err) { next(err); }
});

router.post("/backend/import/promo-codes", requireAuth, async (req: AuthedRequest, res, next): Promise<void> => {
  if (!isSuperAdmin(req.userRole)) { res.status(403).json({ error: "Forbidden" }); return; }
  try {
    const { codes } = req.body;
    if (!Array.isArray(codes)) { res.status(400).json({ error: "codes[] requis" }); return; }
    let created = 0;
    const errors: { row: number; error: string }[] = [];
    for (let i = 0; i < codes.length; i++) {
      const c = codes[i];
      if (!c.code || !c.type) { errors.push({ row: i + 1, error: "code et type requis" }); continue; }
      try {
        await db.insert(promoCodesTable).values({
          code: String(c.code).toUpperCase().trim(),
          description: c.description ?? null,
          type: c.type, value: Number(c.value ?? 0),
          minOrderAmount: Number(c.minOrderAmount ?? 0),
          maxUses: c.maxUses ? Number(c.maxUses) : null,
          maxUsesPerUser: Number(c.maxUsesPerUser ?? 1),
          firstOrderOnly: c.firstOrderOnly === true,
          restaurantId: c.restaurantId ? Number(c.restaurantId) : null,
          isActive: c.isActive !== false,
          expiresAt: c.expiresAt ? new Date(c.expiresAt) : null,
        });
        created++;
      } catch (e: any) {
        errors.push({ row: i + 1, error: e?.message ?? "Erreur" });
      }
    }
    res.json({ success: true, created, errors, total: codes.length });
  } catch (err) { next(err); }
});

// ────────────────────────────────────────────────────────────────────────────
// SYSTEM MONITORING
// ────────────────────────────────────────────────────────────────────────────

router.get("/backend/system", requireAuth, async (req: AuthedRequest, res, next): Promise<void> => {
  if (!isSuperAdmin(req.userRole)) { res.status(403).json({ error: "Forbidden: super_admin requis" }); return; }
  try {
    const uptimeSeconds = process.uptime();
    const mem = process.memoryUsage();
    const totalMem = os.totalmem();
    const freeMem = os.freemem();
    const cpuLoad = os.loadavg();
    const cpus = os.cpus();

    const [orderCount, userCount, productCount, restaurantCount, auditCount] = await Promise.all([
      db.select({ count: count() }).from(ordersTable),
      db.select({ count: count() }).from(usersTable),
      db.select({ count: count() }).from(menuItemsTable),
      db.select({ count: count() }).from(restaurantsTable),
      db.select({ count: count() }).from(activityLogsTable),
    ]);

    res.json({
      uptime: uptimeSeconds,
      uptimeHuman: formatUptime(uptimeSeconds),
      nodeVersion: process.version,
      environment: process.env.NODE_ENV ?? "development",
      /** Configured via --max-old-space-size=4096 in the start script. */
      heapMaxConfigured: 4096,
      memory: {
        heapUsed: mem.heapUsed,
        heapTotal: mem.heapTotal,
        rss: mem.rss,
        external: mem.external,
        systemTotal: totalMem,
        systemFree: freeMem,
        systemUsedPercent: Math.round(((totalMem - freeMem) / totalMem) * 100),
      },
      cpu: {
        loadAvg1: Math.round(cpuLoad[0] * 100) / 100,
        loadAvg5: Math.round(cpuLoad[1] * 100) / 100,
        loadAvg15: Math.round(cpuLoad[2] * 100) / 100,
        cores: cpus.length,
        model: cpus[0]?.model ?? "Unknown",
      },
      platform: os.platform(),
      arch: os.arch(),
      hostname: os.hostname(),
      database: {
        orders: orderCount[0]?.count ?? 0,
        users: userCount[0]?.count ?? 0,
        products: productCount[0]?.count ?? 0,
        restaurants: restaurantCount[0]?.count ?? 0,
        auditLogs: auditCount[0]?.count ?? 0,
      },
      timestamp: new Date().toISOString(),
    });
  } catch (err) { next(err); }
});

// ────────────────────────────────────────────────────────────────────────────
// DB BACKUP
// ────────────────────────────────────────────────────────────────────────────

router.post("/backend/db/backup", requireAuth, async (req: AuthedRequest, res, next): Promise<void> => {
  if (!isSuperAdmin(req.userRole)) { res.status(403).json({ error: "Forbidden: super_admin requis" }); return; }
  try {
    const dbUrl = process.env.DATABASE_URL;
    if (!dbUrl) { res.status(500).json({ error: "DATABASE_URL non configuré" }); return; }
    const { stdout } = await execAsync(`pg_dump "${dbUrl}" --no-owner --no-acl --format=plain`, {
      maxBuffer: 100 * 1024 * 1024,
      timeout: 60000,
    });
    const filename = `backup-${new Date().toISOString().replace(/[:.]/g, "-")}.sql`;
    const [adminUser] = await db.select({ name: usersTable.name, email: usersTable.email })
      .from(usersTable).where(eq(usersTable.id, req.userId!)).limit(1);
    await logActivity({ userId: req.userId, userEmail: adminUser?.email, userName: adminUser?.name, action: "db_backup", entity: "system", ip: req.ip });
    res.setHeader("Content-Type", "application/sql");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.send(stdout);
  } catch (err: any) {
    res.status(500).json({ error: "Backup échoué: " + (err?.message ?? "pg_dump unavailable") });
  }
});

// ────────────────────────────────────────────────────────────────────────────
// MEDIA BACKUP
// ────────────────────────────────────────────────────────────────────────────

router.post("/backend/media/backup", requireAuth, async (req: AuthedRequest, res, next): Promise<void> => {
  if (!isSuperAdmin(req.userRole)) { res.status(403).json({ error: "Forbidden: super_admin requis" }); return; }

  let outputDir: string | undefined;
  try {
    outputDir = await mkdtemp(path.join(os.tmpdir(), "jatek-media-backup-"));
    const backup = await createMediaBackup(outputDir);
    const [adminUser] = await db.select({ name: usersTable.name, email: usersTable.email })
      .from(usersTable).where(eq(usersTable.id, req.userId!)).limit(1);

    await logActivity({
      userId: req.userId,
      userEmail: adminUser?.email,
      userName: adminUser?.name,
      action: "media_backup",
      entity: "system",
      details: {
        objectCount: backup.objectCount,
        totalBytes: backup.totalBytes,
        archiveSize: backup.archive.size,
        manifestSha256: backup.manifestSha256,
        verification: backup.verification,
      },
      ip: req.ip,
    });

    res.setHeader("Content-Type", "application/gzip");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="jatek-media-backup-${new Date().toISOString().replace(/[:.]/g, "-")}.tar.gz"`,
    );
    res.setHeader("X-Media-Backup-Object-Count", String(backup.objectCount));
    res.setHeader("X-Media-Backup-Total-Bytes", String(backup.totalBytes));
    res.setHeader("X-Media-Backup-Archive-Size", String(backup.archive.size));
    res.setHeader("X-Media-Backup-Manifest-Sha256", backup.manifestSha256);
    res.setHeader("X-Media-Backup-Verification", backup.verification);

    await new Promise<void>((resolve, reject) => {
      res.sendFile(backup.archivePath, (error) => {
        if (error) reject(error);
        else resolve();
      });
    });
  } catch (error) {
    if (res.headersSent) {
      console.error("[media-backup] response failed after headers were sent", error);
    } else {
      next(error);
    }
  } finally {
    if (outputDir) await rm(outputDir, { recursive: true, force: true }).catch((cleanupError) => {
      console.error("[media-backup] temporary directory cleanup failed", cleanupError);
    });
  }
});

// ────────────────────────────────────────────────────────────────────────────
// AUTO-CLOSE SCHEDULER — exported for use in app.ts
// ────────────────────────────────────────────────────────────────────────────

/**
 * Checks all restaurants against their weekly schedule every minute.
 * Auto-opens/closes isOpen based on current day + time.
 */
export function startRestaurantAutoCloseScheduler() {
  const tick = async () => {
    try {
      const now = new Date();
      const dayOfWeek = now.getDay(); // 0=Sun
      const currentMinutes = now.getHours() * 60 + now.getMinutes();

      const allHours = await db.select().from(restaurantHoursTable).where(eq(restaurantHoursTable.dayOfWeek, dayOfWeek));
      if (allHours.length === 0) return;

      const restaurantIds = allHours.map((h) => h.restaurantId);
      const restaurants = await db.select({ id: restaurantsTable.id, isOpen: restaurantsTable.isOpen })
        .from(restaurantsTable)
        .where(inArray(restaurantsTable.id, restaurantIds));

      const restaurantMap = new Map(restaurants.map((r) => [r.id, r.isOpen]));

      for (const h of allHours) {
        const shouldBeOpen = !h.isClosed && (() => {
          const [oh, om] = h.openTime.split(":").map(Number);
          const [ch, cm] = h.closeTime.split(":").map(Number);
          const open = oh * 60 + om;
          const close = ch * 60 + cm;
          return currentMinutes >= open && currentMinutes < close;
        })();

        const currentlyOpen = restaurantMap.get(h.restaurantId);
        if (shouldBeOpen !== currentlyOpen) {
          await db.update(restaurantsTable)
            .set({ isOpen: shouldBeOpen })
            .where(eq(restaurantsTable.id, h.restaurantId));
        }
      }
    } catch (e) {
      console.error("[scheduler] auto-close tick failed", e);
    }
  };

  const interval = setInterval(tick, 60_000);
  // The HTTP server itself keeps production alive; do not keep short-lived
  // scripts and integration tests alive solely because this scheduler exists.
  interval.unref?.();
  tick(); // run immediately on start
  console.info("[scheduler] restaurant auto-close started");
}

// ────────────────────────────────────────────────────────────────────────────
// APP CONFIG (public read + admin write)
// ────────────────────────────────────────────────────────────────────────────

const DEFAULT_APP_CONFIG = {
  defaultLanguage: "fr",
  maintenanceMode: false,
  featuredCount: 6,
  homeOrder: ["categories", "banners", "shorts", "popular", "new_restaurants", "supermarkets", "new_products", "shops", "all", "free_delivery", "newest", "support"],
  welcomeMessage: "Bienvenue sur Jatek !",
  splashLogoUrl: "/api/splash/jatek-intro-splash.png",
  homeSections: getDefaultHomeSections(),
  legalContent: getDefaultLegalContent(),
} satisfies AppConfig;

async function getAppConfig(): Promise<AppConfig> {
  const rows = await db.select().from(appConfigTable);
  if (!rows.some((row) => row.key === "legalContent")) {
    await db.insert(appConfigTable)
      .values({ key: "legalContent", value: getDefaultLegalContent() })
      .onConflictDoNothing();
  }
  const config: Record<string, unknown> = { ...DEFAULT_APP_CONFIG };
  for (const row of rows) {
    config[row.key] = row.value;
  }
  // Validate persisted JSON as well as writes. This prevents a malformed
  // admin value from being exposed to every mobile client.
  const savedHomeSections = config.homeSections && typeof config.homeSections === "object"
    ? config.homeSections as Record<string, unknown>
    : {};
  const defaultHomeSections = getDefaultHomeSections();
  const mergedHomeSections = Object.fromEntries(
    Object.entries(defaultHomeSections).map(([key, value]) => [
      key,
      savedHomeSections[key] && typeof savedHomeSections[key] === "object"
        ? { ...value, ...(savedHomeSections[key] as Record<string, unknown>) }
        : value,
    ]),
  );
  const parsedHomeSections = homeSectionsSchema.safeParse(mergedHomeSections);
  if (!parsedHomeSections.success) {
    throw new Error("Stored homeSections configuration is invalid");
  }
  const parsedHomeOrder = homeOrderSchema.safeParse(config.homeOrder);
  const parsedSplash = splashVideoUrlSchema.safeParse(config.splashVideoUrl ?? "");
  const splashLogoValue = typeof config.splashLogoUrl === "string" && config.splashLogoUrl.trim()
    ? config.splashLogoUrl
    : DEFAULT_APP_CONFIG.splashLogoUrl;
  const parsedSplashLogo = splashLogoUrlSchema.safeParse(splashLogoValue);
  const parsedLegalContent = legalContentSchema.safeParse(config.legalContent);
  return {
    ...config,
    homeOrder: parsedHomeOrder.success ? parsedHomeOrder.data : DEFAULT_APP_CONFIG.homeOrder,
    homeSections: parsedHomeSections.data,
    legalContent: parsedLegalContent.success ? parsedLegalContent.data : getDefaultLegalContent(),
    splashVideoUrl: parsedSplash.success ? parsedSplash.data : "",
    splashLogoUrl: parsedSplashLogo.success ? parsedSplashLogo.data : "",
  } as AppConfig;
}

/** Public endpoint read by the mobile app at startup (no auth required). */
router.get("/app-config", async (_req, res, next): Promise<void> => {
  try { res.json(await getAppConfig()); }
  catch (err) { next(err); }
});

/** Admin: read full config */
router.get("/backend/app-config", requireAuth, async (req: AuthedRequest, res, next): Promise<void> => {
  if (!isSuperAdmin(req.userRole)) { res.status(403).json({ error: "Forbidden" }); return; }
  try { res.json(await getAppConfig()); }
  catch (err) { next(err); }
});

/** Admin: upsert one or more config keys */
router.put("/backend/app-config", requireAuth, async (req: AuthedRequest, res, next): Promise<void> => {
  if (!isSuperAdmin(req.userRole)) { res.status(403).json({ error: "Forbidden" }); return; }
  try {
    const body = req.body;
    if (!body || typeof body !== "object" || Array.isArray(body)) {
      res.status(400).json({ error: "Configuration body must be an object" });
      return;
    }
    const entries = Object.entries(body);
    if (entries.length === 0) { res.status(400).json({ error: "No config keys provided" }); return; }
    const parsedConfig = appConfigPatchSchema.safeParse(body);
    if (!parsedConfig.success) {
      res.status(400).json({
        error: "Invalid app configuration",
        details: parsedConfig.error.issues,
      });
      return;
    }
    const validatedEntries = Object.entries(parsedConfig.data) as Array<[string, unknown]>;
    const splashVideoEntry = validatedEntries.find(([key]) => key === "splashVideoUrl");
    if (splashVideoEntry) {
      splashVideoEntry[1] = normalizeStoredMediaPath(splashVideoEntry[1]) ?? "";
    }
    const splashLogoEntry = validatedEntries.find(([key]) => key === "splashLogoUrl");
    if (splashLogoEntry) {
      splashLogoEntry[1] = normalizeStoredMediaPath(splashLogoEntry[1]) ?? "";
    }
    for (const [key, value] of validatedEntries) {
      await db
        .insert(appConfigTable)
        .values({ key, value })
        .onConflictDoUpdate({
          target: appConfigTable.key,
          set: { value: value as any, updatedAt: new Date() },
        });
    }
    await logActivity({
      userId: req.userId,
      action: "update",
      entity: "app_config",
      details: { keys: validatedEntries.map(([key]) => key) },
      ip: req.ip,
    });
    res.json({ ok: true, updated: validatedEntries.length, keys: validatedEntries.map(([key]) => key) });
  } catch (err) { next(err); }
});

export default router;
