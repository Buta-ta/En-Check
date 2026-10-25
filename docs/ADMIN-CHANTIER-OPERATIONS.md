# Administration — invitations, récupération et cycle de vie

> État du lot précédent. Les ajouts de clôture, transferts, contrôles de session et la correction ciblée réellement appliquée sont décrits dans [ADMIN-CLOTURE-ET-CONTROLES.md](ADMIN-CLOTURE-ET-CONTROLES.md).

## État de la livraison

**Code livré, pas activé sur Supabase. Le chantier global n’est pas terminé.**
Ce lot conserve le registre sans sidebar et le motif Bogolan déjà validé.

| Fonction | Code présent | Limites |
|---|---|---|
| Invitations | Formulaire, Edge Auth, journal, expiration 7 jours, renvoi, annulation, activation | SMTP/Auth et redirections à configurer ; accusé fournisseur ≠ livraison dans la boîte mail |
| Droits existants | Attribution serveur des rôles admin/manager/super_admin et entreprises dans la fiche | Pas de rôles personnalisés ni matrice de permissions par module/action |
| Récupération par lien | Demande générique sans exposer l’existence d’un compte, parcours de nouveau mot de passe | Auth et MFA restent requis ; recette fournisseur réelle non exécutée |
| Mot de passe temporaire | Empreinte du hash Auth salé, contrôle serveur de changement obligatoire, retrait de deux anciens points d’entrée | Exige le hook REST/RPC actif ; les autres anciens services Auth restent à auditer |
| Récupération MFA | Intervention d’un autre superadmin en AAL2, confirmation de l’adresse, motif, intention/résultat journalisés | Pas de codes de secours ; pas d’auto-récupération du dernier superadmin ; échec partiel possible entre Auth et SQL |
| Archivage | Désactivation, blocage des modifications historiques, restauration sans réactivation automatique | Pas de suppression définitive |
| Transfert | Transfert optionnel des accès d’entreprise à un compte actif | Pas de réattribution des tâches, prospects ou validations métier |
| Assistance | Diagnostic limité à cinq indicateurs, délégation 1–24 h et révocation | Ni usurpation de session, ni accès métier délégué, ni lecture des secrets |
| Journal | Déclencheurs comptes/liens d’entreprise, mots de passe Auth et événements des nouveaux parcours | Non rétroactif ; ne couvre pas toutes les opérations Auth/Edge ou métier |
| E-mail | Changement via Auth et synchronisation de l’adresse confirmée côté serveur | Confirmer la configuration Auth de vérification des e-mails avant activation |
| Connexions inhabituelles | Détection d’un navigateur déclaré inédit après une première observation, alertes dans Mon compte | Heuristique User-Agent seulement, falsifiable ; ni géolocalisation ni e-mail d’alerte |
| Ancienne interface | Ancienne route redirigée vers le registre ; invitations et opérations intégrées à la fiche | Les anciennes RPC ne sont pas toutes retirées ; ne pas confondre retrait UI et sécurisation serveur |
| Cache | Suppression du cache API Supabase Workbox et nettoyage du cache historique | Déployer le nouveau service worker, fermer/recharger les anciens onglets avant recette de sécurité |

Les remplacements de mot de passe support et récupérations MFA bloquent les sessions Auth existantes pour REST/RPC. Ils ne prétendent pas révoquer universellement Storage, Realtime, Edge service-role ou les tokens de rafraîchissement Auth.

## Vérifications

- Tests SQL PGlite sur schémas synthétiques : identité vérifiée, expiration, rejeu, annulation concurrente à la livraison, rôle, archivage, transfert, expiration/révocation des délégations, mot de passe obligatoire, récupération MFA et alertes.
- Tests React récupération : confirmation, erreurs fournisseur masquées, ordre Auth/activation, déconnexion, contrôle du mot de passe temporaire.
- Suite complète : **814 tests / 85 fichiers** réussis.
- Build Vite/PWA réussi ; gate ESLint : zéro erreur et un avertissement préexistant ; vérification TypeScript Deno des deux Edge réussie.
- Chromium : **12 scénarios** (invitations, fiche Accès, récupération × 390/1440 px × clair/sombre), réponses Auth/REST fictives, absence de débordement horizontal et d’erreur JavaScript.
- Aucun e-mail réel envoyé, aucun facteur réel supprimé, aucune migration appliquée, aucun compte réel modifié.

### Captures sur données fictives

| Écran | Bureau | Mobile |
|---|---|---|
| Invitations | [1440 px](captures/admin-invitations-1440.png) | [390 px](captures/admin-invitations-390.png) |
| Accès et opérations | [1440 px](captures/admin-acces-1440.png) | [390 px](captures/admin-acces-390.png) |
| Récupération | [1440 px](captures/admin-recuperation-1440.png) | [390 px](captures/admin-recuperation-390.png) |

## Mise en service — ordre obligatoire

1. Sauvegarde et recette dans un environnement isolé. Ne pas utiliser de vrais comptes pour les essais de récupération, d’archivage ou de révocation.
2. Appliquer dans l’ordre les migrations comptes `20261024000001_admin_account_workspace`, `20261024000002_admin_account_password`, puis `20261025000001` à `20261025000006`. Ne pas réappliquer une ancienne définition de `encheck_admin_request_guard` par-dessus la migration du mot de passe temporaire.
3. Configurer Auth : fournisseur e-mail, quotas adaptés, vérification des adresses et changement d’e-mail sécurisé. Autoriser les URL publiques `/admin/activation`, `/admin/recuperation` et `/mon-compte` dans les redirections Auth. La durée d’une invitation en base ne prolonge pas la durée d’un lien Auth expiré.
4. Configurer `ADMIN_APP_ORIGIN` avec l’origine HTTPS publique exacte, sans slash final. Déployer `admin-invitations` et `admin-mfa-recovery` avec leurs vérifications explicites getUser + RPC en contexte utilisateur. La clé service-role ne sort jamais des Edge. Ne pas ouvrir CORS à toutes les origines ni prendre l’URL de retour dans le corps de la requête.
5. Déployer le client public et son service worker avant le hook global. Contrôler les anciennes versions et les parcours Login/TOTP/renouvellement de mot de passe.
6. Auditer tous les chemins métier : RLS, fonctions definer, Storage, Realtime et Edge service-role ; corriger notamment les anciens rattachements par e-mail.
7. Activer explicitement le hook avec l’outil SQL séparé seulement après validation de l’audit. Recetter vrais échanges Auth/REST dans l’environnement isolé.

### Échecs partiels à traiter explicitement

Auth et PostgreSQL ne partagent pas une transaction HTTP. Si l’envoi est effectué mais que sa finalisation SQL échoue, l’invitation reste en attente et l’activation est refusée. Un superadmin doit vérifier l’état avant de renvoyer/annuler. Aucun succès n’est inventé.

Une récupération MFA peut retirer une partie des facteurs puis échouer. L’intention est journalisée avant l’appel ; l’interface annonce « non confirmée ou partielle ». Vérifier les facteurs et le journal avant une nouvelle intervention. Les sessions REST bloquées ne sont pas automatiquement rétablies.

## Audit réel effectué en lecture seule le 25 octobre 2026

Projet `en-check` : 103 tables publiques avec RLS ; 127 fonctions `SECURITY DEFINER` exécutables par `authenticated`. Les valeurs par défaut requises pour la création des comptes et des liens d’entreprise ont été lues, sans consulter de données de comptes.

L’inventaire des dépendances révèle notamment des références bloquantes vers `admins` depuis `tasks.created_by_admin_id`, `attendances.modifie_par`, `employee_payslips.sent_by`, `payroll_audit_logs.performed_by`, `payroll_bonuses`, `payroll_deductions`, `leave_requests` et `prospects.assigned_to`. Le compte Auth peut aussi être lié à un employé. Un DELETE/CASCADE générique détruirait ou dégraderait la traçabilité ; aucune suppression destructive n’a été ajoutée.

## Restants réels

- Rôles personnalisés effectifs sur l’ensemble des tables, RPC et Edge, pas seulement dans le formulaire.
- Suppression définitive encadrée avec stratégie d’anonymisation/conservation de l’historique et traitement des identités partagées avec un employé.
- Transfert des responsabilités métier au-delà des accès d’entreprise.
- Audit exhaustif et retrait/sécurisation des autres opérations historiques ; preuve d’absence de contournement sur Storage/Realtime/Edge.
- Recette fournisseur, application des migrations, déploiement Edge et activation en production.

Ces éléments ne sont ni présentés comme terminés ni remplacés par des boutons factices.
