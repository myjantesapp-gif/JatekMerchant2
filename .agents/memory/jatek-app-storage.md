---
name: Jatek App Storage access
description: Replit App Storage uploads must resolve the active bucket through the official SDK.
---

Use Replit’s official App Storage SDK for application-managed restaurant, menu, and short media. Resolve the default bucket through the SDK rather than assuming that the deployment-provided storage identifier is writable.

**Why:** The direct GCS client could authenticate but was denied `storage.objects.create` against the bucket named by the deployment environment. The official SDK resolved a writable active bucket and allowed both upload and retrieval.

**How to apply:** Keep database media fields as API object URLs. For a manual bucket import, reference objects under their existing paths (such as `logos/`, `banners/`, `images/`, `medias/`, and `shorts/`) rather than downloading and re-uploading them.