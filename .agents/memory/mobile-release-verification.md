---
name: Mobile release verification
description: Evidence boundaries and rollout ordering for client recommendations and push delivery.
---

Do not treat an accepted Expo ticket, a successful iOS build, or a passing web preview as proof of APNs delivery on TestFlight. Verify receipt and device reception separately.

**Why:** The available Expo connection could not read a successful Replit-managed iOS workflow. Web testing also encountered CORS restrictions against the pinned public API, which do not establish native networking failure.

**How to apply:** Report credential access and native-device evidence gaps explicitly. Publish backend additions before releasing a client that consumes new endpoints. Keep production CORS restrictions intact rather than broadly opening origins to make a development browser test pass.

Recommendations are a catalog selection, not a measured popularity ranking.

**Why:** No validated popularity metric was available when the product cards were requested. Fabricated promotion/popularity badges misrepresent merchant data.

**How to apply:** Use real available catalog products and describe them as recommendations; only claim popularity or promotions with supporting data.