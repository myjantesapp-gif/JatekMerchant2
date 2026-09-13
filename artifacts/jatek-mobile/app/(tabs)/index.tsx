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
const CATEGORY_WIDTH = (SCREEN_WIDTH - 32 - 24) / 4;
const SHORT_WIDTH = Math.min(138, Math.max(120, SCREEN_WIDTH * 0.32));
const STORE_WIDTH = Math.max(0, (SCREEN_WIDTH - 32 - 12) / 2);
const HORIZONTAL_PRODUCT_LIMIT = 12;

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
          <View style={[styles.categoryIcon, { backgroundColor: `${category.accent}24` }]}>
            <Ionicons name={category.icon} size={29} color={category.accent} />
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
  const { refetch: refetchAppConfig } = useQuery({
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
        {/* 1. Catégories */}
        <View style={styles.categorySection}>
          <CategoryRow categories={categories} onPress={openCategory} />
        </View>

        {/* 2. Shorts */}
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
              {shorts.map((short, index) => (
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

        {/* 3. Produits populaires */}
        <View style={styles.popularSection}>
          <WaveEdge color={SECTION_TINT} height={40} position="top" />
          <SectionHeader
            title="Produits populaires"
            onPress={() => router.push("/restaurants" as any)}
            testID="section-popular-products"
          />
          {popularProductsLoading || popularProductsError ? (
            <LoadingOrEmpty
              loading={popularProductsLoading}
              error={popularProductsError}
              empty="Aucun produit populaire pour le moment"
              onRetry={() => refetchPopularProducts()}
            />
          ) : popularProducts && popularProducts.length > 0 ? (
            <ScrollView horizontal showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.promoProductGrid} nestedScrollEnabled>
              {popularProducts.map((product) => (
                <ProductCard
                  key={`popular-${product.restaurantId}-${product.id}`}
                  product={product}
                  width={PRODUCT_GRID_WIDTH}
                  variant="home-compact"
                  onPress={() => openProduct(product)}
                />
              ))}
            </ScrollView>
          ) : (
            <Text style={styles.empty}>Aucun produit populaire pour le moment</Text>
          )}
          <WaveEdge color={SECTION_TINT} height={40} />
        </View>

        <BannerCarousel
          ads={activeBanners}
          loading={adsLoading}
          error={adsError}
          width={width}
          onPress={openAd}
        />

        {/* 4. Près de chez vous */}
        <View style={styles.restaurantSection}>
          <SectionHeader
            title="Près de chez vous"
            onPress={() => router.push("/restaurants" as any)}
            testID="section-restauration"
          />
          {restaurantsLoading || restaurantsError ? (
            <LoadingOrEmpty
              loading={restaurantsLoading}
              error={restaurantsError}
              empty="Aucun restaurant disponible pour le moment"
              onRetry={() => refetchRestaurants()}
            />
          ) : restaurantStores.length > 0 ? (
            <ScrollView horizontal showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.promoProductGrid} nestedScrollEnabled>
              {restaurantStores.slice(0, 2).map((restaurant) => (
                <StoreCard
                  key={`restaurant-${restaurant.id}`}
                  restaurant={restaurant}
                  width={SCREEN_WIDTH * 0.65}
                  variant="home"
                  badgeLabel={
                    promoProducts?.some((product) => product.restaurantId === restaurant.id)
                      ? "Promo"
                      : undefined
                  }
                  onPress={() =>
                    router.push({
                      pathname: "/restaurant/[id]",
                      params: { id: String(restaurant.id) },
                    })
                  }
                />
              ))}
            </ScrollView>
          ) : (
            <Text style={styles.empty}>Aucun restaurant disponible pour le moment</Text>
          )}
        </View>

        {/* 5. Offres du moment */}
        <View style={styles.promoSection}>
          <SectionHeader
            title="Offres du moment"
            onPress={() => router.push("/restaurants" as any)}
            testID="section-promo-products"
          />
          <ProductRail
            products={promoProducts}
            loading={promoProductsLoading}
            error={promoProductsError}
            empty="Aucun produit en promotion pour le moment"
            onRetry={() => void refetchPromoProducts()}
            width={SCREEN_WIDTH * 0.75}
            onProductPress={openProduct}
            variant="home-offer"
            keyPrefix="promo"
          />
        </View>

        {/* 6. Recommandé pour vous */}
        <View style={styles.restaurantSection}>
          <SectionHeader
            title="Recommandé pour vous"
            onPress={() => router.push("/restaurants" as any)}
            testID="section-recommended"
          />
          {restaurantsLoading || restaurantsError ? (
            <LoadingOrEmpty
              loading={restaurantsLoading}
              error={restaurantsError}
              empty="Aucun restaurant disponible pour le moment"
              onRetry={() => refetchRestaurants()}
            />
          ) : restaurantStores.length > 2 ? (
            <ScrollView horizontal showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.promoProductGrid} nestedScrollEnabled>
              {restaurantStores.slice(2, 5).map((restaurant) => (
                <StoreCard
                  key={`rec-${restaurant.id}`}
                  restaurant={restaurant}
                  width={140}
                  variant="home"
                  showFee={true}
                  onPress={() =>
                    router.push({
                      pathname: "/restaurant/[id]",
                      params: { id: String(restaurant.id) },
                    })
                  }
                />
              ))}
            </ScrollView>
          ) : (
            <Text style={styles.empty}>Aucun restaurant disponible pour le moment</Text>
          )}
        </View>

        {/* 7. Livraison gratuite */}
        <View style={styles.freeDeliverySection}>
          <SectionHeader
            title="Livraison gratuite"
            onPress={() => router.push("/restaurants" as any)}
            testID="section-free-delivery"
          />
          <ProductRail
            products={freeDeliveryProducts}
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

        {/* 8. Nouveautés */}
        <View style={styles.newestSection}>
          <SectionHeader
            title="Nouveautés"
            onPress={() => router.push("/restaurants" as any)}
            testID="section-newest"
          />
          <ProductRail
            products={newestProducts}
            loading={newestProductsLoading}
            error={newestProductsError}
            empty="Aucun nouveau produit pour le moment"
            onRetry={() => void refetchNewestProducts()}
            width={PROMO_PRODUCT_WIDTH}
            onProductPress={openProduct}
            variant="home-compact"
            keyPrefix="newest"
          />
        </View>

        <View style={styles.supportSection}>
          <HomeSupportCard />
        </View>
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
    paddingTop: 4,
    paddingBottom: 4,
    backgroundColor: "#FFFFFF",
    marginBottom: 2,
  },
  categoryRow: {
    gap: 12,
    paddingHorizontal: 16,
    justifyContent: "space-between",
  },
  categoryItem: {
    width: CATEGORY_WIDTH,
    alignItems: "center",
    gap: 7,
  },
  categoryIcon: {
    width: 70,
    height: 60,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FFFFFF",
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
    borderWidth: 1,
    borderColor: "#f3f4f6",
  },
  categoryLabel: {
    minHeight: 18,
    color: NAVY,
    fontSize: 11,
    lineHeight: 14,
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
    marginTop: 26,
    marginBottom: 18,
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