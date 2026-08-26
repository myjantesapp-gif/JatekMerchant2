---
name: Twilio Verify SID misconfigured
description: The TWILIO_VERIFY_SID secret is set but has an invalid value (doesn't start with "VA"), so Twilio Verify is skipped entirely on every boot.
---

## The issue
`TWILIO_VERIFY_SID` is set in the environment but its value starts with something other than `"VA"` (the startup warning shows `"m9vl…"`). A valid Twilio Verify Service SID always begins with `VA`.

**Effect:** Twilio Verify is bypassed at startup. Every WhatsApp OTP falls through to the legacy direct-Twilio + Infobip path, which also fails → users get 502 "Impossible d'envoyer le code".

## Fix required (ops, not code)
The operator must replace `TWILIO_VERIFY_SID` in Replit Secrets with the correct `VA…` SID from the Twilio console (Verify → Services → the relevant service's SID).

## How to apply
- On any boot, a startup warning is logged: `[OTP] TWILIO_VERIFY_SID="…" does not start with "VA" — Twilio Verify will be skipped.`
- The OTP diagnostic endpoint (`GET /api/auth/otp-diagnostic`) now includes `providers.twilioVerify.status` = `"misconfigured"` with a notes array explaining the issue.
- Code-side this is already handled correctly; no code change needed, only the secret value.
