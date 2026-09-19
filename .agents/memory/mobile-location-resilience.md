---
name: Mobile location resilience
description: GPS selection must remain usable when reverse geocoding or location services are unavailable.
---

GPS acquisition is the primary operation; reverse geocoding is an optional enhancement. A valid coordinate should still be accepted with a coordinate-string fallback when the geocoding network is unavailable, and disabled services should offer a direct path to system settings. Request foreground permission before checking the device-wide location switch so a fresh native install reaches the OS prompt.

**Why:** Mobile network services and device location providers can fail independently, and treating reverse-geocoding failure as GPS failure made the location picker appear broken.

**How to apply:** Keep native permission/service errors separate from address lookup errors in every mobile location flow. Changes to iOS/Android permission metadata require a new native TestFlight/Android build; an OTA JavaScript update cannot add those entitlements.