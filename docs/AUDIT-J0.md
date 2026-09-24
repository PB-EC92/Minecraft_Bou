# Audit du jalon J0 — « Cubes »

23 septembre 2026. Périmètre : tout ce qui a été livré dans le dossier `Minecraft` (code, tests, build, dépendances, documents) et sa cohérence avec le brief et le plan.

Méthode : relecture de chaque fichier ; reproduction complète (vérification des types, 12 tests unitaires, build, tests de fumée) ; analyse du fichier livré ; sondes automatisées ciblées (moteur exécuté en Node, jeu piloté dans Chromium sans interface, en `file://`, profils PC et tablette). Les preuves citées viennent de ces sondes. Limite : le Chromium du cloud n'a ni carte graphique ni voix, donc les performances réelles, la synthèse vocale et le comportement exact de la souris sur ton PC ne sont pas mesurables ici.

## Verdict

Le J0 remplit son contrat de prototype technique : il démarre en `file://`, rend le monde, se contrôle au clavier, à la souris et au doigt, et diagnostique ce qu'il faut mesurer. Le socle est sain (build reproductible, aucun code réseau, typage strict, moteur testé). En revanche, **quatre défauts fausseraient ton test J0** : saut de caméra à la capture de la souris, repli souris incomplet, apparition du joueur perché sur un arbre, chute hors du monde. Je recommande une correction courte (J0.1) avant que tu fasses les tests sur tes appareils.

## Ce qui a été vérifié et tient

| Point | Résultat |
|---|---|
| Build | Reproductible à l'octet près ; `dist/cubes.html` = 546 ko (le plan estimait 2 à 3 Mo) |
| Fichier livré | Aucun `fetch`, `XMLHttpRequest`, `eval`, WebSocket ni ressource externe ; les deux URL présentes sont une chaîne d'espace de noms XML et une référence de commentaire dans Three.js |
| Dépendances | `npm audit` : 0 vulnérabilité ; lockfile contenant les binaires Windows (rolldown, lightningcss, TypeScript natif) : pas de piège au `npm install` sur ton poste |
| Typage et tests | TypeScript strict sans erreur ; 12/12 tests unitaires ; tests de fumée en `file://` au vert |
| Maillage | 12 triangles sur 12 orientés vers l'extérieur (vérification géométrique) |
| Physique | Pas de traversée de bloc à grande vitesse ; passage sous un linteau à 2 blocs ; arrêt net contre une marche |
| Tablette (simulée) | Glisser à droite = regarder ; tapoter = casser (« Cassé : herbe ») ; bouton Casser/Poser bascule correctement |
| PC | Souris capturée en `file://` ; clic gauche casse, clic droit pose (« Posé : planches ») |
| Touche Espace | Hypothèse d'un bug (Espace réactivant le dernier bouton cliqué) testée et **réfutée** : le clavier du jeu bloque bien l'activation |
| Originalité | Textures dessinées par code, aucun nom ni élément repris de Minecraft |

## Constats

Gravité : **Majeur** = fausse le test J0 ou gêne directement l'enfant ; **Moyen** = à traiter dans le jalon indiqué ; **Mineur** = cosmétique ou hygiène.

| # | Gravité | Constat | Preuve | Recommandation | Quand |
|---|---|---|---|---|---|
| 1 | Majeur | À chaque capture de la souris, la caméra pivote brusquement (≈ 80° de côté, 45° vers le haut) | Sonde : premier mouvement reçu après capture = (−640, −360), soit la moitié de la fenêtre. Comportement connu de Chromium, **ampleur sur ton PC réel à confirmer** | Ignorer le premier mouvement après capture et écrêter les deltas aberrants (> 150 px) | J0.1 |
| 2 | Majeur | Si la capture de la souris est refusée, le repli permet de regarder (glisser) mais **pas de casser ni de poser** | Sonde avec l'API retirée : glisser OK, clic sans effet ; code `MouseLook` : l'action n'est émise qu'en mode capturé | En mode repli, un clic sans glisser = action (comme le tapotement tactile) | J0.1 |
| 3 | Majeur | Le joueur apparaît **sur le feuillage de l'arbre** (y = 8 au lieu de 4) : le sol est hors de portée au départ, rien ne se casse tant qu'on n'est pas descendu | Diagnostic « pos 16.5 8.0 20.5 » ; `surfaceHeight` compte le feuillage placé sur la case de départ | Calculer le point d'apparition sur une zone dégagée | J0.1 |
| 4 | Majeur | Rien n'empêche de sortir du monde : chute dans le vide jusqu'à y = −20 puis téléportation au centre | Sonde : x atteint 38,4 pour un monde de 32, y min = −20 | Bords infranchissables (hors limites horizontales = solide pour la physique) | J0.1 |
| 5 | Moyen | Un PC à écran tactile est traité comme une tablette : joystick et gros boutons s'affichent sur le PC | Sonde « PC + tactile » : interface tactile affichée. Détection par `maxTouchPoints > 0` | Détecter par `matchMedia("(pointer: coarse)")` et basculer au premier vrai toucher | J0.1 si ton PC est tactile, sinon J3 |
| 6 | Moyen | Voix : aucune préférence pour les voix **locales**, alors que le jeu doit marcher hors ligne (Edge propose des voix « en ligne ») ; liste figée si les voix arrivent après 2 s | Code `speech.ts` (`pickVoice`, `whenReady`) | Préférer `localService` ; réécouter `voiceschanged` en continu | J0.1 |
| 7 | Moyen | Risque connu de Chrome : la fin de lecture n'est parfois jamais signalée ; le panneau resterait sur « Lecture… » | Littérature technique ; **non reproduit ici** (pas de voix dans le cloud) | Garder une référence à la phrase en cours et prévoir un délai de secours | J0.1 |
| 8 | Moyen | Poser un bloc là où se trouve le joueur échoue **sans aucun retour** ; pour un enfant, « ça ne marche pas » | Code `Game.placeBlock` : `return` silencieux | Message et son « pas de place ici » | J2 |
| 9 | Moyen | Une marche d'un bloc exige un saut coordonné avec le joystick : difficile à 7 ans sur tablette | Sonde : arrêt à x = 9,7 devant une marche | Montée automatique des marches d'un bloc | J1 |
| 10 | Moyen | Tout le monde est remaillé à chaque bloc posé ou cassé : 6,7 ms sur le serveur, probablement plusieurs fois plus sur tablette (à-coup) | Sonde Node ; mesure tablette à faire | Découpage en chunks, déjà prévu | J1 |
| 11 | Moyen | Pas de filet de sécurité : une erreur dans la boucle de jeu figerait l'écran sans message ; pas de gestion de la perte du contexte 3D (Android en arrière-plan) | Code `Game.frame`, `SceneView` ; perte de contexte **non testée** | Gestionnaire d'erreur global avec écran lisible ; test « passer à une autre appli puis revenir » dans le protocole | J1 |
| 12 | Mineur | Tapoter casse immédiatement ; seuil de 300 ms possiblement court pour un enfant | Code `TouchControls` | Appui long pour casser (prévu), seuil à ajuster aux tests | J2-J3 |
| 13 | Mineur | Relief affadi : les facteurs d'ombrage sont interprétés en couleur linéaire (un facteur de 0,5 s'affiche à environ 0,73) | Calcul ; non mesuré à l'écran | Convertir les facteurs en linéaire | J1 |
| 14 | Mineur | Texels de bord affichés à demi-largeur (retrait d'un demi-texel dans les UV) | Calcul (`tileUv`) | Retrait beaucoup plus faible | J1 |
| 15 | Mineur | Le feuillage est fait de blocs d'herbe (faces latérales de terre) | Capture | Bloc feuillage, prévu | J1 |
| 16 | Mineur | Bouton Sauter : pas de gestion de `touchcancel`, saut qui peut rester enfoncé | Code | Ajouter `touchcancel` | J3 |
| 17 | Mineur | `@types/node` en v26 alors que Node ≥ 22.12 est requis ; types Node visibles dans le code du jeu | `package.json`, `tsconfig.json` | Aligner sur Node 22 ; tsconfig séparé pour les tests | J1 |
| 18 | Mineur | Tests : casser et poser ne sont pas couverts par les tests de fumée ; aucun test du joueur ni du maillage ; test « voix » trop permissif | `tests/` | Transformer les sondes de cet audit en tests | J0.1 |

## Documents

| # | Constat | Correction |
|---|---|---|
| D1 | `PLAN.md` §4 indique « Vite 7 exige Node.js 20.19 » : le projet utilise Vite 8 et Vitest 5, qui exigent **Node ≥ 22.12** (`CLAUDE.md` et `JOURNAL.md` sont justes) | Mettre à jour le §4 et la source |
| D2 | `PLAN.md` §2 : taille estimée 2 à 3 Mo, réelle 0,55 Mo | Mettre à jour |
| D3 | `RETOURS.md` : la ligne « Souris capturée… » a une colonne manquante ; la colonne Chrome y est marquée « — » à tort | Corriger la ligne |
| D4 | `PLAN.md` J0 et `README.md` proposent de passer le fichier à la tablette « via OneDrive » : c'est l'OneDrive **ECOME**, donc un compte professionnel sur la tablette familiale | Privilégier câble USB, carte mémoire, cloud personnel ou serveur local (plan B) |
| D5 | Le dossier contient une copie `Claude outputs/cubes.html` créée par l'envoi dans la conversation : risque d'ouvrir une version périmée après les prochaines livraisons | Supprimer ce dossier (je ne peux pas supprimer de fichiers d'ici) ; toujours ouvrir `dist/cubes.html` |

## Commentaires

**Architecture.** La séparation moteur / rendu / entrées / jeu tient, et le moteur est testable en Node sans navigateur : c'est ce qui a permis les sondes de cet audit. Le choix « un fichier, zéro ressource externe » est respecté et vérifié. Le remaillage global et le monde en un seul tableau sont des simplifications assumées du J0, déjà prévues au J1.

**Hygiène du projet.** Il n'y a pas de gestion de versions. OneDrive garde des versions fichier par fichier, mais pas un état cohérent du projet, et rien ne permet de revenir proprement en arrière après une mauvaise modification. Recommandation : `git init` et un dépôt GitHub privé dès J0.1 (tu déploies déjà sur GitHub). Cela règle aussi la question du clone hors OneDrive pour travailler localement. Un point de gouvernance à ta main : le projet vit sur l'OneDrive et le poste professionnels ; à voir si c'est acceptable pour ECOME, ou s'il vaut mieux le déplacer vers un espace personnel.

**Risques absents du plan.** Deux risques sur la sauvegarde tablette, non vérifiés et à ajouter au §5. Premier risque : un fichier ouvert depuis le gestionnaire de fichiers Android peut ne pas disposer du stockage local, et la ligne « Stockage local » du diagnostic le dira. Second risque : avec le plan B (serveur sur le PC), les sauvegardes sont attachées à l'adresse du PC, et si le PC change d'adresse sur la box, elles « disparaissent ». Parades : réserver l'adresse du PC dans la box, et faire de l'export de sauvegarde un geste régulier.

**Produit et pédagogie.** Le plan place le premier contenu éducatif en J5-J6, soit après environ 8 sessions. C'est logique techniquement, mais cela valide tard ce qui compte le plus pour toi. Suggestion peu coûteuse : dès J2, une boucle « voix + comptage » (« Tu as ramassé 3 pierres ! ») pour tester tôt, avec les enfants, si la voix et le comptage accrochent. Deux autres points d'ergonomie à anticiper pour 7 ans : la montée automatique des marches (constat 9), et l'option d'une vue à la troisième personne si la vue subjective désoriente l'enfant, à décider aux premiers tests.

## Non vérifié

Voix françaises et fin de lecture sur tes appareils ; ampleur réelle du saut de caméra sur ton PC ; performances et perte de contexte 3D sur la tablette ; ouverture du fichier et stockage local sur Android ; présence et version de Node.js sur ton poste. Le protocole J0 de `RETOURS.md` couvre tous ces points, sauf la perte de contexte (à ajouter).

## Priorités proposées

J0.1, une session courte, avant tes tests : constats 1 à 4 et 6-7, test de fumée casser/poser, `git init`, corrections D1 à D3. Le constat 5 ne rentre dans J0.1 que si ton PC est tactile. Tout le reste suit les jalons indiqués.

## Suivi des corrections (J0.1, 23 septembre 2026)

| # | État | Ce qui a été fait | Vérification |
|---|---|---|---|
| 1 | Corrigé | Mouvements ignorés 80 ms après la capture et mouvements isolés > 200 px écartés (`src/input/mouseFilter.ts`) ; compteur « mouvements écartés » dans le diagnostic | Test unitaire avec la valeur observée (−640, −360) ; test de fumée : orientation identique avant/après capture. Sur ton PC réel : à confirmer (protocole J0.1) |
| 2 | Corrigé | Mode repli : glisser = regarder, clic bref = casser/poser ; message et consigne adaptés ; la capture est retentée à chaque clic (Chrome refuse une recapture pendant ~1 s après Échap) | Test de fumée avec l'API de capture retirée |
| 3 | Corrigé | Point d'apparition calculé au sol (`World.findStandingY`) ; arbre éloigné du point d'apparition | Tests unitaires ; test de fumée « au sol » |
| 4 | Corrigé | Bords horizontaux et dessous du monde = murs pour la physique (`World.isSolidForPhysics`) ; la visée ne les voit pas | Tests unitaires monde et joueur |
| 5 | Corrigé | Détection par `(pointer: coarse)` ; sur PC tactile, l'interface tactile apparaît au premier toucher | Test de fumée (profil PC + toucher réel). Note : l'option `hasTouch` de Playwright fait passer un PC pour une tablette, elle ne sert donc pas à ce test |
| 6 | Corrigé | Voix locales préférées (fonction pure `chooseVoice`) ; liste rafraîchie à chaque `voiceschanged` ; panneau « dont N locale(s) » | Tests unitaires ; sur tes appareils : à confirmer |
| 7 | Corrigé | Référence conservée sur la phrase en cours + délai de secours | Test unitaire du délai ; comportement réel : à confirmer |
| 8 | Corrigé | Message « Pas de place ici : tu es dedans ! » | Relecture |
| 11 | En partie | Boucle de jeu protégée : écran « Oups » lisible avec le texte technique. Perte de contexte 3D : test ajouté au protocole, traitement au J1 si besoin | Relecture |
| 16 | Corrigé | `touchcancel` géré sur Sauter | Relecture |
| 17 | Corrigé | `@types/node` en v22 ; `tsconfig.json` (jeu, sans types Node) et `tsconfig.node.json` (tests) | `npm run typecheck` |
| 18 | Corrigé | 40 tests unitaires (12 avant) ; 12 tests de fumée (6 avant), dont casser/poser à la souris, au doigt et en mode repli | `npm test`, `npm run test:e2e` |
| 9, 10, 12-15 | Reporté | Selon les jalons indiqués dans le tableau des constats (traités au J1, voir ci-dessous) | — |
| D1-D3 | Corrigé | `PLAN.md` (Node ≥ 22.12, taille mesurée), `RETOURS.md` (ligne corrigée, protocole J0.1 enrichi) | Relecture |
| D4 | Corrigé | `PLAN.md` et `README.md` : transfert par câble, carte ou cloud personnel | Relecture |
| D5 | Fait par Pierre | `Claude outputs\cubes.html` supprimé | Dossier vide constaté le 23/09/2026 |
| Git | Fait, à publier | Dépôt git avec historique, livré dans `cubes.git.bundle` ; à pousser par Pierre vers `PB-EC92/Minecraft_Bou` (la session Cowork ne peut ni créer ni rattacher un dépôt) | `git bundle verify`, clone de contrôle |

## Suivi des corrections (J1, 23 septembre 2026)

| # | État | Ce qui a été fait | Vérification |
|---|---|---|---|
| 9 | Corrigé | Montée automatique des marches d'un bloc (et d'une berge jusqu'à deux blocs dans l'eau), caméra lissée ; réglable (`Player.autoStep`) pour le mode parent | Tests unitaires : marche montée, mur de deux blocs infranchissable, caméra sans à-coup, désactivation |
| 10 | Corrigé | Rendu par sections de 16³ : seule la section touchée (et ses voisines si le bloc est sur une frontière) est remaillée ; file par distance avec budget de temps par image | Tests unitaires (1 section remaillée à l'intérieur, 2 sur une frontière). Serveur cloud : monde entier 60 à 200 ms, une section < 1 ms en général (5,6 ms au pire, premier passage). Tablette : à mesurer |
| 11 | Corrigé | Perte du contexte 3D : rendu suspendu, message, reprise à la restauration ; ligne « Contexte 3D » au diagnostic | Test de fumée (perte et restauration forcées, image redessinée). Sur Android réel : à confirmer (protocole J1) |
| 12 | En partie | Seuil du tapotement porté de 300 à 450 ms (aligné sur le clic souris) ; il faisait aussi échouer par intermittence un test de fumée sous charge (cause probable : délai d'exécution, 8 passages sur 8 après correction) | Appui long pour casser : J2-J3 |
| 13 | Corrigé | Facteurs d'ombrage convertis en couleur linéaire ; occlusion ambiante par sommet | Test unitaire (valeurs converties) ; captures d'écran |
| 14 | Corrigé | Retrait des UV ramené à 1/50 de texel ; atlas en grille 8 × 4 | Test unitaire |
| 15 | Corrigé | Bloc feuilles dédié (arbres générés et arbre du monde plat) | Test unitaire, captures |

## Suivi des corrections (J2, 24 septembre 2026)

| # | État | Ce qui a été fait | Vérification |
|---|---|---|---|
| 8 | Complété | « Pas de place » passe par le narrateur (deux variantes, son de refus doux) ; d'autres refus sont annoncés de la même façon : case vide, sac plein, maximum 99, fleur sans sol, couche du bas, bord du monde | Tests de fumée « case vide », « sac plein » ; test unitaire des textes |
| 12 | Corrigé | Casser demande un appui maintenu (souris capturée, mode repli, doigt), avec un anneau de progression autour du viseur ; un appui bref ne casse rien et affiche « Appuie longtemps ! » ; pour un geste ambigu (doigt à droite, souris non capturée), la casse ne démarre qu'après 150 ms d'immobilité | Tests unitaires (`breaking`, `breakPress`) ; tests de fumée souris capturée, clic bref, mode repli, doigt |
