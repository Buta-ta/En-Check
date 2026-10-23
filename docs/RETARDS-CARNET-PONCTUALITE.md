# Retards — carnet de ponctualité

## Proposition validée et réalisation
- Reprise du principe de la maquette choisie : un carnet d’arrivées, lignes de temps prévu/arrivée/écart, résumé horizontal, aide latérale et graphique par jour.
- Titres compacts et palette En-Check de la correction précédente conservés : Segoe UI, ivoire/espresso, cuivre/indigo. Pas de nouvelle sidebar dupliquant la navigation de l’application.
- Motif extrait du bandeau de la maquette approuvée, WebP, affiché sans agrandissement excessif : haut 40 px / mobile 32 px, bas 24 / 20 px. Barre intelligente et dialogue contextuels héritent du motif via PageCulturalBand.
- Quatre raccourcis : Pointages, Planning, Employés, Rapports. Bouton thème clair/sombre global et persistant.
- Vues Jour / Semaine / Mois, date éditable et navigation par période. Mois complet, lundi–dimanche pour la semaine ; navigation mensuelle sans saut involontaire depuis un 31.
- Résumé réel : nombre de retards, employés distincts concernés, durée cumulée. Employés sans planning applicable signalés séparément, sans conclusion de ponctualité.
- Recherche nom/matricule/entreprise, pagination de 8 arrivées. Détails repliés : source horaire, tolérance réellement appliquée, matricule, entreprise. Lignes relatives indicatives, pas une nouvelle mesure du temps.
- Graphique réel de la période entière, incluant les jours à zéro. Mois défilant dans le seul graphique ; aucune largeur forcée de toute la page.
- Export CSV des résultats recherchés sur toute la période, pas seulement la page visible, avec échappement des séparateurs, guillemets et préfixes de formule.
- Aides repliées et tiroir natif « Règles & tolérance », avec bandeaux, focus contenu, restitution du focus et fermeture Échap. Ce tiroir est explicatif : il n’invente pas de seuil global et ne modifie pas les règles de planning.

## Contrat métier et fiabilité
- Le calcul appartient toujours exclusivement à `encheck_retards_plage` → services SQL existants. Aucune lecture directe de employee_schedules/work_schedules ni nouveau calcul de grille dans le navigateur.
- Correction de présentation dans `construireRetards` : une tolérance SQL de **0** n’est plus remplacée par 15 via `||`. Valeur absente : repli préexistant conservé.
- Pagination API avec ordre stable sur les lignes SQL : évite la troncature silencieuse des périodes longues. Même principe pour le sélecteur d’entreprises.
- Vérification du module terminée avant chargement des résultats pour un administrateur d’entreprise. RLS reste l’autorité ; aucun changement de droits ou SQL.
- Les erreurs des jours fériés sont désormais propagées en mode strict, au lieu de produire silencieusement un calcul sans ce filtre. Erreurs de chargement visibles avec Réessayer ; pas d’affichage de zéros trompeurs ou d’anciennes métriques.
- Réponses tardives ignorées après changement de contexte. États d’accès/chargement et reduced-motion sans délai minimum ajouté.
- Suppression préexistante conservée mais explicitée : elle supprime le **pointage source**, pas uniquement une alerte. Confirmation avertit de l’impact possible sur les heures et calculs. Verrou anti-double-envoi ; aucune annonce de réussite sans ligne renvoyée par la suppression ; erreur conservée dans le dialogue pour réessayer. Aucun pointage réel supprimé pendant les tests.

## Vérifications
- **713 tests / 71 fichiers réussis**, dont 13 nouveaux tests : RPC unique et portée, accès avant lecture, périodes, réponse obsolète, erreurs/retry, pagination UI/API, tolérance zéro, CSV, graphique et confirmation de suppression sur services simulés.
- Tests de câblage du moteur SQL existant conservés et réussis.
- Build Vite/PWA réussi ; avertissement de taille des bundles existant.
- Porte ESLint : zéro erreur, un warning préexistant EnterpriseSelectorModal. git diff --check réussi.
- Chromium : **vraie page Retards montée avec le vrai client Supabase, requêtes interceptées vers un domaine de test**. Clair/sombre × 320, 390, 768, 1440 px. Semaine, mois 31 jours, pagination, recherche, détails, ouverture/annulation de suppression, tiroir de règles, boucle du focus/Échap, thème global et téléchargement CSV vérifiés. Aucun débordement horizontal de document ni erreur JavaScript observée. Captures mobile/desktop inspectées.
- Données synthétiques uniquement ; aucune session authentifiée de production ni preuve de RLS production. Aucun SQL, déploiement, écriture de données réelles ou modification des dépendances versionnées.
