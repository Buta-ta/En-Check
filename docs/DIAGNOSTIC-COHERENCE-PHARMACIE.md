# Diagnostic de cohérence — Pharmacie Blanche Gomes

## État : diagnostic de code fait, lecture production en attente

Aucun accès direct à la production dans cette session. Aucun correctif métier,
aucune modification de badge, de planning ou de notification. Ne pas considérer
les résultats de la base fictive comme des résultats de la pharmacie.

## Divergences vérifiées dans le dépôt

1. `src/pages/Dashboard.jsx` : `presentsToday` compte les employés avec au moins
   un badge du jour, sans retirer ceux ayant une sortie. Libellé « présents » ambigu.
2. Même fichier : oubli de sortie = dernier badge brut `in` depuis **plus de 8h**,
   constante locale ; cela ne signifie pas qu’une sortie présumée existe en base.
3. `src/services/hoursCalculator.js`, `resoudrePointagesJournee` : seuil d’oubli
   lu dans les réglages (repli 12h), exceptions de journée passée et décisions
   d’écartement ; production d’une estimation virtuelle distincte des badges.
4. Même moteur : sortie réelle non modifiée moins de `seuilRebondSecondes` après
   l’entrée conservée à l’audit mais non retenue pour fermer la session. Repli 60s.
   Les 12 secondes montrées pour Welcome sont compatibles avec cette règle ;
   il faut vérifier seuil et ligne réelle avant de conclure.
5. `src/hooks/useNotifications.js` : calcul propre des retards, lecture des
   affectations SANS filtre `is_active`, lecture des grilles liées SANS filtre
   `is_active`, et repli sur grille générale active par défaut. Pas de contrôle
   de `module_planning` dans ce chemin. Les entrées ne sont pas triées et la
   première trouvée par `.find` n’est donc pas forcément la première du jour.
   Ces défauts de sélection sont des pistes supplémentaires pour les 4 retards.
6. `src/pages/Pointages.jsx` : affichage du planning général conditionné par
   `module_planning !== false`, affectations personnelles lues avec `is_active=true`.
   Deux écrans peuvent donc afficher des diagnostics différents des mêmes tables.

Ce sont des constats sur le code du dépôt, pas une preuve de la configuration ni
de la version réellement chargée dans le navigateur de l’utilisateur.

## Exécution du diagnostic

Fichier : `supabase/outils-sql/20261019_diagnostic-coherence-pharmacie.sql`.
Copier intégralement dans Supabase SQL Editor, Run, exporter le tableau final CSV.
Date supposée : 2026-10-19 ; vérifier la date des captures et modifier si nécessaire.
L’heure d’observation n’est pas connue : par défaut la requête utilise l’heure
actuelle. Les anciennetés calculées maintenant ne reproduisent pas une capture
passée. Renseigner `reference_observation` avec décalage UTC si cette heure est connue.

Le préflight arrête explicitement si une table attendue manque. Si le nom ne
correspond pas à une entreprise unique, aucun détail métier n’est exporté.
Le script liste les colonnes réelles et lit les colonnes optionnelles par JSON,
pour éviter les erreurs historiques sur des colonnes de planning inexistantes.
Aucune fonction métier/RPC n’est appelée, même pour calculer une journée : cela
évite tout effet de bord de fonctions de production non vérifiées.

Sections : contrôle/fuseau/date ; schéma ; réglages entreprise ; identifiants
employés sans noms ; réglages pointage globaux/locaux ; compteurs bruts ; derniers
badges ; badges J-1 à J+1 ; gestes proches ; toutes affectations y compris inactives ;
grilles entreprise et liées (y compris celles d’une autre entreprise si référencées).
Les badges détaillés sont plafonnés à 2000, avec le nombre total annoncé.
Pas de salaires, coordonnées, notes, photos ou données biométriques exportés.

Après retour du CSV : comparer les seuils globaux/locaux et doublons éventuels,
les décisions d’estimation, la paire de 12 secondes et les affectations inactives.
Ne jamais valider/supprimer une sortie réelle simplement pour faire correspondre
les écrans. Planning absent ≠ repos, sortie manquante ≠ présence physique certaine.

## Validation locale

SQL exécuté sur PostgreSQL embarqué PGlite avec données fictives, dans une transaction
READ ONLY puis ROLLBACK : 11 sections retournées, 5 personnes avec badges, 3 dernières
sorties, 2 dernières entrées >8h, paire à 12s détectée, affectation inactive visible.
Colonnes optionnelles absentes tolérées. Nom ambigu -> détails vides. Table absente
-> message de préflight explicite. Aucun appel à la base réelle ou à un fournisseur IA.
