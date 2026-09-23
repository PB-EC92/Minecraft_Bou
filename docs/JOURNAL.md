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
