# CLAUDE.md — projet « Cubes »

Jeu de construction en blocs 3D, éducatif, pour deux enfants (6 ans lecteur débutant, 8 ans lecteur autonome). Navigateur, hors ligne, un seul fichier HTML. Appareil des enfants : un convertible Windows 10 (Acer Nitro 5 Spin NP515-51) replié en mode tablette, sous **Firefox** (pas de tablette Android) ; il peut aussi être déplié (clavier, pavé tactile). Lire `docs/BRIEF.md` (le quoi) et `docs/PLAN.md` (le comment, jalons J0 à J8) avant toute modification ; `docs/RECETTE-V1.md` dit ce que la V1 livre et comment c'est vérifié ; `docs/V2-LOT1.md` donne la conception du lot 1 de la V2 (J8 : fabrication, verre, mission 2, suites de recette) et les décisions de Pierre, qui l'emportent sur le reste du document. `docs/JOURNAL.md` tient l'état d'avancement session après session : le mettre à jour à chaque fin de session. `docs/FICHE-SEANCE.html` est la fiche imprimable (A4, deux pages) que Pierre remplit au test de la version 1.1-rc2 et à la séance avec les enfants ; `docs/MISSION3.md` est la conception de la mission 3 « Le miroir » (mathématiques), proposée le 06/11/2026, **non validée par Pierre et non codée** (décisions en attente à son §18).

## Commandes

- `npm install` — Node.js ≥ 22.12 requis (Vite 8 / Vitest 5).
- `npm run dev` — serveur de développement avec rechargement.
- `npm run build` — vérification des types puis production de `dist/cubes.html` (fichier unique, le seul livrable).
- `npm run typecheck` — deux passes : `tsconfig.json` (code du jeu, sans types Node) et `tsconfig.node.json` (tests et configuration).
- `npm test` — tests unitaires Vitest (`tests/unit`).
- `npm run test:e2e` — tests de fumée Playwright sur `dist/cubes.html` ouvert en `file://` (lancer `npm run build` avant ; `npx playwright install chromium` une fois). Dans l'environnement cloud de Claude Code, le Chromium préinstallé n'est pas celui qu'attend Playwright : préfixer toute commande Playwright par `CUBES_CHROMIUM=/opt/pw-browsers/chromium` (lu par `playwright.config.ts`) et ne pas lancer `playwright install` ; sur 4 processeurs, `--workers=3` au plus. En local, rien à régler.
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
              (bruit à graine), dayNight (cycle, soir retenu à 17 h, heures de départ de la mission 2), raycast (DDA,
              portée REACH), physics (AABB), random, inventory (sac de 9 cases, une par type, 99 max, format de
              sauvegarde, blocs protégés : discardVerdict, slotToEmpty), breaking (casse par appui maintenu :
              progression, verrou, écart de répétition), creatures (Grignotes : jour, nuit, vol, lampe, clôture,
              bulles, jamais nées dans un enclos), shelter (abri de la mission 1 : toit, 3 murs, fait ou creusé par
              l'enfant), pit (enfant coincé : grimper ou casser), crafting (recettes 1 tronc → 2 planches,
              2 planches → 1 clôture, 1 sable → 2 verres ; tout ou rien, réserve de la mission), words (lecture des
              mots en blocs-lettres dans le monde : rangées, colonnes, sens de lecture, meilleur essai ; ligne de
              cases claires lisible et visable d'où l'on est : planLine, canAimAt)
src/render/   SceneView (Three.js, brouillard, mer au-delà des bords, perte de contexte), ChunkRenderer (sections en
              cinq couches : opaque, découpe, verre au contact de l'eau, eau, verre ; file par distance, budget par
              image, distance de rendu), mesher (pur : faces visibles, occlusion ambiante, eau, verre et verre au
              contact de l'eau, fleurs en croix, cases claires sans faces communes), atlas (disposition pure,
              8 × 8 tuiles), textures (dessin), font (police 5 × 7 des blocs-lettres, pure), LetterGhosts (cases claires
              et contours de la mission 2), Sky (soleil, lune, étoiles), fov (champ de vision élargi en portrait, pur),
              Avatar (personnage en blocs), boxModel, Fox (Pixel), Critters (Grignotes), Bubbles, LampGlow (halo des
              lampes la nuit)
src/input/    Keyboard, MouseLook (Pointer Lock + repli glisser/appui), mouseFilter (fonctions pures), TouchControls
              (joystick fixe, reprise par un nouveau doigt, bouton plein écran, 400 ms sans poser ni casser après la
              fermeture d'un écran : guardAfterOverlay), touchZones (zone du joystick, pur), breakPress (appui
              « casser » commun souris/tactile, pur), slotHold (appui long qui vide une case, doigt, souris ou
              touche 1 à 9 ; durée gardée dans chaque appui, durationMs : 1 s par défaut, 0,8 / 1 / 1,2 s au mode
              parent, &appui= en mode adresse ; touchcancel après durée − 100 ms, slotHoldCancelOkMs, = appui allé au
              bout, slotHoldAfterCancel, même si la fenêtre perd le focus avant, slotHoldAfterBlur ; pur)
src/audio/    sounds (sons synthétisés Web Audio, recettes pures, contexte créé au premier geste)
src/game/     Game (assemblage + boucle protégée + `window.cubesDebug`, session, sauvegarde auto, vue 3e personne, écrans
              posés sur le jeu, fabrication et écriture branchées), Player (marches, eau, escalade de secours),
              urlOptions (#monde=…, &mission=0|1|2, &lecture=, &appui= ; formatUrlOptions réécrit
              l'adresse avec monde, graine, distance et appui), avatars (dessins, pur), thirdPerson (caméra, pur),
              companion (déplacement de Pixel, pur), identity (nom et version du jeu : le seul endroit à changer),
              renderDistance (distance au démarrage : adresse, puis `cubes:distance`, puis 96)
src/edu/      Speech (synthèse vocale, voix locales préférées), texts (messages en deux variantes, niveaux de lecture),
              counting (noms comptables, nombres en lettres accordés, phrases de ramassage), Narrator (affiche la
              variante du niveau, lit à voix haute, anti-répétition, dictée lue même voix coupée ; cancelDelayedSpeech
              annule la lecture différée, pas la dictée), missions (moteur
              déclaratif : tutoriel, mission 1, mission 2 ; MissionRunner porte le relevé du temps par mot,
              beginWordStats, noteActiveTime, noteWordFail, noteWordHelp ; wordStatsLines pour le mode parent ;
              objectifs ramasser/poser/casser/marcher/abri/observer/
              lettre/écrire, soir retenu par étape, lampe à découvrir, campagne, étoiles, consignes au doigt, libellés
              pour l'adulte, shelterPassed : abri de la mission 1 passé, marteau acquis), craftTexts (textes de
              fabrication calculés : additions, refus, présentation du marteau ; craftBlocker : refus à dire à
              l'ouverture du panneau quand rien n'est possible),
              wordLists (mots par niveau et palier, noms dits des lettres, prénom sans accent), wordHelp (aide
              progressive de la copie et de la dictée, pur), wordTexts (textes de la mission 2, gabarits),
              writingFeedback (réaction à un essai d'écriture, pur), wordStats (temps par mot de la mission 2 pour
              l'adulte : relevé en jeu actif, essais non réussis, aides, mot remplacé, lecture robuste, lignes du mode
              parent, helpsFromOutput ; pur)
src/ui/       Hud (DOM natif, pas de framework ; barre, case ABC, appui long, marteau), HomeScreen (accueil, profils,
              trois mondes, étoiles, mode parent, progression et temps par mot, réglage de l'appui long, date et
              rappel d'export), avatarIcon, nearestSlot (case
              la plus proche d'un toucher, pur), Celebration (écran de félicitations), CraftPanel (panneau de cartes
              de la fabrication ; tons de la ligne d'état : craftToneClass), LetterTray (boîte à lettres de la
              mission 2), wordIcon (mot en lettres-blocs : bandeau, félicitations), pixelFace (visage de Pixel,
              bandeau et boîte), shelterIcon (pictogramme de l'abri), fatal (écran d'erreur lisible)
src/save/     worldDiff (écart avec le monde régénéré depuis la graine, base64, pur), saveFormat (formats, lecture robuste,
              clés `cubes:`, réglages communs dont slotHoldMs, pur), SaveStore (stockage local, export/import)
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
- Écrans posés sur le jeu (V2) : panneau de fabrication, boîte à lettres, félicitations. Chacun refuse de s'ouvrir si le jeu est en pause (`paused`), gèle le jeu par `Game.freezeForOverlay()` (souris libérée, casse, doigts, clavier et appui long remis à zéro) et, pour le panneau et la boîte, se ferme sans bruit dans `Game.closeOverlays()` (accueil, nouveau monde, chargement, changement d'adresse, autre onglet), qui oublie aussi la lettre en main et les cases claires, et remet le doigt en mode Casser (toute partie d'enfant et tout nouveau monde commencent en mode Casser). La suite de la campagne (mission en attente du matin, suite des félicitations) n'est oubliée que par `goHome` (accueil, autre onglet) : en mode adresse, un nouveau monde la garde (il commence à 8 h, la mission 2 démarre à son échéance) ; une partie d'enfant la relit dans sa sauvegarde (`startMission`). Au doigt, la boîte et le panneau suivent le dernier doigt posé sur la croix, une lettre ou une carte (il reprend le geste, l'ancien n'agit plus) ; un doigt posé sur le voile, ou sur rien qui agisse, pendant qu'un autre doigt est posé (le doigt suivi, ou un doigt sur la barre, que le panneau ne voit pas : pouce qui tient l'appareil) ne reprend pas le geste ; un doigt suivi sur le voile du panneau est oublié quand un doigt se pose hors du panneau (la barre) ; la fenêtre qui perd le focus oublie le doigt suivi. Un doigt dont la fin se perd, ou une paume sur le voile, ne bloque jamais l'écran. Après la fermeture au doigt d'un écran (lettre choisie, boîte, panneau, félicitations), `TouchControls.guardAfterOverlay()` : un doigt posé sur le jeu dans les 400 ms regarde mais ne pose ni ne casse (second toucher d'un double toucher). Un nouvel écran suit les mêmes règles. Panneau de fabrication ouvert, les annonces passent par `Game.notify` (ligne d'état du panneau).
- Clavier (V2) : **F** = fabriquer (ouvre et ferme le panneau ; F et Échap sont lus avant le test de pause, seulement pour le fermer) ; **0** = boîte à lettres (mission 2) ; garder **1 à 9** la durée de l'appui long (1 s par défaut) vide la case. Panneau de fabrication ouvert, 1 à 9 restent actifs (choix de la case et appui long, `Game.pressSlotKey` ; l'annonce va dans la ligne d'état du panneau) ; 0 et les autres touches n'y font rien. Tout par `KeyboardEvent.code`, sauf la lettre tapée boîte ouverte (règle 4).
- Tests de fumée : Playwright n'a ici que Chromium ; tout comportement propre à Firefox (appareil des enfants) se vérifie à la main par Pierre, à noter dans le protocole de `RETOURS.md`. Profils : `pc`, `tablette` (le convertible en portrait, 1080 × 1802) et `tablette-paysage` (1920 × 1080, seulement les cas dont le titre contient `@tactile`). L'option `hasTouch` de Playwright fait passer un PC pour une tablette (`pointer: coarse`) ; pour simuler un PC à écran tactile, garder le profil PC et envoyer les touchers par CDP (`Input.dispatchTouchEvent`).
- Sauvegardes (J4) : un monde = type + graine + écart ; toute modification du générateur qui change le terrain d'une graine doit incrémenter `GENERATOR_VERSION` (`terrain.ts`) et garder la lecture des anciens mondes (test « empreinte du terrain »).
- Écran des enfants (J7) : panneau « Tests » et ligne d'infos masqués pendant leurs parties (réglage `devTools` du mode parent), toujours visibles en mode adresse. Dans un test de partie d'enfant qui en a besoin : `firstLaunch(page, info, true)` coche la case, ou lire la ligne d'infos par `textContent`. Sélecteur de la ligne d'infos : `.hud > .info` (constante `INFO` de `smoke.spec.ts`). La ligne d'état du panneau de fabrication (`.craft-status`) porte ses tons en `tone-info`, `tone-ok`, `tone-no` (`craftToneClass`, `CraftPanel.ts`).
- Tests de fumée : sans rien dans l'adresse, l'accueil s'affiche (voir les cas J4) ; `#monde=…&graine=…` le saute et n'enregistre rien. En mode adresse, Grignotes et compagnon/mission sont coupés sauf `&creatures=1` / `&mission=0` (tutoriel), `&mission=1` (mission 1) ou `&mission=2` (mission 2, démarrée tout de suite, même la nuit) (ils perturberaient les autres scénarios) ; `&lecture=autonome` (ou `debutant`) fixe le niveau de lecture ; `&appui=<ms>` (500 à 2000, sinon ignoré : 1 s) fixe la durée de l'appui long, car le mode adresse ne lit pas le réglage du mode parent. Seul `&appui` reste dans l'adresse réécrite au chargement, à un nouveau monde et au changement de distance (un F5 le garde) et il est relu quand l'adresse change sans rechargement ; les autres options (`&mission`, `&lecture`, `&creatures`, `&heure`) sont effacées de l'adresse réécrite (un F5 les perd). En mode adresse, le marteau est toujours là, sauf avec `&mission=0`. Une partie d'enfant commence par le tutoriel si son profil ne l'a pas fait (`tutorialDone`) : en tenir compte dans les scénarios « premier lancement ». Ouvrir `#monde=plat&graine=1` (monde plat du J0, positions connues) pour les scénarios d'interaction ; attendre `!window.cubesDebug.state().loading`. `window.cubesDebug` donne l'état (sac, progression de casse, niveau de lecture, sons, mission, abri, félicitations, cadeau en attente compris), oriente le regard, téléporte, remplit ou vide le sac, pose ou casse un bloc selon les règles du jeu, lit un pixel juste après le rendu et provoque une perte de contexte 3D.
- `cubesDebug`, ajouts du J8 (V2 lot 1). Méthodes : `emptySlot(i)` (même chemin que l'appui long, renvoie le verdict), `openCraft()`, `closeCraft()`, `craft(id)` (`planches`, `cloture`, `verre` ; mêmes règles que la carte, réserve de la mission comprise, sans les délais du doigt), `openLetters()`, `chooseLetter(ch)`, `assumeVoice(v)` (force la présence d'une voix française ; `null` rend la détection), `checkWriting()` (relit le mot tout de suite, comme si l'enfant s'était arrêté), `advanceWritingClock(ms)` (avance l'horloge d'aide), `skipMissionStep()` (valide l'étape en cours, tout objectif). `state()` gagne `player.yaw` et `player.pitch`, `slotHold`, `eveningHeld`, `lampRevealed`, `pendingMission`, `craft` (`available`, `open`, `glow`, `status`, `cards`, `intro`), `craftSeen`, `letters`, `writing` (dont `ghostCells` : les cases claires affichées, `[x, y, z]` dans l'ordre du mot), `words` ; `timeBoost` couvre les deux ×30 (dernière étape de la mission 1, attente du matin). Ajouts de la 1.1-rc2 : `state().slotHoldMs` (durée effective de l'appui long) et `state().wordStats` (forme enregistrée `{ words, current?, totalMs? }`, en ms de jeu actif, ou null ; au niveau racine et non dans `state().mission`, que plusieurs tests comparent à `{ step, done }`) ; `advanceWritingClock(ms)` compte aussi ce temps comme du jeu actif une fois la consigne dite.
- Mission 2 dans un test : `#monde=plat&graine=1&mission=2`. Chromium sans écran n'a pas de voix française : un test de dictée appelle `assumeVoice(true)` (sinon la dictée devient une copie). Les aides se testent par `advanceWritingClock`, pas en attendant.
- Cases claires (revue du J8) : `planLine` ne trace une ligne que là où le mot se lira de face et seul, et où chaque case se pose depuis l'œil de l'enfant, à portée (`canAimAt`, `REACH` = 6 ; une fleur voisine n'est pas un appui, le jeu pose à sa place) : jamais derrière un mot déjà écrit ni derrière un mur. Sinon ligne décalée sur le côté (première case dans le champ), sinon une ligne dont une case au moins est dans le champ (mot long : un prénom de 10 lettres, à portée, va de 59° à gauche à 53° à droite ; regard en biais de 30° ou plus : aussi sur l'autre axe), sinon pas de ligne et nouvel essai toutes les 0,5 s ; sans case claire montrée au seuil des 30 s, l'aide dit de se tourner vers un sol plat (`GHOST_NO_PLACE`), la lettre suivante ayant été dite à 25 s. Copie : cases claires dès la consigne au mot 1 seulement ; à partir du mot 2, aucune avant 15 s (case suivante), la ligne à 30 s : appeler `advanceWritingClock(31_000)` avant de lire `ghostCells`. Dans un test, poser dans les cases tracées (`state().writing.ghostCells`) en visant comme l'enfant (`aimAndPlace` : `look` puis `placeBlock`) ; plusieurs mots depuis l'apparition du monde plat : regarder vers +Z (`look(180, 0)`), la place libre, ou tourner la tête s'il n'y a pas de ligne.
- Mise en page (J8) : les cas « mise en page » de `smoke.spec.ts` (`@tactile`, trois profils) mesurent les boîtes du HUD (`HUD_LAYOUT`, `layoutBoxes`) et vérifient qu'aucune ne déborde de l'écran ni n'en chevauche une autre (`layoutProblems`), et l'ordre de la colonne tactile (`expectTouchColumn`). Tout nouvel élément d'interface s'ajoute à `HUD_LAYOUT`, qui contient l'anneau de l'appui long (`.slot-hold.visible` ; le nom du bloc ne compte pas pendant un appui, `.hud:not(.slot-holding) .slot-name.visible`). Panneau de fabrication : `CRAFT_LAYOUT` (feuille, barre, anneau, pastilles). Aides : `layoutBoxesDuringHold` (mesure dans l'image où l'anneau se montre), `slotPress`, `craftPlanksDeltasRisen` (pastilles en haut de leur montée), `synthTouches` (touchers synthétiques sur un écran posé sur le jeu, doigt fantôme compris). Quand « Tests » est visible, le bandeau de Pixel descend sous la ligne d'infos jusqu'à 1100 px de large, et se rétrécit au-delà.
- Réglages et relevés de la 1.1-rc2. Appui long : réglage commun `Settings.slotHoldMs` (800, 1000 ou 1200 ; autre valeur ou absent : 1000), section « Appui long pour vider une case » du mode parent, vaut pour la partie suivante ; la ligne d'infos se termine par « appui 0,8 s » ou « appui 1,2 s » quand la durée n'est pas 1 s. Temps par mot : champ optionnel `mission.wordStats` de la progression d'un monde (chaque relevé : `{ word, mode, ms, fails, helps, replaced? }`, 10 au plus) ; jeu actif = onglet visible, monde chargé, jeu non figé, boîte à lettres comprise, ni panneau de fabrication, ni félicitations, ni accueil, ni chargement, 250 ms au plus par image ; d'une consigne d'écriture au mot trouvé (total : de la première consigne d'écriture aux félicitations). Mode parent : blocs `.parent-word-stats[data-profile][data-slot]` (titre `.parent-word-stats-title`, lignes `li`), distincts de `.parent-progress li`. La 1.1-rc relit ces deux champs sans dégât mais les efface en réenregistrant (réglages, monde) ; le mode parent signale alors les mots « non relevé » et une durée « partielle ».
- Tests de fumée sous charge (1.1-rc2) : avant un clic qui suppose la souris capturée, `waitMouseLocked` (le jeu n'apprend la capture que par `pointerlockchange`) ; après un glisser du regard, `waitLookSettled` ; attendre un état (`expect.poll`) plutôt qu'un délai fixe (le temps du jeu est borné à 50 ms par image, et SwiftShader peut passer plusieurs centaines de ms par image en portrait).
- Temps (V2) : les étapes marquées `holdEvening` (tutoriel, mission 1 jusqu'à l'abri, mission 2) retiennent le soir à 17 h, « Temps ×20 » compris ; dans un test, `setHour` (boutons Soir et Nuit) passe outre. La mission 2 ne commence que de jour (6 h 30 à 16 h 30), sauf forcée par l'adresse.
- Casser demande un appui maintenu (J2) : dans un test, `mouse.down`, attendre que le bloc soit devenu de l'air, puis `mouse.up` ; un `click` ne casse rien.
- Sons et voix : le navigateur les bloque tant qu'il n'y a pas eu de geste (clic, touche, toucher) ; ne jamais lire ni jouer au démarrage.
- Rendu : pas de lumière Three.js. Les couleurs de sommets sont en linéaire (convertir depuis la luminosité perçue, voir `mesher.ts`) ; le jour/nuit passe par la couleur des matériaux (`SceneView.setSky`).

## État courant

Voir `docs/JOURNAL.md` (dernier jalon livré, tests attendus de Pierre, décisions ouvertes).
