---
name: Expo project authorization
description: Expo MCP connection health versus project-level build authorization for Jatek.
---

Expo build operations can fail with `Entity not authorized` for the Jatek project even after the Expo MCP connection is attached and reports healthy OAuth status.

**Why:** The connection and the Expo project ACL are separate. Retrying build/list calls or changing from the project ID to `@jatekapp/jatek` does not repair a project-level permission mismatch.

**How to apply:** Before retrying mobile OTA or native builds, confirm that the connected Expo account can read project `73e947fb-0a5a-4064-aafe-c856e231c9d4` and that the Git ref contains the intended mobile commits.