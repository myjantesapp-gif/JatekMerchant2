import type { Order } from '@/lib/api-core';

export const QUICK_ORDER_FILTERS = [
  { key: 'all', label: 'Toutes' },
  { key: 'attention', label: 'À traiter' },
  { key: 'inProgress', label: 'En cours' },
  { key: 'history', label: 'Historique' },
] as const;

export const STATUS_FILTERS = [
  { key: 'pending', label: 'À confirmer' },
  { key: 'preparing', label: 'En préparation' },
  { key: 'ready', label: 'Prêtes' },
  { key: 'delivery', label: 'En livraison' },
  { key: 'delivered', label: 'Livrées' },
  { key: 'cancelled', label: 'Annulées' },
] as const;

export const ORDER_FILTERS = [...QUICK_ORDER_FILTERS, ...STATUS_FILTERS] as const;
export type OrderFilter = (typeof ORDER_FILTERS)[number]['key'];

const PREPARING_STATUSES = new Set(['accepted', 'confirmed', 'preparing']);
const DELIVERY_STATUSES = new Set([
  'assigned',
  'driver_at_restaurant',
  'picked_up',
  'en_route',
  'out_for_delivery',
  'on_the_way',
  'delivering',
]);
const CANCELLED_STATUSES = new Set(['cancelled', 'rejected']);
const ACTIVE_STATUSES = new Set([
  'pending',
  ...PREPARING_STATUSES,
  'ready',
  ...DELIVERY_STATUSES,
]);

export function isActiveOrderStatus(status: string): boolean {
  return ACTIVE_STATUSES.has(status);
}

export function orderMatchesFilter(status: string, filter: OrderFilter): boolean {
  switch (filter) {
    case 'all':
      return true;
    case 'attention':
    case 'pending':
      return status === 'pending';
    case 'inProgress':
      return isActiveOrderStatus(status) && status !== 'pending';
    case 'history':
      return status === 'delivered' || CANCELLED_STATUSES.has(status);
    case 'preparing':
      return PREPARING_STATUSES.has(status);
    case 'ready':
      return status === 'ready';
    case 'delivery':
      return DELIVERY_STATUSES.has(status);
    case 'delivered':
      return status === 'delivered';
    case 'cancelled':
      return CANCELLED_STATUSES.has(status);
  }
}

export function countOrdersByFilter(orders: readonly Order[]): Record<OrderFilter, number> {
  return Object.fromEntries(
    ORDER_FILTERS.map(({ key }) => [key, orders.filter((order) => orderMatchesFilter(order.status, key)).length]),
  ) as Record<OrderFilter, number>;
}

function orderPriority(status: string): number {
  if (status === 'pending') return 0;
  if (status === 'ready') return 1;
  if (isActiveOrderStatus(status)) return 2;
  return 3;
}

export function filterAndSortOrders<T extends Order>(
  orders: readonly T[],
  filter: OrderFilter,
  search: string,
): T[] {
  const term = search.trim().toLocaleLowerCase('fr');

  return orders
    .filter((order) => orderMatchesFilter(order.status, filter))
    .filter((order) => {
      if (!term) return true;
      return [order.reference, String(order.id), order.userName, order.restaurantName]
        .filter(Boolean)
        .join(' ')
        .toLocaleLowerCase('fr')
        .includes(term);
    })
    .sort((a, b) => {
      const aPriority = orderPriority(a.status);
      const bPriority = orderPriority(b.status);
      if (aPriority !== bPriority) return aPriority - bPriority;

      const aTime = Date.parse(a.createdAt ?? '') || 0;
      const bTime = Date.parse(b.createdAt ?? '') || 0;
      if (aPriority < 3 && aTime !== bTime) return aTime - bTime;
      if (aTime !== bTime) return bTime - aTime;
      return a.id - b.id;
    });
}