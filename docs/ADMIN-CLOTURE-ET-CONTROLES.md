# Administration — clôture, transfert et contrôles des anciens accès

## Ce qui est codé dans ce lot

### Clôture définitive, sans destruction de l’historique

- Demande par un superadministrateur en AAL2 ; compte cible inactif et archivé depuis **sept jours**. Ce délai est un garde-fou produit, pas une durée légale de conservation.
- Approbation/exécution par **un autre superadministrateur**, lui aussi en AAL2. Le demandeur doit encore être actif et superadmin au moment de l’approbation. L’identité Auth doit être identique à celle enregistrée lors de la demande ; un rattachement modifié invalide l’ancienne demande.
- Refus tant que des prospects ouverts sont encore affectés au compte.
- Transaction SQL de clôture : retrait des liens d’entreprise, préférences personnelles, observations de sessions, exigences de mot de passe ; révocation des délégations ; effacement des champs de profil identifiants et détachement d’Auth. L’UUID historique reste présent.
- Après clôture, un déclencheur interdit la modification, la réactivation ou la suppression de la ligne historique, y compris par les anciens chemins d’écriture.
- Nettoyage Edge reprenable : seuls les fichiers listés sous `admin-avatars/<Auth UUID>/` sont supprimés. Aucun chemin arbitraire reçu du navigateur n’est utilisé.
- Auth est supprimé seulement pour une identité non partagée. Si elle est liée à un employé ou à un autre compte, elle est conservée. Un déclencheur protège également contre la suppression d’une identité devenue référencée **après** la vérification initiale.
- La finalisation SQL vérifie l’absence des photos et, pour une identité exclusive, l’absence du compte Auth. Un échec réseau ne réactive pas le profil et n’est pas annoncé comme un succès.

**Limites explicites :** c’est une pseudonymisation de la fiche administrative, pas une attestation d’effacement de toutes les données personnelles. Les identifiants historiques, dates et textes libres des journaux restent conservés. Les fichiers anciens qui ne se trouvent pas dans le dossier d’avatars lié à l’identité Auth nécessitent une revue séparée. Une identité Auth partagée reste sous la protection de son autre parcours métier.

Les anciens identifiants de session enregistrés comme révoqués restent refusés par le nouveau contrôle RLS, même après détachement du profil. Pour une identité partagée, une reconnexion peut être nécessaire : conservation de l’identité ne signifie pas conservation de toutes ses anciennes sessions.

### Transfert réel des responsabilités

La lecture des schémas de production a confirmé :
- `prospects.assigned_to` est une responsabilité actuelle ; les prospects non `signe`/`perdu` sont transférables.
- Le repreneur doit être un superadmin actif, car la politique actuelle de prospection réserve l’écriture aux superadmins.
- `tasks.assigned_employee_id` et `teams.leader_employee_id` désignent des employés, pas des administrateurs : aucun remplacement d’employé n’est effectué par ce parcours.
- Les auteurs, validateurs et signataires historiques (`created_by_admin_id`, `validated_by`, paie, pointages) ne sont jamais réattribués.

### Renforcement des contrôles de session

La migration `20261025000009` :
- retire les recherches et rattachements automatiques par e-mail de `encheck_admin_courant` et `encheck_est_super_admin` ;
- exige une identité Auth unique, active, avec une session admise ;
- impose `is_active IS TRUE`, y compris dans `admin_has_access_to_enterprise` ;
- ajoute une politique **restrictive** aux tables publiques, à `storage.objects` et à `realtime.messages` lorsque cette dernière existe ; elle s’ajoute aux politiques existantes, sans accorder de droits ;
- refuse de s’installer si une table de ce périmètre n’a pas RLS ou si des identités administrateur actives sont non liées/ambiguës.

Les cinq anciennes Edge JWT (`assistant-chat`, `assistant-explain`, `test-ai-search`, `send-email`, `send-push`) appellent désormais le contrôle de session en **contexte du JWT appelant**, avant les lectures/opérations privilégiées. Une migration absente ou un contrôle indisponible provoque un refus, pas un contournement. Les appels système par secret serveur de mail/push restent des appels système, pas des délégations utilisateur.

Ce renforcement ne constitue pas une nouvelle matrice de permissions par module/action. Les rôles personnalisés restent à implémenter. Les futures tables devront recevoir les politiques appropriées ; les vues, les futures Edge et les fonctions SECURITY DEFINER continuent d’exiger une revue de leurs autorisations métier. Les objets Storage publics restent publics tant qu’ils existent.

## Correction réellement appliquée en production

Le 25 octobre 2026, l’audit a confirmé que la primitive interne `encheck_auth_creer_compte(text,text,text,text,text,uuid)` :
- était `SECURITY DEFINER`, sans autorisation d’appelant dans son corps ;
- construisait un compte Auth avec adresse confirmée ;
- était exécutable par `anon` et `authenticated`.

**Une seule correction ciblée a été exécutée :** retrait d’EXECUTE à PUBLIC, anon et authenticated sur cette primitive. Le propriétaire garde EXECUTE ; les fonctions internes SECURITY DEFINER peuvent continuer à l’appeler. La fonction publique de création administrateur contrôlée par superadmin conserve son autorisation existante.

Contrôle après exécution :

| Fonction | anon | authenticated | propriétaire |
|---|---:|---:|---:|
| Primitive interne de création Auth | non | non | oui |
| `create_admin_auth_user(...)` | non | oui | oui |

La migration reproductible est `20261025000008_admin_auth_internal_creation_private.sql`. L’outil a répondu succès avec une version non renseignée : vérifier l’historique de migrations avant de synchroniser les versions CLI. Le REVOKE est idempotent. Aucun compte n’a été créé/modifié/supprimé pour vérifier la faille.

Préflight agrégé en lecture seule : **0** admin actif sans identité Auth ; **0** identité Auth ambiguë ; **0** identité active partagée avec un employé au moment du contrôle. Ces nombres ne remplacent pas une nouvelle vérification avant déploiement.

**Les migrations 07/09 et les nouveaux déploiements Edge n’ont pas été activés en production.** Les migrations des lots précédents ne sont pas considérées comme installées par cette correction ciblée.

## Vérifications effectuées

- **831 tests / 88 fichiers réussis**, comprenant SQL PGlite, tests React du parcours de clôture et tests du contrôle commun Edge.
- Tests SQL de double approbation, délai d’archive, conservation des auteurs, identité partagée, dépendance ajoutée après clôture, blocage de réactivation, nettoyage partiel et finalisation idempotente.
- Tests RLS synthétiques : une session révoquée n’accède plus aux tables publiques, Storage et Realtime, même sans invocation manuelle du hook REST.
- Build Vite/PWA réussi ; gate ESLint : zéro erreur, un avertissement préexistant.
- Deno check réussi sur `admin-retirement`, `assistant-chat`, `assistant-explain` et `test-ai-search`. Les deux anciennes Edge mail/push utilisent des imports distants préexistants ; leur câblage est couvert par les tests, pas une recette fournisseur.
- Aucun appel réel de suppression Auth, aucun effacement de photo et aucune nouvelle recette visuelle navigateur dans ce lot. Les captures du lot précédent ne sont pas des captures de cette nouvelle clôture.

## Ordre de mise en service

1. Recetter dans un environnement isolé avec des comptes de test ; vérifier les dépendances et le stockage.
2. Installer les migrations comptes précédentes puis 07 ; synchroniser la correction ciblée 08 déjà effectuée.
3. Déployer le nouveau client de connexion/MFA/mot de passe et vérifier ses parcours ; ne jamais activer les nouveaux contrôles sur un ancien client non compatible.
4. Vérifier RLS, identités et clients employés ; installer 09 et activer le hook REST selon l’outil SQL existant.
5. Déployer les Edge mises à jour avec `_shared/admin-session.js`. Configurer `ADMIN_APP_ORIGIN` pour `admin-retirement`, exactement comme les autres Edge d’administration.
6. Recetter Auth + Storage + Realtime réels, la reprise après erreurs et les identités partagées. Ne pas tester la suppression sur des comptes réels.

`supabase/audit/admin_authorization_inventory.sql` produit un inventaire reproductible en lecture seule : politiques, droits d’exécution, empreintes des fonctions, vues et dépendances. Il n’exporte ni lignes de comptes, ni corps de fonctions susceptibles de contenir des secrets. Les indicateurs heuristiques ne prouvent pas l’absence de faille.

## Restants — chantier non clôturé

- Rôles personnalisés et permissions métier par module/action/entreprise sur tous les chemins autorisés.
- Revue exhaustive des anciennes RPC et des vues : le contrôle de session ne remplace pas les vérifications de permission de chaque action métier.
- Recette réelle en environnement isolé, déploiements et activation coordonnée des fonctionnalités nouvelles.
