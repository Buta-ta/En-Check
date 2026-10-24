# Pointages — illustration approuvée intégrée

## Source conservée
L’image transmise à nouveau par l’utilisateur est conservée dans `docs/design/pointages-approved-source.png` (SHA-256 `407d0e8a04926091bafaaf5900d4b2843a407cbe7d5f60abe7d1d6dcda94ff5b`). Elle n’est plus seulement un fichier temporaire de conversation.

Le script `scripts/assets/prepare-pointages-art.py` transforme cette source en `public/images/pointages-loading-approved.webp` : cadre 1824 × 1026, soit 16:9, environ 142 Kio, qualité 95. Il prolonge uniquement les marges de papier et le motif inférieur. Le personnage, son téléphone et la borne restent ceux de l’image originale, sans nouvelle génération. Reproduction avec Python + Pillow :

```sh
python scripts/assets/prepare-pointages-art.py docs/design/pointages-approved-source.png public/images/pointages-loading-approved.webp
```

## Intégration
- Remplacement des deux photographies PIN/QR du loader Pointages par l’illustration choisie. Aucun changement du loader Retards.
- Cadre paysage limité à 600 px, illustration complète sans recadrage du personnage, proportions conservées sur mobile et ordinateur. Palette du dessin préservée en clair et sombre ; texte/cadre adaptés au thème.
- Animation décorative CSS : reflet discret sur le téléphone, balayage ivoire/cuivre limité à l’écran de la borne. **Le personnage reste dans la pose approuvée : ce n’est pas une animation de saisie PIN ni une suite de nouvelles poses dessinées.**
- Pas de pourcentage artificiel, étape prétendument terminée, voyant vert ou faux résultat de pointage. Texte descriptif du chargement réel.
- Effets actifs seulement après chargement de l’image ; si celle-ci échoue, le texte et le contrôle d’attente restent disponibles. Reduced-motion : illustration fixe et aucune attente décorative.
- Introduction de 6 secondes lors du premier affichage de la page ; la lecture réelle se poursuit en parallèle. Une erreur est affichée immédiatement, même avant la fin de l’introduction.
- « Passer l’animation » est activé seulement lorsque les données sont prêtes ; le texte le signale alors. Le délai n’est pas renouvelé lors des filtres suivants. Si le réseau est plus lent que l’introduction, le loader reste visible tant que la lecture initiale continue.
- Timer nettoyé au démontage. Le callback de fin reste stable lors des rendus et de l’arrivée des données. Aucun changement de requête, calcul, permission, SQL ou donnée réelle.

## Vérification
- 741 tests, 76 fichiers réussis. Nouveaux tests : chargement/erreur d’image, activation des effets, timer 5999/6000 ms, données arrivant pendant l’introduction, interdiction de passer trop tôt, nettoyage, reduced-motion, budget d’asset et présence de la source durable.
- Test culturel adapté : Pointages possède désormais le motif dans son illustration, et non les anciennes barres/progressions. Tests Pauses et Employés conservés.
- Build Vite/PWA réussi ; avertissement préexistant sur les gros bundles. ESLint gate : zéro erreur, un warning préexistant EnterpriseSelectorModal.
- Chromium : clair/sombre × 320/390/768/1440 px, image décodée, scène paysage sans débordement, reduced-motion et bouton passer. Test supplémentaire d’image en erreur. Captures inspectées.
- QA navigateur sur le composant réel avec données simulées ; pas de session authentifiée en production. Aucune fusion ni mise en production effectuée dans cette livraison.
