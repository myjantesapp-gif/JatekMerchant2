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
  const oldPrice = (product as any).oldPrice;

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${product.name}, ${product.restaurantName}, ${formatMad(product.price)} dirhams`}
      style={({ pressed }) => [
        styles.card,
        { width },
        pressed && { opacity: 0.9, transform: [{ scale: 0.98 }] },
      ]}
    >
      <View style={styles.imageWrap}>
        <Image
          source={{ uri: resolveMediaUrl(product.imageUrl) ?? product.imageUrl }}
          style={styles.image}
          resizeMode="cover"
        />
        {/* Merchant logo top-left */}
        {product.restaurantLogoUrl ? (
          <View style={styles.merchantLogoWrap}>
            <Image
              source={{ uri: resolveMediaUrl(product.restaurantLogoUrl) }}
              style={styles.merchantLogo}
              resizeMode="contain"
            />
          </View>
        ) : null}

        {/* Plus affordance bottom-right */}
        <View style={styles.plusButton}>
          <Ionicons name="add" size={18} color={PINK} />
        </View>
      </View>

      <View style={styles.body}>
        <Text style={styles.name} numberOfLines={2}>{product.name}</Text>
        <View style={styles.priceRow}>
          <Text style={styles.price}>{formatMad(product.price)} DH</Text>
          {oldPrice ? (
            <Text style={styles.oldPrice}>{formatMad(oldPrice)} DH</Text>
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
  imageWrap: {
    height: 120,
    backgroundColor: "#F8F8F8",
    position: "relative",
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
  body: {
    paddingHorizontal: 12,
    paddingTop: 12,
    paddingBottom: 14,
    gap: 6,
  },
  name: {
    color: TEXT_DARK,
    fontSize: 13,
    fontFamily: "Inter_700Bold",
    lineHeight: 18,
    minHeight: 36, // Reserve 2 lines so price alignment is consistent
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
    fontFamily: "Inter_800ExtraBold",
  },
  oldPrice: {
    color: "#A0AAB0",
    fontSize: 12,
    fontFamily: "Inter_500Medium",
    textDecorationLine: "line-through",
  },
});