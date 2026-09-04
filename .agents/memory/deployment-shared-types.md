---
name: Deployment shared type declarations
description: Build ordering required when workspace packages emit ignored declaration files used by dependent TypeScript projects.
---

Production builds must compile shared workspace declaration packages before type-checking dependent applications. A cached or pre-existing ignored dist directory can otherwise expose stale types during publishing even when the source is correct.

**Why:** The deployment environment type-checked the API against stale database declarations and rejected fields that already existed in the source schema.

**How to apply:** Keep the production build script explicit about shared-package compilation before app typechecks; verify the full production script after changes rather than relying only on a local incremental typecheck.