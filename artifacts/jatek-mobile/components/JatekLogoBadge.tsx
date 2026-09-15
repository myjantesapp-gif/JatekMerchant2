import React from "react";
import { Image, StyleSheet, View } from "react-native";

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
      <Image
        source={require("../assets/images/jatek-logo.png")}
        style={styles.image}
        resizeMode="cover"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
  },
  image: {
    width: "100%",
    height: "100%",
  },
});