#!/usr/bin/env bash
# eas-build.sh — Trigger an EAS build for a Jatek Expo app.
#
# Usage:
#   bash scripts/eas-build.sh <app> <profile> [platform]
#
#   <app>      : mobile  → artifacts/jatek-mobile
#              : driver  → artifacts/jatek-driver
#   <profile>  : development | preview | production
#   [platform] : android (default) | ios | all
#
# Examples:
#   bash scripts/eas-build.sh mobile preview android
#   bash scripts/eas-build.sh driver preview android
#   bash scripts/eas-build.sh driver production android
#   bash scripts/eas-build.sh mobile production android

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

APP="${1:-}"
PROFILE="${2:-preview}"
PLATFORM="${3:-android}"

case "$APP" in
  mobile)
    APP_DIR="$ROOT_DIR/artifacts/jatek-mobile"
    APP_LABEL="Jatek (customer)"
    APP_OWNER="jatekapp"
    ;;
  driver)
    APP_DIR="$ROOT_DIR/artifacts/jatek-driver"
    APP_LABEL="Jatek Driver"
    APP_OWNER="jatekplatforms-team"
    ;;
  *)
    echo "Usage: $0 <mobile|driver> <development|preview|production> [android|ios|all]"
    exit 1
    ;;
esac

if [ ! -d "$APP_DIR" ]; then
  echo "[eas-build] ERROR: app directory not found: $APP_DIR"
  exit 1
fi

# Use the project-specific Jatek token for builds.
# Prefer the project-specific secret, while accepting the standard EXPO_TOKEN
# name for existing Replit environments.
EAS_TOKEN="${EXPO_TOKEN_JATEK:-${EXPO_TOKEN:-}}"
if [ -z "$EAS_TOKEN" ]; then
  echo "[eas-build] ERROR: EXPO_TOKEN_JATEK or EXPO_TOKEN secret is not set."
  echo "            Add one of them in Replit Secrets."
  exit 1
fi
export EXPO_TOKEN="$EAS_TOKEN"

# Locate the EAS CLI — prefer app-local, fall back to sibling workspace.
EAS_BIN=""
if [ -f "$APP_DIR/node_modules/.bin/eas" ]; then
  EAS_BIN="$APP_DIR/node_modules/.bin/eas"
elif [ -f "$ROOT_DIR/artifacts/jatek-mobile/node_modules/.bin/eas" ]; then
  EAS_BIN="$ROOT_DIR/artifacts/jatek-mobile/node_modules/.bin/eas"
else
  echo "[eas-build] ERROR: eas-cli not found. Run: pnpm add -D eas-cli in the app directory."
  exit 1
fi

echo "[eas-build] Building $APP_LABEL — profile: $PROFILE, platform: $PLATFORM"
echo "[eas-build] Directory: $APP_DIR"
echo "[eas-build] EAS binary: $EAS_BIN"
echo "[eas-build] EAS account: $APP_OWNER"
echo ""

cd "$APP_DIR"
"$EAS_BIN" build \
  --profile "$PROFILE" \
  --platform "$PLATFORM" \
  --non-interactive
