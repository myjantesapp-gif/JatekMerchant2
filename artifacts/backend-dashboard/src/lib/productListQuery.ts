import type { ListBackendProductsPageParams } from "@workspace/api-client-react";

export const PRODUCT_SORT_OPTIONS = ["custom", "name", "category", "price", "availability", "shop", "createdAt"] as const;
export type ProductSort = typeof PRODUCT_SORT_OPTIONS[number];
export type ProductAvailability = "available" | "unavailable";

export interface ProductListFilters {
  shopId?: number;
  status?: ProductAvailability;
  promo?: boolean;
  category?: string;
  sortDirection?: "asc" | "desc";
  page?: number;
  pageSize?: number;
}

export function isProductSort(value: string): value is ProductSort {
  return PRODUCT_SORT_OPTIONS.includes(value as ProductSort);
}

export function buildProductListParams(
  search: string,
  sort: ProductSort,
  filters?: ProductListFilters,
): ListBackendProductsPageParams {
  const params: ListBackendProductsPageParams = {
    search: search || undefined,
    sort,
  };
  if (filters?.shopId !== undefined) params.shopId = filters.shopId;
  if (filters?.status !== undefined) params.status = filters.status;
  if (filters?.promo !== undefined) params.promo = filters.promo;
  if (filters?.category !== undefined) params.category = filters.category;
  if (filters?.sortDirection !== undefined) params.sortDirection = filters.sortDirection;
  if (filters?.page !== undefined) params.page = filters.page;
  if (filters?.pageSize !== undefined) params.pageSize = filters.pageSize;
  return params;
}