---
name: Driver delivery OTP lifecycle
description: Rules for making driver delivery confirmation authoritative, single-use, and safe to reconcile after network failures.
---

The delivery OTP must be consumed in the same conditional database update that changes the order to `delivered`. A retry after a committed delivery is a conflict, not a success; client reconciliation is reserved for timeout or server/network failures where the commit may have succeeded unseen.

**Why:** Treating every confirmation error as reconcilable can turn an invalid or already-used code into a false delivery success and leave the driver with misleading state.

**How to apply:** Keep format, expiry, wrong-code, and used-code errors distinguishable; preserve the modal on recoverable errors; stop active tracking only after an authoritative delivered/cancelled state.