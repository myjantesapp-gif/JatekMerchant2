---
name: App Storage deployment access
description: Deployment identity permissions required for Jatek media reads and writes
---

The official App Storage SDK can still return Google Cloud Storage 403 errors in a deployment when the deployment identity has not been refreshed for the managed bucket. This affects both existing media reads and new uploads; changing URL normalization or adding a local fallback does not repair it.

**Why:** Production media requests exposed a missing `storage.objects.get` permission for the deployment service account, while the API code was already using the supported managed-storage client.

**How to apply:** When media returns `STORAGE_PERMISSION_DENIED`, verify that the sidecar-resolved default bucket matches the project’s configured App Storage bucket. Replit manages the deployment identity’s viewer/writer permissions automatically; if development access works but the published app still fails, republish to refresh the deployment environment, then retest image upload, video upload, and ranged playback.

Confirm which deployment owns the live custom domain before restoring an archive or changing its storage target.

**Why:** The live Jatek domain returned catalog data while this workspace's deployment metadata named another domain and did not expose a successful corresponding deployment. A workspace default bucket is not proof of the live app's storage identity.

**How to apply:** Treat metadata/domain disagreement as a deployment-identity blocker. Do not restore into a guessed bucket or claim a development restore repaired production; require the intended environment's confirmed default bucket and preserve differing existing objects.