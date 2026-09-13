import React from "react";
import { Image, Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { router } from "expo-router";
import { useAuth } from "@/contexts/AuthContext";
import { useFriendlyAlert } from "@/components/FriendlyAlert";
import { listFavorites, addFavorite, removeFavorite } from "@/lib/api";

import type { RecommendedProduct } from "@/lib/api";
import { formatMad } from "@/lib/money";
import { resolveMediaUrl } from "@/lib/mediaUrl";
import colors from "@/constants/colors";

type Props = {
  product: RecommendedProduct;
  width: number;
  onPress: () => void;
  compact?: boolean;
};

export function ProductCard({ product, width, onPress, compact = false }: Props) {
  const { token, user } = useAuth();
  const alert = useFriendlyAlert();
  const queryClient = useQueryClient();
  const favoritesKey = ["home-favorites", user?.id];
  const { data: favorites, isLoading: favoritesLoading, isError: favoritesError, refetch } = useQuery({
    queryKey: favoritesKey,
    queryFn: listFavorites,
    enabled: !!token,
    staleTime: 15_000,
  });
  const isFavorite = favorites?.some((favorite) => favorite.restaurantId === product.restaurantId) ?? false;
  const favoriteMutation = useMutation({
    mutationFn: () => isFavorite ? removeFavorite(product.restaurantId) : addFavorite(product.restaurantId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: favoritesKey }),
    onError: () => alert.show({
      tone: "error", title: "Favoris",
      message: "Impossible de mettre à jour vos favoris. Réessayez.",
      hideSecondary: true,
    }),
  });
  const originalPrice = product.originalPrice ?? product.oldPrice ?? product.compareAtPrice ?? null;
  const hasPromotion = typeof originalPrice === "number" && originalPrice > product.price;
  const imageUrl = resolveMediaUrl(product.imageUrl);

  return (
    <Pressable
      onPress={onPress}
      testID={`product-card-${product.id}`}
      accessibilityRole="button"
      accessibilityLabel={`${product.name}, ${formatMad(product.price)} dirhams`}
      style={({ pressed }) => [
        styles.card,
        compact && styles.cardCompact,
        { width },
        pressed && styles.pressed,
      ]}
    >
      <View style={[styles.imageWrap, compact && styles.imageWrapCompact]}>
        {imageUrl ? <Image source={{ uri: imageUrl }} style={styles.image} resizeMode="contain" />
          : <View style={[styles.image, { alignItems: "center", justifyContent: "center" }]}>
              <Ionicons name="image-outline" size={24} color="#9CA3AF" />
            </View>}
        <View style={[styles.restaurantLogo, compact && styles.restaurantLogoCompact]}>
          {product.restaurantLogoUrl ? (
            <Image
              source={{ uri: resolveMediaUrl(product.restaurantLogoUrl) }}
              style={styles.restaurantLogoImage}
              resizeMode="contain"
            />
          ) : (
            <Text style={styles.restaurantInitial}>
              {product.restaurantName.trim().charAt(0).toUpperCase() || "J"}
            </Text>
          )}
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`${isFavorite ? "Retirer" : "Ajouter"} ${product.restaurantName} des favoris`}
          accessibilityState={{ selected: isFavorite, disabled: favoriteMutation.isPending }}
          disabled={favoriteMutation.isPending || (!!token && favoritesLoading)}
          hitSlop={4}
          onPress={(event) => {
            event.stopPropagation();
            if (!token) { router.push("/(auth)/login"); return; }
            if (favoritesError) { void refetch(); return; }
            favoriteMutation.mutate();
          }}
          style={[styles.favoriteButton, compact && styles.favoriteButtonCompact]}>
          <Ionicons name={isFavorite ? "heart" : "heart-outline"} size={compact ? 13 : 17} color="#E91E63" />
        </Pressable>
        <Pressable accessibilityRole="button" accessibilityLabel={`Choisir ${product.name}`}
          hitSlop={4} onPress={(event) => { event.stopPropagation(); onPress(); }}
          style={[styles.addButton, compact && styles.addButtonCompact]}>
          <Ionicons name="add" size={compact ? 16 : 19} color="#FFFFFF" />
        </Pressable>
      </View>
      <View style={[styles.body, compact && styles.bodyCompact]}>
        <Text style={[styles.name, compact && styles.nameCompact]} numberOfLines={2}>
          {product.name}
        </Text>
        <View style={styles.priceBlock}>
          {hasPromotion ? (
            <Text style={[styles.compareAtPrice, compact && styles.compareAtPriceCompact]}>
              {formatMad(originalPrice!)} DH
            </Text>
          ) : null}
          <Text style={[styles.price, compact && styles.priceCompact, hasPromotion && styles.promoPrice]}>
            {formatMad(product.price)} DH
          </Text>
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.light.card,
    borderRadius: 18,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: colors.light.border,
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  cardCompact: {
    borderRadius: 15,
    shadowOpacity: 0.05,
  },
  pressed: {
    opacity: 0.9,
    transform: [{ scale: 0.98 }],
  },
  imageWrap: {
    height: 148,
    position: "relative",
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 5,
    paddingTop: 20,
    paddingBottom: 18,
  },
  imageWrapCompact: {
    height: undefined,
    aspectRatio: 1.05,
  },
  image: {
    width: "100%",
    height: "100%",
  },
  restaurantLogo: {
    position: "absolute",
    top: 10,
    left: 10,
    width: 36,
    height: 36,
    borderRadius: 18,
    padding: 3,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
    backgroundColor: colors.light.card,
    borderWidth: 2,
    borderColor: colors.light.card,
    shadowColor: colors.light.heading,
    shadowOpacity: 0.15,
    shadowRadius: 5,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
  },
  restaurantLogoCompact: {
    top: 7,
    left: 7,
    width: 22,
    height: 22,
    borderRadius: 11,
    padding: 2,
  },
  restaurantLogoImage: {
    width: "100%",
    height: "100%",
    borderRadius: 99,
  },
  restaurantInitial: {
    color: colors.light.primary,
    fontSize: 15,
    fontFamily: "Inter_700Bold",
  },
  favoriteButton: {
    position: "absolute",
    top: 10,
    right: 10,
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.94)",
  },
  favoriteButtonCompact: {
    top: 6,
    right: 6,
    width: 22,
    height: 22,
    borderRadius: 11,
  },
  addButton: {
    position: "absolute",
    right: 10,
    bottom: 10,
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#E91E63",
    shadowColor: "#E91E63",
    shadowOpacity: 0.24,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
  },
  addButtonCompact: {
    right: 7,
    bottom: 7,
    width: 24,
    height: 24,
    borderRadius: 12,
  },
  body: {
    paddingHorizontal: 12,
    paddingTop: 12,
    paddingBottom: 14,
    gap: 6,
  },
  bodyCompact: {
    paddingHorizontal: 8,
    paddingTop: 6,
    paddingBottom: 8,
    gap: 3,
  },
  name: {
    minHeight: 34,
    color: colors.light.cardForeground,
    fontSize: 14,
    lineHeight: 19,
    fontFamily: "Inter_700Bold",
  },
  nameCompact: {
    minHeight: 30,
    fontSize: 10,
    lineHeight: 14,
  },
  priceBlock: {
    minHeight: 40,
    alignItems: "flex-start",
    gap: 1,
  },
  price: {
    color: "#E91E63",
    fontSize: 15,
    fontFamily: "Inter_700Bold",
  },
  priceCompact: {
    fontSize: 12,
  },
  compareAtPrice: {
    color: "#9CA3AF",
    fontSize: 12,
    textDecorationLine: "line-through",
    fontFamily: "Inter_500Medium",
  },
  compareAtPriceCompact: {
    fontSize: 9,
  },
  promoPrice: {
    color: "#E91E63",
  },
});