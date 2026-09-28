import { z } from 'zod';

/** Sole business-data host (explicit user requirement). Never derived from env. */
export const API_BASE_URL = 'https://api.jatek.app';

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

/**
 * Builds an absolute URL on the fixed host. The normalized result must keep the
 * exact origin and a pathname under /api/ (defeats dot/backslash/encoded traversal).
 */
export function buildApiUrl(path: string): string {
  if (typeof path !== 'string' || !path || /[\u0000-\u001f\\]/.test(path)) throw new Error('Chemin d\'API invalide.');
  let u: URL;
  try { u = new URL(path, API_BASE_URL); } catch { throw new Error('Chemin d\'API invalide.'); }
  if (u.origin !== API_BASE_URL) throw new Error(`Hôte non autorisé : ${u.origin}`);
  if (u.username || u.password || u.hash || path.includes('#')) throw new Error('URL d\'API non autorisée.');
  if (!u.pathname.startsWith('/api/')) throw new Error(`Chemin d'API invalide : ${u.pathname}`);
  return u.toString();
}

export type FetchLike = (url: string, init?: RequestInit) => Promise<Response>;

export interface RequestOptions {
  method?: 'GET' | 'POST' | 'PATCH';
  body?: unknown;
  token?: string | null;
  signal?: AbortSignal;
}

export function frenchMessage(status: number, serverMsg?: string): string {
  if (status === 401) return 'Session expirée ou identifiants invalides.';
  if (status === 403) return serverMsg === 'This account does not have backend access'
    ? "Ce compte n'a pas accès à l'espace marchand."
    : serverMsg === 'Account disabled' ? 'Ce compte est désactivé.' : 'Accès refusé.';
  if (status === 404) return 'Élément introuvable.';
  if (status === 412 && serverMsg?.includes('Complete your business profile')) {
    return 'Complétez le profil légal de votre boutique avant d’accepter une commande.';
  }
  if (status >= 500) return 'Le serveur Jatek rencontre un problème. Réessayez.';
  return serverMsg || `Erreur ${status}`;
}

export async function requestJson(fetchImpl: FetchLike, path: string, opts: RequestOptions = {}): Promise<unknown> {
  const headers: Record<string, string> = { Accept: 'application/json' };
  if (opts.body !== undefined) headers['Content-Type'] = 'application/json';
  if (opts.token) headers.Authorization = `Bearer ${opts.token}`;
  let res: Response;
  try {
    res = await fetchImpl(buildApiUrl(path), {
      method: opts.method ?? 'GET',
      headers,
      body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
      signal: opts.signal,
      redirect: 'error',
    });
  } catch (e) {
    if ((e as Error)?.name === 'AbortError') throw e;
    throw new ApiError(0, 'Connexion impossible à api.jatek.app. Vérifiez votre réseau.');
  }
  const text = await res.text();
  let data: unknown = null;
  if (text) {
    try { data = JSON.parse(text); } catch {
      throw new ApiError(res.status, res.ok ? 'Réponse du serveur illisible.' : frenchMessage(res.status));
    }
  }
  if (!res.ok) {
    const msg = data && typeof data === 'object' && 'error' in data ? String((data as { error: unknown }).error) : undefined;
    throw new ApiError(res.status, frenchMessage(res.status, msg));
  }
  return data;
}

export function parseWith<T>(schema: z.ZodType<T>, data: unknown, label: string): T {
  const r = schema.safeParse(data);
  if (!r.success) throw new ApiError(-1, `Réponse inattendue du serveur (${label}).`);
  return r.data;
}

const num = z.coerce.number();
const optStr = z.string().nullish();

export const userSchema = z.object({
  id: z.number(),
  email: z.string(),
  name: z.string().nullish(),
  role: z.string(),
}).passthrough();

export const loginSchema = z.object({ token: z.string().min(1), user: userSchema });
export const meSchema = z.object({
  user: userSchema,
  permissions: z.array(z.string()).nullish().transform((v) => v ?? []),
  scopedShopIds: z.array(z.number()).nullish().transform((v) => v ?? []),
}).passthrough();

export const shopSchema = z.object({
  id: z.number(),
  name: z.string(),
  address: optStr,
  phone: optStr,
  category: optStr,
  businessType: optStr,
  logoUrl: optStr,
  isOpen: z.boolean().nullish(),
  isActive: z.boolean().nullish(),
  rating: num.nullish(),
}).passthrough();

export const orderSchema = z.object({
  id: z.number(),
  reference: optStr,
  restaurantId: z.number().nullish(),
  restaurantName: optStr,
  userName: optStr,
  status: z.string(),
  subtotal: num.nullish(),
  deliveryFee: num.nullish(),
  discountAmount: num.nullish(),
  serviceFee: num.nullish(),
  vatAmount: num.nullish(),
  total: num,
  currency: optStr,
  deliveryAddress: optStr,
  deliveryType: optStr,
  notes: optStr,
  kitchenCode: optStr,
  createdAt: optStr,
}).passthrough();

export const orderItemSchema = z.object({
  id: z.number(),
  menuItemName: z.string(),
  quantity: num,
  unitPrice: num,
  totalPrice: num,
  selectedSize: optStr,
  selectedExtras: optStr,
}).passthrough();

export const orderDetailSchema = orderSchema.extend({ items: z.array(orderItemSchema) });

export type MerchantUser = z.infer<typeof userSchema>;
export type Shop = z.infer<typeof shopSchema>;
export type Order = z.infer<typeof orderSchema>;
export type OrderDetail = z.infer<typeof orderDetailSchema>;
export type Me = z.infer<typeof meSchema>;

export const shopsSchema = z.array(shopSchema);
export const ordersSchema = z.array(orderSchema);
