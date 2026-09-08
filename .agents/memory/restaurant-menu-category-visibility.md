---
name: Restaurant menu category visibility
description: Durable rules for global product categories and custom product ordering across admin and customer menus.
---

Global product categories are templates, not universally visible restaurant categories. A restaurant-facing category query should return a global category only when that restaurant has a product linked to the category; legacy products without a category ID may be matched by their stored category name. Restaurant-owned categories remain scoped to their restaurant.

Custom product ordering is stored on the product itself and must be applied consistently in the admin list and the public restaurant menu. Name, price, and creation-date sorting are presentation choices and must not overwrite the saved custom order.

**Why:** Showing every global category in every restaurant creates empty filter tabs, while legacy Jatek products may still lack the newer category foreign key.

**How to apply:** Preserve the ID-first check and only use the name fallback when the product has no category ID. When changing product ordering, update both backend listing and customer menu ordering.