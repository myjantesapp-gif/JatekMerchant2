import { API_BASE_URL, ApiError, buildApiUrl, frenchMessage } from '@/lib/api-core';
import { getSessionToken, notifyUnauthorized } from '@/lib/query-client';

export type MerchantMediaKind = 'image' | 'logo' | 'banner';
const MIME_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif']);
const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;

export async function uploadMerchantImage(uri: string, mimeType = 'image/jpeg', kind: MerchantMediaKind = 'image', token = getSessionToken()): Promise<string> {
  if (!token) throw new ApiError(401, 'Session absente.');
  if (!MIME_TYPES.has(mimeType)) throw new ApiError(415, 'Format non supporté. Utilisez JPEG, PNG, WebP ou GIF.');
  const source = await fetch(uri);
  if (!source.ok) throw new ApiError(source.status, 'Impossible de lire l’image sélectionnée.');
  const blob = await source.blob();
  if (blob.size === 0 || blob.size > MAX_UPLOAD_BYTES) throw new ApiError(400, 'L’image doit peser au maximum 5 Mo.');
  let response: Response;
  try {
    response = await fetch(buildApiUrl('/api/storage/uploads/image'), {
      method: 'POST',
      headers: { Accept: 'application/json', 'Content-Type': mimeType, Authorization: `Bearer ${token}`, 'X-Jatek-Media-Kind': kind },
      body: blob,
      redirect: 'error',
    });
  } catch {
    throw new ApiError(0, 'Connexion impossible à api.jatek.app. Vérifiez votre réseau.');
  }
  const text = await response.text();
  let data: unknown = null;
  try { data = text ? JSON.parse(text) : null; } catch { throw new ApiError(response.status, 'Réponse du serveur illisible.'); }
  if (!response.ok) {
    if (response.status === 401) notifyUnauthorized(token);
    const message = data && typeof data === 'object' && 'error' in data ? String((data as { error: unknown }).error) : undefined;
    throw new ApiError(response.status, frenchMessage(response.status, message));
  }
  const url = data && typeof data === 'object' && typeof (data as { url?: unknown }).url === 'string' ? (data as { url: string }).url : null;
  if (!url) throw new ApiError(-1, 'Réponse inattendue du serveur (image).');
  return url.startsWith('/') ? `${API_BASE_URL}${url}` : url;
}