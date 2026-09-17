import { createHash } from "node:crypto";
import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import { Client as ReplitObjectStorageClient } from "@replit/object-storage";

type ManifestEntry = {
  objectName: string;
  relativePath: string;
  size: number;
  sha256: string;
};

type MediaManifest = {
  version: number;
  objectCount: number;
  totalBytes: number;
  entries: ManifestEntry[];
};

const REPLIT_DEFAULT_BUCKET_URL = "http://127.0.0.1:1106/object-storage/default-bucket";

function required(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is required`);
  return value;
}

function sha256(bytes: Buffer): string {
  return createHash("sha256").update(bytes).digest("hex");
}

function assertSafeObjectName(objectName: string): void {
  if (
    !objectName ||
    objectName.startsWith("/") ||
    objectName.includes("\\") ||
    /[\u0000-\u001f\u007f]/.test(objectName) ||
    objectName.split("/").some((part) => part === "" || part === "." || part === "..")
  ) {
    throw new Error(`Unsafe media object name: ${objectName}`);
  }
}

async function getDefaultBucketId(): Promise<string> {
  const response = await fetch(REPLIT_DEFAULT_BUCKET_URL, {
    signal: AbortSignal.timeout(30_000),
  });
  if (!response.ok) {
    throw new Error(`Unable to resolve the active App Storage bucket (HTTP ${response.status})`);
  }
  const body = await response.json() as { bucketId?: unknown };
  if (typeof body.bucketId !== "string" || !body.bucketId) {
    throw new Error("The App Storage sidecar returned an invalid default bucket");
  }
  return body.bucketId;
}

async function main(): Promise<void> {
  const mediaRoot = path.resolve(required("MEDIA_RESTORE_ROOT"));
  const manifestPath = path.resolve(required("MEDIA_MANIFEST_PATH"));
  const expectedBucketId = required("MEDIA_RESTORE_TARGET_BUCKET_ID");
  const manifest = JSON.parse(await readFile(manifestPath, "utf8")) as MediaManifest;

  if (manifest.version !== 1 || !Array.isArray(manifest.entries)) {
    throw new Error("Unsupported or invalid media manifest");
  }
  if (manifest.objectCount !== manifest.entries.length) {
    throw new Error("Media manifest object count does not match its entries");
  }

  const defaultBucketId = await getDefaultBucketId();
  if (defaultBucketId !== expectedBucketId) {
    throw new Error("The active App Storage bucket does not match the explicitly confirmed restore target");
  }

  const client = new ReplitObjectStorageClient();
  let uploaded = 0;
  let skipped = 0;
  let totalBytes = 0;
  const verifiedEntries: Array<{ entry: ManifestEntry; bytes: Buffer }> = [];
  const objectNames = new Set<string>();

  // Verify the complete archive before making any remote changes.
  for (const entry of manifest.entries) {
    assertSafeObjectName(entry.objectName);
    if (objectNames.has(entry.objectName)) {
      throw new Error(`Duplicate media object name: ${entry.objectName}`);
    }
    objectNames.add(entry.objectName);
    if (entry.relativePath !== path.posix.join("media", entry.objectName)) {
      throw new Error(`Manifest path mismatch for ${entry.objectName}`);
    }
    if (!Number.isSafeInteger(entry.size) || entry.size < 0 || !/^[a-f0-9]{64}$/.test(entry.sha256)) {
      throw new Error(`Invalid manifest metadata for ${entry.objectName}`);
    }

    const localPath = path.resolve(mediaRoot, entry.objectName);
    if (!localPath.startsWith(`${mediaRoot}${path.sep}`)) {
      throw new Error(`Manifest path escapes media root: ${entry.objectName}`);
    }
    const bytes = await readFile(localPath);
    const file = await stat(localPath);
    if (file.size !== entry.size || sha256(bytes) !== entry.sha256) {
      throw new Error(`Checksum verification failed before upload: ${entry.objectName}`);
    }
    totalBytes += file.size;
    verifiedEntries.push({ entry, bytes });
  }

  if (totalBytes !== manifest.totalBytes) {
    throw new Error("Media manifest total byte count does not match the archive contents");
  }

  // Inspect the complete target before uploading. A differing object always
  // aborts the restore: this script only fills missing objects and never
  // overwrites or deletes production media.
  const missingEntries: Array<{ entry: ManifestEntry; bytes: Buffer }> = [];
  for (const verifiedEntry of verifiedEntries) {
    const { entry } = verifiedEntry;
    const existing = await client.exists(entry.objectName);
    if (!existing.ok) throw new Error(`Unable to inspect ${entry.objectName}: ${existing.error.message}`);
    if (existing.value) {
      const target = await client.downloadAsBytes(entry.objectName);
      if (!target.ok) throw new Error(`Unable to verify ${entry.objectName}: ${target.error.message}`);
      if (sha256(target.value[0]) === entry.sha256) {
        skipped++;
        continue;
      }
      throw new Error(`Target object differs: ${entry.objectName}. Restore aborted without overwriting it.`);
    }
    missingEntries.push(verifiedEntry);
  }

  for (const { entry, bytes } of missingEntries) {
    const uploadedResult = await client.uploadFromBytes(entry.objectName, bytes, { compress: false });
    if (!uploadedResult.ok) throw new Error(`Unable to upload ${entry.objectName}: ${uploadedResult.error.message}`);

    const verified = await client.downloadAsBytes(entry.objectName);
    if (!verified.ok || sha256(verified.value[0]) !== entry.sha256) {
      throw new Error(`Checksum verification failed after upload: ${entry.objectName}`);
    }
    uploaded++;
    if (uploaded % 10 === 0) {
      console.log(`[restore:media] uploaded ${uploaded}/${manifest.entries.length}`);
    }
  }

  console.log(`[restore:media] complete — ${uploaded} uploaded, ${skipped} already verified, ${manifest.entries.length} total`);
}

main().catch((error) => {
  console.error(`[restore:media] failed: ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
});