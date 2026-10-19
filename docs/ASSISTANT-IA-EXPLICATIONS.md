# Premier branchement IA réel : explications générales

## Périmètre honnête
La barre appelle une nouvelle fonction `assistant-explain` pour trois sujets publics : sortie présumée, calcul du retard, signification du nombre de pointages. Le modèle reformule une documentation fixe, puis le frontend affiche son paragraphe en texte simple, sans exécuter aucune action. Ce n'est ni un interpréteur libre des questions RH, ni une analyse de dossiers individuels, ni un accès du fournisseur à la base.

Exemples reconnus : « Explique une sortie présumée », « Comment sont calculés les retards ? », « Que signifie le nombre de pointages ? ». La liste « Comprendre avec l'assistant » préremplit la saisie ; l'utilisateur doit envoyer. La reconnaissance locale est volontairement exacte (casse/accents/ponctuation normalisés) : une phrase ajoutant un nom ou un détail personnel ne part pas à cette fonction.

Le seul corps HTTP autorisé est `{ "topic": "presumed_exit" }` (ou `lateness`, `attendance_count`). Aucun texte libre, identifiant d'entreprise, dossier RH, nom de salarié, historique ou résultat de recherche. Le serveur rejette aussi tout champ supplémentaire et tout sujet inconnu. La liste des textes publics est dans `topics.js`, partagée avec le frontend ; aucun secret n'y figure.

Les réponses RH chiffrées restent fournies par les moteurs En-Check, pas par Google. La génération ne déclenche ni validation ni modification. Le redesign et la barre basse ne changent pas.

## Secours et véracité
1. Gemini `gemini-3.5-flash-lite`, un appel, délai fournisseur 30 s.
2. Si erreur, timeout ou format inexploitable : Gemma `gemma-4-31b-it`, un appel, délai fournisseur 30 s.
3. Si les deux échouent, si le quota manque, si le secret/compteur manque ou si l'IA est désactivée : référence En-Check fixe.
4. Si la fonction n'est pas encore déployée, si CORS/session/réseau bloque : même référence disponible dans le frontend (documentation publique uniquement).

Aucune boucle de retry, 2 appels au maximum par demande ; jusqu'à 60 s d'attente fournisseur, hors Auth/DB. Le navigateur abandonne à 70 s, sans prétendre annuler un appel déjà exécuté côté serveur. Chaque réservation reste consommée même en cas d'échec. Pas de circuit-breaker persistant dans ce lot : la protection budgétaire est le quota atomique.

Affichage explicite « Reformulation IA ... à vérifier » ou « Référence En-Check ». Une reformulation valide syntaxiquement peut contenir une erreur : la référence métier est toujours visible à côté, les décisions restent humaines. Aucun message technique brut, nom de modèle ou secret n'est exposé aux utilisateurs. Pas de faux indicateur de génération si le texte vient du secours.

## Accès, quota, gratuité
Session vérifiée avec `auth.getUser`, puis compte `admins.user_id` actif (pas seulement superadmin : documentation publique utile à tous les admins). Service_role uniquement dans Edge, pour contrôler ce statut et réserver le compteur. Aucun appel au chargement de la barre.

Nouvelle table technique (date UTC, périmètre projet ou UUID utilisateur, compteur), protégée par RLS, inaccessible aux rôles anon/authenticated. Fonction de réservation service_role seulement. Verrou transactionnel PostgreSQL pour réserver atomiquement 30 demandes/jour/projet et 5/jour/utilisateur : max 60 appels fournisseur/jour/projet pour cette fonction. Les tests IA isolés et d'autres clients de la clé ont leurs propres consommations. Quotas Google partagés et distincts. Les UUID du compteur sont techniques, restent dans Supabase et ne partent jamais chez Google.

`AI_ASSISTANT_ENABLED` est faux par défaut, indépendant du test isolé. Ne pas activer de facturation. Aucun mécanisme payant de secours. Le code ne peut pas certifier le niveau gratuit du projet Google : le vérifier dans AI Studio. L'hébergement Supabase conserve ses limites propres.

## Installation manuelle (ne pas exécuter les fichiers tests SQL en production)
1. Exécuter **uniquement** `supabase/migrations/20261019000002_quota_assistant_explications.sql` dans SQL Editor. Cela crée le nouveau compteur technique, sans appel Google ni modification RH.
2. Créer/déployer une nouvelle Edge Function nommée **assistant-explain**. Ajouter ses **trois fichiers** au même niveau : `index.ts`, `core.js`, `topics.js`. Ne pas remplacer la fonction `test-ai-search`.
3. Dans le Dashboard, désactiver « Verify JWT with legacy secret » pour cette nouvelle fonction : elle contrôle elle-même Auth et le statut admin. Le config.toml correspond à `verify_jwt=false` pour le déploiement CLI.
4. Garder le secret existant `GEMINI_API_KEY` dans Supabase uniquement. Ajouter `AI_ASSISTANT_ENABLED=true` après vérification du niveau sans frais. Le secret CORS existant `AI_TEST_ALLOWED_ORIGINS` est réutilisé : il doit contenir exactement `https://en-check.vercel.app` (pas de slash final) ; plusieurs origines séparées par virgules. Aucun ajout de clé dans Vercel.
5. Après fusion et mise en ligne du frontend, ouvrir la barre → Comprendre avec l'assistant → choisir une question → Envoyer. Lire la provenance : « Reformulation IA » confirme une réponse modèle ; « Référence En-Check » ne prouve pas que les modèles fonctionnent.
6. Pour désactiver : `AI_ASSISTANT_ENABLED=false`. Les références locales et les recherches/RH restent utilisables. Laisser le test isolé désactivé indépendamment.

## Vérifications effectuées
- 230 tests Vitest / 27 fichiers, 36 tests Node Edge/client, lint gate sans erreur (un avertissement préexistant), build Vite/PWA réussi.
- Deno check sur copie identique des trois fichiers dans dossier isolé.
- PGlite local jetable : migration deux fois, 5 réservations/utilisateur, 30/projet, refus utilisateur nul et permissions contrôlées. Pas de stress-test multiconnexion PostgreSQL réel ; atomicité fournie par le verrou transactionnel.
- Appels Google entièrement simulés, aucune clé réelle utilisée, aucun déploiement Supabase. Disponibilité effective Gemma toujours non confirmée (timeout au test utilisateur précédent), Gemini avait réussi le test isolé mais pas encore cette nouvelle fonction.
- Installation locale temporaire xlsx npm 0.18.5 pour contourner CDN inaccessible ; manifestes/lock restaurés, aucune dépendance modifiée livrée.

## Mise à jour : Gemini principal, Gemma secours
Redéployer `assistant-explain` avec ses trois fichiers existants et `test-ai-search` avec ses deux fichiers (`index.ts`, `core.js`). Le test isolé conserve deux appels parallèles pour vérifier les deux modèles, même si Gemini réussit ; il ne simule pas la chaîne de secours. Son délai passe de 12 à 30 secondes par modèle, avec 40 secondes côté navigateur. Déployer également le frontend pour appliquer les nouveaux délais client. Aucun nouveau SQL ou secret. Ne pas déduire la disponibilité réelle de Gemma des tests simulés. Aucun essai réel lancé par cette mise à jour.
