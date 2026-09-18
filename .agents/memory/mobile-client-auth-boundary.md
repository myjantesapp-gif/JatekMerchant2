---
name: Mobile client authentication boundary
description: The shared auth API distinguishes the customer mobile app with an explicit client header.
---

The mobile app sends `X-Client: mobile` on login, OTP send, and OTP verification. The API rejects every non-customer role for those requests, while backend staff authentication remains separate and unrestricted.

**Why:** The same product ecosystem serves customer, driver, merchant, and dashboard flows; blocking elevated roles globally would break operational clients.

**How to apply:** Preserve the header on any new mobile authentication flow and keep a client-side customer-role guard as defense in depth.