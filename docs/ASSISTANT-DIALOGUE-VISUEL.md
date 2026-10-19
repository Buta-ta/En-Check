# Assistant — dialogue et présentation validée

Lot limité au panneau/barre, sans modification du redesign de l'IA dev 3, des permissions ou des modèles cloud.

- Les exemples dans la barre vide sont effacés puis écrits caractère par caractère (pause 2,2 s, effacement 35 ms/caractère, écriture 75 ms/caractère). Le premier exemple est lisible au montage, puis le cycle démarre. Arrêt au focus, à la saisie, à l'ouverture du panneau/liste, onglet masqué ou préférence de mouvement réduit. Jamais de modification du texte saisi, aucun appel réseau par l'animation.
- Dernière demande affichée dans une bulle. Réponse naturelle, cartes ivoire avec initiales, libellé Entrée/Sortie/Estimation, heure réellement formatée dans le fuseau de l'entreprise. Aucune heure fictive issue de la maquette.
- Correction du bug `undefined` : remplacement de la propriété inexistante `heuresTexte` par `formaterHeureLocaleShort`. En cas de timestamp absent/invalide : « Heure indisponible ».
- Sources et explications techniques repliées. Avertissements essentiels (estimations virtuelles exclues, échantillon tronqué, planning inexploitable), indicateur de provenance IA/référence et nombre de lignes affichées restent visibles.
- Réponses locales à Bonjour/Bonsoir/Salut et Merci ; salutation suivie d'une recherche n'efface pas la demande. Aucune requête RH ni appel modèle pour une salutation seule. Cela ne constitue pas une conversation générative libre.
- Questions telles que « Bonjour, montre-moi les pointages cette semaine » ou « les pointages de la semaine » reconnues. Aucun nom ou critère inconnu supprimé silencieusement.
- Suites réellement branchées : aujourd'hui, les 7 derniers jours (aujourd'hui + 6 précédents), semaine précédente (lundi à dimanche). Le clic sur une suite de réponse soumet la recherche ; les exemples de découverte ne font que préremplir. Vérifications Auth/entreprise et bornes de temps restent celles du service RH.
- « Cette semaine » reste lundi → aujourd'hui ; un lundi, cette limite est expliquée en langage naturel. Détails de l'ancienne recherche conservés ; cartes spécialisées harmonisées par CSS limité au panneau.
- Pas de stockage des échanges ; dernier échange affiché seulement, pas d'historique complet. Contexte d'intention borné à l'entreprise et effacé à fermeture/navigation. Aucun nouveau traitement fournisseur.

## Vérifications
234 tests Vitest / 28 fichiers et 36 tests Node ; lint gate 0 erreur / 1 avertissement préexistant, compilation Vite/PWA réussie. Tests de cycle écriture/effacement, pause, dates/lundi/semaine précédente, salutations et demande combinée, rendu des cartes et heure réelle 08:02 provenant d'un timestamp de test. Tests de rendu SSR, pas de vérification visuelle navigateur authentifié ni caméra réelle.

Installation locale : substitution temporaire xlsx npm 0.18.5 pour contourner CDN inaccessible, manifestes/lock restaurés sans changement livré.

Aucun nouveau SQL, secret ni redéploiement Edge requis. La fonction `assistant-explain` du lot précédent garde sa procédure d'activation indépendante ; cette livraison ne confirme pas son déploiement réel.
