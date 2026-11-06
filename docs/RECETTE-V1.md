# Recette V1 — « Cubes » 1.0-rc

Recette technique du jalon J7 (25/09/2026), faite côté cloud (Chromium sans carte graphique ni voix) par un audit indépendant du code contre `BRIEF.md`, `PLAN.md` et `CLAUDE.md`, puis mise à jour après les corrections du J7. **Elle ne remplace pas la recette avec les enfants** : les critères de réussite du brief se vérifient sur le convertible (protocole « Recette V1 » de `RETOURS.md`). La version passera de « 1.0-rc » à « 1.0 » après cette séance et ses corrections.

**Mise à jour du 03/11/2026 (J8, version 1.1-rc).** Pierre a tranché les décisions ouvertes du §5 le 01/11/2026 ; le lot 1 de la V2 (`docs/V2-LOT1.md`) les applique, et lève aussi plusieurs écarts du §4. Les tableaux des §1 à §3 décrivent la 1.0-rc ; les remarques marquées « J8 » disent ce qui a changé depuis. La recette avec les enfants reste à faire, maintenant avec la 1.1-rc.

Légende : **livré** ; **partiel** (livré avec une réserve) ; **absent** ; **Pierre** (à vérifier sur l'appareil ou avec les enfants).

## 1. Périmètre de la V1 (brief)

| Engagement | Statut | Où | Tests automatiques | Remarque |
|---|---|---|---|---|
| Se déplacer | livré | `Player`, `Keyboard`, `TouchControls`, `touchZones` | fumée « le clavier déplace le joueur », « au doigt : seul le rond fait marcher » ; `player.test` | Marches, eau, escalade de secours ; Pixel explique comment sortir d'un trou (J7, `engine/pit.ts`) |
| Casser et poser une dizaine de types de blocs | livré | `blocks.ts`, `Game.breakBlock`, `Game.placeBlock` | fumée « souris capturée : garder le clic gauche casse… », « au doigt : … mode Poser » ; `breaking.test` | Prairie : herbe, terre, pierre, sable, tronc, feuilles, 2 fleurs, lampe, clôture, arc-en-ciel ; neige ou cactus selon le monde. Planches introuvables par l'enfant, pas de verre (§4). J8 : planches, clôtures et verre se fabriquent ; verre et 26 blocs-lettres ajoutés |
| Inventaire simple | livré | `inventory.ts` (9 cases, une par type, 99 au plus) | `inventory.test` ; fumée « sac plein », « maximum de 99 » | Vider une case = poser tous ses blocs (§5). J8 : appui long sur une case (doigt, clic, touche 1 à 9 ; 1 s par défaut, réglable 0,8 / 1 / 1,2 s dans le mode parent depuis la 1.1-rc2) ; jamais la lampe, le cadeau ni le bloc de l'étape |
| Sauvegarde automatique | livré | `Game.saveNow` (30 s, page masquée ou fermée, bouton maison, chaque étape) | fumée « le monde est retrouvé après rechargement », « bouton accueil » ; `save.test` | Écart avec le monde régénéré |
| Export / import | livré, **Pierre** | `HomeScreen`, `SaveStore` (import tout ou rien, copies de secours exportées, J7) | fumée « mode parent : … exporter puis importer » ; `save.test` « import tout ou rien » | Téléchargement et sélecteur de fichier sous Firefox jamais vérifiés |
| Deux profils | livré | `saveFormat` (2 profils × 3 mondes) | fumée « premier lancement » | Profils créés par l'adulte |
| Choix du type de monde | livré | `terrain.ts`, accueil | fumée « monde « … » : généré… » ; `terrain.test` | Prairie, île, montagne, désert |
| Vue à la troisième personne | livré | `thirdPerson.ts`, `Avatar` | fumée « troisième personne » ; `save.test` « caméra à la troisième personne » (mur en escalier en diagonale au J7) | 6 personnages originaux |
| Lance-bulles | livré | `creatures.bubble`, `Bubbles` | fumée « Grignotes : … une bulle le fait rendre » | Touche B, bouton au doigt |
| Mission 1 : lecture de la consigne | livré | `missions.ts`, `Narrator` | fumée « compagnon Pixel et mission 1 » ; `missions.test` | Voix active par défaut pour le lecteur débutant |
| Mission 1 : comptage 6 bois + 4 pierres | livré | `missions.ts`, bandeau « 3 / 6 » avec l'icône du bloc cherché (J7) | `missions.test` ; fumée « mission 1 de bout en bout » (compte dit à l'objectif) | J7 : le compte réel est dit à voix haute (« Six troncs ! Bravo ! ») ; conseil « Creuse : la pierre est dessous ! » quand l'étape stagne (la pierre n'est en surface qu'en montagne) ; sac plein, conseil concret (« Pose tes 2 fleurs rouges ! ») |
| Mission 1 : abri | livré | `shelter.ts`, conseils de Pixel | `shelter.test` ; fumée « mission 1 de bout en bout » | Le toit reste la difficulté attendue (**Pierre**) |
| Mission 1 : créatures la nuit | livré | `creatures.ts` | `creatures.test` ; fumée « Grignotes : la nuit… » | La nuit tombe environ 7,5 min après la création du monde (§5). J8 : le soir s'arrête à 17 h tant que l'abri n'est pas fait |
| Mission 1 : la lampe éloigne les créatures | livré | dernière étape, temps accéléré, replis | fumée « mission 1 de bout en bout », « sans Grignotes » | Réponse suggérée d'avance au lecteur autonome (§5). J8 : aucun indice avant que l'enfant l'ait vu |
| Compagnon qui donne les missions, lit, félicite | livré | `Fox`, `companion.ts`, bandeau, `Celebration` | fumée « compagnon Pixel », « tutoriel », « mission 1 de bout en bout » | Bandeau en haut plutôt qu'une bulle |
| Mode parent discret (réglages, progression) | partiel | `HomeScreen` (appui long de 3 s) | fumée « mode parent », « accueil et mode parent », « écran des enfants » | Pas de « plage de nombres » ; l'indication « Adulte : garder appuyé 3 s » se lit à 8 ans (§5). J8 : indication retirée ; date du dernier export et rappel |
| Aucune mort, aucun combat, aucun échec bloquant | livré | `Player`, `creatures`, `Game.wouldLose`, replis de la mission | `pit.test`, `player.test` ; fumée « escalade de secours », « sac plein : … pierre brillante », « sac plein pendant l'étape 6 troncs », « sans Grignotes », « coincé au fond d'un puits » | J7 : sac plein, le bloc demandé par l'étape en cours ne se casse plus (il serait perdu : un désert n'a parfois qu'une douzaine de troncs) |
| Textes en deux variantes | livré | `texts.ts` (`ChildText`) | `counting.test`, `missions.test` | J7 : les deux derniers messages à une variante (monde ouvert ailleurs, plein écran refusé) en ont deux. Libellés identiques voulus : « Un abri », « Nouveau » |
| Tutoriel | livré | mission 0 | `missions.test` ; fumée « tutoriel » | Une fois par enfant |
| Jour et nuit | livré | `dayNight.ts` (12 min, nuit jamais noire) | `dayNight.test` ; fumée « la nuit tombe » | Mesuré : signal à 7,1 min, nuit à 7,5 min, 3 min de nuit (1 min en « courte ») |
| PC clavier et souris | livré | `Keyboard`, `MouseLook` | fumée (profil pc) | Edge jamais testé ; plein écran par F11 (le bouton est dans le panneau Tests, masqué pour l'enfant) |
| Convertible tactile | livré, **Pierre** | `TouchControls`, `fov.ts` | fumée `@tactile` (portrait et paysage, Chromium) | Protocoles J3 à J6 du convertible encore vides |
| Un seul fichier, hors ligne | livré | `vite.config.ts`, `dist/cubes.html` (704 ko) | fumée « le jeu démarre en file:// » (J7 : aucune requête en dehors du fichier) | Vérifié aussi navigateur hors ligne par l'audit |

## 2. Critères de réussite du brief

| Critère | Ce que le jeu permet | Risques connus | Statut |
|---|---|---|---|
| 1. L'enfant de 6 ans lance le jeu et joue 15 minutes seul | Accueil sans lecture obligatoire, tutoriel, conseils de Pixel (trou, abri, lampe, étape qui stagne), sauvegarde auto, panneau Tests masqué | « Qui joue ? » n'est pas lu (pas encore de geste de l'enfant : règle des navigateurs) ; sac plein ; vols des Grignotes ; sortie accidentelle hors plein écran | **Pierre** |
| 2. Il comprend et termine la mission 1 sans aide | Six étapes toujours validables, replis sans nuit ni Grignotes | Le toit ; la nuit avant l'abri ; creuser pour la pierre | **Pierre** — premier retour : parcours complet réussi par Pierre en profil débutant (25/09) |
| 3. Le jeu tourne de façon fluide sur le convertible | 60 images/s mesurées aux J1-J2 à 48 et 96 blocs | Rien remesuré depuis Pixel, les Grignotes, le halo, les bulles, le personnage | **Pierre** (mode parent → infos techniques) |
| 4. Les deux profils retrouvent leur monde | Sauvegarde auto, relecture robuste, copie de secours, deux onglets gérés | Stockage de Firefox en `file://` peut-être lié au chemin exact du fichier : jamais vérifié | **Pierre** (priorité avant la séance) |

## 3. Règles non négociables (`CLAUDE.md`)

| Règle | Statut | Vérification |
|---|---|---|
| 1. Un seul fichier, hors ligne | livré | Aucun `fetch`, `XMLHttpRequest`, `WebSocket` ni `import()` dans `src` ; un seul script intégré dans `dist/cubes.html` ; test de fumée sans aucune requête extérieure (J7) |
| 2. Rien de Minecraft | livré | Aucun nom, personnage ni texture repris ; noms « Cubes », « Pixel », « Grignotes » ; textures dessinées par code. L'identifiant interne `GlowStone` n'est jamais affiché (« pierre brillante ») |
| 3. Public 6-8 ans | livré | Deux variantes partout, aucune arme, boutons tactiles de 84 px |
| 4. Clavier par position physique | livré | `Keyboard` n'utilise que `KeyboardEvent.code`. J8 : seule exception, de la saisie, la lettre tapée dans la boîte à lettres ouverte (`LetterTray`, `event.key`) |
| 5. Moteur sans Three.js ni DOM | livré | Imports relatifs seulement dans `src/engine`, tests en Node |
| 6. Identifiants de blocs stables | livré | Ajouts à la fin seulement (J1, J5, J6, J8 : verre 17, lettres 18 à 43) ; test qui fige les valeurs (J7, `breaking.test`) |
| 7. Clés préfixées `cubes:` | livré, **Pierre** | `cubes:profils`, `cubes:reglages`, `cubes:monde:…`, `cubes:distance`, `cubes:test`, `cubes:dernier-export` (J8) ; comportement de Firefox à vérifier |

## 4. Écarts avec le plan (§2 de `PLAN.md`)

| Élément du plan | Livré | Écart |
|---|---|---|
| Graine fixée par profil | différent | Graine tirée à chaque nouveau monde, enregistrée avec lui ; trois mondes par enfant |
| Planches | livré (J8) | Se fabriquent : 1 tronc → 2 planches (et 2 planches → 1 clôture) |
| Verre, bloc-lettre | livrés (J8) | Ajoutés à la fin du registre : verre (17), lettres A à Z (18 à 43) ; verre fabriqué avec du sable, lettres prises dans la boîte de la mission 2 |
| Tactile « moitié gauche = joystick » | différent | Joystick fixe en bas à gauche (J3) |
| Durée de la nuit réglable | différent | Trois choix : normale, courte, pas de nuit |
| Sauvegarde « compressée par plages » | différent | Écart avec le monde régénéré, en base64 (quelques ko) |
| Rappel d'export régulier | livré (J8) | Date du dernier export dans le mode parent ; rappel avec « Exporter maintenant » si des mondes n'ont jamais été exportés, ou après plus de 7 jours, ou si la date du dernier export est incertaine (plus d'un jour dans le futur) |
| Mode parent : longueur des phrases | différent | Portée par le niveau de lecture |
| Mode parent : plage de nombres | absent | Sans effet sur la mission 1 ; backlog V2 (missions de mathématiques) |
| Compagnon : bulle de dialogue | différent | Bandeau en haut de l'écran |
| Créatures qui bloquent un passage | absent | Elles chipent seulement ; backlog V2 |

## 5. Décisions de Pierre (ouvertes au J7, tranchées le 01/11/2026)

Détail et mise en œuvre : `docs/V2-LOT1.md` (section « Décisions de Pierre ») et l'entrée J8 de `docs/JOURNAL.md`.

1. **Vider une case du sac** : oui, par un **appui long d'environ une seconde** sur la case, au doigt comme à la souris, et aussi au clavier en gardant la touche 1 à 9 enfoncée (depuis la 1.1-rc2, durée réglable dans le mode parent : 0,8 / 1 / 1,2 s, 1 s par défaut). Jamais la lampe ni le cadeau (le jeu protège aussi le bloc que demande l'étape en cours). **Clôture avec chaque tronc** : non, les troncs ne donnent plus de clôture ; elle se fabrique (2 planches, et 1 tronc donne 2 planches).
2. **Nuit avant l'abri** : le soir s'arrête à 17 h tant que l'abri de la mission 1 n'est pas construit ; aussi pendant le tutoriel et la mission 2. Si la mission 1 finit la nuit, le temps file (×30) jusqu'au matin avant la mission 2.
3. **Indication du mode parent** : retirée de l'écran « Qui joue ? ». Le geste (3 s sur l'engrenage) est rappelé une fois à l'adulte, sur l'écran du premier réglage.
4. **Lampe suggérée d'avance** : non, aucun indice avant que l'enfant l'ait vu (fin de la mission 1).
5. **Nom définitif** : toujours ouvert ; « Cubes » pour l'instant (`src/game/identity.ts`).

Décision ajoutée : **rappel d'export** dans le mode parent (date du dernier export, rappel au-delà de 7 jours). La version affichée pendant le lot 1 de la V2 est « 1.1-rc » ; la 1.0 sera déclarée après la recette avec les enfants.

## 6. À vérifier sur le convertible (Pierre)

Stockage de Firefox en `file://` (fermer, rouvrir le lendemain, fichier toujours au même endroit) ; images par seconde de la 1.0-rc (nuit, Grignotes, troisième personne, 128 blocs) ; vrais événements tactiles (plusieurs doigts, paume posée) ; appui long de 3 s au doigt sur l'engrenage ; plein écran et menu contextuel ; export et sélecteur de fichier ; voix et sons après le premier geste ; halo et confettis. Voir le protocole « Recette V1 » de `RETOURS.md`.
