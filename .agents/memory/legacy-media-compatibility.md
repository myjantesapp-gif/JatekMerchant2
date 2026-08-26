---
name: Legacy media compatibility
description: Production media references may remain on uploads/ after objects have moved into typed App Storage folders.
---

When a storage-folder migration has moved objects but production PostgreSQL still contains `uploads/` paths, API reads should temporarily remap each field to its typed folder (logos, banners, medias, or shorts). Do not guess one universal folder for every legacy path.

**Why:** Production data and deployment code can be updated at different times; returning stale paths creates 404s in already-installed mobile clients even when the replacement objects exist.

**How to apply:** Preserve third-party URLs and database values, verify the target object exists, and keep the remapping until the production migration has completed successfully.