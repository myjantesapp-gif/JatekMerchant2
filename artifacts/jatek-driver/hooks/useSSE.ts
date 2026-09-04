import { useEffect, useRef } from "react";
import { AppState, type AppStateStatus, Platform } from "react-native";
import { getToken } from "@/lib/auth";
import { getApiTarget, getBaseUrl } from "@/lib/apiTarget";

type EventHandler = (data: unknown) => void;

type SSEOptions = {
  channels: string;
  events: Record<string, EventHandler>;
  enabled?: boolean;
};

const INITIAL_BACKOFF_MS = 1_000;
const MAX_BACKOFF_MS = 30_000;
const READ_TIMEOUT_MS = 60_000;

/**
 * Driver-side SSE subscription. The available-orders query remains enabled as
 * a polling fallback, so a dropped stream never hides a ready course.
 */
export function useSSE({ channels, events, enabled = true }: SSEOptions): void {
  const eventsRef = useRef(events);
  eventsRef.current = events;

  useEffect(() => {
    if (!enabled) return;

    let cancelled = false;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
    let controller: AbortController | null = null;
    let browserSource: EventSource | null = null;
    let backoff = INITIAL_BACKOFF_MS;
    let isActive = AppState.currentState === "active";

    const scheduleReconnect = () => {
      if (cancelled || !isActive || reconnectTimer) return;
      const delay = backoff;
      backoff = Math.min(backoff * 2, MAX_BACKOFF_MS);
      reconnectTimer = setTimeout(() => {
        reconnectTimer = null;
        void connect();
      }, delay);
    };

    const disconnect = () => {
      if (reconnectTimer) {
        clearTimeout(reconnectTimer);
        reconnectTimer = null;
      }
      controller?.abort();
      controller = null;
      browserSource?.close();
      browserSource = null;
    };

    const dispatch = (eventName: string, rawData: string) => {
      if (!rawData) return;
      try {
        eventsRef.current[eventName]?.(JSON.parse(rawData));
      } catch (error) {
        console.warn("[driver-sse] invalid event payload", error);
      }
    };

    async function connect(): Promise<void> {
      if (cancelled || !isActive) return;
      const requestToken = await getToken();
      if (!requestToken) return;
      const base = getBaseUrl(await getApiTarget());
      const query = `channels=${encodeURIComponent(channels)}&token=${encodeURIComponent(requestToken)}`;

      if (Platform.OS === "web" && typeof EventSource !== "undefined") {
        const source = new EventSource(`${base}/events?${query}`);
        browserSource = source;
        const eventNames = Object.keys(eventsRef.current);
        eventNames.forEach((eventName) => {
          source.addEventListener(eventName, (event) => {
            try {
              dispatch(eventName, (event as MessageEvent).data);
            } catch (error) {
              console.warn("[driver-sse] event dispatch failed", error);
            }
          });
        });
        source.onerror = () => {
          source.close();
          if (browserSource === source) browserSource = null;
          if (!cancelled && isActive) scheduleReconnect();
        };
        return;
      }

      const nextController = new AbortController();
      controller = nextController;
      let lastReadAt = Date.now();
      const watchdog = setInterval(() => {
        if (Date.now() - lastReadAt > READ_TIMEOUT_MS) nextController.abort();
      }, 10_000);

      try {
        const response = await fetch(`${base}/events?channels=${encodeURIComponent(channels)}`, {
          headers: { Accept: "text/event-stream", Authorization: `Bearer ${requestToken}` },
          signal: nextController.signal,
        });
        if (!response.ok || !response.body) {
          if (response.status >= 400 && response.status < 500) return;
          throw new Error(`SSE HTTP ${response.status}`);
        }
        backoff = INITIAL_BACKOFF_MS;
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";
        let eventName = "message";
        let data = "";

        const flush = () => {
          if (data) dispatch(eventName, data);
          eventName = "message";
          data = "";
        };

        while (!cancelled && isActive) {
          const { done, value } = await reader.read();
          if (done) break;
          lastReadAt = Date.now();
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() ?? "";
          for (const line of lines) {
            if (line === "") {
              flush();
            } else if (line.startsWith("event:")) {
              eventName = line.slice(6).trim();
            } else if (line.startsWith("data:")) {
              data += `${line.slice(5).trim()}\n`;
            }
          }
        }
        flush();
        if (!cancelled && isActive) scheduleReconnect();
      } catch (error) {
        if (!cancelled && isActive && (error as { name?: string })?.name !== "AbortError") {
          scheduleReconnect();
        } else if (!cancelled && isActive) {
          scheduleReconnect();
        }
      } finally {
        clearInterval(watchdog);
        if (controller === nextController) controller = null;
      }
    }

    const onAppStateChange = (nextState: AppStateStatus) => {
      const nextActive = nextState === "active";
      if (nextActive && !isActive) {
        isActive = true;
        backoff = INITIAL_BACKOFF_MS;
        void connect();
      } else if (!nextActive && isActive) {
        isActive = false;
        disconnect();
      }
    };

    const subscription = AppState.addEventListener("change", onAppStateChange);
    void connect();
    return () => {
      cancelled = true;
      subscription.remove();
      disconnect();
    };
  }, [channels, enabled]);
}