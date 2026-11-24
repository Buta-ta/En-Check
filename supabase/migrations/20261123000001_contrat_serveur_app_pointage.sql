-- ═══════════════════════════════════════════════════════════════════════════════
-- CONTRAT SERVEUR POUR L'APP POINTAGE — deux ajouts, pas un de plus
--
--  Demandés par l'équipe App Pointage dans leur retour du 22/11/2026,
--  validés par le fondateur, et écrits ici APRÈS avoir été mesurés en base.
--
--  ①  encheck_pauses_mes_pauses(jeton) — l'employé voit SES pauses.
--  ②  encheck_pauses.motif_fermeture — distinguer « reprise » de « sortie ».
--
--  Ce que cette migration n'ouvre pas : `encheck_pauses_lire` reste fermée
--  à `anon`. Elle vérifie l'appartenance à l'entreprise, pas l'identité de
--  la personne ; l'ouvrir à la tablette donnerait à un employé les pauses
--  de tous ses collègues.
-- ═══════════════════════════════════════════════════════════════════════════════

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. LE MOTIF DE FERMETURE — « comment la pause s'est terminée »
--
--    Deux valeurs, et NULL pour le passé :
--      · 'reprise' — l'employé a pointé son retour de pause ;
--      · 'sortie'  — il a pointé sa sortie alors que la pause courait.
--    NULL n'est pas une lacune à combler : c'est la vérité des pauses
--    fermées avant que cette colonne existe. On ne leur invente pas un motif.
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE public.encheck_pauses
  ADD COLUMN IF NOT EXISTS motif_fermeture text;

ALTER TABLE public.encheck_pauses DROP CONSTRAINT IF EXISTS encheck_pauses_motif_fermeture_chk;
ALTER TABLE public.encheck_pauses ADD CONSTRAINT encheck_pauses_motif_fermeture_chk
  CHECK (motif_fermeture IS NULL OR motif_fermeture IN ('reprise', 'sortie'));

COMMENT ON COLUMN public.encheck_pauses.motif_fermeture IS
  'reprise = la pause s''est terminée par un pointage de reprise ; sortie = elle a été clôturée par le dépointage de fin de journée (l''employé a quitté sans reprendre). NULL = pause antérieure à l''ajout de cette colonne, ou pause encore ouverte.';

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. LA FERMETURE NOTE SON MOTIF
--
--    ⚠️ PIÈGE DE SIGNATURE : ajouter un 3ᵉ paramètre CRÉE une nouvelle
--    fonction, il ne remplace pas l'ancienne. Les deux cohabitent alors, et
--    un appel à 2 arguments choisit l'ANCIENNE — celle qui n'écrit jamais
--    `motif_fermeture`. Mesuré en base : deux lignes dans `pg_proc` avant
--    le DROP. La suppression de l'ancienne signature est indispensable.
--
--    Un motif inconnu retombe sur 'reprise' au lieu de faire échouer la
--    fermeture : un employé ne doit jamais rester coincé sur une faute de
--    paramètre d'une app tierce.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.encheck_pause_fermer(
  p_employee uuid,
  p_fin      timestamptz DEFAULT now(),
  p_motif    text DEFAULT 'reprise'
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
  v_motif text;
BEGIN
  v_motif := CASE WHEN lower(btrim(COALESCE(p_motif, ''))) = 'sortie' THEN 'sortie' ELSE 'reprise' END;

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
         motif_fermeture = v_motif,
         updated_at = now()
   WHERE id = v_id;

  --  Le jugement ne doit JAMAIS empêcher la reprise d'être notée.
  BEGIN
    v_jug := public.encheck_pause_juger(v_id);
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'Jugement de pause non calculé : %', SQLERRM;
    v_jug := NULL;
  END;

  RETURN jsonb_build_object(
    'ok', true,
    'pause_id', v_id,
    'motif_fermeture', v_motif,
    'depassement', COALESCE(v_jug, jsonb_build_object('ok', false, 'raison', 'non_jugee'))
  );
END;
$$;

COMMENT ON FUNCTION public.encheck_pause_fermer(uuid, timestamptz, text) IS
  'Ferme la pause ouverte de l''employé, en note le motif (reprise ou sortie) et la juge. Un échec du jugement n''empêche pas la reprise.';

--  L'ancienne signature capterait les appels à 2 arguments : on la retire.
--  La nouvelle répond aux mêmes appels grâce à ses valeurs par défaut.
DROP FUNCTION IF EXISTS public.encheck_pause_fermer(uuid, timestamptz);

REVOKE ALL ON FUNCTION public.encheck_pause_fermer(uuid, timestamptz, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.encheck_pause_fermer(uuid, timestamptz, text)
  TO anon, authenticated, service_role;

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. « MES PAUSES » — lecture scopée par JETON DE SESSION
--
--    L'équipe demandait `encheck_pauses_mes_pauses(p_employee)`. Ce n'est
--    pas suffisant, et le dépôt a déjà mieux : `employee_sessions` +
--    `encheck_session_employe(jeton)`, délivré par `encheck_employee_login_qr`
--    (QR, ou matricule + PIN). Le jeton est un secret de 256 bits, haché en
--    base, avec expiration et révocation.
--
--    Un `p_employee` seul circule sur la tablette et ne prouve rien : avec
--    un identifiant, n'importe qui lirait les pauses d'un collègue. Avec le
--    jeton, la fonction ne PEUT renvoyer que les pauses de la personne qui
--    vient de s'identifier.
--
--    Mesuré en base : jeton inventé, vide ou NULL → refus (42501).
--    Jeton réel → les 14 pauses du seul employé concerné.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.encheck_pauses_mes_pauses(
  p_jeton text,
  p_du    date DEFAULT NULL,
  p_au    date DEFAULT NULL
)
RETURNS TABLE (
  id uuid, jour date,
  debut timestamptz, fin timestamptz, duree_minutes integer,
  statut text, source text, motif text, anomalie text,
  prevue_minutes integer, ecart_minutes integer, tolerance_minutes integer,
  prevue_debut time, prevue_fin time,
  ouverte boolean
)
LANGUAGE plpgsql STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_emp uuid;
  v_ent uuid;
BEGIN
  --  ⚠️ `encheck_session_employe` renvoie QUATRE colonnes ; la table
  --  `employee_sessions` en a NEUF. Déclarer `v_sess` du type de la table
  --  puis faire `SELECT * INTO` aligne par POSITION : `device_id` (text)
  --  atterrit dans une colonne uuid → `invalid input syntax for type uuid`.
  --  Mesuré en base au premier essai. On nomme donc les deux variables.
  SELECT s.employee_id, s.enterprise_id
    INTO v_emp, v_ent
    FROM public.encheck_session_employe(p_jeton) s
   LIMIT 1;

  IF v_emp IS NULL THEN
    RAISE EXCEPTION 'Session employé invalide ou expirée.' USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
    SELECT p.id, p.jour,
           p.debut, p.fin, p.duree_minutes,
           p.statut, p.source, p.motif, p.anomalie,
           --  Les deux chiffres de l'écart : « 21 min de plus que les 60
           --  prévues » se lit ; « Dépassement » seul ne dit rien.
           CASE WHEN p.anomalie = 'depassement' THEN (d.res ->> 'prevue_minutes')::int END,
           CASE WHEN p.anomalie = 'depassement' THEN (d.res ->> 'ecart')::int END,
           CASE WHEN p.anomalie = 'depassement' THEN (d.res ->> 'tolerance')::int END,
           CASE WHEN p.anomalie = 'depassement' THEN (pr.prev->>'debut')::time END,
           CASE WHEN p.anomalie = 'depassement' THEN (pr.prev->>'fin')::time END,
           (p.fin IS NULL)
      FROM public.encheck_pauses p
      --  Le calcul ne part QUE pour les lignes marquées : une pause
      --  ordinaire ne paie pas deux appels de grille à chaque lecture.
      LEFT JOIN LATERAL (
        SELECT CASE WHEN p.anomalie = 'depassement'
                    THEN public.encheck_pause_depassement(
                           p.employee_id, p.enterprise_id, p.jour, p.duree_minutes)
               END AS res
      ) d ON true
      LEFT JOIN LATERAL (
        SELECT CASE WHEN p.anomalie = 'depassement'
                    THEN public.encheck_pause_prevue(
                           p.employee_id, p.enterprise_id, p.jour)
               END AS prev
      ) pr ON true
     WHERE p.employee_id = v_emp
       AND p.enterprise_id = v_ent
       AND p.jour BETWEEN COALESCE(p_du, CURRENT_DATE - 30) AND COALESCE(p_au, CURRENT_DATE)
     ORDER BY p.jour DESC, p.debut DESC;
END;
$$;

COMMENT ON FUNCTION public.encheck_pauses_mes_pauses(text, date, date) IS
  'Les pauses de L''employé identifié par son jeton de session — jamais celles d''un autre. Renvoie les deux chiffres du dépassement pour que l''écran puisse dire « 21 min de plus que les 60 prévues ».';

REVOKE ALL ON FUNCTION public.encheck_pauses_mes_pauses(text, date, date) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.encheck_pauses_mes_pauses(text, date, date)
  TO anon, authenticated, service_role;

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. CE QUE CETTE MIGRATION NE FAIT PAS
--
--  · Elle n'ouvre PAS `encheck_pauses_lire` à `anon`. Cette fonction vérifie
--    l'appartenance à l'entreprise, pas l'identité : la tablette en `anon`
--    verrait les pauses de tous les employés.
--  · Elle n'appelle pas `encheck_pause_fermer` depuis le dépointage : ce
--    geste appartient à l'app de pointage (leur lot 1). Côté serveur, tout
--    est prêt ; c'est à eux de passer `p_motif := 'sortie'`.
--  · Elle ne remplit pas `motif_fermeture` pour les pauses existantes.
--    Inventer « reprise » pour 27 pauses dont on ne sait rien serait une
--    donnée fabriquée. NULL dit la vérité : « on ne savait pas encore ».
-- ─────────────────────────────────────────────────────────────────────────────
