-- ═══════════════════════════════════════════════════════════════════════════
-- 🔒 LOT « PAUSES » — LES GARDES D'ÉCRITURE CESSENT D'ÊTRE OUVERTES
--
-- LE DÉFAUT, TEL QU'IL ÉTAIT ÉCRIT
-- ────────────────────────────────────────────────────────────────────────────
-- Cinq fonctions d'écriture commençaient par :
--
--     IF NULLIF(coalesce(auth.jwt() ->> 'email', ''), '') IS NOT NULL
--        AND NOT public.encheck_est_admin_de(p_enterprise) THEN
--       RAISE EXCEPTION 'non autorisé';
--     END IF;
--
-- L'intention est claire : « si quelqu'un est connecté, on vérifie ses
-- droits ». Mais la condition attend un booléen à TROIS états. Quand il n'y
-- a pas de JWT — un visiteur non connecté, le rôle `anon` — l'email est
-- NULL, la première moitié vaut NULL, et `NULL AND FALSE` vaut NULL. Un `IF`
-- ne s'exécute pas sur NULL. **La garde s'ouvrait précisément dans le cas
-- qu'elle devait fermer.**
--
-- C'est le pendant exact de l'erreur déjà corrigée sur le côté lecture
-- (`encheck_pauses_lire`) : une garde raisonnable sur le papier, qui suppose
-- que l'absence d'identité est un cas impossible. Elle ne l'est pas.
--
-- CE QUI A ÉTÉ MESURÉ, LE 23/11, SUR LA PRODUCTION
-- ────────────────────────────────────────────────────────────────────────────
-- Sous `BEGIN … ROLLBACK`, en rôle `anon`, sans JWT :
--
--     encheck_pause_creer(REC-0002, -3h, -2h)  → {"ok": true, "pause_id": …}
--     encheck_pauses_annuler_decision([id])     → 1
--
-- Aucune trace en base après le ROLLBACK, vérifié.
--
-- LA CORRECTION
-- ────────────────────────────────────────────────────────────────────────────
-- On refuse quand il n'y a **pas** d'identité, puis on vérifie les droits.
-- Les deux cas sont explicites, et aucun des deux ne dépend d'un NULL.
--
--     IF auth.uid() IS NULL THEN RAISE … 42501;
--     IF NOT public.encheck_est_admin_de(p_enterprise) THEN RAISE … 42501;
--
-- POURQUOI `auth.uid()` ET NON L'EMAIL
-- ────────────────────────────────────────────────────────────────────────────
-- L'email vient du JWT : correct et non falsifiable. Mais `auth.uid()` est
-- plus direct pour dire « y a-t-il une session ? », et il fonctionne aussi
-- pour les comptes qui n'auraient pas d'email. On garde les deux lectures —
-- `uid` OU email — pour rester compatible avec les administrateurs existants
-- dont le lien ne serait fait que par l'email.
--
-- CE QUI NE CHANGE PAS
-- ────────────────────────────────────────────────────────────────────────────
-- · Les administrateurs connectés : `Pauses.jsx` s'authentifie par mot de
--   passe Supabase, donc porte un JWT. Rien à modifier côté web.
-- · Les signatures, les colonnes de retour, les corps métier : intacts.
--   On ne remplace que les gardes.
-- · Aucune tâche planifiée n'appelle ces fonctions (vérifié : les 3 `cron.job`
--   ne touchent pas `encheck_pauses`).
--
-- ⚠️ `CREATE OR REPLACE FUNCTION` conserve la signature ET l'ACL existants.
--    C'est voulu ici : on ne change pas QUI peut appeler, on change ce que
--    l'appel vérifie. `anon` peut toujours tenter l'appel — il recevra 42501.
-- ═══════════════════════════════════════════════════════════════════════════

BEGIN;

-- ───────────────────────────────────────────────────────────────────────────
-- 1. encheck_pause_creer — créer une pause pour un employé
-- ───────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.encheck_pause_creer(
  p_employee uuid,
  p_debut    timestamptz,
  p_fin      timestamptz,
  p_motif    text DEFAULT NULL::text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE
  v_emp record;
  v_id  uuid;
  v_jour date;
  v_tz  text;
BEGIN
  --  GARDE : sans session, on refuse. Avant, cette ligne laissait passer.
  IF auth.uid() IS NULL
     AND NULLIF(coalesce(auth.jwt() ->> 'email', ''), '') IS NULL THEN
    RAISE EXCEPTION 'non authentifié : création de pause réservée aux administrateurs'
      USING ERRCODE = '42501';
  END IF;

  SELECT e.id, e.enterprise_id INTO v_emp
    FROM public.employees e
   WHERE e.id = p_employee AND COALESCE(e.is_active, true) = true;
  IF v_emp IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'erreur', 'employé inconnu ou inactif');
  END IF;
  IF p_debut IS NULL OR p_fin IS NULL OR p_fin <= p_debut THEN
    RETURN jsonb_build_object('ok', false, 'erreur', 'intervalle invalide');
  END IF;

  --  GARDE : identité prouvée, on vérifie maintenant les droits.
  IF NOT public.encheck_est_admin_de(v_emp.enterprise_id) THEN
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

-- ───────────────────────────────────────────────────────────────────────────
-- 2. encheck_pauses_statuer — valider / écarter (décision de paie)
-- ───────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.encheck_pauses_statuer(
  p_ids      uuid[],
  p_decision text,
  p_motif    text DEFAULT NULL::text
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE
  v_id  uuid;
  v_ent uuid;
  v_emp uuid;
  v_new text;
  v_n   integer := 0;
BEGIN
  IF auth.uid() IS NULL
     AND NULLIF(coalesce(auth.jwt() ->> 'email', ''), '') IS NULL THEN
    RAISE EXCEPTION 'non authentifié : décision réservée aux administrateurs'
      USING ERRCODE = '42501';
  END IF;

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
    IF NOT public.encheck_est_admin_de(v_ent) THEN
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

-- ───────────────────────────────────────────────────────────────────────────
-- 3. encheck_pauses_supprimer — effacer (archivage obligatoire d'abord)
-- ───────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.encheck_pauses_supprimer(
  p_ids   uuid[],
  p_motif text DEFAULT NULL::text
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE
  v_id  uuid;
  v_ent uuid;
  v_emp uuid;
  v_n   integer := 0;
BEGIN
  IF auth.uid() IS NULL
     AND NULLIF(coalesce(auth.jwt() ->> 'email', ''), '') IS NULL THEN
    RAISE EXCEPTION 'non authentifié : suppression réservée aux administrateurs'
      USING ERRCODE = '42501';
  END IF;

  IF p_ids IS NULL OR COALESCE(array_length(p_ids, 1), 0) = 0 THEN
    RAISE EXCEPTION 'aucune pause sélectionnée';
  END IF;

  FOREACH v_id IN ARRAY p_ids LOOP
    SELECT enterprise_id, employee_id INTO v_ent, v_emp
      FROM public.encheck_pauses WHERE id = v_id;
    IF v_ent IS NULL THEN
      CONTINUE;
    END IF;
    IF NOT public.encheck_est_admin_de(v_ent) THEN
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

-- ───────────────────────────────────────────────────────────────────────────
-- 4. encheck_pauses_annuler_decision — revenir sur une décision
-- ───────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.encheck_pauses_annuler_decision(
  p_ids   uuid[],
  p_motif text DEFAULT NULL::text
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE
  v_id   uuid;
  v_ent  uuid;
  v_emp  uuid;
  v_src  text;
  v_old  text;
  v_n    integer := 0;
BEGIN
  IF auth.uid() IS NULL
     AND NULLIF(coalesce(auth.jwt() ->> 'email', ''), '') IS NULL THEN
    RAISE EXCEPTION 'non authentifié : annulation réservée aux administrateurs'
      USING ERRCODE = '42501';
  END IF;

  IF p_ids IS NULL OR COALESCE(array_length(p_ids, 1), 0) = 0 THEN
    RAISE EXCEPTION 'aucune pause sélectionnée';
  END IF;

  FOREACH v_id IN ARRAY p_ids LOOP
    SELECT enterprise_id, employee_id, source, statut INTO v_ent, v_emp, v_src, v_old
      FROM public.encheck_pauses WHERE id = v_id;
    IF v_ent IS NULL THEN
      CONTINUE;
    END IF;
    IF NOT public.encheck_est_admin_de(v_ent) THEN
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

-- ───────────────────────────────────────────────────────────────────────────
-- 5. encheck_pauses_restaurer — restaurer depuis l'archive
-- ───────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.encheck_pauses_restaurer(
  p_journal_ids bigint[]
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE
  v_jid      bigint;
  v_snapshot jsonb;
  v_ent      uuid;
  v_n        integer := 0;
BEGIN
  IF auth.uid() IS NULL
     AND NULLIF(coalesce(auth.jwt() ->> 'email', ''), '') IS NULL THEN
    RAISE EXCEPTION 'non authentifié : restauration réservée aux administrateurs'
      USING ERRCODE = '42501';
  END IF;

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
    IF NOT public.encheck_est_admin_de(v_ent) THEN
      RAISE EXCEPTION 'non autorisé pour cette entreprise';
    END IF;

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

-- ───────────────────────────────────────────────────────────────────────────
-- VÉRIFICATION — la migration échoue si la garde n'est pas en place.
--
-- On relit le source en base, pas le fichier : c'est la seule chose qui
-- prouve ce que PostgreSQL exécutera vraiment.
-- ───────────────────────────────────────────────────────────────────────────
DO $$
DECLARE
  v_fautif text;
  v_ok     text;
BEGIN
  IF (SELECT count(*) FROM pg_proc p
        JOIN pg_namespace n ON n.oid = p.pronamespace
       WHERE n.nspname = 'public'
         AND p.proname IN ('encheck_pause_creer','encheck_pauses_statuer',
                           'encheck_pauses_supprimer','encheck_pauses_annuler_decision',
                           'encheck_pauses_restaurer')
         AND p.prosrc LIKE '%auth.uid() IS NULL%') <> 5 THEN
    RAISE EXCEPTION 'les gardes ne sont pas en place sur les 5 fonctions : migration inapplicable';
  END IF;

  --  Aucune des cinq ne doit plus contenir le motif fautif.
  SELECT string_agg(p.proname, ', ') INTO v_fautif
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
   WHERE n.nspname = 'public'
     AND p.proname IN ('encheck_pause_creer','encheck_pauses_statuer',
                       'encheck_pauses_supprimer','encheck_pauses_annuler_decision',
                       'encheck_pauses_restaurer')
     AND p.prosrc LIKE '%  IF NULLIF(coalesce(auth.jwt() ->> ''email'', '''')'') IS NOT NULL%';
  IF v_fautif IS NOT NULL THEN
    RAISE EXCEPTION 'garde fautive encore présente dans : %', v_fautif;
  END IF;

  IF EXISTS (
    SELECT 1 FROM pg_proc p
      JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname = 'public'
       AND p.proname IN ('encheck_pause_creer','encheck_pauses_statuer',
                         'encheck_pauses_supprimer','encheck_pauses_annuler_decision',
                         'encheck_pauses_restaurer')
       AND (p.proconfig IS NULL OR NOT (p.proconfig @> ARRAY['search_path=public, pg_temp']))
  ) THEN
    RAISE EXCEPTION 'search_path verrouillé perdu sur au moins une fonction';
  END IF;

  RAISE NOTICE 'gardes d''écriture vérifiées : les 5 fonctions refusent désormais sans session';
END;
$$;

COMMIT;
