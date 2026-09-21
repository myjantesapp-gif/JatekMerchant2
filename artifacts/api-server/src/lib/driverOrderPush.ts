import { clearInvalidExpoPushToken } from "./pushTokenCleanup";
import { isExpoPushToken, notifyDrivers } from "./expoPush";

const BATCH_WINDOW_MS = 10_000;

type ReadyOrder = {
  orderId: number;
  restaurantName: string;
  deliveryAddress: string;
  driverEarning: number | null;
};

type PendingBatch = {
  orders: Map<number, ReadyOrder>;
  timer: ReturnType<typeof setTimeout>;
};

const pendingByToken = new Map<string, PendingBatch>();

async function flushToken(token: string, batch: PendingBatch): Promise<void> {
  const orders = Array.from(batch.orders.values());
  if (orders.length === 0) return;

  const first = orders[0];
  const orderIds = orders.map((order) => order.orderId);
  const title = orders.length === 1
    ? "🏍️ Nouvelle course disponible !"
    : `🏍️ ${orders.length} nouvelles courses disponibles !`;
  const body = orders.length === 1
    ? `${first.restaurantName} → ${first.deliveryAddress}\nGain estimé : ${first.driverEarning ?? 0} DH`
    : `${orders.length} courses sont disponibles. Ouvrez l’application pour les consulter.`;

  try {
    await notifyDrivers(
      [token],
      title,
      body,
      {
        type: "new_order",
        orderId: orderIds[0],
        orderIds,
      },
      {
        channelId: "incoming-order",
        priority: "high",
        ttl: 60,
        onInvalidToken: clearInvalidExpoPushToken,
      },
    );
  } catch (error) {
    console.warn("[driver-order-push] batch dispatch failed:", error);
  }
}

/**
 * Queue ready orders per device for a short window.
 *
 * Realtime order events are still published individually. Only background
 * push notifications are coalesced so a burst of ready orders does not fill
 * the driver's notification shade with identical alerts.
 */
export function queueDriverOrderPush(
  tokens: (string | null | undefined)[],
  order: ReadyOrder,
): void {
  const uniqueTokens = Array.from(new Set(tokens.filter(isExpoPushToken)));

  for (const token of uniqueTokens) {
    const existing = pendingByToken.get(token);
    if (existing) {
      existing.orders.set(order.orderId, order);
      continue;
    }

    const orders = new Map([[order.orderId, order]]);
    const timer = setTimeout(() => {
      pendingByToken.delete(token);
      void flushToken(token, { orders, timer });
    }, BATCH_WINDOW_MS);
    timer.unref?.();
    pendingByToken.set(token, { orders, timer });
  }
}
