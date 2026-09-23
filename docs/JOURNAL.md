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
