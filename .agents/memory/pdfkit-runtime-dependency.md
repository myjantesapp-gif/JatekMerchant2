---
name: PDFKit runtime dependency
description: Bundled PDFKit/fontkit output can leave @swc/helpers as an external runtime import.
---

When adding PDFKit to the API server, keep `@swc/helpers` as a direct production dependency because the bundled fontkit output may import it at runtime even when TypeScript compilation succeeds.

**Why:** The API build passed while the workflow failed at startup when Node could not resolve the helper package from the generated bundle.

**How to apply:** After changing PDFKit or its bundling configuration, run both the API build and a clean workflow start, not only the typecheck.