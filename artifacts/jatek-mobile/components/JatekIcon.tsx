import React from "react";
import { Image, StyleSheet, View } from "react-native";

type Props = {
  width?: number;
  height?: number;
};

export function JatekIcon({ width = 18, height = 34 }: Props) {
  return (
    <View style={{ width, height }} accessibilityLabel="Jatek">
      <Image
        source={require("../assets/images/jatek-icon-white.png")}
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