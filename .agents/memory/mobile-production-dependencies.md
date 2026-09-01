---
name: Mobile production dependency completeness
description: Non-obvious dependency rule for the combined Jatek publication build.
---

The Jatek production build bundles the customer Expo app before starting the API. With the custom pnpm/Metro resolver, a native Expo module required by another Expo package may resolve in development but fail in the publication bundle unless it is declared directly in the mobile workspace.

**Why:** A publishing attempt failed during Expo bundling because `expo-notifications` imported `expo-application`, while the customer mobile workspace did not declare `expo-application` directly. The API and dashboard builds were unaffected.

**How to apply:** When adding or upgrading Expo packages, verify both iOS and Android bundles with `bash scripts/build-production.sh`, and add any required native Expo module to `artifacts/jatek-mobile/package.json` using the Expo SDK-compatible version.