# Test isolé Gemma + Gemini (pas la recherche de production)

## Ce que fait ce lot

`test-ai-search` accepte exclusivement `POST {"action":"test"}` d'un utilisateur Supabase Auth lié à une ligne `admins` active avec rôle `super_admin`. Pas de clé publique/service_role utilisée comme identité d'utilisateur. Vérification de session via `auth.getUser`, puis lecture des seuls champs d'autorisation dans `admins`.

Deux modèles fixes, identifiants fournis par les exemples AI Studio de l'utilisateur :
- `gemma-4-31b-it`
- `gemini-3.5-flash-lite`

Une seule question fictive, fixée dans le code. Aucun accès aux employés, salaires, pointages, plannings. Pas de SQL généré, Google Search, audio ou historique conversationnel. Aucun prompt fourni par le navigateur. La fonction n'écrit que son compteur technique ; elle ne modifie aucune donnée RH. Réponses normalisées, sans texte d'erreur brut du fournisseur ni clé. Aucun log applicatif du prompt ou du secret.

IMPORTANT : ce test demande un format précis et vérifie la connectivité / respect du format. Il ne constitue pas une évaluation de qualité générale ni une autorisation d'envoyer des données personnelles. Leurs options AI Studio ne sont pas toutes compatibles avec leur API : seuls les paramètres textuels minimaux sont utilisés.

## Limites et coût

Trois essais par jour UTC pour TOUT le projet (maximum six appels, trois par modèle). Réservation atomique dans une table technique, indépendante du nombre d'instances Edge. Un essai réservé reste consommé même si le fournisseur échoue. Aucun retry automatique. Timeout 12 secondes par modèle et sortie plafonnée à 256 tokens. Les quotas de Google restent distincts, avec leur propre heure de remise à zéro.

Désactivé par défaut. Ne pas activer la facturation Google. Ce code ne peut pas garantir que la clé soit liée à un projet gratuit : vérifier le niveau dans AI Studio. Le test utilise les ressources habituelles Supabase Edge/DB et ses quotas d'hébergement.

## Déploiement manuel, en étapes

1. Copier/exécuter uniquement `supabase/migrations/20261019000001_quota_test_ia.sql` dans l'éditeur SQL Supabase. Table technique avec RLS, aucune permission pour anon/authenticated. RPC de réservation accordée seulement au service_role utilisé côté serveur. Ne pas ouvrir ses permissions pour permettre un test navigateur.
2. Déployer le dossier complet avec Supabase CLI depuis le dépôt lié au bon projet : `supabase functions deploy test-ai-search`. `index.ts` importe `core.js` : les deux fichiers sont nécessaires. `verify_jwt=false` au gateway est volontaire ; la vérification Auth réelle est faite dans la fonction et n'est pas facultative.
3. Secret `GEMINI_API_KEY` : déjà enregistré par l'utilisateur. Ne jamais le transmettre en chat, le mettre dans React, Git ou une variable VITE_. Les secrets Supabase URL et service_role sont fournis par l'environnement Edge.
4. Ajouter `AI_SMOKE_TEST_ENABLED=true` uniquement pour la séance d'essai. Facultatif pour un appel navigateur : `AI_TEST_ALLOWED_ORIGINS=https://votre-domaine-admin` (origines exactes, séparées par virgules ; aucun wildcard). Sans origine configurée, les appels non navigateur restent possibles MAIS exigent aussi une session de super-administrateur.
5. Depuis un client Supabase connecté avec le compte super-administrateur, invoquer `supabase.functions.invoke('test-ai-search', { body: { action: 'test' } })`. Ceci décrit l'appel à intégrer dans un outil de test ; pas un ajout aux barres de recherche. Un test Dashboard utilisant seulement la clé anon ou service_role sera refusé : il faut la session Auth du super-administrateur. Ne pas partager ce jeton en chat.
6. Lire `results` séparément pour chaque modèle. Un HTTP 200 ne suffit pas : `ok` et chaque `interpretation_valid` doivent être vrais. `model_unavailable` peut indiquer un nom/API non accessible ; `provider_access_denied`, un problème de clé/accès ; `quota_provider`, le quota Google ; `daily_test_limit`, notre propre limite ; `unexpected_output`, une réponse non conforme (sans en exposer le texte).
7. Remettre `AI_SMOKE_TEST_ENABLED=false` après les tests. Ne pas supprimer/réinitialiser le compteur pour contourner la limite.

## Vérifications locales reproductibles

`node --test tests/edge/test-ai-search.mjs`

Ces tests simulent Auth, le quota et Google. Aucun appel Gemini réel ni déploiement Supabase n'a lieu pendant les tests. Les modèles réels, le lien admins.user_id et les réponses effectives doivent encore être vérifiés sur le projet après déploiement.
