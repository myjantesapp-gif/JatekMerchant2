#!/usr/bin/env bash
# Clone and release the Jatek stack in a fresh Replit project.
#
# This script never contains secret values. Put secrets in Replit Secrets and
# pass only non-secret parameters as environment variables.
#
# Safe preparation (no data copy, no cloud-store submission):
#   bash scripts/clone-jatek.sh
#
# Full clone into a new, empty Replit project:
# First add SOURCE_DATABASE_URL and SOURCE_OBJECT_STORAGE_ID as Replit Secrets,
# then run:
#   TARGET_OBJECT_STORAGE_ID="$DEFAULT_OBJECT_STORAGE_ID" \
#   NEW_EAS_PROJECT_ID='...' \
#   NEW_EXPO_OWNER='...' \
#   NEW_EXPO_SLUG='...' \
#   API_DOMAIN='new-project.example.com' \
#   PUBLIC_API_URL='https://new-project.example.com' \
#   CLONE_DATA=YES CLONE_MEDIA=YES \
#   bash scripts/clone-jatek.sh
#
# Existing target data is never replaced unless the caller explicitly sets:
#   ALLOW_NONEMPTY_TARGET=YES
#   ALLOW_MEDIA_OVERWRITE=YES
#
# The script prepares and verifies the app. iOS App Store/TestFlight submission
# remains a user-triggered Expo Launch action after the new Expo project is
# authorized and the build has passed.

set -Eeuo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

CLONE_DATA="${CLONE_DATA:-NO}"
CLONE_MEDIA="${CLONE_MEDIA:-NO}"
APPLY_SCHEMA="${APPLY_SCHEMA:-YES}"
RUN_BUILD="${RUN_BUILD:-YES}"
ALLOW_NONEMPTY_TARGET="${ALLOW_NONEMPTY_TARGET:-NO}"
DRY_RUN="${DRY_RUN:-NO}"
DATABASE_DUMP="${DATABASE_DUMP:-$ROOT_DIR/.local/clone/database.dump}"
TARGET_OBJECT_STORAGE_ID="${TARGET_OBJECT_STORAGE_ID:-${DEFAULT_OBJECT_STORAGE_ID:-}}"

log() { printf '[clone] %s\n' "$*"; }
die() { printf '[clone] ERROR: %s\n' "$*" >&2; exit 1; }
has() { command -v "$1" >/dev/null 2>&1; }
is_yes() { [ "${1:-NO}" = "YES" ]; }

usage() {
  sed -n '1,28p' "$0"
  cat <<'EOF'

Environment:
  DATABASE_URL                 Target database (normally supplied by Replit).
  SOURCE_DATABASE_URL          Source database; required with CLONE_DATA=YES.
  SOURCE_OBJECT_STORAGE_ID     Source App Storage bucket; required with CLONE_MEDIA=YES.
  TARGET_OBJECT_STORAGE_ID     Target App Storage bucket; required with CLONE_MEDIA=YES.
  SESSION_SECRET               Required runtime secret for the API.
  EXPO_TOKEN_JATEK or EXPO_TOKEN
                                Validates mobile build credentials without printing them.

New Expo project parameters:
  NEW_EAS_PROJECT_ID           New EAS project ID; no old project ID is copied.
  NEW_EXPO_OWNER               New Expo owner/account.
  NEW_EXPO_SLUG                New Expo slug.
  API_DOMAIN                   Hostname used by the mobile app, without https://.
  PUBLIC_API_URL               Full HTTPS API URL.
  IOS_BUILD_NUMBER             Optional explicit iOS build number.
  ANDROID_VERSION_CODE        Optional explicit Android version code.
  RELEASE_VERSION              Optional app version, also updates runtimeVersion.

Flags are controlled through environment variables so secrets never appear in
the command line history:
  CLONE_DATA=YES                Copy PostgreSQL data.
  CLONE_MEDIA=YES               Copy App Storage objects with SHA-256 checks.
  ALLOW_NONEMPTY_TARGET=YES     Allow destructive database replacement.
  ALLOW_MEDIA_OVERWRITE=YES     Allow replacing differing target objects.
  APPLY_SCHEMA=NO               Skip the development schema push.
  RUN_BUILD=NO                  Skip full web/API/mobile verification build.
  DRY_RUN=YES                   Validate configuration without mutating data.
EOF
}

if [ "${1:-}" = "--help" ] || [ "${1:-}" = "-h" ]; then
  usage
  exit 0
fi

has node || die "Node.js is required"
has pnpm || die "pnpm is required"
has psql || die "psql is required for database validation"
if is_yes "$CLONE_DATA"; then
  has pg_dump || die "pg_dump is required when CLONE_DATA=YES"
  has pg_restore || die "pg_restore is required when CLONE_DATA=YES"
fi

[ -f pnpm-lock.yaml ] || die "pnpm-lock.yaml is missing; run this from the repository root"
[ -f artifacts/jatek-mobile/app.json ] || die "Jatek mobile app is missing"
[ -f artifacts/jatek-mobile/eas.json ] || die "Jatek mobile EAS config is missing"

required_env() {
  local name="$1"
  [ -n "${!name:-}" ] || die "$name is required"
}

required_env DATABASE_URL
required_env SESSION_SECRET

if is_yes "$CLONE_DATA"; then
  required_env SOURCE_DATABASE_URL
  [ "$SOURCE_DATABASE_URL" != "$DATABASE_URL" ] || die "Source and target database URLs must differ"
fi

if is_yes "$CLONE_MEDIA"; then
  required_env SOURCE_OBJECT_STORAGE_ID
  required_env TARGET_OBJECT_STORAGE_ID
  [ "$SOURCE_OBJECT_STORAGE_ID" != "$TARGET_OBJECT_STORAGE_ID" ] ||
    die "Source and target App Storage bucket IDs must differ"
fi

if [ -n "${NEW_EAS_PROJECT_ID:-}" ]; then
  required_env NEW_EXPO_OWNER
  required_env NEW_EXPO_SLUG
  required_env API_DOMAIN
  required_env PUBLIC_API_URL
fi

if is_yes "$DRY_RUN"; then
  log "dry run — configuration is valid; no files, database, media, or builds will be changed"
  exit 0
fi

log "installing the locked workspace dependencies"
pnpm install --frozen-lockfile

if [ -n "${NEW_EAS_PROJECT_ID:-}" ]; then
  log "configuring the new Expo project without copying the old project ID"
  node <<'NODE'
const fs = require("node:fs");

const projectId = process.env.NEW_EAS_PROJECT_ID;
const owner = process.env.NEW_EXPO_OWNER;
const slug = process.env.NEW_EXPO_SLUG;
const apiDomain = process.env.API_DOMAIN;
const apiUrl = process.env.PUBLIC_API_URL;
const releaseVersion = process.env.RELEASE_VERSION;
const iosBuildNumber = process.env.IOS_BUILD_NUMBER;
const androidVersionCode = process.env.ANDROID_VERSION_CODE;

const appPath = "artifacts/jatek-mobile/app.json";
const app = JSON.parse(fs.readFileSync(appPath, "utf8"));
app.expo.extra ??= {};
app.expo.extra.eas ??= {};
app.expo.extra.eas.projectId = projectId;
app.expo.owner = owner;
app.expo.slug = slug;
if (releaseVersion) {
  app.expo.version = releaseVersion;
  app.expo.runtimeVersion = releaseVersion;
}
if (iosBuildNumber) app.expo.ios.buildNumber = String(iosBuildNumber);
if (androidVersionCode) app.expo.android.versionCode = Number(androidVersionCode);
fs.writeFileSync(appPath, `${JSON.stringify(app, null, 2)}\n`);

for (const easPath of ["eas.json", "artifacts/jatek-mobile/eas.json"]) {
  const eas = JSON.parse(fs.readFileSync(easPath, "utf8"));
  for (const profile of Object.values(eas.build ?? {})) {
    profile.env ??= {};
    profile.env.EXPO_PUBLIC_PROJECT_ID = projectId;
    profile.env.EXPO_OWNER = owner;
    profile.env.EXPO_SLUG = slug;
    profile.env.EXPO_PUBLIC_DOMAIN = apiDomain;
    if (profile.env.EXPO_PUBLIC_API_URL !== undefined || profile === eas.build.production) {
      profile.env.EXPO_PUBLIC_API_URL = apiUrl;
    }
  }
  fs.writeFileSync(easPath, `${JSON.stringify(eas, null, 2)}\n`);
}
NODE
fi

if is_yes "$CLONE_DATA"; then
  log "copying PostgreSQL data into the target database"
  mkdir -p "$(dirname "$DATABASE_DUMP")"
  chmod 700 "$(dirname "$DATABASE_DUMP")"
  pg_dump \
    --dbname "$SOURCE_DATABASE_URL" \
    --no-owner --no-acl --format=custom \
    --file "$DATABASE_DUMP"

  target_table_count="$(
    psql "$DATABASE_URL" -Atqc \
      "SELECT count(*) FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE n.nspname = 'public' AND c.relkind IN ('r','p');"
  )"
  restore_args=(--dbname "$DATABASE_URL" --no-owner --no-acl --exit-on-error)
  if [ "${target_table_count:-0}" -gt 0 ]; then
    if ! is_yes "$ALLOW_NONEMPTY_TARGET"; then
      die "target database is not empty; set ALLOW_NONEMPTY_TARGET=YES to replace it"
    fi
    restore_args+=(--clean --if-exists)
  fi
  pg_restore "${restore_args[@]}" "$DATABASE_DUMP"
  rm -f "$DATABASE_DUMP"
  log "database copy completed"
fi

if is_yes "$CLONE_MEDIA"; then
  log "copying App Storage objects with checksum verification"
  pnpm --filter @workspace/api-server exec tsx src/scripts/copy-app-storage.ts
fi

if is_yes "$APPLY_SCHEMA"; then
  log "applying the additive development schema"
  pnpm --filter @workspace/db run push
fi

if is_yes "$RUN_BUILD"; then
  log "running the complete application verification build"
  pnpm run typecheck
  pnpm --filter @workspace/api-server run test
  bash scripts/build-production.sh
fi

log "clone preparation completed successfully"
log "runtime secrets are read from Replit Secrets; no secret values were copied or printed"
if [ -n "${NEW_EAS_PROJECT_ID:-}" ]; then
  log "new Expo project configured; authorize it in Expo Launch before submitting iOS to TestFlight"
fi