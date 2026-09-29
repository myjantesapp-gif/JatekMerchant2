import assert from 'node:assert/strict';
import test from 'node:test';
import { sortOrdersOldestFirst } from './orderQueue';

test('orders oldest first and uses the id as a stable timestamp tie-breaker', () => {
  const newestFirst = [
    { id: 8, createdAt: '2026-09-29T12:00:00.000Z' },
    { id: 7, createdAt: '2026-09-29T11:00:00.000Z' },
    { id: 6, createdAt: '2026-09-29T11:00:00.000Z' },
  ];

  assert.deepEqual(sortOrdersOldestFirst(newestFirst).map((order) => order.id), [6, 7, 8]);
  assert.deepEqual(newestFirst.map((order) => order.id), [8, 7, 6], 'the API result is not mutated');
});

test('invalid timestamps are placed after dated orders', () => {
  const orders = [
    { id: 1, createdAt: 'not-a-date' },
    { id: 2, createdAt: '2026-09-29T11:00:00.000Z' },
  ];

  assert.deepEqual(sortOrdersOldestFirst(orders).map((order) => order.id), [2, 1]);
});