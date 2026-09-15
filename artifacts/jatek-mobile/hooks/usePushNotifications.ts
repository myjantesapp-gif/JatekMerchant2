/**
 * usePushNotifications — local + remote push notification support.
 *
 * Split into two concerns:
 *  - useNotificationSetup(authToken): requests permissions once, sets up the
 *    global tap listener once, AND re-registers the Expo push token with the
 *    backend whenever `authToken` changes (login/restore).  Call once at app
 *    root (_layout.tsx) with the live auth token from AuthContext.
 *  - scheduleOrderStatusNotification(): standalone async utility.
 *    Call from any screen when the order status changes locally.
 */
import { useCallback, useEffect, useRef } from "react";
import { AppState, Platform } from "react-native";
import { router } from "expo-router";
import * as Notifications from "expo-notifications";
import Constants, { ExecutionEnvironment } from "expo-constants";
import { deletePushToken, registerPushToken } from "@workspace/api-client-react";
import { listNotifications } from "@/lib/api";
import { notificationResponseKey, orderIdFromNotificationResponse } from "@/lib/pushNotificationUtils";
import { pushOperationQueue, withManualAbortTimeout } from "@/lib/pushOperationQueue";

/**
 * Remote push needs the installed app's native credentials. Android Expo Go
 * does not support remote push on SDK 53+. Keep this preview path disabled;
 * use a development build or a release to test the app's own credentials.
 */
const isExpoGo = Constants.executionEnvironment === ExecutionEnvironment.StoreClient;
const pushSupported = Platform.OS !== "web" && !isExpoGo;

const STATUS_LABELS: Record<string, { title: string; body: string }> = {
  accepted:   { title: "Commande acceptée ✅",   body: "Le restaurant a confirmé votre commande." },
  preparing:  { title: "En préparation 🍳",       body: "Le chef est aux fourneaux !" },
  ready:      { title: "Commande prête 🛍️",      body: "Un livreur va bientôt récupérer votre commande." },
  picked_up:  { title: "En route 🛵",              body: "Votre livreur est en chemin vers vous." },
  delivered:  { title: "Commande livrée 🎉",       body: "Bon appétit ! N'oubliez pas de noter votre expérience." },
  cancelled:  { title: "Commande annulée ❌",      body: "Votre commande a été annulée." },
};

if (pushSupported) {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
      shouldShowBanner: true,
      shouldShowList: true,
    }),
  });
}

/**
 * Module-level cache for the Expo push token so we avoid redundant
 * getExpoPushTokenAsync calls on every auth change.
 */
let cachedExpoPushToken: string | null = null;

type NotificationRefreshListener = () => void;
const notificationRefreshListeners = new Set<NotificationRefreshListener>();

/** Subscribe to foreground notification updates (used by the notification inbox). */
export function subscribeToNotificationRefresh(listener: NotificationRefreshListener): () => void {
  notificationRefreshListeners.add(listener);
  return () => notificationRefreshListeners.delete(listener);
}

/**
 * Refresh the local notification inbox and native app badge after a push is
 * received while the app is in the foreground. Remote pushes do not update
 * the OS badge automatically on every platform, so set it from the server's
 * unread count instead of assuming the previous count.
 */
export async function refreshNotificationClientState(): Promise<void> {
  notificationRefreshListeners.forEach((listener) => {
    try {
      listener();
    } catch (error) {
      console.warn("[push] notification refresh listener failed:", error);
    }
  });
  try {
    const result = await listNotifications();
    if (pushSupported) {
      await Notifications.setBadgeCountAsync(result.unreadCount);
    }
  } catch (error) {
    // The foreground notification has still been displayed; a temporary API
    // failure must not interfere with tap routing or app interaction.
    console.warn("[push] could not refresh notification badge:", error);
  }
}

async function configureAndroidNotificationChannels(): Promise<void> {
  if (Platform.OS !== "android" || !pushSupported) return;

  await Promise.all([
    Notifications.setNotificationChannelAsync("default", {
      name: "Notifications Jatek",
      importance: Notifications.AndroidImportance.HIGH,
      sound: "default",
    }),
    Notifications.setNotificationChannelAsync("order-status", {
      name: "Suivi des commandes",
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      sound: "default",
      lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
    }),
    Notifications.setNotificationChannelAsync("incoming-order", {
      name: "Nouvelles courses",
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 300, 200, 300],
      sound: "default",
      lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
    }),
  ]);
}

async function fetchExpoPushToken(): Promise<string | null> {
  if (!pushSupported) return null;
  try {
    await configureAndroidNotificationChannels();
    const permission = await Notifications.getPermissionsAsync();
    const allowed = permission.granted ||
      permission.ios?.status === Notifications.IosAuthorizationStatus.PROVISIONAL;
    if (!allowed) return null;
    if (cachedExpoPushToken) return cachedExpoPushToken;
    const projectId =
      Constants.easConfig?.projectId ||
      Constants.expoConfig?.extra?.eas?.projectId ||
      process.env.EXPO_PUBLIC_PROJECT_ID;
    if (!projectId) {
      console.warn("[push] Expo project ID is missing");
      return null;
    }
    const tokenData = await Notifications.getExpoPushTokenAsync({
      projectId,
    });
    if (tokenData?.data) {
      cachedExpoPushToken = tokenData.data;
      return cachedExpoPushToken;
    }
  } catch (err) {
    console.warn("[push] could not get Expo push token:", err);
  }
  return null;
}

/**
 * Register the device's Expo push token with the backend so the server can
 * send remote push notifications for order status changes.
 * Requires a valid auth token — no-ops if absent.
 */
async function fetchAndRegisterPushToken(
  expectedAuthToken: string,
  isCurrent: () => boolean,
): Promise<void> {
  const expoPushToken = await fetchExpoPushToken();
  if (!expoPushToken || !isCurrent()) return;
  const platform = Platform.OS === "ios" ? "ios" : "android";
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    if (!isCurrent()) return;
    try {
      await withManualAbortTimeout(
        (signal) => registerPushToken(
          { token: expoPushToken, platform },
          {
            headers: { Authorization: `Bearer ${expectedAuthToken}` },
            signal,
          },
        ),
        15_000,
        () => !isCurrent(),
      );
      return;
    } catch (err) {
      if (attempt === 3) {
        if (isCurrent()) {
          console.warn("[push] could not register token with backend:", err);
        }
        return;
      }
      if (!isCurrent()) return;
      await new Promise((resolve) => setTimeout(resolve, attempt * 750));
    }
  }
}

/**
 * Detach the token registered by this app session before local auth storage is
 * cleared. The server compares the supplied token before clearing, so an
 * in-flight receipt or logout cannot remove a newer registration.
 */
export async function detachRegisteredPushToken(
  authToken: string | null,
  shouldContinue: () => boolean = () => true,
): Promise<void> {
  const token = cachedExpoPushToken;
  if (!authToken || !token) return;
  await pushOperationQueue(async () => {
    if (!shouldContinue()) return;
    try {
      await withManualAbortTimeout(
        (signal) => deletePushToken(
          { token },
          {
            headers: {
              Authorization: `Bearer ${authToken}`,
              "Content-Type": "application/json",
            },
            signal,
          },
        ),
        10_000,
        () => !shouldContinue(),
      );
      if (cachedExpoPushToken === token) cachedExpoPushToken = null;
    } catch (error) {
      // Logout must still complete when connectivity is unavailable. The
      // conditional server-side clear makes a later registration safe.
      if (shouldContinue()) {
        console.warn("[push] could not detach token during logout:", error);
      }
    }
  });
}

/**
 * Call once in the root layout to:
 *  1. Request notification permissions (one-time).
 *  2. Listen for notification taps app-wide (one-time).
 *  3. Re-register the Expo push token with the backend whenever `authToken`
 *     changes — this handles cold-start-while-logged-out and login-after-boot.
 *
 * @param authToken  Live auth token from AuthContext (null when logged out).
 * @param navigatorReady  Root navigator has mounted and can accept pushes.
 */
export function useNotificationSetup(
  authToken: string | null,
  authReady = true,
  navigatorReady = true,
) {
  const listenerRef = useRef<Notifications.EventSubscription | null>(null);
  const receivedListenerRef = useRef<Notifications.EventSubscription | null>(null);
  // Keep a ref to the latest authToken so the async permission callback can
  // access it without capturing a stale closure value.
  const authTokenRef = useRef<string | null>(authToken);
  authTokenRef.current = authToken;
  const authReadyRef = useRef(authReady);
  authReadyRef.current = authReady;
  const navigatorReadyRef = useRef(navigatorReady);
  navigatorReadyRef.current = navigatorReady;
  const registrationGenerationRef = useRef(0);
  const handledResponseKeysRef = useRef<Set<string>>(new Set());
  const pendingResponseRef = useRef<Notifications.NotificationResponse | null>(null);

  const routeNotificationResponse = useCallback((response: Notifications.NotificationResponse) => {
    if (!authReadyRef.current || !navigatorReadyRef.current || !authTokenRef.current) {
      pendingResponseRef.current = response;
      return;
    }
    const responseKey = notificationResponseKey(response);
    if (handledResponseKeysRef.current.has(responseKey)) return;
    const orderId = orderIdFromNotificationResponse(response);
    try {
      if (orderId) {
        router.push({ pathname: "/order/[id]", params: { id: String(orderId) } });
      } else {
        router.push("/profile/notifications");
      }
      // Only dedupe after a response was actually actionable and handed to
      // the mounted root navigator. Invalid/unauthenticated intents remain
      // pending for the next authenticated session.
      handledResponseKeysRef.current.add(responseKey);
      pendingResponseRef.current = null;
      void Notifications.clearLastNotificationResponseAsync()
        .catch((error) => console.warn("[push] could not clear handled response:", error));
    } catch (error) {
      pendingResponseRef.current = response;
      console.warn("[push] could not navigate from notification response:", error);
    }
  }, []);

  const registerPushTokenWithBackend = useCallback((expectedToken = authTokenRef.current) => {
    if (!expectedToken) return Promise.resolve();
    const generation = registrationGenerationRef.current;
    return pushOperationQueue(() => fetchAndRegisterPushToken(
      expectedToken,
      () => authTokenRef.current === expectedToken &&
        generation === registrationGenerationRef.current,
    ));
  }, []);

  // A cold-start tap can arrive before AuthProvider restores its session. Do
  // not navigate until the authenticated root is ready.
  useEffect(() => {
    if (!authReady || !navigatorReady || !authToken || !pendingResponseRef.current) return;
    const response = pendingResponseRef.current;
    routeNotificationResponse(response);
  }, [authReady, authToken, navigatorReady, routeNotificationResponse]);

  // ── One-time: permission request + notification tap listener ──────────────
  useEffect(() => {
    if (!pushSupported) return;

    (async () => {
      try {
        await configureAndroidNotificationChannels();
        let permission = await Notifications.getPermissionsAsync();
        const provisional = permission.ios?.status === Notifications.IosAuthorizationStatus.PROVISIONAL;
        if (!permission.granted && !provisional && permission.canAskAgain) {
          permission = await Notifications.requestPermissionsAsync({
            ios: { allowAlert: true, allowBadge: true, allowSound: true },
          });
        }
        // After permission is resolved, re-trigger backend registration using the
        // current auth token in case login and permission happened in either order.
        if ((permission.granted ||
            permission.ios?.status === Notifications.IosAuthorizationStatus.PROVISIONAL) &&
            authTokenRef.current) {
          void registerPushTokenWithBackend();
        }
      } catch (err) {
        console.warn("[push] notification setup failed:", err);
      }
    })();

    listenerRef.current = Notifications.addNotificationResponseReceivedListener(routeNotificationResponse);
    receivedListenerRef.current = Notifications.addNotificationReceivedListener(() => {
      if (authTokenRef.current) void refreshNotificationClientState();
    });
    void Notifications.getLastNotificationResponseAsync()
      .then((response) => {
        if (response) routeNotificationResponse(response);
      })
      .catch((err) => console.warn("[push] cold-start response lookup failed:", err));

    return () => {
      listenerRef.current?.remove();
      listenerRef.current = null;
      receivedListenerRef.current?.remove();
      receivedListenerRef.current = null;
    };
  }, [routeNotificationResponse, registerPushTokenWithBackend]);

  // Native tokens can rotate while the app is open. An old cached Expo token
  // must not prevent registering the current device token with the remote API.
  useEffect(() => {
    if (!pushSupported) return;
    const subscription = Notifications.addPushTokenListener(() => {
      cachedExpoPushToken = null;
      void registerPushTokenWithBackend();
    });
    return () => subscription.remove();
  }, [registerPushTokenWithBackend]);

  // A user may grant push permission later from the system settings.
  // Re-checking on foreground makes the registration self-healing.
  useEffect(() => {
    if (!pushSupported) return;
    const subscription = AppState.addEventListener("change", (state) => {
      if (state !== "active" || !authTokenRef.current) return;
      void Notifications.getPermissionsAsync()
        .then((permission) => {
          if (permission.granted ||
              permission.ios?.status === Notifications.IosAuthorizationStatus.PROVISIONAL) {
            void registerPushTokenWithBackend();
          }
        })
        .catch((err) => console.warn("[push] permission refresh failed:", err));
    });
    return () => subscription.remove();
  }, [registerPushTokenWithBackend]);

  // ── Auth-aware: re-register token with backend whenever user logs in ───────
  // Covers the case where the user was already logged in on first render,
  // or logs in after the app started. If permission has not been granted yet,
  // the registration above (post-permission callback) will handle it instead.
  useEffect(() => {
    registrationGenerationRef.current += 1;
    if (!pushSupported || !authToken) return;
    void registerPushTokenWithBackend();
  }, [authToken, registerPushTokenWithBackend]);
}

/**
 * Schedules an immediate local notification for an order status change.
 * Safe to call on web (no-op).
 */
export async function scheduleOrderStatusNotification(status: string, orderId: number) {
  if (!pushSupported) return;
  const info = STATUS_LABELS[status];
  if (!info) return;
  try {
    await Notifications.scheduleNotificationAsync({
      content: {
        title: info.title,
        body: info.body,
        data: { orderId },
        sound: true,
      },
      trigger: Platform.OS === "android" ? { channelId: "order-status" } : null,
    });
  } catch (error) {
    console.warn("[push] local order notification failed:", error);
  }
}
