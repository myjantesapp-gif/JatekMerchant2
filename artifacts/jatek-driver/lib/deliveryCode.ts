export function normalizeDeliveryCode(value: string): string {
  return value.replace(/\D/g, "").slice(0, 4);
}

export function isDeliveryCodeValid(value: unknown): value is string {
  return typeof value === "string" && /^\d{4}$/.test(value.trim());
}