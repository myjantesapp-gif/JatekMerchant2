---
name: Home config normalization
description: Public Home configuration may be partial on older deployments and must be completed client-side before rendering.
---

The mobile Home must merge the public app configuration with the complete section/order defaults before rendering. API values remain authoritative; defaults only fill missing entries.

**Why:** Older production API responses can contain only the sections explicitly saved in the dashboard, which otherwise makes the mobile Home silently lose valid sections.

**How to apply:** Normalize `homeOrder` and `homeSections` at the API boundary, preserve configured order first, append missing known sections, and keep all live content sourced from API queries.