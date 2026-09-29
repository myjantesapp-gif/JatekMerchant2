import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { z } from 'zod';
import { ApiError, parseWith } from '@/lib/api-core';
import { apiRequest, sessionKey } from '@/lib/query-client';
import { useAuth } from '@/lib/auth';

const nullableString = z.string().nullish();
const nullableNumber = z.coerce.number().nullish();

export const dashboardSchema = z.object({
  inProgressOrders: z.coerce.number(),
  cancelledOrders: z.coerce.number(),
  deliveredOrders: z.coerce.number(),
  outOfStockProducts: z.coerce.number(),
  totalProducts: z.coerce.number(),
  orderReviews: z.coerce.number(),
  totalEarned: z.coerce.number(),
  deliveryEarning: z.coerce.number(),
  totalOrderTax: z.coerce.number(),
  totalCommission: z.coerce.number(),
  merchantEarning: z.coerce.number(),
  jatekEarning: z.coerce.number(),
  ordersChart: z.array(z.object({ label: z.string(), value: z.coerce.number() }).passthrough()),
}).passthrough();

export const todoSchema = z.object({
  id: z.coerce.number(),
  userId: z.coerce.number(),
  text: z.string(),
  done: z.boolean(),
  createdAt: nullableString,
}).passthrough();

export const productSchema = z.object({
  id: z.coerce.number(),
  restaurantId: z.coerce.number(),
  name: z.string(),
  description: nullableString,
  price: z.coerce.number(),
  compareAtPrice: nullableNumber,
  imageUrl: nullableString,
  category: nullableString,
  menuItemCategoryId: z.coerce.number().nullish(),
  sortOrder: z.coerce.number().nullish(),
  isAvailable: z.boolean(),
  isPopular: z.boolean().nullish(),
  createdAt: nullableString,
}).passthrough();

export const productsPageSchema = z.object({
  items: z.array(productSchema),
  total: z.coerce.number(),
  page: z.coerce.number(),
  pageSize: z.coerce.number(),
  totalPages: z.coerce.number(),
}).passthrough();

export const menuCategorySchema = z.object({
  id: z.coerce.number(),
  restaurantId: z.coerce.number().nullish(),
  name: z.string(),
  sortOrder: z.coerce.number().nullish(),
  isActive: z.boolean().nullish(),
  createdAt: nullableString,
  productCount: z.coerce.number().nullish(),
}).passthrough();

export const reviewSchema = z.object({
  id: z.coerce.number(),
  userId: z.coerce.number().nullish(),
  restaurantId: z.coerce.number().nullish(),
  orderId: z.coerce.number().nullish(),
  userName: nullableString,
  rating: z.coerce.number().nullish(),
  comment: nullableString,
  createdAt: nullableString,
}).passthrough();

export const merchantShopSchema = z.object({
  id: z.coerce.number(),
  name: z.string(),
  description: nullableString,
  address: nullableString,
  phone: nullableString,
  category: nullableString,
  businessType: nullableString,
  deliveryTime: nullableNumber,
  deliveryFee: nullableNumber,
  minimumOrder: nullableNumber,
  isOpen: z.boolean().nullish(),
  imageUrl: nullableString,
  coverImageUrl: nullableString,
  logoUrl: nullableString,
  rating: nullableNumber,
  reviewCount: nullableNumber,
}).passthrough();

export const todosSchema = z.array(todoSchema);
export const productsSchema = z.array(productSchema);
export const categoriesSchema = z.array(menuCategorySchema);
export const reviewsSchema = z.array(reviewSchema);
export const shopsProfileSchema = z.array(merchantShopSchema);
export const merchantShopHoursSchema = z.array(z.object({
  id: z.coerce.number(),
  restaurantId: z.coerce.number(),
  dayOfWeek: z.coerce.number().int().min(0).max(6),
  openTime: z.string(),
  closeTime: z.string(),
  isClosed: z.boolean(),
}).passthrough());

export type Dashboard = z.infer<typeof dashboardSchema>;
export type DashboardTodo = z.infer<typeof todoSchema>;
export type MerchantProduct = z.infer<typeof productSchema>;
export type MerchantProductsPage = z.infer<typeof productsPageSchema>;
export type MenuCategory = z.infer<typeof menuCategorySchema>;
export type MerchantReview = z.infer<typeof reviewSchema>;
export type MerchantShop = z.infer<typeof merchantShopSchema>;
export type MerchantShopHours = z.infer<typeof merchantShopHoursSchema>;

const key = (path: string, token: string | null) => sessionKey(path, token);
function invalidatePrefix(client: ReturnType<typeof useQueryClient>, prefix: string, token: string | null) {
  return client.invalidateQueries({
    predicate: (query) => {
      const queryKey = query.queryKey as unknown as [unknown, { session?: string | null }?];
      return typeof queryKey[0] === 'string'
        && queryKey[0].startsWith(prefix)
        && queryKey[1]?.session === token;
    },
  });
}
function requireToken(token: string | null): string {
  if (!token) throw new ApiError(401, 'Session absente.');
  return token;
}

export function useMerchantDashboard() {
  const { token } = useAuth();
  return useQuery({
    queryKey: key('/api/backend/dashboard?range=week', token),
    enabled: !!token,
    select: (d: unknown) => parseWith(dashboardSchema, d, 'tableau de bord'),
  });
}

export function useMerchantTodos() {
  const { token } = useAuth();
  return useQuery({
    queryKey: key('/api/backend/todos', token),
    enabled: !!token,
    select: (d: unknown) => parseWith(todosSchema, d, 'rappels'),
  });
}

export function useCreateMerchantTodo() {
  const { token } = useAuth(); const client = useQueryClient();
  return useMutation({
    mutationFn: ({ text }: { text: string }) => apiRequest('/api/backend/todos', { method: 'POST', body: { text }, token: requireToken(token) }).then((d) => parseWith(todoSchema, d, 'rappel')),
    onSuccess: () => client.invalidateQueries({ queryKey: key('/api/backend/todos', token) }),
  });
}

export function useToggleMerchantTodo() {
  const { token } = useAuth(); const client = useQueryClient();
  return useMutation({
    mutationFn: ({ id, done }: { id: number; done: boolean }) => apiRequest(`/api/backend/todos/${id}`, { method: 'PATCH', body: { done }, token: requireToken(token) }).then((d) => parseWith(todoSchema, d, 'rappel')),
    onSuccess: () => client.invalidateQueries({ queryKey: key('/api/backend/todos', token) }),
  });
}

export function useDeleteMerchantTodo() {
  const { token } = useAuth(); const client = useQueryClient();
  return useMutation({
    mutationFn: ({ id }: { id: number }) => apiRequest(`/api/backend/todos/${id}`, { method: 'DELETE', token: requireToken(token) }),
    onSuccess: () => client.invalidateQueries({ queryKey: key('/api/backend/todos', token) }),
  });
}

export function useMerchantProducts(params: { search?: string; category?: string; page?: number; pageSize?: number } = {}) {
  const { token } = useAuth();
  const query = new URLSearchParams();
  if (params.search) query.set('search', params.search);
  if (params.category) query.set('category', params.category);
  query.set('page', String(params.page ?? 1)); query.set('pageSize', String(params.pageSize ?? 100));
  const path = `/api/backend/products/page?${query.toString()}`;
  return useQuery({ queryKey: key(path, token), enabled: !!token, select: (d: unknown) => parseWith(productsPageSchema, d, 'produits') });
}

export function useMerchantCategories(restaurantId?: number) {
  const { token } = useAuth();
  const path = restaurantId ? `/api/backend/menu-categories?restaurantId=${restaurantId}` : '/api/backend/menu-categories';
  return useQuery({ queryKey: key(path, token), enabled: !!token, select: (d: unknown) => parseWith(categoriesSchema, d, 'catégories') });
}

export type MerchantProductInput = {
  restaurantId: number; name: string; price: number; category?: string; description?: string;
  isAvailable?: boolean; imageUrl?: string; menuItemCategoryId?: number;
};
export type MerchantProductUpdate = Omit<Partial<MerchantProductInput>, 'restaurantId'> & { restaurantId?: never };

export function useCreateMerchantProduct() {
  const { token } = useAuth(); const client = useQueryClient();
  return useMutation({
    mutationFn: (body: MerchantProductInput) => apiRequest('/api/backend/products', { method: 'POST', body, token: requireToken(token) }).then((d) => parseWith(productSchema, d, 'produit')),
    onSuccess: () => invalidatePrefix(client, '/api/backend/products/page', token),
  });
}

export function useUpdateMerchantProduct() {
  const { token } = useAuth(); const client = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: MerchantProductUpdate }) => apiRequest(`/api/backend/products/${id}`, { method: 'PATCH', body: data, token: requireToken(token) }).then((d) => parseWith(productSchema, d, 'produit')),
    onSuccess: () => invalidatePrefix(client, '/api/backend/products/page', token),
  });
}

export function useDeleteMerchantProduct() {
  const { token } = useAuth(); const client = useQueryClient();
  return useMutation({
    mutationFn: ({ id }: { id: number }) => apiRequest(`/api/backend/products/${id}`, { method: 'DELETE', token: requireToken(token) }),
    onSuccess: () => invalidatePrefix(client, '/api/backend/products/page', token),
  });
}

export function useMerchantReviews() {
  const { token } = useAuth();
  return useQuery({ queryKey: key('/api/backend/reviews', token), enabled: !!token, select: (d: unknown) => parseWith(reviewsSchema, d, 'avis') });
}

export function useMerchantShops() {
  const { token } = useAuth();
  return useQuery({
    queryKey: key('/api/backend/shops', token),
    enabled: !!token,
    select: (d: unknown) => parseWith(shopsProfileSchema, d, 'boutiques'),
  });
}

export function useMerchantShopHours(shopId?: number) {
  const { token } = useAuth();
  const path = `/api/backend/shops/${shopId ?? 0}/hours`;
  return useQuery({
    queryKey: key(path, token),
    enabled: !!token && !!shopId,
    select: (d: unknown) => parseWith(merchantShopHoursSchema, d, 'horaires'),
  });
}

export function useUpdateMerchantShopCloseTimes() {
  const { token } = useAuth();
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({ shopId, hours }: { shopId: number; hours: { dayOfWeek: number; closeTime: string }[] }) =>
      apiRequest(`/api/backend/shops/${shopId}/hours`, {
        method: 'PUT',
        body: { hours },
        token: requireToken(token),
      }).then((d) => parseWith(merchantShopHoursSchema, d, 'horaires')),
    onSuccess: (_hours, variables) => client.invalidateQueries({
      queryKey: key(`/api/backend/shops/${variables.shopId}/hours`, token),
    }),
  });
}

export type MerchantShopUpdate = {
  name?: string; description?: string | null; address?: string | null; phone?: string | null;
  category?: string | null; businessType?: string | null; deliveryTime?: number | null;
  deliveryFee?: number | null; minimumOrder?: number | null; isOpen?: boolean;
  imageUrl?: string | null; coverImageUrl?: string | null; logoUrl?: string | null;
};

export function useUpdateMerchantShop() {
  const { token } = useAuth(); const client = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: MerchantShopUpdate }) => apiRequest(`/api/backend/shops/${id}`, { method: 'PATCH', body: data, token: requireToken(token) }).then((d) => parseWith(merchantShopSchema, d, 'boutique')),
    onSuccess: () => client.invalidateQueries({ queryKey: key('/api/backend/shops', token) }),
  });
}