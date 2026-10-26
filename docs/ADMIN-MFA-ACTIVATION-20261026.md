# Socle MFA Admin — activation du 26 octobre 2026

## Extension du 26 octobre 2026 (après la recette titulaire)

Tout le reste du chantier Admin a été appliqué en production le même jour,
dans l'ordre strict (1 create_migration par réplique, chaque migration
transactionnelle/idempotente, préflight intégrés) :

- `admin_account_workspace` (20261024000001) et `admin_account_password`
  (20261024000002) : base comptes + bucket `admin-avatars` (public, 2 Mo,
  jpeg/png/webp) + service de mot de passe avec audit.
- Série 20261025000001→010 : sessions/révocations, invitations, cycle de vie
  (accès/archivage/rétablissement/délégation de support), mot de passe
  temporaire (checkpoint), récupération MFA historique (005, drainé par 020),
  alertes session, retrait de profil (retraite irréversible, AAL2, archivage
  ≥7 j, approbateur distinct), helpers Auth privés (008), canaux d'identité +
  policies restrictives `encheck_admin_session_restrictive` sur toutes les
  tables publiques (009), permissions personnalisées inactives (010 :
  framework `enabled=false`, guard final count=1 + `custom_guard_route`).
- Restauration de `encheck_admin_session_valid` stricte (count=1 + AAL2) après
  010, version alignée sur le socle 018.
- `admin_mfa_obligation` (019) : enveloppe du guard par
  `encheck_admin_request_guard_before_mfa`, policies `encheck_mfa_obligation`
  restrictives, émission désactivée (`enabled=false`, 0 obligation).
- `admin_mfa_recovery_v2` (020) : table `admin_mfa_recoveries_v2`,
  prepare/claim/finish/status v2, accès bloqué pendant récupération en cours.
- Edge `admin-mfa-recovery` (v1 ACTIVE, verify_jwt=false) + secret
  `ADMIN_APP_ORIGIN=https://en-check.vercel.app`.

Smoke GUC (simulation SQL, sans réseau PostgREST) : statut OK, sessions OK
(session courante marquée), alertes vides, `obligation_statut`
{required:false, satisfied:true}, admin sans AAL2 refusé 42501, employé et
anon inchangés, table de pointage borne non régressée (service_role seul).
Rien n'est activé : obligations 0, récupérations 0, rôles personnalisés 0.

## Exécuté réellement

- Préflight : aucun admin actif sans liaison Auth, aucun UID ambigu, aucun compte
  Auth référencé manquant ; aucun hook REST existant à remplacer. Aucun facteur
  Admin vérifié avant intervention.
- Client de production vérifié par GitHub : déploiement7329536099 en succès,
  commit `cc79d34179afe2f7c7d1f414eab520bc4c919b64`. Empreintes de Login,
  useAdminMfaCheckpoint et AdminMfaSettings identiques aux sources contrôlées.
- Migration018 `admin_mfa_core` exécutée via Supabase (version API:null).
  Seulement table privée des révocations et trois fonctions de contrôle.
  Aucun déploiement implicite des fonctionnalités001–010, aucun compte modifié.
- Script d'activation du hook exécuté en transaction avec préflight renforcé :
  `authenticator.pgrst.db_pre_request=public.encheck_admin_request_guard`.
  Notification de rechargement de configuration PostgREST envoyée.
- Post-check : configuration enregistrée, statut réservé à authenticated,
  helper et table privés, zéro révocation et toujours zéro facteur vérifié.
  Smoke sous rôle anon réel, sans jeton, avec rollback : guard passe,
  profil/visage refusent le jeton absent normalement.

**Limite de preuve :** configuration SQL et notification confirmées ; pas de
requête HTTP PostgREST avec une session personnelle réelle, ni de scan TOTP natif
par l'agent. L'écran doit confirmer `rest_guard_active=true` avant d'autoriser
l'inscription. Si le bouton reste désactivé, ne pas le forcer : vérifier le
rechargement PostgREST et la session Auth.

## Recette titulaire réussie — 26 octobre, en fin de journée

Le titulaire a exécuté les étapes ci-dessus : facteur Google Authenticator inscrit
et **Vérifié**, puis nouvelle connexion en fenêtre privée où le code a été demandé
et accepté avant l'accès aux données Admin. Le scan TOTP natif, que l'agent ne
peut pas réaliser à sa place, est donc couvert par la recette du titulaire.

## Ce que protège ce socle

REST/RPC : admin actif, UID unique, session Auth présente/non expirée/non révoquée.
Sans facteur vérifié, AAL1 reste accepté pour permettre l'enrôlement initial.
Dès qu'un facteur est vérifié, AAL2 devient obligatoire pour les requêtes Admin.
Les opérations de bornes conservent leur exigence stricte AAL2 même sans facteur.
Le guard n'impose pas d'identité Admin aux appels anon, employés Auth sans compte
Admin ou service_role sans UID Admin : ces circuits gardent leurs propres règles.
Aucune restriction Pointage/ADMS spécifique n'a été modifiée.

Ce hook ne protège PAS à lui seul Storage, Realtime ou les chemins service_role
et n'efface pas les anciennes permissions anonymes. Le MFA n'est pas encore
obligatoire pour tous les comptes sans facteur. Aucun rôle personnalisé010 activé.
Les anciennes policies photos restent ouvertes jusqu'à la bascule coordonnée.
La migration conserve les guards plus récents lorsqu'ils existent ; ne pas rejouer
aveuglément les anciennes migrations001–010, qui peuvent les remplacer.

## Action du titulaire, maintenant

1. Sur l'application habituelle : **Mon compte → Sécurité → Double authentification**.
2. Cliquer **Actualiser la configuration**, puis **Ajouter un authentificateur**.
3. Scanner le QR avec une application d'authentification et confirmer ses six chiffres.
   QR, clé et codes sont confidentiels : ne pas les envoyer à l'agent ni à Pointage.
4. Vérifier la mention **Vérifié**, puis tester une connexion dans une seconde fenêtre
   privée en gardant la session actuelle ouverte. Le code doit être demandé avant
   l'accès aux données Admin.
5. Prévoir un second facteur vérifié/conservation sûre. Le service de récupération
   MFA n'est PAS déployé par ce lot ; aucun code de secours n'est fourni.
6. Une fois cette recette réussie : autoriser une borne de recette via Admin → Rôles
   → Bornes de pointage autorisées. Transmettre son secret par un canal sécurisé,
   jamais dans le document de coordination. Rien n'a été provisionné automatiquement.

L'agent ne peut pas enrôler un facteur à la place de son titulaire. La récupération
administrative et les autres sections encore non déployées de Mon compte ne sont
pas rendues opérationnelles par ce socle minimal.

## Tests

- 6 tests SQL isolés : bootstrap, AAL1/AAL2, session absente/expirée/révoquée,
  inactivité/doublons, canaux non Admin, ACL, conservation d'un guard plus récent,
  activation idempotente/refus d'un autre hook ou d'une liaison Auth manquante.
- 2 tests UI d'inscription : blocage sans statut serveur, enrôlement/confirmation
  explicites, retrait du secret de l'écran après succès. Auth simulée, pas réelle.
- Tests existants MFA challenge et sécurité SQL : 8 PASS lors du contrôle ciblé.

## Si incident d'activation

Ne pas supprimer les facteurs ni rouvrir les photos. Vérifier la session et les
logs PostgREST. Une désactivation temporaire du hook serait un recul de sécurité :
uniquement sur décision opérateur explicite avec trace d'incident et plan de reprise.
Ne pas effectuer de rollback automatique qui laisserait croire la MFA obligatoire
alors que le contrôle REST ne l'est plus.
