# Heures supplémentaires — maquette aso-oke intégrée

## Demande validée
Refonte de la page selon la proposition visuelle sélectionnée : indigo/cuivre/ivoire, indicateurs, graphique, filtres Jour/Semaine/Mois, détail par employé et règles dans un tiroir. Pas de changement du dashboard ou de la navigation générale.

## Livraison
- Bandeaux haut/bas issus directement du bandeau de la maquette approuvée (WebP). Inspiration contemporaine du tissage aso-oke yoruba, sans revendication de reproduction d’un symbole traditionnel précis.
- Identité partagée avec la barre intelligente et son dialogue via la carte centrale des routes.
- Thèmes clair/sombre, cartes mobiles, recherche nom/matricule, détails quotidiens repliés.
- Indicateurs réels : temps travaillé, total supplémentaire et nombre distinct d’employés ayant des heures supplémentaires.
- Graphique quotidien : jusqu’aux 8 employés avec les plus grands dépassements. Semaine : jours du lundi au dimanche. Mois : tranches explicitement étiquetées de 7 jours, incluant les derniers jours du mois. Aucun chiffre de démonstration livré dans le produit.
- Règles dans un dialogue natif latéral : focus contenu, restitution du focus, fermeture Échap hors sauvegarde, verrouillage du scroll. Aides et exemples repliés par défaut. Champs étiquetés, contrôles verrouillés pendant la sauvegarde, erreurs interceptées et brouillon conservé.

## Calcul et chargement
- Le moteur `FeatureService.calculateOvertimeForEmployeeDay` est conservé. Les vues Semaine/Mois additionnent ses résultats **journaliers** ; elles n’introduisent pas un nouveau seuil réglementaire hebdomadaire ou mensuel.
- Seuil réellement retourné par le moteur affiché dans le détail et l’export, au lieu d’un seuil global supposé de 8 h.
- Réglages résolus par entreprise dans la vue globale super-admin. Le réglage global « toutes les entreprises » n’est pas éditable.
- Une entrée de nuit est attribuée à sa date d’entrée et sa sortie peut être le lendemain (limite de 16 h conservée). Elle n’est plus suivie d’entrées du lendemain dans le calcul de la veille : évite le double comptage lors des agrégations multi-jours. Les journées utilisent ici la date UTC de `check_time`, comme l’attribution des entrées préexistante ; pas de nouvel audit complet des fuseaux horaires par pays.
- Requêtes pointages/employés/affectations paginées par 500 lignes pour ne pas tronquer silencieusement les périodes longues. Ordre stable, erreurs propagées, aucun résultat partiel affiché.
- Réponses tardives ignorées après changement de contexte ; métriques et export masqués/désactivés pendant chargement ou erreur. Bouton Réessayer.
- Export CSV quotidien sur toute la période, avec échappement des guillemets, séparateurs, sauts de ligne et préfixes de formule.
- Les droits existants et les règles métier du service central sont conservés. Aucun SQL, changement RLS, envoi de paie ni écriture sur les données de production pendant cette intervention.

## Vérifications
- Suite complète : **694 tests, 68 fichiers réussis** (19 nouveaux tests).
- Tests de présentation/périodes : mois bissextiles, semaines interannuelles, agrégation distincte, totaux du graphique, pagination/erreur, CSV, états vide/chargement/erreur et motif contextuel.
- Montage de la vraie page en jsdom avec services simulés : 31 appels journaliers sur le mois, nuit non comptée deux fois, sauvegarde en erreur puis réussie, retry de chargement.
- Build Vite/PWA réussi.
- Porte ESLint du dépôt : zéro erreur, un warning préexistant dans EnterpriseSelectorModal. Ce n’est pas une affirmation de nettoyage du lint historique complet.
- Chromium : harnais des vrais composants de présentation, clair/sombre à 320, 390, 768 et 1440 px. Recherche, détails, changement de vue, ouverture/Échap et boucle du focus du tiroir vérifiés ; zéro débordement horizontal ni erreur JavaScript observée. Captures desktop/mobile inspectées.
- Le harnais utilise des données synthétiques et un contenu de tiroir simplifié ; le vrai formulaire est couvert par les tests de montage. Pas une session authentifiée de bout en bout ni une validation fiscale ou un audit exhaustif de production.
- Aucun changement des dépendances versionnées. Aucun déploiement de production réalisé.
