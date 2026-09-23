# Cubes (nom provisoire)

Jeu de construction en blocs 3D, éducatif, pour deux enfants. Fonctionne dans un navigateur, hors ligne, sans rien installer. État : **prototype technique J0** (voir `docs/PLAN.md`).

## Jouer

Ouvrir `dist/cubes.html` par double-clic (Chrome ou Edge). C'est tout : le fichier contient le jeu entier.

Sur PC : cliquer sur le monde pour capturer la souris. **ZQSD** (ou flèches) pour bouger, **Espace** pour sauter, **clic gauche** pour casser, **clic droit** pour poser, **1 à 6** pour choisir un bloc, **Échap** pour libérer la souris.

Sur tablette : doigt gauche = joystick, doigt droit = regarder, tapoter = agir (bouton **Casser / Poser** pour changer d'action), bouton **Sauter**. Le bouton **Plein écran** est dans le panneau « Tests J0 ».

### Mettre le fichier sur la tablette Android

Copier `dist/cubes.html` dans un dossier accessible depuis la tablette (application OneDrive, câble USB ou pièce jointe), puis l'ouvrir avec Chrome depuis le gestionnaire de fichiers. Si Chrome refuse d'ouvrir un fichier local, plan B : sur le PC, dans le dossier du projet, lancer `npm run preview`, puis ouvrir sur la tablette l'adresse affichée (de la forme `http://192.168.x.x:4173/cubes.html`). Les deux appareils doivent être sur le même wifi.

## Développer

Prérequis : Node.js 22.12 ou plus récent.

```
npm install                       # une fois
npm run dev                       # développement avec rechargement automatique
npm run build                     # produit dist/cubes.html
npm test                          # tests unitaires du moteur
npx playwright install chromium   # une fois, pour les tests de fumée
npm run test:e2e                  # tests de fumée sur dist/cubes.html
```

Le dossier `node_modules` (créé par `npm install`) est volumineux : si le projet est dans OneDrive, préférer travailler dans un clone git hors OneDrive.

## Documents

- `docs/BRIEF.md` — ce qu'on construit et pour qui.
- `docs/PLAN.md` — architecture, jalons J0 à J7, risques.
- `docs/JOURNAL.md` — avancement session par session.
- `docs/RETOURS.md` — retours de test (Pierre et les enfants).
- `CLAUDE.md` — conventions pour le travail avec Claude (Cowork ou Claude Code).
