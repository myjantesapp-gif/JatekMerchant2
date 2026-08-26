---
name: OpenAPI Zod codegen compatibility
description: Compatibility constraint between the generated Zod client and the workspace's Zod runtime.
---

Orval versions that generate the API validators emit Zod 4 helpers such as `int()`, `email()`, and `url()`, but the workspace currently depends on Zod 3.

**Why:** Regeneration otherwise produces validator code that does not type-check against the installed Zod API.

**How to apply:** Keep the small compatibility adapter that maps those helpers to Zod 3 equivalents whenever generated Zod output is refreshed; URI fields require the `url()` mapping too. Treat a dependency or generator upgrade as the preferred long-term resolution.