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
import { MediaImage } from "@/components/MediaImage";

type Props = {
  product: RecommendedProduct;
  width: number;
  onPress: () => void;
  compact?: boolean;
  emphasizeImage?: boolean;
  variant?: "default" | "home-compact" | "home-popular" | "home-offer" | "home-free-delivery";
};

export const ProductCard = React.memo(function ProductCard({
  product,
  width,
  onPress,
  compact = false,
  emphasizeImage = false,
  variant = "default",
}: Props) {
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

  const toggleFavorite = (event: any) => {
    event.stopPropagation();
    if (!token) { router.push("/(auth)/login"); return; }
    if (favoritesError) { void refetch(); return; }
    favoriteMutation.mutate();
  };

  if (variant === "home-offer") {
    // "Offres du moment"
    const discount = hasPromotion ? Math.round(((originalPrice! - product.price) / originalPrice!) * 100) : 0;
    return (
      <Pressable
        onPress={onPress}
        style={({ pressed }) => [styles.cardOffer, { width }, pressed && styles.pressed]}
      >
        <View style={styles.offerImageWrap}>
          <MediaImage
            urls={[imageUrl]}
            style={styles.offerImage}
            resizeMode="contain"
            fallback={
            <View style={styles.offerImage} />
            }
          />
          {discount > 0 && (
            <View style={styles.discountBadge}>
              <Text style={styles.discountText}>-{discount}%</Text>
            </View>
          )}
        </View>
        <View style={styles.offerBody}>
          <Text style={styles.offerName} numberOfLines={2}>{product.name}</Text>
          <View style={styles.offerPriceRow}>
            {hasPromotion && (
              <Text style={styles.offerOldPrice}>{formatMad(originalPrice!)} DH</Text>
            )}
            <Text style={styles.offerNewPrice}>{formatMad(product.price)} DH</Text>
          </View>
        </View>
      </Pressable>
    );
  }

  if (variant === "home-free-delivery") {
    // "Livraison gratuite"
    return (
      <Pressable
        onPress={onPress}
        style={({ pressed }) => [styles.cardFreeDelivery, { width }, pressed && styles.pressed]}
      >
        <View style={styles.fdImageWrap}>
          <MediaImage
            urls={[imageUrl]}
            style={styles.fdImage}
            resizeMode="contain"
            fallback={
            <View style={[styles.fdImage, { backgroundColor: "#f3f4f6" }]} />
            }
          />
          <View style={styles.fdBadge}>
            <Ionicons name="car" size={10} color="#fff" />
            <Text style={styles.fdBadgeText}>0 DH</Text>
          </View>
        </View>
        <View style={styles.fdBody}>
          <Text style={styles.fdName} numberOfLines={1}>{product.name}</Text>
          <Text style={styles.fdQty}>1 kg</Text> 
          <View style={styles.fdBottomRow}>
            <View style={styles.fdPriceBlock}>
              {hasPromotion ? <Text style={styles.fdOldPrice}>{formatMad(originalPrice!)} DH</Text> : null}
              <Text style={styles.fdPrice}>{formatMad(product.price)} DH</Text>
            </View>
            <Pressable hitSlop={8} style={styles.addBtn} onPress={(e) => { e.stopPropagation(); onPress(); }}>
              <Ionicons name="add" size={16} color="#fff" />
            </Pressable>
          </View>
        </View>
      </Pressable>
    );
  }

  if (variant === "home-compact" || variant === "home-popular") {
    // "Produits populaires"
    const popularCompact = variant === "home-popular";
    return (
      <Pressable
        onPress={onPress}
        style={({ pressed }) => [styles.homeCardCompact, { width }, pressed && styles.pressed]}
      >
        <View style={styles.compactImageWrap}>
          <MediaImage
            urls={[imageUrl]}
            style={styles.compactImage}
            fallback={
            <View style={[styles.compactImage, { backgroundColor: "#f3f4f6" }]} />
            }
          />
          <View style={styles.compactLogo}>
            {product.restaurantLogoUrl ? (
              <Image
                source={{ uri: resolveMediaUrl(product.restaurantLogoUrl) }}
                style={styles.compactLogoImage}
                resizeMode="contain"
              />
            ) : (
              <Text style={styles.compactLogoText}>{product.restaurantName.charAt(0).toUpperCase() || "J"}</Text>
            )}
          </View>
          <Pressable onPress={toggleFavorite} hitSlop={8} style={styles.heartBtn}>
            <Ionicons name={isFavorite ? "heart" : "heart-outline"} size={16} color={isFavorite ? "#E91E63" : "#4b5563"} />
          </Pressable>
        </View>
        <View style={[styles.compactBody, popularCompact && styles.popularCompactBody]}>
          <Text style={[styles.compactName, popularCompact && styles.popularCompactName]} numberOfLines={1}>{product.name}</Text>
          <View style={styles.compactBottomRow}>
            <View style={styles.compactPriceBlock}>
              {hasPromotion ? <Text style={styles.compactOldPrice}>{formatMad(originalPrice!)} DH</Text> : null}
              <Text style={[styles.compactPrice, popularCompact && styles.popularCompactPrice]}>{formatMad(product.price)} DH</Text>
            </View>
            <Pressable hitSlop={8} style={styles.addBtn} onPress={(e) => { e.stopPropagation(); onPress(); }}>
              <Ionicons name="add" size={16} color="#fff" />
            </Pressable>
          </View>
        </View>
      </Pressable>
    );
  }

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
        <MediaImage
          urls={[imageUrl]}
          style={[styles.image, emphasizeImage && styles.emphasizedImage]}
          resizeMode="contain"
          fallback={<View style={[styles.image, { alignItems: "center", justifyContent: "center" }]}>
              <Ionicons name="image-outline" size={24} color="#9CA3AF" />
            </View>}
        />
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
        <Text style={[styles.name, compact && styles.nameCompact]}>
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
});

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
    paddingTop: 10,
    paddingBottom: 9,
  },
  imageWrapCompact: {
    height: undefined,
    aspectRatio: 1.12,
  },
  image: {
    width: "100%",
    height: "100%",
  },
  emphasizedImage: {
    transform: [{ scale: 1.1 }],
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
    fontSize: 15,
    lineHeight: 19,
    fontWeight: "bold",
    fontFamily: "Inter_700Bold",
  },
  nameCompact: {
    minHeight: 28,
    fontSize: 10,
    lineHeight: 14,
    fontWeight: "bold",
  },
  priceBlock: {
    minHeight: 40,
    alignItems: "flex-start",
    gap: 1,
  },
  price: {
    color: "#EC176B",
    fontSize: 18,
    fontWeight: "bold",
    fontFamily: "Montserrat_800ExtraBold",
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
    color: "#EC176B",
  },
  
  // Home Variants Styles
  // Compact (Produits populaires)
  homeCardCompact: {
    backgroundColor: "#fff",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#f3f4f6",
    overflow: "hidden",
  },
  compactImageWrap: {
    height: 96,
    width: "100%",
    position: "relative",
  },
  compactImage: {
    width: "100%",
    height: "100%",
  },
  compactLogo: {
    position: "absolute",
    top: 6,
    left: 6,
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: "#fff",
    alignItems: "center",
    justifyContent: "center",
    padding: 2,
    shadowColor: "#000",
    shadowOpacity: 0.1,
    shadowRadius: 3,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  compactLogoImage: {
    width: "100%",
    height: "100%",
    borderRadius: 15,
  },
  compactLogoText: {
    fontSize: 12,
    fontFamily: "Poppins_700Bold",
    color: "#E91E63",
  },
  heartBtn: {
    position: "absolute",
    top: 6,
    right: 6,
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: "#fff",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOpacity: 0.1,
    shadowRadius: 3,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  compactBody: {
    padding: 8,
  },
  popularCompactBody: {
    paddingTop: 0,
  },
  compactName: {
    fontSize: 12,
    lineHeight: 15,
    fontWeight: "bold",
    fontFamily: "Montserrat_700Bold",
    color: "#08244A",
    marginBottom: 6,
  },
  popularCompactName: {
    fontSize: 10.5,
    lineHeight: 13,
    marginBottom: 2,
  },
  compactBottomRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  compactPrice: {
    fontSize: 11,
    lineHeight: 14,
    fontWeight: "bold",
    fontFamily: "Montserrat_800ExtraBold",
    color: "#EC176B",
  },
  popularCompactPrice: {
    fontSize: 10,
    lineHeight: 12,
  },
  compactPriceBlock: {
    minHeight: 27,
    justifyContent: "flex-end",
  },
  compactOldPrice: {
    color: "#9CA3AF",
    fontSize: 9,
    lineHeight: 11,
    textDecorationLine: "line-through",
    fontFamily: "Poppins_500Medium",
  },
  addBtn: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: "#E91E63",
    alignItems: "center",
    justifyContent: "center",
  },

  // Offer (Offres du moment)
  cardOffer: {
    flexDirection: "row",
    alignItems: "center",
    minHeight: 124,
    backgroundColor: "#fff",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#f3f4f6",
    overflow: "hidden",
  },
  offerImageWrap: {
    height: 116,
    width: "52%",
    flexShrink: 0,
    padding: 8,
    position: "relative",
    backgroundColor: colors.light.turquoiseSoft,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.light.turquoise + "55",
    overflow: "hidden",
    margin: 6,
  },
  offerImage: {
    width: "100%",
    height: "100%",
  },
  discountBadge: {
    position: "absolute",
    top: 7,
    left: 7,
    backgroundColor: "#E91E63",
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 13,
    borderWidth: 2,
    borderColor: "#fff",
    alignItems: "center",
    justifyContent: "center",
    transform: [{ rotate: "-12deg" }],
  },
  discountText: {
    color: "#fff",
    fontFamily: "Poppins_700Bold",
    fontSize: 11,
  },
  offerBody: {
    flex: 1,
    minWidth: 0,
    padding: 12,
  },
  offerName: {
    fontSize: 13,
    fontWeight: "bold",
    fontFamily: "Poppins_700Bold",
    color: "#274C77",
    marginBottom: 6,
  },
  offerPriceRow: {
    alignItems: "flex-start",
    gap: 1,
  },
  offerOldPrice: {
    fontSize: 12,
    fontFamily: "Poppins_500Medium",
    color: "#9ca3af",
    textDecorationLine: "line-through",
  },
  offerNewPrice: {
    fontSize: 14,
    fontWeight: "bold",
    fontFamily: "Montserrat_800ExtraBold",
    color: "#EC176B",
  },

  // Free Delivery
  cardFreeDelivery: {
    backgroundColor: "#fff",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#f3f4f6",
    padding: 8,
  },
  fdImageWrap: {
    height: 80,
    width: "100%",
    position: "relative",
    marginBottom: 8,
  },
  fdImage: {
    width: "100%",
    height: "100%",
  },
  fdBadge: {
    position: "absolute",
    top: 0,
    right: 0,
    backgroundColor: "#E91E63",
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
    gap: 2,
  },
  fdBadgeText: {
    color: "#fff",
    fontSize: 10,
    fontFamily: "Poppins_600SemiBold",
  },
  fdBody: {
    gap: 2,
  },
  fdName: {
    fontSize: 12,
    fontWeight: "bold",
    fontFamily: "Poppins_700Bold",
    color: "#08244A",
  },
  fdQty: {
    fontSize: 10,
    color: "#6b7280",
    fontFamily: "Poppins_400Regular",
    marginBottom: 4,
  },
  fdBottomRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  fdPrice: {
    fontSize: 18,
    fontWeight: "bold",
    fontFamily: "Montserrat_800ExtraBold",
    color: "#EC176B",
  },
  fdPriceBlock: {
    minHeight: 28,
    justifyContent: "flex-end",
  },
  fdOldPrice: {
    color: "#9CA3AF",
    fontSize: 9,
    lineHeight: 11,
    textDecorationLine: "line-through",
    fontFamily: "Poppins_500Medium",
  },
});