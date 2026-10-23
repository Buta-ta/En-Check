# Planning kuba et bandeau contextuel de l’assistant

23 octobre 2026 — branche `arena/1ed749bd-en-check`.

## Demande
Appliquer le nouveau bandeau sélectionné au Planning et à son chargement. Adapter le bandeau de la barre de recherche intelligente à la page consultée.

## Réalisation
- Illustration kuba sélectionnée par l’utilisateur (`planning-motif-kuba.png`), interprétation contemporaine des textiles de RDC. Conversion WebP 1086 × 362, environ 160 Kio ; proportions conservées, pas de recadrage ni nouvelle génération.
- Planning : nouveau bandeau en haut (76 px, 60 px mobile) et en bas (32 px). Le SVG Kente partagé n’est pas modifié pour les autres pages.
- Chargement Planning : même illustration, frise de 56 px (40 px mobile), étapes/scènes, progression et bouton Passer conservés.
- Composant `PageCulturalBand` et correspondance centralisée par chemin : Planning → kuba ; Absences → ndebele ; Paie / anciens liens fiches-paie et configuration-fiscale → bogolan ; autres routes → Kente existant (notamment Pointages, Employés et Pauses). Pas de nouvelle identité inventée pour les pages non redessinées.
- Assistant : le bandeau de la barre compacte ET celui du dialogue reçoivent directement `location.pathname`. Navigation SPA : le motif change sans rechargement. Aucun effet, préférence ou requête réseau ajouté pour sélectionner le motif ; aucun changement au moteur de recherche, aux conversations ou aux contrôles de confidentialité.
- Bandeaux décoratifs `aria-hidden`, proportions conservées et hauteur compacte adaptée au conteneur. Rendu indépendant du thème ; les thèmes et focus de l’assistant restent existants.

## Vérifications
- 671 tests Vitest / 65 fichiers réussis, dont cinq nouveaux cas : correspondance routes/sous-routes/alias/repli, nature décorative, chargement deux thèmes, présence des assets et intégration aux deux bandeaux réels de l’assistant.
- Les tests qui imposaient l’ancien Kente au Planning/chargement sont adaptés au nouveau choix explicite. Les tests du Kente partagé restent conservés.
- Build Vite/PWA réussi. ESLint gate : zéro erreur et un warning préexistant EnterpriseSelectorModal. Diff sans erreur d’espacement.
- Chromium : vrais AssistantDock et PlanningLoadingScreen dans un harnais de navigation. Parcours Planning → Absences → Paie → Pointages → Employés → Pauses → Rapports → Planning sans reload ; vérification des deux bandeaux, ouverture/fermeture du dialogue et bouton Passer le chargement.
- Clair/sombre, 320/390/768/1440 px : zéro débordement global, zéro pageerror et zéro réponse HTTP en erreur. Vérification des thèmes effectivement appliqués au dialogue. Captures de contrôle générées hors Git.

## Périmètre
Aucune donnée réelle lue/écrite pour la QA, aucun SQL, aucune modification de droits, de logique de planification ou d’IA. Tests navigateur réalisés dans un harnais de composants, pas une session de production authentifiée. Dépendances du dépôt inchangées. Harnais et outils QA hors Git.
