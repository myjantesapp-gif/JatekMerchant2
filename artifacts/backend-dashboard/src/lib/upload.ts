import { apiFetch } from "@/lib/api";

export const MAX_IMAGE_UPLOAD_BYTES = 5 * 1024 * 1024;
export const MAX_VIDEO_UPLOAD_BYTES = 50 * 1024 * 1024;
const ALLOWED_IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);
const IMAGE_EXTENSIONS = new Set(["jpg", "jpeg", "png", "webp", "gif"]);
const ALLOWED_VIDEO_TYPES = new Set([
  "video/mp4",
  "video/webm",
  "video/quicktime",
  "video/3gpp",
  "video/x-m4v",
]);
const VIDEO_EXTENSIONS = new Set(["mp4", "webm", "mov", "m4v", "3gp", "3g2"]);

interface ImageUploadResponse {
  url: string;
  contentType: string;
}

export type MediaUploadKind = "image" | "logo" | "banner" | "media" | "short" | "splash";

export function validateImageFile(file: File): string | null {
  const extension = file.name.split(".").pop()?.toLowerCase();
  // Android camera/file pickers can omit the MIME type or report a generic
  // one. The API validates the actual bytes, so do not reject those locally.
  if (!ALLOWED_IMAGE_TYPES.has(file.type) && file.type !== "" && file.type !== "application/octet-stream" && !IMAGE_EXTENSIONS.has(extension ?? "")) {
    return "Format non pris en charge. Choisissez une image JPEG, PNG, WebP ou GIF.";
  }
  if (file.size === 0) {
    return "Le fichier image est vide.";
  }
  if (file.size > MAX_IMAGE_UPLOAD_BYTES) {
    return "L’image est trop volumineuse. La taille maximale est de 5 Mo.";
  }
  return null;
}

export function validateVideoFile(file: File): string | null {
  const extension = file.name.split(".").pop()?.toLowerCase();
  // Some mobile file pickers provide an empty or generic MIME type even for
  // valid videos. The API performs the authoritative magic-byte validation.
  if (!ALLOWED_VIDEO_TYPES.has(file.type) && !(file.type === "" || file.type === "application/octet-stream") && !VIDEO_EXTENSIONS.has(extension ?? "")) {
    return "Format non pris en charge. Choisissez une vidéo MP4, WebM ou MOV.";
  }
  if (file.size === 0) {
    return "Le fichier vidéo est vide.";
  }
  if (file.size > MAX_VIDEO_UPLOAD_BYTES) {
    return "La vidéo est trop volumineuse. La taille maximale est de 50 Mo.";
  }
  return null;
}

/**
 * Uploads an image file through the API so the server can verify its actual bytes
 * before making it available to the applications.
 * Returns the serving URL for storage in the DB.
 */
export async function uploadImage(file: File, kind: MediaUploadKind = "image"): Promise<string> {
  const validationError = validateImageFile(file);
  if (validationError) throw new Error(validationError);

  const result = await apiFetch<ImageUploadResponse>("/api/storage/uploads/image", {
    method: "POST",
    body: file,
    headers: { "Content-Type": file.type || "application/octet-stream", "X-Jatek-Media-Kind": kind },
  });
  return result.url;
}

/** Uploads a Short video through the API, which validates its real file bytes. */
export async function uploadVideo(file: File, kind: MediaUploadKind = "short"): Promise<string> {
  const validationError = validateVideoFile(file);
  if (validationError) throw new Error(validationError);

  const result = await apiFetch<ImageUploadResponse>("/api/storage/uploads/video", {
    method: "POST",
    body: file,
    headers: { "Content-Type": file.type || "application/octet-stream", "X-Jatek-Media-Kind": kind },
  });
  return result.url;
}
