# Récupération MFA v2 — téléphone perdu

## État réel au 26 octobre 2026

Code intégré à la fiche Admin existante et à l'Edge `admin-mfa-recovery`.
**Migration020 APPLIQUÉE en production** (`admin_mfa_recovery_v2`) et **Edge
`admin-mfa-recovery` DÉPLOYÉE** (version 1, ACTIVE, `verify_jwt=false`, secret
`ADMIN_APP_ORIGIN=https://en-check.vercel.app`). La fonction historique
`encheck_mfa_recovery_prepare` (005) a été révoquée ; table `admin_mfa_recoveries_v2`
vide, zéro intervention. Aucun compte ou facteur réel modifié, aucune obligation
imposée, aucun secret Auth récupéré pour les tests. La préparation de récupération
(`prepare_v2`) reste **désactivée** tant que l'activation coordonnée 019 est
désactivée — elle l'est après installation.

## Parcours et contrôles

1. Un autre superadmin actif vérifie son propre facteur (AAL2), confirme l'adresse
   du titulaire et indique le contrôle d'identité effectué par un canal connu.
   L'adresse seule n'est PAS une preuve d'identité. Pas d'auto-récupération ni de
   récupération d'une identité Auth partagée/ambiguë ou d'un compte inactif.
2. `prepare_v2` vérifie l'activation019, le guard, la session, la cible et son adresse
   à la fois dans Admin et Auth. Transaction : crée/conserve l'obligation MFA,
   enregistre les sessions existantes comme révoquées et ouvre une intervention privée.
   La trace initiale de l'obligation n'est pas remplacée.
3. L'Edge, jamais le navigateur, réclame l'intervention via `claim_v2` service_role.
   Délai maximum2min pour la réclamer ; usage unique. UUID Auth résolu serveur,
   pas celui fourni par le client. Vérification de l'acteur actif/superadmin, de son identité et de sa session
   non révoquée avec facteur encore présent, et
   de la liaison cible avant le démarrage.
4. L'Edge retire les facteurs avec l'API Auth officielle. Aucun mot de passe ni
   secret TOTP n'est lu, retourné ou journalisé. Corps limité4096 octets en lecture
   streaming ; origine configurée, jeton Auth validé ; réponses non mises en cache.
5. `finish_v2` exige une intervention démarrée et vérifie en base que les facteurs
   ont réellement disparu et que la cible est encore active/liée au même UID.
   Il révoque aussi les sessions créées pendant l'intervention. Résultat idempotent.
   Succès HTTP uniquement si fournisseur ET confirmation SQL sont positifs.
6. Le titulaire ouvre une **nouvelle connexion**, configure un authentificateur,
   puis vérifie son facteur. L'obligation ne disparaît jamais. Un ancien JWT AAL2
   avec session révoquée reste refusé par le helper des policies intégrées, même
   lorsqu'un nouveau facteur a été inscrit.

## Erreurs, interruption et consultation

- Statuts : pending, running, completed, failed (none si aucune intervention).
- Consultation explicite sur la fiche Sécurité, réservée au superadmin MFA.
  Aucun succès déduit d'une réponse absente, ambiguë ou simplement sans erreur.
- Pending/running : aucune deuxième préparation autorisée, même après2min.
  Un worker interrompu exige une vérification opérateur ; pas de réinitialisation
  automatique du job, qui pourrait permettre à un ancien worker de supprimer un
  facteur fraîchement réinscrit. Pas d'API navigateur d'annulation/déblocage.
- Failed : accès métier conservé bloqué. Après inspection de la cause, une nouvelle
  demande est possible au-delà de2min. Le dernier job terminé avec succès débloque
  seulement le parcours normal d'enrôlement, pas l'accès métier sans MFA.
- L'UI permet de consulter l'état avant toute relance. L'email et le motif ne sont
  effacés qu'après une confirmation explicite de succès.

## Périmètre exact des révocations — limite avant activation

Les révocations sont enregistrées dans `admin_session_revocations` et appliquées
aux guards REST et aux policies utilisant le helper019/020. **Ce n'est pas une
suppression des sessions/refresh tokens dans Supabase Auth** : les autres opérations
Auth natives ne sont pas automatiquement contrôlées par ce helper SQL. Leur
comportement avec un ancien JWT doit être recetté et l'invalidation native résolue
avant de promettre une fermeture universelle des sessions.

Cela ne détruit pas les copies déjà téléchargées ni les URL déjà signées, ne certifie
pas les connexions Realtime déjà ouvertes ni les chemins anon/Edge/service_role
historiques. Les canaux non couverts sont des conditions d'activation, pas des
protections déjà déployées. Le dernier superadmin sans facteur fonctionnel ne peut
pas se récupérer lui-même : prévoir un second facteur et un autre intervenant habilité.

## Déploiement coordonné, pas de replay global

1. Vérifier018 et le client Login/MFA public. Le titulaire inscrit lui-même son
   facteur ; ne jamais demander QR, clé ou code par le chat/document partagé.
2. Recetter019 +020 sur comptes de test autorisés, y compris l'accès aux canaux
   hors REST et la fermeture des anciennes sessions Auth. Installer019 avant020.
3. Si une ancienne Edge de récupération existe : arrêter les demandes et attendre
   la fin de ses workers.020 refuse les jobs historiques non terminés et révoque
   l'exécution authentifiée de l'ancienne RPC prepare pour éviter un chemin sans
   obligation. Ne pas réappliquer005/019 après020 sans migration adaptée.
4. Déployer l'Edge v2 après020. Configurer ADMIN_APP_ORIGIN sur l'origine HTTPS exacte
   de l'Admin. Clé service_role uniquement côté Edge. Déployer le client actualisé.
5. Après recette native et revue des canaux : seulement alors autoriser l'émission
   via `admin_mfa_policy_config`. Ce lot n'active pas ce réglage.

Les journaux de récupération sont privés et consultables via un état minimal. La
consultation complète de l'historique reste une opération support autorisée, pas
un accès direct de l'interface à la table.

## Tests

12 scénarios SQL PGlite : activation, acteur, identité, auto-récupération, obligation,
révocations, ACL, usage unique, expiration, facteur résiduel, nouvelle connexion,
ancien JWT, historique et fermeture de l'ancienne RPC. Cinq tests handler injecté
et quatre tests UI : limites, origine, refus, échec partiel, confirmation explicite,
état sans relance. Deno type-check de l'Edge, ajouté à la CI.
Tests isolés ≠ recette MFA native en production.
