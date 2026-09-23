# Retours de test

Un bloc par séance de test. Noter l'appareil, qui a testé, ce qui a marché, ce qui a coincé, et les idées. Les enfants ont toujours raison sur ce qui est amusant ou frustrant.

## Protocole J0.1 (à faire par Pierre avant la suite)

Vérifier d'abord que la ligne d'infos en haut à gauche se termine par « J0.1 », sinon c'est une ancienne copie du fichier. Ouvrir `dist/cubes.html` et, pour chaque appareil, remplir le tableau (le bouton « Tests J0 », en haut à droite, ouvre le panneau voix + diagnostic). « — » = sans objet.

| Vérification | PC (Edge) | PC (Chrome) | Tablette Android |
|---|---|---|---|
| Le fichier s'ouvre (double-clic sur PC ; gestionnaire de fichiers puis « Ouvrir avec Chrome » sur tablette) | | | |
| Au départ on est au sol (infos : « pos … 4.0 … sol »), face à un escalier de pierre et un mur de planches | | | |
| Images par seconde affichées en haut à gauche (attendre 10 s, noter « moy. » et « pire ») | | | |
| Diagnostic : ligne « WebGL2 » | | | |
| Clic sur le monde : la souris est capturée **sans que la vue saute** ; le regard suit la souris ; Échap libère | | | — |
| Diagnostic : « mouvements écartés » (noter le nombre après quelques captures) | | | — |
| Si la capture échoue : message « Capture de la souris refusée », glisser regarde, clic bref casse/pose | | | — |
| Déplacement ZQSD, saut Espace, monter l'escalier de pierre, passer la porte du mur | | | — |
| Aller jusqu'au bord du monde : on est arrêté par un mur invisible, on ne tombe pas | | | |
| Tactile : joystick à gauche, regard à droite, tapoter casse, bouton Poser puis tapoter pose | — | — | |
| Si le PC a un écran tactile : l'interface tactile n'apparaît qu'après avoir touché l'écran | | | — |
| Casser un bloc (clic gauche) et poser un bloc (clic droit) avec les 6 types | | | |
| Poser un bloc à ses pieds : message « Pas de place ici » | | | |
| Panneau « Voix » : nombre de voix françaises, dont locales (hors ligne) | | | |
| Bouton « Tester la voix » : la phrase est prononcée, en français, compréhensible ; le message final s'affiche | | | |
| Bouton « Tester la voix » **wifi coupé** : la voix fonctionne encore | | | |
| Plein écran fonctionne (et paysage sur tablette) | | | |
| Diagnostic : « Stockage local : ok » | | | |
| Passer à une autre appli (ou verrouiller l'écran) 30 s puis revenir : le monde s'affiche toujours | — | — | |

Copier aussi le contenu du bloc « Diagnostic » de chaque appareil ci-dessous (utile pour régler les performances). Si un écran « Oups, le jeu s'est arrêté » apparaît, copier son texte ici.

## Séance du … — J0.1

Appareil :
Testeurs :

Ce qui marche :

Ce qui coince :

Diagnostic (copié depuis le panneau) :

```
```

Idées :
