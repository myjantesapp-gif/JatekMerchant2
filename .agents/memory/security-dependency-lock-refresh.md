---
name: Security dependency lock refresh
description: Workspace behavior when pnpm security overrides introduce package versions absent from the local store.
---

After changing pnpm overrides to remediate vulnerabilities, a lockfile-only update can succeed while the existing node_modules tree still points at missing package tarballs. An offline frozen install may then fail even though the lockfile is valid.

**Why:** The workspace package firewall/store does not guarantee that a newly selected safe version is cached locally.

**How to apply:** Refresh dependencies once with normal registry access before running offline or full workspace typechecks; do not treat an offline missing-tarball error as a lockfile or code regression.