-- ═══════════════════════════════════════════════════════════════════════════
-- 20261016000005 — SORTIES PRÉSUMÉES : TOUJOURS STATUABLES, RESTENT MARQUÉES
-- ═══════════════════════════════════════════════════════════════════════════
--  Décision du commanditaire (16/10/2026 soir) :
--    « je voudrais que les sorties présumées soient toujours statuer :
--     quand l'admin valide, l'heure de sortie présumée reste et est marquée
--     dans « modifier le pointage », quand l'admin écarte, ces heures
--     présumées disparaissent. »
--
--  Ce script (à copier-coller et exécuter dans l'éditeur SQL Supabase) :
--    1. RÉPARE `encheck_pauses_lire` — erreur 42804 « Returned type character
--       varying(100) does not match expected type text in column 3 » : les
--       colonnes `varchar(N)` de employees/enterprises doivent être CASTÉES
--       en `text` pour coller au RETURNS TABLE (sinon la page Pauses est en
--       400). Rien d'autre n'est touché.
--    2. `encheck_estimation_decider` — le contrat « TOUJOURS STATUER » :
--       ligne en base OU sortie inventée à l'écran (mode ombre), les boutons
--       Valider/Écarter fonctionnent. Valider CONSIGNE l'heure présumée
--       (marquée, jamais blanchie en badge) ; Écarter MARQUE l'heure
--       « écartée » (hors calcul, invisible dans la fiche, conservée pour
--       l'audit — on ne supprime jamais rien).
--    3. `encheck_estimation_deplacer` — déplacer une heure présumée depuis la
--       fiche « Modifier le pointage » SANS perdre sa marque d'origine (la
--       fiche ne passe plus ces lignes par `replace_attendance_day`, qui ne
--       recopie que check_type/check_time et « blanchissait » la ligne).
--
--  SÉCURITÉ PRODUCTION : vérification de schéma en tête (par NOM, leçon du
--  préflight encheck_seuil du 16/10), transactionnel, idempotent (CREATE OR
--  REPLACE), n'utilise que des colonnes créées par nos migrations ou par le
--  schéma de base (attendances.check_time/check_type/method/is_auto_closed +
--  colonnes estimation_* de 20261016000001).
-- ═══════════════════════════════════════════════════════════════════════════

BEGIN;

-- ─────────────────────────────────────────────────────────────────────────────
-- 0. PRÉFLIGHT — par NOM via pg_proc (jamais par signature exacte)
-- ─────────────────────────────────────────────────────────────────────────────
DO $$
DECLARE v_manquant text;
BEGIN
  SELECT string_agg(f.nom, ', ') INTO v_manquant
  FROM (VALUES
         ('encheck_est_admin_de'),
         ('encheck_auteur_actuel'),
         ('encheck_estimation_statuer'),
         ('encheck_pauses_lire')
       ) AS f(nom)
  WHERE NOT EXISTS (
    SELECT 1 FROM pg_proc p
      JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname = 'public' AND p.proname = f.nom
   );
  IF v_manquant IS NOT NULL THEN
    RAISE EXCEPTION 'Préflight : fonctions introuvables (%) — exécutez d''abord '
      '20261016000001 puis 20261016000004, et relancez ce script en entier. '
      'Rien n''a été appliqué.', v_manquant;
  END IF;
END $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. RÉPARATION — encheck_pauses_lire (42804 : varchar(100) ≠ text)
-- ─────────────────────────────────────────────────────────────────────────────
--  Postgres exige que le type RENVOYÉ par chaque colonne du RETURN QUERY
--  corresponde EXACTEMENT au RETURNS TABLE. `employees.first_name` & co sont
--  déclarés varchar(N) par le schéma Prisma ; le RETURNS TABLE annonce text.
--  Leçon : caster en `::text` tout ce qui vient d'une colonne étrangère.
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
-- 2. ENCHECK_ESTIMATION_DECIDER — « toujours statuer » (base ET écran)
-- ─────────────────────────────────────────────────────────────────────────────
--  Contrat du navigateur (les NOMS des paramètres font foi — leçon 404 du
--  16/10) :
--    encheck_estimation_decider(
--      p_id uuid,             -- ligne attendances (NULL si sortie à l'écran)
--      p_source uuid,         -- estimation_source_id = pointage d'ENTRÉE
--      p_decision text,       -- 'valider' | 'rejeter'
--      p_heure_sortie timestamptz, p_niveau smallint, p_confiance text,
--      p_motif text)
--    → jsonb {ok, statut, ligne_id, consignee, erreur}
--
--  RÈGLES (doctrine « on invente, on marque, on n'encaisse pas ») :
--    · VALIDER = l'heure présumée RESTE, marquée (is_auto_closed +
--      estimation_validee_le + estimation_source_id) — elle paie, elle n'est
--      JAMAIS blanchie en badge ;
--    · ÉCARTER = l'heure présumée DISPARAÎT des écrans de travail (hors
--      calcul, fiche « Modifier » vide) — la ligne reste en base pour l'audit
--      (anomalie 'sortie_presumee_rejetee'), jamais supprimée ;
--    · une décision est DÉFINITIVE (jamais deux fois la même question) ;
--    · un vrai badge qui arrive rend l'estimation périmée (remplacée) : plus
--      aucune décision n'est possible dessus.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.encheck_estimation_decider(
  p_id           uuid,
  p_source       uuid,
  p_decision     text,
  p_heure_sortie timestamptz DEFAULT NULL,
  p_niveau       smallint DEFAULT NULL,
  p_confiance    text DEFAULT NULL,
  p_motif        text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql VOLATILE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_row      record;
  v_ent      uuid;
  v_emp      uuid;
  v_ligne    uuid;
  v_detail   jsonb;
BEGIN
  IF p_decision IS NULL OR p_decision NOT IN ('valider', 'rejeter') THEN
    RETURN jsonb_build_object('ok', false, 'erreur',
      'décision inconnue : ' || coalesce(p_decision, 'NULL'));
  END IF;

  -- ── 1) La ligne existe-t-elle déjà en base ? (par id, sinon par source) ──
  IF p_id IS NOT NULL THEN
    SELECT e.* INTO v_row FROM public.attendances e WHERE e.id = p_id;
  END IF;
  IF v_row IS NULL AND p_source IS NOT NULL THEN
    SELECT e.* INTO v_row FROM public.attendances e
     WHERE e.estimation_source_id = p_source
       AND e.estimation_remplacee_le IS NULL
     ORDER BY e.created_at DESC
     LIMIT 1;
  END IF;

  IF v_row IS NOT NULL THEN
    v_ent := v_row.enterprise_id;
    IF NOT public.encheck_est_admin_de(v_ent) THEN
      RETURN jsonb_build_object('ok', false, 'erreur', 'non autorisé pour cette entreprise');
    END IF;

    -- Un vrai badge a remplacé l'estimation : la vérité terrain fait foi.
    IF v_row.estimation_remplacee_le IS NOT NULL
       AND coalesce(v_row.anomalie, '') <> 'sortie_presumee_rejetee' THEN
      RETURN jsonb_build_object('ok', false, 'statut', 'remplacee', 'erreur',
        'un vrai pointage a remplacé cette estimation : rien à statuer');
    END IF;

    IF p_decision = 'valider' THEN
      IF v_row.estimation_validee_le IS NOT NULL THEN
        RETURN jsonb_build_object('ok', true, 'statut', 'deja_statuee',
          'ligne_id', v_row.id, 'consignee', false);
      END IF;
      IF v_row.estimation_remplacee_le IS NOT NULL THEN
        -- Écartée puis « Valider » : la décision d'origine est définitive.
        RETURN jsonb_build_object('ok', true, 'statut', 'deja_statuee',
          'ligne_id', v_row.id, 'consignee', false);
      END IF;
      UPDATE public.attendances e
         SET estimation_validee_le  = now(),
             estimation_validee_par = public.encheck_auteur_actuel(),
             anomalie               = NULL,
             estimation_detail      = coalesce(e.estimation_detail, '{}'::jsonb)
                                  || jsonb_build_object('motif_validation', p_motif)
       WHERE e.id = v_row.id;
    ELSE
      IF v_row.estimation_remplacee_le IS NOT NULL
         AND coalesce(v_row.anomalie, '') = 'sortie_presumee_rejetee' THEN
        RETURN jsonb_build_object('ok', true, 'statut', 'deja_statuee',
          'ligne_id', v_row.id, 'consignee', false);
      END IF;
      UPDATE public.attendances e
         SET estimation_remplacee_le = now(),
             anomalie                = 'sortie_presumee_rejetee',
             estimation_detail       = coalesce(e.estimation_detail, '{}'::jsonb)
                                   || jsonb_build_object('motif_rejet', p_motif)
       WHERE e.id = v_row.id
         AND e.estimation_remplacee_le IS NULL;
    END IF;

    INSERT INTO public.encheck_pointages_journal
          (enterprise_id, employee_id, attendance_id, action, motif, snapshot, pipeline, auteur)
    SELECT e.enterprise_id, e.employee_id, e.id,
           CASE WHEN p_decision = 'valider' THEN 'estimation_validee' ELSE 'estimation_rejetee' END,
           coalesce(p_motif, p_decision), to_jsonb(e),
           'encheck_estimation_decider', public.encheck_auteur_actuel()
      FROM public.attendances e WHERE e.id = v_row.id;

    RETURN jsonb_build_object('ok', true,
      'statut', CASE WHEN p_decision = 'valider' THEN 'validee' ELSE 'rejetee' END,
      'ligne_id', v_row.id, 'consignee', false);
  END IF;

  -- ── 2) Sortie inventée à l'écran (mode ombre) : on part de l'ENTRÉE ──────
  IF p_source IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'erreur',
      'aucune ligne en base et aucun pointage d''entrée : rien à statuer');
  END IF;
  SELECT e.enterprise_id, e.employee_id INTO v_ent, v_emp
    FROM public.attendances e WHERE e.id = p_source;
  IF v_ent IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'erreur', 'pointage d''entrée inconnu');
  END IF;
  IF NOT public.encheck_est_admin_de(v_ent) THEN
    RETURN jsonb_build_object('ok', false, 'erreur', 'non autorisé pour cette entreprise');
  END IF;

  v_detail := jsonb_build_object(
    'origine_ecran', true,
    'motif', p_motif,
    'niveau', p_niveau,
    'confiance', p_confiance
  );

  IF p_decision = 'valider' THEN
    IF p_heure_sortie IS NULL THEN
      RETURN jsonb_build_object('ok', false, 'erreur', 'heure de sortie requise pour valider');
    END IF;
    IF p_heure_sortie > now() + interval '10 minutes' THEN
      RETURN jsonb_build_object('ok', false, 'erreur',
        'heure de sortie dans le futur : refusée');
    END IF;

    BEGIN
      INSERT INTO public.attendances (
        employee_id, enterprise_id, check_time, check_type,
        method, is_auto_closed, anomalie,
        estimation_source_id, estimation_validee_le, estimation_validee_par,
        estimation_niveau, estimation_confiance, estimation_detail
      ) VALUES (
        v_emp, v_ent, p_heure_sortie, 'out',
        'auto_close', true, NULL,
        p_source, now(), public.encheck_auteur_actuel(),
        p_niveau, p_confiance,
        v_detail || jsonb_build_object('consignee_par_validation', true)
      )
      RETURNING id INTO v_ligne;
    EXCEPTION WHEN unique_violation THEN
      -- Le cron a consigné entre-temps : on statue sur sa ligne.
      SELECT e.id INTO v_ligne FROM public.attendances e
       WHERE e.estimation_source_id = p_source
         AND e.estimation_remplacee_le IS NULL
       ORDER BY e.created_at DESC LIMIT 1;
      IF v_ligne IS NOT NULL THEN
        UPDATE public.attendances e
           SET estimation_validee_le  = now(),
               estimation_validee_par = public.encheck_auteur_actuel(),
               anomalie               = NULL
         WHERE e.id = v_ligne AND e.estimation_validee_le IS NULL;
      END IF;
    END;
  ELSE
    --  ÉCARTER : l'heure doit DISPARAÎTRE des écrans de travail. On consigne
    --  la DÉCISION (ligne marquée « écartée », hors calcul, jamais comptée,
    --  jamais ré-inventée par le moteur) — on ne supprime jamais rien.
    BEGIN
      INSERT INTO public.attendances (
        employee_id, enterprise_id, check_time, check_type,
        method, is_auto_closed, anomalie,
        estimation_source_id, estimation_remplacee_le,
        estimation_niveau, estimation_confiance, estimation_detail
      ) VALUES (
        v_emp, v_ent, coalesce(p_heure_sortie, now()), 'out',
        'auto_close', true, 'sortie_presumee_rejetee',
        p_source, now(),
        p_niveau, p_confiance,
        v_detail || jsonb_build_object('motif_rejet', p_motif)
      )
      RETURNING id INTO v_ligne;
    EXCEPTION WHEN unique_violation THEN
      SELECT e.id INTO v_ligne FROM public.attendances e
       WHERE e.estimation_source_id = p_source
       ORDER BY e.created_at DESC LIMIT 1;
    END;
  END IF;

  IF v_ligne IS NOT NULL THEN
    INSERT INTO public.encheck_pointages_journal
          (enterprise_id, employee_id, attendance_id, action, motif, snapshot, pipeline, auteur)
    VALUES (
      v_ent, v_emp, v_ligne,
      CASE WHEN p_decision = 'valider' THEN 'estimation_validee' ELSE 'estimation_rejetee' END,
      coalesce(p_motif, p_decision),
      jsonb_build_object('heure_sortie', p_heure_sortie, 'source', p_source, 'detail', v_detail),
      'encheck_estimation_decider', public.encheck_auteur_actuel()
    );
  END IF;

  RETURN jsonb_build_object('ok', true,
    'statut', CASE WHEN p_decision = 'valider' THEN 'validee' ELSE 'rejetee' END,
    'ligne_id', v_ligne, 'consignee', true);
END;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. ENCHECK_ESTIMATION_DEPLACER — bouger l'heure sans perdre la marque
-- ─────────────────────────────────────────────────────────────────────────────
--  « Modifier le pointage » ne passe PLUS les lignes présumées par
--  `replace_attendance_day` (qui ne recopie que check_type/check_time et
--  blanchissait la ligne en badge). Un déplacement met à jour la ligne EN
--  PLACE : la marque « sortie présumée » survit à l'enregistrement.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.encheck_estimation_deplacer(
  p_id     uuid,
  p_heure  timestamptz,
  p_type   text DEFAULT NULL,
  p_motif  text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql VOLATILE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_row    record;
  v_avant  timestamptz;
BEGIN
  SELECT e.* INTO v_row FROM public.attendances e WHERE e.id = p_id;
  IF v_row IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'erreur', 'pointage inconnu');
  END IF;
  IF NOT public.encheck_est_admin_de(v_row.enterprise_id) THEN
    RETURN jsonb_build_object('ok', false, 'erreur', 'non autorisé pour cette entreprise');
  END IF;
  IF coalesce(v_row.is_auto_closed, false) = false
     AND v_row.estimation_source_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'erreur', 'ligne non estimée');
  END IF;
  IF p_heure IS NULL OR p_heure > now() + interval '10 minutes' THEN
    RETURN jsonb_build_object('ok', false, 'erreur', 'heure invalide (futur interdit)');
  END IF;

  v_avant := v_row.check_time;
  UPDATE public.attendances e
     SET check_time = p_heure,
         check_type = coalesce(p_type, e.check_type),
         estimation_detail = coalesce(e.estimation_detail, '{}'::jsonb)
                          || jsonb_build_object(
                               'deplacee_le', now(),
                               'deplacee_de', v_avant,
                               'motif', p_motif)
   WHERE e.id = p_id;

  INSERT INTO public.encheck_pointages_journal
        (enterprise_id, employee_id, attendance_id, action, motif, snapshot, pipeline, auteur)
  VALUES (
    v_row.enterprise_id, v_row.employee_id, v_row.id,
    'estimation_deplacee',
    coalesce(p_motif, 'déplacement depuis la fiche'),
    jsonb_build_object('avant', v_avant, 'apres', p_heure),
    'encheck_estimation_deplacer', public.encheck_auteur_actuel()
  );

  RETURN jsonb_build_object('ok', true, 'ligne_id', v_row.id);
END;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. DROITS D'EXÉCUTION
-- ─────────────────────────────────────────────────────────────────────────────
--  L'autorité est vérifiée DANS les fonctions (encheck_est_admin_de) — le JWT
--  ne revendique rien : c'est la base qui tranche, comme pour
--  encheck_estimation_statuer.
-- ─────────────────────────────────────────────────────────────────────────────
REVOKE ALL ON FUNCTION public.encheck_estimation_decider(uuid, uuid, text, timestamptz, smallint, text, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.encheck_estimation_deplacer(uuid, timestamptz, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.encheck_estimation_decider(uuid, uuid, text, timestamptz, smallint, text, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.encheck_estimation_deplacer(uuid, timestamptz, text, text) TO authenticated, service_role;

COMMIT;
