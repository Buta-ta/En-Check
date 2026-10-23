# Retards — illustration validée intégrée au chargement

## Demande
Remplacer le dessin schématique par le même niveau de finition que l’illustration professionnelle choisie. Conserver réellement son dessin, sans le redessiner sous forme de personnage SVG simplifié.

## Source et traitement
- Source : `retards-loading-illustration-professionnelle.png`, option 2 sélectionnée, 2048 × 2048.
- SHA-256 original : `9b90524ade6c7fc4744526ad5691582bcbca537b52503f2a24a6474bfcf7a96c`.
- Les cinq WebP livrés sont issus de cette image, sans nouvelle génération : composition approuvée, fond/borne, haut du personnage, jambe avant, jambe arrière. Visage, vêtements, textures et borne ne sont pas redessinés.
- Exports 1536 × 1536, composition/fond WebP qualité 95 et calques transparents sans perte. Total environ 758 Kio. Taille affichée au plus 440 px : réserve de définition pour les écrans denses.
- Masquage du personnage, restitution du papier sous sa silhouette et du sol à partir de zones propres de l’image. Recouvrement des calques aux hanches pour éviter les joints ouverts. Pixels du sol exclus des calques mobiles.

## Animation et comportement
- Animation CSS en calques, boucle 5,6 s : approche de la borne, foulée discrète avec légères oscillations des jambes, ralentissement et pause dans la composition approuvée.
- C’est une illustration mise en mouvement, **pas une course entièrement redessinée image par image ni une vidéo générée**. Les amplitudes sont volontairement faibles pour conserver le dessin et ses proportions.
- La composition approuvée s’affiche initialement et pendant la pause. Les calques ne sont révélés qu’après chargement de toutes les images. Le fond et la borne ne bougent pas.
- Même dessin et mêmes couleurs dans les deux thèmes : aucun filtre sombre appliqué à l’illustration. L’encadrement et le texte suivent le thème global.
- `prefers-reduced-motion` : illustration approuvée fixe, calques mobiles masqués.
- Erreur d’un calque : repli sur l’illustration fixe. Si l’image principale elle-même échoue : statut textuel conservé, sans image cassée.
- Aucun pourcentage fictif, voyant de validation, retard inventé ou temps minimum de chargement. Le composant reste lié au chargement réel existant.
- Les photos des employés, les requêtes, les calculs et les permissions ne sont pas modifiés.

## Vérifications
- **729 tests / 74 fichiers réussis**. Nouveaux tests : attente des cinq images, chargements répétés, repli après erreur, reduced-motion, absence de filtre et budget des assets.
- Build Vite/PWA réussi ; warning préexistant de taille des bundles.
- Porte ESLint : zéro erreur, un warning préexistant EnterpriseSelectorModal. git diff --check réussi.
- Chromium : composant réel, clair/sombre × 320/390/768/1440 px. Décodage des cinq images, inspection de quatre instants de la boucle, composition fixe pendant la pause, reduced-motion, absence de débordement et retrait immédiat à la fin du chargement simulé.
- Captures inspectées ; masque initial et recouvrement des jambes affinés après contrôle visuel. Dernier passage sans erreur JavaScript/HTTP.
- Harnais local, pas une session authentifiée en production. Aucun SQL, donnée réelle modifiée ou déploiement de production. Dépendances versionnées inchangées.
