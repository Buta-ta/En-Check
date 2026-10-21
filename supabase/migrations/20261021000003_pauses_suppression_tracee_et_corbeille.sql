-- ═══════════════════════════════════════════════════════════════════════════
-- 20261021000003 — SUPPRIMER UNE PAUSE : POSSIBLE, MAIS TRACÉ ET RÉVERSIBLE
-- ═══════════════════════════════════════════════════════════════════════════
--  Demande : « il n'y a pas de bouton supprimer pour supprimer une pause ».
--
--  Doctrine En-Check : on peut retirer une ligne — un doublon, une saisie
--  erronée — mais JAMAIS dans le silence. Toute suppression passe donc par
--  une ARCHIVE (copie intégrale dans `encheck_pointages_journal`) avant
--  l'effacement, et reste RESTAURABLE depuis la corbeille.
--
--  Trois fonctions :
--    · encheck_pauses_supprimer(p_ids, p_motif)         → archive PUIS efface
--    · encheck_pauses_archives_lire(p_enterprise, …)    → la corbeille
--    · encheck_pauses_restaurer(p_journal_ids)          → remet la ligne
--
--  Idempotent (CREATE OR REPLACE). À copier-coller et exécuter dans
--  l'éditeur SQL Supabase.
-- ═══════════════════════════════════════════════════════════════════════════

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. ENCHECK_PAUSES_SUPPRIMER — archiver PUIS effacer
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.encheck_pauses_supprimer(
  p_ids   uuid[],
  p_motif text DEFAULT NULL
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
  v_n   integer := 0;
BEGIN
  IF p_ids IS NULL OR COALESCE(array_length(p_ids, 1), 0) = 0 THEN
    RAISE EXCEPTION 'aucune pause sélectionnée';
  END IF;

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

    -- ARCHIVAGE OBLIGATOIRE : la ligne est recopiée AVANT d'être retirée.
    INSERT INTO public.encheck_pointages_journal
      (enterprise_id, employee_id, attendance_id, action, motif, snapshot, pipeline, auteur)
    SELECT p.enterprise_id, p.employee_id, NULL, 'pause_supprimee',
           COALESCE(p_motif, 'pause supprimée par l''admin'), to_jsonb(p),
           'encheck_pauses_supprimer', public.encheck_auteur_actuel()
      FROM public.encheck_pauses p
     WHERE p.id = v_id;

    DELETE FROM public.encheck_pauses WHERE id = v_id;
    v_n := v_n + 1;
  END LOOP;

  RETURN v_n;
END;
$$;

COMMENT ON FUNCTION public.encheck_pauses_supprimer(uuid[], text) IS
  'Supprime des pauses — mais ARCHIVE d''abord chaque ligne (snapshot complet) pour qu''elles restent consultables et restaurables.';

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. ENCHECK_PAUSES_ARCHIVES_LIRE — la corbeille
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.encheck_pauses_archives_lire(
  p_enterprise uuid DEFAULT NULL,
  p_du         date DEFAULT NULL,
  p_au         date DEFAULT NULL
)
RETURNS TABLE (
  journal_id    bigint,
  id            uuid,
  employe_id    uuid,
  prenom        text,
  nom           text,
  matricule     text,
  jour          date,
  debut         timestamptz,
  fin           timestamptz,
  duree_minutes integer,
  statut        text,
  source        text,
  motif         text,
  supprime_le   timestamptz,
  restaurable   boolean
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

  v_du := COALESCE(p_du, CURRENT_DATE - 30);
  v_au := COALESCE(p_au, CURRENT_DATE);

  RETURN QUERY
    SELECT j.id,
           (j.snapshot->>'id')::uuid,
           e.id,
           e.first_name::text,
           e.last_name::text,
           e.matricule::text,
           (j.snapshot->>'jour')::date,
           (j.snapshot->>'debut')::timestamptz,
           NULLIF(j.snapshot->>'fin', '')::timestamptz,
           NULLIF(j.snapshot->>'duree_minutes', '')::integer,
           j.snapshot->>'statut',
           j.snapshot->>'source',
           j.snapshot->>'motif',
           j.horodatage,
           NOT EXISTS (
             SELECT 1 FROM public.encheck_pauses p
              WHERE p.employee_id = (j.snapshot->>'employee_id')::uuid
                AND p.debut       = (j.snapshot->>'debut')::timestamptz
           )
      FROM public.encheck_pointages_journal j
      JOIN public.employees e ON e.id = (j.snapshot->>'employee_id')::uuid
     WHERE j.action = 'pause_supprimee'
       AND (j.snapshot->>'jour') IS NOT NULL
       AND (j.snapshot->>'jour')::date BETWEEN v_du AND v_au
       AND (p_enterprise IS NULL OR j.enterprise_id = p_enterprise)
     ORDER BY j.horodatage DESC;
END;
$$;

COMMENT ON FUNCTION public.encheck_pauses_archives_lire(uuid, date, date) IS
  'Corbeille des pauses supprimées : tout ce qui a été retiré, avec la possibilité de le remettre.';

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. ENCHECK_PAUSES_RESTAURER — remettre une pause depuis la corbeille
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.encheck_pauses_restaurer(
  p_journal_ids bigint[]
)
RETURNS integer
LANGUAGE plpgsql VOLATILE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_jid      bigint;
  v_snapshot jsonb;
  v_ent      uuid;
  v_n        integer := 0;
BEGIN
  IF p_journal_ids IS NULL OR COALESCE(array_length(p_journal_ids, 1), 0) = 0 THEN
    RAISE EXCEPTION 'aucune archive sélectionnée';
  END IF;

  FOREACH v_jid IN ARRAY p_journal_ids LOOP
    SELECT j.snapshot, j.enterprise_id INTO v_snapshot, v_ent
      FROM public.encheck_pointages_journal j
     WHERE j.id = v_jid AND j.action = 'pause_supprimee';
    IF v_snapshot IS NULL THEN
      CONTINUE;
    END IF;
    IF NULLIF(coalesce(auth.jwt() ->> 'email', ''), '') IS NOT NULL
       AND NOT public.encheck_est_admin_de(v_ent) THEN
      RAISE EXCEPTION 'non autorisé pour cette entreprise';
    END IF;

    -- On ne restaure JAMAIS par-dessus une pause existante.
    IF EXISTS (
      SELECT 1 FROM public.encheck_pauses p
       WHERE p.employee_id = (v_snapshot->>'employee_id')::uuid
         AND p.debut       = (v_snapshot->>'debut')::timestamptz
    ) THEN
      CONTINUE;
    END IF;

    INSERT INTO public.encheck_pauses
      (id, enterprise_id, employee_id, jour, debut, fin, duree_minutes,
       statut, source, motif, anomalie, cree_par, created_at, updated_at)
    VALUES
      ((v_snapshot->>'id')::uuid,
       (v_snapshot->>'enterprise_id')::uuid,
       (v_snapshot->>'employee_id')::uuid,
       (v_snapshot->>'jour')::date,
       (v_snapshot->>'debut')::timestamptz,
       NULLIF(v_snapshot->>'fin', '')::timestamptz,
       NULLIF(v_snapshot->>'duree_minutes', '')::integer,
       COALESCE(v_snapshot->>'statut', 'reelle'),
       COALESCE(v_snapshot->>'source', 'pointee'),
       v_snapshot->>'motif',
       v_snapshot->>'anomalie',
       v_snapshot->>'cree_par',
       COALESCE((v_snapshot->>'created_at')::timestamptz, now()),
       now())
    ON CONFLICT (id) DO NOTHING;

    v_n := v_n + 1;
  END LOOP;

  RETURN v_n;
END;
$$;

COMMENT ON FUNCTION public.encheck_pauses_restaurer(bigint[]) IS
  'Remet une pause supprimée depuis son archive. Refuse d''écraser une pause existante.';

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. DROITS
-- ─────────────────────────────────────────────────────────────────────────────
GRANT EXECUTE ON FUNCTION public.encheck_pauses_supprimer(uuid[], text)          TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.encheck_pauses_archives_lire(uuid, date, date)  TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.encheck_pauses_restaurer(bigint[])              TO authenticated, service_role;
REVOKE ALL ON FUNCTION public.encheck_pauses_supprimer(uuid[], text)             FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.encheck_pauses_archives_lire(uuid, date, date)     FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.encheck_pauses_restaurer(bigint[])                 FROM PUBLIC, anon;
