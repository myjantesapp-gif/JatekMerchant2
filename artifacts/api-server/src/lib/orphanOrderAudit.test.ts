import assert from "node:assert/strict";
import test from "node:test";

import {
  canAutoRepairEmptyOrder,
  classifyOrphanOrder,
  type OrderAuditSnapshot,
} from "./orphanOrderAudit";

const baseOrder = (overrides: Partial<OrderAuditSnapshot> = {}): OrderAuditSnapshot => ({
  status: "accepted",
  createdAt: new Date("2026-09-01T10:00:00Z"),
  userId: 1,
  restaurantId: 2,
  driverId: 3,
  userExists: true,
  restaurantExists: true,
  driverExists: true,
  itemCount: 1,
  missingMenuItemCount: 0,
  refundCount: 0,
  reviewCount: 0,
  promoUsageCount: 0,
  chatMessageCount: 0,
  notificationCount: 0,
  ...overrides,
});

test("classifies an assigned order whose driver was deleted without treating it as deletable", () => {
  const order = baseOrder({ driverId: 6, driverExists: false });

  assert.deepEqual(classifyOrphanOrder(order), ["missing_driver"]);
  assert.equal(canAutoRepairEmptyOrder(order, new Date("2026-09-04T10:00:00Z")), false);
});

test("classifies active driver statuses without an assigned driver", () => {
  const order = baseOrder({ status: "out_for_delivery", driverId: null });

  assert.deepEqual(classifyOrphanOrder(order), ["active_without_driver"]);
});

test("only repairs an old empty pending order with no dependent records", () => {
  const order = baseOrder({
    status: "pending",
    createdAt: new Date("2026-09-01T10:00:00Z"),
    driverId: null,
    itemCount: 0,
  });

  assert.deepEqual(classifyOrphanOrder(order), ["no_items"]);
  assert.equal(canAutoRepairEmptyOrder(order, new Date("2026-09-04T10:00:00Z")), true);
  assert.equal(
    canAutoRepairEmptyOrder(
      { ...order, notificationCount: 1 },
      new Date("2026-09-04T10:00:00Z"),
    ),
    false,
  );
});

test("keeps historical missing menu references as a report-only issue", () => {
  const order = baseOrder({ missingMenuItemCount: 1 });

  assert.deepEqual(classifyOrphanOrder(order), ["historical_items_missing_menu"]);
  assert.equal(canAutoRepairEmptyOrder(order, new Date("2026-09-04T10:00:00Z")), false);
});