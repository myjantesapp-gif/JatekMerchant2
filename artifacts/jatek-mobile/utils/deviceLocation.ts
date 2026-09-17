import { Linking, Platform } from "react-native";
import * as Location from "expo-location";

export type DeviceLocationFailure =
  | "permission-denied"
  | "services-disabled"
  | "timeout"
  | "unavailable";

export class DeviceLocationError extends Error {
  constructor(
    public readonly reason: DeviceLocationFailure,
    public readonly canAskAgain = true,
  ) {
    super(reason);
    this.name = "DeviceLocationError";
  }
}

const LOCATION_TIMEOUT_MS = 12_000;

export async function withLocationTimeout<T>(
  operation: Promise<T>,
  timeoutMs = LOCATION_TIMEOUT_MS,
): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      operation,
      new Promise<never>((_, reject) => {
        timer = setTimeout(
          () => reject(new DeviceLocationError("timeout")),
          timeoutMs,
        );
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

function getWebLocation(): Promise<{ latitude: number; longitude: number }> {
  return new Promise((resolve, reject) => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      reject(new DeviceLocationError("unavailable"));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => resolve({
        latitude: coords.latitude,
        longitude: coords.longitude,
      }),
      (error) => {
        if (error.code === error.PERMISSION_DENIED) {
          reject(new DeviceLocationError("permission-denied", false));
        } else if (error.code === error.TIMEOUT) {
          reject(new DeviceLocationError("timeout"));
        } else {
          reject(new DeviceLocationError("unavailable"));
        }
      },
      { enableHighAccuracy: false, timeout: LOCATION_TIMEOUT_MS, maximumAge: 30_000 },
    );
  });
}

export async function getDeviceLocation(): Promise<{
  latitude: number;
  longitude: number;
}> {
  if (Platform.OS === "web") {
    return withLocationTimeout(getWebLocation());
  }

  let servicesEnabled: boolean;
  try {
    servicesEnabled = await Location.hasServicesEnabledAsync();
  } catch {
    throw new DeviceLocationError("unavailable");
  }
  if (!servicesEnabled) throw new DeviceLocationError("services-disabled");

  let permission = await Location.getForegroundPermissionsAsync();
  if (!permission.granted) {
    if (!permission.canAskAgain) {
      throw new DeviceLocationError("permission-denied", false);
    }
    permission = await Location.requestForegroundPermissionsAsync();
  }
  if (!permission.granted) {
    throw new DeviceLocationError("permission-denied", permission.canAskAgain);
  }

  try {
    const position = await withLocationTimeout(
      Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      }),
    );
    return {
      latitude: position.coords.latitude,
      longitude: position.coords.longitude,
    };
  } catch (error) {
    if (error instanceof DeviceLocationError) throw error;
    throw new DeviceLocationError("unavailable");
  }
}

export async function openLocationSettings(): Promise<void> {
  if (Platform.OS === "web") return;
  try {
    await Linking.openSettings();
  } catch {
    // Settings may be unavailable on restricted devices; the manual map remains usable.
  }
}