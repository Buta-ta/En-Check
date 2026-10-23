# Billet animé — Pointages et Employés

23 octobre 2026 — branche `arena/19bfe3d3-en-check`.

## Demande
Reprendre le billet animé du Planning dans Pointages et Employés pour le salarié concerné, avec des explications pliables.

## Livraison
- Pointages : badge dans les vues Passeport, Groupée et Liste, sur le salarié concerné et pour la date consultée.
- Employés (gestion côté employeur) : badge dans les vues Portrait et Liste, pour une fiche couvrant le jour courant. Le détail affiche la date de référence. Le jour courant est recalculé chaque minute et au retour dans la fenêtre.
- Même SVG et même animation que le Planning, sans nouvelle image ni changement d’identité visuelle.
- Détails repliés par défaut : salarié, périodes couvertes, disponibilité dans l’espace salarié, distinction entre publication, paiement et jour travaillé.
- Le clic et les touches du badge ne déclenchent pas l’ouverture de la carte parente. Animation désactivée avec `prefers-reduced-motion`.
- Thème sombre étendu aux nouvelles pages, clair conservé.

## Données et sûreté
- Réutilisation du hook de métadonnées de Planning : statut sent, sent_at renseigné, fiche non retirée, filtrage par entreprise et chevauchement de période ; vérification locale du couple entreprise/salarié.
- Aucun montant de salaire chargé, aucune écriture, aucun SQL. Un calcul sans publication ne produit pas de billet.
- Chargement mutualisé par page/entreprise, pas de requête par carte ; pagination 500, réponses périmées ignorées, AbortController.
- Actualisation au focus, retour visible et chaque minute visible. En cas d’erreur, message explicite et bouton Réessayer, sans faux billet.
- Une fiche retirée disparaît après actualisation. Une fiche hors période ne marque pas le jour consulté, même si sa date d’envoi correspond à ce jour.
- Aucun changement dans le portail salarié ou le dépôt de l’application de pointage externe.

## Vérifications
- 660 tests Vitest, 63 fichiers, tous réussis. Quatre nouveaux tests : association au seul destinataire avec chargement mutualisé, changement de date, isolation clic/clavier, branchement dans les cinq vues.
- Tests existants conservés : entreprise, retrait, brouillon, sent_at absent, dates inclusives, pagination, erreur/reprise et réponses tardives.
- Build Vite/PWA réussi. ESLint gate : zéro erreur, un warning préexistant EnterpriseSelectorModal. Diff sans erreur d’espacement.
- Chromium : composants réels EmployesPortraitCard et PointagesPassportGrid, hook réel et réponses Supabase simulées. Un salarié avec fiche, un sans fiche ; changement de date ; retrait au focus ; ouverture Entrée sans sélectionner la carte ; réduction des animations. Aucun pageerror.
- Clair/sombre, 320/390/768/1440 px : absence de débordement global. Capture mobile sombre inspectée, détails ouverts lisibles.
- Les essais navigateur sont un harnais de composants, pas une session employeur de production de bout en bout. Aucun envoi ni modification de production effectué. Harnais et captures hors Git ; dépendances du dépôt inchangées.
