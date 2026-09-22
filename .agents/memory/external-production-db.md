---
name: External production database access
description: Rules for validating the external production PostgreSQL target before any data mutation.
---

When production uses an external PostgreSQL link, verify that endpoint directly before planning a write. A disabled external endpoint may coexist with a reachable Replit-managed production replica that has a different or stale dataset.

**Why:** A read-only managed snapshot with missing parent rows is not evidence that the external operational database is empty, and mutating it can remove records from the wrong target.

**How to apply:** Keep production unchanged when the external endpoint is disabled or the target identity is uncertain. Record the dry-run result and restore access before retrying cleanup.