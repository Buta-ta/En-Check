# Administration des accès et Mon compte — premier lot, PR en brouillon

## État de livraison
Ce lot **ne constitue pas l’ensemble du programme validé**. Il pose les deux interfaces, une première couche d’actions et une migration de sécurité testée en local. **Migration non appliquée, aucun déploiement production, aucun compte réel modifié.** Ne pas fusionner/déployer comme si les rôles personnalisés, invitations et interventions avancées étaient terminés.

Référence visuelle choisie conservée dans `docs/design/admin-accounts-approved-reference.png`. Ivoire/indigo/cuivre, motifs géométriques discrets, navigation locale à pièces gravées, compteurs compacts, liste et fiche latérale. La navigation globale du dashboard n’est pas redessinée.

## Réalisé
- `/admins` : nouvelle page superadmin, données réelles (champs explicites, pas de hash/mot de passe), comptes actifs et inactifs, recherche, filtre d’entreprise principale et d’état, fiche Profil / Accès / Sécurité / Historique. Maximum explicite de 1 000 lignes ; les compteurs correspondent aux comptes chargés. Aucune fausse invitation, session ou dernière connexion.
- `/mon-compte` : profil propre au titulaire, prénom/nom, photo et aperçu, modification du mot de passe avec vérification du mot de passe courant, révocation du renouvellement des autres sessions via Supabase Auth, thème local. Lecture de l’existence des facteurs TOTP, sans prétendre implémenter le challenge de connexion.
- Accès Mon compte dans le menu du dashboard pour tous les admins. Fiche personnelle déterminée par `auth.getUser()` puis `admins.user_id` côté serveur, jamais par l’ID fourni dans localStorage.
- `/admins/gestion-existante` conserve l’ancienne gestion (création, changement de mot de passe par superadmin, rôles et entreprises existants), sans présenter ses limites comme résolues. Les deux routes de gestion exigent `requireSuperAdmin`. La vérification existante lie maintenant aussi le profil à `session.user.id`.
- Migration `20261024000001_admin_account_workspace.sql` : mise à jour de son propre profil via RPC sans paramètre de rôle ou d’ID cible, changement d’état réservé au superadmin avec motif, journal dédié RLS en lecture seule pour le client, protection du dernier superadmin actif y compris dans les anciennes mises à jour/suppressions directes.
- Suspension et réactivation sérialisées par verrou transactionnel ; modification et événement atomiques. Protection contre l’auto-désactivation via la nouvelle RPC.
- Bucket `admin-avatars`, images JPG/PNG/WebP, limite 2 Mo, upload dans le dossier de l’utilisateur connecté actif, pas de remplacement d’un objet arbitraire. **Photos publiques**, signalé dans le formulaire. Aucun retrait silencieux de la confidentialité d’un bucket existant : installation interrompue s’il existe en privé. Nettoyage de l’upload si la sauvegarde du profil échoue.
- Dialog natif : focus capturé, Échap, retour au bouton d’origine, fermeture interdite pendant une mutation. Mobile : cartes et fiche plein écran. Clair/sombre.

## Important : sécurité et dépendances avant production
1. Auditer le schéma, les politiques RLS existantes sur admins/admin_entreprises et les anciennes RPC de création/mot de passe. Leur sécurité intégrale n’est pas certifiée par ce lot. Les tests synthétiques ne remplacent pas cet audit.
2. Tester/appliquer la migration en environnement de validation avec les véritables rôles et policies Storage. Le script conserve les anciennes fonctions, rôles et permissions ; il ne refond pas toute l’autorisation existante.
3. Les actions profil/photo/état/journal nécessitent cette migration. En son absence, un message explicite est affiché ; aucun repli client privilégié ni faux succès.
4. Une désactivation `is_active=false` n’équivaut pas à une révocation complète de tous les JWT déjà émis. Auditer chaque accès métier et intégrer le traitement des sessions avant de promettre une coupure immédiate universelle.
5. `auth.signOut({scope:'others'})` révoque les renouvellements des autres sessions du titulaire ; un access token existant peut rester valide jusqu’à expiration. L’UI l’indique.
6. Le changement de mot de passe utilise Auth. Sur un compte MFA existant, la politique Auth peut exiger AAL2 ; le parcours complet de challenge reste à intégrer. Aucune réussite n’est annoncée si Auth refuse.
7. Les événements de ce journal couvrent seulement les nouvelles RPC profil/état. Les opérations de l’ancienne gestion et d’Auth ne sont pas artificiellement présentées comme intégralement journalisées ici.

## Reste à réaliser pour le programme validé
- Invitations réelles et suivi de leur expiration ; création atomique Auth/profil/affectations.
- Création de rôles personnalisés, permissions par action/module/entreprise, délégation et application effective dans toutes les API/RPC/RLS. L’onglet actuel inventorie seulement les rôles existants.
- Changement d’email avec vérification, téléphone/fonction, recadrage manuel, notifications et page d’accueil préférée.
- Enrôlement MFA et challenge à la connexion, récupération, liste des appareils et alertes de connexion inhabituelle.
- Superadmin : réinitialisation sécurisée par lien / mot de passe temporaire à changement obligatoire, révocation distante complète, diagnostic et accès d’assistance temporaires traçables.
- Accès temporaires, expiration automatique, archivage métier, transfert de responsabilités et suppression définitive encadrée.
- Audit exhaustif de toutes les voies anciennes et nouvelles de mutation des comptes, tests d’autorisation en environnement réel, déploiement progressif.

## Vérifications exécutées
- **754 tests / 78 fichiers réussis**, build Vite/PWA réussi. ESLint gate : zéro erreur, un warning préexistant EnterpriseSelectorModal ; git diff --check réussi.
- 5 tests PGlite : installation idempotente, droits anonymes, profil propre uniquement, journal, refus d’un acteur non superadmin/inactif, isolation de lecture du journal, dernier superadmin via anciens chemins. **Base synthétique, pas la production et pas une preuve de concurrence multi-connexion.**
- 8 tests React/services : identité authentifiée, refus du répertoire aux admins ordinaires, comptes inactifs conservés, filtres et compteurs réels, drawer, migration absente, routes, formulaire propre sans champs de privilèges, refus serveur sans faux succès.
- Chromium : 16 configurations (répertoire/Mon compte × clair/sombre × 320/390/768/1440). Pas de débordement horizontal ; fiche et champs de sécurité, Échap et retour du focus. Captures inspectées. Harnais temporaire avec données fictives, aucune session de production.
- Dépendances versionnées inchangées. Ancien écran conservé explicitement, pas de suppression de fonctionnalité existante prétendument remplacée.
