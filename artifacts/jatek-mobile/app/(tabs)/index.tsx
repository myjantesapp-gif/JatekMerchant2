import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
import { router, useFocusEffect } from "expo-router";
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
import { useAuth } from "@/contexts/AuthContext";
import { useShorts } from "@/hooks/useContent";
import {
  getPublicAppConfig,
  listAds,
  listRecommendedRestaurants,
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
import { JatekLogoBadge } from "@/components/JatekLogoBadge";
import { JatekIcon } from "@/components/JatekIcon";
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
const SHORT_GAP = 8;
const SHORT_WIDTH = (SCREEN_WIDTH - 32 - SHORT_GAP * 2) / 3;
const STORE_WIDTH = Math.max(0, (SCREEN_WIDTH - 32 - 12) / 2);
const HORIZONTAL_PRODUCT_LIMIT = 12;
type HomeSectionViewConfig = Omit<HomeSectionConfig, "key">;

type HomeCategory = {
  key: string;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  accent: string;
  slug: string;
  businessType?: string;
};

function normalize(value: unknown): string {
  return String(value ?? "")
    .toLocaleLowerCase("fr-FR")
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "");
}

function getCategoryIcon(category: any): keyof typeof Ionicons.glyphMap {
  const categoryText = normalize(`${category?.slug} ${category?.name} ${category?.businessType}`);
  if (categoryText.includes("pharm") || categoryText.includes("sant")) return "add-circle";
  if (categoryText.includes("market") || categoryText.includes("grocery") || categoryText.includes("épicer")) return "basket";
  if (categoryText.includes("restaurant") || categoryText.includes("restauration") || categoryText.includes("food")) {
    return "restaurant";
  }
  if (categoryText.includes("plus") || categoryText.includes("autre")) return "apps";

  const configuredIcon = typeof category?.icon === "string" ? category.icon : "";
  if (configuredIcon in Ionicons.glyphMap) {
    return configuredIcon as keyof typeof Ionicons.glyphMap;
  }
  if (categoryText.includes("shop") || categoryText.includes("boutique")) return "bag-handle";
  return "grid";
}

function getCategoryAccent(category: any): string {
  const categoryText = normalize(`${category?.slug} ${category?.name} ${category?.businessType}`);
  if (categoryText.includes("restaurant") || categoryText.includes("restauration") || categoryText.includes("food")) {
    return "#E50068";
  }
  if (categoryText.includes("market") || categoryText.includes("grocery") || categoryText.includes("épicer")) {
    return "#0DAF87";
  }
  if (categoryText.includes("pharm") || categoryText.includes("sant")) {
    return "#2D6FE8";
  }
  if (categoryText.includes("plus") || categoryText.includes("autre")) {
    return "#7828E8";
  }
  return category?.accentColor || PINK;
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
        <Text style={styles.retryText}>Données distantes indisponibles. Réessayer</Text>
      </Pressable>
    );
  }
  return <Text style={styles.empty}>{empty}</Text>;
}

function RemoteBackendNotice({ onRetry }: { onRetry: () => void }) {
  return (
    <View style={styles.remoteNotice} accessibilityRole="alert">
      <View style={styles.remoteNoticeIcon}>
        <Ionicons name="cloud-offline-outline" size={20} color={PINK} />
      </View>
      <View style={styles.remoteNoticeCopy}>
        <Text style={styles.remoteNoticeTitle}>Service Jatek indisponible</Text>
        <Text style={styles.remoteNoticeText}>
          Le catalogue et les contenus doivent venir de ma.jatek.app. Aucun contenu local n’est affiché.
        </Text>
      </View>
      <Pressable onPress={onRetry} accessibilityRole="button" style={styles.remoteNoticeRetry}>
        <Text style={styles.remoteNoticeRetryText}>Réessayer</Text>
      </Pressable>
    </View>
  );
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
          <Text
            style={[styles.categoryLabel, normalize(category.label).includes("supermarche") && styles.categoryLabelCompact]}
            numberOfLines={normalize(category.label).includes("supermarche") ? 1 : 2}
            adjustsFontSizeToFit={normalize(category.label).includes("supermarche")}
            minimumFontScale={0.85}
          >
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
      ) : (
        <View style={styles.promoFallback}>
          <JatekLogoBadge size={48} />
          <View style={styles.promoFallbackCopy}>
            {ad.badge ? <Text style={styles.promoBadge}>{ad.badge}</Text> : null}
            <Text style={styles.promoTitle} numberOfLines={2}>{ad.title || "Découvrez nos offres"}</Text>
            {ad.subtitle ? <Text style={styles.promoSubtitle} numberOfLines={2}>{ad.subtitle}</Text> : null}
             {ad.type === "promo_product" && ad.promoPrice !== null && ad.promoPrice !== undefined ? (
               <Text style={styles.promoSubtitle} numberOfLines={1}>
                 {ad.promoPrice.toFixed(2)} MAD {ad.normalPrice ? `au lieu de ${ad.normalPrice.toFixed(2)} MAD` : ""}
               </Text>
             ) : null}
          </View>
        </View>
      )}
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
  const bannerScrollRef = useRef<ScrollView>(null);
  const currentIndexRef = useRef(0);
  const cardWidth = Math.max(0, width - 32);
  const snapInterval = cardWidth + 12;

  useEffect(() => {
    currentIndexRef.current = 0;
    bannerScrollRef.current?.scrollTo({ x: 0, animated: false });

    if (ads.length <= 1) return;

    const timer = setInterval(() => {
      const nextIndex = (currentIndexRef.current + 1) % ads.length;
      currentIndexRef.current = nextIndex;
      bannerScrollRef.current?.scrollTo({
        x: nextIndex * snapInterval,
        animated: true,
      });
    }, 4500);

    return () => clearInterval(timer);
  }, [ads.length, snapInterval]);

  if (loading || error || ads.length === 0) return null;

  return (
    <View style={styles.bannerSlot}>
      <ScrollView
        ref={bannerScrollRef}
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.bannerCarouselContent}
        nestedScrollEnabled
        snapToInterval={snapInterval}
        snapToAlignment="start"
        decelerationRate="fast"
        disableIntervalMomentum
        onMomentumScrollEnd={(event) => {
          const index = Math.round(event.nativeEvent.contentOffset.x / snapInterval);
          currentIndexRef.current = Math.max(0, Math.min(index, ads.length - 1));
        }}
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
  gap,
}: {
  products?: RecommendedProduct[];
  loading: boolean;
  error: boolean;
  empty: string;
  onRetry: () => void;
  width: number;
  onProductPress: (product: RecommendedProduct) => void;
  variant?: "default" | "home-compact" | "home-popular" | "home-offer" | "home-free-delivery";
  keyPrefix: string;
  gap?: number;
}) {
  if (loading || error) {
    return <LoadingOrEmpty loading={loading} error={error} empty={empty} onRetry={onRetry} />;
  }
  if (!products?.length) return <Text style={styles.empty}>{empty}</Text>;
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={[styles.promoProductGrid, gap !== undefined && { gap }]}
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
  const OFFER_CARD_WIDTH = Math.max(0, width - 32);
  const PRODUCT_GRID_WIDTH = PROMO_PRODUCT_WIDTH;
  const insets = useSafeAreaInsets();
  const tabBarHeight = useBottomTabBarHeight();
  const scrollY = useRef(new Animated.Value(0)).current;
  const { selectedAddress, itemCount } = useCart();
  const { user } = useAuth();
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

  const {
    data: apiCategories,
    isLoading: categoriesLoading,
    isError: categoriesError,
    refetch: refetchCategories,
  } = useListCategories();
  const {
    data: shortsData,
    isLoading: shortsLoading,
    isError: shortsError,
    refetch: refetchShorts,
  } = useShorts();
  useFocusEffect(useCallback(() => {
    void refetchShorts();
  }, [refetchShorts]));
  const {
    data: restaurants,
    isLoading: restaurantsLoading,
    isError: restaurantsError,
    refetch: refetchRestaurants,
  } = useListRestaurants({});
  const {
    data: restaurantBusinesses,
    isLoading: restaurantBusinessesLoading,
    isError: restaurantBusinessesError,
    refetch: refetchRestaurantBusinesses,
  } = useListRestaurants({ businessType: "restaurant" });
  const {
    data: supermarketBusinesses,
    isLoading: supermarketBusinessesLoading,
    isError: supermarketBusinessesError,
    refetch: refetchSupermarketBusinesses,
  } = useListRestaurants({ businessType: "supermarket" });
  const {
    data: shopBusinesses,
    isLoading: shopBusinessesLoading,
    isError: shopBusinessesError,
    refetch: refetchShopBusinesses,
  } = useListRestaurants({ businessType: "shop" });
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
  const {
    data: recommendedProducts = [],
    isLoading: recommendedProductsLoading,
    isError: recommendedProductsError,
    refetch: refetchRecommendedProducts,
  } = useQuery({
    queryKey: ["home-recommended-products"],
    queryFn: () => listRecommendedProducts({ limit: 30, sort: "recommended" }),
    staleTime: 30_000,
    refetchInterval: 30_000,
  });
  const {
    data: recommendedRestaurants = [],
    isLoading: recommendedRestaurantsLoading,
    isError: recommendedRestaurantsError,
    refetch: refetchRecommendedRestaurants,
  } = useQuery({
    queryKey: ["home-recommended-restaurants"],
    queryFn: () => listRecommendedRestaurants({ limit: 30 }),
    staleTime: 30_000,
    refetchInterval: 30_000,
  });
  const {
    data: appConfig,
    isError: appConfigError,
    refetch: refetchAppConfig,
  } = useQuery({
    queryKey: ["public-app-config"],
    queryFn: getPublicAppConfig,
    staleTime: 60_000,
  });

  const categories = useMemo<HomeCategory[]>(() => {
    return (apiCategories ?? [])
      .filter((category: any) => category.parentId == null && category.isActive !== false)
      .map((category: any) => ({
        key: String(category.id ?? category.slug),
        label: String(category.name ?? "").trim(),
        icon: getCategoryIcon(category),
        accent: getCategoryAccent(category),
        slug: String(category.slug ?? "").trim(),
        businessType: category.businessType,
      }))
      .filter((category) => category.label.length > 0 && category.slug.length > 0);
  }, [apiCategories]);

  const shorts = useMemo<Short[]>(() => shortsData ?? [], [shortsData]);
  const restaurantStores = useMemo<Restaurant[]>(
    () => (featuredRestaurants?.length ? featuredRestaurants : restaurants ?? []).slice(0, 8),
    [featuredRestaurants, restaurants],
  );
  const restaurantOnlyStores = useMemo<Restaurant[]>(
    () => (restaurantBusinesses ?? []).slice(0, 8),
    [restaurantBusinesses],
  );
  const supermarketStores = useMemo<Restaurant[]>(
    () => (supermarketBusinesses ?? []).slice(0, 8),
    [supermarketBusinesses],
  );
  const shopStores = useMemo<Restaurant[]>(
    () => (shopBusinesses ?? []).slice(0, 8),
    [shopBusinesses],
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
            (ad.type.includes("banner") || ad.type === "hero" || ad.type === "promo_product") &&
             (Boolean(resolveMediaUrl(ad.imageUrl)) || Boolean(ad.title)),
        )
        .sort((a, b) => a.sortOrder - b.sortOrder || a.id - b.id),
    [ads],
  );
  const homeSections = useMemo(
    () => (appConfig?.homeSections ?? {}) as Partial<Record<HomeSectionKey, HomeSectionViewConfig>>,
    [appConfig?.homeSections],
  );
  const promoRestaurantIds = useMemo(
    () => new Set((ads ?? []).filter((ad) => ad.isActive && ad.type === "promo_product" && ad.restaurantId).map((ad) => ad.restaurantId)),
    [ads],
  );
  const homeOrder = useMemo(() => {
    const configured = Array.isArray(appConfig?.homeOrder) ? appConfig.homeOrder : [];
    return [...new Set(configured.filter((key): key is HomeSectionKey => typeof key === "string"))];
  }, [appConfig?.homeOrder]);
  const freeDeliveryProducts = useMemo(
    () => (popularProducts ?? []).filter((product) => product.deliveryFee === 0),
    [popularProducts],
  );
  const addressLabel = selectedAddress || "Choisir une adresse";
  const customerFirstName = user?.name?.trim().split(/\s+/)[0] || "";
  const configuredWelcomeMessage = typeof appConfig?.welcomeMessage === "string"
    ? appConfig.welcomeMessage.trim()
    : "";
  const greetingLabel = configuredWelcomeMessage || (customerFirstName ? `Bonjour ${customerFirstName}` : "Bonjour");

  const onRefresh = async () => {
    setRefreshing(true);
    try {
      await refreshAll([
        refetchAds,
        refetchCategories,
        refetchShorts,
        refetchRestaurants,
         refetchRestaurantBusinesses,
         refetchSupermarketBusinesses,
         refetchShopBusinesses,
        refetchFeaturedRestaurants,
        refetchPromoProducts,
        refetchNewestProducts,
        refetchPopularProducts,
        refetchRecommendedProducts,
        refetchRecommendedRestaurants,
        refetchAppConfig,
      ]);
    } finally {
      setRefreshing(false);
    }
  };

  const openCategory = (category: HomeCategory) => {
    router.push({ pathname: "/category/[slug]", params: { slug: category.slug } });
  };

  const openSection = (key: HomeSectionKey) => {
    if (!homeSections[key]) return;
    router.push({ pathname: "/home-section/[key]", params: { key } });
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
            <WaveEdge color={SECTION_TINT} height={22} position="top" />
            {categoriesLoading || categoriesError ? (
              <LoadingOrEmpty
                loading={categoriesLoading}
                error={categoriesError}
                empty="Aucune catégorie disponible"
                onRetry={() => void refetchCategories()}
              />
            ) : categories.length > 0 ? (
              <CategoryRow categories={categories} onPress={openCategory} />
            ) : (
              <Text style={styles.empty}>Aucune catégorie disponible</Text>
            )}
            <WaveEdge color={SECTION_TINT} height={24} />
          </View>
        );
      case "banners":
        return (
          <BannerCarousel
            ads={activeBanners}
            loading={adsLoading}
            error={adsError}
            width={width}
            onPress={openAd}
          />
        );
      case "shorts":
        return (
          <View style={styles.shortsSection}>
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
                decelerationRate="normal"
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
            <WaveEdge color={SECTION_TINT} height={22} position="top" />
            <SectionHeader
              title={config.title}
              variant="home"
              onPress={() => openSection(key)}
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
              variant="home-popular"
              keyPrefix="popular"
            />
            <WaveEdge color={SECTION_TINT} height={24} />
          </View>
        );
      case "recommended_products":
        return (
          <View style={styles.popularSection}>
            <WaveEdge color={SECTION_TINT} height={22} position="top" />
            <SectionHeader title={config.title} variant="home" onPress={() => openSection(key)} testID="section-recommended-products" />
            <ProductRail
              products={recommendedProducts.slice(0, limit)}
              loading={recommendedProductsLoading}
              error={recommendedProductsError}
              empty="Aucun produit recommandé pour le moment"
              onRetry={() => void refetchRecommendedProducts()}
              width={PRODUCT_GRID_WIDTH}
              onProductPress={openProduct}
              variant="home-popular"
              keyPrefix="recommended-products"
            />
            <WaveEdge color={SECTION_TINT} height={24} />
          </View>
        );
      case "recommended_restaurants":
        return (
          <View style={styles.restaurantSection}>
            <SectionHeader title={config.title} variant="home" onPress={() => openSection(key)} testID="section-recommended-restaurants" />
            {recommendedRestaurantsLoading || recommendedRestaurantsError ? (
              <LoadingOrEmpty
                loading={recommendedRestaurantsLoading}
                error={recommendedRestaurantsError}
                empty="Aucun restaurant recommandé pour le moment"
                onRetry={() => void refetchRecommendedRestaurants()}
              />
            ) : recommendedRestaurants.length > 0 ? (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.promoProductGrid} nestedScrollEnabled>
                {recommendedRestaurants.slice(0, limit).map((restaurant) => (
                  <StoreCard
                    key={`recommended-${restaurant.id}`}
                    restaurant={restaurant as Restaurant}
                    width={SCREEN_WIDTH * 0.65}
                    variant="home"
                    showFee
                    onPress={() => router.push({ pathname: "/restaurant/[id]", params: { id: String(restaurant.id) } })}
                  />
                ))}
              </ScrollView>
            ) : <Text style={styles.empty}>Aucun restaurant recommandé pour le moment</Text>}
          </View>
        );
      case "new_restaurants":
      case "supermarkets":
      case "shops":
        {
        const sectionStores = key === "shops"
          ? shopStores
          : key === "supermarkets"
            ? supermarketStores
            : restaurantOnlyStores;
        const sectionLoading = key === "shops"
          ? shopBusinessesLoading
          : key === "supermarkets"
            ? supermarketBusinessesLoading
            : restaurantBusinessesLoading;
        const sectionError = key === "shops"
          ? shopBusinessesError
          : key === "supermarkets"
            ? supermarketBusinessesError
            : restaurantBusinessesError;
        const sectionRetry = key === "shops"
          ? refetchShopBusinesses
          : key === "supermarkets"
            ? refetchSupermarketBusinesses
            : refetchRestaurantBusinesses;
        return (
          <View style={styles.restaurantSection}>
            <SectionHeader
              title={config.title}
              variant="home"
              onPress={() => openSection(key)}
              testID={`section-${key}`}
            />
            {sectionLoading || sectionError ? (
              <LoadingOrEmpty
                loading={sectionLoading}
                error={sectionError}
                empty={key === "supermarkets" ? "Aucun supermarché disponible pour le moment" : "Aucun commerce disponible pour le moment"}
                onRetry={() => sectionRetry()}
              />
            ) : sectionStores.length > 0 ? (
              <ScrollView horizontal showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.promoProductGrid} nestedScrollEnabled>
                {sectionStores.slice(0, limit).map((restaurant) => (
                  <StoreCard
                    key={`${key}-${restaurant.id}`}
                    restaurant={restaurant}
                    width={SCREEN_WIDTH * 0.65}
                    variant="home"
                     badgeLabel={
                       (promoRestaurantIds.has(restaurant.id) || promoProducts?.some((product) => product.restaurantId === restaurant.id))
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
        }
      case "new_products":
        return (
          <View style={styles.promoSection}>
            <SectionHeader title={config.title} variant="home" onPress={() => openSection(key)} testID="section-promo-products" />
            <ProductRail
              products={promoProducts?.slice(0, limit)}
              loading={promoProductsLoading}
              error={promoProductsError}
              empty="Aucun produit en promotion pour le moment"
              onRetry={() => void refetchPromoProducts()}
              width={OFFER_CARD_WIDTH}
              onProductPress={openProduct}
              variant="home-offer"
              keyPrefix="offer"
              gap={16}
            />
          </View>
        );
      case "all":
        return (
          <View style={styles.restaurantSection}>
            <SectionHeader title={config.title} variant="home" onPress={() => openSection(key)} testID="section-recommended" />
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
            <SectionHeader title={config.title} variant="home" onPress={() => openSection(key)} testID="section-free-delivery" />
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
            <WaveEdge color={SECTION_TINT} height={22} position="top" />
            <SectionHeader title={config.title} variant="home" onPress={() => openSection(key)} testID="section-newest" />
            <ProductRail
              products={newestProducts?.slice(0, limit)}
              loading={newestProductsLoading}
              error={newestProductsError}
              empty="Aucun nouveau produit pour le moment"
              onRetry={() => void refetchNewestProducts()}
              width={PROMO_PRODUCT_WIDTH}
              onProductPress={openProduct}
              variant="home-popular"
              keyPrefix="newest"
            />
            <WaveEdge color={SECTION_TINT} height={24} />
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
                  inputRange: [0, 80],
                  outputRange: [60, 0],
                  extrapolate: "clamp",
                }),
                opacity: scrollY.interpolate({
                  inputRange: [0, 48],
                  outputRange: [1, 0],
                  extrapolate: "clamp",
                }),
                transform: [{
                  translateY: scrollY.interpolate({
                    inputRange: [0, 80],
                    outputRange: [0, -24],
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
              style={styles.logoButton}
            >
              <JatekIcon width={13} height={24} />
            </Pressable>
            <Pressable
              onPress={() => setAddressPickerOpen(true)}
              accessibilityRole="button"
              accessibilityLabel={`Adresse de livraison : ${addressLabel}`}
              style={styles.identity}
            >
              <Text style={styles.greeting} numberOfLines={1}>{greetingLabel}</Text>
              <View style={styles.addressRow}>
                <Ionicons name="location" size={12} color={HEADER_ACCENT} />
                <Text style={styles.address} numberOfLines={1}>{addressLabel}</Text>
                <Ionicons name="chevron-down" size={13} color={WHITE} />
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
          <WaveEdge color={HEADER_PINK} height={36} />
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
        {appConfigError ? <RemoteBackendNotice onRetry={() => void refetchAppConfig()} /> : null}
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
        onViewCountChanged={() => void refetchShorts()}
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
    paddingBottom: 12,
    marginBottom: 35,
    backgroundColor: HEADER_PINK,
    overflow: "visible",
  },
  headerTopRow: {
    minHeight: 60,
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
  logoButton: {
    width: 38,
    height: 38,
    marginRight: 2,
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
    color: "#EC176B",
    fontSize: 10,
    fontFamily: "Poppins_700Bold",
  },
  identity: {
    flex: 1,
    minWidth: 0,
    alignItems: "flex-start",
    marginLeft: 4,
    marginRight: 6,
  },
  greeting: {
    maxWidth: "100%",
    color: WHITE,
    fontSize: 13,
    lineHeight: 17,
    fontFamily: "Poppins_700Bold",
  },
  addressRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-start",
    gap: 4,
    width: "100%",
    marginTop: 1,
  },
  address: {
    flexShrink: 1,
    color: WHITE,
    fontSize: 11,
    lineHeight: 15,
    fontFamily: "Poppins_500Medium",
  },
  headerActions: {
    flexDirection: "row",
    alignItems: "center",
    zIndex: 2,
  },
  searchBox: {
    height: 48,
    marginTop: 7,
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
    height: 44,
    padding: 0,
    color: NAVY,
    fontSize: 14,
    fontFamily: "Inter_400Regular",
  },
  categorySection: {
    marginTop: 6,
    marginBottom: 6,
    paddingTop: 6,
    paddingBottom: 6,
    position: "relative",
    backgroundColor: SECTION_TINT,
    zIndex: 2,
    elevation: 2,
  },
  categoryRow: {
    gap: CATEGORY_GAP,
    paddingHorizontal: 6,
  },
  categoryItem: {
    width: CATEGORY_WIDTH,
    minHeight: 90,
    paddingTop: 8,
    paddingBottom: 8,
    paddingHorizontal: 2,
    alignItems: "center",
    justifyContent: "flex-start",
    gap: 2,
    borderRadius: 22,
    backgroundColor: "#FFFFFF",
    shadowColor: "#C38AA4",
    shadowOpacity: 0.12,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  categoryIcon: {
    width: "100%",
    height: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  categoryLabel: {
    minHeight: 13,
    color: "#08244A",
    fontSize: 10,
    lineHeight: 13,
    letterSpacing: -0.15,
    textAlign: "center",
    fontWeight: "bold",
    fontFamily: "Poppins_700Bold",
  },
  categoryLabelCompact: {
    fontSize: 10,
    lineHeight: 13,
    letterSpacing: -0.15,
  },
  section: {
    marginTop: 0,
    paddingBottom: 0,
    backgroundColor: WHITE,
  },
  shortsSection: {
    marginTop: 18,
    paddingBottom: 0,
    backgroundColor: WHITE,
  },
  promoSection: {
    marginTop: 2,
    paddingTop: 0,
    paddingBottom: 2,
    position: "relative",
    backgroundColor: "#FFFFFF",
  },
  popularSection: {
    marginTop: 16,
    marginBottom: 12,
    paddingTop: 0,
    paddingBottom: 4,
    position: "relative",
    backgroundColor: SECTION_TINT,
    zIndex: 2,
    elevation: 2,
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
    marginTop: 16,
    marginBottom: 12,
    paddingTop: 0,
    paddingBottom: 4,
    position: "relative",
    backgroundColor: SECTION_TINT,
    zIndex: 2,
    elevation: 2,
  },
  restaurantSection: {
    marginTop: 2,
    paddingBottom: 2,
    backgroundColor: "#FFFFFF",
  },
  freeDeliverySection: {
    marginTop: 2,
    paddingBottom: 2,
    backgroundColor: "#FFFFFF",
  },
  bannerSlot: {
    marginVertical: 0,
    paddingVertical: 6,
    paddingHorizontal: 0,
    backgroundColor: WHITE,
  },
  bannerCarouselContent: {
    gap: 8,
    paddingHorizontal: 16,
  },
  supportSection: {
    marginTop: 2,
    paddingHorizontal: 0,
    paddingVertical: 2,
    backgroundColor: "#FFFFFF",
  },
  promoCard: {
    height: 128,
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
  promoFallback: {
    flex: 1,
    paddingHorizontal: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  promoFallbackCopy: {
    flex: 1,
    gap: 3,
  },
  promoBadge: {
    alignSelf: "flex-start",
    color: "#E91E63",
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 0.8,
  },
  promoTitle: {
    color: "#08244A",
    fontSize: 17,
    lineHeight: 21,
    fontWeight: "800",
  },
  promoSubtitle: {
    color: "#475569",
    fontSize: 11,
    lineHeight: 15,
  },
  promoProductGrid: {
    paddingVertical: 0,
    paddingHorizontal: 16,
    flexDirection: "row",
    gap: 6,
  },
  productGrid: {
    paddingHorizontal: 16,
    flexDirection: "row",
    flexWrap: "wrap",
    columnGap: 8,
    rowGap: 10,
  },
  horizontalCards: {
    gap: SHORT_GAP,
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
  remoteNotice: {
    marginHorizontal: 16,
    marginBottom: 18,
    padding: 14,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#FBCFE8",
    backgroundColor: "#FFF7FB",
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  remoteNoticeIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FCE7F3",
  },
  remoteNoticeCopy: {
    flex: 1,
    gap: 3,
  },
  remoteNoticeTitle: {
    color: NAVY,
    fontSize: 13,
    fontFamily: "Montserrat_700Bold",
  },
  remoteNoticeText: {
    color: MUTED,
    fontSize: 11,
    lineHeight: 16,
    fontFamily: "Montserrat_400Regular",
  },
  remoteNoticeRetry: {
    paddingHorizontal: 8,
    paddingVertical: 6,
  },
  remoteNoticeRetryText: {
    color: PINK,
    fontSize: 12,
    fontFamily: "Montserrat_700Bold",
  },
  pressed: {
    opacity: 0.86,
    transform: [{ scale: 0.98 }],
  },
});