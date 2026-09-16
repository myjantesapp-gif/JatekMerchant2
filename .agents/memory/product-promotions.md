---
name: Product promotion pricing
description: The durable price semantics used by shop-specific product promotions.
---

An active product promotion stores the promotional amount in `price` and the original catalogue amount in `compareAtPrice`. Removing the promotion restores `price` from `compareAtPrice` and clears the comparison value.

**Why:** The existing mobile catalog already renders `price` and `compareAtPrice`; this preserves that public contract while allowing each shop’s product row to be managed from the dashboard.

**How to apply:** Any future product-price mutation must preserve the original catalogue price while a promotion is active, reject non-numeric or non-discounting promo prices, and avoid silently treating invalid input as zero.