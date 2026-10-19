-- DIAGNOSTIC EN LECTURE SEULE : aucun appel RPC métier, aucune correction.
-- Copier TOUT le fichier dans Supabase / SQL Editor, puis Run.
-- Date supposée des captures : 19 octobre 2026. La modifier dans parametres si nécessaire.
-- reference_observation : laisser NULL pour l'heure d'exécution, ou renseigner
-- l'instant exact de la capture AVEC décalage, ex. '2026-10-19 21:30:00+01'.
-- Un seuil atteint maintenant ne prouve pas qu'il l'était lors de la capture.
-- Un seul tableau final à exporter en CSV. Pas de noms, salaires, notes,
-- coordonnées, photos, clés ou données biométriques dans l'export.

DO $diagnostic$
DECLARE nom text; manquantes text[] := ARRAY[]::text[];
BEGIN
  FOREACH nom IN ARRAY ARRAY['enterprises','employees','attendances',
    'employee_schedules','work_schedules','encheck_reglages_pointage'] LOOP
    IF to_regclass('public.' || nom) IS NULL THEN
      manquantes := array_append(manquantes, nom);
    END IF;
  END LOOP;
  IF cardinality(manquantes) > 0 THEN
    RAISE EXCEPTION 'Diagnostic arrêté, tables absentes : %. Ne rien créer : transmettre cette erreur.', array_to_string(manquantes, ', ');
  END IF;
END $diagnostic$;

WITH
parametres AS (
  SELECT 'Pharmacie Blanche Gomes'::text AS entreprise,
         DATE '2026-10-19' AS jour,
         NULL::timestamptz AS reference_observation
),
candidats AS (
  SELECT to_jsonb(e) AS j FROM public.enterprises e, parametres p
  WHERE lower(btrim(to_jsonb(e)->>'name')) = lower(btrim(p.entreprise))
),
cible AS (
  SELECT j, j->>'id' AS id,
    CASE WHEN EXISTS(SELECT 1 FROM pg_timezone_names z WHERE z.name = j->>'timezone')
      THEN j->>'timezone' ELSE 'UTC' END AS fuseau
  FROM candidats WHERE (SELECT count(*) FROM candidats) = 1
),
cadre AS (
  SELECT c.*, p.jour, coalesce(p.reference_observation, statement_timestamp()) AS reference,
    p.jour::timestamp AT TIME ZONE c.fuseau AS debut,
    (p.jour + 1)::timestamp AT TIME ZONE c.fuseau AS fin,
    (p.jour - 1)::timestamp AT TIME ZONE c.fuseau AS fenetre_debut,
    (p.jour + 2)::timestamp AT TIME ZONE c.fuseau AS fenetre_fin
  FROM cible c CROSS JOIN parametres p
),
employes AS (
  SELECT to_jsonb(e) AS j FROM public.employees e, cible c
  WHERE to_jsonb(e)->>'enterprise_id' = c.id
),
bruts AS (
  SELECT to_jsonb(a) AS j, a.check_time::timestamptz AS instant
  FROM public.attendances a, cadre c
  WHERE to_jsonb(a)->>'enterprise_id' = c.id
    AND a.check_time >= c.fenetre_debut AND a.check_time < c.fenetre_fin
),
du_jour AS (
  SELECT b.* FROM bruts b, cadre c WHERE b.instant >= c.debut AND b.instant < c.fin
),
derniers AS (
  SELECT DISTINCT ON (j->>'employee_id') j, instant
  FROM du_jour ORDER BY j->>'employee_id', instant DESC, j->>'id' DESC
),
chronologie AS (
  SELECT b.*, lag(instant) OVER w AS precedent,
    lag(j->>'check_type') OVER w AS type_precedent,
    lag(j->>'id') OVER w AS id_precedent
  FROM bruts b
  WINDOW w AS (PARTITION BY j->>'employee_id' ORDER BY instant, j->>'id')
),
affectations AS (
  SELECT to_jsonb(s) AS j FROM public.employee_schedules s
  WHERE to_jsonb(s)->>'employee_id' IN (SELECT j->>'id' FROM employes)
),
grilles AS (
  SELECT to_jsonb(s) AS j FROM public.work_schedules s
  WHERE to_jsonb(s)->>'enterprise_id' IN (SELECT id FROM cible)
     OR to_jsonb(s)->>'id' IN (SELECT j->>'schedule_id' FROM affectations)
),
reglages AS (
  SELECT to_jsonb(r) AS j FROM public.encheck_reglages_pointage r
  WHERE EXISTS (SELECT 1 FROM cible)
    AND ((to_jsonb(r)->>'enterprise_id') IS NULL
      OR to_jsonb(r)->>'enterprise_id' IN (SELECT id FROM cible))
),
sections AS (
 SELECT '00_controle_et_perimetre' AS section, jsonb_build_object(
   'entreprise_demandee', p.entreprise, 'jour', p.jour,
   'entreprises_trouvees', (SELECT count(*) FROM candidats),
   'controle', CASE WHEN (SELECT count(*) FROM candidats)=1 THEN 'Cible unique : diagnostic disponible'
      ELSE 'ARRET LOGIQUE : entreprise absente ou nom ambigu ; aucune donnée métier exportée' END,
   'reference_utilisee', coalesce(p.reference_observation, statement_timestamp()),
   'heure_capture_fournie', p.reference_observation IS NOT NULL,
   'fuseau_utilise', (SELECT fuseau FROM cadre),
   'fuseau_enregistre', (SELECT j->>'timezone' FROM cible),
   'avertissement_fuseau', CASE WHEN EXISTS(SELECT 1 FROM cadre WHERE coalesce(j->>'timezone','') <> fuseau)
      THEN 'Fuseau absent/invalide : UTC de secours, vérifier avant interprétation' END,
   'lignes_fenetre', (SELECT count(*) FROM bruts),
   'lignes_exportees_max', 2000,
   'calculs', 'Dernier badge brut / seuil dashboard 8h : pas le moteur de paie, ni une preuve de présence physique.'
 ) AS donnees FROM parametres p
 UNION ALL
 SELECT '01_schema_reel', coalesce(jsonb_agg(jsonb_build_object('table',table_name,'colonne',column_name,'type',data_type)
   ORDER BY table_name,ordinal_position), '[]'::jsonb)
 FROM information_schema.columns WHERE table_schema='public' AND table_name IN
   ('enterprises','employees','attendances','employee_schedules','work_schedules','encheck_reglages_pointage')
 UNION ALL
 SELECT '02_reglages_entreprise', coalesce(jsonb_agg((SELECT jsonb_object_agg(key,value) FROM jsonb_each(c.j)
   WHERE key IN ('id','name','timezone','is_active','module_planning','module_retards','auto_close_enabled','auto_close_time','auto_close_grace_minutes'))), '[]'::jsonb) FROM cible c
 UNION ALL
 SELECT '03_employes_identifiants_seulement', coalesce(jsonb_agg((SELECT jsonb_object_agg(key,value) FROM jsonb_each(e.j)
   WHERE key IN ('id','enterprise_id','matricule','is_active')) ORDER BY e.j->>'matricule'), '[]'::jsonb) FROM employes e
 UNION ALL
 SELECT '04_reglages_pointage_bruts_global_et_entreprise', coalesce(jsonb_agg((SELECT jsonb_object_agg(key,value) FROM jsonb_each(r.j)
   WHERE key IN ('enterprise_id','cle','valeur')) ORDER BY r.j->>'cle',r.j->>'enterprise_id' NULLS FIRST), '[]'::jsonb) FROM reglages r
 UNION ALL
 SELECT '05_comptages_badges_bruts_du_jour', jsonb_build_object(
   'personnes_ayant_pointe', (SELECT count(DISTINCT j->>'employee_id') FROM du_jour),
   'dernier_badge_entree', (SELECT count(*) FROM derniers WHERE lower(j->>'check_type')='in'),
   'dernier_badge_sortie', (SELECT count(*) FROM derniers WHERE lower(j->>'check_type')='out'),
   'entrees_plus_8h_selon_dashboard', (SELECT count(*) FROM derniers d, cadre c
      WHERE lower(d.j->>'check_type')='in' AND c.reference-d.instant > interval '8 hours'),
   'sorties_auto_enregistrees', (SELECT count(*) FROM du_jour WHERE j->>'check_type'='out' AND j->>'is_auto_closed'='true'),
   'important', 'Les sorties virtuelles ne sont pas en base. Aucune conclusion de retard ou de présence actuelle dans ces comptages.')
 UNION ALL
 SELECT '06_derniers_badges_et_anciennete', coalesce(jsonb_agg(jsonb_build_object(
   'employee_id',d.j->>'employee_id','id',d.j->>'id','type',d.j->>'check_type',
   'utc',d.instant,'heure_locale',d.instant AT TIME ZONE c.fuseau,
   'heures_a_la_reference',round((extract(epoch FROM(c.reference-d.instant))/3600)::numeric,3),
   'is_auto_closed',d.j->'is_auto_closed') ORDER BY d.j->>'employee_id'), '[]'::jsonb) FROM derniers d CROSS JOIN cadre c
 UNION ALL
 SELECT '07_pointages_J_moins_1_a_J_plus_1', coalesce(jsonb_agg(
   (SELECT jsonb_object_agg(key,value) FROM jsonb_each(b.j) WHERE key IN
     ('id','employee_id','enterprise_id','check_time','check_type','method','is_auto_closed',
      'estimation_source_id','estimation_validee_le','estimation_remplacee_le','estimation_niveau',
      'modifie_le','origine','suspect','created_at'))
   || jsonb_build_object('heure_locale',b.instant AT TIME ZONE c.fuseau)
   ORDER BY b.j->>'employee_id',b.instant,b.j->>'id'), '[]'::jsonb)
 FROM (SELECT * FROM bruts ORDER BY instant,j->>'id' LIMIT 2000) b CROSS JOIN cadre c
 UNION ALL
 SELECT '08_gestes_rapproches_moins_60s_a_examiner', coalesce(jsonb_agg(jsonb_build_object(
   'employee_id',b.j->>'employee_id','id',b.j->>'id','id_precedent',b.id_precedent,
   'type',b.j->>'check_type','type_precedent',b.type_precedent,
   'ecart_secondes',extract(epoch FROM(b.instant-b.precedent)),
   'is_auto_closed',b.j->'is_auto_closed','modifie_le',b.j->'modifie_le') ORDER BY b.instant), '[]'::jsonb)
 FROM chronologie b WHERE b.instant-b.precedent < interval '60 seconds'
 -- Cette section repère les gestes proches, elle ne décide PAS lequel est valide.
 UNION ALL
 SELECT '09_affectations_plannings_y_compris_inactives', coalesce(jsonb_agg((SELECT jsonb_object_agg(key,value) FROM jsonb_each(a.j)
   WHERE key IN ('id','employee_id','enterprise_id','schedule_id','is_active','use_custom_hours',
     'custom_start_time','custom_end_time','custom_work_days','work_days','start_date','end_date',
     'valide_du','valide_au','created_at','updated_at')) ORDER BY a.j->>'employee_id',a.j->>'id'), '[]'::jsonb) FROM affectations a
 UNION ALL
 SELECT '10_grilles_entreprise_et_grilles_liees', coalesce(jsonb_agg((SELECT jsonb_object_agg(key,value) FROM jsonb_each(g.j)
   WHERE key IN ('id','enterprise_id','is_active','is_default','start_time','end_time','work_days',
     'late_tolerance_minutes','created_at','updated_at')) ORDER BY g.j->>'id'), '[]'::jsonb) FROM grilles g
)
SELECT section, donnees FROM sections ORDER BY section;
