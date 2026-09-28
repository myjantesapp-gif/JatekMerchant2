---
name: Merchant dashboard React Query dedupe
description: Production Vite bundles can duplicate React Query across the merchant app and linked API client workspace package.
---

In the merchant dashboard, configure Vite to deduplicate `@tanstack/react-query` alongside React and React DOM. The app owns the `QueryClientProvider`, while generated hooks in the linked API client import React Query independently.

**Why:** The production bundle included two React Query copies even though both resolved to the same version. Hooks from one copy could not read the provider context created by the other, causing the production dashboard to fail with “No QueryClient set.” Development did not reproduce the failure.

**How to apply:** When a workspace app and linked package both depend on a context-bearing library, inspect the production bundle for duplicates and add that package to Vite's `resolve.dedupe` list if necessary.