# Contrôle natif de la barre Android

Ce contrôle ne modifie pas le layout. Il détecte les pixels non blancs dans
la zone système réservée, hors icônes/encoche explicitement masquées.
Un aperçu web, Expo Go ou un test de source ne valide **pas** ce comportement.

## Matrice obligatoire avant livraison

| Système | Nouveau binaire | OTA sur binaire existant |
|---|---|---|
| Android 14 / API 34 | requis | requis |
| Android 15 / API 35 (ou supérieur) | requis | requis |

Utiliser des émulateurs Android Studio ou des appareils USB avec `adb`, Python
3.10+ et le vrai package `ma.jatek.app` installé. Aucun module Python supplémentaire.
Pour une OTA, garder aussi un binaire edge-to-edge déjà distribué si celui-ci est
encore supporté : les paramètres natifs d'app.json ne changent pas par OTA.
Répéter dans les modes de navigation gestes et trois boutons : huit exécutions
au total. `navigationMode` doit être `2` (gestes) ou `0` (trois boutons).
Une valeur inconnue ou l'absence d'un mode bloque la validation de la matrice.

## Préparer une référence, une fois par appareil/configuration d'affichage

1. Utiliser un compte de test, terminer onboarding/permissions, sélectionner une
   adresse desservie et un commerce existant. Fixer portrait, taille d'affichage,
   taille du texte, thème clair et langue française. Désactiver les notifications.
2. Copier `config.example.json` hors Git. Remplacer les routes/textes du commerce
   et vérifier le libellé réellement visible du panier. Les expressions régulières
   doivent identifier chaque écran, jamais un texte générique commun.
3. Capturer une version visuellement correcte :
   `adb -s SERIAL exec-out screencap -p > reference.png`.
   Renseigner `size` et `statusHeight` en **pixels physiques**, depuis la capture
   et les insets de `adb -s SERIAL shell dumpsys window`. Ne pas deviner la hauteur
   en dp. La zone doit aller du bord supérieur jusqu'au bas de la barre système.
4. Ajouter des rectangles `[x1,y1,x2,y2]` pour l'horloge, les icônes et l'encoche
   uniquement, avec une petite marge pour les chiffres variables. Au moins 50 %
   de la barre doit rester contrôlée. Ne pas masquer sa bordure inférieure.
   Examiner toute la barre manuellement, noter l'approbateur dans `approvedBy`,
   conserver reference.png et config.json avec les résultats. Ne jamais ajuster
   les masques pour faire passer une capture défectueuse.

## Identifier ce qui tourne réellement

Renseigner `delivery` : commit source, canal, runtimeVersion et identifiant
**chargé** de l'update (`embedded` si bundle embarqué).
`evidence` décrit où se trouve la preuve conservée : informations Expo Updates
du client/de son diagnostic, manifeste de build et manifeste EAS Update.
Le canal seul, l'ID de la dernière publication ou la date ne prouvent pas que
l'appareil a chargé l'OTA. Le script ne peut pas lire l'état interne Expo Updates
d'un binaire release : cette identification doit être confirmée par l'opérateur.

### Nouveau binaire

Installer l'APK candidat (`adb -s SERIAL install -r candidat.apk`).
Renseigner `mode: "native"`. Désactiver les OTA ou vérifier explicitement le bundle
chargé afin de tester le binaire attendu, pas une autre publication.
Le script archive la version native et les empreintes SHA-256 de tous les APK.

### OTA

Exécuter d'abord le contrôle sur le binaire installé avant l'OTA et conserver son
result.json. Publier l'update compatible, laisser l'app la télécharger, fermer puis
rouvrir, confirmer l'identifiant effectivement chargé. Renseigner `mode: "ota"` et
`beforeReport` avec le chemin du résultat avant OTA. Le contrôle refuse un APK
différent, un runtime différent ou un identifiant d'update inchangé.
Ne pas reconstruire/réinstaller le binaire entre les deux mesures.

## Exécuter

Depuis la racine du dépôt :

```sh
python3 artifacts/jatek-mobile/tests/android-status-bar/check.py \
  --serial emulator-5554 --config /chemin/android14-native.json \
  --output /chemin/preuves/android14-native
```

Utiliser un nouveau dossier pour chaque exécution. Le parcours vérifie :
Home à froid → commerce → retour Home → commerce à froid → redémarrage Home →
panier → retour Home → panier à froid → redémarrage Home.
Les liens internes utilisent le vrai routeur ; le retour utilise le bouton Android.
Un démarrage à froid est un `force-stop` suivi d'un lancement du lien, sans effacer
la session. Le commerce et le panier ne sont pas censés être restaurés spontanément.

Chaque étape conserve PNG, pixels RGBA exacts analysés et hiérarchie UI XML.
Le résultat conserve modèle, version Android/API, empreinte système, navigation,
versions package, empreintes APK, contexte OTA/natif et ratios mesurés.
Le PNG est généré directement depuis les pixels RGBA analysés : il représente
exactement la même image, sans seconde capture ni décalage temporel.
`PASS` exige le bon écran et au maximum 0,5 % de pixels non blancs non masqués
(chaque canal RGB ≥ 245). Erreur ADB, format inattendu, mauvais écran, timeout ou
changement de résolution produisent un échec, jamais une validation silencieuse.

Archiver les huit dossiers de la matrice ensemble, avec les références approuvées
et preuves de livraison. Vérifier que tous les result.json sont PASS, que les API
incluent 34 et ≥35, avec OTA/natif et gestes/trois boutons **pour chaque système**.
Joindre ce bilan à la livraison. Ne pas committer les captures/XML : ils peuvent
contenir des données de compte. Conserver dans un espace de QA à accès restreint.

La matrice est également contrôlable automatiquement (code de sortie non nul
si une cellule, une étape ou une capture manque). Elle relit les pixels et
les hiérarchies UI, vérifie l'ordre exact du parcours, la concordance PNG/RGBA
et les identités OTA, sans se fier uniquement au champ PASS du résultat :

```sh
python3 artifacts/jatek-mobile/tests/android-status-bar/matrix.py \
  /chemin/preuves/android14-native-gestes/result.json \
  /chemin/preuves/android14-ota-gestes/result.json \
  /chemin/preuves/android15-native-gestes/result.json \
  /chemin/preuves/android15-ota-gestes/result.json \
  /chemin/preuves/android14-native-boutons/result.json \
  /chemin/preuves/android14-ota-boutons/result.json \
  /chemin/preuves/android15-native-boutons/result.json \
  /chemin/preuves/android15-ota-boutons/result.json
```

## Limites et validation du détecteur

Ce test détecte un retour de fond coloré/contenu visible sous les icônes, pas un
chevauchement blanc sur blanc ni un défaut entièrement situé sous un masque.
Examiner aussi les captures intégrales pour les titres coupés, la lisibilité des
icônes et les problèmes de navigation. Ne pas créer automatiquement une référence.

```sh
python3 -m unittest discover \
  -s artifacts/jatek-mobile/tests/android-status-bar -p 'test_*.py' -v
```

Les tests synthétiques injectent notamment un bandeau rose et une barre noire :
ils doivent échouer au contrôle des pixels. Ils ne remplacent pas la matrice native.
Des tests de transport ADB simulé vérifient aussi le parcours, les fichiers archivés,
les erreurs de lancement et la comparaison OTA. Leurs fichiers temporaires sont
supprimés et ne constituent jamais une preuve de validation sur appareil.
À la création de cette procédure, aucun appareil/ADB n'était disponible dans
l'environnement de développement : **aucun résultat Android réel n'est revendiqué**.