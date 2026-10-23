# Retards — reprise de la signature visuelle

## Retour pris en compte
L’interface précédente était jugée trop standard : raccourcis peu distinctifs, filtres et compteurs sans caractère, arrivées réduites à une barre générique, aide trop scolaire et graphique inutile sur une journée avec un seul retard.

## Changements de présentation
- Quatre raccourcis en petites cartes avec icônes façon pièces gravées, relief discret et focus clavier. Thème global conservé.
- Filtres numérotés, champs regroupés, sélection Jour/Semaine/Mois contrastée et date séparée dans un pied de carte.
- Trois compteurs compacts, ornements discrets et libellés au singulier/pluriel corrects. Titres de page conservés à 27 px desktop / 24 px mobile.
- Chaque arrivée devient une fiche horaire : identité/source, heure prévue à gauche, arrivée réelle à droite et écart au centre. Le tracé de liaison est décoratif, pas une nouvelle échelle ni un nouveau calcul. Tolérance visible dans le pied ; contexte replié et suppression préexistante toujours derrière son avertissement explicite.
- Pagination masquée lorsqu’une seule page suffit. Texte « 1 fiche horaire » pour le cas signalé.
- Aide redessinée : horloge SVG originale gravée, étapes « Le rendez-vous / L’arrivée / La différence », explications fermées par défaut.
- Vue Jour : sceau de synthèse avec nombre de retards et durée réelle cumulée, sans pourcentage ni fausse jauge. Les graphiques réels Semaine/Mois sont conservés.
- Palette ivoire/espresso/cuivre, motif précédemment approuvé et barre intelligente inchangés. Mise en page adaptée aux deux thèmes et aux petits écrans.

## Périmètre préservé
Aucune modification du service de retard, du calcul SQL, des requêtes, des permissions, de la tolérance métier, de l’export ou de la suppression des données. Les heures 09:00 / 11:03 et l’écart 2 h 03 de l’exemple utilisateur sont restitués tels quels. La valeur de tolérance utilisée dans les tests est une donnée synthétique, pas une affirmation sur le compte réel.

## Vérifications
- **718 tests / 72 fichiers réussis**, dont cinq nouveaux tests de signature : cas fourni, données zéro, pluriels, jour sans barre, période multi-jours, absence de pagination inutile, explications repliées et gravure décorative.
- Build Vite/PWA réussi ; warning préexistant de taille des bundles.
- Porte ESLint : zéro erreur, un warning préexistant EnterpriseSelectorModal. git diff --check réussi.
- Chromium : vraie page Retards, API interceptée sur un domaine de test. Clair/sombre × 320, 390, 768, 1440 px. Cas unique, recherche vide, détail, annulation de suppression, tiroir/focus/Échap, thème, semaine/mois, pagination multi-fiches, données vides et reduced-motion.
- Débordement du graphique mensuel détecté pendant le contrôle mobile, corrigé : défilement limité à sa carte. Dernier passage sans débordement horizontal du document ni erreur JavaScript.
- Captures desktop et mobile inspectées ; aperçu final explicitement marqué « données simulées ». Pas une connexion authentifiée de production.
- Aucun SQL exécuté, aucune donnée réelle modifiée, aucun déploiement de production ; dépendances versionnées inchangées.
