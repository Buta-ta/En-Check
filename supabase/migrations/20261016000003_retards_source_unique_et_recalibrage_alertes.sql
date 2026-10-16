-- ═══════════════════════════════════════════════════════════════════════════
-- 20261016000003 — RETARDS : SOURCE UNIQUE + RECALIBRAGE DES ALERTES
-- ═══════════════════════════════════════════════════════════════════════════
--  Constat du 16/10/2026 (validation en production) :
--
--  A) « Hippo BIYOKILA · Arrivée à 10:57 alors que la grille « Journée de
--     travail » prévoit 08:00 : 177 minute(s) de retard » — l'alerte compare
--     à la grille PAR DÉFAUT (08:00) alors que l'employé a un horaire
--     personnalisé (09:00). Le vrai retard est 117 min. La purge actuelle
--     (`encheck_alertes_purger`) supprime les alertes FAUSSES mais ne réécrit
--     jamais les chiffres d'une alerte VRAIE restée au texte hérité.
--
--  B) La page « Retards » (JavaScript) calcule elle aussi l'heure prévue avec
--     sa propre lecture de `employee_schedules`/`work_schedules` : sans filtre
--     `is_active`, sans dates d'effet, sans vérifier que la grille liée
--     appartient à la même entreprise. D'où des « Prévu 08:00 » fantômes pour
--     des employés dont l'entreprise n'a AUCUN planning (Pharmacie Blanche
--     Gomes, option Planning non souscrite).
--
--  C) Règle métier validée : une entreprise sans option Planning
--     (`enterprises.module_planning = false`) n'a fixé aucune heure → aucun
--     jugement de ponctualité (ni page Retards, ni alerte).
--
--  Livrés ici :
--    1. `encheck_retards_plage(p_enterprise, p_du, p_au)` — calcul des retards
--       d'une plage, UNIQUEMENT via `encheck_journee_recalculee` →
--       `encheck_grille_au_jour` (la source unique datée et filtrée du projet).
--    2. `encheck_alertes_recalibrer(p_enterprise, p_appliquer)` — réécrit le
--       texte des alertes « Retard à l'arrivée » VRAIES avec les chiffres
--       recalculés pour la date de l'alerte (plus jamais de 177 min inventé).
--    3. `encheck_alertes_purger` (remplacée) — ajoute le motif de suppression
--       « module planning non souscrit » aux trois jugements horaires.
--    4. `encheck_alertes_scan` (remplacée) — enchaîne le recalibrage après la
--       purge, à chaque balayage.
--
--  Sûr pour la production : idempotent (CREATE OR REPLACE), transactionnel,
--  préflight schéma en tête, n'écrit dans aucune table hors `alertes.detail`,
--  et le journal des suppressions d'alertes est conservé tel quel.
-- ═══════════════════════════════════════════════════════════════════════════

BEGIN;

-- ─────────────────────────────────────────────────────────────────────────────
-- 0. PRÉFLIGHT SCHÉMA — message clair si les fondations manquent
-- ─────────────────────────────────────────────────────────────────────────────
--  Vérification par NOM (et non par signature exacte) : `encheck_seuil` est
--  déclarée `(uuid, text, numeric)` — un contrôle sur `(uuid, text, integer)`
--  la manquait alors qu'elle fonctionne (16/10 : préflight faux-négatif).
DO $$
DECLARE
  v_manquant text;
BEGIN
  SELECT string_agg(f.nom, ', ' ORDER BY f.nom) INTO v_manquant
    FROM (VALUES ('encheck_grille_au_jour'),
                 ('encheck_journee_recalculee'),
                 ('encheck_minutes_de_bascule'),
                 ('encheck_duree_circulaire'),
                 ('encheck_colonne_existe'),
                 ('encheck_fuseau'),
                 ('encheck_est_admin_de'),
                 ('encheck_seuil'),
                 ('encheck_table_alertes'),
                 ('encheck_alerte_journaliser'),
                 ('encheck_alertes_purger'),
                 ('encheck_alertes_scan'),
                 ('encheck_generateur_alertes'),
                 ('encheck_reconcilier_estimations'),
                 ('encheck_mode_estimation')) AS f(nom)
   WHERE NOT EXISTS (
     SELECT 1 FROM pg_proc p
       JOIN pg_namespace n ON n.oid = p.pronamespace
      WHERE n.nspname = 'public' AND p.proname = f.nom
   );
  IF v_manquant IS NOT NULL THEN
    RAISE EXCEPTION 'Préflight : fonctions introuvables (%) — exécutez d''abord '
      '20261016000001_fondations_auto_close_structure.sql (et 20261016000002), '
      'puis relancez ce script en entier. Rien n''a été appliqué.', v_manquant;
  END IF;
END $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 0 bis. ENCHECK_GRILLE_au_JOUR — DURCI contre le schéma réel des tables
-- ─────────────────────────────────────────────────────────────────────────────
--  ERREUR DE PRODUCTION du 16/10 : « column es.valide_du does not exist » —
--  `employee_schedules` et `work_schedules` sont créées par un schéma HISTORIQUE
--  (ni notre dépôt, ni celui du pointage n'en portent le CREATE TABLE), et leurs
--  colonnes varient. La version de 20261016000001 filtrait déjà valide_du /
--  valide_au via `encheck_colonne_existe`, MAIS référait `is_active`,
--  `updated_at`, `created_at` en clair dans son SQL dynamique : colonne absente =
--  exception attrapée en silence = les affectations individuelles étaient
--  IGNORÉES (Hippo redevenait « 08:00 » par la trappe du défaut).
--
--  Ici : le MÊME algorithme, à l'identique, mais CHAQUE référence de colonne
--  devient conditionnelle (is_active, valide_du, valide_au, updated_at,
--  created_at). Si toutes les colonnes existent, le comportement est
--  strictement le même qu'avant ; s'il en manque, la résolution continue au
--  lieu d'échouer en silence. Aucune autre fonction n'est touchée.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.encheck_grille_au_jour(
  p_employee uuid,
  p_enterprise uuid,
  p_date date
)
RETURNS jsonb
LANGUAGE plpgsql STABLE
SET search_path = public, pg_temp
AS $$
DECLARE
  v_es      jsonb;
  v_esl     record;
  v_wsj     jsonb;
  v_def     jsonb;
  v_clause  text;
  v_actif   text;
  v_order   text;
  v_found   boolean := false;
  v_nom     text;
  v_start   text;
  v_end     text;
  v_pause   integer := 0;
  v_basc    integer := 0;
  v_tol     integer := 15;
  v_days    jsonb;
  v_source  text := 'aucune';
  v_amp     integer;
BEGIN
  -- ── Affectation individuelle de l'employé, en vigueur CE JOUR-LÀ ──────────
  v_clause := '';
  IF public.encheck_colonne_existe('employee_schedules', 'valide_du') THEN
    v_clause := v_clause || ' AND (es.valide_du IS NULL OR es.valide_du <= $2::date)';
  END IF;
  IF public.encheck_colonne_existe('employee_schedules', 'valide_au') THEN
    v_clause := v_clause || ' AND (es.valide_au IS NULL OR es.valide_au >= $2::date)';
  END IF;

  v_actif := '';
  IF public.encheck_colonne_existe('employee_schedules', 'is_active') THEN
    v_actif := ' AND COALESCE(es.is_active, true) = true';
  END IF;

  v_order := '';
  IF public.encheck_colonne_existe('employee_schedules', 'valide_du') THEN
    v_order := v_order || 'COALESCE(es.valide_du, DATE ''1900-01-01'') DESC NULLS LAST, ';
  END IF;
  IF public.encheck_colonne_existe('employee_schedules', 'updated_at') THEN
    v_order := v_order || 'COALESCE(es.updated_at, ''infinity''::timestamptz) DESC NULLS LAST, ';
  END IF;
  IF public.encheck_colonne_existe('employee_schedules', 'created_at') THEN
    v_order := v_order || 'COALESCE(es.created_at, ''infinity''::timestamptz) DESC NULLS LAST, ';
  END IF;
  v_order := v_order || 'es.id DESC';

  BEGIN
    EXECUTE '
      SELECT to_jsonb(es.*)
        FROM public.employee_schedules es
       WHERE es.employee_id = $1' || v_actif || v_clause || '
       ORDER BY ' || v_order || '
       LIMIT 1'
      INTO v_es USING p_employee, p_date;
    v_found := v_es IS NOT NULL;
  EXCEPTION WHEN OTHERS THEN
    v_found := false;
    v_es    := NULL;
  END;

  IF v_found AND COALESCE((v_es->>'use_custom_hours')::boolean, false)
              AND v_es->>'custom_start_time' IS NOT NULL AND v_es->>'custom_end_time' IS NOT NULL THEN
    v_source := 'custom';
    v_nom    := 'Horaire personnalisé';
    v_start  := left(v_es->>'custom_start_time', 5);
    v_end    := left(v_es->>'custom_end_time', 5);
    -- Sans jours déclarés : Lun–Ven, comme les autres étages et l'UI par défaut
    -- (avant : v_days NULL → est_jour_ouvre faux TOUJOURS → tout disparaissait).
    v_days   := COALESCE(v_es->'custom_work_days', to_jsonb(ARRAY[1,2,3,4,5]));
    v_basc   := public.encheck_minutes_de_bascule(v_es->>'custom_bascule');
    IF (v_es->>'custom_has_break') IS NOT NULL THEN
      v_tol := COALESCE(v_tol, 15);
    END IF;

  ELSIF v_found AND v_es->>'schedule_id' IS NOT NULL THEN
    BEGIN
      EXECUTE 'SELECT to_jsonb(ws.*) FROM public.work_schedules ws WHERE ws.id = $1 LIMIT 1'
        INTO v_wsj USING (v_es->>'schedule_id')::uuid;
    EXCEPTION WHEN OTHERS THEN
      v_wsj := NULL;
    END;
    IF v_wsj IS NOT NULL AND v_wsj->>'start_time' IS NOT NULL AND v_wsj->>'end_time' IS NOT NULL THEN
      v_source := 'liee';
      v_nom    := COALESCE(NULLIF(v_wsj->>'name',''), 'Grille liée');
      v_start  := left(v_wsj->>'start_time', 5);
      v_end    := left(v_wsj->>'end_time', 5);
      v_days   := COALESCE(v_wsj->'work_days', to_jsonb(ARRAY[1,2,3,4,5]));
      v_tol    := COALESCE((v_wsj->>'late_tolerance_minutes')::int, v_tol);
      v_basc   := public.encheck_minutes_de_bascule(v_wsj->>'bascule');
    END IF;
  END IF;

  -- ── Pause : déduite du service attendu (12:00-13:00 = 60 min) ─────────────
  IF v_source <> 'aucune' THEN
    IF v_source = 'custom'
       AND COALESCE((v_es->>'custom_has_break')::boolean, true)
       AND v_es->>'custom_break_start' IS NOT NULL AND v_es->>'custom_break_end' IS NOT NULL THEN
      v_pause := COALESCE(public.encheck_duree_circulaire(left(v_es->>'custom_break_start',5),
                                                           left(v_es->>'custom_break_end',5)), 0);
    ELSIF v_wsj IS NOT NULL
          AND COALESCE((v_wsj->>'has_break')::boolean, false)
          AND v_wsj->>'break_start' IS NOT NULL AND v_wsj->>'break_end' IS NOT NULL THEN
      v_pause := COALESCE(public.encheck_duree_circulaire(left(v_wsj->>'break_start',5),
                                                           left(v_wsj->>'break_end',5)), 0);
    END IF;
  END IF;

  -- ── Grille par DÉFAUT de l'entreprise, uniquement si rien de personnel ────
  IF v_source = 'aucune' THEN
    v_clause := '';
    IF public.encheck_colonne_existe('work_schedules', 'valide_du') THEN
      v_clause := v_clause || ' AND (ws.valide_du IS NULL OR ws.valide_du <= $2::date)';
    END IF;
    IF public.encheck_colonne_existe('work_schedules', 'valide_au') THEN
      v_clause := v_clause || ' AND (ws.valide_au IS NULL OR ws.valide_au >= $2::date)';
    END IF;

    v_actif := '';
    IF public.encheck_colonne_existe('work_schedules', 'is_active') THEN
      v_actif := ' AND COALESCE(ws.is_active, true) = true';
    END IF;

    v_order := 'COALESCE(ws.is_default, false) DESC, ';
    IF public.encheck_colonne_existe('work_schedules', 'created_at') THEN
      v_order := v_order || 'COALESCE(ws.created_at, ''infinity''::timestamptz) DESC, ';
    END IF;
    v_order := v_order || 'ws.id DESC';

    BEGIN
      EXECUTE '
        SELECT to_jsonb(ws.*)
          FROM public.work_schedules ws
         WHERE ws.enterprise_id = $1
           AND ws.start_time IS NOT NULL AND ws.end_time IS NOT NULL' || v_actif || v_clause || '
         ORDER BY ' || v_order || '
         LIMIT 1'
        INTO v_def USING p_enterprise, p_date;
    EXCEPTION WHEN OTHERS THEN
      v_def := NULL;
    END;

    IF v_def IS NOT NULL THEN
      v_source := 'defaut';
      v_nom    := COALESCE(NULLIF(v_def->>'name',''), 'Journée de travail');
      v_start  := left(v_def->>'start_time', 5);
      v_end    := left(v_def->>'end_time', 5);
      v_days   := COALESCE(v_def->'work_days', to_jsonb(ARRAY[1,2,3,4,5]));
      v_tol    := COALESCE((v_def->>'late_tolerance_minutes')::int, v_tol);
      v_basc   := public.encheck_minutes_de_bascule(v_def->>'bascule');
      IF COALESCE((v_def->>'has_break')::boolean, false)
         AND v_def->>'break_start' IS NOT NULL AND v_def->>'break_end' IS NOT NULL THEN
        v_pause := COALESCE(public.encheck_duree_circulaire(left(v_def->>'break_start',5),
                                                             left(v_def->>'break_end',5)), 0);
      END IF;
    END IF;
  END IF;

  -- ── Aucun horaire n'existe : on le dit. Fin du 08:00–17:00 imaginaire. ─────
  IF v_source = 'aucune' THEN
    RETURN jsonb_build_object('trouvee', false, 'source', 'aucune', 'date_jour', p_date::text);
  END IF;

  v_amp := COALESCE(public.encheck_duree_circulaire(v_start, v_end), 0);

  RETURN jsonb_build_object(
    'trouvee',                 true,
    'explicite',               v_source IN ('custom','liee'),
    'source',                  v_source,
    'nom',                     v_nom,
    'start_time',              v_start,
    'end_time',                v_end,
    'start_minutes',           COALESCE(public.encheck_duree_circulaire('00:00', v_start), 0),
    'end_minutes',             COALESCE(public.encheck_duree_circulaire('00:00', v_end), 0),
    'amplitude_minutes',       v_amp,
    'pause_minutes',           v_pause,
    'service_attendu_minutes', GREATEST(0, v_amp - v_pause),
    'bascule_minutes',         v_basc,
    'tolerance_minutes',       v_tol,
    'work_days',               v_days,
    'est_jour_ouvre',          (v_days IS NOT NULL AND v_days @> to_jsonb(ARRAY[EXTRACT(ISODOW FROM p_date)::int])),
    'date_jour',               p_date::text
  );
END;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. CALCUL DES RETARDS SUR UNE PLAGE — la source unique, enfin branchée
-- ─────────────────────────────────────────────────────────────────────────────
--  Chaque (employé, jour) est jugé par `encheck_journee_recalculee`, qui
--  résout la grille en vigueur CE JOUR-LÀ (`encheck_grille_au_jour` :
--  affectation individuelle active et datée → grille liée → défaut de
--  l'entreprise ; sinon « aucune »). Fin des lectures JS approximatives.
--
--  Une ligne est retournée pour chaque jour comportant un pointage :
--    · `motif_exclusion = NULL` : le jour est jugé — `est_retard` fait foi ;
--    · 'sans_option_planning' : entreprise sans option Planning (règle C) ;
--    · 'sans_grille'          : aucune grille en vigueur ce jour-là ;
--    · 'jour_non_ouvre'       : la grille dit que ce jour n'est pas travaillé.
--  `est_retard = retard_minutes > tolerance_minutes`, même formule que la
--  purge d'alertes — page et alertes partagent enfin le même calcul.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.encheck_retards_plage(
  p_enterprise uuid DEFAULT NULL,
  p_du       date  DEFAULT NULL,
  p_au       date  DEFAULT NULL
)
RETURNS TABLE (
  employe_id       uuid,
  prenom           text,
  nom              text,
  matricule        text,
  enterprise_id    uuid,
  entreprise_nom   text,
  jour             date,
  pointage_id      uuid,
  heure_arrivee    text,
  heure_prevue     text,
  tolerance_minutes integer,
  retard_minutes   integer,
  est_retard       boolean,
  grille_nom       text,
  grille_source    text,
  module_planning  boolean,
  motif_exclusion  text
)
LANGUAGE plpgsql STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_email text;
  v_ent   record;
  v_emp   record;
  v_jour  date;
  v_plan  boolean;
  v_tz    text;
  v_r     jsonb;
  v_g     jsonb;
  v_motif text;
  v_ret   integer;
  v_tol   integer;
  v_pid   uuid;
  v_du    date;
  v_au    date;
BEGIN
  -- ── Autorité côté serveur (jamais une revendication du navigateur) ─────────
  v_email := NULLIF(coalesce(auth.jwt() ->> 'email', ''), '');
  IF v_email IS NOT NULL THEN
    IF p_enterprise IS NOT NULL THEN
      IF NOT public.encheck_est_admin_de(p_enterprise) THEN
        RAISE EXCEPTION 'non autorisé pour cette entreprise';
      END IF;
    ELSIF NOT EXISTS (
      SELECT 1 FROM public.admins a
       WHERE lower(a.email) = lower(v_email)
         AND a.is_active = true
         AND a.role = 'super_admin'
    ) THEN
      RAISE EXCEPTION 'non autorisé : la vue toutes entreprises est réservée au super admin';
    END IF;
  END IF;

  v_du := COALESCE(p_du, CURRENT_DATE);
  v_au := COALESCE(p_au, v_du);
  IF v_au < v_du THEN
    RETURN;
  END IF;

  FOR v_ent IN
    SELECT e.id, e.name
      FROM public.enterprises e
     WHERE COALESCE(e.is_active, true) = true
       AND (p_enterprise IS NULL OR e.id = p_enterprise)
     ORDER BY e.name
  LOOP
    -- ── Règle métier C : entreprise sans option Planning → aucun jugement ──
    v_plan := true;
    IF public.encheck_colonne_existe('enterprises', 'module_planning') THEN
      EXECUTE 'SELECT COALESCE(module_planning, true) FROM public.enterprises WHERE id = $1'
        INTO v_plan USING v_ent.id;
    END IF;
    v_tz := public.encheck_fuseau(v_ent.id);

    FOR v_emp IN
      SELECT p.id, p.first_name, p.last_name, p.matricule
        FROM public.employees p
       WHERE p.enterprise_id = v_ent.id
         AND COALESCE(p.is_active, true) = true
       ORDER BY p.last_name, p.first_name
    LOOP
      v_jour := v_du;
      WHILE v_jour <= v_au LOOP
        -- Seuls les pointages FAITS comptent (même règle que la purge) :
        -- une estimation non validée ne prouve rien.
        v_r := public.encheck_journee_recalculee(v_emp.id, v_ent.id, v_jour);

        IF COALESCE((v_r->>'trouvee')::boolean, false) THEN
          v_g := v_r->'grille';
          v_motif := NULL;

          IF NOT COALESCE(v_plan, true) THEN
            v_motif := 'sans_option_planning';
          ELSIF NOT COALESCE((v_g->>'trouvee')::boolean, false) THEN
            v_motif := 'sans_grille';
          ELSIF NOT COALESCE((v_g->>'est_jour_ouvre')::boolean, true) THEN
            v_motif := 'jour_non_ouvre';
          END IF;

          v_ret := COALESCE((v_r->>'retard_minutes')::int, 0);
          v_tol := COALESCE((v_g->>'tolerance_minutes')::int, 15);

          v_pid := NULL;
          SELECT a.id INTO v_pid
            FROM public.attendances a
           WHERE a.employee_id = v_emp.id
             AND a.check_time = (v_r->>'premiere_entree')::timestamptz
             AND (COALESCE(a.is_auto_closed, false) = false OR a.estimation_validee_le IS NOT NULL)
             AND COALESCE(a.anomalie, '') <> 'rebond_qr'
           ORDER BY a.id
           LIMIT 1;

          employe_id        := v_emp.id;
          prenom            := v_emp.first_name;
          nom               := v_emp.last_name;
          matricule         := v_emp.matricule;
          enterprise_id     := v_ent.id;
          entreprise_nom    := v_ent.name;
          jour              := v_jour;
          pointage_id       := v_pid;
          heure_arrivee     := to_char((v_r->>'premiere_entree')::timestamptz AT TIME ZONE v_tz, 'HH24:MI');
          heure_prevue      := left(COALESCE(v_g->>'start_time', ''), 5);
          tolerance_minutes := v_tol;
          retard_minutes    := v_ret;
          est_retard        := (v_motif IS NULL AND v_ret > v_tol);
          grille_nom        := v_g->>'nom';
          grille_source     := COALESCE(v_g->>'source', 'aucune');
          module_planning   := COALESCE(v_plan, true);
          motif_exclusion   := v_motif;
          RETURN NEXT;
        END IF;

        v_jour := v_jour + 1;
      END LOOP;
    END LOOP;
  END LOOP;
END;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. RECALIBRAGE DES ALERTES « RETARD À L'ARRIVÉE » — les vrais chiffres
-- ─────────────────────────────────────────────────────────────────────────────
--  Pour chaque alerte VRAIE encore en base : le texte est régénéré depuis le
--  recalcul du jour DE L'ALERTE (pas d'aujourd'hui) — les dates d'effet des
--  grilles sont donc respectées. Un faux retard n'est jamais « polit » : c'est
--  la purge qui le supprime. Aucune regex sur du texte : on construit le
--  détail depuis les données, et on ne touche que s'il diffère.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.encheck_alertes_recalibrer(
  p_enterprise uuid,
  p_appliquer boolean DEFAULT true
)
RETURNS TABLE (alerte_id uuid, titre text, jour date, employe_id uuid, ancien_detail text, nouveau_detail text)
LANGUAGE plpgsql VOLATILE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_tbl     text;
  v_coldate text;
  v_rec     record;
  v_sql     text;
  v_jours   integer;
  v_tz      text;
  v_r       jsonb;
  v_g       jsonb;
  v_ret     integer;
  v_tol     integer;
  v_ancien  text;
  v_detail  text;
BEGIN
  IF p_enterprise IS NULL THEN
    alerte_id := NULL; titre := NULL; jour := NULL; employe_id := NULL;
    ancien_detail := 'refus : une entreprise explicite est obligatoire'; nouveau_detail := NULL;
    RETURN NEXT;
    RETURN;
  END IF;

  SELECT t.table_alertes, t.col_date INTO v_tbl, v_coldate FROM public.encheck_table_alertes() t;

  IF v_tbl IS NULL OR v_coldate IS NULL
     OR NOT public.encheck_colonne_existe(v_tbl, 'detail') THEN
    alerte_id := NULL; titre := NULL; jour := NULL; employe_id := NULL;
    ancien_detail := 'refus : table d''alertes sans (employee_id + enterprise_id + date + detail)';
    nouveau_detail := NULL;
    RETURN NEXT;
    RETURN;
  END IF;

  v_jours := COALESCE(public.encheck_seuil(p_enterprise, 'alertes_jours_recyclage', 15), 15)::int;
  v_tz    := public.encheck_fuseau(p_enterprise);

  v_sql := format(
    'SELECT a.id, a.titre::text AS titre, a.employee_id, (%I)::date AS jour
       FROM public.%I a
      WHERE a.enterprise_id = $1
        AND (%I)::date >= ((now() AT TIME ZONE $3)::date - $2)
        AND a.titre = %L
      ORDER BY 4',
    v_coldate, v_tbl, v_coldate, 'Retard à l''arrivée');

  FOR v_rec IN EXECUTE v_sql
    USING p_enterprise, v_jours, v_tz
  LOOP
    v_r := public.encheck_journee_recalculee(v_rec.employee_id, p_enterprise, v_rec.jour);
    IF COALESCE((v_r->>'trouvee')::boolean, false) = false THEN
      CONTINUE;                       -- plus rien à prouver sur ce jour
    END IF;
    v_g := v_r->'grille';
    IF COALESCE((v_g->>'trouvee')::boolean, false) = false
       OR COALESCE((v_g->>'est_jour_ouvre')::boolean, true) = false THEN
      CONTINUE;                       -- la purge traite ces cas
    END IF;

    v_ret := COALESCE((v_r->>'retard_minutes')::int, 0);
    v_tol := COALESCE((v_g->>'tolerance_minutes')::int, 15);
    IF v_ret <= v_tol THEN
      CONTINUE;                       -- faux retard : la purge l'efface, on ne le polit pas
    END IF;

    v_detail := format(
      'Arrivée à %s alors que la grille « %s » prévoit %s : %s minute(s) de retard, tolérance %s min.',
      to_char((v_r->>'premiere_entree')::timestamptz AT TIME ZONE v_tz, 'HH24:MI'),
      v_g->>'nom',
      v_g->>'start_time',
      v_ret,
      v_tol);

    EXECUTE format('SELECT (%I)::text FROM public.%I WHERE id = $1', 'detail', v_tbl)
      INTO v_ancien USING v_rec.id;

    IF v_ancien IS NOT DISTINCT FROM v_detail THEN
      CONTINUE;                       -- déjà juste : idempotent, aucune écriture
    END IF;

    alerte_id   := v_rec.id;
    titre       := v_rec.titre;
    jour        := v_rec.jour;
    employe_id  := v_rec.employee_id;
    ancien_detail  := v_ancien;
    nouveau_detail := v_detail;
    RETURN NEXT;

    IF p_appliquer THEN
      EXECUTE format('UPDATE public.%I SET detail = $1 WHERE id = $2', v_tbl)
        USING v_detail, v_rec.id;
    END IF;
  END LOOP;
END;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. ENCHECK_ALERTES_PURGER — + motif « module planning non souscrit »
-- ─────────────────────────────────────────────────────────────────────────────
--  Identique à la version 20261016000001, plus la règle C : une entreprise
--  sans option Planning ne peut porter AUCUN jugement horaire (retard, départ
--  anticipé, journée écourtée) — ces alertes sont purgées avec motif.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.encheck_alertes_purger(
  p_enterprise uuid,
  p_appliquer  boolean DEFAULT true,
  p_jours      integer DEFAULT NULL
)
RETURNS TABLE (alerte_id uuid, titre text, jour date, employe_id uuid, motif text)
LANGUAGE plpgsql VOLATILE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_tbl     text;
  v_coldate text;
  v_rec     record;
  v_sql     text;
  v_jours   integer;
  v_tz      text;
  v_r       jsonb;
  v_g       jsonb;
  v_motif   text;
  v_plan    boolean;
BEGIN
  -- JAMAIS de balayage « toutes entreprises » : c'est par là que des alertes d'une
  -- autre entreprise sautaient par homonymie (correspondance par nom).
  IF p_enterprise IS NULL THEN
    alerte_id := NULL; titre := NULL; jour := NULL; employe_id := NULL;
    motif := 'refus : une entreprise explicite est obligatoire';
    RETURN NEXT;
    RETURN;
  END IF;

  SELECT t.table_alertes, t.col_date INTO v_tbl, v_coldate FROM public.encheck_table_alertes() t;

  IF v_tbl IS NULL OR v_coldate IS NULL THEN
    alerte_id := NULL; titre := NULL; jour := NULL; employe_id := NULL;
    motif := 'refus : table d''alertes sans (employee_id + enterprise_id + date) — aucune correspondance par nom ne sera tentée';
    RETURN NEXT;
    RETURN;
  END IF;

  -- ── Règle métier C : l'option Planning conditionne tout jugement horaire ──
  v_plan := true;
  IF public.encheck_colonne_existe('enterprises', 'module_planning') THEN
    EXECUTE 'SELECT COALESCE(module_planning, true) FROM public.enterprises WHERE id = $1'
      INTO v_plan USING p_enterprise;
  END IF;

  v_jours := COALESCE(p_jours,
              COALESCE(public.encheck_seuil(p_enterprise, 'alertes_jours_recyclage', 15), 15)::int);
  v_tz    := public.encheck_fuseau(p_enterprise);

  v_sql := format(
    'SELECT a.id, a.titre::text AS titre, a.employee_id, (%I)::date AS jour
       FROM public.%I a
      WHERE a.enterprise_id = $1
        AND (%I)::date >= ((now() AT TIME ZONE $3)::date - $2)
        AND a.titre = ANY($4)
      ORDER BY 4',
    v_coldate, v_tbl, v_coldate);

  FOR v_rec IN EXECUTE v_sql
    USING p_enterprise, v_jours, v_tz,
          ARRAY['Retard à l''arrivée', 'Départ anticipé', 'Journée écourtée']
  LOOP
    v_r := public.encheck_journee_recalculee(v_rec.employee_id, p_enterprise, v_rec.jour);
    v_g := v_r->'grille';
    v_motif := NULL;

    IF NOT COALESCE(v_plan, true) THEN
      -- Aucune heure n'a jamais été fixée par l'entreprise : rien ne peut être jugé.
      v_motif := 'module planning non souscrit : aucun jugement horaire n''a de base (règle métier du 2026-10-16)';

    ELSIF COALESCE((v_r->>'trouvee')::boolean, false) = false THEN
      v_motif := NULL;   -- rien à prouver : l'alerte reste

    ELSIF COALESCE((v_g->>'trouvee')::boolean, false) = false THEN
      -- « pas de planning » ne veut plus dire « 08:00-17:00 » : une alerte calculée
      -- contre une grille inexistante n'a aucune valeur.
      v_motif := 'aucune grille horaire en vigueur le ' || v_rec.jour::text || ' : la comparaison est dépourvue de base';

    ELSIF COALESCE((v_g->>'est_jour_ouvre')::boolean, true) = false THEN
      v_motif := 'jour non travaillé selon la grille en vigueur ce jour-là (' || (v_g->>'nom') || ')';

    ELSIF v_rec.titre = 'Retard à l''arrivée' THEN
      IF COALESCE((v_r->>'retard_minutes')::int, 0) <= COALESCE((v_g->>'tolerance_minutes')::int, 15) THEN
        v_motif := format('arrivée %s, grille « %s » %s, tolérance %s min → écart réel %s min, non constitutif d''un retard',
                          to_char((v_r->>'premiere_entree')::timestamptz AT TIME ZONE v_tz, 'HH24:MI'),
                          v_g->>'nom', v_g->>'start_time', v_g->>'tolerance_minutes',
                          v_r->>'retard_minutes');
      END IF;

    ELSIF v_rec.titre = 'Départ anticipé' THEN
      IF (v_r ? 'derniere_sortie') AND COALESCE((v_r->>'avance_minutes')::int, 0) <= 0 THEN
        v_motif := format('sortie réelle %s >= fin de service %s de la grille « %s » du jour',
                          to_char((v_r->>'derniere_sortie')::timestamptz AT TIME ZONE v_tz, 'HH24:MI'),
                          v_g->>'end_time', v_g->>'nom');
      ELSIF COALESCE((v_g->>'end_minutes')::int, 0) < COALESCE((v_g->>'start_minutes')::int, 0) THEN
        v_motif := 'grille de nuit (' || v_g->>'start_time' || '→' || v_g->>'end_time' ||
                   ') : une sortie avant l''heure de fin n''est pas un départ anticipé';
      END IF;

    ELSIF v_rec.titre = 'Journée écourtée' THEN
      IF COALESCE((v_g->>'service_attendu_minutes')::int, 0) > 0
         AND COALESCE((v_r->>'presence_minutes')::int, 0) * 2
             >= (v_g->>'service_attendu_minutes')::int THEN
        v_motif := format('présence réelle %s min pour %s min de service attendu (pause %s min déduite) : seuil des 50 %% atteint',
                          v_r->>'presence_minutes', v_g->>'service_attendu_minutes', v_g->>'pause_minutes');
      END IF;
    END IF;

    IF v_motif IS NULL THEN
      CONTINUE;                    -- alerte confirmée par les données : on la laisse en paix
    END IF;

    alerte_id  := v_rec.id;
    titre      := v_rec.titre;
    jour       := v_rec.jour;
    employe_id := v_rec.employee_id;
    motif      := v_motif;
    RETURN NEXT;

    IF p_appliquer THEN
      PERFORM public.encheck_alerte_journaliser(v_tbl, v_rec.id, p_enterprise,
                                                v_rec.employee_id, v_motif);
    END IF;
  END LOOP;
END;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. ENCHECK_ALERTES_SCAN — purge puis recalibrage, à chaque balayage
-- ─────────────────────────────────────────────────────────────────────────────
--  Identique à la version 20261016000001, plus `encheck_alertes_recalibrer`
--  juste après la purge : une alerte vraie affiche TOUJOURS les chiffres du
--  recalcul du jour visé. Le recalibrage ne dépend pas du mode d'estimation
--  (il n'écrit que le texte d'une alerte déjà acceptée).
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.encheck_alertes_scan(p_enterprise uuid DEFAULT NULL)
RETURNS integer
LANGUAGE plpgsql VOLATILE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE v_purge integer := 0;
        v_email text;
BEGIN
  -- ── Qui a le droit de faire tourner le moteur ? ────────────────────────────
  -- Cet appel est SECURITY DEFINER (il écrit des alertes) et le navigateur le
  -- déclenche à chaque ouverture de la cloche. Sans garde, n'importe quel employé
  -- authentifié — dans n'importe quelle entreprise — peut faire tourner le moteur
  -- de sa voisine. Règle retenue :
  --   · un appel porté par une identité HTTP exige un admin DE L'ENTREPRISE visée ;
  --   · un appel SANS identité HTTP (pg_cron de la nuit, service_role) passe, sinon
  --     la garde transforme silencieusement le cron en no-op — le pire des deux
  --     mondes, parce que plus rien ne se calcule et que rien ne le dit.
  v_email := NULLIF(coalesce(auth.jwt() ->> 'email', ''), '');
  IF v_email IS NOT NULL AND NOT public.encheck_est_admin_de(p_enterprise) THEN
    RETURN 0;
  END IF;

  -- ── Le générateur historique ne reçoit JAMAIS « toutes les entreprises » ─────
  -- C'est par ce biais qu'une purge globale a déjà fait sauter des alertes d'une
  -- entreprise à l'autre par simple homonymie de titre. Le balayage global n'a
  -- donc plus de chemin ici : le cron passe par `encheck_alertes_scan_toutes_
  -- entreprises()`, qui appelle cette fonction UNE PAR UNE.
  IF p_enterprise IS NULL THEN
    -- Sans entreprise explicite : seule la réconciliation (clé par identifiants,
    -- jamais par texte) est autorisée à parcourir tout le parc.
    PERFORM public.encheck_reconcilier_estimations(NULL);
    RETURN 0;
  END IF;

  PERFORM public.encheck_generateur_alertes(p_enterprise);
  PERFORM public.encheck_reconcilier_estimations(p_enterprise);

  IF public.encheck_mode_estimation(p_enterprise) <> 'desactive' THEN
    SELECT count(*) INTO v_purge FROM public.encheck_alertes_purger(p_enterprise, true, NULL);
  END IF;

  -- Recalibrage : les alertes VRAIES restantes affichent les chiffres du jour.
  PERFORM public.encheck_alertes_recalibrer(p_enterprise, true);

  RETURN COALESCE(v_purge, 0);
END;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 5. DROITS D'EXÉCUTION — même discipline que les fondations
-- ─────────────────────────────────────────────────────────────────────────────
REVOKE ALL ON FUNCTION public.encheck_retards_plage(uuid, date, date)          FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.encheck_alertes_recalibrer(uuid, boolean)         FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.encheck_retards_plage(uuid, date, date)        TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.encheck_alertes_recalibrer(uuid, boolean)      TO postgres, service_role;

-- `encheck_alertes_purger` et `encheck_alertes_scan` conservent les droits
-- posés par 20261016000001 (le CREATE OR REPLACE ne les modifie pas).

COMMIT;
