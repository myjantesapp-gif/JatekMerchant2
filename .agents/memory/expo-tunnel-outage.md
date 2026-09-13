---
name: Expo tunnel availability
description: Android preview can be blocked by Expo's tunnel provider even when the app and Metro build are healthy.
---

When the Expo workflow fails with `Cannot read properties of undefined (reading 'body')` immediately after `Starting Metro Bundler`, treat it as an Ngrok tunnel availability failure rather than an application compilation failure.

**Why:** API, dashboard, and mobile typechecks can all succeed while Expo CLI exits before exposing the tunnel; retrying the workflow may not repair an upstream tunnel outage.

**How to apply:** Verify builds and app workflows separately. If Ngrok keeps failing, the Replit Expo proxy can serve Metro with LAN mode instead; verify the public Expo domain returns the Jatek manifest, not the sibling driver app. Keep Metro separate from the static download server. Do not change application UI to repair a transport failure.

Managed artifact workflows cannot be overridden with configureWorkflow, and artifact.toml rejects direct edits. When only the launch command needs changing, update the existing package script consumed by the managed service rather than creating a duplicate workflow.

**Why:** The proxy successfully served Jatek after Ngrok failed before startup; a running sibling Expo service alone did not establish that the public domain served the correct app.