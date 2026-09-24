# Cubes (nom provisoire)

Jeu de construction en blocs 3D, éducatif, pour deux enfants. Fonctionne dans un navigateur, hors ligne, sans rien installer. État : **prototype J5** : monde généré (quatre types), jour et nuit, eau ; casse par appui maintenu, sac de 9 cases, compte lu à voix haute ; commandes tactiles pour le convertible replié ; accueil avec deux profils, trois mondes enregistrés par enfant, mode parent, personnage visible à la troisième personne ; **compagnon Pixel qui lit la mission, Grignotes la nuit, lampe, clôture et lance-bulles** (voir `docs/PLAN.md` et `docs/JOURNAL.md`).

## Jouer

Ouvrir `dist/cubes.html` par double-clic (Chrome, Edge ou Firefox). C'est tout : le fichier contient le jeu entier. La ligne d'infos en haut à gauche se termine par la version (« J5 ») : si ce n'est pas le cas, c'est une ancienne copie.

Sur PC : cliquer sur le monde pour capturer la souris. **ZQSD** (ou flèches) pour bouger, **Espace** pour sauter (ou nager vers le haut), **Maj** pour plonger, **clic gauche maintenu** pour casser (un anneau se remplit autour du viseur ; une fleur se cueille avec un appui plus court, mais un clic bref ne suffit pas), **clic droit** pour poser le bloc de la case choisie, **1 à 9** ou la **molette** pour choisir une case, **Échap** pour libérer la souris. Les marches d'un bloc se montent sans sauter ; dans l'eau, on flotte. Tombé dans un trou ? Garder **Espace** en avançant contre la paroi : au bout d'un instant, on grimpe (un mur de deux blocs arrête toujours si l'on marche sans sauter). En gardant le clic, on casse les blocs à la suite, mais un seul plus bas que ses pieds par appui. Si le navigateur refuse la capture, le jeu passe en mode repli : glisser en tenant le bouton pour regarder, bouton gauche maintenu sans bouger pour casser (on peut aussi viser en glissant puis s'arrêter sans lâcher), clic droit sans bouger pour poser.

Sur tablette (le convertible replié, en portrait ou en paysage) : le **rond** en bas à gauche fait marcher (poser le doigt dessus et le pousser) ; partout ailleurs, glisser le doigt regarde. On vise avec la croix du milieu ; en mode **Casser**, garder le doigt immobile casse le bloc visé (on peut viser en glissant puis s'arrêter sans lever le doigt) ; un nouveau doigt reprend la main (un doigt resté posé ne bloque rien) ; toucher le bouton **Casser** le fait devenir **Poser** : tapoter pose alors ; bouton **Sauter** (garder **Sauter** en poussant le joystick contre une paroi pour grimper hors d'un trou) ; toucher la barre choisit la case la plus proche. Le petit bouton carré au-dessus de **Casser** passe en **plein écran** (conseillé : la barre des tâches de Windows et les onglets de Firefox ne sont plus sous les doigts).

### Accueil, profils et sauvegarde (J4)

Au premier lancement, l'adulte tape les deux prénoms et choisit le niveau de lecture de chacun (débutant : messages courts lus à voix haute ; autonome : phrases complètes). Ensuite, à chaque ouverture : « Qui joue ? » → l'enfant touche son prénom → la première fois, il choisit son personnage → il choisit un de ses **trois mondes** (ou « + Nouveau », puis prairie, île, montagne ou désert). Le jeu enregistre tout seul toutes les 30 secondes, quand on passe à une autre appli et quand on revient à l'accueil (bouton **maison** en haut à droite). Le bouton **œil** (ou la touche **V**) montre le personnage : vue à la troisième personne, la caméra ne traverse pas les murs ; un second appui revient à la vue par les yeux.

**Mode parent** : sur l'écran « Qui joue ? », garder le doigt (ou le clic) **3 secondes** sur l'engrenage en bas à gauche. On y change les prénoms, niveaux et voix, la durée de la nuit (normale, courte, pas de nuit), on efface un monde, on **exporte** tout dans un fichier (`cubes-sauvegarde-AAAA-MM-JJ.json`, dans les téléchargements) et on l'**importe** (sur ce convertible ou un autre appareil). Exporter avant chaque nouvelle version du jeu. Ouvrir le jeu avec `#monde=…&graine=…` dans l'adresse saute l'accueil et n'enregistre rien (tests).

### Pixel, les Grignotes et la nuit (J5)

**Pixel**, le renard, trottine devant l'enfant et lit la mission en cours dans le bandeau en haut de l'écran (bouton **haut-parleur** pour la réentendre) ; l'avancement s'affiche (« 3 / 6 »). Mission 1 (première version) : ramasser 6 troncs, 4 pierres, poser 10 blocs pour une cabane, trouver une **pierre brillante** (cristaux bleus, en surface) qui donne une **lampe**, poser la lampe. Casser un tronc donne aussi une **clôture**.

Les **Grignotes** sont de petites boules à poils colorées. Le jour, elles restent loin. Vers 17 h 30 (en jeu), un carillon annonce la nuit : elles s'approchent et, au contact, en chipent un bloc du sac, puis s'enfuient en riant (jamais de dégâts). Elles fuient la lumière d'une **lampe** (à 6 blocs) et ne passent pas une **clôture**. Le bouton **Bulles** (touche **B** sur PC) les fait fuir ; touchée par une bulle, une Grignote rend le bloc qu'elle avait chipé. Le mode parent peut les désactiver.

### Le sac

Chaque bloc cassé est ramassé : il rejoint la case de son type dans la barre du bas (9 cases, 99 blocs au plus par case), et son nombre s'affiche. Poser un bloc en retire un. Le jeu annonce le compte (« 3 pierres ! ») à l'écran ; pour le lecteur débutant, la voix le lit au premier bloc de chaque sorte puis tous les 5 blocs (5, 10, 15…), pour ne pas se répéter. Les planches ne se trouvent pas dans la nature pour l'instant : le bouton **Compléter le sac** du panneau « Tests » complète jusqu'à 20 blocs de chaque sorte, dans la limite des 9 cases (ce qui a été ramassé reste ; « Vider le sac » d'abord pour avoir tout le kit). Le panneau règle aussi le niveau de lecture (débutant : messages courts lus à voix haute ; autonome : phrases complètes, voix coupée), la voix et les sons.

### Choisir le monde

Au démarrage : une prairie, avec une graine au hasard. Le panneau **Tests** (en haut à droite) permet de choisir le type (prairie, île, montagne, désert), la graine (même type + même graine = le même monde), l'heure (matin, midi, soir, nuit, temps accéléré) et la distance de rendu. L'adresse retient le monde affiché (`cubes.html#monde=ile&graine=1234`) : recharger la page redonne le même monde, et l'on peut taper une adresse de ce type pour en ouvrir un précis. On peut aussi y ajouter `&heure=20` ou `&distance=48` (pris en compte à l'ouverture). La distance de rendu vaut 96 blocs par défaut ; le choix fait dans le panneau est retenu d'une ouverture à l'autre (stockage local) et reste dans l'adresse. Le choix du monde par les enfants, sur un écran d'accueil, arrive au J4.

### Mettre le fichier sur le convertible (appareil des enfants)

L'appareil « tablette » est un ordinateur convertible Windows 10 (Acer Nitro 5 Spin NP515-51), utilisé replié, avec **Firefox**. Il n'y a pas de tablette Android.

Copier `dist/cubes.html` dans un dossier fixe du convertible (par exemple `Documents\Cubes`), par clé USB ou un cloud **personnel** (pas l'OneDrive ECOME, qui mettrait un compte professionnel sur l'appareil familial). L'ouvrir avec Firefox (clic droit → « Ouvrir avec » → Firefox) ; un raccourci sur le bureau vers ce fichier, ouvert par Firefox, évite que Windows le donne à Edge.

À chaque nouvelle version, **remplacer le fichier au même endroit, sous le même nom** (`cubes.html`, pas `cubes(1).html`). Sous Firefox, le stockage local d'un fichier ouvert en local serait lié à son chemin exact (non vérifié) : à partir du J4, une copie ailleurs ou renommée ne retrouverait pas les mondes des enfants.

Conseils pour le mode tablette : lancer le **plein écran** (petit bouton carré à droite) pour que la barre des tâches et les onglets de Firefox ne soient pas sous les doigts ; si l'image tourne quand on penche l'appareil, activer le verrouillage de la rotation de Windows (Centre de notifications). `npm run preview` (servir `dist/` sur le wifi de la maison) reste possible mais n'a plus d'usage prévu.

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
