---
name: Expo tunnel availability
description: Android preview can be blocked by Expo's tunnel provider even when the app and Metro build are healthy.
---

When the Expo workflow fails with `Cannot read properties of undefined (reading 'body')` immediately after `Starting Metro Bundler`, treat it as an Ngrok tunnel availability failure rather than an application compilation failure.

**Why:** API, dashboard, and mobile typechecks can all succeed while Expo CLI exits before exposing the tunnel; retrying the workflow may not repair an upstream tunnel outage.

**How to apply:** Verify builds and app workflows separately, retry the Expo workflow once, and report the tunnel as an external blocker if the same error persists. Do not change the mobile application code to work around this failure.