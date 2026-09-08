import type { ListBackendProductsParams } from "@workspace/api-client-react";

export const PRODUCT_SORT_OPTIONS = ["custom", "name", "price", "createdAt"] as const;
export type ProductSort = typeof PRODUCT_SORT_OPTIONS[number];

export function isProductSort(value: string): value is ProductSort {
  return PRODUCT_SORT_OPTIONS.includes(value as ProductSort);
}

export function buildProductListParams(
  search: string,
  sort: ProductSort,
): ListBackendProductsParams {
  return {
    search: search || undefined,
    sort,
  };
}