import { createHash } from "node:crypto";
import { createWriteStream } from "node:fs";
import { mkdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import { spawn } from "node:child_process";
import { createGzip } from "node:zlib";
import { pipeline } from "node:stream/promises";
import path from "node:path";
import { Client as ReplitObjectStorageClient } from "@replit/object-storage";

const PAGE_SIZE = 2_000;
type MediaManifestEntry = {
  objectName: string;
  relativePath: string;
  size: number;
  sha256: string;
};

export type MediaBackupResult = {
  outputDir: string;
  archivePath: string;
  manifestPath: string;
  summaryPath: string;
  objectCount: number;
  totalBytes: number;
  manifestSha256: string;
  archive: { size: number; sha256: string };
  verification: "verified";
};

function assertSafeObjectName(objectName: string): void {
  if (
    !objectName ||
    objectName.startsWith("/") ||
    objectName.includes("\\") ||
    /[\u0000-\u001f\u007f]/.test(objectName) ||
    objectName.split("/").some((part) => part === "" || part === "." || part === "..")
  ) {
    throw new Error(`Unsafe App Storage object name: ${objectName}`);
  }
}

async function sha256File(filePath: string): Promise<string> {
  const contents = await readFile(filePath);
  return createHash("sha256").update(contents).digest("hex");
}

async function runPgDump(databaseDump: string): Promise<{ size: number; sha256: string }> {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) throw new Error("DATABASE_URL is not configured");

  const child = spawn(
    "pg_dump",
    ["--dbname", databaseUrl, "--no-owner", "--no-acl", "--format=plain"],
    { stdio: ["ignore", "pipe", "pipe"] },
  );
  const stderrChunks: Buffer[] = [];
  child.stderr.on("data", (chunk: Buffer) => stderrChunks.push(Buffer.from(chunk)));

  await Promise.all([
    pipeline(child.stdout, createGzip({ level: 9 }), createWriteStream(databaseDump, { mode: 0o600 })),
    new Promise<void>((resolve, reject) => {
      child.once("error", reject);
      child.once("close", (code) => {
        if (code === 0) resolve();
        else {
          const message = Buffer.concat(stderrChunks).toString("utf8").trim();
          reject(new Error(`pg_dump failed${message ? `: ${message}` : ` (exit ${code})`}`));
        }
      });
    }),
  ]);

  const file = await stat(databaseDump);
  return { size: file.size, sha256: await sha256File(databaseDump) };
}

export async function listAllObjects(client: ReplitObjectStorageClient): Promise<string[]> {
  const names: string[] = [];
  let startOffset: string | undefined;
  let previousLastName = "";

  while (true) {
    const result = await client.list({
      maxResults: PAGE_SIZE,
      ...(startOffset ? { startOffset } : {}),
    });
    if (!result.ok) throw new Error(`Unable to list App Storage objects: ${result.error.message}`);

    const freshNames = result.value
      .map((object) => object.name)
      // App Storage may expose folder markers such as "banners/".
      // They have no bytes to preserve and are not downloadable objects.
      .filter((name) => !name.endsWith("/") && name > previousLastName);
    names.push(...freshNames);

    const lastName = result.value.at(-1)?.name;
    if (!lastName || result.value.length < PAGE_SIZE) break;
    if (lastName <= previousLastName) {
      throw new Error("App Storage pagination did not advance safely");
    }
    previousLastName = lastName;
    startOffset = lastName;
  }

  return [...new Set(names)].sort();
}

async function createTarArchive(archivePath: string, outputDir: string): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const child = spawn("tar", ["-czf", archivePath, "-C", outputDir, "media", "media-manifest.json", "backup-summary.json"], {
      stdio: ["ignore", "ignore", "pipe"],
    });
    const errors: Buffer[] = [];
    child.stderr.on("data", (chunk: Buffer) => errors.push(Buffer.from(chunk)));
    child.once("error", reject);
    child.once("close", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`media archive failed: ${Buffer.concat(errors).toString("utf8").trim()}`));
    });
  });
  await rm(path.join(outputDir, "media"), { recursive: true, force: true });
}

async function verifyArchiveContents(archivePath: string, objectNames: string[]): Promise<void> {
  const archiveEntries = await new Promise<string[]>((resolve, reject) => {
    const child = spawn("tar", ["-tzf", archivePath], { stdio: ["ignore", "pipe", "pipe"] });
    const output: Buffer[] = [];
    const errors: Buffer[] = [];
    child.stdout.on("data", (chunk: Buffer) => output.push(Buffer.from(chunk)));
    child.stderr.on("data", (chunk: Buffer) => errors.push(Buffer.from(chunk)));
    child.once("error", reject);
    child.once("close", (code) => {
      if (code !== 0) {
        reject(new Error(`media archive verification failed: ${Buffer.concat(errors).toString("utf8").trim()}`));
        return;
      }
      resolve(Buffer.concat(output).toString("utf8").split("\n").map((entry) => entry.replace(/\/$/, "")).filter(Boolean));
    });
  });

  const expectedEntries = new Set([
    "media-manifest.json",
    "backup-summary.json",
    ...objectNames.map((objectName) => path.posix.join("media", objectName)),
  ]);
  const actualEntries = new Set(archiveEntries);
  for (const expected of expectedEntries) {
    if (!actualEntries.has(expected)) {
      throw new Error(`Media archive is missing ${expected}`);
    }
  }
}

/**
 * Creates a read-only snapshot of every object in the managed App Storage
 * bucket. The archive contains the media, its per-object SHA-256 manifest and
 * an operation summary. The caller owns cleanup of outputDir.
 */
export async function createMediaBackup(outputDir: string): Promise<MediaBackupResult> {
  const mediaDir = path.join(outputDir, "media");
  const mediaArchive = path.join(outputDir, "media.tar.gz");
  const manifestPath = path.join(outputDir, "media-manifest.json");
  const summaryPath = path.join(outputDir, "backup-summary.json");
  const generatedAt = new Date().toISOString();
  const client = new ReplitObjectStorageClient();
  const objectNames = await listAllObjects(client);
  const entries: MediaManifestEntry[] = [];
  let totalBytes = 0;

  await mkdir(outputDir, { recursive: true, mode: 0o700 });
  for (const [index, objectName] of objectNames.entries()) {
    assertSafeObjectName(objectName);
    const destination = path.join(mediaDir, objectName);
    await mkdir(path.dirname(destination), { recursive: true });

    const result = await client.downloadToFilename(objectName, destination, { decompress: false });
    if (!result.ok) {
      throw new Error(`Unable to download App Storage object ${objectName}: ${result.error.message}`);
    }

    const file = await stat(destination);
    const entry = {
      objectName,
      relativePath: path.posix.join("media", objectName),
      size: file.size,
      sha256: await sha256File(destination),
    };
    entries.push(entry);
    totalBytes += file.size;
    console.log(`[backup:prepublish] media ${index + 1}/${objectNames.length}: ${objectName}`);
  }

  const manifest = {
    version: 1,
    generatedAt,
    objectCount: entries.length,
    totalBytes,
    entries,
  };
  await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, { mode: 0o600 });

  const manifestSha256 = await sha256File(manifestPath);
  await writeFile(
    summaryPath,
    `${JSON.stringify({
      version: 1,
      generatedAt,
      operation: "media_backup",
      verification: {
        status: "verified",
        method: "sha256-manifest",
        description: "Chaque objet téléchargé est présent dans l’archive et décrit par son SHA-256.",
      },
      media: {
        archive: path.basename(mediaArchive),
        manifest: path.basename(manifestPath),
        objectCount: entries.length,
        totalBytes,
        manifestSha256,
      },
      restoreNotes: [
        "Verify media-manifest.json SHA-256 values before importing media.",
        "Do not delete source App Storage objects during restore.",
      ],
    }, null, 2)}\n`,
    { mode: 0o600 },
  );

  await createTarArchive(mediaArchive, outputDir);
  await verifyArchiveContents(mediaArchive, objectNames);
  const archiveFile = await stat(mediaArchive);
  return {
    outputDir,
    archivePath: mediaArchive,
    manifestPath,
    summaryPath,
    objectCount: entries.length,
    totalBytes,
    manifestSha256,
    archive: { size: archiveFile.size, sha256: await sha256File(mediaArchive) },
    verification: "verified",
  };
}

async function main(): Promise<void> {
  const backupRoot = path.resolve(
    process.env.PREPUBLISH_BACKUP_DIR || path.join(process.cwd(), "../../.local/backups"),
  );
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const backupDir = path.join(backupRoot, `jatek-prepublish-${timestamp}`);
  const databaseDump = path.join(backupDir, "database.sql.gz");
  const mediaArchive = path.join(backupDir, "media.tar.gz");
  const manifestPath = path.join(backupDir, "media-manifest.json");
  const summaryPath = path.join(backupDir, "backup-summary.json");
  await mkdir(backupDir, { recursive: true, mode: 0o700 });
  console.log(`[backup:prepublish] writing backup to ${backupDir}`);

  const database = await runPgDump(databaseDump);
  const media = await createMediaBackup(backupDir);
  const summary = {
    version: 1,
    generatedAt: new Date().toISOString(),
    database: { file: path.basename(databaseDump), ...database },
    media: {
      archive: path.basename(mediaArchive),
      manifest: path.basename(manifestPath),
      objectCount: media.objectCount,
      totalBytes: media.totalBytes,
      verification: media.verification,
      manifestSha256: media.manifestSha256,
      ...media.archive,
    },
    restoreNotes: [
      "Restore the SQL dump only into the intended PostgreSQL database.",
      "Verify media-manifest.json SHA-256 values before importing media.",
      "Do not delete source App Storage objects during publish or restore.",
    ],
  };
  await writeFile(summaryPath, `${JSON.stringify(summary, null, 2)}\n`, { mode: 0o600 });

  console.log(`[backup:prepublish] database: ${database.size} bytes, sha256 ${database.sha256}`);
  console.log(
    `[backup:prepublish] media: ${media.objectCount} objects, ${media.totalBytes} bytes, archive sha256 ${media.archive.sha256}`,
  );
  console.log(`[backup:prepublish] summary: ${summaryPath}`);
}

// This module is also imported by the admin API so the dashboard can create a
// media-only backup. Never run the full pg_dump when it is imported by the
// long-lived API process.
if (path.basename(process.argv[1] ?? "").startsWith("backup-prepublish")) {
  main().catch((error) => {
    console.error(`[backup:prepublish] failed: ${error instanceof Error ? error.message : String(error)}`);
    process.exitCode = 1;
  });
}