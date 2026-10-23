# Heures supplémentaires — correction de la charte En-Check

## Retour utilisateur
Titres trop imposants, charte insuffisamment cohérente avec Pointages et Paie & Fiscalité, bandeau supérieur trop haut et flou.

## Corrections
- Suppression des règles génériques `.ot-page h1/h2` : elles agrandissaient aussi le titre du composant partagé PageHeader. Styles désormais limités au titre de contenu et aux titres de panneaux.
- En-tête : 20 px desktop / 17 px mobile, graisse et espacement inspirés de Pointages. Titre de contenu : 27 px / 24 px, comme PaieWorkspace. Titres des panneaux : 16 px. Police Segoe UI conservée, corps de page 14 px.
- Fonds et textes alignés sur la palette de PaieAfroTech : ivoire #FAF6F0, blanc, encre #231911, texte secondaire #4E3D2E ; sombre #15110E / #1D1713 / #F5F2EB. Indigo et cuivre conservés comme accents du motif validé.
- En-tête commun correctement thémé sur cette page uniquement ; aucun changement du composant PageHeader partagé.
- Espacements principaux 22 px / 3,4 % desktop et 16 px mobile ; boutons plus compacts.
- Motif aso-oke redessiné en SVG original, sans bitmap intégré ni filtre floutant. Conserve l’inspiration indigo/cuivre/ivoire en bandes tissées, pas une reproduction pixel à pixel de la texture photographique initiale.
- Bandeau supérieur 40 px desktop / 32 px mobile au lieu de 76 / 60. Bas 24 / 20 px. Tailles spécifiques à aso-oke : autres pages inchangées. La barre intelligente emploie aussi le SVG via la carte centrale.

## Vérification
- 697 tests / 69 fichiers réussis, dont 3 nouveaux tests de non-régression de charte.
- Build Vite/PWA réussi ; avertissement existant sur la taille des bundles.
- Porte ESLint : zéro erreur, un warning préexistant EnterpriseSelectorModal.
- Chromium : vrais composants PageHeader, PageCulturalBand et OvertimeDashboard montés avec données synthétiques ; clair/sombre × 320, 390, 768 et 1440 px. Tailles calculées du header, du titre, des panneaux et du bandeau vérifiées ; SVG utilisé ; recherche fonctionnelle ; aucun débordement horizontal ni erreur JS/HTTP. Captures inspectées.
- Pas de session authentifiée de production ; aucune modification des calculs, requêtes, règles métier, permissions ou données. Aucun déploiement de production.
