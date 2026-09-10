---
name: Android opaque status bar
description: How to keep the Jatek system status area opaque across Android edge-to-edge behavior and OTA updates.
---

Recent Android edge-to-edge behavior can ignore the requested status-bar background and translucency settings even when the system icons use the requested dark style. Keep a real, non-interactive view behind the top safe-area inset in the root render tree, in addition to the native status-bar configuration.

**Why:** The status area remained transparent on a real mobile installation after changing only the status-bar component. A rendered safe-area backdrop is delivered through OTA, while native edge-to-edge settings apply only after users install a new binary.

**How to apply:** Any root-layout or header redesign must preserve the opaque safe-area backdrop. Configure future native builds with a white, non-translucent Android status bar and edge-to-edge disabled, but do not rely on those native values for an OTA-only fix.