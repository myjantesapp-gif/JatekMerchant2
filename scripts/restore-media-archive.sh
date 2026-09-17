#!/usr/bin/env bash
# Restore a verified Jatek media backup into the current default App Storage.
#
# Usage:
#   bash scripts/restore-media-archive.sh attached_assets/media.tar.gz <confirmed-target-bucket-id>
#
# The confirmed target must match the environment's sidecar-resolved default
# App Storage bucket. Existing objects are never replaced or deleted.
# Database references are intentionally not rewritten: the archive preserves
# the original banners/, logos/, medias/ and shorts/ object names.

set -Eeuo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ARCHIVE="${1:-}"
TARGET_BUCKET_ID="${2:-${MEDIA_RESTORE_TARGET_BUCKET_ID:-}}"

fail() { echo "[restore:media] ERROR: $*" >&2; exit 1; }

[ -n "$ARCHIVE" ] || fail "archive path is required"
[ -f "$ARCHIVE" ] || fail "archive not found: $ARCHIVE"
[ -n "$TARGET_BUCKET_ID" ] || fail "confirmed target bucket ID is required as the second argument"
command -v tar >/dev/null 2>&1 || fail "tar is required"
command -v pnpm >/dev/null 2>&1 || fail "pnpm is required"

bad_entry="$(
  tar -tzf "$ARCHIVE" |
    awk '($0 ~ /^\// || $0 ~ /(^|\/)\.\.(\/|$)/ || $0 ~ /\\/) { print; exit }'
)"
[ -z "$bad_entry" ] || fail "unsafe archive entry: $bad_entry"

TEMP_DIR="$(mktemp -d "${TMPDIR:-/tmp}/jatek-media-restore-XXXXXX")"
cleanup() { rm -rf "$TEMP_DIR"; }
trap cleanup EXIT

tar -xzf "$ARCHIVE" -C "$TEMP_DIR" --no-same-owner --no-same-permissions
[ -f "$TEMP_DIR/media-manifest.json" ] || fail "media-manifest.json is missing"
[ -d "$TEMP_DIR/media" ] || fail "media/ directory is missing"

MEDIA_RESTORE_ROOT="$TEMP_DIR/media" \
MEDIA_MANIFEST_PATH="$TEMP_DIR/media-manifest.json" \
MEDIA_RESTORE_TARGET_BUCKET_ID="$TARGET_BUCKET_ID" \
pnpm --filter @workspace/api-server exec tsx src/scripts/restore-media-archive.ts
