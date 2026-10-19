# Assistant — compréhension locale et contexte temporaire

## Périmètre livré

Ce lot rend la consultation RH moins rigide, sans prétendre connecter un chat
Google libre. Gemini/Gemma et le circuit `assistant-explain` restent inchangés :
seul un identifiant de notion publique autorisée peut partir vers cette fonction.
Aucun texte libre, historique, nom, résultat métier ou identifiant d’entreprise
n’est transmis à un modèle par ce lot. Aucun nouveau SQL, secret ou déploiement
Edge n’est nécessaire. Le redesign général et les motifs africains sont conservés.

- Grammaire locale composable : formulations de consultation, politesse,
  période avant/après le sujet, variantes de « semaine passée/dernière ».
- Exemple : « Encore des retards ce matin… » → clarification → « regarde déjà »
  → retards du jour → « et hier ? » → même sujet, autre période.
- Important : le moteur ne filtre pas la matinée. La clarification annonce
  explicitement **journée entière**, et demande de choisir avant la consultation.
- Une nouvelle demande sans période ne reprend pas silencieusement l’ancienne.
- Les demandes vagues, confirmations sans sujet, « pourquoi ? » ambigu et dates
  seules sans contexte entraînent une clarification, pas une cause inventée.
- Des conseils généraux sur les retards sont disponibles localement et identifiés
  comme tels, sans analyse individualisée ni décision RH.
- Aucun filtre individuel, négation ou critère inconnu n’est retiré pour produire
  un bilan collectif à la place de la demande. Les formulations non comprises
  restent non prises en charge ou passent à la recherche En-Check existante.

## Contexte et sécurité

Le contexte ne contient que l’intention et la période. Il reste en mémoire React,
scopé au compte et à l’entreprise, et expire après 15 minutes d’inactivité.
Il est réinitialisé à la fermeture, au changement de route, au scan, à la
connexion/déconnexion et au changement de compte/entreprise. Un contrôle chaque
seconde efface aussi l’affichage périmé ; le scope est vérifié immédiatement à
chaque envoi et avant d’afficher chaque réponse asynchrone. Aucun historique n’est
écrit dans localStorage. Le panneau affiche toujours le dernier échange seulement.

Le scope UI n’accorde aucun droit : toute lecture RH passe encore par getUser,
la RPC de contrôle d’administration, le fuseau de l’entreprise et les requêtes
métier existantes. Les réponses périmées sont ignorées. Pas de SQL généré.
Les plafonds et avertissements métier existants sont conservés.

## Limites explicites

Cette compréhension reste une grammaire locale déterministe : elle ne comprend
pas toute formulation humaine. Elle ne constitue ni un modèle sémantique universel,
ni un filtre garantissant l’anonymisation, ni une anticipation des risques.
Le chat génératif libre reste à construire avec un circuit autorisé pour les
données concernées. Ce lot ne prouve pas le déploiement de `assistant-explain`
ni la disponibilité réelle des deux modèles Google.

## Vérifications

Tests de paraphrases, de dialogue à plusieurs tours, de clarification, de dates,
de refus de filtres inconnus, d’isolement compte/entreprise, d’expiration,
d’absence d’appel IA sur demande RH et de refus serveur des droits.
Tests du dépôt, lint ciblé, build et tests Edge exécutés avant livraison.
Pas de validation dans un navigateur authentifié en production.
