import { useFonts } from "expo-font";
import {
  Montserrat_400Regular,
  Montserrat_500Medium,
  Montserrat_600SemiBold,
  Montserrat_700Bold,
  Montserrat_800ExtraBold,
} from "@expo-google-fonts/montserrat";
import { StatusBar } from "expo-status-bar";
import * as NavigationBar from "expo-navigation-bar";
import * as SystemUI from "expo-system-ui";
import { Ionicons, MaterialCommunityIcons, MaterialIcons, FontAwesome, FontAwesome5 } from "@expo/vector-icons";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Stack, router, useRootNavigationState } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import React, { useEffect, useRef, useState } from "react";
import { ActivityIndicator, Platform, Text, TextInput, View } from "react-native";
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
import { getPublicAppConfig } from "@/lib/api";
import colors from "@/constants/colors";

const INTRO_BACKGROUND = colors.light.introBackground;

// Configure the customer API client to use the canonical remote backend.
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
    style: [{ fontFamily: "Montserrat_400Regular" }, currentStyle].filter(Boolean),
  };
}

// Explicit weight styles still override this value. Text without a dedicated
// style now also uses Montserrat instead of the native system font.
applyDefaultFont(Text);
applyDefaultFont(TextInput);

function MaintenanceGate({ children }: { children: React.ReactNode }) {
  const [maintenanceMode, setMaintenanceMode] = useState(false);
  const [hasLoaded, setHasLoaded] = useState(false);

  useEffect(() => {
    let active = true;
    getPublicAppConfig()
      .then((config) => {
        if (active) setMaintenanceMode(config.maintenanceMode === true);
      })
      .catch(() => {
        // A temporary config outage must not lock users out of the app.
      })
      .finally(() => {
        if (active) setHasLoaded(true);
      });
    return () => {
      active = false;
    };
  }, []);

  if (hasLoaded && maintenanceMode) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", padding: 28, backgroundColor: colors.light.background }}>
        <ActivityIndicator color={colors.light.primary} size="small" />
        <Text style={{ marginTop: 18, color: colors.light.heading, fontSize: 22, fontWeight: "700", textAlign: "center" }}>
          Application temporairement indisponible
        </Text>
        <Text style={{ marginTop: 10, color: colors.light.mutedForeground, fontSize: 15, lineHeight: 22, textAlign: "center" }}>
          Une maintenance est en cours. Revenez dans quelques instants.
        </Text>
      </View>
    );
  }

  return <>{children}</>;
}

function RootLayoutNav() {
  return (
    <MaintenanceGate>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="index" options={{ headerShown: false }} />
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="(auth)" options={{ headerShown: false }} />
        <Stack.Screen name="restaurant/[id]" options={{ headerShown: false }} />
        <Stack.Screen name="category/[slug]" options={{ headerShown: false }} />
        <Stack.Screen name="home-section/[key]" options={{ headerShown: false }} />
        <Stack.Screen name="cart" options={{ headerShown: false }} />
        <Stack.Screen name="order/[id]" options={{ headerShown: false }} />
      </Stack>
    </MaintenanceGate>
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
    Montserrat_400Regular,
    Montserrat_500Medium,
    Montserrat_600SemiBold,
    Montserrat_700Bold,
    Montserrat_800ExtraBold,
    // Keep legacy semantic names as aliases so every existing screen and
    // shared component switches to Montserrat without changing its layout.
    Inter_400Regular: Montserrat_400Regular,
    Inter_500Medium: Montserrat_500Medium,
    Inter_600SemiBold: Montserrat_600SemiBold,
    Inter_700Bold: Montserrat_700Bold,
    Inter_900Black: Montserrat_800ExtraBold,
    Poppins_400Regular: Montserrat_400Regular,
    Poppins_500Medium: Montserrat_500Medium,
    Poppins_600SemiBold: Montserrat_600SemiBold,
    Poppins_700Bold: Montserrat_700Bold,
    Poppins_900Black: Montserrat_800ExtraBold,
    ...Ionicons.font,
    ...MaterialCommunityIcons.font,
    ...MaterialIcons.font,
    ...FontAwesome.font,
    ...FontAwesome5.font,
  });

  useEffect(() => {
    void SystemUI.setBackgroundColorAsync(INTRO_BACKGROUND).catch(() => {});

    if (Platform.OS === "android") {
      void NavigationBar.setBackgroundColorAsync(INTRO_BACKGROUND).catch(() => {});
      void NavigationBar.setButtonStyleAsync("light").catch(() => {});
      void NavigationBar.setVisibilityAsync("visible").catch(() => {});
    }
  }, []);

  // Keep the splash visible until Montserrat is ready so the system font is never
  // shown temporarily. A real font error is allowed to render the fallback.
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
    return () => {
      cancelled = true;
    };
  }, [fontsLoaded, fontError]);

  // Do not render the application while Montserrat is still loading. This keeps
  // the first visible frame consistent on native and web.
  // Web font loading can remain pending in Expo's browser runtime; do not
  // block the actual app (and its remote-data error state) behind it.
  if (!fontsLoaded && !fontError && Platform.OS !== "web") return null;

  return (
    <SafeAreaProvider>
      <StatusBar style="dark" backgroundColor={colors.light.background} translucent={false} />
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
                    <SplashOverlay />
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
