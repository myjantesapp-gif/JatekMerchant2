export function formatMad(value: number | null | undefined): string {
  const amount = Number(value ?? 0);
  if (!Number.isFinite(amount)) return "0,00";
  return amount.toLocaleString("fr-MA", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}