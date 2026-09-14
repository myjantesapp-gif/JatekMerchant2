---
name: Jatek brand typography
description: The mobile typography decision that keeps copy visually aligned with the Jatek wordmark.
---

The Jatek logo is a raster wordmark and does not embed a reusable font. The mobile app uses Nunito from `@expo-google-fonts/nunito` for all copy, with the six loaded weights 400, 500, 600, 700, 800, and 900. Legacy semantic font names remain aliases so shared components do not need a risky mass rename. Icon font families stay separate.

**Why:** The requested reference style uses Nunito's rounded geometric forms, and a centralized alias/load strategy changes the rendered typeface without risky layout or content refactors.

**How to apply:** Keep font loading blocking before the first app frame; use ExtraBold for section titles and prices, Bold for names/buttons/navigation, and Regular–SemiBold for supporting text. Keep the logo as an image.