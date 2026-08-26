import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import {
  ensureAlwaysLocationPermission,
  confirmActiveOrderTracking,
  restoreConfirmedOrderTracking,
  startActiveOrderTracking,
  stopLocationTracking,
  setActiveOrderForTracking,
} from "@/services/locationService";
import { getDriverLocationClient, type WsStatus } from "@/services/wsClient";
import { getOrder } from "@/lib/api";

type Ctx = {
  activeOrderId: string | null;
  trackingActive: boolean;
  wsStatus: WsStatus;
  beginTracking: (orderId: string) => Promise<string | null>;
  confirmTracking: (orderId: string) => Promise<void>;
  endTracking: () => Promise<void>;
};

const ActiveOrderCtx = createContext<Ctx | undefined>(undefined);

export function ActiveOrderProvider({ children }: { children: React.ReactNode }) {
  const [activeOrderId, setActiveOrderId] = useState<string | null>(null);
  const [trackingActive, setTrackingActive] = useState(false);
  const [wsStatus, setWsStatus] = useState<WsStatus>("idle");
  const wsRef = useRef(getDriverLocationClient());

  useEffect(() => {
    const off = wsRef.current.onStatus((s) => setWsStatus(s));
    return off;
  }, []);

  const beginTracking = useCallback(async (orderId: string): Promise<string | null> => {
    if (activeOrderId && activeOrderId !== orderId) {
      return "Une autre course est déjà suivie. Terminez-la avant d'en accepter une nouvelle.";
    }
    try {
      const perm = await ensureAlwaysLocationPermission();
      if (!perm.granted) {
        return perm.message ?? "Permission de localisation requise pour démarrer la course.";
      }
      await startActiveOrderTracking(orderId);
      setActiveOrderId(orderId);
      setTrackingActive(true);
      wsRef.current.connect().catch(() => {});
      return null;
    } catch (e) {
      setActiveOrderForTracking(null);
      await stopLocationTracking(true).catch(() => {});
      setActiveOrderId(null);
      setTrackingActive(false);
      const msg = e instanceof Error ? e.message : "Impossible de démarrer le suivi GPS.";
      console.warn("[active-order] start failed", e);
      return msg;
    }
  }, [activeOrderId]);

  const endTracking = useCallback(async () => {
    try {
      setActiveOrderForTracking(null);
      await stopLocationTracking(true);
    } catch (e) {
      console.warn("[active-order] stop failed", e);
    } finally {
      setActiveOrderId(null);
      setTrackingActive(false);
    }
  }, []);

  useEffect(() => {
    let disposed = false;
    const restoreConfirmedOrder = async () => {
      const savedOrderId = await restoreConfirmedOrderTracking();
      if (!savedOrderId || disposed) return;
      setActiveOrderId(savedOrderId);
      setTrackingActive(true);
      try {
        const order = await getOrder(savedOrderId);
        if (!disposed && (order.status === "cancelled" || order.status === "delivered")) {
          await endTracking();
        }
      } catch {
        // Keep tracking while offline; the next location update verifies the
        // authoritative active-order list before continuing.
      }
    };
    void restoreConfirmedOrder();
    return () => { disposed = true; };
  }, [endTracking]);

  useEffect(() => {
    if (!activeOrderId) return;
    const reconcile = async () => {
      try {
        const order = await getOrder(activeOrderId);
        if (order.status === "cancelled" || order.status === "delivered") await endTracking();
      } catch {
        // Location updates perform the same check while backgrounded.
      }
    };
    void reconcile();
    const timer = setInterval(() => { void reconcile(); }, 15_000);
    return () => clearInterval(timer);
  }, [activeOrderId, endTracking]);

  const confirmTracking = useCallback(async (orderId: string) => {
    await confirmActiveOrderTracking(orderId);
  }, []);

  const value = useMemo<Ctx>(
    () => ({ activeOrderId, trackingActive, wsStatus, beginTracking, confirmTracking, endTracking }),
    [activeOrderId, trackingActive, wsStatus, beginTracking, confirmTracking, endTracking],
  );

  return <ActiveOrderCtx.Provider value={value}>{children}</ActiveOrderCtx.Provider>;
}

export function useActiveOrder(): Ctx {
  const c = useContext(ActiveOrderCtx);
  if (!c) throw new Error("useActiveOrder must be used within ActiveOrderProvider");
  return c;
}
