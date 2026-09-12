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

test("home Shorts render as a three-column vertical grid", () => {
  const page = source("app/(tabs)/index.tsx");
  const shortsSection = page.slice(
    page.indexOf("/* ─── Découvrir en vidéo ─── */"),
    page.indexOf("/* ─── Pres de chez vous"),
  );

  assert.match(shortsSection, /<Animated\.View[\s\S]*style=\{s\.videosGrid\}/);
  assert.doesNotMatch(shortsSection, /\bhorizontal\b/);
  assert.match(page, /videosGrid:\s*\{[\s\S]*flexDirection: "row"[\s\S]*flexWrap: "wrap"/);
  assert.match(page, /const SHORT_COLUMNS = 3/);
  assert.match(page, /SHORT_GAP \* \(SHORT_COLUMNS - 1\)/);
});

test("home shorts use three-column magenta framed cards without labels", () => {
  const page = source("app/(tabs)/index.tsx");

  assert.match(page, /const SHORT_CARD_W/);
  assert.match(page, /const SHORT_BORDER = PINK/);
  assert.match(page, /borderWidth: 2/);
  assert.match(page, /borderColor: SHORT_BORDER/);
  assert.match(page, /shortAvatarRing/);
  assert.match(page, /shortAvatarImageFrame/);
  assert.match(page, /restaurantAvatarById/);
  assert.match(page, /short\.restaurantLogoUrl/);
  assert.match(page, /shortAvatarImage[\s\S]*resizeMode="contain"/);
  assert.match(page, /videoCard:\s*\{[\s\S]*borderRadius: 8/);
  assert.match(page, /shortAvatarRing:\s*\{[\s\S]*width: 44[\s\S]*height: 44/);
  assert.match(page, /shortAvatarImageFrame:\s*\{[\s\S]*padding: 3/);
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

test("home header omits the wordmark while retaining its actions", () => {
  const code = source("app/(tabs)/index.tsx");
  const headerTopRow = code.slice(
    code.indexOf("/* Top row: menu + orders + profile */"),
    code.indexOf("/* Search bar */"),
  );

  assert.doesNotMatch(headerTopRow, /headerLogo|>Jatek</);
  assert.match(headerTopRow, /accessibilityLabel="Ouvrir le menu"/);
  assert.match(headerTopRow, /accessibilityLabel="Mon panier"/);
  assert.match(headerTopRow, /accessibilityLabel="Mon profil"/);
  assert.doesNotMatch(code, /^\s*headerLogo:\s*\{/m);
});

test("home keeps section actions and renders live product recommendations", () => {
  const code = source("app/(tabs)/index.tsx");

  assert.match(code, /listRecommendedProducts/);
  assert.match(code, /home-recommendations/);
  assert.match(code, /productId: String\(product\.id\)/);
  assert.match(code, /limit: 30/);
  assert.match(code, /Math\.min\(recommendedProducts\.length, 30\)/);
  assert.match(code, /pageIndex \* 6/);
  assert.match(code, /pagingEnabled/);
  assert.match(code, /recommendation-page-/);
  assert.match(code, /RECOMMENDATION_COLUMNS = 3/);
  assert.match(code, /style=\{s\.recommendationsGrid\}/);
  assert.match(code, /compact/);
  assert.match(code, /Voir toutes les vidéos/);
  assert.match(code, /Voir les commerces/);
  assert.doesNotMatch(code, />Partenaires VIP & Promos</);
  assert.doesNotMatch(code, />Découvrir en vidéo</);
  assert.doesNotMatch(code, />Près de chez vous</);
  assert.doesNotMatch(code, /<Text style=\{s\.gridSectionTitle\}/);
});

test("home banners display artwork without overlaid text or badges", () => {
  const code = source("app/(tabs)/index.tsx");

  assert.match(code, /const VIP_CARD_W = Math\.min\(SCREEN_W - 80, 300\)/);
  assert.doesNotMatch(code, /borderWidth: 1,\s*borderColor: "rgba\(255,255,255,0\.22\)"/);
  assert.doesNotMatch(code, /vipCardTitle/);
  assert.doesNotMatch(code, /vipCardSubtitle/);
  assert.doesNotMatch(code, /vipBadge/);
  assert.doesNotMatch(code, /title=\{ad\.title\}/);
  assert.match(code, /vipCardImg[\s\S]*opacity: 1/);
});

test("product deep links only open currently available menu items", () => {
  const code = source("app/restaurant/[id].tsx");

  assert.match(code, /requestedProduct\?\.isAvailable === true/);
  assert.match(code, /selectedItem\.isAvailable === false/);
});

test("home includes every commerce type instead of defaulting to restaurants", () => {
  const code = source("app/(tabs)/index.tsx");

  assert.match(code, /const \[activeBusinessType, setActiveBusinessType\] = useState\(""\)/);
  assert.match(code, /const \[activeLabel, setActiveLabel\] = useState\("Tous les commerces"\)/);
  assert.match(code, /Aucun commerce à proximité/);
});

test("app uses a transparent edge-to-edge system bar while preserving readable icons", () => {
  const code = source("app/_layout.tsx");
  const appConfig = source("app.json");

  assert.match(code, /<StatusBar style="dark" backgroundColor="transparent" translucent \/>/);
  assert.doesNotMatch(code, /SystemStatusBarBackdrop/);
  assert.match(appConfig, /"edgeToEdgeEnabled": true/);
  assert.match(appConfig, /"androidStatusBar": \{[\s\S]*"backgroundColor": "transparent"[\s\S]*"barStyle": "dark-content"[\s\S]*"translucent": true/);
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