---
name: Mobile refresh fan-out
description: Rule for refreshing mobile screens that combine several remote data sources.
---

When a mobile screen refreshes several independent feeds, wait for all requests to settle rather than failing fast on the first rejected request.

**Why:** A secondary feed such as promotions, featured content, or metadata can be temporarily unavailable while the primary list is healthy; fail-fast refreshes leave the user with an unnecessarily incomplete refresh state.

**How to apply:** Keep each query's existing error and retry rendering, use an aggregate refresh indicator for the gesture/button, and use independent refetch calls without changing the API contract.