import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import colors from "@/constants/colors";

type Props = {
  title: string;
  onPress?: () => void;
  testID?: string;
};

export function SectionHeader({ title, onPress, testID }: Props) {
  const accentIndex = Math.floor(title.length / 2);
  return (
    <View style={styles.row}>
      <Text style={styles.title} numberOfLines={1}>
        {title.slice(0, accentIndex)}
        <Text style={styles.titleAccent}>{title.charAt(accentIndex)}</Text>
        {title.slice(accentIndex + 1)}
      </Text>
      {onPress ? (
        <Pressable
          onPress={onPress}
          testID={testID}
          accessibilityRole="button"
          accessibilityLabel={`Ouvrir la section ${title}`}
          style={({ pressed }) => [styles.arrow, pressed && styles.arrowPressed]}
        >
          <Ionicons name="arrow-forward" size={19} color={colors.light.primaryForeground} />
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    paddingHorizontal: 16,
    paddingTop: 18,
    paddingBottom: 12,
  },
  title: {
    flex: 1,
    color: colors.light.heading,
    fontSize: 24,
    lineHeight: 29,
    letterSpacing: -0.6,
    fontFamily: "Inter_700Bold",
  },
  titleAccent: {
    color: colors.light.primary,
    fontFamily: "Inter_900Black",
  },
  arrow: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.light.primary,
    shadowColor: colors.light.primary,
    shadowOpacity: 0.22,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 3,
  },
  arrowPressed: {
    opacity: 0.82,
    transform: [{ scale: 0.94 }],
  },
});