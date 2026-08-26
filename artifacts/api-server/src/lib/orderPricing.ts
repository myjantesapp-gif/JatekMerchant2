/**
 * One server-side pricing contract used by every order consumer.
 * Values are calculated in centimes to avoid binary floating point drift,
 * then serialized as MAD numbers with at most two decimals.
 */
export const ORDER_PRICING_VERSION = "2026-08-v1";

function asNumber(value: number | string | null | undefined): number {
  const normalized = String(value ?? "0").trim().replace(",", ".");
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : 0;
}

function cents(value: number | string | null | undefined): number {
  return Math.round(Math.max(0, asNumber(value)) * 100);
}

function mad(valueInCents: number): number {
  return Math.round(valueInCents) / 100;
}

export type OrderPricingInput = {
  subtotal: number;
  deliveryFee: number;
  discountAmount: number;
  vatRate: number;
  commissionRate: number;
  currency?: string;
};

export function calculateOrderPricing(input: OrderPricingInput) {
  const productsCents = cents(input.subtotal);
  const deliveryCents = cents(input.deliveryFee);
  const discountCents = Math.min(productsCents, cents(input.discountAmount));
  const vatRate = Math.min(1, Math.max(0, asNumber(input.vatRate)));
  const commissionRate = Math.min(1, Math.max(0, asNumber(input.commissionRate)));
  const serviceFeeCents = Math.round(Math.max(0, productsCents * commissionRate));
  const taxableBaseCents = Math.max(0, productsCents - discountCents + deliveryCents + serviceFeeCents);
  const vatCents = Math.round(taxableBaseCents * vatRate);
  const totalCents = Math.max(0, taxableBaseCents + vatCents);

  return {
    subtotal: mad(productsCents),
    deliveryFee: mad(deliveryCents),
    discountAmount: mad(discountCents),
    vatRate,
    vatAmount: mad(vatCents),
    serviceFee: mad(serviceFeeCents),
    commissionRate,
    merchantEarning: mad(Math.max(0, productsCents - discountCents)),
    driverEarning: mad(deliveryCents),
    jatekEarning: mad(serviceFeeCents),
    total: mad(totalCents),
    currency: input.currency || "MAD",
    pricingVersion: ORDER_PRICING_VERSION,
  };
}

export function formatMad(value: number | null | undefined): string {
  return new Intl.NumberFormat("fr-MA", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(asNumber(value));
}