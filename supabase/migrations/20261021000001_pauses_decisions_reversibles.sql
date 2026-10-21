-- ═══════════════════════════════════════════════════════════════════════════
-- 20261021000001 — PAUSES : UNE DÉCISION EST RÉVERSIBLE, UNE PAUSE NE SE PERD PAS
-- ═══════════════════════════════════════════════════════════════════════════
--  Signalement terrain (21/10/2026) :
--    « l'employé a bien pris sa pause réelle, j'ai cliqué sur Valider, et
--      une fois validée la pause disparaît, je ne la retrouve nulle part. »
--
--  Rappel vérifié dans le code : Valider / Écarter ne suppriment JAMAIS.
--  `encheck_pauses_statuer` ne fait qu'un UPDATE de `statut`. Aucune migration
--  du dépôt ne contient de DELETE sur `encheck_pauses`. La ligne reste donc
--  en base : ce script s'attaque aux trois défauts qui, eux, sont réels.
--
--  1. `encheck_pauses_annuler_decision` — une décision doit pouvoir être
--     REVENUE (la pause reprend son statut d'origine). Sans ça, un clic
--     mal placé est définitif.
--  2. `encheck_pause_fermer` — n'acceptait que `statut IN ('reelle','presumee')`.
--     Une pause validée PENDANT qu'elle était ouverte ne pouvait donc PLUS
--     JAMAIS être fermée par le retour de l'employé : son badge de reprise
--     était avalé (« aucune pause ouverte ») et la pause restait ouverte à
--     vie. C'est le cas exact de l'écran : employé en pause, admin valide.
--  3. `encheck_pause_ouvrir` — l'idempotence ne jouait que sur une égalité
--     STRICTE de `debut`. Deux appels à quelques secondes d'écart (double
--     tape, reprise réseau) créaient donc DEUX lignes : la première refermée
--     à une durée ridicule (« pause réelle pointée … 2 min ») et une seconde
--     restée ouverte. Désormais : une pause ouverte le même jour → on renvoie
--     l'existante, on n'en crée pas une deuxième.
--
--  À copier-coller et exécuter dans l'éditeur SQL Supabase. Transactionnel,
--  idempotent (CREATE OR REPLACE), aucune suppression, aucune perte de donnée.
-- ═══════════════════════════════════════════════════════════════════════════

BEGIN;

-- ─────────────────────────────────────────────────────────────────────────────
-- 0. PRÉFLIGHT — par NOM (jamais par signature exacte)
-- ─────────────────────────────────────────────────────────────────────────────
DO $$
DECLARE v_manquant text;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables
     WHERE table_schema = 'public' AND table_name = 'encheck_pauses'
  ) THEN
    RAISE EXCEPTION 'Préflight : table public.encheck_pauses absente — exécutez d''abord 20261016000004. Rien n''a été appliqué.';
  END IF;

  SELECT string_agg(f.nom, ', ') INTO v_manquant
    FROM (VALUES ('encheck_est_admin_de'), ('encheck_auteur_actuel'), ('encheck_pauses_statuer')) AS f(nom)
   WHERE NOT EXISTS (
     SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
      WHERE n.nspname = 'public' AND p.proname = f.nom
   );
  IF v_manquant IS NOT NULL THEN
    RAISE EXCEPTION 'Préflight : fonctions introuvables (%) — exécutez 20261016000001 puis 20261016000004, et relancez ce script en entier. Rien n''a été appliqué.', v_manquant;
  END IF;
END $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. ENCHECK_PAUSES_ANNULER_DECISION — revenir sur Valider / Écarter
-- ─────────────────────────────────────────────────────────────────────────────
--  Mêmes garde-fous que `encheck_pauses_statuer` (admin de l'entreprise,
--  journal d'audit). Le statut d'origine est déduit de la SOURCE, jamais
--  deviné : une pause présumée redevient « presumee », une pause pointée ou
--  saisie par l'admin redevient « reelle ». Rien n'est supprimé.
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
  v_back text;
  v_n    integer := 0;
BEGIN
  IF p_ids IS NULL OR COALESCE(array_length(p_ids, 1), 0) = 0 THEN
    RAISE EXCEPTION 'aucune pause sélectionnée';
  END IF;

  FOREACH v_id IN ARRAY p_ids LOOP
    SELECT enterprise_id, employee_id, source, statut, anomalie
      INTO v_ent, v_emp, v_src, v_old, v_back
      FROM public.encheck_pauses WHERE id = v_id;
    IF v_ent IS NULL THEN
      CONTINUE;
    END IF;
    IF NULLIF(coalesce(auth.jwt() ->> 'email', ''), '') IS NOT NULL
       AND NOT public.encheck_est_admin_de(v_ent) THEN
      RAISE EXCEPTION 'non autorisé pour cette entreprise';
    END IF;

    -- Une décision annulée reste une information : on ne l'efface pas de
    -- l'audit, on note simplement l'annulation dans le motif.
    UPDATE public.encheck_pauses
       SET statut = CASE WHEN COALESCE(v_src, 'pointee') = 'presumee' THEN 'presumee' ELSE 'reelle' END,
           motif = COALESCE(p_motif, 'décision annulée par l''admin'),
           updated_at = now()
     WHERE id = v_id;
    v_n := v_n + 1;

    BEGIN
      PERFORM public.encheck_alerte_journaliser('encheck_pauses', v_id, v_ent, v_emp,
        'décision annulée (' || COALESCE(v_old, '?') || ' → ' ||
        CASE WHEN COALESCE(v_src, 'pointee') = 'presumee' THEN 'presumee' ELSE 'reelle' END || ')' ||
        COALESCE(' — ' || p_motif, ''));
    EXCEPTION WHEN OTHERS THEN
      NULL; -- le journal ne doit jamais empêcher l'annulation
    END;
  END LOOP;

  RETURN v_n;
END;
$$;

COMMENT ON FUNCTION public.encheck_pauses_annuler_decision(uuid[], text) IS
  'Revenir sur une décision Valider/Écarter : la pause reprend son statut d''origine (presumee si source=presumee, sinon reelle). Aucune suppression, décision tracée dans le journal d''audit.';

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. ENCHECK_PAUSE_FERMER — une pause VALIDÉE pendant qu'elle est ouverte
--    doit pouvoir être fermée par le retour de l'employé
-- ─────────────────────────────────────────────────────────────────────────────
--  Seul changement : 'validee' entre dans la liste des statuts fermables.
--  Une pause ÉCARTÉE ne se referme toujours pas (elle est hors calcul).
-- ─────────────────────────────────────────────────────────────────────────────
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
     -- ← 'validee' ajouté : une pause validée pendant qu'elle était ouverte
     --   reste fermable, sinon le badge de reprise de l'employé est perdu.
     AND statut IN ('reelle', 'presumee', 'validee')
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
-- 3. ENCHECK_PAUSE_OUVRIR — idempotence réelle (plus de pause fantôme)
-- ─────────────────────────────────────────────────────────────────────────────
--  Avant : deux appels à quelques secondes d'écart créaient deux lignes, la
--  première étant refermée à une durée dérisoire (la fameuse « pause réelle
--  pointée · 2 min » affichée à côté d'une pause toujours ouverte).
--  Maintenant : une pause ouverte LE MÊME JOUR → on renvoie l'existante ;
--  une pause ouverte d'un jour précédent → on la ferme comme avant (marquée
--  « sans_reprise », l'admin statuera).
-- ─────────────────────────────────────────────────────────────────────────────
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
  v_emp    record;
  v_tz     text;
  v_jour   date;
  v_id     uuid;
  v_jr     date;
  v_nb     integer;
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

  -- Idempotence stricte : même début → la pause existante est renvoyée.
  SELECT id INTO v_id
    FROM public.encheck_pauses
   WHERE employee_id = p_employee AND debut = p_debut;
  IF v_id IS NOT NULL THEN
    RETURN jsonb_build_object('ok', true, 'pause_id', v_id, 'deja', true, 'jour', v_jour::text);
  END IF;

  -- Idempotence métier : une pause est DÉJÀ ouverte aujourd'hui → c'est la
  -- même pause (double tape, reprise réseau). On ne la duplique pas.
  SELECT id, jour INTO v_id, v_jr
    FROM public.encheck_pauses
   WHERE employee_id = p_employee
     AND fin IS NULL
     AND statut IN ('reelle', 'presumee', 'validee')
   ORDER BY debut DESC
   LIMIT 1;
  IF v_id IS NOT NULL AND v_jr = v_jour THEN
    RETURN jsonb_build_object('ok', true, 'pause_id', v_id, 'deja', true, 'jour', v_jour::text);
  END IF;

  -- Toute pause restée ouverte (d'un jour précédent) se ferme ici : on ne
  -- devine pas la reprise, on MARQUE « sans_reprise » — l'admin statuera.
  UPDATE public.encheck_pauses
     SET fin = p_debut,
         duree_minutes = GREATEST(0, round(extract(epoch FROM (p_debut - debut)) / 60))::int,
         anomalie = COALESCE(anomalie, 'sans_reprise'),
         updated_at = now()
   WHERE employee_id = p_employee
     AND fin IS NULL
     AND statut IN ('reelle', 'presumee', 'validee');
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

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. CONTRÔLE — lecture de vérité, sans rien modifier
-- ─────────────────────────────────────────────────────────────────────────────
--  À exécuter APRÈS ce script : la pause qui « avait disparu » doit apparaître
--  ici avec son statut réel. Si elle n'apparaît pas, c'est qu'elle n'a jamais
--  été écrite dans la table (côté application de pointage).
-- ─────────────────────────────────────────────────────────────────────────────
-- SELECT p.jour, p.statut, p.source, p.debut, p.fin, p.duree_minutes, e.matricule
--   FROM public.encheck_pauses p
--   JOIN public.employees e ON e.id = p.employee_id
--  WHERE p.jour >= CURRENT_DATE - 30
--  ORDER BY p.jour DESC, p.debut DESC;

COMMIT;
