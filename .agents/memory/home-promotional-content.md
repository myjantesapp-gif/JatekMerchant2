---
name: Home promotional content
description: The mobile Home contract for banners and discounted products.
---

The Home Promos section is content-driven: active admin promo or hero ads are rendered first, then bundled campaign artwork is used only when the public ad feed is empty. Promo products come from the recommendations endpoint's promo sort and are eligible only when the current price is below the compare-at price; the dashboard remains the source of truth for those values.

**Why:** The Home must remain useful before content managers publish a campaign, while published banners and product discounts must change without shipping a new mobile binary.

**How to apply:** Keep admin content ahead of local fallbacks, preserve the `compareAtPrice > price` eligibility rule, and keep the existing dashboard ad/product controls instead of introducing a second content store.