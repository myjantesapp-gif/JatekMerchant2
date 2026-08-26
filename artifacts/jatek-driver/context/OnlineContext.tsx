import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { Alert } from "react-native";
import { setDriverOnline } from "@/lib/api";
import { requestLocationPermissions, setActiveOrderForTracking, startOnlineTracking, stopLocationTracking } from "@/services/locationService";
import { getDriverLocationClient } from "@/services/wsClient";
import { useAuth } from "./AuthContext";
import { useActiveOrder } from "./ActiveOrderContext";

type OnlineState = {
  isOnline: boolean;
  toggling: boolean;
  toggleOnline: () => Promise<void>;
};

const OnlineCtx = createContext<OnlineState | undefined>(undefined);

export function OnlineProvider({ children }: { children: React.ReactNode }) {
  const { ready, token, user } = useAuth();
  const { trackingActive, endTracking } = useActiveOrder();
  const [isOnline, setIsOnline] = useState(user?.driver?.isOnline ?? false);
  const [toggling, setToggling] = useState(false);

  useEffect(() => {
    if (user?.driver) setIsOnline(user.driver.isOnline ?? false);
  }, [user?.driver?.isOnline]);

  useEffect(() => {
    // A transient /auth/me failure keeps the persisted token. Do not tear down
    // an in-progress delivery until the session has actually been cleared.
    if (!ready || user || token) return;
    setIsOnline(false);
    endTracking().catch((error) => console.warn("[online] session cleanup failed", error));
    getDriverLocationClient().close();
  }, [endTracking, ready, token, user]);

  const toggleOnline = useCallback(async () => {
    if (toggling) return;
    if (trackingActive) {
      Alert.alert("Course en cours", "Vous ne pouvez pas passer hors ligne pendant une course active.");
      return;
    }
    const next = !isOnline;
    setToggling(true);
    try {
      if (next) {
        const perm = await requestLocationPermissions();
        if (!perm.granted) {
          Alert.alert("Permission requise", perm.message ?? "La localisation est nécessaire pour recevoir des courses.");
          return;
        }
        try {
          await startOnlineTracking();
          getDriverLocationClient().connect().catch(() => {});
          await setDriverOnline(true);
          setIsOnline(true);
        } catch (error) {
          setActiveOrderForTracking(null);
          await stopLocationTracking(true).catch(() => {});
          getDriverLocationClient().close();
          throw error;
        }
      } else {
        await setDriverOnline(false);
        setActiveOrderForTracking(null);
        await stopLocationTracking(true);
        getDriverLocationClient().close();
        setIsOnline(false);
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Erreur de connexion";
      Alert.alert("Erreur", msg);
    } finally {
      setToggling(false);
    }
  }, [isOnline, toggling, trackingActive]);

  const value = useMemo<OnlineState>(
    () => ({ isOnline, toggling, toggleOnline }),
    [isOnline, toggling, toggleOnline],
  );

  return <OnlineCtx.Provider value={value}>{children}</OnlineCtx.Provider>;
}

export function useOnline(): OnlineState {
  const ctx = useContext(OnlineCtx);
  if (!ctx) throw new Error("useOnline must be used within OnlineProvider");
  return ctx;
}
