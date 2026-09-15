---
name: Production catalog import
description: Publishing a new build does not replace an existing production database; catalog data needs a separate authorized production import.
---

Replit Publish can deploy the new application build while leaving an already-provisioned production database unchanged. Treat catalog deployment as two separate gates: publish the build, then run the approved production data import and verify live endpoints before assigning a custom domain.

**Why:** A published build was healthy but continued serving the previous catalog until the production data import was performed separately.

**How to apply:** Compare production catalog counts and endpoint payloads with the intended development catalog after every replacement. Do not assign the public custom domain while those values differ.