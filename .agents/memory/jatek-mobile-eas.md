---
name: Jatek mobile EAS build setup
description: EAS build quirks for the jatek-mobile pnpm monorepo workspace — config format, pnpm version, CLI path, account.
---

## Rules

1. **Use static `app.json`** — the managed Android build flow requires static Expo configuration; dynamic config files can break cloud builds.

2. **Pin pnpm with EAS's native build-profile field** — every build profile must set `"pnpm": "10.26.1"` (and `"node": "20"`). `PNPM_VERSION` inside `env` does not select the package manager used by EAS's dependency-install step. Keep the root `packageManager` field aligned. The `npm_config_frozen_lockfile` and `pnpm_config_frozen_lockfile` env settings may remain as compatibility guards, but they do not replace the native `pnpm` field.

**Why:** EAS used an older/default pnpm, rejected the valid lockfile as incompatible, then reported `ERR_PNPM_NO_LOCKFILE` under `--frozen-lockfile`.

**How to apply:** Keep the native `pnpm` and `node` fields synchronized across root, Client, and Driver EAS profiles whenever the workspace package-manager version changes.

2b. **Two eas.json files exist** — a repo-root `eas.json` (with `cli.appRoot: artifacts/jatek-mobile`) used by expo.dev GitHub-triggered builds, and `artifacts/jatek-mobile/eas.json` used by local CLI builds. Keep them in sync.

2c. **Resolve the active EAS project from the checked-in static app config.** The Jatek client project has moved accounts more than once; never reuse an older owner, slug, project ID, or token from memory.

3. **EAS CLI is local to jatek-mobile** — run through `scripts/eas-build.sh`, which forces the Jatek project credentials and project ID, using `node_modules/.bin/eas` from `artifacts/jatek-mobile/`.

2d. **Bare workflow runtime version** — because the project contains native Android code, EAS build profiles cannot use the `runtimeVersion` policy object; `app.json` must contain the explicit runtime string matching the app version.

**Why:** EAS rejects `{ "policy": "appVersion" }` after detecting the native `android` directory, before the cloud build starts.

**How to apply:** Keep the explicit `runtimeVersion` aligned with `expo.version` when changing the app version, and update the runtime policy only if the project returns to a managed workflow.

4. **OTA update command** — `EXPO_TOKEN=$EXPO_TOKEN_JATEK node_modules/.bin/eas update --channel preview --message "..." --non-interactive` — bundles both iOS and Android, uploads to EAS.

5. **Remove `--go` from `expo start`** — the app uses `expo-dev-client`, `react-native-keyboard-controller`, `react-native-worklets`, and `expo-notifications`, all of which are custom native modules incompatible with standard Expo Go. `--go` forces Expo Go mode and breaks the dev server. Use `expo start --tunnel` instead.

6. **`serve.js` needs `BASE_PATH=/mobile`** — The production serve script must set `BASE_PATH=/mobile` so routing for `/mobile/` requests works. Without it, every request falls through to `serveStaticFile` and returns 500.

7. **EAS manifest proxy** — When `static-build/` is absent, `serve.js` proxies manifest requests to `https://u.expo.dev/PROJECT_ID`. The dev client sends `expo-platform`, `expo-runtime-version`, `expo-channel-name` headers which are forwarded.

8. **Landing page QR deep-link format** — The QR code uses `exp+jatek://expo-development-client/?url=https%3A%2F%2FHOST%2Fmobile%2F` (not `exps://HOST`). The `expsUrl` in `serveLandingPage` must include `basePath`.

9. **Token access must match the configured owner.** `EXPO_TOKEN_JATEK` must belong to a user or robot with build/update access to the active project owner; an unrelated valid Expo token still fails authorization.

**Why:** Builds have failed both from stale project-ID linkage and from tokens authenticated to an account without access to the configured owner.

**How to apply:** Any time you touch `app.json`, `eas.json`, `serve.js`, or run `eas build`/`eas update`, verify owner/slug/project ID alignment first, then securely replace the project token when the owner changes.
