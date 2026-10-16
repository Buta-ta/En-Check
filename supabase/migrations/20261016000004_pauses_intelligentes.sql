-- ═══════════════════════════════════════════════════════════════════════════
-- 20261016000004 — PAUSES INTELLIGENTES (déclarées, présumées, jamais inventées)
-- ═══════════════════════════════════════════════════════════════════════════
--  Proposition validée le 16/10/2026 — la totale :
--
--  COUCHE 1 — la pause PRÉVUE existe déjà : les grilles portent
--  `break_start`/`break_end` (ex. 12:00–13:00) et le moteur en déduit déjà le
--  service attendu (amplitude − pause).
--
--  COUCHE 2 — la pause RÉELLE (cette migration) :
--    · `encheck_pauses` : table dédiée (JAMAIS dans attendances — leçon MADEDE :
--      pas de ligne qui ressuscite dans « Modifier le pointage ») ;
--    · `encheck_pause_ouvrir` / `encheck_pause_fermer` : RPC appelées par
--      l'app de pointage (fiche LOT D pour l'autre équipe) ;
--    · `encheck_pauses_controler` : le moteur intelligent —
--        - PRÉSOMPTION : jour travaillé + créneau prévu + aucune pause pointée
--          → pause PRÉSUMÉE, marquée telle (« on invente, on marque ») ;
--        - ANOMALIES : « Pause sans reprise » (jumelle de « Sortie manquante »)
--          et « Pause très longue » → alertes admin idempotentes, une seule
--          par pause et par jour (jamais de re-poussée à chaque balayage) ;
--    · `encheck_pauses_statuer` : Valider / Écarter (décision définitive,
--      journalisée, jamais de suppression — doctrine d'audit) ;
--    · `encheck_pauses_lire` : lecture admin par plage ;
--    · `encheck_pauses_duree_reelle` : le point d'intégration paie/heures sup
--      (réelle validée gagne, sinon la présumée — jamais le vide).
--
--  RÈGLE D'OPTION (cohérente avec les retards) : sans option Planning
--  (`enterprises.module_planning = false`), aucune pause n'est présumée ni
--  jugée — les pauses pointées restent enregistrées, sans comparaison.
--
--  Sûr pour la production : transactionnel, idempotent (CREATE OR REPLACE /
--  IF NOT EXISTS), préflight par NOM (leçon du préflight `encheck_seuil`),
--  lectures de colonnes historiques via jsonb + `encheck_colonne_existe`.
-- ═══════════════════════════════════════════════════════════════════════════

BEGIN;

-- ─────────────────────────────────────────────────────────────────────────────
-- 0. PRÉFLIGHT — par NOM, insensible aux signatures
-- ─────────────────────────────────────────────────────────────────────────────
DO $$
DECLARE
  v_manquant text;
BEGIN
  SELECT string_agg(f.nom, ', ' ORDER BY f.nom) INTO v_manquant
    FROM (VALUES ('encheck_grille_au_jour'),
                 ('encheck_journee_recalculee'),
                 ('encheck_colonne_existe'),
                 ('encheck_fuseau'),
                 ('encheck_seuil'),
                 ('encheck_est_admin_de'),
                 ('encheck_table_alertes'),
                 ('encheck_duree_circulaire'),
                 ('encheck_alertes_scan')) AS f(nom)
   WHERE NOT EXISTS (
     SELECT 1 FROM pg_proc p
       JOIN pg_namespace n ON n.oid = p.pronamespace
      WHERE n.nspname = 'public' AND p.proname = f.nom
   );
  IF v_manquant IS NOT NULL THEN
    RAISE EXCEPTION 'Préflight : fonctions introuvables (%) — exécutez d''abord '
      '20261016000001, 20261016000003 puis relancez ce script en entier. '
      'Rien n''a été appliqué.', v_manquant;
  END IF;
END $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. TABLE DES PAUSES — dédiée, jamais dans attendances
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.encheck_pauses (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  enterprise_id   uuid NOT NULL,
  employee_id     uuid NOT NULL,
  jour            date NOT NULL,
  debut           timestamptz NOT NULL,
  fin             timestamptz,
  duree_minutes   integer,
  statut          text NOT NULL DEFAULT 'reelle',   -- reelle | presumee | validee | ecartee
  source          text NOT NULL DEFAULT 'pointee',  -- pointee | presumee | admin
  motif           text,
  anomalie        text,                             -- sans_reprise | trop_longue | NULL
  cree_par        text,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  -- Idempotence hors-ligne : un même (employé, début) ne crée UNE pause ;
  -- le replay d'une file d'attente ne doit pas dupliquer.
  CONSTRAINT encheck_pauses_debut_uk   UNIQUE (employee_id, debut),
  -- Doctrine « on marque » : statuts et sources fermés.
  CONSTRAINT encheck_pauses_statut_chk CHECK (statut IN ('reelle','presumee','validee','ecartee')),
  CONSTRAINT encheck_pauses_source_chk CHECK (source IN ('pointee','presumee','admin')),
  CONSTRAINT encheck_pauses_anomalie_chk CHECK (anomalie IS NULL OR anomalie IN ('sans_reprise','trop_longue')),
  CONSTRAINT encheck_pauses_duree_chk  CHECK (duree_minutes IS NULL OR duree_minutes >= 0)
);

CREATE INDEX IF NOT EXISTS idx_encheck_pauses_emp_jour
  ON public.encheck_pauses (employee_id, jour);
CREATE INDEX IF NOT EXISTS idx_encheck_pauses_ent_jour
  ON public.encheck_pauses (enterprise_id, jour);

GRANT SELECT ON public.encheck_pauses TO authenticated, service_role;
-- Les écritures passent UNIQUEMENT par les fonctions ci-dessous (SECURITY DEFINER).

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. ENCHECK_PAUSE_PREVUE — le créneau de pause en vigueur ce jour-là
-- ─────────────────────────────────────────────────────────────────────────────
--  Même échelle que `encheck_grille_au_jour` : affectation individuelle
--  (use_custom_hours → custom_break_*) → grille liée (break_*) → défaut de
--  l'entreprise. Les champs lus sont extraits du jsonb (`to_jsonb(t.*)`) :
--  colonne absente = clé absente = pas de créneau — jamais d'erreur de schéma.
CREATE OR REPLACE FUNCTION public.encheck_pause_prevue(
  p_employee uuid, p_enterprise uuid, p_jour date
)
RETURNS jsonb
LANGUAGE plpgsql STABLE
SET search_path = public, pg_temp
AS $$
DECLARE
  v_es     jsonb;
  v_ws     jsonb;
  v_def    jsonb;
  v_clause text;
  v_actif  text;
  v_ord    text;
  v_d      text;
  v_f      text;
  v_src    text := 'aucune';
BEGIN
  -- ── Affectation individuelle ───────────────────────────────────────────────
  v_clause := '';
  IF public.encheck_colonne_existe('employee_schedules', 'valide_du') THEN
    v_clause := v_clause || ' AND (es.valide_du IS NULL OR es.valide_du <= $2::date)';
  END IF;
  IF public.encheck_colonne_existe('employee_schedules', 'valide_au') THEN
    v_clause := v_clause || ' AND (es.valide_au IS NULL OR es.valide_au >= $2::date)';
  END IF;
  v_actif := CASE WHEN public.encheck_colonne_existe('employee_schedules', 'is_active')
                  THEN ' AND COALESCE(es.is_active, true) = true' ELSE '' END;
  v_ord := '';
  IF public.encheck_colonne_existe('employee_schedules', 'valide_du') THEN
    v_ord := v_ord || 'COALESCE(es.valide_du, DATE ''1900-01-01'') DESC NULLS LAST, ';
  END IF;
  IF public.encheck_colonne_existe('employee_schedules', 'updated_at') THEN
    v_ord := v_ord || 'COALESCE(es.updated_at, ''infinity''::timestamptz) DESC NULLS LAST, ';
  END IF;
  IF public.encheck_colonne_existe('employee_schedules', 'created_at') THEN
    v_ord := v_ord || 'COALESCE(es.created_at, ''infinity''::timestamptz) DESC NULLS LAST, ';
  END IF;
  v_ord := v_ord || 'es.id DESC';

  BEGIN
    EXECUTE 'SELECT to_jsonb(es.*) FROM public.employee_schedules es
              WHERE es.employee_id = $1' || v_actif || v_clause || '
              ORDER BY ' || v_ord || ' LIMIT 1'
      INTO v_es USING p_employee, p_jour;
  EXCEPTION WHEN OTHERS THEN
    v_es := NULL;
  END;

  IF v_es IS NOT NULL AND COALESCE((v_es->>'use_custom_hours')::boolean, false) THEN
    IF COALESCE((v_es->>'custom_has_break')::boolean, true)
       AND v_es->>'custom_break_start' IS NOT NULL
       AND v_es->>'custom_break_end' IS NOT NULL THEN
      v_d := left(v_es->>'custom_break_start', 5);
      v_f := left(v_es->>'custom_break_end', 5);
      v_src := 'custom';
    END IF;

  ELSIF v_es IS NOT NULL AND v_es->>'schedule_id' IS NOT NULL THEN
    BEGIN
      EXECUTE 'SELECT to_jsonb(ws.*) FROM public.work_schedules ws WHERE ws.id = $1 LIMIT 1'
        INTO v_ws USING (v_es->>'schedule_id')::uuid;
    EXCEPTION WHEN OTHERS THEN
      v_ws := NULL;
    END;
    IF v_ws IS NOT NULL
       AND COALESCE((v_ws->>'has_break')::boolean, false)
       AND v_ws->>'break_start' IS NOT NULL AND v_ws->>'break_end' IS NOT NULL THEN
      v_d := left(v_ws->>'break_start', 5);
      v_f := left(v_ws->>'break_end', 5);
      v_src := 'liee';
    END IF;
  END IF;

  -- ── Grille par défaut de l'entreprise, uniquement si rien de personnel ────
  IF v_src = 'aucune' THEN
    v_clause := '';
    IF public.encheck_colonne_existe('work_schedules', 'valide_du') THEN
      v_clause := v_clause || ' AND (ws.valide_du IS NULL OR ws.valide_du <= $2::date)';
    END IF;
    IF public.encheck_colonne_existe('work_schedules', 'valide_au') THEN
      v_clause := v_clause || ' AND (ws.valide_au IS NULL OR ws.valide_au >= $2::date)';
    END IF;
    v_actif := CASE WHEN public.encheck_colonne_existe('work_schedules', 'is_active')
                    THEN ' AND COALESCE(ws.is_active, true) = true' ELSE '' END;
    v_ord := 'COALESCE(ws.is_default, false) DESC, ';
    IF public.encheck_colonne_existe('work_schedules', 'created_at') THEN
      v_ord := v_ord || 'COALESCE(ws.created_at, ''infinity''::timestamptz) DESC, ';
    END IF;
    v_ord := v_ord || 'ws.id DESC';

    BEGIN
      EXECUTE 'SELECT to_jsonb(ws.*) FROM public.work_schedules ws
                WHERE ws.enterprise_id = $1
                  AND ws.start_time IS NOT NULL AND ws.end_time IS NOT NULL'
                  || v_actif || v_clause || '
                ORDER BY ' || v_ord || ' LIMIT 1'
        INTO v_def USING p_enterprise, p_jour;
    EXCEPTION WHEN OTHERS THEN
      v_def := NULL;
    END;
    IF v_def IS NOT NULL
       AND COALESCE((v_def->>'has_break')::boolean, false)
       AND v_def->>'break_start' IS NOT NULL AND v_def->>'break_end' IS NOT NULL THEN
      v_d := left(v_def->>'break_start', 5);
      v_f := left(v_def->>'break_end', 5);
      v_src := 'defaut';
    END IF;
  END IF;

  IF v_src = 'aucune' THEN
    RETURN jsonb_build_object('trouvee', false);
  END IF;
  RETURN jsonb_build_object(
    'trouvee', true, 'source', v_src,
    'debut', v_d, 'fin', v_f,
    'minutes', COALESCE(public.encheck_duree_circulaire(v_d, v_f), 0));
END;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. RPC POUR L'APP DE POINTAGE — ouvrir / fermer une pause
-- ─────────────────────────────────────────────────────────────────────────────
--  Contrat pour l'équipe En-Check-App-Pointage (fiche LOT D) :
--    encheck_pause_ouvrir(p_employee, p_debut, p_motif) → {ok, pause_id, erreur}
--    encheck_pause_fermer(p_employee, p_fin)            → {ok, pause_id, erreur}
--  Intelligent : « ouvrir » ferme d'abord toute pause restée ouverte
--  (marquée « sans_reprise »), comme un pointage qui en remplacerait un autre.
CREATE OR REPLACE FUNCTION public.encheck_pause_ouvrir(
  p_employee uuid,
  p_debut    timestamptz DEFAULT now(),
  p_motif    text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql VOLATILE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_emp   record;
  v_tz    text;
  v_jour  date;
  v_id    uuid;
  v_nb    integer;
BEGIN
  SELECT e.id, e.enterprise_id INTO v_emp
    FROM public.employees e
   WHERE e.id = p_employee AND COALESCE(e.is_active, true) = true;
  IF v_emp IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'erreur', 'employé inconnu ou inactif');
  END IF;
  IF p_debut IS NULL OR p_debut > now() + interval '10 minutes' THEN
    RETURN jsonb_build_object('ok', false, 'erreur', 'heure de début invalide (futur interdit)');
  END IF;

  v_tz   := public.encheck_fuseau(v_emp.enterprise_id);
  v_jour := (p_debut AT TIME ZONE v_tz)::date;

  -- Idempotence : si un double-tap / un replay hors-ligne renvoie le même
  -- début, on retourne la pause existante sans rien créer.
  SELECT id INTO v_id
    FROM public.encheck_pauses
   WHERE employee_id = p_employee AND debut = p_debut;
  IF v_id IS NOT NULL THEN
    RETURN jsonb_build_object('ok', true, 'pause_id', v_id, 'deja', true, 'jour', v_jour::text);
  END IF;

  -- Toute pause restée ouverte se ferme ici : on ne devine pas la reprise,
  -- on MARQUE « sans_reprise » — l'admin statuera.
  UPDATE public.encheck_pauses
     SET fin = p_debut,
         duree_minutes = GREATEST(0, round(extract(epoch FROM (p_debut - debut)) / 60))::int,
         anomalie = COALESCE(anomalie, 'sans_reprise'),
         updated_at = now()
   WHERE employee_id = p_employee
     AND fin IS NULL
     AND statut IN ('reelle', 'presumee');
  GET DIAGNOSTICS v_nb = ROW_COUNT;

  INSERT INTO public.encheck_pauses
    (enterprise_id, employee_id, jour, debut, statut, source, motif, cree_par)
  VALUES
    (v_emp.enterprise_id, p_employee, v_jour, p_debut, 'reelle', 'pointee', p_motif,
     public.encheck_auteur_actuel())
  RETURNING id INTO v_id;

  RETURN jsonb_build_object('ok', true, 'pause_id', v_id, 'fermees', v_nb, 'jour', v_jour::text);
END;
$$;

CREATE OR REPLACE FUNCTION public.encheck_pause_fermer(
  p_employee uuid,
  p_fin      timestamptz DEFAULT now()
)
RETURNS jsonb
LANGUAGE plpgsql VOLATILE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_id  uuid;
  v_deb timestamptz;
BEGIN
  SELECT id, debut INTO v_id, v_deb
    FROM public.encheck_pauses
   WHERE employee_id = p_employee
     AND fin IS NULL
     AND statut IN ('reelle', 'presumee')
   ORDER BY debut DESC
   LIMIT 1;
  IF v_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'erreur', 'aucune pause ouverte');
  END IF;
  IF p_fin IS NULL OR p_fin < v_deb OR p_fin > now() + interval '10 minutes' THEN
    RETURN jsonb_build_object('ok', false, 'erreur', 'heure de reprise invalide');
  END IF;

  UPDATE public.encheck_pauses
     SET fin = p_fin,
         duree_minutes = GREATEST(0, round(extract(epoch FROM (p_fin - v_deb)) / 60))::int,
         updated_at = now()
   WHERE id = v_id;

  RETURN jsonb_build_object('ok', true, 'pause_id', v_id);
END;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. ENCHECK_PAUSES_LIRE — lecture admin par plage
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.encheck_pauses_lire(
  p_enterprise uuid DEFAULT NULL,
  p_du date DEFAULT NULL,
  p_au date DEFAULT NULL
)
RETURNS TABLE (
  id uuid, employe_id uuid, prenom text, nom text, matricule text,
  enterprise_id uuid, entreprise_nom text, jour date,
  debut timestamptz, fin timestamptz, duree_minutes integer,
  statut text, source text, motif text, anomalie text
)
LANGUAGE plpgsql STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_email text;
  v_du    date;
  v_au    date;
BEGIN
  v_email := NULLIF(coalesce(auth.jwt() ->> 'email', ''), '');
  IF v_email IS NOT NULL THEN
    IF p_enterprise IS NOT NULL THEN
      IF NOT public.encheck_est_admin_de(p_enterprise) THEN
        RAISE EXCEPTION 'non autorisé pour cette entreprise';
      END IF;
    ELSIF NOT EXISTS (
      SELECT 1 FROM public.admins a
       WHERE lower(a.email) = lower(v_email)
         AND a.is_active = true AND a.role = 'super_admin'
    ) THEN
      RAISE EXCEPTION 'non autorisé : la vue toutes entreprises est réservée au super admin';
    END IF;
  END IF;

  v_du := COALESCE(p_du, CURRENT_DATE - 7);
  v_au := COALESCE(p_au, CURRENT_DATE);

  RETURN QUERY
    SELECT p.id, e.id,
           e.first_name::text, e.last_name::text, e.matricule::text,
           ent.id, ent.name::text, p.jour,
           p.debut, p.fin, p.duree_minutes,
           p.statut, p.source, p.motif, p.anomalie
      FROM public.encheck_pauses p
      JOIN public.employees e  ON e.id = p.employee_id
      JOIN public.enterprises ent ON ent.id = p.enterprise_id
     WHERE p.jour BETWEEN v_du AND v_au
       AND (p_enterprise IS NULL OR p.enterprise_id = p_enterprise)
     ORDER BY p.jour DESC, e.last_name, e.first_name, p.debut;
END;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 5. ENCHECK_PAUSES_STATUER — Valider / Écarter (jamais supprimer)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.encheck_pauses_statuer(
  p_ids      uuid[],
  p_decision text,
  p_motif    text DEFAULT NULL
)
RETURNS integer
LANGUAGE plpgsql VOLATILE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_id  uuid;
  v_ent uuid;
  v_emp uuid;
  v_new text;
  v_n   integer := 0;
BEGIN
  IF p_ids IS NULL OR COALESCE(array_length(p_ids, 1), 0) = 0 THEN
    RAISE EXCEPTION 'aucune pause sélectionnée';
  END IF;
  IF p_decision NOT IN ('valider', 'ecarter') THEN
    RAISE EXCEPTION 'décision inconnue : %', p_decision;
  END IF;
  v_new := CASE WHEN p_decision = 'valider' THEN 'validee' ELSE 'ecartee' END;

  FOREACH v_id IN ARRAY p_ids LOOP
    SELECT enterprise_id, employee_id INTO v_ent, v_emp
      FROM public.encheck_pauses WHERE id = v_id;
    IF v_ent IS NULL THEN
      CONTINUE;
    END IF;
    IF NULLIF(coalesce(auth.jwt() ->> 'email', ''), '') IS NOT NULL
       AND NOT public.encheck_est_admin_de(v_ent) THEN
      RAISE EXCEPTION 'non autorisé pour cette entreprise';
    END IF;

    UPDATE public.encheck_pauses
       SET statut = v_new,
           updated_at = now()
     WHERE id = v_id;
    -- Journal d'audit : la décision est gravée, la ligne reste.
    BEGIN
      PERFORM public.encheck_alerte_journaliser('encheck_pauses', v_id, v_ent, v_emp,
        CASE WHEN v_new = 'validee' THEN 'pause validée par l''admin'
             ELSE 'pause écartée par l''admin' END ||
        COALESCE(' — ' || p_motif, ''));
    EXCEPTION WHEN OTHERS THEN
      NULL; -- le journal ne doit jamais empêcher de statuer
    END;
    v_n := v_n + 1;
  END LOOP;
  RETURN v_n;
END;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 6. ENCHECK_PAUSE_CREER — correction manuelle par l'admin
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.encheck_pause_creer(
  p_employee uuid,
  p_debut    timestamptz,
  p_fin      timestamptz,
  p_motif    text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql VOLATILE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_emp record;
  v_id  uuid;
  v_jour date;
  v_tz  text;
BEGIN
  SELECT e.id, e.enterprise_id INTO v_emp
    FROM public.employees e
   WHERE e.id = p_employee AND COALESCE(e.is_active, true) = true;
  IF v_emp IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'erreur', 'employé inconnu ou inactif');
  END IF;
  IF p_debut IS NULL OR p_fin IS NULL OR p_fin <= p_debut THEN
    RETURN jsonb_build_object('ok', false, 'erreur', 'intervalle invalide');
  END IF;
  IF NULLIF(coalesce(auth.jwt() ->> 'email', ''), '') IS NOT NULL
     AND NOT public.encheck_est_admin_de(v_emp.enterprise_id) THEN
    RETURN jsonb_build_object('ok', false, 'erreur', 'non autorisé pour cette entreprise');
  END IF;

  v_tz   := public.encheck_fuseau(v_emp.enterprise_id);
  v_jour := (p_debut AT TIME ZONE v_tz)::date;

  INSERT INTO public.encheck_pauses
    (enterprise_id, employee_id, jour, debut, fin, duree_minutes, statut, source, motif, cree_par)
  VALUES
    (v_emp.enterprise_id, p_employee, v_jour, p_debut, p_fin,
     GREATEST(0, round(extract(epoch FROM (p_fin - p_debut)) / 60))::int,
     'reelle', 'admin', p_motif, public.encheck_auteur_actuel())
  RETURNING id INTO v_id;

  RETURN jsonb_build_object('ok', true, 'pause_id', v_id);
END;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 7. ENCHECK_PAUSES_DUREE_REELLE — le point d'intégration paie / heures sup
-- ─────────────────────────────────────────────────────────────────────────────
--  Doctrine : la pause RÉELLE VALIDÉE gagne ; à défaut la PRÉSUMÉE (marquée) ;
--  jamais le vide. `retenue_minutes` = ce que la paie doit déduire.
CREATE OR REPLACE FUNCTION public.encheck_pauses_duree_reelle(
  p_employee uuid, p_enterprise uuid, p_jour date
)
RETURNS jsonb
LANGUAGE plpgsql STABLE
SET search_path = public, pg_temp
AS $$
DECLARE
  v_reelles   integer := 0;
  v_presumees integer := 0;
  v_retenue   integer := 0;
  v_type      text := 'aucune';
BEGIN
  SELECT COALESCE(sum(p.duree_minutes), 0) INTO v_reelles
    FROM public.encheck_pauses p
   WHERE p.employee_id = p_employee AND p.jour = p_jour
     AND p.statut IN ('reelle', 'validee')
     AND p.fin IS NOT NULL;

  SELECT COALESCE(sum(p.duree_minutes), 0) INTO v_presumees
    FROM public.encheck_pauses p
   WHERE p.employee_id = p_employee AND p.jour = p_jour
     AND p.statut = 'presumee'
     AND p.fin IS NOT NULL;

  IF v_reelles > 0 THEN
    v_retenue := v_reelles; v_type := 'reelle';
  ELSIF v_presumees > 0 THEN
    v_retenue := v_presumees; v_type := 'presumee';
  END IF;

  RETURN jsonb_build_object(
    'reelles_minutes', v_reelles,
    'presumees_minutes', v_presumees,
    'retenue_minutes', v_retenue,
    'source_retenue', v_type);
END;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 8. ENCHECK_PAUSES_CONTROLER — le moteur : présomptions + anomalies + alertes
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.encheck_pauses_controler(
  p_enterprise uuid DEFAULT NULL
)
RETURNS integer
LANGUAGE plpgsql VOLATILE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_ent       record;
  v_emp       record;
  v_jour      date;
  v_plan      boolean;
  v_prev      jsonb;
  v_r         jsonb;
  v_tz        text;
  v_d         timestamptz;
  v_f         timestamptz;
  v_n         integer := 0;
  v_jours     integer;
  v_rappel    integer;
  v_max       integer;
  v_rec       record;
  v_has_poser boolean;
  v_tbl       text;
  v_coldate   text;
  v_deja      boolean;
BEGIN
  IF p_enterprise IS NULL THEN
    RETURN 0;  -- jamais de balayage « toutes entreprises » en une passe
  END IF;

  v_jours  := COALESCE(public.encheck_seuil(p_enterprise, 'pause_fenetre_jours', 7), 7)::int;
  v_rappel := COALESCE(public.encheck_seuil(p_enterprise, 'pause_rappel_minutes', 75), 75)::int;
  v_max    := COALESCE(public.encheck_seuil(p_enterprise, 'pause_duree_max_minutes', 120), 120)::int;
  v_tz     := public.encheck_fuseau(p_enterprise);
  -- Par NOM (leçon du préflight encheck_seuil) : l'appel utilise les noms de
  -- paramètres de l'app de pointage ; si la signature diffère, l'alerte est
  -- simplement ignorée (wrapper EXCEPTION dans encheck_pauses_alerter).
  v_has_poser := EXISTS (
    SELECT 1 FROM pg_proc p
      JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname = 'public' AND p.proname = 'encheck_alerte_poser');

  SELECT t.table_alertes, t.col_date INTO v_tbl, v_coldate
    FROM public.encheck_table_alertes() t;

  -- Règle d'option : sans option Planning, aucun créneau n'existe →
  -- rien à présumer ni à juger. (Les pauses pointées restent enregistrées.)
  v_plan := true;
  IF public.encheck_colonne_existe('enterprises', 'module_planning') THEN
    EXECUTE 'SELECT COALESCE(module_planning, true) FROM public.enterprises WHERE id = $1'
      INTO v_plan USING p_enterprise;
  END IF;

  FOR v_emp IN
    SELECT e.id, e.enterprise_id
      FROM public.employees e
     WHERE e.enterprise_id = p_enterprise
       AND COALESCE(e.is_active, true) = true
  LOOP
    -- ═══ A. PRÉSOMPTION — on marque, on n'invente pas en silence ═══
    IF COALESCE(v_plan, true) THEN
      v_jour := CURRENT_DATE - v_jours;
      WHILE v_jour <= CURRENT_DATE LOOP
        -- Un jour travaillé seulement (au moins un pointage ce jour-là) …
        v_r := public.encheck_journee_recalculee(v_emp.id, p_enterprise, v_jour);
        IF COALESCE((v_r->>'trouvee')::boolean, false)
           AND COALESCE((v_r->'grille'->>'est_jour_ouvre')::boolean, true) THEN
          -- … avec un créneau de pause en vigueur …
          v_prev := public.encheck_pause_prevue(v_emp.id, p_enterprise, v_jour);
          IF COALESCE((v_prev->>'trouvee')::boolean, false)
             AND COALESCE((v_prev->>'minutes')::int, 0) > 0
             -- … et AUCUNE pause connue pour ce jour :
             AND NOT EXISTS (
               SELECT 1 FROM public.encheck_pauses p
                WHERE p.employee_id = v_emp.id AND p.jour = v_jour
             ) THEN
            v_d := ((v_jour::timestamp + (v_prev->>'debut')::time) AT TIME ZONE v_tz);
            v_f := (((v_jour + CASE WHEN (v_prev->>'fin')::time < (v_prev->>'debut')::time
                                   THEN 1 ELSE 0 END)::timestamp
                     + (v_prev->>'fin')::time) AT TIME ZONE v_tz);
            -- Jamais dans le futur : la présomption attend la fin du créneau.
            IF v_f <= now() THEN
              INSERT INTO public.encheck_pauses
                (enterprise_id, employee_id, jour, debut, fin, duree_minutes,
                 statut, source, motif)
              VALUES
                (p_enterprise, v_emp.id, v_jour, v_d, v_f,
                 COALESCE((v_prev->>'minutes')::int, 0),
                 'presumee', 'presumee', 'créneau de la grille');
              v_n := v_n + 1;
            END IF;
          END IF;
        END IF;
        v_jour := v_jour + 1;
      END LOOP;
    END IF;

    -- ═══ B. ANOMALIES — une alerte par pause, jamais par balayage ═══
    FOR v_rec IN
      SELECT p.id, p.jour, p.debut, p.fin, p.duree_minutes, p.anomalie
        FROM public.encheck_pauses p
       WHERE p.employee_id = v_emp.id
         AND p.jour >= CURRENT_DATE - v_jours
         AND p.statut <> 'ecartee'
    LOOP
      IF v_rec.fin IS NULL AND v_rec.debut < now() - make_interval(mins => v_rappel)
         AND COALESCE(v_rec.anomalie, '') <> 'sans_reprise' THEN
        UPDATE public.encheck_pauses
           SET anomalie = 'sans_reprise', updated_at = now()
         WHERE id = v_rec.id;
        v_n := v_n + 1;
        PERFORM public.encheck_pauses_alerter(
          p_enterprise, v_emp.id, v_rec.jour, 'Pause sans reprise',
          'Pause débutée à ' || to_char(v_rec.debut AT TIME ZONE v_tz, 'HH24:MI') ||
          ' toujours sans pointage de reprise (' || v_rappel || ' min de rappel dépassées).',
          'moyenne', v_has_poser, v_tbl, v_coldate);

      ELSIF v_rec.fin IS NOT NULL
            AND COALESCE(v_rec.duree_minutes, 0) > v_max
            AND COALESCE(v_rec.anomalie, '') <> 'trop_longue' THEN
        UPDATE public.encheck_pauses
           SET anomalie = 'trop_longue', updated_at = now()
         WHERE id = v_rec.id;
        v_n := v_n + 1;
        PERFORM public.encheck_pauses_alerter(
          p_enterprise, v_emp.id, v_rec.jour, 'Pause très longue',
          'Pause de ' || v_rec.duree_minutes || ' min (' ||
          to_char(v_rec.debut AT TIME ZONE v_tz, 'HH24:MI') || ' → ' ||
          to_char(v_rec.fin AT TIME ZONE v_tz, 'HH24:MI') || ') pour un maximum de ' ||
          v_max || ' min.',
          'basse', v_has_poser, v_tbl, v_coldate);
      END IF;
    END LOOP;
  END LOOP;

  RETURN v_n;
END;
$$;

-- Pose d'alerte de pause : idempotente (une par titre/employé/jour) et
-- indépendante de `encheck_alerte_poser` (absente = on n'alerte pas, on ne casse rien).
CREATE OR REPLACE FUNCTION public.encheck_pauses_alerter(
  p_enterprise uuid, p_employee uuid, p_jour date,
  p_titre text, p_detail text, p_gravite text,
  p_has_poser boolean, p_tbl text, p_coldate text
)
RETURNS void
LANGUAGE plpgsql VOLATILE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_deja boolean := false;
BEGIN
  IF NOT COALESCE(p_has_poser, false) OR p_tbl IS NULL OR p_coldate IS NULL THEN
    RETURN;
  END IF;

  -- Idempotence : la même alerte n'est JAMAIS repoussée à chaque balayage.
  BEGIN
    EXECUTE format(
      'SELECT EXISTS (SELECT 1 FROM public.%I
        WHERE enterprise_id = $1 AND employee_id = $2
          AND (%I)::date = $3 AND titre = $4)',
      p_tbl, p_coldate)
      INTO v_deja USING p_enterprise, p_employee, p_jour, p_titre;
  EXCEPTION WHEN OTHERS THEN
    v_deja := false;
  END;
  IF COALESCE(v_deja, false) THEN
    RETURN;
  END IF;

  BEGIN
    PERFORM public.encheck_alerte_poser(
      p_enterprise := p_enterprise,
      p_employee   := p_employee,
      p_jour       := p_jour,
      p_type       := 'pause_anomalie',
      p_gravite    := p_gravite,
      p_titre      := p_titre,
      p_detail     := p_detail,
      p_ref        := NULL,
      p_appareil   := NULL
    );
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'Alerte pause non envoyée (sans conséquence) : %', SQLERRM;
  END;
END;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 9. ENCHECK_ALERTES_SCAN — enchaîne le contrôle des pauses
-- ─────────────────────────────────────────────────────────────────────────────
--  Identique à 20261016000003, plus `encheck_pauses_controler` (présomptions
--  et anomalies de pause) après le recalibrage des alertes.
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
  v_email := NULLIF(coalesce(auth.jwt() ->> 'email', ''), '');
  IF v_email IS NOT NULL AND NOT public.encheck_est_admin_de(p_enterprise) THEN
    RETURN 0;
  END IF;

  IF p_enterprise IS NULL THEN
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

  -- Pauses : présomptions (marquées) + anomalies (idempotentes).
  BEGIN
    PERFORM public.encheck_pauses_controler(p_enterprise);
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'Contrôle des pauses non exécuté (sans conséquence) : %', SQLERRM;
  END;

  RETURN COALESCE(v_purge, 0);
END;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 10. DROITS D'EXÉCUTION
-- ─────────────────────────────────────────────────────────────────────────────
REVOKE ALL ON FUNCTION public.encheck_pause_ouvrir(uuid, timestamptz, text)     FROM PUBLIC;
REVOKE ALL ON FUNCTION public.encheck_pause_fermer(uuid, timestamptz)           FROM PUBLIC;
REVOKE ALL ON FUNCTION public.encheck_pause_creer(uuid, timestamptz, timestamptz, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.encheck_pauses_statuer(uuid[], text, text)        FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.encheck_pauses_lire(uuid, date, date)             FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.encheck_pauses_controler(uuid)                    FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.encheck_pauses_alerter(uuid, uuid, date, text, text, text, boolean, text, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.encheck_pauses_duree_reelle(uuid, uuid, date)     FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.encheck_pause_ouvrir(uuid, timestamptz, text)  TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.encheck_pause_fermer(uuid, timestamptz)        TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.encheck_pause_creer(uuid, timestamptz, timestamptz, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.encheck_pauses_statuer(uuid[], text, text)     TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.encheck_pauses_lire(uuid, date, date)          TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.encheck_pauses_controler(uuid)                 TO postgres, service_role, authenticated;
GRANT EXECUTE ON FUNCTION public.encheck_pauses_alerter(uuid, uuid, date, text, text, text, boolean, text, text) TO postgres, service_role;
GRANT EXECUTE ON FUNCTION public.encheck_pauses_duree_reelle(uuid, uuid, date)  TO authenticated, service_role;

COMMIT;
