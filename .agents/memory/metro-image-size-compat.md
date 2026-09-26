---
name: Metro image-size compatibility
description: Compatibility rule for Metro when the security override upgrades image-size to version 2.
---

Keep the safe `image-size` override and preload the mobile build’s compatibility adapter into Metro and its workers; the adapter converts file-path inputs to buffers and preserves the expected CommonJS default export.

**Why:** Metro 0.83 passes image file paths to the `image-size` 1.x API, while `image-size` 2 accepts byte arrays. Upgrading transitively for security otherwise makes Expo Router PNG bundling fail during publication.

**How to apply:** Provide the preload through `NODE_OPTIONS` before Expo starts Metro so the CLI and transformer workers inherit it; keep the static launcher's preload too. Test iOS and Android bundles after upgrades before removing it.