---
name: YouTube Shorts WebView embeds
description: YouTube player error 153 behavior when Shorts are embedded in the native mobile WebView.
---

When embedding YouTube Shorts inside the native React Native WebView, provide an explicit YouTube embed origin and referrer context. A local HTML document loaded without a base URL can be treated as `about:blank`, and YouTube may reject the player with error 153 even when the video ID is valid.

**Why:** YouTube's embedded player requires client identification through origin/referrer context; native WebViews do not automatically provide the same browser context as a normal hosted webpage.

**How to apply:** Keep `origin` and `widget_referrer` on the embed URL, set a YouTube `baseUrl` when loading HTML into the native WebView, and include an explicit referrer policy on the iframe. For JavaScript-only changes, publish an OTA update to the matching EAS channel; a new native binary is not required.

The native sound toggle must send the YouTube IFrame commands after the player is loaded, and should send `unMute`, `setVolume(100)`, and `playVideo` together; a single early `unMute` message can be ignored silently by WebView embeds.

**Why:** The Shorts UI starts videos muted for autoplay, and native WebView timing differs from a normal browser iframe.

**How to apply:** Keep the sound bridge retryable on player load and reset sound when a Short becomes inactive; preserve the direct-video `muted`/`play()` path separately.