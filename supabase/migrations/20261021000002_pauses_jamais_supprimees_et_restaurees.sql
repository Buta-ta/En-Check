-- ═══════════════════════════════════════════════════════════════════════════
-- 20261021000002 — PAUSES : PLUS JAMAIS SUPPRIMÉES, ET LIGNES DÉJÀ PERDUES
--                  RESTAURÉES DEPUIS LE JOURNAL
-- ═══════════════════════════════════════════════════════════════════════════
--  FAUTIF TROUVÉ EN BASE LE 21/10/2026 (reproductible) :
--
--    `encheck_alerte_journaliser(p_table, p_id, …)` n'est PAS un journal :
--    c'est une PURGE. Elle copie la ligne dans `encheck_pointages_journal`,
--    puis exécute      DELETE FROM public.<p_table> WHERE id = p_id.
--
--    Or `encheck_pauses_statuer` — les boutons Valider / Écarter — l'appelle
--    avec p_table = 'encheck_pauses' en croyant ne faire que TRACER la
--    décision. ==> CHAQUE pause validée ou écartée était SUPPRIMÉE de la
--    table. D'où le symptôme terrain : la pause est listée, on clique
--    Valider, elle disparaît partout (liste, compteurs, journal).
--
--  PREUVE (test en transaction annulée, aucune trace laissée) :
--    après encheck_pause_ouvrir .......... 1 ligne (reelle/pointee)
--    après encheck_alerte_journaliser .... 0 ligne   <-- effacée
--
--  BONNE NOUVELLE : la purge faisait une COPIE INTÉGRALE avant de supprimer
--  (colonne `snapshot` jsonb de `encheck_pointages_journal`). Rien n'était
--  perdu : ce script restaure les pauses supprimées, puis verrouille le
--  mécanisme pour que ça ne puisse plus jamais arriver.
--
--  Idempotent (CREATE OR REPLACE, ON CONFLICT DO NOTHING, DROP POLICY IF
--  EXISTS). À copier-coller et exécuter dans l'éditeur SQL Supabase.
-- ═══════════════════════════════════════════════════════════════════════════

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. ENCHECK_JOURNAL_TRACER — le vrai journal : il NE SUPPRIME RIEN
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.encheck_journal_tracer(
  p_table      text,
  p_id         uuid,
  p_enterprise uuid,
  p_employee   uuid,
  p_motif      text DEFAULT NULL,
  p_action     text DEFAULT 'decision'
)
RETURNS void
LANGUAGE plpgsql VOLATILE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF p_id IS NULL OR p_table IS NULL THEN RETURN; END IF;
  EXECUTE format('INSERT INTO public.encheck_pointages_journal (enterprise_id, employee_id, attendance_id, action, motif, snapshot, pipeline, auteur) SELECT $1, $2, NULL, %L, $3, to_jsonb(a), %L, public.encheck_auteur_actuel() FROM public.%I a WHERE a.id = $4', p_action, 'encheck_journal_tracer', p_table)
    USING p_enterprise, p_employee, p_motif, p_id;
END;
$$;

COMMENT ON FUNCTION public.encheck_journal_tracer(text, uuid, uuid, uuid, text, text) IS
  'Journal d''audit pur : consigne une copie de la ligne et NE SUPPRIME JAMAIS. À utiliser pour tracer une décision.';

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. GARDE-FOU — encheck_alerte_journaliser ne touche plus aux données métier
-- ─────────────────────────────────────────────────────────────────────────────
--  La purge reste active pour les tables d'alertes (son rôle d'origine, la
--  table s'appelle `encheck_alertes`), mais une pause, un pointage, un employé
--  ne sont PLUS jamais supprimables par ce biais — même si un autre appelant
--  refait la même erreur demain.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.encheck_alerte_journaliser(
  p_table      text,
  p_id         uuid,
  p_enterprise uuid,
  p_employee   uuid,
  p_motif      text
)
RETURNS void
LANGUAGE plpgsql VOLATILE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  -- Copie intégrale AVANT suppression : une alerte effacée reste consultable.
  EXECUTE format('INSERT INTO public.encheck_pointages_journal (enterprise_id, employee_id, attendance_id, action, motif, snapshot, pipeline, auteur) SELECT $1, $2, NULL, %L, $3, to_jsonb(a), %L, public.encheck_auteur_actuel() FROM public.%I a WHERE a.id = $4', 'alerte_supprimee', 'encheck_alertes_purger', p_table)
    USING p_enterprise, p_employee, p_motif, p_id;

  -- GARDE-FOU : jamais de suppression dans une table de données métier.
  IF lower(coalesce(p_table, '')) IN ('encheck_pauses', 'attendances', 'employees', 'pointages', 'encheck_pointages') THEN
    RETURN;
  END IF;

  EXECUTE format('DELETE FROM public.%I WHERE id = $1', p_table) USING p_id;
END;
$$;

COMMENT ON FUNCTION public.encheck_alerte_journaliser(text, uuid, uuid, uuid, text) IS
  'Purge d''alertes : copie la ligne au journal PUIS la supprime — mais JAMAIS dans encheck_pauses, attendances, employees ou pointages (garde-fou du 21/10/2026).';

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. ENCHECK_PAUSES_STATUER — même code qu'avant, journal PUR au lieu de la purge
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

    -- Journal d'audit : la décision est gravée et LA LIGNE RESTE.
    BEGIN
      PERFORM public.encheck_journal_tracer('encheck_pauses', v_id, v_ent, v_emp,
        CASE WHEN v_new = 'validee' THEN 'pause validée par l''admin'
             ELSE 'pause écartée par l''admin' END ||
        COALESCE(' — ' || p_motif, ''),
        CASE WHEN v_new = 'validee' THEN 'pause_validee' ELSE 'pause_ecartee' END);
    EXCEPTION WHEN OTHERS THEN
      NULL; -- le journal ne doit jamais empêcher de statuer
    END;
    v_n := v_n + 1;
  END LOOP;
  RETURN v_n;
END;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. ENCHECK_PAUSES_ANNULER_DECISION — idem, journal PUR
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.encheck_pauses_annuler_decision(
  p_ids   uuid[],
  p_motif text DEFAULT NULL
)
RETURNS integer
LANGUAGE plpgsql VOLATILE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_id   uuid;
  v_ent  uuid;
  v_emp  uuid;
  v_src  text;
  v_old  text;
  v_n    integer := 0;
BEGIN
  IF p_ids IS NULL OR COALESCE(array_length(p_ids, 1), 0) = 0 THEN
    RAISE EXCEPTION 'aucune pause sélectionnée';
  END IF;

  FOREACH v_id IN ARRAY p_ids LOOP
    SELECT enterprise_id, employee_id, source, statut INTO v_ent, v_emp, v_src, v_old
      FROM public.encheck_pauses WHERE id = v_id;
    IF v_ent IS NULL THEN
      CONTINUE;
    END IF;
    IF NULLIF(coalesce(auth.jwt() ->> 'email', ''), '') IS NOT NULL
       AND NOT public.encheck_est_admin_de(v_ent) THEN
      RAISE EXCEPTION 'non autorisé pour cette entreprise';
    END IF;

    UPDATE public.encheck_pauses
       SET statut = CASE WHEN COALESCE(v_src, 'pointee') = 'presumee' THEN 'presumee' ELSE 'reelle' END,
           motif = COALESCE(p_motif, motif),
           updated_at = now()
     WHERE id = v_id;
    v_n := v_n + 1;

    BEGIN
      PERFORM public.encheck_journal_tracer('encheck_pauses', v_id, v_ent, v_emp,
        'décision annulée (' || COALESCE(v_old, '?') || ' → ' ||
        CASE WHEN COALESCE(v_src, 'pointee') = 'presumee' THEN 'presumee' ELSE 'reelle' END || ')' ||
        COALESCE(' — ' || p_motif, ''),
        'decision_annulee');
    EXCEPTION WHEN OTHERS THEN
      NULL;
    END;
  END LOOP;

  RETURN v_n;
END;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 5. RESTAURATION — les pauses supprimées reviennent depuis les snapshots
-- ─────────────────────────────────────────────────────────────────────────────
--  Idempotent : ON CONFLICT (id) DO NOTHING + exclusion des doublons déjà
--  présents (même employé, même début). Le statut d'origine (validee /
--  ecartee) est conservé tel qu'il était au moment de la décision.
-- ─────────────────────────────────────────────────────────────────────────────
INSERT INTO public.encheck_pauses
  (id, enterprise_id, employee_id, jour, debut, fin, duree_minutes,
   statut, source, motif, anomalie, cree_par, created_at, updated_at)
SELECT
  (s->>'id')::uuid,
  (s->>'enterprise_id')::uuid,
  (s->>'employee_id')::uuid,
  (s->>'jour')::date,
  (s->>'debut')::timestamptz,
  NULLIF(s->>'fin', '')::timestamptz,
  NULLIF(s->>'duree_minutes', '')::integer,
  s->>'statut',
  s->>'source',
  s->>'motif',
  s->>'anomalie',
  s->>'cree_par',
  COALESCE((s->>'created_at')::timestamptz, now()),
  COALESCE((s->>'updated_at')::timestamptz, now())
FROM (
  SELECT DISTINCT ON (snapshot->>'id') snapshot AS s
    FROM public.encheck_pointages_journal
   WHERE snapshot IS NOT NULL
     AND snapshot->>'source' IN ('pointee', 'presumee', 'admin')
     AND (snapshot->>'duree_minutes') IS NOT NULL
     AND (snapshot->>'debut') IS NOT NULL
     AND (snapshot->>'jour') IS NOT NULL
     AND (snapshot->>'id') IS NOT NULL
   ORDER BY snapshot->>'id', horodatage DESC
) r
WHERE NOT EXISTS (
  SELECT 1 FROM public.encheck_pauses p
   WHERE p.employee_id = (s->>'employee_id')::uuid
     AND p.debut       = (s->>'debut')::timestamptz
)
ON CONFLICT (id) DO NOTHING;

-- ─────────────────────────────────────────────────────────────────────────────
-- 6. LECTURE DIRECTE — politique RLS
-- ─────────────────────────────────────────────────────────────────────────────
--  La table avait RLS active SANS AUCUNE politique : les lectures directes de
--  Dashboard / Employés / Pointages / Pauses renvoyaient donc toujours vide,
--  silencieusement. On ouvre la LECTURE aux admins de l'entreprise (les
--  écritures restent passées par les fonctions SECURITY DEFINER).
-- ─────────────────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS encheck_pauses_lecture_admin ON public.encheck_pauses;
CREATE POLICY encheck_pauses_lecture_admin
  ON public.encheck_pauses
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.admins a
       WHERE lower(a.email) = lower(coalesce(auth.jwt() ->> 'email', ''))
         AND a.is_active = true
         AND a.role = 'super_admin'
    )
    OR public.encheck_est_admin_de(enterprise_id)
  );

-- ─────────────────────────────────────────────────────────────────────────────
-- 7. DROITS
-- ─────────────────────────────────────────────────────────────────────────────
GRANT EXECUTE ON FUNCTION public.encheck_journal_tracer(text, uuid, uuid, uuid, text, text) TO authenticated, service_role;
REVOKE ALL ON FUNCTION public.encheck_journal_tracer(text, uuid, uuid, uuid, text, text) FROM PUBLIC, anon;

-- ═══════════════════════════════════════════════════════════════════════════
-- CONTRÔLE APRÈS EXÉCUTION
-- ═══════════════════════════════════════════════════════════════════════════
--  Test non destructif (tout est annulé par l'exception finale) :
--
--  DO $$
--  DECLARE v_id uuid; a text; b text;
--  BEGIN
--    v_id := (public.encheck_pause_ouvrir('<id_employe>', now(), 'controle')->>'pause_id')::uuid;
--    SELECT coalesce(statut,'?') INTO a FROM public.encheck_pauses WHERE id = v_id;
--    PERFORM public.encheck_pauses_statuer(ARRAY[v_id], 'valider', NULL);
--    SELECT coalesce(statut,'?') INTO b FROM public.encheck_pauses WHERE id = v_id;
--    RAISE EXCEPTION 'avant=% apres=%', a, coalesce(b,'DISPARUE');
--  END $$;
--
--  Attendu : avant=reelle apres=validee   (avant le correctif : apres=DISPARUE)
-- ═══════════════════════════════════════════════════════════════════════════
