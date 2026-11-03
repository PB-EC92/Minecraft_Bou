# Cubes (nom provisoire)

Jeu de construction en blocs 3D, éducatif, pour deux enfants. Fonctionne dans un navigateur, hors ligne, sans rien installer. État : **version 1.1-rc** (lot 1 de la V2, en recette ; la 1.0 sera déclarée après la recette avec les enfants). La V1 : monde généré (quatre types), jour et nuit, eau ; casse par appui maintenu, sac de 9 cases, compte lu à voix haute ; commandes tactiles pour le convertible replié ; accueil avec deux profils, trois mondes enregistrés par enfant, mode parent, personnage visible à la troisième personne ; compagnon Pixel, Grignotes la nuit, lampe, clôture et lance-bulles ; tutoriel, mission 1 « Construis un abri avant la nuit », écran de félicitations et cadeau. Le lot 1 de la V2 y ajoute : **fabrication** (planches, clôtures, verre), **bloc de verre**, **mission 2 « Les mots »** (lettres posées dans le monde, copie ou dictée), et les suites de la recette (vider une case par un appui long, soir retenu à 17 h, lampe à découvrir, rappel d'export). Voir `docs/PLAN.md`, `docs/V2-LOT1.md` et `docs/JOURNAL.md`.

## Jouer

Ouvrir `dist/cubes.html` par double-clic (Chrome, Edge ou Firefox). C'est tout : le fichier contient le jeu entier. La ligne d'infos en haut à gauche se termine par la version (« 1.1-rc ») ; elle est visible une fois l'option « Afficher le panneau Tests et les infos techniques » cochée dans le mode parent (masquée par défaut pendant les parties des enfants) : si ce n'est pas le cas, c'est une ancienne copie.

Sur PC : cliquer sur le monde pour capturer la souris. **ZQSD** (ou flèches) pour bouger, **Espace** pour sauter (ou nager vers le haut), **Maj** pour plonger, **clic gauche maintenu** pour casser (un anneau se remplit autour du viseur ; une fleur se cueille avec un appui plus court, mais un clic bref ne suffit pas), **clic droit** pour poser le bloc de la case choisie, **1 à 9** ou la **molette** pour choisir une case (garder la touche **une seconde** vide la case, voir « Le sac »), **F** pour fabriquer (dès que le marteau est là), **0** pour la boîte à lettres (mission 2), **Échap** pour libérer la souris ou fermer un panneau. Les marches d'un bloc se montent sans sauter ; dans l'eau, on flotte. Tombé dans un trou ? Garder **Espace** en avançant contre la paroi : au bout d'un instant, on grimpe (Pixel le rappelle si l'enfant pousse en vain contre les parois) (un mur de deux blocs arrête toujours si l'on marche sans sauter). En gardant le clic, on casse les blocs à la suite, mais un seul plus bas que ses pieds par appui. Si le navigateur refuse la capture, le jeu passe en mode repli : glisser en tenant le bouton pour regarder, bouton gauche maintenu sans bouger pour casser (on peut aussi viser en glissant puis s'arrêter sans lâcher), clic droit sans bouger pour poser.

Sur tablette (le convertible replié, en portrait ou en paysage) : le **rond** en bas à gauche fait marcher (poser le doigt dessus et le pousser) ; partout ailleurs, glisser le doigt regarde. On vise avec la croix du milieu ; en mode **Casser**, garder le doigt immobile casse le bloc visé (on peut viser en glissant puis s'arrêter sans lever le doigt) ; un nouveau doigt reprend la main (un doigt resté posé ne bloque rien) ; toucher le bouton **Casser** le fait devenir **Poser** : tapoter pose alors ; bouton **Sauter** (garder **Sauter** en poussant le joystick contre une paroi pour grimper hors d'un trou) ; toucher la barre choisit la case la plus proche (garder le doigt **une seconde** sur une case la vide) ; le bouton orange au **marteau**, au-dessus de **Casser**, ouvre la fabrication. Le petit bouton carré tout en haut de la colonne passe en **plein écran** (conseillé : la barre des tâches de Windows et les onglets de Firefox ne sont plus sous les doigts).

### Accueil, profils et sauvegarde (J4)

Au premier lancement, l'adulte tape les deux prénoms et choisit le niveau de lecture de chacun (débutant : messages courts lus à voix haute ; autonome : phrases complètes). Ensuite, à chaque ouverture : « Qui joue ? » → l'enfant touche son prénom → la première fois, il choisit son personnage → il choisit un de ses **trois mondes** (ou « + Nouveau », puis prairie, île, montagne ou désert). Le jeu enregistre tout seul toutes les 30 secondes, quand on passe à une autre appli et quand on revient à l'accueil (bouton **maison** en haut à droite). Le bouton **œil** (ou la touche **V**) montre le personnage : vue à la troisième personne, la caméra ne traverse pas les murs ; un second appui revient à la vue par les yeux.

**Mode parent** : sur l'écran « Qui joue ? », garder le doigt (ou le clic) **3 secondes** sur l'engrenage en bas à gauche (aucun texte ne l'indique à l'écran des enfants ; l'écran du premier réglage le rappelle une fois à l'adulte). On y change les prénoms, niveaux et voix, la durée de la nuit (normale, courte, pas de nuit), les Grignotes, l'affichage du panneau « Tests » et des infos techniques pendant les parties (décoché par défaut : les enfants ne les voient pas), on suit la progression de chacun, on efface un monde, on **exporte** tout dans un fichier (`cubes-sauvegarde-AAAA-MM-JJ.json`, dans les téléchargements) et on l'**importe** (sur ce convertible ou un autre appareil). Exporter avant chaque nouvelle version du jeu. La section « Sauvegarde » donne la **date du dernier export** ; un **rappel**, avec un bouton « Exporter maintenant », s'affiche en tête du mode parent quand des mondes existent et n'ont jamais été exportés, ou plus de 7 jours après le dernier export, ou quand la date est incertaine (rien sur l'écran des enfants). Une date d'export de plus d'un jour dans le futur (horloge de l'ordinateur en avance pendant l'export, puis remise à l'heure) s'affiche « date incertaine » et garde le rappel jusqu'au prochain export. La date est retenue dans ce navigateur (`cubes:dernier-export`) au moment où le jeu lance le téléchargement ; un import retient la date du fichier si elle est plus récente. Juste après le passage de la 1.0-rc à la 1.1-rc, le mode parent dit « jamais » : la 1.0-rc ne gardait aucune trace des exports. Ouvrir le jeu avec `#monde=…&graine=…` dans l'adresse saute l'accueil et n'enregistre rien (tests) ; `&mission=0` y ajoute Pixel et le tutoriel, `&mission=1` la mission 1, `&mission=2` la mission 2, `&lecture=autonome` (ou `debutant`) le niveau de lecture, `&creatures=1` les Grignotes.

### Pixel, les Grignotes et la nuit (J5)

**Pixel**, le renard, trottine devant l'enfant et lit la mission en cours dans le bandeau en haut de l'écran (bouton **haut-parleur** pour la réentendre) ; l'avancement s'affiche (« 3 / 6 »). Casser une **pierre brillante** (cristaux bleus, en surface) donne une **lampe**. Un tronc ne donne plus qu'un tronc : la **clôture** se fabrique (2 planches, voir « Fabrication et verre »).

Les **Grignotes** sont de petites boules à poils colorées. Le jour, elles restent loin. Vers 17 h 30 (en jeu), un carillon annonce la nuit : elles s'approchent et, au contact, en chipent un bloc du sac (jamais la lampe, le cadeau ni le bloc que Pixel demande à l'étape en cours), puis s'enfuient en riant (jamais de dégâts). Elles fuient la lumière d'une **lampe** (à 6 blocs) et ne passent pas une **clôture**. Le bouton **Bulles** (touche **B** sur PC) les fait fuir ; touchée par une bulle, une Grignote rend le bloc qu'elle avait chipé. Le mode parent peut les désactiver.

**Lampe à découvrir** (V2) : tant que la mission 1 n'est pas finie dans ce monde (tutoriel compris), aucun message ne dit que la lampe éloigne les Grignotes : le signal de la nuit annonce seulement leur arrivée, et « Elles fuient la lampe ! » n'est dit qu'à la dernière étape, quand l'enfant le voit. Sans mission, une fois la mission 1 finie et pendant la mission 2, le signal rappelle la lampe au lecteur autonome.

**Soir retenu à 17 h** (V2) : pendant le tutoriel, les trois premières étapes de la mission 1 (troncs, pierres, abri) et toute la mission 2, l'heure du jeu s'arrête à 17 h, et la nuit attend. « Temps ×20 » du panneau Tests s'y arrête aussi ; les boutons **Soir** et **Nuit** du panneau passent outre (pour les vérifications). Un monde repris entre 17 h et 18 h reste à son heure.

### Tutoriel, mission 1 et félicitations (J6, complétés en V2)

Dans un nouveau monde, Pixel commence par le **tutoriel** : marcher (le rond au doigt, **Z** au clavier), casser un bloc, le poser. Il n'est fait qu'une fois par enfant : ses mondes suivants commencent directement à la mission 1 (le mode parent indique « tutoriel fait »).

**Mission 1, « Construis un abri avant la nuit »** : ramasser 6 troncs, puis 4 pierres ; construire un **abri** et entrer dedans ; trouver une pierre brillante (elle donne une lampe) ; poser la lampe près de l'abri ; rester près de la lampe : le temps file jusqu'à la nuit, et l'on voit les Grignotes s'enfuir devant la lumière. Un abri, pour le jeu : un bloc plein (le verre compte) au-dessus de la tête (jusqu'à 4 blocs plus haut), des murs dans au moins trois directions (à 4 blocs au plus, à hauteur des pieds ou de la tête : la porte peut rester ouverte), et au moins un bloc posé par l'enfant (un terrier creusé dans une colline compte aussi ; un sous-bois naturel, non). Pendant cette étape, un petit dessin de maison dans le bandeau s'allume partie par partie (toit, murs) quand l'enfant est dedans, et Pixel dit ce qui manque. Astuce pour le toit : avec des murs de trois blocs de haut, on le pose depuis l'intérieur en visant le haut du mur.

À la fin, un **écran de félicitations** (prénom, ce qui a été réuni, confettis) et un **cadeau** : 5 blocs arc-en-ciel. Si le sac est plein, le cadeau attend qu'une case se libère (« Vide une case du sac ! » : un appui long sur une case suffit). Chaque mission réussie donne une **étoile** au monde, à l'accueil (deux après la mission 2) ; le mode parent affiche la progression de chaque monde. Rien ne bloque : sans nuit (réglage « pas de nuit ») ou sans Grignotes, la dernière étape se valide seule.

Après l'écran, la **mission 2** commence, mais seulement de jour (de 6 h 30 à 16 h 30, heure du jeu) : la mission 1 finit le plus souvent la nuit ; Pixel dit alors qu'on écrira demain, et le temps file (×30, sans carillon) jusqu'au matin. Un monde dont la mission 1 était finie avec la 1.0-rc passe à la mission 2 (au matin s'il est repris le soir ou la nuit), en gardant son étoile.

### Le sac

Chaque bloc cassé est ramassé : il rejoint la case de son type dans la barre du bas (9 cases, 99 blocs au plus par case), et son nombre s'affiche. Poser un bloc en retire un. Le jeu annonce le compte (« 3 pierres ! ») à l'écran ; pour le lecteur débutant, la voix le lit au premier bloc de chaque sorte puis tous les 5 blocs (5, 10, 15…), pour ne pas se répéter. Planches, clôtures et verre ne se trouvent pas dans la nature : ils **se fabriquent** (ci-dessous).

**Vider une case** (V2) : garder le doigt sur une case, le clic dessus (souris libre, pas capturée) ou la touche **1 à 9** enfoncée pendant **une seconde**. Un anneau se remplit au-dessus de la case (il n'apparaît qu'après 0,2 s : un simple toucher choisit la case sans rien montrer), puis la case est vidée avec un « pouf » : ces blocs sont jetés. Un doigt ou une souris qui glisse de plus de 18 px, un relâchement, la molette ou une autre case annulent. Si Windows interrompt le toucher après au moins 0,9 s, la case est vidée quand même. La **lampe**, le **cadeau** (arc-en-ciel) et le bloc que Pixel demande à l'étape en cours (« Garde tes troncs ! ») ne se vident jamais : pas d'anneau, et le jeu le dit. Sac plein, le jeu conseille la case à vider (la plus petite pile qu'on a le droit de vider), qui palpite.

Le bouton **Compléter le sac** du panneau « Tests » (réservé à l'adulte) complète jusqu'à 20 blocs de chaque sorte du kit, dans la limite des 9 cases (ce qui a été ramassé reste ; « Vider le sac » d'abord pour avoir tout le kit). Le panneau règle aussi le niveau de lecture (débutant : messages courts lus à voix haute ; autonome : phrases complètes, voix coupée), la voix et les sons.

### Fabrication et verre (V2 lot 1)

Le **marteau** (bouton rond en haut à droite, à côté de Bulles ; bouton orange dans la colonne tactile ; touche **F**) ouvre un panneau de trois cartes ; le jeu est en pause pendant ce temps. Une carte touchée (ou cliquée) fabrique **une fois** :

| Carte | Il faut | On obtient |
|---|---|---|
| Planches | 1 tronc | 2 planches |
| Clôture | 2 planches | 1 clôture |
| Verre | 1 bloc de sable | 2 blocs de verre |

Le lecteur débutant voit l'addition (« 2 + 2 = 4 planches ! », jusqu'à 10), dite en lettres ; le lecteur autonome lit une phrase complète. Une carte qu'on ne peut pas faire tremble et dit pourquoi : il manque l'ingrédient (avec la carte qui le fabrique, ou l'endroit où le trouver) ; 99 au plus ; sac plein (la case à vider remue) ; pendant l'étape « 6 troncs », les troncs demandés par Pixel sont gardés. Le dernier tronc d'une case se change en planches dans sa propre case, même sac plein. Si aucune carte n'est possible parce que le sac est plein, le panneau le dit dès l'ouverture et la case à vider remue ; panneau ouvert, l'appui long sur une case (doigt, clic, touche 1 à 9) reste actif. Le panneau se ferme par la croix, le voile, **F** ou **Échap**. La carte n'est active que 0,4 s après l'ouverture, et deux fabrications sont espacées d'au moins 0,25 s (un doigt gardé sur la carte ne fabrique qu'une fois).

Le marteau est caché au tutoriel. Dans une partie d'enfant, il apparaît à l'étape **abri** de la mission 1 : Pixel le présente (au moins 15 s après le début de l'étape, s'il y a de quoi fabriquer) et il brille jusqu'à la première ouverture. Ensuite, il est là dans tous les mondes de cet enfant (`craftSeen` dans son profil). Il est aussi là dans tout monde dont l'abri de la mission 1 est passé, même si l'enfant ne l'a jamais ouvert ni vu présenter (monde de la 1.0-rc, présentation manquée) : il y brille jusqu'à la première ouverture, sans que Pixel interrompe la mission en cours pour le présenter. En mode adresse, il est toujours là, sauf avec `&mission=0`.

Le **verre** est un bloc plein et transparent : on voit à travers, on ne passe pas, il arrête les Grignotes et compte pour l'abri. Il se casse vite (0,3 s) et revient dans le sac. Une fleur peut se poser dessus. La première vitre posée fait dire « On voit à travers ! » (une fois par ouverture du jeu).

### Mission 2, « Les mots » (V2 lot 1)

Dès la mission 2, une 10e case **ABC**, au bout de la barre (touche **0**), ouvre une **boîte de 26 lettres**, en nombre illimité ; le jeu est en pause pendant ce temps. Poser avec la case ABC choisie mais sans lettre en main l'ouvre aussi. La lettre choisie va dans la main (si la voix est active, elle dit son nom : « emme », et non « mmm ») ; elle se pose comme un bloc (clic droit, ou mode Poser au doigt) et se casse en 0,2 s sans rien rapporter. Les lettres ne sont jamais dans le sac : un sac plein ne gêne pas, les Grignotes ne les prennent pas. Au clavier, boîte ouverte, taper une lettre la choisit ; **0** ou **Échap** la ferment.

Étapes : poser une lettre, écrire trois mots, puis son **prénom** (sans accent : LEA pour Léa). Le jeu lit le mot dans le monde, dans toute rangée de lettres côte à côte (à n'importe quelle hauteur) ou dans une colonne (de haut en bas). Un mot écrit à l'envers pour l'enfant est validé (« Fais le tour pour lire ! »), de même qu'un mot collé à un autre, d'un côté ou de l'autre (« Un espace entre les mots ! »). Un mot déjà lisible au début d'une étape d'écriture (le prénom écrit plus tôt) la valide tout de suite.

- **Lecteur débutant** (copie) : le mot est montré en lettres dans le bandeau de Pixel, avec ses syllabes, et des **cases claires** dans le monde montrent où poser : toujours à portée, là où l'enfant peut poser sans bouger, jamais derrière un mot déjà écrit ni derrière un mur (sinon pas de cases claires : Pixel dit la lettre suivante, et elles apparaissent quand l'enfant tourne la tête ou se déplace). Sans progrès, l'aide monte toute seule : la lettre suivante entourée et montrée dans le monde, « Maintenant, la lettre N ! », toute la ligne de cases claires, puis la lettre mise dans la main (« Voici la lettre N ! »). Une lettre fausse est signalée (« Ici, il faut un … ») et entourée en orange, y compris dans une case claire avant la première lettre juste.
- **Lecteur autonome** (dictée) : le mot est **dit, pas écrit** (mot, phrase d'exemple, mot), et lu à voix haute **même si la voix est coupée** (seulement les mots dictés et leurs indices). Toutes les 30 s sans progrès, ou à chaque essai, un indice de plus : le nombre de lettres, la première lettre, une lettre de plus… jusqu'au mot entier, qui fait passer en copie. Sans voix française, la dictée devient une copie ; un prénom à accents se recopie aussi.

On n'échoue jamais. À la fin : écran de félicitations (chaque mot écrit, en lettres-blocs), un cadeau de 5 blocs arc-en-ciel et une deuxième étoile. La case ABC reste ensuite, pour écrire où l'on veut. Le mode parent liste les mots écrits de chaque monde ; un mot déjà écrit dans un autre monde du même enfant n'est pas redonné.

### Pour l'adulte : panneau « Tests » et adresse

Les enfants choisissent leur monde à l'accueil (J4). Le panneau **Tests** (en haut à droite, visible en mode adresse, ou dans les parties des enfants si le mode parent l'autorise) sert aux vérifications : type de monde et graine (même type + même graine = le même monde ; « Nouveau monde » est refusé pendant la partie d'un enfant pour ne pas écraser son monde), heure (matin, midi, soir, nuit, temps accéléré ; « Temps ×20 » s'arrête au soir retenu, « Soir » et « Nuit » passent outre), distance de rendu (96 blocs par défaut, choix retenu d'une ouverture à l'autre), niveau de lecture, voix, sons, « Compléter le sac » et diagnostic. Ouvrir le jeu avec une adresse du type `cubes.html#monde=ile&graine=1234` saute l'accueil et n'enregistre rien ; on peut y ajouter `&heure=20`, `&distance=48`, `&mission=0`, `&mission=1` ou `&mission=2` (la mission 2 démarre alors tout de suite, même la nuit), `&lecture=debutant` ou `&lecture=autonome`, `&creatures=1`.

### Mettre le fichier sur le convertible (appareil des enfants)

L'appareil « tablette » est un ordinateur convertible Windows 10 (Acer Nitro 5 Spin NP515-51), utilisé replié, avec **Firefox**. Il n'y a pas de tablette Android.

Copier `dist/cubes.html` dans un dossier fixe du convertible (par exemple `Documents\Cubes`), par clé USB ou un cloud **personnel** (pas l'OneDrive ECOME, qui mettrait un compte professionnel sur l'appareil familial). L'ouvrir avec Firefox (clic droit → « Ouvrir avec » → Firefox) ; un raccourci sur le bureau vers ce fichier, ouvert par Firefox, évite que Windows le donne à Edge.

À chaque nouvelle version, **remplacer le fichier au même endroit, sous le même nom** (`cubes.html`, pas `cubes(1).html`). Sous Firefox, le stockage local d'un fichier ouvert en local serait lié à son chemin exact (non vérifié) : à partir du J4, une copie ailleurs ou renommée ne retrouverait pas les mondes des enfants.

**Passage à la 1.1-rc** : exporter d'abord (mode parent → Exporter), puis remplacer le fichier. Ne plus rouvrir ensuite ces mondes avec l'ancienne 1.0-rc : elle ne connaît ni le verre, ni les lettres, ni la mission 2. Pour un monde qui contient du verre ou des lettres, elle mettrait l'enregistrement de côté (copie de secours), repartirait du monde d'origine et préviendrait l'adulte ; un monde en mission 2 repartirait à la mission 1 (lu dans le code de la 1.0-rc, non essayé).

Conseils pour le mode tablette : lancer le **plein écran** (petit bouton carré à droite) pour que la barre des tâches et les onglets de Firefox ne soient pas sous les doigts ; si l'image tourne quand on penche l'appareil, activer le verrouillage de la rotation de Windows (Centre de notifications). `npm run preview` (servir `dist/` sur le wifi de la maison) reste possible mais n'a plus d'usage prévu.

## Développer

Prérequis : Node.js 22.12 ou plus récent (`node -v` pour vérifier).

```
npm install                       # une fois
npm run dev                       # développement avec rechargement automatique
npm run build                     # vérifie les types puis produit dist/cubes.html
npm test                          # tests unitaires (moteur, terrain, joueur, maillage, sac, casse, fabrication, mots, sons, textes, souris, voix)
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
- `docs/PLAN.md` — architecture, jalons J0 à J8, risques, backlog V2.
- `docs/RECETTE-V1.md` — recette technique de la V1 et décisions prises.
- `docs/V2-LOT1.md` — conception du lot 1 de la V2 (J8) et décisions de Pierre.
- `docs/JOURNAL.md` — avancement session par session.
- `docs/AUDIT-J0.md` — audit du J0 et suivi des corrections.
- `docs/RETOURS.md` — protocole de test et retours (Pierre et les enfants).
- `CLAUDE.md` — conventions pour le travail avec Claude (Cowork ou Claude Code).
