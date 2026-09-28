#!/bin/bash
set -e

echo "========================================"
echo "  Jatek — Production Build"
echo "========================================"

echo ""
echo "[1/8] Build shared database type declarations…"
pnpm --filter @workspace/db run build

echo ""
echo "[2/8] Type-check API server…"
pnpm --filter @workspace/api-server exec tsc -p tsconfig.json --noEmit

echo ""
echo "[3/8] Build API server (TypeScript → ESM)…"
pnpm --filter @workspace/api-server run build

echo ""
echo "[4/8] Build landing page (SPA → dist/public)…"
BASE_PATH=/ pnpm --filter @workspace/jatek-landing run build

echo ""
echo "[5/8] Build backend-dashboard (SPA → dist/public)…"
BASE_PATH=/admin/ pnpm --filter @workspace/backend-dashboard run build

echo ""
echo "[6/8] Build merchant dashboard at /merchant/…"
PORT=19445 BASE_PATH=/merchant/ \
  pnpm --filter @workspace/merchant-dashboard run build

echo ""
echo "[7/8] Build mobile static preview (Expo manifests, bundles, and assets)…"
BASE_PATH=/mobile/ pnpm --filter @workspace/jatek-mobile run build

echo ""
echo "[8/8] Smoke-test production routes and mobile delivery contract…"
bash "$(dirname "$0")/smoke-production.sh"
bash "$(dirname "$0")/smoke-mobile-preview.sh"

echo ""
echo "========================================"
echo "  Build production terminé avec succès!"
echo "========================================"
echo ""
echo "Note: DB schema migration runs at container startup (start-production.sh), not here."
echo "Démarrage : NODE_ENV=production PORT=8080 node artifacts/api-server/dist/index.mjs"
