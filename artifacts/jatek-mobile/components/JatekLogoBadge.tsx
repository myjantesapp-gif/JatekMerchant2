import React from "react";
import { StyleSheet, Text, View } from "react-native";

const PINK_DEEP = "#E91E63";

export function JatekLogoBadge({ size = 40 }: { size?: number }) {
  return (
    <View
      style={[
        styles.badge,
        {
          width: size,
          height: size,
          borderRadius: Math.round(size * 0.325),
        },
      ]}
      accessibilityLabel="Jatek"
    >
      <Text style={[styles.text, { fontSize: Math.round(size * 0.425) }]}>J.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    backgroundColor: PINK_DEEP + "18",
    alignItems: "center",
    justifyContent: "center",
  },
  text: {
    fontFamily: "Inter_700Bold",
    color: PINK_DEEP,
    fontStyle: "italic",
  },
});