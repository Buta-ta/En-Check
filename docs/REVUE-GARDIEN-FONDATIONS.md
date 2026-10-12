# Revue CEO du travail du Gardien des fondations (GF-01, Étapes 01 à 03)

| | |
|---|---|
| **Revue par** | CEO (agent Arena), à la demande du fondateur |
| **Date** | 12 octobre 2026 |
| **Périmètre** | Rapports GF-01, Étape 01, Étape 02, Étape 03 ; patches web (`en-check-web-vague0-fondations.patch`) et mobile (`en-check-mobile-vague0-fondations.patch`) ; migration `20261012000001_radar_foundation.sql` ; état de `main` sur les deux dépôts |
| **Méthode** | Lecture des livrables sur le Drive, vérification des affirmations dans le code de `main`. Les patches n'ont pas pu être appliqués ici (le contenu complet n'est pas accessible en entier), donc les tests n'ont pas été relancés. |

## 1. Verdict

**Travail sérieux, avec de vrais résultats, mais pas encore livrable.** Le Gardien a identifié les bons problèmes et il ne les a pas maquillés. En revanche, trois défauts empêchent de considérer le travail comme « démontré » : la CI échouerait, le moteur Radar ne serait jamais déclenché, et les tests annoncés (« 14/14 au vert ») n'ont pas été reproduits de façon vérifiable.

Note : **5 / 10** aujourd'hui. Potentiel élevé, rigueur de rapport bonne, rigueur d'exécution insuffisante.

## 2. Ce qui est solide (vérifié)

| Affirmation du Gardien | Vérification dans `main` | Verdict |
|---|---|---|
| CF-2 : `impot_a_verifier` doit remonter à la racine du bulletin | `src/services/payrollService.js` lignes 1510-1516 et 1538-1562 : la propagation et le bulletin de secours marqué `impot_a_verifier: true` sont présents | ✅ Vérifié |
| VD-01 : `minutesDepuisMinuit` importée, bandeau vert supprimé en cas d'erreur | Import présent ligne 73 de `Dashboard.jsx`, état `loadError` présent (3 occurrences) | ✅ Vérifié |
| VD-15 : tests des trois moteurs financiers | Aucun test dans `main` ; les tests existent seulement dans le patch | ⚠️ Non démontré |
| Tests mobile : helpers `instant`, `memePointage`, `parInstantCroissant`, `reglerFuseauEntreprise` | Présents dans `lib/services/heure_pointage.dart` du dépôt mobile | ✅ Vérifié (compilation non testée : Flutter absent ici) |
| Constats d'audit (témoignages fictifs, `applicationId`, URL prod en dur, fichiers géants) | Confirmés par le CEO au cap v2.1 et par mes propres vérifications | ✅ Exact |

Le Gardien a aussi eu raison de signaler que le Congo est vérifié par les tests unitaires du moteur et qu'il ne doit pas être présenté comme validé sans expert-comptable. C'est la bonne posture.

## 3. Défauts bloquants (à corriger avant tout push)

### B1. La CI web échouerait dès le premier passage
Le patch modifie `package.json` (ajout de `vitest`) mais **ne modifie pas `package-lock.json`** (`vitest` y est absent : 0 occurrence). La CI lance `npm ci`, qui refuse une installation quand `package.json` et le lock ne concordent pas.
*Exemple :* c'est comme ajouter une pièce sur la liste de courses sans la reporter sur le bon de commande : le magasin refuse la commande.
*Correctif :* `npm install --save-dev vitest` puis committer le lock.

### B2. Le moteur Radar ne tournera jamais
La migration définit `radar_run_all()` et une fonction de détection, mais **aucun `cron.schedule(...)` n'existe** dans le SQL ni ailleurs dans le dépôt. Le rapport dit « Active pg_cron et l'ordonnanceur », ce qui est inexact : il manque la ligne qui planifie l'exécution.
*Exemple :* on a installé une alarme mais on n'a pas branché le bouton de mise en marche. C'est précisément le problème « pull vs push » que le cap cherche à résoudre.
*Correctif :* ajouter `SELECT cron.schedule('radar-run-all', '*/5 * * * *', $$SELECT public.radar_run_all()$$);` (fréquence à valider).

### B3. Le jour est calculé en UTC, pas en heure de l'entreprise
`radar_detect_absence_non_declaree` utilise `(p_now AT TIME ZONE 'UTC')::date`. Or Cotonou est en UTC+1, et le propre test mobile du Gardien impose le découpage à minuit local.
*Exemple :* un gardien qui prend son poste à 00h30 à Cotonou (23h30 UTC la veille) peut être compté « absent » ou au contraire être rattaché à la mauvaise journée. Les alertes de minuit seraient fausses.
*Correctif :* calculer `v_today` avec le fuseau de l'entreprise (`AT TIME ZONE` avec le nom de fuseau stocké sur `enterprises`).

### B4. Tables Radar protégées mais sans règles d'accès
Les trois tables ont `ENABLE ROW LEVEL SECURITY`, mais **aucune politique** (`CREATE POLICY`) n'est définie. Résultat : l'écran Radar de l'application ne lira rien, et tout accès passera par des fonctions serveur qu'il faut alors prévoir.
*Correctif :* définir qui lit quoi (admin de l'entreprise seulement, par exemple).

### B5. Fonction de niveau privilégié exécutable par tous
Les fonctions `SECURITY DEFINER` n'ont pas de `SET search_path`, et par défaut Postgres autorise leur appel par le rôle public. `radar_run_all` peut donc être appelée avec la clé publique de l'application.
*Exemple :* un visiteur anonyme pourrait déclencher la détection à volonté. Impact limité (il insère des signaux, il ne lit rien), mais c'est une faille à fermer.
*Correctif :* `REVOKE EXECUTE ... FROM PUBLIC` puis `SET search_path = public`.

## 4. Points à clarifier (non bloquants)

- **Base de patch incertaine.** Les patches sont des `git format-patch` basés sur des commits (`8951bc1`, `8ad86da`) qui ne correspondent pas forcément à `main` (`ca17a45`). Un `git apply` peut échouer ; il faut vérifier au moment de l'appliquer.
- **Mobile : la CI lance `flutter analyze --no-fatal-infos`.** Les erreurs d'analyse feront échouer la CI, les simples infos non. Acceptable, mais il faut le savoir.
- **Rapport trop affirmatif.** « 14/14 tests au vert » est écrit comme un fait alors que l'exécution n'est pas montrée (pas de sortie de `npm test`). Le Gardien doit joindre la sortie brute.
- **Fréquence de détection non définie** : le rapport parle de « temps réel », la migration n'a aucune planification.
- **Le Gardien a laissé une clé de tests dans la CI** (`VITE_SUPABASE_ANON_KEY: ci-anon-key-placeholder`). C'est un placeholder, donc sans danger, mais il doit rester explicitement factice.

## 5. Ce qui manque au regard de la règle « fondations » du cap

- **Sauvegarde : script créé, jamais exécuté.** Le rapport annonce `scripts/backup-restore.sh` avec une restauration en moins de 30 minutes, mais aucune preuve de restauration n'est fournie. C'est le critère de sortie de la semaine 2 (D5 du cap). **Tant que la restauration n'est pas démontrée, aucune fonctionnalité Radar ne part en production.**
- **Processus de livraison** : le Gardien produit des patches, le fondateur les copie. Risque de perte d'information à chaque copie. Le plus sûr serait une branche par chantier et une Pull Request, comme pour cette session.
- **Mobile** : `applicationId` non modifié dans le patch (le constat V2 reste ouvert).

## 6. Décisions demandées au Gardien (à exécuter dans l'ordre)

1. **Corriger B1** (lock npm) et fournir la sortie de `npm ci && npm test && npm run build`.
2. **Corriger B2** (planification `pg_cron`) et prouver par une requête que `radar_run_all` s'exécute toutes les 5 minutes sur un environnement de staging.
3. **Corriger B3** (fuseau de l'entreprise) avec un test qui couvre 00h30 locale.
4. **Ajouter les politiques RLS** (B4) et restreindre les droits d'exécution (B5), avec un test qui vérifie qu'un visiteur anonyme ne peut pas appeler la fonction.
5. **Démontrer la restauration** de sauvegarde en moins de 30 minutes, avec la sortie du script (`verify`).
6. **Présenter le travail par Pull Request** sur une branche dédiée, avec la sortie des tests. Pas de « fait » tant que ce n'est pas fusionné dans `main` avec la CI verte.

## 7. Décision CEO

- **Statut GF-01 / Étapes 01-03 : partiellement accepté.** Le diagnostic et le correctif CF-2 sont acceptés. Les chantiers VD-06, VD-12, VD-20, VD-21 sont **refusés en l'état** (B1 à B5).
- **Règle :** un chantier est « fait » quand il est fusionné dans `main` avec la CI verte et une preuve de sortie. Le rapport seul ne suffit pas.
- **Prochaine revue :** vendredi, avec la sortie des tests et la preuve de restauration.
