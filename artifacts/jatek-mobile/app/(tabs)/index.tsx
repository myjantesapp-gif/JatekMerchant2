import React, { useEffect, useMemo, useState } from "react";
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  TextInput,
  TouchableOpacity,
  Pressable,
  Image,
  ActivityIndicator,
  RefreshControl,
  Platform,
  Dimensions,
  Linking,
} from "react-native";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useBottomTabBarHeight } from "@react-navigation/bottom-tabs";
import Animated, { FadeInDown } from "react-native-reanimated";
import { LinearGradient } from "expo-linear-gradient";
import Svg, { Path } from "react-native-svg";
import { useQuery } from "@tanstack/react-query";
import {
  useListRestaurants,
  useGetFeaturedRestaurants,
  useListCategories,
  type Restaurant,
  type ListRestaurantsParams,
} from "@workspace/api-client-react";

import { useAuth } from "@/contexts/AuthContext";
import { useCart } from "@/contexts/CartContext";
import { useAds, useShorts } from "@/hooks/useContent";
import {
  getPublicAppConfig,
  listRecommendedProducts,
  type Ad,
  type HomeSectionConfig,
} from "@/lib/api";
import { getYouTubeThumbnailUrl, resolveMediaUrl } from "@/lib/mediaUrl";
import { getApiBaseSafe } from "@/lib/apiBase";
import { formatMad } from "@/lib/money";
import { WaveEdge } from "@/components/WaveEdge";
import { ShortPlayerModal } from "@/components/ShortPlayerModal";
import { AddressQuickPicker } from "@/components/AddressQuickPicker";
import { CartPreviewSheet } from "@/components/CartPreviewSheet";
import { SideMenu } from "@/components/SideMenu";
import { JatekScrollingBanner } from "@/components/JatekScrollingBanner";
import { RecommendedProductCard } from "@/components/RecommendedProductCard";
import { refreshAll } from "@/lib/mobileRefresh";
import { rotateItems } from "@/lib/catalogUtils";

function trackBannerClick(restaurantId: number) {
  try {
    fetch(`${getApiBaseSafe()}/api/restaurants/${restaurantId}/track-click`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
    }).catch(() => {});
  } catch {
    // Fire-and-forget — never block navigation on analytics
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Brand palette — Jatek (matches Figma prototype)
// ─────────────────────────────────────────────────────────────────────────────
const PINK = "#E91E63";
const PINK_DEEP = "#C2185B";
const PINK_SOFT = "#FFE3EF";
const TEXT_DARK = "#0A1B3D";
const TEXT_MUTED = "#6B7280";
const BG = "#FFFFFF";
const STAR = "#E91E63";
const CARD_BORDER = "#F0F0F0";
const SHORT_BORDER = PINK;

// Shop categories (3×2 grid below the header)
const CAT_TINT = "#F2EDD0"; // light yellow-olive — shared tile background

const { width: SCREEN_W } = Dimensions.get("window");
const GRID_GAP = 12;
const GRID_SIDE = 16;
const GRID_CARD_W = (SCREEN_W - GRID_SIDE * 2 - GRID_GAP) / 2;
const SHORT_GAP = 10;
const SHORT_SIDE = 16;
const SHORT_COLUMNS = 3;
const SHORT_PAGE_W = SCREEN_W - 24;
const SHORT_ROWS = 2;
const SHORT_PAGE_SIZE = SHORT_COLUMNS * SHORT_ROWS;
const SHORT_CARD_W = (SHORT_PAGE_W - SHORT_SIDE * 2 - SHORT_GAP * (SHORT_COLUMNS - 1)) / SHORT_COLUMNS;
const SHORT_CARD_H = Math.round(SHORT_CARD_W * 1.64);
const RECOMMENDATION_GAP = 8;
const RECOMMENDATION_CARD_W = Math.floor((SCREEN_W - 28 - RECOMMENDATION_GAP * 3) / 4);
const NEW_PRODUCT_PAGE_W = SCREEN_W - 24;
const NEW_PRODUCT_CARD_W = Math.floor((NEW_PRODUCT_PAGE_W - 28 - RECOMMENDATION_GAP * 2) / 3);
const DEFAULT_HOME_SECTIONS: HomeSectionConfig[] = [
  { key: "popular", title: "Produits populaires", visible: true, source: "popular", limit: 30 },
  { key: "new_products", title: "Promos", visible: true, source: "promos", limit: 12 },
  { key: "new_restaurants", title: "Restauration", visible: false, source: "new_restaurants", limit: 6 },
  { key: "shops", title: "Boutiques", visible: true, source: "shops", limit: 6 },
];
const VIP_CARD_W = Math.min(SCREEN_W - 80, 300);

// ─────────────────────────────────────────────────────────────────────────────
// Sub-components
// ─────────────────────────────────────────────────────────────────────────────

function LoadRetry({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <View style={s.loadRetry}>
      <Ionicons name="cloud-offline-outline" size={24} color={TEXT_MUTED} />
      <Text style={s.loadRetryText}>{message}</Text>
      <TouchableOpacity onPress={onRetry} style={s.loadRetryButton} activeOpacity={0.85}>
        <Text style={s.loadRetryButtonText}>Réessayer</Text>
      </TouchableOpacity>
    </View>
  );
}

function ShortAvatar({ name, imageUrl }: { name: string; imageUrl?: string | null }) {
  const [imageFailed, setImageFailed] = useState(false);
  const initials = name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("") || "J";

  useEffect(() => {
    setImageFailed(false);
  }, [imageUrl]);

  return (
    <View style={s.shortAvatarRing}>
      {imageUrl && !imageFailed ? (
        <View style={s.shortAvatarImageFrame}>
          <Image
            source={{ uri: resolveMediaUrl(imageUrl) ?? imageUrl }}
            style={s.shortAvatarImage}
            resizeMode="contain"
            onError={() => setImageFailed(true)}
          />
        </View>
      ) : (
        <Text style={s.shortAvatarInitials}>{initials}</Text>
      )}
    </View>
  );
}

function ShortThumbnail({
  short,
  avatarUrl,
}: {
  short: { id: number; title?: string | null; restaurantName?: string | null; imageUrl?: string | null; videoUrl?: string | null };
  avatarUrl?: string | null;
}) {
  const [sourceIndex, setSourceIndex] = useState(0);
  const sources = useMemo(
    () => [resolveMediaUrl(short.imageUrl), getYouTubeThumbnailUrl(short.videoUrl)]
      .filter((value): value is string => Boolean(value)),
    [short.imageUrl, short.videoUrl],
  );
  const source = sources[sourceIndex];

  if (!source) {
    return (
      <View style={[s.videoImg, s.videoImgPlaceholder]}>
        <Ionicons name="videocam-outline" size={30} color="rgba(255,255,255,0.7)" />
        <ShortAvatar
          name={short.restaurantName ?? short.title ?? "Jatek"}
          imageUrl={avatarUrl}
        />
      </View>
    );
  }

  return (
    <>
      <Image
        source={{ uri: source }}
        style={s.videoImg}
        resizeMode="cover"
        onError={() => setSourceIndex((current) => current + 1)}
      />
      <ShortAvatar
        name={short.restaurantName ?? short.title ?? "Jatek"}
        imageUrl={avatarUrl}
      />
    </>
  );
}

function VipBannerCard({
  bgColor,
  imageUrl,
  onPress,
}: {
  bgColor: string;
  imageUrl?: string | null;
  onPress: () => void;
}) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [pressed && { opacity: 0.92 }]}>
      <LinearGradient
        colors={[bgColor, PINK_DEEP]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={s.vipCard}
      >
        {imageUrl ? (
          <Image source={{ uri: resolveMediaUrl(imageUrl) }} style={s.vipCardImg} resizeMode="cover" />
        ) : null}
      </LinearGradient>
    </Pressable>
  );
}

function PopularSectionWaves() {
  return (
    <View pointerEvents="none" style={s.popularWaves}>
      <Svg width="100%" height="100%" viewBox="0 0 100 100" preserveAspectRatio="none">
        <Path
          d="M0 6 C17 0 32 13 49 7 C67 1 83 14 100 6 L100 24 C82 31 67 18 49 24 C31 31 16 18 0 25 Z"
          fill="#FDE8F0"
          opacity={0.72}
        />
        <Path
          d="M0 38 C19 30 34 46 52 38 C70 31 85 45 100 37 L100 57 C82 64 68 50 50 57 C31 64 16 50 0 58 Z"
          fill="#FAD6E4"
          opacity={0.42}
        />
        <Path
          d="M0 75 C17 68 32 82 50 75 C69 68 84 82 100 74 L100 96 C82 100 66 88 48 94 C29 100 15 88 0 96 Z"
          fill="#FDE8F0"
          opacity={0.68}
        />
      </Svg>
    </View>
  );
}

function HomeSectionHeader({ title, onPress }: { title: string; onPress: () => void }) {
  return (
    <View style={s.popularHeaderRow}>
      <View style={s.popularTitleBadge}>
        <Text style={s.popularTitle} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.72}>{title}</Text>
      </View>
      <TouchableOpacity
        onPress={onPress}
        activeOpacity={0.85}
        style={s.sectionArrowButton}
        accessibilityRole="button"
        accessibilityLabel={`Ouvrir la section : ${title}`}
      >
        <Ionicons name="arrow-forward" size={20} color="#FFFFFF" />
      </TouchableOpacity>
    </View>
  );
}

function RestaurantTile({
  restaurant,
  width,
  onPress,
  showDistance = false,
}: {
  restaurant: Restaurant;
  width: number;
  onPress: () => void;
  showDistance?: boolean;
}) {
  // imageUrl is the dashboard's canonical banner field. coverImageUrl is only
  // retained as a fallback for older restaurant records.
  const img = restaurant.imageUrl || restaurant.coverImageUrl;
  const badgeText = (restaurant as any).badge || (restaurant as any).promoText;
  const isNew = badgeText?.toLowerCase() === "nouveau";
  const badgeBg = isNew ? "#4ADE80" : PINK;

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        s.tile,
        { width },
        pressed && { opacity: 0.9, transform: [{ scale: 0.98 }] },
      ]}
    >
      <View style={s.tileImgWrap}>
        {img ? (
          <Image source={{ uri: resolveMediaUrl(img) }} style={s.tileImg} resizeMode="cover" />
        ) : (
          <View style={[s.tileImg, s.tileImgPlaceholder]}>
            <Ionicons name="restaurant-outline" size={34} color={TEXT_MUTED} />
          </View>
        )}
        {/* Badge Top Left */}
        {badgeText ? (
          <View style={[s.tileBadge, { backgroundColor: badgeBg }]}>
            <Text style={s.tileBadgeTxt}>{badgeText}</Text>
          </View>
        ) : null}

        {/* Logo Top Right */}
        <View style={s.tileLogoSq}>
          {restaurant.logoUrl ? (
            <Image source={{ uri: resolveMediaUrl(restaurant.logoUrl) }} style={s.tileLogoSqImg} resizeMode="contain" />
          ) : (
            <Text style={s.tileLogoSqText}>{restaurant.name.charAt(0).toUpperCase()}</Text>
          )}
        </View>
      </View>
      <View style={s.tileBody}>
        <Text style={s.tileName} numberOfLines={1}>
          {restaurant.name}
        </Text>
        <View style={s.tileMetaRow}>
          <View style={s.tileMetaItem}>
            <Ionicons name="time-outline" size={13} color={TEXT_MUTED} />
            <Text style={s.tileMetaTxt}>
              {restaurant.deliveryTime != null ? `${restaurant.deliveryTime} - ${restaurant.deliveryTime + 10} min` : "20 - 30 min"}
            </Text>
          </View>
          {restaurant.deliveryFee != null && (
            <View style={s.tileMetaItem}>
              <Ionicons
                name="location-outline"
                size={13}
                color={TEXT_MUTED}
              />
              <Text style={s.tileMetaTxt}>{formatMad(restaurant.deliveryFee)} MAD</Text>
            </View>
          )}
        </View>
      </View>
    </Pressable>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Home Screen
// ─────────────────────────────────────────────────────────────────────────────

export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { selectedAddress, itemCount } = useCart();

  const [search, setSearch] = useState("");
  const [activeCat, setActiveCat] = useState<string | null>(null);
  // The home feed includes every commerce type, not only restaurants.
  const [activeBusinessType, setActiveBusinessType] = useState("");
  const [activeLabel, setActiveLabel] = useState("Tous les commerces");

  const [onlyOpen, setOnlyOpen] = useState<boolean | undefined>(undefined);
  const [addressPickerOpen, setAddressPickerOpen] = useState(false);
  const [shortsVisible, setShortsVisible] = useState(false);
  const [initialShort, setInitialShort] = useState(0);
  const [cartSheetVisible, setCartSheetVisible] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [rotationSeed, setRotationSeed] = useState(() => Math.floor(Date.now() / 86_400_000));
  const {
    data: publicAppConfig,
    refetch: refetchAppConfig,
  } = useQuery({
    queryKey: ["public-app-config"],
    queryFn: getPublicAppConfig,
    staleTime: 60_000,
  });
  const homeSections = useMemo<HomeSectionConfig[]>(() => {
    const configured = publicAppConfig?.homeSections;
    if (!configured || typeof configured !== "object" || Array.isArray(configured)) return DEFAULT_HOME_SECTIONS;
    const validKeys = new Set(DEFAULT_HOME_SECTIONS.map((section) => section.key));
    const configuredOrder = Array.isArray(publicAppConfig.homeOrder)
      ? publicAppConfig.homeOrder.filter((key): key is HomeSectionConfig["key"] => validKeys.has(key as HomeSectionConfig["key"]))
      : [];
    const orderedKeys = [
      ...configuredOrder,
      ...DEFAULT_HOME_SECTIONS.map((section) => section.key).filter((key) => !configuredOrder.includes(key)),
    ];
    const normalized = orderedKeys.flatMap((key) => {
      const section = configured[key];
      if (!section || typeof section.title !== "string") return [];
      return [{
        key,
        ...section,
        title: section.title.trim() || DEFAULT_HOME_SECTIONS.find((item) => item.key === key)!.title,
        limit: Math.min(30, Math.max(1, Number(section.limit) || 6)),
      }];
    });
    const configuredKeys = new Set(normalized.map((section) => section.key));
    return [
      ...normalized,
      ...DEFAULT_HOME_SECTIONS.filter((section) => !configuredKeys.has(section.key)),
    ];
  }, [publicAppConfig]);
  const sectionConfig = (key: HomeSectionConfig["key"]) =>
    homeSections.find((section) => section.key === key)
    ?? DEFAULT_HOME_SECTIONS.find((section) => section.key === key)!;
  const popularConfig = sectionConfig("popular");
  const newProductsConfig = sectionConfig("new_products");
  const newRestaurantsConfig = sectionConfig("new_restaurants");
  const shopsConfig = sectionConfig("shops");

  const params = useMemo<ListRestaurantsParams>(() => {
    const p: ListRestaurantsParams = {};
    if (activeBusinessType) p.businessType = activeBusinessType;
    if (activeCat) p.category = activeCat;
    if (search.trim()) p.search = search.trim();
    if (onlyOpen !== undefined) p.isOpen = onlyOpen;
    return p;
  }, [activeBusinessType, activeCat, onlyOpen, search]);

  const {
    data: restaurants,
    isLoading,
    isError: restaurantsError,
    refetch: refetchRestaurants,
  } = useListRestaurants(params);
  const {
    data: homeRestaurants,
    isLoading: homeRestaurantsLoading,
    isError: homeRestaurantsError,
    refetch: refetchHomeRestaurants,
  } = useListRestaurants({});
  const { data: featuredPartners, refetch: refetchFeatured } = useGetFeaturedRestaurants();
  const { data: apiCategories, isLoading: categoriesLoading, refetch: refetchCategories } = useListCategories();
  const { data: ads, refetch: refetchAds } = useAds();
  const {
    data: shortsData,
    isLoading: shortsLoading,
    isError: shortsError,
    refetch: refetchShorts,
  } = useShorts();
  const {
    data: recommendedProducts,
    isLoading: recommendationsLoading,
    isError: recommendationsError,
    refetch: refetchRecommendations,
  } = useQuery({
    queryKey: ["home-recommendations", activeBusinessType, popularConfig.source, popularConfig.limit],
    queryFn: () => listRecommendedProducts({
      limit: popularConfig.limit,
      businessType: activeBusinessType || undefined,
      sort: popularConfig.source === "newest" ? "newest" : popularConfig.source === "promos" ? "promos" : "catalog",
    }),
    staleTime: 60_000,
    enabled: popularConfig.visible,
  });
  const {
    data: newestProducts,
    isLoading: newestProductsLoading,
    isError: newestProductsError,
    refetch: refetchNewestProducts,
  } = useQuery({
    queryKey: ["home-new-products", activeBusinessType, newProductsConfig.source, newProductsConfig.limit],
    queryFn: () => listRecommendedProducts({
      limit: newProductsConfig.limit,
      businessType: activeBusinessType || undefined,
      sort: newProductsConfig.source === "popular"
        ? "catalog"
        : newProductsConfig.source === "promos"
          ? "promos"
          : "newest",
    }),
    staleTime: 60_000,
    enabled: newProductsConfig.visible,
  });

  // Ads managed from the admin dashboard (Bannières page).
  const vipAds = useMemo(() => (ads ?? []).filter((a) => a.type === "vip_banner" || a.type === "hero"), [ads]);
  // Ad taps: internal path → router.push, absolute URL → system browser.
  const openAdLink = (ad: Ad) => {
    const url = ad.linkUrl?.trim();
    if (!url) return;
    if (url.startsWith("/")) router.push(url as any);
    else Linking.openURL(url).catch(() => {});
  };

  // Categories are 100% managed from the admin dashboard (ma.jatek.app/admin).
  // "service_shortcut" type → quick-action row; "category" type → Explorer slider.
  // Legacy rows with no type field fall back to "category".
  const serviceShortcuts = useMemo(() => {
    const parents = (apiCategories ?? []).filter(
      (c: any) => c.parentId == null && c.isActive !== false
        && c.type === "service_shortcut"
        && c.businessType === "services",
    );
    return parents.map((c: any) => ({
      slug: c.slug,
      label: c.name,
      icon: (c.icon || "flash-outline") as any,
      accent: c.accentColor || PINK,
    }));
  }, [apiCategories]);

  const shopCategories = useMemo(() => {
    // A supermarket/grocery parent must remain visible even if legacy admin
    // data carries an incorrect shortcut type. Only service-business
    // shortcuts belong in the quick-action row.
    const parents = (apiCategories ?? []).filter(
      (c: any) => c.parentId == null && c.isActive !== false
        && !(c.type === "service_shortcut" && c.businessType === "services"),
    );
    return parents.map((c: any) => ({
      slug: c.slug,
      label: c.name,
      icon: (c.icon || "storefront") as any,
      accent: c.accentColor || PINK,
    }));
  }, [apiCategories]);
  // Shorts are 100% managed from the admin dashboard (Shorts CRUD).
  const shorts = useMemo(() => shortsData ?? [], [shortsData]);
  const restaurantAvatarById = useMemo(
    () => new Map(
      (featuredPartners ?? []).map((restaurant) => [
        restaurant.id,
        restaurant.imageUrl ?? restaurant.coverImageUrl ?? null,
      ]),
    ),
    [featuredPartners],
  );
  const orderedRestaurants = useMemo(() => {
    return rotateItems(restaurants ?? [], rotationSeed);
  }, [restaurants, rotationSeed]);
  const newestRestaurants = useMemo(() => {
    const items = [...(homeRestaurants ?? [])];
    if (newRestaurantsConfig.source === "new_restaurants") {
      items.sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
    }
    return items.slice(0, newRestaurantsConfig.limit);
  }, [homeRestaurants, newRestaurantsConfig.limit, newRestaurantsConfig.source]);
  const shopRestaurants = useMemo(() => {
    const items = shopsConfig.source === "all_restaurants"
      ? [...(homeRestaurants ?? [])]
      : (homeRestaurants ?? []).filter((restaurant) => restaurant.businessType === "shop");
    return items.slice(0, shopsConfig.limit);
  }, [homeRestaurants, shopsConfig.limit, shopsConfig.source]);

  const onRefresh = async () => {
    setRefreshing(true);
    setRotationSeed((seed) => seed + 1);
    try {
      await refreshAll([
        refetchRestaurants,
        refetchFeatured,
        refetchCategories,
        refetchAds,
        refetchShorts,
        refetchRecommendations,
        refetchNewestProducts,
        refetchHomeRestaurants,
        refetchAppConfig,
      ]);
    } finally {
      setRefreshing(false);
    }
  };

  const goRestaurant = (id: number) =>
    router.push({ pathname: "/restaurant/[id]", params: { id: String(id) } });

  const addressLabel = selectedAddress || "Livraison en 5R22+CVC2";
  const greetingLabel = user?.name?.trim() ? `Bonjour, ${user.name.trim()}` : "Bonjour";
  const currentLabel = activeLabel;

  const openShort = (index: number) => {
    setInitialShort(index);
    setShortsVisible(true);
  };

  const goRecommendedProduct = (product: { restaurantId: number; id: number }) =>
    router.push({
      pathname: "/restaurant/[id]",
      params: { id: String(product.restaurantId), productId: String(product.id) },
    });
  const categorySlugForBusinessType = (businessType: string) =>
    (apiCategories ?? []).find(
      (category: any) =>
        category.parentId == null
        && category.isActive !== false
        && category.businessType === businessType,
    )?.slug as string | undefined;
  const goSectionList = (section: HomeSectionConfig) => {
    if (section.key === "shops") {
      const slug = categorySlugForBusinessType("shop");
      if (slug) {
        router.push({ pathname: "/category/[slug]", params: { slug } });
        return;
      }
    }
    if (section.key === "new_restaurants") {
      const slug = categorySlugForBusinessType("restaurant");
      if (slug) {
        router.push({ pathname: "/category/[slug]", params: { slug } });
        return;
      }
    }
    router.push("/restaurants" as any);
  };

  // Tab bar leaves ~84pt of empty space at the bottom — pad accordingly.
  // Real rendered tab bar height — keeps the floating bar glued to its top edge
  // on every device (handles bottom safe-area / home indicator automatically).
  const tabBarPad = useBottomTabBarHeight();

  return (
    <View style={s.root}>
      <ScrollView
        style={s.scroll}
        contentContainerStyle={{ paddingBottom: tabBarPad + 72 }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={PINK} />}
      >
        {/* ─── Pink header with wavy bottom edge ─── */}
        <View style={s.headerWrap}>
          <View
            style={[
              s.header,
                // Keep the safe-area backdrop inside the pink header while
                // reducing the empty vertical band above the search field.
                { paddingTop: insets.top + 8 },
            ]}
          >
            {/* Top row: menu + orders + profile */}
            <View style={s.headerTopRow}>
              {/* hamburger — opens side menu */}
              <TouchableOpacity
                activeOpacity={0.8}
                style={s.iconBtn}
                onPress={() => setMenuOpen(true)}
                accessibilityLabel="Ouvrir le menu"
              >
                <Ionicons name="menu" size={24} color="#fff" />
              </TouchableOpacity>

              <TouchableOpacity
                activeOpacity={0.85}
                style={s.headerIdentity}
                onPress={() => setAddressPickerOpen(true)}
                accessibilityRole="button"
                accessibilityLabel={`Adresse de livraison : ${addressLabel}`}
              >
                <Text style={s.headerGreeting} numberOfLines={1}>{greetingLabel}</Text>
                <View style={s.headerAddressRow}>
                  <Ionicons name="location" size={15} color="#fff" />
                  <Text style={s.headerAddress} numberOfLines={1}>{addressLabel}</Text>
                  <Ionicons name="chevron-down" size={16} color="#fff" />
                </View>
              </TouchableOpacity>

              {/* right actions */}
              <View style={s.headerActions}>
                <TouchableOpacity
                  activeOpacity={0.85}
                  style={s.iconBtn}
                  onPress={() => router.push("/cart" as any)}
                  accessibilityLabel="Mon panier"
                >
                  <Ionicons name="bag-handle" size={22} color="#fff" />
                  {itemCount > 0 && (
                    <View style={s.headerBadge}>
                      <Text style={s.headerBadgeTxt}>{itemCount > 9 ? "9+" : itemCount}</Text>
                    </View>
                  )}
                </TouchableOpacity>

                <TouchableOpacity
                  activeOpacity={0.85}
                  style={s.iconBtn}
                  onPress={() => router.push("/(tabs)/profile" as any)}
                  accessibilityLabel="Mon profil"
                >
                  <Ionicons name="person-circle-outline" size={24} color="#fff" />
                </TouchableOpacity>
              </View>
            </View>

            {/* Search bar */}
            <View style={s.searchBox}>
              <Ionicons name="search" size={18} color="#9CA3AF" />
              <TextInput
                style={s.searchInput}
                placeholder="Rechercher dans Jatek..."
                placeholderTextColor="#9CA3AF"
                value={search}
                onChangeText={setSearch}
                returnKeyType="search"
              />
              {search.length > 0 && (
                <TouchableOpacity onPress={() => setSearch("")} hitSlop={8}>
                  <Ionicons name="close-circle" size={18} color="#9CA3AF" />
                </TouchableOpacity>
              )}
            </View>
          </View>

          {/* Wavy bottom edge — extends the pink down with an organic curve */}
          <WaveEdge color={PINK} height={28} />
        </View>

        <View style={s.shopCategorySpacer} accessibilityElementsHidden importantForAccessibility="no" />

        {/* ─── Service shortcuts row (type=service_shortcut from admin) ─── */}
        {serviceShortcuts.length > 0 && (
          <Animated.View
            entering={FadeInDown.delay(60).duration(450).springify()}
            style={s.serviceShortcutsWrap}
          >
            <Animated.ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              nestedScrollEnabled
              contentContainerStyle={[s.shopCatsContent, { paddingTop: 10, paddingBottom: 6 }]}
            >
              {serviceShortcuts.map((sc) => (
                <Pressable
                  key={sc.slug}
                  onPress={() => router.push({ pathname: "/category/[slug]", params: { slug: sc.slug } })}
                  style={({ pressed }) => [s.shopCatItem, { width: 80 }, pressed && { opacity: 0.8, transform: [{ scale: 0.95 }] }]}
                >
                  <View style={[s.shopCatTile, { backgroundColor: sc.accent, width: 60, height: 60 }]}>
                    <Ionicons name={sc.icon} size={28} color="#fff" />
                  </View>
                  <Text
                    style={[s.shopCatLabel, { color: TEXT_DARK, fontWeight: "600" }]}
                    numberOfLines={2}
                    adjustsFontSizeToFit
                    minimumFontScale={0.7}
                  >
                    {sc.label}
                  </Text>
                </Pressable>
              ))}
            </Animated.ScrollView>
          </Animated.View>
        )}

        {/* ─── Shop categories horizontal slider ─── */}
        {categoriesLoading && shopCategories.length === 0 && (
          <View style={{ paddingVertical: 24, alignItems: "center" }}>
            <ActivityIndicator size="small" color={PINK} />
          </View>
        )}
        {!categoriesLoading && shopCategories.length === 0 && (
          <Text style={{ paddingHorizontal: 16, paddingVertical: 16, color: TEXT_MUTED, fontSize: 13 }}>
            Aucune catégorie disponible pour le moment.
          </Text>
        )}
        <Animated.ScrollView
          entering={FadeInDown.delay(140).duration(500).springify()}
          horizontal
          showsHorizontalScrollIndicator={false}
          nestedScrollEnabled
          style={s.shopCatsScroll}
          contentContainerStyle={s.shopCatsContent}
        >
          {shopCategories.map((c) => (
            <Pressable
              key={c.slug}
              onPress={() => router.push({ pathname: "/category/[slug]", params: { slug: c.slug } })}
              style={({ pressed }) => [s.shopCatItem, pressed && { opacity: 0.85, transform: [{ scale: 0.96 }] }]}
            >
              <View style={[s.shopCatTile, { backgroundColor: c.accent + "1A" }]}>
                <Ionicons name={c.icon} size={34} color={c.accent} />
              </View>
              <Text
                style={[s.shopCatLabel, { color: c.accent }]}
                numberOfLines={2}
                adjustsFontSizeToFit
                minimumFontScale={0.65}
              >
                {c.label}
              </Text>
            </Pressable>
          ))}
        </Animated.ScrollView>

        <Animated.ScrollView
          entering={FadeInDown.delay(260).duration(550).springify()}
          horizontal
          showsHorizontalScrollIndicator={false}
          nestedScrollEnabled
          contentContainerStyle={s.vipScrollRow}
          decelerationRate="fast"
            snapToInterval={VIP_CARD_W + 12}
        >
          {vipAds.length > 0
            ? vipAds.slice(0, 6).map((ad) => (
                <VipBannerCard
                  key={`ad-${ad.id}`}
                  bgColor={ad.bgColor || PINK}
                  imageUrl={ad.imageUrl}
                  onPress={() => openAdLink(ad)}
                />
              ))
            : (featuredPartners ?? []).slice(0, 6).map((r) => (
                <VipBannerCard
                  key={`vip-${r.id}`}
                  bgColor={PINK}
                  imageUrl={r.imageUrl ?? r.coverImageUrl}
                  onPress={() => {
                    trackBannerClick(r.id);
                    goRestaurant(r.id);
                  }}
                />
              ))}
          {vipAds.length === 0 && (featuredPartners ?? []).length === 0 && (
            <Text style={s.emptyTxt}>Aucune offre disponible pour le moment</Text>
          )}
        </Animated.ScrollView>

        <JatekScrollingBanner />

        {/* ─── Configurable Home sections ─── */}
        {homeSections
          .filter((section) => section.visible)
          .sort((a, b) => {
            const order = ["new_products", "new_restaurants", "popular", "shops"];
            const aIndex = order.indexOf(a.key);
            const bIndex = order.indexOf(b.key);
            return (aIndex < 0 ? order.length : aIndex) - (bIndex < 0 ? order.length : bIndex);
          })
          .map((section, sectionIndex) => {
          const isProductSection = section.key === "popular" || section.key === "new_products";
           const hasPinkWaveBackground = section.key === "popular";
          const products = section.key === "popular" ? recommendedProducts : newestProducts;
          const productsLoading = section.key === "popular" ? recommendationsLoading : newestProductsLoading;
          const productsError = section.key === "popular" ? recommendationsError : newestProductsError;
          const retryProducts = section.key === "popular" ? refetchRecommendations : refetchNewestProducts;
          const commerce = section.key === "new_restaurants" ? newestRestaurants : shopRestaurants;

          return (
            <Animated.View
              key={section.key}
              entering={FadeInDown.delay(380 + sectionIndex * 80).duration(500).springify()}
              style={[
                s.homeFeedSection,
                hasPinkWaveBackground && s.pinkWaveSection,
              ]}
            >
              {hasPinkWaveBackground ? <PopularSectionWaves /> : null}
              <HomeSectionHeader title={section.title} onPress={() => goSectionList(section)} />

              {isProductSection ? (
                productsLoading ? (
                  <ActivityIndicator color={PINK} style={s.sectionLoader} />
                ) : productsError ? (
                  <LoadRetry message="Impossible de charger les produits." onRetry={() => retryProducts()} />
                ) : products && products.length > 0 ? (
                  section.key === "new_products" ? (
                    <ScrollView
                      horizontal
                      pagingEnabled
                      nestedScrollEnabled
                      showsHorizontalScrollIndicator={false}
                      decelerationRate="fast"
                      snapToInterval={NEW_PRODUCT_PAGE_W}
                    >
                      {Array.from(
                        { length: Math.ceil(products.length / 3) },
                        (_, pageIndex) => (
                          <View key={`new-products-${pageIndex}`} style={s.newProductsPage}>
                            {products.slice(pageIndex * 3, pageIndex * 3 + 3).map((product) => (
                              <RecommendedProductCard
                                key={`${product.restaurantId}-${product.id}`}
                                product={product}
                                width={NEW_PRODUCT_CARD_W}
                                compact
                                onPress={() => goRecommendedProduct(product)}
                              />
                            ))}
                          </View>
                        ),
                      )}
                    </ScrollView>
                  ) : (
                    <ScrollView
                      horizontal
                      showsHorizontalScrollIndicator={false}
                      decelerationRate="fast"
                      nestedScrollEnabled
                      contentContainerStyle={s.popularProductsRow}
                    >
                      {products.map((product) => (
                        <RecommendedProductCard
                          key={`${product.restaurantId}-${product.id}`}
                          product={product}
                          width={RECOMMENDATION_CARD_W}
                          compact
                          onPress={() => goRecommendedProduct(product)}
                        />
                      ))}
                    </ScrollView>
                  )
                ) : (
                  <Text style={s.sectionEmptyTxt}>Aucun produit disponible pour le moment</Text>
                )
              ) : homeRestaurantsLoading ? (
                <ActivityIndicator color={PINK} style={s.sectionLoader} />
              ) : homeRestaurantsError ? (
                <LoadRetry message="Impossible de charger les commerces." onRetry={() => refetchHomeRestaurants()} />
              ) : commerce.length > 0 ? (
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  nestedScrollEnabled
                  contentContainerStyle={s.homeCommerceRow}
                >
                  {commerce.map((restaurant) => (
                    <RestaurantTile
                      key={`${section.key}-${restaurant.id}`}
                      restaurant={restaurant}
                      width={250}
                      onPress={() => goRestaurant(restaurant.id)}
                    />
                  ))}
                </ScrollView>
              ) : (
                <Text style={s.sectionEmptyTxt}>Aucun commerce disponible pour le moment</Text>
              )}
            </Animated.View>
          );
        })}

        {/* ─── Shorts ─── */}
        <Animated.View
          entering={FadeInDown.delay(700).duration(550).springify()}
          style={s.homeFeedSection}
        >
          <HomeSectionHeader
            title="Shorts"
            onPress={() => { setInitialShort(0); setShortsVisible(true); }}
          />
          {shortsLoading ? (
            <ActivityIndicator color={PINK} style={s.sectionLoader} />
          ) : shortsError ? (
            <LoadRetry message="Impossible de charger les vidéos." onRetry={() => refetchShorts()} />
          ) : shorts.length > 0 ? (
            <ScrollView
              horizontal
              pagingEnabled
              nestedScrollEnabled
              showsHorizontalScrollIndicator={false}
              decelerationRate="fast"
              snapToInterval={SHORT_PAGE_W}
            >
              {Array.from({ length: Math.ceil(shorts.length / SHORT_PAGE_SIZE) }, (_, pageIndex) => (
                <View key={`shorts-page-${pageIndex}`} style={s.shortsPage}>
                  <View style={s.videosGrid}>
                    {shorts
                      .slice(pageIndex * SHORT_PAGE_SIZE, pageIndex * SHORT_PAGE_SIZE + SHORT_PAGE_SIZE)
                      .map((short, offset) => {
                        const index = pageIndex * SHORT_PAGE_SIZE + offset;
                        return (
                          <Pressable
                            key={short.id}
                            onPress={() => openShort(index)}
                            style={({ pressed }) => [s.videoCard, pressed && { opacity: 0.9 }]}
                          >
                            <ShortThumbnail
                              short={short}
                              avatarUrl={
                                short.restaurantLogoUrl
                                ?? (short.restaurantId != null ? restaurantAvatarById.get(short.restaurantId) : null)
                              }
                            />
                          </Pressable>
                        );
                      })}
                  </View>
                </View>
              ))}
            </ScrollView>
          ) : (
            <Text style={s.emptyTxt}>Aucune vidéo disponible pour le moment</Text>
          )}
        </Animated.View>

        <View style={s.homeSectionSpacer} accessibilityElementsHidden importantForAccessibility="no" />

        {/* ─── Restauration (2-column grid) ─── */}
        <Animated.View entering={FadeInDown.delay(740).duration(550).springify()} style={s.gridSection}>
          <View style={s.nearbyHeaderRow}>
            <Text style={s.nearbyTitle}>Restauration</Text>
            <TouchableOpacity
              onPress={() => router.push("/restaurants" as any)}
              activeOpacity={0.85}
              style={s.sectionArrowButton}
              accessibilityRole="button"
              accessibilityLabel={`Voir plus : ${currentLabel}`}
            >
              <Ionicons name="arrow-forward" size={20} color="#FFFFFF" />
            </TouchableOpacity>
          </View>
          {isLoading ? (
            <ActivityIndicator color={PINK} style={{ marginVertical: 24 }} />
          ) : restaurantsError ? (
              <LoadRetry message="Impossible de charger les commerces." onRetry={() => refetchRestaurants()} />
          ) : (
            <View style={s.grid}>
              {orderedRestaurants.map((r, i) => (
                <Animated.View
                  key={r.id}
                  entering={FadeInDown.delay(800 + i * 60).duration(420).springify()}
                  style={{ width: GRID_CARD_W }}
                >
                  <RestaurantTile
                    restaurant={r}
                    width={GRID_CARD_W}
                    onPress={() => goRestaurant(r.id)}
                  />
                </Animated.View>
              ))}
            </View>
          )}
        </Animated.View>
      </ScrollView>
      <AddressQuickPicker visible={addressPickerOpen} onClose={() => setAddressPickerOpen(false)} />
      <CartPreviewSheet visible={cartSheetVisible} onClose={() => setCartSheetVisible(false)} />
      <ShortPlayerModal
        visible={shortsVisible}
        shorts={shorts}
        initialIndex={Math.min(initialShort, Math.max(shorts.length - 1, 0))}
        onClose={() => setShortsVisible(false)}
      />
      <SideMenu visible={menuOpen} onClose={() => setMenuOpen(false)} />
    </View>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Styles
// ─────────────────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: BG },
  scroll: { flex: 1, backgroundColor: BG },

  // ── Header ──
  headerWrap: {
    backgroundColor: PINK,
    position: "relative",
  },
  header: {
    paddingHorizontal: 16,
    paddingBottom: 14,
    backgroundColor: PINK,
  },
  headerTopRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  headerActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  headerIdentity: {
    flex: 1,
    minWidth: 0,
    marginHorizontal: 8,
  },
  headerGreeting: {
    color: "#fff",
    fontSize: 18,
    lineHeight: 22,
    fontFamily: "Inter_900Black",
  },
  headerAddressRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    marginTop: 2,
  },
  headerAddress: {
    flex: 1,
    minWidth: 0,
    color: "rgba(255,255,255,0.9)",
    fontSize: 12,
    lineHeight: 16,
    fontFamily: "Inter_500Medium",
  },
  iconBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: "center",
    justifyContent: "center",
  },
  headerBadge: {
    position: "absolute",
    top: 2,
    right: 2,
    minWidth: 16,
    height: 16,
    paddingHorizontal: 3,
    borderRadius: 8,
    backgroundColor: "#FFD400",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1.5,
    borderColor: PINK,
  },
  headerBadgeTxt: {
    color: "#0A1B3D",
    fontSize: 9,
    fontFamily: "Inter_700Bold",
    lineHeight: 11,
  },
  searchBox: {
    height: 48,
    borderRadius: 26,
    backgroundColor: "#fff",
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    gap: 10,
    shadowColor: "#000",
    shadowOpacity: 0.08,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: TEXT_DARK,
    fontFamily: "Inter_400Regular",
    height: 44,
    padding: 0,
  },
  shopCatsScroll: {
    marginTop: 18,
  },
  serviceShortcutsWrap: {
    // WaveEdge is absolutely positioned and visually extends below the
    // header's layout box. Keep the first icon rail below that painted area.
    marginTop: 18,
  },
  shopCategorySpacer: {
    height: 10,
  },
  shopCatsContent: {
    paddingHorizontal: 16,
    gap: 12,
    paddingBottom: 4,
  },
  shopCatItem: {
    alignItems: "center",
    gap: 8,
    width: 90,
  },
  shopCatTile: {
    width: 70,
    height: 70,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
  },
  shopCatLabel: {
    fontSize: 11,
    fontFamily: "Inter_700Bold",
    textAlign: "center",
    lineHeight: 14,
  },
  homeSectionSpacer: {
    height: 10,
  },
  homeFeedSection: {
    position: "relative",
    overflow: "hidden",
    paddingHorizontal: 16,
    paddingBottom: 20,
    marginHorizontal: 0,
    marginTop: 12,
    backgroundColor: "#FFFFFF",
  },
  pinkWaveSection: {
    backgroundColor: "#FFF7FA",
  },
  popularWaves: {
    ...StyleSheet.absoluteFillObject,
  },
  popularHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 12,
    gap: 10,
  },
  popularTitleBadge: {
    flexShrink: 1,
    paddingVertical: 2,
  },
  popularTitle: {
    color: TEXT_DARK,
    fontSize: 23,
    fontFamily: "Inter_900Black",
    letterSpacing: -0.5,
  },
  popularProductsRow: {
    paddingHorizontal: 14,
    gap: RECOMMENDATION_GAP,
    paddingBottom: 4,
  },
  newProductsPage: {
    width: NEW_PRODUCT_PAGE_W,
    paddingHorizontal: 14,
    flexDirection: "row",
    gap: RECOMMENDATION_GAP,
  },
  homeCommerceRow: {
    paddingHorizontal: 14,
    gap: 10,
    paddingBottom: 4,
  },
  sectionLoader: {
    marginVertical: 18,
  },
  sectionEmptyTxt: {
    color: TEXT_MUTED,
    fontFamily: "Inter_500Medium",
    fontSize: 13,
    paddingHorizontal: 16,
    paddingVertical: 18,
    textAlign: "center",
  },
  // ── Services row ──
  servicesRow: {
    flexDirection: "row",
    paddingHorizontal: 16,
    marginTop: 18,
    gap: 12,
  },
  serviceItem: {
    flex: 1,
    alignItems: "center",
    gap: 6,
  },
  serviceSquare: {
    width: "100%",
    aspectRatio: 1,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  serviceLabel: {
    fontSize: 11,
    fontFamily: "Inter_500Medium",
    color: TEXT_DARK,
    textAlign: "center",
  },

  // ── Pink pill categories ──
  pillsRow: {
    paddingHorizontal: 16,
    paddingTop: 18,
    gap: 18,
  },
  pillStack: { alignItems: "center", gap: 6 },
  pillCircle: {
    width: 64,
    height: 64,
    borderRadius: 22,
    overflow: "hidden",
    backgroundColor: PINK_SOFT,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: PINK,
    shadowOpacity: 0.08,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  pillCircleActive: {
    borderWidth: 2.5,
    borderColor: PINK,
  },
  pillImg: {
    width: "100%",
    height: "100%",
  },
  pillLabel: {
    fontSize: 12,
    fontFamily: "Inter_600SemiBold",
    color: TEXT_DARK,
  },

  // ── Promo banner (clean, no colored bg) ──
  promoBanner: {
    width: "100%",
    minHeight: 80,
    backgroundColor: "#fff",
    borderRadius: 18,
    paddingHorizontal: 18,
    paddingVertical: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderWidth: 1,
    borderColor: "#F0F0F5",
    shadowColor: PINK,
    shadowOpacity: 0.08,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
    overflow: "hidden",
    gap: 12,
  },
  promoBannerLeft: { flex: 1, minWidth: 0, gap: 3 },
  promoTagBadge: {
    alignSelf: "flex-start",
    backgroundColor: PINK_SOFT,
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  promoTagTxt: { fontSize: 10, fontFamily: "Inter_700Bold", color: PINK, letterSpacing: 0.6 },
  promoMinusClean: {
    fontSize: 28,
    fontFamily: "Inter_900Black",
    color: TEXT_DARK,
    letterSpacing: -0.5,
    lineHeight: 32,
  },
  promoCodeClean: {
    fontSize: 12,
    fontFamily: "Inter_500Medium",
    color: TEXT_MUTED,
    flexShrink: 1,
  },
  promoBrandWrap: { alignItems: "center", gap: 6, flexShrink: 0 },
  promoBrandClean: {
    fontSize: 24,
    fontFamily: "Inter_900Black",
    color: PINK,
    fontStyle: "italic",
    letterSpacing: -0.5,
  },
  promoMinus: { fontSize: 44, fontFamily: "Inter_900Black", color: "#fff", letterSpacing: -1.5, lineHeight: 48 },
  promoCode: { fontSize: 16, fontFamily: "Inter_700Bold", color: PINK, letterSpacing: 1, marginTop: 2 },
  promoBrand: { fontSize: 38, fontFamily: "Inter_900Black", color: "#fff", fontStyle: "italic", letterSpacing: -1 },

  // ── VIP partners horizontal slider ──
  vipScrollRow: {
    paddingHorizontal: 16,
    gap: 12,
    paddingTop: 14,
    paddingBottom: 2,
  },
  vipCard: {
    width: VIP_CARD_W,
    height: 156,
    borderRadius: 20,
    overflow: "hidden",
  },
  vipCardImg: {
    ...StyleSheet.absoluteFillObject,
    opacity: 1,
  },

  sectionArrowButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#E51A73",
    shadowColor: "#B41059",
    shadowOpacity: 0.2,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 3,
  },

  // ── Available product recommendations ──
  recommendationsGrid: {
    paddingHorizontal: 16,
    columnGap: RECOMMENDATION_GAP,
    rowGap: RECOMMENDATION_GAP,
    paddingTop: 14,
    paddingBottom: 2,
    flexDirection: "row",
    flexWrap: "wrap",
  },
  recommendationsPager: {
    flexGrow: 1,
  },
  recommendationsPage: {
    width: SCREEN_W,
  },
  // ── Videos ──
  shortsPage: {
    width: SHORT_PAGE_W,
  },
  videosGrid: {
    paddingHorizontal: SHORT_SIDE,
    columnGap: SHORT_GAP,
    rowGap: SHORT_GAP,
    flexDirection: "row",
    flexWrap: "wrap",
    paddingBottom: 4,
    paddingTop: 2,
  },
  videoCard: {
    width: SHORT_CARD_W,
    height: SHORT_CARD_H,
    borderRadius: 8,
    backgroundColor: "#202020",
    overflow: "hidden",
    position: "relative",
  },
  videoImg: {
    ...StyleSheet.absoluteFillObject,
    width: undefined,
    height: undefined,
  },
  videoImgPlaceholder: {
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#111827",
  },
  shortAvatarRing: {
    position: "absolute",
    top: 8,
    left: 8,
    width: 44,
    height: 44,
    borderRadius: 999,
    borderWidth: 2,
    borderColor: SHORT_BORDER,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
  },
  shortAvatarImageFrame: {
    position: "absolute",
    top: 4,
    right: 4,
    bottom: 4,
    left: 4,
    borderRadius: 999,
    backgroundColor: "#FFFFFF",
    overflow: "hidden",
    padding: 3,
    alignItems: "center",
    justifyContent: "center",
  },
  shortAvatarImage: {
    width: "100%",
    height: "100%",
  },
  shortAvatarInitials: {
    color: SHORT_BORDER,
    fontFamily: "Inter_700Bold",
    fontSize: 14,
  },
  videoScrim: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(10,27,61,0.35)",
  },
  // play icon centered over the card
  videoPlayWrap: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  // title + gradient pinned to the bottom
  videoBottom: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(10,27,61,0.58)",
    paddingHorizontal: 8,
    paddingVertical: 8,
  },
  videoTitle: {
    color: "#fff",
    fontSize: 11,
    fontFamily: "Inter_700Bold",
    lineHeight: 15,
  },
  loadRetry: {
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 24,
    paddingVertical: 20,
    gap: 7,
  },
  loadRetryText: {
    color: TEXT_MUTED,
    fontFamily: "Inter_500Medium",
    fontSize: 13,
    textAlign: "center",
  },
  loadRetryButton: {
    backgroundColor: PINK,
    borderRadius: 18,
    paddingHorizontal: 15,
    paddingVertical: 8,
  },
  loadRetryButtonText: { color: "#fff", fontFamily: "Inter_700Bold", fontSize: 12 },

  // ── Restaurant tiles (shared) ──
  horizontalRow: {
    paddingHorizontal: 16,
    gap: 12,
    paddingBottom: 4,
  },
  tile: {
    backgroundColor: "#fff",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#F0F0F5",
    overflow: "hidden",
    shadowColor: "#000",
    shadowOpacity: 0.04,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  tileImgWrap: {
    width: "100%",
    height: 120,
    position: "relative",
    backgroundColor: "#F3F4F6",
  },
  tileImg: { width: "100%", height: "100%" },
  tileImgPlaceholder: { alignItems: "center", justifyContent: "center", backgroundColor: "#F3F4F6" },
  tileBadge: {
    position: "absolute",
    top: 8,
    left: 8,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  tileBadgeTxt: {
    color: "#fff",
    fontSize: 11,
    fontFamily: "Inter_700Bold",
  },
  tileLogoSq: {
    position: "absolute",
    top: 8,
    right: 8,
    width: 44,
    height: 44,
    borderRadius: 10,
    backgroundColor: "#fff",
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
    shadowColor: "#000",
    shadowOpacity: 0.1,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
    padding: 2,
  },
  tileLogoSqImg: { width: "100%", height: "100%", borderRadius: 8 },
  tileLogoSqText: { color: TEXT_DARK, fontFamily: "Inter_700Bold", fontSize: 18 },
  tileBody: {
    paddingHorizontal: 12,
    paddingTop: 12,
    paddingBottom: 14,
    gap: 6,
  },
  tileName: {
    fontSize: 15,
    fontFamily: "Inter_700Bold",
    color: TEXT_DARK,
  },
  tileMetaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    flexWrap: "wrap",
  },
  tileMetaItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  tileMetaTxt: {
    fontSize: 12,
    fontFamily: "Inter_500Medium",
    color: TEXT_MUTED,
  },
  emptyTxt: {
    color: TEXT_MUTED,
    fontFamily: "Inter_400Regular",
    fontSize: 13,
    paddingHorizontal: 4,
  },

  // ── Grid section ──
  gridSection: {
    paddingHorizontal: 16,
    marginTop: 22,
  },
  nearbyHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    marginBottom: 16,
  },
  nearbyTitle: {
    flex: 1,
    color: TEXT_DARK,
    fontFamily: "Inter_900Black",
    fontSize: 23,
    letterSpacing: -0.5,
  },
  filterChip: {
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 11,
    paddingVertical: 7,
    borderRadius: 16,
    backgroundColor: PINK_SOFT,
    marginBottom: 14,
  },
  filterChipText: {
    color: PINK,
    fontSize: 12,
    fontFamily: "Inter_700Bold",
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: GRID_GAP,
  },

});
