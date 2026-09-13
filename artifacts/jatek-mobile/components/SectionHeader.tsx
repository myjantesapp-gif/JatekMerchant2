import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import colors from "@/constants/colors";

type Props = {
  title: string;
  onPress?: () => void;
  testID?: string;
  buttonLabel?: string;
  accent?: boolean;
};

export function SectionHeader({
  title,
  onPress,
  testID,
  buttonLabel,
}: Props) {
  return (
    <View style={styles.row}>
      <Text style={styles.title} numberOfLines={1}>
        {title}
      </Text>
      {onPress ? (
        <Pressable
          onPress={onPress}
          testID={testID}
          accessibilityRole="button"
          accessibilityLabel={`Ouvrir la section ${title}`}
          style={({ pressed }) => [
            buttonLabel ? styles.moreButton : styles.arrow,
            pressed && (buttonLabel ? styles.moreButtonPressed : styles.arrowPressed),
          ]}
        >
          {buttonLabel ? (
            <Text style={styles.moreButtonText}>{buttonLabel}</Text>
          ) : (
            <Ionicons name="arrow-forward" size={19} color={colors.light.primaryForeground} />
          )}
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
    fontSize: 23,
    lineHeight: 28,
    letterSpacing: -0.45,
    fontFamily: "Inter_700Bold",
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
  moreButton: {
    minWidth: 83,
    height: 34,
    paddingHorizontal: 14,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.light.primary,
  },
  moreButtonPressed: {
    opacity: 0.82,
    transform: [{ scale: 0.97 }],
  },
  moreButtonText: {
    color: colors.light.primaryForeground,
    fontSize: 12,
    lineHeight: 16,
    fontFamily: "Inter_700Bold",
  },
});