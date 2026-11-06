# Retours de test

Un bloc par séance de test. Noter l'appareil, qui a testé, ce qui a marché, ce qui a coincé, et les idées. Les enfants ont toujours raison sur ce qui est amusant ou frustrant.

Appareils (précisés le 24/09/2026) : la colonne « Tablette Android » des protocoles J0.1 à J2 désigne en fait le **convertible Acer Nitro 5 Spin NP515-51 replié en mode tablette, sous Firefox** ; il n'y a pas de tablette Android. À partir du J2.1, les colonnes sont « PC » et « Convertible (mode tablette, Firefox) ».

## Protocole J8 / V2 lot 1 (version 1.1-rc2)

Fiche imprimable de ce protocole, à remplir sur place : `docs/FICHE-SEANCE.html` (A4, deux pages : avant la séance, Pierre seul ; puis la séance avec les enfants), à recopier ensuite ici dans « Séance du … — J8 ».

Sur le convertible replié, Firefox. **Avant** : avec l'ancien fichier (1.0-rc ou 1.1-rc), mode parent → **Exporter** ; puis remplacer `cubes.html` au même endroit, sous le même nom. Ligne d'infos (mode parent → « Afficher le panneau Tests et les infos techniques », ou en mode adresse) terminée par « 1.1-rc2 » (suivie de « appui 0,8 s » ou « appui 1,2 s » si l'appui long n'est pas réglé à 1 s). Si l'ancien fichier était la 1.0-rc, le mode parent dit juste après « Dernier export : jamais. » : c'est normal (la 1.0-rc ne gardait pas cette date). **Ne plus rouvrir l'ancien fichier** : la 1.1-rc relit les mondes de la 1.1-rc2 mais efface à son prochain enregistrement le temps par mot et le réglage d'appui (vérifié sur son code, non essayé). **Ne jamais rouvrir ces mondes avec la 1.0-rc** : elle ne connaît ni le verre, ni les lettres, ni la mission 2 (un monde qui en contient serait mis de côté en copie de secours et régénéré ; un monde en mission 2 repartirait à la mission 1).

Ce que Chromium a vérifié côté cloud (tests de fumée) n'est pas repris ici, sauf quand Firefox, Windows, la voix ou la vraie carte graphique peuvent changer le résultat. Colonne « Convertible » : oui / non, et ce qu'on a vu.

**Marteau : une découverte par profil.** Ouvrir le marteau (panneau de fabrication) dans une partie d'enfant le retient pour ce profil, dans tous ses mondes : il ne brille plus, Pixel ne le présente plus, et le mode parent ne permet pas de l'oublier. Pour garder la découverte aux enfants : faire les essais du panneau (lignes « Sac » et « Fabrication et verre » qui l'ouvrent) **en mode adresse**, qui n'enregistre rien et où le marteau est toujours là (`cubes.html#monde=prairie&graine=1&mission=1&lecture=debutant` ajouté au chemin du fichier dans la barre d'adresse ; `&lecture=autonome` pour l'autre niveau), ou dans un seul profil, en sachant que l'observation de la séance ne vaudra alors que pour l'autre enfant. La ligne « nouveau monde : pas de marteau avant l'étape abri » ne vaut que pour un profil qui n'a jamais ouvert le marteau : la faire avant toute ouverture dans ce profil. Si le marteau a déjà été ouvert dans le profil d'un enfant : réimporter, avant la séance, l'export fait à l'étape « Avant » (1.0-rc, sans marteau découvert) ; tout est remplacé par l'état d'avant la mise à jour.

### Sac : vider une case

| Vérification | Convertible |
|---|---|
| Mode parent : la section « Appui long pour vider une case » est sur « 1 s (par défaut) » ; les choix sont 0,8 s, 1 s et 1,2 s | |
| Sac bien rempli, réglage à 1 s : garder le doigt **une seconde** sur une case. Un anneau se remplit **au-dessus** de la case (visible malgré le doigt), puis « pouf » : la case est vidée. Noter : menu contextuel de Firefox ? Si Windows montre son carré de clic droit ou interrompt le geste vers 1 s, la case doit **quand même se vider** (parade faite après la revue : un toucher annulé à 0,1 s de la fin ou plus tard, soit après 0,9 s au réglage de 1 s, compte comme un appui allé au bout, que la fenêtre perde le focus avant ou après l'annulation) ; si elle se vide avant la fin de l'anneau, le noter | |
| **Si la case ne se vide pas, ou mal, à 1 s** : ouvrir `cubes.html#monde=plat&graine=1&appui=800` (mode adresse, rien n'est enregistré ; `&appui` n'agit qu'avec `monde=` ou `graine=` dans l'adresse, sinon il est ignoré sans message) ; la ligne d'infos finit par « appui 0,8 s » ; refaire l'essai (seuil d'annulation : 0,7 s). Appuyer sur **F5** : la ligne d'infos dit toujours « appui 0,8 s » (non vérifié sous Firefox en `file://`). Si c'est mieux : mode parent → « 0,8 s » → enregistrer ; le réglage vaut à partir de la partie suivante. Le relire en rouvrant le mode parent : dans une partie d'enfant, la ligne d'infos n'est visible qu'avec « Tests » coché, et les enfants la voient alors aussi. **Noter la durée retenue pour la séance** | |
| Toucher bref sur une case : elle est choisie, aucun anneau ; doigt qui glisse le long de la barre : rien n'est vidé | |
| Lampe et blocs arc-en-ciel : pas d'anneau, le jeu dit de les garder (« Garde ta lampe ! ») ; pendant l'étape « 6 troncs », les troncs ne se vident pas (« Garde tes troncs ! ») | |
| Sac plein : le jeu conseille une case à vider, qui palpite | |
| Déplié, clavier : garder la touche **3** la durée réglée (une seconde par défaut) vide la case 3 ; la relâcher avant ne vide rien ; de même panneau de fabrication ouvert (la ligne d'état du panneau le dit ; en mode adresse, voir « Marteau » plus haut). Souris non capturée : garder le clic la même durée sur une case la vide | |

### Fabrication et verre

| Vérification | Convertible |
|---|---|
| Partie d'enfant, nouveau monde, **profil qui n'a jamais ouvert le marteau** : pas de marteau avant l'étape abri ; à l'étape abri, Pixel le présente (après au moins 15 s) et il brille (rond du haut et bouton orange de la colonne, sous le plein écran) | |
| Les lignes suivantes en mode adresse (voir « Marteau » plus haut). Toucher le marteau : panneau de trois cartes ; toucher « Planches » : 1 tronc → 2 planches ; au deuxième tronc, le débutant voit « 2 + 2 = 4 planches ! » (et l'entend) | |
| Garder le doigt sur une carte : **une seule** fabrication, pas de menu contextuel ; glisser le doigt sur le panneau : la vue ne tourne pas ; le voile ou la croix ferment ; rien n'a été cassé ni posé derrière | |
| 2 planches → 1 clôture ; 1 sable → 2 verres. Carte impossible : elle tremble et le panneau dit pourquoi ; panneau ouvert sac plein, sans aucune carte possible : « Sac plein : vide une case ! » et la case à vider remue | |
| Panneau ouvert, appui long sur une case : l'anneau se voit **entre la barre et la feuille**, sans masquer la consigne du panneau ; la case est vidée | |
| Appareil tenu à deux mains, le **pouce posé sur le bord de l'écran** (sur le voile) pendant qu'un doigt de l'autre main touche une carte : la carte fabrique, rien ne se ferme au lever du pouce. Même essai avec une paume posée d'abord sur le voile, puis avec le doigt gardé une seconde sur une **case de la barre** (pouce posé avant ou après) : la case se vide, le panneau reste ouvert | |
| **Double toucher** rapide sur la croix du panneau, un bloc en main en mode Poser : le panneau se ferme, rien n'est posé derrière ; un toucher une demi-seconde plus tard pose | |
| Déplié : **F** ouvre et ferme ; **Échap en plein écran** : noter si Firefox quitte d'abord le plein écran, et si le panneau se ferme ; après fermeture, un clic recapture la souris (« Clique pour jouer ») ; ce message ne vient que si l'écran n'a pas été touché depuis l'ouverture de la page : après les essais au doigt, recharger la page (F5) une fois l'appareil déplié | |
| Verre posé, **de jour puis de nuit** : on voit à travers, on ne passe pas ; « On voit à travers ! » à la première vitre | |
| **Aquarium** (bassin d'eau entouré de verre) et **maison de verre** (murs et toit) : rien ne disparaît selon l'angle ; vue de dehors ou d'au-dessus, la vitre du fond et un verre posé au fond de l'eau sont teintés par l'eau ; vues de l'intérieur sous l'eau, les vitres restent nettes ; noter les défauts (vitres qui en cachent d'autres, halo de lampe ou bulles teintés derrière une vitre, bulle ou halo devant une vitre dessiné derrière son cadre) | |
| Images par seconde (ligne d'infos) en regardant à travers plusieurs vitres, de près et de loin | |

### Mission 2 « Les mots » (avec chaque enfant)

| Vérification | Convertible |
|---|---|
| Mission 1 finie (souvent la nuit) : après « Continuer », Pixel dit qu'on écrira demain ; le temps file jusqu'au matin, sans carillon ; la mission 2 commence au matin | |
| Case **ABC** au bout de la barre : la toucher ouvre la boîte. **Portrait puis paysage** : les 26 lettres tiennent dans l'écran, sans défilement, assez grosses pour le doigt | |
| Choisir une lettre : si la voix du profil est active (par défaut : oui pour le débutant, non pour l'autonome), elle dit son **nom** (« emme », « erre ») ; la lettre est en main (mode Poser) ; elle se pose sous la croix | |
| Boîte ouverte, appareil tenu à deux mains : le **pouce posé sur le voile** pendant qu'un doigt touche une lettre : la lettre est choisie, la boîte ne se ferme pas au lever du pouce. Après un geste de Windows (balayage depuis un bord, puis retour au jeu), la boîte répond toujours au doigt. **Double toucher** rapide sur une lettre : elle est choisie, et rien n'est posé derrière ; un toucher une demi-seconde plus tard la pose | |
| Débutant : le mot est montré dans le bandeau (syllabes) ; des **cases claires** dans le monde, à quelle distance (prévu : 3 à 6 blocs, toujours posables sans bouger). Au **mot 1**, toute la ligne dès la consigne ; aux **mots 2 et 3 et au prénom**, rien d'abord : la case de la lettre suivante après 15 s sans rien poser, « Maintenant, la lettre … ! » à 25 s, toute la ligne à 30 s, la lettre dans la main vers 50 s | |
| Débutant, au doigt : la lettre posée tombe-t-elle bien **dans la case visée** ? Une mauvaise lettre dans la première case claire : « Ici, il faut un … », contour orange, et la ligne ne bouge pas | |
| Trois mots écrits de suite **sans bouger** (aux mots 2 et 3, attendre 30 s sans rien poser pour voir la ligne) : chaque mot a sa ligne, lisible, jamais derrière le mot d'avant ; s'il n'y a de place pour aucune ligne là où il regarde, Pixel dit la lettre suivante à 25 s, puis « Tourne-toi vers un sol plat ! » à 30 s, et en tournant la tête des cases claires apparaissent | |
| Prénom long (8 lettres ou plus), regard droit devant sur un sol plat : à 15 s, la case de la première lettre est à gauche, hors de l'écran ou à son bord ; à 30 s, la ligne traverse l'écran ; l'enfant trouve-t-il la première case ? | |
| Écrire son prénom pendant les mots 1 à 3 : l'étape « prénom » est validée dès son début | |
| Autonome : le mot est **dicté, pas écrit**, et lu **même voix coupée** (mots dictés et indices seulement) ; les mots sont-ils compris avec la voix du convertible ? un indice de plus toutes les 30 s ou à chaque essai | |
| Prénom (étape 4) : écrit sans accent ; pour un prénom à accents, copie du prénom en capitales | |
| **Lisibilité des lettres** posées, à 5, 15 et 30 blocs, de jour et le soir (17 h) | |
| **Barre à 10 cases en portrait** : la case ABC, le rond et les boutons ne se chevauchent pas ; la touche « 0 » se lit ; la lettre tenue se voit dans la case ABC | |
| **Durée réelle de la mission 2** à la montre, début et fin, pour chaque enfant (heure de la première lettre, heure des félicitations). Le **temps par mot** n'est plus à chronométrer : le jeu le relève (voir « Temps par mot » ci-dessous) | |
| **Temps par mot lisible dans le mode parent**, en portrait : après la mission 2, « Qui joue ? » → engrenage (3 s) → mode parent → « Progression » → sous le prénom, « Monde N, temps par mot (jeu actif) : » ; une ligne par mot, puis la durée de la mission 2 ; valeurs plausibles par rapport à la montre ; les lignes tiennent dans l'écran sans déborder. Sortir par « Fermer sans enregistrer » | |
| Félicitations : chaque mot écrit en lettres-blocs, cadeau ; accueil : deux étoiles ; mode parent : « mots écrits : … » | |

**Temps par mot : ce que disent les chiffres** (relevé par le jeu depuis la 1.1-rc2 ; aussi dans le fichier exporté, champ `mission.wordStats`).
- **Jeu actif** : compté tant que la partie est affichée (onglet visible), boîte à lettres ouverte comprise, et y compris le temps où l'enfant ne fait rien ; non compté : panneau de fabrication, félicitations, accueil, chargement d'un monde ; une image compte 250 ms au plus. La durée au mur (pauses comprises) n'est pas relevée : la noter à la montre.
- **Durée d'un mot** : de la consigne dite au mot trouvé. **Durée de la mission 2** : de la première **consigne d'écriture** (mot 1) aux félicitations, pas de la première lettre posée à l'étape 0.
- **Essai non réussi** : un message de correction du jeu ; un même essai faux peut en donner plusieurs, et « De gauche à droite ! » est redit et recompté toutes les 15 s tant que le mot reste à l'envers.
- **Aides** : case = case claire suivante ; ligne = ligne de cases claires ; lettre dite = lettre suivante dite ; sol plat = conseil de se tourner vers un sol plat ; lettre donnée = lettre mise dans la main ; cases du mot, 1re lettre, lettre dévoilée = indices de la dictée ; passé en copie = mot entier dévoilé, ou plus de voix ; comment casser = conseil pour casser une lettre fausse. La ligne montrée d'emblée au mot 1 en copie n'est pas une aide.
- Un prénom déjà écrit avant sa consigne s'affiche « 0 s, sans aide ». « X : non relevé (écrit avec une version du jeu sans ce relevé) » et une durée « partielle » : le monde est passé par la 1.1-rc. « X (copie, remplacé par un autre mot avant d'être écrit) » : niveau de lecture ou prénom changé en cours de mot.
- Non vérifié sous Firefox : onglet masqué, cadence des images du convertible ; comparer à la montre.

### Soir retenu, lampe, mode parent

| Vérification | Convertible |
|---|---|
| Mission 1 (avant l'abri), panneau Tests visible : l'heure s'arrête à 17 h, « Temps ×20 » compris ; une fois l'abri fait, le temps reprend, carillon vers 17 h 30 puis nuit | |
| Profil autonome, avant la fin de la mission 1 : le signal de la nuit ne parle pas de la lampe ; à la dernière étape, l'enfant découvre seul que les Grignotes fuient la lampe | |
| Écran « Qui joue ? » : plus aucun texte sous l'engrenage ; 3 s de doigt l'ouvrent toujours | |
| Mode parent : rappel en tête (« Rappel : les mondes des enfants n'ont encore jamais été exportés. ») et « Exporter maintenant », et dans la section Sauvegarde « Dernier export : jamais. » ; après un **vrai téléchargement** (fichier dans Téléchargements), la date devient « aujourd'hui » et le rappel disparaît ; fermer puis rouvrir le jeu : la date est gardée | |
| Importer ce fichier : tout est remplacé, la date reste | |

### Séance enfants J8

Profil 6 ans d'abord, seul, sur un monde dont la mission 1 est finie (ou un nouveau monde : la mission 1 puis la mission 2). Noter chaque appel à l'aide et sa raison. À observer : vide-t-il des cases sans le vouloir (appui long) ? Trouve-t-il le marteau (dans un monde dont la mission 1 est finie, il brille, mais Pixel n'en parle pas : le trouve-t-il seul ? seulement si son profil n'a jamais ouvert le marteau, voir « Marteau » plus haut), comprend-il les cartes et l'addition ? Que fait-il du verre ? Comprend-il la case ABC et la boîte ? Recopie-t-il le mot avec les cases claires ? (Le temps par mot est relevé par le jeu : le recopier depuis le mode parent après la séance.) Puis le profil 8 ans : la dictée est-elle comprise, trop facile, trop longue ? Les deux : la mission 2 les amuse-t-elle ?

## Séance du … — J8

Appareil : convertible, Firefox, portrait / paysage
Testeurs :

Ce qui marche :

Ce qui coince :

Durée retenue pour l'appui long (0,8 / 1 / 1,2 s) :

Temps de la mission 2 (par enfant : à la montre ; par mot : lignes « temps par mot » du mode parent) :

Idées des enfants :

## Protocole de recette V1 (J7, version 1.0-rc)

Sur le convertible replié, Firefox ; ligne d'infos (mode parent → « Afficher le panneau Tests et les infos techniques ») terminée par « 1.0-rc ». **Exporter les sauvegardes avant** de remplacer le fichier. Pendant les parties des enfants, le panneau Tests et la ligne d'infos sont désormais masqués : les réafficher seulement pour relever un diagnostic.

### Les quatre critères du brief (avec les enfants)

| Critère | Comment l'observer | Résultat |
|---|---|---|
| 1. L'enfant de 6 ans lance le jeu et joue 15 minutes seul | Raccourci sur le bureau → « Qui joue ? » → son prénom → son monde ; chronométrer sans intervenir ; noter chaque appel à l'aide et sa raison | |
| 2. Il comprend et termine la mission 1 sans aide d'un adulte | Nouveau monde, profil débutant ; noter le temps par étape (tutoriel, troncs, pierres, abri, lampe, nuit) et les blocages | |
| 3. Le jeu tourne de façon fluide sur le convertible | Au ressenti ; si doute, mode parent → infos techniques : images/s en marchant, la nuit, près des Grignotes | |
| 4. Les deux profils retrouvent leur monde à la partie suivante | Fermer Firefox, rouvrir le lendemain : chaque enfant retrouve monde, sac, étape de mission, étoile | |

### Vérifications de la 1.0-rc (Pierre)

| Vérification | Convertible |
|---|---|
| Partie d'un enfant : pas de bouton « Tests » ni de ligne d'infos ; les boutons ronds (bulles, maison, œil) sont contre le bord droit | |
| Mode parent → cocher « Afficher le panneau Tests… » → ils réapparaissent dans la partie | |
| Au fond d'un trou de deux blocs, pousser contre la paroi sans sauter : après quelques secondes, « Garde Sauter contre le mur ! » ; le faire : on grimpe | |
| Enfermé dans un abri de 1 × 1 avec toit, pousser contre les murs : « Casse un mur pour sortir ! » | |
| Nager au large : Pixel attend sur la rive (il ne réapparaît pas dans l'eau) | |
| Grand enclos de clôtures (plus de 14 blocs de côté) la nuit : aucune Grignote n'apparaît dedans | |
| Vue à la troisième personne le long d'un mur en escalier, en diagonale : la caméra ne passe pas derrière le mur | |
| Import d'un fichier de sauvegarde : tout est remplacé, ou rien (message d'erreur sans état mélangé) | |

## Séance du 25/09/2026 — J6 (retour de Pierre)

Appareil : non précisé
Testeurs : Pierre

Ce qui marche : scénario complet réalisé en profil « petit » (lecteur débutant) : tutoriel puis mission 1 jusqu'à la fin ; la partie est bien sauvegardée.

Ce qui coince : rien de signalé. Tests complets avec les enfants à venir (après le J7).

## Protocole J6 (tutoriel, mission 1 complète, félicitations)

Sur le convertible replié, Firefox ; ligne d'infos terminée par « J6 ». **Exporter les sauvegardes avant** de remplacer le fichier (mode parent → Exporter). Les protocoles J3 à J5 restent à faire s'ils ne l'ont pas été.

| Vérification | Convertible |
|---|---|
| Nouveau monde d'un enfant qui n'a jamais joué au J6 : Pixel se présente et lance le **tutoriel** ; au doigt, la consigne parle du rond (au clavier, de la touche Z) | |
| Tutoriel : marcher → casser un bloc → le poser (bouton Casser → Poser, puis taper) ; « Bravo, tu sais jouer ! » ; le bouton redevient **Casser** tout seul | |
| La mission 1 suit : 6 troncs (« 0 / 6 »), puis 4 pierres | |
| Étape abri : le petit dessin de maison du bandeau s'allume quand on est entre des murs (un mur par côté fermé) et sous un toit ; debout dans un abri incomplet, Pixel dit ce qui manque (« Il manque le toit ! ») | |
| Construire un vrai abri (murs de 3 blocs, toit posé depuis l'intérieur), entrer dedans : l'étape est validée (« Bravo ! » et un petit air de 4 notes) | |
| Pierre brillante → lampe, poser la lampe près de l'abri | |
| Dernière étape : « Reste près de ta lampe » ; le soleil se couche en quelques secondes ; la nuit, les Grignotes approchent et s'enfuient devant la lampe ; Pixel : « Elles fuient la lampe ! » | |
| Écran de félicitations : « Bravo (prénom) ! », 6 troncs, 4 pierres, un abri, une lampe, cadeau de 5 blocs arc-en-ciel, confettis, voix (lecteur débutant) ; le bouton « Continuer » ne répond qu'après un instant, puis ferme l'écran | |
| Les blocs arc-en-ciel sont dans le sac et se posent ; sac plein à la fin : « Vide une case du sac ! », le cadeau arrive dès qu'une case se libère | |
| Sac plein (9 sortes) : viser une pierre brillante et garder l'appui ne la casse pas ; « Sac plein : vide une case ! » ; après avoir vidé une case, elle se casse et donne sa lampe | |
| Accueil : le monde réussi porte une étoile ; un nouveau monde du même enfant commence directement à la mission 1 (pas de tutoriel) | |
| Mode parent : section « Progression » (tutoriel fait ou non, étape de chaque monde) | |
| Mode parent → nuit « pas de nuit » : la dernière étape se valide quand même (écran de félicitations) | |
| La nuit, près d'une lampe : le halo couvre toute la zone que les Grignotes évitent (6 blocs) sans gêner la vue | |
| Un monde du J5 déjà en cours reprend à son étape (un monde où la mission était finie au J5 reprend à la dernière étape : attendre la nuit près de la lampe) | |

### Séance enfants J6 (test complet de la V1)

Consigne donnée à l'oral : aucune, Pixel s'en charge. Profil 6 ans d'abord, seul, sur un **nouveau monde** ; noter chaque moment où il faut l'aider, et combien de temps prend chaque étape. À observer : le tutoriel suffit-il pour marcher, casser, poser ? Comprend-il ce qu'est un abri et comment faire le toit ? Le dessin de maison l'aide-t-il ? La nuit qui tombe vite le surprend-elle, l'amuse-t-elle ? Comprend-il que la lampe éloigne les Grignotes ? Le cadeau lui plaît-il ? Puis le profil 8 ans (en lisant). Critères du brief : joue 15 minutes seul, termine la mission 1 sans aide d'un adulte.

## Séance du … — J6

Appareil : convertible, Firefox
Testeurs :

Ce qui marche :

Ce qui coince :

Temps par étape (tutoriel, troncs, pierres, abri, lampe, nuit) :

Idées des enfants :

## Protocole J5 (Pixel, mission, Grignotes, lampe, clôture, bulles)

Sur le convertible replié, Firefox ; ligne d'infos terminée par « J5 ». Créer un **nouveau monde** (les mondes du J4 n'ont pas de pierres brillantes).

| Vérification | Convertible |
|---|---|
| Pixel (renard) apparaît devant, un peu à gauche, et suit quand on marche ; il dit « Je suis Pixel… » puis la consigne | |
| Le bandeau en haut montre la consigne et « 0 / 6 » ; le bouton haut-parleur la relit | |
| Casser un tronc : « Un tronc ! » et une clôture arrive aussi dans le sac | |
| Trouver une pierre brillante (cristaux bleus au sol) ; la casser donne une lampe | |
| La mission avance : troncs → pierres → cabane (10 blocs posés) → lampe trouvée → lampe posée → « Bravo ! » | |
| Panneau Tests → Soir, Temps ×20 : carillon et « La nuit arrive ! » ; des Grignotes (boules colorées aux grands yeux) approchent | |
| Une Grignote qui touche l'enfant chipe un bloc (message), puis s'enfuit en riant ; pas plus d'un vol toutes les 25 s | |
| Bouton Bulles vers la voleuse : elle fuit et rend le bloc | |
| Lampe posée : halo jaune la nuit ; les Grignotes restent à distance | |
| Enclos de clôtures : les Grignotes n'entrent pas | |
| Mode parent → décocher « Grignotes actives » : plus aucune | |
| Quitter (maison) au milieu de la mission puis reprendre : Pixel rappelle l'étape en cours | |

### Séance enfants J5

Comprennent-ils seuls la consigne de Pixel (6 ans : à l'oreille ; 8 ans : en lisant) ? Les Grignotes les amusent-elles ou les agacent-elles (vol d'un bloc) ? Pensent-ils aux bulles, à la lampe, à la clôture ? Trouvent-ils les pierres brillantes ?

## Séance du … — J5

Appareil : convertible, Firefox
Testeurs :

Ce qui marche :

Ce qui coince :

Idées des enfants :

## Protocole J4 (accueil, profils, sauvegarde, mode parent, troisième personne)

Sur le convertible replié, Firefox. Vérifier que la ligne d'infos (en jeu) se termine par « J4 ». Ouvrir `cubes.html` **sans rien après le nom dans l'adresse**.

| Vérification | Convertible |
|---|---|
| Premier lancement : écran « Réglages de l'adulte » ; taper les deux prénoms, choisir les niveaux, « C'est parti ! » | |
| « Qui joue ? » : les deux prénoms ; toucher un prénom → choix du personnage (6 dessins) → trois emplacements « + Nouveau » | |
| « + Nouveau » → prairie, île, montagne ou désert → le jeu démarre ; la consigne est lue (lecteur débutant) | |
| Construire un peu, ramasser des blocs, puis bouton maison (en haut à droite) : retour à « Qui joue ? » | |
| Reprendre ce monde : constructions, sac et position retrouvés ; la vignette dit « aujourd'hui » | |
| Fermer Firefox en pleine partie (sans passer par la maison), rouvrir le fichier : le monde est retrouvé (au plus 30 s perdues) | |
| Bouton œil : on se voit de dos ; contre un mur, la caméra ne passe pas au travers ; second appui : retour aux yeux | |
| Mode parent : garder le doigt 3 s sur l'engrenage (un anneau se remplit) ; un appui court n'ouvre rien | |
| Mode parent → « Exporter » : un fichier `cubes-sauvegarde-….json` arrive dans les Téléchargements | |
| Mode parent → effacer un monde, puis « Importer » le fichier exporté : le monde revient | |
| Mode parent → nuit « pas de nuit » : en « Temps ×20 » (panneau Tests), la nuit ne tombe plus | |
| **Stockage sous Firefox** : copier `cubes.html` dans un autre dossier et l'ouvrir : l'écran « Réglages de l'adulte » réapparaît-il (stockage lié au chemin du fichier) ? Noter oui / non | |

### Séance enfants J4

Chaque enfant retrouve-t-il seul son prénom et son monde ? Choisissent-ils un personnage facilement ? Aiment-ils se voir (œil) ? Combien de mondes créent-ils ?

## Séance du … — J4

Appareil : convertible, Firefox
Testeurs :

Ce qui marche :

Ce qui coince :

Idées des enfants :

## Protocole J3 (tactile et convertible)

Sur le convertible replié, avec Firefox. Vérifier que la ligne d'infos se termine par « J3 ». Faire le tableau en portrait puis en paysage. Le protocole J2.1 (voix par paliers) ci-dessous peut se faire en même temps.

| Vérification | Portrait | Paysage |
|---|---|---|
| Un rond est visible en bas à gauche ; doigt posé dessus et poussé : on marche ; doigt levé : on s'arrête | | |
| Toucher un bloc ailleurs, même à gauche au-dessus du rond : on ne marche pas ; glisser regarde ; doigt immobile : le bloc sous la croix se casse | | |
| Un doigt reste posé sur l'écran (main, doigt d'un autre enfant) : un nouveau doigt peut quand même regarder et casser | | |
| Toucher entre deux cases ou sur le bord de la barre : la case la plus proche est choisie ; appui long sur la barre : pas de menu de Firefox | | |
| Petit bouton carré au-dessus de « Casser » : passe en plein écran et disparaît ; panneau Tests → « Plein écran » : on en sort | | |
| Diagnostic, ligne « Fenêtre » : champ de vision d'environ 88° en portrait, 70° en paysage ; en portrait, on voit plus large qu'avant | | |
| Tourner l'appareil en pleine partie : l'image se réajuste, rien ne reste bloqué | | |
| Distance de rendu : 96 blocs à l'ouverture ; choisir 128, fermer puis rouvrir le fichier : toujours 128 | | |
| À 128 blocs, après 10 s sans bouger puis en marchant : noter « i/s », « moy. » et « pire » (ligne en haut à gauche) | | |
| Doigt sur le rond, passer à une autre appli puis revenir : le personnage ne marche pas tout seul | | |
| Balayer depuis les bords gauche, droit et haut pendant la partie (en plein écran et hors plein écran) : noter si l'on sort du jeu | | |

### Séance enfants J3

Même consigne : « Construis une cabane. » À observer : trouvent-ils seuls le rond pour marcher ? Se déplacent-ils encore sans le vouloir ? Portrait ou paysage, lequel choisissent-ils ? Utilisent-ils le bouton plein écran ? Sortent-ils du jeu par accident ? Combien de temps jouent-ils ?

## Séance du … — J3

Appareil : convertible, Firefox, portrait / paysage
Testeurs :

Ce qui marche :

Ce qui coince :

Idées des enfants :

## Protocole J2.1 (voix par paliers)

Vérifier que la ligne d'infos se termine par « J2.1 ». Niveau de lecture débutant, voix active.

| Vérification | PC | Convertible (mode tablette, Firefox) |
|---|---|---|
| Premier bloc d'une sorte : la voix dit « Une pierre ! » | | |
| 2ᵉ, 3ᵉ, 4ᵉ bloc : le nombre s'affiche, « pop », pas de voix | | |
| 5ᵉ, 10ᵉ bloc : la voix dit « Cinq pierres ! », « Dix pierres ! » | | |
| Avec les enfants : la voix est-elle encore trop présente, ou trop rare ? | | |

## Protocole J2 (à faire par Pierre, puis séance avec les enfants)

Vérifier d'abord que la ligne d'infos en haut à gauche se termine par « J2 ». Le protocole J1 ci-dessous reste valable (tablette en priorité) : le dérouler avec ce fichier J2. Au départ, **le sac est vide** : on ne pose que ce qu'on a ramassé. Le panneau **Tests** contient une nouvelle section **Jeu** : niveau de lecture, voix, sons, « Compléter le sac » (jusqu'à 20 blocs de chaque sorte, dans la limite des 9 cases ; « Vider le sac » d'abord pour avoir tout le kit), « Vider le sac ». « — » = sans objet.

| Vérification | PC (Chrome) | Tablette Android |
|---|---|---|
| Un clic bref (ou un tapotement) sur un bloc ne le casse pas ; le message « Appuie longtemps ! » s'affiche |Oui |Oui |
| Garder l'appui : un anneau jaune se remplit autour du viseur, puis le bloc se casse (noter si la durée paraît trop longue ou trop courte) |Oui |Oui |
| Le bloc cassé apparaît dans la barre du bas avec son nombre ; le nombre augmente à chaque bloc du même type |Oui |Oui |
| Le compte s'affiche (« 3 pierres ! ») et est lu à voix haute, sans bégayer quand on casse vite |Oui |Oui |
| Poser (clic droit / mode Poser + tapoter) retire un bloc du compte ; à zéro, la case se vide et le jeu le dit |Oui | Oui|
| Poser avec une case vide : message « Ta case est vide. » |Oui | Oui|
| Cueillir une fleur : un appui court suffit (plus court que pour un bloc), un clic bref ou un tapotement ne la cueille pas ; un bloc sous une fleur emporte la fleur dans le sac | | |
| En gardant l'appui vers le sol : un seul bloc est creusé plus bas que les pieds ; relâcher puis rappuyer en creuse un autre | Oui|Oui |
| Dans un trou de deux ou trois blocs : garder Espace (Sauter) en avançant contre la paroi fait grimper et sortir | | |
| Touches 1 à 9, molette (PC), toucher une case (tablette) : la case choisie change, son nom s'affiche au-dessus |Oui | |
| Sons : casse (petits « tic » puis un bruit), pose (« toc »), ramassage (« pop »), refus (deux notes douces). Volume correct ? Rien d'agaçant ? |Oui | Oui|
| Panneau → Jeu → Lecture « autonome » : phrases complètes (« Tu as ramassé… »), voix coupée ; la case « Lire les messages » la rallume | | |
| Diagnostic : lignes « Sons : actif » (après un premier clic), « Lecture », « Sac » | Oui|Oui |
| Tablette : garder le doigt immobile casse le bloc sous la croix du milieu ; glisser le doigt regarde sans casser ; viser en glissant puis s'arrêter sans lever le doigt casse aussi | — |Oui, mais parfois on se déplace alors qu'on veut casser un bloc |

### Séance enfants J2 (première séance, consigne libre)

Consigne donnée à l'oral : « Construis une cabane. » Pas d'aide au départ ; noter ce qui bloque avant d'aider. Suggestion : monde prairie, sac vide (ils doivent casser pour ramasser) ; au bout de 10 minutes, si ça coince, « Compléter le sac ».

À observer : comprennent-ils seuls qu'il faut rester appuyé ? La durée de casse les agace-t-elle ? Regardent-ils le nombre dans les cases, le lisent-ils, le répètent-ils ? La voix les aide-t-elle, les gêne-t-elle (6 ans / 8 ans) ? Que construisent-ils ? Combien de temps jouent-ils avant de décrocher ?
Ils arrivent à prendre en main, deconstruisent plus que construisent pour l'instant, intéressés
La voix est répétitive ; ils ont vite pris les choses en main.

Appareils : colonne « PC (Chrome) » = ordinateur portable classique (autre que le PC du bureau) ; colonne « Tablette » = convertible Acer Nitro 5 Spin NP515-51 en mode tablette, Firefox.

## Séance du 24/09/2026 — J2 (diagnostic seul, protocole J2 non encore rempli)

Appareil : tablette tactile sous Windows 10, Firefox 154 (d'après le diagnostic ; le tableau J1 ci-dessous est intitulé « Tablette Android » : même appareil ? à confirmer)
Testeurs : Pierre

Ce qui marche :

Ce qui coince :

Diagnostic (transcrit par Claude depuis la capture d'écran fournie en discussion) :

```
Version : J2
Monde : île, graine 870756, 128×64×128, arbres 51, fleurs 191, cactus 0
Rendu : distance 128 blocs, sections affichées 127/256, en attente 0, appels 59, triangles 23584
Calcul par image (hors attente de l'écran) : moy. 2.8 ms, pire 8.0 ms
Heure : 12h31 (jour), vitesse ×20
Adresse : file://(fichier local)
Navigateur : Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:154.0) Gecko/20100101 Firefox/154.0
Écran : 1080×1802 @ 1× (rendu 1×)
Tactile : pointeur principal doigt, interface tactile affichée (5 points)
WebGL2 : oui — ANGLE (Intel, Intel(R) HD Graphics 400 Direct3D11 vs_5_0 ps_5_0), or similar
Pointer Lock : disponible, inactif, captures 4, écartés 0 après capture et 0 trop grands (> 200 px), plus grand reçu 0 px
Contexte 3D : ok, perdu 0 fois
Stockage local : ok
Synthèse vocale : disponible
Sons : actif
Lecture : debutant, voix active
Sac : 4/9 cases, 18 blocs
Voix : Microsoft Hortense - French (France) (fr-FR) ; 4 voix françaises dont 4 locales (hors ligne), sur 5 voix au total
```

Idées des enfants :

## Protocole J1 (à faire par Pierre)

Vérifier d'abord que la ligne d'infos en haut à gauche se termine par « J1 ». Le panneau **Tests** (en haut à droite) contient maintenant : Monde (type, graine, « Nouveau monde »), Heure, Distance de rendu, Voix, Diagnostic. La priorité est la **tablette** : c'est elle qui fixera la distance de rendu et la taille du monde. « — » = sans objet.

| Vérification | PC (Chrome) | Tablette Android |
|---|---|---|
| Le fichier s'ouvre ; l'écran « Construction du monde… » disparaît (noter en combien de secondes, à peu près) | | |
| Au départ on est au sol, à ciel ouvert, dans une prairie (4ᵉ ligne des infos : « prairie · graine … ») | |Oui |
| Images par seconde après 10 s sans bouger (noter « moy. », « pire » et « calcul ») | |16.7 17 1,3 |
| Même mesure en marchant 20 s dans le monde | |16.7 17 1,3 |
| Panneau → Distance de rendu : noter les images par seconde à 48, 96 et 128 blocs | | 48 (16.7 17 2.2) 96 (16.7 17 2.3)|
| Panneau → Monde : essayer île, montagne, désert (« Nouveau monde ») : chacun s'affiche, on apparaît au sol | |oui |
| Marcher contre une marche d'un bloc : on monte sans sauter ; un mur de deux blocs arrête | | oui|
| Entrer dans l'eau : on flotte ; en avançant vers la berge, on ressort | |oui |
| Sous l'eau (Maj sur PC pour plonger) : l'image devient bleue ; en relâchant, on remonte | | — |
| Panneau → Heure → Nuit : ciel sombre, étoiles, on voit encore le sol ; « Temps ×20 » : le soleil se couche puis se lève | |Oui |
| Casser, poser, cueillir une fleur (on vise la fleur) | |Oui |
| Souris : après quelques captures et des gestes très rapides, noter la ligne « Pointer Lock » du diagnostic (écartés… après capture, … trop grands, plus grand reçu … px) ; le regard « colle »-t-il parfois ? | | — |
| Passer à une autre appli (ou verrouiller l'écran) 30 s puis revenir : le monde s'affiche toujours (ligne « Contexte 3D » du diagnostic) | — |Oui |
| Diagnostic : « Stockage local : ok » | |Oui |

Copier le bloc « Diagnostic » de chaque appareil dans la séance ci-dessous (une capture d'écran convient aussi). Si les enfants essaient : quel type de monde préfèrent-ils, qu'est-ce qui les amuse, qu'est-ce qui les gêne ?

## Séance du … — J1

Appareil :
Testeurs :

Ce qui marche :

Ce qui coince :

Diagnostic (copié depuis le panneau) :

```
```

Idées :

## Protocole J0.1 (fait par Pierre le 23/09/2026 sur PC, Chrome)

Vérifier d'abord que la ligne d'infos en haut à gauche se termine par « J0.1 », sinon c'est une ancienne copie du fichier. Ouvrir `dist/cubes.html` et, pour chaque appareil, remplir le tableau (le bouton « Tests J0 », en haut à droite, ouvre le panneau voix + diagnostic). « — » = sans objet.

| Vérification | PC (Edge) | PC (Chrome) | Tablette Android |
|---|---|---|---|
| Le fichier s'ouvre (double-clic sur PC ; gestionnaire de fichiers puis « Ouvrir avec Chrome » sur tablette) | |Oui | |
| Au départ on est au sol (infos : « pos … 4.0 … sol »), face à un escalier de pierre et un mur de planches | | | |
| Images par seconde affichées en haut à gauche (attendre 10 s, noter « moy. » et « pire ») | |16.7 17 | |
| Diagnostic : ligne « WebGL2 » | |Oui - Angle (Intel, Intel(R) UHD Graphics (0x00009BC4) Direct3D11 vs_5_0 ps_5_0 D3D11 | |
| Clic sur le monde : la souris est capturée **sans que la vue saute** ; le regard suit la souris ; Échap libère | |Oui | — |
| Diagnostic : « mouvements écartés » (noter le nombre après quelques captures) | |62 | — |
| Si la capture échoue : message « Capture de la souris refusée », glisser regarde, clic bref casse/pose | |Oui | — |
| Déplacement ZQSD, saut Espace, monter l'escalier de pierre, passer la porte du mur | |Oui | — |
| Aller jusqu'au bord du monde : on est arrêté par un mur invisible, on ne tombe pas | |Oui | |
| Tactile : joystick à gauche, regard à droite, tapoter casse, bouton Poser puis tapoter pose | — | — | |
| Si le PC a un écran tactile : l'interface tactile n'apparaît qu'après avoir touché l'écran | | | — |
| Casser un bloc (clic gauche) et poser un bloc (clic droit) avec les 6 types | |Oui | |
| Poser un bloc à ses pieds : message « Pas de place ici » | |Oui | |
| Panneau « Voix » : nombre de voix françaises, dont locales (hors ligne) | |4 | |
| Bouton « Tester la voix » : la phrase est prononcée, en français, compréhensible ; le message final s'affiche | |Oui | |
| Bouton « Tester la voix » **wifi coupé** : la voix fonctionne encore | |Oui | |
| Plein écran fonctionne (et paysage sur tablette) | |Oui | |
| Diagnostic : « Stockage local : ok » | |Oui | |
| Passer à une autre appli (ou verrouiller l'écran) 30 s puis revenir : le monde s'affiche toujours | — | — | |

Copier aussi le contenu du bloc « Diagnostic » de chaque appareil ci-dessous (utile pour régler les performances). Si un écran « Oups, le jeu s'est arrêté » apparaît, copier son texte ici.
iMAGE FOURNIE EN DISCUSSION CLAUDE (transcrite par Claude dans le bloc « Diagnostic » ci-dessous)

## Séance du 23/09/2026 — J0.1

Appareil :PC boulot
Testeurs :moi

Ce qui marche :

Ce qui coince :

Diagnostic (copié depuis le panneau) :

```
Ligne d'infos : 60 i/s (moy. 16.7 ms, pire 17 ms)
                pos 6.6 1.0 6.3  sol  regard 260° 27°
                faces 2804  bloc : tronc  J0.1
Voix : Microsoft Hortense - French (France) (fr-FR) ; Lecture terminée (9811 ms)
Adresse : file://(fichier local)
Navigateur : Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/153.0.0.0 Safari/537.36
Écran : 1536×730 @ 1.25× (rendu 1.25×)
Tactile : pointeur principal souris, interface tactile masquée (0 points)
WebGL2 : oui — ANGLE (Intel, Intel(R) UHD Graphics (0x00009BC4) Direct3D11 vs_5_0 ps_5_0, D3D11)
Pointer Lock : disponible, inactif, mouvements écartés 60, erreur : pointerlockerror
Stockage local : ok
Synthèse vocale : disponible
Node.js du poste (PowerShell, node -v) : v24.11.0
```

Idées :Avoir un personnage 
Des armes (fun)
Pleins de pays
Des monstres?
Quand viennent ils?
Comment sélectionner son profil?
Comment enregistrer ?
Quand apprend on des choses?
