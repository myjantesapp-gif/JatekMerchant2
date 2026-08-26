import {
  db,
  favoritesTable,
  menuItemCategoriesTable,
  menuItemExtrasTable,
  menuItemsTable,
  menuItemSizesTable,
  orderItemsTable,
  ordersTable,
  quotesTable,
  restaurantsTable,
  restaurantHoursTable,
  reviewsTable,
  shortsTable,
  usersTable,
} from "@workspace/db";
import { eq, like, or } from "drizzle-orm";
import { Client as ReplitObjectStorageClient } from "@replit/object-storage";
import { ObjectStorageService, type MediaFolder } from "../lib/objectStorage";

const SOURCE_URL = "https://commandes.smashs.ma/";
const RESTAURANT_NAME = "Smash's Burger Oujda";
const objectStorage = new ObjectStorageService();
const bucketClient = new ReplitObjectStorageClient();

type SourceProduct = {
  name: string;
  description?: string;
  price: number;
  image?: string;
  available?: boolean;
  Tailles?: Record<string, { price: number; description?: string }>;
  extraOptions?: Array<{ type: string; values: string[] }>;
  isKidsMenu?: boolean;
};

type SourceCatalog = {
  commonOptions?: Record<string, unknown>;
  [category: string]: unknown;
};

const CATEGORY_LABELS: Record<string, string> = {
  "Smash’s": "Burgers",
  "Smash's Double": "Burgers doubles",
  "Box Fried Chicken": "Boxes chicken",
  "Family Packs": "Menus famille",
  Tacos: "Tacos",
  Wrapstar: "Wraps",
  "Menu Kids": "Menus kids",
  Salade: "Salades",
  Desserts: "Desserts",
  Shakes: "Shakes",
  "Sundae Ice": "Sundae",
  Boissons: "Boissons",
};

function sourceAssetUrl(assetPath: string): string {
  return new URL(assetPath, SOURCE_URL).href;
}

function getServedObjectUrl(objectPath: string): string {
  return `/api/storage/objects${objectPath.replace(/^\/objects/, "")}`;
}

function slugify(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\.[a-z0-9]+$/i, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function isImageAsset(name: string): boolean {
  return /\.(jpe?g|png|webp|gif|svg)$/i.test(name);
}

function isVideoAsset(name: string): boolean {
  return /\.(mp4|webm|mov)$/i.test(name);
}

type BucketAsset = {
  name: string;
  url: string;
};

async function listBucketAssets(): Promise<BucketAsset[]> {
  const result = await bucketClient.list({ maxResults: 2_000 });
  if (!result.ok) {
    throw new Error(`Unable to list App Storage objects: ${result.error.message}`);
  }

  return result.value.map(({ name }) => ({
    name,
    url: getServedObjectUrl(`/objects/${name}`),
  }));
}

function assetsInFolders(assets: BucketAsset[], folders: string[]): BucketAsset[] {
  return assets.filter(({ name }) => {
    const normalized = name.toLowerCase();
    return folders.some((folder) => normalized.startsWith(`${folder}/`));
  });
}

function findProductAsset(
  product: SourceProduct,
  mediaAssets: BucketAsset[],
  fallbackIndex: number,
): BucketAsset | undefined {
  const sourceStem = product.image
    ? slugify(product.image.split("/").pop() ?? "")
    : "";
  const productStem = slugify(product.name);
  const exact = mediaAssets.find((asset) => {
    const assetStem = slugify(asset.name.split("/").pop() ?? "");
    return (
      assetStem === sourceStem ||
      assetStem === productStem ||
      productStem.includes(assetStem) ||
      assetStem.includes(productStem)
    );
  });
  if (exact) return exact;

  // If the owner uploaded one image per catalog item without source names,
  // preserve the upload order as a deterministic fallback.
  return mediaAssets.length === 68 ? mediaAssets[fallbackIndex] : undefined;
}

function getShortTitle(name: string): string {
  const filename = name.split("/").pop() ?? name;
  return filename.replace(/\.[a-z0-9]+$/i, "").replace(/[-_]+/g, " ").trim();
}

async function readSourceCatalog(): Promise<SourceCatalog> {
  const response = await fetch(SOURCE_URL, {
    signal: AbortSignal.timeout(30_000),
    headers: { "User-Agent": "Jatek catalog import (authorized site owner)" },
  });
  if (!response.ok) {
    throw new Error(`Source site returned HTTP ${response.status}`);
  }

  const html = await response.text();
  const match = html.match(/const produitsData\s*=\s*(\{.*?\});\s*\n/s);
  if (!match) {
    throw new Error("Could not find produitsData in the source site");
  }

  const catalog = JSON.parse(match[1]) as SourceCatalog;
  const categories = Object.entries(catalog).filter(
    ([key, value]) => key !== "commonOptions" && Array.isArray(value),
  );
  const productCount = categories.reduce(
    (total, [, value]) => total + (value as SourceProduct[]).length,
    0,
  );
  if (productCount < 50) {
    throw new Error(`Source catalog looks incomplete (${productCount} products)`);
  }

  return catalog;
}

async function uploadSourceAsset(
  assetPath: string,
  cache: Map<string, string>,
  folder: MediaFolder = "medias",
): Promise<string> {
  const url = sourceAssetUrl(assetPath);
  const existing = cache.get(url);
  if (existing) return existing;

  const response = await fetch(url, {
    signal: AbortSignal.timeout(30_000),
    headers: { "User-Agent": "Jatek media import (authorized site owner)" },
  });
  if (!response.ok) {
    throw new Error(`Media ${url} returned HTTP ${response.status}`);
  }

  const contentType = response.headers.get("content-type")?.split(";")[0] || "image/png";
  if (!contentType.startsWith("image/")) {
    throw new Error(`Media ${url} is not an image (${contentType})`);
  }

  const objectPath = await objectStorage.uploadBuffer(
    Buffer.from(await response.arrayBuffer()),
    contentType,
    folder,
  );
  const servedUrl = getServedObjectUrl(objectPath);
  cache.set(url, servedUrl);
  return servedUrl;
}

async function findOwnerId(): Promise<number> {
  const [merchantOwner] = await db
    .select({ id: usersTable.id })
    .from(usersTable)
    .where(like(usersTable.email, "%smash%"))
    .limit(1);
  if (merchantOwner) return merchantOwner.id;

  const [adminOwner] = await db
    .select({ id: usersTable.id })
    .from(usersTable)
    .where(
      or(
        eq(usersTable.role, "super_admin"),
        eq(usersTable.role, "admin"),
        eq(usersTable.role, "manager"),
      ),
    )
    .limit(1);
  if (!adminOwner) {
    throw new Error("No merchant or admin account exists to own the restaurant");
  }
  return adminOwner.id;
}

function flattenProducts(catalog: SourceCatalog) {
  return Object.entries(catalog)
    .filter(([key, value]) => key !== "commonOptions" && Array.isArray(value))
    .flatMap(([sourceCategory, value]) =>
      (value as SourceProduct[]).map((product, index) => ({
        sourceCategory,
        category: CATEGORY_LABELS[sourceCategory] ?? sourceCategory,
        product,
        sortOrder: index,
      })),
    );
}

async function main() {
  const fromBucket = process.argv.includes("--from-bucket");
  console.log("[seed:smashs] Reading the authorized source catalog…");
  const catalog = await readSourceCatalog();
  const products = flattenProducts(catalog);
  const mediaCache = new Map<string, string>();

  let productImageUrls = new Map<string, string>();
  let logoUrl: string;
  let coverUrl: string;
  let bucketShortAssets: BucketAsset[] = [];

  if (fromBucket) {
    const bucketAssets = await listBucketAssets();
    const logoAssets = assetsInFolders(bucketAssets, ["logos", "logo"]).filter((asset) =>
      isImageAsset(asset.name),
    );
    const bannerAssets = assetsInFolders(bucketAssets, ["banners", "banner"]).filter((asset) =>
      isImageAsset(asset.name),
    );
    const mediaAssets = assetsInFolders(bucketAssets, ["media", "medias", "images"]).filter((asset) =>
      isImageAsset(asset.name),
    );
    bucketShortAssets = assetsInFolders(bucketAssets, ["shorts"]).filter((asset) =>
      isImageAsset(asset.name) || isVideoAsset(asset.name),
    );

    if (!logoAssets[0]) throw new Error("No image found in logos/ or logo/");
    if (!bannerAssets[0]) throw new Error("No image found in banners/ or banner/");
    if (!mediaAssets.length) throw new Error("No product image found in media/, medias/ or images/");
    if (!bucketShortAssets.length) throw new Error("No image or video found in shorts/");

    logoUrl = logoAssets[0].url;
    coverUrl = bannerAssets[0].url;
    for (const [index, { product }] of products.entries()) {
      const asset = findProductAsset(product, mediaAssets, index);
      if (asset) productImageUrls.set(product.image ?? product.name, asset.url);
    }
    console.log(
      `[seed:smashs] Using ${bucketAssets.length} direct bucket objects: ${logoAssets.length} logos, ${bannerAssets.length} banners, ${mediaAssets.length} product images and ${bucketShortAssets.length} shorts.`,
    );
  } else {
    console.log(`[seed:smashs] Uploading ${products.length} product images…`);
    for (const { product } of products) {
      if (!product.image) continue;
      productImageUrls.set(product.image, await uploadSourceAsset(product.image, mediaCache));
    }
    logoUrl = await uploadSourceAsset("images/logo_smashsfoodoujda.png", mediaCache, "logos");
    coverUrl = await uploadSourceAsset("images/slides/promo1.png", mediaCache, "banners");
  }
  const ownerId = await findOwnerId();

  await db.transaction(async (tx) => {
    // This is an intentional replacement seed: old dev/demo restaurant data,
    // operational records tied to it, and old shorts must not remain visible.
    await tx.delete(orderItemsTable);
    await tx.delete(ordersTable);
    await tx.delete(reviewsTable);
    await tx.delete(quotesTable);
    await tx.delete(favoritesTable);
    await tx.delete(restaurantHoursTable);
    await tx.delete(menuItemExtrasTable);
    await tx.delete(menuItemSizesTable);
    await tx.delete(menuItemCategoriesTable);
    await tx.delete(menuItemsTable);
    await tx.delete(shortsTable);
    await tx.delete(restaurantsTable);

    const [restaurant] = await tx
      .insert(restaurantsTable)
      .values({
        ownerId,
        name: RESTAURANT_NAME,
        description:
          "Burgers, poulet croustillant, tacos, wraps et desserts Smash's à Oujda.",
        address: "693 Boulevard Al Maqdis, Hay Al Qods, Oujda 60000",
        phone: null,
        imageUrl: logoUrl,
        coverImageUrl: coverUrl,
        logoUrl,
        category: "Burgers",
        businessType: "restaurant",
        isLocal: true,
        isOpen: true,
        deliveryTime: null,
        deliveryFee: null,
        minimumOrder: null,
        rating: null,
        reviewCount: 0,
        isVerified: true,
        latitude: 34.6814,
        longitude: -1.9078,
        isFeatured: true,
      })
      .returning({ id: restaurantsTable.id });

    if (!restaurant) throw new Error("Restaurant insert returned no row");

    const menuRows = products.map(({ category, product }, index) => ({
      restaurantId: restaurant.id,
      name: product.name.trim(),
      description: product.description?.trim() || null,
      price: Number(product.price),
      imageUrl: product.image
        ? productImageUrls.get(product.image) ?? null
        : productImageUrls.get(product.name) ?? null,
      category,
      isAvailable: product.available !== false,
      isPopular: index < 8,
      prepTimeMinutes: null,
    }));

    const insertedItems = await tx
      .insert(menuItemsTable)
      .values(menuRows)
      .returning({
        id: menuItemsTable.id,
        name: menuItemsTable.name,
      });

    const itemByName = new Map(insertedItems.map((item) => [item.name, item.id]));
    const sizeRows: Array<{
      menuItemId: number;
      name: string;
      priceAdjustment: number;
      sortOrder: number;
    }> = [];
    const extraRows: Array<{
      menuItemId: number;
      name: string;
      price: number;
      sortOrder: number;
    }> = [];

    for (const { product } of products) {
      const menuItemId = itemByName.get(product.name.trim());
      if (!menuItemId) continue;

      for (const [sortOrder, [name, variant]] of Object.entries(
        product.Tailles ?? {},
      ).entries()) {
        sizeRows.push({
          menuItemId,
          name,
          priceAdjustment: Number(variant.price) - Number(product.price),
          sortOrder,
        });
      }

      const extras = new Set(
        (product.extraOptions ?? []).flatMap((option) => option.values),
      );
      [...extras].forEach((name, sortOrder) => {
        extraRows.push({ menuItemId, name, price: 0, sortOrder });
      });
    }

    if (sizeRows.length) await tx.insert(menuItemSizesTable).values(sizeRows);
    if (extraRows.length) await tx.insert(menuItemExtrasTable).values(extraRows);

    const shortRows = fromBucket
      ? bucketShortAssets.map((asset, sortOrder) => ({
          title: `${getShortTitle(asset.name)} — Smash's Oujda`,
          imageUrl: isImageAsset(asset.name) ? asset.url : null,
          videoUrl: isVideoAsset(asset.name) ? asset.url : null,
          restaurantId: restaurant.id,
          restaurantName: RESTAURANT_NAME,
          isActive: true,
          sortOrder,
        }))
      : products
          .filter(({ product }) => product.image)
          .slice(0, 3)
          .map(({ product }, sortOrder) => ({
            title: `${product.name.trim()} — Smash's Oujda`,
            imageUrl: productImageUrls.get(product.image!),
            videoUrl: null,
            restaurantId: restaurant.id,
            restaurantName: RESTAURANT_NAME,
            isActive: true,
            sortOrder,
          }));
    await tx.insert(shortsTable).values(shortRows);

    console.log(
      `[seed:smashs] Created restaurant ${restaurant.id}, ${menuRows.length} products, ${sizeRows.length} sizes, ${extraRows.length} extras and ${shortRows.length} shorts.`,
    );
  });

  console.log(
    `[seed:smashs] Completed. ${mediaCache.size} source media files are stored in the project bucket.`,
  );
}

main().catch((error) => {
  console.error("[seed:smashs] Failed:", error);
  process.exitCode = 1;
});