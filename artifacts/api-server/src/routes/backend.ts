import { Router, type IRouter, type Response } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import {
  db,
  usersTable,
  restaurantsTable,
  ordersTable,
  orderItemsTable,
  menuItemsTable,
  menuItemCategoriesTable,
  driversTable,
  reviewsTable,
  dashboardTodosTable,
  categoriesTable,
  platformSettingsTable,
} from "@workspace/db";
import { eq, inArray, count, sum, gte, ilike, and, or, desc, sql } from "drizzle-orm";
import { requireAuth, type AuthedRequest } from "../middlewares/auth";
import {
  sendOtpMessage,
  twilioConfigured,
  twilioCredentialMode,
  twilioVerifyConfigured,
} from "../lib/otpMessaging";
import { dispatchNotificationToUsers } from "./notificationPrefs";
import * as tracking from "../lib/trackingService";
import { closeUserSubscriptions, publish } from "../lib/sse";
import { DEFAULT_PLATFORM_SETTINGS, getPlatformSettingNumber } from "../lib/platformSettings";
import { normalizeStoredMediaPath, resolveLegacyMediaPath } from "../lib/objectStorage";

const router: IRouter = Router();

function parseDecimal(value: unknown): number {
  const parsed = Number(String(value ?? "").trim().replace(",", "."));
  return Number.isFinite(parsed) ? parsed : 0;
}

function permissionPatternMatches(pattern: string, permission: string): boolean {
  if (pattern === "*") return true;
  if (!pattern.includes("*")) return pattern === permission;
  const escaped = pattern
    .replace(/[.+?^${}()|[\]\\]/g, "\\$&")
    .replace(/\*/g, ".*");
  return new RegExp(`^${escaped}$`).test(permission);
}

function categorySlugBase(name: string): string {
  return name.toLowerCase().normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "")
    .replace(/^-+|-+$/g, "") || "category";
}

async function uniqueCategorySlug(name: string, excludeId?: number): Promise<string> {
  const base = categorySlugBase(name);
  for (let suffix = 0; suffix < 1000; suffix++) {
    const slug = suffix === 0 ? base : `${base}-${suffix + 1}`;
    const [existing] = await db.select({ id: categoriesTable.id })
      .from(categoriesTable)
      .where(eq(categoriesTable.slug, slug))
      .limit(1);
    if (!existing || existing.id === excludeId) return slug;
  }
  throw new Error("Unable to generate a unique category slug");
}

type ShopCategoryResolution =
  | { ok: true; category: string; businessType: string; subcategoryId: number | null }
  | { ok: false; error: string };

/**
 * Resolve the canonical shop category while preserving the legacy text field.
 * A subcategory ID always wins over client-provided names and business types.
 * Unknown legacy category text is kept so old records remain editable.
 */
async function resolveShopCategory(input: {
  category?: unknown;
  businessType?: unknown;
  subcategoryId?: unknown;
  requireActive?: boolean;
}): Promise<ShopCategoryResolution> {
  const categoryText = typeof input.category === "string" ? input.category.trim() : "";
  const requestedBusinessType = typeof input.businessType === "string"
    ? input.businessType.trim()
    : "";
  const rawSubcategoryId = input.subcategoryId;
  const hasSubcategory = rawSubcategoryId !== undefined && rawSubcategoryId !== null && rawSubcategoryId !== "";
  const subcategoryId = hasSubcategory ? Number(rawSubcategoryId) : null;

  if (subcategoryId !== null && (!Number.isInteger(subcategoryId) || subcategoryId <= 0)) {
    return { ok: false, error: "subcategoryId invalide" };
  }

  const matches = categoryText
    ? await db.select().from(categoriesTable)
      .where(sql`lower(${categoriesTable.name}) = ${categoryText.toLowerCase()}`)
    : [];

  if (subcategoryId !== null) {
    const [subcategory] = await db.select().from(categoriesTable)
      .where(eq(categoriesTable.id, subcategoryId))
      .limit(1);
    if (!subcategory || !subcategory.parentId || subcategory.type !== "subcategory") {
      return { ok: false, error: "Sous-catégorie invalide" };
    }

    const [parent] = await db.select().from(categoriesTable)
      .where(eq(categoriesTable.id, subcategory.parentId))
      .limit(1);
    if (!parent || parent.parentId) {
      return { ok: false, error: "Catégorie parente invalide" };
    }
    if (input.requireActive && (!parent.isActive || !subcategory.isActive)) {
      return { ok: false, error: "La catégorie sélectionnée est inactive" };
    }

    return {
      ok: true,
      category: subcategory.name,
      businessType: parent.businessType,
      subcategoryId: subcategory.id,
    };
  }

  const parents = matches.filter((row) => !row.parentId);
  if (parents.length > 1) {
    return { ok: false, error: "La catégorie de boutique est ambiguë" };
  }
  const parent = parents[0];
  if (parent) {
    if (input.requireActive && !parent.isActive) {
      return { ok: false, error: "La catégorie sélectionnée est inactive" };
    }
    return {
      ok: true,
      category: parent.name,
      businessType: parent.businessType,
      subcategoryId: null,
    };
  }

  // Backfill an unambiguous legacy child name into the canonical relation.
  const children = matches.filter((row) => !!row.parentId && row.type === "subcategory");
  if (children.length === 1) {
    const child = children[0];
    const [parentForChild] = await db.select().from(categoriesTable)
      .where(eq(categoriesTable.id, child.parentId!))
      .limit(1);
    if (!parentForChild) return { ok: false, error: "Catégorie parente introuvable" };
    if (input.requireActive && (!parentForChild.isActive || !child.isActive)) {
      return { ok: false, error: "La catégorie sélectionnée est inactive" };
    }
    return {
      ok: true,
      category: child.name,
      businessType: parentForChild.businessType,
      subcategoryId: child.id,
    };
  }

  return {
    ok: true,
    category: categoryText || "Other",
    businessType: requestedBusinessType || "restaurant",
    subcategoryId: null,
  };
}

const JWT_SECRET = process.env.SESSION_SECRET!; // validated at startup by auth middleware

// ---------- Roles + permissions ----------
type RoleKey = "super_admin" | "admin" | "manager" | "restaurant_owner" | "owner" | "employee" | "customer" | "driver" | "other";

/**
 * All permission keys exposed to the dashboard. Super admins use this list when
 * customizing per-user (role='other') access.
 */
export const ALL_PERMISSION_KEYS: { key: string; label: string; group: string }[] = [
  { key: "dashboard.view", label: "Voir le tableau de bord", group: "Général" },
  { key: "orders.read", label: "Lire les commandes", group: "Commandes" },
  { key: "orders.write", label: "Modifier les commandes", group: "Commandes" },
  { key: "orders.update_status", label: "Changer le statut", group: "Commandes" },
  { key: "shops.read", label: "Lire les boutiques", group: "Boutiques" },
  { key: "shops.write", label: "Créer/éditer boutiques", group: "Boutiques" },
  { key: "shops.commission.write", label: "Configurer les commissions boutiques", group: "Boutiques" },
  { key: "shops.delete", label: "Supprimer boutiques", group: "Boutiques" },
  { key: "products.read", label: "Lire les produits", group: "Produits" },
  { key: "products.write", label: "Créer/éditer produits", group: "Produits" },
  { key: "products.delete", label: "Supprimer produits", group: "Produits" },
  { key: "categories.read", label: "Lire catégories", group: "Catégories" },
  { key: "categories.write", label: "Gérer catégories", group: "Catégories" },
  { key: "customers.read", label: "Lire les clients", group: "Clients" },
  { key: "customers.write", label: "Éditer/désactiver clients", group: "Clients" },
  { key: "deliverymen.read", label: "Lire les livreurs", group: "Livreurs" },
  { key: "deliverymen.write", label: "Gérer les livreurs", group: "Livreurs" },
  { key: "reviews.read", label: "Lire les avis", group: "Avis" },
  { key: "reviews.delete", label: "Supprimer des avis", group: "Avis" },
  { key: "staff.read", label: "Lire le personnel", group: "Personnel" },
  { key: "staff.write", label: "Gérer le personnel", group: "Personnel" },
  { key: "promotions.read", label: "Lire promotions", group: "Promotions" },
  { key: "promotions.write", label: "Gérer promotions", group: "Promotions" },
  { key: "wallets.read", label: "Lire les wallets", group: "Wallets" },
  { key: "wallets.write", label: "Gérer les wallets", group: "Wallets" },
  { key: "content.read", label: "Lire le contenu", group: "Contenu" },
  { key: "content.write", label: "Éditer le contenu", group: "Contenu" },
];

const ROLE_DEFS: { key: RoleKey; label: string; description: string; permissions: string[] }[] = [
  {
    key: "super_admin",
    label: "Super Admin",
    description: "Accès total, gestion des admins et paramètres système",
    permissions: ["*"],
  },
  {
    key: "admin",
    label: "Admin",
    description: "Gestion complète sauf super-admins et paramètres système",
    permissions: [
      "dashboard.view",
      "orders.*", "shops.*", "products.*", "categories.*", "reviews.*",
      "customers.*", "staff.read", "staff.write", "deliverymen.*",
      "promotions.*", "content.*", "wallets.*",
    ],
  },
  {
    key: "manager",
    label: "Manager",
    description: "Lecture sur tout, écriture sur opérations courantes",
    permissions: [
      "dashboard.view",
      "orders.*", "shops.read", "shops.write", "products.read", "products.write",
      "categories.read", "reviews.*", "customers.read", "deliverymen.read",
      "content.read", "promotions.read",
    ],
  },
  {
    key: "restaurant_owner",
    label: "Commerçant",
    description: "Voit et édite uniquement ses propres shops + leurs produits/orders/reviews",
    permissions: [
      "dashboard.view",
      "orders.read.own", "orders.update_status.own",
      "shops.read.own", "shops.write.own",
      "products.*.own", "reviews.read.own", "staff.read.own", "staff.write.own",
    ],
  },
  {
    key: "employee",
    label: "Employé",
    description: "Assigné à un shop — gère ses commandes, lecture seule sur produits",
    permissions: [
      "dashboard.view",
      "orders.read.shop", "orders.update_status.shop",
      "products.read.shop", "shops.read.shop",
    ],
  },
  {
    key: "customer",
    label: "Client",
    description: "Pas d'accès au dashboard backend",
    permissions: [],
  },
  {
    key: "driver",
    label: "Livreur",
    description: "Pas d'accès au dashboard backend (utilise l'app livreur)",
    permissions: [],
  },
  {
    key: "other",
    label: "Personnalisé",
    description: "Accès personnalisés assignés par un super admin",
    permissions: [],
  },
];

const STAFF_ROLES: RoleKey[] = ["super_admin", "admin", "manager", "restaurant_owner", "owner", "employee", "other"];

function getPermissionsForRole(role: string): string[] {
  const normalizedRole = role === "owner" ? "restaurant_owner" : role;
  return ROLE_DEFS.find((r) => r.key === normalizedRole)?.permissions ?? [];
}

/**
 * Compute the effective permission keys for a user, expanding wildcards.
 * For role='other', merges inheritedRoles + grants.
 */
function computeEffectivePermissions(role: string, custom: { inheritedRoles?: string[]; grants?: string[] } | null): string[] {
  if (role !== "other") return getPermissionsForRole(role);
  const inherited = (custom?.inheritedRoles ?? []).flatMap((r) => getPermissionsForRole(r));
  const grants = custom?.grants ?? [];
  return Array.from(new Set([...inherited, ...grants]));
}

/**
 * True when the user has the given permission. Supports '*' wildcard, group
 * wildcards like 'shops.*', and exact matches.
 */
function hasPermission(role: string, custom: { inheritedRoles?: string[]; grants?: string[] } | null, perm: string): boolean {
  const effective = computeEffectivePermissions(role, custom);
  return effective.some((grant) => permissionPatternMatches(grant, perm));
}

function canReadProducts(ctx: { role: string; permissions: { inheritedRoles?: string[]; grants?: string[] } | null }): boolean {
  return hasPermission(ctx.role, ctx.permissions, "products.read")
    || hasPermission(ctx.role, ctx.permissions, "products.read.own")
    || hasPermission(ctx.role, ctx.permissions, "products.read.shop");
}

function canWriteProducts(ctx: { role: string; permissions: { inheritedRoles?: string[]; grants?: string[] } | null }): boolean {
  return hasPermission(ctx.role, ctx.permissions, "products.write")
    || hasPermission(ctx.role, ctx.permissions, "products.write.own");
}

function canDeleteProducts(ctx: { role: string; permissions: { inheritedRoles?: string[]; grants?: string[] } | null }): boolean {
  return hasPermission(ctx.role, ctx.permissions, "products.delete")
    || hasPermission(ctx.role, ctx.permissions, "products.delete.own");
}

function parseCommissionRate(value: unknown, fallback?: number): number | null {
  if (value === undefined || value === null || value === "") return fallback ?? null;
  const parsed = Number(String(value).trim().replace(",", "."));
  return Number.isFinite(parsed) && parsed >= 0 && parsed <= 1 ? parsed : null;
}

async function findValidMenuCategory(
  restaurantId: number,
  categoryId: unknown,
  categoryName: unknown,
): Promise<typeof menuItemCategoriesTable.$inferSelect | null> {
  const parsedId = categoryId === undefined || categoryId === null || categoryId === ""
    ? null
    : Number(categoryId);
  if (parsedId !== null && (!Number.isInteger(parsedId) || parsedId <= 0)) return null;

  const name = typeof categoryName === "string" ? categoryName.trim() : "";
  const conditions = [
    eq(menuItemCategoriesTable.isActive, true),
    or(
      sql`${menuItemCategoriesTable.restaurantId} IS NULL`,
      eq(menuItemCategoriesTable.restaurantId, restaurantId),
    ),
  ];
  if (parsedId !== null) conditions.push(eq(menuItemCategoriesTable.id, parsedId));
  else if (name) conditions.push(eq(menuItemCategoriesTable.name, name));
  else return null;

  const rows = await db.select().from(menuItemCategoriesTable).where(and(...conditions));
  return rows.find((row) => row.restaurantId === restaurantId) ?? rows.find((row) => row.restaurantId === null) ?? null;
}

function validateSortOrder(value: unknown, fallback = 0): number | null {
  if (value === undefined || value === null || value === "") return fallback;
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed >= 0 ? parsed : null;
}

function parseBoolean(value: unknown, fallback: boolean): boolean {
  if (typeof value === "boolean") return value;
  if (value === "true") return true;
  if (value === "false") return false;
  return fallback;
}

function menuCategoryUsageCondition(category: {
  id: number;
  name: string;
  restaurantId: number | null;
}) {
  // Only products without a canonical ID need the legacy name fallback.
  // This prevents a global category rename/delete from touching an unrelated
  // private category that happens to share the same display name.
  const legacyMatch = and(
    sql`${menuItemsTable.menuItemCategoryId} IS NULL`,
    eq(menuItemsTable.category, category.name),
  )!;
  const categoryMatch = or(
    eq(menuItemsTable.menuItemCategoryId, category.id),
    legacyMatch,
  )!;
  return category.restaurantId === null
    ? categoryMatch
    : and(eq(menuItemsTable.restaurantId, category.restaurantId), categoryMatch);
}

/** Returns the list of shop IDs the user is scoped to, or null = no restriction. */
async function getScopedShopIds(userId: number, role: string, assignedShopId: number | null): Promise<number[] | null> {
  if (role === "restaurant_owner" || role === "owner") {
    const rows = await db.select({ id: restaurantsTable.id }).from(restaurantsTable).where(eq(restaurantsTable.ownerId, userId));
    return rows.map((r) => r.id);
  }
  if (role === "employee") {
    return assignedShopId ? [assignedShopId] : [];
  }
  return null; // unrestricted
}

async function requireBackendUser(req: AuthedRequest, res: Response): Promise<{ id: number; role: string; assignedShopId: number | null; permissions: { inheritedRoles?: string[]; grants?: string[] } | null } | null> {
  const userId = req.userId;
  const role = req.userRole;
  if (!userId || !role) {
    res.status(401).json({ error: "Authentication required" });
    return null;
  }
  if (!STAFF_ROLES.includes(role as RoleKey)) {
    res.status(403).json({ error: "Forbidden: dashboard access denied" });
    return null;
  }
  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, userId)).limit(1);
  if (!user) {
    res.status(401).json({ error: "User not found" });
    return null;
  }
  const permissions = (user as { permissions?: unknown }).permissions as { inheritedRoles?: string[]; grants?: string[] } | null ?? null;
  return { id: user.id, role: user.role, assignedShopId: user.assignedShopId, permissions };
}

// ---------- Auth ----------
router.post("/backend/login", async (req, res): Promise<void> => {
  const { email, password } = req.body || {};
  if (!email || !password) {
    res.status(400).json({ error: "Email and password are required" });
    return;
  }
  const [user] = await db.select().from(usersTable).where(eq(usersTable.email, String(email).toLowerCase().trim())).limit(1);
  if (!user) { res.status(401).json({ error: "Invalid credentials" }); return; }
  if (!user.isActive) { res.status(403).json({ error: "Account disabled" }); return; }
  if (!STAFF_ROLES.includes(user.role as RoleKey)) {
    res.status(403).json({ error: "This account does not have backend access" });
    return;
  }
  const ok = await bcrypt.compare(String(password), user.password);
  if (!ok) { res.status(401).json({ error: "Invalid credentials" }); return; }
  const token = jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: "30d" });
  const { password: _, ...safe } = user;
  res.json({ token, user: safe });
});

router.get("/backend/me", requireAuth, async (req: AuthedRequest, res): Promise<void> => {
  const ctx = await requireBackendUser(req, res);
  if (!ctx) return;
  const [u] = await db.select().from(usersTable).where(eq(usersTable.id, ctx.id)).limit(1);
  if (!u) { res.status(404).json({ error: "User not found" }); return; }
  const { password: _p, ...safe } = u;
  const scoped = await getScopedShopIds(ctx.id, ctx.role, ctx.assignedShopId);
  res.json({
    user: safe,
    permissions: computeEffectivePermissions(ctx.role, ctx.permissions),
    scopedShopIds: scoped ?? [],
  });
});

// ---------- Dashboard ----------
router.get("/backend/dashboard", requireAuth, async (req: AuthedRequest, res): Promise<void> => {
  const ctx = await requireBackendUser(req, res);
  if (!ctx) return;
  const range = (req.query.range as string) || "month";
  const now = new Date();
  const start = new Date(now);
  if (range === "week") start.setDate(now.getDate() - 7);
  else if (range === "year") start.setFullYear(now.getFullYear() - 1);
  else start.setMonth(now.getMonth() - 1);

  const scopedShopIds = await getScopedShopIds(ctx.id, ctx.role, ctx.assignedShopId);
  const orderShopFilter = scopedShopIds !== null
    ? (scopedShopIds.length > 0 ? inArray(ordersTable.restaurantId, scopedShopIds) : sql`false`)
    : undefined;
  const productShopFilter = scopedShopIds !== null
    ? (scopedShopIds.length > 0 ? inArray(menuItemsTable.restaurantId, scopedShopIds) : sql`false`)
    : undefined;
  const reviewShopFilter = scopedShopIds !== null
    ? (scopedShopIds.length > 0 ? inArray(reviewsTable.restaurantId, scopedShopIds) : sql`false`)
    : undefined;

  const inProgressStatuses = [
    "pending", "accepted", "confirmed", "preparing", "ready",
    "driver_at_restaurant", "picked_up", "en_route", "out_for_delivery",
  ];

  const baseOrderWhere = (extra: any) => orderShopFilter ? and(orderShopFilter, extra) : extra;

  const [inProg] = await db.select({ c: count() }).from(ordersTable).where(baseOrderWhere(inArray(ordersTable.status, inProgressStatuses)));
  const [cancelled] = await db.select({ c: count() }).from(ordersTable).where(baseOrderWhere(eq(ordersTable.status, "cancelled")));
  const [delivered] = await db.select({ c: count() }).from(ordersTable).where(baseOrderWhere(and(eq(ordersTable.status, "delivered"), gte(ordersTable.createdAt, start))));
  const [outOfStock] = await db.select({ c: count() }).from(menuItemsTable).where(productShopFilter ? and(productShopFilter, eq(menuItemsTable.isAvailable, false)) : eq(menuItemsTable.isAvailable, false));
  const [totalProd] = await db.select({ c: count() }).from(menuItemsTable).where(productShopFilter ?? sql`true`);
  const [reviewCount] = await db.select({ c: count() }).from(reviewsTable).where(reviewShopFilter ?? sql`true`);

  const deliveredWhere = baseOrderWhere(and(eq(ordersTable.status, "delivered"), gte(ordersTable.createdAt, start)));
  const [earnedRow] = await db.select({ s: sum(ordersTable.total) }).from(ordersTable).where(deliveredWhere);
  const [deliveryRow] = await db.select({ s: sum(ordersTable.driverEarning) }).from(ordersTable).where(deliveredWhere);
  const [taxRow] = await db.select({ s: sum(ordersTable.vatAmount) }).from(ordersTable).where(deliveredWhere);
  const [merchantRow] = await db.select({ s: sum(ordersTable.merchantEarning) }).from(ordersTable).where(deliveredWhere);
   const [jatekRow] = await db.select({
     s: sum(ordersTable.jatekEarning),
     refunded: sum(ordersTable.refundedJatekEarning),
   }).from(ordersTable).where(deliveredWhere);
  const totalEarned = Number(earnedRow?.s || 0);
  const deliveryEarning = Number(deliveryRow?.s || 0);
  const totalOrderTax = Number(taxRow?.s || 0);
  const merchantEarning = Number(merchantRow?.s || 0);
   const jatekEarning = Math.max(0, Number(jatekRow?.s || 0) - Number(jatekRow?.refunded || 0));

  // Orders chart by day for the requested range
  const days = range === "week" ? 7 : range === "year" ? 12 : 30;
  const chart: { label: string; value: number }[] = [];
  if (range === "year") {
    for (let i = 11; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const next = new Date(now.getFullYear(), now.getMonth() - i + 1, 1);
      const [r] = await db.select({ c: count() }).from(ordersTable).where(baseOrderWhere(and(gte(ordersTable.createdAt, d), sql`${ordersTable.createdAt} < ${next.toISOString()}`)));
      chart.push({ label: d.toLocaleString("en", { month: "short" }), value: Number(r?.c || 0) });
    }
  } else {
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date(now); d.setDate(now.getDate() - i); d.setHours(0, 0, 0, 0);
      const next = new Date(d); next.setDate(d.getDate() + 1);
      const [r] = await db.select({ c: count() }).from(ordersTable).where(baseOrderWhere(and(gte(ordersTable.createdAt, d), sql`${ordersTable.createdAt} < ${next.toISOString()}`)));
      chart.push({ label: `${d.getDate()}/${d.getMonth() + 1}`, value: Number(r?.c || 0) });
    }
  }

  res.json({
    inProgressOrders: Number(inProg?.c || 0),
    cancelledOrders: Number(cancelled?.c || 0),
    deliveredOrders: Number(delivered?.c || 0),
    outOfStockProducts: Number(outOfStock?.c || 0),
    totalProducts: Number(totalProd?.c || 0),
    orderReviews: Number(reviewCount?.c || 0),
    totalEarned,
    deliveryEarning,
    totalOrderTax,
    totalCommission: jatekEarning,
    merchantEarning,
    jatekEarning,
    ordersChart: chart,
  });
});

// ---------- Orders ----------
router.get("/backend/orders", requireAuth, async (req: AuthedRequest, res): Promise<void> => {
  const ctx = await requireBackendUser(req, res);
  if (!ctx) return;
  const scoped = await getScopedShopIds(ctx.id, ctx.role, ctx.assignedShopId);
  const conds: any[] = [];
  if (scoped !== null) {
    if (scoped.length === 0) { res.json([]); return; }
    conds.push(inArray(ordersTable.restaurantId, scoped));
  }
  if (req.query.status && typeof req.query.status === "string" && req.query.status !== "all") {
    conds.push(eq(ordersTable.status, req.query.status));
  }
  if (req.query.shopId) {
    conds.push(eq(ordersTable.restaurantId, Number(req.query.shopId)));
  }
  if (req.query.search && typeof req.query.search === "string") {
    const s = `%${req.query.search}%`;
    conds.push(or(ilike(ordersTable.userName, s), ilike(ordersTable.restaurantName, s), ilike(ordersTable.reference, s))!);
  }
  const limit = Math.min(Number(req.query.limit) || 50, 200);
  const where = conds.length ? and(...conds) : undefined;
  const rows = await db.select().from(ordersTable).where(where).orderBy(desc(ordersTable.createdAt)).limit(limit);
  res.json(rows);
});

router.get("/backend/orders/:id", requireAuth, async (req: AuthedRequest, res): Promise<void> => {
  const ctx = await requireBackendUser(req, res);
  if (!ctx) return;
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) { res.status(400).json({ error: "Invalid id" }); return; }
  const [order] = await db.select().from(ordersTable).where(eq(ordersTable.id, id)).limit(1);
  if (!order) { res.status(404).json({ error: "Order not found" }); return; }
  const scoped = await getScopedShopIds(ctx.id, ctx.role, ctx.assignedShopId);
  if (scoped !== null && (order.restaurantId == null || !scoped.includes(order.restaurantId))) {
    res.status(403).json({ error: "Forbidden" }); return;
  }
  const items = await db.select().from(orderItemsTable).where(eq(orderItemsTable.orderId, id));
  res.json({ ...order, items });
});

// ---------- Products ----------
router.get("/backend/products", requireAuth, async (req: AuthedRequest, res): Promise<void> => {
  const ctx = await requireBackendUser(req, res);
  if (!ctx) return;
  if (!canReadProducts(ctx)) {
    res.status(403).json({ error: "Forbidden: products.read required" });
    return;
  }
  const scoped = await getScopedShopIds(ctx.id, ctx.role, ctx.assignedShopId);
  const conds: any[] = [];
  if (scoped !== null) {
    if (scoped.length === 0) { res.json([]); return; }
    conds.push(inArray(menuItemsTable.restaurantId, scoped));
  }
  if (req.query.shopId) conds.push(eq(menuItemsTable.restaurantId, Number(req.query.shopId)));
  if (req.query.status === "available") conds.push(eq(menuItemsTable.isAvailable, true));
  if (req.query.status === "unavailable") conds.push(eq(menuItemsTable.isAvailable, false));
  if (req.query.search && typeof req.query.search === "string") {
    conds.push(ilike(menuItemsTable.name, `%${req.query.search}%`));
  }
  const where = conds.length ? and(...conds) : undefined;
  const rows = await db.select().from(menuItemsTable).where(where).orderBy(desc(menuItemsTable.createdAt)).limit(200);
  res.json(rows);
});

// ---------- Products CRUD ----------
router.post("/backend/products", requireAuth, async (req: AuthedRequest, res, next): Promise<void> => {
  const ctx = await requireBackendUser(req, res);
  if (!ctx) return;
  if (!canWriteProducts(ctx)) {
    res.status(403).json({ error: "Forbidden: products.write required" });
    return;
  }
  try {
    const scoped = await getScopedShopIds(ctx.id, ctx.role, ctx.assignedShopId);
    const { restaurantId, name, description, price, category, menuItemCategoryId, imageUrl, isAvailable, isPopular, allergens, tags, prepTimeMinutes, calories } = req.body || {};
    if (!restaurantId || !name || price === undefined || (!category && !menuItemCategoryId)) {
      res.status(400).json({ error: "restaurantId, name, price, category ou menuItemCategoryId requis" }); return;
    }
    const rid = Number(restaurantId);
    if (!Number.isInteger(rid) || rid <= 0) {
      res.status(400).json({ error: "restaurantId invalide" }); return;
    }
    if (scoped !== null && !scoped.includes(rid)) {
      res.status(403).json({ error: "Forbidden: not your restaurant" }); return;
    }
    const productCategory = await findValidMenuCategory(rid, menuItemCategoryId, category);
    if (!productCategory) {
      res.status(400).json({ error: "Catégorie produit inexistante, inactive ou non disponible pour cette boutique" }); return;
    }
    const [item] = await db.insert(menuItemsTable).values({
      restaurantId: rid, name, description: description ?? null, price: parseDecimal(price),
      category: productCategory.name, menuItemCategoryId: productCategory.id,
      imageUrl: normalizeStoredMediaPath(imageUrl) ?? null, isAvailable: isAvailable ?? true,
      isPopular: isPopular ?? false, allergens: allergens ?? null,
      tags: Array.isArray(tags) ? tags : (tags ? [tags] : null),
       prepTimeMinutes: prepTimeMinutes ? parseDecimal(prepTimeMinutes) : null,
       calories: calories ? parseDecimal(calories) : null,
    }).returning();
    res.status(201).json(item);
  } catch (err) { next(err); }
});

router.patch("/backend/products/:id", requireAuth, async (req: AuthedRequest, res, next): Promise<void> => {
  const ctx = await requireBackendUser(req, res);
  if (!ctx) return;
  if (!canWriteProducts(ctx)) {
    res.status(403).json({ error: "Forbidden: products.write required" });
    return;
  }
  try {
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) { res.status(400).json({ error: "Invalid id" }); return; }
    const [existing] = await db.select().from(menuItemsTable).where(eq(menuItemsTable.id, id)).limit(1);
    if (!existing) { res.status(404).json({ error: "Not found" }); return; }
    const scoped = await getScopedShopIds(ctx.id, ctx.role, ctx.assignedShopId);
    if (scoped !== null && !scoped.includes(existing.restaurantId)) {
      res.status(403).json({ error: "Forbidden: not your restaurant" }); return;
    }
    const allowed = ["name", "description", "price", "imageUrl", "isAvailable", "isPopular", "allergens", "tags", "prepTimeMinutes", "calories"];
    const updates: Record<string, unknown> = {};
    for (const k of allowed) if ((req.body || {})[k] !== undefined) updates[k] = req.body[k];
    if (Object.prototype.hasOwnProperty.call(req.body || {}, "category")
      || Object.prototype.hasOwnProperty.call(req.body || {}, "menuItemCategoryId")) {
      const requestedCategoryId = req.body?.menuItemCategoryId === undefined
        ? null
        : Number(req.body.menuItemCategoryId);
      const categoryUnchanged = req.body?.category === existing.category
        && existing.menuItemCategoryId !== null
        && requestedCategoryId === existing.menuItemCategoryId;
      if (!categoryUnchanged) {
        const productCategory = await findValidMenuCategory(
          existing.restaurantId,
          req.body?.menuItemCategoryId,
          req.body?.category,
        );
        if (!productCategory) {
          res.status(400).json({ error: "Catégorie produit inexistante, inactive ou non disponible pour cette boutique" }); return;
        }
        updates.category = productCategory.name;
        updates.menuItemCategoryId = productCategory.id;
      }
    }
    if ("price" in updates) updates.price = parseDecimal(updates.price);
    if ("prepTimeMinutes" in updates) updates.prepTimeMinutes = parseDecimal(updates.prepTimeMinutes);
    if ("calories" in updates) updates.calories = parseDecimal(updates.calories);
    if ("imageUrl" in updates) updates.imageUrl = normalizeStoredMediaPath(updates.imageUrl);
    const [item] = await db.update(menuItemsTable).set(updates as any).where(eq(menuItemsTable.id, id)).returning();
    if (!item) { res.status(404).json({ error: "Not found" }); return; }
    res.json(item);
  } catch (err) { next(err); }
});

router.delete("/backend/products/:id", requireAuth, async (req: AuthedRequest, res, next): Promise<void> => {
  const ctx = await requireBackendUser(req, res);
  if (!ctx) return;
  if (!canDeleteProducts(ctx)) {
    res.status(403).json({ error: "Forbidden: products.delete required" });
    return;
  }
  try {
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) { res.status(400).json({ error: "Invalid id" }); return; }
    const [existing] = await db.select().from(menuItemsTable).where(eq(menuItemsTable.id, id)).limit(1);
    if (!existing) { res.status(404).json({ error: "Not found" }); return; }
    const scoped = await getScopedShopIds(ctx.id, ctx.role, ctx.assignedShopId);
    if (scoped !== null && !scoped.includes(existing.restaurantId)) {
      res.status(403).json({ error: "Forbidden: not your restaurant" }); return;
    }
    await db.delete(menuItemsTable).where(eq(menuItemsTable.id, id));
    res.status(204).end();
  } catch (err: any) {
    if (err?.code === "23503") { res.status(409).json({ error: "Impossible de supprimer: produit référencé par des commandes. Marquez-le indisponible." }); return; }
    next(err);
  }
});

// ---------- Menu-item categories ----------

/**
 * GET /backend/menu-categories?restaurantId=X
 * Returns global categories (restaurantId IS NULL) plus any owned by `restaurantId`.
 * Accessible to all authenticated backend users (admin sees all; owner sees own + global).
 */
router.get("/backend/menu-categories", requireAuth, async (req: AuthedRequest, res): Promise<void> => {
  const ctx = await requireBackendUser(req, res);
  if (!ctx) return;
  if (!canReadProducts(ctx)) {
    res.status(403).json({ error: "Forbidden: products.read required" });
    return;
  }

  const scoped = await getScopedShopIds(ctx.id, ctx.role, ctx.assignedShopId);
  const rid = req.query.restaurantId ? Number(req.query.restaurantId) : null;
  if (rid !== null && (!Number.isInteger(rid) || rid <= 0)) {
    res.status(400).json({ error: "restaurantId invalide" }); return;
  }

  // Owner can only query their own restaurant's categories
  if (scoped !== null && rid !== null && !scoped.includes(rid)) {
    res.status(403).json({ error: "Forbidden: not your restaurant" }); return;
  }

  let rows;
  if (rid !== null) {
    // Global + restaurant-specific
    rows = await db.select().from(menuItemCategoriesTable)
      .where(and(
        or(
          sql`${menuItemCategoriesTable.restaurantId} IS NULL`,
          eq(menuItemCategoriesTable.restaurantId, rid)
        )
      ))
      .orderBy(menuItemCategoriesTable.sortOrder, menuItemCategoriesTable.name, menuItemCategoriesTable.id);
  } else if (scoped === null) {
    // Admin with no restaurantId filter → return everything
    rows = await db.select().from(menuItemCategoriesTable)
      .orderBy(menuItemCategoriesTable.restaurantId, menuItemCategoriesTable.sortOrder, menuItemCategoriesTable.name, menuItemCategoriesTable.id);
  } else {
    // Owner with no restaurantId → return their restaurants' categories + global
    if (scoped.length === 0) { res.json([]); return; }
    rows = await db.select().from(menuItemCategoriesTable)
      .where(or(
        sql`${menuItemCategoriesTable.restaurantId} IS NULL`,
        inArray(menuItemCategoriesTable.restaurantId, scoped)
      ))
      .orderBy(menuItemCategoriesTable.sortOrder, menuItemCategoriesTable.name, menuItemCategoriesTable.id);
  }
  const categoryIds = rows.map((row) => row.id);
   const usageCounts = await Promise.all(rows.map(async (row) => {
     const [usage] = await db.select({ cnt: count() })
       .from(menuItemsTable)
       .where(menuCategoryUsageCondition(row));
     return [row.id, Number(usage?.cnt ?? 0)] as const;
   }));
   const usageMap = new Map(usageCounts);
   res.json(rows.map((row) => ({ ...row, productCount: usageMap.get(row.id) ?? 0 })));
});

/**
 * GET /backend/menu-categories/:id/products — the reverse category relation.
 * Legacy products are included when their structured category id is missing.
 */
router.get("/backend/menu-categories/:id/products", requireAuth, async (req: AuthedRequest, res): Promise<void> => {
  const ctx = await requireBackendUser(req, res);
  if (!ctx) return;
  if (!canReadProducts(ctx)) {
    res.status(403).json({ error: "Forbidden: products.read required" });
    return;
  }
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }
  const [category] = await db.select().from(menuItemCategoriesTable)
    .where(eq(menuItemCategoriesTable.id, id)).limit(1);
  if (!category) {
    res.status(404).json({ error: "Not found" });
    return;
  }
  const scoped = await getScopedShopIds(ctx.id, ctx.role, ctx.assignedShopId);
  if (category.restaurantId !== null && scoped !== null && !scoped.includes(category.restaurantId)) {
    res.status(403).json({ error: "Forbidden: not your restaurant" });
    return;
  }
  const conditions: any[] = [menuCategoryUsageCondition(category)];
  if (scoped !== null) {
    conditions.push(scoped.length ? inArray(menuItemsTable.restaurantId, scoped) : sql`false`);
  }
  const products = await db.select().from(menuItemsTable)
    .where(and(...conditions))
    .orderBy(menuItemsTable.name, menuItemsTable.id);
  res.json(products);
});

/**
 * POST /backend/menu-categories
 * Admin: can create global (restaurantId omitted/null) or restaurant-specific.
 * Owner: must supply their own restaurantId; cannot create global.
 */
router.post("/backend/menu-categories", requireAuth, async (req: AuthedRequest, res, next): Promise<void> => {
  const ctx = await requireBackendUser(req, res);
  if (!ctx) return;
  if (!canWriteProducts(ctx)) {
    res.status(403).json({ error: "Forbidden: products.write required" });
    return;
  }
  try {
    const { name, restaurantId, sortOrder, isActive } = req.body ?? {};
    if (!name || typeof name !== "string" || !name.trim()) {
      res.status(400).json({ error: "name requis" }); return;
    }
    const scoped = await getScopedShopIds(ctx.id, ctx.role, ctx.assignedShopId);
    const rid: number | null = restaurantId ? Number(restaurantId) : null;
    if (rid !== null && (!Number.isInteger(rid) || rid <= 0)) {
      res.status(400).json({ error: "restaurantId invalide" }); return;
    }

    if (scoped !== null) {
      // Owner must supply a restaurantId that belongs to them
      if (rid === null) { res.status(403).json({ error: "Les commerçants ne peuvent pas créer de catégories globales" }); return; }
      if (!scoped.includes(rid)) { res.status(403).json({ error: "Forbidden: not your restaurant" }); return; }
    }

    const normalizedSortOrder = validateSortOrder(sortOrder);
    if (normalizedSortOrder === null) {
      res.status(400).json({ error: "sortOrder doit être un entier positif ou nul" }); return;
    }
    const [duplicate] = await db.select({ id: menuItemCategoriesTable.id })
      .from(menuItemCategoriesTable)
      .where(and(
        eq(menuItemCategoriesTable.name, name.trim()),
        rid === null
          ? sql`${menuItemCategoriesTable.restaurantId} IS NULL`
          : eq(menuItemCategoriesTable.restaurantId, rid),
      ))
      .limit(1);
    if (duplicate) {
      res.status(409).json({ error: "Une catégorie avec ce nom existe déjà pour cette portée" }); return;
    }
    const [row] = await db.insert(menuItemCategoriesTable).values({
      name: name.trim(),
      restaurantId: rid,
      sortOrder: normalizedSortOrder,
      isActive: isActive !== false,
    }).returning();
    res.status(201).json(row);
  } catch (err) { next(err); }
});

/**
 * PATCH /backend/menu-categories/:id
 * Admin: can edit any. Owner: can edit only their restaurant-scoped categories.
 */
router.patch("/backend/menu-categories/:id", requireAuth, async (req: AuthedRequest, res, next): Promise<void> => {
  const ctx = await requireBackendUser(req, res);
  if (!ctx) return;
  if (!canWriteProducts(ctx)) {
    res.status(403).json({ error: "Forbidden: products.write required" });
    return;
  }
  try {
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) { res.status(400).json({ error: "Invalid id" }); return; }
    const [existing] = await db.select().from(menuItemCategoriesTable).where(eq(menuItemCategoriesTable.id, id)).limit(1);
    if (!existing) { res.status(404).json({ error: "Not found" }); return; }

    const scoped = await getScopedShopIds(ctx.id, ctx.role, ctx.assignedShopId);
    if (scoped !== null) {
      // Owners cannot edit global categories
      if (existing.restaurantId === null) { res.status(403).json({ error: "Impossible de modifier une catégorie globale" }); return; }
      if (!scoped.includes(existing.restaurantId)) { res.status(403).json({ error: "Forbidden: not your restaurant" }); return; }
    }

    const updates: Record<string, unknown> = {};
    const allowed = ["name", "sortOrder", "isActive"];
    for (const k of allowed) if ((req.body ?? {})[k] !== undefined) updates[k] = req.body[k];
    if ("sortOrder" in updates) {
      const normalizedSortOrder = validateSortOrder(updates.sortOrder, existing.sortOrder);
      if (normalizedSortOrder === null) {
        res.status(400).json({ error: "sortOrder doit être un entier positif ou nul" }); return;
      }
      updates.sortOrder = normalizedSortOrder;
    }
     if (typeof updates.name === "string" && updates.name.trim()) {
      const [duplicate] = await db.select({ id: menuItemCategoriesTable.id })
        .from(menuItemCategoriesTable)
        .where(and(
          eq(menuItemCategoriesTable.name, updates.name.trim()),
          existing.restaurantId === null
            ? sql`${menuItemCategoriesTable.restaurantId} IS NULL`
            : eq(menuItemCategoriesTable.restaurantId, existing.restaurantId),
        ))
        .limit(1);
      if (duplicate && duplicate.id !== id) {
        res.status(409).json({ error: "Une catégorie avec ce nom existe déjà pour cette portée" }); return;
      }
      updates.name = updates.name.trim();
    }
    if ("isActive" in updates && typeof updates.isActive !== "boolean") {
      res.status(400).json({ error: "isActive doit être un booléen" }); return;
    }
    if (Object.keys(updates).length === 0) { res.status(400).json({ error: "No valid fields" }); return; }
     const [row] = await db.update(menuItemCategoriesTable).set(updates as any).where(eq(menuItemCategoriesTable.id, id)).returning();
    if (updates.name && updates.name !== existing.name) {
      await db.update(menuItemsTable)
        .set({ category: String(updates.name) })
         .where(menuCategoryUsageCondition({
           id,
           name: existing.name,
           restaurantId: existing.restaurantId,
         }));
    }
    res.json(row);
  } catch (err) { next(err); }
});

/**
 * DELETE /backend/menu-categories/:id
 * Admin: can delete any. Owner: only their own restaurant-scoped categories.
 */
router.delete("/backend/menu-categories/:id", requireAuth, async (req: AuthedRequest, res, next): Promise<void> => {
  const ctx = await requireBackendUser(req, res);
  if (!ctx) return;
  if (!canDeleteProducts(ctx)) {
    res.status(403).json({ error: "Forbidden: products.delete required" });
    return;
  }
  try {
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) { res.status(400).json({ error: "Invalid id" }); return; }
    const [existing] = await db.select().from(menuItemCategoriesTable).where(eq(menuItemCategoriesTable.id, id)).limit(1);
    if (!existing) { res.status(404).json({ error: "Not found" }); return; }

    const scoped = await getScopedShopIds(ctx.id, ctx.role, ctx.assignedShopId);
    if (scoped !== null) {
      if (existing.restaurantId === null) { res.status(403).json({ error: "Impossible de supprimer une catégorie globale" }); return; }
      if (!scoped.includes(existing.restaurantId)) { res.status(403).json({ error: "Forbidden: not your restaurant" }); return; }
    }

     const inUse = await db.select({ id: menuItemsTable.id })
       .from(menuItemsTable)
       .where(menuCategoryUsageCondition({
         id,
         name: existing.name,
         restaurantId: existing.restaurantId,
       }));
    if (inUse.length > 0) {
      res.status(409).json({ error: `Cette catégorie est utilisée par ${inUse.length} produit(s). Réaffectez-les d'abord ou rendez-la inactive.` });
      return;
    }

    await db.delete(menuItemCategoriesTable).where(eq(menuItemCategoriesTable.id, id));
    res.status(204).end();
  } catch (err) { next(err); }
});

// ---------- Shops ----------
router.get("/backend/shops", requireAuth, async (req: AuthedRequest, res): Promise<void> => {
  const ctx = await requireBackendUser(req, res);
  if (!ctx) return;
  const scoped = await getScopedShopIds(ctx.id, ctx.role, ctx.assignedShopId);
  const conds: any[] = [];
  if (scoped !== null) {
    if (scoped.length === 0) { res.json([]); return; }
    conds.push(inArray(restaurantsTable.id, scoped));
  }
  if (req.query.search && typeof req.query.search === "string") {
    conds.push(ilike(restaurantsTable.name, `%${req.query.search}%`));
  }
  const where = conds.length ? and(...conds) : undefined;
  const rows = await db.select().from(restaurantsTable).where(where).orderBy(desc(restaurantsTable.createdAt));
  res.json(rows.map((row) => ({
    ...row,
    imageUrl: resolveLegacyMediaPath(row.imageUrl, "banners"),
    coverImageUrl: resolveLegacyMediaPath(row.coverImageUrl, "banners"),
    logoUrl: resolveLegacyMediaPath(row.logoUrl, "logos"),
  })));
});

// POST /backend/shops — create a shop (admin only)
router.post("/backend/shops", requireAuth, async (req: AuthedRequest, res, next): Promise<void> => {
  const ctx = await requireBackendUser(req, res);
  if (!ctx) return;
  if (!["super_admin", "admin"].includes(ctx.role)) { res.status(403).json({ error: "Forbidden" }); return; }
  try {
    const { name, description, address, phone, category, imageUrl, logoUrl, coverImageUrl, deliveryTime, deliveryFee, minimumOrder, freeDeliveryThreshold, ownerId, isOpen, businessType, subcategoryId, isFeatured, latitude, longitude, legalName, ice, printerEmail, commissionRate } = req.body || {};
    if (!name || !address) { res.status(400).json({ error: "name et address requis" }); return; }
    const categoryResolution = await resolveShopCategory({
      category,
      businessType,
      subcategoryId,
      requireActive: true,
    });
    if (!categoryResolution.ok) { res.status(400).json({ error: categoryResolution.error }); return; }
    const defaultLatitude = await getPlatformSettingNumber("defaultLatitude", Number(DEFAULT_PLATFORM_SETTINGS.defaultLatitude));
    const defaultLongitude = await getPlatformSettingNumber("defaultLongitude", Number(DEFAULT_PLATFORM_SETTINGS.defaultLongitude));
    const resolvedCommissionRate = parseCommissionRate(
      commissionRate,
      await getPlatformSettingNumber("jatekCommissionRate", Number(DEFAULT_PLATFORM_SETTINGS.jatekCommissionRate)),
    );
    if (resolvedCommissionRate === null) { res.status(400).json({ error: "commissionRate doit être compris entre 0 et 1" }); return; }
    const [shop] = await db.insert(restaurantsTable).values({
      name, description: description ?? null, address,
      phone: phone ?? null, category: categoryResolution.category,
      imageUrl: normalizeStoredMediaPath(imageUrl) ?? null,
      logoUrl: normalizeStoredMediaPath(logoUrl) ?? null,
      coverImageUrl: normalizeStoredMediaPath(coverImageUrl) ?? null,
      deliveryTime: deliveryTime ? Number(deliveryTime) : null,
      deliveryFee: deliveryFee !== undefined && deliveryFee !== null && deliveryFee !== "" ? Number(deliveryFee) : null,
      minimumOrder: minimumOrder !== undefined && minimumOrder !== null && minimumOrder !== "" ? Number(minimumOrder) : null,
      freeDeliveryThreshold: freeDeliveryThreshold !== undefined ? Number(freeDeliveryThreshold) : await getPlatformSettingNumber("freeDeliveryThreshold", Number(DEFAULT_PLATFORM_SETTINGS.freeDeliveryThreshold)),
      commissionRate: resolvedCommissionRate,
      ownerId: ownerId ? Number(ownerId) : (ctx.id),
      isOpen: isOpen ?? true,
      businessType: categoryResolution.businessType,
      subcategoryId: categoryResolution.subcategoryId,
      isFeatured: isFeatured ?? false,
      isVerified: true,
      profileCompletedAt: new Date(),
      legalName: typeof legalName === "string" && legalName.trim() ? legalName.trim() : name.trim(),
      ice: typeof ice === "string" && ice.trim() ? ice.trim() : null,
      printerEmail: printerEmail ?? null,
      latitude: Number.isFinite(Number(latitude)) ? Number(latitude) : defaultLatitude,
      longitude: Number.isFinite(Number(longitude)) ? Number(longitude) : defaultLongitude,
    }).returning();
    res.status(201).json(shop);
  } catch (err) { next(err); }
});

// PATCH /backend/shops/:id — profile edit (admin: anything; restaurant_owner: own shop only)
router.patch("/backend/shops/:id", requireAuth, async (req: AuthedRequest, res, next): Promise<void> => {
  const ctx = await requireBackendUser(req, res);
  if (!ctx) return;
  try {
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) { res.status(400).json({ error: "Invalid id" }); return; }
    const scoped = await getScopedShopIds(ctx.id, ctx.role, ctx.assignedShopId);
    if (scoped !== null && !scoped.includes(id)) {
      res.status(403).json({ error: "Forbidden: not your restaurant" }); return;
    }
    const [existing] = await db.select().from(restaurantsTable).where(eq(restaurantsTable.id, id)).limit(1);
    if (!existing) { res.status(404).json({ error: "Not found" }); return; }
    const adminAllowed = ["name", "description", "address", "phone", "category", "imageUrl", "logoUrl", "coverImageUrl", "deliveryTime", "deliveryFee", "minimumOrder", "freeDeliveryThreshold", "commissionRate", "isOpen", "ownerId", "isVerified", "businessType", "subcategoryId", "isFeatured", "latitude", "longitude", "legalName", "ice", "printerEmail", "profileCompletedAt"];
    // A shop owner can update their own commercial terms and operations;
    // platform staff retain access to all shops and administrative fields.
    const ownerAllowed = ["name", "description", "address", "phone", "category", "imageUrl", "logoUrl", "coverImageUrl", "deliveryTime", "deliveryFee", "minimumOrder", "commissionRate", "isOpen", "businessType", "subcategoryId"];
    const allowed = (ctx.role === "restaurant_owner" || ctx.role === "owner") ? ownerAllowed : adminAllowed;
    const updates: Record<string, unknown> = {};
    for (const k of allowed) if ((req.body || {})[k] !== undefined) updates[k] = req.body[k];
    if ("commissionRate" in updates) {
      if (!["admin", "super_admin", "restaurant_owner", "owner"].includes(ctx.role)) {
        res.status(403).json({ error: "Seuls les admins ou le commerçant de la boutique peuvent modifier la commission" });
        return;
      }
      const rate = parseCommissionRate(updates.commissionRate);
      if (rate === null) { res.status(400).json({ error: "commissionRate doit être compris entre 0 et 1" }); return; }
      updates.commissionRate = rate;
    }
    const categoryFieldsProvided = ["category", "businessType", "subcategoryId"]
      .some((field) => Object.prototype.hasOwnProperty.call(req.body || {}, field));
    if (categoryFieldsProvided) {
      const categoryResolution = await resolveShopCategory({
        category: req.body?.category !== undefined ? req.body.category : existing.category,
        businessType: req.body?.businessType !== undefined ? req.body.businessType : existing.businessType,
        subcategoryId: req.body?.subcategoryId !== undefined ? req.body.subcategoryId : existing.subcategoryId,
        requireActive: true,
      });
      if (!categoryResolution.ok) { res.status(400).json({ error: categoryResolution.error }); return; }
      updates.category = categoryResolution.category;
      updates.businessType = categoryResolution.businessType;
      updates.subcategoryId = categoryResolution.subcategoryId;
    }
    for (const field of ["imageUrl", "logoUrl", "coverImageUrl"] as const) {
      if (field in updates) updates[field] = normalizeStoredMediaPath(updates[field]);
    }
    if (ctx.role === "admin" || ctx.role === "super_admin") {
      if (typeof req.body?.profileCompleted === "boolean") {
        updates.profileCompletedAt = req.body.profileCompleted ? new Date() : null;
      }
    }
    if (Object.keys(updates).length === 0) { res.status(400).json({ error: "No valid fields to update" }); return; }
    const [shop] = await db.update(restaurantsTable).set(updates as any).where(eq(restaurantsTable.id, id)).returning();
    res.json(shop);
  } catch (err) { next(err); }
});

// DELETE /backend/shops/:id — admin only
router.delete("/backend/shops/:id", requireAuth, async (req: AuthedRequest, res, next): Promise<void> => {
  const ctx = await requireBackendUser(req, res);
  if (!ctx) return;
  if (!["super_admin", "admin"].includes(ctx.role)) { res.status(403).json({ error: "Forbidden" }); return; }
  try {
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) { res.status(400).json({ error: "Invalid id" }); return; }
    const deleted = await db.delete(restaurantsTable)
      .where(eq(restaurantsTable.id, id))
      .returning({ id: restaurantsTable.id });
    if (deleted.length === 0) { res.status(404).json({ error: "Not found" }); return; }
    res.status(204).end();
  } catch (err: any) {
    if (err?.code === "23503") { res.status(409).json({ error: "Cette boutique est référencée par des commandes existantes" }); return; }
    next(err);
  }
});

// ---------- Staff ----------
router.get("/backend/staff", requireAuth, async (req: AuthedRequest, res): Promise<void> => {
  const ctx = await requireBackendUser(req, res);
  if (!ctx) return;
  if (!["super_admin", "admin", "restaurant_owner", "owner"].includes(ctx.role)) {
    res.status(403).json({ error: "Forbidden" }); return;
  }
  let rows;
  if (ctx.role === "restaurant_owner" || ctx.role === "owner") {
    const myShops = await getScopedShopIds(ctx.id, ctx.role, ctx.assignedShopId);
    if (!myShops || myShops.length === 0) { res.json([]); return; }
    rows = await db.select().from(usersTable).where(and(eq(usersTable.role, "employee"), inArray(usersTable.assignedShopId, myShops)));
  } else {
    rows = await db.select().from(usersTable).where(inArray(usersTable.role, ["super_admin", "admin", "manager", "restaurant_owner", "owner", "employee"]));
  }
  res.json(rows.map((u) => { const { password, ...s } = u; return s; }));
});

const STAFF_FIELD_ALLOWLIST = ["name", "email", "password", "role", "phone", "isActive", "assignedShopId"] as const;
const ROLE_TRANSITIONS: Record<string, RoleKey[]> = {
  super_admin: ["super_admin", "admin", "manager", "restaurant_owner", "employee", "other"],
  admin: ["admin", "manager", "restaurant_owner", "employee"],
  restaurant_owner: ["employee"],
  owner: ["employee"],
};

router.post("/backend/staff", requireAuth, async (req: AuthedRequest, res): Promise<void> => {
  const ctx = await requireBackendUser(req, res);
  if (!ctx) return;
  const allowedRolesForActor = ROLE_TRANSITIONS[ctx.role];
  if (!allowedRolesForActor) { res.status(403).json({ error: "Forbidden" }); return; }
  const { name, email, password, role, phone, assignedShopId } = req.body || {};
  if (!name || !email || !password || !role) { res.status(400).json({ error: "Missing fields" }); return; }
  if (!allowedRolesForActor.includes(role)) { res.status(403).json({ error: `Cannot create role '${role}'` }); return; }

  let finalShopId: number | null = assignedShopId ?? null;
  if (ctx.role === "restaurant_owner" || ctx.role === "owner") {
    // merchant: must assign to one of their own shops
    const ownedShops = await getScopedShopIds(ctx.id, ctx.role, ctx.assignedShopId) ?? [];
    if (!finalShopId || !ownedShops.includes(finalShopId)) {
      res.status(403).json({ error: "assignedShopId must belong to your shops" }); return;
    }
  }
  const hashed = await bcrypt.hash(String(password), 10);
  const [u] = await db.insert(usersTable).values({
    name, email: String(email).toLowerCase().trim(), password: hashed, role, phone: phone || null, assignedShopId: finalShopId,
  }).returning();
  const { password: _, ...safe } = u;
  res.status(201).json(safe);
});

router.patch("/backend/staff/:id", requireAuth, async (req: AuthedRequest, res): Promise<void> => {
  const ctx = await requireBackendUser(req, res);
  if (!ctx) return;
  const allowedRolesForActor = ROLE_TRANSITIONS[ctx.role];
  if (!allowedRolesForActor) { res.status(403).json({ error: "Forbidden" }); return; }
  const id = Number(req.params.id);

  // Load target to enforce target-scope and role-boundary
  const [target] = await db.select().from(usersTable).where(eq(usersTable.id, id)).limit(1);
  if (!target) { res.status(404).json({ error: "Not found" }); return; }
  if (!allowedRolesForActor.includes(target.role as RoleKey) && target.role !== ctx.role) {
    res.status(403).json({ error: "Cannot modify this user" }); return;
  }
  if (ctx.role === "restaurant_owner" || ctx.role === "owner") {
    const ownedShops = await getScopedShopIds(ctx.id, ctx.role, ctx.assignedShopId) ?? [];
    if (target.role !== "employee" || !target.assignedShopId || !ownedShops.includes(target.assignedShopId)) {
      res.status(403).json({ error: "Cannot modify this user" }); return;
    }
  }

  // Field allowlist
  const updates: any = {};
  for (const k of STAFF_FIELD_ALLOWLIST) {
    if (k in (req.body || {})) updates[k] = req.body[k];
  }
  if (updates.password) updates.password = await bcrypt.hash(String(updates.password), 10);
  if (updates.role && !allowedRolesForActor.includes(updates.role)) {
    res.status(403).json({ error: `Cannot assign role '${updates.role}'` }); return;
  }
  if (ctx.role === "restaurant_owner" || ctx.role === "owner") {
    if (updates.role && updates.role !== "employee") { res.status(403).json({ error: "Forbidden" }); return; }
    if ("assignedShopId" in updates) {
      const ownedShops = await getScopedShopIds(ctx.id, ctx.role, ctx.assignedShopId) ?? [];
      if (!updates.assignedShopId || !ownedShops.includes(updates.assignedShopId)) {
        res.status(403).json({ error: "assignedShopId must belong to your shops" }); return;
      }
    }
  }

  const [u] = await db.update(usersTable).set(updates).where(eq(usersTable.id, id)).returning();
  if (!u) { res.status(404).json({ error: "Not found" }); return; }
  if (updates.isActive === false) closeUserSubscriptions(id);
  const { password: _, ...safe } = u;
  res.json(safe);
});

/**
 * Set custom permissions on a user (super_admin only). Forces role='other' and
 * stores `{ inheritedRoles, grants }`. Pass `permissions: null` to clear.
 */
router.patch("/backend/staff/:id/permissions", requireAuth, async (req: AuthedRequest, res): Promise<void> => {
  const ctx = await requireBackendUser(req, res);
  if (!ctx) return;
  if (ctx.role !== "super_admin") { res.status(403).json({ error: "Only super admins may customize permissions" }); return; }
  const id = Number(req.params.id);
  const [target] = await db.select().from(usersTable).where(eq(usersTable.id, id)).limit(1);
  if (!target) { res.status(404).json({ error: "Not found" }); return; }
  if (target.role === "super_admin") { res.status(403).json({ error: "Cannot customize a super admin" }); return; }

  const body = req.body || {};
  if (body.permissions === null) {
    // Clear: revert to baseRole or employee
    const baseRole: RoleKey = (body.baseRole as RoleKey) || "employee";
    const [u] = await db.update(usersTable).set({ role: baseRole, permissions: null }).where(eq(usersTable.id, id)).returning();
    const { password: _p, ...safe } = u!;
    res.json(safe);
    return;
  }
  const inheritedRoles: string[] = Array.isArray(body.inheritedRoles) ? body.inheritedRoles.filter((r: any) => typeof r === "string") : [];
  const grants: string[] = Array.isArray(body.grants) ? body.grants.filter((g: any) => typeof g === "string") : [];
  const allowedKeys = new Set(ALL_PERMISSION_KEYS.map((p) => p.key));
  const cleanGrants = grants.filter((g) => allowedKeys.has(g));
  const allowedInherit = ["admin", "manager", "restaurant_owner", "employee"];
  const cleanInherit = inheritedRoles.filter((r) => allowedInherit.includes(r));

  const [u] = await db.update(usersTable).set({
    role: "other",
    permissions: { inheritedRoles: cleanInherit, grants: cleanGrants },
  }).where(eq(usersTable.id, id)).returning();
  if (!u) { res.status(404).json({ error: "Not found" }); return; }
  const { password: _, ...safe } = u;
  res.json(safe);
});

router.delete("/backend/staff/:id", requireAuth, async (req: AuthedRequest, res): Promise<void> => {
  const ctx = await requireBackendUser(req, res);
  if (!ctx) return;
  if (!["super_admin", "admin"].includes(ctx.role)) { res.status(403).json({ error: "Forbidden" }); return; }
  const deleted = await db.delete(usersTable)
    .where(eq(usersTable.id, Number(req.params.id)))
    .returning({ id: usersTable.id });
  if (deleted.length === 0) { res.status(404).json({ error: "Not found" }); return; }
  closeUserSubscriptions(deleted[0].id);
  res.status(204).end();
});

// ---------- Customers ----------
router.get("/backend/customers", requireAuth, async (req: AuthedRequest, res): Promise<void> => {
  const ctx = await requireBackendUser(req, res);
  if (!ctx) return;
  if (!["super_admin", "admin", "manager"].includes(ctx.role)) { res.status(403).json({ error: "Forbidden" }); return; }
  const conds: any[] = [eq(usersTable.role, "customer")];
  if (req.query.search && typeof req.query.search === "string") {
    const s = `%${req.query.search}%`;
    conds.push(or(ilike(usersTable.name, s), ilike(usersTable.email, s), ilike(usersTable.phone, s))!);
  }
  const rows = await db.select().from(usersTable).where(and(...conds)).orderBy(desc(usersTable.createdAt)).limit(200);
  res.json(rows.map((u) => { const { password, ...s } = u; return s; }));
});

// ---------- Deliverymen ----------
router.get("/backend/deliverymen", requireAuth, async (_req: AuthedRequest, res): Promise<void> => {
  const ctx = await requireBackendUser(_req, res);
  if (!ctx) return;
  if (!["super_admin", "admin", "manager"].includes(ctx.role)) { res.status(403).json({ error: "Forbidden" }); return; }
  const rows = await db
    .select({
      driver: driversTable,
      email: usersTable.email,
      accountActive: usersTable.isActive,
    })
    .from(driversTable)
    .leftJoin(usersTable, eq(usersTable.id, driversTable.userId))
    .orderBy(desc(driversTable.createdAt));
  res.json(rows.map((r) => ({ ...r.driver, email: r.email, accountActive: r.accountActive ?? true })));
});

router.post("/backend/drivers", requireAuth, async (req: AuthedRequest, res): Promise<void> => {
  const ctx = await requireBackendUser(req, res);
  if (!ctx) return;
  if (!["super_admin", "admin"].includes(ctx.role)) { res.status(403).json({ error: "Forbidden" }); return; }

  const { name, phone, email, vehicleType, vehiclePlate, nationalId, licenseNumber, latitude, longitude } = req.body ?? {};
  if (!name || typeof name !== "string" || !name.trim()) { res.status(400).json({ error: "name is required" }); return; }
  if (!phone || typeof phone !== "string" || !phone.trim()) { res.status(400).json({ error: "phone is required" }); return; }

  const phoneTrimmed = phone.trim();

  // email is UNIQUE NOT NULL in users table — generate a placeholder when not provided
  const emailTrimmed = email ? String(email).toLowerCase().trim() : null;
  const emailVal = emailTrimmed || `driver.${phoneTrimmed.replace(/\D/g, "")}@jatek.internal`;

  // Pre-check for duplicate phone
  const existingByPhone = await db.select({ id: usersTable.id }).from(usersTable).where(eq(usersTable.phone, phoneTrimmed)).limit(1);
  if (existingByPhone.length > 0) { res.status(409).json({ error: "Un utilisateur avec ce numéro existe déjà" }); return; }

  // Pre-check for duplicate email (when explicitly provided)
  if (emailTrimmed) {
    const existingByEmail = await db.select({ id: usersTable.id }).from(usersTable).where(eq(usersTable.email, emailVal)).limit(1);
    if (existingByEmail.length > 0) { res.status(409).json({ error: "Un utilisateur avec cet email existe déjà" }); return; }
  }

  // Generate a random 10-char temporary password (letters + digits, no ambiguous chars)
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789";
  const randomBytes = new Uint32Array(10);
  crypto.getRandomValues(randomBytes);
  const tempPassword = Array.from(randomBytes, (v) => chars[v % chars.length]).join("");
  const hashedPassword = await bcrypt.hash(tempPassword, 10);

  try {
    const defaultLatitude = await getPlatformSettingNumber("defaultLatitude", Number(DEFAULT_PLATFORM_SETTINGS.defaultLatitude));
    const defaultLongitude = await getPlatformSettingNumber("defaultLongitude", Number(DEFAULT_PLATFORM_SETTINGS.defaultLongitude));
    const { newUser, driver } = await db.transaction(async (tx) => {
      const [newUser] = await tx.insert(usersTable).values({
        name: name.trim(),
        phone: phoneTrimmed,
        email: emailVal,
        password: hashedPassword,
        role: "driver",
        isActive: true,
      }).returning();

      const [driver] = await tx.insert(driversTable).values({
        userId: newUser.id,
        name: name.trim(),
        phone: phoneTrimmed,
        vehicleType: vehicleType?.trim() || "moto",
        vehiclePlate: vehiclePlate?.trim() || null,
        nationalId: nationalId?.trim() || null,
        licenseNumber: licenseNumber?.trim() || null,
        profileCompletedAt: new Date(),
        isVerified: true,
        latitude: Number.isFinite(Number(latitude)) ? Number(latitude) : defaultLatitude,
        longitude: Number.isFinite(Number(longitude)) ? Number(longitude) : defaultLongitude,
      }).returning();
      return { newUser, driver };
    });

    // Return driver record + temporary password so admin can share it with the driver.
    // tempPassword is intentionally separated from the driver object so it is not
    // accidentally spread, logged, or forwarded as part of the driver record.
    res.status(201).json({ driver, tempPassword });
  } catch (e: any) {
    if (e.code === "23505") { res.status(409).json({ error: "Un compte avec ces informations existe déjà" }); return; }
    throw e;
  }
});

router.delete("/backend/drivers/:id", requireAuth, async (req: AuthedRequest, res): Promise<void> => {
  const ctx = await requireBackendUser(req, res);
  if (!ctx) return;
  if (!["super_admin", "admin"].includes(ctx.role)) { res.status(403).json({ error: "Forbidden" }); return; }

  const id = Number(req.params.id);
  if (!id) { res.status(400).json({ error: "Invalid id" }); return; }

  // Lock the driver while checking order history. Orders intentionally keep
  // their driver ID as an immutable operational/history snapshot, so deleting
  // a referenced driver would create a dangling assignment and break tracking.
  const deletion = await db.transaction(async (tx) => {
    const [driver] = await tx
      .select()
      .from(driversTable)
      .where(eq(driversTable.id, id))
      .limit(1)
      .for("update");
    if (!driver) return { kind: "missing" as const };

    const [orderSummary] = await tx
      .select({
        orderCount: count(ordersTable.id),
        activeOrderCount: sql<number>`COUNT(*) FILTER (WHERE ${inArray(ordersTable.status, [
          "pending",
          "accepted",
          "confirmed",
          "preparing",
          "ready",
          "driver_at_restaurant",
          "picked_up",
          "en_route",
          "out_for_delivery",
        ])})`,
      })
      .from(ordersTable)
      .where(eq(ordersTable.driverId, id));

    const orderCount = Number(orderSummary?.orderCount ?? 0);
    const activeOrderCount = Number(orderSummary?.activeOrderCount ?? 0);
    if (orderCount > 0) {
      return { kind: "has_orders" as const, orderCount, activeOrderCount };
    }

    await tx.delete(driversTable).where(eq(driversTable.id, id));
    await tx.delete(usersTable).where(eq(usersTable.id, driver.userId));
    return { kind: "deleted" as const, userId: driver.userId };
  });

  if (deletion.kind === "missing") {
    res.status(404).json({ error: "Driver not found" });
    return;
  }
  if (deletion.kind === "has_orders") {
    res.status(409).json({
      error: "Ce chauffeur possède un historique de commandes. Désactivez son compte au lieu de le supprimer.",
      code: "DRIVER_HAS_ORDER_HISTORY",
      orderCount: deletion.orderCount,
      activeOrderCount: deletion.activeOrderCount,
    });
    return;
  }

  closeUserSubscriptions(deletion.userId);

  res.status(204).end();
});

router.patch("/backend/drivers/:id", requireAuth, async (req: AuthedRequest, res): Promise<void> => {
  const ctx = await requireBackendUser(req, res);
  if (!ctx) return;
  if (!["super_admin", "admin", "manager"].includes(ctx.role)) { res.status(403).json({ error: "Forbidden" }); return; }

  const id = Number(req.params.id);
  if (!id) { res.status(400).json({ error: "Invalid id" }); return; }

  const [existing] = await db.select().from(driversTable).where(eq(driversTable.id, id)).limit(1);
  if (!existing) { res.status(404).json({ error: "Driver not found" }); return; }

  const { name, phone, vehicleType, vehiclePlate, nationalId, licenseNumber, isAvailable, isVerified, profileCompleted, latitude, longitude } = req.body ?? {};
  const driverUpdates: Partial<typeof driversTable.$inferInsert> = {};
  if (name !== undefined) driverUpdates.name = String(name).trim();
  if (phone !== undefined) driverUpdates.phone = String(phone).trim();
  if (vehicleType !== undefined) driverUpdates.vehicleType = vehicleType;
  if (vehiclePlate !== undefined) driverUpdates.vehiclePlate = vehiclePlate;
  if (nationalId !== undefined) driverUpdates.nationalId = nationalId;
  if (licenseNumber !== undefined) driverUpdates.licenseNumber = licenseNumber;
  if (isAvailable !== undefined) driverUpdates.isAvailable = Boolean(isAvailable);
  if (latitude !== undefined && Number.isFinite(Number(latitude))) driverUpdates.latitude = Number(latitude);
  if (longitude !== undefined && Number.isFinite(Number(longitude))) driverUpdates.longitude = Number(longitude);
  if (ctx.role === "admin" || ctx.role === "super_admin") {
    if (isVerified !== undefined) driverUpdates.isVerified = Boolean(isVerified);
    if (profileCompleted !== undefined) {
      driverUpdates.profileCompletedAt = profileCompleted ? (existing.profileCompletedAt ?? new Date()) : null;
    }
  }

  // Sync identity fields to usersTable to prevent divergence
  const userUpdates: Partial<typeof usersTable.$inferInsert> = {};
  if (driverUpdates.name !== undefined) userUpdates.name = driverUpdates.name;
  if (driverUpdates.phone !== undefined) userUpdates.phone = driverUpdates.phone;

  const [driver] = await db.transaction(async (tx) => {
    const [updated] = await tx.update(driversTable).set(driverUpdates).where(eq(driversTable.id, id)).returning();
    if (Object.keys(userUpdates).length > 0) {
      await tx.update(usersTable).set(userUpdates).where(eq(usersTable.id, existing.userId));
    }
    return [updated];
  });
  res.json(driver);
});

// ---------- Reviews ----------
router.get("/backend/reviews", requireAuth, async (req: AuthedRequest, res): Promise<void> => {
  const ctx = await requireBackendUser(req, res);
  if (!ctx) return;
  const scoped = await getScopedShopIds(ctx.id, ctx.role, ctx.assignedShopId);
  const conds: any[] = [];
  if (scoped !== null) {
    if (scoped.length === 0) { res.json([]); return; }
    conds.push(inArray(reviewsTable.restaurantId, scoped));
  }
  if (req.query.shopId) conds.push(eq(reviewsTable.restaurantId, Number(req.query.shopId)));
  const where = conds.length ? and(...conds) : undefined;
  const rows = await db.select().from(reviewsTable).where(where).orderBy(desc(reviewsTable.createdAt)).limit(200);
  res.json(rows);
});

// DELETE /backend/reviews/:id — admin/super_admin or restaurant_owner (own shop's reviews)
router.delete("/backend/reviews/:id", requireAuth, async (req: AuthedRequest, res, next): Promise<void> => {
  const ctx = await requireBackendUser(req, res);
  if (!ctx) return;
  try {
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) { res.status(400).json({ error: "Invalid id" }); return; }
    const [review] = await db.select().from(reviewsTable).where(eq(reviewsTable.id, id)).limit(1);
    if (!review) { res.status(404).json({ error: "Not found" }); return; }
    const scoped = await getScopedShopIds(ctx.id, ctx.role, ctx.assignedShopId);
    if (scoped !== null && (review.restaurantId == null || !scoped.includes(review.restaurantId))) {
      res.status(403).json({ error: "Forbidden" }); return;
    }
    await db.delete(reviewsTable).where(eq(reviewsTable.id, id));
    res.status(204).end();
  } catch (err) { next(err); }
});

// ---------- Categories ----------
/**
 * GET /backend/categories
 * Returns a hierarchical tree: parent categories with nested subCategories[].
 */
router.get("/backend/categories", requireAuth, async (req: AuthedRequest, res): Promise<void> => {
  const ctx = await requireBackendUser(req, res);
  if (!ctx) return;
  if (!hasPermission(ctx.role, ctx.permissions, "categories.read")) {
    res.status(403).json({ error: "Forbidden: categories.read required" });
    return;
  }

  const all = await db.select().from(categoriesTable).orderBy(categoriesTable.sortOrder, categoriesTable.name, categoriesTable.id);

  // Count restaurant usage per category name
  const usageRows = await db
    .select({ name: restaurantsTable.category, cnt: count() })
    .from(restaurantsTable)
    .groupBy(restaurantsTable.category);
  const usageMap = new Map(usageRows.map((r) => [r.name, Number(r.cnt)]));

  const toShape = (c: typeof all[number]) => ({
    id: c.id,
    name: c.name,
    slug: c.slug,
    icon: c.icon,
    accentColor: c.accentColor,
    businessType: (c as any).businessType ?? "restaurant",
    type: (c as any).type ?? ((c as any).parentId ? "subcategory" : "category"),
    bannerImageUrl: (c as any).bannerImageUrl ?? null,
    isActive: c.isActive,
    sortOrder: c.sortOrder,
    parentId: (c as any).parentId ?? null,
    count: usageMap.get(c.name) ?? 0,
  });

  // Build tree: parents first, then nest children
  const parents = all.filter((c) => !(c as any).parentId);
  const children = all.filter((c) => (c as any).parentId);

  const tree = parents.map((p) => ({
    ...toShape(p),
    subCategories: children
      .filter((ch) => (ch as any).parentId === p.id)
      .sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name) || a.id - b.id)
      .map(toShape),
  }));

  res.json(tree);
});

/**
 * POST /backend/categories
 * Creates a parent or child category. Accepts: name, icon, accentColor, sortOrder,
 * isActive, parentId, businessType, type and bannerImageUrl.
 */
router.post("/backend/categories", requireAuth, async (req: AuthedRequest, res): Promise<void> => {
  const ctx = await requireBackendUser(req, res);
  if (!ctx) return;
  if (!hasPermission(ctx.role, ctx.permissions, "categories.write")) {
    res.status(403).json({ error: "Forbidden: categories.write required" });
    return;
  }

  const name = String(req.body?.name || "").trim();
  const icon = String(req.body?.icon || "storefront").trim();
  const accentColor = String(req.body?.accentColor || "#E91E63").trim();
  const sortOrder = Number(req.body?.sortOrder ?? 0);
   const isActive = parseBoolean(req.body?.isActive, true);
   const parentId = req.body?.parentId !== undefined && req.body?.parentId !== null && req.body?.parentId !== ""
     ? Number(req.body.parentId)
     : null;
  let businessType = String(req.body?.businessType || "restaurant").trim();
  let type = parentId ? "subcategory" : String(req.body?.type || "category").trim();
  const bannerImageUrl = req.body?.bannerImageUrl
    ? normalizeStoredMediaPath(String(req.body.bannerImageUrl).trim())
    : null;

  if (!name) { res.status(400).json({ error: "Name required" }); return; }
  if (!Number.isInteger(sortOrder) || sortOrder < 0) {
    res.status(400).json({ error: "sortOrder doit être un entier positif ou nul" }); return;
  }
  if (parentId !== null && (!Number.isInteger(parentId) || parentId <= 0)) {
    res.status(400).json({ error: "parentId invalide" }); return;
  }

  if (parentId !== null) {
    const [parent] = await db.select()
      .from(categoriesTable)
      .where(eq(categoriesTable.id, parentId))
      .limit(1);
    if (!parent) { res.status(400).json({ error: "Parent category not found" }); return; }
    if (parent.parentId || !["category", "service_shortcut"].includes(parent.type)) {
      res.status(400).json({ error: "Une sous-catégorie doit avoir une catégorie principale valide" }); return;
    }
    if (!parent.isActive && isActive) {
      res.status(400).json({ error: "Impossible d'activer une sous-catégorie sous une catégorie inactive" }); return;
    }
    businessType = parent.businessType;
    type = "subcategory";
  } else if (!["category", "service_shortcut"].includes(type)) {
    res.status(400).json({ error: "Type de catégorie invalide" }); return;
  }

  const slug = await uniqueCategorySlug(name);

  try {
    const [cat] = await db
      .insert(categoriesTable)
      .values({
        name, slug, icon, accentColor, sortOrder, isActive, businessType, type,
        bannerImageUrl, ...(parentId ? { parentId } : {}),
      } as any)
      .returning();
    res.status(201).json({
      id: cat.id, name: cat.name, slug: cat.slug, icon: cat.icon,
      accentColor: cat.accentColor, businessType: (cat as any).businessType ?? "restaurant",
      type: (cat as any).type ?? "category",
      bannerImageUrl: (cat as any).bannerImageUrl ?? null,
      isActive: cat.isActive, sortOrder: cat.sortOrder, parentId: (cat as any).parentId ?? null, count: 0,
      subCategories: [],
    });
  } catch (e: any) {
    if (e.code === "23505") { res.status(409).json({ error: "Une catégorie avec ce nom existe déjà" }); return; }
    throw e;
  }
});

/**
 * PATCH /backend/categories/:id — update by numeric ID.
 * Also syncs restaurants.category when the name changes (for parent cats).
 */
router.patch("/backend/categories/:id", requireAuth, async (req: AuthedRequest, res): Promise<void> => {
  const ctx = await requireBackendUser(req, res);
  if (!ctx) return;
  if (!hasPermission(ctx.role, ctx.permissions, "categories.write")) {
    res.status(403).json({ error: "Forbidden: categories.write required" });
    return;
  }

  const id = parseInt(String(req.params.id), 10);
  if (!id) { res.status(400).json({ error: "Invalid id" }); return; }

  const [existing] = await db.select().from(categoriesTable).where(eq(categoriesTable.id, id)).limit(1);
  if (!existing) { res.status(404).json({ error: "Catégorie introuvable" }); return; }

   const name = String(req.body?.name ?? existing.name).trim();
   if (!name) { res.status(400).json({ error: "Name required" }); return; }
  const icon = String(req.body?.icon ?? existing.icon);
  const accentColor = String(req.body?.accentColor ?? existing.accentColor);
   const sortOrder = req.body?.sortOrder !== undefined ? Number(req.body.sortOrder) : existing.sortOrder;
   const isActive = req.body?.isActive !== undefined
     ? parseBoolean(req.body.isActive, existing.isActive)
     : existing.isActive;
   if (!Number.isInteger(sortOrder) || sortOrder < 0) {
     res.status(400).json({ error: "sortOrder doit être un entier positif ou nul" }); return;
   }
   const parentForExisting = existing.parentId
     ? (await db.select().from(categoriesTable).where(eq(categoriesTable.id, existing.parentId)).limit(1))[0]
     : null;
   if (existing.parentId && !parentForExisting) {
     res.status(409).json({ error: "Catégorie parente introuvable" }); return;
   }
    if (existing.parentId && isActive && parentForExisting && !parentForExisting.isActive) {
      res.status(400).json({ error: "Impossible d'activer une sous-catégorie sous une catégorie inactive" }); return;
    }
   const businessType = parentForExisting
     ? parentForExisting.businessType
     : req.body?.businessType !== undefined
       ? String(req.body.businessType).trim()
       : (existing as any).businessType ?? "restaurant";
   const type = existing.parentId
     ? "subcategory"
     : req.body?.type !== undefined
       ? String(req.body.type)
       : (existing as any).type ?? "category";
   if (!existing.parentId && !["category", "service_shortcut"].includes(type)) {
     res.status(400).json({ error: "Type de catégorie invalide" }); return;
   }
   if (existing.parentId && !isActive && parentForExisting && parentForExisting.isActive === false) {
     // Both records being inactive is valid; this branch documents the intentional
     // compatibility behavior and avoids treating legacy inactive trees as corrupt.
   }
  const bannerImageUrl = req.body?.bannerImageUrl !== undefined
    ? (req.body.bannerImageUrl ? normalizeStoredMediaPath(String(req.body.bannerImageUrl).trim()) : null)
    : (existing as any).bannerImageUrl ?? null;

  try {
    const [updated] = await db
      .update(categoriesTable)
       .set({ name, icon, accentColor, sortOrder, isActive, businessType, type, bannerImageUrl } as any)
      .where(eq(categoriesTable.id, id))
      .returning();

      // An inactive parent must not leave active children visible in an
      // administrative tree that the public API cannot expose coherently.
      if (!existing.parentId && existing.isActive && !isActive) {
        await db.update(categoriesTable)
          .set({ isActive: false } as any)
          .where(eq(categoriesTable.parentId, id));
      }

     if (name !== existing.name || businessType !== (existing as any).businessType) {
       if (!existing.parentId) {
         const children = await db.select({ id: categoriesTable.id })
           .from(categoriesTable)
           .where(eq(categoriesTable.parentId, id));
         await db.update(restaurantsTable)
           .set({
             ...(name !== existing.name ? { category: name } : {}),
             ...(businessType !== (existing as any).businessType ? { businessType } : {}),
            })
            .where(eq(restaurantsTable.category, existing.name));
          if (businessType !== (existing as any).businessType && children.length > 0) {
            await db.update(restaurantsTable)
              .set({ businessType })
              .where(inArray(restaurantsTable.subcategoryId, children.map((child) => child.id)));
          }
       } else {
         await db.update(restaurantsTable)
           .set({ category: name, businessType })
           .where(or(
             eq(restaurantsTable.subcategoryId, id),
             eq(restaurantsTable.category, existing.name),
           ));
       }
    }

    res.json({
      id: updated.id, name: updated.name, slug: updated.slug, icon: updated.icon,
      accentColor: updated.accentColor, businessType: (updated as any).businessType ?? "restaurant",
      type: (updated as any).type ?? "category",
      bannerImageUrl: (updated as any).bannerImageUrl ?? null,
      isActive: updated.isActive, sortOrder: updated.sortOrder, parentId: (updated as any).parentId ?? null,
    });
  } catch (e: any) {
    if (e.code === "23505") { res.status(409).json({ error: "Ce nom de catégorie existe déjà" }); return; }
    throw e;
  }
});

/**
 * DELETE /backend/categories/:id — delete by numeric ID.
 * Blocks if any restaurant uses the category or if it has child subcategories.
 */
router.delete("/backend/categories/:id", requireAuth, async (req: AuthedRequest, res): Promise<void> => {
  const ctx = await requireBackendUser(req, res);
  if (!ctx) return;
  if (!hasPermission(ctx.role, ctx.permissions, "categories.write")) {
    res.status(403).json({ error: "Forbidden: categories.write required" });
    return;
  }

  const id = parseInt(String(req.params.id), 10);
  if (!id) { res.status(400).json({ error: "Invalid id" }); return; }

  const [cat] = await db.select().from(categoriesTable).where(eq(categoriesTable.id, id)).limit(1);
  if (!cat) { res.status(404).json({ error: "Catégorie introuvable" }); return; }

  // Block if restaurants use this category
  const inUse = await db.select({ id: restaurantsTable.id }).from(restaurantsTable).where(or(
    eq(restaurantsTable.category, cat.name),
    eq(restaurantsTable.subcategoryId, id),
  ));
  if (inUse.length > 0) {
    res.status(409).json({ error: `Cette catégorie est utilisée par ${inUse.length} restaurant(s). Réaffectez-les d'abord.` });
    return;
  }

  // Block if it has subcategories (children must be deleted first)
  const children = await db.select({ id: categoriesTable.id }).from(categoriesTable)
    .where(eq((categoriesTable as any).parentId, id));
  if (children.length > 0) {
    res.status(409).json({ error: `Cette catégorie a ${children.length} sous-catégorie(s). Supprimez-les d'abord.` });
    return;
  }

  await db.delete(categoriesTable).where(eq(categoriesTable.id, id));
  res.status(204).end();
});

// ---------- Roles ----------
router.get("/backend/roles", requireAuth, async (req: AuthedRequest, res): Promise<void> => {
  const ctx = await requireBackendUser(req, res);
  if (!ctx) return;
  res.json(ROLE_DEFS);
});

/** All permission keys available to assign to a 'other' role user. */
router.get("/backend/permissions", requireAuth, async (req: AuthedRequest, res): Promise<void> => {
  const ctx = await requireBackendUser(req, res);
  if (!ctx) return;
  res.json(ALL_PERMISSION_KEYS);
});

// ---------- Todos ----------
router.get("/backend/todos", requireAuth, async (req: AuthedRequest, res): Promise<void> => {
  const ctx = await requireBackendUser(req, res);
  if (!ctx) return;
  const rows = await db.select().from(dashboardTodosTable).where(eq(dashboardTodosTable.userId, ctx.id)).orderBy(desc(dashboardTodosTable.createdAt));
  res.json(rows);
});

router.post("/backend/todos", requireAuth, async (req: AuthedRequest, res): Promise<void> => {
  const ctx = await requireBackendUser(req, res);
  if (!ctx) return;
  const text = String(req.body?.text || "").trim();
  if (!text) { res.status(400).json({ error: "Text required" }); return; }
  const [t] = await db.insert(dashboardTodosTable).values({ userId: ctx.id, text }).returning();
  res.status(201).json(t);
});

router.patch("/backend/todos/:id", requireAuth, async (req: AuthedRequest, res): Promise<void> => {
  const ctx = await requireBackendUser(req, res);
  if (!ctx) return;
  const id = Number(req.params.id);
  const [t] = await db.update(dashboardTodosTable).set({ done: !!req.body?.done }).where(and(eq(dashboardTodosTable.id, id), eq(dashboardTodosTable.userId, ctx.id))).returning();
  if (!t) { res.status(404).json({ error: "Not found" }); return; }
  res.json(t);
});

router.delete("/backend/todos/:id", requireAuth, async (req: AuthedRequest, res): Promise<void> => {
  const ctx = await requireBackendUser(req, res);
  if (!ctx) return;
  await db.delete(dashboardTodosTable).where(and(eq(dashboardTodosTable.id, Number(req.params.id)), eq(dashboardTodosTable.userId, ctx.id)));
  res.status(204).end();
});

// ---------- Reports ----------
router.get("/backend/reports", requireAuth, async (req: AuthedRequest, res): Promise<void> => {
  const ctx = await requireBackendUser(req, res);
  if (!ctx) return;
  if (!["super_admin", "admin", "manager"].includes(ctx.role)) { res.status(403).json({ error: "Forbidden" }); return; }

  const days = Math.min(Number(req.query.days ?? 30), 365);
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

  const [totals] = await db.select({
    totalRevenue: sum(ordersTable.total),
    totalOrders: count(ordersTable.id),
    deliveredOrders: sql<number>`count(*) filter (where ${ordersTable.status} = 'delivered')`,
  }).from(ordersTable).where(gte(ordersTable.createdAt, since));

  const byDay = await db.select({
    day: sql<string>`date_trunc('day', ${ordersTable.createdAt})::date::text`,
    orders: count(ordersTable.id),
    revenue: sum(ordersTable.total),
  }).from(ordersTable)
    .where(gte(ordersTable.createdAt, since))
    .groupBy(sql`date_trunc('day', ${ordersTable.createdAt})`)
    .orderBy(sql`date_trunc('day', ${ordersTable.createdAt})`);

  const topRestaurants = await db.select({
    restaurantId: ordersTable.restaurantId,
    restaurantName: ordersTable.restaurantName,
    orders: count(ordersTable.id),
    revenue: sum(ordersTable.total),
  }).from(ordersTable)
    .where(gte(ordersTable.createdAt, since))
    .groupBy(ordersTable.restaurantId, ordersTable.restaurantName)
    .orderBy(desc(count(ordersTable.id)))
    .limit(10);

  res.json({
    totalRevenue: Number(totals?.totalRevenue ?? 0),
    totalOrders: Number(totals?.totalOrders ?? 0),
    deliveredOrders: Number(totals?.deliveredOrders ?? 0),
    byDay: byDay.map((r) => ({ day: r.day, orders: Number(r.orders), revenue: Number(r.revenue ?? 0) })),
    topRestaurants: topRestaurants.map((r) => ({
      restaurantId: r.restaurantId,
      restaurantName: r.restaurantName,
      orders: Number(r.orders),
      revenue: Number(r.revenue ?? 0),
    })),
  });
});

// ---------- Wallets ----------
router.get("/backend/wallets", requireAuth, async (req: AuthedRequest, res): Promise<void> => {
  const ctx = await requireBackendUser(req, res);
  if (!ctx) return;
  if (!["super_admin", "admin", "manager"].includes(ctx.role)) { res.status(403).json({ error: "Forbidden" }); return; }

  const restaurantEarnings = await db.select({
    restaurantId: ordersTable.restaurantId,
    restaurantName: ordersTable.restaurantName,
    totalOrders: count(ordersTable.id),
    grossRevenue: sum(ordersTable.subtotal),
    deliveryFees: sum(ordersTable.deliveryFee),
    merchantEarning: sum(ordersTable.merchantEarning),
    jatekEarning: sum(ordersTable.jatekEarning),
    totalRevenue: sum(ordersTable.total),
  }).from(ordersTable)
    .where(eq(ordersTable.status, "delivered"))
    .groupBy(ordersTable.restaurantId, ordersTable.restaurantName)
    .orderBy(desc(sum(ordersTable.total)))
    .limit(100);

  const driverEarnings = await db.select({
    driverId: ordersTable.driverId,
    totalDeliveries: count(ordersTable.id),
    totalEarnings: sum(ordersTable.driverEarning),
  }).from(ordersTable)
    .where(and(eq(ordersTable.status, "delivered"), sql`${ordersTable.driverId} is not null`))
    .groupBy(ordersTable.driverId)
    .orderBy(desc(sum(ordersTable.deliveryFee)))
    .limit(100);

  const driverIds = driverEarnings.map((r) => r.driverId).filter(Boolean) as number[];
  const driversInfo = driverIds.length
    ? await db.select({ id: driversTable.id, name: driversTable.name, phone: driversTable.phone }).from(driversTable).where(inArray(driversTable.id, driverIds))
    : [];
  const driverMap = new Map(driversInfo.map((d) => [d.id, d]));

  res.json({
    restaurants: restaurantEarnings.map((r) => ({
      restaurantId: r.restaurantId,
      restaurantName: r.restaurantName,
      totalOrders: Number(r.totalOrders),
      grossRevenue: Number(r.grossRevenue ?? 0),
      deliveryFees: Number(r.deliveryFees ?? 0),
      merchantEarning: Number(r.merchantEarning ?? 0),
      jatekEarning: Number(r.jatekEarning ?? 0),
      totalRevenue: Number(r.totalRevenue ?? 0),
    })),
    drivers: driverEarnings.map((r) => {
      const info = driverMap.get(r.driverId!);
      return {
        driverId: r.driverId,
        driverName: info?.name ?? `Driver #${r.driverId}`,
        driverPhone: info?.phone ?? null,
        totalDeliveries: Number(r.totalDeliveries),
        totalEarnings: Number(r.totalEarnings ?? 0),
      };
    }),
  });
});

// ---------- Platform Settings ----------
router.get("/backend/settings", requireAuth, async (req: AuthedRequest, res): Promise<void> => {
  const ctx = await requireBackendUser(req, res);
  if (!ctx) return;
  try {
    const [row] = await db.select().from(platformSettingsTable).limit(1);
    res.json(row ? { ...DEFAULT_PLATFORM_SETTINGS, ...(row.data as object) } : DEFAULT_PLATFORM_SETTINGS);
  } catch {
    res.json(DEFAULT_PLATFORM_SETTINGS);
  }
});

router.put("/backend/settings", requireAuth, async (req: AuthedRequest, res): Promise<void> => {
  const ctx = await requireBackendUser(req, res);
  if (!ctx) return;
  if (!["super_admin", "admin"].includes(ctx.role)) {
    res.status(403).json({ error: "Forbidden: admin only" }); return;
  }
  try {
    const data = { ...(req.body ?? {}) } as Record<string, unknown>;
    const decimalKeys = [
      "defaultDeliveryFee", "freeDeliveryThreshold", "maxDeliveryRadiusKm",
      "minOrderAmount", "taxRate", "driverCommissionRate", "jatekCommissionRate",
      "defaultLatitude", "defaultLongitude",
    ];
    for (const key of decimalKeys) {
      if (data[key] === undefined) continue;
      const raw = String(data[key]).trim().replace(",", ".");
      const value = Number(raw);
      if (!Number.isFinite(value)) {
        res.status(400).json({ error: `${key} doit être numérique` });
        return;
      }
      data[key] = value;
    }
    for (const key of ["taxRate", "driverCommissionRate", "jatekCommissionRate"]) {
      if (data[key] !== undefined && (Number(data[key]) < 0 || Number(data[key]) > 1)) {
        res.status(400).json({ error: `${key} doit être compris entre 0 et 1` });
        return;
      }
    }
    const [existing] = await db.select().from(platformSettingsTable).limit(1);
    if (existing) {
      const [updated] = await db.update(platformSettingsTable)
        .set({ data: { ...DEFAULT_PLATFORM_SETTINGS, ...(existing.data as object), ...data }, updatedAt: new Date() })
        .where(eq(platformSettingsTable.id, existing.id))
        .returning();
      res.json(updated.data);
    } else {
      const [created] = await db.insert(platformSettingsTable)
        .values({ data: { ...DEFAULT_PLATFORM_SETTINGS, ...data } })
        .returning();
      res.json(created.data);
    }
  } catch (err: any) {
    res.status(500).json({ error: err?.message ?? "Failed to save settings" });
  }
});

// ---------- Driver Management (admin) ----------

/**
 * POST /api/backend/orders/:id/assign-driver
 * Admin manually assigns an available driver to an order.
 */
router.post("/backend/orders/:id/assign-driver", requireAuth, async (req: AuthedRequest, res): Promise<void> => {
  const ctx = await requireBackendUser(req, res);
  if (!ctx) return;
  if (!["super_admin", "admin", "manager"].includes(ctx.role)) {
    res.status(403).json({ error: "Forbidden: admin only" }); return;
  }
  const orderId = parseInt(String(req.params.id), 10);
  const { driverId } = req.body ?? {};
  if (!orderId || !driverId) {
    res.status(400).json({ error: "orderId et driverId requis" }); return;
  }
  try {
    const [driver] = await db.select().from(driversTable).where(eq(driversTable.id, Number(driverId))).limit(1);
    if (!driver) { res.status(404).json({ error: "Livreur introuvable" }); return; }

    const [order] = await db
      .update(ordersTable)
      .set({ driverId: driver.id })
      .where(eq(ordersTable.id, orderId))
      .returning();

    if (!order) { res.status(404).json({ error: "Commande introuvable" }); return; }

    // Notify driver via SSE
    publish(`driver_orders:${driver.id}`, "order_assigned", { orderId });

    res.json(order);
  } catch (err: any) {
    res.status(500).json({ error: err?.message ?? "Erreur serveur" });
  }
});

/**
 * GET /api/backend/drivers
 * List all drivers with basic info (admin only).
 * Proxies to /api/drivers with enriched data.
 */
router.get("/backend/drivers", requireAuth, async (req: AuthedRequest, res): Promise<void> => {
  const ctx = await requireBackendUser(req, res);
  if (!ctx) return;
  if (!["super_admin", "admin", "manager"].includes(ctx.role)) {
    res.status(403).json({ error: "Forbidden: admin/manager only" }); return;
  }
  try {
    const drivers = await db.select().from(driversTable);
    res.json(drivers);
  } catch (err: any) {
    res.status(500).json({ error: err?.message });
  }
});

// ---------- Live Tracking ----------
router.get("/backend/live-tracking", requireAuth, async (req: AuthedRequest, res): Promise<void> => {
  const ctx = await requireBackendUser(req, res);
  if (!ctx) return;

  const ACTIVE_STATUSES = [
    "pending",
    "accepted",
    "confirmed",
    "preparing",
    "ready",
    "driver_at_restaurant",
    "picked_up",
    "en_route",
    "out_for_delivery",
  ] as const;

  const activeOrders = await db
    .select({
      id: ordersTable.id,
      reference: ordersTable.reference,
      status: ordersTable.status,
      total: ordersTable.total,
      createdAt: ordersTable.createdAt,
      deliveryAddress: ordersTable.deliveryAddress,
      driverId: ordersTable.driverId,
      restaurantId: ordersTable.restaurantId,
      userId: ordersTable.userId,
    })
    .from(ordersTable)
    .where(inArray(ordersTable.status, [...ACTIVE_STATUSES]))
    .orderBy(desc(ordersTable.createdAt))
    .limit(100);

  if (activeOrders.length === 0) {
    res.json({ activeOrders: [], onlineDriversCount: 0, totalActiveCount: 0, pendingCount: 0, enRouteCount: 0 });
    return;
  }

  // Gather restaurant + user names
  const restaurantIds = [...new Set(activeOrders.map((o) => o.restaurantId))];
  const userIds = [...new Set(activeOrders.map((o) => o.userId))];
  const driverIds = activeOrders.map((o) => o.driverId).filter((id): id is number => id !== null);
  const uniqueDriverIds = [...new Set(driverIds)];

  const [restaurants, users, drivers] = await Promise.all([
    restaurantIds.length
      ? db.select({ id: restaurantsTable.id, name: restaurantsTable.name }).from(restaurantsTable).where(inArray(restaurantsTable.id, restaurantIds))
      : Promise.resolve([]),
    userIds.length
      ? db.select({ id: usersTable.id, name: usersTable.name }).from(usersTable).where(inArray(usersTable.id, userIds))
      : Promise.resolve([]),
    uniqueDriverIds.length
      ? db.select({ id: driversTable.id, name: driversTable.name, phone: driversTable.phone, latitude: driversTable.latitude, longitude: driversTable.longitude }).from(driversTable).where(inArray(driversTable.id, uniqueDriverIds))
      : Promise.resolve([]),
  ]);

  const restaurantMap = new Map(restaurants.map((r) => [r.id, r.name]));
  const userMap = new Map(users.map((u) => [u.id, u.name]));
  const driverMap = new Map(drivers.map((d) => [d.id, d]));

  // Merge in-memory live tracking data
  const liveLocations = tracking.getAllLocations();
  const liveMap = new Map(liveLocations.map((l) => [l.driverId, l]));

  const enriched = activeOrders.map((o) => {
    const driver = o.driverId ? driverMap.get(o.driverId) ?? null : null;
    const live = o.driverId ? liveMap.get(o.driverId) ?? null : null;
    return {
      id: o.id,
      reference: o.reference,
      status: o.status,
      total: o.total,
      createdAt: o.createdAt,
      deliveryAddress: o.deliveryAddress,
      restaurantName: restaurantMap.get(o.restaurantId) ?? `Restaurant #${o.restaurantId}`,
      userName: userMap.get(o.userId) ?? `Client #${o.userId}`,
      driverId: o.driverId,
      driverName: driver?.name ?? null,
      driverPhone: driver?.phone ?? null,
      // Prefer real-time in-memory position; fall back to DB snapshot
      driverLat: live?.lat ?? driver?.latitude ?? null,
      driverLng: live?.lng ?? driver?.longitude ?? null,
      driverLastSeen: live ? live.lastSeen : null,
      driverIsOnline: live ? live.isOnline : false,
      eta: live?.eta ?? null,
    };
  });

  const onlineDriverIds = new Set(liveLocations.filter((l) => l.isOnline).map((l) => l.driverId));

  res.json({
    activeOrders: enriched,
    totalActiveCount: enriched.length,
    pendingCount: enriched.filter((o) => o.status === "pending").length,
    enRouteCount: enriched.filter((o) => ["driver_at_restaurant", "picked_up", "en_route", "out_for_delivery"].includes(o.status)).length,
    onlineDriversCount: onlineDriverIds.size,
  });
});

// ---------- Notifications (in-app + push + SMS) ----------
router.post("/backend/notifications/send", requireAuth, async (req: AuthedRequest, res): Promise<void> => {
  const ctx = await requireBackendUser(req, res);
  if (!ctx) return;
  if (!["super_admin", "admin"].includes(ctx.role)) { res.status(403).json({ error: "Forbidden" }); return; }

  const { target, message, phone } = req.body ?? {};
  if (!message || typeof message !== "string" || !message.trim()) {
    res.status(400).json({ error: "message required" }); return;
  }

  let recipients: Array<{ id: number; phone: string | null }> = [];

  if (target === "single") {
    if (!phone) { res.status(400).json({ error: "phone required for single target" }); return; }
    const normalizedPhone = String(phone).trim();
    recipients = await db.select({ id: usersTable.id, phone: usersTable.phone })
      .from(usersTable)
      .where(eq(usersTable.phone, normalizedPhone));
  } else if (target === "customers") {
    recipients = await db.select({ id: usersTable.id, phone: usersTable.phone }).from(usersTable)
      .where(and(eq(usersTable.role, "customer"), eq(usersTable.isActive, true)));
  } else if (target === "drivers") {
    recipients = await db.select({ id: usersTable.id, phone: usersTable.phone }).from(usersTable)
      .where(and(eq(usersTable.role, "driver"), eq(usersTable.isActive, true)));
  } else if (target === "all") {
    recipients = await db.select({ id: usersTable.id, phone: usersTable.phone }).from(usersTable)
      .where(and(eq(usersTable.isActive, true), sql`${usersTable.role} in ('customer', 'driver')`));
  } else {
    res.status(400).json({ error: "target must be: single | customers | drivers | all" }); return;
  }

  const phones = target === "single"
    ? [String(phone).trim()]
    : Array.from(new Set(recipients.map((u) => u.phone).filter(Boolean) as string[]));
  const delivery = await dispatchNotificationToUsers(
    recipients.map((recipient) => recipient.id),
    { title: "Message Jatek", body: message.trim(), data: { source: "admin_broadcast" } },
  );

  if (recipients.length === 0 && target !== "single") {
    res.json({ sent: 0, failed: 0, attempted: 0, total: 0, truncated: false, ...delivery });
    return;
  }

  let sent = 0;
  let failed = 0;
  const errors: string[] = [];
  const smsRecipients = phones.slice(0, 200);

  for (const to of smsRecipients) {
    try {
      await sendOtpMessage(to, message.trim());
      sent++;
    } catch (err: any) {
      failed++;
      if (errors.length < 5) errors.push(`${to}: ${err?.message ?? String(err)}`);
    }
  }

  res.json({
    success: true,
    sent,
    failed,
    attempted: smsRecipients.length,
    total: phones.length,
    truncated: phones.length > smsRecipients.length,
    errors,
    ...delivery,
  });
});

// ─── OTP provider health (production-safe, no credentials exposed) ───────────
// Returns config-derived status for each OTP provider so dashboard operators
// can diagnose delivery failures without needing developer access.
router.get("/backend/otp-health", requireAuth, (_req, res): void => {
  type ProviderStatus = "ok" | "misconfigured" | "not_configured";
  interface ProviderHealth {
    id: string; name: string;
    channel: "whatsapp" | "email";
    role: "primary" | "fallback";
    status: ProviderStatus; notes: string[];
  }

  const isProduction = process.env.NODE_ENV === "production" || !!process.env.REPLIT_DEPLOYMENT;
  const sandboxNumber = "+14155238886";
  const providers: ProviderHealth[] = [];

  // ── Twilio Verify (primary WhatsApp) ────────────────────────────────────────
  {
    const verifySid  = process.env.TWILIO_VERIFY_SID;
    const accountSid = process.env.TWILIO_ACCOUNT_SID;
    const notes: string[] = [];
    let status: ProviderStatus = "ok";

    if (!verifySid && !accountSid && !twilioCredentialMode()) {
      status = "not_configured";
    } else {
      if (!verifySid || !verifySid.startsWith("VA")) {
        status = "misconfigured";
        notes.push(!verifySid
          ? 'TWILIO_VERIFY_SID non défini'
          : `TWILIO_VERIFY_SID doit commencer par "VA" (actuel : "${verifySid.slice(0, 4)}…")`);
      }
      if (!accountSid?.startsWith("AC")) {
        status = "misconfigured";
        notes.push("TWILIO_ACCOUNT_SID manquant ou invalide (doit commencer par AC)");
      }
      if (!twilioVerifyConfigured()) {
        status = "misconfigured";
        notes.push("Credentials Twilio manquants/incomplets : TWILIO_API_KEY + TWILIO_AUTH_KEY (ou TWILIO_AUTH_TOKEN)");
      }
    }
    providers.push({ id: "twilio-verify", name: "Twilio Verify", channel: "whatsapp", role: "primary", status, notes });
  }

  // ── Twilio WhatsApp direct (fallback) ───────────────────────────────────────
  {
    const accountSid = process.env.TWILIO_ACCOUNT_SID;
    const waFrom     = process.env.TWILIO_WA_FROM;
    const notes: string[] = [];
    let status: ProviderStatus = "ok";

    if (!accountSid && !twilioCredentialMode()) {
      status = "not_configured";
    } else {
      if (!accountSid?.startsWith("AC")) { status = "misconfigured"; notes.push("TWILIO_ACCOUNT_SID manquant ou invalide"); }
      if (!twilioConfigured())           { status = "misconfigured"; notes.push("Credentials Twilio manquants/incomplets : TWILIO_API_KEY + TWILIO_AUTH_KEY (ou TWILIO_AUTH_TOKEN)"); }
      if (isProduction && (!waFrom || waFrom === sandboxNumber)) {
        if (status === "ok") status = "misconfigured";
        notes.push("Numéro sandbox en production — définissez TWILIO_WA_FROM avec un numéro WhatsApp Business approuvé");
      }
    }
    providers.push({ id: "twilio-whatsapp", name: "Twilio WhatsApp direct", channel: "whatsapp", role: "fallback", status, notes });
  }

  // ── Infobip WhatsApp (fallback) ──────────────────────────────────────────────
  {
    const apiKey  = process.env.INFOBIP_API_KEY;
    const baseUrl = process.env.INFOBIP_BASE_URL || process.env.INFOBIP_URL;
    const sender  = process.env.INFOBIP_WA_SENDER;
    const notes: string[] = [];
    let status: ProviderStatus = "ok";

    if (!apiKey) {
      status = "not_configured";
    } else {
      if (!baseUrl) { status = "misconfigured"; notes.push("INFOBIP_BASE_URL manquant"); }
      if (!sender)  { status = "misconfigured"; notes.push("INFOBIP_WA_SENDER manquant"); }
    }
    providers.push({ id: "infobip", name: "Infobip WhatsApp", channel: "whatsapp", role: "fallback", status, notes });
  }

  // ── Resend Email (primary email OTP / password reset) ────────────────────────
  {
    const apiKey    = process.env.RESEND_API_KEY;
    const fromEmail = process.env.RESEND_FROM_EMAIL || process.env.RESEND_EMAIL_FROM;
    const notes: string[] = [];
    let status: ProviderStatus = "ok";

    if (!apiKey) {
      status = "not_configured";
    } else {
      if (!fromEmail) { status = "misconfigured"; notes.push("RESEND_FROM_EMAIL manquant"); }
    }
    providers.push({ id: "resend", name: "Resend Email", channel: "email", role: "primary", status, notes });
  }

  // ── Channel-level summary ────────────────────────────────────────────────────
  function channelSummary(list: ProviderHealth[]): "ok" | "degraded" | "down" {
    const primaryOk  = list.filter((p) => p.role === "primary").some((p) => p.status === "ok");
    const anyOk      = list.some((p) => p.status === "ok");
    if (primaryOk) return "ok";
    if (anyOk)     return "degraded";
    return "down";
  }

  res.json({
    providers,
    summary: {
      whatsapp: channelSummary(providers.filter((p) => p.channel === "whatsapp")),
      email:    channelSummary(providers.filter((p) => p.channel === "email")),
    },
  });
});

export default router;
