import { createHash } from "node:crypto";
import { Client as ReplitObjectStorageClient } from "@replit/object-storage";

const PAGE_SIZE = 2_000;

function required(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is required`);
  return value;
}

function sha256(value: Buffer): string {
  return createHash("sha256").update(value).digest("hex");
}

async function listAllObjects(client: ReplitObjectStorageClient): Promise<string[]> {
  const names: string[] = [];
  let startOffset: string | undefined;
  let previousLastName = "";

  while (true) {
    const result = await client.list({
      maxResults: PAGE_SIZE,
      ...(startOffset ? { startOffset } : {}),
    });
    if (!result.ok) throw new Error(`Unable to list App Storage objects: ${result.error.message}`);

    for (const object of result.value) {
      if (!object.name.endsWith("/") && object.name > previousLastName) {
        names.push(object.name);
      }
    }

    const lastName = result.value.at(-1)?.name;
    if (!lastName || result.value.length < PAGE_SIZE) break;
    if (lastName <= previousLastName) throw new Error("App Storage pagination did not advance safely");
    previousLastName = lastName;
    startOffset = lastName;
  }

  return [...new Set(names)].sort();
}

async function main(): Promise<void> {
  const sourceBucketId = required("SOURCE_OBJECT_STORAGE_ID");
  const targetBucketId = required("TARGET_OBJECT_STORAGE_ID");
  if (sourceBucketId === targetBucketId) {
    throw new Error("SOURCE_OBJECT_STORAGE_ID and TARGET_OBJECT_STORAGE_ID must be different");
  }

  const allowOverwrite = process.env.ALLOW_MEDIA_OVERWRITE === "YES";
  const source = new ReplitObjectStorageClient({ bucketId: sourceBucketId });
  const target = new ReplitObjectStorageClient({ bucketId: targetBucketId });
  const names = await listAllObjects(source);

  let copied = 0;
  let skipped = 0;
  for (const name of names) {
    const sourceBytes = await source.downloadAsBytes(name);
    if (!sourceBytes.ok) throw new Error(`Unable to download ${name}: ${sourceBytes.error.message}`);

    const existing = await target.exists(name);
    if (!existing.ok) throw new Error(`Unable to inspect ${name}: ${existing.error.message}`);
    if (existing.value) {
      const targetBytes = await target.downloadAsBytes(name);
      if (!targetBytes.ok) throw new Error(`Unable to verify existing ${name}: ${targetBytes.error.message}`);
      if (sha256(sourceBytes.value[0]) === sha256(targetBytes.value[0])) {
        skipped++;
        continue;
      }
      if (!allowOverwrite) {
        throw new Error(`Target object differs: ${name}. Set ALLOW_MEDIA_OVERWRITE=YES to replace it.`);
      }
    }

    const uploaded = await target.uploadFromBytes(name, sourceBytes.value[0], { compress: false });
    if (!uploaded.ok) throw new Error(`Unable to upload ${name}: ${uploaded.error.message}`);

    const verified = await target.downloadAsBytes(name);
    if (!verified.ok || sha256(verified.value[0]) !== sha256(sourceBytes.value[0])) {
      throw new Error(`Checksum verification failed for ${name}`);
    }
    copied++;
    if (copied % 100 === 0) console.log(`[clone:media] copied ${copied}/${names.length}`);
  }

  console.log(`[clone:media] complete — ${copied} copied, ${skipped} already verified, ${names.length} total`);
}

main().catch((error) => {
  console.error(`[clone:media] failed: ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
});