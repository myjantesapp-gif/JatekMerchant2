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
  compact?: boolean;
};

export function RecommendedProductCard({ product, width, onPress, compact = false }: Props) {
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
      <View style={[styles.imageWrap, compact && styles.imageWrapCompact]}>
        <Image
          source={{ uri: resolveMediaUrl(product.imageUrl) ?? product.imageUrl }}
          style={styles.image}
          resizeMode="cover"
        />
        <View style={[styles.arrow, compact && styles.arrowCompact]}>
          <Ionicons name="arrow-forward" size={compact ? 11 : 14} color={PINK} />
        </View>
      </View>
      <View style={[styles.body, compact && styles.bodyCompact]}>
        <Text style={[styles.name, compact && styles.nameCompact]} numberOfLines={1}>{product.name}</Text>
        <Text style={[styles.merchant, compact && styles.merchantCompact]} numberOfLines={1}>{product.restaurantName}</Text>
        <Text style={[styles.price, compact && styles.priceCompact]}>{formatMad(product.price)} MAD</Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: "#fff",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#F2DDE7",
    overflow: "hidden",
    shadowColor: PINK,
    shadowOpacity: 0.08,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  imageWrap: {
    height: 132,
    backgroundColor: "#FFF1F6",
    position: "relative",
  },
  imageWrapCompact: {
    height: 82,
  },
  image: { width: "100%", height: "100%" },
  arrow: {
    position: "absolute",
    right: 9,
    bottom: 9,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "#fff",
    alignItems: "center",
    justifyContent: "center",
  },
  arrowCompact: {
    right: 6,
    bottom: 6,
    width: 22,
    height: 22,
    borderRadius: 11,
  },
  body: { paddingHorizontal: 11, paddingTop: 10, paddingBottom: 12, gap: 3 },
  bodyCompact: {
    paddingHorizontal: 7,
    paddingTop: 7,
    paddingBottom: 8,
    gap: 2,
  },
  name: {
    color: TEXT_DARK,
    fontSize: 14,
    fontFamily: "Inter_700Bold",
  },
  nameCompact: {
    fontSize: 11,
  },
  merchant: {
    color: TEXT_MUTED,
    fontSize: 11,
    fontFamily: "Inter_500Medium",
  },
  merchantCompact: {
    fontSize: 9,
  },
  price: {
    color: PINK,
    fontSize: 14,
    fontFamily: "Inter_900Black",
    marginTop: 4,
  },
  priceCompact: {
    fontSize: 11,
    marginTop: 2,
  },
});