-- =============================================================================
-- Migration : 20261016000002_garde_nuit_garde_fous_double_lecture.sql
-- Auteur    : IA ARBITRE — arbitrage n°2/3 (cas Hippo BIYOKILA 15→16/10/2026,
--             cas Mercia MAYOUMA 16/10/2026). VALIDÉE par le commanditaire.
-- Objet     :
--   1. Nouveau seuil `garde_max_heures` (22 h) — règle « garde de nuit » (R2) :
--      une sortie RÉELLE pointée avant 06:00 le lendemain appartient à la
--      garde ouverte la veille, même au-delà de la tolérance d'appariement,
--      dans la limite de 22 h. Deux vrais badges ne se perdent plus
--      (Hippo : 08:54 → 01:12 = 16 h 19, refusées par le seuil de 16 h).
--   2. Garde-fou « date future » : un pointage ne peut pas se trouver dans le
--      futur (marge 10 min pour la dérive des horloges). Le bouton « J+1 » de
--      ModifierPointage a déjà envoyé une sortie au lendemain par erreur : la
--      journée s'est nouée sur un instant qui n'était pas encore arrivé.
--   3. Règle R2 dans les moteurs de réconciliation SQL (trigger de remplacement
--      d'estimation + balayage `encheck_reconcilier_estimations`).
--   4. Double lecture en ombre du Niveau 2 (décision B2) : le comportement est
--      calculé et consigné même quand le Niveau 1 a répondu — sinon il ne
--      tournerait jamais (les 14 salariés contrôlés ont tous une grille).
--      + correction de variables « périmées » entre itérations de la cascade
--      (v2_* et v_id n'étaient pas réinitialisées : la 2e itération d'une
--      exécution réutilisait les chiffres de la 1re).
--
-- Conventions : idempotente, rejouable. Ne touche JAMAIS aux données
-- existantes (la réparation des lignes corrompues vit dans
-- `supabase/outils-sql/20261016_reparer-cas-hippo-mercia.sql`, à jouer
-- explicitement après le déploiement).
-- =============================================================================

BEGIN;

-- -----------------------------------------------------------------------------
-- 1. SEUIL `garde_max_heures` (source unique : encheck_reglages_pointage)
-- -----------------------------------------------------------------------------
INSERT INTO public.encheck_reglages_pointage (cle, valeur, commentaire) VALUES
  ('garde_max_heures', '22',
   'Règle garde de nuit (arbitrage n°2, R2) : sortie réelle avant 06:00 le lendemain = fin de la garde ouverte la veille, dans la limite de ce plafond (22 h). Au-delà, ce n''est plus une garde : c''est un oubli.')
ON CONFLICT (cle) WHERE enterprise_id IS NULL DO NOTHING;

-- -----------------------------------------------------------------------------
-- 2. GARDE-FOU « DATE FUTURE » — un badge ne peut pas se trouver dans le futur
--    (marge 10 min pour la dérive des horloges de boîtier). Le point de
--    contournement `SET encheck.test_rejeu = '1'` existe pour les harnais de
--    test qui rejouent des scénarios avec des dates fictives — jamais pour la
--    production.
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.encheck_attendances_refuser_futur()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
  IF COALESCE(current_setting('encheck.test_rejeu', true), '') = '1' THEN
    RETURN NEW;   -- harnais de test explicite, jamais la production
  END IF;
  IF NEW.check_time IS NOT NULL
     AND NEW.check_time > now() + make_interval(mins => 10) THEN
    RAISE EXCEPTION
      'Pointage refusé : check_time (%) est dans le futur (marge : 10 min). Un badge ne peut pas se trouver dans le futur — vérifiez la date (bouton « J+1 » de la fiche Modifier : il ajoute un jour à la date affichée).',
      NEW.check_time
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_attendances_refuser_futur ON public.attendances;
CREATE TRIGGER trg_attendances_refuser_futur
  BEFORE INSERT ON public.attendances
  FOR EACH ROW
  EXECUTE FUNCTION public.encheck_attendances_refuser_futur();

-- -----------------------------------------------------------------------------
-- 3. RÉCONCILIATION AU MOMENT DE L'INSERTION — alignée sur la règle R2
--    (copie de `encheck_attendances_apres_insert` avec la fenêtre élargie :
--    appariement normal OU sortie de nuit < 06:00 dans garde_max_heures).
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.encheck_attendances_apres_insert()
RETURNS trigger
LANGUAGE plpgsql VOLATILE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_est  uuid;
  v_hrs  integer;
  v_garde integer;
  v_tz   text;
BEGIN
  IF COALESCE(NEW.is_auto_closed, false) THEN
    RETURN NULL;                      -- notre propre estimation : pas d'auto-remplacement
  END IF;
  IF lower(NEW.check_type::text) <> 'out' THEN
    RETURN NULL;
  END IF;
  IF NEW.estimation_source_id IS NOT NULL THEN
    RETURN NULL;
  END IF;

  v_hrs  := COALESCE(public.encheck_seuil(NEW.enterprise_id, 'appariement_heures', 16), 16)::int;
  v_garde := COALESCE(public.encheck_seuil(NEW.enterprise_id, 'garde_max_heures', 22), 22)::int;
  v_tz   := public.encheck_fuseau(NEW.enterprise_id);

  SELECT e.id INTO v_est
    FROM public.attendances e
    JOIN public.attendances i ON i.id = e.estimation_source_id
   WHERE e.employee_id = NEW.employee_id
     AND COALESCE(e.is_auto_closed, false) = true
     AND e.estimation_remplacee_le IS NULL
     AND NEW.check_time >  i.check_time
     AND (
          -- R1 : tolérance d'appariement normale
          NEW.check_time <= i.check_time + make_interval(hours => v_hrs)
          OR (
            -- R2 : sortie de nuit — avant 06:00 locale, dans garde_max_heures
            NEW.check_time <= i.check_time + make_interval(hours => v_garde)
            AND (EXTRACT(HOUR FROM (NEW.check_time AT TIME ZONE v_tz))::int < 6)
          )
        )
   ORDER BY e.check_time DESC
   LIMIT 1;

  IF v_est IS NOT NULL THEN
    PERFORM public.encheck_estimation_remplacer(v_est, NEW.id,
             'vrai pointage reçu après l''estimation (file hors-ligne, ou oubli rattrapé)');
  END IF;

  RETURN NULL;
EXCEPTION WHEN OTHERS THEN
  RETURN NULL;   -- un déclencheur ne doit JAMAIS empêcher un pointage d'être enregistré
END;
$$;

-- Le trigger existe déjà (créé par 20261016000001) : la fonction remplacée
-- suffit, mais on ré-attache au cas où le nom aurait été perdu.
DROP TRIGGER IF EXISTS trg_attendances_reconcilier_estimation ON public.attendances;
CREATE TRIGGER trg_attendances_reconcilier_estimation
  AFTER INSERT ON public.attendances
  FOR EACH ROW
  EXECUTE FUNCTION public.encheck_attendances_apres_insert();

-- -----------------------------------------------------------------------------
-- 3b. BALAYAGE DE RÉCONCILIATION — même règle R2 (fenêtre de matching élargie
--     pour les sorties de nuit ; la fenêtre de MESURE reste large elle aussi).
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.encheck_reconcilier_estimations(p_enterprise uuid DEFAULT NULL)
RETURNS integer
LANGUAGE plpgsql VOLATILE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_rec record;
  v_n   integer := 0;
  v_tz  text;
BEGIN
  v_tz := public.encheck_fuseau(p_enterprise);

  FOR v_rec IN
    SELECT e.id AS estimation_id, v.remplacement_id, v.remplacement_time
      FROM public.attendances e
      JOIN LATERAL (
        SELECT r.id AS remplacement_id, r.check_time AS remplacement_time
          FROM public.attendances r
          JOIN public.attendances i ON i.id = e.estimation_source_id
         WHERE r.employee_id = e.employee_id
           AND lower(r.check_type::text) = 'out'
           AND COALESCE(r.is_auto_closed, false) = false
           AND r.estimation_source_id IS NULL
           AND r.check_time >  i.check_time
           AND (
                r.check_time <= i.check_time + make_interval(
                  hours => COALESCE(public.encheck_seuil(e.enterprise_id,'appariement_heures',16),16)::int)
                OR (
                  r.check_time <= i.check_time + make_interval(
                    hours => COALESCE(public.encheck_seuil(e.enterprise_id,'garde_max_heures',22),22)::int)
                  AND (EXTRACT(HOUR FROM (r.check_time AT TIME ZONE v_tz))::int < 6)
                )
              )
         ORDER BY r.check_time
         LIMIT 1
      ) v ON TRUE
     WHERE COALESCE(e.is_auto_closed, false) = true
       AND e.estimation_remplacee_le IS NULL
       AND lower(e.check_type::text) = 'out'
       AND (p_enterprise IS NULL OR e.enterprise_id = p_enterprise)
       AND e.check_time >= now() - interval '90 days'
     ORDER BY e.check_time
  LOOP
    IF public.encheck_estimation_remplacer(v_rec.estimation_id, v_rec.remplacement_id,
         'pointage réel (' || to_char(v_rec.remplacement_time AT TIME ZONE v_tz, 'DD/MM HH24:MI') ||
         ') reçu : la vérité terrain prime sur l''estimation') THEN
      v_n := v_n + 1;
    END IF;
  END LOOP;

  -- Mesure de l'écart, même en mode ombre (aucune ligne dans attendances à ce stade).
  UPDATE public.encheck_clotures_estimees c
     SET sortie_reelle = s.veritable,
         ecart_minutes = CASE WHEN c.sortie_estimee IS NOT NULL
                              THEN round(extract(epoch FROM (c.sortie_estimee - s.veritable)) / 60)::int
                              ELSE NULL END,
         maj_le        = now()
    FROM (
      SELECT ce.attendance_in_id, min(o.check_time) AS veritable
        FROM public.encheck_clotures_estimees ce
        JOIN public.attendances i ON i.id = ce.attendance_in_id
        JOIN public.attendances o
          ON o.employee_id = i.employee_id
         AND lower(o.check_type::text) = 'out'
         AND COALESCE(o.is_auto_closed, false) = false
         AND o.estimation_source_id IS NULL
         AND o.check_time >  i.check_time
         AND o.check_time <= i.check_time + interval '20 hours'
       WHERE ce.sortie_reelle IS NULL
       GROUP BY 1
    ) s
   WHERE c.attendance_in_id = s.attendance_in_id;

  RETURN v_n;
END;
$$;

-- -----------------------------------------------------------------------------
-- 4. CASCADE DE CLÔTURE — DOUBLE LECTURE OMBRE DU NIVEAU 2 (décision B2)
--    Changements, STRICTEMENT limités :
--      a. `v2_*` et `v_id` sont RÉINITIALISÉES à chaque itération (avant :
--         variables périmées d'une itération à l'autre — la 2e ligne consignée
--         d'une exécution pouvait porter les chiffres de la 1re) ;
--      b. le hook Niveau 2 est appelé MÊME quand le Niveau 1 a répondu, et son
--         résultat est consigné dans `detail->'niveau2_ombre'` SANS changer la
--         décision : c'est ce qui permettra de mesurer l'apprentissage avant
--         de l'activer (les 14 salariés contrôlés ont tous une grille : sans
--         cette double lecture, le Niveau 2 ne tournerait jamais).
--    Le reste de la fonction est identique à 20261016000001.
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.encheck_cloturer_pivotable(
  p_enterprise uuid,
  p_now        timestamptz DEFAULT now(),
  p_mode       text        DEFAULT NULL
)
RETURNS TABLE (
  employee_id uuid, entree timestamptz, cible timestamptz, niveau text,
  motif_rejet text, applique boolean, estimation_id uuid
)
LANGUAGE plpgsql VOLATILE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_locked  boolean;
  v_mode    text;
  v_tz      text;
  v_oubli   numeric;
  v_plafond numeric;
  v_marge   numeric;
  v_dmin    numeric;
  v_seuil   integer;
  v_jours   integer;
  v_dv      integer;
  v_nmin    integer;
  v_iqr     integer;
  v_in      record;
  v_g       jsonb;
  v_basc    integer;
  v_jour    date;
  v_auj     date;
  v_cible   timestamptz;
  v_niveau  text;
  v_rejet   text;
  v_det     jsonb;
  v_entj    jsonb;   -- ligne `enterprises` lue en jsonb (colonnes optionnelles)
  v_loc     timestamp;
  v_id      uuid;
  -- Niveau 2 (variables scalaires : un `record` non affecté ne se teste pas)
  v2_cible  timestamptz;
  v2_niv    text;
  v2_n      integer;
  v2_iqr    integer;
  v2_conf   text;
  v2_rejet  text;
  v2_det    jsonb;
BEGIN
  SELECT pg_try_advisory_xact_lock(hashtextextended('encheck:cloture:' || COALESCE(p_enterprise::text,'*'), 0))
    INTO v_locked;
  IF NOT COALESCE(v_locked, true) THEN
    RETURN;   -- une exécution tourne déjà : ce n'est pas une erreur, c'est la preuve du verrou
  END IF;

  v_mode := lower(COALESCE(NULLIF(p_mode, ''), public.encheck_mode_estimation(p_enterprise), 'ombre'));
  IF v_mode = 'desactive' THEN
    RETURN;
  END IF;

  v_tz      := public.encheck_fuseau(p_enterprise);
  v_oubli   := public.encheck_seuil(p_enterprise, 'oubli_sortie_heures', 12);
  v_plafond := public.encheck_seuil(p_enterprise, 'plafond_invention_heures', 12);
  v_marge   := public.encheck_seuil(p_enterprise, 'marge_apres_sortie_estimee_minutes', 30);
  v_dmin    := public.encheck_seuil(p_enterprise, 'duree_minimale_session_minutes', 30);
  v_seuil   := COALESCE(public.encheck_seuil(p_enterprise, 'cluster_fenetre_minutes', 90), 90)::int;
  v_jours   := COALESCE(public.encheck_seuil(p_enterprise, 'cluster_fenetre_jours', 28), 28)::int;
  v_dv      := COALESCE(public.encheck_seuil(p_enterprise, 'cluster_demi_vie_jours', 14), 14)::int;
  v_nmin    := COALESCE(public.encheck_seuil(p_enterprise, 'cluster_nb_min', 5), 5)::int;
  v_iqr     := COALESCE(public.encheck_seuil(p_enterprise, 'cluster_iqr_max_minutes', 45), 45)::int;

  FOR v_in IN
    SELECT d.in_id, d.employee_id, d.enterprise_id, d.entree
      FROM (
        SELECT DISTINCT ON (a.employee_id)
               a.id AS in_id, a.employee_id, a.enterprise_id, a.check_time AS entree,
               a.check_type, a.is_auto_closed, a.anomalie
          FROM public.attendances a
         WHERE (p_enterprise IS NULL OR a.enterprise_id = p_enterprise)
           AND a.check_time >= p_now - interval '60 days'
         ORDER BY a.employee_id, a.check_time DESC
      ) d
     WHERE lower(d.check_type::text) = 'in'
       AND COALESCE(d.is_auto_closed, false) = false
       AND d.entree <= p_now - make_interval(hours => GREATEST(1, v_oubli)::int)
       AND d.anomalie IS NULL          -- une entrée signalée suspecte par la pointeuse ne se clôture pas
       AND NOT EXISTS (                -- déjà estimée : idempotence + anti-course
             SELECT 1 FROM public.attendances x
              WHERE x.estimation_source_id = d.in_id
                AND x.estimation_remplacee_le IS NULL)
     ORDER BY d.entree
  LOOP
    --  (Correctif arbitrage n°3) : réinitialisation COMPLÈTE à chaque itération.
    --  Avant, v2_* et v_id survivaient d'une itération à l'autre : la 2e ligne
    --  consignée d'une exécution pouvait porter les chiffres de la 1re.
    employee_id   := v_in.employee_id;
    entree        := v_in.entree;
    cible         := NULL;
    niveau        := NULL;
    motif_rejet   := NULL;
    estimation_id := NULL;
    applique      := false;
    v_cible := NULL; v_niveau := NULL; v_rejet := NULL; v_det := '{}'::jsonb;
    v_id    := NULL;
    v2_cible := NULL; v2_niv := NULL; v2_n := NULL; v2_iqr := NULL;
    v2_conf := NULL; v2_rejet := NULL; v2_det := NULL;

    v_g    := public.encheck_grille_au_jour(v_in.employee_id, v_in.enterprise_id,
                                            (v_in.entree AT TIME ZONE v_tz)::date);
    v_basc := COALESCE((v_g->>'bascule_minutes')::int, 0);
    v_jour := ((v_in.entree AT TIME ZONE v_tz) - make_interval(mins => v_basc))::date;
    v_auj  := ((p_now      AT TIME ZONE v_tz) - make_interval(mins => v_basc))::date;

    IF v_jour >= v_auj THEN
      v_rejet  := 'journee_en_cours';
      v_niveau := 'garde-fou';
      cible := NULL; niveau := v_niveau; motif_rejet := v_rejet;
      INSERT INTO public.encheck_clotures_estimees
            (enterprise_id, employee_id, attendance_in_id, jour_travail, entree,
             sortie_estimee, niveau, motif_rejet, applique, detail, maj_le)
      VALUES(v_in.enterprise_id, v_in.employee_id, v_in.in_id, v_jour, v_in.entree,
             NULL, v_niveau, v_rejet, false, v_det, now())
      ON CONFLICT (attendance_in_id) DO UPDATE
        SET motif_rejet = EXCLUDED.motif_rejet, niveau = EXCLUDED.niveau,
            detail = EXCLUDED.detail, maj_le = now();
      RETURN NEXT;
      CONTINUE;
    END IF;

    -- ── Niveau 1 : décision écrite pour cet employé (perso, ou grille qui lui est liée)
    IF COALESCE(v_g->>'source','aucune') IN ('custom','liee') THEN
      v_cible  := public.encheck_heure_de_fin_prevue(v_in.entree, v_g, v_tz);
      v_niveau := '1-horaire-personnel';
      v_det    := v_det || jsonb_build_object('grille', v_g);
    END IF;

    -- ── Niveau 2 : apprentissage comportemental (hook IA DEV 1)
    --  B2 (arbitrage n°2) : DOUBLE LECTURE. Le hook est calculé MÊME quand le
    --  Niveau 1 a répondu ; son résultat est consigné dans `niveau2_ombre` sans
    --  changer la décision. Sans ça, le Niveau 2 ne tournerait jamais en
    --  production (tous les salariés ont une grille) et l'activation se ferait
    --  sans AUCUNE mesure. Les colonnes `nb_exemples`/`iqr_minutes` de la ligne
    --  consignée ne décrivent que l'estimation RETENUE : on les vide si le
    --  Niveau 1 a gagné.
    BEGIN
      SELECT e.sortie_estimee, e.niveau, e.nb_exemples, e.iqr_minutes, e.confiance,
             e.motif_rejet, e.detail
        INTO v2_cible, v2_niv, v2_n, v2_iqr, v2_conf, v2_rejet, v2_det
        FROM public.encheck_estimer_sortie_comportementale(
               v_in.employee_id, v_in.enterprise_id, v_in.entree,
               v_seuil, v_jours, v_dv, v_nmin, v_iqr, v_marge::int, v_plafond) e;

      IF v_cible IS NULL THEN
        -- Niveau 1 muet : le Niveau 2 peut prendre la décision.
        IF v2_cible IS NOT NULL THEN
          v_cible  := v2_cible;
          v_niveau := COALESCE('2-apprentissage-' || v2_niv, '2-apprentissage');
          v_det    := v_det || jsonb_build_object('nb_exemples', v2_n, 'iqr_minutes', v2_iqr,
                                                   'confiance', v2_conf, 'source_estimation', v2_det);
        ELSIF v2_rejet IS NOT NULL THEN
          v_niveau := '2-apprentissage';
          v_det    := v_det || jsonb_build_object('rejet_niveau2', v2_rejet, 'detail_niveau2', v2_det);
        END IF;
      ELSE
        -- Niveau 1 a répondu : consigne ombre, la décision ne change pas.
        v_det := v_det || jsonb_build_object('niveau2_ombre', jsonb_build_object(
                   'sortie_estimee', v2_cible, 'niveau', v2_niv,
                   'nb_exemples', v2_n, 'iqr_minutes', v2_iqr,
                   'confiance', v2_conf, 'motif_rejet', v2_rejet,
                   'detail', v2_det));
        v2_n := NULL; v2_iqr := NULL;   -- colonnes = estimation RETENUE uniquement
      END IF;
    EXCEPTION WHEN OTHERS THEN
      -- Une estimation qui plante ne doit jamais bloquer la clôture de sécurité :
      -- on descend d'étage et la raison est consignée (pas avalée).
      v_det := v_det || jsonb_build_object('erreur_niveau2', SQLERRM);
    END;

    -- ── Niveau 3 : grille par défaut de l'entreprise
    IF v_cible IS NULL AND COALESCE(v_g->>'source','aucune') = 'defaut' THEN
      v_cible  := public.encheck_heure_de_fin_prevue(v_in.entree, v_g, v_tz);
      v_niveau := '3-grille-entreprise';
      v_det    := v_det || jsonb_build_object('grille', v_g);
    END IF;

    -- ── Niveau 4 : heure auto-close de l'entreprise (config, jamais une durée)
    IF v_cible IS NULL THEN
      BEGIN
        EXECUTE 'SELECT to_jsonb(e.*) FROM public.enterprises e WHERE e.id = $1 LIMIT 1'
          INTO v_entj USING v_in.enterprise_id;
      EXCEPTION WHEN OTHERS THEN
        v_entj := NULL;
      END;
      IF COALESCE((v_entj->>'auto_close_enabled')::boolean, false)
         AND v_entj->>'auto_close_time' IS NOT NULL THEN
        v_loc := ((v_in.entree AT TIME ZONE v_tz)::date
                  + left(v_entj->>'auto_close_time', 5)::time
                  + make_interval(mins => COALESCE((v_entj->>'auto_close_grace_minutes')::int, 0)))
                 + CASE WHEN left(v_entj->>'auto_close_time', 5)::time
                           < COALESCE((v_g->>'start_time')::time, time '00:00')
                        THEN interval '1 day' ELSE interval '0' END;
        IF (v_loc AT TIME ZONE v_tz) > v_in.entree AND (v_loc AT TIME ZONE v_tz) <= p_now THEN
          v_cible  := v_loc AT TIME ZONE v_tz;
          v_niveau := '4-auto-close-entreprise';
        END IF;
      END IF;
    END IF;

    -- ── Niveau 5 : secours universel entrée + 8 h (traverse minuit sans 23:59)
    IF v_cible IS NULL THEN
      v_cible  := v_in.entree + interval '8 hours';
      v_niveau := '5-secours-8h';
    END IF;

    -- ── Garde-fous transverses (§4.3)
    IF v_cible <= v_in.entree + make_interval(mins => COALESCE(v_dmin, 30)::int) THEN
      v_det  := v_det || jsonb_build_object('cible_ecartee', v_cible);
      v_rejet := 'session_trop_courte';
      v_cible := NULL;
    ELSIF v_cible > v_in.entree + make_interval(hours => COALESCE(v_plafond, 12)::int) THEN
      v_det  := v_det || jsonb_build_object('cible_avant_plafond', v_cible,
                                            'plafond_heures', v_plafond, 'plafonnee', true);
      v_cible := v_in.entree + make_interval(hours => COALESCE(v_plafond, 12)::int);
    ELSIF v_cible > p_now THEN
      v_det  := v_det || jsonb_build_object('cible_ecartee', v_cible);
      v_rejet := 'cible_dans_le_futur';
      v_cible := NULL;
    END IF;

    cible := v_cible; niveau := v_niveau; motif_rejet := v_rejet;

    -- ── Écriture : seulement en mode « actif » (§5 : deux semaines d'ombre d'abord)
    IF v_cible IS NOT NULL AND v_mode = 'actif' THEN
      INSERT INTO public.attendances (
        employee_id, enterprise_id, check_time, check_type,
        method, is_auto_closed, origine, decision_raison, anomalie, notes,
        estimation_source_id, estimation_niveau, estimation_confiance, estimation_detail
      )
      VALUES (
        v_in.employee_id, v_in.enterprise_id, v_cible, 'out',
        'auto_close',                       -- §4.1 : imposée, jamais recopiée de l'entrée
        true, 'estimation', v_niveau, 'sortie_presumee',
        'Sortie présumée par le pipeline En-Check — à valider par un humain. Non payée, non notifiée.',
        v_in.in_id,
        CASE WHEN v_niveau LIKE '1%' THEN 1 WHEN v_niveau LIKE '2%' THEN 2
             WHEN v_niveau LIKE '3%' THEN 3 WHEN v_niveau LIKE '4%' THEN 4 ELSE 5 END::smallint,
        COALESCE(v_det->>'confiance', 'faible'), v_det
      )
      RETURNING id INTO v_id;

      estimation_id := v_id;
      applique      := true;

      INSERT INTO public.encheck_pointages_journal
            (enterprise_id, employee_id, attendance_id, action, motif, snapshot, pipeline, auteur)
      VALUES(v_in.enterprise_id, v_in.employee_id, v_id, 'estimation_inseree',
             'oubli de dépointage — sortie présumée consignée (mode actif)',
             jsonb_build_object('entree_id', v_in.in_id, 'entree', v_in.entree,
                                'cible', v_cible, 'niveau', v_niveau, 'jour_travail', v_jour,
                                'detail', v_det),
             'encheck_cloturer_pivotable', public.encheck_auteur_actuel());
    END IF;

    INSERT INTO public.encheck_clotures_estimees
          (enterprise_id, employee_id, attendance_in_id, jour_travail, entree,
           sortie_estimee, niveau, nb_exemples, iqr_minutes, confiance, motif_rejet,
           applique, estimation_id, detail, maj_le)
    VALUES(v_in.enterprise_id, v_in.employee_id, v_in.in_id, v_jour, v_in.entree,
           v_cible, COALESCE(v_niveau,'inconnu'), v2_n, v2_iqr, v_det->>'confiance', v_rejet,
           applique, v_id, v_det, now())
    ON CONFLICT (attendance_in_id) DO UPDATE
      SET sortie_estimee = COALESCE(EXCLUDED.sortie_estimee,
                                    public.encheck_clotures_estimees.sortie_estimee),
          niveau         = EXCLUDED.niveau,
          nb_exemples    = COALESCE(EXCLUDED.nb_exemples, public.encheck_clotures_estimees.nb_exemples),
          iqr_minutes    = COALESCE(EXCLUDED.iqr_minutes, public.encheck_clotures_estimees.iqr_minutes),
          confiance      = COALESCE(EXCLUDED.confiance,   public.encheck_clotures_estimees.confiance),
          motif_rejet    = EXCLUDED.motif_rejet,
          applique       = EXCLUDED.applique,
          estimation_id  = COALESCE(EXCLUDED.estimation_id, public.encheck_clotures_estimees.estimation_id),
          detail         = public.encheck_clotures_estimees.detail || EXCLUDED.detail,
          maj_le         = now();

    RETURN NEXT;
  END LOOP;
END;
$$;

-- Les fonctions qui touchent aux pointages ne s'exposent qu'aux rôles prévus
-- (patron identique au Radar : 20261012000001 §9).
REVOKE ALL ON FUNCTION public.encheck_attendances_refuser_futur() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.encheck_cloturer_pivotable(uuid, timestamptz, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.encheck_cloturer_pivotable(uuid, timestamptz, text) TO postgres, service_role;

COMMIT;
