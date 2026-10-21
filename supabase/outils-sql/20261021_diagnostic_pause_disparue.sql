-- ═══════════════════════════════════════════════════════════════════════════
-- DIAGNOSTIC — « ma pause réelle a disparu après validation »
-- ═══════════════════════════════════════════════════════════════════════════
--  À copier-coller intégralement dans Supabase → SQL Editor → Run.
--
--  Objectif : voir, noir sur blanc, TOUTES les lignes de `encheck_pauses`
--  d'un employé — y compris celles que l'écran ne montre plus (validées,
--  écartées) — et les confronter aux badges bruts du même jour.
--
--  Lecture seule : aucune écriture, aucune fonction métier appelée, aucun
--  effet de bord, aucune alerte créée, aucun recalcul de journée.
--
--  ⚙️  Renseigner le matricule en bas (ex. 'ENN-0002') : 3 emplacements.
-- ═══════════════════════════════════════════════════════════════════════════

-- ─── 0. Préflight : la table existe-t-elle ? ────────────────────────────────
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables
     WHERE table_schema = 'public' AND table_name = 'encheck_pauses'
  ) THEN
    RAISE EXCEPTION 'Table public.encheck_pauses absente : migration 20261016000004 non appliquée.';
  END IF;
END $$;

-- ═══════════════════════════════════════════════════════════════════════════
-- 1. TOUTES les lignes de pause de l'employé (30 derniers jours)
--    → c'est ici qu'on voit si la pause « réelle » a bien été enregistrée
--      un jour, et ce qu'elle est devenue après une décision.
-- ═══════════════════════════════════════════════════════════════════════════
SELECT
  e.matricule,
  e.first_name || ' ' || e.last_name AS employe,
  p.jour,
  to_char(p.debut AT TIME ZONE 'Africa/Porto-Novo', 'YYYY-MM-DD HH24:MI') AS debut_local,
  to_char(p.fin   AT TIME ZONE 'Africa/Porto-Novo', 'HH24:MI')            AS fin_local,
  p.duree_minutes,
  p.statut,   -- reelle | presumee | validee | ecartee
  p.source,   -- pointee | presumee | admin
  p.anomalie,
  p.motif,
  to_char(p.updated_at AT TIME ZONE 'Africa/Porto-Novo', 'YYYY-MM-DD HH24:MI:SS') AS modifie_le
FROM public.encheck_pauses p
JOIN public.employees e ON e.id = p.employee_id
WHERE e.matricule = 'ENN-0002'          -- ⚙️ matricule
  AND p.jour >= CURRENT_DATE - 30
ORDER BY p.jour DESC, p.debut DESC;

-- ═══════════════════════════════════════════════════════════════════════════
-- 2. Écarts RÉELS entre une sortie et l'entrée suivante (7 derniers jours)
--    → la pause effectivement prise, telle que les badges la montrent.
-- ═══════════════════════════════════════════════════════════════════════════
WITH badges AS (
  SELECT
    a.employee_id,
    a.check_time,
    lower(coalesce(a.check_type, '')) AS type_badge
  FROM public.attendances a
  JOIN public.employees e ON e.id = a.employee_id
  WHERE e.matricule = 'ENN-0002'      -- ⚙️ matricule
    AND a.check_time >= now() - interval '7 days'
),
ordonnes AS (
  SELECT
    check_time,
    type_badge,
    lag(type_badge) OVER w AS type_precedent,
    lag(check_time) OVER w AS heure_precedente
  FROM badges
  WINDOW w AS (PARTITION BY employee_id ORDER BY check_time)
)
SELECT
  to_char(heure_precedente AT TIME ZONE 'Africa/Porto-Novo', 'YYYY-MM-DD HH24:MI') AS debut_ecart,
  to_char(check_time       AT TIME ZONE 'Africa/Porto-Novo', 'HH24:MI')            AS fin_ecart,
  type_precedent || ' -> ' || type_badge                                           AS enchainement,
  round(extract(epoch FROM (check_time - heure_precedente)) / 60)::int             AS ecart_minutes
FROM ordonnes
WHERE type_precedent = 'out' AND type_badge = 'in'
  AND round(extract(epoch FROM (check_time - heure_precedente)) / 60)::int >= 5
ORDER BY check_time DESC;

-- ═══════════════════════════════════════════════════════════════════════════
-- 3. Compteurs par statut / source sur 30 jours (vue d'ensemble)
-- ═══════════════════════════════════════════════════════════════════════════
SELECT p.statut, p.source, count(*) AS lignes, sum(p.duree_minutes) AS minutes
FROM public.encheck_pauses p
JOIN public.employees e ON e.id = p.employee_id
WHERE e.matricule = 'ENN-0002'        -- ⚙️ matricule
  AND p.jour >= CURRENT_DATE - 30
GROUP BY p.statut, p.source
ORDER BY p.statut, p.source;

-- ═══════════════════════════════════════════════════════════════════════════
-- COMMENT LIRE LE RÉSULTAT
--
--  · Aucune ligne `source = 'pointee'` en section 1
--      → la pause réelle n'a jamais été écrite dans la table (l'app mobile
--        n'appelle pas encheck_pause_ouvrir / encheck_pause_fermer).
--        Le moteur a donc présumé la pause de la grille. Correctif côté app.
--
--  · Une ligne `source = 'pointee'` avec `statut = 'validee'`
--      → la pause existe toujours : onglet « Pauses réelles » + Journal des
--        décisions. C'était un problème de filtre d'écran.
--
--  · Une ligne `source = 'presumee'` avec `statut = 'validee'`
--      → la pause validée est d'origine présumée : onglet « Présumées →
--        Validées ». L'écart réel mesuré en section 2 n'a pas été rattaché.
--
--  · Section 2 montre un écart réel absent de la section 1
--      → l'intervalle entre deux badges n'est PAS converti en pause :
--        comportement voulu aujourd'hui (doctrine : on n'invente pas une
--        pause à partir d'un intervalle). À décider ensemble.
-- ═══════════════════════════════════════════════════════════════════════════
