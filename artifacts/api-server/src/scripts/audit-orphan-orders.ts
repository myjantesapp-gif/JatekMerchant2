import { pool } from "@workspace/db";
import {
  canAutoRepairEmptyOrder,
  classifyOrphanOrder,
  type OrderAuditSnapshot,
  type OrphanOrderIssue,
} from "../lib/orphanOrderAudit";

const AUDIT_QUERY = `
  SELECT
    o.id,
    o.reference,
    o.status,
    o.created_at AS "createdAt",
    o.updated_at AS "updatedAt",
    o.user_id AS "userId",
    o.restaurant_id AS "restaurantId",
    o.driver_id AS "driverId",
    EXISTS (SELECT 1 FROM users u WHERE u.id = o.user_id) AS "userExists",
    EXISTS (SELECT 1 FROM restaurants r WHERE r.id = o.restaurant_id) AS "restaurantExists",
    (o.driver_id IS NULL OR EXISTS (SELECT 1 FROM drivers d WHERE d.id = o.driver_id)) AS "driverExists",
    (SELECT COUNT(*)::int FROM order_items oi WHERE oi.order_id = o.id) AS "itemCount",
    (
      SELECT COUNT(*)::int
      FROM order_items oi
      LEFT JOIN menu_items mi ON mi.id = oi.menu_item_id
      WHERE oi.order_id = o.id AND mi.id IS NULL
    ) AS "missingMenuItemCount",
    (SELECT COUNT(*)::int FROM refunds rf WHERE rf.order_id = o.id) AS "refundCount",
    (SELECT COUNT(*)::int FROM reviews rv WHERE rv.order_id = o.id) AS "reviewCount",
    (SELECT COUNT(*)::int FROM promo_code_usages pu WHERE pu.order_id = o.id) AS "promoUsageCount",
    (SELECT COUNT(*)::int FROM chat_messages cm WHERE cm.order_id = o.id) AS "chatMessageCount",
    (
      SELECT COUNT(*)::int
      FROM notifications n
      WHERE n.data->>'orderId' = o.id::text
    ) AS "notificationCount"
  FROM orders o
  ORDER BY o.created_at ASC, o.id ASC
`;

const DANGLING_RELATIONS_QUERY = `
  SELECT source, row_count
  FROM (
    SELECT 'order_items' AS source, COUNT(*)::int AS row_count
    FROM order_items oi
    LEFT JOIN orders o ON o.id = oi.order_id
    WHERE o.id IS NULL
    UNION ALL
    SELECT 'refunds', COUNT(*)::int
    FROM refunds rf
    LEFT JOIN orders o ON o.id = rf.order_id
    WHERE o.id IS NULL
    UNION ALL
    SELECT 'reviews', COUNT(*)::int
    FROM reviews rv
    LEFT JOIN orders o ON o.id = rv.order_id
    WHERE rv.order_id IS NOT NULL AND o.id IS NULL
    UNION ALL
    SELECT 'promo_code_usages', COUNT(*)::int
    FROM promo_code_usages pu
    LEFT JOIN orders o ON o.id = pu.order_id
    WHERE o.id IS NULL
    UNION ALL
    SELECT 'chat_messages', COUNT(*)::int
    FROM chat_messages cm
    LEFT JOIN orders o ON o.id = cm.order_id
    WHERE o.id IS NULL
    UNION ALL
    SELECT 'notifications', COUNT(*)::int
    FROM notifications n
    LEFT JOIN orders o ON o.id::text = n.data->>'orderId'
    WHERE n.data->>'orderId' IS NOT NULL AND o.id IS NULL
  ) dangling
  ORDER BY source
`;

const SAFE_REPAIR_QUERY = `
  SELECT
    o.id,
    o.reference
  FROM orders o
  WHERE o.status = 'pending'
    AND o.created_at < NOW() - INTERVAL '24 hours'
    AND o.driver_id IS NULL
    AND EXISTS (SELECT 1 FROM users u WHERE u.id = o.user_id)
    AND EXISTS (SELECT 1 FROM restaurants r WHERE r.id = o.restaurant_id)
    AND NOT EXISTS (SELECT 1 FROM order_items oi WHERE oi.order_id = o.id)
    AND NOT EXISTS (SELECT 1 FROM refunds rf WHERE rf.order_id = o.id)
    AND NOT EXISTS (SELECT 1 FROM reviews rv WHERE rv.order_id = o.id)
    AND NOT EXISTS (SELECT 1 FROM promo_code_usages pu WHERE pu.order_id = o.id)
    AND NOT EXISTS (SELECT 1 FROM chat_messages cm WHERE cm.order_id = o.id)
    AND NOT EXISTS (
      SELECT 1
      FROM notifications n
      WHERE n.data->>'orderId' = o.id::text
    )
  ORDER BY o.created_at ASC, o.id ASC
  FOR UPDATE
`;

const APPLY_CONFIRMATION = "REVIEWED_ORPHAN_ORDER_REPORT";
const DEFAULT_MAX_REPAIRS = 25;

type AuditRow = OrderAuditSnapshot & {
  id: number;
  reference: string | null;
  updatedAt: Date;
};

function isApplyMode(): boolean {
  return process.argv.includes("--apply");
}

function maxRepairs(): number {
  const raw = process.env.ORPHAN_ORDER_CLEANUP_MAX_ROWS;
  if (raw === undefined) return DEFAULT_MAX_REPAIRS;
  const parsed = Number(raw);
  if (!Number.isInteger(parsed) || parsed < 1 || parsed > DEFAULT_MAX_REPAIRS) {
    throw new Error(`ORPHAN_ORDER_CLEANUP_MAX_ROWS must be an integer between 1 and ${DEFAULT_MAX_REPAIRS}`);
  }
  return parsed;
}

function ensureApplyGuardrails(): void {
  if (process.env.ORPHAN_ORDER_CLEANUP_CONFIRM !== APPLY_CONFIRMATION) {
    throw new Error(
      `Refusing --apply. Set ORPHAN_ORDER_CLEANUP_CONFIRM=${APPLY_CONFIRMATION} only after reviewing the dry-run report.`,
    );
  }
  if (
    process.env.NODE_ENV === "production" &&
    process.env.ORPHAN_ORDER_CLEANUP_ENV !== "production"
  ) {
    throw new Error(
      "Refusing production mutation without ORPHAN_ORDER_CLEANUP_ENV=production.",
    );
  }
}

function issueCounts(rows: Array<AuditRow & { issues: OrphanOrderIssue[] }>): Map<string, number> {
  const counts = new Map<string, number>();
  for (const row of rows) {
    for (const issue of row.issues) counts.set(issue, (counts.get(issue) ?? 0) + 1);
  }
  return counts;
}

function ageHours(createdAt: Date | string, now = new Date()): number {
  return Math.max(0, Math.round(((now.getTime() - new Date(createdAt).getTime()) / (60 * 60 * 1000)) * 10) / 10);
}

function printReport(
  rows: Array<AuditRow & { issues: OrphanOrderIssue[] }>,
  danglingRelations: Array<{ source: string; row_count: number }>,
): void {
  console.log("Orphan order audit (dry-run by default)");
  console.log("Criteria: missing customer/restaurant, empty order, missing assigned driver, active delivery without driver.");
  console.log("Historical menu-item references are reported separately and are not deletion candidates.");
  console.log(`Orders scanned: ${rows.length}`);

  const counts = issueCounts(rows);
  if (counts.size === 0) {
    console.log("Order anomalies: none");
  } else {
    console.log("Order anomalies:");
    for (const [issue, count] of counts) console.log(`- ${issue}: ${count}`);
    console.log("Order anomaly details:");
    for (const row of rows.filter((candidate) => candidate.issues.length > 0)) {
      console.log(JSON.stringify({
        id: row.id,
        reference: row.reference,
        status: row.status,
        createdAt: row.createdAt,
        ageHours: ageHours(row.createdAt),
        userId: row.userId,
        restaurantId: row.restaurantId,
        driverId: row.driverId,
        itemCount: row.itemCount,
        issues: row.issues,
        related: {
          refunds: row.refundCount,
          reviews: row.reviewCount,
          promoUsages: row.promoUsageCount,
          chatMessages: row.chatMessageCount,
          notifications: row.notificationCount,
        },
      }));
    }
  }

  const nonZeroDangling = danglingRelations.filter((relation) => relation.row_count > 0);
  if (nonZeroDangling.length === 0) {
    console.log("Dangling order-related records: none");
  } else {
    console.log("Dangling order-related records:");
    for (const relation of nonZeroDangling) {
      console.log(`- ${relation.source}: ${relation.row_count}`);
    }
  }
}

async function run(): Promise<void> {
  const apply = isApplyMode();
  if (apply) ensureApplyGuardrails();

  const client = await pool.connect();
  try {
    const auditResult = await client.query<AuditRow>(AUDIT_QUERY);
    const rows = auditResult.rows.map((row) => ({
      ...row,
      issues: classifyOrphanOrder(row),
    }));
    const danglingResult = await client.query<{ source: string; row_count: number }>(
      DANGLING_RELATIONS_QUERY,
    );
    printReport(rows, danglingResult.rows);

    if (!apply) {
      console.log("No data was changed. Use --apply only after reviewing this report.");
      return;
    }

    const limit = maxRepairs();
    await client.query("BEGIN");
    try {
      const candidates = await client.query<{ id: number; reference: string | null }>(
        SAFE_REPAIR_QUERY,
      );
      if (candidates.rows.length > limit) {
        throw new Error(
          `Refusing to repair ${candidates.rows.length} rows; limit is ${limit}. Review the report and run in smaller batches.`,
        );
      }

      const repairIds = candidates.rows.map((candidate) => candidate.id);
      if (repairIds.length === 0) {
        await client.query("COMMIT");
        console.log("No automatically repairable orders found. Manual-review anomalies were left unchanged.");
        return;
      }

      const repaired = await client.query<{ id: number; reference: string | null }>(
        `
          UPDATE orders
          SET status = 'cancelled', updated_at = NOW()
          WHERE id = ANY($1::int[])
            AND status = 'pending'
          RETURNING id, reference
        `,
        [repairIds],
      );
      await client.query("COMMIT");
      console.log(`Safely repaired ${repaired.rows.length} empty pending order(s) by preserving them as cancelled.`);
      for (const row of repaired.rows) console.log(JSON.stringify(row));

      const postRepair = await client.query<AuditRow>(AUDIT_QUERY);
      const remainingIssues = postRepair.rows.reduce(
        (total, row) => total + (classifyOrphanOrder(row).length > 0 ? 1 : 0),
        0,
      );
      console.log(`Post-repair verification: ${remainingIssues} order(s) still require review.`);
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    }
  } finally {
    client.release();
    await pool.end();
  }
}

run().catch((error) => {
  console.error("[orphan-order-audit] failed:", error instanceof Error ? error.message : error);
  process.exitCode = 1;
});