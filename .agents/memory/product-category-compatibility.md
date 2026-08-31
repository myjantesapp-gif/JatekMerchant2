---
name: Product category compatibility
description: The structured product-category relationship must remain compatible with legacy name-based clients.
---

The canonical product category is the stable `menuItemCategoryId`, but every product write should also maintain the legacy category name. Reads should preserve both values so older mobile clients can continue filtering and rendering by name.

**Why:** Existing mobile and production data can still depend on category names, while dashboard edits need a scoped, rename-safe relationship.

**How to apply:** Validate IDs against active global or shop-scoped categories, synchronize names on category rename, and do not delete categories that are still referenced by products.