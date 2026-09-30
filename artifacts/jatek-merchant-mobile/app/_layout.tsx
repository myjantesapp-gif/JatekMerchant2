import React, { useEffect } from 'react';
import { QueryClientProvider } from '@tanstack/react-query';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { KeyboardProvider } from 'react-native-keyboard-controller';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import {
  DMSans_400Regular, DMSans_500Medium, DMSans_600SemiBold, DMSans_700Bold,
  useFonts as useDMSansFonts,
} from '@expo-google-fonts/dm-sans';
import { Syne_600SemiBold, Syne_700Bold, Syne_800ExtraBold } from '@expo-google-fonts/syne';
import { Stack, useRouter, useSegments } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { queryClient } from '@/lib/query-client';
import { IncomingOrderAlertHost } from '@/components/IncomingOrderAlert';
import { AuthProvider, useAuth } from '@/lib/auth';
import { useMe } from '@/lib/merchant-data';
import { OrderProvider } from '@/lib/order-context';
import { ShopProvider } from '@/lib/shop-context';
import { useColors } from '@/hooks/useColors';
import { font } from '@/components/ui';

SplashScreen.preventAutoHideAsync();

function RootLayoutNav() {
  const { status } = useAuth();
  const me = useMe();
  const c = useColors();
  const router = useRouter();
  const segments = useSegments();
  const signedIn = status === 'signedIn';
  const employee = me.data?.user.role === 'employee';

  useEffect(() => {
    if (!signedIn || !employee) return;
    const [root, screen] = segments;
    const allowedTab = root === '(tabs)' && (screen === 'orders' || screen === 'shops');
    const allowedOrderPopup = root === 'order' && screen === '[id]';
    if (root && !allowedTab && !allowedOrderPopup) {
      router.replace('/(tabs)/orders');
    }
  }, [employee, router, segments, signedIn]);

  if (status === 'loading') return null;
  return (
    <Stack screenOptions={{
      headerBackTitle: 'Retour',
      headerTintColor: c.primary,
      headerStyle: { backgroundColor: c.background },
      headerTitleStyle: { fontFamily: font.semibold, color: c.foreground },
      contentStyle: { backgroundColor: c.background },
      headerShadowVisible: false,
    }}>
      <Stack.Screen name="index" options={{ headerShown: false }} />
      <Stack.Protected guard={signedIn}>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen
          name="order/[id]"
          options={{
            title: 'Commande',
            presentation: employee ? 'modal' : 'card',
            headerBackTitle: employee ? 'Fermer' : 'Retour',
          }}
        />
      </Stack.Protected>
      <Stack.Protected guard={signedIn && !!me.data && !employee}>
        <Stack.Screen name="reviews" options={{ headerShown: false }} />
        <Stack.Screen name="shop-profile" options={{ headerShown: false }} />
        <Stack.Screen name="settings" options={{ headerShown: false }} />
      </Stack.Protected>
      <Stack.Protected guard={!signedIn}>
        <Stack.Screen name="login" options={{ headerShown: false }} />
      </Stack.Protected>
    </Stack>
  );
}

export default function RootLayout() {
  const [fontsLoaded, fontError] = useDMSansFonts({
    DMSans_400Regular,
    DMSans_500Medium,
    DMSans_600SemiBold,
    DMSans_700Bold,
    Syne_600SemiBold,
    Syne_700Bold,
    Syne_800ExtraBold,
  });

  useEffect(() => {
    if (fontsLoaded || fontError) SplashScreen.hideAsync();
  }, [fontsLoaded, fontError]);

  if (!fontsLoaded && !fontError) return null;

  return (
    <QueryClientProvider client={queryClient}>
      <SafeAreaProvider>
        <ErrorBoundary>
          <AuthProvider>
            <GestureHandlerRootView style={{ flex: 1 }}>
              <KeyboardProvider>
                <OrderProvider>
                  <ShopProvider>
                    <>
                      <RootLayoutNav />
                      <IncomingOrderAlertHost />
                    </>
                  </ShopProvider>
                </OrderProvider>
              </KeyboardProvider>
            </GestureHandlerRootView>
          </AuthProvider>
        </ErrorBoundary>
      </SafeAreaProvider>
    </QueryClientProvider>
  );
}
