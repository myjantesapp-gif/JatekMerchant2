import React from "react";
import { Image, Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import type { Restaurant } from "@workspace/api-client-react";
import { formatMad } from "@/lib/money";
import { resolveMediaUrl } from "@/lib/mediaUrl";
import colors from "@/constants/colors";

type Props = {
  restaurant: Restaurant;
  width: number;
  onPress: () => void;
  compact?: boolean;
  badgeLabel?: string;
  variant?: "default" | "home";
  showFee?: boolean;
};

export function StoreCard({
  restaurant,
  width,
  onPress,
  compact = false,
  badgeLabel,
  variant = "default",
  showFee = false,
}: Props) {
  const imageUrl = resolveMediaUrl(restaurant.imageUrl || restaurant.coverImageUrl);
  const rating = (restaurant as Restaurant & { rating?: number | null }).rating;
  const time = restaurant.deliveryTime != null
    ? `${restaurant.deliveryTime}-${restaurant.deliveryTime + 10} min`
    : null;
  const fee = restaurant.deliveryFee != null ? `${formatMad(restaurant.deliveryFee)} DH` : null;

  if (variant === "home") {
    return (
      <Pressable
        onPress={onPress}
        testID={`store-card-${restaurant.id}`}
        style={({ pressed }) => [
          styles.homeCard,
          { width },
          pressed && styles.pressed,
        ]}
      >
        <View style={styles.homeCoverWrap}>
          {imageUrl ? (
            <Image source={{ uri: imageUrl }} style={styles.homeCover} resizeMode="cover" />
          ) : (
            <View style={[styles.homeCover, styles.imagePlaceholder]}>
              <Ionicons name="storefront-outline" size={32} color={colors.light.mutedForeground} />
            </View>
          )}
          <View style={styles.homeLogoCircle}>
            {restaurant.logoUrl ? (
              <Image
                source={{ uri: resolveMediaUrl(restaurant.logoUrl) }}
                style={styles.homeLogoImage}
                resizeMode="contain"
              />
            ) : (
              <Text style={styles.homeLogoInitial}>
                {restaurant.name.charAt(0).toUpperCase()}
              </Text>
            )}
          </View>
          <Pressable hitSlop={8} style={styles.homeHeartBtn}>
            <Ionicons name="heart-outline" size={16} color="#fff" />
          </Pressable>
        </View>
        <View style={styles.homeInfo}>
          <Text style={styles.homeName} numberOfLines={1}>
            {restaurant.name}
          </Text>
          {showFee ? (
            <>
              {rating != null ? (
                <View style={styles.homeMetaRow}>
                  <Ionicons name="star" size={10} color="#F4D03F" />
                  <Text style={styles.homeMetaTextBold}>{rating.toFixed(1)}</Text>
                </View>
              ) : null}
              {time ? <Text style={styles.homeMetaTextLight}>{time}</Text> : null}
              {fee ? <Text style={styles.homeMetaTextLight}>{fee}</Text> : null}
            </>
          ) : (
            <View style={styles.homeMetaRow}>
              {rating != null ? (
                <>
                  <Ionicons name="star" size={10} color="#F4D03F" />
                  <Text style={styles.homeMetaTextBold}>{rating.toFixed(1)}</Text>
                </>
              ) : null}
              {time ? <Text style={styles.homeMetaTextLight}>{time}</Text> : null}
            </View>
          )}
        </View>
      </Pressable>
    );
  }

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
        {imageUrl ? (
          <Image
            source={{ uri: imageUrl }}
            style={[styles.cover, compact && styles.coverCompact]}
            resizeMode="cover"
          />
        ) : (
          <View style={[styles.cover, compact && styles.coverCompact, styles.imagePlaceholder]}>
            <Ionicons name="storefront-outline" size={32} color={colors.light.mutedForeground} />
          </View>
        )}
        {badgeLabel ? (
          <View style={[styles.badge, badgeLabel === "Promo" && styles.badgePromo]}>
            <Text style={[styles.badgeText, badgeLabel === "Promo" && { color: "#FFFFFF" }]}>{badgeLabel}</Text>
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
                {restaurant.name.charAt(0).toUpperCase()}
              </Text>
            )}
          </View>
        ) : null}
        <View style={[styles.copy, compact && styles.copyCompact]}>
          <Text style={[styles.name, compact && styles.nameCompact]} numberOfLines={1}>
            {restaurant.name}
          </Text>
          <View style={styles.metaRow}>
            {rating != null ? (
              <View style={styles.metaItem}>
                <Ionicons name="star" size={compact ? 12 : 14} color="#F4D03F" />
                <Text style={[styles.metaText, compact && styles.metaTextCompact, styles.ratingText]}>
                  {rating.toFixed(1)}
                </Text>
              </View>
            ) : null}
            {time ? (
              <View style={styles.metaItem}>
                <Ionicons name="time-outline" size={compact ? 12 : 14} color={colors.light.mutedForeground} />
                <Text style={[styles.metaText, compact && styles.metaTextCompact]}>{time}</Text>
              </View>
            ) : null}
            {fee ? (
              <View style={styles.metaItem}>
                <Ionicons name="location-outline" size={compact ? 12 : 14} color={colors.light.mutedForeground} />
                <Text style={[styles.metaText, compact && styles.metaTextCompact]}>{fee}</Text>
              </View>
            ) : null}
          </View>
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    minHeight: 236,
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
  imagePlaceholder: {
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.light.muted,
  },
  badge: {
    position: "absolute",
    left: 10,
    top: 10,
    paddingHorizontal: 10,
    height: 24,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#4ADE80",
  },
  badgePromo: {
    backgroundColor: "#E91E63",
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
    flexDirection: "column",
    alignItems: "flex-start",
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
    width: "100%",
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
  ratingText: {
    color: "#475569",
    fontFamily: "Inter_700Bold",
  },
  
  // Home Variant Styles
  homeCard: {
    borderRadius: 12,
    overflow: "hidden",
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#f3f4f6",
  },
  homeCoverWrap: {
    position: "relative",
    height: 88,
    width: "100%",
  },
  homeCover: {
    width: "100%",
    height: "100%",
  },
  homeLogoCircle: {
    position: "absolute",
    top: 6,
    left: 6,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#fff",
    alignItems: "center",
    justifyContent: "center",
    padding: 2,
  },
  homeLogoImage: {
    width: "100%",
    height: "100%",
    borderRadius: 99,
  },
  homeLogoInitial: {
    color: "#E91E63",
    fontSize: 14,
    fontFamily: "Poppins_700Bold",
  },
  homeHeartBtn: {
    position: "absolute",
    top: 6,
    right: 6,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: "rgba(0,0,0,0.3)",
    alignItems: "center",
    justifyContent: "center",
  },
  homeInfo: {
    padding: 8,
    gap: 2,
  },
  homeName: {
    color: "#274C77",
    fontSize: 13,
    fontWeight: "bold",
    fontFamily: "Poppins_700Bold",
  },
  homeMetaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  homeMetaTextBold: {
    color: "#274C77",
    fontSize: 10,
    fontFamily: "Poppins_700Bold",
  },
  homeMetaTextLight: {
    color: "#6b7280",
    fontSize: 10,
    fontFamily: "Poppins_400Regular",
  },
});