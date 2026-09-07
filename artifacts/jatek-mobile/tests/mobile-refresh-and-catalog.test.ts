import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import assert from "node:assert/strict";
import test from "node:test";

import {
  filterAndSortMenuItems,
  filterRestaurantsBySearch,
  groupMenuSections,
  rotateItems,
  sortOrdersByCreatedAt,
} from "../lib/catalogUtils";
import { refreshAll } from "../lib/mobileRefresh";

const testDirectory = dirname(fileURLToPath(import.meta.url));
const source = (relativePath: string) =>
  readFileSync(resolve(testDirectory, "..", relativePath), "utf8");

test("refreshAll starts every feed and settles when one feed fails", async () => {
  const completed: string[] = [];

  await refreshAll([
    async () => {
      completed.push("restaurants");
    },
    async () => {
      throw new Error("optional feed unavailable");
    },
    async () => {
      completed.push("orders");
    },
  ]);

  assert.deepEqual(completed, ["restaurants", "orders"]);
});

test("home rotation changes the visible order without mutating API data", () => {
  const restaurants = ["a", "b", "c"];

  assert.deepEqual(rotateItems(restaurants, 0), ["a", "b", "c"]);
  assert.deepEqual(rotateItems(restaurants, 1), ["b", "c", "a"]);
  assert.deepEqual(rotateItems(restaurants, 4), ["b", "c", "a"]);
  assert.deepEqual(restaurants, ["a", "b", "c"]);
});

const categories = [
  { id: "Tous", name: "Tous" },
  { id: "1", name: "Burgers" },
  { id: "2", name: "Boissons" },
];

const menuItems = [
  { id: 1, name: "Classic", description: "Burger maison", price: 70, menuItemCategoryId: 1 },
  { id: 2, name: "Cola", description: "Boisson fraîche", price: 15, menuItemCategoryId: 2 },
  { id: 3, name: "Spicy", description: "Burger très épicé", price: 45, category: "Burgers" },
  { id: 4, name: "Cookie", description: "Dessert", price: 25, category: "Desserts" },
];

test("restaurant search and category filters work together", () => {
  assert.deepEqual(
    filterAndSortMenuItems(menuItems, {
      categories,
      activeCategory: "1",
      searchQuery: "épIcÉ",
      sortMode: "recommended",
    }).map((item) => item.id),
    [3],
  );
  assert.deepEqual(
    filterAndSortMenuItems(menuItems, {
      categories,
      activeCategory: "Tous",
      searchQuery: "cola",
      sortMode: "recommended",
    }).map((item) => item.id),
    [2],
  );
});

test("catalog helper supports all sort modes and keeps recommended order", () => {
  const options = { categories, activeCategory: "Tous", searchQuery: "" };

  assert.deepEqual(
    filterAndSortMenuItems(menuItems, { ...options, sortMode: "recommended" }).map((item) => item.id),
    [1, 2, 3, 4],
  );
  assert.deepEqual(
    filterAndSortMenuItems(menuItems, { ...options, sortMode: "priceAsc" }).map((item) => item.id),
    [2, 4, 3, 1],
  );
  assert.deepEqual(
    filterAndSortMenuItems(menuItems, { ...options, sortMode: "priceDesc" }).map((item) => item.id),
    [1, 3, 4, 2],
  );
});

test("restaurant page uses recommended order without exposing sort controls", () => {
  const code = source("app/restaurant/[id].tsx");

  assert.match(code, /sortMode: "recommended"/);
  assert.doesNotMatch(code, /Recommandés/);
  assert.doesNotMatch(code, /Prix croissant/);
  assert.doesNotMatch(code, /Prix décroissant/);
  assert.doesNotMatch(code, /sortChip/);
});

test("restaurant catalog sections retain category labels and collect uncategorized products", () => {
  const sections = groupMenuSections(categories, menuItems, "Tous");

  assert.deepEqual(
    sections.map((section) => [section.name, section.items.map((item) => item.id)]),
    [
      ["Burgers", [1, 3]],
      ["Boissons", [2]],
      ["Autres", [4]],
    ],
  );
});

test("restaurant category navigation stays sticky and tracks visible sections", () => {
  const code = source("app/restaurant/[id].tsx");

  assert.match(code, /categoryOverlay/);
  assert.match(code, /categoryBarOffsetRef/);
  assert.match(code, /categoryPinned/);
  assert.match(code, /onScroll=\{handleMenuScroll\}/);
  assert.match(code, /scrollEventThrottle=\{16\}/);
  assert.match(code, /sectionOffsetsRef/);
  assert.match(code, /setActiveCategory\(\(current\)/);
  assert.match(code, /CATEGORY_OVERLAY_TOP_GAP/);
  assert.match(code, /\(categoryBarY \?\? HERO_H\) - insets\.top - CATEGORY_OVERLAY_TOP_GAP/);
  assert.match(code, /menuScrollRef\.current\?\.scrollTo\(\{ y: 0, animated: true \}\)/);
  assert.match(code, /testID=\{`restaurant-category-\$\{cat\.id\}`\}/);
});

test("restaurant page keeps the safe-area header and renders a two-column product grid", () => {
  const page = source("app/restaurant/[id].tsx");
  const gridCard = source("components/MenuItemGridCard.tsx");

  assert.match(page, /const \[headerPinned, setHeaderPinned\]/);
  assert.match(page, /renderPinnedHeader/);
  assert.match(page, /paddingTop: insets\.top/);
  assert.match(page, /<MenuItemGridCard/);
  assert.match(page, /width=\{menuCardWidth\}/);
  assert.match(page, /menuList:\s*\{[\s\S]*flexDirection: "row"[\s\S]*flexWrap: "wrap"/);
  assert.match(page, /const MENU_GRID_GAP/);
  assert.doesNotMatch(page, /section\.items\.length.*articles/);
  assert.match(gridCard, /aspectRatio: 1/);
});

test("home Shorts render as a two-column vertical grid", () => {
  const page = source("app/(tabs)/index.tsx");
  const shortsSection = page.slice(
    page.indexOf("/* ─── Découvrir en vidéo ─── */"),
    page.indexOf("/* ─── Pres de chez vous"),
  );

  assert.match(shortsSection, /<Animated\.View[\s\S]*style=\{s\.videosGrid\}/);
  assert.doesNotMatch(shortsSection, /\bhorizontal\b/);
  assert.match(page, /videosGrid:\s*\{[\s\S]*flexDirection: "row"[\s\S]*flexWrap: "wrap"/);
});

test("home shorts use two-column magenta framed cards without labels", () => {
  const page = source("app/(tabs)/index.tsx");

  assert.match(page, /const SHORT_CARD_W/);
  assert.match(page, /const SHORT_BORDER = PINK/);
  assert.match(page, /borderWidth: 2/);
  assert.match(page, /borderColor: SHORT_BORDER/);
  assert.match(page, /shortAvatarRing/);
  assert.match(page, /restaurantAvatarById/);
  assert.match(page, /short\.restaurantLogoUrl/);
  assert.doesNotMatch(page, /shortNameLabel/);
  assert.doesNotMatch(page, /<Ionicons name="play-circle"/);
});

test("category search matches both establishment name and category", () => {
  const restaurants = [
    { id: 1, name: "Chez Lina", category: "Pâtisserie" },
    { id: 2, name: "Burger Club", category: "Restauration" },
  ];

  assert.deepEqual(filterRestaurantsBySearch(restaurants, "pÂtIs"), [restaurants[0]]);
  assert.deepEqual(filterRestaurantsBySearch(restaurants, "burger"), [restaurants[1]]);
  assert.deepEqual(filterRestaurantsBySearch(restaurants, "  "), restaurants);
});

test("order sorting is stable for the source array and supports both feed directions", () => {
  const orders = [
    { id: 1, createdAt: "2026-09-01T10:00:00Z" },
    { id: 2, createdAt: "2026-09-03T10:00:00Z" },
    { id: 3, createdAt: "2026-09-02T10:00:00Z" },
  ];

  assert.deepEqual(sortOrdersByCreatedAt(orders, "desc").map((order) => order.id), [2, 3, 1]);
  assert.deepEqual(sortOrdersByCreatedAt(orders, "asc").map((order) => order.id), [1, 3, 2]);
  assert.deepEqual(orders.map((order) => order.id), [1, 2, 3]);
});

const refreshableScreens = [
  "app/(tabs)/index.tsx",
  "app/category/[slug].tsx",
  "app/restaurant/[id].tsx",
  "app/(tabs)/orders.tsx",
  "app/(tabs)/manage.tsx",
  "app/(tabs)/deliver.tsx",
];

for (const screen of refreshableScreens) {
  test(`${screen} keeps manual and pull-to-refresh controls`, () => {
    const code = source(screen);

    assert.match(code, /RefreshControl/);
    assert.match(code, /refreshControl=\{\s*<RefreshControl|onRefresh=\{onRefresh\}/);
    assert.match(code, /RefreshButton/);
    assert.match(code, /onPress=\{onRefresh\}/);
    assert.match(code, /const onRefresh = async/);
  });
}

const profileFeedScreens = [
  "app/profile/favorites.tsx",
  "app/profile/reorder.tsx",
  "app/profile/reviews.tsx",
  "app/profile/notifications.tsx",
];

for (const screen of profileFeedScreens) {
  test(`${screen} keeps manual and pull-to-refresh controls`, () => {
    const code = source(screen);

    assert.match(code, /RefreshControl/);
    assert.match(code, /RefreshButton/);
    assert.match(code, /refreshing/);
    assert.match(code, /load/);
  });
}

test("owner and driver feeds retain realtime listeners and polling fallbacks", () => {
  for (const screen of ["app/(tabs)/manage.tsx", "app/(tabs)/deliver.tsx"]) {
    const code = source(screen);
    assert.match(code, /useSSE/);
    assert.match(code, /refetchInterval:\s*30000/);
    assert.match(code, /refreshAll/);
  }
});