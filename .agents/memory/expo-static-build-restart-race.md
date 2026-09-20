---
name: Expo static-build restart race
description: Workflow ordering needed when the mobile web static build and Expo Metro share generated directories.
---

Restarting the mobile web workflow and the Expo workflow at the same time can make Metro watch a deleted `static-build` directory and exit with ENOENT. Wait for the web build to finish, then restart Expo on its own.

**Why:** The web preview clears and recreates generated static-build directories while Expo scans the workspace for changes.

**How to apply:** After mobile code changes, restart the web workflow first when a full bundle rebuild is needed; once it is serving, restart `artifacts/jatek-mobile: expo` separately.