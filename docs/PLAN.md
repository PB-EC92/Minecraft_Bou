# Plan d'attaque — « Cubes » (nom provisoire)

Version 1 du plan, 23 septembre 2026, établie à partir du brief validé (`docs/BRIEF.md`). Les estimations de charge sont indicatives et non vérifiées : elles seront recalées après le jalon J0.

## 1. Principes de conduite

Chaque session de travail se termine par un livrable testable : le fichier `dist/cubes.html` déposé dans le dossier `Minecraft`, accompagné du code source. Les enfants testent tôt et souvent (dès J2), et leurs retours sont consignés dans `docs/RETOURS.md`. Le périmètre V1 est gelé : toute idée nouvelle va au backlog V2 (section 6) plutôt que dans le jalon en cours. Un seul fichier HTML autonome, sans installation ni connexion, reste la contrainte qui structure tous les choix techniques.

## 2. Architecture technique

### Pile

TypeScript, Vite, Three.js (dernière version stable, r186 à la date du plan), `vite-plugin-singlefile` pour produire le fichier unique, Vitest pour les tests unitaires, Playwright (Chromium en cloud) pour les tests de fumée et les captures d'écran. Pas de framework d'interface : le HUD est en HTML/CSS natif superposé au canvas 3D. Pas de moteur physique externe : une physique boîte-contre-blocs suffit.

TypeScript plutôt que JavaScript : le code sera en grande partie écrit par Claude ; le typage attrape à la compilation une bonne part des erreurs qu'un relecteur humain ne verrait pas, et reste lisible pour quelqu'un venant de Python.

### Structure des dossiers

```
Minecraft/
  docs/              BRIEF.md, PLAN.md, RETOURS.md
  src/
    engine/          monde, chunks, génération de terrain, maillage, physique, raycast
    render/          scène Three.js, atlas de textures procédurales, ciel jour/nuit
    input/           clavier + souris (Pointer Lock), tactile (joystick, regard, boutons)
    game/            joueur, inventaire, registre des blocs, créatures, lampe, clôture
    edu/             profils, moteur de missions, compagnon, dialogues, synthèse vocale
    ui/              écran d'accueil, HUD, menus, mode parent
    save/            sauvegarde locale, export/import
    main.ts
  tests/             unitaires (Vitest) et fumée (Playwright)
  dist/cubes.html    le jeu, un seul fichier
  CLAUDE.md          conventions et architecture pour Claude Code
  package.json, vite.config.ts, tsconfig.json
```

`node_modules` n'est jamais déposé dans le dossier (voir section 4, piège OneDrive).

### Choix clés

Monde : 128 × 128 blocs, hauteur 64, découpé en chunks de 16 × 16 × 64 (64 chunks). Chaque chunk est un `Uint8Array` d'identifiants de blocs, soit environ 1 Mo pour tout le monde.

Maillage : par chunk, seules les faces visibles (voisin transparent ou vide) sont générées ; un mesh opaque et un mesh transparent par chunk ; reconstruction du seul chunk modifié (et de ses voisins en bordure) à chaque pose ou casse. Suffisant à cette taille ; le greedy meshing est gardé en réserve si la tablette peine.

Textures : atlas de tuiles 16 × 16 px dessinées par code sur un canvas au démarrage. Zéro image externe, style pixel-art original, aucun emprunt à Minecraft.

Génération : bruit simplex avec graine ; relief doux, herbe, terre, pierre, sable, lacs, arbres, fleurs. Graine fixée par profil pour que chaque enfant retrouve « son » monde.

Physique : boîte du joueur contre les blocs (AABB), gravité, saut, aucun dégât de chute, flottaison simple dans l'eau.

Blocs V1 (une douzaine) : herbe, terre, pierre, sable, tronc, planches, feuilles, verre, eau, lampe, clôture, fleur ; le bloc-lettre est prévu dans le registre pour la V2 sans être exposé en V1.

Contrôles clavier : touches repérées par position physique (`KeyboardEvent.code`), ce qui donne ZQSD en AZERTY et WASD en QWERTY sans aucun réglage. Regard à la souris via Pointer Lock.

Tactile : moitié gauche de l'écran = joystick virtuel ; moitié droite = glisser pour regarder ; boutons saut, bascule casser/poser, inventaire ; réticule au centre ; plein écran et orientation paysage.

Audio : sons synthétisés par Web Audio (aucun fichier). Voix : `speechSynthesis` avec une voix fr-FR ; repli texte + icônes + sons si aucune voix française n'est disponible.

Jour/nuit : cycle court (ordre de grandeur 8 minutes de jour, 3 de nuit), durée réglable en mode parent.

Créatures : machine à états simple. Le jour elles errent loin du joueur ; la nuit elles s'approchent, chipent un bloc de l'inventaire au contact, fuient à quelques blocs d'une lampe et ne franchissent pas les clôtures.

Sauvegarde : `localStorage` par profil (chunks compressés par plages puis encodés en base64, inventaire, position, progression) ; export = téléchargement d'un fichier JSON ; import = sélecteur de fichier. En `file://`, le stockage local est partagé entre tous les fichiers ouverts localement : les clés sont préfixées `cubes:`.

Missions : données déclaratives (étapes, conditions observées sur l'état du jeu, textes en deux variantes débutant/autonome, récompense). Le moteur observe le jeu et fait avancer la mission ; le compagnon porte les dialogues.

Mode parent : appui long de trois secondes sur l'engrenage de l'écran d'accueil. Réglages : voix, longueur des phrases, plage de nombres, durée de la nuit, créatures actives ou non. Progression par profil.

Build : `npm run build` produit `dist/cubes.html`. Taille attendue de l'ordre de 2 à 3 Mo (Three.js minifié compris — estimation), très en dessous du plafond de 20 Mo du dépôt de fichiers vers le poste.

### Ce qu'impose le fichier local (`file://`)

Un fichier ouvert par double-clic ne peut ni charger des modules ES externes ni lire des fichiers voisins par `fetch` : tout est inliné dans le HTML. Deux points restent à vérifier au J0 : le Pointer Lock en `file://` (repli : regard par clic-glisser, ou petit serveur local lancé sur le PC) et l'ouverture d'un fichier HTML local dans Chrome sur la tablette Android (repli : servir le jeu depuis le PC sur le wifi de la maison, `npm run preview -- --host`, la tablette ouvrant l'adresse du PC ; on reste « en local » au sens du foyer).

## 3. Jalons

| Jalon | Contenu | Livrable testable | Sessions (estim.) |
|---|---|---|---|
| J0 | Socle du projet et prototype technique | `cubes.html` minimal : marcher, casser/poser, test voix, compteur d'images | 1 à 2 |
| J1 | Monde : chunks, terrain, textures, jour/nuit, eau | Se promener dans un monde généré | 2 |
| J2 | Interaction : visée, casser/poser, inventaire, sons | Construire une cabane au clavier | 1 |
| J3 | Tactile et performances tablette | Construire la même cabane sur la tablette | 1 à 2 |
| J4 | Profils, sauvegarde, export/import, mode parent | Deux enfants retrouvent chacun leur monde | 1 |
| J5 | Compagnon, moteur de missions, créatures, lampe, clôture | Le compagnon parle ; les créatures rôdent la nuit | 2 |
| J6 | Tutoriel, mission 1 complète, finitions | Mission 1 jouable de bout en bout | 2 |
| J7 | Recette V1 avec les enfants, corrections | Version 1.0 | 1 |

Total indicatif : 11 à 13 sessions de travail, au fil de l'eau.

### J0 — Socle et prototype technique

Mise en place du projet (Vite, TypeScript, Three.js, single-file, Vitest, Playwright), `CLAUDE.md`, `README.md` (comment jouer : double-clic sur `dist/cubes.html` ; comment développer : `npm install`, `npm run dev`, `npm run build`, `npm test`).

Prototype volontairement laid : monde plat 32 × 32, déplacement clavier, Pointer Lock, casser/poser un bloc, compteur d'images par seconde, joystick tactile rudimentaire, bouton « test voix » qui liste les voix disponibles et prononce une phrase en français.

Tests à faire par Pierre : ouverture par double-clic sur le PC (Edge et Chrome), ouverture sur la tablette (fichier copié via OneDrive ou câble), lecture des voix, images par seconde.

Porte de décision à la fin du J0 : Pointer Lock fonctionnel ou repli ; voix française disponible ou repli ; au moins 30 images par seconde sur la tablette ou réduction du monde ; mode de chargement retenu pour la tablette (fichier local ou serveur sur le PC).

### J1 — Monde

Chunks, maillage avec suppression des faces cachées, génération de terrain à graine, atlas de textures procédurales, éclairage jour/nuit (couleur du ciel, intensité), eau, arbres et fleurs. Physique du joueur. Mesure des performances et réglage de la distance de rendu.

### J2 — Interaction et inventaire

Visée par raycast avec surbrillance du bloc ciblé, casse (courte pression avec barre de progression, pour éviter les casses accidentelles), pose, barre d'inventaire à neuf cases avec compteurs (les blocs cassés sont ramassés : le comptage est le support de la mission 1). Sons synthétisés. Première session de test avec les enfants : consigne libre « construis une cabane ».

### J3 — Tactile et performances

Joystick virtuel, regard au doigt, boutons, détection du tactile, plein écran, verrouillage paysage, taille des cibles adaptée aux petits doigts, réglage des performances tablette (distance de rendu, résolution du rendu). Test des enfants sur la tablette.

### J4 — Profils, sauvegarde, mode parent

Écran d'accueil avec deux profils (prénom, avatar), « nouveau monde » ou « continuer », sauvegarde automatique toutes les 30 secondes et à la fermeture, export/import, mode parent avec ses réglages et la progression.

### J5 — Compagnon, missions, créatures

Compagnon qui suit le joueur, bulle de dialogue, lecture vocale, bouton « répète ». Moteur de missions déclaratif avec variantes par profil. Créatures rigolotes et leurs comportements ; bloc lampe et bloc clôture fonctionnels ; signal d'arrivée de la nuit (son, ciel).

### J6 — Tutoriel, mission 1, finitions

Mission 0 (tutoriel, trois étapes : se déplacer, casser, poser) puis mission 1 « Construis un abri avant la nuit » telle que décrite dans le brief, écran de félicitations, récompense visuelle. Textes en deux variantes. Test complet avec les deux enfants, corrections.

### J7 — Recette V1

Vérification des quatre critères de réussite du brief avec les enfants, corrections, version 1.0, mise à jour de la documentation, tri du backlog V2.

## 4. Organisation du travail

En session Cowork : je code et je teste côté cloud (tests unitaires, Chromium sans interface, captures d'écran que je relis), puis je dépose `src/`, `docs/`, les fichiers de configuration et `dist/cubes.html` dans le dossier `Minecraft`. Chaque fichier déposé reste sous 20 Mo.

De ton côté : tester sur PC et tablette, faire tester par les enfants, noter les retours dans `docs/RETOURS.md` ou me les donner en session.

Avec Claude Code sur ton poste : `npm install` puis `npm run dev` pour développer, `npm run build` pour régénérer `dist/cubes.html`, `npm test` pour les tests. Vite 7 exige Node.js 20.19 ou plus récent (à vérifier sur ton poste ; la version de Vite retenue au J0 pourra exiger davantage). `CLAUDE.md` décrit l'architecture et les règles du projet : tout inliné, aucun asset externe, textes en deux variantes, aucun emprunt à Minecraft.

Piège OneDrive : `node_modules` contient des dizaines de milliers de fichiers ; dans un dossier synchronisé il ralentit fortement OneDrive. Deux options : ne rien installer localement (tout passe par Cowork), ou travailler localement dans un clone git hors OneDrive, avec un dépôt GitHub privé comme référence et sauvegarde. Le choix se fait au J0.

## 5. Risques et parades

| Risque | Effet | Parade |
|---|---|---|
| Performances insuffisantes sur la tablette | Jeu saccadé, abandon | Monde petit, distance de rendu réglable, mesure dès J0, greedy meshing en réserve |
| Pointer Lock indisponible en `file://` | Pas de regard souris | Test J0 ; repli clic-glisser ou serveur local |
| Aucune voix française de synthèse | Consignes non lues pour le lecteur débutant | Test J0 ; repli icônes + sons ; option : enregistrer la voix d'un parent (fichiers audio embarqués, taille en hausse) |
| Fichier HTML local non ouvrable sur Android | Le jeu ne se lance pas sur la tablette | Test J0 ; repli serveur sur le PC via le wifi domestique |
| Ergonomie inadaptée à 7 ans | Frustration | Tests enfants dès J2, tutoriel J6, gros boutons, aucun échec bloquant |
| Dérive de périmètre (quatre domaines pédagogiques) | V1 jamais terminée | Périmètre gelé, une seule mission en V1, backlog V2 |
| `node_modules` dans OneDrive | Synchronisation dégradée | Voir section 4 |
| Perte de sauvegarde (vidage du navigateur) | Monde perdu | Export JSON proposé régulièrement, rappel en mode parent |

## 6. Backlog V2 (non planifié)

Missions 2 à 5, une par domaine : mots à composer en blocs-lettres (lecture/écriture) ; construction symétrique à compléter (mathématiques) ; maison qui garde la chaleur la nuit et plantes à arroser (sciences) ; suite d'ordres à donner au compagnon pour franchir un parcours (logique). Puis : craft simple (planches à partir de tronc), animaux à nourrir, météo, musique d'ambiance, nom définitif choisi par les enfants, blocs et biomes supplémentaires.

## 7. Éléments non vérifiés à confirmer

Présence et version de Node.js sur le poste ; modèle de la tablette Android et ses performances WebGL ; voix de synthèse françaises sur PC et tablette ; Pointer Lock et ouverture `file://` sur PC et Android ; estimations de sessions ; taille du fichier final. Les quatre premiers points sont levés par le J0.

## Sources

- Three.js, dernière version : [Release r186 · mrdoob/three.js](https://github.com/mrdoob/three.js/releases/tag/r186)
- Fichier unique : [vite-plugin-singlefile](https://github.com/richardtallent/vite-plugin-singlefile)
- Prérequis Node.js de Vite 7 : [Vite 7.0 is out!](https://vite.dev/blog/announcing-vite7)
