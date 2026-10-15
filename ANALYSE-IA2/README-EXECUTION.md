# 📋 Comment exécuter ces fondations — mode d'emploi (IA DEV 2)

Ce dossier contient tout ce qu'il faut pour mettre en service la nouvelle
architecture de clôture automatique **sans risque pour la paie ni pour les
pointages**. Lis cette page avant de toucher à Supabase.

## Les trois fichiers

| Fichier | À quoi ça sert | Où il s'exécute |
|---|---|---|
| `../supabase/migrations/20261016000001_fondations_auto_close_structure.sql` | **LE correctif.** Colonnes, seuils uniques, cascade à 5 niveaux, mode ombre, réconciliation, journaux, RLS, cron | Éditeur SQL Supabase (projet `cxggndvhwdolbtyezjde`), ou automatiquement si tu laisses la branche se déployer |
| `test-execution-migration.sql` | La **fumée** : 24 contrôles qui disent « ok… := true » quand la règle est bien appliquée | Postgres **local uniquement**, jamais la production |
| `squelette-supabase-local.sql` | Le mini-monde qui imite Supabase (rôles, `auth.jwt()`, tables partagées) pour pouvoir lancer la fumée | Postgres local |
| `diagnostic-auto-close-probleme2.sql` | Le constat d'origine (sections A→G) : ce qui clochait avant, chiffres à l'appui | Lecture seule, n'importe où |

## Pourquoi un harnais d'exécution, alors que la migration « passe » déjà

Un fichier de migration est appliqué sans être relu : **Postgres ne compile le
code des fonctions PL/pgSQL qu'à la première exécution**. Une migration peut donc
s'appliquer « sans erreur » et casser au premier cron, à 04:30 du matin.

En exécutant vraiment cette migration sur un Postgres, la fumée a sorti **quatre
bugs** qu'aucune relecture n'avait vus :

1. `d.check_time` au lieu de `d.entree` dans la sélection de la cascade → **toute
   la clôture pivotable échouait dès le premier tour** ;
2. `round(double precision, integer)` n'existe pas → les statistiques du mode
   ombre (ce que l'arbitre doit lire pour décider d'activer) ne tournaient pas ;
3. `work_days` (JSONB) casté en `integer[]` → « malformed array literal » dans la
   vitre de compatibilité appelée par le mobile ;
4. l'idempotence des rebonds : le contrôle « déjà traité » ne regardait que
   l'entrée → chaque nuit re-marquait et re-journalisait les mêmes doubles scans.

**Réflexe à garder pour les deux IA : une migration non exécutée est une
migration non testée.**

## Lancer la fumée chez toi (5 minutes)

```bash
# Postgres 15+ local (Docker suffit). Ne jamais pointer sur la base de prod.
docker run -d --name pgtest -e POSTGRES_PASSWORD=mdp -p 5433:54 postgres:16

# 1) squelette, 2) migration à tester, 3) re-jeu de la migration (elle doit être
#    rejouable sans erreur), 4) la fumée. ON_ERROR_STOP=0 exprès : on veut TOUTES
#    les erreurs d'un coup, pas seulement la première.
psql "postgresql://postgres:mdp@localhost:5433/postgres" -f squelette-supabase-local.sql
psql "postgresql://postgres:mdp@localhost:5433/postgres" -v ON_ERROR_STOP=1 \
     -f ../supabase/migrations/20261016000001_fondations_auto_close_structure.sql
psql "postgresql://postgres:mdp@localhost:5433/postgres" -v ON_ERROR_STOP=1 \
     -f ../supabase/migrations/20261016000001_fondations_auto_close_structure.sql
psql "postgresql://postgres:mdp@localhost:5433/postgres" -v ON_ERROR_STOP=0 \
     -f test-execution-migration.sql
```

Ce qu'il faut voir défiler : **24 lignes `ok_… := true`** et **zéro ligne
`ÉCHEC …`**. Les deux `ok_negatif`/`ok_oubli_pas_encore_mur` prouvent que le
harnais sait aussi détecter une erreur et qu'un moteur honnête ne s'invente pas
*avant* l'heure.

## Ordre de mise en service en production

1. **Appliquer la migration.** À ce stade, `mode_estimation = "ombre"` : le
   moteur consigne ses décisions dans `encheck_clotures_estimees` et **n'écrit
   rien dans `attendances`**. La paie, les pointages et les alertes existantes
   ne bougent pas.
2. **Vérifier le cron** (section 16 de la migration) : deux jobs nommés,
   `encheck-alertes-scan` (toutes les 10 min) et `encheck-cloture-pivotable`
   (04:30, uniquement pour les journées ≤ la veille). Si `pg_cron` n'est pas
   accessible au rôle utilisé, la migration affiche une NOTICE : planifier les
   deux jobs depuis le panneau « Jobs » du dashboard, avec les mêmes noms.
3. **Contrôles après exécution** (section 17 du fichier de migration) : le mode
   est bien `ombre`, la grille fantôme est morte, les seuils sont uniques.
4. **Deux semaines de mode ombre.** Lire les chiffres (ci-dessous). Décision
   d'activation **entreprise par entreprise**, pas globalement.
5. Pour une entreprise prête : `UPDATE public.encheck_reglages_pointage SET
   valeur='"actif"'::jsonb WHERE cle='mode_estimation' AND enterprise_id = <id>;`
   → les sorties présumées commencent à être écrites (marquées, non payées).
6. **Retour arrière** à tout moment : remettre `'"ombre"'` (ou `'"desactive"'`).
   Rien n'est jamais supprimé ; les lignes déjà écrites restent marquées
   `is_auto_closed = true` et continuent d'être exclues de la paie tant
   qu'aucun humain ne les valide.

## Les chiffres à regarder pendant le mode ombre

```sql
-- Précision par niveau, sur 45 jours glissants.
SELECT * FROM public.encheck_clotures_statistiques(NULL, 45);

-- Ce que le Niveau 2 (apprentissage) aurait donné, et pourquoi il se tait.
SELECT niveau, count(*) AS n, count(*) FILTER (WHERE sortie_estimee IS NOT NULL) AS proposes,
       count(*) FILTER (WHERE motif_rejet IS NOT NULL) AS rejetes
  FROM public.encheck_clotures_estimees
 WHERE jour_travail >= (now() AT TIME ZONE 'Africa/Porto-Novo')::date - 45
 GROUP BY niveau ORDER BY n DESC;

-- Les cas litigieux : ce que le moteur aurait inventé et qu'un humain a corrigé.
SELECT c.jour_travail, e.first_name || ' ' || e.last_name AS employe, c.niveau,
       to_char(c.sortie_estimee AT TIME ZONE 'Africa/Porto-Novo','HH24:MI') AS estimee,
       to_char(c.sortie_reelle  AT TIME ZONE 'Africa/Porto-Novo','HH24:MI') AS reelle,
       c.ecart_minutes
  FROM public.encheck_clotures_estimees c
  JOIN public.employees e ON e.id = c.employee_id
 WHERE c.sortie_reelle IS NOT NULL AND abs(c.ecart_minutes) > 30
 ORDER BY abs(c.ecart_minutes) DESC LIMIT 40;
```

Seuil de confiance proposé à l'arbitre : **activer une entreprise quand
`couverture_pct ≥ 60 %` ET `ecart_median_min ≤ 15` ET `dans_30_pct ≥ 80 %`.**
Tant que ces trois nombres ne sont pas réunis, l'entreprise reste en ombre : ce
n'est pas une punition pour l'algorithme, c'est une protection pour la paie.

## Ce qui reste à la charge de l'autre IA (DEV 1, dépôt pointage)

* Remplacer le **corps vide** de `public.encheck_estimer_sortie_comportementale`
  par le vrai apprentissage (cahier des charges §5 écrit en commentaire de la
  fonction : cluster d'arrivée **circulaire** ±90 min, cible = **médiane des
  heures de sortie**, `n ≥ 5`, `IQR ≤ 45 min`, entraînement seulement sur
  `is_auto_closed = false AND modifie_le IS NULL`).
  ⚠️ Ne pas renommer la fonction, ne pas ajouter de `CREATE OR REPLACE` ailleurs :
  la signature est un contrat, les seuils arrivent **en paramètres**.
* Le nudge PUSH à +20 min (`nudge_apres_minutes`) côté boîtier ; jamais de SMS ni
  d'email payant (§0 de l'arbitrage).
* Le mobile doit continuer d'appeler `encheck_resoudre_grille_employe` : c'est
  désormais une vitre sans grille fantôme, aucune modification de son côté n'est
  nécessaire.

## Point d'attention pour l'arbitre (une dette signalée, pas corrigée ici)

`src/pages/Rapports.jsx` contient une **copie conforme** de
`PayrollService.calculateWorkedMinutesByDay`. Le filtre « pas de paie sur une
sortie présumée non validée » a été appliqué **aux deux endroits** (sinon le
rapport et le bulletin racontent deux histoires différentes), mais le vrai
nettoyage consiste à supprimer le doublon. Ce n'est pas fait dans cette PR, pour
ne pas mélanger un correctif de paie avec un remaniement de 600 lignes de
rapports.
