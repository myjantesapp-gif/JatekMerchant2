#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# eas-build.sh — Jatek EAS build launcher
#
# Jatek builds always use the Jatek Expo project. The repository's `dev` branch
# is a source-control branch, not a separate Expo project/account.
#
# Usage (from artifacts/jatek-mobile/):
#   ./scripts/eas-build.sh --profile preview --platform android --non-interactive
#   ./scripts/eas-build.sh --profile production --platform android --non-interactive
# ─────────────────────────────────────────────────────────────────────────────

set -e

export EXPO_TOKEN="${EXPO_TOKEN_JATEK:-$EXPO_TOKEN}"
export EXPO_OWNER="jatekapp"
export EXPO_SLUG="jatek"
export EXPO_PUBLIC_PROJECT_ID="73e947fb-0a5a-4064-aafe-c856e231c9d4"

echo "👤 Owner : $EXPO_OWNER"
echo "📦 Slug  : $EXPO_SLUG"
echo "🆔 ID    : $EXPO_PUBLIC_PROJECT_ID"
echo ""

# Forward all arguments to EAS CLI
exec node_modules/.bin/eas "$@"
