import { asc, desc } from "drizzle-orm";
import { menuItemsTable } from "@workspace/db/schema";

export const PRODUCT_SORT_VALUES = ["custom", "name", "price", "createdAt"] as const;
export type ProductSort = typeof PRODUCT_SORT_VALUES[number];

export function normalizeProductSort(value: unknown): ProductSort {
  return typeof value === "string" && PRODUCT_SORT_VALUES.includes(value as ProductSort)
    ? value as ProductSort
    : "custom";
}

/**
 * Keep the database order used by GET /api/backend/products in one place.
 * The final id tie-breaker makes every sort deterministic.
 */
export function getBackendProductsOrderBy(sort: ProductSort): any[] {
  if (sort === "name") return [menuItemsTable.name, menuItemsTable.id];
  if (sort === "price") return [menuItemsTable.price, menuItemsTable.name, menuItemsTable.id];
  if (sort === "createdAt") return [desc(menuItemsTable.createdAt), desc(menuItemsTable.id)];
  return [menuItemsTable.sortOrder, menuItemsTable.name, menuItemsTable.id];
}

type SortableProduct = {
  id: number;
  name: string;
  price: number;
  sortOrder: number;
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
): number {
  if (sort === "name") {
    return compareText(left.name, right.name) || compareNumbers(left.id, right.id);
  }
  if (sort === "price") {
    return compareNumbers(left.price, right.price)
      || compareText(left.name, right.name)
      || compareNumbers(left.id, right.id);
  }
  if (sort === "createdAt") {
    return compareNumbers(new Date(right.createdAt).getTime(), new Date(left.createdAt).getTime())
      || compareNumbers(right.id, left.id);
  }
  return compareNumbers(left.sortOrder, right.sortOrder)
    || compareText(left.name, right.name)
    || compareNumbers(left.id, right.id);
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