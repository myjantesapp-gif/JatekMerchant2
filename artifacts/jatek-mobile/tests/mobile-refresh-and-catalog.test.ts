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

test("restaurant category tabs keep legacy menu categories alongside API categories", () => {
  const page = source("app/restaurant/[id].tsx");

  assert.match(page, /const legacyCategories = Array\.from/);
  assert.match(page, /new Map\(/);
  assert.match(page, /knownNames\.has\(name\.toLocaleLowerCase\(\)\)/);
  assert.match(page, /\.\.\.fromApi, \.\.\.legacyCategories/);
});

test("restaurant header labels service merchants without calling them restaurants", () => {
  const page = source("app/restaurant/[id].tsx");

  assert.match(page, /const businessLabel = isServices \? "Marchand" : "Restaurant"/);
  assert.match(page, /businessLabel\} fermé/);
  assert.match(page, /briefcase-outline/);
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

test("restaurant page keeps the safe-area header and renders a three-column product grid", () => {
  const page = source("app/restaurant/[id].tsx");
  const gridCard = source("components/MenuItemGridCard.tsx");

  assert.match(page, /const \[headerPinned, setHeaderPinned\]/);
  assert.match(page, /renderPinnedHeader/);
  assert.match(page, /paddingTop: insets\.top/);
  assert.match(page, /<MenuItemGridCard/);
  assert.match(page, /width=\{menuCardWidth\}/);
  assert.match(page, /MENU_GRID_GAP \* 2\) \/ 3/);
  assert.match(page, /menuList:\s*\{[\s\S]*flexDirection: "row"[\s\S]*flexWrap: "wrap"/);
  assert.match(page, /const MENU_GRID_GAP/);
  assert.doesNotMatch(page, /section\.items\.length.*articles/);
  assert.match(gridCard, /aspectRatio: 1/);
});

test("home renders discovery videos as a horizontal 9:16 card rail", () => {
  const page = source("app/(tabs)/index.tsx");
  const card = source("components/ShortCard.tsx");

  assert.match(page, /title="Shorts"/);
  assert.match(page, /shorts\.map\(\(short, index\)/);
  assert.match(page, /<ShortCard/);
  assert.match(card, /height: 238/);
  assert.match(card, /borderRadius: 18/);
});

test("short cards keep the merchant logo in a pink circular frame", () => {
  const card = source("components/ShortCard.tsx");

  assert.match(card, /borderColor: colors\.light\.primary/);
  assert.match(card, /avatarImage/);
  assert.match(card, /avatarUrl/);
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

test("category headers use business-specific illustrated backgrounds", () => {
  const page = source("app/category/[slug].tsx");

  assert.match(page, /getHeaderPatternIcon/);
  assert.match(page, /includes\("pharm"\)[\s\S]*return "medkit"/);
  assert.match(page, /includes\("market"\)[\s\S]*return "cart"/);
  assert.match(page, /includes\("shop"\)[\s\S]*return "bag-handle"/);
  assert.match(page, /includes\("service"\)[\s\S]*return "construct"/);
  assert.match(page, /colors=\{\[config\.color, PINK\]\}/);
  assert.match(page, /style=\{styles\.categoryPattern\}/);
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
  "app/category/[slug].tsx",
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

test("restaurant header keeps pull-to-refresh but has no refresh icon", () => {
  const code = source("app/restaurant/[id].tsx");
  assert.match(code, /RefreshControl/);
  assert.match(code, /const onRefresh = async/);
  assert.doesNotMatch(code, /RefreshButton/);
});

test("home keeps pull-to-refresh without a header refresh button", () => {
  const code = source("app/(tabs)/index.tsx");

  assert.match(code, /RefreshControl/);
  assert.match(code, /refreshControl=\{\s*<RefreshControl/);
  assert.match(code, /const onRefresh = async/);
  assert.doesNotMatch(code, /RefreshButton/);
});

test("home header omits the wordmark while retaining its actions and pink wave", () => {
  const code = source("app/(tabs)/index.tsx");

  assert.doesNotMatch(code, /styles\.headerLogo|styles\.headerBrand/);
  assert.match(code, /const HEADER_PINK = "#CF346E"/);
  assert.match(code, /<WaveEdge color=\{HEADER_PINK\} height=\{28\} \/>/);
  assert.match(code, /accessibilityLabel="Ouvrir le menu"/);
  assert.match(code, /accessibilityLabel="Ouvrir le panier"/);
  assert.match(code, /accessibilityLabel="Ouvrir le profil"/);
  assert.match(code, /greeting/);
  assert.match(code, /addressRow/);
  assert.match(code, /addressLabel/);
});

test("welcome address picker uses the official Jatek wordmark", () => {
  const code = source("app/(auth)/welcome.tsx");

  assert.match(code, /<JatekLogoBadge \/>/);
  assert.doesNotMatch(code, /Jatek<Text/);
});

test("home renders reusable sections and live product recommendations", () => {
  const code = source("app/(tabs)/index.tsx");
  const productCard = source("components/ProductCard.tsx");
  const storeCard = source("components/StoreCard.tsx");
  const sectionHeader = source("components/SectionHeader.tsx");

  assert.match(code, /listRecommendedProducts/);
  assert.match(code, /productId: String\(product\.id\)/);
  assert.match(code, /title="Produits populaires"/);
  assert.match(code, /<SectionHeader[\s\S]*title="Shorts"/);
  assert.match(code, /<SectionHeader[\s\S]*title="Nouveautés"/);
  assert.match(code, /<SectionHeader[\s\S]*title="Restauration"/);
  assert.match(code, /<ProductCard/);
  assert.match(code, /<ShortCard/);
  assert.match(code, /<StoreCard/);
  assert.match(code, /styles\.promoSection/);
  assert.match(code, /styles\.promoProductGrid/);
  assert.match(code, /styles\.newestSection/);
  assert.match(code, /const SECTION_TINT/);
  assert.match(code, /WaveEdge/);
  assert.match(code, /sort: "promos"/);
  assert.match(productCard, /compareAtPrice/);
  assert.match(sectionHeader, /arrow-forward/);
  assert.match(storeCard, /time-outline/);
  assert.match(storeCard, /location-outline/);
});

test("home renders the requested strict section order", () => {
  const page = source("app/(tabs)/index.tsx");
  const categories = page.indexOf('title="Catégories"');
  const banners = page.indexOf('title="Bannières"');
  const promos = page.indexOf('title="PROMOS"');
  const videos = page.indexOf('title="Shorts"');
  const popular = page.indexOf('title="Produits populaires"');
  const newest = page.indexOf('title="Nouveautés"');
  const restaurants = page.indexOf('title="Restauration"');
  assert.ok(categories >= 0 && categories < banners);
  assert.ok(banners < promos);
  assert.ok(promos < videos);
  assert.ok(videos < popular);
  assert.ok(popular < newest);
  assert.ok(newest < restaurants);
});

test("home shows products in the compact four-column reference grid", () => {
  const page = source("app/(tabs)/index.tsx");
  assert.match(page, /const PROMO_PRODUCT_WIDTH = Math\.max\(74, \(SCREEN_WIDTH - 32 - 24\) \/ 4\)/);
  assert.match(page, /styles\.promoProductGrid/);
});

test("home keeps the four requested categories above the feed", () => {
  const page = source("app/(tabs)/index.tsx");
  assert.match(page, /label: "Restauration"/);
  assert.match(page, /label: "Épicerie"/);
  assert.match(page, /label: "Santé"/);
  assert.match(page, /label: "Supermarché"/);
  assert.match(page, /<CategoryRow categories=\{categories\}/);
});

test("home promo banner displays artwork without overlay text", () => {
  const code = source("app/(tabs)/index.tsx");
  const productCard = source("components/ProductCard.tsx");

  assert.match(code, /LOCAL_PROMO_BANNERS/);
  assert.match(code, /function PromoBanner/);
  assert.match(code, /promoImage/);
  assert.doesNotMatch(code, /ad\.title/);
  assert.match(productCard, /textDecorationLine: "line-through"/);
});

test("product deep links only open currently available menu items", () => {
  const code = source("app/restaurant/[id].tsx");

  assert.match(code, /requestedProduct\?\.isAvailable === true/);
  assert.match(code, /selectedItem\.isAvailable === false/);
});

test("home includes every commerce type instead of defaulting to restaurants", () => {
  const code = source("app/(tabs)/index.tsx");

  assert.match(code, /CATEGORY_PRESETS/);
  assert.match(code, /matches: \["pharmacy", "pharmacie", "health", "santé", "sante"\]/);
  assert.match(code, /Aucun nouveau commerce pour le moment/);
});

test("app uses a transparent edge-to-edge system bar while preserving readable icons", () => {
  const code = source("app/_layout.tsx");
  const appConfig = source("app.json");

  assert.match(code, /<StatusBar style="dark" backgroundColor="transparent" translucent \/>/);
  assert.doesNotMatch(code, /SystemStatusBarBackdrop/);
  assert.match(appConfig, /"android": \{[\s\S]*"edgeToEdgeEnabled": true/);
  assert.match(appConfig, /"androidStatusBar": \{[\s\S]*"backgroundColor": "#00000000"[\s\S]*"barStyle": "dark-content"[\s\S]*"translucent": true/);
});

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