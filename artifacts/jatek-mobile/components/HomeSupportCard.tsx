import React from "react";
import { View, Text, StyleSheet, Pressable } from "react-native";
import { useRouter } from "expo-router";
import Svg, { Path, Circle, Rect } from "react-native-svg";

export function HomeSupportCard() {
  const router = useRouter();

  return (
    <View style={styles.container} accessible={false}>
      <View style={styles.content}>
        <Text style={styles.title}>Besoin d’aide ?</Text>
        <Text style={styles.subtitle}>
          Une question sur votre commande ou votre livraison ?
        </Text>
        <Pressable
          style={({ pressed }) => [
            styles.button,
            pressed && styles.buttonPressed,
          ]}
          onPress={() => router.push("/profile/support")}
          accessibilityRole="button"
          accessibilityLabel="Contacter le support"
        >
          <Text style={styles.buttonText}>Contacter le support</Text>
        </Pressable>
      </View>
      <View 
        style={styles.illustrationContainer} 
        accessibilityElementsHidden={true}
        importantForAccessibility="no"
      >
        <Svg width="90" height="90" viewBox="0 0 100 100" fill="none">
          {/* Subtle background circle for depth */}
          <Circle cx="50" cy="55" r="42" fill="#F8FAFC" />
          
          {/* Turquoise Chat Bubble */}
          <Path 
            d="M22,18 h26 a6,6 0 0 1 6,6 v14 a6,6 0 0 1 -6,6 h-6 l-6,6 v-6 h-14 a6,6 0 0 1 -6,-6 v-14 a6,6 0 0 1 6,-6 Z" 
            fill="#00A5B5" 
          />
          {/* Typing Indicator Dots */}
          <Circle cx="28" cy="31" r="2.5" fill="#FFFFFF" />
          <Circle cx="35" cy="31" r="2.5" fill="#FFFFFF" />
          <Circle cx="42" cy="31" r="2.5" fill="#FFFFFF" />

          {/* Olive Yellow Chat Bubble */}
          <Path 
            d="M82,32 h-20 a6,6 0 0 0 -6,6 v10 a6,6 0 0 0 6,6 h4 v5 l5,-5 h11 a6,6 0 0 0 6,-6 v-10 a6,6 0 0 0 -6,-6 Z" 
            fill="#F4D03F" 
          />

          {/* Headset Headband */}
          <Path 
            d="M30,65 A20,20 0 0 1 70,65" 
            fill="none" 
            stroke="#0F172A" 
            strokeWidth="5" 
            strokeLinecap="round" 
          />
          
          {/* Earcups (#E91E63) */}
          <Rect x="26" y="60" width="9" height="18" rx="4.5" fill="#E91E63" />
          <Rect x="65" y="60" width="9" height="18" rx="4.5" fill="#E91E63" />
          
          {/* Microphone */}
          <Path 
            d="M30,73 v7 a6,6 0 0 0 6,6 h5" 
            fill="none" 
            stroke="#0F172A" 
            strokeWidth="2.5" 
            strokeLinecap="round" 
          />
          <Circle cx="43" cy="86" r="3.5" fill="#E91E63" />
        </Svg>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 16,
    marginHorizontal: 16,
    marginVertical: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    shadowColor: "#0F172A",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.04,
    shadowRadius: 12,
    elevation: 2,
  },
  content: {
    flex: 1,
    paddingRight: 12,
  },
  title: {
    color: "#274C77",
    fontSize: 20,
    fontWeight: "bold",
    fontFamily: "Poppins_700Bold",
    marginBottom: 4,
    letterSpacing: -0.4,
  },
  subtitle: {
    color: "#475569",
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    lineHeight: 18,
    marginBottom: 14,
  },
  button: {
    backgroundColor: "#E91E63",
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 24,
    alignSelf: "flex-start",
  },
  buttonPressed: {
    opacity: 0.85,
    transform: [{ scale: 0.96 }],
  },
  buttonText: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "bold",
    fontFamily: "Poppins_700Bold",
  },
  illustrationContainer: {
    width: 90,
    height: 90,
    alignItems: "center",
    justifyContent: "center",
  },
});
