# Administration — état réel du chantier

> Ce document décrit le lot précédent. Pour les ajouts et les restants actuels, voir [le chantier opérations](ADMIN-CHANTIER-OPERATIONS.md).

## Lot livré dans cette branche

- Challenge TOTP à la connexion, avant les lectures métier ; contrôle AAL2.
- Vérification du compte actif côté serveur sur toutes les routes administrateur.
- Inscription TOTP (QR/clé manuelle), validation et retrait de facteur.
- Préférences personnelles : téléphone, fonction déclarative, accueil autorisé, notifications e-mail synchronisées avec le réglage existant.
- Liste des sessions Auth du titulaire ou, pour un superadmin, du compte sélectionné ; motif et journal de révocation.
- Tests SQL locaux PGlite : permissions, préférences, cloisonnement des sessions, compte désactivé, MFA, révocation idempotente et garde de requêtes.
- Tests React du challenge : succès avec AAL2, refus AAL1, erreur fournisseur masquée, effacement du code, annulation.

## Non activé en production

Aucune migration, activation de hook ou modification de compte réel effectuée dans ce lot. L'inscription MFA et la révocation sont désactivées dans l'interface tant que le serveur ne confirme pas l'activation du contrôle REST/RPC. Le challenge fonctionne pour les facteurs TOTP déjà vérifiés.

Ordre de mise en service :
1. Auditer les fonctions/RLS/Edge historiques et les identités Auth des administrateurs. Corriger notamment le rattachement historique par adresse e-mail.
2. Appliquer les migrations `20261024000001`, `20261024000002`, puis `20261025000001` après vérification des prérequis et sauvegarde.
3. Déployer et vérifier le nouveau client Login/MFA sur l'application publique ; ne pas activer le hook global à partir du seul aperçu de branche.
4. Auditer les chemins Storage, Realtime, Edge/service-role ; ils ne sont PAS protégés par ce hook.
5. Exécuter explicitement `supabase/outils-sql/20261025_activer_garde_sessions_admin.sql`, puis tester avec des comptes de test autorisés. Le script refuse les identités ambiguës/non liées et l'écrasement d'un autre hook.

La révocation inscrite en base bloque les requêtes REST/RPC portant cet identifiant de session. Elle ne supprime pas la session Auth ni ses refresh tokens et ne prétend pas fermer universellement tous les canaux. Une nouvelle connexion reste possible si le compte est actif. Aucun code de secours ou processus de récupération MFA n'est livré.

## Vérifications exécutées

- Suite existante + tests SQL : **793 tests / 81 fichiers réussis**.
- Tests du challenge ajoutés ensuite : **3 tests réussis**.
- Build Vite/PWA réussi.
- ESLint gate : zéro erreur, un avertissement préexistant dans EnterpriseSelectorModal.
- Pas de nouvelle recette visuelle navigateur ni de test Auth/Supabase de bout en bout en production. Les anciennes captures du registre ne constituent pas une recette de ce lot.

## Chantier global encore incomplet

Invitations et relances ; rôles personnalisés appliqués à tous les chemins serveur ; récupération et changement obligatoire de mot de passe ; récupération MFA ; alertes de connexion inhabituelle ; résiliation, transfert et suppression encadrée ; délégations d'assistance ; journal exhaustif des anciennes opérations ; changement d'e-mail vérifié ; absorption complète de l'ancienne gestion.

Ne pas présenter ce lot comme la réalisation de tout le chantier Admin.
