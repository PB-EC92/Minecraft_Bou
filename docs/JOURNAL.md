# Journal du projet

Une entrée par session de travail : ce qui a été fait, ce qui est attendu, les décisions prises ou en attente. À lire en début de session, à compléter en fin de session.

## 2026-09-23 — Brief, plan, jalon J0

**Fait.** Brief validé (`BRIEF.md`) et plan d'attaque (`PLAN.md`). Projet initialisé : TypeScript strict, Vite 8, Three.js r186, `vite-plugin-singlefile`, Vitest 5, Playwright 1.56 (version alignée sur le Chromium disponible côté cloud ; en local, `npx playwright install chromium`). Prototype J0 livré dans `dist/cubes.html` (546 ko) :

- monde plat 32 × 32 × 16 avec escalier, mur à porte, arbre, carré de sable ;
- maillage du monde entier avec suppression des faces cachées (1 728 faces au départ), atlas de 8 textures pixel-art dessinées par code ;
- déplacement clavier par position physique, saut, physique boîte-contre-blocs avec sous-pas anti-traversée ;
- regard souris par Pointer Lock avec repli « glisser » si la capture échoue ;
- visée par parcours de voxels (DDA), surbrillance du bloc, casser (clic gauche / tapoter) et poser (clic droit / mode Poser) parmi 6 blocs ;
- contrôles tactiles rudimentaires (joystick, regard, boutons Casser/Poser et Sauter) activés si l'appareil est tactile ;
- panneau « Tests J0 » : plein écran, capture souris, liste des voix et test de lecture en français, diagnostic (adresse, WebGL, tactile, Pointer Lock, stockage local, synthèse vocale) ;
- 12 tests unitaires (monde, raycast, physique) et 6 tests de fumée Playwright exécutés en `file://` sur deux profils (PC, tablette simulée). Un bug a été trouvé et corrigé par ces tests : le calque tactile masquait les boutons du HUD.

**Non vérifié côté cloud** (Chromium sans carte graphique ni voix) : Pointer Lock réel, voix françaises, performances réelles. C'est l'objet du protocole J0 dans `RETOURS.md`.

**Attendu de Pierre.** Remplir le protocole J0 de `RETOURS.md` sur PC (Edge, Chrome) et tablette Android ; préciser l'âge et le niveau scolaire du second enfant ; dire si Node.js est installé sur le poste (et sa version) et si le travail local se fera dans un clone git hors OneDrive.

**Décisions prises.** TypeScript plutôt que JavaScript. Pas de lumière Three.js : ombrage par couleurs de sommets (rapide sur tablette). Rendu à 1,25× maximum de densité de pixels sur tactile, 2× sur PC. Node.js ≥ 22.12 (imposé par Vitest 5).

**Décisions en attente (porte J0).** Mode de regard souris (Pointer Lock ou repli) ; voix (synthèse ou repli sons + icônes) ; mode de chargement sur la tablette (fichier local ou serveur sur le PC) ; taille du monde et distance de rendu pour J1 selon les images par seconde mesurées.

**Prochaine étape.** J1 — monde par chunks, génération de terrain à graine, eau, jour/nuit (voir `PLAN.md` §3), après lecture des retours J0.

## 2026-09-23 — Audit du J0

**Fait.** Audit complet, voir `AUDIT-J0.md`. Le socle tient : build reproductible, aucun code réseau, 0 vulnérabilité, lockfile compatible Windows, faces correctement orientées, casser/poser vérifiés sur PC et tablette simulés. Quatre défauts majeurs fausseraient le test J0 : saut de caméra à la capture de la souris, repli souris sans casser/poser, apparition sur le feuillage de l'arbre, chute hors du monde. Trois erreurs relevées dans les documents (Node ≥ 22.12 dans `PLAN.md`, taille estimée du fichier, une ligne du tableau de `RETOURS.md`).

**Décision en attente.** Faire J0.1 (corrections majeures, `git init`, tests casser/poser) avant les tests J0 de Pierre : recommandé.

## 2026-09-23 — J0.1, corrections de l'audit

**Fait.** Les quatre défauts majeurs sont corrigés : caméra stable à la capture de la souris, mode repli complet (glisser = regarder, clic bref = agir), apparition au sol, bords du monde infranchissables. Aussi corrigés : détection tactile par pointeur principal (PC tactile géré), voix locales préférées avec liste rafraîchie et délai de secours, message « Pas de place ici », écran d'erreur lisible si la boucle plante, `touchcancel` sur Sauter, séparation des configurations TypeScript. Tests : 40 unitaires, 12 de fumée (17 exécutions sur les deux profils, les autres étant propres à un seul profil). Détail et état de chaque constat : `AUDIT-J0.md`, section « Suivi ». Documents corrigés : `PLAN.md`, `RETOURS.md` (protocole J0.1), `README.md`, `CLAUDE.md`. `dist/cubes.html` ≈ 550 ko ; la version s'affiche dans la ligne d'infos (« J0.1 »).

**Git.** Dépôt créé côté cloud avec l'historique (J0, puis J0.1), livré dans `cubes.git.bundle`. L'intégration GitHub (compte PB-EC92) est connectée, mais ses sessions cloud sont liées aux dépôts configurés à leur démarrage : impossible de créer un dépôt depuis Cowork. Pierre a créé `PB-EC92/Minecraft_Bou` ; la session n'a pas pu s'y rattacher (l'API répond « accès non activé pour cette session » et aucun outil de rattachement n'est disponible). Pierre pousse le bundle depuis son poste (procédure dans `README.md`).

**Attendu de Pierre.** Supprimer `Claude outputs\cubes.html` ; vérifier que `Minecraft_Bou` est privé et y pousser le bundle ; dérouler le protocole J0.1 de `RETOURS.md` sur PC et tablette ; indiquer la version de Node.js du poste, l'âge du second enfant, et si le PC a un écran tactile.

**Décisions en attente.** Porte J0 (inchangée) ; façon dont les sessions suivantes contribuent au dépôt GitHub (session cloud démarrée sur le dépôt, ou bundle) ; suggestion de l'audit : une boucle « voix + comptage » dès J2 pour tester tôt la pédagogie.

## 2026-09-23 — Précisions de Pierre (âges, écran tactile)

**Reçu de Pierre.** Les deux enfants ont 6 ans (profil A, lecteur débutant, niveau CP) et 8 ans (profil B, lecteur autonome, niveau CE2) : mis à jour dans `BRIEF.md` et `CLAUDE.md`. Le PC utilisé pour le développement n'a pas d'écran tactile ; Pierre dispose par ailleurs d'un autre PC à écran tactile, utilisable pour la ligne correspondante du protocole J0.1 (`RETOURS.md`) s'il veut la couvrir.

**Vérifié.** Le dossier `Claude outputs` du OneDrive est vide : l'ancien `cubes.html` a bien été supprimé. `cubes.git.bundle` (dans le dossier `Minecraft` et dans `Claude outputs`) correspond exactement au commit `ce1b24b` (J0.1), aucun changement local en attente avant les corrections ci-dessus.

**Attendu de Pierre.** Version de Node.js du poste (lancer `node -v` dans PowerShell) ; suite du protocole J0.1 de `RETOURS.md` (PC, et tablette si possible) ; pousser `cubes.git.bundle` vers `PB-EC92/Minecraft_Bou` (procédure dans `README.md`) et vérifier que ce dépôt est privé.

## 2026-09-23 — Retours J0.1 sur PC (Chrome)

**Reçu de Pierre.** Protocole J0.1 déroulé sur le PC de travail, Chrome 153, fichier ouvert en `file://` (`RETOURS.md` ; diagnostic transcrit depuis ses captures d'écran). Node.js du poste : v24.11.0, compatible avec Vite 8 (≥ 22.12) et Vitest 5 (^24).

**Constats.** Tout ce qui a été testé passe : ouverture par double-clic, capture de la souris sans saut de la vue, Échap, repli (glisser + clic bref), déplacement, escalier, porte, bords du monde, casser/poser les 6 blocs, « Pas de place ici », plein écran, stockage local, voix (4 voix françaises dont Microsoft Hortense, locale : fonctionne wifi coupé ; phrase de test lue en 9,8 s). 60 images/s constantes (moyenne 16,7 ms, pire 17 ms) sur une carte graphique intégrée Intel UHD : c'est le plafond de la synchronisation écran, la marge réelle n'est donc pas mesurable avec cet affichage. Un `pointerlockerror` a été relevé : cohérent avec le refus de recapture que Chrome applique juste après Échap, déjà prévu (chaque clic retente la capture) ; le repli a pris le relais comme prévu. 60 à 62 mouvements écartés : ce compteur additionne les mouvements ignorés dans les 80 ms qui suivent une capture et ceux de plus de 200 px en un événement, il ne permet pas de savoir si des gestes rapides légitimes sont perdus (Pierre n'a pas signalé de regard « collant »). Position de départ non renseignée ; la capture (y = 1,0) a été prise après avoir creusé jusqu'au fond, cohérent avec un sol à y = 4.

**Non testé.** Edge ; tablette Android (ouverture du fichier, images/s, tactile, voix, stockage local, retour d'une autre appli) ; PC à écran tactile.

**Porte J0, état.** Regard souris : Pointer Lock retenu, repli automatique conservé (vérifié sur Chrome). Voix : synthèse retenue sur PC. Tablette : décisions en attente (mode de chargement, 30 images/s minimum, distance de rendu).

**Proposé pour J1.** Diagnostic plus fin : deux compteurs distincts (après capture / trop grand) et plus grand déplacement reçu ; temps de calcul par image hors attente de l'écran, pour mesurer la marge réelle sur PC et tablette.

**Idées de Pierre.** Avoir un personnage ; des armes (fun) ; plein de pays ; des monstres (quand viennent-ils ?) ; comment choisir son profil, comment enregistrer, quand apprend-on des choses. Rattachement aux jalons et décisions : voir l'entrée suivante.

## 2026-09-23 — Décisions après les retours J0.1

**Décisions de Pierre.**
- Lancer J1 sans attendre le test de la tablette : distance de rendu réglable, la tablette testera directement la version J1.
- Armes et monstres : pas de combat. Des outils rigolos non violents à la place. Proposition retenue dans le brief : un outil en V1, le lance-bulles qui fait fuir les créatures (J5) ; filet et bloc confettis en backlog V2.
- « Plein de pays » = plusieurs types de monde au choix à la création (prairie, île, montagne, désert). Générateur paramétré dès J1, choix par l'enfant au J4.
- « Avoir un personnage » = se voir à l'écran : vue à la troisième personne activable, avatar original choisi dans le profil (J4).

**Documents mis à jour.** `BRIEF.md` (expérience de jeu, périmètre V1, hors V1), `PLAN.md` (J1, J4, J5, backlog V2, estimation portée à 13 à 15 sessions, risque « ergonomie » ramené à 6 ans).

**Décision en attente.** Avancer au J2 une boucle « consigne lue + comptage » pour tester tôt la pédagogie avec les enfants (recommandé, sans réponse de Pierre à ce stade).

## 2026-09-23 — J1, le monde

**Fait.** Monde généré de 128 × 64 × 128 blocs, à graine, en quatre types (prairie, île, montagne, désert), plus le monde plat du J0 réservé aux tests (`#monde=plat`). Nouveaux blocs, ajoutés à la fin du registre (identifiants 7 à 12) : eau, feuilles, fleur rouge, fleur jaune, neige, cactus ; barre de blocs portée à 9 (touches 1 à 9). Rendu par sections de 16³ avec file par distance et budget de temps par image ; occlusion ambiante par sommet ; eau semi-transparente ; fleurs en plans croisés ; faces tournées vers l'extérieur du monde supprimées ; mer au-delà des bords jusqu'à l'horizon. Cycle jour/nuit de 12 minutes (9 de jour, 3 de nuit), soleil, lune et étoiles, nuit jamais noire (40 % de luminosité). Joueur : montée automatique des marches d'un bloc, flottaison, nage (Espace), plongée (Maj), sortie sur la berge, voile bleu sous l'eau, pas de noyade. Perte du contexte 3D gérée. Panneau « Tests » : type de monde, graine, heure, temps accéléré, distance de rendu ; l'adresse retient le monde (`#monde=ile&graine=1234`). Diagnostic affiné comme proposé après le J0.1 : temps de calcul par image hors attente de l'écran, souris (captures, écartés après capture, trop grands, plus grand déplacement reçu), rendu (sections, appels, triangles), contexte 3D. Constats de l'audit traités : 9, 10, 11, 13, 14, 15 et 12 en partie (tapotement à 450 ms), voir `AUDIT-J0.md`. `dist/cubes.html` : 582 ko ; ligne d'infos terminée par « J1 ».

**Tests.** 88 tests unitaires (monde, sections, bruit, terrain des quatre types, jour/nuit, joueur, maillage, rendu par sections, souris, adresse, voix) ; 20 cas de fumée, 26 exécutions sur les deux profils (types de monde, nuit, eau, perte de contexte, panneau « Nouveau monde », en plus des cas du J0.1). Un test de fumée tactile échouait par intermittence sous charge : seuil du tapotement relevé de 300 à 450 ms, 8 passages sur 8 ensuite (cause probable, non démontrée : délai d'exécution).

**Mesures (serveur cloud, rendu logiciel : ordres de grandeur seulement).** Génération d'un monde : 30 à 50 ms. Maillage du monde entier : 60 à 200 ms ; une section : moins de 1 ms en général (5,6 ms au pire). 21 000 à 40 000 faces selon le type de monde. Les images par seconde du cloud ne veulent rien dire (pas de carte graphique).

**Décisions techniques.** Stockage des blocs en un seul tableau avec des versions par section, plutôt que des chunks de 16 × 16 × 64 comme prévu au `PLAN.md` (plus simple pour un monde borné, même effet sur le remaillage ; `PLAN.md` mis à jour). Pas de Web Worker pour le maillage (fonctionnement non vérifié en `file://`) : budget par image à la place. Distance de rendu par défaut : 96 blocs sur PC, 48 sur tablette. Aucune dépendance ajoutée.

**Limites connues.** L'eau ne coule pas (casser un bloc au bord d'un lac laisse un trou sec) ; pas de grottes ; il ne fait pas plus sombre sous terre ; pas de bouton « plonger » sur tablette (on flotte, c'est suffisant pour l'instant) ; rien n'est enregistré ; l'adresse ne retient que le type et la graine.

**Non vérifié.** Tout ce qui concerne la tablette ; les performances réelles sur le PC de Pierre ; la perte de contexte sur un vrai Android ; Edge.

**Attendu de Pierre.** Protocole J1 de `RETOURS.md`, tablette en priorité ; publier le dépôt sur GitHub si ce n'est pas fait (bundle à jour dans le dossier) ; avis sur la boucle « consigne lue + comptage » au J2.

**Prochaine étape.** J2 (inventaire à 9 cases avec compteurs, casse par appui court avec barre de progression, sons, première séance avec les enfants), ou J3 avancé si la tablette peine.

## 2026-09-24 — J2, interaction et sac

**Contexte.** Première session Claude Code démarrée directement sur le dépôt GitHub `PB-EC92/Minecraft_Bou` (branche `claude/dreamy-curie-ctoxg3`, PR `PB-EC92/Minecraft_Bou#1` ouverte par Pierre) : plus besoin de `cubes.git.bundle` pour cette session. J2 lancé sans attendre les tests tablette du J1, sur décision de Pierre (le J2 ne touche ni au rendu ni au stockage, dont dépendent les décisions tablette).

**Fait.**
- Casse par appui maintenu (souris capturée, mode repli, doigt en mode Casser), anneau de progression jaune autour du viseur, durée par bloc (fleurs 150 ms, feuilles 200, herbe et terre 350, pierre 650). Un appui bref ne casse rien et affiche « Appuie longtemps ! ». Pour un geste qui peut aussi servir à regarder (doigt à droite, souris non capturée), la casse ne démarre qu'après 150 ms d'immobilité ; viser en glissant puis s'arrêter sans lâcher casse après 400 ms. En gardant l'appui, les blocs se cassent à la suite, mais un seul plus bas que les pieds par appui.
- Escalade de secours : garder le saut en avançant contre une paroi fait grimper au bout de 0,6 s. Aucun trou ne peut piéger l'enfant (règle « aucun échec bloquant ») ; sans saut, un mur de deux blocs arrête toujours ; le bord du monde ne s'escalade pas.
- Sac de 9 cases, une par type de bloc, 99 au plus : chaque bloc cassé est ramassé (une fleur posée dessus aussi), poser en retire un, la case vide redevient libre. Barre avec icônes, gros compteurs, animation au ramassage, nom du bloc tenu affiché au-dessus. Touches 1 à 9 (et pavé numérique), molette (une case par cran, pavé tactile compris), toucher une case.
- Boucle « consigne lue + comptage » (proposée à l'audit J0) : au ramassage, « 3 pierres ! » à l'écran ; pour le lecteur débutant, lu à voix haute avec les nombres en lettres accordés (« vingt et une pierres »). Le compte est lu une fois l'appui relâché. La voix attend le premier vrai geste (règle des navigateurs) ; la consigne d'accueil est lue à ce moment-là.
- Tous les messages à l'enfant en deux variantes (débutant 6 ans / autonome 8 ans), formulations neutres en genre : ramassage, case vidée, case vide, sac plein, maximum, pas de place, fleur hors sol ou dans l'eau, couche du bas, bord du monde, reprise de la souris, repli, perte d'image, aides d'écran (au doigt, selon le mode Casser / Poser). Durée d'affichage selon la longueur du texte et le niveau (le lecteur autonome, sans voix, a le temps de lire).
- Sons synthétisés (Web Audio, aucun fichier) : tic de casse selon la matière, casse, pose, ramassage, refus doux, sélection ; niveaux équilibrés par mesure ; contexte créé au premier geste.
- Panneau « Tests » → section Jeu : niveau de lecture (la voix suit le niveau), voix, sons, « Compléter le sac » (jusqu'à 20 de chaque bloc du kit, sans rien retirer, dans la limite des 9 cases), « Vider le sac ». Diagnostic : Sons, Lecture, Sac ; durées d'image réelles (non bornées), rafraîchies même quand les images sont lentes.
- Mise en page : cases bornées par la largeur (portrait, petit écran), boutons tactiles au-dessus de la barre sous 1000 px de large, piste d'anneau sombre (lisible sur sable et neige).
- Nouveaux modules : `engine/inventory`, `engine/breaking`, `input/breakPress`, `audio/sounds`, `edu/texts`, `edu/counting`, `edu/Narrator`. Aucune dépendance ajoutée.

**Méthode.** Modules purs écrits en parallèle par quatre agents d'après une spécification, chacun relu par un second agent ; intégration faite à part. Puis revue en six dimensions (entrées, logique du sac, enfant et règles, sons et voix, tests, HUD) : 38 constats, dont 12 majeurs, presque tous confirmés par des vérificateurs qui les ont reproduits ; tous corrigés. Les plus notables : puits sans issue en creusant vers le bas, compte coupé en cassant de la pierre sans relâcher, consigne tactile trompeuse (on casse sous la croix, pas sous le doigt), barre couverte par « Sauter » en portrait, tests de fumée dépendants du temps réel. Seconde revue sur les corrections (quatre dimensions, un vérificateur par constat) : 19 constats confirmés, tous corrigés, dont le plus important : un trou d'une case et de deux blocs de profondeur suffisait à piéger l'enfant, d'où l'escalade de secours. Aussi : voile de chargement qui clignotait à chaque bloc, viser en glissant puis tenir qui ne cassait rien, messages autonomes trop brefs pour être lus.

**Tests.** 386 tests unitaires (17 fichiers ; 88 au J1). Tests de fumée : 42 exécutions sur les deux profils (26 au J1), dont casse maintenue, clic bref, fleur, casse vers le bas et en diagonale, escalade hors d'un puits, case vide, pas de place, sac plein, maximum 99, panneau Jeu, lecteur autonome, sons débloqués au premier geste, mode repli (viser puis tenir compris), doigt maintenu, viser en glissant puis tenir, changement de mode doigt posé, molette et pavé tactile. Toutes vertes deux fois de suite, et avec quatre processus en parallèle. `dist/cubes.html` : 610 ko ; ligne d'infos terminée par « J2 ».

**Choix faits sans consigne, à confirmer par Pierre.**
1. Sac vide au départ.
2. Une case par type, 99 au plus ; sac plein ou maximum atteint : le bloc est cassé mais pas ramassé (l'enfant n'est jamais bloqué, au prix d'un bloc perdu).
3. Nouveau monde = sac vidé (la sauvegarde arrive au J4).
4. Les planches ne se trouvent pas dans la nature : « Compléter le sac » en attendant le craft du backlog V2.
5. Herbe cassée = bloc d'herbe (et non de la terre).
6. Voix active par défaut pour le niveau débutant ; niveau débutant par défaut tant qu'il n'y a pas de profils.
7. Escalade de secours partout (pas seulement dans un trou) : une falaise se grimpe aussi en gardant le saut contre elle. Plus simple à comprendre et à découvrir pour un enfant ; à restreindre si cela gâche l'intérêt des montagnes.
8. Un seul bloc plus bas que les pieds par appui : creuser un trou demande de rappuyer à chaque bloc.

**Limites connues.** L'escalade de secours n'est expliquée qu'à l'écran (aide et README), pas encore par le compagnon (J5). L'eau ne coule toujours pas. Voix et sons non vérifiés sur la tablette.

**Non vérifié.** Voix et sons réels sur PC et tablette (le cloud n'a ni haut-parleur ni voix) ; durée de casse ressentie par les enfants ; tout ce qui concerne la tablette (protocole J1 toujours en attente).

**Attendu de Pierre.** Protocole J2 de `RETOURS.md` (il reprend le J1, tablette en priorité), puis première séance avec les enfants : « Construis une cabane ». Avis sur les huit choix ci-dessus.

**Prochaine étape.** J3 (tactile et performances tablette) après les retours, ou corrections du J2 d'après la séance des enfants.

## 2026-09-24 — Retours J1 sur tablette, diagnostic J2

**Reçu de Pierre.** Colonne « Tablette » du protocole J1 remplie (`RETOURS.md`) et une capture du panneau « Tests » du J2 (diagnostic transcrit dans `RETOURS.md`). Le fichier `RETOURS.md` envoyé datait d'avant le J2 : seules les réponses J1 ont été reportées, le protocole J2 du dépôt est conservé.

**Constats J1 (tablette).** Tout ce qui a été testé passe : apparition au sol dans la prairie, les quatre types de monde, marches, eau et sortie sur la berge, nuit et temps accéléré, casser / poser / cueillir, retour après 30 s dans une autre appli, stockage local. 60 images/s (moy. 16,7 ms, pire 17 ms) à l'arrêt comme en marchant, à 48 et 96 blocs ; calcul par image 1,3 ms (distance par défaut), 2,2 ms à 48 blocs, 2,3 ms à 96 (l'écart entre 1,3 et 2,2 n'est pas expliqué ; mesures faites à des moments différents, probablement). Temps d'ouverture non noté.

**Constats J2 (capture).** Même appareil, à 128 blocs sur une île : calcul moyen 2,8 ms, pire 8,0 ms, soit une large marge sous les 16,7 ms d'une image à 60 i/s. (Correction : « Intel HD Graphics 400, or similar » n'est pas la vraie puce ; Firefox, depuis sa version 91, remplace le nom exact par une famille approchante.) Écran portrait 1080 × 1802, interface tactile affichée, voix Microsoft Hortense locale, sons actifs, sac utilisé (18 blocs). La ligne d'images par seconde n'était pas visible sur la capture.

**Point à éclaircir.** Le diagnostic décrit une tablette **Windows 10 avec Firefox**, alors que la colonne s'intitule « Tablette Android ». Si la tablette des enfants est bien celle-ci, la décision « distance de rendu tablette » peut être prise : 128 blocs tient largement (au lieu de 48 par défaut). Si une tablette Android existe aussi, elle reste à tester. « Captures 4 » sur un appareil tactile : clavier ou pavé tactile branché, ou bouton « Capturer la souris » ? À confirmer (un toucher ne devrait pas déclencher la capture).

**Attendu de Pierre.** Confirmer l'appareil ; remplir le protocole J2 ; séance enfants « Construis une cabane » ; avis sur les huit choix du J2.

**Précisions de Pierre (même jour).** La « tablette » est un **ordinateur convertible Windows 10, Acer Nitro 5 Spin NP515-51**, utilisé replié en mode tablette, avec **Firefox** (J1 et J2). Caractéristiques du modèle d'après les fiches revendeur (non vérifiées sur l'appareil) : Core i5-8250U ou i7-8550U, Intel UHD 620 intégrée + NVIDIA GTX 1050 4 Go, écran tactile 15,6" Full HD, charnière à 360°. **Il n'y a pas de tablette Android** : le convertible la remplace dans le projet (brief, plan, README et protocoles à mettre à jour). Les performances ne sont plus un risque sur cet appareil.

## 2026-09-24 — Retours J2 (PC et convertible) et première séance des enfants

**Reçu de Pierre.** Protocole J2 rempli (colonnes « PC (Chrome) », un ordinateur portable classique autre que le PC du bureau, et « Tablette », c'est-à-dire le convertible sous Firefox), reporté dans `RETOURS.md` (le fichier envoyé datait d'avant les réponses J1 : fusion faite à la main).

**Constats.** Passent sur les deux appareils : clic bref sans casse et « Appuie longtemps ! », anneau puis casse, compteurs dans la barre, compte affiché et lu sans bégayer, poser et case vidée, « Ta case est vide », un seul bloc sous les pieds par appui, sons, lignes du diagnostic. Molette et touches 1 à 9 : oui sur PC. Doigt maintenu, glisser pour regarder, viser puis tenir : oui, **mais « parfois on se déplace alors qu'on veut casser un bloc »** sur le convertible. Hypothèse non vérifiée : tout toucher dans la moitié gauche de l'écran commande le déplacement ; un enfant qui touche le bloc là où il le voit (et non la croix du milieu) avance au lieu de casser, d'autant plus en portrait.

**Non testé.** Fleur, escalade hors d'un trou, choix d'une case au doigt, lecture « autonome ».

**Séance enfants.** « Ils arrivent à prendre en main, déconstruisent plus que construisent pour l'instant, intéressés. » Ils ont vite pris les choses en main (appui maintenu compris). **La voix est jugée répétitive** : chaque ramassage relit le compte (« trois pierres », « quatre pierres »…). Durée de jeu non notée.

**Suite.** Audit de compatibilité « convertible Windows + Firefox » en cours ; mise à jour des documents (Android → convertible) ensuite ; le déplacement involontaire au doigt entre au J3.

## 2026-09-24 — J2.1 : la voix lit le compte par paliers

**Décision de Pierre.** Après le retour « la voix est répétitive » : lire le compte à voix haute au premier bloc d'une sorte et aux paliers de 5 (5, 10, 15, 20…) ; entre les deux, le « pop » et le nombre à l'écran (option recommandée parmi quatre : paliers, phrases variées, premier bloc seulement, paliers + phrases variées).

**Fait.** `shouldSpeakPickup` (`src/edu/counting.ts`, pur, testé) décide si un ramassage est lu : total 1 (premier bloc d'une sorte, ou retour d'une sorte dont la case s'était vidée) ou multiple de `PICKUP_VOICE_STEP` = 5. Si la lecture d'un palier attend encore (appui maintenu, lecture repoussée au relâchement) et qu'un autre bloc du même type arrive, la voix dit le compte à jour (« onze » et non « dix » quand l'écran montre 11). Le niveau autonome n'est pas touché (voix coupée par défaut). `window.cubesDebug.state().spoken` : les 20 dernières phrases demandées à la voix (pour les tests de fumée, le cloud n'ayant pas de voix). Ligne d'infos terminée par « J2.1 ».

**Tests.** 389 tests unitaires (3 nouveaux) ; tests de fumée : 43 exécutions vertes (un nouveau cas : « Une pierre », rien à 2, 3 et 4, « Cinq pierres », puis compte à jour quand un palier attend).

**À vérifier par Pierre.** Avec les enfants : la voix est-elle encore trop présente, ou trop rare ? Le palier de 5 se change en une ligne (`PICKUP_VOICE_STEP`).

## 2026-09-24 — Audit « convertible Windows + Firefox » ; documents mis à jour

**Méthode.** Quatre relecteurs en parallèle (passage plié ↔ déplié, particularités de Firefox sous Windows, écran et ergonomie, documents et tests), chacun contre-vérifié par un second agent chargé de réfuter chaque constat en relisant le code (et, quand c'était possible, en le reproduisant dans Chromium en 1080 × 1802). 46 constats : 18 confirmés dans le code, 27 plausibles (ils dépendent de Firefox ou de Windows, que le cloud ne peut pas faire tourner), 1 réfuté. Aucun n'est bloquant ; l'essentiel est ramené à « mineur » par les vérificateurs.

**Principaux constats, à traiter au J3.**
- Déplacement involontaire signalé par Pierre : confirmé dans le code, tout toucher dans la moitié gauche de l'écran commande le déplacement (`TouchControls`), et en portrait cette moitié ne fait que 540 px. Un contact déjà posé (paume, doigt d'un autre enfant) prend aussi la zone et bloque le vrai doigt ; à droite, en mode Casser, il casse le bloc visé sans bouger (reproduit).
- Portrait : champ de vision de 46° en largeur (contre environ 100° en paysage) ; le verrouillage paysage prévu au J3 ne ferait rien dans Firefox sur PC (non vérifié sur l'appareil) : retiré du plan, rotation laissée à Windows.
- Distance de rendu par défaut à 48 blocs quand le pointeur est tactile, jamais mémorisée, et `#distance=` effacé de l'adresse au démarrage. 96 blocs est mesuré à 60 images/s sur l'appareil ; 128 ne l'est pas encore (seul le temps de calcul l'est).
- Hors plein écran, la barre des tâches de Windows est juste sous le bouton Sauter (14 px) : risque de sortir du jeu par accident. Plein écran seulement accessible depuis le panneau adulte.
- Barre du bas : la marge intérieure (environ 22 % de sa surface) ne réagit pas au doigt ; un appui long hors des cases pourrait ouvrir le menu contextuel de Firefox (« Actualiser » ferait perdre la construction tant qu'il n'y a pas de sauvegarde).
- Déplié : l'interface tactile, une fois affichée, ne se masque plus et les aides souris ne reviennent pas ; sous Firefox, la touche « 4 » (apostrophe en AZERTY) ouvre la recherche rapide et prend le clavier au jeu ; Alt seul affiche la barre de menus. Sans effet replié.
- Stockage : sous Firefox, le `localStorage` d'un fichier local serait lié à son chemin exact (non vérifié, environ 80 % de confiance du relecteur) : contrainte de conception pour le J4.
- Tests : Playwright ne dispose ici que de Chromium ; le profil « tablette » imite une tablette Android en paysage, pas le convertible. Pas de test d'un toucher suivi d'une souris.

**Documents mis à jour.** `BRIEF.md` (plateformes, critère 3, points ouverts), `PLAN.md` (pile tactile, stockage, `file://`, J1, J3 réécrit « Tactile et convertible », risques, §7), `README.md` (installation sur le convertible avec Firefox, fichier toujours remplacé au même endroit), `CLAUDE.md` (appareil des enfants, règle 7, Firefox vérifié à la main), `RETOURS.md` (colonnes « Tablette Android » = convertible).

**Questions ouvertes pour Pierre.** Les enfants jouent-ils en portrait ou en paysage ? Déplient-ils parfois l'appareil (clavier, pavé tactile) ? Lancement du J3 avec ce contenu ?

## 2026-09-24 — J3, tactile et convertible

**Décisions de Pierre.** Les enfants jouent en portrait comme en paysage ; l'appareil reste toujours replié (volet « déplié » du plan non traité) ; lancer le J3.

**Fait.**
- Joystick fixe et visible en bas à gauche (rond de 150 px, écarté de 28 px des bords) : seul un toucher qui commence sur lui ou tout près (1,5 fois son rayon) fait marcher, avec une petite zone morte au centre. Partout ailleurs, le doigt regarde et casse. Corrige le déplacement involontaire signalé au J2 (avant : toute la moitié gauche de l'écran commandait le déplacement). `input/touchZones.ts` (pur, testé).
- Un nouveau doigt dans une zone déjà prise la reprend (paume posée, doigt d'un autre enfant) ; quand il se lève, le doigt resté posé reprend la main.
- Doigts remis à zéro quand le jeu perd le focus (autre appli, geste de Windows) : le personnage ne marche plus tout seul.
- Toute la barre du bas choisit la case la plus proche, marges comprises (`ui/nearestSlot.ts`) ; menu contextuel du navigateur bloqué sur le jeu, sauf dans les champs du panneau et sur l'écran d'erreur (copie au doigt).
- Portrait : champ de vision vertical élargi pour garder 60° en largeur (88° en 1080 × 1802, contre 46° de large avant) ; paysage inchangé (70°). `render/fov.ts` (pur, testé). Verrouillage paysage retiré (Firefox sur PC ne le permet pas ; rotation laissée à Windows).
- Bouton plein écran à la portée de l'enfant, dans la colonne des boutons tactiles ; masqué en plein écran.
- Distance de rendu : 96 blocs par défaut quel que soit le pointeur ; choix de l'adulte retenu (`cubes:distance`) et gardé dans l'adresse ; une distance tapée dans l'adresse s'applique aussi en cours de partie. `game/renderDistance.ts`.
- Aides d'écran au doigt réécrites (« Rond : marcher · glisse : regarder… »). Diagnostic : ligne « Fenêtre » (taille de la fenêtre, de l'écran, champ de vision, plein écran).
- Tests de fumée : le profil « tablette » imite désormais le convertible en portrait (1080 × 1802, 1×) ; nouveau profil « tablette-paysage » (1920 × 1080) pour les cas marqués `@tactile`.

**Relecture.** Un agent indépendant a relu le diff : 5 constats, 4 corrigés (menu contextuel bloqué sur l'écran d'erreur ; distance tapée dans l'adresse ignorée ; doigt resté posé inerte après une reprise ; rond qui chevauchait la barre entre 1001 et 1012 px de large, seuil porté à 1040 px). Non traité : sur un petit écran paysage de 800 × 400 (hors appareil cible), la colonne de boutons recouvre le bouton « Tests ». Il a aussi vu deux tests souris échouer une fois sous charge, puis passer 4 fois sur 4 relancés seuls.

**Tests.** 410 tests unitaires ; 65 tests de fumée verts (pc, tablette portrait, tablette paysage). Chromium seulement : le comportement réel dans Firefox (événements tactiles, plein écran, menu contextuel) reste à vérifier par Pierre. `dist/cubes.html` : 614 ko ; ligne d'infos terminée par « J3 ».

**Attendu de Pierre.** Protocole J3 de `RETOURS.md` (portrait et paysage, dont les images par seconde à 128 blocs), puis séance enfants.

## 2026-09-24 — J4, profils, sauvegarde, mode parent, troisième personne

**Décisions de Pierre.** Trois emplacements de monde par enfant ; profils créés par l'adulte (prénoms, niveaux de lecture) ; vue à la troisième personne dans le J4. Lancé sans attendre les tests du J3.

**Fait.**
- Écran d'accueil (`ui/HomeScreen.ts`) : premier lancement « Réglages de l'adulte » (deux prénoms, niveau, voix) ; « Qui joue ? » avec les deux profils ; choix du personnage (6 dessins originaux, `game/avatars.ts`) ; trois emplacements par enfant (vignette : type de monde, « aujourd'hui », « hier » ou date) ; nouveau monde : prairie, île, montagne ou désert. Consignes en deux variantes, lues pour le lecteur débutant.
- Sauvegarde : un monde = type + graine + **écart** avec le monde régénéré (`save/worldDiff.ts` : entiers variables, base64), plus position, sac, heure. Quelques kilo-octets. Enregistrement automatique toutes les 30 s, quand la page est masquée ou fermée, et au bouton maison. Lecture robuste (`save/saveFormat.ts`) : donnée abîmée ignorée, jamais d'erreur bloquante. `GENERATOR_VERSION` dans `terrain.ts`, avec un test d'empreinte du terrain pour les quatre types (toute modification du générateur le fera échouer).
- Mode parent : appui long de 3 s sur l'engrenage (anneau qui se remplit) : prénoms, niveaux, voix, durée de la nuit (normale, courte, pas de nuit ; `advancePhase` dans `dayNight.ts`), effacer un monde, exporter tout dans `cubes-sauvegarde-AAAA-MM-JJ.json`, importer. Le chemin du fichier est affiché, avec l'avertissement Firefox (stockage probablement lié au chemin).
- Personnage en blocs (`render/Avatar.ts`) et vue à la troisième personne : bouton œil ou touche V ; caméra un peu au-dessus de l'épaule (la tête ne cache pas la croix), jamais à travers un bloc plein (`game/thirdPerson.ts`, pur, testé) ; marche animée ; luminosité du jour et de la nuit.
- Le jeu attend en pause derrière l'accueil. L'adresse `#monde=…&graine=…` saute l'accueil et n'enregistre rien (tests, vérifications) ; sans elle, l'adresse n'est plus réécrite (un rechargement ramène à l'accueil).
- Nouveau : `Inventory.load` (moteur, testé).

**Relecture.** Agent indépendant : 7 constats, 5 corrigés :
- « Nouveau monde » du panneau Tests écrasait le monde enregistré de l'enfant (reproduit) : refusé pendant une partie d'enfant, de même qu'un changement de monde par l'adresse.
- Le même monde ouvert dans deux onglets : l'onglet resté en arrière écrasait le travail de l'autre (reproduit). Désormais, dès qu'un autre onglet enregistre ce monde, celui-ci revient à l'accueil sans enregistrer.
- Stockage indisponible : l'enfant restait bloqué sur l'écran de l'adulte (reproduit). On joue quand même, l'adulte est prévenu.
- Sauvegarde illisible ou d'une autre version du générateur : copie de secours intacte (`…:secours`) avant toute écriture, et message à l'adulte.
- Réglage de nuit du mode parent appliqué aussi en mode adresse : réglages par défaut en mode adresse.

Non traités : import non atomique (un échec d'écriture au milieu laisse un état mélangé ; improbable, sauvegardes petites) ; voile sous l'eau qui suit la tête du personnage et non la caméra, en troisième personne ; caméra qui peut passer derrière un mur en escalier en diagonale (échantillonnage du rayon).

**Tests.** 444 tests unitaires ; 79 tests de fumée verts (premier lancement, reprise après rechargement, bouton maison, mode parent avec export, effacement et import, fichier refusé, troisième personne avec mur, mode adresse, deux onglets, panneau Tests pendant une partie). Le test souris « garder le clic gauche » a échoué une fois sous charge au premier passage, puis est passé 4 fois sur 4 seul et à la série complète suivante (instabilité connue, antérieure au J4). `dist/cubes.html` : 643 ko ; ligne d'infos terminée par « J4 ».

**Non vérifié.** Tout sur Firefox (stockage en `file://` par chemin, téléchargement de l'export, appui long au doigt — Windows peut transformer un appui long en clic droit —, sélecteur de fichier en mode tablette).

**Attendu de Pierre.** Protocoles J3 et J4 de `RETOURS.md`, dont la ligne « stockage sous Firefox » (copier le fichier ailleurs), puis séance enfants.

## 2026-09-24 — J5, compagnon, missions, Grignotes

**Décisions de Pierre.** Compagnon : le renard « Pixel ». Créatures : les « Grignotes », qui chipent un bloc au contact puis s'enfuient. Lampe et clôture trouvées dans la nature.

**Fait.**
- Blocs ajoutés à la fin du registre : lampe (13), clôture (14), pierre brillante (15), avec textures dessinées. `dropsOf` : la pierre brillante donne une lampe ; un tronc donne aussi une clôture (sans message, le compte annoncé reste celui des troncs). Kit de test : lampe et clôture remplacent neige et cactus.
- Générateur **version 2** : pierres brillantes en surface (5 à 16 par monde, visibles). `generateWorld(type, graine, version)` : un monde enregistré en version 1 se régénère en version 1 et le reste. Les mondes du J4 reçoivent leurs pierres brillantes au chargement, là où le terrain n'a pas été touché ; l'écart enregistré les garde. Empreintes du terrain v1 (inchangées) et v2 dans les tests.
- Grignotes (`engine/creatures.ts`, pur, testé) : deux le jour, loin ; jusqu'à quatre la nuit, qui approchent ; au contact (même hauteur, rien de plein entre elles et l'enfant), une Grignote chipe un bloc, au plus un vol toutes les 25 s, jamais une lampe ni le bloc de l'étape de mission en cours ; elles fuient une lampe à moins de 6 blocs, ne montent jamais sur une clôture, ne passent pas en diagonale entre deux clôtures, ne sautent pas au fond d'un trou profond, n'apparaissent ni sur un toit ni sur une construction. Une bulle les fait fuir et fait rendre le bloc chipé. Un bloc emporté n'est jamais perdu (rendu si la Grignote disparaît, compté dans la sauvegarde). Réglage « Grignotes actives » dans le mode parent.
- Lance-bulles : bouton Bulles (colonne tactile), bouton en haut à droite, touche B ; bulles translucides, son « bloup ».
- Signal de la nuit à 17 h 30 : carillon et « La nuit arrive ! ». Halo jaune autour des lampes la nuit.
- Pixel (`render/Fox.ts`, `game/companion.ts`) : trottine devant l'enfant, sur sa gauche (visible en vue normale), se tourne vers lui à l'arrêt, réapparaît s'il est resté loin. Bandeau en haut : portrait, consigne, avancement (« 3 / 6 »), bouton « répète ».
- Moteur de missions (`edu/missions.ts`, déclaratif, pur, testé) : objectifs « ramasser » et « poser », textes écrits et dits en deux variantes, progression enregistrée dans le monde. Mission 1, première version : 6 troncs, 4 pierres, 10 blocs posés, une lampe trouvée, la lampe posée.
- Narrateur : option « consigne importante » ; pendant qu'elle est lue, les autres phrases (comptes, vols) sont affichées sans couper la voix.
- Sons ajoutés : rire de Grignote, bulles, carillon de la nuit (recettes Web Audio, ≤ 0,4 s).
- Mode adresse : Grignotes et Pixel coupés sauf `&creatures=1` / `&mission=1`.

**Relecture.** Agent indépendant : 12 constats, 9 corrigés, dont les deux majeurs :
- mission 1 impossible à finir dans les mondes du J4, faute de pierres brillantes (reproduit) ;
- vol à travers un toit, le fond d'un trou ou le coin d'une clôture en diagonale (reproduit).

Également corrigés :
- bloc chipé perdu à l'enregistrement ou à la disparition de la Grignote ;
- vol possible de la seule lampe ;
- doigt gardé sur le bandeau de Pixel qui cassait un bloc (reproduit) ;
- consignes de Pixel coupées par les comptes ;
- apparition sur un toit ;
- signal de la nuit au chargement d'un monde ;
- bandeau réécrit à chaque image.

Non traités : un enclos de clôture de plus de 14 blocs de côté peut voir naître une Grignote à l'intérieur ; le halo de la lampe paraît plus petit que la zone réelle (6 blocs) ; le bandeau peut masquer en partie le message central sur petit écran ; Pixel peut réapparaître dans l'eau quand il n'y a pas de sol près de sa place.

**Tests.** 492 tests unitaires ; 89 tests de fumée verts (pierre brillante, clôture, vol et bulles, lampe, compagnon et mission, mission enregistrée, monde du J4 complété, bandeau au doigt). `dist/cubes.html` : 677 ko ; ligne d'infos terminée par « J5 ».

**Non vérifié.** Tout sur Firefox et le convertible ; l'intérêt réel des Grignotes pour les enfants (amusement ou agacement du vol) ; le rendu du halo la nuit sur une vraie carte graphique.

**Attendu de Pierre.** Protocole J5 de `RETOURS.md` (et J3, J4 s'ils ne sont pas faits), puis séance enfants. Le J6 finira la mission 1 (tutoriel, cabane vérifiée, finitions).

## 2026-09-24 — J6, tutoriel, mission 1 complète, félicitations

**Contexte.** Session Claude Code sur le dépôt GitHub, branche `claude/quirky-feynman-c3upak`. `main` était resté au J2 : les J2.1 à J5 n'existaient que sur la branche `claude/wizardly-carson-hwinwa` (aucune PR ouverte). Le J6 a été construit par-dessus cette branche (avance rapide, sans réécriture d'historique) ; une PR de cette branche vers `main` apporte donc aussi les J2.1 à J5. Décision de Pierre : lancer le J6 sans attendre les retours des J3 à J5, qui seront intégrés ensuite.

**Fait.**
- **Tutoriel (mission 0)** : marcher 5 blocs, casser un bloc, le poser. Consignes propres à l'appareil (au doigt : le rond, garder le doigt, bouton Casser → Poser puis taper ; au clavier : Z, clic gauche gardé, clic droit), en deux variantes. Fait une fois par enfant (`Profile.tutorialDone`) : ses mondes suivants commencent à la mission 1. Au doigt, retour automatique au mode Casser à la fin (resté en Poser, l'enfant poserait au lieu de casser des troncs). Les pas ne comptent que si le déplacement d'une image est inférieur à un bloc (une téléportation ne compte pas).
- **Mission 1 complète**, six étapes : 6 troncs, 4 pierres, **abri vérifié**, pierre brillante → lampe, lampe posée, **rester près de la lampe** jusqu'à la nuit. Abri (`engine/shelter.ts`, pur, testé) : un bloc plein au-dessus de la tête (jusqu'à 4 blocs plus haut), des murs dans au moins 3 directions sur 4 (à 4 blocs au plus, pieds ou tête : la porte reste ouverte), et fait par l'enfant (au moins un de ces blocs posé par lui, ou il se tient dans un creux qu'il a creusé : un terrier compte, un sous-bois naturel non). Pictogramme de maison dans le bandeau de Pixel (toit et trois murs qui s'allument), conseils de Pixel quand l'enfant se tient immobile dans un abri commencé (« Il manque le toit ! », avec une astuce pour le lecteur autonome : murs de 3 blocs, toit posé depuis l'intérieur).
- **Dernière étape** : une fois la consigne lue, le temps file (×30) jusqu'à la nuit (quelques secondes) ; la nuit, une Grignote qui fuit la lampe valide l'étape, et Pixel dit la découverte (« Elles fuient la lampe ! »). Jamais bloquant : réglage « pas de nuit » → étape validée tout de suite ; Grignotes coupées → 4 s après la tombée de la nuit ; sinon au plus tard après 40 s de nuit. Loin de toute lampe la nuit, Pixel rappelle d'y revenir.
- **Écran de félicitations** (`ui/Celebration.ts`) : « Bravo (prénom) ! », phrase de Pixel, récapitulatif en icônes et nombres (6 troncs, 4 pierres, un abri, une lampe), cadeau, confettis en CSS (coupés si le système demande moins d'animations), son « bravo » (quatre notes, ≤ 0,4 s, aussi joué à chaque étape réussie), lecture à voix haute pour le lecteur débutant. Le jeu attend en pause ; le bouton « Continuer » ne répond qu'après 1,2 s (un saut ou un tapotement au mauvais moment ne le ferme pas).
- **Cadeau** : 5 blocs **arc-en-ciel**, nouveau bloc (identifiant 16, tuile 18, à la fin des registres), décoratif, jamais chipé par une Grignote. Sac plein : le cadeau attend (enregistré avec le monde) et entre dès qu'une case se libère ; le jeu le dit.
- **Accueil** : étoile sur un monde dont la mission 1 est réussie. **Mode parent** : section « Progression » (tutoriel fait ou non, étape de chaque monde en clair).
- Reprise des sauvegardes : ancien compteur « placed » du J5 relu ; étapes 0, 1, 3 et 4 inchangées (l'étape 2 « poser 10 blocs » devient l'abri) ; une mission finie au J5 reprend à la nouvelle dernière étape (l'enfant voit la fin du J6) ; un tutoriel fini dont le profil n'a pas pu être enregistré passe quand même à la mission 1.
- **Finitions** (constats non traités du J4 et du J5) : halo des lampes à la taille réelle de la zone évitée (second disque pâle de 6 blocs de rayon) ; message central poussé sous le bandeau de Pixel quand celui-ci descend (petit écran) ; voile sous l'eau selon la position de la caméra en troisième personne (et non de la tête).
- Mode adresse : `&mission=0` (tutoriel) ou `&mission=1` (mission 1). `window.cubesDebug` : `placeBlock()`, et dans l'état `missionId`, `shelter`, `celebration`, `rewardPending`, `timeBoost`, `tutorialDone`. Narrateur : `say` (lire sans afficher). Aucune dépendance ajoutée.

**Relecture.** Agent indépendant sur le diff, avec reproduction (scripts Vitest et Playwright) : 3 constats majeurs et 10 mineurs. Corrigés, chaque correctif revérifié en relançant le script de reproduction du relecteur sur le nouveau fichier :
- **Majeur** : en nuit « courte » (1 min), le délai de secours de la dernière étape (60 s, remis à zéro à chaque aube) ne se déclenchait jamais ; sans Grignote près d'une lampe, l'étape bouclait de nuit en nuit (reproduit). Désormais 40 s de nuit **cumulées** d'une nuit à l'autre.
- **Majeur** : sac plein, casser une pierre brillante la détruisait sans donner de lampe (hérité du J5) ; en répétant, l'enfant pouvait épuiser les pierres du monde et bloquer la mission 1 (reproduit). Une pierre brillante, une lampe ou un bloc arc-en-ciel ne se cassent plus quand leur butin n'entre pas : « Sac plein : vide une case ! » (`Inventory.canAdd`, testé).
- **Majeur** : l'abri se validait en creusant un seul bloc au pied d'un arbre (terre autour, feuillage au-dessus), 148 fois sur 204 arbres essayés (reproduit). Un creux creusé ne compte plus que sous un plafond de terre ou de pierre collé à la tête (vrai terrier) ; sinon, il faut un bloc posé par l'enfant.
- Mineurs corrigés : touche relâchée sur l'écran de félicitations restée « enfoncée » (le personnage avançait seul ; relâchement écouté en capture, clavier vidé à l'ouverture et à la fermeture) ; menu contextuel du navigateur non bloqué sur cet écran ; un nouveau monde commençait à l'heure du monde précédent (souvent la nuit après la mission 1) : il commence à 8 h ; « Reviens près de ta lampe » dit alors qu'aucune lampe n'était posée (« Pose ta lampe ! » si elle est dans le sac) ; le signal de 17 h 30 coupait la consigne de la dernière étape et en donnait la réponse (carillon seul pendant cette étape) ; écran de félicitations perdu si l'on quittait dans les 4 s après la fin (drapeau enregistré, montré à la reprise) ; libellé « tutoriel réussie » dans le mode parent (le monde est décrit à la mission 1, étape 1) ; astuce du toit dite à voix haute au lecteur débutant ; consigne au doigt « poser » précisant que le bloc va sous la croix.
- Non traités : un monde du J5 dont la mission était finie reprend à la dernière étape (pas d'étoile avant de l'avoir faite ; l'enfant y gagne l'écran et le cadeau) ; faux abri possible, en théorie, avec une pierre brillante ajoutée à un monde du J4 comme mur (improbable : au ras du sol) ; Pixel peut encore réapparaître dans l'eau (J5).

**Tests.** 527 tests unitaires (492 au J5 ; nouveaux : abri, missions et campagne, cadeau et formats, `canAdd`, `say`, son « bravo »). Tests de fumée : 96 exécutions sur les trois profils (89 au J5) ; nouveaux cas : tutoriel au clavier et au doigt (portrait et paysage), tutoriel enregistré puis repris, mission 1 de bout en bout (abri incomplet puis complet, conseil de Pixel, lampe, nuit accélérée, Grignote qui fuit, félicitations, menu contextuel, touche relâchée, cadeau en attente puis livré), dernière étape sans Grignotes, nouveau monde le matin, accueil et mode parent (étoile, tutoriel sauté, progression), pierre brillante gardée sac plein. Toute la suite est passée ; à la dernière série complète, un cas du J2 (« les touches 1 à 9 et la molette », nom de la case affiché brièvement) a échoué une fois sous charge (4 processus), puis est passé 3 fois sur 3 seul : fragilité de temps du test, antérieure au J6 et non liée à son code (à surveiller). `dist/cubes.html` : 698 ko ; ligne d'infos terminée par « J6 ».

**Choix faits sans consigne, à confirmer par Pierre.**
1. Tutoriel une fois par enfant (et non dans chaque monde).
2. Définition de l'abri (toit, 3 murs sur 4, fait par l'enfant, terrier accepté).
3. Dernière étape : le temps file (×30) jusqu'à la nuit plutôt que d'attendre jusqu'à 7 minutes ; découverte validée par une Grignote qui fuit la lampe.
4. Cadeau : 5 blocs arc-en-ciel (nouveau bloc décoratif) ; étoile sur le monde réussi ; pas de mission 2 (hors V1) : jeu libre ensuite.
5. Blocs précieux (pierre brillante, lampe, arc-en-ciel) non cassables sac plein (exception à la règle du J2 « le bloc est cassé mais pas ramassé »).

**Non vérifié.** Tout sur Firefox et le convertible (sons, voix, confettis, halo sur une vraie carte graphique) ; le temps réel que mettent les enfants pour chaque étape ; si un enfant de 6 ans arrive seul à poser un toit (murs de trois blocs, visée du haut du mur) — c'est la difficulté principale attendue de la mission 1.

**Attendu de Pierre.** Exporter les sauvegardes, remplacer le fichier au même endroit, dérouler le protocole J6 de `RETOURS.md`, puis la séance enfants J6 (test complet de la V1, critères du brief). Retours des J3 à J5 à intégrer ensuite, comme convenu. Avis sur les cinq choix ci-dessus.

**Prochaine étape.** Corrections d'après les retours (J3 à J6), puis J7 (recette V1).

## 2026-09-25 — Retour de Pierre sur le J6

**Reçu de Pierre.** Scénario complet réalisé en profil « petit » (lecteur débutant) : tutoriel puis mission 1 jusqu'à la fin ; la partie est bien sauvegardée. Appareil non précisé. Consigné dans `RETOURS.md`. Décision : passer au J7, les tests complets (enfants, convertible) viendront après.

## 2026-09-25 — J7, recette technique et version 1.0-rc

**Décisions de Pierre** (questions posées en début de session, options recommandées retenues) : masquer le panneau « Tests » et la ligne d'infos pendant les parties des enfants, avec une case du mode parent pour les réafficher ; afficher « 1.0-rc » jusqu'à la recette avec les enfants, puis « 1.0 » ; garder le nom « Cubes » pour l'instant ; dans ce J7, recette technique et correction des limites connues (sans attendre les retours des enfants).

**Fait.**
- **Version 1.0-rc** : nom et version en un seul endroit (`src/game/identity.ts` ; titre de l'onglet, messages, panneau). `package.json` en 1.0.0-rc.1.
- **Écran des enfants** : panneau « Tests » (qui permettait de « tricher » avec Compléter le sac, de changer l'heure…) et ligne d'infos techniques masqués pendant leurs parties ; les boutons ronds du haut se rangent contre le bord. Mode parent → « Afficher le panneau Tests et les infos techniques » (réglage `devTools`). Toujours visibles en mode adresse.
- **Recette technique** (`docs/RECETTE-V1.md`) : audit indépendant du code contre le brief, le plan et les règles, ligne par ligne (statut, où, test automatique). Tout le périmètre V1 est livré, les sept règles non négociables sont respectées (vérifiées concrètement : aucune requête réseau, rien de Minecraft, `KeyboardEvent.code`, moteur pur, identifiants stables, clés `cubes:`). Écarts avec le plan consignés (planches introuvables par l'enfant, pas de verre, graine par monde et non par profil, pas de « plage de nombres »).
- **Corrections issues de l'audit** :
  - la pierre n'est jamais en surface hors des montagnes (60 graines sur 60 par type) : conseil de Pixel quand l'étape stagne (« Creuse : la pierre est dessous ! ») ; conseils déclaratifs aussi pour les troncs, la pierre brillante et la pose de la lampe (`StepDef.hint`, après 40 s sans progrès, puis toutes les 60 s) ;
  - sac plein, un tronc cassé pendant l'étape « 6 troncs » était détruit (un désert n'en a parfois qu'une douzaine : mission impossible) : le bloc demandé par l'étape en cours ne se casse plus sac plein (« Sac plein : vide une case ! ») ;
  - le compte n'était jamais dit à l'objectif (paliers de 5) : « Six troncs ! Bravo ! », « Quatre pierres ! Bravo ! » ;
  - icône du bloc demandé dans le bandeau de Pixel (le lecteur débutant voit ce qu'il cherche) ;
  - deux derniers messages à une seule variante (monde ouvert ailleurs, plein écran refusé) ;
  - tests : aucune requête réseau au démarrage, identifiants de blocs figés.
- **Limites connues des jalons précédents, corrigées** :
  - import de sauvegarde tout ou rien (J4) ;
  - Pixel ne réapparaît plus dans l'eau (J5) ;
  - aucune Grignote ne naît dans un enclos de clôtures, même de plus de 14 blocs (J5) ;
  - caméra à la troisième personne qui passait derrière un mur en escalier vu en diagonale (J4) : sonde en boîte ;
  - escalade de secours expliquée seulement à l'écran (J2) : quand l'enfant pousse en vain contre les parois d'un trou, « Garde Sauter contre le mur ! » (Espace au clavier), ou « Casse un mur pour sortir ! » s'il est enfermé (`engine/pit.ts`, temps réel et non temps de jeu : c'est ce que vit l'enfant, même si les images sont lentes).
- **Documentation** : protocole « Recette V1 » dans `RETOURS.md` (les quatre critères du brief, avec les enfants, et les vérifications de la 1.0-rc) ; `PLAN.md` §2 remis d'équerre avec le livré, état du J7, **backlog V2 trié** (priorité 1 : craft des planches puis du verre, mission 2 avec blocs-lettres, nom définitif, suites de la recette ; priorité 2 : missions 3 à 5, plage de nombres, créatures qui bloquent un passage ; priorité 3 : outils, animaux, météo, musique, biomes, grottes, eau qui coule, bouton plonger) ; `BRIEF.md`, `README.md`, `CLAUDE.md`.

**Relecture du J7.** Agent indépendant sur le diff, avec reproduction (Vitest, Playwright) : 3 constats majeurs, 10 mineurs, aucun bloquant. Corrigés :
- **Majeur** : l'icône du bandeau à l'étape « Trouve une pierre qui brille » montrait la lampe (l'objectif) et non la pierre brillante à chercher : `StepDef.icon` (pierre brillante pour cette étape).
- **Majeur** : sac plein, le conseil d'étape (« Creuse… », « Cherche un arbre ! ») contredisait le refus de casser, et la vraie solution n'était jamais dite au lecteur débutant : conseil concret à la place, la sorte la moins nombreuse à poser (« Pose tes 2 fleurs rouges ! »), aussi au refus de casser (`emptySlotText`).
- **Majeur** : pendant l'étape abri, l'enfant qui pousse contre ses propres murs recevait tour à tour « Il manque le toit ! » et « Garde Espace contre le mur ! » (sortir de l'abri presque fini) : pas de conseil « coincé » pendant l'étape abri quand l'abri est le sien.
- Mineurs : « grimper » conseillé dans un abri 1 × 1 dont le toit est posé sur des murs de 3 blocs (`pitState` vérifie maintenant qu'une sortie par escalade existe : colonne libre jusqu'en haut d'une paroi et place au-dessus) ; Pixel posé dans l'eau à sa première apparition après un chargement (même recherche de terre ferme, sinon il attend) ; compte dit à l'objectif = nombre demandé et non ramassé, et coupé par la consigne suivante (compte réel ; la consigne attend la fin de la phrase ; une étape à la fois, pas avant la consigne de la précédente ; consigne sautée si l'étape est déjà remplie) ; restauration d'un import qui pouvait tout effacer si le stockage devenait inutilisable (elle ne supprime plus jamais une clé qui existait, et prévient si elle échoue) ; « Ton monde est ouvert ailleurs » caché derrière l'accueil (affiché sur l'accueil, et lu) ; « Temps ×20 » resté actif une fois le panneau masqué (remis à 1) ; enclos sur une pente non vu (clôtures cherchées à 8 blocs de haut ou de bas) ; copies de secours absentes de l'export alors que le message à l'adulte les y promettait (exportées et réimportées) ; deux conseils inexacts selon le monde ; nom du jeu encore écrit en dur à deux endroits.
- Non traités (limites) : enfermé dans une pièce fermée plus grande que 1 × 1, aucun conseil ; sur PC à la souris, plus de bouton plein écran pour l'enfant (il était dans le panneau Tests, masqué) : F11.
