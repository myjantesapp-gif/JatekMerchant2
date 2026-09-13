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
  compact?: boolean;
  badgeLabel?: string;
};

export function StoreCard({
  restaurant,
  width,
  onPress,
  compact = false,
  badgeLabel,
}: Props) {
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
      style={({ pressed }) => [
        styles.card,
        compact && styles.cardCompact,
        { width },
        pressed && styles.pressed,
      ]}
    >
      <View style={styles.coverWrap}>
        <Image
          source={{ uri: imageUrl }}
          style={[styles.cover, compact && styles.coverCompact]}
          resizeMode="cover"
        />
        {badgeLabel ? (
          <View style={[styles.badge, badgeLabel === "Promo" && styles.badgePromo]}>
            <Text style={styles.badgeText}>{badgeLabel}</Text>
          </View>
        ) : null}
        {compact ? (
          <View style={styles.compactLogo}>
            {restaurant.logoUrl ? (
              <Image
                source={{ uri: resolveMediaUrl(restaurant.logoUrl) }}
                style={styles.compactLogoImage}
                resizeMode="contain"
              />
            ) : (
              <Text style={styles.logoInitialCompact}>
                {restaurant.name.charAt(0).toUpperCase() || "J"}
              </Text>
            )}
          </View>
        ) : null}
      </View>
      <View style={[styles.info, compact && styles.infoCompact]}>
        {!compact ? (
          <View style={[styles.logo, compact && styles.logoCompact]}>
            {restaurant.logoUrl ? (
              <Image
                source={{ uri: resolveMediaUrl(restaurant.logoUrl) }}
                style={[styles.logoImage, compact && styles.logoImageCompact]}
                resizeMode="contain"
              />
            ) : (
              <Text style={[styles.logoInitial, compact && styles.logoInitialCompact]}>
                {restaurant.name.charAt(0).toUpperCase() || "J"}
              </Text>
            )}
          </View>
        ) : null}
        <View style={[styles.copy, compact && styles.copyCompact]}>
          <Text style={[styles.name, compact && styles.nameCompact]} numberOfLines={1}>
            {restaurant.name}
          </Text>
          <View style={styles.metaRow}>
            <View style={styles.metaItem}>
              <Ionicons name="time-outline" size={compact ? 12 : 14} color={colors.light.mutedForeground} />
              <Text style={[styles.metaText, compact && styles.metaTextCompact]}>{time}</Text>
            </View>
            <View style={styles.metaItem}>
              <Ionicons name="location-outline" size={compact ? 12 : 14} color={colors.light.mutedForeground} />
              <Text style={[styles.metaText, compact && styles.metaTextCompact]}>{fee}</Text>
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
    borderRadius: 14,
    overflow: "hidden",
    backgroundColor: colors.light.card,
    shadowColor: colors.light.heading,
    shadowOpacity: 0.08,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  cardCompact: {
    height: 132,
    borderRadius: 10,
    shadowOpacity: 0.05,
    borderWidth: 1,
    borderColor: colors.light.border,
  },
  pressed: {
    opacity: 0.9,
    transform: [{ scale: 0.98 }],
  },
  coverWrap: {
    position: "relative",
  },
  cover: {
    width: "100%",
    height: 132,
    backgroundColor: colors.light.muted,
  },
  coverCompact: {
    height: 83,
  },
  badge: {
    position: "absolute",
    left: 9,
    top: 9,
    paddingHorizontal: 10,
    height: 24,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.light.success,
  },
  badgePromo: {
    backgroundColor: colors.light.primary,
  },
  badgeText: {
    color: colors.light.heading,
    fontSize: 10,
    lineHeight: 13,
    fontFamily: "Inter_700Bold",
  },
  compactLogo: {
    position: "absolute",
    top: 8,
    right: 8,
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: "center",
    justifyContent: "center",
    padding: 3,
    backgroundColor: colors.light.card,
    shadowColor: colors.light.heading,
    shadowOpacity: 0.14,
    shadowRadius: 5,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
  },
  compactLogoImage: {
    width: "100%",
    height: "100%",
    borderRadius: 99,
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
  infoCompact: {
    minHeight: 49,
    marginTop: -1,
    marginHorizontal: 0,
    paddingHorizontal: 8,
    paddingTop: 7,
    paddingBottom: 6,
    gap: 6,
    borderRadius: 0,
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
  logoCompact: {
    width: 25,
    height: 25,
    borderRadius: 13,
    padding: 2,
  },
  logoImage: {
    width: "100%",
    height: "100%",
    borderRadius: 99,
  },
  logoImageCompact: {
    borderRadius: 99,
  },
  logoInitial: {
    color: colors.light.primary,
    fontSize: 17,
    fontFamily: "Inter_700Bold",
  },
  logoInitialCompact: {
    fontSize: 11,
  },
  copy: {
    flex: 1,
    minWidth: 0,
    gap: 6,
  },
  copyCompact: {
    gap: 3,
  },
  name: {
    color: colors.light.cardForeground,
    fontSize: 15,
    fontFamily: "Inter_700Bold",
  },
  nameCompact: {
    fontSize: 11,
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
  metaTextCompact: {
    fontSize: 8,
  },
});