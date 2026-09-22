---
name: Legal content configuration
description: Mobile legal documents are public app configuration managed from the dashboard.
---

Legal documents belong in the `app_config` `legalContent` object and are validated by the API before public exposure. The mobile legal screens must fetch this object instead of embedding document text.

**Why:** Legal, privacy, cookie, and terms content must be changeable without shipping a new mobile bundle.

**How to apply:** Add or edit documents through the dashboard app-config editor; keep server defaults only as initialization/repair values and persist the initial object when the public config is first read.

Persisted `legalContent` is validated as one complete object, so an invalid legacy `mentions` or `cookies` document makes the API fall back to all defaults, including otherwise valid newly imported terms and privacy documents.

**Why:** The API parses the four-document object together before exposing any public legal content.

**How to apply:** After importing one legal document, validate the complete stored object and repair legacy platform-specific text rather than assuming untouched sibling documents are valid.