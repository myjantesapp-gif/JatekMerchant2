---
name: Production database pause
description: Replit production database inactivity pauses can surface as API 500s with an endpoint-disabled PostgreSQL error.
---

When production auth or signup requests fail with PostgreSQL error code 28000 and “The endpoint has been disabled,” check the Replit Database tool before changing application code. The production database may be frozen due to inactivity; unpause the Production database in the Project Editor and retry the request.

**Why:** The API can be healthy while every database-backed route fails, including OTP rate-limit reads, and the generic API error hides the infrastructure cause.

**How to apply:** Confirm with a read-only production database check. If it reports that the production database is frozen, unpause it in Replit; only investigate `DATABASE_URL` conflicts or application code if the database remains unavailable afterward.