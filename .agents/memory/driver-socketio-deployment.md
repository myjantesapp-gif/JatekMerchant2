---
name: Driver Socket.IO deployment
description: Realtime driver-client behavior depends on the API domain exposing the Socket.IO upgrade endpoint.
---

The driver client can fall back between API hosts and continue REST polling, but that does not create realtime delivery by itself. The deployed API host must mount Socket.IO at `/socket.io/` on the same HTTP server, authenticate `auth.token`, and bridge the existing event publisher into the driver rooms.

**Why:** A live check showed the current public API host returning the landing HTML for `/socket.io/`, while the workspace API server returned a valid Engine.IO handshake after mounting Socket.IO.

**How to apply:** When publishing the API server or changing the API domain, verify the Socket.IO handshake and deployment routing before diagnosing the mobile client. Keep REST polling as the degraded fallback.