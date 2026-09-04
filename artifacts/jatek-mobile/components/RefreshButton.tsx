import React from "react";
import { ActivityIndicator, StyleSheet, TouchableOpacity } from "react-native";
import { Ionicons } from "@expo/vector-icons";

type Props = {
  onPress: () => void | Promise<void>;
  refreshing?: boolean;
  color?: string;
  iconOnly?: boolean;
  accessibilityLabel?: string;
};

export function RefreshButton({
  onPress,
  refreshing = false,
  color = "#E91E63",
  iconOnly = true,
  accessibilityLabel = "Actualiser",
}: Props) {
  return (
    <TouchableOpacity
      onPress={() => void onPress()}
      disabled={refreshing}
      activeOpacity={0.8}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      style={[styles.button, !iconOnly && styles.buttonWithLabel]}
    >
      {refreshing ? (
        <ActivityIndicator size="small" color={color} />
      ) : (
        <Ionicons name="refresh-outline" size={iconOnly ? 21 : 17} color={color} />
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  button: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: "center",
    justifyContent: "center",
  },
  buttonWithLabel: {
    width: "auto",
    paddingHorizontal: 12,
    flexDirection: "row",
    gap: 6,
  },
});