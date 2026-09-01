---
name: App Storage deployment access
description: Deployment identity permissions required for Jatek media reads and writes
---

The official App Storage SDK can still return Google Cloud Storage 403 errors in a deployment when the deployment identity lacks access to the managed bucket. This affects both existing media reads and new uploads; changing URL normalization or adding a local fallback does not repair it.

**Why:** Production media requests exposed a missing `storage.objects.get` permission for the deployment service account, while the API code was already using the supported managed-storage client.

**How to apply:** When media returns `STORAGE_PERMISSION_DENIED`, verify the App Storage bucket attached to the app and grant the deployment identity object viewer plus the required write permission, then retest image upload, video upload, and ranged playback.