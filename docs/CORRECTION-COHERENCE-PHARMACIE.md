# Cohérence dashboard, cloche et Pointages

## Périmètre validé
Suite au diagnostic de production en lecture seule : modules Planning et Retards
désactivés, ancienne grille 08:00–17:00 inactive et six affectations inactives ;
seuil d’oubli 12h et anti-rebond 60s globaux. Les deux gestes rapprochés de Welcome
et Junior ne sont pas modifiés par ce lot. Aucun SQL, secret ni Edge à déployer.

## Changements

- Cloche (`useNotifications`, `notificationRetardContext`) : seules les entreprises
  avec les deux modules explicitement actifs sont évaluées. Seules les affectations
  et grilles actives sont chargées. Une grille liée ne peut appartenir à une autre
  entreprise. Les affectations actives ambiguës ne sont pas choisies arbitrairement.
  Pas de grille générale choisie arbitrairement si plusieurs actives par défaut.
  Lecture des entrées triée chronologiquement ; tolérance de zéro conservée ; heure
  convertie avec le fuseau de l’entreprise, fuseau invalide non évalué. Erreurs de
  lecture remontées au chemin d’erreur existant, pas de calcul sur données partielles.
- Dashboard : les compteurs existants conservent leur définition cumulée mais sont
  renommés « ayant pointé aujourd’hui », pas une preuve de présence actuelle.
  Les deux chargements (entreprise et global) utilisent `chargerSeuilsPointage`
  pour l’oubli : seuil par entreprise, atteint avec >=, plus de constante 8h.
  Une sortie manquante à vérifier n’est plus présentée comme une estimation à valider.
- Moteur Pointages : ajout purement descriptif de `sortiesNonRetenues` dans la
  branche anti-rebond existante, avec heure, écart et seuil. Aucun changement des
  décisions d’appariement, des heures ou des badges. Carte et détail affichent
  pourquoi la sortie a été écartée du calcul tout en restant enregistrée. Une
  session ouverte n’est plus libellée « En poste (aucune sortie) ».
- Aucun changement du redesign général, des droits, des règles de paie ou des
  actions de confirmation existantes.

## Limites à ne pas masquer

Le dashboard reste une vue des badges bruts du jour ; il n’exécute pas toute la
résolution des nuits/estimations de Pointages. Ce lot partage le seuil d’oubli,
mais ne prétend pas remplacer tous les moteurs par un moteur unique. Les badges
rapprochés demandent encore une décision humaine. Les anciennes notifications
persistées ou déjà envoyées en push ne sont ni supprimées ni corrigées rétroactivement.
Le calcul de retard de la cloche n’est pas entièrement remplacé par le moteur
Retards (règles de jour travaillé, validité temporelle, nuit et fériés restent à
harmoniser). La correction immédiate empêche notamment de calculer des retards
pour cette pharmacie dont les modules sont désactivés.

## Vérifications

278 tests Vitest / 33 fichiers, dont tests de seuils par entreprise, modules off,
grilles/affectations inactives, liaison interentreprise, erreurs réseau, badge à
12s non retenu mais conservé, sortie modifiée respectée, doubles entrées et rendu
du motif. 55 tests Edge réussis. Lint ciblé zéro erreur / un warning préexistant ;
compilation Vite/PWA et diff --check réussis. Pas de validation visuelle dans une
session de production. Installation xlsx temporaire puis restauration des deux
manifestes : aucune modification de dépendance livrée.

Déploiement : fusion/revue de la PR puis frontend. Aucune écriture en production
par l’agent pendant ce lot. Les validations/suppressions de pointages de Welcome
ou Junior restent hors périmètre.
