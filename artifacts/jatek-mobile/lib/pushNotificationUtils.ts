type NotificationResponseShape = {
  notification?: {
    request?: {
      identifier?: unknown;
      date?: unknown;
      content?: { data?: unknown };
    };
  };
};

function responseShape(response: unknown): NotificationResponseShape {
  return response && typeof response === "object"
    ? response as NotificationResponseShape
    : {};
}

export function notificationResponseKey(response: unknown): string {
  const request = responseShape(response).notification?.request;
  if (typeof request?.identifier === "string" && request.identifier) {
    return `id:${request.identifier}`;
  }

  const data = request?.content?.data;
  let serializedData = "";
  try {
    serializedData = JSON.stringify(data ?? {});
  } catch {
    serializedData = "";
  }
  return `fallback:${String(request?.date ?? "")}:${serializedData}`;
}

export function orderIdFromNotificationResponse(response: unknown): number | null {
  const data = responseShape(response).notification?.request?.content?.data;
  if (!data || typeof data !== "object") return null;
  const rawOrderId = (data as Record<string, unknown>).orderId;
  if (typeof rawOrderId !== "number" && typeof rawOrderId !== "string") return null;
  const orderId = typeof rawOrderId === "number" ? rawOrderId : Number(rawOrderId);
  return Number.isSafeInteger(orderId) && orderId > 0 ? orderId : null;
}