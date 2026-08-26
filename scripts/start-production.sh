#!/bin/bash
set -euo pipefail
export NODE_ENV=production
export PORT="${PORT:-8080}"
export MOBILE_STATIC_PORT="${MOBILE_STATIC_PORT:-25896}"

if [ "${SKIP_PRODUCTION_MIGRATIONS:-0}" != "1" ]; then
  echo "[start] Applying DB schema migrations…"
  node artifacts/api-server/scripts/push-prod-schema.mjs
else
  echo "[start] Skipping DB schema migrations (smoke test mode)"
fi

node - <<'NODE'
const path = require("path");
const { validateStaticBuild } = require(path.resolve("artifacts/jatek-mobile/server/build-check"));
const result = validateStaticBuild({
  staticRoot: path.resolve("artifacts/jatek-mobile/static-build"),
  basePath: "/mobile",
});

if (!result.ok) {
  console.error("[start] Mobile static build is missing or invalid:");
  for (const error of result.errors) console.error(`  - ${error}`);
  process.exit(1);
}
NODE

cleanup() {
  local status=$?
  trap - EXIT INT TERM
  for pid in "${API_PID:-}" "${MOBILE_PID:-}"; do
    if [ -n "$pid" ] && kill -0 "$pid" 2>/dev/null; then
      kill -TERM "$pid" 2>/dev/null || true
    fi
  done
  wait "${API_PID:-}" "${MOBILE_PID:-}" 2>/dev/null || true
  exit "$status"
}
trap cleanup EXIT INT TERM

echo "[start] Starting mobile static server on port $MOBILE_STATIC_PORT…"
PORT="$MOBILE_STATIC_PORT" BASE_PATH=/mobile/ \
  pnpm --filter @workspace/jatek-mobile run serve &
MOBILE_PID=$!

echo "[start] Starting API server on port $PORT…"
node --max-old-space-size=4096 artifacts/api-server/dist/index.mjs &
API_PID=$!

wait -n "$API_PID" "$MOBILE_PID"
echo "[start] A production service exited unexpectedly" >&2
exit 1
