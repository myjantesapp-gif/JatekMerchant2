#!/bin/bash
# Smoke-test the bundled production API server.
#
# Boots the production startup script on random local ports, waits for the API
# and mobile static service, then probes the routes the deployment relies on.
# Any non-200 or a service crash fails the build before it ships.
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SERVER_ENTRY="$ROOT_DIR/artifacts/api-server/dist/index.mjs"
START_SCRIPT="$ROOT_DIR/scripts/start-production.sh"
ADMIN_INDEX="$ROOT_DIR/artifacts/backend-dashboard/dist/public/index.html"
LANDING_INDEX="$ROOT_DIR/artifacts/jatek-landing/dist/public/index.html"

fail() {
  echo "[smoke] FAIL: $*" >&2
  exit 1
}

[ -f "$SERVER_ENTRY" ]  || fail "missing $SERVER_ENTRY — run scripts/build-production.sh first"
[ -f "$START_SCRIPT" ]  || fail "missing $START_SCRIPT"
[ -f "$ADMIN_INDEX" ]   || fail "missing $ADMIN_INDEX — backend-dashboard build did not produce dist/public/index.html"
[ -f "$LANDING_INDEX" ] || fail "missing $LANDING_INDEX — jatek-landing build did not produce dist/public/index.html"

# Pick a free random port (high range to avoid collisions with running dev workflows).
PORT="$(node -e 'const s=require("net").createServer();s.listen(0,()=>{const p=s.address().port;s.close(()=>console.log(p));});')"
MOBILE_STATIC_PORT="$(node -e 'const s=require("net").createServer();s.listen(0,()=>{const p=s.address().port;s.close(()=>console.log(p));});')"
LOG_FILE="$(mktemp -t smoke-prod-XXXXXX.log)"
MANIFEST_FILE=""

echo "[smoke] Starting production server on port $PORT (logs: $LOG_FILE)"

# Start under NODE_ENV=production with a stub DATABASE_URL only if not already
# set — the smoke test does not exercise the DB, but the bundle may import
# modules that read it at construction time.
export NODE_ENV=production
export PORT
export MOBILE_STATIC_PORT
export SKIP_PRODUCTION_MIGRATIONS=1
export DATABASE_URL="${DATABASE_URL:-postgres://smoke:smoke@127.0.0.1:5/smoke}"
# auth.ts hard-fails when NODE_ENV=production and SESSION_SECRET is missing.
export SESSION_SECRET="${SESSION_SECRET:-smoke-test-session-secret-not-used}"
export ALLOWED_ORIGINS="${ALLOWED_ORIGINS:+$ALLOWED_ORIGINS,}https://merchant.jatek.app"

bash "$START_SCRIPT" >"$LOG_FILE" 2>&1 &
SERVER_PID=$!

cleanup() {
  if kill -0 "$SERVER_PID" 2>/dev/null; then
    kill -TERM "$SERVER_PID" 2>/dev/null || true
    # Give the server up to 10s to shut down cleanly, then SIGKILL.
    for _ in $(seq 1 20); do
      kill -0 "$SERVER_PID" 2>/dev/null || break
      sleep 0.5
    done
    if kill -0 "$SERVER_PID" 2>/dev/null; then
      echo "[smoke] server did not exit on SIGTERM, sending SIGKILL" >&2
      kill -KILL "$SERVER_PID" 2>/dev/null || true
    fi
  fi
  rm -f "$LOG_FILE" "$MANIFEST_FILE"
}
trap cleanup EXIT

# Wait up to 30s for "Server listening" or for the process to die.
READY=0
for _ in $(seq 1 60); do
  if grep -q "Server listening" "$LOG_FILE"; then
    READY=1
    break
  fi
  if ! kill -0 "$SERVER_PID" 2>/dev/null; then
    break
  fi
  sleep 0.5
done

if [ "$READY" -ne 1 ]; then
  echo "[smoke] --- server log ---" >&2
  cat "$LOG_FILE" >&2
  echo "[smoke] --- end log ---" >&2
  fail "server did not log 'Server listening' within 30s (likely crashed at startup)"
fi

BASE_URL="http://127.0.0.1:$PORT"

check() {
  local path="$1"
  local url="$BASE_URL$path"
  local code
  code="$(curl -s -o /dev/null -w '%{http_code}' --max-time 10 "$url" || echo "000")"
  if [ "$code" != "200" ]; then
    echo "[smoke] --- server log ---" >&2
    cat "$LOG_FILE" >&2
    echo "[smoke] --- end log ---" >&2
    fail "GET $path returned HTTP $code (expected 200)"
  fi
  echo "[smoke]   GET $path → 200"
}

check-host() {
  local host="$1"
  local path="$2"
  local code
  code="$(curl -s -o /dev/null -w '%{http_code}' --max-time 10 \
    -H "Host: $host" "$BASE_URL$path" || echo "000")"
  if [ "$code" != "200" ]; then
    echo "[smoke] --- server log ---" >&2
    cat "$LOG_FILE" >&2
    echo "[smoke] --- end log ---" >&2
    fail "GET $path for host $host returned $code"
  fi
  echo "[smoke]   GET $path (Host: $host) → 200"
}

echo "[smoke] Probing routes…"
check "/"
check-host "merchant.jatek.app" "/"
check-host "merchant.jatek.app" "/sw.js"
MERCHANT_INDEX_FILE="$(mktemp -t smoke-merchant-index-XXXXXX.html)"
curl -fsS --max-time 10 \
  -H "Host: merchant.jatek.app" \
  "$BASE_URL/" >"$MERCHANT_INDEX_FILE" ||
  fail "GET / for merchant.jatek.app failed"
grep -Fq '<title>Espace Commerçant Jatek</title>' "$MERCHANT_INDEX_FILE" ||
  fail "merchant.jatek.app root did not return the merchant app"
rm -f "$MERCHANT_INDEX_FILE"
echo "[smoke]   merchant.jatek.app serves the merchant app at /"
check "/admin/"
check "/api/healthz"
check "/health"
check "/mobile/"
check "/mobile/status"

MERCHANT_CORS_ORIGIN="$(curl -sS -D - -o /dev/null --max-time 10 -X OPTIONS \
  -H "Origin: https://merchant.jatek.app" \
  -H "Access-Control-Request-Method: GET" \
  "$BASE_URL/api/healthz" |
  grep -i '^Access-Control-Allow-Origin:' |
  head -n 1 |
  sed 's/^[^:]*: *//;s/\r$//')"
[ "$MERCHANT_CORS_ORIGIN" = "https://merchant.jatek.app" ] ||
  fail "API CORS did not allow https://merchant.jatek.app"
echo "[smoke]   API CORS allows https://merchant.jatek.app"

MERCHANT_MANIFEST_FILE="$(mktemp -t smoke-merchant-manifest-XXXXXX.json)"
curl -fsS --max-time 10 \
  -H "Host: merchant.jatek.app" \
  "$BASE_URL/manifest.webmanifest" >"$MERCHANT_MANIFEST_FILE" ||
  fail "GET /manifest.webmanifest for merchant.jatek.app failed"
node - "$MERCHANT_MANIFEST_FILE" <<'NODE'
const manifest = JSON.parse(require("fs").readFileSync(process.argv[2], "utf8"));
if (manifest.id !== "/" || manifest.start_url !== "/" || manifest.scope !== "/") {
  throw new Error("Merchant PWA manifest does not launch from the domain root");
}
NODE
rm -f "$MERCHANT_MANIFEST_FILE"

MANIFEST_FILE="$(mktemp -t smoke-mobile-manifest-XXXXXX.json)"
curl -fsS --max-time 10 \
  -H "expo-platform: android" \
  "$BASE_URL/mobile/manifest" >"$MANIFEST_FILE" ||
  fail "GET /mobile/manifest with Android Expo header failed"

LAUNCH_PATH="$(node - "$MANIFEST_FILE" <<'NODE'
const manifest = JSON.parse(require("fs").readFileSync(process.argv[2], "utf8"));
if (!manifest.launchAsset?.url) throw new Error("Android manifest is missing launchAsset.url");
const pathname = new URL(manifest.launchAsset.url).pathname;
if (!pathname.startsWith("/mobile/")) throw new Error(`Launch asset is outside /mobile/: ${pathname}`);
console.log(pathname);
NODE
)"
check "$LAUNCH_PATH"

echo "[smoke] OK — production API and mobile preview serve all expected routes."
