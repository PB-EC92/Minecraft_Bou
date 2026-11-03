# CLAUDE.md — projet « Cubes »

Jeu de construction en blocs 3D, éducatif, pour deux enfants (6 ans lecteur débutant, 8 ans lecteur autonome). Navigateur, hors ligne, un seul fichier HTML. Appareil des enfants : un convertible Windows 10 (Acer Nitro 5 Spin NP515-51) replié en mode tablette, sous **Firefox** (pas de tablette Android) ; il peut aussi être déplié (clavier, pavé tactile). Lire `docs/BRIEF.md` (le quoi) et `docs/PLAN.md` (le comment, jalons J0 à J8) avant toute modification ; `docs/RECETTE-V1.md` dit ce que la V1 livre et comment c'est vérifié ; `docs/V2-LOT1.md` donne la conception du lot 1 de la V2 (J8 : fabrication, verre, mission 2, suites de recette) et les décisions de Pierre, qui l'emportent sur le reste du document. `docs/JOURNAL.md` tient l'état d'avancement session après session : le mettre à jour à chaque fin de session.

## Commandes

- `npm install` — Node.js ≥ 22.12 requis (Vite 8 / Vitest 5).
- `npm run dev` — serveur de développement avec rechargement.
- `npm run build` — vérification des types puis production de `dist/cubes.html` (fichier unique, le seul livrable).
- `npm run typecheck` — deux passes : `tsconfig.json` (code du jeu, sans types Node) et `tsconfig.node.json` (tests et configuration).
- `npm test` — tests unitaires Vitest (`tests/unit`).
- `npm run test:e2e` — tests de fumée Playwright sur `dist/cubes.html` ouvert en `file://` (lancer `npm run build` avant ; `npx playwright install chromium` une fois).
- `npm run preview` — sert `dist/` sur le réseau local (plus d'usage prévu : la tablette est un convertible Windows qui ouvre le fichier directement).

## Règles non négociables

1. **Un seul fichier, hors ligne.** Aucun asset externe, aucun CDN, aucun `fetch`. Textures dessinées sur canvas au démarrage (`src/render/textures.ts`), sons synthétisés par Web Audio, voix par `speechSynthesis`. Tout ce qui est ajouté doit survivre à une ouverture par double-clic sans réseau.
2. **Rien de Minecraft.** Ni le nom, ni les textures, ni les personnages, ni les noms de créatures. Univers original ; nom provisoire « Cubes ».
3. **Public : 6-8 ans.** Textes courts en français simple, toujours en deux variantes (débutant / autonome) quand ils s'adressent à l'enfant. Aucune mort, aucun combat, aucun échec bloquant. Gros boutons tactiles.
4. **Clavier par position physique** : `KeyboardEvent.code` (KeyW/KeyA/KeyS/KeyD → ZQSD en AZERTY). Jamais `event.key` pour le déplacement. Seule exception, qui est de la saisie : taper une lettre dans la boîte à lettres ouverte (mission 2, `LetterTray`) lit `event.key`.
5. **Le moteur (`src/engine/`) ne dépend pas de Three.js** ni du DOM : il est testé en Node par Vitest. Le rendu (`src/render/`) consomme le moteur.
6. **Identifiants de blocs stables** (`src/engine/blocks.ts`) : on ajoute à la fin, on ne renumérote jamais (sauvegardes).
7. **Clés de stockage préfixées `cubes:`** (en `file://`, Chrome et Edge partagent le `localStorage` entre tous les fichiers locaux ; Firefox le rattacherait au chemin exact du fichier, non vérifié : en tenir compte au J4).

## Architecture (voir `docs/PLAN.md` §2)

```
src/engine/   World (tableau plat + versions par section de 16³, bords = murs), blocks (propriétés, durée de casse,
              tables rapides, verre 17, lettres 18 à 43, dropsOf), terrain (types de monde, graine, apparition), noise
              (bruit à graine), dayNight (cycle, soir retenu à 17 h, heures de départ de la mission 2), raycast (DDA),
              physics (AABB), random, inventory (sac de 9 cases, une par type, 99 max, format de sauvegarde, blocs
              protégés : discardVerdict, slotToEmpty), breaking (casse par appui maintenu : progression, verrou, écart
              de répétition), creatures (Grignotes : jour, nuit, vol, lampe, clôture, bulles, jamais nées dans un
              enclos), shelter (abri de la mission 1 : toit, 3 murs, fait ou creusé par l'enfant), pit (enfant coincé :
              grimper ou casser), crafting (recettes 1 tronc → 2 planches, 2 planches → 1 clôture, 1 sable → 2 verres ;
              tout ou rien, réserve de la mission), words (lecture des mots en blocs-lettres dans le monde : rangées,
              colonnes, sens de lecture, meilleur essai)
src/render/   SceneView (Three.js, brouillard, mer au-delà des bords, perte de contexte), ChunkRenderer (sections en
              quatre couches : opaque, découpe, eau, verre ; file par distance, budget par image, distance de rendu),
              mesher (pur : faces visibles, occlusion ambiante, eau, verre, fleurs en croix), atlas (disposition pure,
              8 × 8 tuiles), textures (dessin), font (police 5 × 7 des blocs-lettres, pure), LetterGhosts (cases claires
              et contours de la mission 2), Sky (soleil, lune, étoiles), fov (champ de vision élargi en portrait, pur),
              Avatar (personnage en blocs), boxModel, Fox (Pixel), Critters (Grignotes), Bubbles, LampGlow (halo des
              lampes la nuit)
src/input/    Keyboard, MouseLook (Pointer Lock + repli glisser/appui), mouseFilter (fonctions pures), TouchControls
              (joystick fixe, reprise par un nouveau doigt, bouton plein écran), touchZones (zone du joystick, pur),
              breakPress (appui « casser » commun souris/tactile, pur), slotHold (appui long d'une seconde qui vide
              une case, doigt, souris ou touche 1 à 9, pur)
src/audio/    sounds (sons synthétisés Web Audio, recettes pures, contexte créé au premier geste)
src/game/     Game (assemblage + boucle protégée + `window.cubesDebug`, session, sauvegarde auto, vue 3e personne, écrans
              posés sur le jeu, fabrication et écriture branchées), Player (marches, eau, escalade de secours),
              urlOptions (#monde=…, &mission=0|1|2, &lecture=), avatars (dessins, pur), thirdPerson (caméra, pur),
              companion (déplacement de Pixel, pur), identity (nom et version du jeu : le seul endroit à changer),
              renderDistance (distance au démarrage : adresse, puis `cubes:distance`, puis 96)
src/edu/      Speech (synthèse vocale, voix locales préférées), texts (messages en deux variantes, niveaux de lecture),
              counting (noms comptables, nombres en lettres accordés, phrases de ramassage), Narrator (affiche la
              variante du niveau, lit à voix haute, anti-répétition, dictée lue même voix coupée), missions (moteur
              déclaratif : tutoriel, mission 1, mission 2 ; objectifs ramasser/poser/casser/marcher/abri/observer/
              lettre/écrire, soir retenu par étape, lampe à découvrir, campagne, étoiles, consignes au doigt, libellés
              pour l'adulte), craftTexts (textes de fabrication calculés : additions, refus, présentation du marteau),
              wordLists (mots par niveau et palier, noms dits des lettres, prénom sans accent), wordHelp (aide
              progressive de la copie et de la dictée, pur), wordTexts (textes de la mission 2, gabarits),
              writingFeedback (réaction à un essai d'écriture, pur)
src/ui/       Hud (DOM natif, pas de framework ; barre, case ABC, appui long, marteau), HomeScreen (accueil, profils,
              trois mondes, étoiles, mode parent, progression, date et rappel d'export), avatarIcon, nearestSlot (case
              la plus proche d'un toucher, pur), Celebration (écran de félicitations), CraftPanel (panneau de cartes
              de la fabrication), LetterTray (boîte à lettres de la mission 2), wordIcon (mot en lettres-blocs : bandeau,
              félicitations), pixelFace (visage de Pixel, bandeau et boîte), shelterIcon (pictogramme de l'abri), fatal
              (écran d'erreur lisible)
src/save/     worldDiff (écart avec le monde régénéré depuis la graine, base64, pur), saveFormat (formats, lecture robuste,
              clés `cubes:`, pur), SaveStore (stockage local, export/import)
tests/unit    Vitest — moteur et modules purs
tests/e2e     Playwright — fumée sur le fichier construit
```

## Conventions

- TypeScript strict (`noUncheckedIndexedAccess` activé) ; une classe ou un module par fichier ; commentaires et identifiants d'interface en français, code en anglais.
- Pas de dépendance ajoutée sans la noter dans `docs/JOURNAL.md` avec sa raison.
- Toute nouvelle fonctionnalité du moteur arrive avec un test unitaire ; toute nouvelle interface avec un cas dans `tests/e2e/smoke.spec.ts` si elle est vérifiable sans WebGL matériel.
- Avant de livrer : `npm run build` réussit, `npm test` passe, `dist/cubes.html` a été ouvert en `file://`.
- Le dossier vit dans OneDrive : ne jamais y écrire `node_modules` depuis Cowork ; en local, travailler dans le clone git hors OneDrive (voir `README.md`).
- Git : une session Cowork commite ses changements et redépose `cubes.git.bundle` ; une session Claude Code démarrée sur le dépôt GitHub `PB-EC92/Minecraft_Bou` commite et pousse sur sa branche (PR vers `main`). Messages de commit en français, préfixés par le jalon (ex. « J1 : … »).
- Aucun échec bloquant, y compris physique : toute nouvelle façon de se coincer (trou, piège de blocs) doit garder une sortie à la portée d'un enfant de 6 ans (aujourd'hui : l'escalade de secours, `Player`). De même pour les missions : toute étape doit pouvoir se valider quels que soient les réglages du mode parent (pas de nuit, pas de Grignotes) et l'état du sac (plein). Blocs protégés (V2) : une seule règle, `discardVerdict` (`inventory.ts`) avec `Game.keptBlocks()` (lampe, cadeau, bloc numérique de l'étape en cours), pour le vol des Grignotes, l'appui long, le conseil « sac plein » et la case que la fabrication fait remuer. Les lettres de la mission 2 ne vont jamais dans le sac.
- Écrans posés sur le jeu (V2) : panneau de fabrication, boîte à lettres, félicitations. Chacun refuse de s'ouvrir si le jeu est en pause (`paused`), gèle le jeu par `Game.freezeForOverlay()` (souris libérée, casse, doigts, clavier et appui long remis à zéro) et, pour le panneau et la boîte, se ferme sans bruit dans `Game.closeOverlays()` (accueil, nouveau monde, chargement, changement d'adresse, autre onglet), qui oublie aussi la lettre en main, les cases claires et la mission en attente du matin. Un nouvel écran suit la même règle. Panneau de fabrication ouvert, les annonces passent par `Game.notify` (ligne d'état du panneau).
- Clavier (V2) : **F** = fabriquer (ouvre et ferme le panneau ; F et Échap sont lus avant le test de pause, seulement pour le fermer) ; **0** = boîte à lettres (mission 2) ; garder **1 à 9** une seconde vide la case. Tout par `KeyboardEvent.code`, sauf la lettre tapée boîte ouverte (règle 4).
- Tests de fumée : Playwright n'a ici que Chromium ; tout comportement propre à Firefox (appareil des enfants) se vérifie à la main par Pierre, à noter dans le protocole de `RETOURS.md`. Profils : `pc`, `tablette` (le convertible en portrait, 1080 × 1802) et `tablette-paysage` (1920 × 1080, seulement les cas dont le titre contient `@tactile`). L'option `hasTouch` de Playwright fait passer un PC pour une tablette (`pointer: coarse`) ; pour simuler un PC à écran tactile, garder le profil PC et envoyer les touchers par CDP (`Input.dispatchTouchEvent`).
- Sauvegardes (J4) : un monde = type + graine + écart ; toute modification du générateur qui change le terrain d'une graine doit incrémenter `GENERATOR_VERSION` (`terrain.ts`) et garder la lecture des anciens mondes (test « empreinte du terrain »).
- Écran des enfants (J7) : panneau « Tests » et ligne d'infos masqués pendant leurs parties (réglage `devTools` du mode parent), toujours visibles en mode adresse. Dans un test de partie d'enfant qui en a besoin : `firstLaunch(page, info, true)` coche la case, ou lire la ligne d'infos par `textContent`. Sélecteur de la ligne d'infos : `.hud > .info` (constante `INFO` de `smoke.spec.ts`) et non `.info`, que la ligne d'état du panneau de fabrication porte aussi.
- Tests de fumée : sans rien dans l'adresse, l'accueil s'affiche (voir les cas J4) ; `#monde=…&graine=…` le saute et n'enregistre rien. En mode adresse, Grignotes et compagnon/mission sont coupés sauf `&creatures=1` / `&mission=0` (tutoriel), `&mission=1` (mission 1) ou `&mission=2` (mission 2, démarrée tout de suite, même la nuit) (ils perturberaient les autres scénarios) ; `&lecture=autonome` (ou `debutant`) fixe le niveau de lecture. En mode adresse, le marteau est toujours là, sauf avec `&mission=0`. Une partie d'enfant commence par le tutoriel si son profil ne l'a pas fait (`tutorialDone`) : en tenir compte dans les scénarios « premier lancement ». Ouvrir `#monde=plat&graine=1` (monde plat du J0, positions connues) pour les scénarios d'interaction ; attendre `!window.cubesDebug.state().loading`. `window.cubesDebug` donne l'état (sac, progression de casse, niveau de lecture, sons, mission, abri, félicitations, cadeau en attente compris), oriente le regard, téléporte, remplit ou vide le sac, pose ou casse un bloc selon les règles du jeu, lit un pixel juste après le rendu et provoque une perte de contexte 3D.
- `cubesDebug`, ajouts du J8 (V2 lot 1). Méthodes : `emptySlot(i)` (même chemin que l'appui long, renvoie le verdict), `openCraft()`, `closeCraft()`, `craft(id)` (`planches`, `cloture`, `verre` ; mêmes règles que la carte, réserve de la mission comprise, sans les délais du doigt), `openLetters()`, `chooseLetter(ch)`, `assumeVoice(v)` (force la présence d'une voix française ; `null` rend la détection), `checkWriting()` (relit le mot tout de suite, comme si l'enfant s'était arrêté), `advanceWritingClock(ms)` (avance l'horloge d'aide), `skipMissionStep()` (valide l'étape en cours, tout objectif). `state()` gagne `player.yaw` et `player.pitch`, `slotHold`, `eveningHeld`, `lampRevealed`, `pendingMission`, `craft` (`available`, `open`, `glow`, `status`, `cards`, `intro`), `craftSeen`, `letters`, `writing`, `words` ; `timeBoost` couvre les deux ×30 (dernière étape de la mission 1, attente du matin).
- Mission 2 dans un test : `#monde=plat&graine=1&mission=2`. Chromium sans écran n'a pas de voix française : un test de dictée appelle `assumeVoice(true)` (sinon la dictée devient une copie). Les aides se testent par `advanceWritingClock`, pas en attendant.
- Mise en page (J8) : les cas « mise en page » de `smoke.spec.ts` (`@tactile`, trois profils) mesurent les boîtes du HUD (`HUD_LAYOUT`, `layoutBoxes`) et vérifient qu'aucune ne déborde de l'écran ni n'en chevauche une autre (`layoutProblems`), et l'ordre de la colonne tactile (`expectTouchColumn`). Tout nouvel élément d'interface s'ajoute à `HUD_LAYOUT`. Quand « Tests » est visible, le bandeau de Pixel descend sous la ligne d'infos jusqu'à 1100 px de large, et se rétrécit au-delà.
- Temps (V2) : les étapes marquées `holdEvening` (tutoriel, mission 1 jusqu'à l'abri, mission 2) retiennent le soir à 17 h, « Temps ×20 » compris ; dans un test, `setHour` (boutons Soir et Nuit) passe outre. La mission 2 ne commence que de jour (6 h 30 à 16 h 30), sauf forcée par l'adresse.
- Casser demande un appui maintenu (J2) : dans un test, `mouse.down`, attendre que le bloc soit devenu de l'air, puis `mouse.up` ; un `click` ne casse rien.
- Sons et voix : le navigateur les bloque tant qu'il n'y a pas eu de geste (clic, touche, toucher) ; ne jamais lire ni jouer au démarrage.
- Rendu : pas de lumière Three.js. Les couleurs de sommets sont en linéaire (convertir depuis la luminosité perçue, voir `mesher.ts`) ; le jour/nuit passe par la couleur des matériaux (`SceneView.setSky`).

## État courant

Voir `docs/JOURNAL.md` (dernier jalon livré, tests attendus de Pierre, décisions ouvertes).
