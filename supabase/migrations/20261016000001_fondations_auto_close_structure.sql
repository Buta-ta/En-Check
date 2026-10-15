-- =============================================================================
-- Migration : 20261016000001_fondations_auto_close_structure.sql
-- Auteur    : IA DEV 2 (dépôt En-Check — admin PWA)
-- Objet     : Lot « fondations structurelles » de l'ARBITRAGE N°1 du 15/10/2026
--             (dossier Drive « IA ARBITRE »), plan d'action §6 ligne 3.
--
-- CE QUE CETTE MIGRATION FAIT
--   1. SEUILS HARMONISÉS  — une seule source de vérité. Avant : 12 h (pointeuse),
--      14 h (SQL oubli), 14 h (SQL plafond), 16 h (JS appariement), 60 s (anti-rebond,
--      2 implémentations), 5 min, 23:59. Table `encheck_reglages_pointage` +
--      `encheck_seuil()`. Concepts distinctes et nommées : oubli ≠ plafond ≠ appariement.
--   2. DOCTRINE §4.1 — une sortie estimée est MARQUÉE, jamais confondue avec un badge :
--      `method='auto_close'` IMPOSÉE (avant : recopiée depuis l'entrée → une sortie
--      inventée portait la signature « qr » d'un vrai pointage), pas de GPS recopié,
--      `anomalie='sortie_presumee'`, provenance complète (`estimation_*`).
--   3. NON-DESTRUCTION — `encheck_nettoyer_rebonds_qr` ne SUPPRIME PLUS rien : marquage
--      + journal `encheck_pointages_journal`. Fin de la cascade destructive sur les
--      photos et sur `attendance_corrections` (FK ON DELETE CASCADE, dépôt pointage).
--   4. FIN DU MONKEY-PATCH — orchestrateurs NOMMÉS (`encheck_alertes_scan`,
--      `encheck_pipeline_cloture`). Plus aucun `ALTER FUNCTION … RENAME` : le prochain
--      CREATE OR REPLACE d'une autre IA ne peut plus effacer silencieusement le pipeline.
--   5. FIN DES REGEX SUR DU TEXTE — `encheck_assainir_alertes_horaires` est neutralisée.
--      `encheck_alertes_purger()` re-CALCULE depuis les données, exige `employee_id`
--      ET `enterprise_id`, ne fait JAMAIS de correspondance par nom, refuse p_enterprise
--      NULL, et journalise une copie de l'alerte avant toute suppression.
--   6. GRILLE FANTÔME TUÉE — `encheck_grille_au_jour()` : résolveur UNIQUE, daté
--      (dates d'effet si elles existent, bascule respectée), qui répond « aucune grille »
--      au lieu d'inventer 08:00–17:00 (cause des faux retards du Problème 1).
--      Lecture par jsonb : aucune dépendance à une colonne qui pourrait manquer.
--   7. POINT D'EXTENSION §5 — `encheck_estimer_sortie_comportementale()` : corps
--      VOLONTAIREMENT VIDE, propriété IA DEV 1. Le Niveau 2 est câblé, les plafonds et
--      réglages lui sont passés en paramètres. Ni renommage, ni enveloppe.
--   8. MODE OMBRE — AUCUNE écriture dans `attendances` tant que `mode_estimation` =
--      'ombre' (défaut pour toutes les entreprises). Tout est consigné dans
--      `encheck_clotures_estimees`, et `encheck_clotures_statistiques()` mesure l'écart.
--   9. EXÉCUTION SERVEUR — pg_cron (patron Radar) : verrous advisory, index unique
--      anti-doublon, REVOKE/GRANT. Le navigateur d'un admin ne déclenche plus d'écritures.
--  10. RÉCONCILIATION — un pointage réel reçu après une estimation la marque
--      « remplacée » (jamais supprimée), par trigger + fonction de rattrapage.
--
-- CE QUE CETTE MIGRATION NE FAIT PAS (volontairement)
--   · L'algorithme d'apprentissage (Niveau 2) : livrable IA DEV 1 (§6 ligne 4).
--   · `encheck_punch`, `replace_attendance_day`, `encheck_alertes_controler_interne` :
--     fonctions qui ne vivent qu'en production. Voir ANALYSE-IA2/exporter-fonctions-prod.sql :
--     elles doivent être versées dans `supabase/migrations/` AVANT toute couche nouvelle (§4.4).
--
-- LIRE AVANT DE RELANCER : idempotent (IF NOT EXISTS / CREATE OR REPLACE / DROP POLICY
-- IF EXISTS). BEGIN…COMMIT : en cas d'erreur, rien n'est à moitié appliqué, on corrige
-- et on relance le fichier entier.
-- =============================================================================

BEGIN;

-- ═══════════════════════════════════════════════════════════════════════════
-- 1. COLONNES DE TRAÇABILITÉ (additif, nullables — rien ne casse côté pointage)
-- ═══════════════════════════════════════════════════════════════════════════
ALTER TABLE public.attendances ADD COLUMN IF NOT EXISTS origine text;
ALTER TABLE public.attendances ADD COLUMN IF NOT EXISTS decision_raison text;
ALTER TABLE public.attendances ADD COLUMN IF NOT EXISTS anomalie text;
ALTER TABLE public.attendances ADD COLUMN IF NOT EXISTS modifie_par_employe boolean NOT NULL DEFAULT false;
ALTER TABLE public.attendances ADD COLUMN IF NOT EXISTS modifie_le timestamptz;

ALTER TABLE public.attendances ADD COLUMN IF NOT EXISTS estimation_source_id uuid;
ALTER TABLE public.attendances ADD COLUMN IF NOT EXISTS estimation_niveau smallint;
ALTER TABLE public.attendances ADD COLUMN IF NOT EXISTS estimation_confiance text;
ALTER TABLE public.attendances ADD COLUMN IF NOT EXISTS estimation_detail jsonb NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE public.attendances ADD COLUMN IF NOT EXISTS estimation_validee_le timestamptz;
ALTER TABLE public.attendances ADD COLUMN IF NOT EXISTS estimation_validee_par uuid;
ALTER TABLE public.attendances ADD COLUMN IF NOT EXISTS estimation_remplacee_le timestamptz;

COMMENT ON COLUMN public.attendances.estimation_source_id IS
  'Sortie ESTIMEE (jamais badgée) : id du pointage d''entrée ayant déclenché l''estimation.';
COMMENT ON COLUMN public.attendances.estimation_validee_le IS
  'Validation humaine. NULL = journée « présumée » : exclue de la paie et des notifications sortantes (arbitrage §4.1).';
COMMENT ON COLUMN public.attendances.estimation_remplacee_le IS
  'Une donnée réelle est arrivée : l''estimation est périmée mais CONSERVÉE (audit + mesure d''écart).';

-- Anti-doublon RACE-PROOF : une seule estimation ouverte par entrée oubliée.
-- (Le 15/10 insérait sans contrainte : deux onglets ouverts = deux sorties inventées.)
CREATE UNIQUE INDEX IF NOT EXISTS attendances_estimation_unique
  ON public.attendances (estimation_source_id)
  WHERE estimation_source_id IS NOT NULL AND estimation_remplacee_le IS NULL;

CREATE INDEX IF NOT EXISTS attendances_estimations_a_valider
  ON public.attendances (enterprise_id, check_time DESC)
  WHERE is_auto_closed = true AND estimation_validee_le IS NULL AND estimation_remplacee_le IS NULL;

-- ═══════════════════════════════════════════════════════════════════════════
-- 2. RÉGLAGES ET SEUILS — source unique
-- ═══════════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.encheck_reglages_pointage (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  enterprise_id uuid REFERENCES public.enterprises(id) ON DELETE CASCADE,   -- NULL = global
  cle           text NOT NULL,
  valeur        jsonb NOT NULL,
  commentaire   text,
  maj_le        timestamptz NOT NULL DEFAULT now(),
  maj_par       uuid
);

CREATE UNIQUE INDEX IF NOT EXISTS encheck_reglages_pointage_global_key
  ON public.encheck_reglages_pointage (cle) WHERE enterprise_id IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS encheck_reglages_pointage_entreprise_key
  ON public.encheck_reglages_pointage (enterprise_id, cle) WHERE enterprise_id IS NOT NULL;

INSERT INTO public.encheck_reglages_pointage (cle, valeur, commentaire) VALUES
  ('oubli_sortie_heures',                '12',    'Âge d''une session sans sortie à partir duquel l''oubli est avéré (aligné sur la pointeuse, qui signalait déjà 12 h).'),
  ('plafond_invention_heures',           '12',    '§4.3 — durée maximale inventée. Avant : 14 h, soit une journée de 14 h payée sans preuve.'),
  ('duree_minimale_session_minutes',     '30',    'En dessous, estimer une sortie n''a pas de sens : on ne clôture pas.'),
  ('marge_apres_sortie_estimee_minutes', '30',    '§4.3 — jamais plus de 30 min après la sortie médiane du cluster.'),
  ('appariement_heures',                 '16',    'Tolérance d''appariement entrée<->sortie (gardes longues). Ce N''EST PAS un seuil d''oubli.'),
  ('seuil_rebond_secondes',              '60',    'Anti-rebond QR : un OUT à moins de 60 s de l''IN est une double lecture.'),
  ('rebond_fenetre_jours',               '7',     'Fenêtre de balayage des rebonds.'),
  ('cluster_fenetre_minutes',            '90',    '§5 — demi-fenêtre CIRCULAIRE autour de l''heure d''arrivée (90, pas 120 : évite la fusion de shifts qui se recouvrent).'),
  ('cluster_fenetre_jours',              '28',    '§5 — 28 jours, pas 60 : une médiane à 60 jours traverse les changements d''organisation et ne converge jamais.'),
  ('cluster_demi_vie_jours',             '14',    '§5 — décroissance exponentielle de l''antériorité.'),
  ('cluster_nb_min',                     '5',     '§4.3 — moins de 5 exemples : pas d''estimation.'),
  ('cluster_iqr_max_minutes',            '45',    '§4.3 — dispersion > 45 min : pas d''estimation.'),
  ('rupture_regime_jours',               '5',     '§5 — les N derniers jours divergent → pas d''estimation, file « à valider ».'),
  ('rupture_regime_minutes',             '90',    'Seuil de divergence des jours récents.'),
  ('collegues_nb_employes_min',          '5',     '§5 — repli « collègues » : 5 employés distincts minimum, même équipe/poste + même contrat.'),
  ('collegues_ecart_max_minutes',        '30',    '§5 — écart toléré sur la médiane collective.'),
  ('nudge_apres_minutes',                '20',    '§5 — rappel PUSH à sortie estimée + 20 min. Canal push uniquement (§0 : pas de SMS, pas de service payant).'),
  ('delai_contestation_heures',          '48',    '§5 — fenêtre de contestation employé.'),
  ('mode_estimation',                    '"ombre"', '§5 — « ombre » (défaut) | « actif » | « desactive ». Ouverture entreprise par entreprise, statistiques lues.'),
  ('alertes_jours_recyclage',            '15',    'Fenêtre dans laquelle le pipeline peut encore invalider une alerte contredite par les données.')
ON CONFLICT (cle) WHERE enterprise_id IS NULL DO NOTHING;

CREATE OR REPLACE FUNCTION public.encheck_seuil(p_enterprise uuid, p_cle text, p_defaut numeric)
RETURNS numeric
LANGUAGE sql STABLE
SET search_path = public, pg_temp
AS $$
  SELECT COALESCE(
    (SELECT (r.valeur #>> '{}')::numeric
       FROM public.encheck_reglages_pointage r
      WHERE r.cle = p_cle AND r.enterprise_id = p_enterprise),
    (SELECT (r.valeur #>> '{}')::numeric
       FROM public.encheck_reglages_pointage r
      WHERE r.cle = p_cle AND r.enterprise_id IS NULL),
    p_defaut);
$$;

CREATE OR REPLACE FUNCTION public.encheck_reglage_texte(p_enterprise uuid, p_cle text, p_defaut text)
RETURNS text
LANGUAGE sql STABLE
SET search_path = public, pg_temp
AS $$
  SELECT COALESCE(
    (SELECT (r.valeur #>> '{}')::text
       FROM public.encheck_reglages_pointage r
      WHERE r.cle = p_cle AND r.enterprise_id = p_enterprise),
    (SELECT (r.valeur #>> '{}')::text
       FROM public.encheck_reglages_pointage r
      WHERE r.cle = p_cle AND r.enterprise_id IS NULL),
    p_defaut);
$$;

CREATE OR REPLACE FUNCTION public.encheck_mode_estimation(p_enterprise uuid)
RETURNS text
LANGUAGE sql STABLE
SET search_path = public, pg_temp
AS $$
  SELECT CASE WHEN v IN ('actif','ombre','desactive') THEN v ELSE 'ombre' END
    FROM (SELECT public.encheck_reglage_texte(p_enterprise, 'mode_estimation', 'ombre') AS v) s;
$$;

-- « minutes depuis minuit » d'un time, et durée circulaire (gère la nuit sans BETWEEN).
CREATE OR REPLACE FUNCTION public.encheck_minutes_time(p_t time)
RETURNS integer
LANGUAGE sql IMMUTABLE PARALLEL SAFE
AS $$ SELECT CASE WHEN p_t IS NULL THEN NULL
                  ELSE (EXTRACT(HOUR FROM p_t) * 60 + EXTRACT(MINUTE FROM p_t))::int END; $$;

CREATE OR REPLACE FUNCTION public.encheck_duree_circulaire(p_debut text, p_fin text)
RETURNS integer
LANGUAGE sql IMMUTABLE PARALLEL SAFE
AS $$
  -- 22:00 -> 06:00 = 480 min ; 08:00 -> 17:00 = 540 min. Jamais 0 ligne, jamais négatif.
  SELECT CASE
    WHEN p_debut IS NULL OR p_fin IS NULL THEN NULL
    ELSE (( ((split_part(p_fin,':',1)::int*60 + split_part(p_fin,':',2)::int)
           - (split_part(p_debut,':',1)::int*60 + split_part(p_debut,':',2)::int)) % 1440) + 1440) % 1440
  END;
$$;

CREATE OR REPLACE FUNCTION public.encheck_minutes_de_bascule(p_valeur text)
RETURNS integer
LANGUAGE sql IMMUTABLE PARALLEL SAFE
AS $$
  SELECT CASE
    WHEN p_valeur IS NULL OR p_valeur = '' THEN 0
    WHEN p_valeur ~ '^[0-9]{1,2}:[0-9]{2}'
      THEN GREATEST(0, LEAST(1439, split_part(p_valeur,':',1)::int * 60 + split_part(p_valeur,':',2)::int))
    WHEN p_valeur ~ '^[0-9]+$' THEN GREATEST(0, LEAST(1439, p_valeur::int))
    ELSE 0
  END;
$$;

CREATE OR REPLACE FUNCTION public.encheck_auteur_actuel()
RETURNS uuid
LANGUAGE plpgsql STABLE
SET search_path = public, pg_temp
AS $$
DECLARE v_sub uuid;
BEGIN
  BEGIN
    SELECT (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub')::uuid
      INTO v_sub;
  EXCEPTION WHEN OTHERS THEN
    v_sub := NULL;
  END;
  RETURN v_sub;
END;
$$;

CREATE OR REPLACE FUNCTION public.encheck_est_admin_de(p_enterprise uuid)
RETURNS boolean
LANGUAGE plpgsql STABLE
SET search_path = public, pg_temp
AS $$
DECLARE v_ok boolean;
BEGIN
  IF p_enterprise IS NULL THEN
    RETURN false;
  END IF;
  BEGIN
    SELECT EXISTS (
      SELECT 1
        FROM public.admins a
       WHERE lower(a.email) = lower(auth.jwt() ->> 'email')
         AND a.is_active = true
         AND (a.role = 'super_admin'
              OR a.enterprise_id = p_enterprise
              OR EXISTS (SELECT 1 FROM public.admin_entreprises ae
                          WHERE ae.admin_id = a.id
                            AND ae.enterprise_id = p_enterprise
                            AND ae.is_active = true))
    ) INTO v_ok;
  EXCEPTION WHEN OTHERS THEN
    v_ok := false;
  END;
  RETURN COALESCE(v_ok, false);
END;
$$;

CREATE OR REPLACE FUNCTION public.encheck_colonne_existe(p_table text, p_colonne text)
RETURNS boolean
LANGUAGE sql STABLE
AS $$
  SELECT EXISTS (SELECT 1 FROM information_schema.columns
                  WHERE table_schema = 'public' AND table_name = p_table AND column_name = p_colonne);
$$;

CREATE OR REPLACE FUNCTION public.encheck_fuseau(p_enterprise uuid)
RETURNS text
LANGUAGE plpgsql STABLE
SET search_path = public, pg_temp
AS $$
DECLARE v_tz text;
BEGIN
  BEGIN
    EXECUTE 'SELECT NULLIF(e.timezone, '''') FROM public.enterprises e WHERE e.id = $1'
      INTO v_tz USING p_enterprise;
  EXCEPTION WHEN OTHERS THEN
    v_tz := NULL;
  END;
  RETURN COALESCE(NULLIF(v_tz, ''), 'Africa/Porto-Novo');
END;
$$;

-- ═══════════════════════════════════════════════════════════════════════════
-- 3. JOURNAUX APPEND-ONLY — plus aucune écriture sans trace
-- ═══════════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.encheck_pointages_journal (
  id             bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  enterprise_id  uuid,
  employee_id    uuid,
  attendance_id  uuid,
  action         text NOT NULL,
  motif          text NOT NULL,
  snapshot       jsonb NOT NULL DEFAULT '{}'::jsonb,
  pipeline       text,
  horodatage     timestamptz NOT NULL DEFAULT now(),
  auteur         uuid
);

CREATE TABLE IF NOT EXISTS public.encheck_pipeline_runs (
  id             bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  pipeline       text NOT NULL,
  enterprise_id  uuid,
  mode           text,
  demarre_le     timestamptz NOT NULL DEFAULT now(),
  fini_le        timestamptz,
  ecritures      integer NOT NULL DEFAULT 0,
  consignations  integer NOT NULL DEFAULT 0,
  ignores        integer NOT NULL DEFAULT 0,
  avertissement  text,
  detail         jsonb NOT NULL DEFAULT '{}'::jsonb
);

-- ═══════════════════════════════════════════════════════════════════════════
-- 4. RÉSOLVEUR DE GRILLE UNIQUE, DATÉ, SANS GRILLE FANTÔME
-- ═══════════════════════════════════════════════════════════════════════════
--  Tout est lu depuis du jsonb (`to_jsonb(record)`) : si une colonne optionnelle
--  (dates d'effet, bascule, tolérance individuelle) n'existe pas dans cet
--  environnement, la clé est simplement absente — la fonction ne casse pas, et le
--  pipeline descend d'un étage au lieu de tomber.

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

  BEGIN
    EXECUTE '
      SELECT to_jsonb(es.*)
        FROM public.employee_schedules es
       WHERE es.employee_id = $1
         AND COALESCE(es.is_active, true) = true' || v_clause || '
       ORDER BY ' ||
         CASE WHEN public.encheck_colonne_existe('employee_schedules','valide_du')
              THEN 'COALESCE(es.valide_du, DATE ''1900-01-01'') DESC NULLS LAST, ' ELSE '' END ||
         'COALESCE(es.updated_at, ''infinity''::timestamptz) DESC NULLS LAST,
          COALESCE(es.created_at, ''infinity''::timestamptz) DESC NULLS LAST
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
    v_days   := v_es->'custom_work_days';
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
    BEGIN
      EXECUTE '
        SELECT to_jsonb(ws.*)
          FROM public.work_schedules ws
         WHERE ws.enterprise_id = $1
           AND COALESCE(ws.is_active, true) = true
           AND ws.start_time IS NOT NULL AND ws.end_time IS NOT NULL' || v_clause || '
         ORDER BY COALESCE(ws.is_default, false) DESC,
                  COALESCE(ws.created_at, ''infinity''::timestamptz) DESC
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
      v_tol    := COALESCE((v_def->>'late_tolerance_minutes')::int, 15);
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

-- Rétro-compat : l'ancienne signature reste utilisable, mais devient une VITRE sur le
-- nouveau résolveur. Une seule logique de résolution dans tout le projet.
DROP FUNCTION IF EXISTS public.encheck_resoudre_grille_employe(uuid, uuid, date);
CREATE OR REPLACE FUNCTION public.encheck_resoudre_grille_employe(
  p_employee_id uuid,
  p_enterprise_id uuid,
  p_date date DEFAULT CURRENT_DATE
)
RETURNS TABLE (
  grille_nom text, start_time time, end_time time, has_break boolean,
  break_start time, break_end time, work_days integer[], tolerance_minutes integer,
  pause_minutes integer, service_attendu_minutes integer, est_jour_ouvre boolean,
  source text, explicite boolean, bascule_minutes integer, trouvee boolean
)
LANGUAGE sql STABLE
SET search_path = public, pg_temp
AS $$
  SELECT NULLIF(g->>'nom','')::text,
         NULLIF(g->>'start_time','')::time,
         NULLIF(g->>'end_time','')::time,
         COALESCE((g->>'pause_minutes')::int, 0) > 0,
         NULL::time, NULL::time,
         --  `work_days` arrive en JSONB (`[1, 2, 3, 4, 5]`) : le caster en `text
         --  ::integer[]` échoue (« malformed array literal »), et la vitre aurait
         --  planté au premier appel du mobile. On convertit élément par élément.
         --  (Trouvé en exécutant la migration sur un Postgres réel.)
         CASE WHEN jsonb_typeof(g->'work_days') = 'array'
              THEN ARRAY(SELECT (jsonb_array_elements(g->'work_days'))::integer)
              ELSE NULL::integer[] END,
         COALESCE((g->>'tolerance_minutes')::int, 15),
         COALESCE((g->>'pause_minutes')::int, 0),
         COALESCE((g->>'service_attendu_minutes')::int, 0),
         COALESCE((g->>'est_jour_ouvre')::boolean, false),
         COALESCE(g->>'source','aucune'),
         COALESCE((g->>'explicite')::boolean, false),
         COALESCE((g->>'bascule_minutes')::int, 0),
         COALESCE((g->>'trouvee')::boolean, false)
    FROM (SELECT public.encheck_grille_au_jour(p_employee_id, p_enterprise_id, p_date) AS g) s;
$$;

-- Fin de service du jour de travail, en instant UTC. NULL si cette fin est déjà
-- passée par rapport à l'entrée : l'étage est écarté, on descend au suivant
-- (avant : on gardait 17:00 pour une entrée de 20:00, ce qui inventait 3 h 59).
CREATE OR REPLACE FUNCTION public.encheck_heure_de_fin_prevue(
  p_entree timestamptz, p_grille jsonb, p_tz text
)
RETURNS timestamptz
LANGUAGE plpgsql IMMUTABLE
SET search_path = public, pg_temp
AS $$
DECLARE
  v_basc  integer;
  v_local timestamp;
  v_in_loc timestamp;
BEGIN
  IF p_grille IS NULL OR p_grille->>'end_time' IS NULL THEN
    RETURN NULL;
  END IF;
  v_basc   := COALESCE((p_grille->>'bascule_minutes')::int, 0);
  v_in_loc := (p_entree AT TIME ZONE p_tz) - make_interval(mins => v_basc);
  v_local  := (v_in_loc)::date + (p_grille->>'end_time')::time
               + CASE WHEN COALESCE((p_grille->>'end_minutes')::int, 0)
                         < COALESCE((p_grille->>'start_minutes')::int, 0)
                      THEN interval '1 day' ELSE interval '0' END;
  IF v_local <= (p_entree AT TIME ZONE p_tz) THEN
    RETURN NULL;
  END IF;
  RETURN v_local AT TIME ZONE p_tz;
END;
$$;

-- ═══════════════════════════════════════════════════════════════════════════
-- 5. REBONDS QR — MARQUER, NE PLUS JAMAIS SUPPRIMER
-- ═══════════════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.encheck_rebonds_neutraliser(
  p_enterprise uuid DEFAULT NULL,
  p_appliquer  boolean DEFAULT true
)
RETURNS TABLE (employee_id uuid, pointage_id uuid, action text, detail text)
LANGUAGE plpgsql VOLATILE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_rec   record;
  v_seuil integer;
  v_jours integer;
  v_photo boolean;
BEGIN
  v_seuil := COALESCE(public.encheck_seuil(p_enterprise, 'seuil_rebond_secondes', 60), 60)::int;
  v_jours := COALESCE(public.encheck_seuil(p_enterprise, 'rebond_fenetre_jours', 7), 7)::int;

  FOR v_rec IN
    WITH ordonnes AS (
      SELECT a.id, a.employee_id, a.enterprise_id, a.check_type, a.check_time,
             a.anomalie, a.modifie_le,
             -- `anom1` = l'anomalie DÉJÀ posée sur le OUT qui suit. Sans cette
             -- colonne, le contrôle « déjà traité » ne regardait que l'IN : le
             -- rebond marqué restait éligible au passage suivant, et un cron
             -- quotidien re-journalisait le même double scan tous les jours
             -- (trouvé en exécutant la migration sur un Postgres réel).
             LEAD(a.anomalie)      OVER w AS anom1,
             LEAD(a.id)            OVER w AS id1,
             LEAD(a.check_type)    OVER w AS type1,
             LEAD(a.check_time)    OVER w AS t1,
             LEAD(a.modifie_le)    OVER w AS mod1,
             LEAD(a.id, 2)         OVER w AS id2,
             LEAD(a.check_type, 2) OVER w AS type2,
             LEAD(a.check_time, 2) OVER w AS t2,
             LEAD(a.modifie_le, 2) OVER w AS mod2
        FROM public.attendances a
       WHERE (p_enterprise IS NULL OR a.enterprise_id = p_enterprise)
         AND a.check_time >= now() - make_interval(days => GREATEST(1, v_jours))
       WINDOW w AS (PARTITION BY a.employee_id ORDER BY a.check_time ASC)
    )
    SELECT o.employee_id, o.enterprise_id, o.id AS in_id, o.id1 AS out_id, o.id2 AS in2_id,
           o.check_time AS in_time, o.t1 AS out_time, o.t2 AS in2_time
      FROM ordonnes o
     WHERE lower(o.check_type::text) = 'in'
       AND lower(o.type1::text)      = 'out'
       AND lower(o.type2::text)      = 'in'
       AND o.mod1 IS NULL AND o.mod2 IS NULL      -- jamais un pointage corrigé à la main
       AND o.anomalie IS NULL                     -- IN déjà traité : on ne rejoue pas
       AND o.anom1  IS NULL                       -- OUT déjà marqué : idem (idempotence du cron)
       AND extract(epoch FROM (o.t1 - o.check_time)) BETWEEN 0 AND v_seuil
       AND extract(epoch FROM (o.t2 - o.t1))         BETWEEN 0 AND 120
     ORDER BY o.check_time
  LOOP
    employee_id := v_rec.employee_id;
    pointage_id := v_rec.out_id;

    -- Garde-fou preuve : un pointage photographié ne se neutralise pas en silence.
    v_photo := false;
    IF to_regclass('public.pointages_photos') IS NOT NULL THEN
      BEGIN
        EXECUTE 'SELECT EXISTS (SELECT 1 FROM public.pointages_photos
                                 WHERE attendance_id = $1 OR attendance_id = $2)'
          INTO v_photo USING v_rec.out_id, v_rec.in2_id;
      EXCEPTION WHEN OTHERS THEN
        v_photo := true;
      END;
    END IF;

    IF COALESCE(v_photo, false) THEN
      action := 'ignore';
      detail := 'rebond apparent, mais des photos y sont rattachées : non touché';
      RETURN NEXT;
      CONTINUE;
    END IF;

    action := CASE WHEN p_appliquer THEN 'marque' ELSE 'a_marquer' END;
    detail := format('double lecture QR %s -> %s (%s s) : marqué anomalie=rebond_qr, AUCUNE suppression',
                     to_char(v_rec.in_time  AT TIME ZONE public.encheck_fuseau(v_rec.enterprise_id), 'HH24:MI:SS'),
                     to_char(v_rec.out_time AT TIME ZONE public.encheck_fuseau(v_rec.enterprise_id), 'HH24:MI:SS'),
                     round(extract(epoch FROM (v_rec.out_time - v_rec.in_time))::numeric, 0));

    IF p_appliquer THEN
      UPDATE public.attendances t
         SET anomalie        = COALESCE(t.anomalie, 'rebond_qr'),
             decision_raison = 'rebond_qr_neutralise',
             origine         = COALESCE(t.origine, 'auto')
       WHERE t.id IN (v_rec.out_id, v_rec.in2_id);

      INSERT INTO public.encheck_pointages_journal
            (enterprise_id, employee_id, attendance_id, action, motif, snapshot, pipeline, auteur)
      VALUES(v_rec.enterprise_id, v_rec.employee_id, v_rec.out_id, 'rebond_neutralise',
             'double lecture QR neutralisée par marquage (aucune suppression, photos intactes)',
             jsonb_build_object('in_id', v_rec.in_id, 'out_id', v_rec.out_id,
                                'in2_id', v_rec.in2_id, 'in_time', v_rec.in_time,
                                'out_time', v_rec.out_time, 'in2_time', v_rec.in2_time,
                                'seuil_secondes', v_seuil),
             'encheck_rebonds_neutraliser', public.encheck_auteur_actuel());
    END IF;

    RETURN NEXT;
  END LOOP;
END;
$$;

-- Ancien nom, même signature, rendu INOFFENSIF plutôt que supprimé : tout appelant
-- oublié (dont l'orchestrateur posé le 15/10) marque désormais au lieu de détruire.
CREATE OR REPLACE FUNCTION public.encheck_nettoyer_rebonds_qr(p_enterprise uuid DEFAULT NULL)
RETURNS integer
LANGUAGE plpgsql VOLATILE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE v_n integer;
BEGIN
  SELECT count(*) INTO v_n FROM public.encheck_rebonds_neutraliser(p_enterprise, true);
  RETURN COALESCE(v_n, 0);
END;
$$;

-- ═══════════════════════════════════════════════════════════════════════════
-- 6. NIVEAU 2 — LE CONTRAT, PAS L'ALGORITHME (propriété IA DEV 1)
-- ═══════════════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.encheck_estimer_sortie_comportementale(
  p_employee   uuid,
  p_enterprise uuid,
  p_entree     timestamptz,
  p_fenetre_minutes integer,
  p_jours           integer,
  p_demi_vie_jours  integer,
  p_nb_min          integer,
  p_iqr_max_minutes integer,
  p_marge_minutes   integer,
  p_plafond_heures  numeric
)
RETURNS TABLE (
  sortie_estimee timestamptz,
  niveau         text,
  nb_exemples    integer,
  iqr_minutes    integer,
  confiance      text,
  motif_rejet    text,
  detail         jsonb
)
LANGUAGE plpgsql STABLE
SET search_path = public, pg_temp
AS $$
BEGIN
  -- ░░░░░░░ CORPS VOLONTAIREMENT VIDE — à livrer par l'IA DEV 1 (arbitrage §6 ligne 4) ░░░
  --
  -- CAHIER DES CHARGES (arbitrage §5 + trous n°2/3/4 du compte rendu IA DEV 2) :
  --  1. Échantillon d'entraînement :
  --        is_auto_closed = false AND modifie_le IS NULL AND anomalie IS NULL
  --     JAMAIS une estimation antérieure : sinon le modèle apprend ses propres
  --     inventions et toute l'entreprise converge vers « entrée + 8 h » en 3 semaines.
  --  2. Cluster = distance CIRCULAIRE sur les minutes du jour, pas un BETWEEN :
  --        d = LEAST(abs(a-b), 1440 - abs(a-b))  avec a = arrivée de l'historique,
  --                                                    b = arrivée du jour
  --     `d <= p_fenetre_minutes`. `BETWEEN '21:30' AND '01:30'` renvoie 0 ligne :
  --     c'est exactement ce qui efface tous les travailleurs de nuit.
  --  3. Cible = MÉDIANE DES HEURES DE SORTIE du cluster (la durée n'est qu'un contrôle
  --     de cohérence). Un commerce ferme à heure fixe : « entrée + durée habituelle »
  --     invente autant d'heures que l'employé est en retard (trou n°2).
  --  4. Rejet explicite (`motif_rejet`) et pas de devinette quand :
  --        n < p_nb_min, ou IQR > p_iqr_max_minutes, ou rupture de régime
  --        (les `rupture_regime_jours` derniers jours divergent de > rupture_regime_minutes),
  --        ou sortie hors de [entree + duree_minimale, entree + p_plafond_heures],
  --        ou sortie hors de [median ± p_marge_minutes].
  --  5. Repli « collègues » : MÊME équipe/poste ET même type de contrat,
  --     >= collegues_nb_employes_min employés distincts, écart <= 30 min,
  --     p_enterprise TOUJOURS dans le WHERE. Aucune agrégation inter-entreprises :
  --     croiser les données de deux clients = fuite + RGPD, même « anonymisé ».
  --  6. Décroissance (p_demi_vie_jours) sur p_jours jours, pas 60 jours plats.
  --  7. Ne rien écrire dans `attendances` : le pipeline consigne et mesure.
  RETURN;
END;
$$;

-- ═══════════════════════════════════════════════════════════════════════════
-- 7. MODE OMBRE — consignation + instrument de mesure
-- ═══════════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.encheck_clotures_estimees (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  enterprise_id    uuid NOT NULL REFERENCES public.enterprises(id) ON DELETE CASCADE,
  employee_id      uuid NOT NULL,
  attendance_in_id uuid NOT NULL,
  jour_travail     date NOT NULL,
  entree           timestamptz NOT NULL,
  sortie_estimee   timestamptz,
  sortie_reelle    timestamptz,
  ecart_minutes    integer,
  niveau           text NOT NULL,
  nb_exemples      integer,
  iqr_minutes      integer,
  confiance        text,
  motif_rejet      text,
  applique         boolean NOT NULL DEFAULT false,
  estimation_id    uuid,
  detail           jsonb NOT NULL DEFAULT '{}'::jsonb,
  cree_le          timestamptz NOT NULL DEFAULT now(),
  maj_le           timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT encheck_clotures_estimees_in_unique UNIQUE (attendance_in_id)
);

CREATE INDEX IF NOT EXISTS encheck_clotures_estimees_suivi
  ON public.encheck_clotures_estimees (enterprise_id, jour_travail DESC);

-- ═══════════════════════════════════════════════════════════════════════════
-- 8. LA CLÔTURE — CASCADE 5 NIVEAUX, PLAFONDS, IDEMPOTENTE, SERVEUR
-- ═══════════════════════════════════════════════════════════════════════════
--  Lecture de la cascade (à contredire sinon par l'IA ARBITRE) :
--    Niveau 1  horaire PERSONNEL (use_custom_hours) OU grille explicitement LIÉE à
--              l'employé : dans les deux cas une décision écrite pour CET employé.
--    Niveau 2  ★ apprentissage comportemental ★ (hook §6 ; vide tant que DEV 1 n'a pas livré)
--    Niveau 3  grille par DÉFAUT de l'entreprise  ← descendue ICI, pas au niveau 1 :
--              c'est le trou n°1 (sinon l'apprentissage ne s'exécute jamais, et Junior
--              entré à 06:32 serait clôturé à 17:00 = 2 h 30 payées pour rien, SANS
--              alerte, puisque 17:00 est pile la fin de la grille).
--    Niveau 4  heure auto-close configurée (23:59 ne devient jamais une DURÉE)
--    Niveau 5  entrée + 8 h
--  Règle d'or : JAMAIS une journée en cours (`jour_travail >= aujourd'hui`) — ce qui
--  remplace le « attends 14 h » arbitraire qui laissait une session ouverte à l'écran.

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
       -- `d.entree` et non `d.check_time` : le sous-select a RENOMMÉ la colonne
       -- (`a.check_time AS entree`), la référencer par son ancien nom fait échouer
       -- toute la fonction à la première exécution du cron — et personne ne s'en
       -- aperçoit avant la nuit suivante. (Attrapé à l'exécution réelle.)
       AND d.entree <= p_now - make_interval(hours => GREATEST(1, v_oubli)::int)
       AND d.anomalie IS NULL          -- une entrée signalée suspecte par la pointeuse ne se clôture pas
       AND NOT EXISTS (                -- déjà estimée : idempotence + anti-course
             SELECT 1 FROM public.attendances x
              WHERE x.estimation_source_id = d.in_id
                AND x.estimation_remplacee_le IS NULL)
     ORDER BY d.entree
  LOOP
    employee_id   := v_in.employee_id;
    entree        := v_in.entree;
    cible         := NULL;
    niveau        := NULL;
    motif_rejet   := NULL;
    estimation_id := NULL;
    applique      := false;
    v_cible := NULL; v_niveau := NULL; v_rejet := NULL; v_det := '{}'::jsonb;

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
    IF v_cible IS NULL THEN
      BEGIN
        SELECT e.sortie_estimee, e.niveau, e.nb_exemples, e.iqr_minutes, e.confiance,
               e.motif_rejet, e.detail
          INTO v2_cible, v2_niv, v2_n, v2_iqr, v2_conf, v2_rejet, v2_det
          FROM public.encheck_estimer_sortie_comportementale(
                 v_in.employee_id, v_in.enterprise_id, v_in.entree,
                 v_seuil, v_jours, v_dv, v_nmin, v_iqr, v_marge::int, v_plafond) e;

        IF v2_cible IS NOT NULL THEN
          v_cible  := v2_cible;
          v_niveau := COALESCE('2-apprentissage-' || v2_niv, '2-apprentissage');
          v_det    := v_det || jsonb_build_object('nb_exemples', v2_n, 'iqr_minutes', v2_iqr,
                                                   'confiance', v2_conf, 'source_estimation', v2_det);
        ELSIF v2_rejet IS NOT NULL THEN
          v_niveau := '2-apprentissage';
          v_det    := v_det || jsonb_build_object('rejet_niveau2', v2_rejet, 'detail_niveau2', v2_det);
        END IF;
      EXCEPTION WHEN OTHERS THEN
        -- Une estimation qui plante ne doit jamais bloquer la clôture de sécurité :
        -- on descend d'étage et la raison est consignée (pas avalée).
        v_det := v_det || jsonb_build_object('erreur_niveau2', SQLERRM);
      END;
    END IF;

    -- ── Niveau 3 : grille par défaut de l'entreprise
    IF v_cible IS NULL AND COALESCE(v_g->>'source','aucune') = 'defaut' THEN
      v_cible  := public.encheck_heure_de_fin_prevue(v_in.entree, v_g, v_tz);
      v_niveau := '3-grille-entreprise';
      v_det    := v_det || jsonb_build_object('grille', v_g);
    END IF;

    -- ── Niveau 4 : heure auto-close de l'entreprise (config, jamais une durée)
    IF v_cible IS NULL THEN
      --  Lecture en jsonb, comme partout ailleurs dans ce fichier : la colonne
      --  `auto_close_grace_minutes` n'existe que depuis les migrations récentes et
      --  peut manquer sur une base plus vieille. Un `SELECT e.auto_close_grace_minutes`
      --  statique ferait échouer TOUTE la clôture pour une colonne absente ; là,
      --  colonne absente = grâce nulle, et si `auto_close_time` manque aussi,
      --  l'étage se débranche tout seul et on descend au Niveau 5.
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

-- Signature laissée pour ne casser aucun appelant : elle ne fabrique plus rien,
-- elle consigne (le mode par défaut est « ombre » pour toutes les entreprises).
CREATE OR REPLACE FUNCTION public.encheck_cloturer_sorties_oubliees(p_enterprise uuid DEFAULT NULL)
RETURNS integer
LANGUAGE plpgsql VOLATILE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE v_n integer;
BEGIN
  SELECT count(*) INTO v_n
    FROM public.encheck_cloturer_pivotable(p_enterprise, now(), NULL)
   WHERE applique;
  RETURN COALESCE(v_n, 0);
END;
$$;

-- ═══════════════════════════════════════════════════════════════════════════
-- 9. RÉCONCILIATION — la donnée réelle qui arrive en retard gagne
-- ═══════════════════════════════════════════════════════════════════════════
--  File hors-ligne (Hive `pointages_pending`, `file-dattente.jsonl` du boîtier) :
--  une vraie sortie peut arriver 3 à 20 h plus tard. Avant, elle était ignorée par
--  l'appariement (plus d'entrée libre) et la journée restait payée sur l'estimation.

CREATE OR REPLACE FUNCTION public.encheck_estimation_remplacer(
  p_estimation_id uuid, p_remplacee_par uuid, p_motif text
)
RETURNS boolean
LANGUAGE plpgsql VOLATILE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE v_ok boolean := false;
BEGIN
  UPDATE public.attendances e
     SET estimation_remplacee_le = now(),
         anomalie                = 'sortie_presumee_remplacee'
   WHERE e.id = p_estimation_id
     AND COALESCE(e.is_auto_closed, false) = true
     AND e.estimation_remplacee_le IS NULL
  RETURNING true INTO v_ok;

  IF NOT COALESCE(v_ok, false) THEN
    RETURN false;
  END IF;

  INSERT INTO public.encheck_pointages_journal
        (enterprise_id, employee_id, attendance_id, action, motif, snapshot, pipeline, auteur)
  SELECT e.enterprise_id, e.employee_id, e.id, 'estimation_remplacee', p_motif,
         jsonb_build_object('estimation', to_jsonb(e), 'remplacee_par', p_remplacee_par),
         'encheck_estimation_remplacer', public.encheck_auteur_actuel()
    FROM public.attendances e WHERE e.id = p_estimation_id;

  UPDATE public.encheck_clotures_estimees c
     SET applique = false,
         maj_le   = now(),
         detail   = c.detail || jsonb_build_object('remplacee_le', now(),
                                                   'remplacee_par', p_remplacee_par,
                                                   'motif', p_motif)
   WHERE c.estimation_id = p_estimation_id;

  RETURN true;
END;
$$;

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
           AND r.check_time <= i.check_time + make_interval(
                 hours => COALESCE(public.encheck_seuil(e.enterprise_id,'appariement_heures',16),16)::int)
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

CREATE OR REPLACE FUNCTION public.encheck_attendances_apres_insert()
RETURNS trigger
LANGUAGE plpgsql VOLATILE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_est  uuid;
  v_hrs  integer;
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

  v_hrs := COALESCE(public.encheck_seuil(NEW.enterprise_id, 'appariement_heures', 16), 16)::int;

  SELECT e.id INTO v_est
    FROM public.attendances e
    JOIN public.attendances i ON i.id = e.estimation_source_id
   WHERE e.employee_id = NEW.employee_id
     AND COALESCE(e.is_auto_closed, false) = true
     AND e.estimation_remplacee_le IS NULL
     AND NEW.check_time >  i.check_time
     AND NEW.check_time <= i.check_time + make_interval(hours => v_hrs)
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

DROP TRIGGER IF EXISTS trg_attendances_reconcilier_estimation ON public.attendances;
CREATE TRIGGER trg_attendances_reconcilier_estimation
  AFTER INSERT ON public.attendances
  FOR EACH ROW
  EXECUTE FUNCTION public.encheck_attendances_apres_insert();

-- ═══════════════════════════════════════════════════════════════════════════
-- 10. VALIDATION / REJET EN 1 CLIC (§5 « droit de regard »)
-- ═══════════════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.encheck_estimation_statuer(
  p_ids uuid[], p_decision text, p_motif text DEFAULT NULL
)
RETURNS integer
LANGUAGE plpgsql VOLATILE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE v_id uuid; v_ent uuid; v_n integer := 0;
BEGIN
  IF p_ids IS NULL OR array_length(p_ids, 1) IS NULL THEN
    RAISE EXCEPTION 'aucun pointage sélectionné';
  END IF;
  IF p_decision NOT IN ('valider','rejeter') THEN
    RAISE EXCEPTION 'décision inconnue : %', p_decision;
  END IF;

  FOREACH v_id IN ARRAY p_ids LOOP
    SELECT enterprise_id INTO v_ent FROM public.attendances WHERE id = v_id;
    IF v_ent IS NULL THEN
      CONTINUE;
    END IF;
    -- Autorité vérifiée côté serveur (jamais une revendication du navigateur).
    IF NOT public.encheck_est_admin_de(v_ent) THEN
      RAISE EXCEPTION 'non autorisé pour cette entreprise';
    END IF;

    IF p_decision = 'valider' THEN
      UPDATE public.attendances e
         SET estimation_validee_le  = now(),
             estimation_validee_par = public.encheck_auteur_actuel(),
             anomalie               = NULL,
             estimation_detail      = e.estimation_detail
                                  || jsonb_build_object('motif_validation', p_motif)
       WHERE e.id = v_id
         AND COALESCE(e.is_auto_closed, false) = true
         AND e.estimation_validee_le IS NULL
         AND e.estimation_remplacee_le IS NULL;
    ELSE
      UPDATE public.attendances e
         SET estimation_remplacee_le = now(),
             anomalie                = 'sortie_presumee_rejetee',
             estimation_detail       = e.estimation_detail
                                    || jsonb_build_object('motif_rejet', p_motif)
       WHERE e.id = v_id
         AND COALESCE(e.is_auto_closed, false) = true
         AND e.estimation_remplacee_le IS NULL;
    END IF;

    IF FOUND THEN
      INSERT INTO public.encheck_pointages_journal
            (enterprise_id, employee_id, attendance_id, action, motif, snapshot, pipeline, auteur)
      SELECT e.enterprise_id, e.employee_id, e.id,
             CASE WHEN p_decision = 'valider' THEN 'estimation_validee' ELSE 'estimation_rejetee' END,
             COALESCE(p_motif, p_decision), to_jsonb(e),
             'encheck_estimation_statuer', public.encheck_auteur_actuel()
        FROM public.attendances e WHERE e.id = v_id;
      v_n := v_n + 1;
    END IF;
  END LOOP;

  RETURN v_n;
END;
$$;

-- ═══════════════════════════════════════════════════════════════════════════
-- 11. ALERTES — RE-CALCUL, plus de regex sur le texte ni de correspondance par nom
-- ═══════════════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.encheck_table_alertes()
RETURNS TABLE (table_alertes text, col_date text, col_type text)
LANGUAGE sql STABLE
SET search_path = public, pg_temp
AS $$
  SELECT t.tbl,
         (SELECT c.column_name FROM information_schema.columns c
           WHERE c.table_schema='public' AND c.table_name=t.tbl
             AND c.column_name IN ('date_alerte','jour','date','for_date','detected_at','created_at','cree_le')
           ORDER BY array_position(ARRAY['date_alerte','jour','date','for_date','detected_at','created_at','cree_le'],
                                  c.column_name)
           LIMIT 1),
         (SELECT c.column_name FROM information_schema.columns c
           WHERE c.table_schema='public' AND c.table_name=t.tbl
             AND c.column_name IN ('type','code','categorie','category')
           ORDER BY array_position(ARRAY['type','code','categorie','category'], c.column_name)
           LIMIT 1)
    FROM (SELECT cand.tbl
            FROM (VALUES ('encheck_alertes'), ('alertes')) AS cand(tbl)
           WHERE EXISTS (SELECT 1 FROM information_schema.columns x
                          WHERE x.table_schema='public' AND x.table_name=cand.tbl AND x.column_name='titre')
             AND EXISTS (SELECT 1 FROM information_schema.columns y
                          WHERE y.table_schema='public' AND y.table_name=cand.tbl AND y.column_name='employee_id')
             AND EXISTS (SELECT 1 FROM information_schema.columns z
                          WHERE z.table_schema='public' AND z.table_name=cand.tbl AND z.column_name='enterprise_id')
           LIMIT 1) t;
$$;

CREATE OR REPLACE FUNCTION public.encheck_journee_recalculee(
  p_employee uuid, p_enterprise uuid, p_jour date
)
RETURNS jsonb
LANGUAGE plpgsql STABLE
SET search_path = public, pg_temp
AS $$
DECLARE
  v_g   jsonb;
  v_basc integer;
  v_tz  text;
  v_in  timestamptz;
  v_out timestamptz;
  v_res jsonb;
BEGIN
  v_g    := public.encheck_grille_au_jour(p_employee, p_enterprise, p_jour);
  v_basc := COALESCE((v_g->>'bascule_minutes')::int, 0);
  v_tz   := public.encheck_fuseau(p_enterprise);

  -- Seuls les pointages FAITS comptent : une estimation non validée ne prouve rien.
  SELECT min(a.check_time), max(a.check_time) INTO v_in, v_out
    FROM public.attendances a
   WHERE a.employee_id = p_employee
     AND a.check_time >= (p_jour::timestamp + make_interval(mins => v_basc)) AT TIME ZONE v_tz
     AND a.check_time <  ((p_jour + 1)::timestamp + make_interval(mins => v_basc)) AT TIME ZONE v_tz
     AND (COALESCE(a.is_auto_closed, false) = false OR a.estimation_validee_le IS NOT NULL)
     AND COALESCE(a.anomalie,'') <> 'rebond_qr';

  IF v_in IS NULL THEN
    RETURN jsonb_build_object('trouvee', false, 'grille', v_g);
  END IF;

  v_res := jsonb_build_object(
    'trouvee', true,
    'grille', v_g,
    'premiere_entree', v_in,
    'derniere_sortie', v_out,
    'presence_minutes', CASE WHEN v_out IS NOT NULL
          THEN GREATEST(0, round(extract(epoch FROM (v_out - v_in)) / 60))::int ELSE NULL END
  );

  IF v_g->>'start_time' IS NOT NULL THEN
    v_res := v_res || jsonb_build_object('retard_minutes',
      GREATEST(0, (EXTRACT(HOUR FROM (v_in AT TIME ZONE v_tz)) * 60
                 + EXTRACT(MINUTE FROM (v_in AT TIME ZONE v_tz)))::int
                - (v_g->>'start_minutes')::int));
  END IF;

  IF v_out IS NOT NULL AND v_g->>'end_time' IS NOT NULL THEN
    v_res := v_res || jsonb_build_object('avance_minutes',
      GREATEST(0, (v_g->>'end_minutes')::int
                + CASE WHEN (EXTRACT(HOUR FROM (v_out AT TIME ZONE v_tz)) * 60
                            + EXTRACT(MINUTE FROM (v_out AT TIME ZONE v_tz)))::int
                       < COALESCE((v_g->>'start_minutes')::int, 0) THEN 1440 ELSE 0 END
                - (EXTRACT(HOUR FROM (v_out AT TIME ZONE v_tz)) * 60
                 + EXTRACT(MINUTE FROM (v_out AT TIME ZONE v_tz)))::int));
  END IF;

  RETURN v_res;
END;
$$;

CREATE OR REPLACE FUNCTION public.encheck_alerte_journaliser(
  p_table text, p_id uuid, p_enterprise uuid, p_employee uuid, p_motif text
)
RETURNS void
LANGUAGE plpgsql VOLATILE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  -- Copie intégrale AVANT suppression : une alerte effacée reste consultable.
  EXECUTE format(
    'INSERT INTO public.encheck_pointages_journal
            (enterprise_id, employee_id, attendance_id, action, motif, snapshot, pipeline, auteur)
     SELECT $1, $2, NULL, %L, $3, to_jsonb(a), %L, public.encheck_auteur_actuel()
       FROM public.%I a WHERE a.id = $4',
    'alerte_supprimee', 'encheck_alertes_purger', p_table)
    USING p_enterprise, p_employee, p_motif, p_id;

  EXECUTE format('DELETE FROM public.%I WHERE id = $1', p_table) USING p_id;
END;
$$;

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

    IF COALESCE((v_r->>'trouvee')::boolean, false) = false THEN
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

-- Neutralisée (elle n'est plus appelée par le pipeline) — pas supprimée : si un vieux
-- client ou un vieux cron l'appelle encore, elle ne doit plus rien écrire.
CREATE OR REPLACE FUNCTION public.encheck_assainir_alertes_horaires(p_enterprise uuid DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql VOLATILE
SET search_path = public, pg_temp
AS $$
BEGIN
  RAISE NOTICE 'encheck_assainir_alertes_horaires est neutralisé depuis 20261016000001 : les alertes ne sont plus corrigées par regex sur leur texte français. Voir encheck_alertes_purger.';
END;
$$;

-- ═══════════════════════════════════════════════════════════════════════════
-- 12. ORCHESTRATEURS NOMMÉS — fin du patch par renommage
-- ═══════════════════════════════════════════════════════════════════════════
--  Le 15/10, l'entrée publique `encheck_alertes_controler` a été RENOMMÉE en `_interne`
--  et remplacée par un wrapper : le prochain `CREATE OR REPLACE` sur ce nom (autre IA,
--  ou toi dans l'éditeur SQL) écrasait le wrapper SANS erreur et faisait disparaître
--  clôture + nettoyage + assainissement ; et rejouer la migration recollait le wrapper
--  sur l'ANCIENNE `_interne`, perdant le correctif de l'autre IA. Ici : des noms propres,
--  appelés explicitement, et une sélection `to_regprocedure` au lieu d'un renommage.

CREATE OR REPLACE FUNCTION public.encheck_generateur_alertes(p_enterprise uuid)
RETURNS void
LANGUAGE plpgsql VOLATILE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF to_regprocedure('public.encheck_alertes_controler_interne(uuid)') IS NOT NULL THEN
    PERFORM public.encheck_alertes_controler_interne(p_enterprise);
  ELSIF to_regprocedure('public.encheck_alertes_controler_v2(uuid)') IS NOT NULL THEN
    PERFORM public.encheck_alertes_controler_v2(p_enterprise);
  END IF;
END;
$$;

-- SEUL chemin que le navigateur a le droit d'appeler : alertes + lecture,
-- AUCUNE écriture dans `attendances`.
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

  RETURN COALESCE(v_purge, 0);
END;
$$;

CREATE OR REPLACE FUNCTION public.encheck_pipeline_cloture(
  p_enterprise uuid, p_mode text DEFAULT NULL, p_now timestamptz DEFAULT now()
)
RETURNS jsonb
LANGUAGE plpgsql VOLATILE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_run bigint; v_marques integer := 0; v_clos integer := 0; v_consignes integer := 0;
  v_alertes integer := 0; v_recon integer := 0; v_mode text; v_ok boolean;
BEGIN
  SELECT pg_try_advisory_xact_lock(hashtextextended('encheck:pipeline:' || COALESCE(p_enterprise::text,'*'), 0))
    INTO v_ok;
  IF NOT COALESCE(v_ok, true) THEN
    RETURN jsonb_build_object('ignore', 'exécution déjà en cours', 'entreprise', p_enterprise);
  END IF;

  v_mode := lower(COALESCE(NULLIF(p_mode,''), public.encheck_mode_estimation(p_enterprise), 'ombre'));

  INSERT INTO public.encheck_pipeline_runs (pipeline, enterprise_id, mode)
  VALUES ('encheck_pipeline_cloture', p_enterprise, v_mode) RETURNING id INTO v_run;

  IF v_mode = 'actif' THEN
    SELECT count(*) INTO v_marques FROM public.encheck_rebonds_neutraliser(p_enterprise, true);
  END IF;

  SELECT count(*) FILTER (WHERE applique), count(*)
    INTO v_clos, v_consignes
    FROM public.encheck_cloturer_pivotable(p_enterprise, p_now, v_mode);

  v_recon := COALESCE(public.encheck_reconcilier_estimations(p_enterprise), 0);

  IF v_mode <> 'desactive' THEN
    SELECT count(*) INTO v_alertes
      FROM public.encheck_alertes_purger(p_enterprise, v_mode = 'actif', NULL);
  END IF;
  PERFORM public.encheck_generateur_alertes(p_enterprise);

  UPDATE public.encheck_pipeline_runs
     SET fini_le = now(), ecritures = v_clos + v_marques, consignations = v_consignes,
         ignores = v_recon,
         avertissement = CASE WHEN v_mode = 'ombre'
             THEN 'mode ombre : rien d''écrit dans attendances (arbitrage §5). Pour activer : UPDATE encheck_reglages_pointage SET valeur = ''"actif"'' WHERE cle = ''mode_estimation'' AND enterprise_id = ' || COALESCE(p_enterprise::text,'NULL') || ';' ELSE NULL END,
         detail = jsonb_build_object('rebonds_marques', v_marques, 'clotures', v_clos,
                                    'consignees', v_consignes, 'reconciliees', v_recon,
                                    'alertes_purgees', v_alertes)
   WHERE id = v_run;

  RETURN jsonb_build_object('run', v_run, 'mode', v_mode,
                            'rebonds_marques', v_marques, 'clotures', v_clos,
                            'consignees', v_consignes, 'reconciliees', v_recon,
                            'alertes_purgees', v_alertes);
END;
$$;

CREATE OR REPLACE FUNCTION public.encheck_pipeline_toutes_entreprises(p_mode text DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql VOLATILE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE v_ent record; v_tot jsonb := '{}'::jsonb; v_res jsonb; v_n integer := 0;
BEGIN
  FOR v_ent IN SELECT id FROM public.enterprises WHERE COALESCE(is_active, true) = true ORDER BY id
  LOOP
    v_res := public.encheck_pipeline_cloture(v_ent.id, p_mode, now());
    v_tot := jsonb_set(v_tot, ARRAY[v_ent.id::text], COALESCE(v_res, '{}'::jsonb));
    v_n   := v_n + COALESCE((v_res->>'clotures')::int, 0);
  END LOOP;
  RETURN jsonb_build_object('entreprises', jsonb_typeof(v_tot), 'clotures', v_n, 'resultats', v_tot);
END;
$$;

CREATE OR REPLACE FUNCTION public.encheck_alertes_scan_toutes_entreprises()
RETURNS integer
LANGUAGE plpgsql VOLATILE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE v_ent record; v_n integer := 0;
BEGIN
  FOR v_ent IN SELECT id FROM public.enterprises WHERE COALESCE(is_active, true) = true ORDER BY id
  LOOP
    v_n := v_n + COALESCE(public.encheck_alertes_scan(v_ent.id), 0);
  END LOOP;
  RETURN v_n;
END;
$$;

-- L'ancienne porte d'entrée devient une ALIAS SÛRE (et non plus une porte d'écriture) :
-- un bundle Vercel déjà déployé qui l'appelle encore ne peut plus fabriquer de données.
--
-- ⚠️ NE PAS REJOUER `20261015000002_...rebonds_qr_et_oublis_sortie.sql` APRÈS CE FICHIER.
--   Sa section 3 re-installe un wrapper sur ce même nom par `CREATE OR REPLACE`, wrapper
--   qui (a) n'a AUCUNE garde d'identité — il serait donc appelé par le navigateur pour
--   n'importe quelle entreprise, et (b) rappelle `encheck_nettoyer_rebonds_qr` +
--   `encheck_cloturer_sorties_oubliees` dans leur ancien ordre. Les dégâts restent
--   bornés parce que ces deux fonctions sont neutralisées ICI (marquage, mode ombre) ;
--   mais l'alias ci-dessous est écrasé et la garde du scan contournée. Si ce rejeu
--   devient indispensable, rejouer CE fichier juste après. Contrôle manuel :
--     SELECT prosrc LIKE '%encheck_alertes_scan%' AS alias_ok
--       FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
--      WHERE n.nspname = 'public' AND p.proname = 'encheck_alertes_controler';
CREATE OR REPLACE FUNCTION public.encheck_alertes_controler(p_enterprise uuid DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql VOLATILE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  PERFORM public.encheck_alertes_scan(p_enterprise);
END;
$$;

-- ═══════════════════════════════════════════════════════════════════════════
-- 13. MESURES DU MODE OMBRE
-- ═══════════════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.encheck_clotures_statistiques(
  p_enterprise uuid DEFAULT NULL, p_jours integer DEFAULT 45
)
RETURNS TABLE (
  niveau text, total integer, comparees integer, couverture_pct numeric,
  ecart_median_min numeric, erreur_moyenne_min numeric, dans_15_pct numeric,
  dans_30_pct numeric, trop_long_pct numeric, trop_court_pct numeric,
  heures_inventees_total numeric
)
LANGUAGE sql STABLE
SET search_path = public, pg_temp
AS $$
  WITH s AS (
    SELECT coalesce(c.niveau,'?') AS niveau,
           c.ecart_minutes AS se,
           abs(c.ecart_minutes) AS ae,
           (c.sortie_reelle IS NOT NULL) AS compare
      FROM public.encheck_clotures_estimees c
     WHERE c.jour_travail >= ((now() AT TIME ZONE public.encheck_fuseau(p_enterprise))::date - p_jours)
       AND (p_enterprise IS NULL OR c.enterprise_id = p_enterprise)
  )
  SELECT niveau,
         count(*)::int,
         count(*) FILTER (WHERE compare)::int,
         round(100.0 * count(*) FILTER (WHERE compare) / NULLIF(count(*),0)::numeric)::int,
         -- `percentile_cont` renvoie TOUJOURS un double (le cast de l'entrée n'y
         -- change rien) : c'est le RÉSULTAT qu'il faut passer en numeric pour `round`.
         round(percentile_cont(0.5) WITHIN GROUP (ORDER BY ae)::numeric, 1),
         round(avg(ae::numeric), 1),
         round(100.0 * count(*) FILTER (WHERE ae <= 15) / NULLIF(count(*) FILTER (WHERE compare),0)::numeric, 1),
         round(100.0 * count(*) FILTER (WHERE ae <= 30) / NULLIF(count(*) FILTER (WHERE compare),0)::numeric, 1),
         round(100.0 * count(*) FILTER (WHERE se >  60) / NULLIF(count(*) FILTER (WHERE compare),0)::numeric, 1),
         round(100.0 * count(*) FILTER (WHERE se < -60) / NULLIF(count(*) FILTER (WHERE compare),0)::numeric, 1),
         round(COALESCE(sum(se) FILTER (WHERE compare), 0)::numeric / 60.0, 2)
    FROM s GROUP BY niveau ORDER BY count(*) DESC;
$$;

-- ═══════════════════════════════════════════════════════════════════════════
-- 14. RLS + PRIVILÈGES (patron du socle Radar §9)
-- ═══════════════════════════════════════════════════════════════════════════
ALTER TABLE public.encheck_reglages_pointage  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.encheck_pointages_journal  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.encheck_pipeline_runs      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.encheck_clotures_estimees  ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.encheck_reglages_pointage TO authenticated;
GRANT SELECT ON public.encheck_pointages_journal TO authenticated;
GRANT SELECT ON public.encheck_pipeline_runs     TO authenticated;
GRANT SELECT, UPDATE ON public.encheck_clotures_estimees TO authenticated;

-- Journaux : aucune écriture possible depuis le navigateur (append-only côté API).
REVOKE INSERT, UPDATE, DELETE ON public.encheck_pointages_journal FROM PUBLIC, anon, authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.encheck_pipeline_runs     FROM PUBLIC, anon, authenticated;
REVOKE INSERT, DELETE           ON public.encheck_clotures_estimees FROM PUBLIC, anon, authenticated;

DROP POLICY IF EXISTS encheck_reglages_admin_all ON public.encheck_reglages_pointage;
CREATE POLICY encheck_reglages_admin_all ON public.encheck_reglages_pointage
  FOR ALL TO authenticated USING (
    EXISTS (SELECT 1 FROM public.admins a
             WHERE lower(a.email) = lower(auth.jwt() ->> 'email')
               AND a.is_active = true
               AND (a.role = 'super_admin'
                    OR a.enterprise_id = encheck_reglages_pointage.enterprise_id
                    OR EXISTS (SELECT 1 FROM public.admin_entreprises ae
                                WHERE ae.admin_id = a.id
                                  AND ae.enterprise_id = encheck_reglages_pointage.enterprise_id
                                  AND ae.is_active = true)))
  ) WITH CHECK (
    EXISTS (SELECT 1 FROM public.admins a
             WHERE lower(a.email) = lower(auth.jwt() ->> 'email')
               AND a.is_active = true
               AND (a.role = 'super_admin'
                    OR a.enterprise_id = encheck_reglages_pointage.enterprise_id))
  );

DROP POLICY IF EXISTS encheck_journal_admin_select ON public.encheck_pointages_journal;
CREATE POLICY encheck_journal_admin_select ON public.encheck_pointages_journal
  FOR SELECT TO authenticated USING (
    EXISTS (SELECT 1 FROM public.admins a
             WHERE lower(a.email) = lower(auth.jwt() ->> 'email')
               AND a.is_active = true
               AND (a.role = 'super_admin'
                    OR a.enterprise_id = encheck_pointages_journal.enterprise_id
                    OR EXISTS (SELECT 1 FROM public.admin_entreprises ae
                                WHERE ae.admin_id = a.id
                                  AND ae.enterprise_id = encheck_pointages_journal.enterprise_id
                                  AND ae.is_active = true)))
  );

DROP POLICY IF EXISTS encheck_runs_admin_select ON public.encheck_pipeline_runs;
CREATE POLICY encheck_runs_admin_select ON public.encheck_pipeline_runs
  FOR SELECT TO authenticated USING (
    EXISTS (SELECT 1 FROM public.admins a
             WHERE lower(a.email) = lower(auth.jwt() ->> 'email')
               AND a.is_active = true AND a.role = 'super_admin')
  );

DROP POLICY IF EXISTS encheck_clotures_admin_select ON public.encheck_clotures_estimees;
CREATE POLICY encheck_clotures_admin_select ON public.encheck_clotures_estimees
  FOR SELECT TO authenticated USING (
    EXISTS (SELECT 1 FROM public.admins a
             WHERE lower(a.email) = lower(auth.jwt() ->> 'email')
               AND a.is_active = true
               AND (a.role = 'super_admin'
                    OR a.enterprise_id = encheck_clotures_estimees.enterprise_id
                    OR EXISTS (SELECT 1 FROM public.admin_entreprises ae
                                WHERE ae.admin_id = a.id
                                  AND ae.enterprise_id = encheck_clotures_estimees.enterprise_id
                                  AND ae.is_active = true)))
  );

DROP POLICY IF EXISTS encheck_clotures_admin_update ON public.encheck_clotures_estimees;
CREATE POLICY encheck_clotures_admin_update ON public.encheck_clotures_estimees
  FOR UPDATE TO authenticated USING (
    EXISTS (SELECT 1 FROM public.admins a
             WHERE lower(a.email) = lower(auth.jwt() ->> 'email')
               AND a.is_active = true
               AND (a.role = 'super_admin'
                    OR a.enterprise_id = encheck_clotures_estimees.enterprise_id))
  ) WITH CHECK (
    EXISTS (SELECT 1 FROM public.admins a
             WHERE lower(a.email) = lower(auth.jwt() ->> 'email')
               AND a.is_active = true
               AND (a.role = 'super_admin'
                    OR a.enterprise_id = encheck_clotures_estimees.enterprise_id))
  );

-- ÉCRITURES RÉSERVÉES AU SERVEUR : pg_cron (`postgres`) et `service_role`.
REVOKE ALL ON FUNCTION public.encheck_rebonds_neutraliser(uuid, boolean)             FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.encheck_cloturer_pivotable(uuid, timestamptz, text)    FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.encheck_cloturer_sorties_oubliees(uuid)                FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.encheck_nettoyer_rebonds_qr(uuid)                      FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.encheck_pipeline_cloture(uuid, text, timestamptz)      FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.encheck_pipeline_toutes_entreprises(text)              FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.encheck_alertes_scan_toutes_entreprises()              FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.encheck_estimation_remplacer(uuid, uuid, text)         FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.encheck_reconcilier_estimations(uuid)                   FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.encheck_alertes_purger(uuid, boolean, integer)          FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.encheck_generateur_alertes(uuid)                       FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.encheck_alerte_journaliser(text, uuid, uuid, uuid, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.encheck_assainir_alertes_horaires(uuid)                FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.encheck_rebonds_neutraliser(uuid, boolean)             TO postgres, service_role;
GRANT EXECUTE ON FUNCTION public.encheck_cloturer_pivotable(uuid, timestamptz, text)    TO postgres, service_role;
GRANT EXECUTE ON FUNCTION public.encheck_cloturer_sorties_oubliees(uuid)                TO postgres, service_role;
GRANT EXECUTE ON FUNCTION public.encheck_nettoyer_rebonds_qr(uuid)                      TO postgres, service_role;
GRANT EXECUTE ON FUNCTION public.encheck_pipeline_cloture(uuid, text, timestamptz)      TO postgres, service_role;
GRANT EXECUTE ON FUNCTION public.encheck_pipeline_toutes_entreprises(text)              TO postgres, service_role;
GRANT EXECUTE ON FUNCTION public.encheck_alertes_scan_toutes_entreprises()              TO postgres, service_role;
GRANT EXECUTE ON FUNCTION public.encheck_estimation_remplacer(uuid, uuid, text)         TO postgres, service_role;
GRANT EXECUTE ON FUNCTION public.encheck_reconcilier_estimations(uuid)                  TO postgres, service_role;
GRANT EXECUTE ON FUNCTION public.encheck_alertes_purger(uuid, boolean, integer)         TO postgres, service_role;
GRANT EXECUTE ON FUNCTION public.encheck_generateur_alertes(uuid)                      TO postgres, service_role;
GRANT EXECUTE ON FUNCTION public.encheck_alerte_journaliser(text, uuid, uuid, uuid, text) TO postgres, service_role;
GRANT EXECUTE ON FUNCTION public.encheck_assainir_alertes_horaires(uuid)               TO postgres, service_role;

-- Ce que le client a le droit d'appeler.
GRANT EXECUTE ON FUNCTION public.encheck_alertes_scan(uuid)                        TO authenticated;
GRANT EXECUTE ON FUNCTION public.encheck_alertes_controler(uuid)                   TO authenticated;
GRANT EXECUTE ON FUNCTION public.encheck_estimation_statuer(uuid[], text, text)     TO authenticated;
GRANT EXECUTE ON FUNCTION public.encheck_clotures_statistiques(uuid, integer)       TO authenticated;
GRANT EXECUTE ON FUNCTION public.encheck_grille_au_jour(uuid, uuid, date)          TO authenticated;
GRANT EXECUTE ON FUNCTION public.encheck_resoudre_grille_employe(uuid, uuid, date) TO authenticated;
GRANT EXECUTE ON FUNCTION public.encheck_journee_recalculee(uuid, uuid, date)       TO authenticated;
GRANT EXECUTE ON FUNCTION public.encheck_table_alertes()                            TO authenticated;
GRANT EXECUTE ON FUNCTION public.encheck_seuil(uuid, text, numeric)                 TO authenticated;
GRANT EXECUTE ON FUNCTION public.encheck_reglage_texte(uuid, text, text)            TO authenticated;
GRANT EXECUTE ON FUNCTION public.encheck_mode_estimation(uuid)                      TO authenticated;
GRANT EXECUTE ON FUNCTION public.encheck_fuseau(uuid)                               TO authenticated;
GRANT EXECUTE ON FUNCTION public.encheck_auteur_actuel()                            TO authenticated;

-- ═══════════════════════════════════════════════════════════════════════════
-- 15. pg_cron — le déclencheur est le serveur, pas un poste de travail
-- ═══════════════════════════════════════════════════════════════════════════
-- 03:30 UTC = 04:30 Africa/Porto-Novo (UTC+1, pas de changement d'heure au Bénin).
DO $$
DECLARE v_have_cron boolean;
BEGIN
  SELECT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') INTO v_have_cron;
  IF NOT COALESCE(v_have_cron, false) THEN
    RAISE NOTICE 'pg_cron absent : clôture non planifiée. Activer l''extension (Database → Extensions) puis rejouer cette section.';
    RETURN;
  END IF;

  -- ── Deux pièges à ne PAS transformer en échec du fichier entier ───────────────
  -- (a) `pg_cron` est installé dans la base « postgres », pas dans la base applicative :
  --     ici `cron.job` n'existe pas, donc undefined_table ;
  -- (b) dans Supabase, le rôle SQL n'a pas toujours le privilège de LIRE cron.job :
  --     c'est insufficient_privilege (42501), que `WHEN undefined_table` ne capture
  --     PAS — et comme cette migration vit dans un unique BEGIN…COMMIT, ce refus
  --     annulait TOUS les objets créés plus haut (le fichier « ne s'exécutait pas »).
  -- D'où : on teste l'existence puis le privilège AVANT de toucher la table, et le
  -- handler du bas attrape n'importe quel refus. Un cron non planifié reste une
  -- dégradation visible (NOTICE), jamais une migration perdue.
  IF to_regclass('cron.job') IS NULL THEN
    RAISE NOTICE 'pg_cron invisible dans cette base : planifier les deux jobs depuis la base « postgres » (Database → Jobs) — encheck-alertes-scan */10 * * * * ; encheck-cloture-pivotable 30 3 * * *.';
    RETURN;
  END IF;
  IF NOT has_table_privilege('cron.job', 'SELECT') THEN
    RAISE NOTICE 'cron.job existe mais ce rôle ne peut pas le lire : planifier les deux jobs via Database → Jobs (encheck-alertes-scan */10 * * * * ; encheck-cloture-pivotable 30 3 * * *).';
    RETURN;
  END IF;

  BEGIN
    IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'encheck-alertes-scan') THEN
      PERFORM cron.unschedule('encheck-alertes-scan');
    END IF;
    IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'encheck-cloture-pivotable') THEN
      PERFORM cron.unschedule('encheck-cloture-pivotable');
    END IF;

    -- Alertes : léger, toutes les 10 min, aucune écriture dans attendances.
    PERFORM cron.schedule('encheck-alertes-scan', '*/10 * * * *',
      $cron$SELECT public.encheck_alertes_scan_toutes_entreprises()$cron$);

    -- Clôture pivotable : une fois par jour, pour les journées <= J-1 (§5).
    PERFORM cron.schedule('encheck-cloture-pivotable', '30 3 * * *',
      $cron$SELECT public.encheck_pipeline_toutes_entreprises()$cron$);
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'planification pg_cron refusée (%) : les objets sont bien créés, mais les deux jobs restent à créer à la main dans Database → Jobs (encheck-alertes-scan */10 * * * * ; encheck-cloture-pivotable 30 3 * * *).', SQLERRM;
  END;
END;
$$;

-- ═══════════════════════════════════════════════════════════════════════════
-- 16. CARTE DES FONCTIONS — qui possède quoi (§4.4)
-- ═══════════════════════════════════════════════════════════════════════════
--  Une table, pas une habitude : elle rend visible le « dernière écriture gagne ».
CREATE TABLE IF NOT EXISTS public.encheck_carte_fonctions (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  fonction    text NOT NULL UNIQUE,
  proprietaire text NOT NULL,      -- 'IA DEV 1' | 'IA DEV 2' | 'producteur' | 'non versionnee'
  depot       text,
  versionnee  boolean NOT NULL DEFAULT false,
  contrat     text,
  maj_le      timestamptz NOT NULL DEFAULT now()
);

INSERT INTO public.encheck_carte_fonctions (fonction, proprietaire, depot, versionnee, contrat) VALUES
  ('encheck_grille_au_jour',                  'IA DEV 2', 'En-Check', true,  'Résolveur UNIQUE de grille horaire, daté. Personne d''autre ne renomme ni n''enveloppe.'),
  ('encheck_resoudre_grille_employe',         'IA DEV 2', 'En-Check', true,  'Vitre de compatibilité sur encheck_grille_au_jour.'),
  ('encheck_estimer_sortie_comportementale',  'IA DEV 1', 'à livrer', true,  'Niveau 2 uniquement : remplacer le corps, ne pas renommer, pas de CREATE OR REPLACE ailleurs.'),
  ('encheck_cloturer_pivotable',              'IA DEV 2', 'En-Check', true,  'Cascade + plafonds + mode ombre. Ne pas éditer pour ajouter un étage : passer par le hook.'),
  ('encheck_rebonds_neutraliser',              'IA DEV 2', 'En-Check', true,  'Marquage, jamais suppression.'),
  ('encheck_alertes_scan',                     'IA DEV 2', 'En-Check', true,  'Seul point d''entrée appelable par le navigateur.'),
  ('encheck_pipeline_cloture',                 'IA DEV 2', 'En-Check', true,  'Appelé par pg_cron uniquement.'),
  ('encheck_alertes_controler_interne',        'producteur', 'AUCUN', false,  'Géniteur d''alertes historique : À EXPORTER dans supabase/migrations/ avant toute modification.'),
  ('encheck_punch',                            'producteur', 'AUCUN', false,  'Chemin d''écriture des pointeuses : À EXPORTER.'),
  ('replace_attendance_day',                   'producteur', 'AUCUN', false,  'Correction atomique admin + attendance_history : À EXPORTER.')
ON CONFLICT (fonction) DO UPDATE
  SET proprietaire = EXCLUDED.proprietaire, depot = EXCLUDED.depot,
      versionnee = EXCLUDED.versionnee, contrat = EXCLUDED.contrat, maj_le = now();

ALTER TABLE public.encheck_carte_fonctions ENABLE ROW LEVEL SECURITY;
GRANT SELECT ON public.encheck_carte_fonctions TO authenticated;
DROP POLICY IF EXISTS encheck_carte_admin_select ON public.encheck_carte_fonctions;
CREATE POLICY encheck_carte_admin_select ON public.encheck_carte_fonctions
  FOR SELECT TO authenticated USING (true);

COMMIT;

-- ═══════════════════════════════════════════════════════════════════════════
-- 17. CONTRÔLES APRÈS EXÉCUTION (à lancer à part, lecture seule)
-- ═══════════════════════════════════════════════════════════════════════════
-- 1) Le mode est bien « ombre » (donc : aucune sortie inventée dorénavant) :
--    SELECT public.encheck_mode_estimation(NULL);
--    SELECT count(*) FROM public.attendances WHERE estimation_source_id IS NOT NULL;
-- 2) Les deux jobs sont planifiés :
--    SELECT jobname, schedule FROM cron.job WHERE jobname LIKE 'encheck-%';
-- 3) Les seuils sont uniques et lisibles :
--    SELECT cle, valeur FROM public.encheck_reglages_pointage WHERE enterprise_id IS NULL ORDER BY cle;
-- 4) La grille fantôme est morte (une entreprise sans work_schedules doit répondre trouvee=false) :
--    SELECT public.encheck_grille_au_jour(NULL, NULL, CURRENT_DATE);
-- 5) Précision mesurée du mode ombre (l'IA ARBITRE valide ou corrige avec ces chiffres) :
--    SELECT * FROM public.encheck_clotures_statistiques(NULL, 45);
--    SELECT id, pipeline, mode, ecritures, consignations, avertissement
--      FROM public.encheck_pipeline_runs ORDER BY id DESC LIMIT 10;
-- 6) Test d'un seul entreprise en mode actif, SANS toucher les autres (décommenter) :
--    -- SELECT public.encheck_pipeline_cloture('<uuid-entreprise>'::uuid, 'actif');

