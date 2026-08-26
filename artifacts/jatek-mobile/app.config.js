/**
 * Dynamic Expo config — extends the static app.json with build-time values.
 *
 * Why this file exists:
 *   app.json cannot read environment variables, so OTA update channels cannot
 *   be set statically. EAS injects EAS_UPDATE_CHANNEL at build time (it equals
 *   the build profile's `channel` field in eas.json). We forward that value to
 *   `updates.channel` here so that `eas update --channel <name>` targets the
 *   correct APKs already on drivers' phones — no new native build required.
 *
 * OTA deployment cheat-sheet:
 *   Preview channel (internal testers / beta APK):
 *     eas update --channel preview --message "fix: describe what changed"
 *
 *   Production channel (Play Store AAB / sideloaded production APK):
 *     eas update --channel production --message "fix: describe what changed"
 *
 *   Both commands push JS bundle changes instantly to all installed APKs on
 *   that channel. A new native build (eas build) is only needed when you
 *   change native modules, app.json native fields, or update the Expo SDK.
 */

// eslint-disable-next-line @typescript-eslint/no-var-requires
const baseConfig = require("./app.json");

/** Channel injected by EAS at build time. Falls back to "development" locally. */
const easChannel = process.env.EAS_UPDATE_CHANNEL ?? "development";

/** @type {import('@expo/config').ExpoConfig} */
module.exports = {
  ...baseConfig.expo,
  updates: {
    // EAS Update endpoint — same project ID as eas.json
    url: "https://u.expo.dev/d30cddea-9dd6-42aa-8339-80d86b9ad76e",
    // Channel must match the --channel flag of `eas update` for OTA to land.
    channel: easChannel,
  },
  // appVersion policy: matches the existing installed APKs (built from app.json
  // with runtimeVersion.policy: "appVersion"). Changing this policy would make
  // OTA updates incompatible with already-installed builds — do NOT switch
  // without a coordinated native rebuild on all channels.
  // Runtime version for current builds = "1.0.0" (the `version` field above).
  runtimeVersion: {
    policy: "appVersion",
  },
};
