# Planning — raccourcis paie et billet animé

23 octobre 2026 — branche arena/a5b57c02-en-check

## Navigation
- Le raccourci « Fiches de paie » du Planning ouvre `/paie`, donc l’accueil Préparation lorsque le module Bulletins est accessible (les règles d’accès existantes restent applicables).
- Le raccourci Fiches de paie est exclu de la bande de raccourcis de Paie & Fiscalité, sur tous ses onglets. Les autres raccourcis et ceux des autres pages sont conservés.

## Symbole de fiche envoyée
- Petit billet SVG original animé dans les cases salarié/jour en semaine et dans la vue jour.
- En vue mois, badge compact avec nombre de salariés concernés parmi ceux du filtre courant ; les noms et périodes sont accessibles en ouvrant le badge, y compris sans horaire planifié.
- Le repère couvre **chaque jour inclus dans la période du bulletin**, et non la date technique d’envoi. Les week-ends et repos peuvent être couverts : ce n’est pas une preuve de travail ou de paiement.
- Conditions : ligne `employee_payslips`, `status = sent`, `sent_at` renseigné, non retirée (`is_deleted` faux ou nul), salarié et entreprise correspondants. Un calcul local non envoyé ne crée aucun billet.
- Un clic ou Entrée/Espace ouvre le détail de la période et rappelle que la fiche est disponible dans l’espace salarié. Aucun montant de salaire n’est affiché ou même sélectionné par la requête.
- Actualisation manuelle, au retour dans la fenêtre et toutes les 60 secondes tant que le document est visible. Un retrait est reflété à la prochaine lecture réussie ; ce n’est pas une souscription temps réel.
- Erreur réseau/droits : message explicite et absence de badges non vérifiés. Les réponses obsolètes sont ignorées ; annulation au changement de contexte ou au démontage.
- Pagination par 500, filtre entreprise explicite et chevauchement de périodes (début bulletin ≤ dernier jour visible ; fin bulletin ≥ premier jour visible).
- Animation désactivée avec `prefers-reduced-motion`. Palette lisible claire/sombre, détail natif accessible au clavier.

## Vérification
- 637 tests Vitest / 62 fichiers réussis, dont 11 nouveaux tests couvrant filtrage, bornes, dédoublonnage, pagination, absence de montants, erreurs/reprise, retour fenêtre, retrait, réponses périmées, absence de contexte, badge et navigation.
- ESLint gate : 0 erreur ; 1 warning préexistant EnterpriseSelectorModal.
- Build Vite/PWA réussi, avertissement préexistant de taille des bundles.
- Chromium : composant réel et CSS du Planning, harnais de cellules avec données simulées ; 320, 390, 1440 px en clair/sombre ; ouverture clavier, réduction des mouvements et absence de débordement vérifiées. Zéro pageerror. Capture sombre inspectée.
- Le harnais navigateur ne reproduit pas la totalité du Planning ni le parcours authentifié d’envoi d’une fiche. Pas de publication, paiement ou retrait en production pour tester.

## Données et livraison
Aucun SQL ni changement de formule de paie. Aucune écriture de production. Client administrateur et RLS existants conservés, sans extension des droits. Dépendances inchangées : substitution xlsx temporaire pour installation locale seulement, manifests restaurés. Harnais, navigateur et captures hors Git.
