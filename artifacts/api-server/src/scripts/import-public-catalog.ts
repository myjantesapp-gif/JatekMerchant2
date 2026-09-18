import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import {
  adsTable,
  categoriesTable,
  db,
  menuItemCategoriesTable,
  menuItemsTable,
  pool,
  restaurantsTable,
  shortsTable,
  usersTable,
} from "@workspace/db";
import { asc, eq } from "drizzle-orm";

type SnapshotCategory = {
  name: string;
  slug: string;
  icon: string;
  accentColor: string;
  businessType: string;
  type: string;
  bannerImageUrl: string | null;
  isActive: boolean;
  sortOrder: number;
  parentSlug: string | null;
};

type SnapshotMenuCategory = {
  key: string;
  restaurantKey: string | null;
  name: string;
  sortOrder: number;
  isActive: boolean;
};

type SnapshotRestaurant = {
  key: string;
  matchKeys: string[];
  name: string;
  description: string | null;
  address: string;
  phone: string | null;
  imageUrl: string | null;
  coverImageUrl: string | null;
  logoUrl: string | null;
  category: string;
  businessType: string;
  isLocal: boolean;
  isOpen: boolean;
  deliveryTime: number | null;
  deliveryFee: number | null;
  minimumOrder: number | null;
  freeDeliveryThreshold: number;
  commissionRate: number;
  rating: number | null;
  reviewCount: number;
  isVerified: boolean;
  latitude: number;
  longitude: number;
  isFeatured: boolean;
  subcategorySlug: string | null;
};

type SnapshotProduct = {
  key: string;
  restaurantKey: string;
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
  menuItemCategoryKey: string | null;
  sortOrder: number;
};

type SnapshotAd = {
  key: string;
  type: string;
  title: string;
  subtitle: string | null;
  badge: string | null;
  bgColor: string;
  accentColor: string | null;
  icon: string;
  imageUrl: string | null;
  linkUrl: string | null;
  restaurantKey: string | null;
  productKey: string | null;
  normalPrice: number | null;
  promoPrice: number | null;
  isActive: boolean;
  sortOrder: number;
};

type SnapshotShort = {
  key: string;
  title: string;
  imageUrl: string | null;
  videoUrl: string | null;
  restaurantKey: string | null;
  restaurantName: string | null;
  audioCodec: string | null;
  audioBitrate: number | null;
  durationSeconds: number | null;
  viewCount: number;
  isActive: boolean;
  sortOrder: number;
};

type PublicCatalogSnapshot = {
  schemaVersion: number;
  mergePolicy: string;
  categories: SnapshotCategory[];
  menuCategories: SnapshotMenuCategory[];
  restaurants: SnapshotRestaurant[];
  products: SnapshotProduct[];
  ads: SnapshotAd[];
  shorts: SnapshotShort[];
  mediaObjects: string[];
};

const SNAPSHOT_PATH = fileURLToPath(
  new URL("../seed-data/public-catalog.json", import.meta.url),
);

function loadSnapshot(): PublicCatalogSnapshot {
  const snapshot = JSON.parse(
    readFileSync(SNAPSHOT_PATH, "utf8"),
  ) as PublicCatalogSnapshot;
  if (
    snapshot.schemaVersion !== 1 ||
    snapshot.mergePolicy !== "production-wins"
  ) {
    throw new Error(`Unsupported public catalog snapshot at ${SNAPSHOT_PATH}`);
  }
  return snapshot;
}

function normalize(value: string | null | undefined): string {
  return String(value ?? "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[’'`]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

function restaurantMatchKeys(row: {
  name: string;
  address: string;
  phone: string | null;
  businessType: string;
}): string[] {
  const keys: string[] = [];
  if (normalize(row.phone)) keys.push(`phone:${normalize(row.phone)}`);
  if (normalize(row.address)) keys.push(`address:${normalize(row.address)}`);
  if (normalize(row.name)) {
    keys.push(
      `name:${normalize(row.name)}|type:${normalize(row.businessType)}`,
    );
  }
  return keys;
}

function publicCatalogKey(type: string, title: string): string {
  return `${normalize(type)}|${normalize(title)}`;
}

function shortKey(
  title: string,
  videoUrl: string | null,
  restaurantKey: string | null,
): string {
  return videoUrl
    ? `video:${normalize(videoUrl)}`
    : `content:${restaurantKey ?? "none"}|${normalize(title)}`;
}

function requireMappedId(
  ids: Map<string, number>,
  key: string,
  description: string,
): number {
  const id = ids.get(key);
  if (id === undefined) {
    throw new Error(`Snapshot reference ${description} is not mapped: ${key}`);
  }
  return id;
}

async function findSystemOwnerId(): Promise<number> {
  const [admin] = await db
    .select({ id: usersTable.id })
    .from(usersTable)
    .where(eq(usersTable.role, "admin"))
    .orderBy(asc(usersTable.id))
    .limit(1);
  if (admin) return admin.id;

  const [superAdmin] = await db
    .select({ id: usersTable.id })
    .from(usersTable)
    .where(eq(usersTable.role, "super_admin"))
    .orderBy(asc(usersTable.id))
    .limit(1);
  if (superAdmin) return superAdmin.id;

  throw new Error(
    "No existing admin or super_admin account is available for new public restaurants",
  );
}

type ImportCounts = {
  categoriesInserted: number;
  menuCategoriesInserted: number;
  restaurantsInserted: number;
  productsInserted: number;
  adsInserted: number;
  shortsInserted: number;
};

export async function importPublicCatalog(): Promise<ImportCounts> {
  const snapshot = loadSnapshot();
  const counts: ImportCounts = {
    categoriesInserted: 0,
    menuCategoriesInserted: 0,
    restaurantsInserted: 0,
    productsInserted: 0,
    adsInserted: 0,
    shortsInserted: 0,
  };
  const systemOwnerId = await findSystemOwnerId();

  await db.transaction(async (tx) => {
    const existingCategories = await tx
      .select({ id: categoriesTable.id, slug: categoriesTable.slug })
      .from(categoriesTable);
    const categoryIds = new Map(
      existingCategories.map((row) => [row.slug, row.id]),
    );

    const pendingCategories = new Map(
      snapshot.categories.map((category) => [category.slug, category]),
    );
    while (pendingCategories.size > 0) {
      let insertedThisRound = 0;
      for (const [slug, category] of pendingCategories) {
        if (category.parentSlug && !categoryIds.has(category.parentSlug))
          continue;

        const inserted = await tx
          .insert(categoriesTable)
          .values({
            name: category.name,
            slug,
            icon: category.icon,
            accentColor: category.accentColor,
            parentId: category.parentSlug
              ? categoryIds.get(category.parentSlug)!
              : null,
            businessType: category.businessType,
            type: category.type,
            bannerImageUrl: category.bannerImageUrl,
            isActive: category.isActive,
            sortOrder: category.sortOrder,
          })
          .onConflictDoNothing({ target: categoriesTable.slug })
          .returning({ id: categoriesTable.id });

        if (inserted[0]) {
          counts.categoriesInserted += 1;
          categoryIds.set(slug, inserted[0].id);
        } else {
          const [existing] = await tx
            .select({ id: categoriesTable.id })
            .from(categoriesTable)
            .where(eq(categoriesTable.slug, slug))
            .limit(1);
          if (!existing)
            throw new Error(`Category insert raced for slug ${slug}`);
          categoryIds.set(slug, existing.id);
        }

        pendingCategories.delete(slug);
        insertedThisRound += 1;
      }
      if (insertedThisRound === 0) {
        throw new Error(
          "Unable to resolve parent category references in public snapshot",
        );
      }
    }

    const existingRestaurants = await tx
      .select({
        id: restaurantsTable.id,
        name: restaurantsTable.name,
        address: restaurantsTable.address,
        phone: restaurantsTable.phone,
        businessType: restaurantsTable.businessType,
      })
      .from(restaurantsTable)
      .orderBy(asc(restaurantsTable.id));
    const restaurantIdsByMatchKey = new Map<string, number>();
    for (const restaurant of existingRestaurants) {
      for (const key of restaurantMatchKeys(restaurant)) {
        const previous = restaurantIdsByMatchKey.get(key);
        if (previous !== undefined && previous !== restaurant.id) {
          throw new Error(`Ambiguous existing restaurant business key ${key}`);
        }
        restaurantIdsByMatchKey.set(key, restaurant.id);
      }
    }

    const restaurantIds = new Map<string, number>();
    for (const restaurant of snapshot.restaurants) {
      const existingId = restaurant.matchKeys
        .map((key) => restaurantIdsByMatchKey.get(key))
        .find((id): id is number => id !== undefined);
      if (existingId !== undefined) {
        restaurantIds.set(restaurant.key, existingId);
        continue;
      }

      const [inserted] = await tx
        .insert(restaurantsTable)
        .values({
          ownerId: systemOwnerId,
          name: restaurant.name,
          description: restaurant.description,
          address: restaurant.address,
          phone: restaurant.phone,
          imageUrl: restaurant.imageUrl,
          coverImageUrl: restaurant.coverImageUrl,
          logoUrl: restaurant.logoUrl,
          category: restaurant.category,
          businessType: restaurant.businessType,
          isLocal: restaurant.isLocal,
          isOpen: restaurant.isOpen,
          deliveryTime: restaurant.deliveryTime,
          deliveryFee: restaurant.deliveryFee,
          minimumOrder: restaurant.minimumOrder,
          freeDeliveryThreshold: restaurant.freeDeliveryThreshold,
          commissionRate: restaurant.commissionRate,
          rating: restaurant.rating,
          reviewCount: restaurant.reviewCount,
          isVerified: restaurant.isVerified,
          latitude: restaurant.latitude,
          longitude: restaurant.longitude,
          isFeatured: restaurant.isFeatured,
          subcategoryId: restaurant.subcategorySlug
            ? requireMappedId(
                categoryIds,
                restaurant.subcategorySlug,
                "restaurant subcategory",
              )
            : null,
        })
        .returning({ id: restaurantsTable.id });
      if (!inserted)
        throw new Error(`Unable to insert restaurant ${restaurant.name}`);

      restaurantIds.set(restaurant.key, inserted.id);
      counts.restaurantsInserted += 1;
      for (const key of restaurant.matchKeys)
        restaurantIdsByMatchKey.set(key, inserted.id);
    }

    const restaurantKeyById = new Map(
      [...restaurantIds.entries()].map(([key, id]) => [id, key]),
    );
    const existingMenuCategories = await tx
      .select({
        id: menuItemCategoriesTable.id,
        restaurantId: menuItemCategoriesTable.restaurantId,
        name: menuItemCategoriesTable.name,
      })
      .from(menuItemCategoriesTable)
      .orderBy(asc(menuItemCategoriesTable.id));
    const menuCategoryIds = new Map<string, number>();
    for (const category of existingMenuCategories) {
      const restaurantKey =
        category.restaurantId === null
          ? null
          : restaurantKeyById.get(category.restaurantId);
      const key = restaurantKey
        ? `${restaurantKey}|${normalize(category.name)}`
        : `global:${normalize(category.name)}`;
      if (!menuCategoryIds.has(key)) menuCategoryIds.set(key, category.id);
    }

    for (const category of snapshot.menuCategories) {
      if (menuCategoryIds.has(category.key)) continue;
      const [inserted] = await tx
        .insert(menuItemCategoriesTable)
        .values({
          restaurantId: category.restaurantKey
            ? requireMappedId(
                restaurantIds,
                category.restaurantKey,
                "menu category restaurant",
              )
            : null,
          name: category.name,
          sortOrder: category.sortOrder,
          isActive: category.isActive,
        })
        .returning({ id: menuItemCategoriesTable.id });
      if (!inserted)
        throw new Error(`Unable to insert menu category ${category.key}`);
      menuCategoryIds.set(category.key, inserted.id);
      counts.menuCategoriesInserted += 1;
    }

    const existingProducts = await tx
      .select({
        id: menuItemsTable.id,
        restaurantId: menuItemsTable.restaurantId,
        name: menuItemsTable.name,
      })
      .from(menuItemsTable)
      .orderBy(asc(menuItemsTable.id));
    const productIds = new Map<string, number>();
    for (const product of existingProducts) {
      const restaurantKey = restaurantKeyById.get(product.restaurantId);
      if (!restaurantKey) continue;
      const key = `${restaurantKey}|${normalize(product.name)}`;
      if (!productIds.has(key)) productIds.set(key, product.id);
    }

    for (const product of snapshot.products) {
      if (productIds.has(product.key)) continue;
      const restaurantId = restaurantIds.get(product.restaurantKey);
      if (!restaurantId)
        throw new Error(`Unmapped product restaurant ${product.restaurantKey}`);
      const [inserted] = await tx
        .insert(menuItemsTable)
        .values({
          restaurantId,
          name: product.name,
          description: product.description,
          price: product.price,
          compareAtPrice: product.compareAtPrice,
          imageUrl: product.imageUrl,
          category: product.category,
          isAvailable: product.isAvailable,
          isPopular: product.isPopular,
          tags: product.tags,
          allergens: product.allergens,
          prepTimeMinutes: product.prepTimeMinutes,
          calories: product.calories,
          menuItemCategoryId: product.menuItemCategoryKey
            ? requireMappedId(
                menuCategoryIds,
                product.menuItemCategoryKey,
                "product category",
              )
            : null,
          sortOrder: product.sortOrder,
        })
        .returning({ id: menuItemsTable.id });
      if (!inserted) throw new Error(`Unable to insert product ${product.key}`);
      productIds.set(product.key, inserted.id);
      counts.productsInserted += 1;
    }

    const existingAds = await tx
      .select({ type: adsTable.type, title: adsTable.title })
      .from(adsTable);
    const adKeys = new Set(
      existingAds.map((ad) => publicCatalogKey(ad.type, ad.title)),
    );
    for (const ad of snapshot.ads) {
      if (adKeys.has(ad.key)) continue;
      const [inserted] = await tx
        .insert(adsTable)
        .values({
          type: ad.type,
          title: ad.title,
          subtitle: ad.subtitle,
          badge: ad.badge,
          bgColor: ad.bgColor,
          accentColor: ad.accentColor,
          icon: ad.icon,
          imageUrl: ad.imageUrl,
          linkUrl: ad.linkUrl,
          restaurantId: ad.restaurantKey
            ? requireMappedId(restaurantIds, ad.restaurantKey, "ad restaurant")
            : null,
          productId: ad.productKey
            ? requireMappedId(productIds, ad.productKey, "ad product")
            : null,
          normalPrice: ad.normalPrice,
          promoPrice: ad.promoPrice,
          isActive: ad.isActive,
          sortOrder: ad.sortOrder,
        })
        .returning({ id: adsTable.id });
      if (!inserted) throw new Error(`Unable to insert ad ${ad.key}`);
      adKeys.add(ad.key);
      counts.adsInserted += 1;
    }

    const existingShorts = await tx
      .select({
        title: shortsTable.title,
        videoUrl: shortsTable.videoUrl,
        restaurantId: shortsTable.restaurantId,
      })
      .from(shortsTable);
    const shortKeys = new Set(
      existingShorts.map((short) =>
        shortKey(
          short.title,
          short.videoUrl,
          short.restaurantId === null
            ? null
            : (restaurantKeyById.get(short.restaurantId) ?? null),
        ),
      ),
    );
    for (const short of snapshot.shorts) {
      if (shortKeys.has(short.key)) continue;
      const [inserted] = await tx
        .insert(shortsTable)
        .values({
          title: short.title,
          imageUrl: short.imageUrl,
          videoUrl: short.videoUrl,
          restaurantId: short.restaurantKey
            ? requireMappedId(
                restaurantIds,
                short.restaurantKey,
                "Short restaurant",
              )
            : null,
          restaurantName: short.restaurantName,
          audioCodec: short.audioCodec,
          audioBitrate: short.audioBitrate,
          durationSeconds: short.durationSeconds,
          viewCount: short.viewCount,
          isActive: short.isActive,
          sortOrder: short.sortOrder,
        })
        .returning({ id: shortsTable.id });
      if (!inserted) throw new Error(`Unable to insert Short ${short.key}`);
      shortKeys.add(short.key);
      counts.shortsInserted += 1;
    }
  });

  console.log(
    `[import:public-catalog] complete — ${counts.restaurantsInserted} restaurants, ` +
      `${counts.productsInserted} products, ${counts.adsInserted} ads, ` +
      `${counts.shortsInserted} Shorts inserted; ${snapshot.mediaObjects.length} media ` +
      "references retained for the separate verified media restore.",
  );
  return counts;
}

importPublicCatalog()
  .catch((error) => {
    console.error(
      `[import:public-catalog] failed: ${error instanceof Error ? error.message : String(error)}`,
    );
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool.end();
  });
