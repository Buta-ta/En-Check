# Administration — rôles personnalisés et contrôle serveur

## État de livraison — 25 octobre 2026

**Code livré, activation générale NON effectuée.** La migration `20261025000010` et le script d’activation séparé n’ont pas été exécutés en production. Les migrations précédentes du chantier Admin et les Edge doivent également suivre leur procédure de déploiement : cette livraison ne les active pas implicitement.

Deux corrections ciblées ont réellement été appliquées dans le projet `en-check` :
- précédemment, retrait de l’accès client à la primitive interne de création Auth (migration de traçabilité 008) ;
- dans cette tranche, `employees_public` passe en `security_invoker=true` et perd tous les privilèges PUBLIC/anon (migration de traçabilité 011).

Post-contrôle de 011, sur métadonnées uniquement : `anon SELECT=false`, `authenticated SELECT=true`, option `security_invoker=true`. Vérification complémentaire : aucun droit anonyme de lecture par colonne ; aucune autre vue non invoker exposée à anon/authenticated, y compris par droits de colonne. Aucun compte ni aucune ligne d’employé modifié/consulté pour cet audit. Les droits de lecture des utilisateurs connectés dépendent maintenant des règles existantes sur `employees` ; ce contrôle n’est pas une certification de toutes ces règles.

**Contrat pour l’équipe de l’application Pointage :** aucun usage de `employees_public` repéré dans ce dépôt. Tout consommateur anonyme de cette vue doit désormais s’authentifier et disposer des permissions de la table source. Vérifier les parcours de l’application tierce avant sa prochaine livraison ; son dépôt n’a pas été modifié. La vue n’a pas été supprimée ni ses colonnes changées.

## Fonctionnalités codées

- Onglet Rôles : création de versions immuables, règles par entreprise/module/action, catalogue et compteurs d’attribution.
- Attribution/retrait explicites, motif obligatoire, confirmation et MFA côté serveur. Pas d’auto-attribution, pas de modification de ses propres privilèges, pas de rôle personnalisé sur un superadmin.
- Mon compte : lecture des permissions renvoyées par le serveur, noms des entreprises ; erreur explicite si le service est absent.
- Journal : création/attribution/retrait et écritures métier sous rôle personnalisé, sans copie des données RH.
- RLS restrictives : elles s’ajoutent aux politiques existantes, elles ne donnent pas à elles seules un accès auparavant interdit.

| Module | Tables couvertes |
|---|---|
| Employés | employees |
| Pointages | attendances |
| Planning | work_schedules |
| Paie | employee_payslips, payroll_bonuses, payroll_deductions |
| Tâches et équipes | tasks, teams |

Actions : lire, créer, modifier, supprimer. Lire est obligatoire dans une règle. Les références employé/équipe sont contrôlées pour éviter les rattachements interentreprises. Les auteurs historiques ne peuvent pas être remplacés et les validations au nom d’un tiers sont refusées.

Tables métier non couvertes : refus pour les comptes à rôle personnalisé. Exceptions de lecture limitées : propre compte, propres événements/liens et entreprises accordées. Storage privé et Realtime refusés pour ces comptes ; les ressources publiques restent publiques. Les écrans métier/navigation ne sont pas encore tous adaptés à ce modèle : **ne pas présenter ce moteur comme compatible avec tous les parcours existants**.

L’attribution positionne le rôle historique à `admin` et remplace les liens d’entreprises. Le retrait explicite conserve ces liens et revient aux droits historiques `admin` : ce n’est PAS la restauration automatique du précédent rôle manager, ni un blocage du compte. L’interface avertit de ce retour aux droits historiques. Pour bloquer un compte, utiliser son état d’accès.

## Blocages et limites de sécurité

- Comptes ambigus, sans liaison Auth ou liés à un employé : attribution refusée.
- Le contrôle REST refuse les RPC non auditées pour les comptes restreints et vérifie les empreintes des RPC autorisées. Les empreintes déjà enregistrées ne sont pas réapprouvées automatiquement en rejouant 010.
- Le préflight recherche notamment les tables sans RLS/couverture, vues non invoker, relations calculées à argument composite, fonctions applicatives dans les vues et fonctions publiques SECURITY DEFINER exécutables anonymement sans revue.
- Audit production : **102 fonctions publiques SECURITY DEFINER exécutables par anon** recensées. Cela n’établit pas 102 vulnérabilités : examen individuel des signatures, corps, appels transitifs, déclencheurs et droits requis nécessaire. Ne pas les approuver/révoquer en masse.
- La seule vue non invoker exposée repérée était `employees_public` ; correction ciblée effectuée ci-dessus.
- Le garde partagé des cinq Edge de gestion des comptes refuse maintenant `custom_role_restricted=true`. Les autres Edge/service-role doivent encore être auditées avant activation ; les requêtes service-role contournent les RLS.
- Les empreintes ne certifient pas les dépendances transitives d’une fonction. Toute évolution de schéma, de fonction, de politique ou de canal nécessite une nouvelle revue. Mesurer le coût du préflight et des RLS sur une volumétrie représentative.

## Déploiement encadré

1. Suivre les documents des migrations 001–009 ; tester Auth réel, hook REST, MFA, SMTP, Storage, Edge et parcours de l’application tierce sans supprimer/modifier de vrais comptes pour tester.
2. Appliquer 010 après ses dépendances, dans l’ordre ; elle laisse `enabled=false`. Ne pas rejouer les anciennes définitions après 010.
3. Confirmer la correction 011 déjà appliquée en production et rapprocher l’historique de migrations avant un déploiement CLI. L’API a renvoyé `version:null` pour les corrections ciblées : ne pas supposer qu’un historique CLI complet est enregistré.
4. Exécuter l’inventaire `supabase/audit/admin_authorization_inventory.sql`, examiner individuellement les fonctions anonymes et les canaux, corriger ou enregistrer uniquement des revues réellement terminées avec signature/empreinte/note. Garder les attributions désactivées tant que des risques restent ouverts.
5. Déployer le client et les cinq Edge avec leur garde commun ; auditer également les autres Edge. Vérifier en environnement contrôlé les scénarios autorisés ET interdits avec JWT réellement émis par Auth.
6. Seulement ensuite, exécuter `supabase/outils-sql/20261025_activer_roles_personnalises.sql`. Le script refuse les blocages du préflight et les paramètres manquants. Un préflight vide ne remplace pas la revue humaine des autres canaux.

Désactiver `enabled` empêche les **nouvelles attributions**, sans enlever les restrictions des comptes déjà liés. Ne jamais supprimer ces restrictions comme stratégie de retour arrière : retirer explicitement un rôle avec motif et connaissance des droits historiques retrouvés, ou désactiver le compte.

## Vérifications réalisées

- Suite complète : **847 tests, 91 fichiers PASS**.
- SQL PGlite : 9 tests avec vraies migrations du chantier et données entièrement fictives — idempotence, attribution désactivée, scopes/actions, falsification d’auteur, refus de RPC, Storage/Realtime, identités ambiguës, fonction anonyme non revue, dérive des fonctions/vues/schéma, retrait audité, correction 011 et RLS de la vue.
- Interface : 4 tests catalogue/création/activation/erreurs + 2 tests Mes permissions.
- Garde partagé Edge : 4 tests dans la suite.
- Build Vite/PWA réussi. ESLint gate : aucune erreur, un avertissement préexistant dans EnterpriseSelectorModal. `git diff --check` réussi.
- Navigateur : 8 scénarios catalogue/éditeur, 390 et 1440 px, clair et sombre ; aucun débordement horizontal ni erreur JavaScript. Auth/REST interceptés avec fixtures, aucune requête de modification réelle. Ces captures ne prouvent PAS une activation Supabase/SMTP/MFA.

### Captures (données fictives)

- [Ordinateur, clair](captures/admin-roles-1440-clair.png)
- [Ordinateur, sombre](captures/admin-roles-1440-sombre.png)
- [Mobile, clair](captures/admin-roles-390-clair.png)
- [Mobile, sombre](captures/admin-roles-390-sombre.png)

Les tests locaux ne simulent pas GoTrue, les fournisseurs de messagerie, tous les canaux Supabase ni la concurrence réelle. Le chantier fonctionnel global ne doit donc pas être déclaré intégralement activé sur la seule base de cette suite.
