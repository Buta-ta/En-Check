-- =============================================================================
-- Migration : 20261015000002_correctif_probleme2_rebonds_qr_et_oublis_sortie.sql
-- Objet     : Correctif PROBLEME 2 (Junior MANSTIAMINA · PHA-0002) & Oublis de dépointage
--               1. Neutralisation et nettoyage des rebonds QR Code (< 60 secondes)
--                  du type Entrée -> Sortie -> Entrée (ex: 06:32:20 -> 06:32:32 -> 06:32:XX).
--               2. Clôture automatique intelligente des oublis de dépointage (> 14h sans sortie)
--                  selon la cascade à 3 niveaux :
--                    • Niveau 1 : Fin du planning (horaire personnalisé ou grille entreprise,
--                                 avec gestion J+1 pour les gardes de nuit).
--                    • Niveau 2 : Heure Auto-Close de l'entreprise (si activée).
--                    • Niveau 3 : Secours universel sans planning ni horaires -> Entrée + 8h00
--                                 (traverse minuit proprement pour les travailleurs de nuit).
--               3. Intégration automatique dans encheck_alertes_controler + exécution immédiate.
-- =============================================================================

BEGIN;

-- -----------------------------------------------------------------------------
-- 1. NETTOYAGE AUTOMATIQUE DES REBONDS QR CODE (< 60 SECONDES)
--    Cas Junior MANSTIAMINA (PHA-0002) le 15/10/2026 à 06:32 :
--    Quand un employé scanne Entrée (t1), puis que la caméra relit le QR Code
--    moins de 60s après en enregistrant Sortie (t2), et que l'employé rescanne
--    Entrée (t3) dans les 2 minutes pour corriger, on supprime le couple parasite
--    (t2, t3) pour ne conserver que la vraie Entrée initiale (t1).
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.encheck_nettoyer_rebonds_qr(
  p_enterprise uuid DEFAULT NULL
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_rec record;
  v_deleted integer := 0;
  v_count integer;
BEGIN
  FOR v_rec IN
    WITH ordonnes AS (
      SELECT
        a.id,
        a.employee_id,
        a.enterprise_id,
        a.check_type,
        a.check_time,
        a.modifie_le,
        LEAD(a.id, 1) OVER (PARTITION BY a.employee_id ORDER BY a.check_time ASC) AS out_id,
        LEAD(a.check_type, 1) OVER (PARTITION BY a.employee_id ORDER BY a.check_time ASC) AS out_type,
        LEAD(a.check_time, 1) OVER (PARTITION BY a.employee_id ORDER BY a.check_time ASC) AS out_time,
        LEAD(a.modifie_le, 1) OVER (PARTITION BY a.employee_id ORDER BY a.check_time ASC) AS out_modifie,
        LEAD(a.id, 2) OVER (PARTITION BY a.employee_id ORDER BY a.check_time ASC) AS in2_id,
        LEAD(a.check_type, 2) OVER (PARTITION BY a.employee_id ORDER BY a.check_time ASC) AS in2_type,
        LEAD(a.check_time, 2) OVER (PARTITION BY a.employee_id ORDER BY a.check_time ASC) AS in2_time,
        LEAD(a.modifie_le, 2) OVER (PARTITION BY a.employee_id ORDER BY a.check_time ASC) AS in2_modifie
      FROM public.attendances a
      WHERE (p_enterprise IS NULL OR a.enterprise_id = p_enterprise)
        AND a.check_time >= (now() - interval '7 days')
    )
    SELECT
      id AS in1_id,
      out_id,
      in2_id
    FROM ordonnes
    WHERE check_type = 'in'
      AND out_type = 'out'
      AND in2_type = 'in'
      AND out_modifie IS NULL
      AND in2_modifie IS NULL
      AND EXTRACT(EPOCH FROM (out_time - check_time)) >= 0
      AND EXTRACT(EPOCH FROM (out_time - check_time)) < 60
      AND EXTRACT(EPOCH FROM (in2_time - out_time)) >= 0
      AND EXTRACT(EPOCH FROM (in2_time - out_time)) <= 120
  LOOP
    -- Rattacher d'éventuelles photos des pointages rebonds sur l'entrée initiale (in1_id)
    IF to_regclass('public.pointages_photos') IS NOT NULL THEN
      UPDATE public.pointages_photos
      SET attendance_id = v_rec.in1_id
      WHERE attendance_id IN (v_rec.out_id, v_rec.in2_id);
    END IF;

    DELETE FROM public.attendances
    WHERE id IN (v_rec.out_id, v_rec.in2_id);

    GET DIAGNOSTICS v_count = ROW_COUNT;
    v_deleted := v_deleted + v_count;
  END LOOP;

  RETURN v_deleted;
END;
$$;

-- -----------------------------------------------------------------------------
-- 2. CLÔTURE AUTOMATIQUE INTELLIGENTE DES OUBLIS DE DÉPOINTAGE (CASCADE 3 NIVEAUX)
--    Ne touche JAMAIS une session en cours (< 14h écoulées) pour ne pas couper
--    les travailleurs de nuit ni les employés qui font des heures supplémentaires.
--    Au-delà de 14h sans sortie (oubli avéré) :
--      • Niveau 1 : Fin du planning (horaire personnalisé ou grille liée/par défaut),
--                   avec gestion de J+1 si planning de nuit, ou repli sur +8h si
--                   l'employé est entré après l'heure de fin du planning de jour.
--      • Niveau 2 : Heure Auto-Close de l'entreprise (si auto_close_enabled = true).
--      • Niveau 3 : Sans planning ni horaires renseignés -> Entrée + 8h00 (jour ou nuit).
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.encheck_cloturer_sorties_oubliees(
  p_enterprise uuid DEFAULT NULL
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_in record;
  v_ent record;
  v_es record;
  v_ws record;
  v_def record;
  v_tz text := 'Africa/Porto-Novo';
  v_in_local timestamp without time zone;
  v_in_date date;
  v_start_time time;
  v_end_time time;
  v_has_schedule boolean := false;
  v_target_local timestamp without time zone;
  v_target_utc timestamptz;
  v_next_in_time timestamptz;
  v_inserted integer := 0;
BEGIN
  FOR v_in IN
    WITH avec_suivant AS (
      SELECT
        a.id,
        a.employee_id,
        a.enterprise_id,
        a.check_type,
        a.check_time,
        a.method,
        LEAD(a.check_type) OVER (PARTITION BY a.employee_id ORDER BY a.check_time ASC) AS next_type,
        LEAD(a.check_time) OVER (PARTITION BY a.employee_id ORDER BY a.check_time ASC) AS next_time
      FROM public.attendances a
      WHERE (p_enterprise IS NULL OR a.enterprise_id = p_enterprise)
        AND a.check_time >= (now() - interval '60 days')
    )
    SELECT *
    FROM avec_suivant
    WHERE check_type = 'in'
      -- Session ouverte depuis plus de 14 heures (ne coupe jamais une garde ou heure sup en cours)
      AND check_time <= (now() - interval '14 hours')
      -- Aucune sortie valide dans les 16 heures suivant cette entrée
      AND (
        next_type IS NULL
        OR next_type = 'in'
        OR EXTRACT(EPOCH FROM (next_time - check_time)) > (16 * 3600)
      )
      -- Ignorer un double IN consécutif situé à moins de 14h du prochain pointage de la même garde
      AND NOT (
        next_type = 'in'
        AND EXTRACT(EPOCH FROM (next_time - check_time)) <= (14 * 3600)
      )
  LOOP
    v_has_schedule := false;
    v_start_time   := NULL;
    v_end_time     := NULL;
    v_target_utc   := NULL;

    -- Charger la configuration de l'entreprise
    SELECT e.*
    INTO v_ent
    FROM public.enterprises e
    WHERE e.id = v_in.enterprise_id
    LIMIT 1;

    v_in_local := v_in.check_time AT TIME ZONE v_tz;
    v_in_date  := v_in_local::date;

    -- Niveau 1a : Horaire personnalisé ou grille liée de l'employé
    SELECT es.*
    INTO v_es
    FROM public.employee_schedules es
    WHERE es.employee_id = v_in.employee_id
      AND COALESCE(es.is_active, true) = true
    ORDER BY es.updated_at DESC NULLS LAST, es.created_at DESC NULLS LAST
    LIMIT 1;

    IF FOUND THEN
      IF COALESCE(v_es.use_custom_hours, false) = true
         AND v_es.custom_start_time IS NOT NULL
         AND v_es.custom_end_time IS NOT NULL THEN
        v_start_time   := v_es.custom_start_time;
        v_end_time     := v_es.custom_end_time;
        v_has_schedule := true;
      ELSIF v_es.schedule_id IS NOT NULL THEN
        SELECT ws.*
        INTO v_ws
        FROM public.work_schedules ws
        WHERE ws.id = v_es.schedule_id
        LIMIT 1;

        IF FOUND AND v_ws.start_time IS NOT NULL AND v_ws.end_time IS NOT NULL THEN
          v_start_time   := v_ws.start_time;
          v_end_time     := v_ws.end_time;
          v_has_schedule := true;
        END IF;
      END IF;
    END IF;

    -- Niveau 1b : Grille par défaut de l'entreprise (si l'employé n'a pas de planning dédié)
    IF NOT v_has_schedule THEN
      SELECT ws.*
      INTO v_def
      FROM public.work_schedules ws
      WHERE ws.enterprise_id = v_in.enterprise_id
        AND COALESCE(ws.is_active, true) = true
      ORDER BY COALESCE(ws.is_default, false) DESC, ws.created_at DESC NULLS LAST
      LIMIT 1;

      IF FOUND AND v_def.start_time IS NOT NULL AND v_def.end_time IS NOT NULL THEN
        v_start_time   := v_def.start_time;
        v_end_time     := v_def.end_time;
        v_has_schedule := true;
      END IF;
    END IF;

    -- Calcul de l'heure cible selon le Niveau 1 (Planning)
    IF v_has_schedule AND v_start_time IS NOT NULL AND v_end_time IS NOT NULL THEN
      IF v_end_time < v_start_time THEN
        -- Planning de nuit (ex: 22:00 -> 06:00) : fin le lendemain (J+1)
        v_target_local := (v_in_date + 1) + v_end_time;
      ELSE
        -- Planning de jour (ex: 08:00 -> 17:00) : fin le jour même (Jour J)
        v_target_local := v_in_date + v_end_time;
      END IF;

      IF v_target_local > v_in_local THEN
        v_target_utc := v_target_local AT TIME ZONE v_tz;
      END IF;
    END IF;

    -- Niveau 2 : Configuration Auto-Close de l'entreprise (si pas de cible Niveau 1)
    IF v_target_utc IS NULL
       AND v_ent IS NOT NULL
       AND COALESCE(v_ent.auto_close_enabled, false) = true
       AND v_ent.auto_close_time IS NOT NULL THEN
      v_target_local := v_in_date + v_ent.auto_close_time::time
                        + make_interval(mins => COALESCE(v_ent.auto_close_grace_minutes, 0));
      IF v_target_local > v_in_local THEN
        v_target_utc := v_target_local AT TIME ZONE v_tz;
      END IF;
    END IF;

    -- Niveau 3 : Secours universel sans planning ni horaires renseignés -> Entrée + 8h00 (jour ou nuit)
    IF v_target_utc IS NULL THEN
      v_target_utc := v_in.check_time + interval '8 hours';
    END IF;

    -- Plafond de sécurité : jamais plus de 14h après l'entrée, et jamais après le prochain pointage
    IF v_target_utc > (v_in.check_time + interval '14 hours') THEN
      v_target_utc := v_in.check_time + interval '14 hours';
    END IF;

    IF v_in.next_time IS NOT NULL AND v_target_utc >= v_in.next_time THEN
      v_target_utc := v_in.next_time - interval '1 minute';
    END IF;

    IF v_target_utc > v_in.check_time AND v_target_utc <= now() THEN
      INSERT INTO public.attendances (
        employee_id,
        enterprise_id,
        check_time,
        check_type,
        method,
        is_auto_closed,
        notes
      )
      VALUES (
        v_in.employee_id,
        v_in.enterprise_id,
        v_target_utc,
        'out',
        COALESCE(v_in.method, 'auto_close'),
        true,
        'Clôture automatique (oubli de dépointage)'
      );
      v_inserted := v_inserted + 1;
    END IF;
  END LOOP;

  RETURN v_inserted;
END;
$$;

-- -----------------------------------------------------------------------------
-- 3. INTÉGRATION DANS encheck_alertes_controler(uuid)
-- -----------------------------------------------------------------------------
DO $$
BEGIN
  IF to_regprocedure('public.encheck_alertes_controler_interne(uuid)') IS NOT NULL THEN
    EXECUTE $fn$
      CREATE OR REPLACE FUNCTION public.encheck_alertes_controler(p_enterprise uuid)
      RETURNS void
      LANGUAGE plpgsql
      SECURITY DEFINER
      SET search_path = public
      AS $body$
      BEGIN
        PERFORM public.encheck_nettoyer_rebonds_qr(p_enterprise);
        PERFORM public.encheck_cloturer_sorties_oubliees(p_enterprise);
        PERFORM public.encheck_alertes_controler_interne(p_enterprise);
        IF to_regprocedure('public.encheck_assainir_alertes_horaires(uuid)') IS NOT NULL THEN
          PERFORM public.encheck_assainir_alertes_horaires(p_enterprise);
        END IF;
      END;
      $body$;
    $fn$;
  END IF;
END;
$$;

-- -----------------------------------------------------------------------------
-- 4. EXÉCUTION IMMÉDIATE SUR TOUTES LES ENTREPRISES
-- -----------------------------------------------------------------------------
SELECT public.encheck_nettoyer_rebonds_qr(NULL);
SELECT public.encheck_cloturer_sorties_oubliees(NULL);
DO $$
BEGIN
  IF to_regprocedure('public.encheck_assainir_alertes_horaires(uuid)') IS NOT NULL THEN
    PERFORM public.encheck_assainir_alertes_horaires(NULL);
  END IF;
END;
$$;

COMMIT;
