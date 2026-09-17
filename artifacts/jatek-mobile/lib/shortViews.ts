export function formatShortViewCount(value: number | null | undefined): string {
  const count = Number.isFinite(value) ? Math.max(0, Number(value)) : 0;
  return count >= 1000
    ? `${(count / 1000).toLocaleString("fr-FR", { maximumFractionDigits: 1 })}K`
    : count.toLocaleString("fr-FR");
}