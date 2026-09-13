import React, { useMemo, useState } from "react";
import {
  ActivityIndicator,
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

import { useAuth } from "@/contexts/AuthContext";
import { useCart } from "@/contexts/CartContext";
import { useAds, useShorts } from "@/hooks/useContent";
import {
  getPublicAppConfig,
  listRecommendedProducts,
  type Ad,
  type Short,
  type RecommendedProduct,
} from "@/lib/api";
import { resolveMediaUrl } from "@/lib/mediaUrl";
import { getApiBaseSafe } from "@/lib/apiBase";
import { refreshAll } from "@/lib/mobileRefresh";
import { AddressQuickPicker } from "@/components/AddressQuickPicker";
import { CartPreviewSheet } from "@/components/CartPreviewSheet";
import { SideMenu } from "@/components/SideMenu";
import { ShortPlayerModal } from "@/components/ShortPlayerModal";
import { ProductCard } from "@/components/ProductCard";
import { ShortCard } from "@/components/ShortCard";
import { StoreCard } from "@/components/StoreCard";
import { SectionHeader } from "@/components/SectionHeader";
import { WaveEdge } from "@/components/WaveEdge";
import colors from "@/constants/colors";

const { width: SCREEN_WIDTH } = Dimensions.get("window");
const PINK = colors.light.primary;
const PINK_SOFT = colors.light.primarySoft;
const NAVY = colors.light.heading;
const MUTED = colors.light.mutedForeground;
const WHITE = colors.light.background;
const SECTION_TINT = colors.light.pinkBg;
const CATEGORY_WIDTH = 82;
const PROMO_PRODUCT_WIDTH = Math.max(74, (SCREEN_WIDTH - 32 - 24) / 4);
const SHORT_WIDTH = Math.min(138, Math.max(120, SCREEN_WIDTH * 0.32));
const STORE_WIDTH = Math.min(286, Math.max(260, SCREEN_WIDTH * 0.72));
const STORE_GRID_WIDTH = Math.max(0, (SCREEN_WIDTH - 48) / 2);
const BANNER_WIDTH = SCREEN_WIDTH - 32;
const FALLBACK_PROMO =
  "https://images.unsplash.com/photo-1540420773420-3366772f4999?auto=format&fit=crop&w=1200&q=88";
const LOCAL_PROMO_BANNERS = [
  require("../../assets/images/banner-mois-mamans.png"),
  require("../../assets/images/banner-rentree.png"),
  require("../../assets/images/banner-rentree-orange.png"),
];

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
    label: "Restauration",
    icon: "restaurant-outline",
    accent: "#F28CB7",
    matches: ["restaurant", "restauration", "food"],
  },
  {
    key: "grocery",
    label: "Épicerie",
    icon: "basket-outline",
    accent: "#F4A261",
    matches: ["grocery", "épicerie", "epicerie"],
  },
  {
    key: "health",
    label: "Santé",
    icon: "medkit-outline",
    accent: "#55B9A5",
    matches: ["pharmacy", "pharmacie", "health", "santé", "sante"],
  },
  {
    key: "supermarket",
    label: "Supermarché",
    icon: "cart-outline",
    accent: "#7F8CE3",
    matches: ["supermarket", "supermarché", "supermarche", "market"],
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

function PromoBanner({
  ad,
  fallbackSource,
  width,
  onPress,
}: {
  ad?: Ad;
  fallbackSource?: number;
  width: number;
  onPress: () => void;
}) {
  const imageSource = ad?.imageUrl
    ? { uri: resolveMediaUrl(ad.imageUrl) ?? FALLBACK_PROMO }
    : fallbackSource ?? { uri: FALLBACK_PROMO };
  return (
    <Pressable
      onPress={onPress}
      testID="home-promo-banner"
      accessibilityRole="button"
      accessibilityLabel="Ouvrir les promotions"
      style={({ pressed }) => [styles.promoBanner, { width }, pressed && styles.pressed]}
    >
      <Image source={imageSource} style={styles.promoImage} resizeMode="cover" />
    </Pressable>
  );
}

function openAd(ad?: Ad) {
  const link = ad?.linkUrl?.trim();
  if (!link) return;
  if (link.startsWith("/")) router.push(link as any);
  else Linking.openURL(link).catch(() => {});
}

function HomeScreen() {
  const insets = useSafeAreaInsets();
  const tabBarHeight = useBottomTabBarHeight();
  const { user } = useAuth();
  const { selectedAddress } = useCart();
  const [search, setSearch] = useState("");
  const [refreshing, setRefreshing] = useState(false);
  const [addressPickerOpen, setAddressPickerOpen] = useState(false);
  const [cartSheetVisible, setCartSheetVisible] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [shortsVisible, setShortsVisible] = useState(false);
  const [initialShort, setInitialShort] = useState(0);

  const { data: apiCategories, refetch: refetchCategories } = useListCategories();
  const {
    data: ads,
    refetch: refetchAds,
  } = useAds();
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
    queryFn: () => listRecommendedProducts({ limit: 12, sort: "promos" }),
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
        icon: (match?.icon as HomeCategory["icon"]) || preset.icon,
        accent: match?.accentColor || preset.accent,
        slug: match?.slug,
      };
    });
  }, [apiCategories]);

  const shorts = useMemo<Short[]>(() => shortsData ?? [], [shortsData]);
  const bannerAds = useMemo<Ad[]>(
    () =>
      ((ads ?? []) as Ad[])
        .filter(
          (ad) =>
            ["vip_banner", "promo_banner", "hero"].includes(ad.type) &&
            typeof ad.imageUrl === "string" &&
            ad.imageUrl.trim().length > 0,
        ),
    [ads],
  );
  const newestStores = useMemo<Restaurant[]>(
    () =>
      [...(restaurants ?? [])]
        .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt))
        .slice(0, 8),
    [restaurants],
  );
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
  const greeting = user?.name?.trim() ? `Bonjour, ${user.name.trim()}` : "Bonjour";
  const addressLabel = selectedAddress || "Choisir une adresse";

  const onRefresh = async () => {
    setRefreshing(true);
    try {
      await refreshAll([
        refetchCategories,
        refetchAds,
        refetchShorts,
        refetchRestaurants,
        refetchFeaturedRestaurants,
        refetchPromoProducts,
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

  return (
    <View style={styles.root}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={{ paddingBottom: tabBarHeight + 74 }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={PINK} />
        }
      >
        <View style={[styles.header, { paddingTop: insets.top + 10 }]}>
          <View style={styles.headerTopRow}>
            <Pressable
              onPress={() => setMenuOpen(true)}
              accessibilityRole="button"
              accessibilityLabel="Ouvrir le menu"
              style={styles.headerIcon}
            >
            <Ionicons name="menu" size={24} color={NAVY} />
            </Pressable>
            <Pressable
              onPress={() => setAddressPickerOpen(true)}
              accessibilityRole="button"
              accessibilityLabel={`Adresse de livraison : ${addressLabel}`}
              style={styles.identity}
            >
                <Text style={styles.greeting} numberOfLines={1}>{greeting}</Text>
              <View style={styles.addressRow}>
                  <Ionicons name="location" size={14} color={PINK} />
                <Text style={styles.address} numberOfLines={1}>{addressLabel}</Text>
                  <Ionicons name="chevron-down" size={15} color={MUTED} />
              </View>
            </Pressable>
            <View style={styles.headerActions}>
              <Pressable
                onPress={() => setCartSheetVisible(true)}
                accessibilityRole="button"
                accessibilityLabel="Ouvrir le panier"
                style={styles.headerIcon}
              >
                <Ionicons name="bag-handle-outline" size={22} color={NAVY} />
              </Pressable>
              <Pressable
                onPress={() => router.push("/(tabs)/profile" as any)}
                accessibilityRole="button"
                accessibilityLabel="Ouvrir le profil"
                style={styles.headerIcon}
              >
                <Ionicons name="person-circle-outline" size={24} color={NAVY} />
              </Pressable>
            </View>
          </View>
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
        </View>

        {/* 1. Catégories */}
        <View style={styles.categorySection}>
          <SectionHeader title="Catégories" accent={false} />
          <CategoryRow categories={categories} onPress={openCategory} />
        </View>

        {/* 2. Bannières administrables, avec visuels locaux de secours */}
        <View style={styles.bannerSection}>
          <SectionHeader title="Bannières" accent={false} />
          <ScrollView
            horizontal
            pagingEnabled
            snapToInterval={BANNER_WIDTH + 12}
            decelerationRate="fast"
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.bannerRail}
            nestedScrollEnabled
          >
            {bannerAds.length > 0
              ? bannerAds.map((ad) => (
                  <PromoBanner
                    key={ad.id}
                    ad={ad}
                    width={BANNER_WIDTH}
                    onPress={() => openAd(ad)}
                  />
                ))
              : LOCAL_PROMO_BANNERS.map((source, index) => (
                  <PromoBanner
                    key={`fallback-banner-${index}`}
                    fallbackSource={source}
                    width={BANNER_WIDTH}
                    onPress={() => router.push("/restaurants" as any)}
                  />
                ))}
          </ScrollView>
        </View>

        {/* 3. Produits réellement remisés, pilotés depuis le dashboard */}
        <View style={styles.promoSection}>
          <WaveEdge color={SECTION_TINT} position="top" height={30} />
          <SectionHeader
             title="Promos produits"
            buttonLabel="Voir plus"
            accent={false}
            onPress={() => router.push("/restaurants" as any)}
             testID="section-promo-products"
          />
          {promoProductsLoading || promoProductsError ? (
            <LoadingOrEmpty
              loading={promoProductsLoading}
              error={promoProductsError}
              empty="Aucun produit en promotion pour le moment"
              onRetry={() => refetchPromoProducts()}
            />
          ) : promoProducts && promoProducts.length > 0 ? (
            <View style={styles.promoProductGrid}>
               {promoProducts.slice(0, 4).map((product) => (
                <ProductCard
                  key={`${product.restaurantId}-${product.id}`}
                  product={product}
                  width={PROMO_PRODUCT_WIDTH}
                  compact
                  onPress={() => openProduct(product)}
                />
              ))}
            </View>
          ) : (
            <Text style={styles.empty}>Aucun produit en promotion pour le moment</Text>
          )}
          <WaveEdge color={SECTION_TINT} height={34} />
        </View>

         {/* 4. Shorts */}
         <View style={styles.section}>
           <SectionHeader
             title="Shorts"
             buttonLabel="Voir plus"
             accent={false}
             onPress={() => openShort(0)}
             testID="section-videos"
           />
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

        {/* 5. Produits populaires */}
        <View style={styles.popularSection}>
          <WaveEdge color={SECTION_TINT} position="top" height={30} />
          <SectionHeader
            title="Produits populaires"
            buttonLabel="Voir plus"
            accent={false}
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
            <View style={styles.promoProductGrid}>
              {popularProducts.slice(0, 4).map((product) => (
                <ProductCard
                  key={`popular-${product.restaurantId}-${product.id}`}
                  product={product}
                  width={PROMO_PRODUCT_WIDTH}
                  compact
                  onPress={() => openProduct(product)}
                />
              ))}
            </View>
          ) : (
            <Text style={styles.empty}>Aucun produit populaire pour le moment</Text>
          )}
          <WaveEdge color={SECTION_TINT} height={34} />
        </View>

        {/* 6. Nouveautés */}
        <View style={styles.newestSection}>
          <SectionHeader
            title="Nouveautés"
            buttonLabel="Voir plus"
            accent={false}
            onPress={() => router.push("/restaurants" as any)}
            testID="section-newest"
          />
          {restaurantsLoading || restaurantsError ? (
            <LoadingOrEmpty
              loading={restaurantsLoading}
              error={restaurantsError}
              empty="Aucun nouveau commerce pour le moment"
              onRetry={() => refetchRestaurants()}
            />
          ) : newestStores.length > 0 ? (
            <View style={styles.storeGrid}>
              {newestStores.slice(0, 2).map((restaurant, index) => (
                <StoreCard
                  key={restaurant.id}
                  restaurant={restaurant}
                  width={STORE_GRID_WIDTH}
                  compact
                  badgeLabel={index === 0 ? "Nouveau" : "Promo"}
                  onPress={() =>
                    router.push({
                      pathname: "/restaurant/[id]",
                      params: { id: String(restaurant.id) },
                    })
                  }
                />
              ))}
            </View>
          ) : (
            <Text style={styles.empty}>Aucun nouveau commerce pour le moment</Text>
          )}
        </View>

         {/* 7. Restauration */}
        <View style={styles.restaurantSection}>
          <SectionHeader
            title="Restauration"
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
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.horizontalCards}
              nestedScrollEnabled
            >
              {restaurantStores.map((restaurant) => (
                <StoreCard
                  key={`restaurant-${restaurant.id}`}
                  restaurant={restaurant}
                  width={STORE_WIDTH}
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
          <WaveEdge color={SECTION_TINT} height={34} />
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
    backgroundColor: WHITE,
  },
  scroll: {
    flex: 1,
    backgroundColor: "transparent",
  },
  header: {
    paddingHorizontal: 16,
    paddingBottom: 10,
    backgroundColor: WHITE,
  },
  headerTopRow: {
    minHeight: 52,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  headerIcon: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: "center",
    justifyContent: "center",
  },
  identity: {
    flex: 1,
    minWidth: 0,
    marginHorizontal: 4,
  },
  greeting: {
    color: NAVY,
    fontSize: 16,
    lineHeight: 20,
    fontFamily: "Inter_700Bold",
  },
  addressRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginTop: 2,
  },
  address: {
    flex: 1,
    color: MUTED,
    fontSize: 12,
    fontFamily: "Inter_500Medium",
  },
  headerActions: {
    flexDirection: "row",
    alignItems: "center",
  },
  searchBox: {
    height: 48,
    marginTop: 7,
    paddingHorizontal: 15,
    borderRadius: 25,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: SECTION_TINT,
    shadowColor: NAVY,
    shadowOpacity: 0,
    shadowRadius: 0,
    shadowOffset: { width: 0, height: 0 },
    elevation: 0,
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
    paddingTop: 0,
    paddingBottom: 14,
    backgroundColor: WHITE,
  },
  categoryRow: {
    gap: 13,
    paddingHorizontal: 16,
  },
  categoryItem: {
    width: CATEGORY_WIDTH,
    alignItems: "center",
    gap: 7,
  },
  categoryIcon: {
    width: 62,
    height: 62,
    borderRadius: 21,
    alignItems: "center",
    justifyContent: "center",
  },
  categoryLabel: {
    minHeight: 30,
    color: NAVY,
    fontSize: 11,
    lineHeight: 14,
    textAlign: "center",
    fontFamily: "Inter_600SemiBold",
  },
  section: {
    marginTop: 0,
    paddingBottom: 28,
    backgroundColor: WHITE,
  },
  bannerSection: {
    paddingBottom: 40,
    backgroundColor: WHITE,
  },
  promoSection: {
    marginTop: 0,
    paddingTop: 2,
    paddingBottom: 35,
    position: "relative",
    backgroundColor: SECTION_TINT,
  },
  popularSection: {
    marginTop: 0,
    paddingTop: 2,
    paddingBottom: 35,
    position: "relative",
    backgroundColor: SECTION_TINT,
  },
  newestSection: {
    marginTop: 0,
    paddingBottom: 27,
    backgroundColor: WHITE,
  },
  restaurantSection: {
    marginTop: 0,
    paddingBottom: 40,
    backgroundColor: SECTION_TINT,
  },
  promoBanner: {
    height: Math.min(190, Math.max(148, SCREEN_WIDTH * 0.43)),
    borderRadius: 22,
    overflow: "hidden",
    backgroundColor: PINK_SOFT,
    shadowColor: PINK,
    shadowOpacity: 0.14,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 5 },
    elevation: 3,
  },
  promoImage: {
    width: "100%",
    height: "100%",
  },
  bannerRail: {
    gap: 12,
    paddingHorizontal: 16,
  },
  promoProductGrid: {
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
    gap: 16,
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