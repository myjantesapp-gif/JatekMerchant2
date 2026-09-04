---
name: Native category sticky headers
description: Reliable pattern for category navigation bars over long mobile catalog pages.
---

For long catalog screens containing a horizontal category ScrollView, use an explicit overlay that appears when the bar reaches the top instead of relying only on native sticky-header indices.

**Why:** Nested horizontal ScrollViews can prevent `stickyHeaderIndices` from behaving consistently across iOS, Android, and React Native Web, and section tracking can fail at the same time.

**How to apply:** Record the category bar and section layout positions, toggle the overlay from the vertical scroll offset, and derive the active category from the section nearest the fixed bar. Keep the overlay below the safe-area inset with a small breathing gap, and include that gap in the pin threshold.