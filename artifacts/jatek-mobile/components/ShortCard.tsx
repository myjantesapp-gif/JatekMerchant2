import React, { useMemo, useState } from "react";
import { Image, Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import type { Short } from "@/lib/api";
import { getYouTubeThumbnailUrl, resolveMediaUrl } from "@/lib/mediaUrl";
import colors from "@/constants/colors";

const FALLBACK_SHORT_IMAGE =
  "https://images.unsplash.com/photo-1550547660-d9450f859349?auto=format&fit=crop&w=520&q=85";

type Props = {
  short: Short;
  width: number;
  avatarUrl?: string | null;
  onPress: () => void;
};

export function ShortCard({ short, width, avatarUrl, onPress }: Props) {
  const [sourceIndex, setSourceIndex] = useState(0);
  const sources = useMemo(
    () =>
      [resolveMediaUrl(short.imageUrl), getYouTubeThumbnailUrl(short.videoUrl), FALLBACK_SHORT_IMAGE].filter(
        (value): value is string => Boolean(value),
      ),
    [short.imageUrl, short.videoUrl],
  );
  const source = sources[Math.min(sourceIndex, sources.length - 1)] ?? FALLBACK_SHORT_IMAGE;
  const merchantName = short.restaurantName?.trim() || "Jatek";
  const initials = merchantName.charAt(0).toUpperCase() || "J";

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
      <View style={styles.playBadge}>
        <Ionicons name="play" size={13} color={colors.light.primaryForeground} />
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    height: 238,
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
    backgroundColor: "rgba(10,27,61,0.12)",
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
    borderColor: colors.light.card,
  },
  avatarImage: {
    width: "100%",
    height: "100%",
    borderRadius: 99,
  },
  avatarInitial: {
    color: colors.light.primary,
    fontSize: 15,
    fontFamily: "Inter_700Bold",
  },
  playBadge: {
    position: "absolute",
    right: 10,
    bottom: 10,
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(10,27,61,0.52)",
  },
});