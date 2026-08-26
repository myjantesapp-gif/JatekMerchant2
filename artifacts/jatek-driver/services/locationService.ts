import * as Location from "expo-location";
import * as TaskManager from "expo-task-manager";
import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";
import { updateDriverLocation } from "@/lib/api";
import { getDriverLocationClient } from "./wsClient";

export const LOCATION_TASK = "jatek-driver-location-task";
const CONFIRMED_ORDER_KEY = "jatek_driver_confirmed_order";

let activeOrderId: string | null = null;
let activeOrderConfirmed = false;
let trackingOperation: Promise<void> = Promise.resolve();

function runTrackingOperation<T>(operation: () => Promise<T>): Promise<T> {
  const result = trackingOperation.then(operation, operation);
  trackingOperation = result.then(() => undefined, () => undefined);
  return result;
}

export function setActiveOrderForTracking(orderId: string | null): void {
  activeOrderId = orderId;
  if (!orderId) activeOrderConfirmed = false;
}

export function getActiveOrderForTracking(): string | null {
  return activeOrderId;
}

export async function confirmActiveOrderTracking(orderId: string): Promise<void> {
  // Called only after the server has confirmed acceptance. Do not depend on a
  // React state update having completed before persisting this background task.
  activeOrderId = orderId;
  activeOrderConfirmed = true;
  if (Platform.OS !== "web") await SecureStore.setItemAsync(CONFIRMED_ORDER_KEY, orderId);
}

export async function restoreConfirmedOrderTracking(): Promise<string | null> {
  return getConfirmedOrderId();
}

async function getConfirmedOrderId(): Promise<string | null> {
  if (activeOrderConfirmed && activeOrderId) return activeOrderId;
  if (Platform.OS === "web") return null;
  const stored = await SecureStore.getItemAsync(CONFIRMED_ORDER_KEY);
  if (stored) {
    activeOrderId = stored;
    activeOrderConfirmed = true;
  }
  return stored;
}

async function clearConfirmedOrder(): Promise<void> {
  activeOrderConfirmed = false;
  if (Platform.OS !== "web") await SecureStore.deleteItemAsync(CONFIRMED_ORDER_KEY);
}

async function sendLocation(loc: Location.LocationObject): Promise<void> {
  const ws = getDriverLocationClient();
  const payload = {
    type: "location" as const,
    orderId: activeOrderId,
    latitude: loc.coords.latitude,
    longitude: loc.coords.longitude,
    heading: loc.coords.heading ?? null,
    speed: loc.coords.speed ?? null,
    accuracy: loc.coords.accuracy ?? null,
    timestamp: loc.timestamp ?? Date.now(),
  };
  ws.send(payload);
  const update = await updateDriverLocation({
    latitude: payload.latitude,
    longitude: payload.longitude,
    heading: payload.heading,
    speed: payload.speed,
  });
  const confirmedOrderId = await getConfirmedOrderId();
  if (confirmedOrderId && !update.activeOrderIds.includes(Number(confirmedOrderId))) {
    console.warn("[location] tracked order is no longer active; stopping GPS", confirmedOrderId);
    await stopLocationTracking(true);
  }
}

TaskManager.defineTask(LOCATION_TASK, async ({ data, error }) => {
  if (error) { console.warn("[locationTask] error", error); return; }
  if (!data) return;
  const { locations } = data as { locations: Location.LocationObject[] };
  const last = locations?.[locations.length - 1];
  if (!last) return;
  try { await sendLocation(last); } catch (e) { console.warn("[locationTask] dispatch failed", e); }
});

export type LocationPermissionResult = {
  granted: boolean;
  background: boolean;
  message?: string;
};

export async function requestLocationPermissions(): Promise<LocationPermissionResult> {
  const fg = await Location.requestForegroundPermissionsAsync();
  if (fg.status !== "granted") {
    return { granted: false, background: false, message: "Permission de localisation refusée." };
  }
  if (Platform.OS === "web") return { granted: true, background: false };
  const bg = await Location.requestBackgroundPermissionsAsync();
  return {
    granted: bg.status === "granted",
    background: bg.status === "granted",
    message: bg.status === "granted"
      ? undefined
      : "La localisation \"Toujours\" est requise pour poursuivre les courses en arrière-plan.",
  };
}

export async function ensureAlwaysLocationPermission(): Promise<LocationPermissionResult> {
  const fg = await Location.getForegroundPermissionsAsync();
  if (fg.status !== "granted") {
    const re = await Location.requestForegroundPermissionsAsync();
    if (re.status !== "granted") {
      return { granted: false, background: false, message: "Permission de localisation refusée. Activez-la pour accepter une course." };
    }
  }
  if (Platform.OS === "web") return { granted: true, background: false };
  const bg = await Location.getBackgroundPermissionsAsync();
  if (bg.status !== "granted") {
    const reBg = await Location.requestBackgroundPermissionsAsync();
    if (reBg.status !== "granted") {
      return { granted: false, background: false, message: "Permission \"Toujours\" requise. Activez-la dans les Réglages pour accepter une course et assurer son suivi en arrière-plan." };
    }
  }
  return { granted: true, background: true };
}

export async function isLocationTrackingActive(): Promise<boolean> {
  if (Platform.OS === "web") return false;
  try { return await Location.hasStartedLocationUpdatesAsync(LOCATION_TASK); } catch { return false; }
}

let foregroundSub: Location.LocationSubscription | null = null;

async function startForegroundWatcher(): Promise<void> {
  if (foregroundSub) return;
  if (Platform.OS === "web") {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      throw new Error("La géolocalisation n'est pas disponible sur cet appareil.");
    }
    const watchId = navigator.geolocation.watchPosition(
      (pos) => sendLocation({
        coords: { latitude: pos.coords.latitude, longitude: pos.coords.longitude, altitude: pos.coords.altitude ?? null, accuracy: pos.coords.accuracy ?? null, altitudeAccuracy: pos.coords.altitudeAccuracy ?? null, heading: pos.coords.heading ?? null, speed: pos.coords.speed ?? null },
        timestamp: pos.timestamp,
      } as unknown as Location.LocationObject),
      (err) => console.warn("[location:web] watch error", err),
      { enableHighAccuracy: true, maximumAge: 2000, timeout: 10000 },
    );
    foregroundSub = { remove: () => navigator.geolocation.clearWatch(watchId) } as Location.LocationSubscription;
    return;
  }
  foregroundSub = await Location.watchPositionAsync(
    { accuracy: Location.Accuracy.BestForNavigation, timeInterval: 4000, distanceInterval: 5, mayShowUserSettingsDialog: true },
    (loc) => { sendLocation(loc).catch((e) => console.warn("[location] sendLocation failed", e)); },
  );
}

function stopForegroundWatcher(): void {
  if (foregroundSub) { foregroundSub.remove(); foregroundSub = null; }
}

export async function startOnlineTracking(): Promise<void> {
  return runTrackingOperation(async () => {
    try {
      await startForegroundWatcher();
      if (Platform.OS === "web") return;
      const active = await isLocationTrackingActive();
      if (active) return;
      await Location.startLocationUpdatesAsync(LOCATION_TASK, {
        accuracy: Location.Accuracy.High,
        timeInterval: 15_000,
        distanceInterval: 25,
        showsBackgroundLocationIndicator: true,
        pausesUpdatesAutomatically: false,
        foregroundService: { notificationTitle: "Jatek Driver — En ligne", notificationBody: "Partage de position activé.", notificationColor: "#E91E8C" },
        activityType: Location.ActivityType.AutomotiveNavigation,
      });
      if (!await isLocationTrackingActive()) throw new Error("Le suivi GPS n'a pas pu démarrer.");
    } catch (error) {
      stopForegroundWatcher();
      throw error;
    }
  });
}

export async function startActiveOrderTracking(orderId: string): Promise<void> {
  return runTrackingOperation(async () => {
    setActiveOrderForTracking(orderId);
    try {
      getDriverLocationClient().connect().catch(() => {});
      await startForegroundWatcher();
      if (Platform.OS === "web") return;
      const active = await isLocationTrackingActive();
      if (active) await Location.stopLocationUpdatesAsync(LOCATION_TASK);
      await Location.startLocationUpdatesAsync(LOCATION_TASK, {
        accuracy: Location.Accuracy.BestForNavigation,
        timeInterval: 4_000,
        distanceInterval: 5,
        showsBackgroundLocationIndicator: true,
        pausesUpdatesAutomatically: false,
        foregroundService: { notificationTitle: "Jatek Driver — Course en cours", notificationBody: "Suivi GPS haute précision actif. Ne pas fermer l'application.", notificationColor: "#E91E8C" },
        activityType: Location.ActivityType.AutomotiveNavigation,
      });
      if (!await isLocationTrackingActive()) throw new Error("Le suivi GPS de la course n'a pas pu démarrer.");
    } catch (error) {
      setActiveOrderForTracking(null);
      stopForegroundWatcher();
      throw error;
    }
  });
}

export async function stopLocationTracking(force = false): Promise<void> {
  return runTrackingOperation(async () => {
    if (!force && activeOrderId) { console.warn("[location] refusing to stop — order is active", activeOrderId); return; }
    if (force) setActiveOrderForTracking(null);
    if (force) await clearConfirmedOrder();
    stopForegroundWatcher();
    if (Platform.OS === "web") return;
    const active = await isLocationTrackingActive();
    if (!active) return;
    await Location.stopLocationUpdatesAsync(LOCATION_TASK);
  });
}
