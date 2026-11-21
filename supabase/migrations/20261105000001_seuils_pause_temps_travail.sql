-- ═══════════════════════════════════════════════════════════════════════════════
-- TEMPS DE TRAVAIL — les deux seuils de pause, réglables par l'entreprise
--
--  Décisions du fondateur, 17/11/2026 :
--    · les seuils se règlent dans Configuration pointeuse → Temps de travail ;
--    · « 15 minutes de tolérance pour le seuil de dépassement pour la pause »
--      (les 15 minutes de retard d'arrivée, `late_tolerance_minutes`, ne sont
--      PAS touchées : autre grandeur, autre écran) ;
--    · « je veux savoir qui a touché au seuil » → trace systématique ;
--    · « trace les 2 champs » → chaque enregistrement, même sans changement.
--
--  Ce que cette migration ne fait pas :
--    · pas de second plafond « 2× la prévue » — `pause_duree_max_minutes`
--      existe depuis 000004:581 et reste la seule vérité ;
--    · pas de réglage « pause payée » (sujet de paie) ;
--    · pas de RLS réécrite — les policies de
--      20261016000001:1793-1810 restent la garde du navigateur ; la RPC
--      ajoute la sienne.
-- ═══════════════════════════════════════════════════════════════════════════════

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. LES VALEURS DE DÉPART — l'entreprise hérite du global tant qu'elle n'a
--    rien réglé. `encheck_seuil()` résout entreprise → global → défaut.
-- ─────────────────────────────────────────────────────────────────────────────

--  Le plafond était LU par le moteur depuis le 16/10 (`000004:581`, défaut
--  codé 120) mais JAMAIS semé : l'écran aurait affiché un champ vide sur une
--  règle pourtant appliquée. On sème la valeur que le code appliquait déjà —
--  semer ne change donc aucun calcul en cours.
INSERT INTO public.encheck_reglages_pointage (cle, valeur, commentaire) VALUES
  ('pause_duree_max_minutes', '120',
   'Plafond d''une pause (minutes). Au-delà : anomalie « trop_longue » et alerte au manager. Appliqué depuis 000004:581 — semé ici pour être réglable.'),
  ('pause_tolerance_minutes', '15',
   'Tolérance de dépassement d''une pause (minutes). Une pause plus longue que le créneau de la grille de ce montant est signalée. Décision du 17/11/2026.')
ON CONFLICT (cle) WHERE enterprise_id IS NULL DO NOTHING;

--  Pour les entreprises qui auraient déjà une valeur propre de plafond, rien
--  n'est écrasé : l'index unique (enterprise_id, cle) l'interdit, et c'est
--  voulu. La tolérance, elle, n'existait pas avant — aucune ligne à préserver.

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. LES BORNES — une seule règle, ici, lue par la RPC et par le service.
--    Un `0` ou un texte dans la base ne doit jamais devenir une règle
--    d'affaires (leçon seuilsPointage.js : un plafond à 0 efface tout).
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.encheck_seuil_borne(p_cle text, p_valeur numeric)
RETURNS integer
LANGUAGE plpgsql IMMUTABLE
AS $$
BEGIN
  IF p_valeur IS NULL OR p_valeur <> p_valeur THEN  -- NULL ou NaN
    RAISE EXCEPTION 'Valeur manquante pour %', p_cle USING ERRCODE = '22023';
  END IF;
  IF p_valeur <> trunc(p_valeur) THEN
    RAISE EXCEPTION 'La valeur de % doit être un nombre entier de minutes.', p_cle
      USING ERRCODE = '22023';
  END IF;

  CASE p_cle
    --  0 est permis : « signalée au premier dépassement » est un choix légitime.
    WHEN 'pause_tolerance_minutes' THEN
      IF p_valeur < 0 OR p_valeur > 240 THEN
        RAISE EXCEPTION 'La tolérance doit être comprise entre 0 et 240 minutes.' USING ERRCODE = '22023';
      END IF;
    --  Un plafond à 0 effacerait toutes les pauses ; 15 min est le plancher
    --  qui garde un sens à « pause ».
    WHEN 'pause_duree_max_minutes' THEN
      IF p_valeur < 15 OR p_valeur > 600 THEN
        RAISE EXCEPTION 'Le plafond doit être compris entre 15 et 600 minutes.' USING ERRCODE = '22023';
      END IF;
    ELSE
      RAISE EXCEPTION 'Réglage inconnu : %', p_cle USING ERRCODE = '22023';
  END CASE;

  RETURN p_valeur::int;
END;
$$;

COMMENT ON FUNCTION public.encheck_seuil_borne(text, numeric) IS
  'Les bornes des seuils de pause, en un seul endroit. Refuse plutôt que d''arrondir une valeur incohérente.';

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. LA LECTURE — ce que l'écran affiche, avec la valeur d'usage.
--    Une valeur absente n'est pas une erreur : l'écran montre le défaut et dit
--    d'où il vient (« valeur d''usage »), il n'invente pas un champ vide.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.encheck_seuils_pause(p_enterprise uuid)
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_tol   integer;
  v_max   integer;
  v_nom   text;
  v_quand timestamptz;
BEGIN
  IF NOT public.encheck_est_admin_de(p_enterprise) THEN
    RAISE EXCEPTION 'Accès refusé.' USING ERRCODE = '42501';
  END IF;

  v_tol := COALESCE(public.encheck_seuil(p_enterprise, 'pause_tolerance_minutes', 15), 15)::int;
  v_max := COALESCE(public.encheck_seuil(p_enterprise, 'pause_duree_max_minutes', 120), 120)::int;

  --  Dernière modification connue, sur l'un ou l'autre des deux réglages.
  SELECT a.first_name || ' ' || a.last_name, r.maj_le
    INTO v_nom, v_quand
    FROM public.encheck_reglages_pointage r
    LEFT JOIN public.admins a ON a.id = r.maj_par
   WHERE r.enterprise_id = p_enterprise
     AND r.cle IN ('pause_tolerance_minutes', 'pause_duree_max_minutes')
   ORDER BY r.maj_le DESC
   LIMIT 1;

  RETURN jsonb_build_object(
    'tolerance_minutes', v_tol,
    'tolerance_source', CASE WHEN EXISTS (
        SELECT 1 FROM public.encheck_reglages_pointage
         WHERE enterprise_id = p_enterprise AND cle = 'pause_tolerance_minutes')
      THEN 'entreprise' ELSE 'usage' END,
    'max_minutes', v_max,
    'max_source', CASE WHEN EXISTS (
        SELECT 1 FROM public.encheck_reglages_pointage
         WHERE enterprise_id = p_enterprise AND cle = 'pause_duree_max_minutes')
      THEN 'entreprise' ELSE 'usage' END,
    'maj_le', v_quand,
    'maj_par', NULLIF(trim(COALESCE(v_nom, '')), '')
  );
END;
$$;

COMMENT ON FUNCTION public.encheck_seuils_pause(uuid) IS
  'Les deux seuils de pause d''une entreprise, leur provenance, et le dernier auteur connu. Lecture seule.';

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. L'ÉCRITURE — une opération, une trace, une invalidation.
--
--    « je veux savoir qui a touché au seuil » : le nom ne suffit pas, il faut
--    pouvoir dire QUAND et QUELLE VALEUR a été remplacée. La trace part donc
--    dans le journal append-only (`encheck_pointages_journal`), avec
--    l'instantané complet du réglage — ancienne valeur ET nouvelle.
--    `maj_par` reste écrit aussi : c'est ce que l'écran lit sans jointure.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.encheck_seuil_ecrire(
  p_enterprise uuid,
  p_tolerance  integer,
  p_max        integer
)
RETURNS jsonb
LANGUAGE plpgsql VOLATILE SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_tol   integer;
  v_max   integer;
  v_id    uuid;
  v_avant jsonb;
  v_nom   text;
  v_qui   uuid;
BEGIN
  IF NOT public.encheck_est_admin_de(p_enterprise) THEN
    RAISE EXCEPTION 'Accès refusé.' USING ERRCODE = '42501';
  END IF;

  --  Bornes AVANT toute écriture : rien ne se pose en base puis n'est refusé.
  v_tol := public.encheck_seuil_borne('pause_tolerance_minutes', p_tolerance);
  v_max := public.encheck_seuil_borne('pause_duree_max_minutes', p_max);

  IF v_tol > v_max THEN
    RAISE EXCEPTION 'La tolérance (%) ne peut pas dépasser le plafond (%).', v_tol, v_max
      USING ERRCODE = '22023';
  END IF;

  v_qui := public.encheck_auteur_actuel();
  SELECT NULLIF(trim(COALESCE(a.first_name, '') || ' ' || COALESCE(a.last_name, '')), '')
    INTO v_nom FROM public.admins a WHERE a.user_id = v_qui LIMIT 1;

  -- ── tolérance ──────────────────────────────────────────────────────────────
  SELECT id, to_jsonb(r.*) INTO v_id, v_avant
    FROM public.encheck_reglages_pointage r
   WHERE r.enterprise_id = p_enterprise AND r.cle = 'pause_tolerance_minutes';

  INSERT INTO public.encheck_reglages_pointage (enterprise_id, cle, valeur, commentaire, maj_le, maj_par)
  VALUES (p_enterprise, 'pause_tolerance_minutes', to_jsonb(v_tol),
          'Tolérance de dépassement d''une pause (minutes). Réglée depuis l''écran Temps de travail.',
          now(), v_qui)
  ON CONFLICT (enterprise_id, cle) WHERE enterprise_id IS NOT NULL DO UPDATE
    SET valeur = EXCLUDED.valeur, maj_le = now(), maj_par = v_qui;

  SELECT id INTO v_id
    FROM public.encheck_reglages_pointage
   WHERE enterprise_id = p_enterprise AND cle = 'pause_tolerance_minutes';

  PERFORM public.encheck_journal_tracer(
    'encheck_reglages_pointage', v_id, p_enterprise, NULL,
    'pause_tolerance_minutes : ' ||
      COALESCE(v_avant #>> '{valeur}', 'valeur d''usage') || ' → ' || v_tol::text,
    'reglage_seuil');

  -- ── plafond ────────────────────────────────────────────────────────────────
  SELECT id, to_jsonb(r.*) INTO v_id, v_avant
    FROM public.encheck_reglages_pointage r
   WHERE r.enterprise_id = p_enterprise AND r.cle = 'pause_duree_max_minutes';

  INSERT INTO public.encheck_reglages_pointage (enterprise_id, cle, valeur, commentaire, maj_le, maj_par)
  VALUES (p_enterprise, 'pause_duree_max_minutes', to_jsonb(v_max),
          'Plafond d''une pause (minutes). Réglé depuis l''écran Temps de travail.',
          now(), v_qui)
  ON CONFLICT (enterprise_id, cle) WHERE enterprise_id IS NOT NULL DO UPDATE
    SET valeur = EXCLUDED.valeur, maj_le = now(), maj_par = v_qui;

  SELECT id INTO v_id
    FROM public.encheck_reglages_pointage
   WHERE enterprise_id = p_enterprise AND cle = 'pause_duree_max_minutes';

  PERFORM public.encheck_journal_tracer(
    'encheck_reglages_pointage', v_id, p_enterprise, NULL,
    'pause_duree_max_minutes : ' ||
      COALESCE(v_avant #>> '{valeur}', 'valeur d''usage') || ' → ' || v_max::text,
    'reglage_seuil');

  RETURN jsonb_build_object(
    'ok', true,
    'tolerance_minutes', v_tol,
    'max_minutes', v_max,
    'auteur', v_nom,
    'maj_le', now()
  );
END;
$$;

COMMENT ON FUNCTION public.encheck_seuil_ecrire(uuid, integer, integer) IS
  'Écrit les deux seuils de pause d''une entreprise en une opération : bornes, cohérence, maj_par, et une trace par champ dans le journal append-only.';

-- ─────────────────────────────────────────────────────────────────────────────
-- 5. LES DROITS — l'écran passe par la RPC, jamais par une écriture directe.
-- ─────────────────────────────────────────────────────────────────────────────

REVOKE ALL ON FUNCTION public.encheck_seuil_borne(text, numeric) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.encheck_seuils_pause(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.encheck_seuil_ecrire(uuid, integer, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.encheck_seuils_pause(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.encheck_seuil_ecrire(uuid, integer, integer) TO authenticated, service_role;
