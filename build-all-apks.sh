#!/bin/bash
set -e

echo "=========================================="
echo " 1. CRÉATION & CONFIGURATION DES FICHIERS "
echo "=========================================="

# Configuration de eas.json pour débloquer pnpm-lockfile
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
echo "✅ eas.json configuré."

echo "=========================================="
echo " 2. RÉPARATION WORKSPACE & PNPM LOCKFILE  "
echo "=========================================="

# Suppression des caches/lockfiles corrompus
rm -rf node_modules pnpm-lock.yaml
rm -rf artifacts/jatek-mobile/node_modules artifacts/jatek-mobile/pnpm-lock.yaml
rm -rf artifacts/jatek-driver/node_modules artifacts/jatek-driver/pnpm-lock.yaml

# Installation propre du workspace
echo "--> Génération et synchronisation des dépendances PNPM..."
pnpm install --no-frozen-lockfile

echo "=========================================="
echo " 3. COMPILATION APK LOCAL : CLIENT APP    "
echo "=========================================="

if [ -d "artifacts/jatek-mobile" ]; then
    cd artifacts/jatek-mobile
    echo "--> Prebuild Expo Android Client..."
    npx expo prebuild --platform android --clean
    
    echo "--> Génération APK Gradle..."
    cd android && ./gradlew assembleRelease
    
    echo "------------------------------------------"
    echo "✅ APK CLIENT PRÊT :"
    echo "   $(pwd)/app/build/outputs/apk/release/app-release.apk"
    echo "------------------------------------------"
    cd ../../..
else
    echo "❌ Dossier artifacts/jatek-mobile introuvable"
fi

echo "=========================================="
echo " 4. COMPILATION APK LOCAL : DRIVER APP    "
echo "=========================================="

if [ -d "artifacts/jatek-driver" ]; then
    cd artifacts/jatek-driver
    echo "--> Prebuild Expo Android Driver..."
    npx expo prebuild --platform android --clean
    
    echo "--> Génération APK Gradle..."
    cd android && ./gradlew assembleRelease
    
    echo "------------------------------------------"
    echo "✅ APK DRIVER PRÊT :"
    echo "   $(pwd)/app/build/outputs/apk/release/app-release.apk"
    echo "------------------------------------------"
    cd ../../..
else
    echo "❌ Dossier artifacts/jatek-driver introuvable"
fi

echo "=========================================="
echo "🎉 PROCESSUS TERMINÉ : LES 2 APKs SONT PRÊTS !"
echo "=========================================="
