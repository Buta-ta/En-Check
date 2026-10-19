# Discussion générale — installation et limites

## Ce que ce lot branche réellement

L’interface propose désormais une seule conversation et une seule saisie.
Entrée ou la flèche envoie le message ; aucune sélection de moteur ni de mode.
Les recherches métier reconnues restent traitées localement. Un routeur conservateur
oriente certaines formulations générales vers le modèle, après activation explicite
pour la session. Les suites courtes comme « Comment ? » reprennent uniquement le
contexte général s’il existe ; sinon elles déclenchent une clarification locale.

Le dernier échange est affiché. La mémoire fournisseur contient au maximum les
trois derniers échanges généraux ; elle est effacée lors d’une demande locale,
à la fermeture, à la nouvelle discussion, à l’expiration et au changement de compte.
Aucun résultat métier n’est ajouté à cette mémoire. Les demandes inconnues ne sont
pas systématiquement transmises : le routage n’est pas un interpréteur universel.

Identité à l’écran : Assistant En-Check, sans badges de provenance techniques.
Sources et limites sont conservées dans « Sources et précisions », les avertissements
métier importants restent visibles. Chargement commun « Je prépare votre réponse… ».
L’information de transfert apparaît avant le premier envoi général de la session,
puis reste accessible dans « Confidentialité et fonctionnement ». Pas de case à
cocher à chaque message. L’activation peut être refusée sans envoi externe.

## Avant activation — données et responsabilités

La discussion utilise l’API Google (Gemini, puis Gemma). Le fournisseur doit être
identifié dans l’information de confidentialité destinée aux utilisateurs même
si sa marque n’apparaît pas dans les bulles. Vérifier les conditions en vigueur,
le niveau sans frais, les régions autorisées et les conditions de mise à disposition
aux utilisateurs avant d’activer. Les restrictions de l’offre gratuite restent
applicables, notamment pour les données personnelles/confidentielles et les
utilisateurs dans les régions où une offre payante est exigée.

L’utilisateur est averti du transfert externe des messages et du contexte général.
Il active explicitement ce traitement pour la session, réservé aux messages non personnels et non confidentiels. Cette activation ne remplace pas les obligations d’information et de conformité.
Les adresses mail, numéros longs et certains secrets explicites sont bloqués côté
client et serveur avant la réservation du quota. Cette détection est volontairement
limitée : elle ne sait pas garantir l’anonymisation, ni détecter tous les noms,
salaires ou éléments confidentiels. La confirmation n’autorise pas l’envoi de
contenus interdits par les conditions du fournisseur. Pas de mise en production
« sans restriction », ni garantie automatique de conformité.

Le modèle n’a aucun outil, accès à la base, recherche web ou pouvoir d’action.
Il reçoit des consignes de clarification, de prudence et d’absence de données métier.
Ces consignes ne garantissent pas l’exactitude. Aucun conseil professionnel ni
aucune analyse de dossiers RH ne doit être déduit de ce mode.

## Étapes de déploiement (indispensables)

**La fusion GitHub et le déploiement du site ne déploient pas cette fonction.**

1. Dans Supabase → Edge Functions, créer **assistant-chat**.
2. Ajouter les **trois fichiers** du dossier `supabase/functions/assistant-chat/`
   au même niveau : `index.ts`, `core.js`, `contract.js`. Ne remplacer ni
   `test-ai-search` ni `assistant-explain`.
3. Désactiver « Verify JWT with legacy secret » pour cette fonction. Elle vérifie
   elle-même le token avec `auth.getUser`, puis le compte administrateur actif.
4. Garder `GEMINI_API_KEY` uniquement dans les secrets Supabase et vérifier
   `AI_TEST_ALLOWED_ORIGINS` : `https://en-check.vercel.app` sans slash final
   (plusieurs origines séparées par des virgules si nécessaire).
5. Après vérification des conditions ci-dessus, ajouter **AI_CHAT_ENABLED=true**.
   Sans ce secret, la fonction reste désactivée et le site l’indique honnêtement.
   Le drapeau `AI_ASSISTANT_ENABLED` des explications ne l’active pas.
6. Vérifier que la migration déjà exécutée
   `20261019000002_quota_assistant_explications.sql` est présente. **Aucun nouveau
   SQL nécessaire** si elle est déjà installée. Le chat réutilise son quota
   atomique : **5 demandes/utilisateur/jour et 30/projet/jour UTC, partagées avec
   les explications**. Ne pas exécuter les SQL de test en production.
7. Fusionner la PR et déployer le frontend.
8. Ouvrir la barre, saisir « Comment organiser une réunion utile ? », puis
   envoyer. Lire l’information et choisir « Activer et poursuivre ». Continuer
   avec « Comment ? », sans nouvelle confirmation dans cette session.
   Ce test consomme le quota chat/explications, **pas** le quota diagnostic 3/jour.

Rollback : `AI_CHAT_ENABLED=false`. Les consultations métier et les explications existantes
restent indépendants. Aucun secret ni token à copier dans la conversation.

## Limites opérationnelles

- Gemini `gemini-3.5-flash-lite` en premier, Gemma `gemma-4-31b-it` uniquement après
  échec, délai ou format inexploitable. Maximum deux appels, sans boucle de retry.
- 30 secondes par fournisseur, 70 secondes côté navigateur pour les deux appels
  et la marge Auth/DB/réseau. Une annulation navigateur ne garantit pas l’arrêt
  d’un appel déjà lancé côté serveur ; la réservation reste consommée.
- 2 000 caractères par message, trois échanges précédents + le nouveau message
  (7 messages envoyés maximum). Pas de résumé caché ni de stockage de l’historique
  dans la base ou localStorage. Métadonnées quota uniquement dans En-Check.
- Effacement à la fermeture, au changement de route, compte/entreprise,
  connexion/déconnexion, demande « Nouvelle discussion » ou 15 minutes d’inactivité.
- Erreurs, quota épuisé et fonction non activée ne sont jamais présentés comme
  une réponse générée. Une fonction absente/non déployée peut afficher le message
  générique d’indisponibilité si la passerelle ne fournit pas notre code d’erreur.
- Les modèles ont leurs propres limites de disponibilité ; Gemma reste à tester
  réellement avec son délai de 30 secondes. Aucun appel réel exécuté par l’agent.

## Vérifications de ce lot

- 267 tests Vitest / 31 fichiers et 55 tests Node Edge réussis.
- Test DOM monté local complémentaire : confirmation, appel, chargement, affichage,
  historique au deuxième tour, reset et rejet d’une réponse périmée (1 test réussi).
- Deno check de la fonction complète réussi sur copie isolée.
- Lint ciblé : zéro erreur, un avertissement préexistant. Build Vite/PWA et
  `git diff --check` réussis.
- Pas de test dans une session authentifiée en production, pas de déploiement
  Supabase ni de consommation de quota fournisseur par l’agent.
- Installation locale : xlsx npm 0.18.5 temporaire (CDN inaccessible), manifestes
  et lock restaurés. Aucune dépendance modifiée livrée. Test DOM avec jsdom dans
  un dossier temporaire externe au dépôt.

## Mise à jour interface unifiée

Le routeur est volontairement restrictif : questions générales et quelques suites
contextuelles seulement, blocage local de thèmes RH/identifiants évidents. Il ne
constitue PAS un filtre exhaustif : une formulation contenant un nom ou une donnée
confidentielle peut échapper aux règles. Respecter les conditions d’usage et
l’information initiale reste nécessaire. Ne pas annoncer une anonymisation garantie.

Cette mise à jour est frontend seulement : aucun nouveau SQL, secret ou déploiement
Edge si `assistant-chat` du lot précédent est déjà installé/activé. Aucun appel
fournisseur réel dans les tests. 268 tests Vitest et 55 tests Edge ; test DOM monté
complémentaire du Dock : activation, second tour sans confirmation, absence de
résultat RH dans le payload, nouvelle discussion et rejet des réponses périmées.
