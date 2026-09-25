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
    engine/          monde, sections, génération de terrain, jour/nuit, physique, raycast
    render/          scène Three.js, maillage par section, atlas de textures procédurales, ciel
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

Monde : 128 × 128 blocs, hauteur 64 (réalisé au J1). Les blocs sont rangés dans un seul `Uint8Array` (1 Mo), plus simple que des tableaux par chunk pour un monde borné ; le découpage sert au rendu : 256 sections de 16 × 16 × 16, chacune avec un numéro de version. Bords du monde : murs invisibles ; au-delà, une mer s'étend jusqu'à l'horizon.

Maillage : par section, seules les faces visibles (voisin non opaque) sont générées, avec une occlusion ambiante par sommet ; trois meshs par section (opaque, découpe pour les fleurs, eau) ; remaillage de la seule section modifiée (et de ses voisines si le bloc est sur une frontière), les sections en attente étant traitées de la plus proche à la plus lointaine dans un budget de temps par image. Le greedy meshing reste en réserve si la tablette peine.

Textures : atlas de tuiles 16 × 16 px dessinées par code sur un canvas au démarrage. Zéro image externe, style pixel-art original, aucun emprunt à Minecraft.

Génération : bruit de gradient 2D à graine (réalisé au J1, type Perlin) ; quatre types de monde (prairie, île, montagne, désert) avec herbe, terre, pierre, sable, neige, eau, arbres, fleurs, cactus. Même type et même graine donnent le même monde. Réalisé au J4 autrement : trois mondes par enfant, chacun avec une graine tirée à sa création et enregistrée avec lui. Pierres brillantes en surface depuis le J5 (générateur version 2).

Physique : boîte du joueur contre les blocs (AABB), gravité, saut, aucun dégât de chute ; au J1, montée automatique des marches d'un bloc, et dans l'eau on flotte (nager vers le haut, plonger), sans noyade.

Blocs V1 (livrés) : herbe, terre, pierre, sable, tronc, planches, feuilles, eau, deux fleurs, neige, cactus, lampe, clôture, pierre brillante (donne la lampe), arc-en-ciel (cadeau de la mission 1). Écarts : pas de verre ; les planches existent mais l'enfant ne peut pas en trouver (craft en V2) ; le bloc-lettre sera ajouté en V2 à la fin du registre (voir `RECETTE-V1.md`).

Contrôles clavier : touches repérées par position physique (`KeyboardEvent.code`), ce qui donne ZQSD en AZERTY et WASD en QWERTY sans aucun réglage. Regard à la souris via Pointer Lock.

Tactile : moitié gauche de l'écran = joystick virtuel ; moitié droite = glisser pour regarder ; boutons saut, bascule casser/poser, inventaire ; réticule au centre ; plein écran. L'appareil tactile est un convertible Windows sous Firefox, utilisé replié : l'orientation est laissée à Windows (verrou de rotation), un verrouillage par le code n'y étant pas pris en charge (Firefox ne le permet que sur Android, non vérifié sur l'appareil).

Audio : sons synthétisés par Web Audio (aucun fichier). Voix : `speechSynthesis` avec une voix fr-FR ; repli texte + icônes + sons si aucune voix française n'est disponible.

Jour/nuit : cycle de 12 minutes au J1 (9 de jour, 3 de nuit), nuit jamais noire ; durée réglable en mode parent (J4).

Créatures : machine à états simple. Le jour elles errent loin du joueur ; la nuit elles s'approchent, chipent un bloc de l'inventaire au contact, fuient à quelques blocs d'une lampe et ne franchissent pas les clôtures.

Sauvegarde : `localStorage` par profil (réalisé au J4 : écart avec le monde régénéré depuis sa graine, encodé en base64, plus inventaire, position, heure, progression de mission ; J6 : cadeau et écran de félicitations en attente) ; export = téléchargement d'un fichier JSON ; import = sélecteur de fichier. En `file://`, Chrome et Edge partagent le stockage local entre tous les fichiers ouverts localement : les clés sont préfixées `cubes:`. Firefox, navigateur du convertible, le rattacherait au chemin exact du fichier (non vérifié) : le J4 doit en tenir compte (toujours remplacer le fichier au même endroit sous le même nom, montrer en mode parent où vit la sauvegarde, proposer l'export avant une mise à jour).

Missions : données déclaratives (étapes, conditions observées sur l'état du jeu, textes en deux variantes débutant/autonome, récompense). Le moteur observe le jeu et fait avancer la mission ; le compagnon porte les dialogues.

Mode parent : appui long de trois secondes sur l'engrenage de l'écran d'accueil. Réglages : voix, longueur des phrases, plage de nombres, durée de la nuit, créatures actives ou non. Progression par profil. Réalisé : prénoms, niveau de lecture (qui règle aussi la longueur des phrases), voix, nuit (normale, courte, pas de nuit), Grignotes, panneau Tests (J7), progression (J6), effacer un monde, export et import. La plage de nombres n'est pas faite (sans effet sur la mission 1) : backlog V2.

Build : `npm run build` produit `dist/cubes.html`. Taille mesurée : environ 550 ko au J0.1, 580 ko au J1, 700 ko environ à la 1.0-rc, Three.js minifié compris (l'estimation initiale de 2 à 3 Mo était large), très en dessous du plafond de 20 Mo du dépôt de fichiers vers le poste.

### Ce qu'impose le fichier local (`file://`)

Un fichier ouvert par double-clic ne peut ni charger des modules ES externes ni lire des fichiers voisins par `fetch` : tout est inliné dans le HTML. Deux points restent à vérifier au J0 : le Pointer Lock en `file://` (repli : regard par clic-glisser, ou petit serveur local lancé sur le PC) et l'ouverture d'un fichier HTML local sur la tablette. Les deux sont levés : Pointer Lock vérifié sur PC (Chrome) ; la « tablette » est un convertible Windows qui ouvre le fichier par double-clic dans Firefox (vérifié au J1). Le repli « serveur sur le PC » (`npm run preview -- --host`) n'a plus d'usage prévu.

## 3. Jalons

| Jalon | Contenu | Livrable testable | Sessions (estim.) |
|---|---|---|---|
| J0 | Socle du projet et prototype technique | `cubes.html` minimal : marcher, casser/poser, test voix, compteur d'images | 1 à 2 |
| J0.1 | Corrections issues de l'audit (`AUDIT-J0.md`) | Même prototype, fiabilisé pour les tests de Pierre | 1 |
| J1 | Monde : chunks, terrain par type de monde, textures, jour/nuit, eau | Se promener dans un monde généré | 2 |
| J2 | Interaction : visée, casser/poser, inventaire, sons | Construire une cabane au clavier | 1 |
| J3 | Tactile et convertible | Construire la même cabane sur le convertible replié | 1 à 2 |
| J4 | Profils et avatars, choix du type de monde, vue à la 3e personne, sauvegarde, export/import, mode parent | Deux enfants retrouvent chacun leur monde et se voient jouer | 1 à 2 |
| J5 | Compagnon, moteur de missions, créatures, lampe, clôture, lance-bulles | Le compagnon parle ; les créatures rôdent la nuit | 2 |
| J6 | Tutoriel, mission 1 complète, finitions | Mission 1 jouable de bout en bout | 2 |
| J7 | Recette V1 avec les enfants, corrections | Version 1.0 | 1 |

Total indicatif : 13 à 15 sessions de travail (J0.1 compris), au fil de l'eau (une de plus qu'au départ, pour les ajouts du 23/09 : types de monde, vue à la 3e personne, lance-bulles).

### J0 — Socle et prototype technique

Mise en place du projet (Vite, TypeScript, Three.js, single-file, Vitest, Playwright), `CLAUDE.md`, `README.md` (comment jouer : double-clic sur `dist/cubes.html` ; comment développer : `npm install`, `npm run dev`, `npm run build`, `npm test`).

Prototype volontairement laid : monde plat 32 × 32, déplacement clavier, Pointer Lock, casser/poser un bloc, compteur d'images par seconde, joystick tactile rudimentaire, bouton « test voix » qui liste les voix disponibles et prononce une phrase en français.

Tests à faire par Pierre : ouverture par double-clic sur le PC (Edge et Chrome), ouverture sur la tablette (fichier copié par câble USB, carte mémoire ou cloud personnel, et non par l'OneDrive ECOME, qui mettrait un compte professionnel sur la tablette familiale), lecture des voix, images par seconde.

Porte de décision à la fin du J0 : Pointer Lock fonctionnel ou repli ; voix française disponible ou repli ; au moins 30 images par seconde sur la tablette ou réduction du monde ; mode de chargement retenu pour la tablette (fichier local ou serveur sur le PC).

### J1 — Monde

Chunks, maillage avec suppression des faces cachées, génération de terrain à graine, atlas de textures procédurales, éclairage jour/nuit (couleur du ciel, intensité), eau, arbres et fleurs. Physique du joueur. Mesure des performances et réglage de la distance de rendu.

État : livré le 23/09/2026 (voir `JOURNAL.md`) ; testé sur le convertible le 24/09/2026 (tout passe, 60 images/s à 48 et 96 blocs).

Le générateur accepte dès J1 un type de monde (prairie, île, montagne, désert) ; le choix par l'enfant arrive avec l'écran d'accueil au J4. Diagnostic affiné à la suite des retours J0.1 : temps de calcul par image hors attente de l'écran (la marge réelle, masquée par le plafond de 60 images/s), et compteurs de mouvements souris écartés séparés (après capture / trop grand).

### J2 — Interaction et inventaire

Visée par raycast avec surbrillance du bloc ciblé, casse (courte pression avec barre de progression, pour éviter les casses accidentelles), pose, barre d'inventaire à neuf cases avec compteurs (les blocs cassés sont ramassés : le comptage est le support de la mission 1). Sons synthétisés. Première session de test avec les enfants : consigne libre « construis une cabane ».

État : livré le 24/09/2026 (voir `JOURNAL.md`), avec la boucle « consigne lue + comptage » proposée à l'audit (le jeu annonce « trois pierres ! » à l'écran et, pour le lecteur débutant, à voix haute). Choix faits en l'absence de consigne, à confirmer par Pierre : sac vide au départ ; une case par type de bloc, 99 au plus ; sac plein = le bloc est cassé mais pas ramassé ; nouveau monde = sac vidé ; les planches ne se ramassent pas dans la nature (bouton « Compléter le sac » du panneau de tests en attendant le craft du backlog V2) ; escalade de secours pour sortir d'un trou (garder le saut en avançant contre une paroi).

### J3 — Tactile et convertible

Appareil cible : le convertible Windows (Acer Nitro 5 Spin NP515-51) replié en mode tablette, sous Firefox. Les performances ne sont plus un sujet (60 images/s à 96 blocs, calcul de 2,8 ms à 128) ; le verrouillage paysage et le réglage de la résolution sont retirés (sans objet ou impossibles sur cet appareil). Contenu, d'après les retours J2 et l'audit « convertible + Firefox » du 24/09/2026 (`JOURNAL.md`) :
- zones tactiles : corriger le déplacement involontaire signalé au J2 (aujourd'hui, tout toucher dans la moitié gauche commande le déplacement) ; un nouveau toucher dans une zone déjà prise la reprend (doigt d'un autre enfant, paume posée) ;
- barre du bas : toute sa surface choisit la case la plus proche ; menu contextuel de Firefox bloqué hors des champs du panneau ;
- portrait comme paysage : champ de vision élargi en portrait (46° de large aujourd'hui) ; rotation laissée à Windows ;
- plein écran proposé à l'enfant par un gros bouton (hors du panneau adulte), commandes écartées des bords de l'écran ;
- distance de rendu : 96 blocs par défaut quel que soit le pointeur, choix de l'adulte mémorisé (`cubes:distance`) et gardé dans l'adresse ; 128 par défaut seulement après une mesure des images par seconde ;
- doigts remis à zéro quand le jeu perd le focus (bascule d'appli, geste de Windows) ;
- si les enfants déplient l'appareil (à confirmer par Pierre) : interface et aides qui suivent le dernier moyen utilisé (doigt ou pavé tactile/souris), touches sans effet parasite dans Firefox (apostrophe du « 4 », Alt) ;
- test des enfants sur le convertible, avec au protocole : balayages depuis les bords, sortie du jeu par accident, main posée sur l'écran.

État : livré le 24/09/2026 (voir `JOURNAL.md`), sauf le volet « déplié » (Pierre : l'appareil reste toujours replié). À tester par Pierre et les enfants (protocole J3 de `RETOURS.md`).

### J4 — Profils, sauvegarde, mode parent

Écran d'accueil avec deux profils (prénom, avatar), « nouveau monde » (avec choix du type de monde) ou « continuer », sauvegarde automatique toutes les 30 secondes et à la fermeture, export/import, mode parent avec ses réglages et la progression. Avatar en blocs, dessin original (rien de Minecraft), visible dans une vue à la troisième personne activable par une touche et un bouton tactile ; la caméra ne traverse pas les murs.

État : livré le 24/09/2026 (voir `JOURNAL.md`). Choix de Pierre : trois emplacements de monde par enfant, profils créés par l'adulte, vue à la troisième personne dans le J4. Réglages du mode parent livrés : prénoms, niveau de lecture, voix, durée de la nuit ; « plage de nombres » et « créatures » arriveront avec les missions et les créatures (J5).

### J5 — Compagnon, missions, créatures

Compagnon qui suit le joueur, bulle de dialogue, lecture vocale, bouton « répète ». Moteur de missions déclaratif avec variantes par profil. Créatures rigolotes et leurs comportements ; bloc lampe et bloc clôture fonctionnels ; lance-bulles (outil rigolo, jamais une arme : les bulles font fuir les créatures) ; signal d'arrivée de la nuit (son, ciel).

État : livré le 24/09/2026 (voir `JOURNAL.md`). Choix de Pierre : compagnon renard « Pixel » ; créatures « Grignotes » qui chipent un bloc au contact ; lampe et clôture trouvées dans la nature (pierre brillante → lampe, tronc → clôture en plus). Mission 1 en première version (sans tutoriel ni abri vérifié) ; la finir est l'objet du J6.

### J6 — Tutoriel, mission 1, finitions

Mission 0 (tutoriel, trois étapes : se déplacer, casser, poser) puis mission 1 « Construis un abri avant la nuit » telle que décrite dans le brief, écran de félicitations, récompense visuelle. Textes en deux variantes. Test complet avec les deux enfants, corrections.

État : livré le 24/09/2026 (voir `JOURNAL.md`), sans attendre les retours des J3 à J5 (décision de Pierre : ils seront intégrés ensuite) ; le test complet avec les deux enfants reste à faire. Choix faits sans consigne, à confirmer : tutoriel une fois par enfant ; abri = toit + 3 murs sur 4 + au moins un bloc de l'enfant (un terrier creusé compte) ; dernière étape « rester près de la lampe » avec le temps qui file (×30) jusqu'à la nuit, validée quand une Grignote fuit la lampe ; cadeau de 5 blocs arc-en-ciel (nouveau bloc), étoile sur le monde à l'accueil, progression dans le mode parent.

### J7 — Recette V1

Vérification des quatre critères de réussite du brief avec les enfants, corrections, version 1.0, mise à jour de la documentation, tri du backlog V2.

État : première partie livrée le 25/09/2026 (voir `JOURNAL.md`) : version **1.0-rc**, recette technique (`RECETTE-V1.md`), corrections des limites connues et des écarts relevés par l'audit, protocole de recette avec les enfants dans `RETOURS.md`, backlog V2 trié (§6). Reste : la séance avec les enfants (Pierre), les corrections qui en sortiront, puis le passage à « 1.0 ».

## 4. Organisation du travail

En session Cowork : je code et je teste côté cloud (tests unitaires, Chromium sans interface, captures d'écran que je relis), puis je dépose `src/`, `docs/`, les fichiers de configuration et `dist/cubes.html` dans le dossier `Minecraft`. Chaque fichier déposé reste sous 20 Mo.

De ton côté : tester sur PC et tablette, faire tester par les enfants, noter les retours dans `docs/RETOURS.md` ou me les donner en session.

Avec Claude Code sur ton poste : `npm install` puis `npm run dev` pour développer, `npm run build` pour régénérer `dist/cubes.html`, `npm test` pour les tests. Les versions retenues au J0 (Vite 8, Vitest 5) exigent **Node.js 22.12 ou plus récent** (à vérifier sur ton poste avec `node -v`). `CLAUDE.md` décrit l'architecture et les règles du projet : tout inliné, aucun asset externe, textes en deux variantes, aucun emprunt à Minecraft.

Piège OneDrive : `node_modules` contient des dizaines de milliers de fichiers ; dans un dossier synchronisé il ralentit fortement OneDrive. Deux options : ne rien installer localement (tout passe par Cowork), ou travailler localement dans un clone git hors OneDrive, avec un dépôt GitHub privé comme référence et sauvegarde. Le choix se fait au J0.

Gestion de versions (depuis J0.1) : le projet est un dépôt git. L'intégration GitHub du compte (PB-EC92) ne permet pas de créer un dépôt depuis une session Cowork : ses sessions cloud sont liées aux dépôts configurés à leur démarrage (vérifié le 23/09/2026). L'historique est donc livré dans `cubes.git.bundle` (un seul fichier). Pierre a créé le dépôt `PB-EC92/Minecraft_Bou` ; il y pousse le bundle après l'avoir cloné hors OneDrive (procédure dans `README.md`). Même une fois le dépôt créé, cette session Cowork n'a pas pu s'y rattacher (aucun outil de rattachement disponible). Une fois le dépôt en place, il devient la référence. Reste à décider comment les sessions suivantes y contribuent : session Claude cloud démarrée sur ce dépôt, ou bundle à chaque session.

## 5. Risques et parades

| Risque | Effet | Parade |
|---|---|---|
| Performances insuffisantes sur la tablette | Jeu saccadé, abandon | Levé au J1 : le convertible tient 60 images/s à 96 blocs (calcul de 2,8 ms à 128) |
| Pointer Lock indisponible en `file://` | Pas de regard souris | Test J0 ; repli clic-glisser ou serveur local |
| Aucune voix française de synthèse | Consignes non lues pour le lecteur débutant | Test J0 ; repli icônes + sons ; option : enregistrer la voix d'un parent (fichiers audio embarqués, taille en hausse) |
| Fichier HTML local non ouvrable sur la tablette | Le jeu ne se lance pas | Sans objet : la tablette est un convertible Windows, le fichier s'ouvre par double-clic dans Firefox (vérifié au J1) |
| Ergonomie inadaptée à 6 ans | Frustration | Tests enfants dès J2, tutoriel J6, gros boutons, aucun échec bloquant |
| Dérive de périmètre (quatre domaines pédagogiques) | V1 jamais terminée | Périmètre gelé, une seule mission en V1, backlog V2 |
| `node_modules` dans OneDrive | Synchronisation dégradée | Voir section 4 |
| Perte de sauvegarde (vidage du navigateur) | Monde perdu | Export JSON proposé régulièrement, rappel en mode parent |
| Stockage local indisponible sur la tablette | Aucune sauvegarde possible | Levé : « Stockage local : ok » sur le convertible (Firefox, `file://`) |
| Firefox rattache le stockage local au chemin exact du fichier (non vérifié) | Une copie du jeu ailleurs, ou renommée, ne retrouve pas les mondes | À vérifier avant le J4 (deux copies du fichier suffisent) ; toujours remplacer le fichier au même endroit sous le même nom ; export avant chaque mise à jour |
| L'enfant sort du jeu par accident sur le convertible (barre des tâches, balayage depuis un bord, onglet fermé) | Monde perdu tant qu'il n'y a pas de sauvegarde | J3 : plein écran proposé à l'enfant, commandes loin des bords ; ligne au protocole ; au besoin, réglages Windows (masquer la barre des tâches, raccourci Firefox en mode kiosque) |
| Le convertible est déplié en cours de partie | Aides et boutons tactiles qui ne correspondent plus au pavé tactile | J3, selon l'usage réel des enfants |
| Plan B serveur : les sauvegardes sont liées à l'adresse du PC ; si la box lui en attribue une autre, elles « disparaissent » | Monde perdu en apparence | Réserver l'adresse du PC dans la box ; export régulier |
| Perte du contexte 3D quand la tablette passe à une autre appli | Écran noir ou figé au retour | Gérée au J1 ; vérifié sur le convertible (retour après 30 s dans une autre appli) |

## 6. Backlog V2 (non planifié, trié au J7)

Trié par intérêt pour les enfants et par coût estimé (non vérifié). À revoir après la séance de recette.

**Priorité 1 — prolonge directement la V1.**
- Craft simple : planches à partir d'un tronc (aujourd'hui introuvables par l'enfant), puis verre à partir de sable.
- Mission 2, lecture et écriture : mots à composer en blocs-lettres (nouveau bloc-lettre, ajouté à la fin du registre).
- Nom définitif choisi par les enfants (un seul endroit à changer : `src/game/identity.ts`).
- Selon les retours : geste pour vider une case du sac, nuit retenue jusqu'à l'abri, rappel d'export dans le mode parent.

**Priorité 2 — les autres domaines du brief.**
- Mission 3, mathématiques : construction symétrique à compléter ; « plage de nombres » du mode parent.
- Mission 4, sciences : maison qui garde la chaleur la nuit, plantes à arroser.
- Mission 5, logique : suite d'ordres à donner au compagnon pour franchir un parcours.
- Créatures qui bloquent un passage (brief), pas seulement qui chipent.

**Priorité 3 — richesse du monde.**
- Autres outils rigolos : filet pour attraper les créatures, bloc confettis qui fait sauter des blocs.
- Animaux à nourrir, météo, musique d'ambiance.
- Blocs, biomes et types de monde supplémentaires ; grottes, obscurité sous terre, eau qui coule.
- Bouton « plonger » au doigt (on flotte seulement).

## 7. Éléments non vérifiés à confirmer

Présence et version de Node.js sur le poste ; modèle de la tablette et ses performances WebGL ; voix de synthèse françaises sur PC et tablette ; Pointer Lock et ouverture `file://` sur PC et tablette ; estimations de sessions ; taille du fichier final. Les quatre premiers points sont levés (J0 à J2 ; la tablette est un convertible Windows sous Firefox). Restent : les images par seconde à 128 blocs sur le convertible ; le stockage local de Firefox par chemin de fichier (avant le J4).

## Sources

- Three.js, dernière version : [Release r186 · mrdoob/three.js](https://github.com/mrdoob/three.js/releases/tag/r186)
- Fichier unique : [vite-plugin-singlefile](https://github.com/richardtallent/vite-plugin-singlefile)
- Prérequis Node.js : champ `engines` des paquets publiés sur npm, vérifié le 23/09/2026 (`vite@8.3.0` : Node ^20.19 ou ≥ 22.12 ; `vitest@5.0.1` : Node ^22.12, ^24 ou ≥ 26) ; contexte : [Vite 7.0 is out!](https://vite.dev/blog/announcing-vite7)
