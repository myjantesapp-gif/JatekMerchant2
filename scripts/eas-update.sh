#!/usr/bin/env bash
# eas-update.sh — Push an OTA JS update to EAS channel.
#
# Usage:
#   bash scripts/eas-update.sh <app> <channel> [message]
#
# Examples:
#   bash scripts/eas-update.sh mobile production "Fix checkout bug"
#   bash scripts/eas-update.sh driver production "Fix location tracking"

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

APP="${1:-}"
CHANNEL="${2:-production}"
MESSAGE="${3:-OTA update $(date +%Y-%m-%d)}"

case "$APP" in
  mobile)
    APP_DIR="$ROOT_DIR/artifacts/jatek-mobile"
    APP_LABEL="Jatek (customer)"
    ;;
  driver)
    APP_DIR="$ROOT_DIR/artifacts/jatek-driver"
    APP_LABEL="Jatek Driver"
    ;;
  *)
    echo "Usage: $0 <mobile|driver> <preview|production> [message]"
    exit 1
    ;;
esac

case "$CHANNEL" in
  preview|production)
    ;;
  *)
    echo "[eas-update] ERROR: channel must be preview or production (received: $CHANNEL)"
    exit 1
    ;;
esac

if [ -z "${EXPO_TOKEN_JATEK:-}" ]; then
  echo "[eas-update] ERROR: EXPO_TOKEN_JATEK secret is not set."
  exit 1
fi

EAS_BIN="$ROOT_DIR/artifacts/jatek-mobile/node_modules/.bin/eas"
if [ ! -x "$EAS_BIN" ]; then
  echo "[eas-update] ERROR: eas-cli is not installed at $EAS_BIN"
  exit 1
fi

export EXPO_TOKEN="$EXPO_TOKEN_JATEK"

echo "[eas-update] Pushing OTA update for $APP_LABEL → channel: $CHANNEL"
echo "[eas-update] Message: $MESSAGE"
echo ""

cd "$APP_DIR"
"$EAS_BIN" update \
  --channel "$CHANNEL" \
  --message "$MESSAGE" \
  --non-interactive
