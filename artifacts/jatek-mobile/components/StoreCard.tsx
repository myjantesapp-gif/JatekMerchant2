import React from "react";
import { Image, Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import type { Restaurant } from "@workspace/api-client-react";
import { formatMad } from "@/lib/money";
import { resolveMediaUrl } from "@/lib/mediaUrl";
import colors from "@/constants/colors";

const FALLBACK_STORE_IMAGE =
  "https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?auto=format&fit=crop&w=900&q=85";

type Props = {
  restaurant: Restaurant;
  width: number;
  onPress: () => void;
};

export function StoreCard({ restaurant, width, onPress }: Props) {
  const imageUrl = resolveMediaUrl(restaurant.imageUrl || restaurant.coverImageUrl) ?? FALLBACK_STORE_IMAGE;
  const time = restaurant.deliveryTime != null
    ? `${restaurant.deliveryTime} - ${restaurant.deliveryTime + 10} min`
    : "20 - 30 min";
  const fee = restaurant.deliveryFee != null ? `${formatMad(restaurant.deliveryFee)} MAD` : "10,00 MAD";

  return (
    <Pressable
      onPress={onPress}
      testID={`store-card-${restaurant.id}`}
      accessibilityRole="button"
      accessibilityLabel={`Ouvrir ${restaurant.name}`}
      style={({ pressed }) => [styles.card, { width }, pressed && styles.pressed]}
    >
      <Image source={{ uri: imageUrl }} style={styles.cover} resizeMode="cover" />
      <View style={styles.info}>
        <View style={styles.logo}>
          {restaurant.logoUrl ? (
            <Image
              source={{ uri: resolveMediaUrl(restaurant.logoUrl) }}
              style={styles.logoImage}
              resizeMode="contain"
            />
          ) : (
            <Text style={styles.logoInitial}>{restaurant.name.charAt(0).toUpperCase() || "J"}</Text>
          )}
        </View>
        <View style={styles.copy}>
          <Text style={styles.name} numberOfLines={1}>{restaurant.name}</Text>
          <View style={styles.metaRow}>
            <View style={styles.metaItem}>
              <Ionicons name="time-outline" size={14} color={colors.light.mutedForeground} />
              <Text style={styles.metaText}>{time}</Text>
            </View>
            <View style={styles.metaItem}>
              <Ionicons name="location-outline" size={14} color={colors.light.mutedForeground} />
              <Text style={styles.metaText}>{fee}</Text>
            </View>
          </View>
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    height: 206,
    borderRadius: 20,
    overflow: "hidden",
    backgroundColor: colors.light.card,
    shadowColor: colors.light.heading,
    shadowOpacity: 0.08,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  pressed: {
    opacity: 0.9,
    transform: [{ scale: 0.98 }],
  },
  cover: {
    width: "100%",
    height: 132,
    backgroundColor: colors.light.muted,
  },
  info: {
    minHeight: 82,
    marginTop: -12,
    marginHorizontal: 10,
    paddingHorizontal: 10,
    paddingTop: 10,
    paddingBottom: 8,
    flexDirection: "row",
    alignItems: "center",
    gap: 9,
    borderRadius: 14,
    backgroundColor: colors.light.card,
  },
  logo: {
    width: 42,
    height: 42,
    borderRadius: 21,
    padding: 3,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
    backgroundColor: colors.light.primarySoft,
  },
  logoImage: {
    width: "100%",
    height: "100%",
    borderRadius: 99,
  },
  logoInitial: {
    color: colors.light.primary,
    fontSize: 17,
    fontFamily: "Inter_700Bold",
  },
  copy: {
    flex: 1,
    minWidth: 0,
    gap: 6,
  },
  name: {
    color: colors.light.cardForeground,
    fontSize: 15,
    fontFamily: "Inter_700Bold",
  },
  metaRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  metaItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
  },
  metaText: {
    color: colors.light.mutedForeground,
    fontSize: 11,
    fontFamily: "Inter_500Medium",
  },
});