# Retards — prolongation de l’animation d’introduction

## Demande
L’utilisateur souhaite profiter plus longtemps de l’illustration animée validée, comme du chargement de Pointages. L’illustration Pointages reste au stade de proposition : aucun changement de cette page dans cette livraison.

## Livraison
- Retards : introduction de **6 secondes** au premier chargement de la page, mesurées à partir du montage du loader. Les requêtes continuent immédiatement en parallèle.
- Bouton « Passer l’animation » activé dès que les données sont prêtes. Pendant cette courte présentation, le titre indique honnêtement « Les arrivées sont prêtes » si le calcul a déjà terminé.
- Si les données demandent plus de six secondes, le loader continue : l’expiration du délai ne révèle jamais des résultats incomplets.
- Pas de nouvelle attente minimale lors des changements de date, vue ou entreprise après l’introduction. Une nouvelle visite de la page peut rejouer l’introduction.
- Une erreur ou un refus d’accès reste visible sans attendre la fin de l’animation. En cas d’erreur initiale avant la fin de l’introduction, une nouvelle tentative peut relancer sa durée.
- Pas d’attente décorative avec `prefers-reduced-motion`. Prise en compte d’un changement de cette préférence pendant l’introduction.
- Timer nettoyé au démontage ou au passage de l’animation. L’illustration, les photos, la logique métier et les permissions restent inchangées.

## Vérifications
- **735 tests / 75 fichiers réussis**. Tests à horloge simulée : seuil 5999/6000 ms, nettoyage, bouton désactivé pendant la lecture, possibilité de passer quand prêt, reduced-motion, absence de répétition sur les filtres et maintien du loader si la requête n’est pas terminée.
- Build Vite/PWA réussi ; warning de taille des bundles préexistant.
- Porte ESLint : zéro erreur, un warning préexistant EnterpriseSelectorModal. git diff --check réussi.
- Montage de la vraie page avec services simulés en jsdom ; pas de nouvelle session navigateur authentifiée ni d’intervention sur les données de production.
- Aucun SQL, aucune donnée réelle modifiée, aucun changement des dépendances versionnées, aucun déploiement production.
