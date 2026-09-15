---
name: Mobile preview download
description: Stable APK download behavior for the Jatek mobile Preview artifact.
---

The mobile Preview landing server exposes the tracked Android preview APK through a stable `/mobile/downloads/jatek-preview.apk` route with attachment headers. The web Preview must use its own port because the Expo/Metro workflow can occupy the mobile development port.

**Why:** Serving the APK from the landing server gives users a real downloadable artifact instead of sending them to a generic EAS build list, while separate ports prevent the web Preview from failing with `EADDRINUSE`.

**How to apply:** Keep the landing-page APK URL generated from the current Preview host/base path, and do not reuse the Expo/Metro port for the static web server.

The Expo development preview must use its own port and workflow (`artifacts/jatek-mobile: expo` on port 3000); the static landing/download server remains on port 25896.

**Why:** Reusing port 25896 makes the Preview proxy reach the landing server instead of Metro, while Expo loading requests need the Expo router and platform context.

**How to apply:** Open the Expo workflow preview or scan its QR code; use the web workflow only for the static QR/APK landing page.