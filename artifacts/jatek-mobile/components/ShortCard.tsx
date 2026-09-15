import React, { useMemo, useState } from "react";
import { Image, Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";

import type { Short } from "@/lib/api";
import { getYouTubeThumbnailUrl, resolveMediaUrl } from "@/lib/mediaUrl";
import colors from "@/constants/colors";

type Props = {
  short: Short;
  width: number;
  avatarUrl?: string | null;
  onPress: () => void;
  variant?: "default" | "home";
};

export function ShortCard({ short, width, avatarUrl, onPress, variant = "default" }: Props) {
  const [sourceIndex, setSourceIndex] = useState(0);
  const sources = useMemo(
    () =>
      [resolveMediaUrl(short.imageUrl), getYouTubeThumbnailUrl(short.videoUrl)].filter(
        (value): value is string => Boolean(value),
      ),
    [short.imageUrl, short.videoUrl],
  );
  const merchantName = short.restaurantName?.trim() || "";
  const initials = merchantName.charAt(0).toUpperCase();
  const shortWithViews = short as Short & { views?: number; viewCount?: number };
  const viewCount = shortWithViews.viewCount ?? shortWithViews.views;

  if (sources.length === 0) return null;

  const source = sources[Math.min(sourceIndex, sources.length - 1)];
  
  const formattedViews =
    viewCount == null
      ? "— vues"
      : viewCount >= 1000
        ? `${(viewCount / 1000).toLocaleString("fr-FR", { maximumFractionDigits: 1 })}K vues`
        : `${viewCount.toLocaleString("fr-FR")} vues`;

  if (variant === "home") {
    return (
      <Pressable
        onPress={onPress}
        testID={`short-card-${short.id}`}
        accessibilityRole="button"
        accessibilityLabel={`Short ${short.title || merchantName}`}
        style={({ pressed }) => [
          styles.homeCard,
          { width, height: Math.round(width * 1.7) },
          pressed && styles.pressed,
        ]}
      >
        <Image
          source={{ uri: source }}
          style={styles.image}
          resizeMode="cover"
          onError={() => setSourceIndex((index) => Math.min(index + 1, sources.length - 1))}
        />
        <View style={styles.scrim} />
        <View style={styles.avatar}>
          {avatarUrl ? (
            <Image source={{ uri: resolveMediaUrl(avatarUrl) }} style={styles.avatarImage} resizeMode="contain" />
          ) : (
            <Image
              source={require("../assets/images/jatek-app-icon.png")}
              style={styles.avatarImage}
              resizeMode="contain"
              accessibilityLabel="Logo Jatek"
            />
          )}
        </View>
        <LinearGradient
          colors={["transparent", "rgba(0,0,0,0.76)"]}
          style={styles.bottomOverlay}
          pointerEvents="none"
        >
          <View style={styles.shortMeta}>
            <View style={styles.shortCopy}>
              <Text style={styles.shortTitle} numberOfLines={2}>
                {short.title || "Découvrez ce Short"}
              </Text>
              <View style={styles.views}>
                <Ionicons name="eye" size={15} color="#FFFFFF" />
                <Text style={styles.viewsText}>{formattedViews}</Text>
              </View>
            </View>
            <View style={styles.homePlayBadge}>
              <Ionicons name="play" size={14} color="#FFFFFF" style={{ marginLeft: 2 }} />
            </View>
          </View>
        </LinearGradient>
      </Pressable>
    );
  }

  return (
    <Pressable
      onPress={onPress}
      testID={`short-card-${short.id}`}
      accessibilityRole="button"
      accessibilityLabel={`Short ${short.title || merchantName}`}
      style={({ pressed }) => [styles.card, { width }, pressed && styles.pressed]}
    >
      <Image
        source={{ uri: source }}
        style={styles.image}
        resizeMode="cover"
        onError={() => setSourceIndex((index) => Math.min(index + 1, sources.length - 1))}
      />
      <View style={styles.scrim} />
      <View style={styles.avatar}>
        {avatarUrl ? (
          <Image source={{ uri: resolveMediaUrl(avatarUrl) }} style={styles.avatarImage} resizeMode="contain" />
        ) : (
          <Text style={styles.avatarInitial}>{initials}</Text>
        )}
      </View>
      <LinearGradient
        colors={["transparent", "rgba(0,0,0,0.62)"]}
        style={styles.bottomOverlay}
        pointerEvents="none"
      >
        <View style={styles.shortMeta}>
          <View style={styles.shortCopy}>
            <Text style={styles.shortTitle} numberOfLines={2}>
              {short.title || "Le goût qui fait parler !"}
            </Text>
            <View style={styles.views}>
              <Ionicons name="eye-outline" size={13} color="#FFFFFF" />
              <Text style={styles.viewsText}>{formattedViews}</Text>
            </View>
          </View>
          <View style={styles.playBadge}>
            <Ionicons name="play" size={14} color="#FFFFFF" />
          </View>
        </View>
      </LinearGradient>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    height: 168,
    borderRadius: 18,
    overflow: "hidden",
    position: "relative",
    backgroundColor: colors.light.heading,
  },
  pressed: {
    opacity: 0.9,
    transform: [{ scale: 0.98 }],
  },
  image: {
    width: "100%",
    height: "100%",
  },
  scrim: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(10,27,61,0.08)",
  },
  avatar: {
    position: "absolute",
    top: 10,
    left: 10,
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: "center",
    justifyContent: "center",
    padding: 3,
    overflow: "hidden",
    backgroundColor: colors.light.card,
    borderWidth: 2,
    borderColor: colors.light.primary,
  },
  avatarImage: {
    width: "100%",
    height: "100%",
    borderRadius: 99,
  },
  avatarInitial: {
    color: "#E91E63",
    fontSize: 15,
    fontFamily: "Inter_700Bold",
  },
  playBadge: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#E91E63",
  },
  homePlayBadge: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(0,0,0,0.16)",
    borderWidth: 1.5,
    borderColor: "rgba(255,255,255,0.72)",
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.28,
    shadowRadius: 3,
    elevation: 2,
  },
  bottomOverlay: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    height: 104,
    justifyContent: "flex-end",
    paddingHorizontal: 11,
    paddingBottom: 11,
  },
  shortMeta: {
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
    gap: 8,
  },
  shortCopy: {
    flex: 1,
    minWidth: 0,
    gap: 5,
  },
  shortTitle: {
    color: "#FFFFFF",
    fontSize: 11,
    lineHeight: 14,
    fontFamily: "Inter_700Bold",
  },
  views: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  viewsText: {
    color: "rgba(255,255,255,0.9)",
    fontSize: 10,
    fontFamily: "Inter_500Medium",
  },
  
  // Home Variant Styles
  homeCard: {
    height: 200,
    borderRadius: 12,
    overflow: "hidden",
    position: "relative",
    backgroundColor: colors.light.heading,
  },
});