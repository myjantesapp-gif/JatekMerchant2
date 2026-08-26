---
name: Expo driver workflow port
description: The Expo driver Metro process can run correctly while Replit's port gate never detects its configured web port.
---

The driver Expo workflow should be treated as a console workflow without a `waitForPort` gate; Expo Go/Metro can be ready while no detectable HTTP listener is exposed on the configured port.

**Why:** Repeated restarts with a port gate timed out even though Metro printed its QR code and stayed running. Removing the gate allowed the workflow to remain healthy.

**How to apply:** Keep the driver workflow console-only and validate readiness from its Metro output rather than requiring port 8099.