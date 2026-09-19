---
name: Password reset OTP security
description: Password reset codes are short-lived, attempt-limited, and stored hashed while retaining legacy-code compatibility.
---

Password-reset OTPs must be hashed at rest, expire after five minutes, allow at most three failed attempts, and accept only passwords of at least eight characters. Verification may temporarily support legacy plaintext reset rows during migration, but all new rows must be hashed.

**Why:** Reset codes are authentication credentials; storing new codes in plaintext or allowing a weaker password policy would undermine the mobile reset flow.

**How to apply:** Keep client and server validation aligned, preserve the one-minute resend limit, and remove the legacy comparison once all old reset rows have expired.