# Retours de test

Un bloc par séance de test. Noter l'appareil, qui a testé, ce qui a marché, ce qui a coincé, et les idées. Les enfants ont toujours raison sur ce qui est amusant ou frustrant.

## Protocole J1 (à faire par Pierre)

Vérifier d'abord que la ligne d'infos en haut à gauche se termine par « J1 ». Le panneau **Tests** (en haut à droite) contient maintenant : Monde (type, graine, « Nouveau monde »), Heure, Distance de rendu, Voix, Diagnostic. La priorité est la **tablette** : c'est elle qui fixera la distance de rendu et la taille du monde. « — » = sans objet.

| Vérification | PC (Chrome) | Tablette Android |
|---|---|---|
| Le fichier s'ouvre ; l'écran « Construction du monde… » disparaît (noter en combien de secondes, à peu près) | | |
| Au départ on est au sol, à ciel ouvert, dans une prairie (4ᵉ ligne des infos : « prairie · graine … ») | | |
| Images par seconde après 10 s sans bouger (noter « moy. », « pire » et « calcul ») | | |
| Même mesure en marchant 20 s dans le monde | | |
| Panneau → Distance de rendu : noter les images par seconde à 48, 96 et 128 blocs | | |
| Panneau → Monde : essayer île, montagne, désert (« Nouveau monde ») : chacun s'affiche, on apparaît au sol | | |
| Marcher contre une marche d'un bloc : on monte sans sauter ; un mur de deux blocs arrête | | |
| Entrer dans l'eau : on flotte ; en avançant vers la berge, on ressort | | |
| Sous l'eau (Maj sur PC pour plonger) : l'image devient bleue ; en relâchant, on remonte | | — |
| Panneau → Heure → Nuit : ciel sombre, étoiles, on voit encore le sol ; « Temps ×20 » : le soleil se couche puis se lève | | |
| Casser, poser, cueillir une fleur (on vise la fleur) | | |
| Souris : après quelques captures et des gestes très rapides, noter la ligne « Pointer Lock » du diagnostic (écartés… après capture, … trop grands, plus grand reçu … px) ; le regard « colle »-t-il parfois ? | | — |
| Passer à une autre appli (ou verrouiller l'écran) 30 s puis revenir : le monde s'affiche toujours (ligne « Contexte 3D » du diagnostic) | — | |
| Diagnostic : « Stockage local : ok » | | |

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
