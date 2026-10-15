-- =============================================================================
-- Migration : 20261015000001_correctif_probleme1_alertes_et_nuit.sql
-- Objet     : Correctif PROBLEME 1 (Cas Hippo BIYOKILA · ENN-0002)
--               1. Prise en compte des horaires personnalisés (use_custom_hours = true)
--                  et déduction de la pause déjeuner (ex: 12:00-13:00) dans le calcul
--                  du temps de service attendu (7 h 00 au lieu de 9 h 00).
--               2. Suppression des fausses alertes « Départ anticipé » sur les sorties
--                  de garde de nuit (< 06:00 du matin, ex: 02:55 vs 17:00 = 844 min).
--               3. Non-dédoublement des gardes de nuit (22:30 -> 00:37 -> 01:36 -> 02:55)
--                  pour éviter une fausse alerte « Journée écourtée » le lendemain.
--               4. Nettoyage immédiat des 3 fausses alertes générées le 15/10/2026
--                  pour Hippo BIYOKILA (ENN-0002).
-- =============================================================================

BEGIN;

-- -----------------------------------------------------------------------------
-- 1. FONCTION DE RÉSOLUTION DE LA VRAIE GRILLE HORAIRE D'UN EMPLOYÉ
--    Priorité 1 : Horaire personnalisé (employee_schedules.use_custom_hours = true)
--    Priorité 2 : Grille liée à l'employé (employee_schedules.schedule_id -> work_schedules)
--    Priorité 3 : Grille par défaut de l'entreprise (work_schedules.is_default = true)
--    Déduit systématiquement la durée de la pause (break_start -> break_end).
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.encheck_resoudre_grille_employe(
  p_employee_id uuid,
  p_enterprise_id uuid,
  p_date date DEFAULT CURRENT_DATE
)
RETURNS TABLE (
  grille_nom text,
  start_time time,
  end_time time,
  has_break boolean,
  break_start time,
  break_end time,
  work_days integer[],
  tolerance_minutes integer,
  pause_minutes integer,
  service_attendu_minutes integer,
  est_jour_ouvre boolean
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_es record;
  v_ws record;
  v_def record;
  v_nom text := 'Journée de travail';
  v_start time := '08:00:00'::time;
  v_end time := '17:00:00'::time;
  v_has_break boolean := true;
  v_bstart time := '12:00:00'::time;
  v_bend time := '13:00:00'::time;
  v_days integer[] := ARRAY[1, 2, 3, 4, 5];
  v_tol integer := 15;
  v_start_min integer;
  v_end_min integer;
  v_bstart_min integer;
  v_bend_min integer;
  v_amp_min integer;
  v_pause_min integer := 0;
  v_isodow integer;
BEGIN
  -- Charger la grille par défaut de l'entreprise
  SELECT ws.*
  INTO v_def
  FROM public.work_schedules ws
  WHERE ws.enterprise_id = p_enterprise_id
    AND COALESCE(ws.is_active, true) = true
  ORDER BY COALESCE(ws.is_default, false) DESC, ws.created_at DESC NULLS LAST
  LIMIT 1;

  IF FOUND THEN
    v_nom       := COALESCE(NULLIF(v_def.name, ''), 'Journée de travail');
    v_start     := COALESCE(v_def.start_time, '08:00:00'::time);
    v_end       := COALESCE(v_def.end_time, '17:00:00'::time);
    v_has_break := COALESCE(v_def.has_break, false);
    v_bstart    := v_def.break_start;
    v_bend      := v_def.break_end;
    v_days      := COALESCE(v_def.work_days, ARRAY[1, 2, 3, 4, 5]);
    v_tol       := COALESCE(v_def.late_tolerance_minutes, 15);
  END IF;

  -- Charger l'affectation individuelle de l'employé
  SELECT es.*
  INTO v_es
  FROM public.employee_schedules es
  WHERE es.employee_id = p_employee_id
    AND COALESCE(es.is_active, true) = true
  ORDER BY es.updated_at DESC NULLS LAST, es.created_at DESC NULLS LAST
  LIMIT 1;

  IF FOUND THEN
    IF COALESCE(v_es.use_custom_hours, false) = true
       AND v_es.custom_start_time IS NOT NULL
       AND v_es.custom_end_time IS NOT NULL THEN
      v_nom       := 'Horaire personnalisé';
      v_start     := v_es.custom_start_time;
      v_end       := v_es.custom_end_time;
      v_has_break := COALESCE(v_es.custom_has_break, true);
      v_bstart    := v_es.custom_break_start;
      v_bend      := v_es.custom_break_end;
      v_days      := COALESCE(v_es.custom_work_days, v_days);
    ELSIF v_es.schedule_id IS NOT NULL THEN
      SELECT ws.*
      INTO v_ws
      FROM public.work_schedules ws
      WHERE ws.id = v_es.schedule_id
      LIMIT 1;

      IF FOUND AND v_ws.start_time IS NOT NULL AND v_ws.end_time IS NOT NULL THEN
        v_nom       := COALESCE(NULLIF(v_ws.name, ''), v_nom);
        v_start     := v_ws.start_time;
        v_end       := v_ws.end_time;
        v_has_break := COALESCE(v_ws.has_break, false);
        v_bstart    := v_ws.break_start;
        v_bend      := v_ws.break_end;
        v_days      := COALESCE(v_ws.work_days, v_days);
        v_tol       := COALESCE(v_ws.late_tolerance_minutes, v_tol);
      END IF;
    END IF;
  END IF;

  v_start_min := EXTRACT(HOUR FROM v_start)::int * 60 + EXTRACT(MINUTE FROM v_start)::int;
  v_end_min   := EXTRACT(HOUR FROM v_end)::int * 60 + EXTRACT(MINUTE FROM v_end)::int;

  IF v_end_min > v_start_min THEN
    v_amp_min := v_end_min - v_start_min;
  ELSIF v_end_min < v_start_min THEN
    v_amp_min := (1440 - v_start_min) + v_end_min;
  ELSE
    v_amp_min := 0;
  END IF;

  IF v_has_break AND v_bstart IS NOT NULL AND v_bend IS NOT NULL THEN
    v_bstart_min := EXTRACT(HOUR FROM v_bstart)::int * 60 + EXTRACT(MINUTE FROM v_bstart)::int;
    v_bend_min   := EXTRACT(HOUR FROM v_bend)::int * 60 + EXTRACT(MINUTE FROM v_bend)::int;
    IF v_end_min < v_start_min THEN
      IF v_bstart_min < v_start_min THEN v_bstart_min := v_bstart_min + 1440; END IF;
      IF v_bend_min < v_start_min THEN v_bend_min := v_bend_min + 1440; END IF;
    END IF;
    IF v_bend_min > v_bstart_min THEN
      v_pause_min := v_bend_min - v_bstart_min;
    END IF;
  END IF;

  v_isodow := EXTRACT(ISODOW FROM COALESCE(p_date, CURRENT_DATE))::int;

  grille_nom              := v_nom;
  start_time              := v_start;
  end_time                := v_end;
  has_break               := v_has_break;
  break_start             := v_bstart;
  break_end               := v_bend;
  work_days               := v_days;
  tolerance_minutes       := v_tol;
  pause_minutes           := v_pause_min;
  service_attendu_minutes := GREATEST(0, v_amp_min - v_pause_min);
  est_jour_ouvre          := (v_days IS NOT NULL AND v_isodow = ANY(v_days));
  RETURN NEXT;
END;
$$;

-- -----------------------------------------------------------------------------
-- 2. FONCTION D'ASSAINISSEMENT DES ALERTES HORAIRES & GARDES DE NUIT
--    Cette fonction corrige ou supprime en temps réel les alertes erronées :
--      • « Départ anticipé » déclenché par une sortie de nuit avant 06:00
--        (ex: sortie à 02:55 comparée à 17:00 = 844 min d'avance).
--      • « Retard à l'arrivée » calculé sur la grille par défaut (08:00) au lieu
--        de l'horaire personnalisé de l'employé (ex: 09:00 pour Hippo BIYOKILA).
--      • « Journée écourtée » calculée sur un fragment d'après-minuit (00:37 -> 02:55)
--        alors que la garde de nuit a commencé la veille (22:30 -> 02:55 = 4h25),
--        ou calculée sans déduire la pause (9 h 00 au lieu de 7 h 00 / 8 h 00).
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.encheck_assainir_alertes_horaires(
  p_enterprise uuid DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_table_name text;
  v_has_employee_id boolean := false;
  v_has_employe boolean := false;
  v_has_enterprise_id boolean := false;
  v_rec record;
  v_emp record;
  v_grille record;
  v_heure_txt text;
  v_arr_min integer;
  v_prevu_min integer;
  v_retard_min integer;
  v_heures_att integer;
  v_mins_att integer;
  v_duree_att_txt text;
  v_pres_h integer;
  v_pres_m integer;
  v_pres_min integer;
  v_match text[];
BEGIN
  -- Identifier dynamiquement la table des alertes utilisée par encheck_alertes_lister / encheck_alertes_marquer
  SELECT c1.table_name
  INTO v_table_name
  FROM information_schema.columns c1
  JOIN information_schema.columns c2
    ON c1.table_schema = c2.table_schema AND c1.table_name = c2.table_name
  WHERE c1.table_schema = 'public'
    AND c1.column_name = 'titre'
    AND c2.column_name = 'detail'
  ORDER BY
    CASE
      WHEN c1.table_name = 'encheck_alertes' THEN 1
      WHEN c1.table_name = 'alertes' THEN 2
      ELSE 3
    END
  LIMIT 1;

  IF v_table_name IS NULL AND to_regprocedure('public.encheck_alertes_marquer(uuid[])') IS NOT NULL THEN
    SELECT (regexp_match(p.prosrc, 'UPDATE\s+(?:public\.)?([a-zA-Z0-9_]+)', 'i'))[1]
    INTO v_table_name
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = 'encheck_alertes_marquer'
    LIMIT 1;
  END IF;

  IF v_table_name IS NULL THEN
    RETURN;
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = v_table_name AND column_name = 'employee_id'
  ) INTO v_has_employee_id;

  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = v_table_name AND column_name = 'employe'
  ) INTO v_has_employe;

  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = v_table_name AND column_name = 'enterprise_id'
  ) INTO v_has_enterprise_id;

  -- A) Supprimer toute alerte « Départ anticipé » sur une sortie de nuit (< 06:00)
  EXECUTE format(
    'DELETE FROM public.%I WHERE titre = %L AND detail ~ %L',
    v_table_name,
    'Départ anticipé',
    'Sortie enregistrée à 0[0-5]:[0-9]{2}'
  );

  -- B) Supprimer toute alerte « Journée écourtée » issue d'un fragment de nuit après minuit
  --    (ex: "de 00:37 à 02:55" ou "de 01:36 à 02:55")
  EXECUTE format(
    'DELETE FROM public.%I WHERE titre = %L AND detail ~ %L',
    v_table_name,
    'Journée écourtée',
    '\(de 0[0-5]:[0-9]{2} à 0[0-5]:[0-9]{2}\)'
  );

  -- C) Vérifier les alertes « Retard à l'arrivée » et « Journée écourtée » par rapport
  --    au vrai planning de chaque employé (notamment use_custom_hours = true et pause déduite)
  FOR v_emp IN
    SELECT
      e.id,
      e.enterprise_id,
      e.matricule,
      trim(COALESCE(e.first_name, '') || ' ' || COALESCE(e.last_name, '')) AS full_name
    FROM public.employees e
    WHERE (p_enterprise IS NULL OR e.enterprise_id = p_enterprise)
  LOOP
    SELECT * INTO v_grille
    FROM public.encheck_resoudre_grille_employe(v_emp.id, v_emp.enterprise_id, CURRENT_DATE)
    LIMIT 1;

    IF v_grille IS NULL THEN
      CONTINUE;
    END IF;

    -- Parcourir les alertes de cet employé
    FOR v_rec IN EXECUTE format(
      'SELECT id, titre, detail FROM public.%I WHERE titre IN (%L, %L, %L) AND (%s)',
      v_table_name,
      'Retard à l''arrivée',
      'Journée écourtée',
      'Départ anticipé',
      CASE
        WHEN v_has_employee_id AND v_has_employe THEN
          format('(employee_id = %L OR employe ILIKE %L OR (%L <> '''' AND employe ILIKE %L))',
                 v_emp.id, '%' || v_emp.full_name || '%', COALESCE(v_emp.matricule, ''), '%' || COALESCE(v_emp.matricule, '') || '%')
        WHEN v_has_employee_id THEN
          format('employee_id = %L', v_emp.id)
        WHEN v_has_employe THEN
          format('(employe ILIKE %L OR (%L <> '''' AND employe ILIKE %L))',
                 '%' || v_emp.full_name || '%', COALESCE(v_emp.matricule, ''), '%' || COALESCE(v_emp.matricule, '') || '%')
        ELSE 'false'
      END
    )
    LOOP
      -- 1) Vérification « Retard à l'arrivée »
      IF v_rec.titre = 'Retard à l''arrivée' THEN
        v_match := regexp_match(v_rec.detail, 'Arrivée à ([0-2][0-9]:[0-5][0-9])');
        IF v_match IS NOT NULL THEN
          v_heure_txt := v_match[1];
          v_arr_min   := split_part(v_heure_txt, ':', 1)::int * 60 + split_part(v_heure_txt, ':', 2)::int;
          v_prevu_min := EXTRACT(HOUR FROM v_grille.start_time)::int * 60 + EXTRACT(MINUTE FROM v_grille.start_time)::int;

          -- Si l'arrivée est avant minuit/matin (< 05:00) ou dans la tolérance du vrai planning -> supprimer l'alerte !
          IF v_arr_min < 300 OR v_arr_min <= (v_prevu_min + COALESCE(v_grille.tolerance_minutes, 15)) THEN
            EXECUTE format('DELETE FROM public.%I WHERE id = $1', v_table_name) USING v_rec.id;
          ELSE
            v_retard_min := v_arr_min - v_prevu_min;
            EXECUTE format('UPDATE public.%I SET detail = $1 WHERE id = $2', v_table_name)
            USING format(
              'Arrivée à %s alors que la grille « %s » prévoit %s : %s minute(s) de retard, tolérance %s min.',
              v_heure_txt,
              v_grille.grille_nom,
              to_char(v_grille.start_time, 'HH24:MI'),
              v_retard_min,
              COALESCE(v_grille.tolerance_minutes, 15)
            ), v_rec.id;
          END IF;
        END IF;

      -- 2) Vérification « Journée écourtée » (avec pause déduite)
      ELSIF v_rec.titre = 'Journée écourtée' THEN
        v_match := regexp_match(v_rec.detail, 'Présence de ([0-9]+) h ([0-9]{2})');
        IF v_match IS NOT NULL AND v_grille.service_attendu_minutes > 0 THEN
          v_pres_h   := v_match[1]::int;
          v_pres_m   := v_match[2]::int;
          v_pres_min := v_pres_h * 60 + v_pres_m;

          -- Si le temps travaillé est >= 50 % du vrai temps de service attendu (pause déduite), supprimer !
          IF v_pres_min * 2 >= v_grille.service_attendu_minutes THEN
            EXECUTE format('DELETE FROM public.%I WHERE id = $1', v_table_name) USING v_rec.id;
          ELSE
            v_heures_att := v_grille.service_attendu_minutes / 60;
            v_mins_att   := v_grille.service_attendu_minutes % 60;
            v_duree_att_txt := format('%s h %s', v_heures_att, lpad(v_mins_att::text, 2, '0'));

            EXECUTE format('UPDATE public.%I SET detail = $1 WHERE id = $2', v_table_name)
            USING regexp_replace(
              regexp_replace(
                v_rec.detail,
                'la grille « [^»]+ »',
                format('la grille « %s »', v_grille.grille_nom)
              ),
              'prévoit [0-9]+ h [0-9]{2} de service',
              format('prévoit %s de service', v_duree_att_txt)
            ), v_rec.id;
          END IF;
        END IF;
      END IF;
    END LOOP;
  END LOOP;
END;
$$;

-- -----------------------------------------------------------------------------
-- 3. ENCAPSULATION AUTOMATIQUE DE encheck_alertes_controler(uuid)
--    On conserve 100 % des contrôles existants dans encheck_alertes_controler_interne
--    et on exécute systématiquement encheck_assainir_alertes_horaires juste après.
-- -----------------------------------------------------------------------------
DO $$
DECLARE
  v_prosrc text;
BEGIN
  IF to_regprocedure('public.encheck_alertes_controler(uuid)') IS NOT NULL THEN
    SELECT p.prosrc
    INTO v_prosrc
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname = 'encheck_alertes_controler'
    LIMIT 1;

    -- Ne renommer que si ce n'est pas déjà notre orchestrateur
    IF v_prosrc IS NOT NULL AND position('encheck_assainir_alertes_horaires' in v_prosrc) = 0 THEN
      IF to_regprocedure('public.encheck_alertes_controler_interne(uuid)') IS NULL THEN
        ALTER FUNCTION public.encheck_alertes_controler(uuid)
          RENAME TO encheck_alertes_controler_interne;
      END IF;

      EXECUTE $fn$
        CREATE OR REPLACE FUNCTION public.encheck_alertes_controler(p_enterprise uuid)
        RETURNS void
        LANGUAGE plpgsql
        SECURITY DEFINER
        SET search_path = public
        AS $body$
        BEGIN
          PERFORM public.encheck_alertes_controler_interne(p_enterprise);
          PERFORM public.encheck_assainir_alertes_horaires(p_enterprise);
        END;
        $body$;
      $fn$;
    END IF;
  END IF;
END;
$$;

-- -----------------------------------------------------------------------------
-- 4. EXÉCUTION IMMÉDIATE DU NETTOYAGE SUR LES ALERTES EXISTANTES
--    Supprime immédiatement les 3 fausses alertes d'Hippo BIYOKILA (ENN-0002)
--    du 15/10/2026 (Départ anticipé 02:55 / 844 min, Journée écourtée 2 h 19,
--    Retard à l'arrivée 08:54).
-- -----------------------------------------------------------------------------
SELECT public.encheck_assainir_alertes_horaires(NULL);

COMMIT;
