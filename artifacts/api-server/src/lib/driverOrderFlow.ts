export const DRIVER_ORDER_TRANSITIONS: Record<string, readonly string[]> = {
  accepted: ["driver_at_restaurant"],
  driver_at_restaurant: ["picked_up"],
  picked_up: ["en_route"],
  en_route: ["out_for_delivery"],
};

export const DELIVERY_CODE_TTL_MS = 24 * 60 * 60 * 1000;

export type AcceptanceDecision = "claim" | "already_accepted" | "driver_has_active_order";

export function classifyDriverAcceptance(
  activeOrder: { id: number; status: string } | null | undefined,
  orderId: number,
): AcceptanceDecision {
  if (!activeOrder || activeOrder.id !== orderId) {
    return activeOrder ? "driver_has_active_order" : "claim";
  }
  return ["ready", "assigned"].includes(activeOrder.status) ? "claim" : "already_accepted";
}

export function isValidDriverTransition(current: string, next: string): boolean {
  return DRIVER_ORDER_TRANSITIONS[current]?.includes(next) ?? false;
}

export function isDeliveryCodeFormatValid(code: unknown): code is string {
  return typeof code === "string" && /^\d{4}$/.test(code.trim());
}

export function isDeliveryCodeExpired(expiresAt: Date | string | null | undefined, now = new Date()): boolean {
  if (!expiresAt) return false;
  const expiry = expiresAt instanceof Date ? expiresAt : new Date(expiresAt);
  return Number.isNaN(expiry.getTime()) || expiry.getTime() <= now.getTime();
}

export type DeliveryCodeAttempt =
  | { ok: true }
  | { ok: false; status: 400 | 409 | 410; code: string; message: string };

export function validateDeliveryCodeAttempt(input: {
  status: string;
  pickupCode: string | null;
  pickupCodeUsedAt: Date | string | null | undefined;
  pickupCodeExpiresAt: Date | string | null | undefined;
  enteredCode: string;
}, now = new Date()): DeliveryCodeAttempt {
  if (input.status === "delivered" || input.pickupCodeUsedAt) {
    return {
      ok: false,
      status: 409,
      code: "DELIVERY_CODE_ALREADY_USED",
      message: "Cette livraison a déjà été confirmée. Le code a déjà été utilisé.",
    };
  }
  if (input.status !== "out_for_delivery") {
    return {
      ok: false,
      status: 409,
      code: "DELIVERY_NOT_READY",
      message: "La course doit être arrivée chez le client avant confirmation.",
    };
  }
  if (isDeliveryCodeExpired(input.pickupCodeExpiresAt, now)) {
    return {
      ok: false,
      status: 410,
      code: "DELIVERY_CODE_EXPIRED",
      message: "Le code de livraison a expiré. Demandez un nouveau code au client.",
    };
  }
  if (!input.pickupCode || input.pickupCode !== input.enteredCode) {
    return {
      ok: false,
      status: 400,
      code: "INVALID_PICKUP_CODE",
      message: "Incorrect pickup code",
    };
  }
  return { ok: true };
}