# Brief — « Cubes » (nom provisoire)

Jeu de construction en blocs, éducatif, pour deux enfants.
Brief validé par Pierre le 23 septembre 2026. Document de référence du projet : toute évolution du périmètre passe par une mise à jour de ce fichier.

## Objectif

Un jeu inspiré de Minecraft, en 3D à base de blocs, jouable dans un navigateur sur les appareils de la famille, sans serveur ni connexion internet, dans lequel les enfants apprennent en jouant.

Nom provisoire « Cubes » ; les enfants choisiront le nom définitif. Ni le nom Minecraft, ni ses textures, ni ses personnages ne sont repris : univers et graphismes originaux (textures pixel-art générées par le jeu lui-même).

## Joueurs

Deux enfants, deux profils, chacun avec sa sauvegarde et son réglage de lecture.

Profil A — 7 ans, lecteur débutant (déchiffre) : consignes courtes, toujours lues à voix haute par le jeu, texte affiché pour l'entraînement, icônes partout.

Profil B — lecteur autonome (âge et niveau scolaire à préciser) : consignes écrites, voix en option.

Les deux connaissent Minecraft de vue : on garde les codes visuels (blocs, inventaire en bas d'écran, casser/poser), on simplifie librement les mécaniques.

Un « mode parent », d'accès discret, permet de régler la difficulté et de consulter la progression de chacun.

## Expérience de jeu

Monde en blocs de taille limitée (pas d'infini), vue à la première personne, cycle jour/nuit. Aucune mort possible.

Les « petits ennuis » sont des créatures rigolotes non violentes : elles chipent un objet, bloquent un passage, s'éloignent d'une lampe ou d'une clôture. On ne combat jamais.

Un compagnon-guide (petit robot ou animal) donne les missions, lit les consignes, félicite.

Sauvegarde automatique dans le navigateur, plus export/import d'un fichier de sauvegarde pour ne rien perdre.

## Pédagogie

Quatre domaines, ancrés dans le programme de cycle 2 (CP-CE2), toujours « en faisant », jamais sous forme de quiz plaqué :

- Lecture et écriture : consignes, panneaux, mots à composer avec des blocs-lettres.
- Mathématiques : compter les blocs, additions dans les recettes, formes et symétrie des constructions.
- Sciences et nature : matériaux, eau, plantes, chaleur (construire une maison qui garde la chaleur la nuit).
- Logique et programmation : donner une suite d'ordres au compagnon, mécanismes simples.

Chaque mission mobilise un ou deux domaines et s'adapte au profil (aide vocale, longueur des phrases, taille des nombres).

## Périmètre de la V1

Bac à sable complet : se déplacer, casser et poser une dizaine de types de blocs, inventaire simple, sauvegarde, deux profils.

Mission 1 — « Construis un abri avant la nuit » : le compagnon lit la consigne (lecture), il faut rassembler 6 bois et 4 pierres (comptage), les créatures rigolotes arrivent la nuit et on découvre que la lampe les éloigne (logique).

Hors V1 : multijoueur, craft complexe, survie/faim, monstres violents, monde infini, missions 2 à n.

## Plateformes et contrôles

PC Windows : clavier ZQSD + souris.
Tablette Android (Chrome) : joystick virtuel à gauche, regard au doigt à droite, gros boutons.
Un seul et même fichier de jeu pour les deux ; l'interface détecte le tactile.

## Contraintes techniques

- Projet web standard (TypeScript, modules, Three.js, Vite) rangé dans le dossier `Minecraft`, utilisable depuis Cowork comme depuis Claude Code sur le poste de Pierre.
- Livraison : un seul fichier HTML autonome (`dist/cubes.html`) à double-cliquer, fonctionnant hors ligne. Tout est embarqué (moteur 3D, textures, sons) : un fichier ouvert en local ne peut charger ni modules ni ressources externes.
- Développement et tests côté cloud (Cowork), dépôt des fichiers dans le dossier ; le shell local Cowork du poste est hors service depuis la mise à jour Windows de début septembre 2026.

## Critères de réussite de la V1

1. L'enfant de 7 ans lance le jeu et joue 15 minutes seul.
2. Il comprend et termine la mission 1 sans aide d'un adulte.
3. Le jeu tourne de façon fluide sur la tablette.
4. Les deux profils retrouvent leur monde à la partie suivante.

## Points ouverts et éléments non vérifiés

- Âge et niveau scolaire du second enfant.
- Présence de voix françaises de synthèse sur le PC et sur la tablette : à tester en tout début de projet (repli : sons et icônes).
- Présence et version de Node.js sur le poste (nécessaire pour Vite / Claude Code) : non vérifiée.
- Capture souris (Pointer Lock) dans un fichier ouvert par double-clic, et performances 3D de la tablette (modèle inconnu) : à valider par le prototype technique du jalon J0.
