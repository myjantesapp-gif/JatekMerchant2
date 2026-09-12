---
name: Jatek brand typography
description: The mobile typography decision that keeps copy visually aligned with the Jatek wordmark.
---

The Jatek logo is a raster wordmark and does not embed a reusable font. The mobile app uses Poppins as the closest bundled brand typeface for all copy, while existing semantic font names remain aliases so shared components do not need a risky mass rename. Icon font families stay separate.

**Why:** The wordmark has a rounded geometric character that is not matched by the previous Inter family, and changing every screen's style key would create unnecessary regression risk.

**How to apply:** Add new text styles using the Poppins weight that matches the hierarchy; keep the existing semantic aliases when touching legacy screens unless a full typography migration is intentionally planned.