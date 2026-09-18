---
name: Public catalog seed
description: Durable rules for merging Jatek public catalog content across development and production.
---

The public catalog snapshot is a content-only, production-priority merge. Its
import must be explicit, idempotent, and insert-only: it may reuse existing
target rows and an existing admin owner, but must not update or delete catalog,
operational, account, or media data.

**Why:** Publishing the application does not replace an existing production
catalog, while copying production IDs or owner IDs into a cloned environment
can attach public content to the wrong accounts.

**How to apply:** Remap categories by slug, shops by exported match keys,
products by shop plus normalized name, and ads/Shorts by normalized public
content keys. Restore managed media only from a checksum-verified archive
after exporting the target environment's App Storage objects.
