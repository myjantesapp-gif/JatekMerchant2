---
name: Metro image-size compatibility
description: Compatibility rule for Metro when the security override upgrades image-size to version 2.
---

Keep the safe `image-size` override and preload the mobile build’s compatibility adapter into Metro and its workers; the adapter converts file-path inputs to buffers and preserves the expected CommonJS default export.

**Why:** Metro 0.83 passes image file paths to the `image-size` 1.x API, while `image-size` 2 accepts byte arrays. Upgrading transitively for security otherwise makes Expo Router PNG bundling fail during publication.

**How to apply:** Preserve the preload when changing the static Expo build launcher. If Metro or `image-size` is upgraded, test both iOS and Android production bundles before removing it.