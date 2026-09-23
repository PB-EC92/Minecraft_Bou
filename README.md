# Cubes (nom provisoire)

Jeu de construction en blocs 3D, éducatif, pour deux enfants. Fonctionne dans un navigateur, hors ligne, sans rien installer. État : **prototype technique J0.1** (voir `docs/PLAN.md` et `docs/JOURNAL.md`).

## Jouer

Ouvrir `dist/cubes.html` par double-clic (Chrome ou Edge). C'est tout : le fichier contient le jeu entier. La ligne d'infos en haut à gauche indique la version (« J0.1 ») : si elle ne s'affiche pas, c'est une ancienne copie.

Sur PC : cliquer sur le monde pour capturer la souris. **ZQSD** (ou flèches) pour bouger, **Espace** pour sauter, **clic gauche** pour casser, **clic droit** pour poser, **1 à 6** pour choisir un bloc, **Échap** pour libérer la souris. Si le navigateur refuse la capture, le jeu passe en mode repli : glisser en tenant le bouton pour regarder, clic bref pour casser ou poser.

Sur tablette : doigt gauche = joystick, doigt droit = regarder, tapoter = agir (bouton **Casser / Poser** pour changer d'action), bouton **Sauter**. Le bouton **Plein écran** est dans le panneau « Tests J0 ».

### Mettre le fichier sur la tablette Android

Copier `dist/cubes.html` sur la tablette par câble USB, carte mémoire ou un cloud **personnel** (pas l'OneDrive ECOME, qui mettrait un compte professionnel sur la tablette familiale). L'ouvrir ensuite depuis le gestionnaire de fichiers avec **Chrome** (« Ouvrir avec… »), pas avec une visionneuse intégrée.

Si Chrome refuse d'ouvrir un fichier local, ou si le diagnostic n'affiche pas « Stockage local : ok », plan B : sur le PC, dans le dossier du projet, lancer `npm run preview`, puis ouvrir sur la tablette l'adresse affichée (de la forme `http://192.168.x.x:4173/cubes.html`). Les deux appareils doivent être sur le même wifi. Les sauvegardes (à partir de J4) seront alors liées à cette adresse : réserver l'adresse du PC dans la box pour qu'elle ne change pas.

## Développer

Prérequis : Node.js 22.12 ou plus récent (`node -v` pour vérifier).

```
npm install                       # une fois
npm run dev                       # développement avec rechargement automatique
npm run build                     # vérifie les types puis produit dist/cubes.html
npm test                          # tests unitaires (moteur, souris, voix, maillage)
npx playwright install chromium   # une fois, pour les tests de fumée
npm run test:e2e                  # tests de fumée sur dist/cubes.html ouvert en file://
```

Le dossier `node_modules` (créé par `npm install`) est volumineux : ne pas le créer dans le dossier OneDrive, travailler dans un clone git hors OneDrive (ci-dessous).

## Historique git et dépôt GitHub

Le projet est un dépôt git. Son historique complet est livré dans un seul fichier, `cubes.git.bundle`, à la racine du dossier. Il se publie sur le dépôt GitHub **`PB-EC92/Minecraft_Bou`**. Ce dépôt doit rester **privé** : vérifier dans Settings → General → Danger Zone → Change visibility.

1. Si l'application GitHub Claude est limitée à certains dépôts, lui donner accès à `Minecraft_Bou` (github.com → Settings → Applications → Claude → Configure) : les sessions Claude cloud **démarrées sur ce dépôt** pourront alors y travailler directement.
2. Dans PowerShell (adapter le chemin si besoin) :

```
git clone "$env:USERPROFILE\OneDrive - ECOME\Documents\Claude\Minecraft\cubes.git.bundle" C:\dev\Minecraft_Bou
cd C:\dev\Minecraft_Bou
git remote rename origin bundle
git remote add origin https://github.com/PB-EC92/Minecraft_Bou.git
git push -u origin main
```

Si le `push` est refusé (« rejected… fetch first »), c'est que GitHub a créé un premier fichier (README, licence) à l'ouverture du dépôt. Dans ce cas :

```
git pull origin main --allow-unrelated-histories --no-edit
git push -u origin main
```

En cas de conflit sur `README.md` pendant le `pull`, garder la version du projet (`git checkout --ours README.md`, `git add README.md`, `git commit --no-edit`), puis relancer le `push`.

Ensuite, `C:\dev\Minecraft_Bou` est la copie de travail (Claude Code, `npm install`, etc.) et GitHub la référence. Le dossier OneDrive reste le point de livraison des sessions Cowork.

## Documents

- `docs/BRIEF.md` — ce qu'on construit et pour qui.
- `docs/PLAN.md` — architecture, jalons J0 à J7, risques.
- `docs/JOURNAL.md` — avancement session par session.
- `docs/AUDIT-J0.md` — audit du J0 et suivi des corrections.
- `docs/RETOURS.md` — protocole de test et retours (Pierre et les enfants).
- `CLAUDE.md` — conventions pour le travail avec Claude (Cowork ou Claude Code).
