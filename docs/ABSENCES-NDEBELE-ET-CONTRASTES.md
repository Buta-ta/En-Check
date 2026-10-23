# Absences — bandeau ndebele et lisibilité des thèmes

23 octobre 2026 — branche `arena/3788446d-en-check`.

## Demande
Intégrer le bandeau sélectionné en haut et en bas de la page Absences et dans les tiroirs. Corriger la lisibilité des filtres, onglets, vues Planning/Mois/Liste, demandes employés, configuration des congés et formulaire de déclaration, en clair et sombre.

## Motif culturel
- Image sélectionnée : `/home/user/absences-motif-ndebele.png`, 2172 × 724 px. Interprétation contemporaine inspirée des peintures ndebele, sans revendication d’authenticité traditionnelle.
- Conversion WebP optimisée (~276 Kio), sans recadrage ni déformation : `public/images/absences-ndebele.webp`.
- Composant décoratif partagé `AbsencesCulturalBand`, ignoré des lecteurs d’écran.
- Page : 76 px en haut, 32 px en bas, hauteur supérieure adaptée sur mobile. Motif entier répété horizontalement, proportions conservées.
- Tiroirs de déclaration/modification et de consultation : même motif en haut et en bas, à une hauteur réduite. Aucun changement du bogolan de Paie ni du motif du Planning.

## Corrections visuelles
La cause principale était le mélange de fonds espresso fixés dans les styles en ligne et de textes déjà adaptés au thème clair. Les panneaux et contrôles utilisent désormais les couleurs du thème.

- Recherche employé, entreprise, boutons Planning/Mois/Liste, panneaux de filtres : surfaces claires/sombres cohérentes, libellés accessibles, focus visible et états sélectionnés explicites.
- Onglets Absences / Demandes employés / Configuration congés : fond sélectionné contrasté, état aria-pressed, retour à la ligne sur mobile.
- Tous les motifs : texte lisible même lorsque le bouton est désactivé parce que tous sont déjà affichés. Masquer les employés sans absence : libellé adapté au thème. Motifs : couleurs conservées dans fonds/bordures, texte lisible au lieu d’un texte clair sur fond clair.
- Tiroirs : palette locale explicite, textes secondaires renforcés, champs, dates, statut, solde, justificatif, boutons et actions harmonisés. Le formulaire reste défilable entre l’en-tête et le pied.
- Demandes : statuts, filtres et actions adaptés au thème. Sur mobile, les actions passent sous l’identité au lieu de comprimer le nom et les dates.
- Configuration : fonds des motifs, paramètres et champs harmonisés ; tableau des soldes défilant localement et accessible au clavier sur petit écran.
- Mois : colonnes `minmax(0,1fr)` et cellules adaptées aux écrans étroits ; navigation de Planning repliable sur plusieurs lignes. Suppression du grand espace vide dû au flex-basis de la barre de recherche en colonne.
- L’explication du dock de motifs est repliée par défaut.

## Vérifications
- **666 tests Vitest / 64 fichiers réussis**, dont 6 nouveaux tests de bandeau, thème local des deux tiroirs, contrastes des couleurs de texte, absence de panneaux sombres fixes et disposition des demandes.
- Tests de l’ancienne frise adaptés au nouveau choix explicite ; les tests du SVG Kente partagé et du Planning restent conservés.
- Contraste des couleurs de texte principales/secondaires et accents testés sur les surfaces élevées : au moins 4,5:1 dans chaque thème. Ce contrôle de palette ne constitue pas un audit WCAG intégral de chaque combinaison de motifs personnalisables.
- Build Vite/PWA réussi ; ESLint gate zéro erreur, un warning préexistant EnterpriseSelectorModal ; diff sans erreurs d’espacement.
- Chromium avec vraie page Absences et services/API simulés : Planning, Mois, Liste, Demandes, Configuration, sélection entreprise, déclaration avec sélection salarié, ouverture et fermeture du tiroir de consultation. Deux bandeaux par page/tiroir vérifiés.
- Matrice clair/sombre × 320/390/768/1440 px : zéro débordement global ; grilles larges défilantes localement. Zéro pageerror et zéro écriture simulée. Captures mobile/desktop inspectées, dont demandes et formulaire en clair.

## Périmètre préservé
Aucune règle de décompte, permission, décision d’approbation, suppression, donnée de motif ou API de sauvegarde modifiée. Aucun SQL ni changement de production. Les tests navigateur utilisent des données fictives et ne constituent pas un essai d’une session employeur authentifiée en production. Manifests de dépendances inchangés ; harnais et captures hors Git.
