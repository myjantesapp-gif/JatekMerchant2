---
name: Mobile production Expo project
description: The published mobile landing server must resolve Expo manifests from the same EAS project and channel as the Android preview build.
---

The production mobile server must keep its manifest fallback project ID and channel aligned with `eas.json` and the static Expo config in `app.json`. A stale fallback can make `/mobile/` look available while the Android manifest returns an EAS error or loads a different project.

**Why:** The published deployment did not inject the mobile build project variables, so its old fallback pointed to a different Expo project than the current Android preview build.

**How to apply:** When changing Expo accounts, project IDs, or preview channels, verify `/mobile/` with Android Expo headers and verify the production page/QR after publishing. Keep the app config static because dynamic Expo config breaks the managed Android build flow.

On 2026-08-20, the driver Preview build was rejected before compilation because its configured Expo project ID no longer existed for the build account. Restore or relink the project deliberately; do not replace project IDs speculatively, since the deployed manifest and build channel must remain aligned.

Production iOS builds also require a validated remote Apple distribution credential; EAS non-interactive builds stop at credential setup when the certificate is missing or invalid.

**Why:** A configured iOS production profile and valid Expo project are not sufficient to create a TestFlight build without Apple signing credentials.

**How to apply:** Before attempting a non-interactive iOS build, validate the existing remote credentials interactively or through the approved App Store Connect/EAS setup; do not report TestFlight readiness as submission success.