import express, { Router, type IRouter, type Response } from "express";
import { Readable } from "stream";
import {
  ObjectStorageService,
  ObjectNotFoundError,
  ObjectStorageError,
  getMediaFolder,
  type MediaKind,
} from "../lib/objectStorage";
import { requireRole, requireAuth, type AuthedRequest } from "../middlewares/auth";

const router: IRouter = Router();
const objectStorageService = new ObjectStorageService();

const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;
const MAX_VIDEO_UPLOAD_BYTES = 50 * 1024 * 1024;
const ALLOWED_IMAGE_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
]);
const ALLOWED_VIDEO_TYPES = new Set([
  "video/mp4",
  "video/webm",
  "video/quicktime",
  "video/3gpp",
  "video/x-m4v",
]);

/**
 * POST /storage/uploads/avatar
 *
 * Server-side proxied avatar upload for any authenticated user.
 * The client sends the raw image binary as the request body (Content-Type: image/*).
 * The server enforces:
 *   - 2 MB hard limit (enforced by express.raw middleware, not client-reported)
 *   - Allowed image MIME types checked against both the header and magic bytes
 * The image is written directly to the bucket — no presigned URL is issued.
 */
const MAGIC_BYTES: Record<string, number[][]> = {
  "image/jpeg": [[0xff, 0xd8, 0xff]],
  "image/png": [[0x89, 0x50, 0x4e, 0x47]],
  "image/webp": [[0x52, 0x49, 0x46, 0x46]], // RIFF header; bytes 8-11 are WEBP
  "image/gif": [[0x47, 0x49, 0x46, 0x38]],
};

const MAX_AVATAR_BYTES = 2 * 1024 * 1024;

function detectMimeFromMagic(buf: Buffer): string | null {
  if (buf.length < 12) return null;
  if (MAGIC_BYTES["image/jpeg"].some((pattern) => pattern.every((b, i) => buf[i] === b))) return "image/jpeg";
  if (MAGIC_BYTES["image/png"].some((pattern) => pattern.every((b, i) => buf[i] === b))) return "image/png";
  if (MAGIC_BYTES["image/gif"].some((pattern) => pattern.every((b, i) => buf[i] === b))) return "image/gif";
  if (
    MAGIC_BYTES["image/webp"].some((pattern) => pattern.every((b, i) => buf[i] === b)) &&
    buf.subarray(8, 12).toString("ascii") === "WEBP"
  ) return "image/webp";
  return null;
}

function detectVideoMimeFromMagic(buf: Buffer): string | null {
  // ISO Base Media files (MP4/MOV) declare the file type at bytes 4–11.
  if (buf.length >= 12 && buf.subarray(4, 8).toString("ascii") === "ftyp") {
    const brand = buf.subarray(8, 12).toString("ascii");
    if (brand === "qt  ") return "video/quicktime";
    if (brand.startsWith("3gp") || brand.startsWith("3g2")) return "video/3gpp";
    if (brand.startsWith("M4V")) return "video/x-m4v";
    return "video/mp4";
  }
  // WebM is an EBML container and must include its document type in the header.
  if (
    buf.length >= 64 &&
    buf[0] === 0x1a && buf[1] === 0x45 && buf[2] === 0xdf && buf[3] === 0xa3 &&
    buf.subarray(0, Math.min(buf.length, 256)).includes(Buffer.from("webm"))
  ) return "video/webm";
  return null;
}

function canContainImage(req: { headers: { "content-type"?: string | string[] } }): boolean {
  const contentType = getContentType(req.headers);
  // File inputs and camera capture on Android can report a generic MIME type,
  // or a MIME type that disagrees with the actual bytes (for example a PNG
  // whose filename ends in .jpg). The magic-byte check below is authoritative.
  return contentType === "" || contentType === "application/octet-stream" || contentType.startsWith("image/");
}

function getDeclaredVideoMime(req: express.Request): string | null {
  const contentType = (req.headers["content-type"] ?? "").split(";")[0].trim().toLowerCase();
  return ALLOWED_VIDEO_TYPES.has(contentType) ? contentType : null;
}

function getContentType(headers: { "content-type"?: string | string[] }): string {
  const header = headers["content-type"];
  return (Array.isArray(header) ? header[0] : header ?? "").split(";")[0].trim().toLowerCase();
}

function canContainVideo(req: { headers: { "content-type"?: string | string[] } }): boolean {
  const contentType = getContentType(req.headers);
  // Mobile/browser file pickers may omit the MIME type or use the generic
  // binary type. We still validate the actual container below.
  return contentType === "" || contentType === "application/octet-stream" || contentType.startsWith("video/");
}

function getMediaKind(req: express.Request, fallback: MediaKind): MediaKind {
  const requested = req.headers["x-jatek-media-kind"];
  const value = (Array.isArray(requested) ? requested[0] : requested)?.trim().toLowerCase();
  if (value === "image" || value === "logo" || value === "banner" || value === "media" || value === "short") {
    return value;
  }
  return fallback;
}

function sendUploadStorageError(
  req: AuthedRequest,
  res: Response,
  mediaLabel: "image" | "video" | "avatar",
  error: unknown,
): void {
  if (error instanceof ObjectStorageError) {
    req.log.error({
      err: error,
      storageCode: error.code,
      storageStatus: error.statusCode,
      storageOperation: error.operation,
      providerMessage: error.providerMessage,
    }, `Error uploading ${mediaLabel}`);
    res.status(500).json({
      error: `Échec du téléversement de ${mediaLabel} : ${error.message}`,
      code: error.code,
      cause: error.message,
      operation: error.operation,
    });
    return;
  }

  req.log.error({ err: error }, `Error uploading ${mediaLabel}`);
  res.status(500).json({
    error: `Échec du téléversement de ${mediaLabel}. Le serveur n’a pas pu enregistrer le fichier.`,
    code: "STORAGE_UNAVAILABLE",
    cause: "Le stockage de l’application est indisponible.",
    operation: "upload",
  });
}

/**
 * POST /storage/uploads/image
 *
 * Admin/owner image upload with server-enforced body limit and content sniffing.
 * Unlike a signed PUT, invalid file bytes never become publicly served objects.
 */
router.post(
  "/storage/uploads/image",
  requireRole("admin", "super_admin", "manager", "restaurant_owner"),
  (req, res, next) => {
    if (!canContainImage(req)) {
      (res as Response).status(415).json({ error: "Unsupported Media Type. Send a JPEG, PNG, WebP, or GIF image." });
      return;
    }
    express.raw({ type: (request) => canContainImage(request), limit: MAX_UPLOAD_BYTES })(req, res, next);
  },
  async (req: AuthedRequest, res: Response) => {
    const body = req.body as Buffer | undefined;
    if (!Buffer.isBuffer(body) || body.length === 0) {
      res.status(400).json({ error: "Request body must be a non-empty image binary." });
      return;
    }

    const detectedMime = detectMimeFromMagic(body);
    if (!detectedMime) {
      res.status(400).json({ error: "The file content is not a supported JPEG, PNG, WebP, or GIF image." });
      return;
    }

    try {
      const objectPath = await objectStorageService.uploadBuffer(
        body,
        detectedMime,
        getMediaFolder(getMediaKind(req, "image")),
      );
      const pathPart = objectPath.replace(/^\/objects/, "");
      res.status(201).json({ url: `/api/storage/objects${pathPart}`, contentType: detectedMime });
    } catch (error) {
      sendUploadStorageError(req, res, "image", error);
    }
  },
);

/**
 * POST /storage/uploads/video
 *
 * Admin video uploads used by Shorts. Video bytes are kept in the same
 * authenticated object store as images and are validated before storage.
 */
router.post(
  "/storage/uploads/video",
  requireRole("admin", "super_admin", "manager", "restaurant_owner"),
  (req, res, next) => {
    if (!canContainVideo(req)) {
      (res as Response).status(415).json({ error: "Unsupported Media Type. Send an MP4, WebM, or MOV video." });
      return;
    }
    express.raw({
      type: (request) => canContainVideo(request),
      limit: MAX_VIDEO_UPLOAD_BYTES,
    })(req, res, next);
  },
  async (req: AuthedRequest, res: Response) => {
    const body = req.body as Buffer | undefined;
    const declaredMime = getDeclaredVideoMime(req);
    if (!Buffer.isBuffer(body) || body.length === 0) {
      res.status(400).json({ error: "Request body must be a non-empty video binary." });
      return;
    }

    const detectedMime = detectVideoMimeFromMagic(body);
    if (!detectedMime || (declaredMime && detectedMime !== declaredMime)) {
      res.status(400).json({ error: "The file content does not match the declared video type." });
      return;
    }

    try {
      const objectPath = await objectStorageService.uploadBuffer(
        body,
        detectedMime,
        getMediaFolder(getMediaKind(req, "short")),
      );
      const pathPart = objectPath.replace(/^\/objects/, "");
      res.status(201).json({ url: `/api/storage/objects${pathPart}`, contentType: detectedMime });
    } catch (error) {
      sendUploadStorageError(req, res, "video", error);
    }
  },
);

router.post(
  "/storage/uploads/avatar",
  requireAuth,
  // Parse raw binary body; express enforces the size limit here (not client-reported)
  (req, res, next) => {
    if (!canContainImage(req)) {
      (res as Response).status(415).json({ error: "Unsupported Media Type. Send an image/jpeg, image/png, image/webp, or image/gif body." });
      return;
    }
    express.raw({ type: (request) => canContainImage(request), limit: MAX_AVATAR_BYTES })(req, res, next);
  },
  async (req: AuthedRequest, res: Response) => {
    const body = req.body as Buffer | undefined;
    if (!Buffer.isBuffer(body) || body.length === 0) {
      res.status(400).json({ error: "Request body must be a non-empty image binary." });
      return;
    }

    // Server-side magic-byte validation — ignore client-reported content-type for actual check
    const detectedMime = detectMimeFromMagic(body);
    if (!detectedMime) {
      res.status(400).json({ error: "File does not appear to be a supported image (magic-byte check failed)." });
      return;
    }

    try {
      const objectPath = await objectStorageService.uploadBuffer(body, detectedMime, getMediaFolder("image"));
      const pathPart = objectPath.replace(/^\/objects/, "");
      const servedUrl = `/api/storage/objects${pathPart}`;
      res.status(201).json({ url: servedUrl, contentType: detectedMime });
    } catch (error) {
      sendUploadStorageError(req, res, "avatar", error);
    }
  },
);

/**
 * GET /storage/public-objects/*
 *
 * Serve public assets from PUBLIC_OBJECT_SEARCH_PATHS.
 * These are unconditionally public — no authentication checks.
 */
router.get("/storage/public-objects/*filePath", async (req: AuthedRequest, res: Response) => {
  try {
    const raw = req.params.filePath;
    const filePath = Array.isArray(raw) ? raw.join("/") : raw;
    const file = await objectStorageService.searchPublicObject(filePath);
    if (!file) {
      res.status(404).json({ error: "File not found" });
      return;
    }

    const response = await objectStorageService.downloadObject(file);

    res.status(response.status);
    response.headers.forEach((value, key) => res.setHeader(key, value));

    if (response.body) {
      const nodeStream = Readable.fromWeb(response.body as ReadableStream<Uint8Array>);
      nodeStream.pipe(res);
    } else {
      res.end();
    }
  } catch (error) {
    req.log.error({ err: error }, "Error serving public object");
    res.status(500).json({ error: "Failed to serve public object" });
  }
});

/**
 * GET /storage/objects/*
 *
 * Serve uploaded restaurant/menu images from PRIVATE_OBJECT_DIR. Reads are
 * open so customers can view restaurant/menu images without authentication;
 * writes are gated by the upload endpoint above.
 */
router.get("/storage/objects/*path", async (req: AuthedRequest, res: Response) => {
  try {
    const raw = req.params.path;
    const wildcardPath = Array.isArray(raw) ? raw.join("/") : raw;
    const objectPath = `/objects/${wildcardPath}`;
    const objectFile = await objectStorageService.getObjectEntityFile(objectPath);

    const range = typeof req.headers.range === "string" ? req.headers.range : undefined;
    const response = await objectStorageService.downloadObject(objectFile, 3600, range);

    res.status(response.status);
    response.headers.forEach((value, key) => res.setHeader(key, value));

    if (response.body) {
      const nodeStream = Readable.fromWeb(response.body as ReadableStream<Uint8Array>);
      nodeStream.pipe(res);
    } else {
      res.end();
    }
  } catch (error) {
    if (error instanceof ObjectNotFoundError) {
      req.log.warn({ err: error }, "Object not found");
      res.status(404).json({ error: "Object not found" });
      return;
    }
    req.log.error({ err: error }, "Error serving object");
    res.status(500).json({ error: "Failed to serve object" });
  }
});

export default router;
