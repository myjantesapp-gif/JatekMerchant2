import { asc, desc } from "drizzle-orm";
import { menuItemsTable } from "@workspace/db/schema";

export const PRODUCT_SORT_VALUES = ["custom", "name", "category", "price", "availability", "shop", "createdAt"] as const;
export type ProductSort = typeof PRODUCT_SORT_VALUES[number];
export const PRODUCT_SORT_DIRECTION_VALUES = ["asc", "desc"] as const;
export type ProductSortDirection = typeof PRODUCT_SORT_DIRECTION_VALUES[number];

export function normalizeProductSort(value: unknown): ProductSort {
  return typeof value === "string" && PRODUCT_SORT_VALUES.includes(value as ProductSort)
    ? value as ProductSort
    : "custom";
}

export function normalizeProductSortDirection(value: unknown, sort: ProductSort = "custom"): ProductSortDirection {
  if (typeof value === "string" && PRODUCT_SORT_DIRECTION_VALUES.includes(value as ProductSortDirection)) {
    return value as ProductSortDirection;
  }
  // Preserve the historical endpoint order for callers that do not send a
  // direction: every mode is ascending by default, while createdAt was
  // historically newest first.
  return sort === "createdAt" ? "desc" : "asc";
}

/**
 * Keep the database order used by GET /api/backend/products in one place.
 * The final id tie-breaker makes every sort deterministic.
 */
export function getBackendProductsOrderBy(sort: ProductSort, direction: ProductSortDirection = normalizeProductSortDirection(undefined, sort)): any[] {
  const order = direction === "desc" ? desc : asc;
  if (sort === "name") return [order(menuItemsTable.name), order(menuItemsTable.id)];
  if (sort === "category") return [order(menuItemsTable.category), order(menuItemsTable.name), order(menuItemsTable.id)];
  if (sort === "price") return [order(menuItemsTable.price), order(menuItemsTable.name), order(menuItemsTable.id)];
  if (sort === "availability") return [order(menuItemsTable.isAvailable), order(menuItemsTable.name), order(menuItemsTable.id)];
  if (sort === "shop") return [order(menuItemsTable.restaurantId), order(menuItemsTable.name), order(menuItemsTable.id)];
  if (sort === "createdAt") return [order(menuItemsTable.createdAt), order(menuItemsTable.id)];
  return [order(menuItemsTable.sortOrder), order(menuItemsTable.name), order(menuItemsTable.id)];
}

type SortableProduct = {
  id: number;
  name: string;
  category?: string;
  price: number;
  sortOrder: number;
  isAvailable?: boolean;
  restaurantId?: number | null;
  createdAt: Date | string;
};

function compareText(left: string, right: string): number {
  return left.localeCompare(right);
}

function compareNumbers(left: number, right: number): number {
  return left - right;
}

/**
 * A database-independent representation of the public product ordering.
 * This is used by regression tests to assert the response contract.
 */
export function compareProductsBySort(
  left: SortableProduct,
  right: SortableProduct,
  sort: ProductSort,
  direction: ProductSortDirection = normalizeProductSortDirection(undefined, sort),
): number {
  const multiplier = direction === "desc" ? -1 : 1;
  if (sort === "name") {
    return multiplier * (compareText(left.name, right.name) || compareNumbers(left.id, right.id));
  }
  if (sort === "category") {
    return multiplier * (compareText(left.category ?? "", right.category ?? "") || compareText(left.name, right.name) || compareNumbers(left.id, right.id));
  }
  if (sort === "price") {
    return multiplier * (compareNumbers(left.price, right.price)
      || compareText(left.name, right.name)
      || compareNumbers(left.id, right.id));
  }
  if (sort === "availability") {
    return multiplier * (compareNumbers(Number(Boolean(left.isAvailable)), Number(Boolean(right.isAvailable)))
      || compareText(left.name, right.name)
      || compareNumbers(left.id, right.id));
  }
  if (sort === "shop") {
    return multiplier * (compareNumbers(left.restaurantId ?? 0, right.restaurantId ?? 0)
      || compareText(left.name, right.name)
      || compareNumbers(left.id, right.id));
  }
  if (sort === "createdAt") {
    return multiplier * (compareNumbers(new Date(left.createdAt).getTime(), new Date(right.createdAt).getTime())
      || compareNumbers(left.id, right.id));
  }
  return multiplier * (compareNumbers(left.sortOrder, right.sortOrder)
    || compareText(left.name, right.name)
    || compareNumbers(left.id, right.id));
}

type CustomerMenuEntry = SortableProduct & {
  category: string;
  categorySortOrder: number | null;
};

/**
 * Customer menus group by category order, then preserve each product's saved
 * custom order. This mirrors the order used by GET /api/restaurants/:id/menu.
 */
export function compareCustomerMenuEntries(
  left: CustomerMenuEntry,
  right: CustomerMenuEntry,
): number {
  // PostgreSQL puts NULL first for ascending order, matching legacy products
  // that do not have a structured category join.
  const leftCategoryOrder = left.categorySortOrder ?? Number.MIN_SAFE_INTEGER;
  const rightCategoryOrder = right.categorySortOrder ?? Number.MIN_SAFE_INTEGER;
  return compareNumbers(leftCategoryOrder, rightCategoryOrder)
    || compareNumbers(left.sortOrder, right.sortOrder)
    || compareText(left.category, right.category)
    || compareNumbers(new Date(right.createdAt).getTime(), new Date(left.createdAt).getTime())
    || compareNumbers(right.id, left.id);
}