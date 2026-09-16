import React from "react";
import { Image, StyleSheet, View } from "react-native";

type Props = {
  width?: number;
  height?: number;
  tone?: "pink" | "white";
};

export function JatekWordmark({ width = 96, height = 38, tone = "pink" }: Props) {
  return (
    <View style={{ width, height }} accessibilityLabel="Jatek">
      <Image
        source={
          tone === "white"
            ? require("../assets/images/jatek-wordmark-white.png")
            : require("../assets/images/jatek-wordmark.png")
        }
        style={styles.image}
        resizeMode="contain"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  image: {
    width: "100%",
    height: "100%",
  },
});