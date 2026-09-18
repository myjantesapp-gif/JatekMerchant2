---
name: Mobile SectionList row boundary
description: Defensive handling for two-column SectionList data in the Expo mobile catalog.
---

Virtualized mobile catalog rows are an untrusted boundary. Normalize a row into a validated array before deriving keys or rendering cards; accept a single valid product as a one-item row and skip malformed values.

**Why:** A merchant product screen reached `row.map is not a function` even though the intended grid data was arrays, so a variant SectionList item shape can otherwise crash the whole screen.

**How to apply:** Keep the two-column SectionList, but use a shared row normalizer and safe chunking helper at the catalog boundary. Do not call `.map` directly on the callback item.