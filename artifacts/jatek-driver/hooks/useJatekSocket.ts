import { useEffect, useRef, useState } from "react";
import { io, type Socket } from "socket.io-client";

type OrderPayload = {
  driverId?: string | number | null;
  order?: { driverId?: string | number | null } | null;
  [key: string]: unknown;
};

export type UseJatekSocketOptions = {
  token: string | null;
  driverId?: string | number;
  enabled?: boolean;
  onOrderReady?: (order: OrderPayload) => void;
  onOrderAssigned?: (order: OrderPayload) => void;
  onOrderStatus?: (order: OrderPayload) => void;
};

const PRIMARY_URL = (process.env.EXPO_PUBLIC_API_URL ?? "https://driver.jatek.app").replace(/\/api\/?$/, "");
const FALLBACK_URL = "https://api.jatek.app";

function getPayloadDriverId(payload: OrderPayload): string | null {
  const driverId = payload.driverId ?? payload.order?.driverId;
  return driverId == null ? null : String(driverId);
}

/**
 * Connects the driver app directly to the remote Socket.IO backend.
 *
 * This intentionally does not derive the URL from the Replit preview domain:
 * the driver app is an operational client and must keep working when the
 * frontend preview is stopped or unavailable.
 */
export function useJatekSocket({
  token,
  driverId,
  enabled = true,
  onOrderReady,
  onOrderAssigned,
  onOrderStatus,
}: UseJatekSocketOptions) {
  const [isConnected, setIsConnected] = useState(false);
  const [activeUrl, setActiveUrl] = useState<string | null>(null);
  const [socket, setSocket] = useState<Socket | null>(null);
  const socketRef = useRef<Socket | null>(null);
  const callbacksRef = useRef({ onOrderReady, onOrderAssigned, onOrderStatus });
  callbacksRef.current = { onOrderReady, onOrderAssigned, onOrderStatus };

  useEffect(() => {
    if (!enabled || !token) {
      socketRef.current?.disconnect();
      socketRef.current = null;
      setSocket(null);
      setIsConnected(false);
      setActiveUrl(null);
      return;
    }

    let disposed = false;
    let fallbackStarted = false;

    const stopCurrent = () => {
      const current = socketRef.current;
      socketRef.current = null;
      if (current) {
        current.removeAllListeners();
        current.disconnect();
      }
      setSocket(null);
      setIsConnected(false);
    };

    const start = (serverUrl: string) => {
      if (disposed) return;
      stopCurrent();

      const nextSocket = io(serverUrl, {
        path: "/socket.io/",
        transports: ["websocket", "polling"],
        auth: { token },
        reconnection: true,
        reconnectionAttempts: 3,
        reconnectionDelay: 2_000,
      });
      socketRef.current = nextSocket;
      setSocket(nextSocket);
      setActiveUrl(serverUrl);

      nextSocket.on("connect", () => {
        if (disposed || socketRef.current !== nextSocket) return;
        setIsConnected(true);
        setActiveUrl(serverUrl);
        if (driverId !== undefined && driverId !== null) {
          nextSocket.emit("driver_register", { driverId });
        }
      });

      nextSocket.on("disconnect", () => {
        if (socketRef.current !== nextSocket) return;
        setIsConnected(false);
      });

      nextSocket.on("connect_error", (error) => {
        if (disposed || socketRef.current !== nextSocket) return;
        setIsConnected(false);
        if (serverUrl === PRIMARY_URL && !fallbackStarted) {
          fallbackStarted = true;
          console.warn("[driver-socket] driver.jatek.app unavailable, switching to api.jatek.app", error.message);
          start(FALLBACK_URL);
        }
      });

      nextSocket.on("order_ready", (payload: OrderPayload) => {
        callbacksRef.current.onOrderReady?.(payload);
      });

      nextSocket.on("order_assigned", (payload: OrderPayload) => {
        const payloadDriverId = getPayloadDriverId(payload);
        if (driverId === undefined || payloadDriverId === null || payloadDriverId === String(driverId)) {
          callbacksRef.current.onOrderAssigned?.(payload);
        }
      });

      nextSocket.on("order_status", (payload: OrderPayload) => {
        callbacksRef.current.onOrderStatus?.(payload);
      });
    };

    start(PRIMARY_URL);

    return () => {
      disposed = true;
      stopCurrent();
    };
  }, [driverId, enabled, token]);

  return { isConnected, activeUrl, socket };
}