import { useFonts } from "expo-font";
import {
  Poppins_400Regular,
  Poppins_500Medium,
  Poppins_600SemiBold,
  Poppins_700Bold,
  Poppins_900Black,
} from "@expo-google-fonts/poppins";
import { StatusBar } from "expo-status-bar";
import { Ionicons, MaterialCommunityIcons, MaterialIcons, FontAwesome, FontAwesome5 } from "@expo/vector-icons";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Stack, router, useRootNavigationState } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import React, { useEffect, useRef } from "react";
import { Text, TextInput } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { KeyboardProvider } from "react-native-keyboard-controller";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { setBaseUrl } from "@workspace/api-client-react";

import { ErrorBoundary } from "@/components/ErrorBoundary";
import { useNotificationSetup } from "@/hooks/usePushNotifications";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { CartProvider } from "@/contexts/CartContext";
import { LanguageProvider } from "@/contexts/LanguageContext";
import CookieConsentBanner from "@/components/CookieConsentBanner";
import SplashOverlay from "@/components/SplashOverlay";
import { FriendlyAlertProvider } from "@/components/FriendlyAlert";
import { useFriendlyAlert } from "@/components/FriendlyAlert";
import { OrderStatusToast } from "@/components/OrderStatusToast";
import { getApiBaseSafe } from "@/lib/apiBase";

// Configure the API base URL — robustly resolves from EXPO_PUBLIC_DOMAIN, then
// expo-constants extra, then Metro hostUri (LAN dev). Never throws at boot.
const apiBase = getApiBaseSafe();
console.log(`[Boot] API base = ${apiBase}`);
setBaseUrl(apiBase);

// Prevent the splash screen from auto-hiding before asset loading is complete.
// Wrap in try/catch — on web (and some Expo Go reloads) preventAutoHideAsync
// can reject with "Splash screen module is not available", which would crash
// the JS bundle before any UI ever renders → infinite blue splash.
SplashScreen.preventAutoHideAsync().catch(() => {});

const queryClient = new QueryClient();

function applyDefaultFont(component: typeof Text | typeof TextInput) {
  const target = component as typeof component & {
    defaultProps?: { style?: unknown };
  };
  const currentStyle = target.defaultProps?.style;
  target.defaultProps = {
    ...target.defaultProps,
    style: [{ fontFamily: "Inter_400Regular" }, currentStyle].filter(Boolean),
  };
}

// Explicit weight styles still override this value. Text without a dedicated
// style now also uses Poppins instead of the native system font.
applyDefaultFont(Text);
applyDefaultFont(TextInput);

function RootLayoutNav() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" options={{ headerShown: false }} />
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen name="(auth)" options={{ headerShown: false }} />
      <Stack.Screen name="restaurant/[id]" options={{ headerShown: false }} />
      <Stack.Screen name="category/[slug]" options={{ headerShown: false }} />
      <Stack.Screen name="cart" options={{ headerShown: false }} />
      <Stack.Screen name="order/[id]" options={{ headerShown: false }} />
      <Stack.Screen name="offer/[key]" options={{ headerShown: false }} />
    </Stack>
  );
}

/**
 * Inner component rendered inside AuthProvider so it can access the live
 * auth token and pass it to useNotificationSetup for re-registration on login.
 */
function AppSetup() {
  const { token, isLoading } = useAuth();
  const rootNavigationState = useRootNavigationState();
  useNotificationSetup(token, !isLoading, Boolean(rootNavigationState?.key));
  return null;
}

/** Redirects once when any protected API request invalidates the local session. */
function SessionExpiryRedirect() {
  const { sessionExpired } = useAuth();
  const alert = useFriendlyAlert();
  const shownRef = useRef(false);

  useEffect(() => {
    if (!sessionExpired) {
      shownRef.current = false;
      return;
    }
    if (shownRef.current) return;

    shownRef.current = true;
    router.replace("/(auth)/login");
    alert.show({
      tone: "warning",
      icon: "lock-closed-outline",
      title: "Session expirée",
      message: "Votre compte a été désactivé ou votre session a expiré. Veuillez vous reconnecter.",
      primary: { label: "Compris" },
      hideSecondary: true,
    });
  }, [alert, sessionExpired]);

  return null;
}

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    // Keep the existing semantic names so every screen and shared component
    // automatically uses the Jatek brand typeface without a risky mass rename.
    Inter_400Regular: Poppins_400Regular,
    Inter_500Medium: Poppins_500Medium,
    Inter_600SemiBold: Poppins_600SemiBold,
    Inter_700Bold: Poppins_700Bold,
    Inter_900Black: Poppins_900Black,
    ...Ionicons.font,
    ...MaterialCommunityIcons.font,
    ...MaterialIcons.font,
    ...FontAwesome.font,
    ...FontAwesome5.font,
  });
  // Hide the splash as soon as fonts are ready OR a 1.5 s safety timeout
  // elapses — whichever comes first. Without this fallback, a slow bundle
  // would leave the splash visible forever ("écran bleu" in production).
  useEffect(() => {
    let cancelled = false;
    const hide = () => {
      if (cancelled) return;
      cancelled = true;
      SplashScreen.hideAsync().catch(() => {});
    };
    if (fontsLoaded || fontError) {
      hide();
      return;
    }
    const timer = setTimeout(hide, 1500);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [fontsLoaded, fontError]);

  // Render the tree immediately — system fonts are used as a fallback until
  // Inter finishes loading. Never return null here as that caused the splash
  // to hang indefinitely ("écran bleu") in production.

  return (
    <SafeAreaProvider>
      <StatusBar style="dark" backgroundColor="transparent" translucent />
      <ErrorBoundary>
        <QueryClientProvider client={queryClient}>
          <AuthProvider>
            <AppSetup />
            <LanguageProvider>
              <CartProvider>
                <GestureHandlerRootView style={{ flex: 1, backgroundColor: "#FFFFFF" }}>
                  <KeyboardProvider>
                    <FriendlyAlertProvider>
                        <SessionExpiryRedirect />
                      <RootLayoutNav />
                      <OrderStatusToast />
                      <CookieConsentBanner />
                    </FriendlyAlertProvider>
                    <SplashOverlay duration={1800} />
                  </KeyboardProvider>
                </GestureHandlerRootView>
              </CartProvider>
            </LanguageProvider>
          </AuthProvider>
        </QueryClientProvider>
      </ErrorBoundary>
    </SafeAreaProvider>
  );
}
