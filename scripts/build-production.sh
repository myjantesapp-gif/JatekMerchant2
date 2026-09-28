#!/bin/bash
set -e

echo "========================================"
echo "  Jatek — Production Build"
echo "========================================"

echo ""
echo "[1/9] Build shared database type declarations…"
pnpm --filter @workspace/db run build

echo ""
echo "[2/9] Type-check API server…"
pnpm --filter @workspace/api-server exec tsc -p tsconfig.json --noEmit

echo ""
echo "[3/9] Build API server (TypeScript → ESM)…"
pnpm --filter @workspace/api-server run build

echo ""
echo "[4/9] Build landing page (SPA → dist/public)…"
BASE_PATH=/ pnpm --filter @workspace/jatek-landing run build

echo ""
echo "[5/9] Build backend-dashboard (SPA → dist/public)…"
BASE_PATH=/admin/ pnpm --filter @workspace/backend-dashboard run build

echo ""
echo "[6/9] Build merchant dashboard at /merchant/ for existing routes…"
PORT=19445 BASE_PATH=/merchant/ \
  pnpm --filter @workspace/merchant-dashboard run build

echo ""
echo "[7/9] Build merchant PWA at the custom-domain root…"
PORT=19445 BASE_PATH=/ MERCHANT_BUILD_OUT_DIR=dist/root-public \
  pnpm --filter @workspace/merchant-dashboard run build
node - <<'NODE'
const fs = require("node:fs");
const manifestPath = "artifacts/merchant-dashboard/dist/root-public/manifest.webmanifest";
const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
manifest.id = "/";
manifest.start_url = "/";
manifest.scope = "/";
fs.writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
NODE

echo ""
echo "[8/9] Build mobile static preview (Expo manifests, bundles, and assets)…"
BASE_PATH=/mobile/ pnpm --filter @workspace/jatek-mobile run build

echo ""
echo "[9/9] Smoke-test production routes and mobile delivery contract…"
bash "$(dirname "$0")/smoke-production.sh"
bash "$(dirname "$0")/smoke-mobile-preview.sh"

echo ""
echo "========================================"
echo "  Build production terminé avec succès!"
echo "========================================"
echo ""
echo "Note: DB schema migration runs at container startup (start-production.sh), not here."
echo "Démarrage : NODE_ENV=production PORT=8080 node artifacts/api-server/dist/index.mjs"
