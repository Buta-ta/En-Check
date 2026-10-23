# Loadings : paysage et adaptation mobile

## Périmètre
- Retards : cadre d’illustration paysage 2:1 sur ordinateur, 16:10 sur téléphone (jusqu’à 480 px), largeur maximale 600 px. Le dessin complet reste centré, sans étirement ni découpe du personnage.
- Les calques de Retards gardent leur repère carré d’origine : les pivots, la foulée, les textures et la pause restent alignés. Le motif inférieur existant est prolongé sur la largeur du cadre à partir de l’image déjà chargée.
- Durée initiale de 6 secondes, passage lorsque les données sont prêtes, fallback et reduced-motion inchangés. Bouton d’au moins 44 px de haut, texte pouvant revenir à la ligne.
- Pointages **actuel** : suppression de la hauteur minimale plein écran, largeur limitée à 680 px, scènes paysage 16:9 sans recadrage destructif. Légendes sous les images.
- Jusqu’à 640 px, une seule scène Pointages visible à la fois dans un emplacement partagé 16:10 : les deux méthodes ne s’empilent plus. Les boutons existants permettent toujours de passer entre PIN et QR ; la scène cachée n’intercepte pas les interactions.
- La nouvelle illustration Pointages sélectionnée n’est pas encore intégrée/animée. Une référence paysage séparée (`pointages-illustration-paysage.png`, 1600 × 900) est fournie : personnage et borne issus de l’image choisie, marges de papier prolongées, bandeau existant répété. Pas de nouvelle génération du dessin. Ce fichier de proposition reste hors des assets de production.

## Vérifications
- 735 tests / 75 fichiers réussis ; build Vite/PWA réussi.
- ESLint gate : zéro erreur, un warning préexistant EnterpriseSelectorModal. git diff --check réussi.
- Chromium : 16 configurations (Retards/Pointages × clair/sombre × 320/390/768/1440 px). Images décodées, largeur de scène supérieure à sa hauteur, aucun débordement horizontal, bascule PIN/QR avec une seule scène visible sur téléphone ; aucune erreur JavaScript.
- Captures des composants réels inspectées, dont Retards à la pause de sa boucle. Harnais local, pas une session authentifiée en production.
- Aucun changement de données, calculs, permissions, SQL, dépendances versionnées ou durée de chargement.
