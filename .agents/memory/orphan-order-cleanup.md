---
name: Safe orphan order cleanup
description: Rules for auditing legacy order references without deleting valid financial or operational history.
---

Order and order-related tables may lack database foreign keys, so orphan audits must validate customer, restaurant, driver, item, refund, review, promotion, chat, and notification references explicitly.

**Why:** A driver deletion can leave historical or active orders pointing to a missing driver. Active orders with missing assignments can require operational recovery, while completed orders may still be valid financial history.

**How to apply:** Keep the audit dry-run by default. Only auto-repair old empty pending orders with no dependent records; leave missing relations, assigned-driver gaps, and historical missing menu items for manual review. Prevent deleting a driver with any order history; deactivate it instead.