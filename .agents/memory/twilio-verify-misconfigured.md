---
name: Twilio Verify SID misconfigured
description: Twilio Verify requires a VA service SID plus credentials from the same Twilio account.
---

## The rule
A valid Twilio Verify setup needs a `TWILIO_VERIFY_SID` beginning with `VA`, an Account SID beginning with `AC`, and either a matching API Key SID/secret pair (`SK…` plus its secret) or the legacy Auth Token. The Verify service and API key must belong to the same Twilio account or subaccount.

**Why:** Correct prefixes only prove the values have the expected shape. Twilio returns HTTP 401/code 20003 when the key-secret pair is wrong, revoked, or paired with a different Account SID; Verify may then return 401/code 70051.

## Fix required (ops, not code)
Regenerate or re-copy the API Key SID and its secret together from the Twilio console, confirm the Account SID is from the same account, and confirm the Verify Service SID is from that account. Do not paste credentials into chat.

## How to apply
- Run `artifacts/api-server/scripts/test-twilio-config.mjs` to validate Account and Verify access without sending an OTP.
- Add `--send-whatsapp +212...` only for an intentional delivery test.
