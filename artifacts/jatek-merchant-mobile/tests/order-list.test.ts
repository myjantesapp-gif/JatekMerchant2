import assert from 'node:assert/strict';
import test from 'node:test';
import type { Order } from '../lib/api-core';
import { countOrdersByFilter, filterAndSortOrders, orderMatchesFilter } from '../lib/order-list';

function makeOrder(id: number, status: string, createdAt: string, customer = 'Client'): Order {
  return {
    id,
    status,
    createdAt,
    reference: `JTK-${id}`,
    userName: customer,
    restaurantName: 'Le Comptoir',
    total: 85,
  } as Order;
}

test('order filters include every operational delivery status', () => {
  for (const status of ['accepted', 'confirmed', 'preparing']) {
    assert.equal(orderMatchesFilter(status, 'preparing'), true);
  }
  for (const status of ['assigned', 'driver_at_restaurant', 'picked_up', 'en_route', 'out_for_delivery', 'on_the_way', 'delivering']) {
    assert.equal(orderMatchesFilter(status, 'delivery'), true);
  }
  assert.equal(orderMatchesFilter('rejected', 'cancelled'), true);
  assert.equal(orderMatchesFilter('delivered', 'delivery'), false);
});

test('filter counts report grouped statuses without losing the all-orders total', () => {
  const orders = [
    makeOrder(1, 'pending', '2026-09-30T10:00:00Z'),
    makeOrder(2, 'preparing', '2026-09-30T10:05:00Z'),
    makeOrder(3, 'out_for_delivery', '2026-09-30T10:10:00Z'),
    makeOrder(4, 'delivered', '2026-09-30T10:15:00Z'),
    makeOrder(5, 'cancelled', '2026-09-30T10:20:00Z'),
  ];
  assert.deepEqual(countOrdersByFilter(orders), {
    all: 5,
    pending: 1,
    preparing: 1,
    ready: 0,
    delivery: 1,
    delivered: 1,
    cancelled: 1,
  });
});

test('orders prioritize confirmations and ready pickups, then search customer and reference', () => {
  const orders = [
    makeOrder(1, 'delivered', '2026-09-30T11:00:00Z', 'Alice'),
    makeOrder(2, 'preparing', '2026-09-30T09:00:00Z', 'Bilal'),
    makeOrder(3, 'ready', '2026-09-30T08:00:00Z', 'Chloé'),
    makeOrder(4, 'pending', '2026-09-30T10:00:00Z', 'Dalia'),
    makeOrder(5, 'pending', '2026-09-30T07:00:00Z', 'Emma'),
  ];
  assert.deepEqual(filterAndSortOrders(orders, 'all', '').map((order) => order.id), [5, 4, 3, 2, 1]);
  assert.deepEqual(filterAndSortOrders(orders, 'all', 'chloé').map((order) => order.id), [3]);
  assert.deepEqual(filterAndSortOrders(orders, 'all', 'JTK-4').map((order) => order.id), [4]);
});