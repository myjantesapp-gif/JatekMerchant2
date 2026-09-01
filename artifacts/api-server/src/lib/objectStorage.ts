import { Storage, File } from "@google-cloud/storage";
import { Client as ReplitObjectStorageClient } from "@replit/object-storage";
import { Readable } from "stream";
import { randomUUID } from "crypto";

const REPLIT_SIDECAR_ENDPOINT = "http://127.0.0.1:1106";

export const objectStorageClient = new Storage({
  credentials: {
    audience: "replit",
    subject_token_type: "access_token",
    token_url: `${REPLIT_SIDECAR_ENDPOINT}/token`,
    type: "external_account",
    credential_source: {
      url: `${REPLIT_SIDECAR_ENDPOINT}/credential`,
      format: {
        type: "json",
        subject_token_field_name: "access_token",
      },
    },
    universe_domain: "googleapis.com",
  },
  projectId: "",
});

/**
 * Uses Replit's supported App Storage SDK. It resolves the active bucket from
 * the sidecar, rather than relying on a deployment-only bucket identifier.
 */
const managedObjectStorageClient = new ReplitObjectStorageClient();

type ManagedObjectFile = {
  objectName: string;
};

export const MEDIA_FOLDERS = ["images", "logos", "banners", "medias", "shorts"] as const;
export type MediaFolder = (typeof MEDIA_FOLDERS)[number];

const MEDIA_FOLDER_BY_KIND = {
  image: "images",
  logo: "logos",
  banner: "banners",
  media: "medias",
  short: "shorts",
} as const satisfies Record<string, MediaFolder>;

export type MediaKind = keyof typeof MEDIA_FOLDER_BY_KIND;

export function getMediaFolder(kind: MediaKind): MediaFolder {
  return MEDIA_FOLDER_BY_KIND[kind];
}

function trustedMediaHosts(): Set<string> {
  return new Set([
    "ma.jatek.app",
    "api.jatek.app",
    process.env.REPLIT_DEV_DOMAIN,
  ].filter((host): host is string => Boolean(host)));
}

export function containsLegacyMediaReference(value: unknown): boolean {
  if (typeof value === "string") {
    const candidate = value.trim();
    if (candidate.startsWith("uploads/") || candidate.startsWith("/objects/uploads/") || candidate.startsWith("/api/storage/objects/uploads/")) {
      return true;
    }
    try {
      const url = new URL(candidate);
      return trustedMediaHosts().has(url.host) && url.pathname.startsWith("/api/storage/objects/uploads/");
    } catch {
      return false;
    }
  }
  if (Array.isArray(value)) return value.some(containsLegacyMediaReference);
  if (value && typeof value === "object") return Object.values(value).some(containsLegacyMediaReference);
  return false;
}

function parseByteRange(value: string, size: number): { start: number; end: number } | null {
  const match = value.match(/^bytes=(\d*)-(\d*)$/);
  if (!match) return null;
  const [, rawStart, rawEnd] = match;

  if (!rawStart) {
    const suffixLength = Number(rawEnd);
    if (!Number.isInteger(suffixLength) || suffixLength <= 0) return null;
    return { start: Math.max(size - suffixLength, 0), end: size - 1 };
  }

  const start = Number(rawStart);
  const end = rawEnd ? Number(rawEnd) : size - 1;
  if (!Number.isInteger(start) || !Number.isInteger(end) || start < 0 || start > end || start >= size) return null;
  return { start, end: Math.min(end, size - 1) };
}

/**
 * Converts absolute URLs served by this API back to the database's canonical
 * relative form. Third-party URLs are deliberately preserved unchanged.
 */
export function normalizeStoredMediaPath(rawPath: unknown): string | null | undefined {
  if (rawPath === null || rawPath === undefined) return rawPath;
  if (typeof rawPath !== "string") return undefined;
  const value = rawPath.trim();
  if (!value) return value;

  if (value.startsWith("/api/storage/objects/")) return value;

  try {
    const url = new URL(value);
    if (trustedMediaHosts().has(url.host) && url.pathname.startsWith("/api/storage/objects/")) {
      return `${url.pathname}${url.search}`;
    }
  } catch {
    return value;
  }

  return value;
}

/**
 * Keeps old database references readable while production data is migrated.
 * The object names are preserved; only the media folder is corrected.
 */
export function resolveLegacyMediaPath(rawPath: unknown, folder: MediaFolder): string | null | undefined {
  const normalized = normalizeStoredMediaPath(rawPath);
  if (normalized === null || normalized === undefined || typeof normalized !== "string") return normalized;
  const value = normalized.trim();
  if (!value) return value;

  const match = value.match(/^(.*\/api\/storage\/objects\/)uploads\/([^?#/]+)([?#].*)?$/)
    ?? value.match(/^\/objects\/uploads\/([^?#/]+)([?#].*)?$/)
    ?? value.match(/^uploads\/([^?#/]+)([?#].*)?$/);
  if (!match) return value;

  const objectName = match.length === 4 ? match[2] : match[1];
  const suffix = match.length === 4 ? (match[3] ?? "") : (match[2] ?? "");
  return `/api/storage/objects/${folder}/${objectName}${suffix}`;
}

export class ObjectNotFoundError extends Error {
  constructor() {
    super("Object not found");
    this.name = "ObjectNotFoundError";
    Object.setPrototypeOf(this, ObjectNotFoundError.prototype);
  }
}

export type ObjectStorageErrorCode =
  | "STORAGE_PERMISSION_DENIED"
  | "STORAGE_NOT_FOUND"
  | "STORAGE_UNAVAILABLE";

/**
 * Error raised by the managed App Storage client.
 *
 * The SDK deliberately returns a Result for Google errors, so callers must
 * turn a failed result into an exception before it reaches an HTTP handler.
 * Keeping the public message separate from the provider message means the
 * dashboard gets a useful diagnosis without exposing bucket or identity
 * details from the provider response.
 */
export class ObjectStorageError extends Error {
  readonly code: ObjectStorageErrorCode;
  readonly statusCode?: number;
  readonly operation: string;
  readonly providerMessage: string;

  constructor(
    operation: string,
    code: ObjectStorageErrorCode,
    message: string,
    providerMessage: string,
    statusCode?: number,
  ) {
    super(message);
    this.name = "ObjectStorageError";
    this.code = code;
    this.statusCode = statusCode;
    this.operation = operation;
    this.providerMessage = providerMessage;
    Object.setPrototypeOf(this, ObjectStorageError.prototype);
  }
}

function providerStatusCode(error: unknown): number | undefined {
  if (!error || typeof error !== "object") return undefined;
  const candidate = error as { statusCode?: unknown; code?: unknown };
  if (typeof candidate.statusCode === "number") return candidate.statusCode;
  if (typeof candidate.code === "number") return candidate.code;
  if (typeof candidate.code === "string" && /^\d+$/.test(candidate.code)) {
    return Number(candidate.code);
  }
  return undefined;
}

function providerErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (error && typeof error === "object" && "message" in error) {
    const message = (error as { message?: unknown }).message;
    if (typeof message === "string") return message;
  }
  return "Unknown App Storage error";
}

function statusFromProviderMessage(message: string): number | undefined {
  const match = message.match(/(?:code|status(?:Code)?)["\s:=]+["']?([45]\d{2})/i);
  return match ? Number(match[1]) : undefined;
}

function toObjectStorageError(operation: string, error: unknown): ObjectStorageError {
  if (error instanceof ObjectStorageError) return error;

  const providerMessage = providerErrorMessage(error);
  const statusCode = providerStatusCode(error) ?? statusFromProviderMessage(providerMessage);
  if (statusCode === 403) {
    const action = operation === "upload" ? "écriture" : "lecture";
    return new ObjectStorageError(
      operation,
      "STORAGE_PERMISSION_DENIED",
      `App Storage a refusé la ${action} (${statusCode}). Vérifiez que le bucket géré est accessible à ce déploiement.`,
      providerMessage,
      statusCode,
    );
  }
  if (statusCode === 404) {
    return new ObjectStorageError(
      operation,
      "STORAGE_NOT_FOUND",
      "Le bucket App Storage géré est introuvable. Vérifiez la configuration du stockage de l’application.",
      providerMessage,
      statusCode,
    );
  }
  return new ObjectStorageError(
    operation,
    "STORAGE_UNAVAILABLE",
    `App Storage n’a pas pu ${operation === "upload" ? "enregistrer le fichier" : "lire le fichier"}. Vérifiez la configuration du stockage puis réessayez.`,
    providerMessage,
    statusCode,
  );
}

export class ObjectStorageService {
  constructor() {}

  getPublicObjectSearchPaths(): Array<string> {
    const pathsStr = process.env.PUBLIC_OBJECT_SEARCH_PATHS || "";
    const paths = Array.from(
      new Set(
        pathsStr
          .split(",")
          .map((path) => path.trim())
          .filter((path) => path.length > 0)
      )
    );
    if (paths.length === 0) {
      throw new Error(
        "PUBLIC_OBJECT_SEARCH_PATHS not set. Create a bucket in 'Object Storage' " +
          "tool and set PUBLIC_OBJECT_SEARCH_PATHS env var (comma-separated paths)."
      );
    }
    return paths;
  }

  getPrivateObjectDir(): string {
    // Replit supplies DEFAULT_OBJECT_STORAGE_ID for the app's managed bucket.
    // PRIVATE_OBJECT_DIR may still point to a subdirectory/bucket when an app
    // needs an explicit override.
    const dir = process.env.PRIVATE_OBJECT_DIR || process.env.DEFAULT_OBJECT_STORAGE_ID || "";
    if (!dir) {
      throw new Error(
        "No object storage bucket is configured. Create an App Storage bucket or set PRIVATE_OBJECT_DIR."
      );
    }
    return dir.startsWith("/") ? dir : `/${dir}`;
  }

  async searchPublicObject(filePath: string): Promise<File | null> {
    for (const searchPath of this.getPublicObjectSearchPaths()) {
      const fullPath = `${searchPath}/${filePath}`;

      const { bucketName, objectName } = parseObjectPath(fullPath);
      const bucket = objectStorageClient.bucket(bucketName);
      const file = bucket.file(objectName);

      const [exists] = await file.exists();
      if (exists) {
        return file;
      }
    }

    return null;
  }

  async downloadObject(
    file: File | ManagedObjectFile,
    cacheTtlSec: number = 3600,
    rangeHeader?: string,
  ): Promise<Response> {
    if ("objectName" in file) {
      let result;
      try {
        result = await managedObjectStorageClient.downloadAsBytes(file.objectName);
      } catch (error) {
        throw toObjectStorageError("read", error);
      }
      if (!result.ok) {
        if (result.error.statusCode === 404) throw new ObjectNotFoundError();
        throw toObjectStorageError("read", result.error);
      }

      const [buffer] = result.value;
      const size = buffer.length;
      let start = 0;
      let end = Math.max(size - 1, 0);
      let status = 200;

      if (rangeHeader && size > 0) {
        const parsed = parseByteRange(rangeHeader, size);
        if (!parsed) {
          return new Response(null, {
            status: 416,
            headers: { "Content-Range": `bytes */${size}`, "Accept-Ranges": "bytes" },
          });
        }
        start = parsed.start;
        end = parsed.end;
        status = 206;
      }

      const headers: Record<string, string> = {
        "Content-Type": detectContentType(buffer),
        "Cache-Control": `public, max-age=${cacheTtlSec}`,
        "Accept-Ranges": "bytes",
        "Content-Length": String(size ? end - start + 1 : 0),
      };
      if (status === 206) headers["Content-Range"] = `bytes ${start}-${end}/${size}`;

      return new Response(buffer.subarray(start, end + 1), { status, headers });
    }

    const [metadata] = await file.getMetadata();
    const size = Number(metadata.size ?? 0);
    let start: number | undefined;
    let end: number | undefined;
    let status = 200;

    if (rangeHeader && size > 0) {
      const parsed = parseByteRange(rangeHeader, size);
      if (!parsed) {
        return new Response(null, {
          status: 416,
          headers: { "Content-Range": `bytes */${size}`, "Accept-Ranges": "bytes" },
        });
      }
      start = parsed.start;
      end = parsed.end;
      status = 206;
    }

    const nodeStream = file.createReadStream(start === undefined ? undefined : { start, end });
    const webStream = Readable.toWeb(nodeStream) as ReadableStream;

    const headers: Record<string, string> = {
      "Content-Type": (metadata.contentType as string) || "application/octet-stream",
      "Cache-Control": `public, max-age=${cacheTtlSec}`,
      "Accept-Ranges": "bytes",
    };
    if (size) {
      headers["Content-Length"] = String(start === undefined ? size : end! - start + 1);
    }
    if (start !== undefined) {
      headers["Content-Range"] = `bytes ${start}-${end}/${size}`;
    }

    return new Response(webStream, { status, headers });
  }

  async getObjectEntityUploadURL(): Promise<string> {
    const privateObjectDir = this.getPrivateObjectDir();

    const objectId = randomUUID();
    const fullPath = `${privateObjectDir}/medias/${objectId}`;

    const { bucketName, objectName } = parseObjectPath(fullPath);

    return signObjectURL({
      bucketName,
      objectName,
      method: "PUT",
      ttlSec: 900,
    });
  }

  async getObjectEntityFile(objectPath: string): Promise<ManagedObjectFile> {
    if (!objectPath.startsWith("/objects/")) {
      throw new ObjectNotFoundError();
    }

    const parts = objectPath.slice(1).split("/");
    if (parts.length < 2) {
      throw new ObjectNotFoundError();
    }

    const entityId = parts.slice(1).join("/");
    let exists;
    try {
      exists = await managedObjectStorageClient.exists(entityId);
    } catch (error) {
      throw toObjectStorageError("read", error);
    }
    if (!exists.ok && exists.error.statusCode === 404) {
      throw new ObjectNotFoundError();
    }
    if (!exists.ok || !exists.value) {
      if (!exists.ok) throw toObjectStorageError("read", exists.error);
      throw new ObjectNotFoundError();
    }
    return { objectName: entityId };
  }

  /**
   * Upload a buffer directly to the bucket (server-side proxied upload).
   * Used for avatar uploads where we need server-enforced size/type checks.
   * Returns the /objects/... path that maps to the GET serving endpoint.
   */
  async uploadBuffer(
    buffer: Buffer,
    contentType: string,
    folder: MediaFolder = "images",
  ): Promise<string> {
    const objectId = randomUUID();
    const objectName = `${folder}/${objectId}`;
    let result;
    try {
      // The managed SDK resolves the writable App Storage bucket itself.
      // Its upload API intentionally has no metadata argument; playback
      // responses use the validated bytes to derive the MIME type instead.
      result = await managedObjectStorageClient.uploadFromBytes(objectName, buffer, {
        compress: false,
      });
    } catch (error) {
      throw toObjectStorageError("upload", error);
    }
    if (!result.ok) {
      throw toObjectStorageError("upload", result.error);
    }

    return `/objects/${objectName}`;
  }

  normalizeObjectEntityPath(rawPath: string): string {
    if (!rawPath.startsWith("https://storage.googleapis.com/")) {
      return rawPath;
    }

    const url = new URL(rawPath);
    const rawObjectPath = url.pathname;

    let objectEntityDir = this.getPrivateObjectDir();
    if (!objectEntityDir.endsWith("/")) {
      objectEntityDir = `${objectEntityDir}/`;
    }

    if (!rawObjectPath.startsWith(objectEntityDir)) {
      return rawObjectPath;
    }

    const entityId = rawObjectPath.slice(objectEntityDir.length);
    return `/objects/${entityId}`;
  }

}

function detectContentType(buffer: Buffer): string {
  if (buffer.length >= 8 && buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) {
    return "image/png";
  }
  if (buffer.length >= 3 && buffer.subarray(0, 3).equals(Buffer.from([0xff, 0xd8, 0xff]))) {
    return "image/jpeg";
  }
  if (buffer.length >= 6 && ["GIF87a", "GIF89a"].includes(buffer.subarray(0, 6).toString("ascii"))) {
    return "image/gif";
  }
  if (buffer.length >= 12 && buffer.subarray(0, 4).toString("ascii") === "RIFF" && buffer.subarray(8, 12).toString("ascii") === "WEBP") {
    return "image/webp";
  }
  if (buffer.length >= 12 && buffer.subarray(4, 8).toString("ascii") === "ftyp") return "video/mp4";
  if (buffer.length >= 4 && buffer.subarray(0, 4).equals(Buffer.from([0x1a, 0x45, 0xdf, 0xa3]))) return "video/webm";
  const textPrefix = buffer.subarray(0, 256).toString("utf8").trimStart();
  if (textPrefix.startsWith("<svg") || textPrefix.startsWith("<?xml")) return "image/svg+xml";
  return "application/octet-stream";
}

function parseObjectPath(path: string): {
  bucketName: string;
  objectName: string;
} {
  if (!path.startsWith("/")) {
    path = `/${path}`;
  }
  const pathParts = path.split("/");
  if (pathParts.length < 3) {
    throw new Error("Invalid path: must contain at least a bucket name");
  }

  const bucketName = pathParts[1];
  const objectName = pathParts.slice(2).join("/");

  return {
    bucketName,
    objectName,
  };
}

async function signObjectURL({
  bucketName,
  objectName,
  method,
  ttlSec,
}: {
  bucketName: string;
  objectName: string;
  method: "GET" | "PUT" | "DELETE" | "HEAD";
  ttlSec: number;
}): Promise<string> {
  const request = {
    bucket_name: bucketName,
    object_name: objectName,
    method,
    expires_at: new Date(Date.now() + ttlSec * 1000).toISOString(),
  };
  const response = await fetch(
    `${REPLIT_SIDECAR_ENDPOINT}/object-storage/signed-object-url`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(request),
      signal: AbortSignal.timeout(30_000),
    }
  );
  if (!response.ok) {
    throw new Error(
      `Failed to sign object URL, errorcode: ${response.status}, ` +
        `make sure you're running on Replit`
    );
  }

  const { signed_url: signedURL } = (await response.json()) as { signed_url: string };
  return signedURL;
}
