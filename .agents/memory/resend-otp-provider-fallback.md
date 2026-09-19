---
name: Resend OTP sender policy
description: Durable constraint for the single Resend sender domain and credential pair used for email OTP.
---

Email OTP delivery is intentionally pinned to the third Resend credential pair and the exact `ma.jatek.app` sender domain. Other Resend keys or sender values must not be used for OTP.

**Why:** A valid-looking Resend credential can still fail at send time when its sender domain is not verified. Using one known project/domain pair avoids accidentally mixing credentials across Resend projects.

**How to apply:** Configure `RESEND_API_KEY_3` with `RESEND_EMAIL_FROM_3`, and ensure the sender email ends exactly in `@ma.jatek.app`. Do not re-enable the other Resend pairs unless this policy changes explicitly.