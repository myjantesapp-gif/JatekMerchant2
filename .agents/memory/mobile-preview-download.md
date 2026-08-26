---
name: Mobile preview download
description: Stable APK download behavior for the Jatek mobile Preview artifact.
---

The mobile Preview landing server exposes the tracked Android preview APK through a stable `/mobile/downloads/jatek-preview.apk` route with attachment headers. The web Preview must use its own port because the Expo/Metro workflow can occupy the mobile development port.

**Why:** Serving the APK from the landing server gives users a real downloadable artifact instead of sending them to a generic EAS build list, while separate ports prevent the web Preview from failing with `EADDRINUSE`.

**How to apply:** Keep the landing-page APK URL generated from the current Preview host/base path, and do not reuse the Expo/Metro port for the static web server.