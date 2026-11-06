# Mission 3 « Le miroir » (mathématiques) — conception

Proposition du 06/11/2026, relue le même jour (revue contradictoire, voir « Relecture » en fin de document) : **elle n'est pas validée par Pierre et rien n'est codé.** Elle prépare le jalon suivant du backlog (priorité 2 de `PLAN.md` §6 : « Mission 3, mathématiques : construction symétrique à compléter ; plage de nombres du mode parent »), à réaliser après le test de la 1.1-rc sur le convertible et les séances avec les enfants. Elle suit le découpage de `docs/V2-LOT1.md`. Les choix ouverts sont regroupés au §18, chacun avec une proposition par défaut ; la conception part de ces propositions.

Le nom « Le miroir » est provisoire (identifiant `miroir`, nom pour l'adulte « mission 3 (le miroir) »).

Sources du besoin :
- `docs/BRIEF.md`, Pédagogie : « Mathématiques : compter les blocs, additions dans les recettes, formes et symétrie des constructions » ; « toujours en faisant, jamais sous forme de quiz plaqué » ; chaque mission « s'adapte au profil (aide vocale, longueur des phrases, taille des nombres) » ;
- `docs/PLAN.md` §2 (mode parent : « plage de nombres » prévue, jamais faite) et §6 ;
- `docs/RECETTE-V1.md` §1 et §4 : « Mode parent : plage de nombres — absent » ;
- programme de mathématiques du cycle 2 (§1, « Place dans les programmes »).

Code relu pour cette conception : `src/edu/missions.ts`, `src/engine/words.ts` (`planLine`, `canAimAt`, `ghostCells`), `src/render/LetterGhosts.ts`, `src/render/mesher.ts` (`ghostCubes`), `src/edu/wordHelp.ts`, `src/edu/wordTexts.ts`, `src/edu/counting.ts`, `src/edu/craftTexts.ts`, `src/edu/Narrator.ts`, `src/engine/blocks.ts`, `src/engine/inventory.ts`, `src/engine/shelter.ts`, `src/engine/dayNight.ts`, `src/engine/raycast.ts`, `src/render/fov.ts`, `src/game/companion.ts`, `src/game/Player.ts`, `src/engine/physics.ts`, `src/input/TouchControls.ts`, `src/game/Game.ts` (enchaînement des missions, `placeBlock`, `keptBlocks`, `skipMissionStep`, `refreshCompanionPanel`, `onMissionDone`, `updatePendingMission`), `src/game/urlOptions.ts`, `src/save/saveFormat.ts`, `src/ui/HomeScreen.ts`, `src/ui/Celebration.ts`. Ce qui n'a pas pu être vérifié dans le code est marqué « à vérifier ». Les renvois au code citent les fonctions plutôt que des numéros de ligne (`Game.ts` change d'une session à l'autre).

Simulation de visée (relecture du 06/11/2026) : un essai Vitest jetable, hors du dépôt, a construit chaque figure du §7.3 sur un monde plat avec le vrai `canAimAt` (`words.ts`), œil à 1,62 bloc au-dessus des pieds (`Player.ts`), portée 6, figure à 3, 4 ou 5 blocs, enfant décalé latéralement de −4 à +4 blocs par pas de 0,5 (positif : côté des cibles), ordre glouton du bas vers le haut puis de l'axe vers l'extérieur, l'enfant immobile pendant toute la construction. Ses résultats sont cités aux §4.1, §7.3 et §8.1 ; ils sont à refaire en test unitaire (§14), le script n'est pas versé au dépôt.

Typographie des textes (comme au J8) : espace insécable devant ! ? : ; et autour de + et = ; dans ce document, les espaces sont ordinaires.

## 1. Objectifs

### Pédagogie

- **Symétrie axiale** : compléter une figure dont la moitié est donnée, par rapport à un axe vertical ; puis inventer une figure symétrique. Notions : le « jumeau » d'un bloc est à la même hauteur et à la même distance de l'axe, de l'autre côté ; une moitié retournée n'est pas une moitié recopiée.
- **Nombres**, toujours en faisant :
  - compter : Pixel compte à voix haute les blocs de sa moitié en les posant ; le bandeau montre « 3 / 5 » pendant que l'enfant pose ;
  - les doubles : « 5 + 5 = 10 » à chaque figure finie (les deux moitiés ont le même nombre de blocs) ;
  - le complément : « il en faut 5, tu en as 3 : il en manque 2 » (sac trop vide, figure libre) ;
  - l'addition de plusieurs termes, pour la plus grande plage : « 14 + 20 + 24 = 58 blocs » à l'écran de félicitations.

### Place dans les programmes

Source : « Annexe 4 – Programme de mathématiques du cycle 2 », education.gouv.fr (https://www.education.gouv.fr/sites/default/files/document/Annexe%204%20%E2%80%93%20Programme%20de%20math%C3%A9matiques%20du%20cycle%202-403821.pdf ; PDF daté du 09/10/2024 selon la revue ; texte relu le 06/11/2026 dans une copie extraite de ce PDF ; le numéro du Bulletin officiel n'a pas été relu).

- **Symétrie : CE2.** « Compléter, sur une feuille quadrillée ou pointée, une figure simple pour la rendre symétrique par rapport à un axe donné » (exemples de réussite : « L'élève complète une figure pour la rendre symétrique en s'appuyant sur le pliage de la feuille », « l'axe étant vertical ou horizontal ») et « Reconnaitre si une figure possède un ou plusieurs axes de symétrie » n'apparaissent que dans la partie Espace et géométrie du **cours élémentaire deuxième année**. Ni le CP ni le CE1 ne les contiennent.
- **Nombres** :
  - CP : nombres entiers jusqu'à cent (jusqu'à cinquante-neuf au plus tard en période 2, jusqu'à cent au plus tard en période 3) ; doubles des nombres de 1 à 10 et moitiés des nombres pairs de 2 à 20 ; symboles « + », « - » et « = » ; égalités à trou du type « 4 + … = 12 » ; poser une addition de deux ou trois nombres à un ou deux chiffres ;
  - CE1 : nombres jusqu'à mille ; doubles des nombres de 1 à 15 ;
  - CE2 : nombres jusqu'à 10 000 ; doubles des nombres de 1 à 20.
- **Ce que cela implique** :
  - pour l'enfant de 6 ans (débutant), compléter une figure symétrique a environ deux ans d'avance : la mission est pour lui une **découverte**, pas une notion de sa classe. C'est ce qui justifie le guidage renforcé du débutant (première figure qui montre le retournement, case suivante d'emblée, figures basses : §6, §7.3, décision 17) ;
  - pour l'enfant de 8 ans (autonome), la tâche est dans le programme s'il est en CE2 ; lui présenter « axe de symétrie » à la fin (décision 12) l'est aussi ;
  - les doubles affichés (jusqu'à 12 + 12) et l'addition à trois termes restent dans les attendus du CP au CE2 ; le complément (« il en manque 2 ») rejoint les égalités à trou du CP ; le signe « − » est au programme du CP (décision 3) ;
  - les plages 10, 20 et 100 (§7.2) ne sont pas des seuils du programme : celui du CP fixe cinquante-neuf puis cent ;
  - le programme s'appuie sur le **pliage** : une animation de pliage à la fin de chaque figure est proposée en option (décision 20).
- **Inconnu** : la classe de chaque enfant (grande section ou CP pour celui de 6 ans, CE1 ou CE2 pour celui de 8 ans). Question posée à Pierre (§18, question A).

### Jeu

- Aucun quiz : l'enfant construit ; le jeu juge ce qui est posé dans le monde (comme la mission 2 lit les mots dans le monde).
- Aucun échec : l'aide monte jusqu'à la case qui brille et au bon bloc mis dans la main ; une étape attend toujours que l'enfant y arrive.
- Aucun bouton nouveau, pas de nouvel écran posé sur le jeu, pas de nouveau bloc. **Geste nouveau** : poser dans un mur vertical précis, en hauteur. À la mission 2, les lettres sont toujours posées sur le sol ; l'abri de la mission 1 peut être creusé. À partir de la 3e rangée d'une figure (r = 2, §4.1), une case ne se pose que contre la face latérale d'un bloc voisin, vue de biais : c'est le principal risque de frustration du débutant (§15, décision 17), à observer par Pierre (§14).
- Durée visée : comparable à la mission 2 (environ 15 lettres posées pour le débutant, estimation du J8) ; voir §7.3.

### Hors périmètre

Axe horizontal ou oblique, figure posée à plat sur le sol (vue de trop près et de trop bas à hauteur d'enfant), trouver l'axe d'une figure, rotation, multiplication, nombres au-delà de 100 (`numberWords` s'arrête à cent).

## 2. Ce qui existe et sera réutilisé

| Existant (vérifié) | Réutilisation |
|---|---|
| `missions.ts` : moteur déclaratif (`Goal`, `StepDef` avec `text`/`spoken`/`touch`/`hint`/`holdEvening`, `MissionRunner`, `CAMPAIGN`, `resumeMission`, `starsEarned`, `progressLabel`, `prepare` pour fixer le contenu d'une étape) | `MISSION_3` ajoutée à la fin de `CAMPAIGN` ; deux objectifs nouveaux (§8.4) ; `prepare` choisit la figure comme il choisit le mot, avec une règle de conservation propre (§8.4) |
| `starsEarned` (`Math.max(0, i − 1)` + 1 si finie) | Sans changement : mission 3 en cours = 2 étoiles, finie = 3 |
| `resumeMission` et `Game.startMission` (mission suivante fraîche ; `before = CAMPAIGN[rank − 1]` si ce n'est pas le jour) | Sans changement de logique : un monde dont la mission 2 est finie reprend à la mission 3, de jour |
| `Game.queueMission`, `updatePendingMission`, `pendingMission`, `isMissionDaytime` (6 h 30 à 16 h 30) | Réutilisés ; le test `def === MISSION_2` de `queueMission` et le texte `MISSION_2_TOMORROW` dit dans `updatePendingMission` sont à généraliser (§8.4) |
| `holdEvening` (soir retenu à 17 h, `dayNight.ts`) | Posé sur toutes les étapes de la mission 3 (§18, décision 7) |
| `words.ts` : `canAimAt` (visée depuis l'œil, portée `REACH` = 6, fleur jamais appui) et la méthode de `planLine` (axe dominant du regard, sol plat, face côté enfant libre, essais décalés, nouvel essai toutes les 0,5 s) | `canAimAt` tel quel ; `planFigure` (§8.1) reprend la méthode de `planLine` pour un cadre vertical au lieu d'une ligne |
| `LetterGhosts.ts` : cases claires (`GhostCell` avec un `BlockId` quelconque, dessiné par `ghostCubes` avec la tuile du bloc), case suivante qui respire avec son contour jaune (`nextOutline`), contours orange (à revoir) et vert (réussi, `doneId`) posés par `setMarks`, sans clignotement ; `MAX_GHOSTS` = `MAX_MARKS` = 10 | Cases claires des jumeaux, case suivante, blocs en trop (orange) et paire réussie (vert). Bornes relevées et nouveau contour « repère » jaune clignotant (§9.2) |
| `wordHelp.ts` : aide pure par seuils de temps sans progrès (15 s, 25 s, 30 s, 50 s, puis toutes les 30 s) | Même forme et mêmes seuils dans `mirrorHelp.ts` (§6) |
| `counting.ts` : `numberWords` (0 à 100, accord féminin), `CountNoun`, `countNoun`, `quantity`, `spokenQuantity`, `capitalize` | Additions écrites et dites de la mission 3 |
| `craftTexts.ts` : addition écrite « 2 + 2 = 4 planches » et dite « Deux plus deux, ça fait quatre planches » (fonctions privées `writtenSum` et `spokenSum`, qui prennent un `BlockId` pour accorder le nom par `quantity`) ; `craftText(…, sumMax = DEBUTANT_SUM_MAX)` (10) ne coupe l'addition que dans la variante débutant | `writtenSum` et `spokenSum` sortent dans `counting.ts` avec un nom comptable en paramètre (`CountNoun`, par exemple « bloc / blocs ») au lieu d'un `BlockId`, pour servir aux deux modules |
| `inventory.ts` : `discardVerdict`, `slotToEmpty`, blocs protégés par `Game.keptBlocks()` | `keptBlocks()` protège aussi les blocs de la figure en mode couleurs (§5.4) |
| `Game.placeBlock` : refuse de poser dans la boîte du joueur (`NO_SPACE`), pose à la place d'une fleur | Rien à changer pour l'enfant (sauf aide à la visée si la décision 17 la retient) ; Pixel suit la même règle quand il pose ses blocs (§4.3) |
| `Narrator.ts` : une consigne importante n'est jamais coupée pendant sa durée estimée (`busyUntil`, `speechMs` = 600 ms + 75 ms par caractère) ; une lecture différée est remplacée par la suivante ; aucun événement de fin d'énoncé n'est lu | Le compte de Pixel est dit en une phrase et les poses sont cadencées sur sa durée estimée (§4.3) |
| `companion.ts` : but unique `companionGoal` (2,6 blocs devant l'enfant, 1,4 à sa gauche), `stepCompanion` en ligne droite, arrêt devant une marche de plus d'un bloc, réapparition seulement au-delà de 10 blocs (`COMPANION_TELEPORT`) ou de 4 blocs de dénivelé. Pixel n'est pas un obstacle (ni `Player.ts` ni `physics.ts` ne lisent le compagnon ; la visée ne lit que le monde) | But imposé pendant la mission 3 et réapparition quand il n'avance plus (§4.2) |
| `wordIcon.ts` (mot en tuiles de l'atlas, bandeau et félicitations) | Même principe pour `figureIcon.ts` (§9.3) |
| `HomeScreen.ts` : réglages par profil (prénom, niveau de lecture, voix) et réglages communs (`Settings` : nuit, Grignotes, Tests) | La plage de nombres est un réglage **par profil**, à côté du niveau de lecture (§10) |
| `urlOptions.ts` : `#mission=0|1|2`, `&lecture=` | `#mission=3` et `&nombres=10|20|100` (§13) |

## 3. Déroulé

### 3.1 Place dans la campagne

- Campagne : tutoriel → mission 1 (l'abri) → mission 2 (les mots) → **mission 3 (le miroir)**.
- Comme entre les missions 1 et 2 : après l'écran de félicitations de la mission 2, la mission 3 attend sa fermeture, puis le jour (6 h 30 à 16 h 30). La mission 2 retient le soir à 17 h : si elle finit entre 16 h 30 et 17 h, le temps file ×30 jusqu'au matin et Pixel dit « Demain, on joue au miroir ! » (comportement existant de `queueMission` et `updatePendingMission`, avec un texte propre à la mission 3).
- Au début de la mission 3, le jeu met en main une case du sac (le bloc de la figure s'il y en a un, sinon la première case non vide), comme il remet le doigt en mode Casser : la case ABC de la mission 2 peut encore être en main (§5.2).
- Une étoile de plus à l'accueil quand la mission 3 est finie (trois en tout), sans rien changer à `starsEarned`.
- Mondes existants dont la mission 2 est finie (jeu libre aujourd'hui) : ils reprennent à la mission 3 à la prochaine partie, de jour (§18, décision 9).
- Après la mission 3 : jeu libre, comme aujourd'hui après la mission 2.

### 3.2 Étapes

Quatre étapes, la première plus guidée. Les figures dépendent de la plage de nombres du profil (§7.3).

| Étape | Objectif (`goal`) | Ce qui se passe | Libellé pour l'adulte |
|---|---|---|---|
| 0 | `mirror`, palier 1 | Pixel construit la moitié d'une petite figure où le miroir diffère de la recopie, en comptant à voix haute ; l'enfant pose l'autre moitié. Case suivante d'emblée, avec son bloc du modèle qui clignote | compléter une première figure |
| 1 | `mirror`, palier 2 | Figure moyenne ; côté du modèle tiré au sort pour l'autonome, encore à gauche pour le débutant (§18, décision 6) ; case suivante d'emblée pour le débutant ; mode couleurs pour l'autonome | compléter une deuxième figure |
| 2 | `mirror`, palier 3 | Plus grande figure de la plage ; côté tiré au sort ; mode couleurs pour l'autonome | compléter une troisième figure |
| 3 | `mirrorFree` | Pixel trace l'axe et le cadre ; l'enfant invente sa figure symétrique, avec un minimum de blocs de chaque côté | inventer une figure symétrique |

Fin : félicitations (une ligne par figure avec son addition, et le total pour la plage 100), cadeau de 5 blocs arc-en-ciel comme les missions 1 et 2 (§18, décision 10), troisième étoile.

### 3.3 Textes

Toujours deux variantes. Débutant : 5 mots au plus à l'écrit (règle de `wordTexts.ts` ; une addition écrite suit la règle de `craftText`), lu à voix haute, et une forme dite plus longue quand elle est donnée (comme `M2_STEP_LETTER`) ; autonome : phrases complètes. Forme dite : nombres en lettres (`numberWords`), « plus » et « ça fait ». Les valeurs entre accolades sont calculées ; le nom de la figure et son article viennent du catalogue (§8.2). Aucun texte ne parle de la lampe ni des Grignotes. « Pareil » n'est employé que pour le type de bloc (mode couleurs) et pour deux moitiés finies : pour un enfant de 6 ans, « fais pareil » veut dire « recopie », l'erreur même que la mission corrige.

| Texte | Débutant | Autonome |
|---|---|---|
| `M3_INTRO` | Jouons au miroir ! | Je construis la moitié d'une figure. À toi de faire l'autre moitié, comme dans un miroir ! |
| `M3_TOMORROW` | Demain, on joue au miroir ! | Attendons le matin : j'ai une figure à te montrer. |
| `M3_BUILDING` (Pixel pose sa moitié) | Regarde : je fais une moitié. Puis le compte, dit en une phrase : « Un, deux, trois ! » (§4.3) | Regarde bien : je construis la moitié d'{une maison}. Ma moitié a {5} blocs. |
| `M3_STEP_MIRROR` | Fais le miroir, en face ! Dit : « Pose tes blocs en face des miens. Mon bloc qui touche la ligne, le tien touche aussi la ligne. » | Construis l'autre moitié : chaque bloc doit avoir son jumeau, à la même hauteur et à la même distance de la ligne. |
| `M3_STEP_MIRROR_TOUCH`, étape 0, au doigt, bouton en mode Casser (cas du départ : la fin de la mission 2 remet le mode Casser) | Touche Casser, puis tape. | Touche le bouton Casser : il devient Poser. Puis tape l'écran : ton bloc se pose sous la croix du milieu, de l'autre côté de la ligne. |
| `M3_STEP_MIRROR_TOUCH`, étape 0, au doigt, bouton déjà en mode Poser | Vise la case, puis tape. | Vise la case qui brille avec la croix du milieu, puis tape l'écran pour poser ton bloc. |
| `M3_STEP_MIRROR_MOUSE`, étape 0, souris | Pose : clic droit. | Vise la case qui brille avec la croix, puis fais un clic droit pour poser ton bloc. |
| `M3_STEP_COLOURS` (mode couleurs) | Même bloc que moi ! | Construis l'autre moitié avec les mêmes blocs que moi : chaque jumeau a la même couleur. |
| `M3_HELP_NEXT` (15 s) | Regarde la case qui brille ! | Commence par la case qui brille, tout près de la ligne. |
| `M3_HELP_DISTANCE` (25 s ; le bloc du modèle correspondant clignote, aux deux niveaux) | En face de mon bloc ! | Bloc qui touche la ligne (c = ±1) : « Ce bloc touche la ligne : son jumeau touche aussi la ligne, de l'autre côté. » Sinon : « Il y a {1} case entre ce bloc et la ligne : laisse {1} case de l'autre côté aussi. » |
| `M3_HELP_GHOSTS` (30 s) | Remplis les cases claires ! | Pose un bloc dans chaque case claire : ce sont les jumeaux de mes blocs. |
| `M3_HELP_GIVE` (50 s) | Voici le bon bloc ! | J'ai choisi le bon bloc dans ta barre : pose-le dans la case qui brille. |
| `M3_EXTRA` (bloc sans jumeau) | Ce bloc est en trop ! | Ce bloc n'a pas de jumeau de l'autre côté de la ligne : casse-le. |
| `M3_TRANSLATED` (moitié recopiée sans être retournée ; débutant : orange sur les seuls blocs mal placés, les bonnes cases brillent) | Mets-les dans les cases claires ! | Tu as recopié ma moitié sans la retourner : mon bloc collé à la ligne doit avoir son jumeau collé à la ligne, et tu l'as mis tout au bout. |
| `M3_SHIFTED_SIDE` (décalée d'une colonne) | Pose contre la ligne ! | Ta moitié est décalée : le jumeau d'un bloc qui touche la ligne touche aussi la ligne. |
| `M3_SHIFTED_UP` (décalée d'un cran en hauteur) | Trop haut ! Pose plus bas. | Ta moitié est un cran trop haut : deux jumeaux sont toujours à la même hauteur. |
| `M3_WRONG_BLOCK` (mode couleurs) | Même bloc que le mien ! | Bonne place ! Mais il faut le même bloc que le mien : {un bloc de terre}. |
| `M3_OFF_PLANE` (bloc posé devant ou derrière la figure) | Pas devant : dedans ! Dit : « Pas devant ma figure : pose dans le mur, dans la case qui brille. » | Ce bloc est {devant} ma figure : pose-le dans la case claire, dans le même mur que mes blocs. |
| `M3_LETTER_IN_TARGET` (lettre posée dans une cible) | Prends un bloc du sac ! | Les lettres ne font pas de miroir : prends un bloc de ton sac. |
| `M3_OUT_OF_FRAME` (figure libre, bloc hors du cadre) | Reste dans le cadre ! | Ce bloc est hors du cadre : il ne compte pas. Construis dans le cadre. |
| `M3_COME_CLOSER` (case suivante trop loin) | Approche-toi de la ligne ! | Approche-toi de ma figure : d'ici, tu ne peux pas poser dans la case qui brille. |
| `M3_MOVE_SIDE` (case suivante à portée mais pas visable d'où il est, §6) | Va un peu {à droite} ! | D'ici, tu ne peux pas viser la case qui brille : va un peu {à droite}, devant la moitié à construire. |
| `M3_BREAK_TIP_TOUCH` (au doigt, bouton en mode Poser) | Touche Poser, puis casse-le. | Pour enlever un bloc, touche le bouton Poser (il devient Casser) et garde le doigt sur le bloc. |
| `M3_BREAK_TIP_MOUSE` | Garde le clic gauche dessus. | Pour enlever un bloc, vise-le et garde le clic gauche appuyé. |
| `M3_THIRD_PERSON` (dit une fois, à l'autonome seulement, §4.2 ; la variante débutant existe pour la règle des deux variantes) | Au doigt : Touche l'œil : tu vois tout ! Clavier : Appuie sur V ! | Au doigt : Pour voir toute la figure, touche le bouton œil : tu te verras de derrière. Clavier : Pour voir toute la figure, appuie sur la touche V : tu te verras de derrière. |
| `M3_NEED_BLOCKS` (sac trop vide) | Casse le sol plus loin ! | Il te faut encore {5} blocs et tu en as {3} : il en manque {2}. Casse le sol un peu plus loin, pas sous ma figure. |
| `M3_FAR` | Reviens près de ma figure ! | Ma figure t'attend là-bas : reviens près de la ligne du miroir. |
| `M3_NO_PLACE` | Va sur un sol plat ! | Pour construire, j'ai besoin d'un sol plat et libre devant toi : tourne-toi ou avance un peu. |
| `M3_MODEL_BACK` (bloc du modèle cassé, remis) | Je remets mon bloc ! | Ce bloc est à moi : je le remets, pour garder le modèle. |
| `M3_GROUND_BACK` (sol cassé sous le cadre, rebouché) | Je rebouche le sol ! | Ma figure a besoin d'un sol : je rebouche le trou. |
| `M3_DONE` (calculé) | {5} + {5} = {10} blocs ! Dit : « Cinq plus cinq, ça fait dix blocs ! » ; au-delà de la plage : « {14} blocs ! Bravo ! » | Les deux moitiés sont pareilles : {5} blocs de chaque côté, {5} + {5} = {10}. |
| `M3_STEP_FREE` | Invente ta figure miroir ! | À toi d'inventer : construis dans le cadre une figure symétrique, avec au moins {5} blocs de chaque côté de la ligne. |
| `M3_FREE_MORE` | Encore {2} de chaque côté ! | Ta figure est symétrique. Il faut {5} blocs de chaque côté et tu en as {3} : ajoute encore {2} blocs de chaque côté. |
| `M3_FREE_TWIN` | Ce bloc est tout seul ! Dit : « Ce bloc est tout seul : pose son copain dans la case qui brille. » | Ce bloc n'a pas encore de jumeau : pose-le dans la case qui brille, ou casse ce bloc. |
| `M3_FREE_DONE` (calculé) | {6} + {6} = {12} blocs ! | Ta figure est symétrique : {6} blocs à gauche, {6} à droite, {6} + {6} = {12}. |
| `M3_OUTRO` | Tu sais faire le miroir. | Chaque bloc a son jumeau de l'autre côté de l'axe : tes figures sont symétriques. |
| `M3_RECAP` (récapitulatif, plage 100) | {58} blocs en tout ! (l'addition seulement si le total tient dans la plage du profil) | En tout : {14} + {20} + {24} = {58} blocs. |

Ces textes sont des gabarits : ils vivent dans un module à part, `src/edu/mirrorTexts.ts`, comme `wordTexts.ts` (le test des constantes de `texts.ts` refuserait les gabarits bruts), et leur test les vérifie une fois remplis (deux variantes, longueur du débutant, espaces insécables, nombres accordés, genre du nom de la figure). Les astuces de casse de la mission 2 (`BREAK_TIP_TOUCH`, `BREAK_TIP_MOUSE`) ne sont pas réutilisées : elles parlent d'une lettre (« casse-la », « Pour enlever une lettre »).

Vocabulaire : « la ligne » ou « la ligne du miroir » pour l'axe pendant la mission ; le mot « axe » n'apparaît qu'à la fin, pour l'autonome (§18, décision 12). « Symétrique » seulement pour l'autonome. « Jumeau » seulement pour l'autonome ; le débutant entend « en face de mon bloc », « tout seul », « son copain ».

### 3.4 Exemple : le débutant, plage « jusqu'à 10 »

Avec les propositions par défaut (figures de 2 rangées pour la plage 10, décision 17).

1. Le matin, Pixel : « Jouons au miroir ! ». Une ligne lumineuse verticale apparaît devant l'enfant, à 3 ou 4 blocs, un peu sur sa gauche ; Pixel se tient à gauche de la figure. Il pose 3 blocs de terre à gauche de la ligne, une marche (« Un, deux, trois ! »). Une case claire respire à droite, contre la ligne, et le bloc de Pixel qui lui fait face clignote. Bandeau : icône de la marche entière, « 0 / 3 ».
2. « Touche Casser, puis tape. » L'enfant passe en mode Poser, pose un bloc dans la case qui brille. La paire (son bloc et celui de Pixel) s'entoure de vert ; « 1 / 3 » ; la case suivante brille, avec son bloc du modèle. Au troisième bloc (en haut, contre la ligne, pas au bout) : « 3 + 3 = 6 blocs ! » (dit : « Trois plus trois, ça fait six blocs ! »).
3. Pixel se déplace : nouvelle ligne et bateau (4 blocs par moitié), modèle encore à gauche, case suivante d'emblée. S'il s'arrête 25 s : « En face de mon bloc ! » ; à 30 s, toutes les cases claires.
4. Voiture (5 par moitié), modèle à gauche ou à droite, sans case claire tant que l'enfant progresse : « 5 + 5 = 10 blocs ! ».
5. Figure libre : le cadre est tracé ; « Invente ta figure miroir ! », au moins 3 blocs de chaque côté. Quand sa figure est symétrique et que rien n'a bougé autour d'elle pendant 8 s : « 4 + 4 = 8 blocs ! ».
6. Félicitations : trois figures et leurs additions, la figure de l'enfant, le cadeau ; troisième étoile à l'accueil.

## 4. Ce que voit l'enfant

### 4.1 La figure : un mur dressé face à l'enfant

- La figure est verticale, d'un bloc d'épaisseur, posée sur un sol plat, face à l'enfant, comme une fresque : vue de face, la symétrie gauche-droite se lit d'un coup d'œil. Une figure à plat sur le sol se verrait mal à hauteur d'enfant (œil à 1,62 bloc au-dessus des pieds, `Player.ts`).
- Cadre : 3 colonnes de chaque côté de l'axe au plus, 5 rangées au plus (r = 0 à 4 depuis le sol). Plage 10 : 2 rangées au plus (décision 17).
- L'axe passe **entre deux colonnes** (sur une ligne de la grille, comme sur le quadrillage d'un cahier) : il n'occupe aucune case ; le jumeau d'un bloc qui touche l'axe touche l'axe de l'autre côté.
- **Hauteur de visée** : le dessus d'un bloc de la rangée r = 0 est à 1 bloc au-dessus des pieds, sous l'œil (1,62) : la rangée r = 1 se pose sur le dessus de la rangée 0. Le dessus d'un bloc de la rangée r = 1 est à 2 blocs, au-dessus de l'œil, donc invisible : **à partir de la 3e rangée (r = 2), une case ne se pose que contre la face latérale d'un bloc voisin de la même rangée** (le bloc du modèle de l'autre côté de la ligne pour c = ±1), ou sous la face inférieure d'un bloc plus haut. Une face latérale ne se vise que depuis le côté où elle donne : celle qui regarde vers l'extérieur se voit depuis l'extérieur.
- **Place de l'enfant** : en conséquence, les rangées hautes se construisent depuis une position décalée vers la moitié à compléter. Simulation (préambule), cibles seules, modèle déjà posé : la marche, le bateau et la voiture (2 rangées) se construisent depuis tout écart de −1 à +4 blocs ; le petit arbre demande un écart d'au moins 1,5 bloc vers les cibles, la maison 0,5, le sapin, le papillon et le château redessinés (§7.3) 2,5 (à 5 blocs de distance, seulement 2,5 à 3 pour le sapin, 2,5 pour les figures de 5 rangées). Proposition : la figure est placée l'axe à environ un bloc du regard, côté modèle (l'axe et les premières cibles restent dans le champ) ; `planFigure` vérifie qu'une position de la rangée de l'enfant permet de tout construire (§8.1) ; quand la case suivante n'est pas visable d'où il est, Pixel lui dit de quel côté aller (`M3_MOVE_SIDE`, §6).
- Distance : 3 ou 4 blocs pour les figures de 4 ou 5 rangées, 3 à 5 blocs sinon, pour que chaque case soit à portée (`REACH` = 6 depuis l'œil). Le champ horizontal visé est d'au moins 60° (`fov.ts`) : le cadre n'a pas à tenir entier dans le champ ; la moitié de Pixel se regarde en tournant la tête, comme un prénom long à la mission 2 (§15).

### 4.2 L'axe et la moitié à compléter

- **L'axe** (nouveau module de rendu `SymmetryGuide`, jamais un bloc du monde : on le traverse, la visée l'ignore), d'une couleur propre (jaune pâle), seul trait appelé « la ligne » :
  - une bande verticale fine, en tirets lumineux, du sol jusqu'à un bloc au-dessus de la figure, un peu plus profonde que la figure pour se voir de biais ;
  - prolongée au sol par une ligne en tirets qui avance de 2 blocs vers l'enfant (comme le pli d'une feuille) : on voit où est l'axe avant que la figure ne soit construite et même de loin ;
  - la bande garde la luminosité du jour et de la nuit, comme les cases claires (`setBrightness`).
- **La moitié à compléter** (§18, décision 13) : pour le débutant, rien d'autre que l'axe et ses tirets au sol (un rectangle tracé inviterait à le remplir, comme les cases claires de la mission 2) ; pour l'autonome, un contour fin de la **boîte de la figure en miroir** (largeur et hauteur de la moitié de Pixel, retournée), et non du cadre 3 × 5, d'une couleur distincte de l'axe. Les cases claires (§6) sont l'aide, pas l'affichage de départ. Figure libre (étape 3) : le contour du cadre (3 colonnes × 5 rangées de chaque côté) est montré aux deux niveaux, dans cette couleur distincte.
- **Le modèle** : les vrais blocs posés par Pixel. Quand l'enfant pose un jumeau juste, la paire (son bloc et le bloc du modèle) s'entoure de vert pendant 1,2 s (`setMarks` avec `doneId`) : la correspondance se voit.
- **Pixel** se tient sur le côté de la figure, au-delà de la dernière colonne du modèle, hors du cadre, tourné vers la ligne ; jamais entre l'enfant et la figure, où son corps cacherait les premières cases à poser (le bas de l'axe : `buildOrder` commence en bas, contre l'axe). Vérifié dans le code : son but n'est calculé qu'à un endroit (`companionGoal`, appelé par `Game` à chaque image), un point d'arrivée imposé est donc simple ; par défaut il se placerait 2,6 blocs devant l'enfant et 1,4 à sa gauche, c'est-à-dire entre l'enfant et une figure à 3 ou 5 blocs. `stepCompanion` avance en ligne droite, s'arrête devant une marche de plus d'un bloc et ne réapparaît qu'au-delà de 10 blocs : si l'enfant fait le tour du mur, Pixel peut rester bloqué derrière la figure. Pendant la mission 3, il réapparaît à sa place quand il n'avance plus (par exemple 2 s sans approcher de son but, valeur à régler), avec un test du compagnon (but fixe derrière un mur de 2 blocs). Il n'est pas un obstacle physique (vérifié, §2).
- **Bandeau de Pixel** : l'icône de la figure entière (débutant) ou de la moitié de Pixel et de l'axe (autonome, §18, décision 14), et le compte « 3 / 5 ».
- La vue à la troisième personne (touche V, bouton œil) permet de voir toute la figure : Pixel la suggère une fois à l'autonome (`M3_THIRD_PERSON`).

### 4.3 Pixel construit sa moitié

- Quand la place est trouvée (§8.1), Pixel écrit ses blocs dans le monde un par un, sans viser (il n'est pas soumis à `canAimAt`), avec le son « place », du bas vers le haut et de l'axe vers l'extérieur.
- **Rythme et compte** : un compte dit nombre par nombre avec `tell` ne suivrait pas les poses (`Narrator` : une lecture différée est remplacée par la suivante, une consigne importante n'est pas coupée). Pour le débutant, le compte est dit en **une seule phrase** importante (« Un, deux, trois, quatre, cinq ! », nombres accordés au masculin) et les poses sont cadencées sur sa durée estimée (`speechMs`, divisée par le nombre de blocs), au moins 0,8 s par bloc ; voix coupée ou absente, 1 s par bloc. Le chiffre s'affiche au moment de chaque pose (dans le bandeau, à la place du compte de l'enfant, ou au-dessus du bloc ; choix à la réalisation), pour que le compte se voie même sans voix. Pour l'autonome, poses toutes les 0,5 s puis « Ma moitié a {5} blocs. ». La latence de la synthèse vocale de Firefox sous Windows n'est pas mesurée : à observer par Pierre (§14).
- Il ne pose jamais dans la boîte du joueur (`boxesIntersect`, comme `placeBlock`) : une case occupée par l'enfant est reprise quand il s'en écarte.
- Ces blocs sont des blocs ordinaires écrits dans le monde : ils entrent dans l'écart de la sauvegarde, et restent après la mission (l'enfant garde ses figures).
- Pendant la construction, la casse et la pose de l'enfant restent possibles (pas de pause) ; les cases claires attendent la fin.

## 5. Jugement de la symétrie

Module pur `src/engine/symmetry.ts` (§8.1). Le jeu le relit après chaque pose ou casse dans le cadre et à ses abords, et quand l'enfant s'arrête (3 s sans changement), comme `evaluateWriting` à la mission 2. Les délais sont décidés par un module pur (`mirrorSession`, §8.3).

### 5.1 Le miroir

- Une figure est enregistrée par sa place : origine (case du sol au pied de l'axe), axe dominant du regard au moment du tracé (`f`, l'un des quatre axes), sens « droite de l'enfant » `d = (−f.z, f.x)` comme dans `planLine`, et côté du modèle.
- Une case est repérée par (colonne c, rangée r) : c = 1 à 3 à droite de l'axe, −1 à −3 à gauche ; r = 0 à 4 depuis le sol. Le jumeau de (c, r) est (−c, r).
- Les cibles sont les jumeaux des cases du **modèle enregistré** (la figure choisie au catalogue), pas des blocs actuellement présents côté modèle : un bloc du modèle cassé ou remplacé ne change pas ce qu'on attend de l'enfant.

### 5.2 Ce qui compte comme un bloc

- Une case est remplie si elle contient un bloc plein (`isSolidId`) qui n'est pas un bloc-lettre : terre, pierre, planches, verre, lampe, clôture, arc-en-ciel… Une fleur, l'eau ou l'air : vide. Les lettres de la mission 2 (case ABC toujours ouverte, `lettersUnlocked`) ne comptent pas : leur dessin ne se retourne pas dans un miroir (`words.ts` : la lettre n'est jamais en miroir) ; posée dans une cible, une lettre est entourée d'orange et Pixel dit `M3_LETTER_IN_TARGET` (une fois par figure). Le jeu met un bloc du sac en main au début de la mission (§3.1) ; `letterHandReminder` reste propre à la mission 2.
- **Mode forme** (débutant) : n'importe quel bloc plein compte, quelle que soit sa couleur.
- **Mode couleurs** (autonome, étapes 1 et 2) : le jumeau doit être du même type que le bloc du modèle. Un bon emplacement avec un autre bloc : contour orange et `M3_WRONG_BLOCK` (§18, décision 4).
- Le mode est recalculé depuis le niveau de lecture du profil à chaque reprise : si l'adulte passe l'enfant en débutant entre deux parties, la figure en cours (gardée, avec ses types) est jugée en mode forme ; ses types ne servent plus qu'à la couleur des cases claires. Les deux variantes des textes du mode couleurs existent quand même (règle des deux variantes, test des textes).
- Aucun bloc du jeu n'a d'orientation à retourner (le tronc a un dessus et des côtés, jamais tourné ; **à vérifier** pour tout bloc ajouté plus tard).

### 5.3 Validation, tolérance et diagnostics

- **Figure à compléter** (étapes 0 à 2), validée quand :
  1. chaque cible est remplie (et du bon type en mode couleurs) ;
  2. aucun bloc « sans jumeau » dans le plan du cadre : un bloc plein posé dans le cadre, hors du modèle et des cibles, est accepté si son jumeau est plein aussi (l'enfant a embelli symétriquement), sinon il est en trop (contour orange, `M3_EXTRA`).
- **Ce qui est ignoré pour la validation** :
  - les blocs hors du plan de la figure (devant ou derrière, profondeur ≠ 0) : erreur de visée attendue (le geste naturel est de viser la face avant d'un bloc du dessous ou d'à côté, et le bloc se pose devant la figure). Ils ne bloquent pas, mais ils ne sont pas passés sous silence : contour orange **à chaque fois** (tant qu'ils sont là), `M3_OFF_PLANE` dit une fois par figure, et la cible du plan juste derrière (ou devant), si elle est vide, brille aussitôt (§18, décision 5) ;
  - les blocs hors du cadre (au-delà de 3 colonnes ou de 5 rangées), sauf dans la figure libre (ci-dessous) ;
  - le côté du modèle : seuls les blocs en trop y sont jugés ;
  - une figure construite ailleurs (copie à côté, autre endroit) : rien ne la lit ; si l'enfant s'éloigne, voir §12.
- **Diagnostics**, quand l'enfant s'arrête 3 s et que la moitié n'est pas juste (dans cet ordre) :
  - `translated` : sa moitié est la moitié du modèle recopiée sans être retournée (colonne c du modèle posée en colonne (largeur + 1 − c) de son côté). Seulement si la moitié du modèle n'est pas elle-même symétrique (sinon les deux se confondent) → `M3_TRANSLATED`, l'erreur classique de la symétrie. Débutant : orange sur les seuls blocs mal placés, les cases justes à remplir brillent ;
  - `shiftedSide` : sa moitié est juste mais décalée d'une colonne loin de l'axe → `M3_SHIFTED_SIDE` ;
  - `shiftedUp` : juste mais un cran trop haute (posée sur un bloc) → `M3_SHIFTED_UP` ;
  - `wrongBlock` (mode couleurs) ; `extra` ; sinon l'aide normale (§6).
  - Un diagnostic n'est dit qu'une fois par état de la figure ; les blocs à revoir sont entourés d'orange, la case juste à remplir à la place brille.
- **Figure libre** (étape 3) :
  - le cadre (3 colonnes × 5 rangées de chaque côté) est tracé (§4.2) ; un bloc posé hors du cadre, dans le plan ou à côté de la figure, est entouré d'orange et Pixel dit `M3_OUT_OF_FRAME` (une fois par figure) : seuls les blocs du cadre sont comptés, et l'enfant le voit ;
  - validée quand chaque bloc du cadre a son jumeau (même type en mode couleurs), qu'il y a au moins le minimum de blocs de chaque côté (§7.3) et que **rien n'a été posé ni cassé dans le cadre ni à ses abords (2 blocs autour) depuis 8 s** (valeur à observer, 8 à 10 s, §15). Un délai court validerait une figure en cours (une figure au minimum, puis l'enfant part casser du sol pour continuer : l'écran de félicitations s'ouvrirait au milieu de sa création) ;
  - un bloc sans jumeau : la case de son jumeau brille (`M3_FREE_TWIN`) ; trop peu de blocs : `M3_FREE_MORE` (complément).
- **Comptage pour le bandeau** : figure à compléter, cibles remplies / cibles ; figure libre, paires de jumeaux / minimum.

### 5.4 Blocs disponibles

- Mode forme : tout bloc plein convient ; le sol en donne toujours (casser l'herbe rapporte de l'herbe, `dropsOf`). Un sac vide n'est donc jamais une impasse ; Pixel dit de casser le sol **plus loin**, pas sous la figure (§12).
- Mode couleurs : la figure prend au plus deux types :
  - le bloc du sol à l'endroit de la figure (herbe, terre, sable ou neige selon le monde), qu'on peut toujours casser autour de soi ;
  - un second type pris **dans le sac de l'enfant** au moment du tracé, s'il en a au moins autant que la figure en demande, **parmi une liste permise** : planches, pierre, terre, sable, tronc, feuilles, neige. Exclus : le verre (transparent, la forme à reproduire disparaît), la lampe et la pierre brillante (elle rapporte une lampe ; la lampe éloigne les Grignotes et sert à la mission 1), l'arc-en-ciel (cadeau qu'on ne trouve pas dans la nature, `blocks.ts`), la clôture et le cactus (blocs fabriqués ou rares que l'enfant ne s'attend pas à dépenser), les lettres (§18, décision 18). Aucun type permis en nombre suffisant : la figure n'a qu'un type. Liste écrite dans `figures.ts` et testée.
  - Ces types sont protégés pendant l'étape par `keptBlocks()` (vol des Grignotes, appui long, conseil « sac plein »), comme le bloc d'une étape « ramasser ». Les poser reste permis.
- Un bloc du modèle cassé par l'enfant revient dans son sac (`dropsOf` rend le bloc lui-même) et Pixel le remet (§12) : chaque casse crée un bloc de plus, au plus un toutes les 3 s, d'un type permis (§18, décision 19).

## 6. Aide progressive

Module pur `src/edu/mirrorHelp.ts`, calqué sur `wordHelp.ts` : il reçoit le temps sans progrès (hors pause), le palier, le nombre de cibles remplies, l'étape et le niveau, et rend ce qu'il faut montrer et dire. Le jeu remet l'horloge à zéro quand une cible juste est remplie. Le palier ne redescend pas pendant l'étape et il est enregistré (`MissionRunner.noteHelp`, étendu aux objectifs `mirror`, §8.4).

| Temps sans progrès | Débutant | Autonome |
|---|---|---|
| départ, étape 0 | case suivante seule (une case claire à la fois), avec le bloc du modèle qui lui fait face clignotant en jaune (« repère », §9.2) | case suivante seulement (palier 1) |
| départ, étape 1 | case suivante et son repère, comme à l'étape 0 | rien de plus que l'axe et le contour de la figure en miroir |
| départ, étape 2 | rien de plus que l'axe | rien de plus que l'axe et le contour |
| 15 s | case suivante (palier 1), `M3_HELP_NEXT` (étape 2 seulement : elle est déjà là aux étapes 0 et 1) | case suivante, sans voix |
| 25 s | `M3_HELP_DISTANCE` (« En face de mon bloc ! »), le repère clignote | `M3_HELP_DISTANCE` (texte selon la colonne), le repère clignote |
| 30 s, rien posé | toutes les cases claires (palier 2), `M3_HELP_GHOSTS` | toutes les cases claires, `M3_HELP_GHOSTS` |
| 50 s | le bon bloc est choisi dans la barre (`M3_HELP_GIVE`) ; s'il n'y en a pas, `M3_NEED_BLOCKS` | idem |
| ensuite toutes les 30 s | `M3_HELP_DISTANCE` redit pour la case suivante | idem |

- **Case suivante** : parmi les cibles vides, la première de `buildOrder` posable d'où se tient l'enfant (`canAimAt`, les blocs déjà posés comptent). À défaut : la première de `buildOrder` posable depuis une autre position de la rangée de l'enfant ; elle brille, et Pixel dit `M3_MOVE_SIDE` (le côté vers lequel aller, calculé : vers la moitié à construire en général) si l'enfant est à portée, `M3_COME_CLOSER` s'il est trop loin (au plus une fois toutes les 30 s, comme `M3_FAR`). Une fonction pure rend la direction (§8.1).
- **Cases claires** : `LetterGhosts` avec l'identifiant du bloc du modèle (en mode forme, la couleur du modèle sert de guide, n'importe quel bloc convient).
- **Bloc en trop ou mal placé** : contour orange tant qu'il est là ; 10 s après, l'astuce pour casser (`BREAK_TIP_MS` de `wordHelp.ts`, textes `M3_BREAK_TIP_TOUCH` ou `M3_BREAK_TIP_MOUSE`, §3.3).
- **Bloc hors du plan** : contour orange à chaque fois, voix une fois par figure, la cible derrière brille (§5.3).
- **Figure libre** : pas de cases claires au départ ; un bloc sans jumeau fait briller la case du jumeau aussitôt que l'enfant s'arrête 3 s.
- On n'échoue jamais : l'aide va jusqu'à la case qui brille et au bon bloc dans la main, comme « Voici la lettre N ! » à la mission 2 ; Pixel ne pose jamais à la place de l'enfant (§18, décision 11).

## 7. Les nombres et la plage

### 7.1 Où sont les nombres

- **Compter** : Pixel compte ses blocs en les posant (débutant, à voix haute en une phrase, avec le chiffre affiché à chaque pose ; autonome, « Ma moitié a {5} blocs. ») ; le bandeau « 3 / 5 » avance à chaque jumeau juste.
- **Doubles** : à chaque figure finie, `M3_DONE` (« 5 + 5 = 10 blocs ! ») : le même nombre de chaque côté est la propriété de la symétrie elle-même.
- **Complément** : `M3_NEED_BLOCKS` et `M3_FREE_MORE` (« il en faut 5, tu en as 3 : il en manque 2 »). À l'écrit, l'autonome peut voir la soustraction « 5 − 3 = 2 » (§18, décision 3).
- **Addition à trois termes** (plage 100) : le récapitulatif des félicitations, « 14 + 20 + 24 = 58 blocs » pour l'autonome ; « 58 blocs en tout ! » pour un débutant réglé sur la plage 100, avec l'addition seulement si le total tient dans sa plage (`M3_RECAP`).
- Règle d'affichage, comme `DEBUTANT_SUM_MAX` à la fabrication : l'addition est écrite si son total tient dans la plage du profil ; au-delà, le total seul (« 14 blocs ! »). Dans la figure libre, un enfant de la plage 10 qui pose 6 blocs de chaque côté entend « 12 blocs ! Bravo ! ».

### 7.2 La plage de nombres

- Trois valeurs : **jusqu'à 10**, **jusqu'à 20**, **jusqu'à 100**. Ce ne sont pas des seuils du programme (§1 : le CP fixe cinquante-neuf au plus tard en période 2, puis cent) mais des tailles de figures et d'additions ; au-delà de 100, `numberWords` écrit des chiffres et les figures ne tiennent pas à portée de main.
- Réglage par profil (les deux enfants n'ont pas le même niveau), proposé par défaut selon le niveau de lecture : débutant 10, autonome 20 (§18, décision 1).
- Effet :
  - mission 3 : choix des figures (taille, nombre de rangées pour la plage 10), minimum de la figure libre, additions et récapitulatif ;
  - fabrication : le seuil `DEBUTANT_SUM_MAX` (10) suit la plage du profil. Seule la variante débutant est concernée (l'autonome voit déjà toutes les additions, `craftText`), et seulement si l'adulte donne au débutant la plage 20 ou 100 : avec la plage par défaut du débutant (10), rien ne change (§18, décision 2) ;
  - missions 1 et 2 : **aucun effet** (6 troncs et 4 pierres, mots de la mission 2 inchangés), pour ne pas changer des missions déjà testées et en cours dans les mondes des enfants (§18, décision 2).

### 7.3 Catalogue de figures

Figures dessinées pour le jeu (rien de Minecraft), vues de face, de haut en bas ; `#` bloc, `.` vide, `|` axe ; la moitié gauche est celle de Pixel quand le modèle est à gauche.

Règles du catalogue, vérifiées par le test `figures` (§14) :
- chaque figure est d'un seul tenant, tient dans 3 colonnes × 5 rangées par moitié, et sa moitié n'est pas elle-même symétrique (sinon recopier et retourner donnent la même chose, et le diagnostic `translated` ne sert à rien) ;
- **règle d'appui** : toute case d'une rangée r ≥ 2, et toute case de la rangée r = 1 sans bloc dessous, a dans sa rangée une voisine pleine du côté de l'axe (pour c = ±1, le bloc de l'autre moitié). Autrement dit, chaque rangée haute part de l'axe sans trou. Cette règle remplace « touche le sol par un bloc contre l'axe », qui ne garantissait pas la construction : une case de la 3e rangée ou plus ne s'appuie que sur une face latérale (§4.1). Elle est suffisante, pas nécessaire ; `buildOrder` reste le juge (test de chaque figure, des deux côtés) ;
- plage 10 : 2 rangées au plus (proposition de la décision 17).

Plage 10 (2 rangées, aucune case contre une face latérale) :

Marche (3 par moitié, 3 + 3 = 6 ; le miroir diffère de la recopie : le bloc du haut est contre la ligne) :
```
. # | # .
# # | # #
```
Bateau (4 par moitié, 4 + 4 = 8) :
```
# . . | . . #
# # # | # # #
```
Voiture (5 par moitié, 5 + 5 = 10) :
```
. # # | # # .
# # # | # # #
```

Plages 20 et 100, et plage 10 si la décision 17 retient l'aide à la visée plutôt que les figures basses :

Petit arbre (4 par moitié, 4 + 4 = 8) :
```
# # | # #
. # | # .
. # | # .
```
Maison (5 par moitié, 5 + 5 = 10) :
```
. # | # .
# # | # #
# # | # #
```
Sapin (7 par moitié, 7 + 7 = 14) :
```
. . # | # . .
. # # | # # .
# # # | # # #
. . # | # . .
```
Papillon (10 par moitié, 10 + 10 = 20 ; rangée du haut redessinée, l'ancienne `# # . | . # #` n'avait aucun appui) :
```
. # # | # # .
# # # | # # #
. . # | # . .
# # # | # # #
. . # | # . .
```
Château (12 par moitié, 12 + 12 = 24 ; créneaux du haut remplacés, l'ancien `# . # | # . #` laissait la case c = ±3 sans appui ; la porte au pied de l'axe reste, la règle d'appui la permet) :
```
. # # | # # .
# # # | # # #
# # # | # # #
# # . | . # #
# # . | . # #
```

Simulation (préambule), cibles seules, modèle déjà posé, enfant immobile : marche, bateau et voiture constructibles depuis tout écart de −1 à +4 blocs (à 5 blocs de distance ; davantage à 3 ou 4) ; petit arbre à partir de +1,5, maison +0,5, sapin, papillon et château redessinés +2,5 (à 5 blocs de distance, papillon et château seulement à +2,5 exactement : d'où 3 ou 4 blocs pour les figures hautes, §4.1). L'ancien papillon et l'ancien château n'étaient constructibles depuis aucune position.

| Plage | Étape 0 | Étape 1 | Étape 2 | Figure libre (minimum par côté) | Blocs que l'enfant pose (au moins) |
|---|---|---|---|---|---|
| jusqu'à 10 | marche (6) | bateau (8) | voiture (10) | 3 (6 en tout) | 3 + 4 + 5 + 6 = 18 |
| jusqu'à 10, décision 17 (b) | marche (6) | petit arbre (8) | maison (10) | 3 (6 en tout) | 3 + 4 + 5 + 6 = 18 |
| jusqu'à 20 | maison (10) | sapin (14) | papillon (20) | 5 (10 en tout) | 5 + 7 + 10 + 10 = 32 |
| jusqu'à 100 | sapin (14) | papillon (20) | château (24) | 8 (16 en tout) | 7 + 10 + 12 + 16 = 45 ; récapitulatif 14 + 20 + 24 = 58 |

- Plage 10 : 18 blocs, du même ordre que les 15 lettres estimées de la mission 2. Plages 20 et 100 : nettement plus longues (§15) ; on pourra ajouter des figures au catalogue (cœur, fusée, champignon, robot…), dans le respect des règles ci-dessus, pour varier d'un monde à l'autre, choisies par la graine du monde comme les mots de la mission 2 (`pickWord`).
- Plage 10 : le bateau et la voiture font 6 colonnes en tout ; l'enfant se tient devant la moitié à compléter (§4.1), la moitié de Pixel est sur le côté (§15).
- Hauteur : 5 rangées au plus, à vérifier sur le convertible (les rangées r = 2 à 4, de la 3e à la 5e, sont au-dessus de l'œil : elles se posent contre le côté d'un bloc voisin, jamais sur le dessus d'un bloc, §4.1, §15).

## 8. Moteur : modules purs (testés en Node)

### 8.1 `src/engine/symmetry.ts` (nouveau, sans Three.js ni DOM)

- Types : `MirrorSite` (origine, `f`, `d`, côté du modèle), `FigureShape` (liste de cases (c, r) d'une moitié, largeur, hauteur), `MirrorMode` (`shape` | `colours`).
- `mirrorOf(site, cell)` et `cellsOf(site, shape, side)` : cases du monde d'une moitié et de son jumeau.
- `planFigure(w, feet, yaw, shape, hfovDeg, aim)` : place d'une figure devant l'enfant, sur le modèle de `planLine` : axe dominant du regard ; cadre (largeur totale × hauteur) entièrement dans l'air ou des fleurs, posé sur un sol plat opaque sans bloc-lettre ; la rangée côté enfant libre et non opaque ; une colonne d'air au bout de chaque côté (rien de collé, ni lettre ni autre figure) ; la case des pieds de l'enfant hors du cadre ; l'axe à environ un bloc du regard, côté modèle (§4.1), à 3 ou 4 blocs pour une figure de 4 ou 5 rangées, 3 à 5 sinon, puis décalé ; **seules les cibles sont vérifiées** : elles doivent être constructibles dans l'ordre de `buildOrder` (le modèle posé), depuis l'œil de l'enfant ou depuis une position de sa rangée (pas de 0,5 bloc, sur le sol plat et libre, jusqu'à largeur − 0,5 bloc au-delà de l'axe côté cibles). Le modèle n'est pas vérifié : Pixel l'écrit dans le monde sans viser. (Exiger que le modèle **et** les cibles soient posables depuis un même œil rendait toute place impossible sauf pour une tour d'une colonne : une face latérale ne se vise que du côté vide, le modèle demanderait un œil côté modèle et les cibles un œil côté cibles ; simulation, préambule.) Aucune place : `null` (le jeu dit `M3_NO_PLACE` et réessaie toutes les 0,5 s quand l'enfant bouge, comme la mission 2).
- `buildOrder(w, aim, cells, filled)` : un ordre où chaque case est posable depuis l'œil, les cases d'avant étant pleines (gloutonne : à chaque tour, la première case posable, du bas vers le haut et de l'axe vers l'extérieur) ; `null` si on reste coincé.
- `aimSpot(w, site, cell, feet)` : direction (gauche, droite, approcher) d'une position de la rangée de l'enfant d'où la case suivante est posable, pour `M3_MOVE_SIDE` et `M3_COME_CLOSER` ; `null` s'il n'y en a pas.
- `judgeMirror(w, site, model, mode)` → `{ filled, total, targets[], missing[], wrongBlock[], extra[], offPlane[], letters[], diagnosis, done }`.
- `judgeFree(w, site, frame, minPerSide, mode)` → `{ left, right, pairs, unmatched[], twinCells[], outOfFrame[], symmetric, done }` (la stabilité est décidée par `mirrorSession`, §8.3).
- Les fonctions privées de `words.ts` qui serviraient aussi (`inWorld`, recherche de la hauteur du sol) sont exportées ou dupliquées (choix à la réalisation ; `canAimAt` est déjà exporté).

### 8.2 `src/edu/figures.ts` (nouveau)

Catalogue : identifiant, nom pour l'enfant et l'adulte avec son genre et son article (« une maison », « un sapin », pour les textes), forme d'une moitié, palier, plages. Liste des types permis pour le second type du mode couleurs (§5.4). `pickFigure(range, tier, seed, exclude)` : choix déterministe par la graine du monde, hors des figures déjà faites dans ce monde.

### 8.3 `src/edu/mirrorHelp.ts`, `src/edu/mirrorSession.ts` et `src/edu/mirrorTexts.ts` (nouveaux)

- `mirrorHelp` : §6 (seuils exportés, comme `COPY_NEXT_GHOST_MS`, etc.).
- `mirrorSession` : toutes les règles de temps et de distance de la mission 3, pour qu'elles soient testées dans Vitest comme `wordHelp` et non seulement en fumée : il reçoit le temps, les changements dans le cadre et à ses abords, la distance de l'enfant à l'axe, l'état du modèle et du sol sous le cadre, et rend les actions : valider la figure libre (8 s de stabilité), remettre tel bloc du modèle ou reboucher tel bloc du sol (3 s, case vide, hors de la boîte du joueur ; voix une fois par figure), dire `M3_FAR` (au-delà de 12 blocs, au plus toutes les 30 s), retracer une figure (au-delà de 24 blocs pendant 90 s), cadence des poses de Pixel (§4.3). `Game.ts` ne fait que brancher.
- `mirrorTexts` : gabarits du §3.3 et textes calculés : `doubleText(n, range, level)`, `missingText(need, have, level)`, `sumText(terms, range, level)`, en deux formes (écrite en chiffres, dite en lettres). `writtenSum` et `spokenSum` sortent de `craftTexts.ts` vers `counting.ts`, avec un nom comptable en paramètre (`CountNoun`) au lieu d'un `BlockId` : « 5 + 5 = 10 blocs » demande un nom générique qui n'est pas un bloc.

### 8.4 Modifications de modules existants

- `missions.ts` :
  - objectifs `{ kind: "mirror"; tier: 1 | 2 | 3 }` et `{ kind: "mirrorFree" }` ;
  - `MissionView.mirror?()` (comme `shelter?()`) : ce que le jeu a jugé ;
  - `MISSION_3` à la fin de `CAMPAIGN`, toutes ses étapes `holdEvening: true` ;
  - `MissionDef.tomorrow?: ChildText` (texte « demain » de la mission) ;
  - `noteHelp` et `help` acceptent aujourd'hui seulement une étape `write` : étendus aux objectifs `mirror` et `mirrorFree` (palier d'aide enregistré, §6) ;
  - `MissionProgress.figure` (place, figure, types, côté du modèle, blocs déjà posés par Pixel) et `MissionProgress.figures` (figures finies, pour le récapitulatif et l'adulte), relus de façon robuste comme `words` et `word` ;
  - **mots de la mission 2 conservés** : la progression d'un monde ne garde qu'une mission (`readProgress` ignore une progression d'un autre identifiant). Au passage à la mission 3, le champ `words` disparaîtrait ; or `wordsSeen` (appelé par `Game` au tirage des mots) écarte les mots des autres mondes de l'enfant par ce champ, et `progressLabel` affiche « mots écrits ». Proposition : `MissionRunner` reçoit les mots déjà écrits de la mission précédente et les réécrit dans sa progression (`MissionProgress.words` relu quel que soit l'identifiant de la mission) ; de même plus tard pour `figures` ;
  - `RecapItem` gagne `{ figures: true }` ; `progressLabel` ajoute « — figures : marche, bateau » ;
  - `prepare` choisit la figure de l'étape (`pickFigure`) ; **une figure enregistrée est gardée dès qu'une place (`site`) existe ou qu'un bloc du modèle est posé, quelle que soit la plage du profil** ; une figure n'est retirée qu'avant le tracé. (Le `prepare` des mots ne garde un mot enregistré que s'il est encore dans la liste du niveau ; transposé tel quel, une plage changée entre deux parties ferait tirer une autre figure alors que le modèle de la première est déjà dans le monde.) La place est fixée par le jeu (elle dépend du regard).
- `save/saveFormat.ts` : `Profile.numbers?: 10 | 20 | 100` ; `parseProfiles` l'écrit toujours (absent ou invalide : selon le niveau de lecture).
- `Game.ts` :
  - `keptBlocks()` : en mode couleurs, les types de la figure en cours ;
  - `refreshCompanionPanel` calcule l'avancement avec `m.progress(this.inventory)`, pas avec `missionView` : il faut lui passer `missionView`, sinon un `mirror()` ajouté à `MissionView` n'y serait jamais appelé et le bandeau resterait à 0 / n ; et ajouter `mirror` et `mirrorFree` aux objectifs comptés ;
  - `onMissionDone` ne traite à part que la mission 2 (dernier objectif `write` : mot félicité, retour au mode Casser) ; avec `mirrorFree`, la mission 3 tomberait dans la branche de la mission 1 (« Bravo », félicitations à 1,6 s), sans `M3_FREE_DONE` ni retour au mode Casser : une branche selon le dernier objectif (mot ou figure), qui remet le mode Casser dans les deux cas ;
  - adresse : `opts.mission === 0 ? TUTORIAL : opts.mission === 1 ? MISSION_1 : MISSION_2` ferait de `#mission=3` la mission 2 : une table mission par numéro ;
  - `queueMission` (test `def === MISSION_2`) et `updatePendingMission` (qui dit `MISSION_2_TOMORROW`) lisent `def.tomorrow` ;
  - début de la mission 3 : une case du sac mise en main (§3.1) ;
  - Pixel : but imposé et réapparition pendant la mission 3 (§4.2) ;
  - `letterHandReminder` (rappel de la lettre en main) reste propre à la mission 2.

## 9. Rendu et interface

### 9.1 `src/render/SymmetryGuide.ts` (nouveau)

Bande de l'axe et ligne au sol en tirets (couleur de l'axe) ; contour de la boîte de la figure en miroir (autonome) et du cadre de la figure libre (couleur distincte). Maillages simples sans lumière, luminosité par la couleur du matériau (`setBrightness`), dessinés après les couches transparentes du monde (ordre 3, comme `LetterGhosts`). Jamais dans `World` : ni visée, ni physique.

### 9.2 `LetterGhosts.ts`

Réutilisé pour les cases claires (jumeaux), la case suivante, les contours orange (blocs à revoir, hors du plan, hors du cadre) et verts (paire juste, figure finie). Bornes : `MAX_GHOSTS` passe à 16 (12 cibles du château, 15 jumeaux au plus dans la figure libre) ; `MAX_MARKS` passe à 32 (le vert de la figure finie couvre toute la figure : 24 blocs pour le château, jusqu'à 30 cases du cadre pour la figure libre ; les contours orange peuvent aussi dépasser 16). Nouveau type de contour « repère » (jaune clignotant) pour le bloc du modèle qui fait face à la case suivante (§6) : `LetterGhosts` n'a aujourd'hui qu'un contour jaune, `nextOutline`, qui suit la case suivante, et ses contours de `setMarks` sont orange et verts, sans clignotement. Test dans `mesh.test.ts` (qui vérifie aujourd'hui `lines().length` égal à `MAX_MARKS`).

### 9.3 Bandeau et félicitations

- `src/ui/figureIcon.ts` (nouveau, comme `wordIcon.ts`) : la figure en petites tuiles de l'atlas, l'axe en trait ; utilisée par le bandeau de Pixel et par l'écran de félicitations.
- Compteur du bandeau : `refreshCompanionPanel` compte aujourd'hui les objectifs `collect`, `place`, `break` et `letter`, avec l'inventaire ; on y ajoute `mirror` et `mirrorFree`, avec `missionView` (§8.4). Pendant que Pixel construit, le bandeau montre son compte (§4.3).
- Félicitations (`Celebration.ts`, lignes icône + texte) : une ligne par figure (« Maison : 5 + 5 = 10 »), la figure libre, le total pour la plage 100. Animation de pliage en option (décision 20).
- Aucun bouton, aucun écran posé sur le jeu, aucune touche nouvelle : les règles des écrans posés sur le jeu ne sont pas concernées. Les tests de mise en page (`HUD_LAYOUT`) reçoivent l'icône si elle change la taille du bandeau (**à vérifier** à la réalisation).

## 10. Mode parent

- Ligne de chaque enfant : à côté du niveau de lecture et de la voix, une liste « Nombres : jusqu'à 10 / jusqu'à 20 / jusqu'à 100 » (`aria-label` « Nombres du joueur 1 »).
- Valeur par défaut à la création du profil et à la lecture d'un profil qui n'en a pas : débutant 10, autonome 20. Changer le niveau de lecture ne change pas la plage (au contraire de la voix aujourd'hui), pour ne pas défaire un choix de l'adulte (§18, décision 1).
- Changer la plage en cours de mission 3 : prise en compte à la figure suivante ; la figure en cours garde sa taille (règle de `prepare`, §8.4).
- Progression : « mission 3 (le miroir) : étape 2 sur 4 (compléter une deuxième figure) — figures : marche ».
- Une seule variante (texte pour l'adulte).

## 11. Sauvegarde et compatibilité

- **Aucun bloc nouveau** : les figures utilisent des blocs existants ; l'axe et les cases claires ne sont pas des blocs. Atlas, `BlockId`, `GENERATOR_VERSION` (2) et le test « empreinte du terrain » ne changent pas. Si un bloc devait être ajouté (§18, décision 8), il irait à la fin (44), sans renuméroter.
- `SAVE_VERSION` (1), `WorldSave` et `ExportFile` ne changent pas ; ajouts optionnels : `MissionProgress.figure`, `MissionProgress.figures`, `Profile.numbers` ; `MissionProgress.words` gardé d'une mission à l'autre (§8.4).
- Blocs de Pixel (modèle, sol rebouché) : dans l'écart du monde, comme ceux de l'enfant.
- **Reprise** :
  - figure enregistrée et valide : même place, même figure (quelle que soit la plage), mode recalculé depuis le niveau (§5.2) ; les blocs du modèle manquants sont remis par Pixel (§12) ;
  - figure enregistrée illisible ou place devenue impossible : nouvelle place ; l'ancienne figure reste dans le monde comme décor ;
  - partie quittée pendant que Pixel construit : il finit à la reprise.
- **Mondes de la 1.1-rc** : mission 2 finie → mission 3 de jour (§3.1) ; mission 2 en cours → rien ne change.
- **Retour à la 1.1-rc (à éviter)** : `missionById("miroir")` y renvoie `null`, donc `resumeMission` repartirait du tutoriel ou de la mission 1 (relu dans le code de la 1.1-rc, non essayé), et les étoiles tomberaient à 0 à l'accueil ; `parseProfiles` y oublierait la plage de nombres au premier enregistrement des profils. Même consigne qu'au J8 : exporter avant la mise à jour, ne pas rouvrir ces mondes avec l'ancienne version.

## 12. Aucun échec bloquant

| Situation | Ce qui se passe |
|---|---|
| Pas de nuit (mode parent) | Rien ne dépend de la nuit ; la mission démarre de jour, et le mode « pas de nuit » passe de 18 h au matin (`advancePhase`) |
| Grignotes coupées | Rien ne dépend d'elles. Actives : le soir retenu à 17 h les tient à l'écart pendant la mission ; elles chipent dans le sac, jamais dans le monde (`creatures.ts` ne modifie aucun bloc, relu), donc jamais dans une figure ; les types de la figure en mode couleurs sont protégés |
| Sac plein | Mode forme : l'enfant a des blocs à poser. Mode couleurs, type manquant : le conseil « sac plein » existant désigne une case à vider (`slotToEmpty`, types de la figure protégés) |
| Sac vide | « Casse le sol plus loin ! » ; le sol en donne toujours ; un bloc du modèle cassé en donne aussi, Pixel le remet |
| Sol cassé sous le cadre (l'enfant ramasse près de la figure) | Une cible de la rangée 0 n'aurait plus de dessous, et un bloc posé dans le trou (rangée −1, hors du cadre) ne compterait pas. Pixel rebouche le sol sous le cadre et sous la rangée côté enfant devant lui, avec le bloc du sol, comme il remet un bloc du modèle (3 s, case vide, hors de la boîte du joueur, `M3_GROUND_BACK` une fois par figure) ; `M3_NEED_BLOCKS` dit de casser plus loin |
| Pas de sol plat devant | `M3_NO_PLACE`, nouvel essai toutes les 0,5 s quand l'enfant bouge (comme `GHOST_NO_PLACE`) |
| Case hors de portée ou pas visable d'où il est (en face de l'axe, rangées hautes) | La case suivante est la première posable d'où il se tient ; sinon elle brille quand même et Pixel dit de quel côté aller (`M3_MOVE_SIDE`) ou de s'approcher (`M3_COME_CLOSER`) ; `planFigure` garantit qu'une position de sa rangée suffit (§8.1) |
| Bloc posé devant ou derrière la figure | Ignoré pour la validation, contour orange à chaque fois, `M3_OFF_PLANE` une fois par figure, la cible derrière brille |
| L'enfant casse le modèle | Pixel remet le bloc 3 s après (`M3_MODEL_BACK`, une fois par figure), seulement si la case est vide et hors de la boîte du joueur ; un bloc de l'enfant posé à la place n'est jamais cassé. Le jugement ne dépend pas des blocs du modèle (§5.1) |
| L'enfant construit ailleurs ou s'éloigne | Rien n'est lu hors du cadre ; au-delà de 12 blocs de l'axe, `M3_FAR` (au plus toutes les 30 s) ; au-delà de 24 blocs pendant 90 s, Pixel trace une nouvelle figure devant lui, l'ancienne reste comme décor (§18, décision 5) |
| Pixel bloqué derrière la figure | Il réapparaît à sa place quand il n'avance plus (§4.2) |
| L'enfant se coince (puits, cage de blocs) | Escalade de secours (`Player`), conseils de `pit.ts` ; Pixel ne pose jamais dans la boîte du joueur ; la rangée côté enfant reste libre |
| Lettre posée dans une cible | Non comptée, contour orange, `M3_LETTER_IN_TARGET` ; elle se casse en 0,2 s et retourne dans la boîte |
| Figure libre validée en cours de construction | Validation seulement après 8 s sans pose ni casse dans le cadre et à ses abords (§5.3) |
| Figure libre jamais symétrique, ou blocs hors du cadre | Les jumeaux manquants brillent ; les blocs hors du cadre sont signalés (`M3_OUT_OF_FRAME`) ; jamais de refus définitif |
| Partie quittée pendant la mission | Reprise à la même figure (§11) |

## 13. Accès de test et adresse

- `#mission=3` : mission 3 tout de suite, même la nuit (comme `#mission=2`) ; `&nombres=10|20|100` fixe la plage en mode adresse (défaut : selon `&lecture=`, sinon 10).
- `window.cubesDebug` :
  - `state().mirror` : place, axe, figure, `model`, `targets`, `filled`, `extra`, `offPlane`, `wrongBlock`, `ghostCells`, `diagnosis`, palier d'aide, blocs encore à poser par Pixel, place de Pixel ;
  - `checkMirror()` (jugement immédiat, comme si l'enfant s'était arrêté), `advanceMirrorClock(ms)` (horloge d'aide et horloge de `mirrorSession` : stabilité de la figure libre, remise du modèle et du sol), `finishPixelBuild()` (fin immédiate de la construction de Pixel) ;
  - `skipMissionStep()` couvre `mirror` et `mirrorFree`.
- Les tests posent dans les cibles en visant comme l'enfant (`look` puis `placeBlock`, comme `aimAndPlace` de la mission 2), depuis une position d'où la cible est visable (`teleport` sur la rangée de l'enfant).

## 14. Tests prévus

### Unitaires (Vitest)

- `symmetry` : jumeaux sur les quatre axes ; `judgeMirror` (complet, partiel, bloc en trop, embellissement symétrique accepté, hors plan ignoré et rendu dans `offPlane`, lettre non comptée, fleur vide, mode couleurs, modèle cassé sans effet) ; diagnostics `translated`, `shiftedSide`, `shiftedUp` (et pas de `translated` pour une moitié elle-même symétrique) ; `judgeFree` (minimum, jumeau manquant, types, hors du cadre) ; `planFigure` sur le monde plat (quatre caps, en biais), refus (pente, eau, mot ou figure collés, pieds dans le cadre) ; **chaque figure du catalogue, modèle à gauche puis à droite : `planFigure` trouve une place sur le monde plat dans les quatre directions** ; `buildOrder` : chaque figure du catalogue, des deux côtés, depuis la place prévue (reprend la simulation du préambule) ; `aimSpot` (enfant en face de l'axe devant une figure haute : direction vers les cibles) ; balayage de mondes générés (quatre types, graines 1 à 3, quatre directions), comme la revue du J8 (constat 2) : toute place proposée est constructible et lisible.
- `figures` : chaque figure d'un seul tenant, tient dans 3 × 5, moitié non symétrique, **règle d'appui** (§7.3), plage 10 en 2 rangées, nombres du tableau §7.3 ; types permis du mode couleurs (ni verre, ni lampe, ni pierre brillante, ni arc-en-ciel, ni clôture, ni cactus, ni lettre) ; `pickFigure` déterministe et sans répétition.
- `mirrorHelp` : seuils, palier qui ne redescend pas, étapes 0 et 1 du débutant (case suivante et repère d'emblée), autonome.
- `mirrorSession` : stabilité de la figure libre (8 s, remise à zéro par une pose ou une casse aux abords), remise du modèle et du sol (3 s, case vide, hors de la boîte du joueur, voix une fois), `M3_FAR` (12 blocs, 30 s), nouvelle figure (24 blocs, 90 s), cadence des poses de Pixel (au moins 0,8 s par bloc pour le débutant).
- `mirrorTexts` : deux variantes de chaque texte (y compris `M3_STEP_COLOURS`, `M3_WRONG_BLOCK`, `M3_THIRD_PERSON`, `M3_RECAP`), 5 mots au plus pour le débutant, espaces insécables, additions écrites et dites (accords), genre du nom de la figure, seuil de la plage, complément, texte de pose selon le mode du bouton.
- `counting` : additions sorties de `craftTexts` avec un nom comptable (les tests de `craftTexts` doivent rester verts).
- `missions` : `MISSION_3` (étapes, `holdEvening`), progression, reprise (`figure`, `figures` abîmés), `noteHelp` et `help` pour `mirror`, « plage changée, figure gardée », mots de la mission 2 gardés dans la progression de la mission 3 (et relus par `wordsSeen`), `starsEarned` = 3, `resumeMission` après la mission 2 finie, `progressLabel`.
- `companion` : but fixe derrière un mur de 2 blocs, réapparition à sa place.
- `mesh` : contour « repère » clignotant, `MAX_MARKS` relevé.
- `save` : `Profile.numbers` (absent, invalide, valeurs), mots gardés d'une mission à l'autre, export et import.
- `urlOptions` : `mission=3`, `nombres=`.

### Fumée (Playwright, Chromium ; `#monde=plat&graine=1&mission=3`)

1. Pixel construit sa moitié (blocs présents dans le monde, `state().mirror.model`), l'axe est affiché, bandeau « 0 / n », Pixel hors du cadre et jamais entre l'enfant et la figure.
2. Figure complétée en visant et en posant dans les cibles : étape validée, l'addition est dite.
3. Moitié recopiée sans être retournée : `M3_TRANSLATED`, étape non validée.
4. Bloc en trop dans le cadre : contour orange, validation après la casse ; bloc posé devant la figure : ignoré, contour orange, `M3_OFF_PLANE` une fois.
5. Débutant (forme) accepte un autre bloc ; autonome (couleurs) le signale.
6. Bloc du modèle cassé : remis, jamais dans la boîte du joueur ; sol cassé sous le cadre : rebouché.
7. Aide : `advanceMirrorClock(16_000)` puis `31_000` (case suivante, puis toutes les cases claires) ; enfant en face de l'axe devant une figure haute : `M3_MOVE_SIDE`.
8. Sac vide : conseil, le sol cassé plus loin donne de quoi finir.
9. Pas de place (regard vers un mur) : `M3_NO_PLACE`, puis une place en se tournant.
10. Figure libre : validée symétrique et stable, pas avant le minimum ni pendant la construction ; bloc hors du cadre signalé.
11. Campagne : fin de la mission 2 → félicitations → mission 3 en attente (`pendingMission` = `miroir`) le soir, puis le matin ; trois étoiles à l'accueil ; fin de la mission 3 : retour au mode Casser.
12. Mode parent : plage par profil enregistrée et relue ; `&nombres=`.
13. Pas de nuit, Grignotes coupées : mission jusqu'au bout.
14. Mise en page (`@tactile`, trois profils) si le bandeau change.

### À la main par Pierre, sous Firefox sur le convertible

Dans cet ordre de priorité :
1. **Visée au doigt des faces latérales** (rangées à partir de la 3e, plages 20 et 100 ; plage 10 si la décision 17 retient l'aide à la visée) : l'enfant de 6 ans pose-t-il seul une case de la 3e rangée ? Les faces vues de biais sont étroites à l'écran ;
2. geste nouveau : l'enfant pose-t-il dans le mur ou devant (blocs hors du plan) ?
3. place de l'enfant : se décale-t-il quand Pixel le lui dit (`M3_MOVE_SIDE`) ?
4. figure de 6 colonnes en portrait (l'enfant voit-il le modèle sur le côté ?) ;
5. voix qui compte : la phrase suit-elle les poses (latence de Firefox sous Windows) ?
6. lisibilité de l'axe de jour et au soir ; Pixel placé sur le côté ;
7. durée réelle par plage ; délai de stabilité de la figure libre (8 s : assez, trop ?) ;
8. compréhension de « ligne », « en face », « jumeau » (autonome) par chaque enfant ; erreur de recopie observée ou non.

## 15. Risques (non vérifiés)

- **Rangées au-dessus de l'œil** : à partir de la 3e rangée (r = 2 à 4), une case ne se pose que contre le côté d'un bloc voisin, visé de biais (§4.1) ; au doigt, ces faces paraissent étroites à l'écran, et le geste naturel (viser la face avant d'un bloc) pose devant la figure. Parades : figures de 2 rangées pour la plage 10 (décision 17), règle d'appui du catalogue et `buildOrder` (§7.3), place de l'enfant et `M3_MOVE_SIDE` (§4.1, §6), signalement des blocs hors du plan (§5.3) ; si l'essai sur le convertible est mauvais pour l'autonome aussi, figures limitées à 4 rangées.
- **Place de l'enfant** : les figures hautes demandent un écart de 1,5 à 2,5 blocs vers la moitié à construire ; l'axe et la moitié de Pixel sortent alors du champ (60° au moins) et se regardent en tournant la tête. Vue à la troisième personne en recours.
- **Champ de vision** en portrait : une figure de 6 colonnes ne tient pas entière dans 60° ; l'éloigner davantage la mettrait hors de portée.
- **Durée** des plages 20 et 100 (32 et 45 blocs au moins) : à mesurer avec l'autonome ; parade, figures plus petites ou une étape de moins.
- **Recopie au lieu du miroir** : erreur attendue, c'est l'objet du diagnostic `translated` ; à observer. La consigne du débutant n'emploie plus « pareil » (§3.3).
- **Figure libre** : délai de stabilité (8 s) à régler ; trop court, félicitations au milieu de la création ; trop long, attente.
- **Compte de Pixel** : synchronisation de la phrase et des poses estimée, pas mesurée (`speechMs`) ; à observer.
- **Pixel** : place imposée et réapparition à écrire et à observer (§4.2).
- **Terrain** : places plates rares en montagne ; balayage des mondes générés à faire (§14).
- **Blocs du modèle cassés à répétition** (jeu de l'enfant) : remis au plus une fois toutes les 3 s, sans fin ; chaque remise crée un bloc (décision 19) ; à observer.
- **Figures restantes** : trois ou quatre figures par monde s'ajoutent aux mots et à l'abri ; sans effet connu sur le rendu (blocs ordinaires).
- **Retour à la 1.1-rc** : mission reprise au début (§11).
- **Vocabulaire** : « ligne du miroir », « en face » compris à 6 ans, « jumeau » à 8 ans ? À observer.

## 16. Estimation (non vérifiée)

Comparée au J8 (conception le 01/11, réalisation et revue le 03/11 pour quatre fonctions, dont la mission 2) : **2 à 3 sessions**, plus une revue contradictoire et sa contre-vérification comme au J8. Estimation non refaite après la relecture du 06/11/2026 ; les ajouts (`mirrorSession`, `aimSpot`, contour « repère », place de Pixel, sol rebouché, mots gardés, aide à la visée si la décision 17 la retient) la tirent vers le haut de la fourchette.
- Modules purs et leurs tests (`symmetry`, `figures`, `mirrorHelp`, `mirrorSession`, `mirrorTexts`, `missions`, `saveFormat`, `companion`) : environ 1 session, en paquets parallèles comme au J8.
- Rendu (`SymmetryGuide`, `figureIcon`, contour « repère »), intégration dans `Game.ts` (place, construction de Pixel, jugement, aide, bandeau, félicitations, points du §8.4), mode parent, tests de fumée : 1 à 1,5 session.
- Revue et corrections : 0,5 à 1 session.

## 17. Documentation à mettre à jour à la réalisation

`README.md` (mission 3, plage de nombres, `#mission=3`, `&nombres=`) ; `CLAUDE.md` (architecture : `symmetry`, `figures`, `mirrorHelp`, `mirrorSession`, `mirrorTexts`, `SymmetryGuide`, `figureIcon` ; conventions de test de la mission 3 ; `cubesDebug`) ; `PLAN.md` §2 (mode parent, missions) et §6 ; `RECETTE-V1.md` §1 et §4 (plage de nombres livrée) ; `RETOURS.md` (protocole de la mission 3, dans l'ordre du §14 « À la main », visée au doigt des faces latérales en tête : « 3e rangée posée au doigt par l'enfant de 6 ans ? ») ; `JOURNAL.md` ; version dans `identity.ts` et `package.json`.

## 18. Décisions à trancher par Pierre

Question préalable :

A. **Classe de chaque enfant** (grande section ou CP ; CE1 ou CE2). La symétrie est au programme du CE2 seulement (§1) : la réponse confirme ou non le guidage renforcé du débutant (décision 17) et la présentation du mot « axe » à l'autonome (décision 12).

Décisions :

1. **Plage de nombres : où et quelles valeurs.** Proposition : réglage par enfant, trois valeurs (jusqu'à 10, 20, 100), défaut 10 pour le débutant et 20 pour l'autonome. Alternative : réglage commun aux deux enfants, ou défaut 100 pour l'autonome.
2. **Effet de la plage hors de la mission 3.** Proposition : missions 1 et 2 inchangées ; seule l'addition affichée au débutant à la fabrication suit la plage (aujourd'hui jusqu'à 10 ; sans effet tant que le débutant garde la plage 10). Alternative : mission 3 seulement ; ou bien des comptes plus grands à la mission 1 pour les nouveaux mondes (par exemple 10 troncs et 8 pierres en plage 20).
3. **Écriture de la soustraction.** Proposition : « il en manque 2 » pour les deux enfants, et « 5 − 3 = 2 » écrit en plus pour l'autonome (le signe « - » est au programme du CP, §1). Alternative : jamais de signe « − ».
4. **Couleurs.** Proposition : forme seule pour le débutant ; même bloc exigé pour l'autonome aux étapes 1 et 2 (bloc du sol et un type permis de son sac, §5.4) ; mode recalculé depuis le niveau à la reprise. Alternative : forme seule pour les deux ; ou couleurs pour les deux à l'étape 2.
5. **Tolérance.** Proposition : blocs posés devant ou derrière la figure ignorés pour la validation, mais entourés d'orange à chaque fois (voix une fois par figure, cible derrière qui brille) ; embellissement symétrique accepté ; enfant parti au loin 90 s : nouvelle figure devant lui. Alternative : figure stricte (rien de plus que les cibles) et figure jamais déplacée.
6. **Côté du modèle.** Proposition : débutant, modèle à gauche aux étapes 0 et 1, tiré au sort à partir de l'étape 2 ; autonome, à gauche à l'étape 0, tiré au sort dès l'étape 1. Alternative : toujours à gauche.
7. **Soir retenu pendant la mission 3.** Proposition : oui, comme la mission 2 (rien ne dépend de la nuit). Alternative : non, la nuit vient pendant la mission.
8. **Axe.** Proposition : trait lumineux entre deux colonnes, jamais un bloc (on le traverse). Alternative : une colonne de blocs « miroir » (nouveau bloc 44) au milieu de la figure, plus visible mais à casser, à sauvegarder et à protéger.
9. **Mondes où la mission 2 est finie.** Proposition : ils reprennent à la mission 3 (de jour). Alternative : seulement les nouveaux mondes.
10. **Cadeau de fin.** Proposition : 5 blocs arc-en-ciel et une étoile, comme avant. Alternative : un autre cadeau (à définir ; un bloc nouveau irait à la fin du registre).
11. **Jusqu'où va l'aide.** Proposition : case qui brille et bon bloc mis dans la main ; Pixel ne pose jamais à la place de l'enfant. Alternative : après 90 s, Pixel pose un jumeau avec lui.
12. **Vocabulaire.** Proposition : « ligne » pendant la mission, « en face » et « tout seul » pour le débutant, « jumeau » pour l'autonome ; « axe » et « symétrique » seulement pour l'autonome, à la fin (dans le programme du CE2, §1). Alternative : « axe de symétrie » dès le début pour l'autonome.
13. **Affichage de la moitié à compléter.** Proposition : débutant, l'axe et ses tirets au sol seulement ; autonome, en plus un contour fin de la boîte de la figure en miroir, d'une couleur distincte de l'axe ; cases claires seulement comme aide (case suivante d'emblée aux étapes 0 et 1 pour le débutant, à l'étape 0 pour l'autonome) ; cadre tracé pour la figure libre. Alternative : pas de contour pour personne ; ou contour du rectangle pour les deux.
14. **Icône du bandeau.** Proposition : figure entière pour le débutant (comme le modèle du mot en copie), moitié de Pixel et axe pour l'autonome. Alternative : figure entière pour les deux, ou pas d'icône.
15. **Ordre de la campagne.** Proposition : linéaire, la mission 3 après la mission 2. Alternative : mission 3 possible dès la mission 1 finie, pour un enfant qui bloquerait sur les mots.
16. **Nom de la mission.** Proposition : « Le miroir » (provisoire, à faire choisir par les enfants comme le nom du jeu). Alternative : « Les formes ».
17. **Rangées hautes pour le débutant.** À partir de la 3e rangée, une case ne se pose que contre une face latérale vue de biais (§4.1). Proposition : (a) plage 10 en figures de 2 rangées (marche, bateau, voiture, §7.3) ; rangées hautes seulement à partir de la plage 20. Alternative : (b) garder des figures de 3 rangées (petit arbre, maison) et ajouter pour le débutant une aide à la visée : un bloc qui se poserait hors du plan, juste devant une cible vide voisine, va dans la cible (ou le rayon s'arrête sur une cible vide qu'il traverse) ; c'est une règle de pose nouvelle dans `Game.placeBlock`, à tester. À revoir après l'essai sur le convertible (§14).
18. **Types de bloc de la figure en mode couleurs.** Proposition : second type parmi planches, pierre, terre, sable, tronc, feuilles, neige ; exclus verre, lampe, pierre brillante, arc-en-ciel, clôture, cactus et lettres (§5.4). Alternative : admettre l'arc-en-ciel (s'il y en a assez) ou la clôture.
19. **Blocs remis par Pixel (modèle cassé, sol sous le cadre).** Proposition : Pixel remet le bloc sans rien reprendre (le modèle et le sol restent lisibles ; un bloc créé au plus toutes les 3 s, d'un type permis seulement). Alternative : Pixel reprend un bloc de ce type dans le sac de l'enfant s'il y en a (« je reprends mon bloc »), ou ne remet pas un bloc du modèle tant que l'enfant le garde dans son sac.
20. **Animation de pliage.** Proposition : en option, après le premier essai : à `M3_DONE`, la moitié de Pixel pivote autour de la ligne et vient se poser sur celle de l'enfant (le programme s'appuie sur le pliage de la feuille, §1). Alternative : pas d'animation.

## Relecture

Revue contradictoire du 06/11/2026 : 37 remarques, chacune vérifiée dans le code, dans le document ou dans le texte du programme. Toutes celles qui étaient fondées sont appliquées ci-dessus (plusieurs remarques en double ont été fusionnées : consigne au doigt, astuces de casse, rythme du compte de Pixel, place de Pixel). Aucune n'est écartée en entier ; les parties suivantes le sont, ou sont tranchées autrement que proposé :

- **Plages « étapes à l'intérieur du CP »** : seuls cinquante-neuf (période 2) et cent (période 3) sont des repères du CP dans le texte relu ; 10 et 20 n'y figurent pas. Le §1 et le §7.2 disent donc « pas des seuils du programme », sans parler d'étapes.
- **Rectangle de la moitié vide** : pas supprimé pour l'autonome (proposé seulement pour le débutant) ; il devient la boîte de la figure en miroir, d'une couleur distincte (décision 13).
- **Arc-en-ciel comme second type du mode couleurs** : une remarque l'admettait, une autre l'excluait. Exclu par défaut (cadeau, et remise sans fin par Pixel), admis en alternative (décision 18).
- **Figure libre** : « compter tous les blocs reliés à la figure » et « l'écran de félicitations attend que l'enfant s'éloigne » ne sont pas retenus ; le cadre est montré, les blocs hors du cadre sont signalés, et la stabilité dure 8 s sans pose ni casse aux abords.
- **Trou sous le cadre** : la case claire « sol » n'est pas retenue ; Pixel rebouche le sol, comme il remet le modèle (un seul mécanisme).
- **Compte de Pixel** : « poser au signal de fin d'énoncé » n'est pas retenu tel quel : le `Narrator` ne lit aucun événement de fin d'énoncé aujourd'hui ; le pas suit la durée estimée (`speechMs`), au moins 0,8 s par bloc.
- **Contours** : « limiter le vert à la paire juste » n'est pas retenu ; `MAX_MARKS` passe à 32.
- **Mots de la mission 2** : le champ du monde (`WorldSave`) n'est pas retenu ; les mots sont reportés dans la progression de la mission suivante (aucun changement de `WorldSave`).
- **Rangées hautes** : ni (a) ni (b) n'est imposé ; (a) est la proposition, (b) l'alternative (décision 17). La remarque parlait de « rangée 2 » et de « 3e rangée » pour la même rangée (r = 2, comptée depuis 0) ; le document dit « à partir de la 3e rangée (r = 2) ».
- **Numéros de ligne de `Game.ts`** cités par la revue : ils ont bougé (fichier modifié dans la copie de travail) ; le document cite les fonctions.
- **Étendu par analogie** (non demandé) : `M3_SHIFTED_SIDE` débutant (« Colle-la à la ligne ! ») avait le même pronom sans antécédent que « Retourne-la » ; devenu « Pose contre la ligne ! ».
