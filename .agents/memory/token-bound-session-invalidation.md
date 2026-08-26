---
name: Token-bound session invalidation
description: Session expiry must be associated with the bearer token that made the rejected request.
---

Only invalidate a persisted session when a 401 or terminal authenticated stream event carries the exact bearer token that is still active.

**Why:** A request, upload, or SSE connection opened before a customer signs in again can fail later. Treating its response as a global logout deletes the newer valid session and makes authentication appear unreliable.

**How to apply:** Capture and pass the request token through every authenticated transport and compare it to the active session token before clearing storage. Serialize session writes and deletes so a profile update cannot recreate a session after logout.