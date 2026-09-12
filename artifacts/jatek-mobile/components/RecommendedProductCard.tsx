import React from "react";
import {
  Image,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";

import type { RecommendedProduct } from "@/lib/api";
import { formatMad } from "@/lib/money";
import { resolveMediaUrl } from "@/lib/mediaUrl";

const PINK = "#E91E63";
const TEXT_DARK = "#0A1B3D";
const TEXT_MUTED = "#6B7280";

type Props = {
  product: RecommendedProduct;
  width: number;
  onPress: () => void;
  compact?: boolean; // Kept for interface compatibility, but we enforce the new layout
};

export function RecommendedProductCard({ product, width, onPress, compact = false }: Props) {
  const hasPromotion = typeof product.compareAtPrice === "number"
    && product.compareAtPrice > product.price;
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${product.name}, ${product.restaurantName}, ${formatMad(product.price)} dirhams${hasPromotion ? ` au lieu de ${formatMad(product.compareAtPrice!)} dirhams` : ""}`}
      style={({ pressed }) => [
        styles.card,
        compact && styles.cardCompact,
        { width },
        pressed && { opacity: 0.9, transform: [{ scale: 0.98 }] },
      ]}
    >
      <View style={[styles.imageWrap, compact && styles.imageWrapCompact]}>
        <Image
          source={{ uri: resolveMediaUrl(product.imageUrl) ?? product.imageUrl }}
          style={styles.image}
          resizeMode="cover"
        />
        {/* Merchant logo top-left */}
        {product.restaurantLogoUrl ? (
          <View style={[styles.merchantLogoWrap, compact && styles.merchantLogoWrapCompact]}>
            <Image
              source={{ uri: resolveMediaUrl(product.restaurantLogoUrl) }}
              style={styles.merchantLogo}
              resizeMode="contain"
            />
          </View>
        ) : null}

        {/* Plus affordance bottom-right */}
        <View style={[styles.plusButton, compact && styles.plusButtonCompact]}>
          <Ionicons name="add" size={compact ? 15 : 18} color={PINK} />
        </View>
      </View>

      <View style={[styles.body, compact && styles.bodyCompact]}>
        <Text style={[styles.name, compact && styles.nameCompact]} numberOfLines={2}>{product.name}</Text>
        <View style={styles.priceRow}>
          <Text style={[styles.price, compact && styles.priceCompact]}>{formatMad(product.price)} DH</Text>
          {hasPromotion ? (
            <Text style={[styles.compareAtPrice, compact && styles.compareAtPriceCompact]}>
              {formatMad(product.compareAtPrice!)} DH
            </Text>
          ) : null}
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: "#fff",
    borderRadius: 16,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
    borderWidth: 1,
    borderColor: "#F0F0F5",
  },
  cardCompact: {
    borderRadius: 12,
    shadowOpacity: 0.04,
    shadowRadius: 6,
  },
  imageWrap: {
    height: 120,
    backgroundColor: "#F8F8F8",
    position: "relative",
  },
  imageWrapCompact: {
    height: 76,
  },
  image: {
    width: "100%",
    height: "100%",
  },
  merchantLogoWrap: {
    position: "absolute",
    top: 8,
    left: 8,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#fff",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOpacity: 0.1,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
    overflow: "hidden",
    padding: 2,
  },
  merchantLogoWrapCompact: {
    top: 5,
    left: 5,
    width: 26,
    height: 26,
    borderRadius: 13,
  },
  merchantLogo: {
    width: "100%",
    height: "100%",
    borderRadius: 14,
  },
  plusButton: {
    position: "absolute",
    right: 8,
    bottom: 8,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "#fff",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOpacity: 0.15,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
    elevation: 3,
  },
  plusButtonCompact: {
    right: 5,
    bottom: 5,
    width: 23,
    height: 23,
    borderRadius: 12,
  },
  body: {
    paddingHorizontal: 12,
    paddingTop: 12,
    paddingBottom: 14,
    gap: 6,
  },
  bodyCompact: {
    paddingHorizontal: 7,
    paddingTop: 7,
    paddingBottom: 9,
    gap: 3,
  },
  name: {
    color: TEXT_DARK,
    fontSize: 13,
    fontFamily: "Inter_700Bold",
    lineHeight: 18,
    minHeight: 36, // Reserve 2 lines so price alignment is consistent
  },
  nameCompact: {
    fontSize: 10,
    lineHeight: 13,
    minHeight: 26,
  },
  priceRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 2,
  },
  price: {
    color: PINK,
    fontSize: 14,
    fontFamily: "Inter_700Bold",
  },
  priceCompact: {
    fontSize: 11,
  },
  compareAtPrice: {
    color: TEXT_MUTED,
    fontSize: 12,
    fontFamily: "Inter_500Medium",
    textDecorationLine: "line-through",
  },
  compareAtPriceCompact: {
    fontSize: 9,
  },
});