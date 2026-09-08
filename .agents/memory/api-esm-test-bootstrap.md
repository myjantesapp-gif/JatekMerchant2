---
name: API ESM test bootstrap
description: Native ESM API-server tests must resolve source-relative files without CommonJS globals.
---

App-level API tests run TypeScript source through native ESM, not the bundled production wrapper.

**Why:** The production esbuild banner provides `__dirname`, but the `tsx` test runner does not. Importing the real Express app therefore exposes CommonJS-only path code before any route test executes.

**How to apply:** Use `import.meta.url` with `fileURLToPath` for source-relative paths in modules imported by API integration tests; do not rely on `__dirname` being globally available.