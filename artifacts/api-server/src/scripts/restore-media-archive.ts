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

async function main(): Promise<void> {
  const mediaRoot = path.resolve(required("MEDIA_RESTORE_ROOT"));
  const manifestPath = path.resolve(required("MEDIA_MANIFEST_PATH"));
  const manifest = JSON.parse(await readFile(manifestPath, "utf8")) as MediaManifest;

  if (manifest.version !== 1 || !Array.isArray(manifest.entries)) {
    throw new Error("Unsupported or invalid media manifest");
  }
  if (manifest.objectCount !== manifest.entries.length) {
    throw new Error("Media manifest object count does not match its entries");
  }

  const client = new ReplitObjectStorageClient();
  const allowOverwrite = process.env.ALLOW_MEDIA_OVERWRITE === "YES";
  let uploaded = 0;
  let skipped = 0;
  let totalBytes = 0;

  for (const entry of manifest.entries) {
    assertSafeObjectName(entry.objectName);
    if (entry.relativePath !== path.posix.join("media", entry.objectName)) {
      throw new Error(`Manifest path mismatch for ${entry.objectName}`);
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

    const existing = await client.exists(entry.objectName);
    if (!existing.ok) throw new Error(`Unable to inspect ${entry.objectName}: ${existing.error.message}`);
    if (existing.value) {
      const target = await client.downloadAsBytes(entry.objectName);
      if (!target.ok) throw new Error(`Unable to verify ${entry.objectName}: ${target.error.message}`);
      if (sha256(target.value[0]) === entry.sha256) {
        skipped++;
        continue;
      }
      if (!allowOverwrite) {
        throw new Error(`Target object differs: ${entry.objectName}. Set ALLOW_MEDIA_OVERWRITE=YES to replace it.`);
      }
    }

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

  if (totalBytes !== manifest.totalBytes) {
    throw new Error("Media manifest total byte count does not match the archive contents");
  }
  console.log(`[restore:media] complete — ${uploaded} uploaded, ${skipped} already verified, ${manifest.entries.length} total`);
}

main().catch((error) => {
  console.error(`[restore:media] failed: ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
});