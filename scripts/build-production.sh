#!/bin/bash
set -e

echo "========================================"
echo "  Jatek — Production Build"
echo "========================================"

echo ""
echo "[1/6] Type-check API server…"
pnpm --filter @workspace/api-server exec tsc -p tsconfig.json --noEmit

echo ""
echo "[2/6] Build API server (TypeScript → ESM)…"
pnpm --filter @workspace/api-server run build

echo ""
echo "[3/6] Build landing page (SPA → dist/public)…"
BASE_PATH=/ pnpm --filter @workspace/jatek-landing run build

echo ""
echo "[4/6] Build backend-dashboard (SPA → dist/public)…"
BASE_PATH=/admin/ pnpm --filter @workspace/backend-dashboard run build

echo ""
echo "[5/6] Build mobile static preview (Expo manifests, bundles, and assets)…"
BASE_PATH=/mobile/ pnpm --filter @workspace/jatek-mobile run build

echo ""
echo "[6/6] Smoke-test production routes and mobile delivery contract…"
bash "$(dirname "$0")/smoke-production.sh"
bash "$(dirname "$0")/smoke-mobile-preview.sh"

echo ""
echo "========================================"
echo "  Build production terminé avec succès!"
echo "========================================"
echo ""
echo "Note: DB schema migration runs at container startup (start-production.sh), not here."
echo "Démarrage : NODE_ENV=production PORT=8080 node artifacts/api-server/dist/index.mjs"
