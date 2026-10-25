# Audit serveur — lectures d’employés (25 octobre 2026)

## Réellement corrigé

Migration 014 appliquée au projet en-check :

| Fonction | Avant | Après |
|---|---|---|
| encheck_employe_par_id(uuid) | propriétaire + accès anonyme | droits de l’appelant ; anon interdit |
| get_employees_by_enterprise(uuid) | propriétaire + accès anonyme | droits de l’appelant ; anon interdit |
| encheck_adms_carte_pins(uuid) | propriétaire + accès anonyme | droits de l’appelant ; anon interdit |

La première pouvait encore lire la vue `employees_public` sous les droits du propriétaire : **sécuriser une vue ne suffit pas si une fonction privilégiée la contourne**. La deuxième présente le même problème. La troisième lit les correspondances PIN machine / matricule / identifiant d’employé sans contrôle dans son corps.

Les corps et signatures n’ont pas été réécrits. La migration ne change que le mode d’exécution et les privilèges. Post-contrôles réels pour les trois fonctions : SECURITY DEFINER=false, anon=false, authenticated=true, service_role=true, propriétaire=true.

## Compatibilité vérifiée et limites

- Aucun appel direct aux trois fonctions trouvé dans `src` de ce dépôt ni dans `lib` de Pointage (main `25f4140`). Ce constat n’exclut pas un ancien client, un nom construit dynamiquement ou une intégration externe.
- Appel SQL interne repéré : `encheck_adms_ingest` utilise la carte des PIN. Il reste SECURITY DEFINER propriétaire postgres ; un sous-appel invoker hérite du contexte de cet appelant. Le privilège propriétaire a été conservé. Le corps et les droits de l’entrée ingest ne sont pas changés.
- Test PGlite : fonctions métier synthétiques pour vérifier exactement les privilèges et l’imbrication, pas une simulation complète de la logique ADMS. Anonyme refusé, utilisateur autorisé limité à son entreprise par RLS, autre entreprise invisible, service_role et appel interne propriétaire conservés, corps identiques avant/après, migration rejouable.
- Aucun pointage réel, aucune fiche ni aucun token employé consulté ou utilisé pour tester. Les preuves de production sont des métadonnées ; **pas de garantie de non-régression complète sans recette terrain**.
- API migration : version null. Rapprocher l’historique avant un déploiement CLI ; ne pas rejouer toutes les anciennes définitions après les correctifs.

## Blocage découvert côté Pointage

La lecture du dépôt tiers a confirmé des accès anonymes directs à la vue fermée par 011. Cette dépendance n’avait pas été vérifiée lors de sa fermeture. Je ne peux donc pas certifier que cette ancienne correction n’a affecté aucun parcours Pointage.

Voir [contrat et fiche de liaison Pointage](CONTRAT-POINTAGE-ACCES-EMPLOYES.md). Aucun fichier du dépôt tiers n’est modifié. Ne pas rétablir l’exposition RH comme solution de compatibilité.

## Ce qui reste à faire

- Terminer la revue des autres fonctions privilégiées et de leurs dépendances, avec preuves d’usage avant chaque changement. Le compteur des accès anonymes n’est pas une certification de sécurité.
- Coordonner les lectures individuelles, le cache de borne et le périmètre biométrique avec l’équipe Pointage.
- Recette réelle Auth/MFA/SMTP, sessions et Edge ; activation graduelle Admin, toujours distincte des correctifs ciblés.
- Les rôles personnalisés restent désactivés ; aucune empreinte de fonction approuvée en masse.

`supabase/audit/public_rpc_triage.sql` fournit un inventaire reproductible en lecture seule (signatures, privilèges, empreintes et appelants SQL possibles). Les indices « jeton » ou « trigger » ne valent jamais approbation. Les appels dynamiques/externes nécessitent une revue complémentaire.

## Résultats de livraison

- Inventaire après correction : **97 fonctions publiques SECURITY DEFINER exécutables par anon**, contre 100 avant cette tranche. Les trois fonctions corrigées existent toujours, mais n’utilisent plus ce mode privilégié.
- Suite complète : **912 tests / 97 fichiers réussis**. Build Vite/PWA réussi ; lint gate : aucune erreur, un avertissement préexistant.
- Aucun changement de l’interface Admin ou du design de Dev 1.
