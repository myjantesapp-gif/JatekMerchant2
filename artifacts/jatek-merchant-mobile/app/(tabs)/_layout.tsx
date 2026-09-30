import React from 'react';
import { ActivityIndicator, Platform, StyleSheet, Text, useColorScheme, View, type ColorValue } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { isLiquidGlassAvailable } from 'expo-glass-effect';
import { Tabs } from 'expo-router';
import { NativeTabs } from 'expo-router/unstable-native-tabs';
import { useColors } from '@/hooks/useColors';
import { ErrorState, font } from '@/components/ui';
import { useMe } from '@/lib/merchant-data';

export const unstable_settings = { initialRouteName: 'overview' };

function NativeTabLayout({ employee }: { employee: boolean }) {
  return (
    <NativeTabs>
      <NativeTabs.Trigger name="overview" hidden={employee}>
        <NativeTabs.Trigger.Icon sf={{ default: 'chart.bar', selected: 'chart.bar.fill' }} />
        <NativeTabs.Trigger.Label>Aperçu</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="orders">
        <NativeTabs.Trigger.Icon sf={{ default: 'bag', selected: 'bag.fill' }} />
        <NativeTabs.Trigger.Label>Commandes</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="menu" hidden={employee}>
        <NativeTabs.Trigger.Icon sf={{ default: 'fork.knife', selected: 'fork.knife' }} />
        <NativeTabs.Trigger.Label>Menu</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="shops">
        <NativeTabs.Trigger.Icon sf={{ default: 'storefront', selected: 'storefront.fill' }} />
        <NativeTabs.Trigger.Label>{employee ? 'Paramètres' : 'Boutiques'}</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="more" hidden={employee}>
        <NativeTabs.Trigger.Icon sf={{ default: 'ellipsis.circle', selected: 'ellipsis.circle.fill' }} />
        <NativeTabs.Trigger.Label>Plus</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}

function ClassicTabLayout({ employee }: { employee: boolean }) {
  const c = useColors();
  const isDark = useColorScheme() === 'dark';
  const isIOS = Platform.OS === 'ios';
  const isWeb = Platform.OS === 'web';
  const icon = (name: keyof typeof Feather.glyphMap) => ({ color }: { color: ColorValue }) => <Feather name={name} size={22} color={color} />;
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: c.primary,
        tabBarInactiveTintColor: c.mutedForeground,
        tabBarLabelStyle: { fontFamily: font.medium, fontSize: 11 },
        tabBarStyle: {
          position: 'absolute',
          backgroundColor: isIOS ? 'transparent' : c.background,
          borderTopWidth: 1,
          borderTopColor: c.border,
          elevation: 0,
          ...(isWeb ? { height: 84 } : {}),
        },
        tabBarBackground: () =>
          isIOS ? <BlurView intensity={100} tint={isDark ? 'dark' : 'light'} style={StyleSheet.absoluteFill} />
            : <View style={[StyleSheet.absoluteFill, { backgroundColor: c.background }]} />,
      }}
    >
      <Tabs.Screen name="overview" options={employee ? { href: null } : { title: 'Aperçu', tabBarIcon: icon('bar-chart-2') }} />
      <Tabs.Screen name="orders" options={{ title: 'Commandes', tabBarIcon: icon('shopping-bag') }} />
      <Tabs.Screen name="menu" options={employee ? { href: null } : { title: 'Menu', tabBarIcon: icon('grid') }} />
      <Tabs.Screen name="shops" options={{ title: employee ? 'Paramètres' : 'Boutiques', tabBarIcon: icon('home') }} />
      <Tabs.Screen name="more" options={employee ? { href: null } : { title: 'Plus', tabBarIcon: icon('more-horizontal') }} />
    </Tabs>
  );
}

export default function TabLayout() {
  const c = useColors();
  const me = useMe();
  if (!me.data && me.isPending) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, backgroundColor: c.background }}>
        <ActivityIndicator color={c.primary} />
        <Text style={{ color: c.mutedForeground, fontFamily: font.medium }}>Chargement de votre espace…</Text>
      </View>
    );
  }
  if (!me.data && me.isError) {
    return <View style={{ flex: 1, backgroundColor: c.background }}><ErrorState error={me.error} onRetry={() => void me.refetch()} /></View>;
  }
  const employee = me.data?.user.role === 'employee';
  return isLiquidGlassAvailable()
    ? <NativeTabLayout employee={employee} />
    : <ClassicTabLayout employee={employee} />;
}
