import { createHash } from "node:crypto";
import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync } from "node:fs";
import { cpus } from "node:os";
import { join, resolve } from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { Client as ReplitObjectStorageClient } from "@replit/object-storage";
import {
  adsTable,
  appConfigTable,
  categoriesTable,
  cartItemsTable,
  db,
  menuItemCategoriesTable,
  menuItemExtrasTable,
  menuItemSizesTable,
  menuItemsTable,
  pool,
  restaurantsTable,
  shortsTable,
} from "@workspace/db";
import { and, asc, eq, sql } from "drizzle-orm";

type Product = {
  id: number;
  restaurantId: number;
  name: string;
  description: string | null;
  price: number;
  compareAtPrice: number | null;
  imageUrl: string | null;
  category: string;
  isAvailable: boolean;
  isPopular: boolean;
  tags: string[] | null;
  allergens: string | null;
  prepTimeMinutes: number | null;
  calories: number | null;
  menuItemCategoryId: number | null;
  sortOrder: number;
};

type Photo = {
  objectName: string;
  relativePath: string;
  size: number;
  sha256: string;
};

type CatalogRow = {
  product: Product;
  restaurant: typeof restaurantsTable.$inferSelect;
  productCategory: typeof menuItemCategoriesTable.$inferSelect;
  shopCategory: typeof categoriesTable.$inferSelect;
  sizes: Array<{
    name: string;
    priceAdjustment: number;
    sortOrder: number;
    isAvailable: boolean;
  }>;
  extras: Array<{
    name: string;
    price: number;
    sortOrder: number;
    isAvailable: boolean;
  }>;
  photo: Photo;
};

const DEFAULT_ARCHIVE = resolve(
  fileURLToPath(new URL("../../../../attached_assets", import.meta.url)),
  "jatek-products-with-photos.tar_1789509947347.gz",
);
const objectStorage = new ReplitObjectStorageClient();

function readJson<T>(root: string, relativePath: string): T {
  return JSON.parse(readFileSync(join(root, relativePath), "utf8")) as T;
}

function objectUrl(objectName: string): string {
  return `/api/storage/objects/${objectName}`;
}

function sha256(path: string): string {
  return createHash("sha256").update(readFileSync(path)).digest("hex");
}

function roundMoney(value: number): number {
  return Math.round(value * 100) / 100;
}

function extractArchive(archivePath: string): { root: string; cleanup: () => void } {
  if (!existsSync(archivePath)) {
    throw new Error(`Catalog archive not found: ${archivePath}`);
  }

  const root = mkdtempSync("/tmp/jatek-catalog-");
  execFileSync("tar", ["-xzf", archivePath, "-C", root], { stdio: "inherit" });
  const extractedRoot = join(root, "data");
  return {
    root,
    cleanup: () => rmSync(root, { recursive: true, force: true }),
  };
}

async function verifyAndUploadPhotos(root: string, rows: CatalogRow[]): Promise<void> {
  const uniquePhotos = [...new Map(rows.map((row) => [row.photo.objectName, row.photo])).values()];
  const photoRoot = join(root, "photos");

  for (const photo of uniquePhotos) {
    const path = join(photoRoot, photo.relativePath.replace(/^photos\//, ""));
    if (!existsSync(path)) throw new Error(`Missing catalog photo: ${photo.relativePath}`);
    if (readFileSync(path).length !== photo.size || sha256(path) !== photo.sha256) {
      throw new Error(`Catalog photo checksum mismatch: ${photo.relativePath}`);
    }
  }

  let uploaded = 0;
  const concurrency = Math.max(2, Math.min(6, cpus().length));
  for (let offset = 0; offset < uniquePhotos.length; offset += concurrency) {
    const batch = uniquePhotos.slice(offset, offset + concurrency);
    await Promise.all(batch.map(async (photo) => {
      const path = join(photoRoot, photo.relativePath.replace(/^photos\//, ""));
      const result = await objectStorage.uploadFromBytes(
        photo.objectName,
        readFileSync(path),
        { compress: false },
      );
      if (!result.ok) {
        throw new Error(`Unable to upload ${photo.objectName}: ${result.error.message}`);
      }
      uploaded += 1;
    }));
    console.log(`[import:jatek] Uploaded ${uploaded}/${uniquePhotos.length} product photos.`);
  }
}

async function upsertConfig(key: string, value: unknown): Promise<void> {
  await db.insert(appConfigTable).values({ key, value }).onConflictDoUpdate({
    target: appConfigTable.key,
    set: { value, updatedAt: new Date() },
  });
}

async function main(): Promise<void> {
  const archivePath = process.argv.includes("--archive")
    ? process.argv[process.argv.indexOf("--archive") + 1]
    : DEFAULT_ARCHIVE;
  if (!archivePath) throw new Error("--archive requires a file path");

  const { root, cleanup } = extractArchive(resolve(archivePath));
  try {
    const rows = readJson<CatalogRow[]>(root, "data/catalog-complete.json");
    if (rows.length < 50) throw new Error(`Catalog is unexpectedly small: ${rows.length} products`);
    if (new Set(rows.map((row) => row.product.name)).size !== rows.length) {
      throw new Error("Catalog contains duplicate product names");
    }

    await verifyAndUploadPhotos(root, rows);

    const [targetRestaurant] = await db
      .select()
      .from(restaurantsTable)
      .where(and(
        eq(restaurantsTable.ownerId, rows[0].restaurant.ownerId),
        eq(restaurantsTable.businessType, "restaurant"),
      ))
      .orderBy(asc(restaurantsTable.id))
      .limit(1);
    if (!targetRestaurant) {
      throw new Error(`No existing restaurant belongs to catalog owner ${rows[0].restaurant.ownerId}`);
    }

    const [activeCart] = await db.select({ id: cartItemsTable.id }).from(cartItemsTable).limit(1);
    if (activeCart) {
      throw new Error(
        `Refusing catalog replacement because cart item ${activeCart.id} still references live catalog data`,
      );
    }

    const archiveRestaurant = rows[0].restaurant;
    const restaurantCategory = await db
      .select({ id: categoriesTable.id })
      .from(categoriesTable)
      .where(eq(categoriesTable.slug, rows[0].shopCategory.slug))
      .limit(1);
    const restaurantSubcategoryId = restaurantCategory[0]?.id ?? targetRestaurant.subcategoryId;

    const promoProductIds = new Set(
      rows
        .slice()
        .sort((a, b) => a.product.id - b.product.id)
        .slice(0, 6)
        .map((row) => row.product.id),
    );

    await db.transaction(async (tx) => {
      // These are catalog/content tables only. Users, orders, order_items,
      // payment records, notifications, favorites, and drivers are untouched.
      await tx.delete(menuItemExtrasTable);
      await tx.delete(menuItemSizesTable);
      await tx.delete(menuItemsTable);
      await tx.delete(menuItemCategoriesTable);
      await tx.delete(shortsTable);
      await tx.delete(adsTable);

      await tx
        .update(restaurantsTable)
        .set({
          name: archiveRestaurant.name,
          description: archiveRestaurant.description,
          address: archiveRestaurant.address,
          phone: archiveRestaurant.phone,
          imageUrl: archiveRestaurant.imageUrl,
          coverImageUrl: archiveRestaurant.coverImageUrl,
          logoUrl: archiveRestaurant.logoUrl,
          category: archiveRestaurant.category,
          businessType: archiveRestaurant.businessType,
          isLocal: archiveRestaurant.isLocal,
          isOpen: archiveRestaurant.isOpen,
          deliveryTime: archiveRestaurant.deliveryTime,
          deliveryFee: archiveRestaurant.deliveryFee,
          minimumOrder: archiveRestaurant.minimumOrder,
          freeDeliveryThreshold: archiveRestaurant.freeDeliveryThreshold,
          commissionRate: archiveRestaurant.commissionRate,
          rating: archiveRestaurant.rating,
          reviewCount: archiveRestaurant.reviewCount,
          isVerified: archiveRestaurant.isVerified,
          latitude: archiveRestaurant.latitude,
          longitude: archiveRestaurant.longitude,
          isFeatured: archiveRestaurant.isFeatured,
          subcategoryId: restaurantSubcategoryId,
          updatedAt: new Date(),
        })
        .where(eq(restaurantsTable.id, targetRestaurant.id));

      // Keep legacy shops with their order history, but remove them from public
      // recommendations when the archive contains a single live restaurant.
      await tx
        .update(restaurantsTable)
        .set({ isOpen: false, isVerified: false, isFeatured: false, updatedAt: new Date() })
        .where(sql`${restaurantsTable.id} <> ${targetRestaurant.id}`);

      const categoryNames = [...new Map(
        rows.map((row) => [row.productCategory.name, row.productCategory]),
      ).values()]
        .sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name));
      const insertedCategories = await tx
        .insert(menuItemCategoriesTable)
        .values(categoryNames.map((category, sortOrder) => ({
          restaurantId: null,
          name: category.name,
          sortOrder,
          isActive: category.isActive,
        })))
        .returning({ id: menuItemCategoriesTable.id, name: menuItemCategoriesTable.name });
      const categoryIds = new Map(insertedCategories.map((category) => [category.name, category.id]));

      const menuRows = rows.map((row, index) => {
        const product = row.product;
        const compareAtPrice = promoProductIds.has(product.id)
          ? roundMoney(product.price * 1.25)
          : null;
        return {
          restaurantId: targetRestaurant.id,
          name: product.name.trim(),
          description: product.description?.trim() || null,
          price: product.price,
          compareAtPrice,
          imageUrl: objectUrl(row.photo.objectName),
          category: product.category,
          isAvailable: product.isAvailable,
          isPopular: product.isPopular || index < 8,
          tags: product.tags,
          allergens: product.allergens,
          prepTimeMinutes: product.prepTimeMinutes,
          calories: product.calories,
          menuItemCategoryId: categoryIds.get(row.productCategory.name) ?? null,
          sortOrder: index,
        };
      });
      const insertedItems = await tx.insert(menuItemsTable).values(menuRows).returning({
        id: menuItemsTable.id,
        name: menuItemsTable.name,
      });
      const itemIds = new Map(insertedItems.map((item) => [item.name, item.id]));

      const sizeRows = rows.flatMap((row) => {
        const menuItemId = itemIds.get(row.product.name);
        return menuItemId
          ? row.sizes.map((size) => ({ ...size, menuItemId }))
          : [];
      });
      const extraRows = rows.flatMap((row) => {
        const menuItemId = itemIds.get(row.product.name);
        return menuItemId
          ? row.extras.map((extra) => ({ ...extra, menuItemId }))
          : [];
      });
      if (sizeRows.length) await tx.insert(menuItemSizesTable).values(sizeRows);
      if (extraRows.length) await tx.insert(menuItemExtrasTable).values(extraRows);

      const shortRows = rows.slice(0, 8).map((row, sortOrder) => ({
        title: `${row.product.name.trim()} — ${archiveRestaurant.name}`,
        imageUrl: objectUrl(row.photo.objectName),
        videoUrl: null,
        restaurantId: targetRestaurant.id,
        restaurantName: archiveRestaurant.name,
        isActive: true,
        sortOrder,
      }));
      await tx.insert(shortsTable).values(shortRows);

      const adRows = rows.slice(0, 3).map((row, sortOrder) => ({
        type: "vip_banner",
        title: sortOrder === 0 ? "Les offres Smash's" : row.product.name.trim(),
        subtitle: sortOrder === 0
          ? "Découvrez les nouveautés et les prix du moment"
          : `À partir de ${row.product.price} MAD`,
        badge: "PROMO",
        bgColor: ["#F8DDE6", "#E8F2FF", "#FFF0D9"][sortOrder] ?? "#F8DDE6",
        accentColor: ["#E91E63", "#1976D2", "#EF6C00"][sortOrder] ?? "#E91E63",
        icon: "gift",
        imageUrl: objectUrl(row.photo.objectName),
        isActive: true,
        sortOrder,
      }));
      await tx.insert(adsTable).values(adRows);
    });

    await upsertConfig("homeSections", {
      categories: { title: "Catégories", visible: true, source: "categories", limit: 4 },
      banners: { title: "Promotions", visible: true, source: "banners", limit: 3 },
      shorts: { title: "Shorts", visible: true, source: "shorts", limit: 8 },
      popular: { title: "Produits populaires", visible: true, source: "popular", limit: 6 },
      new_restaurants: { title: "Restauration", visible: false, source: "new_restaurants", limit: 6 },
      supermarkets: { title: "Supermarché", visible: false, source: "supermarkets", limit: 6 },
      new_products: { title: "Offres du moment", visible: true, source: "promos", limit: 6 },
      shops: { title: "Boutiques", visible: false, source: "shops", limit: 6 },
      all: { title: "Recommandé pour vous", visible: true, source: "all_restaurants", limit: 6 },
      free_delivery: { title: "Livraison gratuite", visible: false, source: "free_delivery", limit: 6 },
      newest: { title: "Nouveautés", visible: true, source: "newest", limit: 6 },
      support: { title: "Besoin d'aide ?", visible: true, source: "support", limit: 1 },
    });
    await upsertConfig("homeOrder", [
      "categories",
      "banners",
      "shorts",
      "new_products",
      "popular",
      "all",
      "newest",
      "support",
    ]);

    const [counts] = await db
      .select({
        products: sql<number>`count(*)`,
      })
      .from(menuItemsTable)
      .where(eq(menuItemsTable.restaurantId, targetRestaurant.id));
    console.log(
      `[import:jatek] Completed catalog replacement for restaurant ${targetRestaurant.id}: ` +
      `${counts?.products ?? 0} products, ${rows.reduce((total, row) => total + row.sizes.length, 0)} sizes, ` +
      `${rows.reduce((total, row) => total + row.extras.length, 0)} extras, 8 shorts and 3 ads.`,
    );
  } finally {
    cleanup();
  }
}

main()
  .catch((error) => {
    console.error("[import:jatek] Failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool.end();
  });