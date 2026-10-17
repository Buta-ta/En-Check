-- Analyse en lecture seule, à la demande de l'admin. Aucun changement de paie.
-- Première étape du moteur contextuel : cohortes et départ avec entrée oubliée.
-- Ne remplace PAS encore la cascade planning/historique ; les résultats ne sont
-- pas validables automatiquement avant confrontation à ces sources.
BEGIN;
SET LOCAL lock_timeout = '5s';
DO $$
DECLARE v_missing text;
BEGIN
  SELECT string_agg(x.nom, ', ') INTO v_missing
    FROM (VALUES ('encheck_seuil'), ('encheck_est_admin_de')) x(nom)
    WHERE NOT EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
      WHERE n.nspname='public' AND p.proname=x.nom);
  IF v_missing IS NOT NULL THEN RAISE EXCEPTION 'Préflight : fonctions absentes : %', v_missing; END IF;
  IF to_regclass('public.attendances') IS NULL OR to_regclass('public.encheck_reglages_pointage') IS NULL THEN
    RAISE EXCEPTION 'Préflight : tables du socle absentes.';
  END IF;
  SELECT string_agg(x.nom, ', ') INTO v_missing FROM
    (VALUES ('id'), ('employee_id'), ('enterprise_id'), ('check_time'), ('check_type'),
      ('is_auto_closed'), ('method'), ('modifie_le'), ('anomalie')) x(nom)
    WHERE NOT EXISTS (SELECT 1 FROM pg_attribute WHERE attrelid='public.attendances'::regclass
      AND attname=x.nom AND attnum>0 AND NOT attisdropped);
  IF v_missing IS NOT NULL THEN RAISE EXCEPTION 'Préflight : colonnes absentes : %', v_missing; END IF;
END $$;

INSERT INTO public.encheck_reglages_pointage(cle,valeur,commentaire) VALUES
 ('cohorte_arrivee_minutes', '5', 'Fenêtre autour de l’entrée, analyse en mode ombre'),
 ('cohorte_sortie_dispersion_minutes', '2', 'Dispersion maximale des sorties du groupe'),
 ('cohorte_depart_secondes', '90', 'Proximité des départs pour un double badge suspect'),
 ('cohorte_min_collegues', '2', 'Nombre minimal de collègues distincts')
ON CONFLICT DO NOTHING;

CREATE OR REPLACE FUNCTION public.encheck_analyser_pointage(p_source uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_source public.attendances%ROWTYPE;
  v_arrivee numeric; v_dispersion numeric; v_depart numeric; v_min integer;
  v_rebond numeric; v_duree_min numeric; v_max numeric;
  v_count integer; v_ecart numeric; v_median double precision;
  v_preuves jsonb; v_out timestamptz;
BEGIN
  SELECT * INTO v_source FROM public.attendances WHERE id=p_source;
  IF NOT FOUND THEN RAISE EXCEPTION 'Pointage inaccessible' USING ERRCODE='42501'; END IF;
  IF NOT public.encheck_est_admin_de(v_source.enterprise_id) THEN
    RAISE EXCEPTION 'Pointage inaccessible' USING ERRCODE='42501';
  END IF;
  IF v_source.check_type <> 'in' OR v_source.is_auto_closed IS TRUE
     OR v_source.method = 'auto_close' OR v_source.modifie_le IS NOT NULL
     OR v_source.anomalie IS NOT NULL OR v_source.check_time > now() THEN
    RETURN jsonb_build_object('kind','insuffisant','reason','Une entrée réelle non corrigée est nécessaire.');
  END IF;
  v_arrivee := public.encheck_seuil(v_source.enterprise_id,'cohorte_arrivee_minutes',5);
  v_dispersion := public.encheck_seuil(v_source.enterprise_id,'cohorte_sortie_dispersion_minutes',2);
  v_depart := public.encheck_seuil(v_source.enterprise_id,'cohorte_depart_secondes',90);
  v_min := public.encheck_seuil(v_source.enterprise_id,'cohorte_min_collegues',2)::integer;
  v_rebond := public.encheck_seuil(v_source.enterprise_id,'seuil_rebond_secondes',60);
  v_duree_min := public.encheck_seuil(v_source.enterprise_id,'duree_minimale_session_minutes',30);
  v_max := public.encheck_seuil(v_source.enterprise_id,'plafond_invention_heures',12);
  IF v_arrivee <= 0 OR v_dispersion <= 0 OR v_depart <= 0 OR v_min < 2
     OR v_rebond <= 0 OR v_duree_min <= 0 OR v_max <= 0 THEN
    RETURN jsonb_build_object('kind','insuffisant','reason','Réglages incohérents : analyse suspendue.');
  END IF;

  -- Priorité au cas Reine : un OUT réel suit immédiatement l’IN.
  SELECT check_time INTO v_out FROM public.attendances a
    WHERE a.employee_id=v_source.employee_id AND a.enterprise_id=v_source.enterprise_id
      AND a.check_type='out' AND a.check_time>=v_source.check_time AND a.check_time<=now()
      AND a.check_time<v_source.check_time+make_interval(secs=>v_rebond::double precision)
      AND a.is_auto_closed IS NOT TRUE AND a.method IS DISTINCT FROM 'auto_close'
      AND a.modifie_le IS NULL AND a.anomalie IS NULL
    ORDER BY a.check_time, a.id LIMIT 1;
  IF v_out IS NOT NULL THEN
    SELECT count(DISTINCT a.employee_id), jsonb_agg(jsonb_build_object('id',a.id,'sortie',a.check_time))
      INTO v_count,v_preuves FROM public.attendances a
      WHERE a.enterprise_id=v_source.enterprise_id AND a.employee_id<>v_source.employee_id
        AND a.check_type='out' AND a.is_auto_closed IS NOT TRUE
        AND a.method IS DISTINCT FROM 'auto_close' AND a.modifie_le IS NULL AND a.anomalie IS NULL
        AND a.check_time<=now()
        AND abs(extract(epoch FROM a.check_time-v_out))<=v_depart;
    IF v_count>=v_min THEN
      RETURN jsonb_build_object('kind','depart_probable','proposed_out',v_out,'proposed_in',NULL,
        'reason','Départ possible avec entrée oubliée : badges rapprochés au moment du départ de collègues. Une arrivée de nuit reste possible.',
        'colleagues',v_count,'evidence',v_preuves,'payable',false);
    END IF;
    RETURN jsonb_build_object('kind','ambigu','reason','Badges rapprochés : impossible de déterminer leur sens sans confirmation.','payable',false);
  END IF;

  -- Un vrai OUT suivant la source interdit d’inventer une autre sortie.
  IF EXISTS (SELECT 1 FROM public.attendances a
    WHERE a.enterprise_id=v_source.enterprise_id AND a.employee_id=v_source.employee_id
      AND a.check_time>v_source.check_time
      AND a.check_time<=v_source.check_time+make_interval(hours=>ceil(v_max)::integer)
      AND a.check_type='out' AND a.is_auto_closed IS NOT TRUE
      AND a.method IS DISTINCT FROM 'auto_close') THEN
    RETURN jsonb_build_object('kind','insuffisant','reason','Une sortie existe déjà : vérifier la session avant toute estimation.');
  END IF;

  -- Sessions simples uniquement : IN suivi directement d’un OUT réel.
  -- LEAD voit aussi les lignes synthétiques/corrigées : on ne saute jamais
  -- une anomalie intermédiaire pour fabriquer une paire artificielle.
  WITH events AS (
    SELECT a.*, lead(a.check_type) OVER w AS next_type,
      lead(a.check_time) OVER w AS next_time, lead(a.id) OVER w AS next_id,
      lead(a.is_auto_closed) OVER w AS next_auto, lead(a.method) OVER w AS next_method,
      lead(a.modifie_le) OVER w AS next_modified, lead(a.anomalie) OVER w AS next_anomaly
    FROM public.attendances a
    WHERE a.enterprise_id=v_source.enterprise_id AND a.employee_id<>v_source.employee_id
      AND a.check_time BETWEEN v_source.check_time-make_interval(mins=>ceil(v_arrivee)::integer)
        AND v_source.check_time+make_interval(hours=>ceil(v_max)::integer)+make_interval(mins=>ceil(v_arrivee)::integer)
    WINDOW w AS (PARTITION BY a.employee_id ORDER BY a.check_time,a.id)
  ), pairs AS (
    SELECT * FROM events WHERE check_type='in' AND next_type='out'
      AND is_auto_closed IS NOT TRUE AND next_auto IS NOT TRUE
      AND method IS DISTINCT FROM 'auto_close' AND next_method IS DISTINCT FROM 'auto_close'
      AND modifie_le IS NULL AND next_modified IS NULL AND anomalie IS NULL AND next_anomaly IS NULL
      AND abs(extract(epoch FROM check_time-v_source.check_time))<=v_arrivee*60
      AND extract(epoch FROM next_time-check_time) BETWEEN v_duree_min*60 AND v_max*3600
      AND extract(epoch FROM next_time-v_source.check_time) BETWEEN v_duree_min*60 AND v_max*3600
      AND next_time<=now()
  ), unique_peers AS (
    SELECT * FROM pairs WHERE employee_id IN (SELECT employee_id FROM pairs GROUP BY employee_id HAVING count(*)=1)
  )
  SELECT count(*), extract(epoch FROM max(next_time)-min(next_time)),
    percentile_cont(0.5) WITHIN GROUP(ORDER BY extract(epoch FROM next_time)::double precision),
    jsonb_agg(jsonb_build_object('entree_id',id,'sortie_id',next_id,'entree',check_time,'sortie',next_time))
    INTO v_count,v_ecart,v_median,v_preuves FROM unique_peers;
  IF v_count<v_min THEN
    RETURN jsonb_build_object('kind','insuffisant','reason','Pas assez de collègues avec une session réelle comparable. Aucune heure inventée.','payable',false);
  END IF;
  IF v_ecart>v_dispersion*60 THEN
    RETURN jsonb_build_object('kind','divergence','reason','Les sorties des collègues divergent : aucune proposition collective fiable.',
      'colleagues',v_count,'evidence',v_preuves,'payable',false);
  END IF;
  RETURN jsonb_build_object('kind','sortie_cohorte','proposed_out',to_timestamp(v_median),
    'reason','Sorties concordantes de collègues arrivés au même créneau. Planning, site/équipe et historique restent à vérifier.',
    'colleagues',v_count,'evidence',v_preuves,'payable',false);
END $$;
REVOKE ALL ON FUNCTION public.encheck_analyser_pointage(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.encheck_analyser_pointage(uuid) TO authenticated;
COMMIT;
