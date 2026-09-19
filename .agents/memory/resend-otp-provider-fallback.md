---
name: Resend OTP provider fallback
description: Durable constraint for email OTP delivery when Resend sender domains or provider projects change.
---

Email OTP delivery must not depend on one Resend API key and sender pair. Resend can accept the credentials but reject delivery with HTTP 403 when the sender domain is not verified, so configured fallback pairs should be tried before returning a generic delivery error.

**Why:** A valid-looking primary configuration can still fail at send time because domain verification belongs to the Resend project and sender identity, not only to the API key.

**How to apply:** When changing OTP delivery configuration, keep the primary and fallback API key/sender pairs aligned where possible, and verify the sender domain in the corresponding Resend project before removing the fallback.