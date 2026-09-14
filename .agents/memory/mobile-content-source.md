---
name: Mobile content source
description: Home mobile content and section navigation must use admin/API data rather than local sample content.
---

The mobile Home must treat the dashboard/API as the source of truth for section configuration, category labels, links, products, restaurants, media, and metadata. Local code may provide presentation states, but must not fabricate live content or route to a generic substitute.

**Why:** The product owner explicitly requires real operational content in the mobile app and wants each section arrow to open the corresponding filtered backend content.

**How to apply:** Read section titles, order, visibility, limits, and sources from the public app config; use API-backed category slugs and filtered endpoints for navigation; show a neutral empty/loading state when data is missing instead of inventing values.

For merchant sections, preserve the API's business-type boundaries: Restauration uses `restaurant`, Boutiques uses `shop`, and explicitly general sections such as Recommandé may combine business types.

**Why:** Mixing merchant types in a named Home section makes category navigation misleading and sends users to the wrong catalog.

**How to apply:** Prefer the server's `businessType` query filter for section feeds and use the same filter on the section detail route opened by its header.