export const DRIVER_REQUIRED_STATUSES = [
  "driver_at_restaurant",
  "picked_up",
  "en_route",
  "out_for_delivery",
] as const;

export type OrphanOrderIssue =
  | "missing_user"
  | "missing_restaurant"
  | "no_items"
  | "missing_driver"
  | "active_without_driver"
  | "historical_items_missing_menu";

export type OrderAuditSnapshot = {
  status: string;
  createdAt: Date | string;
  userId: number;
  restaurantId: number;
  driverId: number | null;
  userExists: boolean;
  restaurantExists: boolean;
  driverExists: boolean;
  itemCount: number;
  missingMenuItemCount: number;
  refundCount: number;
  reviewCount: number;
  promoUsageCount: number;
  chatMessageCount: number;
  notificationCount: number;
};

export function classifyOrphanOrder(order: OrderAuditSnapshot): OrphanOrderIssue[] {
  const issues: OrphanOrderIssue[] = [];

  if (!order.userExists) issues.push("missing_user");
  if (!order.restaurantExists) issues.push("missing_restaurant");
  if (order.itemCount === 0) issues.push("no_items");
  if (order.driverId !== null && !order.driverExists) issues.push("missing_driver");
  if (
    DRIVER_REQUIRED_STATUSES.includes(order.status as (typeof DRIVER_REQUIRED_STATUSES)[number]) &&
    order.driverId === null
  ) {
    issues.push("active_without_driver");
  }
  if (order.missingMenuItemCount > 0) issues.push("historical_items_missing_menu");

  return issues;
}

/**
 * The only automatic repair is cancelling an old, empty, still-pending order.
 * It preserves the order row and is refused when any business or notification
 * record is attached. Missing relations and active delivery anomalies always
 * remain manual-review cases.
 */
export function canAutoRepairEmptyOrder(order: OrderAuditSnapshot, now = new Date()): boolean {
  const ageHours = (now.getTime() - new Date(order.createdAt).getTime()) / (60 * 60 * 1000);
  return (
    order.status === "pending" &&
    ageHours >= 24 &&
    order.userExists &&
    order.restaurantExists &&
    order.driverId === null &&
    order.itemCount === 0 &&
    order.missingMenuItemCount === 0 &&
    order.refundCount === 0 &&
    order.reviewCount === 0 &&
    order.promoUsageCount === 0 &&
    order.chatMessageCount === 0 &&
    order.notificationCount === 0
  );
}