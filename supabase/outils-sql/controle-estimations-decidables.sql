-- ═══════════════════════════════════════════════════════════════════════════
--  EN-CHECK — OUTIL — « CETTE SORTIE EST-ELLE DÉCIDABLE ? »
-- ═══════════════════════════════════════════════════════════════════════════
--  EXÉCUTER : éditeur SQL Supabase → coller le fichier ENTIER → Run.
--             psql convient aussi : aucune méta-commande psql, aucun rôle local.
--  ⚠️ 100 % LECTURE SEULE. Aucun INSERT / UPDATE / DELETE / ALTER / CREATE / GRANT.
--     Tu peux le relancer trente fois, il ne change rien à la base.
--
--  POURQUOI CE SCRIPT EXISTE (16/10, deux erreurs sur le même bouton)
--  ──────────────────────────────────────────────────────────────────
--    08:36 — « Valider » répond 404 : le JS envoyait le paramètre `p_action`,
--            la base déclare `p_decision`. Corrigé dans la PR #9.
--    08:54 — « Valider » répond 400 :
--              invalid input syntax for type uuid: "virtual-out-e24bb1d9-…"
--            Cette fois le nom était bon. La VALEUR ne pouvait pas l'être :
--            `encheck_estimation_statuer(p_ids uuid[], …)` met à jour une ligne
--            de `attendances`, et l'appli avait sous la main une sortie que le
--            MOTEUR D'AFFICHAGE venait d'inventer à la lecture (id de facture
--            `virtual-out-<uuid de l'entrée>`, `hoursCalculator.js` l.511/636/1639).
--            Corrigé dans la PR qui suit : le bandeau ne propose plus de décision
--            que sur une ligne réellement en base.
--
--  CE QUE CE SCRIPT RÉPOND, et que nul écran de l'admin ne montre
--    1  pour chaque entreprise : le mode de l'estimation, et le NOMBRE de lignes
--       réellement statuable. C'est le chiffre qui tranche le débat. En mode
--       « ombre » — le défaut de toute entreprise tant que personne n'a écrit
--       `mode_estimation = 'actif'` — `encheck_cloturer_pivotable` N'ÉCRIT RIEN
--       dans `attendances` (migration l.992 : `IF v_mode = 'actif'`, et l.874 :
--       `applique := false`) ; tout part dans `encheck_clotures_estimees`. Donc :
--         · zéro ligne à valider en base, et
--         · le bandeau ne peut s'afficher QUE sur une sortie inventée,
--       c'est-à-dire précisément sur les lignes où cliquer ne voulait rien dire.
--    2  le déclencheur tourne-t-il (pg_cron + `encheck_pipeline_runs`), et avec
--       quel mode annoncé — sans jamais toucher `cron.job` si ce rôle n'a pas
--       le droit de le lire (le test passe par `information_schema.tables`, qui
--       ne montre que ce qui est réellement lisible ici).
--    3  les décisions VRAIMENT écrites, lues dans le journal d'audit. Attendu
--       aujourd'hui : `estimation_validee` et `estimation_rejetee` à 0 — preuve
--       positive que les deux clics du matin n'ont modifié aucune paie.
--    4  les journées qui ne seront JAMAIS consignées : entrée de J-1 ou plus
--       ancien, sans badge de sortie dans les 36 h, sans estimation en base et
--       sans trace dans la table d'ombre. C'est la liste que la paie regarde.
--
--  APPROXIMATION ASSUMÉE : §4 date les lignes en UTC (`check_time::date`), alors
--  que le moteur d'affichage utilise le jour de TRAVAIL avec bascule. Une journée
--  qui commence après minuit heure locale peut donc apparaître la veille. §4 est
--  une liste de travail, pas un chiffre de paie.
-- ═══════════════════════════════════════════════════════════════════════════


-- ─────────────────────────────────────────────────────────────────────────────
--  1. PAR ENTREPRISE : CE QUI EST DÉCIDABLE, VRAIMENT
--      « décidable » = ligne `attendances` marquée auto_close, pas encore validée,
--      pas encore remplacée — exactement le `WHERE` de `encheck_estimation_statuer`.
-- ─────────────────────────────────────────────────────────────────────────────
WITH etat AS (
  SELECT en.id                                            AS enterprise_id,
         en.name                                          AS entreprise,
         public.encheck_mode_estimation(en.id)            AS mode_estimation,
         en.auto_close_enabled                            AS auto_close_active,
         public.encheck_seuil(en.id, 'appariement_heures', 16)       AS appariement_heures,
         public.encheck_seuil(en.id, 'plafond_invention_heures', 12) AS plafond_invention_heures,
         (SELECT count(*) FROM public.attendances a
           WHERE a.enterprise_id = en.id AND a.is_auto_closed = true)                       AS estimations_en_base,
         (SELECT count(*) FROM public.attendances a
           WHERE a.enterprise_id = en.id AND a.is_auto_closed = true
             AND a.estimation_validee_le IS NOT NULL)                                       AS validees,
         (SELECT count(*) FROM public.attendances a
           WHERE a.enterprise_id = en.id AND a.is_auto_closed = true
             AND a.estimation_remplacee_le IS NOT NULL)                                     AS remplacees_ou_ecartees,
         (SELECT count(*) FROM public.attendances a
           WHERE a.enterprise_id = en.id AND a.is_auto_closed = true
             AND a.estimation_validee_le IS NULL
             AND a.estimation_remplacee_le IS NULL)                                         AS decidables,
         (SELECT count(*) FROM public.encheck_clotures_estimees c
           WHERE c.enterprise_id = en.id)                                                   AS traces_en_ombre,
         (SELECT count(*) FROM public.encheck_clotures_estimees c
           WHERE c.enterprise_id = en.id AND c.applique)                                    AS ombres_appliquees
    FROM public.enterprises en
)
SELECT entreprise,
       mode_estimation,
       auto_close_active,
       appariement_heures,
       plafond_invention_heures,
       estimations_en_base,
       validees,
       remplacees_ou_ecartees,
       decidables,
       traces_en_ombre,
       ombres_appliquees,
       CASE
         WHEN mode_estimation <> 'actif' AND decidables = 0 AND estimations_en_base = 0
           THEN '⚠️ AUCUNE LIGNE À STATUER EN BASE — le bandeau de décision ne peut '
                || 's’afficher que sur une sortie inventée à l’écran. Mode « '
                || mode_estimation || ' » : le serveur mesure, il n’écrit pas.'
         WHEN mode_estimation <> 'actif' AND decidables = 0
           THEN 'mode « ' || mode_estimation || ' » : des lignes existent déjà en base '
                || '(écrites avant, ou par un autre moteur) — rien en attente.'
         WHEN decidables > 0
           THEN decidables::text || ' ligne(s) décidable(s) maintenant — les boutons ont '
                || 'une cible réelle.'
         ELSE 'ok'
       END AS verdict
  FROM etat
 ORDER BY decidables, estimations_en_base, entreprise;


-- ─────────────────────────────────────────────────────────────────────────────
--  2. LE DÉCLENCHEUR TOURNE-T-IL ?
--      `pg_cron` est dans la base « postgres », pas forcément ici ; et la lecture
--      de `cron.job` est souvent refusée au rôle SQL. D'où `information_schema`,
--      qui ne répond OUI que si la table est là ET lisible. Le nombre de runs du
--      pipeline, lui, est la preuve directe : 0 run = aucune consignation possible.
-- ─────────────────────────────────────────────────────────────────────────────
SELECT (SELECT count(*) FROM pg_extension WHERE extname = 'pg_cron') > 0
                                                        AS extension_pg_cron_ici,
       (SELECT count(*) FROM information_schema.tables
         WHERE table_schema = 'cron' AND table_name = 'job') > 0
                                                        AS cron_job_lisible,
       (SELECT count(*) FROM public.encheck_pipeline_runs)          AS runs_total,
       (SELECT count(*) FROM public.encheck_pipeline_runs
         WHERE demarre_le >= now() - interval '2 days')             AS runs_dernieres_48h,
       to_char((SELECT max(demarre_le) FROM public.encheck_pipeline_runs)
               AT TIME ZONE 'UTC', 'YYYY-MM-DD HH24:MI')            AS dernier_demarrage_utc,
       (SELECT mode FROM public.encheck_pipeline_runs
         ORDER BY demarre_le DESC LIMIT 1)                          AS dernier_mode_annonce,
       (SELECT consignations FROM public.encheck_pipeline_runs
         ORDER BY demarre_le DESC LIMIT 1)                          AS dernieres_consignations,
       (SELECT avertissement FROM public.encheck_pipeline_runs
         ORDER BY demarre_le DESC LIMIT 1)                          AS dernier_avertissement;


-- ─────────────────────────────────────────────────────────────────────────────
--  3. LES DÉCISIONS RÉELLEMENT ÉCRITES (journal d'audit)
--      `encheck_estimation_statuer` n'insère une ligne de journal QUE si son
--      UPDATE a trouvé une cible (`IF FOUND`). Un compteur à 0 sur
--      `estimation_validee` / `estimation_rejetee` est donc la preuve, pas un
--      hasard : ni le 404 de 08:36 ni le 400 de 08:54 n'ont touché la paie.
-- ─────────────────────────────────────────────────────────────────────────────
SELECT j.action,
       count(*)                                       AS nb,
       to_char(min(j.horodatage) AT TIME ZONE 'UTC', 'YYYY-MM-DD HH24:MI') AS premiere,
       to_char(max(j.horodatage) AT TIME ZONE 'UTC', 'YYYY-MM-DD HH24:MI') AS derniere
  FROM public.encheck_pointages_journal j
 WHERE j.action IN ('estimation_inseree', 'estimation_validee',
                    'estimation_rejetee', 'estimation_remplacee')
 GROUP BY j.action
 ORDER BY nb DESC, j.action;

-- Et les cinq derniers mouvements, motifs en clair (le motif par défaut de la
-- fonction est la décision elle-même ; un autre texte vient d'ailleurs).
SELECT to_char(j.horodatage AT TIME ZONE 'UTC', 'YYYY-MM-DD HH24:MI:SS') AS quand_utc,
       j.action, j.motif, j.pipeline, j.attendance_id
  FROM public.encheck_pointages_journal j
 WHERE j.action IN ('estimation_inseree', 'estimation_validee',
                    'estimation_rejetee', 'estimation_remplacee')
 ORDER BY j.horodatage DESC
 LIMIT 5;


-- ─────────────────────────────────────────────────────────────────────────────
--  4. ⭐ LES JOURNÉES QUE PERSONNE NE TRANCHERA JAMAIS
--      Entrée de J-1 ou plus ancien, aucun badge de sortie dans les 36 h, aucune
--      estimation en base, aucune trace en table d'ombre. C'est le trou réel : ni
--      badge, ni estimation, donc 0 seconde partout — et aucun bouton n'y peut
--      rien, parce qu'il n'y a rien à valider.
-- ─────────────────────────────────────────────────────────────────────────────
WITH orphelines AS (
  SELECT i.id, i.enterprise_id, i.employee_id, i.check_time,
         round(EXTRACT(EPOCH FROM (now() - i.check_time)) / 3600.0, 1) AS heures_depuis_entree
    FROM public.attendances i
   WHERE lower(i.check_type::text) = 'in'
     AND i.is_auto_closed = false
     AND i.check_time >= now() - interval '30 days'
     AND i.check_time::date < now()::date            -- J-1 et avant : le cron a eu sa chance
     AND NOT EXISTS (SELECT 1 FROM public.attendances o
                      WHERE o.employee_id = i.employee_id
                        AND lower(o.check_type::text) = 'out'
                        AND o.check_time >  i.check_time
                        AND o.check_time <= i.check_time + interval '36 hours'
                        AND o.is_auto_closed = false)
     AND NOT EXISTS (SELECT 1 FROM public.attendances e
                      WHERE e.estimation_source_id = i.id)
     AND NOT EXISTS (SELECT 1 FROM public.encheck_clotures_estimees c
                      WHERE c.attendance_in_id = i.id)
)
SELECT count(*)                          AS journees_sans_sortie_ni_estimation,
       max(o.heures_depuis_entree)       AS la_plus_ancienne_heures,
       round(avg(o.heures_depuis_entree), 1) AS moyenne_heures
  FROM orphelines o;

-- Les quinze plus vieilles, avec qui et où (pour appeler, pas pour payer).
WITH orphelines AS (
  SELECT i.id, i.enterprise_id, i.employee_id, i.check_time,
         round(EXTRACT(EPOCH FROM (now() - i.check_time)) / 3600.0, 1) AS heures_depuis_entree
    FROM public.attendances i
   WHERE lower(i.check_type::text) = 'in'
     AND i.is_auto_closed = false
     AND i.check_time >= now() - interval '30 days'
     AND i.check_time::date < now()::date
     AND NOT EXISTS (SELECT 1 FROM public.attendances o
                      WHERE o.employee_id = i.employee_id
                        AND lower(o.check_type::text) = 'out'
                        AND o.check_time >  i.check_time
                        AND o.check_time <= i.check_time + interval '36 hours'
                        AND o.is_auto_closed = false)
     AND NOT EXISTS (SELECT 1 FROM public.attendances e
                      WHERE e.estimation_source_id = i.id)
     AND NOT EXISTS (SELECT 1 FROM public.encheck_clotures_estimees c
                      WHERE c.attendance_in_id = i.id)
)
SELECT o.heures_depuis_entree,
       to_char(o.check_time AT TIME ZONE 'UTC', 'YYYY-MM-DD HH24:MI') AS entree_utc,
       nullif(trim(concat_ws(' ', e.first_name, e.last_name)), '')    AS nom,
       e.matricule,
       en.name                                                        AS entreprise
  FROM orphelines o
  JOIN public.employees   e  ON e.id  = o.employee_id
  JOIN public.enterprises en ON en.id = o.enterprise_id
 ORDER BY o.heures_depuis_entree DESC
 LIMIT 15;


-- ─────────────────────────────────────────────────────────────────────────────
--  CONTRÔLE DE COLLAGE — cette ligne est la DERNIÈRE du fichier.
--  Si elle n'apparaît pas, la copie s'est arrêtée en route : relancer le fichier
--  ENTIER, et ne rien conclure d'une section amputée.
-- ─────────────────────────────────────────────────────────────────────────────
SELECT 'FIN DU CONTRÔLE — sections 1 à 4 collées entièrement' AS etat,
       now()                                            AS execute_le;
