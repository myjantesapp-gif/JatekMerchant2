import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";

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
            styles.arrow,
            pressed && styles.arrowPressed,
          ]}
        >
          <Ionicons name="chevron-forward" size={20} color="#E91E63" />
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
    color: "#0F172A",
    fontSize: 19,
    lineHeight: 24,
    letterSpacing: -0.15,
    fontFamily: "Inter_700Bold",
  },
  arrow: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FFF7FA",
    borderWidth: 1,
    borderColor: "#F5B4CC",
  },
  arrowPressed: {
    opacity: 0.82,
    transform: [{ scale: 0.94 }],
  },
});