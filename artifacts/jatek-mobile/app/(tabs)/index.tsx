import React, { useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  Dimensions,
  Image,
  Linking,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  useWindowDimensions,
} from "react-native";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useBottomTabBarHeight } from "@react-navigation/bottom-tabs";
import { useQuery } from "@tanstack/react-query";
import {
  useGetFeaturedRestaurants,
  useListCategories,
  useListRestaurants,
  type Restaurant,
} from "@workspace/api-client-react";

import { useCart } from "@/contexts/CartContext";
import { useShorts } from "@/hooks/useContent";
import {
  getPublicAppConfig,
  listAds,
  type Ad,
  listRecommendedProducts,
  type Short,
  type RecommendedProduct,
  type HomeSectionKey,
  type HomeSectionConfig,
} from "@/lib/api";
import { refreshAll } from "@/lib/mobileRefresh";
import { resolveMediaUrl } from "@/lib/mediaUrl";
import { AddressQuickPicker } from "@/components/AddressQuickPicker";
import { CartPreviewSheet } from "@/components/CartPreviewSheet";
import { SideMenu } from "@/components/SideMenu";
import { ShortPlayerModal } from "@/components/ShortPlayerModal";
import { ProductCard } from "@/components/ProductCard";
import { ShortCard } from "@/components/ShortCard";
import { StoreCard } from "@/components/StoreCard";
import { SectionHeader } from "@/components/SectionHeader";
import { WaveEdge } from "@/components/WaveEdge";
import { HomeSupportCard } from "@/components/HomeSupportCard";
import colors from "@/constants/colors";

const { width: SCREEN_WIDTH } = Dimensions.get("window");
const PINK = "#E91E63";
const NAVY = "#0F172A";
const MUTED = colors.light.mutedForeground;
const WHITE = colors.light.background;
// Brand colors composited at 5–7% over white; identical opaque wave fills
// avoid darker seams where the SVG overlaps its section by one pixel.
const SECTION_TINT = "#FEF3F7";
const OLIVE_TINT = "#FEFCEF";
const TURQUOISE_TINT = "#F0FAFB";
const HEADER_PINK = "#E91E63";
const HEADER_ACCENT = "#FFD0E0";
const CATEGORY_GAP = 8;
const CATEGORY_WIDTH = (SCREEN_WIDTH - 32 - CATEGORY_GAP * 3) / 4;
const SHORT_WIDTH = Math.min(138, Math.max(120, SCREEN_WIDTH * 0.32));
const STORE_WIDTH = Math.max(0, (SCREEN_WIDTH - 32 - 12) / 2);
const HORIZONTAL_PRODUCT_LIMIT = 12;
const DEFAULT_HOME_ORDER: HomeSectionKey[] = [
  "categories",
  "banners",
  "shorts",
  "popular",
  "new_restaurants",
  "new_products",
  "shops",
  "all",
  "free_delivery",
  "newest",
  "support",
];

type HomeSectionViewConfig = Omit<HomeSectionConfig, "key">;

const DEFAULT_HOME_SECTION_CONFIG: Record<HomeSectionKey, HomeSectionViewConfig> = {
  categories: { title: "Catégories", visible: true, source: "categories", limit: 4 },
  banners: { title: "Bannières", visible: true, source: "banners", limit: 10 },
  shorts: { title: "Shorts", visible: true, source: "shorts", limit: 12 },
  popular: { title: "Produits populaires", visible: true, source: "popular", limit: 6 },
  new_restaurants: { title: "Près de chez vous", visible: true, source: "new_restaurants", limit: 6 },
  new_products: { title: "Offres du moment", visible: true, source: "promos", limit: 6 },
  shops: { title: "Boutiques", visible: true, source: "shops", limit: 6 },
  all: { title: "Recommandé pour vous", visible: true, source: "all_restaurants", limit: 6 },
  free_delivery: { title: "Livraison gratuite", visible: true, source: "free_delivery", limit: 6 },
  newest: { title: "Nouveautés", visible: true, source: "newest", limit: 6 },
  support: { title: "Besoin d'aide ?", visible: true, source: "support", limit: 1 },
};

type HomeCategory = {
  key: string;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  accent: string;
  slug?: string;
};

const CATEGORY_PRESETS: Array<{
  key: string;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  accent: string;
  matches: string[];
}> = [
  {
    key: "restaurant",
    label: "Restaurants",
    icon: "restaurant",
    accent: "#E91E63",
    matches: ["restaurant", "restauration", "food"],
  },
  {
    key: "grocery",
    label: "Courses",
    icon: "basket",
    accent: "#55B89A",
    matches: ["grocery", "épicerie", "epicerie"],
  },
  {
    key: "health",
    label: "Pharmacie",
    icon: "medkit",
    accent: "#00A5B5",
    matches: ["pharmacy", "pharmacie", "health", "santé", "sante"],
  },
  {
    key: "more",
    label: "Plus",
    icon: "apps",
    accent: "#9B7FEA",
    matches: ["supermarket", "supermarché", "supermarche", "market", "shop", "boutique"],
  },
];

function normalize(value: unknown): string {
  return String(value ?? "")
    .toLocaleLowerCase("fr-FR")
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "");
}

function LoadingOrEmpty({
  loading,
  empty,
  error,
  onRetry,
}: {
  loading: boolean;
  empty: string;
  error?: boolean;
  onRetry?: () => void;
}) {
  if (loading) return <ActivityIndicator color={PINK} style={styles.loader} />;
  if (error && onRetry) {
    return (
      <Pressable onPress={onRetry} style={styles.retry} accessibilityRole="button">
        <Ionicons name="cloud-offline-outline" size={20} color={MUTED} />
        <Text style={styles.retryText}>Impossible de charger. Réessayer</Text>
      </Pressable>
    );
  }
  return <Text style={styles.empty}>{empty}</Text>;
}

function CategoryRow({
  categories,
  onPress,
}: {
  categories: HomeCategory[];
  onPress: (category: HomeCategory) => void;
}) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.categoryRow}
      nestedScrollEnabled
    >
      {categories.map((category) => (
        <Pressable
          key={category.key}
          onPress={() => onPress(category)}
          testID={`home-category-${category.key}`}
          accessibilityRole="button"
          accessibilityLabel={category.label}
          style={({ pressed }) => [styles.categoryItem, pressed && styles.pressed]}
        >
          <View style={styles.categoryIcon}>
            <Ionicons name={category.icon} size={33} color={category.accent} />
          </View>
          <Text style={styles.categoryLabel} numberOfLines={2}>
            {category.label}
          </Text>
        </Pressable>
      ))}
    </ScrollView>
  );
}

function PromotionalCard({
  onPress,
  ad,
  width,
}: {
  onPress: () => void;
  ad: Ad;
  width: number;
}) {
  const imageUrl = resolveMediaUrl(ad.imageUrl);
  return (
    <Pressable
      onPress={onPress}
      testID={`home-promo-card-${ad.id}`}
      accessibilityRole="button"
      accessibilityLabel={ad.title || "Ouvrir les offres promotionnelles"}
      style={({ pressed }) => [
        styles.promoCard,
        { backgroundColor: ad.bgColor || SECTION_TINT, width },
        pressed && styles.pressed,
      ]}
    >
      {imageUrl ? (
        <Image source={{ uri: imageUrl }} style={styles.promoImage} resizeMode="cover" />
      ) : null}
    </Pressable>
  );
}

function BannerCarousel({
  ads,
  loading,
  error,
  width,
  onPress,
}: {
  ads: Ad[];
  loading: boolean;
  error: boolean;
  width: number;
  onPress: (ad: Ad) => void;
}) {
  if (loading || error || ads.length === 0) return null;

  const cardWidth = Math.max(0, width - 32);
  const snapInterval = cardWidth + 12;

  return (
    <View style={styles.bannerSlot}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.bannerCarouselContent}
        nestedScrollEnabled
        snapToInterval={snapInterval}
        snapToAlignment="start"
        decelerationRate="fast"
        disableIntervalMomentum
      >
        {ads.map((ad) => (
          <PromotionalCard
            key={`banner-${ad.id}`}
            ad={ad}
            width={cardWidth}
            onPress={() => onPress(ad)}
          />
        ))}
      </ScrollView>
    </View>
  );
}

function ProductRail({
  products,
  loading,
  error,
  empty,
  onRetry,
  width,
  onProductPress,
  variant = "default",
  keyPrefix,
}: {
  products?: RecommendedProduct[];
  loading: boolean;
  error: boolean;
  empty: string;
  onRetry: () => void;
  width: number;
  onProductPress: (product: RecommendedProduct) => void;
  variant?: "default" | "home-compact" | "home-offer" | "home-free-delivery";
  keyPrefix: string;
}) {
  if (loading || error) {
    return <LoadingOrEmpty loading={loading} error={error} empty={empty} onRetry={onRetry} />;
  }
  if (!products?.length) return <Text style={styles.empty}>{empty}</Text>;
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.promoProductGrid}
      nestedScrollEnabled
    >
      {products.map((product) => (
        <ProductCard
          key={`${keyPrefix}-${product.restaurantId}-${product.id}`}
          product={product}
          width={width}
          variant={variant}
          onPress={() => onProductPress(product)}
        />
      ))}
    </ScrollView>
  );
}

function HomeScreen() {
  const { width } = useWindowDimensions();
  const PROMO_PRODUCT_WIDTH = (width - 48) / 3;
  const PRODUCT_GRID_WIDTH = PROMO_PRODUCT_WIDTH;
  const insets = useSafeAreaInsets();
  const tabBarHeight = useBottomTabBarHeight();
  const scrollY = useRef(new Animated.Value(0)).current;
  const { selectedAddress, itemCount } = useCart();
  const [search, setSearch] = useState("");
  const [refreshing, setRefreshing] = useState(false);
  const [addressPickerOpen, setAddressPickerOpen] = useState(false);
  const [cartSheetVisible, setCartSheetVisible] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [shortsVisible, setShortsVisible] = useState(false);
  const [initialShort, setInitialShort] = useState(0);
  const { data: ads, isLoading: adsLoading, isError: adsError, refetch: refetchAds } = useQuery({
    queryKey: ["home-banner-ads"],
    queryFn: () => listAds(),
    staleTime: 60_000,
  });

  const { data: apiCategories, refetch: refetchCategories } = useListCategories();
  const {
    data: shortsData,
    isLoading: shortsLoading,
    isError: shortsError,
    refetch: refetchShorts,
  } = useShorts();
  const {
    data: restaurants,
    isLoading: restaurantsLoading,
    isError: restaurantsError,
    refetch: refetchRestaurants,
  } = useListRestaurants({});
  const {
    data: featuredRestaurants,
    refetch: refetchFeaturedRestaurants,
  } = useGetFeaturedRestaurants();
  const {
    data: promoProducts,
    isLoading: promoProductsLoading,
    isError: promoProductsError,
    refetch: refetchPromoProducts,
  } = useQuery({
    queryKey: ["home-products-promos"],
    queryFn: () => listRecommendedProducts({ limit: HORIZONTAL_PRODUCT_LIMIT, sort: "promos" }),
    staleTime: 60_000,
  });
  const {
    data: newestProducts,
    isLoading: newestProductsLoading,
    isError: newestProductsError,
    refetch: refetchNewestProducts,
  } = useQuery({
    queryKey: ["home-products-newest"],
    queryFn: () => listRecommendedProducts({ limit: HORIZONTAL_PRODUCT_LIMIT, sort: "newest" }),
    staleTime: 60_000,
  });
  const {
    data: popularProducts,
    isLoading: popularProductsLoading,
    isError: popularProductsError,
    refetch: refetchPopularProducts,
  } = useQuery({
    queryKey: ["home-products-popular"],
    queryFn: () => listRecommendedProducts({ limit: 12, sort: "catalog" }),
    staleTime: 60_000,
  });
  const { data: appConfig, refetch: refetchAppConfig } = useQuery({
    queryKey: ["public-app-config"],
    queryFn: getPublicAppConfig,
    staleTime: 60_000,
  });

  const categories = useMemo<HomeCategory[]>(() => {
    const source = (apiCategories ?? []).filter(
      (category: any) =>
        category.parentId == null && category.isActive !== false,
    );
    return CATEGORY_PRESETS.map((preset) => {
      const match = source.find((category: any) => {
        const haystack = normalize(
          `${category.slug} ${category.name} ${category.businessType}`,
        );
        return preset.matches.some((term) => haystack.includes(normalize(term)));
      });
      return {
        key: preset.key,
        label: preset.label,
        icon: preset.icon,
        accent: preset.accent,
        slug: preset.key === "more" ? undefined : match?.slug,
      };
    });
  }, [apiCategories]);

  const shorts = useMemo<Short[]>(() => shortsData ?? [], [shortsData]);
  const restaurantStores = useMemo<Restaurant[]>(
    () => (featuredRestaurants?.length ? featuredRestaurants : restaurants ?? []).slice(0, 8),
    [featuredRestaurants, restaurants],
  );
  const restaurantLogoById = useMemo(
    () =>
      new Map(
        (featuredRestaurants ?? []).map((restaurant) => [
          restaurant.id,
          restaurant.logoUrl ?? restaurant.imageUrl ?? restaurant.coverImageUrl ?? null,
        ]),
      ),
    [featuredRestaurants],
  );
  const activeBanners = useMemo(
    () =>
      (ads ?? [])
        .filter(
          (ad) =>
            ad.isActive &&
            (ad.type.includes("banner") || ad.type === "hero") &&
            Boolean(resolveMediaUrl(ad.imageUrl)),
        )
        .sort((a, b) => a.sortOrder - b.sortOrder),
    [ads],
  );
  const homeSections = useMemo(
    () => Object.fromEntries(
      Object.entries(DEFAULT_HOME_SECTION_CONFIG).map(([key, fallback]) => [
        key,
        {
          ...fallback,
          ...(appConfig?.homeSections?.[key as HomeSectionKey] ?? {}),
        },
      ]),
    ) as Record<HomeSectionKey, HomeSectionViewConfig>,
    [appConfig?.homeSections],
  );
  const homeOrder = useMemo(() => {
    const configured = Array.isArray(appConfig?.homeOrder) ? appConfig.homeOrder : [];
    const valid = configured.filter((key): key is HomeSectionKey =>
      DEFAULT_HOME_ORDER.includes(key as HomeSectionKey),
    );
    return [...new Set([...valid, ...DEFAULT_HOME_ORDER])];
  }, [appConfig?.homeOrder]);
  const freeDeliveryProducts = useMemo(
    () => (popularProducts ?? []).filter((product) => product.deliveryFee === 0),
    [popularProducts],
  );
  const addressLabel = selectedAddress || "Oujda";

  const onRefresh = async () => {
    setRefreshing(true);
    try {
      await refreshAll([
        refetchAds,
        refetchCategories,
        refetchShorts,
        refetchRestaurants,
        refetchFeaturedRestaurants,
        refetchPromoProducts,
        refetchNewestProducts,
        refetchPopularProducts,
        refetchAppConfig,
      ]);
    } finally {
      setRefreshing(false);
    }
  };

  const openCategory = (category: HomeCategory) => {
    if (category.slug) {
      router.push({ pathname: "/category/[slug]", params: { slug: category.slug } });
      return;
    }
    router.push("/restaurants" as any);
  };

  const openProduct = (product: RecommendedProduct) => {
    router.push({
      pathname: "/restaurant/[id]",
      params: { id: String(product.restaurantId), productId: String(product.id) },
    });
  };

  const openShort = (index: number) => {
    setInitialShort(index);
    setShortsVisible(true);
  };

  const openAd = (ad: Ad) => {
    const link = ad.linkUrl?.trim();
    if (link?.startsWith("/") && !link.startsWith("//")) {
      router.push(link as any);
    } else if (link && /^https?:\/\//i.test(link)) {
      void Linking.openURL(link);
    } else {
      router.push("/restaurants" as any);
    }
  };

  const renderHomeSection = (key: HomeSectionKey): React.ReactNode => {
    const config = homeSections[key];
    if (!config?.visible) return null;
    const limit = Math.max(1, Number(config.limit) || 1);
    const productsFor = (source: string) => {
      if (source === "promos") return promoProducts;
      if (source === "newest") return newestProducts;
      return popularProducts;
    };

    switch (key) {
      case "categories":
        return (
          <View style={styles.categorySection}>
            <CategoryRow categories={categories.slice(0, limit)} onPress={openCategory} />
          </View>
        );
      case "banners":
        return (
          <BannerCarousel
            ads={activeBanners.slice(0, limit)}
            loading={adsLoading}
            error={adsError}
            width={width}
            onPress={openAd}
          />
        );
      case "shorts":
        return (
          <View style={styles.section}>
            {shortsLoading || shortsError ? (
              <LoadingOrEmpty
                loading={shortsLoading}
                error={shortsError}
                empty="Aucun Short disponible pour le moment"
                onRetry={() => refetchShorts()}
              />
            ) : shorts.length > 0 ? (
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.horizontalCards}
                nestedScrollEnabled
              >
                {shorts.slice(0, limit).map((short, index) => (
                  <ShortCard
                    key={short.id}
                    short={short}
                    width={SHORT_WIDTH}
                    variant="home"
                    avatarUrl={
                      short.restaurantLogoUrl ??
                      (short.restaurantId != null ? restaurantLogoById.get(short.restaurantId) : null)
                    }
                    onPress={() => openShort(index)}
                  />
                ))}
              </ScrollView>
            ) : (
              <Text style={styles.empty}>Aucun Short disponible pour le moment</Text>
            )}
          </View>
        );
      case "popular":
        return (
          <View style={styles.popularSection}>
            <WaveEdge color={SECTION_TINT} height={28} position="top" />
            <SectionHeader
              title={config.title}
              onPress={() => router.push("/restaurants" as any)}
              testID="section-popular-products"
            />
            <ProductRail
              products={productsFor(config.source)?.slice(0, limit)}
              loading={config.source === "promos" ? promoProductsLoading : config.source === "newest" ? newestProductsLoading : popularProductsLoading}
              error={config.source === "promos" ? promoProductsError : config.source === "newest" ? newestProductsError : popularProductsError}
              empty="Aucun produit populaire pour le moment"
              onRetry={() => void (config.source === "promos" ? refetchPromoProducts() : config.source === "newest" ? refetchNewestProducts() : refetchPopularProducts())}
              width={PRODUCT_GRID_WIDTH}
              onProductPress={openProduct}
              variant="home-compact"
              keyPrefix="popular"
            />
            <WaveEdge color={SECTION_TINT} height={28} />
          </View>
        );
      case "new_restaurants":
      case "shops":
        return (
          <View style={styles.restaurantSection}>
            <SectionHeader
              title={config.title}
              onPress={() => router.push("/restaurants" as any)}
              testID={`section-${key}`}
            />
            {restaurantsLoading || restaurantsError ? (
              <LoadingOrEmpty
                loading={restaurantsLoading}
                error={restaurantsError}
                empty="Aucun commerce disponible pour le moment"
                onRetry={() => refetchRestaurants()}
              />
            ) : restaurantStores.length > 0 ? (
              <ScrollView horizontal showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.promoProductGrid} nestedScrollEnabled>
                {restaurantStores.slice(0, limit).map((restaurant) => (
                  <StoreCard
                    key={`${key}-${restaurant.id}`}
                    restaurant={restaurant}
                    width={SCREEN_WIDTH * 0.65}
                    variant="home"
                    badgeLabel={
                      key === "new_restaurants" && promoProducts?.some((product) => product.restaurantId === restaurant.id)
                        ? "Promo"
                        : undefined
                    }
                    onPress={() => router.push({ pathname: "/restaurant/[id]", params: { id: String(restaurant.id) } })}
                  />
                ))}
              </ScrollView>
            ) : (
              <Text style={styles.empty}>Aucun commerce disponible pour le moment</Text>
            )}
          </View>
        );
      case "new_products":
        return (
          <View style={styles.promoSection}>
            <SectionHeader title={config.title} onPress={() => router.push("/restaurants" as any)} testID="section-promo-products" />
            <ProductRail
              products={productsFor(config.source)?.slice(0, limit)}
              loading={config.source === "newest" ? newestProductsLoading : config.source === "popular" ? popularProductsLoading : promoProductsLoading}
              error={config.source === "newest" ? newestProductsError : config.source === "popular" ? popularProductsError : promoProductsError}
              empty="Aucun produit en promotion pour le moment"
              onRetry={() => void (config.source === "newest" ? refetchNewestProducts() : config.source === "popular" ? refetchPopularProducts() : refetchPromoProducts())}
              width={SCREEN_WIDTH * 0.75}
              onProductPress={openProduct}
              variant="home-offer"
              keyPrefix="offer"
            />
          </View>
        );
      case "all":
        return (
          <View style={styles.restaurantSection}>
            <SectionHeader title={config.title} onPress={() => router.push("/restaurants" as any)} testID="section-recommended" />
            {restaurantsLoading || restaurantsError ? (
              <LoadingOrEmpty loading={restaurantsLoading} error={restaurantsError} empty="Aucun restaurant disponible pour le moment" onRetry={() => refetchRestaurants()} />
            ) : restaurantStores.length > 2 ? (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.promoProductGrid} nestedScrollEnabled>
                {restaurantStores.slice(2, 2 + limit).map((restaurant) => (
                  <StoreCard
                    key={`rec-${restaurant.id}`}
                    restaurant={restaurant}
                    width={140}
                    variant="home"
                    showFee
                    onPress={() => router.push({ pathname: "/restaurant/[id]", params: { id: String(restaurant.id) } })}
                  />
                ))}
              </ScrollView>
            ) : <Text style={styles.empty}>Aucun restaurant disponible pour le moment</Text>}
          </View>
        );
      case "free_delivery":
        return (
          <View style={styles.freeDeliverySection}>
            <SectionHeader title={config.title} onPress={() => router.push("/restaurants" as any)} testID="section-free-delivery" />
            <ProductRail
              products={freeDeliveryProducts.slice(0, limit)}
              loading={popularProductsLoading}
              error={popularProductsError}
              empty="Aucun produit en livraison gratuite pour le moment"
              onRetry={() => void refetchPopularProducts()}
              width={120}
              onProductPress={openProduct}
              variant="home-free-delivery"
              keyPrefix="free-delivery"
            />
          </View>
        );
      case "newest":
        return (
          <View style={styles.newestSection}>
            <SectionHeader title={config.title} onPress={() => router.push("/restaurants" as any)} testID="section-newest" />
            <ProductRail
              products={productsFor(config.source)?.slice(0, limit)}
              loading={config.source === "popular" ? popularProductsLoading : config.source === "promos" ? promoProductsLoading : newestProductsLoading}
              error={config.source === "popular" ? popularProductsError : config.source === "promos" ? promoProductsError : newestProductsError}
              empty="Aucun nouveau produit pour le moment"
              onRetry={() => void (config.source === "popular" ? refetchPopularProducts() : config.source === "promos" ? refetchPromoProducts() : refetchNewestProducts())}
              width={PROMO_PRODUCT_WIDTH}
              onProductPress={openProduct}
              variant="home-compact"
              keyPrefix="newest"
            />
          </View>
        );
      case "support":
        return <View style={styles.supportSection}><HomeSupportCard /></View>;
      default:
        return null;
    }
  };

  return (
    <View style={styles.root}>
        <View style={[styles.header, { paddingTop: insets.top + 10 }]}>
          <Animated.View
            style={[
              styles.headerTopRowClip,
              {
                height: scrollY.interpolate({
                  inputRange: [0, 72],
                  outputRange: [44, 0],
                  extrapolate: "clamp",
                }),
                opacity: scrollY.interpolate({
                  inputRange: [0, 48],
                  outputRange: [1, 0],
                  extrapolate: "clamp",
                }),
                transform: [{
                  translateY: scrollY.interpolate({
                    inputRange: [0, 72],
                    outputRange: [0, -18],
                    extrapolate: "clamp",
                  }),
                }],
              },
            ]}
          >
          <View style={styles.headerTopRow}>
            <Pressable
              onPress={() => setMenuOpen(true)}
              accessibilityRole="button"
              accessibilityLabel="Ouvrir le menu"
              style={styles.headerIcon}
            >
              <Ionicons name="menu" size={24} color={WHITE} />
            </Pressable>
            <Pressable
              onPress={() => setAddressPickerOpen(true)}
              accessibilityRole="button"
              accessibilityLabel={`Adresse de livraison : ${addressLabel}`}
              style={styles.identity}
            >
              <View style={styles.addressRow}>
                <Ionicons name="location" size={13} color={HEADER_ACCENT} />
                <Text style={styles.address} numberOfLines={1}>{addressLabel}</Text>
                <Ionicons name="chevron-down" size={14} color={WHITE} />
              </View>
            </Pressable>
            <View style={styles.headerActions}>
              <Pressable
                onPress={() => setCartSheetVisible(true)}
                accessibilityRole="button"
                accessibilityLabel="Ouvrir le panier"
                style={styles.headerIcon}
              >
                <View style={{ position: "relative" }}>
                  <Ionicons name="cart-outline" size={26} color={WHITE} />
                  {itemCount > 0 && (
                    <View style={styles.cartBadge}>
                      <Text style={styles.cartBadgeText}>{itemCount}</Text>
                    </View>
                  )}
                </View>
              </Pressable>
              <Pressable
                onPress={() => router.push("/(tabs)/profile" as any)}
                accessibilityRole="button"
                accessibilityLabel="Ouvrir le profil"
                style={styles.headerIcon}
              >
                <Ionicons name="person-circle-outline" size={24} color={WHITE} />
              </Pressable>
            </View>
          </View>
          </Animated.View>
          <View style={styles.searchBox}>
            <Ionicons name="search" size={18} color={MUTED} />
            <TextInput
              value={search}
              onChangeText={setSearch}
              onSubmitEditing={() => {
                if (search.trim()) router.push({ pathname: "/restaurants", params: { search: search.trim() } } as any);
              }}
              returnKeyType="search"
              placeholder="Rechercher dans Jatek..."
              placeholderTextColor={MUTED}
              style={styles.searchInput}
            />
            {search ? (
              <Pressable onPress={() => setSearch("")} accessibilityLabel="Effacer la recherche">
                <Ionicons name="close-circle" size={18} color={MUTED} />
              </Pressable>
            ) : null}
          </View>
          <WaveEdge color={HEADER_PINK} height={28} />
        </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={{ paddingTop: 20, paddingBottom: tabBarHeight + 40 }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        onScroll={Animated.event(
          [{ nativeEvent: { contentOffset: { y: scrollY } } }],
          { useNativeDriver: false },
        )}
        scrollEventThrottle={16}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={PINK} />
        }
      >
        {homeOrder.map((key) => (
          <React.Fragment key={key}>{renderHomeSection(key)}</React.Fragment>
        ))}
      </ScrollView>

      <AddressQuickPicker visible={addressPickerOpen} onClose={() => setAddressPickerOpen(false)} />
      <CartPreviewSheet visible={cartSheetVisible} onClose={() => setCartSheetVisible(false)} />
      <ShortPlayerModal
        visible={shortsVisible}
        shorts={shorts}
        initialIndex={Math.min(initialShort, Math.max(0, shorts.length - 1))}
        onClose={() => setShortsVisible(false)}
      />
      <SideMenu visible={menuOpen} onClose={() => setMenuOpen(false)} />
    </View>
  );
}

export default HomeScreen;

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: "#FFFFFF",
  },
  scroll: {
    flex: 1,
    backgroundColor: "transparent",
  },
  header: {
    flexShrink: 0,
    zIndex: 10,
    paddingHorizontal: 16,
    paddingBottom: 20,
    backgroundColor: HEADER_PINK,
    overflow: "visible",
  },
  headerTopRow: {
    minHeight: 44,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 6,
    position: "relative",
  },
  headerTopRowClip: {
    overflow: "hidden",
  },
  headerIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  cartBadge: {
    position: "absolute",
    top: -4,
    right: -6,
    backgroundColor: "#fff",
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 4,
  },
  cartBadgeText: {
    color: "#E91E63",
    fontSize: 10,
    fontFamily: "Poppins_700Bold",
  },
  identity: {
    flex: 1,
    minWidth: 0,
    alignItems: "center",
    marginLeft: 40,
    marginRight: 4,
  },
  addressRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    marginTop: 0,
  },
  address: {
    flexShrink: 1,
    color: WHITE,
    fontSize: 13,
    lineHeight: 18,
    fontFamily: "Inter_700Bold",
  },
  headerActions: {
    flexDirection: "row",
    alignItems: "center",
    zIndex: 2,
  },
  searchBox: {
    height: 44,
    marginTop: 5,
    paddingHorizontal: 15,
    borderRadius: 25,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: WHITE,
    shadowColor: "#7A163E",
    shadowOpacity: 0.12,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 2,
  },
  searchInput: {
    flex: 1,
    height: 40,
    padding: 0,
    color: NAVY,
    fontSize: 14,
    fontFamily: "Inter_400Regular",
  },
  categorySection: {
    paddingTop: 8,
    paddingBottom: 8,
    backgroundColor: "#FFF3F8",
    marginBottom: 2,
  },
  categoryRow: {
    gap: CATEGORY_GAP,
    paddingHorizontal: 16,
    justifyContent: "space-between",
  },
  categoryItem: {
    width: CATEGORY_WIDTH,
    minHeight: 104,
    paddingTop: 8,
    paddingBottom: 9,
    paddingHorizontal: 3,
    alignItems: "center",
    justifyContent: "space-between",
    gap: 2,
    borderRadius: 18,
    backgroundColor: "#FFFFFF",
    shadowColor: "#D58BA9",
    shadowOpacity: 0.08,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 2,
  },
  categoryIcon: {
    width: "100%",
    height: 58,
    alignItems: "center",
    justifyContent: "center",
  },
  categoryLabel: {
    minHeight: 17,
    color: NAVY,
    fontSize: 12,
    lineHeight: 16,
    textAlign: "center",
    fontFamily: "Poppins_700Bold",
  },
  section: {
    marginTop: 0,
    paddingBottom: 4,
    backgroundColor: "#FFFFFF",
  },
  promoSection: {
    marginTop: 4,
    paddingTop: 0,
    paddingBottom: 8,
    position: "relative",
    backgroundColor: "#FFFFFF",
  },
  popularSection: {
    marginTop: 28,
    marginBottom: 28,
    paddingTop: 0,
    paddingBottom: 12,
    position: "relative",
    backgroundColor: SECTION_TINT,
  },
  offerSection: {
    marginTop: 46,
    gap: 12,
    paddingHorizontal: 16,
    paddingTop: 20,
    paddingBottom: 24,
    backgroundColor: "#FFFFFF",
  },
  newestSection: {
    marginTop: 4,
    paddingBottom: 8,
    backgroundColor: "#FFFFFF",
  },
  restaurantSection: {
    marginTop: 4,
    paddingBottom: 8,
    backgroundColor: "#FFFFFF",
  },
  freeDeliverySection: {
    marginTop: 4,
    paddingBottom: 8,
    backgroundColor: "#FFFFFF",
  },
  bannerSlot: {
    marginVertical: 4,
    paddingHorizontal: 16,
  },
  bannerCarouselContent: {
    gap: 12,
    paddingHorizontal: 16,
  },
  supportSection: {
    marginTop: 4,
    paddingHorizontal: 0,
    paddingVertical: 4,
    backgroundColor: "#FFFFFF",
  },
  promoCard: {
    height: 144,
    borderRadius: 20,
    overflow: "hidden",
    position: "relative",
    backgroundColor: "#FFEBF2",
    shadowColor: "#C41A54",
    shadowOpacity: 0.1,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 5 },
    elevation: 3,
  },
  promoImage: {
    width: "100%",
    height: "100%",
  },
  promoProductGrid: {
    paddingVertical: 2,
    paddingHorizontal: 16,
    flexDirection: "row",
    gap: 8,
  },
  productGrid: {
    paddingHorizontal: 16,
    flexDirection: "row",
    flexWrap: "wrap",
    columnGap: 8,
    rowGap: 10,
  },
  horizontalCards: {
    gap: 11,
    paddingHorizontal: 16,
  },
  storeGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    columnGap: 12,
    rowGap: 12,
    paddingHorizontal: 16,
  },
  loader: {
    marginVertical: 26,
  },
  empty: {
    paddingHorizontal: 16,
    paddingVertical: 21,
    color: MUTED,
    fontSize: 13,
    textAlign: "center",
    fontFamily: "Inter_500Medium",
  },
  retry: {
    minHeight: 70,
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
  },
  retryText: {
    color: MUTED,
    fontSize: 13,
    fontFamily: "Inter_500Medium",
  },
  pressed: {
    opacity: 0.86,
    transform: [{ scale: 0.98 }],
  },
});