---
name: Twilio Verify SID misconfigured
description: Twilio Verify requires a VA service SID plus credentials from the same Twilio account.
---

## The rule
A valid Twilio Verify setup needs a `TWILIO_VERIFY_SID` beginning with `VA`, an Account SID beginning with `AC`, and either a matching API Key SID/secret pair (`SK…` plus its secret) or the legacy Auth Token. The Verify service and API key must belong to the same Twilio account or subaccount. A VA-shaped SID can still be wrong: Twilio returns 404/20404 when it belongs to another account or no longer exists.

**Why:** Correct prefixes only prove the values have the expected shape. Twilio returns HTTP 401/code 20003 when the key-secret pair is wrong, revoked, or paired with a different Account SID; Verify may return 404/code 20404 when the service SID is not accessible under that account.

## Fix required (ops, not code)
Select the Verify service SID from the same Twilio account in the console and replace `TWILIO_VERIFY_SID` through the secure secrets flow. The current account has two WhatsApp-capable services named `JATEK ACCOUNT` and `Jatek`; do not reuse an SID from another account. Do not paste credentials into chat.

## How to apply
- Run `artifacts/api-server/scripts/test-twilio-config.mjs` to validate Account and Verify access without sending an OTP; a 404/20404 means the SID is not the service used by the configured account.
- Add `--send-whatsapp +212...` only for an intentional delivery test.
