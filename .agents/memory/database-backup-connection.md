---
name: Database backup connection
description: Replit-managed SQL access can work while the shell pg_dump credentials are stale or invalid.
---

Use the managed database tools to inspect or restore the development database when they report the database as ready. Treat a shell `pg_dump` failure caused by authentication as a connection-configuration problem, not as proof that the database is empty or unavailable.

**Why:** The managed database connection and the workspace shell environment can use different credential state; a local dump may fail even while SQL queries succeed.

**How to apply:** Before manual database changes, rely on the Replit development checkpoint for rollback and only present a file backup after `pg_dump` succeeds and its checksum/file size are verified.