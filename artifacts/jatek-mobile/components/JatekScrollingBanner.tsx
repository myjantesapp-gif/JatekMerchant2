import React, { useRef, useEffect } from "react";
import { View, Text, StyleSheet, Animated, Easing, Dimensions } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useAds } from "@/hooks/useContent";

const PINK = "#E91E63";
const NAVY = "#0A1B3D";
const GOLD = "#FFD700";
const ORANGE = "#FF6B00";
const { width: SCREEN_W } = Dimensions.get("window");

const ITEM_W = 160;
const ICONS = ["rocket", "star", "sparkles", "flash", "gift", "flame"] as const;

export function JatekScrollingBanner() {
  const scrollX = useRef(new Animated.Value(0)).current;
  const { data: ads } = useAds();
  const source = (ads ?? []).filter((ad) => ad.type === "ticker" || ad.type === "mini_card");
  const items = source.map((ad, index) => ({
    label: ad.title,
    icon: (ICONS[index % ICONS.length]) as typeof ICONS[number],
    color: ad.accentColor || ad.bgColor || [PINK, NAVY, "#8B1A6B", ORANGE][index % 4],
  }));
  const loopItems = items.length > 1 ? [...items, ...items] : items;
  const totalWidth = items.length * (ITEM_W + 10);

  useEffect(() => {
    if (totalWidth === 0) return;
    Animated.loop(
      Animated.timing(scrollX, {
        toValue: -totalWidth,
        duration: totalWidth * 22,
        easing: Easing.linear,
        useNativeDriver: true,
      })
    ).start();
    return () => scrollX.stopAnimation();
  }, [scrollX, totalWidth]);

  if (items.length === 0) return null;

  return (
    <View style={styles.wrap}>
      <Animated.View style={[styles.row, { transform: [{ translateX: scrollX }] }]}>
        {loopItems.map((item, i) => (
          <View key={i} style={[styles.pill, { borderColor: item.color + "33", backgroundColor: item.color + "0D" }]}>
            <Ionicons name={item.icon} size={13} color={item.color} />
            <Text style={[styles.pillTxt, { color: item.color }]}>{item.label}</Text>
          </View>
        ))}
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    height: 38,
    overflow: "hidden",
    marginTop: 14,
    marginBottom: 2,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 16,
    height: 38,
  },
  pill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
    borderWidth: 1.2,
    width: ITEM_W,
    justifyContent: "center",
  },
  pillTxt: {
    fontSize: 11,
    fontFamily: "Inter_700Bold",
    letterSpacing: 0.6,
  },
});
