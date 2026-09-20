---
name: Mobile Shorts feed pagination
description: Contract for loading the complete active Shorts feed in the customer mobile app.
---

The public Shorts endpoint supports cursor pagination and older clients may still receive a capped array response. The mobile client must request pages and merge them, while retaining the array fallback for compatibility. Home should not truncate the active Shorts rail when the product requirement is to show all uploaded content.

**Why:** The default endpoint response and the Home section limit can hide active Shorts even when their App Storage images are healthy and return HTTP 200.

**How to apply:** Use the paginated `/api/shorts?limit=50&cursor=...` contract in mobile data hooks, and verify both item count and media URLs when diagnosing missing Shorts.