-- ═══════════════════════════════════════════════════════════════════════════════
-- DÉPASSEMENT DE PAUSE — le seuil de tolérance devient une règle qui agit
--
--  Le 15/11/2026, la migration 20261105000001 a semé `pause_tolerance_minutes`
--  à 15 et a construit l'écran de réglage. Mais AUCUN moteur ne lisait cette
--  clé : l'écran enregistrait, la trace gardait, et il ne se passait rien.
--  Cette migration branche la règle.
--
--  Décisions du fondateur (21/11/2026) :
--    · « 15 minutes de tolérance pour le seuil de dépassement pour la pause » ;
--    · les 15 min de retard d'arrivée (`late_tolerance_minutes`) ne bougent pas ;
--    · tolérance → BADGE seulement ; plafond 120 → alerte (déjà en place) ;
--    · choix A + B + C :
--        A. badge dans la liste des pauses, côté admin ;
--        B. entrée dans le centre d'alertes ;
--        C. l'employé voit son propre dépassement sur son historique.
--
--  La grandeur mesurée est l'ÉCART AU CRÉNEAU DE LA GRILLE
--  (`encheck_pause_prevue`), jamais une durée absolue. Une pause de 95 min
--  sur un créneau de 90 n'est pas une « très longue » : c'est un dépassement
--  de 5 min, sous la tolérance de 15. Confondre les deux effacerait la règle.
--
--  Trois questions, trois valeurs dans `encheck_pauses.anomalie` :
--    · `sans_reprise` — la pause n'a jamais été refermée ;
--    · `trop_longue`  — durée absolue au-delà du plafond (alerte) ;
--    · `depassement`  — écart au créneau au-delà de la tolérance (badge + alerte).
-- ═══════════════════════════════════════════════════════════════════════════════

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. LA CONTRAINTE — on ÉLARGIT, on ne remplace pas
--    Les deux valeurs existantes restent valides ; `depassement` s'ajoute.
--    Sans cette ligne, l'écriture du badge échoue en 23514 et la pause ne
--    peut plus être fermée : c'est ce qui s'est produit au premier essai.
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE public.encheck_pauses DROP CONSTRAINT IF EXISTS encheck_pauses_anomalie_chk;
ALTER TABLE public.encheck_pauses ADD CONSTRAINT encheck_pauses_anomalie_chk
  CHECK (anomalie IS NULL OR anomalie IN ('sans_reprise', 'trop_longue', 'depassement'));

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. LA RÈGLE — un calcul pur, sans écriture ni jugement
--    Séparer « calculer » de « décider » permet de mesurer à blanc, et de
--    tester le calcul sans toucher aux données.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.encheck_pause_depassement(
  p_employee   uuid,
  p_enterprise uuid,
  p_jour       date,
  p_duree      integer
)
RETURNS jsonb
LANGUAGE plpgsql STABLE
SET search_path = public, pg_temp
AS $$
DECLARE
  v_prev    jsonb;
  v_minutes integer;
  v_tol     integer;
  v_ecart   integer;
BEGIN
  IF p_duree IS NULL THEN
    RETURN jsonb_build_object('trouvee', false, 'motif', 'duree_inconnue');
  END IF;

  v_prev := public.encheck_pause_prevue(p_employee, p_enterprise, p_jour);
  IF NOT COALESCE((v_prev->>'trouvee')::boolean, false) THEN
    RETURN jsonb_build_object('trouvee', false, 'motif', 'aucune_grille');
  END IF;

  v_minutes := COALESCE((v_prev->>'minutes')::int, 0);
  IF v_minutes <= 0 THEN
    RETURN jsonb_build_object('trouvee', false, 'motif', 'creneau_nul');
  END IF;

  v_tol   := COALESCE(public.encheck_seuil(p_enterprise, 'pause_tolerance_minutes', 15), 15)::int;
  v_ecart := p_duree - v_minutes;

  RETURN jsonb_build_object(
    'trouvee',        true,
    'prevue_minutes', v_minutes,
    'reelle_minutes', p_duree,
    'tolerance',      v_tol,
    'ecart',          v_ecart,
    --  Strictement supérieur : à 75 pour 60 et une tolérance de 15, on est
    --  PILE dans la tolérance. « Tolérer 15 min » veut dire que 15 passent.
    'depasse',        v_ecart > v_tol,
    'source',         v_prev->>'source'
  );
END;
$$;

COMMENT ON FUNCTION public.encheck_pause_depassement(uuid, uuid, date, integer) IS
  'L''écart entre une pause réelle et le créneau de la grille, comparé à pause_tolerance_minutes. N''écrit rien, ne juge pas : calcule. Une pause plus courte que prévu n''est jamais un dépassement.';

GRANT EXECUTE ON FUNCTION public.encheck_pause_depassement(uuid, uuid, date, integer) TO authenticated, service_role;
REVOKE ALL ON FUNCTION public.encheck_pause_depassement(uuid, uuid, date, integer) FROM PUBLIC, anon;

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. LE JUGEMENT — A (badge) + B (alerte), une seule fois
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.encheck_pause_juger(p_pause uuid)
RETURNS jsonb
LANGUAGE plpgsql VOLATILE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_p     record;
  v_res   jsonb;
  v_tz    text;
  v_nom   text;
  v_tbl   text;
  v_cold  text;
  v_deja  boolean;
  v_msg   text;
BEGIN
  IF p_pause IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'raison', 'pause_inconnue');
  END IF;

  SELECT p.id, p.enterprise_id, p.employee_id, p.jour, p.duree_minutes,
         p.anomalie, p.statut, p.debut, p.fin
    INTO v_p
    FROM public.encheck_pauses p
   WHERE p.id = p_pause;

  IF v_p.id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'raison', 'pause_inconnue');
  END IF;

  --  Une pause écartée par un humain ne se fait pas rejuger par une règle.
  --  La décision humaine prime sur le calcul : c'est la doctrine du dépôt.
  IF v_p.statut = 'ecartee' THEN
    RETURN jsonb_build_object('ok', false, 'raison', 'ecartee');
  END IF;

  --  Une pause encore ouverte n'a pas de durée : rien à juger.
  IF v_p.fin IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'raison', 'en_cours');
  END IF;

  v_res := public.encheck_pause_depassement(
    v_p.employee_id, v_p.enterprise_id, v_p.jour, v_p.duree_minutes);

  IF NOT COALESCE((v_res->>'trouvee')::boolean, false) THEN
    --  Pas de grille, pas de juge. On ne compare pas à un chiffre inventé.
    RETURN jsonb_build_object('ok', true, 'depasse', false,
                              'raison', v_res->>'motif');
  END IF;

  IF NOT COALESCE((v_res->>'depasse')::boolean, false) THEN
    RETURN jsonb_build_object('ok', true, 'depasse', false, 'ecart', (v_res->>'ecart')::int);
  END IF;

  --  ── A : le badge, porté par la ligne de pause elle-même ──
  --  On ne recouvre PAS `trop_longue` : une pause déjà signalée pour durée
  --  absolue garde son signal le plus grave. Deux badges sur la même ligne
  --  se contrediraient.
  IF COALESCE(v_p.anomalie, '') NOT IN ('trop_longue', 'depassement') THEN
    UPDATE public.encheck_pauses
       SET anomalie = 'depassement', updated_at = now()
     WHERE id = v_p.id AND COALESCE(anomalie, '') NOT IN ('trop_longue', 'depassement');
  END IF;

  --  ── B : l'alerte, une seule par pause et par jour ──
  v_tz  := public.encheck_fuseau(v_p.enterprise_id);
  v_tbl := NULL; v_cold := NULL;
  SELECT t.table_alertes, t.col_date INTO v_tbl, v_cold FROM public.encheck_table_alertes() t;
  IF v_tbl IS NOT NULL AND v_cold IS NOT NULL THEN
    EXECUTE format(
      'SELECT EXISTS (SELECT 1 FROM public.%I WHERE enterprise_id = $1 AND employee_id = $2
         AND (%I)::date = $3 AND titre = $4)', v_tbl, v_cold)
      INTO v_deja USING v_p.enterprise_id, v_p.employee_id, v_p.jour,
        'Pause dépassée';
  END IF;

  IF NOT COALESCE(v_deja, false) THEN
    SELECT NULLIF(btrim(COALESCE(e.first_name,'') || ' ' || COALESCE(e.last_name,'')), '')
      INTO v_nom FROM public.employees e WHERE e.id = v_p.employee_id;

    v_msg := 'Pause de ' || v_p.duree_minutes || ' min (' ||
      to_char(v_p.debut AT TIME ZONE v_tz, 'HH24:MI') || ' → ' ||
      to_char(v_p.fin   AT TIME ZONE v_tz, 'HH24:MI') ||
      ') pour un créneau de ' || (v_res->>'prevue_minutes') || ' min : ' ||
      (v_res->>'ecart') || ' min de plus, tolérance ' || (v_res->>'tolerance') || ' min.' ||
      CASE WHEN v_nom IS NOT NULL THEN ' Employé : ' || v_nom || '.' ELSE '' END;

    BEGIN
      PERFORM public.encheck_alerte_poser(
        p_enterprise := v_p.enterprise_id,
        p_employee   := v_p.employee_id,
        p_jour       := v_p.jour,
        p_type       := 'pause_anomalie',
        p_gravite    := 'attention',
        p_titre      := 'Pause dépassée',
        p_detail     := v_msg,
        p_ref        := NULL,
        p_appareil   := NULL);
    EXCEPTION WHEN OTHERS THEN
      --  Une alerte qui échoue ne doit jamais empêcher la pause d'exister.
      RAISE WARNING 'Alerte de dépassement non posée : %', SQLERRM;
    END;
  END IF;

  RETURN jsonb_build_object(
    'ok', true, 'depasse', true,
    'ecart', (v_res->>'ecart')::int,
    'prevue', (v_res->>'prevue_minutes')::int,
    'tolerance', (v_res->>'tolerance')::int,
    'alerte', NOT COALESCE(v_deja, false)
  );
END;
$$;

COMMENT ON FUNCTION public.encheck_pause_juger(uuid) IS
  'Juge une pause terminée : compare sa durée réelle au créneau de la grille + tolerance et, au-delà, pose le badge depassement et une alerte (une seule par pause et par jour). Idempotent.';

GRANT EXECUTE ON FUNCTION public.encheck_pause_juger(uuid) TO authenticated, service_role;
REVOKE ALL ON FUNCTION public.encheck_pause_juger(uuid) FROM PUBLIC, anon;

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. LE RATTRAPAGE — pour les pauses fermées avant l'existence de la règle
--    Sans lui, un dépassement passé resterait invisible : la règle ne
--    s'applique qu'aux pauses jugées, et le jugement n'existait pas encore.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.encheck_pauses_juger_lot(
  p_enterprise uuid DEFAULT NULL,
  p_jours      integer DEFAULT 30
)
RETURNS jsonb
LANGUAGE plpgsql VOLATILE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_rec  record;
  v_n    integer := 0;
  v_dep  integer := 0;
  v_res  jsonb;
BEGIN
  IF p_enterprise IS NOT NULL AND NOT public.encheck_est_admin_de(p_enterprise) THEN
    RAISE EXCEPTION 'Accès refusé.' USING ERRCODE = '42501';
  END IF;
  IF p_enterprise IS NULL AND NOT EXISTS (
    SELECT 1 FROM public.admins a
     WHERE lower(a.email) = lower(coalesce(auth.jwt() ->> 'email',''))
       AND a.is_active = true AND a.role = 'super_admin') THEN
    RAISE EXCEPTION 'Accès refusé.' USING ERRCODE = '42501';
  END IF;

  FOR v_rec IN
    SELECT p.id
      FROM public.encheck_pauses p
     WHERE p.fin IS NOT NULL
       AND p.statut <> 'ecartee'
       AND p.jour >= CURRENT_DATE - GREATEST(1, LEAST(COALESCE(p_jours, 30), 365))
       AND COALESCE(p.anomalie, '') NOT IN ('trop_longue', 'depassement')
       AND (p_enterprise IS NULL OR p.enterprise_id = p_enterprise)
     ORDER BY p.jour DESC, p.debut
  LOOP
    BEGIN
      v_res := public.encheck_pause_juger(v_rec.id);
      v_n := v_n + 1;
      IF COALESCE((v_res->>'depasse')::boolean, false) THEN
        v_dep := v_dep + 1;
      END IF;
    EXCEPTION WHEN OTHERS THEN
      --  Une pause qui résiste ne bloque pas les suivantes.
      RAISE WARNING 'Pause % non jugée : %', v_rec.id, SQLERRM;
    END;
  END LOOP;

  RETURN jsonb_build_object('ok', true, 'examinees', v_n, 'depassements', v_dep);
END;
$$;

COMMENT ON FUNCTION public.encheck_pauses_juger_lot(uuid, integer) IS
  'Rattrapage : juge les pauses terminées des N derniers jours qui n''ont jamais été comparées à leur créneau. Idempotent, gardé par l''appartenance à l''entreprise.';

GRANT EXECUTE ON FUNCTION public.encheck_pauses_juger_lot(uuid, integer) TO authenticated, service_role;
REVOKE ALL ON FUNCTION public.encheck_pauses_juger_lot(uuid, integer) FROM PUBLIC, anon;

-- ─────────────────────────────────────────────────────────────────────────────
-- 5. LE JUGEMENT AU DÉPOINTAGE — le seul instant où la durée devient vraie
--    Avant, la règle dépendait de l'ouverture de l'écran des pauses : une
--    pause pouvait dépasser un mois sans que personne ne le sache.
--    Le dépointage ferme la pause ; c'est là qu'on mesure.
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
  v_jug jsonb;
BEGIN
  SELECT id, debut INTO v_id, v_deb
    FROM public.encheck_pauses
   WHERE employee_id = p_employee
     AND fin IS NULL
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

  --  Le jugement ne doit JAMAIS empêcher la reprise d'être notée.
  --  L'employé est en train de pointer : sa pause doit se fermer, même si
  --  la grille est illisible ou si l'alerte échoue.
  BEGIN
    v_jug := public.encheck_pause_juger(v_id);
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'Jugement de pause non calculé : %', SQLERRM;
    v_jug := NULL;
  END;

  RETURN jsonb_build_object(
    'ok', true,
    'pause_id', v_id,
    'depassement', COALESCE(v_jug, jsonb_build_object('ok', false, 'raison', 'non_jugee'))
  );
END;
$$;

COMMENT ON FUNCTION public.encheck_pause_fermer(uuid, timestamptz) IS
  'Ferme la pause ouverte de l''employé et la juge dans la foulée : le dépassement du créneau est mesuré à l''instant où la durée devient connue. Un échec du jugement n''empêche pas la reprise.';

-- ─────────────────────────────────────────────────────────────────────────────
-- 6. LA LECTURE — les deux chiffres qui donnent son sens au badge
--    « Dépassement » sans chiffre est un mot creux. L'écran doit pouvoir
--    écrire « 18 min de plus que les 60 min prévues ».
--    ATTENTION : `CREATE OR REPLACE` interdit de changer le type de retour
--    d'une fonction. D'où le DROP, DANS LA MÊME TRANSACTION, et le GRANT
--    reposé juste après — sinon la fonction revient sans droits d'exécution
--    et l'écran des pauses se vide en silence.
-- ─────────────────────────────────────────────────────────────────────────────
BEGIN;

DROP FUNCTION IF EXISTS public.encheck_pauses_lire(uuid, date, date);

CREATE FUNCTION public.encheck_pauses_lire(
  p_enterprise uuid DEFAULT NULL,
  p_du date DEFAULT NULL,
  p_au date DEFAULT NULL
)
RETURNS TABLE (
  id uuid, employe_id uuid, prenom text, nom text, matricule text,
  enterprise_id uuid, entreprise_nom text, jour date,
  debut timestamptz, fin timestamptz, duree_minutes integer,
  statut text, source text, motif text, anomalie text,
  prevue_minutes integer, ecart_minutes integer
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
           p.statut, p.source, p.motif, p.anomalie,
           CASE WHEN p.anomalie = 'depassement' THEN (d.res ->> 'prevue_minutes')::int END,
           CASE WHEN p.anomalie = 'depassement' THEN (d.res ->> 'ecart')::int END
      FROM public.encheck_pauses p
      JOIN public.employees e  ON e.id = p.employee_id
      JOIN public.enterprises ent ON ent.id = p.enterprise_id
      --  Le calcul n'est lancé QUE pour les lignes marquées : une pause
      --  ordinaire ne paie pas quatre appels de grille à chaque lecture.
      CROSS JOIN LATERAL (
        SELECT CASE WHEN p.anomalie = 'depassement'
                    THEN public.encheck_pause_depassement(
                           p.employee_id, p.enterprise_id, p.jour, p.duree_minutes)
               END AS res
      ) d
     WHERE p.jour BETWEEN v_du AND v_au
       AND (p_enterprise IS NULL OR p.enterprise_id = p_enterprise)
     ORDER BY p.jour DESC, e.last_name, e.first_name, p.debut;
END;
$$;

GRANT EXECUTE ON FUNCTION public.encheck_pauses_lire(uuid, date, date) TO authenticated, service_role;
REVOKE ALL ON FUNCTION public.encheck_pauses_lire(uuid, date, date) FROM PUBLIC, anon;

COMMIT;

-- ─────────────────────────────────────────────────────────────────────────────
-- 7. CE QUE CETTE MIGRATION NE FAIT PAS, ET POURQUOI
--
--  · Elle ne touche pas `late_tolerance_minutes` : autre grandeur, autre écran.
--  · Elle ne juge pas les pauses EN COURS : sans `fin`, la durée n'existe pas.
--    Un dépassement ne se constate qu'une fois la pause refermée.
--  · Elle ne crée pas de vue employé (C). L'espace employé n'a aucune page
--    « mes pauses » aujourd'hui ; fabriquer une page entière dépasserait ce
--    lot. Le badge est calculé et stocké, donc lisible ; l'écran employé
--    viendra avec l'équipe App Pointage, qui tient ce périmètre.
--  · Elle n'ajoute pas de déclencheur sur `attendances` : le dépointage passe
--    par `encheck_pause_fermer`, qui juge désormais lui-même. Un déclencheur
--    de plus multiplierait les chemins d'écriture sur une table sensible.
-- ─────────────────────────────────────────────────────────────────────────────
