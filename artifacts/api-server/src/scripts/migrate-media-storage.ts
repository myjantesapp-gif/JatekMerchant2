/**
 * One-off, idempotent migration from the historic uploads/ prefix to Jatek's
 * media folders. The order is intentionally copy -> verify -> update database
 * -> delete legacy source so an interrupted run never creates broken media.
 *
 * Run with:
 *   pnpm --filter @workspace/api-server exec tsx src/scripts/migrate-media-storage.ts
 */
import { Client as ObjectStorageClient } from "@replit/object-storage";
import {
  adsTable,
  categoriesTable,
  db,
  menuItemsTable,
  restaurantsTable,
  shortsTable,
  usersTable,
} from "@workspace/db";
import { eq } from "drizzle-orm";

type Folder = "images" | "logos" | "banners" | "medias" | "shorts";
type Reference = {
  source: string;
  folder: Folder;
  id: number;
  table: "ads" | "categories" | "menuItems" | "restaurants" | "shorts" | "users";
  column: "imageUrl" | "bannerImageUrl" | "coverImageUrl" | "logoUrl" | "videoUrl" | "avatarUrl";
};

export type LegacyMediaMigrationSummary = {
  legacyObjects: number;
  migratedReferences: number;
  migratedOrphans: number;
  deletedLegacyObjects: number;
  retainedLegacyObjects: number;
  failures: number;
};

const client = new ObjectStorageClient();
const LEGACY_PREFIX = "uploads/";

function legacyObjectName(value: string | null): string | null {
  if (!value) return null;
  const normalized = value.trim();
  const match = normalized.match(/(?:^|\/)api\/storage\/objects\/(uploads\/[^?#/]+)(?:[?#]|$)/)
    ?? normalized.match(/^\/objects\/(uploads\/[^?#/]+)(?:[?#]|$)/)
    ?? normalized.match(/^(uploads\/[^?#/]+)(?:[?#]|$)/);
  return match?.[1] ?? null;
}

function targetName(source: string, folder: Folder): string {
  const basename = source.slice(LEGACY_PREFIX.length);
  return `${folder}/${basename}`;
}

function servedPath(objectName: string): string {
  return `/api/storage/objects/${objectName}`;
}

function detectFolder(buffer: Buffer): Folder {
  const video =
    (buffer.length >= 8 && buffer.subarray(4, 8).toString("ascii") === "ftyp")
    || (buffer.length >= 4 && buffer[0] === 0x1a && buffer[1] === 0x45 && buffer[2] === 0xdf && buffer[3] === 0xa3);
  return video ? "shorts" : "images";
}

async function listLegacyObjects(): Promise<string[]> {
  const objectNames: string[] = [];
  let startOffset: string | undefined;
  const pageSize = 1_000;

  for (;;) {
    const result = await client.list({ prefix: LEGACY_PREFIX, startOffset, maxResults: pageSize });
    if (!result.ok) throw new Error(`Unable to list legacy media: ${result.error.message}`);
    objectNames.push(...result.value.map((object) => object.name));
    if (result.value.length < pageSize) break;
    startOffset = `${result.value[result.value.length - 1].name}\u0000`;
  }

  return [...new Set(objectNames)];
}

async function resolveExistingSource(requested: string, legacyObjects: Set<string>): Promise<string | null> {
  if (legacyObjects.has(requested)) return requested;
  // A historic importer sometimes saved an extension in PostgreSQL even though
  // the App Storage object was stored by UUID without one.
  const withoutExtension = requested.replace(/\.[a-z0-9]{1,8}$/i, "");
  return legacyObjects.has(withoutExtension) ? withoutExtension : null;
}

async function copyAndVerify(source: string, destination: string): Promise<void> {
  const exists = await client.exists(destination);
  if (!exists.ok) throw new Error(`Unable to check ${destination}: ${exists.error.message}`);
  if (!exists.value) {
    const copied = await client.copy(source, destination);
    if (!copied.ok) throw new Error(`Unable to copy ${source}: ${copied.error.message}`);
  }
  const verified = await client.exists(destination);
  if (!verified.ok || !verified.value) throw new Error(`Copy verification failed for ${destination}`);
  const [sourceBytes, destinationBytes] = await Promise.all([
    client.downloadAsBytes(source),
    client.downloadAsBytes(destination),
  ]);
  if (!sourceBytes.ok || !destinationBytes.ok || !sourceBytes.value[0].equals(destinationBytes.value[0])) {
    throw new Error(`Destination collision or failed copy for ${destination}; legacy source was retained`);
  }
}

async function updateReference(reference: Reference, destination: string): Promise<void> {
  const value = servedPath(destination);
  if (reference.table === "ads") {
    const updated = await db.update(adsTable).set({ imageUrl: value }).where(eq(adsTable.id, reference.id)).returning({ id: adsTable.id });
    if (updated.length !== 1) throw new Error("Database update did not affect the ad");
  } else if (reference.table === "categories") {
    const updated = await db.update(categoriesTable).set({ bannerImageUrl: value }).where(eq(categoriesTable.id, reference.id)).returning({ id: categoriesTable.id });
    if (updated.length !== 1) throw new Error("Database update did not affect the category");
  } else if (reference.table === "menuItems") {
    const updated = await db.update(menuItemsTable).set({ imageUrl: value }).where(eq(menuItemsTable.id, reference.id)).returning({ id: menuItemsTable.id });
    if (updated.length !== 1) throw new Error("Database update did not affect the menu item");
  } else if (reference.table === "restaurants") {
    const updated = await db.update(restaurantsTable).set({ [reference.column]: value } as any).where(eq(restaurantsTable.id, reference.id)).returning({ id: restaurantsTable.id });
    if (updated.length !== 1) throw new Error("Database update did not affect the restaurant");
  } else if (reference.table === "shorts") {
    const updated = await db.update(shortsTable).set({ [reference.column]: value } as any).where(eq(shortsTable.id, reference.id)).returning({ id: shortsTable.id });
    if (updated.length !== 1) throw new Error("Database update did not affect the Short");
  } else {
    const updated = await db.update(usersTable).set({ avatarUrl: value }).where(eq(usersTable.id, reference.id)).returning({ id: usersTable.id });
    if (updated.length !== 1) throw new Error("Database update did not affect the user");
  }
}

async function getReferences(): Promise<Reference[]> {
  const references: Reference[] = [];
  const add = (source: string | null, folder: Folder, id: number, table: Reference["table"], column: Reference["column"]) => {
    const objectName = legacyObjectName(source);
    if (objectName) references.push({ source: objectName, folder, id, table, column });
  };

  for (const row of await db.select({ id: menuItemsTable.id, value: menuItemsTable.imageUrl }).from(menuItemsTable)) {
    add(row.value, "medias", row.id, "menuItems", "imageUrl");
  }
  for (const row of await db.select({ id: restaurantsTable.id, imageUrl: restaurantsTable.imageUrl, logoUrl: restaurantsTable.logoUrl, coverImageUrl: restaurantsTable.coverImageUrl }).from(restaurantsTable)) {
    add(row.imageUrl, "banners", row.id, "restaurants", "imageUrl");
    add(row.logoUrl, "logos", row.id, "restaurants", "logoUrl");
    add(row.coverImageUrl, "banners", row.id, "restaurants", "coverImageUrl");
  }
  for (const row of await db.select({ id: adsTable.id, value: adsTable.imageUrl }).from(adsTable)) {
    add(row.value, "banners", row.id, "ads", "imageUrl");
  }
  for (const row of await db.select({ id: categoriesTable.id, value: categoriesTable.bannerImageUrl }).from(categoriesTable)) {
    add(row.value, "banners", row.id, "categories", "bannerImageUrl");
  }
  for (const row of await db.select({ id: shortsTable.id, imageUrl: shortsTable.imageUrl, videoUrl: shortsTable.videoUrl }).from(shortsTable)) {
    add(row.imageUrl, "shorts", row.id, "shorts", "imageUrl");
    add(row.videoUrl, "shorts", row.id, "shorts", "videoUrl");
  }
  for (const row of await db.select({ id: usersTable.id, value: usersTable.avatarUrl }).from(usersTable)) {
    add(row.value, "images", row.id, "users", "avatarUrl");
  }
  return references;
}

export async function migrateLegacyMedia(): Promise<LegacyMediaMigrationSummary> {
  const legacyObjectNames = await listLegacyObjects();
  const legacyObjects = new Set(legacyObjectNames);
  const references = await getReferences();
  const referencedSources = new Set<string>();
  const expectedReferenceUpdates = new Map<string, number>();
  const successfulReferenceUpdates = new Map<string, number>();
  const removableSources = new Set<string>();
  let migratedReferences = 0;
  let migratedOrphans = 0;
  let failures = 0;

  for (const reference of references) {
    const source = await resolveExistingSource(reference.source, legacyObjects);
    if (!source) {
      console.error(`Skipping missing legacy object referenced by ${reference.table}.${reference.column}#${reference.id}: ${reference.source}`);
      failures++;
      continue;
    }
    referencedSources.add(source);
    expectedReferenceUpdates.set(source, (expectedReferenceUpdates.get(source) ?? 0) + 1);
  }

  for (const reference of references) {
    const source = await resolveExistingSource(reference.source, legacyObjects);
    if (!source) continue;
    const destination = targetName(source, reference.folder);
    try {
      await copyAndVerify(source, destination);
      await updateReference(reference, destination);
      successfulReferenceUpdates.set(source, (successfulReferenceUpdates.get(source) ?? 0) + 1);
      migratedReferences++;
    } catch (error) {
      console.error(`Could not migrate ${source} for ${reference.table}.${reference.column}#${reference.id}:`, error);
      failures++;
    }
  }

  for (const source of referencedSources) {
    if (successfulReferenceUpdates.get(source) === expectedReferenceUpdates.get(source)) {
      removableSources.add(source);
    }
  }

  const liveReferences = await getReferences();
  const sourcesStillReferenced = new Set<string>();
  for (const reference of liveReferences) {
    const source = await resolveExistingSource(reference.source, legacyObjects);
    if (source) sourcesStillReferenced.add(source);
  }
  for (const source of sourcesStillReferenced) removableSources.delete(source);

  for (const source of legacyObjectNames.filter((objectName) => !referencedSources.has(objectName))) {
    try {
      const bytes = await client.downloadAsBytes(source);
      if (!bytes.ok) throw new Error(bytes.error.message);
      const destination = targetName(source, detectFolder(bytes.value[0]));
      await copyAndVerify(source, destination);
      removableSources.add(source);
      migratedOrphans++;
    } catch (error) {
      console.error(`Could not migrate unreferenced ${source}:`, error);
      failures++;
    }
  }

  for (const source of removableSources) {
    const deleted = await client.delete(source);
    if (!deleted.ok) {
      console.error(`Copied ${source} but could not delete the legacy object: ${deleted.error.message}`);
      failures++;
    }
  }

  return {
    legacyObjects: legacyObjectNames.length,
    migratedReferences,
    migratedOrphans,
    deletedLegacyObjects: removableSources.size,
    retainedLegacyObjects: sourcesStillReferenced.size,
    failures,
  };
}

async function main(): Promise<void> {
  const summary = await migrateLegacyMedia();
  console.log(JSON.stringify(summary, null, 2));
  const { failures } = summary;
  if (failures > 0) process.exitCode = 1;
}

if (process.argv[1]?.endsWith("migrate-media-storage.ts")) {
  main().catch((error) => {
    console.error("Media migration failed:", error);
    process.exitCode = 1;
  });
}