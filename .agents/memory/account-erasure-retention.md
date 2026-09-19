---
name: Account erasure retention
description: Durable rule for balancing customer erasure with operational and accounting history.
---

Customer account deletion must run as one transaction. Delete personal records that have no retention purpose, and anonymize retained order/accounting history so it can no longer identify the customer.

**Why:** Several historical tables do not depend on the user row through database cascades. Deleting only the user can leave names, addresses, messages, codes, photos, or identifiers behind, while deleting completed orders can break merchant, driver, refund, and accounting history.

**How to apply:** Route every customer-facing deletion endpoint through the same erasure service. When adding a user-linked table, explicitly classify it as deletable or retained-and-anonymized and include it in that transaction.