---
name: Jatek target architecture
description: Project-wide product identity and engineering constraints for future Jatek ecosystem changes.
---

Treat Jatek as a scalable food, grocery, and boutique delivery ecosystem. Mobile work should use React Native with Expo, native-quality splash behavior, optimized navigation, remote API-driven menu ordering, and reliable local fallbacks. Backend work should use typed Node.js/Express REST endpoints with PostgreSQL as the system of record. `/api/v1/`, Redis, Socket.io, real-time inventory/tracking, and synchronized push notifications are target architecture; migrate toward them deliberately without breaking existing `/api/` clients.

**Why:** The user defined these as global ecosystem guidelines. Some target components are not necessarily present in the current implementation, so treating the framework as an immediate claim about deployed infrastructure would be unsafe.

**How to apply:** Prefer strict runtime validation, comprehensive TypeScript, defensive array and `SectionList` handling, error boundaries, and explicit failure states. Preserve Jatek magenta and teal branding, precise splash animations, and local fallback behavior. Introduce versioned routes or new real-time infrastructure only through compatibility-preserving migrations.