#!/usr/bin/env bash
# Smoke-test the static Jatek mobile preview after its Expo build completes.
#
# The test exercises the exact public contract: landing page, build health,
# Android manifest, launch bundle, and every manifest asset URL.
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
APP_DIR="$ROOT_DIR/artifacts/jatek-mobile"
SERVER_ENTRY="$APP_DIR/server/serve.js"

fail() {
  echo "[mobile-smoke] FAIL: $*" >&2
  exit 1
}

[ -f "$SERVER_ENTRY" ] || fail "missing $SERVER_ENTRY"

if [ "${MOBILE_SMOKE_REBUILD:-0}" = "1" ]; then
  echo "[mobile-smoke] Rebuilding from an empty static-build directory..."
  rm -rf "$APP_DIR/static-build"
  BASE_PATH=/mobile/ pnpm --filter @workspace/jatek-mobile run build
fi

node - "$APP_DIR" <<'NODE'
const path = require("path");
const appDir = process.argv[2];
const { validateStaticBuild } = require(path.join(appDir, "server", "build-check"));
const result = validateStaticBuild({
  staticRoot: path.join(appDir, "static-build"),
  basePath: "/mobile",
});

if (!result.ok) {
  console.error(result.errors.join("\n"));
  process.exit(1);
}
NODE

PORT="$(node -e 'const s=require("net").createServer();s.listen(0,()=>{const p=s.address().port;s.close(()=>console.log(p));});')"
LOG_FILE="$(mktemp -t mobile-smoke-XXXXXX.log)"
URL_LIST="$(mktemp -t mobile-urls-XXXXXX.txt)"

cleanup() {
  if [ -n "${SERVER_PID:-}" ] && kill -0 "$SERVER_PID" 2>/dev/null; then
    kill -TERM "$SERVER_PID" 2>/dev/null || true
    wait "$SERVER_PID" 2>/dev/null || true
  fi
  rm -f "$LOG_FILE" "$URL_LIST"
}
trap cleanup EXIT

BASE_PATH=/mobile PORT="$PORT" node "$SERVER_ENTRY" >"$LOG_FILE" 2>&1 &
SERVER_PID=$!

for _ in $(seq 1 30); do
  if curl -fsS --max-time 2 "http://127.0.0.1:$PORT/status" >/dev/null; then
    break
  fi
  if ! kill -0 "$SERVER_PID" 2>/dev/null; then
    cat "$LOG_FILE" >&2
    fail "preview server exited before becoming healthy"
  fi
  sleep 0.5
done

curl -fsS --max-time 10 "http://127.0.0.1:$PORT/mobile/status" >/dev/null ||
  fail "GET /mobile/status did not report a ready static build"

curl -fsS --max-time 10 "http://127.0.0.1:$PORT/mobile/" |
  grep -q "<title>Jatek</title>" ||
  fail "GET /mobile/ did not return the Jatek landing page"

MANIFEST_FILE="$(mktemp -t mobile-manifest-XXXXXX.json)"
curl -fsS --max-time 10 \
  -H "expo-platform: android" \
  "http://127.0.0.1:$PORT/mobile/manifest" >"$MANIFEST_FILE"

node - "$APP_DIR" "$MANIFEST_FILE" <<'NODE' >"$URL_LIST"
const path = require("path");
const appDir = process.argv[2];
const manifestPath = process.argv[3];
const manifest = JSON.parse(require("fs").readFileSync(manifestPath, "utf8"));
const { getBundleAssetUrls } = require(path.join(appDir, "server", "build-check"));
const launchUrl = manifest.launchAsset?.url;

if (!launchUrl) {
  throw new Error("Android manifest has no launch asset");
}

const launchPath = new URL(launchUrl).pathname;
const bundlePath = path.join(
  appDir,
  "static-build",
  launchPath.replace(/^\/mobile\//, ""),
);
const urls = [
  launchUrl,
  ...(manifest.assets || []).map((asset) => asset?.url),
  ...getBundleAssetUrls(bundlePath),
].filter(Boolean);

for (const value of urls) {
  const url = new URL(value);
  if (!url.pathname.startsWith("/mobile/")) {
    throw new Error(`Manifest URL does not use /mobile/: ${value}`);
  }
  console.log(url.pathname);
}
NODE

while IFS= read -r asset_path; do
  code="$(curl -sS -o /dev/null -w '%{http_code}' --max-time 20 "http://127.0.0.1:$PORT$asset_path" || true)"
  [ "$code" = "200" ] || fail "GET $asset_path returned HTTP $code"
done <"$URL_LIST"

rm -f "$MANIFEST_FILE"
echo "[mobile-smoke] OK — page, Android manifest, bundle, and assets are reachable."