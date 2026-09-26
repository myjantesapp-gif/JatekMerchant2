import React, { useCallback, useMemo } from "react";
import {
  ActivityIndicator,
  FlatList,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from "react-native";
import { router, Stack, useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useQuery } from "@tanstack/react-query";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  useListCategories,
  useListRestaurants,
  type Restaurant,
} from "@workspace/api-client-react";

import {
  getPublicAppConfig,
  listRecommendedProducts,
  listRecommendedRestaurants,
  type HomeSectionConfig,
  type HomeSectionKey,
  type RecommendedProduct,
} from "@/lib/api";
import { ProductCard } from "@/components/ProductCard";
import { StoreCard } from "@/components/StoreCard";

const PINK = "#E91E63";
const NAVY = "#0F172A";
const MUTED = "#64748B";
const PAGE_BG = "#FAFAFA";
type HomeSectionViewConfig = Omit<HomeSectionConfig, "key">;
type GridEntry =
  | { kind: "product"; value: RecommendedProduct }
  | { kind: "restaurant"; value: Restaurant };

function normalize(value: unknown): string {
  return String(value ?? "")
    .toLocaleLowerCase("fr-FR")
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "");
}

function isRestaurantSection(source?: string): boolean {
  return source === "new_restaurants" || source === "supermarkets" || source === "all_restaurants" || source === "shops" || source === "recommended_restaurants";
}

function isProductSection(source?: string): boolean {
  return source === "popular" || source === "newest" || source === "promos" || source === "free_delivery" || source === "recommended_products";
}

function findBusinessCategory(categories: any[], source?: string) {
  if (source === "all_restaurants" || source === "recommended_restaurants") return undefined;
  const roots = categories.filter((category) => category.parentId == null && category.isActive !== false);
  const matches = (category: any, terms: string[]) => {
    const value = normalize(`${category.businessType} ${category.slug} ${category.name}`);
    return terms.some((term) => value.includes(normalize(term)));
  };

  if (source === "shops") {
    return roots.find((category) => matches(category, ["shop", "boutique", "store", "market"]))
      ?? roots.find((category) => !matches(category, ["restaurant", "restauration", "food"]));
  }
  if (source === "supermarkets") {
    return roots.find((category) => matches(category, ["supermarket", "supermarché", "market"]));
  }

  return roots.find((category) => matches(category, ["restaurant", "restauration", "food"]));
}

export default function HomeSectionScreen() {
  const { key } = useLocalSearchParams<{ key: string }>();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const gridColumns = width >= 1100 ? 4 : width >= 760 ? 3 : 2;
  const sectionKey = key as HomeSectionKey;
  const { data: appConfig, isLoading: configLoading } = useQuery({
    queryKey: ["public-app-config", "home-section", sectionKey],
    queryFn: getPublicAppConfig,
    staleTime: 60_000,
  });
  const section = (appConfig?.homeSections?.[sectionKey] ?? null) as HomeSectionViewConfig | null;
  const source = section?.source;
  const restaurantSection = isRestaurantSection(source);
  const productSection = isProductSection(source);
  const { data: categories = [], isLoading: categoriesLoading } = useListCategories({
    query: { enabled: restaurantSection } as any,
  } as any);
  const restaurantCategory = useMemo(
    () => findBusinessCategory(categories as any[], source),
    [categories, source],
  );
  const businessType = restaurantCategory?.businessType;
  const {
    data: restaurants = [],
    isLoading: restaurantsLoading,
    isError: restaurantsError,
  } = useListRestaurants(
    { businessType },
    {
      query: {
        enabled: restaurantSection && source !== "recommended_restaurants" && (source === "all_restaurants" || Boolean(businessType)),
      },
    } as any,
  );
  const productSort = source === "recommended_products"
    ? "recommended"
    : source === "promos" ? "promos" : source === "newest" ? "newest" : "catalog";
  const {
    data: recommendedProducts = [],
    isLoading: productsLoading,
    isError: productsError,
  } = useQuery({
    queryKey: ["home-section-products", sectionKey, productSort],
    queryFn: () => listRecommendedProducts({ limit: 30, sort: productSort }),
    enabled: productSection,
    staleTime: 60_000,
    refetchInterval: 30_000,
  });
  const {
    data: recommendedRestaurants = [],
    isLoading: recommendedRestaurantsLoading,
    isError: recommendedRestaurantsError,
  } = useQuery({
    queryKey: ["home-section-recommended-restaurants", sectionKey],
    queryFn: () => listRecommendedRestaurants({ limit: 30 }),
    enabled: source === "recommended_restaurants",
    staleTime: 30_000,
    refetchInterval: 30_000,
  });
  const products = useMemo(
    () => source === "free_delivery"
      ? recommendedProducts.filter((product) => product.deliveryFee === 0)
      : recommendedProducts,
    [recommendedProducts, source],
  );
  const loading = configLoading
    || (restaurantSection && source !== "recommended_restaurants" && (categoriesLoading || restaurantsLoading))
    || (source === "recommended_restaurants" && recommendedRestaurantsLoading)
    || (productSection && productsLoading);
  const error = restaurantsError || productsError || (source === "recommended_restaurants" && recommendedRestaurantsError);
  const entries = useMemo<GridEntry[]>(() => {
    if (loading || error) return [];
    if (productSection) return products.map((value) => ({ kind: "product", value }));
    if (source === "recommended_restaurants") {
      return (recommendedRestaurants as Restaurant[]).map((value) => ({ kind: "restaurant", value }));
    }
    if (restaurantSection && restaurantCategory) {
      return (restaurants as Restaurant[]).map((value) => ({ kind: "restaurant", value }));
    }
    return [];
  }, [
    error,
    loading,
    productSection,
    products,
    recommendedRestaurants,
    restaurantCategory,
    restaurantSection,
    restaurants,
    source,
  ]);
  const contentWidth = Math.min(width, 1280);
  const cardWidth = Math.max(0, (contentWidth - 32 - 16 * (gridColumns - 1)) / gridColumns);
  const renderItem = useCallback(({ item }: { item: GridEntry }) => {
    if (item.kind === "product") {
      const product = item.value;
      return (
        <ProductCard
          product={product}
          width={cardWidth}
          onPress={() => router.push({
            pathname: "/restaurant/[id]",
            params: { id: String(product.restaurantId), productId: String(product.id) },
          })}
        />
      );
    }
    const restaurant = item.value;
    return (
      <StoreCard
        restaurant={restaurant}
        width={cardWidth}
        onPress={() => router.push({ pathname: "/restaurant/[id]", params: { id: String(restaurant.id) } })}
        showFee
      />
    );
  }, [cardWidth]);
  const emptyContent = useMemo(() => {
    if (loading) return <ActivityIndicator color={PINK} style={styles.loader} />;
    if (error) return <Text style={styles.empty}>Impossible de charger ce contenu</Text>;
    if (restaurantSection && source !== "recommended_restaurants" && !restaurantCategory) {
      return <Text style={styles.empty}>Aucune catégorie correspondante</Text>;
    }
    if (source === "recommended_restaurants") {
      return <Text style={styles.empty}>Aucun restaurant recommandé</Text>;
    }
    if (restaurantSection) return <Text style={styles.empty}>Aucun établissement disponible</Text>;
    if (productSection) return <Text style={styles.empty}>Aucun produit disponible</Text>;
    return null;
  }, [error, loading, productSection, restaurantCategory, restaurantSection, source]);

  return (
    <View style={styles.root}>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <Pressable
          onPress={() => router.back()}
          hitSlop={10}
          style={styles.backButton}
          accessibilityRole="button"
          accessibilityLabel="Retour"
        >
          <Ionicons name="chevron-back" size={24} color={NAVY} />
        </Pressable>
        <Text style={styles.title} numberOfLines={1}>{section?.title ?? ""}</Text>
        <View style={styles.headerSpacer} />
      </View>

      <FlatList
        data={entries}
        renderItem={renderItem}
        keyExtractor={(item) => item.kind === "product"
          ? `product-${item.value.restaurantId}-${item.value.id}`
          : `restaurant-${item.value.id}`}
        numColumns={gridColumns}
        columnWrapperStyle={styles.gridRow}
        ItemSeparatorComponent={() => <View style={styles.rowSeparator} />}
        ListEmptyComponent={emptyContent}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.content, { width: "100%", maxWidth: 1280, alignSelf: "center", paddingBottom: insets.bottom + 32 }]}
        initialNumToRender={8}
        maxToRenderPerBatch={8}
        updateCellsBatchingPeriod={40}
        windowSize={7}
        removeClippedSubviews={Platform.OS !== "web"}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: PAGE_BG,
  },
  header: {
    minHeight: 64,
    paddingHorizontal: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: "#FFFFFF",
    borderBottomWidth: 1,
    borderBottomColor: "#F1F5F9",
  },
  backButton: {
    width: 36,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
  },
  title: {
    flex: 1,
    color: NAVY,
    fontSize: 20,
    fontWeight: "bold",
    fontFamily: "Poppins_700Bold",
  },
  headerSpacer: {
    width: 36,
  },
  content: {
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  loader: {
    marginTop: 40,
  },
  empty: {
    paddingVertical: 36,
    color: MUTED,
    fontSize: 14,
    textAlign: "center",
    fontFamily: "Inter_500Medium",
  },
  gridRow: {
    flexDirection: "row",
    columnGap: 16,
  },
  rowSeparator: { height: 16 },
});