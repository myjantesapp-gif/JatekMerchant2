/**
 * Upload helpers for the Jatek mobile app.
 *
 * - uploadImage()  — restaurant/menu images (admin/owner only, server-validated)
 * - uploadAvatar() — user avatars (any authenticated user, server-side proxied)
 */
import { getApiBaseSafe } from "./apiBase";
import { handleUnauthorizedResponse } from "./api";

// ─── Restaurant/menu image upload (server-validated, restricted roles) ─────────

const ALLOWED_IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);

/**
 * Upload a restaurant or menu image.
 * Requires admin, manager, or restaurant_owner role.
 * Max 5 MB. Sends raw image bytes so the API can validate the real content.
 */
export async function uploadImage(
  uri: string,
  mimeType: string,
  token: string
): Promise<string> {
  const apiBase = getApiBaseSafe();
  if (!ALLOWED_IMAGE_TYPES.has(mimeType)) {
    throw new Error("Format non pris en charge. Choisissez une image JPEG, PNG, WebP ou GIF.");
  }

  const fileRes = await fetch(uri);
  if (!fileRes.ok) throw new Error("Impossible de lire le fichier sélectionné.");
  const blob = await fileRes.blob();

  if (blob.size > 5 * 1024 * 1024) throw new Error("Image trop grande. Maximum 5 Mo.");

  const uploadRes = await fetch(`${apiBase}/api/storage/uploads/image`, {
    method: "POST",
    headers: { "Content-Type": mimeType, Authorization: `Bearer ${token}` },
    body: blob,
  });

  if (!uploadRes.ok) {
    handleUnauthorizedResponse(uploadRes.status, token);
    let msg = `Erreur ${uploadRes.status}`;
    try { const err = await uploadRes.json(); msg = err?.error ?? msg; } catch (_) {}
    throw new Error(msg);
  }

  const { url } = await uploadRes.json() as { url: string };
  return url.startsWith("http") ? url : `${apiBase}${url}`;
}

// ─── Avatar upload (server-side proxied, any authenticated user) ───────────────

/**
 * Upload a user avatar image.
 * Any authenticated user may call this.
 * The file is sent as raw binary to the API, which validates and stores it server-side.
 * Max 2 MB enforced server-side.
 */
export async function uploadAvatar(
  uri: string,
  mimeType: string,
  token: string
): Promise<string> {
  const apiBase = getApiBaseSafe();

  // Read the local file as binary
  const fileRes = await fetch(uri);
  if (!fileRes.ok) throw new Error("Impossible de lire le fichier sélectionné.");
  const blob = await fileRes.blob();

  if (blob.size > 2 * 1024 * 1024) throw new Error("Image trop grande. Maximum 2 Mo pour un avatar.");

  // POST raw binary — server validates size, magic bytes, and content-type
  const uploadRes = await fetch(`${apiBase}/api/storage/uploads/avatar`, {
    method: "POST",
    headers: {
      "Content-Type": mimeType,
      Authorization: `Bearer ${token}`,
    },
    body: blob,
  });

  if (!uploadRes.ok) {
    handleUnauthorizedResponse(uploadRes.status, token);
    let msg = `Erreur ${uploadRes.status}`;
    try { const err = await uploadRes.json(); msg = err?.error ?? msg; } catch (_) {}
    throw new Error(msg);
  }

  const { url } = await uploadRes.json() as { url: string };
  // url is a server-relative path (e.g. /api/storage/objects/...) — must be absolute for React Native Image
  return url.startsWith("http") ? url : `${apiBase}${url}`;
}
