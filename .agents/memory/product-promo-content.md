---
name: Product promo content
description: The storage and API decision for dashboard-created product promo cards.
---

Product promo cards are stored as `ads` content with type `promo_product`, rather than as a second promotion table. They carry restaurant/product references, normal and promotional prices, image, display order, and active state; the public ads feed remains the delivery path.

**Why:** The mobile home already consumes the ordered active ads feed, while catalogue price promotions have separate semantics. Reusing content keeps campaign presentation independent from the product’s live catalogue price.

**How to apply:** Keep `promo_product` validation strict (restaurant/product must match and promo price must be lower than normal price), preserve regular banner behavior, and use the existing image upload path.