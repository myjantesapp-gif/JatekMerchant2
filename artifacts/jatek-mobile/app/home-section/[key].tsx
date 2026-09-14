import React, { useMemo } from "react";
import {
  ActivityIndicator,
  Dimensions,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
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
const { width: SCREEN_WIDTH } = Dimensions.get("window");

type HomeSectionViewConfig = Omit<HomeSectionConfig, "key">;

function normalize(value: unknown): string {
  return String(value ?? "")
    .toLocaleLowerCase("fr-FR")
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "");
}

function isRestaurantSection(source?: string): boolean {
  return source === "new_restaurants" || source === "supermarkets" || source === "all_restaurants" || source === "shops";
}

function isProductSection(source?: string): boolean {
  return source === "popular" || source === "newest" || source === "promos" || source === "free_delivery";
}

function findBusinessCategory(categories: any[], source?: string) {
  if (source === "all_restaurants") return undefined;
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

function ProductGrid({ products }: { products: RecommendedProduct[] }) {
  const cardWidth = Math.max(0, (SCREEN_WIDTH - 48) / 2);

  return (
    <View style={styles.productGrid}>
      {products.map((product) => (
        <ProductCard
          key={`${product.restaurantId}-${product.id}`}
          product={product}
          width={cardWidth}
          onPress={() =>
            router.push({
              pathname: "/restaurant/[id]",
              params: { id: String(product.restaurantId), productId: String(product.id) },
            })
          }
        />
      ))}
    </View>
  );
}

function RestaurantGrid({ restaurants }: { restaurants: Restaurant[] }) {
  const cardWidth = Math.max(0, (SCREEN_WIDTH - 48) / 2);

  return (
    <View style={styles.restaurantGrid}>
      {restaurants.map((restaurant) => (
        <StoreCard
          key={restaurant.id}
          restaurant={restaurant}
          width={cardWidth}
          onPress={() => router.push({ pathname: "/restaurant/[id]", params: { id: String(restaurant.id) } })}
          showFee
        />
      ))}
    </View>
  );
}

export default function HomeSectionScreen() {
  const { key } = useLocalSearchParams<{ key: string }>();
  const insets = useSafeAreaInsets();
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
        enabled: restaurantSection && (source === "all_restaurants" || Boolean(businessType)),
      },
    } as any,
  );
  const productSort = source === "promos" ? "promos" : source === "newest" ? "newest" : "catalog";
  const {
    data: recommendedProducts = [],
    isLoading: productsLoading,
    isError: productsError,
  } = useQuery({
    queryKey: ["home-section-products", sectionKey, productSort],
    queryFn: () => listRecommendedProducts({ limit: 30, sort: productSort }),
    enabled: productSection,
    staleTime: 60_000,
  });
  const products = useMemo(
    () => source === "free_delivery"
      ? recommendedProducts.filter((product) => product.deliveryFee === 0)
      : recommendedProducts,
    [recommendedProducts, source],
  );
  const loading = configLoading
    || (restaurantSection && (categoriesLoading || restaurantsLoading))
    || (productSection && productsLoading);
  const error = restaurantsError || productsError;

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

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 32 }]}
      >
        {loading ? <ActivityIndicator color={PINK} style={styles.loader} /> : null}
        {!loading && error ? <Text style={styles.empty}>Impossible de charger ce contenu</Text> : null}
        {!loading && !error && restaurantSection && !restaurantCategory ? (
          <Text style={styles.empty}>Aucune catégorie correspondante</Text>
        ) : null}
        {!loading && !error && restaurantSection && restaurantCategory && restaurants.length === 0 ? (
          <Text style={styles.empty}>Aucun établissement disponible</Text>
        ) : null}
        {!loading && !error && productSection && products.length === 0 ? (
          <Text style={styles.empty}>Aucun produit disponible</Text>
        ) : null}
        {!loading && !error && restaurantSection && restaurantCategory && restaurants.length > 0 ? (
          <RestaurantGrid restaurants={restaurants as Restaurant[]} />
        ) : null}
        {!loading && !error && productSection && products.length > 0 ? (
          <ProductGrid products={products} />
        ) : null}
      </ScrollView>
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
  productGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 16,
  },
  restaurantGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 16,
  },
});