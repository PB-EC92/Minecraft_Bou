# Cubes (nom provisoire)

Jeu de construction en blocs 3D, éducatif, pour deux enfants. Fonctionne dans un navigateur, hors ligne, sans rien installer. État : **prototype J2.1** : un vrai monde généré (quatre types au choix), jour et nuit, eau ; on casse en gardant l'appui, les blocs cassés vont dans un sac de 9 cases avec leur nombre, on pose ce qu'on a ramassé ; sons et compte lu à voix haute (voir `docs/PLAN.md` et `docs/JOURNAL.md`). Rien n'est encore enregistré : chaque ouverture repart de zéro, sac vide (la sauvegarde arrive au J4).

## Jouer

Ouvrir `dist/cubes.html` par double-clic (Chrome, Edge ou Firefox). C'est tout : le fichier contient le jeu entier. La ligne d'infos en haut à gauche se termine par la version (« J2.1 ») : si ce n'est pas le cas, c'est une ancienne copie.

Sur PC : cliquer sur le monde pour capturer la souris. **ZQSD** (ou flèches) pour bouger, **Espace** pour sauter (ou nager vers le haut), **Maj** pour plonger, **clic gauche maintenu** pour casser (un anneau se remplit autour du viseur ; une fleur se cueille avec un appui plus court, mais un clic bref ne suffit pas), **clic droit** pour poser le bloc de la case choisie, **1 à 9** ou la **molette** pour choisir une case, **Échap** pour libérer la souris. Les marches d'un bloc se montent sans sauter ; dans l'eau, on flotte. Tombé dans un trou ? Garder **Espace** en avançant contre la paroi : au bout d'un instant, on grimpe (un mur de deux blocs arrête toujours si l'on marche sans sauter). En gardant le clic, on casse les blocs à la suite, mais un seul plus bas que ses pieds par appui. Si le navigateur refuse la capture, le jeu passe en mode repli : glisser en tenant le bouton pour regarder, bouton gauche maintenu sans bouger pour casser (on peut aussi viser en glissant puis s'arrêter sans lâcher), clic droit sans bouger pour poser.

Sur tablette (le convertible replié) : doigt gauche = joystick, doigt droit = regarder ; on vise avec la croix du milieu ; en mode **Casser**, garder le doigt droit immobile casse le bloc visé (on peut viser en glissant puis s'arrêter sans lever le doigt) ; toucher le bouton **Casser** le fait devenir **Poser** : tapoter pose alors ; bouton **Sauter** (garder **Sauter** en poussant le joystick contre une paroi pour grimper hors d'un trou) ; toucher une case de la barre la choisit. Le bouton **Plein écran** est dans le panneau « Tests ».

### Le sac

Chaque bloc cassé est ramassé : il rejoint la case de son type dans la barre du bas (9 cases, 99 blocs au plus par case), et son nombre s'affiche. Poser un bloc en retire un. Le jeu annonce le compte (« 3 pierres ! ») à l'écran ; pour le lecteur débutant, la voix le lit au premier bloc de chaque sorte puis tous les 5 blocs (5, 10, 15…), pour ne pas se répéter. Les planches ne se trouvent pas dans la nature pour l'instant : le bouton **Compléter le sac** du panneau « Tests » complète jusqu'à 20 blocs de chaque sorte, dans la limite des 9 cases (ce qui a été ramassé reste ; « Vider le sac » d'abord pour avoir tout le kit). Le panneau règle aussi le niveau de lecture (débutant : messages courts lus à voix haute ; autonome : phrases complètes, voix coupée), la voix et les sons.

### Choisir le monde

Au démarrage : une prairie, avec une graine au hasard. Le panneau **Tests** (en haut à droite) permet de choisir le type (prairie, île, montagne, désert), la graine (même type + même graine = le même monde), l'heure (matin, midi, soir, nuit, temps accéléré) et la distance de rendu. L'adresse retient le monde affiché (`cubes.html#monde=ile&graine=1234`) : recharger la page redonne le même monde, et l'on peut taper une adresse de ce type pour en ouvrir un précis. On peut aussi y ajouter `&heure=20` ou `&distance=48` (pris en compte à l'ouverture). Le choix du monde par les enfants, sur un écran d'accueil, arrive au J4.

### Mettre le fichier sur le convertible (appareil des enfants)

L'appareil « tablette » est un ordinateur convertible Windows 10 (Acer Nitro 5 Spin NP515-51), utilisé replié, avec **Firefox**. Il n'y a pas de tablette Android.

Copier `dist/cubes.html` dans un dossier fixe du convertible (par exemple `Documents\Cubes`), par clé USB ou un cloud **personnel** (pas l'OneDrive ECOME, qui mettrait un compte professionnel sur l'appareil familial). L'ouvrir avec Firefox (clic droit → « Ouvrir avec » → Firefox) ; un raccourci sur le bureau vers ce fichier, ouvert par Firefox, évite que Windows le donne à Edge.

À chaque nouvelle version, **remplacer le fichier au même endroit, sous le même nom** (`cubes.html`, pas `cubes(1).html`). Sous Firefox, le stockage local d'un fichier ouvert en local serait lié à son chemin exact (non vérifié) : à partir du J4, une copie ailleurs ou renommée ne retrouverait pas les mondes des enfants.

Conseils pour le mode tablette : lancer le **Plein écran** (panneau « Tests ») pour que la barre des tâches et les onglets de Firefox ne soient pas sous les doigts ; si l'image tourne quand on penche l'appareil, activer le verrouillage de la rotation de Windows (Centre de notifications). `npm run preview` (servir `dist/` sur le wifi de la maison) reste possible mais n'a plus d'usage prévu.

## Développer

Prérequis : Node.js 22.12 ou plus récent (`node -v` pour vérifier).

```
npm install                       # une fois
npm run dev                       # développement avec rechargement automatique
npm run build                     # vérifie les types puis produit dist/cubes.html
npm test                          # tests unitaires (moteur, terrain, joueur, maillage, sac, casse, sons, textes, souris, voix)
npx playwright install chromium   # une fois, pour les tests de fumée
npm run test:e2e                  # tests de fumée sur dist/cubes.html ouvert en file:// (Node 22.12+ ; v24 sur le poste : ok)
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
