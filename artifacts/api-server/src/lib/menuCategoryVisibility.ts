export type MenuCategoryVisibilityRow = {
  id: number;
  restaurantId: number | null;
  name: string;
  isActive?: boolean;
};

export type MenuProductCategoryReference = {
  menuItemCategoryId: number | null;
  category: string;
};

function normalizeCategoryName(name: string): string {
  return name.trim().toLocaleLowerCase();
}

/**
 * Return the product categories that should be offered by a restaurant menu.
 *
 * Global categories are templates and only become visible when the restaurant
 * uses them. Products created before menuItemCategoryId existed are matched
 * by their legacy category name. Restaurant-owned categories are already
 * scoped by the route's restaurantId query.
 */
export function filterVisibleRestaurantMenuCategories(
  rows: MenuCategoryVisibilityRow[],
  products: MenuProductCategoryReference[],
  restaurantId?: number,
): MenuCategoryVisibilityRow[] {
  const usedCategoryIds = new Set(
    products
      .map((product) => product.menuItemCategoryId)
      .filter((id): id is number => id !== null),
  );
  const usedLegacyNames = new Set(
    products
      .filter((product) => product.menuItemCategoryId === null)
      .map((product) => normalizeCategoryName(product.category))
      .filter(Boolean),
  );

  return rows.filter((row) =>
    row.isActive !== false
    && (restaurantId === undefined || row.restaurantId === null || row.restaurantId === restaurantId)
    && (
      row.restaurantId !== null
      || usedCategoryIds.has(row.id)
      || usedLegacyNames.has(normalizeCategoryName(row.name))
    ),
  );
}