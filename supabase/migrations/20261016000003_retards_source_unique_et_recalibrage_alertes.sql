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
DO $$
BEGIN
  IF to_regprocedure('public.encheck_grille_au_jour(uuid,uuid,date)') IS NULL
     OR to_regprocedure('public.encheck_journee_recalculee(uuid,uuid,date)') IS NULL THEN
    RAISE EXCEPTION 'Préflight : encheck_grille_au_jour / encheck_journee_recalculee introuvables. '
      'Exécutez d''abord 20261016000001_fondations_auto_close_structure.sql, puis relancez ce script en entier.';
  END IF;
  IF to_regprocedure('public.encheck_table_alertes()') IS NULL
     OR to_regprocedure('public.encheck_alertes_purger(uuid,boolean,integer)') IS NULL
     OR to_regprocedure('public.encheck_alertes_scan(uuid)') IS NULL THEN
    RAISE EXCEPTION 'Préflight : chaîne d''alertes (encheck_table_alertes / encheck_alertes_purger / '
      'encheck_alertes_scan) introuvable. Exécutez d''abord 20261016000001 puis relancez ce script en entier.';
  END IF;
  IF to_regprocedure('public.encheck_est_admin_de(uuid)') IS NULL THEN
    RAISE EXCEPTION 'Préflight : encheck_est_admin_de introuvable. '
      'Exécutez d''abord 20261016000001 puis relancez ce script en entier.';
  END IF;
  IF to_regprocedure('public.encheck_seuil(uuid,text,integer)') IS NULL THEN
    RAISE EXCEPTION 'Préflight : encheck_seuil introuvable. '
      'Exécutez d''abord les migrations fondations puis relancez ce script en entier.';
  END IF;
END $$;

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
