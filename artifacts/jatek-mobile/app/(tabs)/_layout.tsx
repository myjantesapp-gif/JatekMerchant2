import { Tabs } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import React, { useEffect, useRef } from "react";
import { Image, Platform, StyleSheet, View, Text, Animated, Easing } from "react-native";
import { useListOrders } from "@workspace/api-client-react";
import { useAuth } from "@/contexts/AuthContext";
import FloatingChatBot from "@/components/FloatingChatBot";
import { ACTIVE_ORDER_STATUSES } from "@/lib/orderStatus";

const PINK = "#E91E63";
const INACTIVE = "#B5B5B5";
const TAB_H = Platform.OS === "web" ? 84 : 72;

function useActiveOrdersCount(): number {
  const { token, user } = useAuth();
  const ordersParams = user ? { userId: user.id } : undefined;
  const { data } = useListOrders(
    ordersParams,
    {
      query: {
        enabled: !!token && !!user,
        refetchInterval: 15000,
        refetchOnMount: "always",
        refetchOnWindowFocus: true,
      },
    } as any,
  );
  if (!data) return 0;
  return (data as any[]).filter((o) => ACTIVE_ORDER_STATUSES.has(String(o.status))).length;
}

function JatekTabIcon({ focused }: { focused: boolean }) {
  return (
    <View style={[s.jLogo, { opacity: focused ? 1 : 0.38 }]}>
      <Image
        source={require("../../assets/images/jatek-wordmark-transparent.png")}
        style={s.jLogoImage}
        resizeMode="contain"
        accessibilityLabel="Jatek"
      />
    </View>
  );
}

function OrdersTabIcon({ focused, count }: { focused: boolean; count: number }) {
  const pulse = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (count > 0) {
      const loop = Animated.loop(
        Animated.sequence([
          Animated.timing(pulse, {
            toValue: 1.15,
            duration: 600,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
          Animated.timing(pulse, {
            toValue: 1,
            duration: 600,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
        ]),
      );
      loop.start();
      return () => loop.stop();
    } else {
      pulse.setValue(1);
    }
  }, [count, pulse]);

  const color = focused ? PINK : INACTIVE;
  return (
    <Animated.View style={[s.iconWrap, { transform: [{ scale: pulse }] }]}>
      <Ionicons name={focused || count > 0 ? "receipt" : "receipt-outline"} size={26} color={color} />
      {count > 0 && (
        <View style={s.badge}>
          <Text style={s.badgeTxt}>{count > 9 ? "9+" : count}</Text>
        </View>
      )}
    </Animated.View>
  );
}

export default function TabLayout() {
  const ordersCount = useActiveOrdersCount();

  return (
    <View style={{ flex: 1 }}>
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: PINK,
        tabBarInactiveTintColor: INACTIVE,
        headerShown: false,
        tabBarShowLabel: false,
        tabBarItemStyle: { paddingTop: 6 },
        tabBarStyle: {
          backgroundColor: "#FFFFFF",
          borderTopWidth: StyleSheet.hairlineWidth,
          borderTopColor: "#EBEBEB",
          height: TAB_H,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Accueil",
          tabBarLabel: () => null,
          tabBarIcon: ({ focused }) => <JatekTabIcon focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="orders"
        options={{
          title: "Commandes",
          tabBarIcon: ({ focused }) => <OrdersTabIcon focused={focused} count={ordersCount} />,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: "Profil",
          tabBarIcon: ({ color }) => <Ionicons name="person-circle-outline" size={26} color={color} />,
        }}
      />
      {/* Hidden screens — kept for navigation but excluded from the tab bar */}
      <Tabs.Screen name="restaurants" options={{ href: null }} />
      <Tabs.Screen name="favoris" options={{ href: null }} />
      <Tabs.Screen name="deliver" options={{ href: null }} />
      <Tabs.Screen name="manage" options={{ href: null }} />
    </Tabs>
    <FloatingChatBot />
    </View>
  );
}

const s = StyleSheet.create({
  jLogo: {
    width: 72,
    height: 28,
    alignItems: "center",
    justifyContent: "center",
  },
  jLogoImage: {
    width: "100%",
    height: "100%",
  },
  iconWrap: {
    width: 36,
    height: 30,
    alignItems: "center",
    justifyContent: "center",
  },
  badge: {
    position: "absolute",
    top: -4,
    right: -2,
    minWidth: 18,
    height: 18,
    paddingHorizontal: 4,
    borderRadius: 9,
    backgroundColor: PINK,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1.5,
    borderColor: "#fff",
  },
  badgeTxt: {
    color: "#fff",
    fontSize: 10,
    fontFamily: "Inter_700Bold",
    lineHeight: 12,
  },
});
