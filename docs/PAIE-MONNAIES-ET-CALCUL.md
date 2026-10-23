# Paie — médaillons monétaires, lisibilité et correction du calcul

23 octobre 2026 — suite de la PR #100, sur `arena/03586e2f-en-check`.

## Demande utilisateur

Conserver les bandeaux bogolan, retravailler le sélecteur entreprise et l'indicateur pays/devise, les cinq rubriques, le compteur salariés, l'alignement Historique, les contrôles avant calcul et les graphiques. Respecter la police de l'application. Corriger l'erreur `filter is not a function` pendant la génération et examiner le 406.

## Corrections fonctionnelles

### Plantage de génération : cause identifiée

`filtrerPointagesPayables` reçoit un tableau et retourne un tableau filtré. `calculateWorkedMinutesByDay` l'utilisait comme prédicat via `.filter(filtrerPointagesPayables)` : chaque objet pointage devenait donc son argument et le `.filter()` interne levait l'exception vue dans la console.

Correction : appliquer le filtre de liste avant le filtrage par salarié. Même correction dans la copie de calcul de `Rapports.jsx`. Pas de modification des seuils, de la borne du 16 octobre ni des règles de paiement des estimations.

Régressions couvertes : pointages réels, autre salarié, liste vide/null, rebond neutralisé, estimation non validée, estimation validée, estimation remplacée, non-rétroactivité, appel réel `getEmployeeEnCheckData`. Aucun pointage ni bulletin existant n'a été modifié.

### HTTP 406 : lectures facultatives ciblées

Les lectures d'une configuration possiblement absente utilisaient `.single()` : zéro ligne peut générer une réponse 406. Passage à `.maybeSingle()` dans les lectures de payroll_settings (paie, congés et recherche d'existence avant sauvegarde) et overtime_settings. La lecture des paramètres de paie laisse désormais remonter les vraies erreurs au lieu de calculer avec des valeurs par défaut ; une erreur de recherche d'existence empêche la sauvegarde.

L'URL de la requête 406 de l'utilisateur n'a pas été fournie. Ces cas de zéro ligne sont corrigés, mais l'attribution précise du 406 observé reste non démontrée. Les lectures qui exigent réellement une ligne, notamment l'employé et l'entreprise, restent strictes. Les autres stratégies de repli historiques hors de ce périmètre ne sont pas refondues.

## Interface

- Bandeaux haut et bas inchangés : aucune régénération ni modification des assets validés.
- Médaillons SVG originaux inspirés des monnaies, ronds striés, octogonaux cuivrés et bimétalliques ; pas de reproduction d'une monnaie officielle. Boutons clavier, libellés et état actif conservés.
- Entreprise dans un contrôle identifié, indicateur pays/devise avec médaillon. L'indicateur est informatif, pas un faux bouton.
- Bas d'en-tête occupé par la signature « Vos équipes. Votre rythme. » et les raccourcis, plutôt qu'une rangée vide.
- Historique aligné avec le bloc des dates ; adaptation à une deuxième ligne sur les petites largeurs.
- Compteur intégré au titre du tableau et à un pied de tableau structuré ; état vide explicite.
- Contrôles regroupés par identifiant salarié, avec nombre de contrôles ET nombre de personnes concernées. Toutes les remarques sont conservées, y compris après la quatrième (zone défilable). Deux salariés homonymes ne sont pas fusionnés lorsque leurs identifiants sont présents.
- Aide repliable, actions calcul et import séparées ; les champs sociaux et d'embauche sont explicitement indiqués comme appartenant à la fiche Employé.
- Graphique annulaire des profils, légende chiffrée, graphique brut/net avec montants lisibles ; état d'attente sans montants inventés. Période affichée en français.
- Police globale existante conservée : pile Segoe UI / Tahoma / Geneva / Verdana / sans-serif, centralisée dans `--encheck-font-ui` sans changer la pile du body. Les contrôles de paie héritent de cette police, pas de nouvelle fonte décorative pour les chiffres ou les monnaies.

## Vérifications

- 609 tests Vitest / 59 fichiers réussis ; 55 tests Edge réussis.
- Lint : 0 erreur, 1 warning préexistant dans EnterpriseSelectorModal.
- Build Vite/PWA réussi, avertissement préexistant de taille des bundles ; diff-check réussi.
- Vérification réelle dans Chromium avec Playwright : écran Paie monté dans un harnais isolé, réponses Supabase interceptées et données simulées ; pas de connexion ni d'écriture en production. Captures desktop 1440px, sombre, mobile 390px. Aucun pageerror ; largeur document 1440/1440 et 390/390. Tableau et raccourcis défilent dans leurs propres conteneurs.
- La police calculée dans le navigateur est bien la pile globale attendue.
- Captures de travail hors dépôt : `/home/user/paie-coins-desktop.png`, `/home/user/paie-coins-dark.png`, `/home/user/paie-coins-mobile.png`. Dépendances navigateur et harnais hors livraison, pas d'ajout au package de l'application.

Limites : pas de test métier authentifié de production, pas de confirmation de l'URL exacte du 406, pas de nouveau SQL. Aucun déploiement production ni fusion automatique dans ce lot.
