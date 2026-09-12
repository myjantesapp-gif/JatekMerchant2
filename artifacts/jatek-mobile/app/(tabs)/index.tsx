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
import Svg, { Path } from "react-native-svg";
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
import colors from "@/constants/colors";

const { width: SCREEN_WIDTH } = Dimensions.get("window");
const PINK = colors.light.primary;
const PINK_SOFT = colors.light.primarySoft;
const NAVY = colors.light.heading;
const MUTED = colors.light.mutedForeground;
const WHITE = colors.light.background;
const CATEGORY_WIDTH = 82;
const PRODUCT_WIDTH = Math.min(184, Math.max(158, SCREEN_WIDTH * 0.44));
const SHORT_WIDTH = Math.min(138, Math.max(120, SCREEN_WIDTH * 0.32));
const STORE_WIDTH = Math.min(286, Math.max(260, SCREEN_WIDTH * 0.72));
const FALLBACK_PROMO =
  "https://images.unsplash.com/photo-1540420773420-3366772f4999?auto=format&fit=crop&w=1200&q=88";

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

function HomeWaves() {
  return (
    <View pointerEvents="none" style={styles.backgroundWaves}>
      <Svg width="100%" height="100%" viewBox="0 0 100 100" preserveAspectRatio="none">
        <Path
          d="M0 6 C14 0 29 13 46 7 C65 0 82 14 100 5 L100 21 C82 29 65 16 47 23 C29 30 14 17 0 24 Z"
          fill="#FAD7E6"
          opacity={0.62}
        />
        <Path
          d="M0 37 C17 29 33 46 51 38 C69 30 84 45 100 36 L100 52 C83 61 68 47 50 55 C32 62 16 48 0 56 Z"
          fill="#FFF0F6"
          opacity={0.95}
        />
        <Path
          d="M0 73 C15 66 31 81 49 74 C67 67 83 81 100 72 L100 88 C83 97 67 84 49 92 C31 99 16 85 0 94 Z"
          fill="#F7C4D9"
          opacity={0.48}
        />
      </Svg>
    </View>
  );
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
  onPress,
}: {
  ad?: Ad;
  onPress: () => void;
}) {
  const imageUrl = resolveMediaUrl(ad?.imageUrl) ?? FALLBACK_PROMO;
  return (
    <Pressable
      onPress={onPress}
      testID="home-promo-banner"
      accessibilityRole="button"
      accessibilityLabel="Ouvrir les promotions"
      style={({ pressed }) => [styles.promoBanner, pressed && styles.pressed]}
    >
      <Image source={{ uri: imageUrl }} style={styles.promoImage} resizeMode="cover" />
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
    isLoading: adsLoading,
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
    data: popularProducts,
    isLoading: popularLoading,
    isError: popularError,
    refetch: refetchPopular,
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
  const newestStores = useMemo<Restaurant[]>(
    () =>
      [...(restaurants ?? [])]
        .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt))
        .slice(0, 8),
    [restaurants],
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
  const promoAd = useMemo(
    () => (ads ?? []).find((ad) => ad.type === "promo_banner" || ad.type === "hero" || ad.type === "vip_banner"),
    [ads],
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
        refetchPopular,
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
      <HomeWaves />
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
              <Ionicons name="menu" size={24} color={WHITE} />
            </Pressable>
            <Pressable
              onPress={() => setAddressPickerOpen(true)}
              accessibilityRole="button"
              accessibilityLabel={`Adresse de livraison : ${addressLabel}`}
              style={styles.identity}
            >
              <Text style={styles.greeting} numberOfLines={1}>{greeting}</Text>
              <View style={styles.addressRow}>
                <Ionicons name="location" size={14} color={WHITE} />
                <Text style={styles.address} numberOfLines={1}>{addressLabel}</Text>
                <Ionicons name="chevron-down" size={15} color={WHITE} />
              </View>
            </Pressable>
            <View style={styles.headerActions}>
              <Pressable
                onPress={() => setCartSheetVisible(true)}
                accessibilityRole="button"
                accessibilityLabel="Ouvrir le panier"
                style={styles.headerIcon}
              >
                <Ionicons name="bag-handle-outline" size={22} color={WHITE} />
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

        <View style={styles.categorySection}>
          <CategoryRow categories={categories} onPress={openCategory} />
        </View>

        {/* 1. Promos */}
        <View style={styles.section}>
          <SectionHeader title="Promos" onPress={() => router.push("/restaurants" as any)} testID="section-promos" />
          {adsLoading ? (
            <ActivityIndicator color={PINK} style={styles.loader} />
          ) : (
            <PromoBanner ad={promoAd} onPress={() => openAd(promoAd)} />
          )}
        </View>

        {/* 2. Populaires */}
        <View style={styles.popularSection}>
          <View style={styles.popularWaveLayer}>
            <Svg width="100%" height="100%" viewBox="0 0 100 100" preserveAspectRatio="none">
              <Path d="M0 8 C20 1 31 16 50 8 C69 0 82 15 100 7 L100 24 C80 32 68 17 49 25 C30 32 18 18 0 26 Z" fill="#F9C9DC" opacity={0.55} />
              <Path d="M0 68 C19 61 33 78 50 69 C69 60 84 76 100 67 L100 87 C81 95 68 82 50 91 C31 98 17 84 0 94 Z" fill="#FFF0F6" opacity={0.9} />
            </Svg>
          </View>
          <SectionHeader title="Populaires" onPress={() => router.push("/restaurants" as any)} testID="section-popular" />
          {popularLoading || popularError ? (
            <LoadingOrEmpty
              loading={popularLoading}
              error={popularError}
              empty="Aucun produit populaire pour le moment"
              onRetry={() => refetchPopular()}
            />
          ) : popularProducts && popularProducts.length > 0 ? (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.horizontalCards}
              nestedScrollEnabled
            >
              {popularProducts.map((product) => (
                <ProductCard
                  key={`${product.restaurantId}-${product.id}`}
                  product={product}
                  width={PRODUCT_WIDTH}
                  compact
                  onPress={() => openProduct(product)}
                />
              ))}
            </ScrollView>
          ) : (
            <Text style={styles.empty}>Aucun produit populaire pour le moment</Text>
          )}
        </View>

        {/* 3. Shorts */}
        <View style={styles.section}>
          <SectionHeader
            title="Shorts"
            onPress={() => openShort(0)}
            testID="section-shorts"
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

        {/* 4. Nouveautés */}
        <View style={styles.section}>
          <SectionHeader
            title="Nouveautés"
            onPress={() => router.push("/restaurants" as any)}
            testID="section-newest"
          />
          {restaurantsLoading || restaurantsError ? (
            <LoadingOrEmpty
              loading={restaurantsLoading}
              error={restaurantsError}
              empty="Aucun commerce disponible pour le moment"
              onRetry={() => refetchRestaurants()}
            />
          ) : newestStores.length > 0 ? (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.horizontalCards}
              nestedScrollEnabled
            >
              {newestStores.map((restaurant) => (
                <StoreCard
                  key={restaurant.id}
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
            <Text style={styles.empty}>Aucun commerce disponible pour le moment</Text>
          )}
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
  backgroundWaves: {
    ...StyleSheet.absoluteFillObject,
    top: 220,
    opacity: 1,
  },
  header: {
    paddingHorizontal: 16,
    paddingBottom: 16,
    backgroundColor: PINK,
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
    color: WHITE,
    fontSize: 18,
    lineHeight: 22,
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
    color: "rgba(255,255,255,0.9)",
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
    backgroundColor: WHITE,
    shadowColor: NAVY,
    shadowOpacity: 0.1,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 3,
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
    paddingTop: 13,
    paddingBottom: 4,
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
    marginTop: 7,
    paddingBottom: 19,
  },
  popularSection: {
    position: "relative",
    overflow: "hidden",
    marginTop: 7,
    paddingBottom: 20,
    backgroundColor: "rgba(255,240,246,0.72)",
  },
  popularWaveLayer: {
    ...StyleSheet.absoluteFillObject,
    opacity: 0.92,
  },
  promoBanner: {
    height: Math.min(190, Math.max(148, SCREEN_WIDTH * 0.43)),
    marginHorizontal: 16,
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
  horizontalCards: {
    gap: 11,
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