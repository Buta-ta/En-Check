# Identités culturelles validées et animation de chargement Absences

23 octobre 2026 — branche `arena/04fa1bab-en-check`.

## Validation utilisateur
Les trois bandeaux et la scène de chargement ont été explicitement validés avant intégration. Interprétations contemporaines inspirées de traditions visuelles africaines, sans revendication d’authenticité de symboles précis.

## Livraison
- Pointages : inspiration adinkra du Ghana, indigo/cuivre/ivoire.
- Pauses : inspiration des textiles du Lesotho, crème/bleu/terre cuite.
- Employés : inspiration des perles zoulou d’Afrique du Sud, losanges colorés sur espresso.
- Images sélectionnées converties en WebP optimisés, proportions conservées. Intégration aux bandeaux supérieurs et inférieurs des pages.
- Les trois écrans de chargement reprennent leur nouveau motif, sans changer leurs scènes, étapes, bouton Passer ou règles de chargement existantes.
- Correspondance centralisée PageCulturalBand : l’assistant compact et son dialogue suivent les trois nouvelles identités à chaque navigation. Planning kuba, Absences ndebele et Paie bogolan inchangés ; Kente conservé en repli sur les autres routes.

## Nouvelle animation Absences
- La scène sélectionnée est conservée, avec calendrier, fiche et valise. Extraction des calques de la fiche et du couvercle à partir de l’image validée ; fond reconstitué localement pour permettre les mouvements. Aucun service d’image externe ajouté à l’application.
- Boucle CSS de cinq secondes : la fiche se déplace vers le calendrier et s’efface, la zone des jours se met en évidence, le couvercle descend pour refermer la valise, puis retour doux à la scène de départ.
- Même bandeau ndebele que la page en haut et en bas du chargement.
- Branchements sur les états réels existants `!accessChecked || loading` : distinction vérification d’accès / chargement des données. Pas de durée minimale imposée, de faux pourcentage, de validation de demande ou de modification du contrôle d’accès.
- État d’attente accessible, images décoratives, explication repliée par défaut.
- `prefers-reduced-motion: reduce` : calques animés masqués et image sélectionnée fixe affichée à la place.

## Vérifications
- **675 tests Vitest / 66 fichiers réussis**. Quatre nouveaux tests couvrent les chargements, les états accessibles, les calques et le mode sans mouvement, ainsi que l’intégration aux pages. Tests de correspondance des routes et d’assistant actualisés pour les nouvelles identités.
- Build Vite/PWA réussi ; ESLint gate zéro erreur et un warning préexistant dans EnterpriseSelectorModal ; diff sans erreur d’espacement.
- Chromium : vrais composants d’en-tête Pointages/Employés, chargements et AssistantDock dans un harnais de navigation. Navigation entre les quatre pages sans rechargement, correspondance des deux bandeaux assistant, contrôles des images et des boutons Passer.
- Matrice clair/sombre × 320/390/768/1440 px : aucun débordement global, aucun pageerror et aucune réponse HTTP en erreur.
- Animation : présence des animations CSS vérifiée, état de la fiche vérifié à 3,2 secondes, images décodées ; bascule du mode reduced-motion testée. Captures de bureau et mobile inspectées.
- Les essais navigateur sont des tests de composants intégrés dans un harnais, pas une session employeur authentifiée de bout en bout.

## Préservation métier et données
Aucune écriture réelle, aucun SQL, aucun changement de calcul, de permission, de statut d’absence ou de comportement de recherche. Manifests de dépendances inchangés. Les outils de préparation d’images et de QA, scripts et captures restent hors Git. Les seuls nouveaux binaires versionnés sont les sept assets WebP utilisés par l’interface (environ 550 Kio au total).
