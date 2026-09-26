---
name: Jatek mobile plist parsing
description: Keep Expo's Firebase plist parsing compatible with the workspace's safe XML parser.
---

Keep the `@xmldom/xmldom` security override and the narrow `@expo/plist` patch that passes the `text/xml` MIME type to `DOMParser`. Do not downgrade the XML parser to work around Expo plist parsing.

**Why:** Expo reads the bundled Firebase service plist as part of the iOS app configuration, and the pinned parser requires the explicit MIME type.

**How to apply:** Preserve the pnpm patch and lockfile entry when changing the XML parser or Expo plist package. Validate Expo configuration before an iOS build.