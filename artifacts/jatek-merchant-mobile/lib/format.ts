export function money(v: number | null | undefined, currency?: string | null) {
  const n = typeof v === 'number' && Number.isFinite(v) ? v : 0;
  return `${n.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${currency || 'MAD'}`;
}

export function dateTime(iso?: string | null) {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString('fr-FR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
}

const STATUS: Record<string, { label: string; tone: 'accent' | 'primary' | 'secondary' | 'muted' | 'destructive' }> = {
  pending: { label: 'En attente', tone: 'accent' },
  accepted: { label: 'Acceptée', tone: 'primary' },
  confirmed: { label: 'Confirmée', tone: 'primary' },
  preparing: { label: 'En préparation', tone: 'primary' },
  ready: { label: 'Prête', tone: 'secondary' },
  picked_up: { label: 'Récupérée', tone: 'secondary' },
  on_the_way: { label: 'En livraison', tone: 'secondary' },
  delivering: { label: 'En livraison', tone: 'secondary' },
  delivered: { label: 'Livrée', tone: 'muted' },
  completed: { label: 'Terminée', tone: 'muted' },
  cancelled: { label: 'Annulée', tone: 'destructive' },
  rejected: { label: 'Refusée', tone: 'destructive' },
  refunded: { label: 'Remboursée', tone: 'destructive' },
};

export function statusInfo(s: string) {
  return STATUS[s] ?? { label: s.replace(/_/g, ' '), tone: 'muted' as const };
}

export function parseExtras(raw?: string | null): string[] {
  if (!raw) return [];
  try {
    const v = JSON.parse(raw);
    return Array.isArray(v) ? v.map((x) => (typeof x === 'string' ? x : x?.name ?? x?.label ?? '')).filter(Boolean) : [];
  } catch { return [raw]; }
}
