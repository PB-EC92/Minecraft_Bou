# V2, lot 1 (jalon J8) — fabrication, verre, mission 2 « Les mots », suites de recette

Conception du 01/11/2026 : quatre fonctions conçues chacune par plusieurs propositions indépendantes (angles : l'enfant de 6 ans seul, la pédagogie, la simplicité technique), départagées par un juge puis intégrées en une spécification unique. Les spécifications détaillées par fonction ont servi à la réalisation ; ce document en garde l'ensemble et les décisions.

## Décisions de Pierre (01/11/2026)

Avant la conception :
1. Périmètre : V2 lot 1 = fabrication (planches, verre, clôtures) + mission 2 lecture-écriture (blocs-lettres, deux niveaux) + suites de la recette.
2. Sac plein : appui long sur une case pour la vider (jamais la lampe ni le cadeau).
3. Les troncs ne donnent plus de clôture : elle se fabrique.
4. Mission 1 : le soir s'arrête à 17 h tant que l'abri n'est pas construit.
5. Plus de texte « Adulte : garder appuyé 3 s » sous l'engrenage.
6. Lampe à découvrir : aucun indice avant que l'enfant l'ait vu.
7. Rappel d'export en mode parent (date du dernier export, rappel au-delà de 7 jours).

Après la conception (choix remontés par l'intégration) :
8. **Recettes à nous** : 1 tronc → **2** planches ; 2 planches → 1 clôture ; 1 sable → 2 verres (le rapport « 1 tronc → 4 planches » du jeu d'inspiration est écarté). Additions du débutant : « 2 + 2 = 4 planches ! » ; 1 tronc donne donc 1 clôture.
9. Blocs-lettres en **une seule encre sombre** (pas de code de couleur voyelles / consonnes).
10. Vider une case aussi **au clavier** : garder une touche 1 à 9 enfoncée une seconde.
11. Soir retenu à 17 h **aussi pendant le tutoriel et la mission 2** ; si la mission 1 finit la nuit, le temps file (×30) jusqu'au matin avant la mission 2.
12. Les lettres sont dites par leur **nom** (« emme »), pas par leur son.
13. La **dictée** de l'enfant de 8 ans est lue à voix haute même si sa voix est coupée (mots dictés et indices seulement) ; sans voix française, elle devient une copie.
14. Listes de mots proposées ; prénom écrit sans accent (LEA pour Léa).
15. Version affichée pendant ce lot : **1.1-rc** (la 1.0 sera déclarée après la recette avec les enfants).

Là où la spécification ci-dessous dit autre chose (par exemple « 1 tronc → 4 planches », « 4 + 4 = 8 », couleurs de lettres), **ces décisions l'emportent**.

---

Projet « Cubes », branche `claude/quirky-feynman-c3upak`, version 1.0-rc. Ce document assemble quatre spécifications retenues :

- la fabrication ;
- la mission 2 « Les mots » ;
- le bloc verre ;
- les suites de recette (décisions 2, 4, 5, 6 et 7).

Il fixe aussi les arbitrages entre elles, le découpage en paquets et l'ordre de réalisation. Les affirmations sur le code ont été vérifiées dans le dépôt : `Game.ts`, `Hud.ts`, `HomeScreen.ts`, `style.css`, `blocks.ts`, `inventory.ts`, `missions.ts`, `texts.ts`, `counting.ts`, `Narrator.ts`, `sounds.ts`, `mesher.ts`, `ChunkRenderer.ts`, `SceneView.ts`, `saveFormat.ts`, `SaveStore.ts`, `worldDiff.ts` et les tests.

Typographie : dans tous les textes, une espace insécable précède ! ? : ; et entoure + et =.

## 1. Périmètre et décisions

Décisions de Pierre, non rediscutées :

1. Fabrication simple : planches à partir d'un tronc, verre à partir de sable, clôture à partir de planches. Mission 2 « lecture-écriture » en deux niveaux.
2. Vider une case par un appui long d'environ 1 s, au doigt comme à la souris. Jamais la lampe ni le cadeau.
3. Les troncs ne donnent plus de clôture.
4. Le soir s'arrête à 17 h tant que l'abri de la mission 1 n'est pas construit.
5. Plus de texte sous l'engrenage du mode parent.
6. Aucun indice sur la lampe avant la découverte.
7. Date du dernier export et rappel au-delà de 7 jours.

Choix d'intégration adoptés sans les remonter à Pierre, tous justifiés par une règle de CLAUDE.md ou par le code :

- Le bloc demandé par l'étape en cours est aussi protégé de l'appui long (« Garde tes troncs ! »), selon la règle « aucun échec bloquant ».
- Le rendu du verre est celui de la spec « verre » : couche transparente.
- Les textes de la mission 2 vont dans un module à part (`wordTexts.ts`).
- La découverte de la lampe est comptée par monde : rien à stocker.
- Un monde repris entre 17 h et 18 h reste figé à son heure.
- La fleur peut se poser sur le verre.
- Le message « On voit à travers ! » est dit une fois par chargement de la page.
- La pause pendant la fabrication fonctionne comme pour les félicitations.
- Le débutant voit l'addition jusqu'à un total de 10.

Les vrais choix restants sont listés à part (`decisions_for_pierre`), avec une recommandation ; l'implémentation part de ces recommandations.

## 2. Identifiants (règle 6 : ajout à la fin, rien de renuméroté)

| Bloc | BlockId | Tuile(s) | Forme | Casse | Rapporte | Matière (son) |
|---|---|---|---|---|---|---|
| verre | 17 | 19 | `glass` (plein, visable, non opaque) | 300 ms | lui-même | stone |
| lettre A … Z | 18 … 43 | côtés 20 … 45, dessus et dessous Planks | `cube` (opaque) | 200 ms | rien (retour à la boîte) | wood |

- L'atlas passe à 8 × 8 tuiles (128 × 128 px), une seule fois. Les colonnes ne changent pas, donc les tuiles 0 à 18 restent à leur place.
- La tuile du verre est dessinée sans tirage aléatoire ; chaque lettre a son générateur `createRng(9100 + k)`. Aucune tuile existante ne change.
- `isInventoryBlockId` accepte désormais de 1 à 43. C'est voulu : `applyDiff` relit ainsi l'écart d'un monde contenant du verre ou des lettres. Le jeu ne met jamais de lettre dans le sac.

## 3. Paquets et propriété des fichiers

Les paquets purs ne touchent ni `Game.ts`, ni `Hud.ts`, ni `HomeScreen.ts`, ni `style.css`. Chacun garde `typecheck` et `test` verts avec le `Game.ts` actuel, grâce à des paramètres optionnels.

| Paquet | Contenu | Fichiers possédés | Dépend de |
|---|---|---|---|
| WP0 Fondation | registre (verre, lettres, `dropsOf`), comptage, textes communs, narrateur, sons | `engine/blocks.ts`, `edu/counting.ts`, `edu/texts.ts`, `edu/Narrator.ts`, `audio/sounds.ts` + tests `breaking`, `counting`, `narrator`, `sounds` | — |
| WP1 Sac, temps, sauvegarde | `discardVerdict`, `discard`, `slotToEmpty`, `slotHold`, `holdEvening`, `isMissionDaytime`, dernier export, `craftSeen` | `engine/inventory.ts`, `input/slotHold.ts`, `engine/dayNight.ts`, `save/saveFormat.ts`, `save/SaveStore.ts` + tests `inventory`, `slotHold`, `dayNight`, `save` | WP0 |
| WP2 Rendu | atlas 8 × 8, police, tuiles, `blockIcon`, couche verre, `ghostCubes`, `LetterGhosts` | `render/atlas.ts`, `font.ts`, `textures.ts`, `mesher.ts`, `ChunkRenderer.ts`, `SceneView.ts`, `LetterGhosts.ts` + tests `mesh`, `font`, `shelter`, `pit`, `raycast`, `physics`, `creatures` | WP0 |
| WP3 Fabrication | recettes, textes, panneau | `engine/crafting.ts`, `edu/craftTexts.ts`, `ui/CraftPanel.ts` + tests `crafting`, `craftTexts` | WP0 |
| WP4a Écriture | lecture des mots, réaction aux essais | `engine/words.ts`, `edu/writingFeedback.ts` + tests | WP0 |
| WP4b Mission 2 | listes, aide, textes, missions (et suites de recette dans `missions.ts`), adresse | `edu/wordLists.ts`, `wordHelp.ts`, `wordTexts.ts`, `missions.ts`, `game/urlOptions.ts` + tests | WP0 |
| WP4c Interface des lettres | boîte à lettres, `wordIcon`, `pixelFace` | `ui/LetterTray.ts`, `ui/wordIcon.ts`, `ui/pixelFace.ts` | WP0 |
| WP5 Intégration (une personne) | branchements, HUD, accueil, styles, tests de fumée, documentation, version | `Game.ts`, `Hud.ts`, `HomeScreen.ts`, `Celebration.ts`, `style.css`, `MouseLook.ts`, `TouchControls.ts`, `identity.ts`, `package.json`, `smoke.spec.ts`, `README`, `CLAUDE.md`, `docs/*` | tous |

Ordre : WP0 d'abord. Ensuite WP1, WP2, WP3, WP4a, WP4b et WP4c en parallèle. WP5 en dernier, avec un commit par volet : socle, recette, verre, fabrication, mission 2, styles, tests, documentation.

## 4. Règles transversales

### 4.1 Écrans posés sur le jeu et pause

- Le panneau de fabrication (z 25), la boîte à lettres (z 25), les félicitations (z 30) et l'accueil (z 20, plein écran) s'excluent : chacun refuse de s'ouvrir si `paused`.
- Tous gèlent le jeu par `freezeForOverlay()`. Effets : souris libérée, casse, doigts et appui « casser » remis à zéro, clavier vidé, appui long annulé, `paused = true`.
- Tous se ferment sans bruit dans `goHome`, `newWorld`, `loadSave`, `hashchange` et l'événement `storage` (`closeOverlays`). Avec eux : lettre en main, fantômes, horloge d'aide sont remis à zéro, et le doigt revient au mode Casser (le mode Poser pris pour une lettre ne passe pas à la partie suivante). `pendingMission` et `afterCelebration` (la suite de la campagne) ne sont oubliés que par `goHome` (accueil, autre onglet) : en mode adresse, un nouveau monde garde la mission 2 en attente ; une partie d'enfant la relit dans sa sauvegarde (revue du J8, constats 3 et 9).
- Panneau de fabrication ouvert : la barre passe au-dessus du voile (z 26), avec l'anneau de l'appui long. L'appui long reste actif, au doigt, à la souris et au clavier (touches 1 à 9), et les annonces vont dans la ligne d'état (`Game.notify`). La feuille laisse la place de l'anneau et des pastilles « −1 » / « +2 » entre elle et la barre (son bas à `--slot` + 94 px).
- Au doigt, la boîte et le panneau suivent le dernier doigt posé sur la croix, une lettre ou une carte : il reprend le geste, l'ancien n'agit plus (un doigt dont la fin se perd ne bloque jamais l'écran). Un doigt posé sur le voile, ou sur rien qui agisse, pendant qu'un autre doigt est posé (le doigt suivi, ou un doigt sur la barre, que le panneau ne voit pas : pouce qui tient l'appareil) ne reprend pas le geste ; un doigt suivi sur le voile du panneau est oublié quand un doigt se pose sur la barre. La fenêtre qui perd le focus oublie le doigt suivi.
- Après la fermeture au doigt d'un écran posé sur le jeu (lettre choisie, boîte ou panneau fermés, félicitations), un doigt posé sur le jeu dans les 400 ms regarde mais ne pose ni ne casse (`TouchControls.guardAfterOverlay`) : le second toucher d'un double toucher sur une lettre ou sur la croix ne pose pas la lettre ou le bloc en main.
- Clavier :
  - F et Échap sont traités avant le test de pause, seulement pour fermer le panneau ;
  - la boîte capture le clavier en phase de capture sur `window` (Échap, 0, lettres par `event.key` normalisé). C'est la seule exception à la règle 4, et c'est de la saisie, pas du déplacement.
- `onLockChange` ne dit plus « Clique pour jouer » pendant une pause.

### 4.2 Blocs protégés : une règle

- `keptBlocks()` renvoie le bloc numérique de l'objectif en cours (collect, place, break). « any » et « letter » sont ignorés.
- `discardVerdict(stack, keep)` donne : `empty`, `keep-lamp`, `keep-gift`, `keep-goal` ou `ok`. Il sert au vol des Grignotes, à l'appui long, au conseil « sac plein » (`slotToEmpty`) et à la case que la fabrication fait remuer (avec l'ingrédient et le résultat en plus).
- La réserve de fabrication est distincte : pendant une étape collect, on peut fabriquer tant qu'on ne passe pas sous le nombre demandé.
- `wouldLose` ne change pas. Le verre n'y est pas, pour qu'une boîte de verre fermée reste cassable.
- Les lettres ne sont jamais dans le sac. Elles ne peuvent donc être ni chipées, ni perdues, ni bloquées par un sac plein.

### 4.3 Temps

```
mult  = timeScale (×20 Tests) × (watchBoost ou attente du matin ? 30 : 1)
next  = advancePhase(phase, dt, mult, night)
phase = eveningHeld() ? holdEvening(phase, next) : next
```

- `eveningHeld()` exige : compagnon actif, mission non finie, et le drapeau `holdEvening` sur l'étape en cours.
- Le drapeau est posé sur : les 3 étapes du tutoriel, les étapes 0 à 2 de la mission 1, et les 5 étapes de la mission 2 (sous réserve de Pierre).
- La mission 2 ne démarre que de jour (6 h 30 ≤ h < 16 h 30). Si la mission 1 finit la nuit, la mission est mise en attente (`pendingMission`) et le temps passe à ×30 jusqu'au matin, sans carillon ni message de nuit.
- Les boutons Soir et Nuit du panneau Tests contournent la retenue.

### 4.4 Textes

- Textes communs (`texts.ts`, `counting.ts`) : un seul propriétaire, WP0. Le test des constantes vérifie toute `ChildText` exportée par `texts.ts`.
- Gabarits de la mission 2 : dans `wordTexts.ts`, vérifiés après remplissage.
- Textes de fabrication calculés : dans `craftTexts.ts`.
- Suffixes de l'aide d'écran : dans des objets `HINT_EXTRAS` et `LETTERS_HINT`, qui ne sont pas des `ChildText` isolées.
- Décision 6 :
  - `NIGHT_COMING` est réécrit ;
  - `NIGHT_COMING_LAMP` n'est dit que si `lampRevealed` est vrai : sans mission, mission 1 finie, ou mission 2 ;
  - `LAMP_SCARES` hors de l'étape « regarder » obéit à la même condition ;
  - la consigne de pose de la lampe ne dit plus pourquoi ;
  - aucun texte de fabrication, de mission 2 ou d'appui long ne parle de la lampe et des Grignotes.
- Libellés d'interface jamais lus, en une seule forme : « Fabriquer », « Fermer », « ABC », « lettre M ». Textes pour l'adulte (rappel d'export, note de l'engrenage) : une seule variante.

### 4.5 HUD et disposition (calculé depuis `style.css`, à mesurer par les tests de mise en page)

- **Ronds du haut**, en partant du bord droit :
  - avec Tests : œil 86, accueil 146, Bulles 206, **marteau 266** ;
  - sans Tests : 12, 72, 132, **192**.
  - Le bandeau de Pixel est limité à `calc(100vw − 660px)` au-dessus de 1100 px.
- **Colonne tactile**, de haut en bas : plein écran (`order −2`), **marteau** (`order −1`, orange), Casser, Sauter, Bulles. Le marteau est ajouté en fin de DOM : le premier `.touch-btn` reste le bouton de mode, ce que lisent les tests.
- **Portrait 1080 × 1802 sans lettres** :
  - barre de 212 à 868 px ;
  - colonne de 28 à 476 px depuis le bas ;
  - feuille de fabrication de x 60 à 1020, bas à 158 px (`--slot` + 94, voir §4.1).
- **Avec la case ABC** (classe `.letters-on`, `--slot` sur 10 cases) :
  - barre de 738 px (171 à 909) ;
  - jusqu'à 1120 px de large, le rond et la colonne remontent au-dessus de la barre (+90 px) ;
  - en paysage 1920 × 1080, rien ne bouge (barre de 591 à 1329).
- **Bandeau de Pixel, mission 2** : il passe à la ligne (`flex-wrap`) pour le modèle du mot ; le message central reste dessous (`placeMessageBelowCompanion`).

### 4.6 Accès de test (`window.cubesDebug`)

- `state()` gagne :
  - `player.yaw` et `player.pitch` ;
  - `craft`, `slotHold`, `eveningHeld`, `lampRevealed`, `pendingMission`, `letters`, `writing` (avec `ghostCells`, les cases claires affichées dans l'ordre du mot) ;
  - `timeBoost`, qui couvre les deux ×30.
- Nouvelles méthodes : `openCraft`, `closeCraft`, `craft(id)`, `emptySlot(i)`, `openLetters`, `chooseLetter`, `assumeVoice`, `checkWriting`, `advanceWritingClock`, `skipMissionStep`.

## 5. Déroulés résumés

### Fabrication

- Le marteau apparaît pendant l'étape abri de la mission 1. Pixel le présente au moins 15 s après le début de l'étape, une fois par partie, si :
  - il ne parle pas ;
  - aucune consigne n'attend ;
  - une recette est possible.
- Il réapparaît ensuite dans chaque monde dès que le profil l'a découvert (`craftSeen`). Il est aussi là dans tout monde dont l'abri de la mission 1 est passé (`shelterPassed`), même jamais présenté ni ouvert (monde de la 1.0-rc) : il brille jusqu'à la première ouverture, sans présentation de Pixel (revue du J8, constat 5).
- Panneau ouvert sans aucune recette possible : sac plein, la ligne d'état et la voix le disent et la case à vider remue ; au maximum de 99, le maximum est dit (`craftBlocker`) ; sinon « Il manque des blocs ! ».
- Deux touchers : le marteau (ou F), puis une carte.
- Trois recettes :

  | Recette | Ingrédient | Résultat |
  |---|---|---|
  | planches | 1 tronc | 4 planches |
  | clôture | 2 planches | 1 clôture |
  | verre | 1 sable | 2 verres |

- Retour donné à l'enfant :
  - addition en chiffres pour le débutant, jusqu'à 10 (« 4 + 4 = 8 planches ! »), dite en lettres ;
  - phrase complète pour l'autonome.
- Refus :
  - réserve de la mission ;
  - manque, avec indice de chaîne et lieu où trouver ;
  - maximum de 99 ;
  - sac plein, avec la case qui remue.
- Le dernier tronc se change en planches dans sa propre case. Un toucher fabrique une seule fois (250 ms au moins entre deux) ; la carte est armée 400 ms après l'ouverture.

### Verre

- Bloc plein et transparent : on voit à travers, on ne passe pas.
- Il compte pour l'abri et arrête les Grignotes. Il se casse en 0,3 s et revient dans le sac.
- « On voit à travers ! » est dit à la première pose de la page.
- Il est dessiné dans des couches transparentes, sans écriture de profondeur, avec un seul matériau. Ses faces au contact de l'air sont à l'ordre 2, après l'eau. Ses faces au contact de l'eau (couche `glassWet`, choisies face par face d'après le voisin) sont à l'ordre 0,5, avant l'eau, quand la caméra est hors de l'eau, et à l'ordre 2 quand elle est sous l'eau. Les défauts acceptés sont listés au §9.

### Mission 2

- Elle commence de jour, après la mission 1 et son écran de félicitations.
- Une 10e case « ABC » ouvre une boîte de 26 lettres illimitées. La lettre choisie va dans la main, se pose, et se casse sans rien rapporter.
- Étape 0 : poser une lettre.
- Étapes 1 à 3 : trois mots.
  - Le débutant recopie, avec modèle, syllabes, cases claires et aide graduée jusqu'à « Voici la lettre N ! ».
  - L'autonome écrit sous la dictée : mot, phrase, mot, lus même voix coupée. Les indices montent jusqu'à la copie ; on n'échoue jamais.
- Étape 4 : le prénom, sans accent.
- Le mot est lu par le moteur (`words.ts`) dans toute rangée lisible. Un mot à l'envers ou collé à un autre (dans un sens ou dans l'autre) est validé, avec un conseil.
- Cases claires (`planLine`, revue du J8) :
  - tracées seulement là où le mot se lira de face et seul : case côté enfant dans le monde et non opaque, appui qui n'est pas un bloc-lettre, aucune lettre juste derrière une case ni collée aux deux bouts ;
  - toujours posables d'où se tient l'enfant (`canAimAt` : visée depuis l'œil, portée `REACH` = 6 blocs, lettres d'avant posées) : jamais derrière un mot déjà écrit ni derrière un mur ;
  - sinon, une ligne décalée sur le côté, sa première case dans le champ ; sinon une ligne dont une case au moins est dans le champ, la première case la plus près du regard (un mot long, à portée, déborde des deux côtés du champ : 10 lettres à 3 blocs vont de 59° à gauche à 53° à droite ; regard en biais de 30° ou plus, aussi sur l'autre axe) ; sinon pas de ligne, seulement la consigne, et un nouvel essai toutes les 0,5 s quand l'enfant tourne la tête ou se déplace ;
  - copie : la ligne est montrée dès la consigne au premier mot seulement ; aux mots 2 et 3 et au prénom, la case suivante après 15 s sans progrès, « Maintenant, la lettre N ! » à 25 s, toute la ligne à 30 s. Sans case claire possible au seuil des 30 s, l'aide dit de se tourner vers un sol plat (« Tourne-toi vers un sol plat ! ») au lieu de « Remplis les cases claires ! » ;
  - la ligne reste en place quand on y pose des lettres ; une lettre fausse dans une de ses cases est signalée (« Ici, il faut un … », contour orange), jamais une lettre qui traîne ailleurs ;
  - les cases claires voisines ne dessinent pas leur face commune (y compris avec la case suivante) : pas de lettre écrasée entre deux lettres. Les blocs du monde ne cachent rien.
- Un mot déjà lisible au début d'une étape d'écriture (le prénom écrit plus tôt) la valide sans consigne.
- Fin : félicitations (mots écrits et cadeau de 5 blocs arc-en-ciel) et une deuxième étoile.

### Suites de recette

- Appui long sur une case :
  - anneau au-dessus de la case après 200 ms, case vidée à 1 s, son « pouf » (depuis la 1.1-rc2, durée réglable : 0,8 / 1 / 1,2 s au mode parent, `&appui=` en mode adresse ; 1 s par défaut) ;
  - annulé si le doigt glisse de plus de 18 px, au relâchement, à un changement de case ou à une pause (sauf panneau de fabrication) ;
  - un `touchcancel` reçu après au moins 900 ms d'appui vaut un appui allé au bout (parade pour Windows, `slotHoldAfterCancel`) ; avant 900 ms, l'appui est abandonné (depuis la 1.1-rc2 : durée − 100 ms, soit 700, 900 ou 1100 ms) ;
  - au clavier, garder la touche 1 à 9 enfoncée (sous réserve de Pierre).
- Soir retenu à 17 h : voir §4.3.
- Engrenage : plus de texte ; une note pour l'adulte sur l'écran de premier réglage.
- Lampe à découvrir : voir §4.4.
- Mode parent :
  - date du dernier export ;
  - rappel (« jamais », ou plus de 7 jours alors qu'il y a des mondes, ou date incertaine), avec un bouton « Exporter maintenant ». Une date d'export de plus d'un jour dans le futur (horloge en avance pendant l'export, puis remise à l'heure) s'affiche « Dernier export : date incertaine (l'horloge de l'ordinateur a changé). » et déclenche le rappel jusqu'au prochain export. Jusqu'à un jour d'avance, elle compte pour aujourd'hui ;
  - l'import retient la date du fichier si elle est plus récente.

## 6. Sauvegardes et compatibilité

- **Formats** : `SAVE_VERSION` (1), `GENERATOR_VERSION` (2), `WorldSave` et `ExportFile` ne changent pas. Le test « empreinte du terrain » ne bouge pas.
- **Ajouts** :
  - `Profile.craftSeen` (optionnel ; absent = faux) ;
  - `MissionProgress.words` et `word`, relus de façon robuste ;
  - clé `cubes:dernier-export`, hors du fichier d'export.
- **Mondes J4 à J7** :
  - relus à l'identique ;
  - les clôtures déjà gagnées restent ;
  - abri fini → mission 2 au matin, étoile gardée (`starsEarned` = 1) ;
  - `celebrate: true` → l'écran de la mission 1 passe d'abord ;
  - monde repris entre 17 h et 18 h avant l'abri → heure figée.
- **Retour à la 1.0-rc (à éviter)** : un monde contenant du verre ou des lettres a des octets 17 à 43 dans son écart. `applyDiff` renvoie alors −1 : la 1.0-rc garde une copie de secours, régénère le monde et prévient l'adulte. À écrire dans le JOURNAL, avec la consigne d'exporter avant la mise à jour.
- **Juste après la mise à jour**, le mode parent dira « Dernier export : jamais. » et, en tête, « Rappel : les mondes des enfants n'ont encore jamais été exportés. », faute de trace des exports faits avec la 1.0-rc.

## 7. Tests

- **Unitaires** : chaque paquet pur livre ses tests (détail dans chaque paquet). Tests nouveaux :
  - `crafting`, `craftTexts` ;
  - `slotHold` ;
  - `font` ;
  - `words`, `writingFeedback`, `wordLists`, `wordHelp`, `wordTexts`.
- **Unitaires complétés** : `breaking`, `counting`, `narrator`, `sounds` (12 sons), `inventory`, `dayNight`, `save`, `mesh`, `shelter`, `pit`, `raycast`, `physics`, `creatures`, `missions`, `urlOptions`.
- **Tests de fumée (Chromium)** :
  - 9 cas pour la fabrication et le verre ;
  - 10 pour les suites de recette ;
  - 14 pour la mission 2 ;
  - adaptation de trois cas existants : clôture des troncs, mission 1 de bout en bout, accueil et mode parent ;
  - relance de toute la suite sur les trois profils.
- **À la main par Pierre, sous Firefox sur le convertible** (protocole dans `RETOURS.md`) :
  - appui long au doigt : menu contextuel, `touchcancel` de Windows ;
  - Échap en plein écran ; recapture de la souris ;
  - rendu et images par seconde du verre ;
  - voix : noms des lettres, mots dictés ;
  - lisibilité des lettres ;
  - barre à 10 cases en portrait ;
  - durée réelle de la mission 2 ;
  - date d'export après un vrai téléchargement.

## 8. Documentation

À mettre à jour :

- `README` : sac et appui long, fabrication, mission 2, soir retenu, export, adresse `#mission=2` et `&lecture=` ;
- `CLAUDE.md` : architecture et conventions ;
- `PLAN` §2 et §6 ;
- `RECETTE-V1` §4 et §5 ;
- `RETOURS` : protocole V2 lot 1 ;
- `JOURNAL` : entrée de session ;
- version dans `identity.ts` et `package.json`.

## 9. Risques principaux (non vérifiés)

- **Firefox sous Windows au doigt** : appui long transformé en clic droit, ou `touchcancel` vers 1 s. Parade faite pendant la revue du J8 : un `touchcancel` reçu après au moins 900 ms d'appui sur une case vaut un appui allé au bout ; la case est vidée avec les règles de `discardVerdict` (refus dit pour la lampe, le cadeau ou le bloc de l'étape). Avant 900 ms, l'appui est abandonné. Une perte de focus au même moment ne l'empêche pas, qu'elle arrive avant ou après l'annulation (`slotHoldAfterBlur`, contre-vérification V6). Depuis la 1.1-rc2, passer l'appui à 800 ms ne demande plus de nouvelle version : réglage du mode parent (0,8 / 1 / 1,2 s) ou `&appui=800` en mode adresse, seuil du `touchcancel` à durée − 100 ms. À vérifier sur le convertible (protocole J8).
- **Doigt perdu sur un écran posé sur le jeu** (geste de Windows sans `touchcancel`, paume ou pouce sur le voile) : parade faite (§4.1, dernier doigt posé, voile ignoré tant qu'un autre doigt est posé, y compris sur la barre, oubli sur perte de focus ; 400 ms sans poser ni casser après la fermeture d'un écran). À vérifier sur le convertible.
- **Vidage involontaire** par l'enfant de 6 ans.
- **Barre à 10 cases en portrait** : le rond et la colonne remontent.
- **Visée au doigt** pour poser les lettres.
- **Durée de la mission 2** avec le petit : environ 15 lettres posées (estimation).
- **Tri des faces de verre** dans une même section ; halo de lampe et bulles légèrement teintés derrière une vitre ; bulle ou halo de lampe placé devant une vitre, dessiné derrière son cadre (le verre est toujours dessiné après les bulles et les halos) ; vitre au sec vue à travers un verre noyé, qui peut passer devant lui ; verre noyé un peu plus bleu qu'une pierre noyée (la face d'eau collée au verre s'ajoute à la surface) ; une vitre posée dans l'air derrière de l'eau (derrière un aquarium, ou vue d'un bassin à travers sa surface) n'est pas teintée par l'eau : elle se dessine par-dessus (ordre 2, après toute l'eau ; seules les faces au contact de l'eau passent avant, ordre 0,5). Défauts acceptés.
- **Gains des sons** `craft` et `discard` : à mesurer.
- **Taille du fichier** : `dist/cubes.html` grossit (estimation : quelques dizaines de ko ; mesuré : 813 ko à la 1.1-rc, 819 ko après les corrections de la revue, 821 ko après la seconde contre-vérification, 828 ko à la 1.1-rc2, contre 706 ko à la 1.0-rc).
- **Le rapport 1 tronc → 4 planches** est celui du jeu d'inspiration : c'est un nombre dans une table, à changer en une ligne.
- **Huit cases occupées sur neuf** dès la mission 1 avec la fabrication : l'appui long est la soupape, à observer en séance.
