# CLAUDE.md — projet « Cubes »

Jeu de construction en blocs 3D, éducatif, pour deux enfants (7 ans lecteur débutant, et un lecteur autonome). Navigateur, hors ligne, un seul fichier HTML. Lire `docs/BRIEF.md` (le quoi) et `docs/PLAN.md` (le comment, jalons J0 à J7) avant toute modification. `docs/JOURNAL.md` tient l'état d'avancement session après session : le mettre à jour à chaque fin de session.

## Commandes

- `npm install` — Node.js ≥ 22.12 requis (Vite 8 / Vitest 5).
- `npm run dev` — serveur de développement avec rechargement.
- `npm run build` — vérification des types puis production de `dist/cubes.html` (fichier unique, le seul livrable).
- `npm test` — tests unitaires Vitest (`tests/unit`).
- `npm run test:e2e` — tests de fumée Playwright sur `dist/cubes.html` ouvert en `file://` (lancer `npm run build` avant ; `npx playwright install chromium` une fois).
- `npm run preview` — sert `dist/` sur le réseau local (plan B pour la tablette).

## Règles non négociables

1. **Un seul fichier, hors ligne.** Aucun asset externe, aucun CDN, aucun `fetch`. Textures dessinées sur canvas au démarrage (`src/render/textures.ts`), sons synthétisés par Web Audio, voix par `speechSynthesis`. Tout ce qui est ajouté doit survivre à une ouverture par double-clic sans réseau.
2. **Rien de Minecraft.** Ni le nom, ni les textures, ni les personnages, ni les noms de créatures. Univers original ; nom provisoire « Cubes ».
3. **Public : 7 ans.** Textes courts en français simple, toujours en deux variantes (débutant / autonome) quand ils s'adressent à l'enfant. Aucune mort, aucun combat, aucun échec bloquant. Gros boutons tactiles.
4. **Clavier par position physique** : `KeyboardEvent.code` (KeyW/KeyA/KeyS/KeyD → ZQSD en AZERTY). Jamais `event.key` pour le déplacement.
5. **Le moteur (`src/engine/`) ne dépend pas de Three.js** ni du DOM : il est testé en Node par Vitest. Le rendu (`src/render/`) consomme le moteur.
6. **Identifiants de blocs stables** (`src/engine/blocks.ts`) : on ajoute à la fin, on ne renumérote jamais (sauvegardes).
7. **Clés de stockage préfixées `cubes:`** (en `file://` le `localStorage` est partagé entre tous les fichiers locaux).

## Architecture (voir `docs/PLAN.md` §2)

```
src/engine/   monde, blocs, raycast (DDA), physique AABB, aléatoire déterministe
src/render/   SceneView (Three.js), WorldMesh (faces visibles), textures (atlas procédural)
src/input/    Keyboard, MouseLook (Pointer Lock + repli glisser), TouchControls
src/game/     Game (assemblage + boucle), Player
src/edu/      Speech (synthèse vocale) ; à venir : profils, missions, compagnon
src/ui/       Hud (DOM natif, pas de framework)
src/save/     à venir (J4)
tests/unit    Vitest — moteur
tests/e2e     Playwright — fumée sur le fichier construit
```

## Conventions

- TypeScript strict (`noUncheckedIndexedAccess` activé) ; une classe ou un module par fichier ; commentaires et identifiants d'interface en français, code en anglais.
- Pas de dépendance ajoutée sans la noter dans `docs/JOURNAL.md` avec sa raison.
- Toute nouvelle fonctionnalité du moteur arrive avec un test unitaire ; toute nouvelle interface avec un cas dans `tests/e2e/smoke.spec.ts` si elle est vérifiable sans WebGL matériel.
- Avant de livrer : `npm run build` réussit, `npm test` passe, `dist/cubes.html` a été ouvert en `file://`.
- Le dossier vit dans OneDrive : ne jamais y écrire `node_modules` depuis Cowork ; en local, préférer un clone git hors OneDrive.

## État courant

Voir `docs/JOURNAL.md` (dernier jalon livré, tests attendus de Pierre, décisions ouvertes).
