# CLAUDE.md — projet « Cubes »

Jeu de construction en blocs 3D, éducatif, pour deux enfants (6 ans lecteur débutant, 8 ans lecteur autonome). Navigateur, hors ligne, un seul fichier HTML. Lire `docs/BRIEF.md` (le quoi) et `docs/PLAN.md` (le comment, jalons J0 à J7) avant toute modification. `docs/JOURNAL.md` tient l'état d'avancement session après session : le mettre à jour à chaque fin de session.

## Commandes

- `npm install` — Node.js ≥ 22.12 requis (Vite 8 / Vitest 5).
- `npm run dev` — serveur de développement avec rechargement.
- `npm run build` — vérification des types puis production de `dist/cubes.html` (fichier unique, le seul livrable).
- `npm run typecheck` — deux passes : `tsconfig.json` (code du jeu, sans types Node) et `tsconfig.node.json` (tests et configuration).
- `npm test` — tests unitaires Vitest (`tests/unit`).
- `npm run test:e2e` — tests de fumée Playwright sur `dist/cubes.html` ouvert en `file://` (lancer `npm run build` avant ; `npx playwright install chromium` une fois).
- `npm run preview` — sert `dist/` sur le réseau local (plan B pour la tablette).

## Règles non négociables

1. **Un seul fichier, hors ligne.** Aucun asset externe, aucun CDN, aucun `fetch`. Textures dessinées sur canvas au démarrage (`src/render/textures.ts`), sons synthétisés par Web Audio, voix par `speechSynthesis`. Tout ce qui est ajouté doit survivre à une ouverture par double-clic sans réseau.
2. **Rien de Minecraft.** Ni le nom, ni les textures, ni les personnages, ni les noms de créatures. Univers original ; nom provisoire « Cubes ».
3. **Public : 6-8 ans.** Textes courts en français simple, toujours en deux variantes (débutant / autonome) quand ils s'adressent à l'enfant. Aucune mort, aucun combat, aucun échec bloquant. Gros boutons tactiles.
4. **Clavier par position physique** : `KeyboardEvent.code` (KeyW/KeyA/KeyS/KeyD → ZQSD en AZERTY). Jamais `event.key` pour le déplacement.
5. **Le moteur (`src/engine/`) ne dépend pas de Three.js** ni du DOM : il est testé en Node par Vitest. Le rendu (`src/render/`) consomme le moteur.
6. **Identifiants de blocs stables** (`src/engine/blocks.ts`) : on ajoute à la fin, on ne renumérote jamais (sauvegardes).
7. **Clés de stockage préfixées `cubes:`** (en `file://` le `localStorage` est partagé entre tous les fichiers locaux).

## Architecture (voir `docs/PLAN.md` §2)

```
src/engine/   World (tableau plat + versions par section de 16³, bords = murs), blocks (propriétés, durée de casse,
              tables rapides), terrain (types de monde, graine, apparition), noise (bruit à graine), dayNight (cycle),
              raycast (DDA), physics (AABB), random, inventory (sac de 9 cases, une par type, 99 max, format de
              sauvegarde), breaking (casse par appui maintenu : progression, verrou, écart de répétition)
src/render/   SceneView (Three.js, brouillard, mer au-delà des bords, perte de contexte), ChunkRenderer (sections,
              file par distance, budget par image, distance de rendu), mesher (pur : faces visibles, occlusion
              ambiante, eau, fleurs en croix), atlas (disposition pure), textures (dessin), Sky (soleil, lune, étoiles)
src/input/    Keyboard, MouseLook (Pointer Lock + repli glisser/appui), mouseFilter (fonctions pures), TouchControls,
              breakPress (appui « casser » commun souris/tactile, pur)
src/audio/    sounds (sons synthétisés Web Audio, recettes pures, contexte créé au premier geste)
src/game/     Game (assemblage + boucle protégée + `window.cubesDebug`), Player (marches, eau), urlOptions (#monde=…)
src/edu/      Speech (synthèse vocale, voix locales préférées), texts (messages en deux variantes, niveaux de lecture),
              counting (noms comptables, nombres en lettres accordés, phrases de ramassage), Narrator (affiche la
              variante du niveau, lit à voix haute, anti-répétition) ; à venir : profils, missions, compagnon
src/ui/       Hud (DOM natif, pas de framework), fatal (écran d'erreur lisible)
src/save/     à venir (J4)
tests/unit    Vitest — moteur
tests/e2e     Playwright — fumée sur le fichier construit
```

## Conventions

- TypeScript strict (`noUncheckedIndexedAccess` activé) ; une classe ou un module par fichier ; commentaires et identifiants d'interface en français, code en anglais.
- Pas de dépendance ajoutée sans la noter dans `docs/JOURNAL.md` avec sa raison.
- Toute nouvelle fonctionnalité du moteur arrive avec un test unitaire ; toute nouvelle interface avec un cas dans `tests/e2e/smoke.spec.ts` si elle est vérifiable sans WebGL matériel.
- Avant de livrer : `npm run build` réussit, `npm test` passe, `dist/cubes.html` a été ouvert en `file://`.
- Le dossier vit dans OneDrive : ne jamais y écrire `node_modules` depuis Cowork ; en local, travailler dans le clone git hors OneDrive (voir `README.md`).
- Git : une session Cowork commite ses changements et redépose `cubes.git.bundle` ; messages de commit en français, préfixés par le jalon (ex. « J1 : … »).
- Tests de fumée : l'option `hasTouch` de Playwright fait passer un PC pour une tablette (`pointer: coarse`) ; pour simuler un PC à écran tactile, garder le profil PC et envoyer les touchers par CDP (`Input.dispatchTouchEvent`).
- Tests de fumée : ouvrir `#monde=plat&graine=1` (monde plat du J0, positions connues) pour les scénarios d'interaction ; attendre `!window.cubesDebug.state().loading`. `window.cubesDebug` donne l'état (sac, progression de casse, niveau de lecture, sons compris), oriente le regard, téléporte, remplit ou vide le sac, lit un pixel juste après le rendu et provoque une perte de contexte 3D.
- Casser demande un appui maintenu (J2) : dans un test, `mouse.down`, attendre que le bloc soit devenu de l'air, puis `mouse.up` ; un `click` ne casse rien.
- Sons et voix : le navigateur les bloque tant qu'il n'y a pas eu de geste (clic, touche, toucher) ; ne jamais lire ni jouer au démarrage.
- Rendu : pas de lumière Three.js. Les couleurs de sommets sont en linéaire (convertir depuis la luminosité perçue, voir `mesher.ts`) ; le jour/nuit passe par la couleur des matériaux (`SceneView.setSky`).

## État courant

Voir `docs/JOURNAL.md` (dernier jalon livré, tests attendus de Pierre, décisions ouvertes).
