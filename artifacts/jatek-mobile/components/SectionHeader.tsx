import React from "react";
import { Pressable, StyleProp, StyleSheet, Text, TextStyle, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";

type Props = {
  title: string;
  onPress?: () => void;
  testID?: string;
  buttonLabel?: string;
  accent?: boolean;
  variant?: "default" | "home";
};

function ColoredTitle({ title, style }: { title: string; style: StyleProp<TextStyle> }) {
  return <Text style={style} numberOfLines={1}>{title}</Text>;
}

export function SectionHeader({
  title,
  onPress,
  testID,
  variant = "default",
}: Props) {
  if (variant === "home") {
    return (
      <View style={styles.homeRow}>
        <ColoredTitle title={title} style={styles.homeTitle} />
        {onPress ? (
          <Pressable
            onPress={onPress}
            testID={testID}
            accessibilityRole="button"
            accessibilityLabel={`Ouvrir la section ${title}`}
            style={({ pressed }) => [
              styles.homeArrow,
              pressed && styles.arrowPressed,
            ]}
          >
            <Ionicons name="chevron-forward" size={18} color="#E91E63" />
          </Pressable>
        ) : null}
      </View>
    );
  }

  return (
    <View style={styles.row}>
      <ColoredTitle title={title} style={styles.title} />
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
    paddingTop: 8,
    paddingBottom: 4,
  },
  title: {
    flex: 1,
    color: "#274C77",
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
  homeRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    paddingHorizontal: 16,
    paddingTop: 18,
    paddingBottom: 12,
  },
  homeTitle: {
    flex: 1,
    color: "#274C77",
    fontSize: 22,
    lineHeight: 28,
    letterSpacing: -0.5,
    fontFamily: "Poppins_700Bold",
  },
  homeArrow: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "transparent",
    borderWidth: 1.5,
    borderColor: "#FCE4EC",
  },
});