#!/bin/bash
set -e

echo "=========================================="
echo " 1. CRÉATION & CONFIGURATION DES FICHIERS "
echo "=========================================="

# 1. Mise à jour du eas.json à la racine
cat << 'EOT' > eas.json
{
  "cli": {
    "version": ">= 7.0.0",
    "appVersionSource": "remote"
  },
  "build": {
    "development": {
      "developmentClient": true,
      "distribution": "internal"
    },
    "preview": {
      "distribution": "internal",
      "android": {
        "buildType": "apk"
      },
      "pnpm": {
        "frozenLockfile": false
      }
    },
    "production": {
      "autoIncrement": true,
      "pnpm": {
        "frozenLockfile": false
      }
    }
  },
  "submit": {
    "production": {}
  }
}
EOT
echo "✅ eas.json configuré à la racine."

# 2. Configuration projectId EAS pour Jatek Client
if [ -f "artifacts/jatek-mobile/app.json" ]; then
  npx jq '.expo.extra.eas.projectId = "73e947fb-0a5a-4064-aafe-c856e231c9d4"' artifacts/jatek-mobile/app.json > artifacts/jatek-mobile/app.json.tmp && mv artifacts/jatek-mobile/app.json.tmp artifacts/jatek-mobile/app.json
  echo "✅ app.json mis à jour pour jatek-mobile (Client)."
fi

# 3. Configuration projectId EAS pour Jatek Driver
if [ -f "artifacts/jatek-driver/app.json" ]; then
  npx jq '.expo.extra.eas.projectId = "3c515b02-249e-427b-a45f-e15e22e4f25d"' artifacts/jatek-driver/app.json > artifacts/jatek-driver/app.json.tmp && mv artifacts/jatek-driver/app.json.tmp artifacts/jatek-driver/app.json
  echo "✅ app.json mis à jour pour jatek-driver (Driver)."
fi

echo "=========================================="
echo " 2. REPARATION PNPM & DEPENDANCES        "
echo "=========================================="

rm -rf node_modules pnpm-lock.yaml
rm -rf artifacts/jatek-mobile/node_modules artifacts/jatek-mobile/pnpm-lock.yaml
rm -rf artifacts/jatek-driver/node_modules artifacts/jatek-driver/pnpm-lock.yaml

echo "--> Installation et synchronisation des dépendances..."
pnpm install --no-frozen-lockfile

echo "=========================================="
echo " 3. LANCEMENT BUILD EAS CLOUD (CLIENT)    "
echo "=========================================="

if [ -d "artifacts/jatek-mobile" ]; then
    echo "--> Envoi du build EAS Client en tâche de fond..."
    npx eas-cli build --platform android --profile preview --path artifacts/jatek-mobile --non-interactive || echo "⚠️ Connexion requise"
fi

echo "=========================================="
echo " 4. LANCEMENT BUILD EAS CLOUD (DRIVER)    "
echo "=========================================="

if [ -d "artifacts/jatek-driver" ]; then
    echo "--> Envoi du build EAS Driver en tâche de fond..."
    npx eas-cli build --platform android --profile preview --path artifacts/jatek-driver --non-interactive || echo "⚠️ Connexion requise"
fi

echo "=========================================="
echo "🎉 BUILDS ENVOYÉS SUR EAS CLOUD !"
echo "=========================================="
