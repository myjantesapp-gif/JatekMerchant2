---
name: Expo Android push credentials
description: The non-obvious credential requirements for delivering Android notifications through Expo Push Service.
---

Expo Android builds and Expo Push Service use different credential paths. The app's `google-services.json` is needed by the native Android build, but remote notifications also require a valid FCM v1 service-account credential configured for the Expo/EAS project. Without it, Expo may accept the HTTP request and return a per-recipient `InvalidCredentials` ticket error.

**Why:** A successful EAS build and a registered `ExponentPushToken[...]` do not prove that Android remote delivery is configured. The failure occurs after token registration, inside Expo's FCM handoff.

**How to apply:** When Android Expo pushes fail with `InvalidCredentials` or an FCM server-key message, configure or repair the project's FCM v1 credential in EAS/Firebase before changing the mobile token-registration flow. Treat per-ticket errors as delivery failures even when the Expo API returns HTTP 200.