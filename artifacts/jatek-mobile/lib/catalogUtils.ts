export type MenuCategory = { id: string; name: string };

export type MenuItemLike = {
  id: number | string;
  name?: string | null;
  description?: string | null;
  price?: number | string | null;
  category?: string | null;
  menuItemCategoryId?: number | string | null;
};

export type MenuSortMode = "recommended" | "priceAsc" | "priceDesc";

function isMenuItemRecord(value: unknown): value is MenuItemLike {
  return (
    value !== null &&
    typeof value === "object" &&
    "id" in value
  );
}

export function normalizeMenuGridRow<T extends MenuItemLike>(row: unknown): T[] {
  const values = Array.isArray(row) ? row : isMenuItemRecord(row) ? [row] : [];
  return values.filter(isMenuItemRecord) as T[];
}

export function chunkMenuItems<T extends MenuItemLike>(
  items: unknown,
  chunkSize = 2,
): T[][] {
  if (!Array.isArray(items) || chunkSize < 1) return [];
  const safeItems = items.filter(isMenuItemRecord) as T[];
  return Array.from(
    { length: Math.ceil(safeItems.length / chunkSize) },
    (_, index) => safeItems.slice(index * chunkSize, index * chunkSize + chunkSize),
  );
}

function matchesMenuCategory(item: MenuItemLike, category: MenuCategory): boolean {
  const itemCategoryName = String(item.category ?? "").trim().toLowerCase();
  const categoryName = category.name.trim().toLowerCase();

  return (
    String(item.menuItemCategoryId ?? "") === category.id ||
    (itemCategoryName.length > 0 && itemCategoryName === categoryName)
  );
}

export function rotateItems<T>(items: readonly T[], seed: number): T[] {
  if (items.length < 2) return [...items];
  const offset = ((seed % items.length) + items.length) % items.length;
  return [...items.slice(offset), ...items.slice(0, offset)];
}

export function filterAndSortMenuItems<T extends MenuItemLike>(
  items: readonly T[],
  options: {
    categories: readonly MenuCategory[];
    activeCategory: string;
    searchQuery: string;
    sortMode: MenuSortMode;
  },
): T[] {
  const { categories, activeCategory, searchQuery, sortMode } = options;
  const selectedCategory = categories.find((category) => category.id === activeCategory);
  const query = searchQuery.trim().toLowerCase();
  const matching = items.filter((item) => {
    const matchesCategory =
      activeCategory === "Tous" ||
      (!!selectedCategory &&
        matchesMenuCategory(item, selectedCategory));
    const searchableText = `${item.name ?? ""} ${item.description ?? ""}`.toLowerCase();
    return matchesCategory && (!query || searchableText.includes(query));
  });

  if (sortMode === "priceAsc") {
    return [...matching].sort((a, b) => Number(a.price) - Number(b.price));
  }
  if (sortMode === "priceDesc") {
    return [...matching].sort((a, b) => Number(b.price) - Number(a.price));
  }
  return matching;
}

export function groupMenuSections<T extends MenuItemLike>(
  categories: readonly MenuCategory[],
  items: readonly T[],
  activeCategory: string,
): Array<MenuCategory & { items: T[] }> {
  const visibleCategories =
    activeCategory === "Tous"
      ? categories.filter((category) => category.id !== "Tous")
      : categories.filter((category) => category.id === activeCategory);
  const grouped = visibleCategories
    .map((category) => ({
      ...category,
      items: items.filter((item) => matchesMenuCategory(item, category)),
    }))
    .filter((section) => section.items.length > 0);

  const assignedIds = new Set(grouped.flatMap((section) => section.items.map((item) => item.id)));
  const uncategorized = items.filter((item) => !assignedIds.has(item.id));
  if (uncategorized.length > 0) {
    grouped.push({ id: "other", name: "Autres", items: uncategorized });
  }
  return activeCategory === "Tous"
    ? grouped
    : grouped.length > 0
      ? grouped
      : [{ id: activeCategory, name: activeCategory, items: [...items] }];
}

export function filterRestaurantsBySearch<T extends { name: string; category?: string | null }>(
  restaurants: readonly T[],
  search: string,
): T[] {
  const query = search.trim().toLowerCase();
  if (!query) return [...restaurants];
  return restaurants.filter(
    (restaurant) =>
      restaurant.name.toLowerCase().includes(query) ||
      (restaurant.category ?? "").toLowerCase().includes(query),
  );
}

export function sortOrdersByCreatedAt<T extends { createdAt: string | Date }>(
  orders: readonly T[],
  direction: "asc" | "desc",
): T[] {
  const factor = direction === "asc" ? 1 : -1;
  return [...orders].sort(
    (a, b) => factor * (new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()),
  );
}