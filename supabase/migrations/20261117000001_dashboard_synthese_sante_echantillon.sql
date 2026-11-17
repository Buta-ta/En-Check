-- ═══════════════════════════════════════════════════════════════
-- SANTÉ RH — régularité : échantillon minimal et « — » sans données
--
-- Deux défauts de l'indicateur, vérifiés en production (17/11) :
--
--  1. AUCUNE GARDE D'ÉCHANTILLON. Le coefficient de variation est
--     calculé sur les jours OÙ DES POINTAGES EXISTENT (les jours
--     fermés ne produisent pas de ligne). Avec un seul jour
--     d'activité, stddev_samp d'un point est NULL → coalesce 0 →
--     « 100 % de régularité » sur un seul point. Deux jours identiques
--     → idem. Le chiffre n'est un signal que sur un vrai échantillon.
--
--  2. « 0 » AU LIEU DE « — ». Sans effectif actif (ou sans pointage),
--     la variable restait initialisée à 0 : la carte affichait
--     « Régularité 0 % » — la maladie du 0/0 que P0 a corrigée
--     ailleurs. Une valeur impossible à calculer doit être null.
--
-- Correction :
--   · v_assiduite / v_regularite initialisées à NULL ;
--   · régularité : HAVING count(*) >= 3 jours d'activité, sinon NULL
--     (la carte affiche alors « — », jamais un faux 0 ni un faux 100) ;
--   · le CV reste calculé sur les jours avec pointage : un jour
--     fermé n'est pas une fluctuation d'effectif, il est hors mesure ;
--   · ⚠️ dans le template v_sql, les valeurs NULL sont concaténées
--     via coalesce(valeur::text, 'null') : en SQL, « '' || NULL »
--     rendrait tout le template NULL (erreur 22004 en prod, incident
--     de ce 17/11), alors que le mot-clé null produit le JSON null.
--
-- Idempotence : CREATE OR REPLACE + GRANT. Aucune donnée modifiée.
-- ⚠️ Le template v_sql reste volontairement SUR UNE SEULE LIGNE
--    (incident 11/11 : le formateur a corrompu la requête).
-- ═══════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.encheck_dashboard_synthese(
  p_enterprise_id uuid DEFAULT NULL,
  p_jours integer DEFAULT 30,
  p_fuseau text DEFAULT NULL
) RETURNS json
LANGUAGE plpgsql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_jours int := coalesce(NULLIF(p_jours, 0), 30);
  v_ent uuid := p_enterprise_id;
  v_ent_tz text;
  v_fuseau text;
  v_tz text;          -- fuseau, littéral SQL sûr (quote_literal)
  v_d_fin text;       -- date locale du jour (littéral)
  v_d_debut text;     -- début de période (littéral)
  v_d_s7 text;        -- v_fin - 6 (littéral)
  v_d_prev text;      -- début des 7 jours précédents (littéral)
  v_w_att text := ''; -- fragment WHERE entreprise (attendances)
  v_w_emp text := ''; -- fragment WHERE entreprise (employees)
  v_ent_lit text;     -- uuid littéral ou NULL::uuid
  v_actifs int := 0;
  -- NULL = « valeur non calculable » (pas d'effectif, échantillon trop
  -- court). L'affichage en fait un « — », jamais un faux 0.
  v_assiduite int := NULL;
  v_regularite int := NULL;
  v_bornes_total int := 0;
  v_bornes_actives int := 0;
  v_sql text;
  v_json json;
BEGIN
  IF v_jours NOT IN (7, 30, 90) THEN
    v_jours := 30;
  END IF;

  IF v_ent IS NOT NULL THEN
    SELECT timezone INTO v_ent_tz
    FROM public.enterprises
    WHERE id = v_ent;
    v_w_att := ' AND a.enterprise_id = ' || quote_literal(v_ent::text);
    v_w_emp := ' AND e.enterprise_id = ' || quote_literal(v_ent::text);
    v_ent_lit := quote_literal(v_ent::text) || '::uuid';
  ELSE
    v_ent_lit := 'NULL::uuid';
  END IF;

  v_fuseau := coalesce(p_fuseau, v_ent_tz, 'UTC');
  -- Date du jour dans le fuseau local (pas UTC)
  v_tz := quote_literal(v_fuseau);
  v_d_fin := quote_literal(((now() AT TIME ZONE v_fuseau))::date);
  v_d_debut := quote_literal(((now() AT TIME ZONE v_fuseau))::date - (v_jours - 1));
  v_d_s7 := quote_literal(((now() AT TIME ZONE v_fuseau))::date - 6);
  v_d_prev := quote_literal(((now() AT TIME ZONE v_fuseau))::date - (v_jours - 1) - v_jours);

  -- Effectif actif (pour les ratios)
  EXECUTE 'SELECT count(*)::int
           FROM public.employees e
           WHERE e.is_active = true ' || v_w_emp
  INTO v_actifs;

  IF v_actifs > 0 THEN
    -- Assiduité : % de l'effectif qui a pointé au moins une fois sur 7 jours
    EXECUTE 'SELECT coalesce(round(100.0 * count(DISTINCT a.employee_id) / '
      || v_actifs || '), 0)::int
       FROM public.attendances a
       WHERE (a.check_time AT TIME ZONE ' || v_tz || ')::date BETWEEN '
      || v_d_s7 || ' AND ' || v_d_fin || v_w_att
    INTO v_assiduite;

    -- Régularité : 100 − coefficient de variation de l'effectif présent
    -- d'un jour à l'autre sur les 7 derniers jours, calculée sur les
    -- jours OÙ DES POINTAGES EXISTENT (un jour fermé n'est pas une
    -- fluctuation d'effectif : il ne produit pas de ligne et doit
    -- rester hors mesure). Garde d'échantillon : moins de 3 jours
    -- d'activité → NULL (« — »), car 1 ou 2 points ne font pas un
    -- signal (1 seul jour donnait « 100 % » sur un point).
    EXECUTE 'SELECT coalesce(round(
                greatest(0.0, 100.0 - 100.0 * coalesce(stddev_samp(x.n)::numeric, 0)
                         / NULLIF(avg(x.n), 0))
              ), 0)::int
       FROM (
         SELECT count(DISTINCT a.employee_id)::int AS n
         FROM public.attendances a
         WHERE (a.check_time AT TIME ZONE ' || v_tz || ')::date BETWEEN '
      || v_d_s7 || ' AND ' || v_d_fin || v_w_att
         || ' GROUP BY (a.check_time AT TIME ZONE ' || v_tz || ')::date
       ) x
       WHERE x.n > 0
       HAVING count(*) >= 3'
    INTO v_regularite;
  END IF;

  -- Bornes de pointage : via le helper SECURITY DEFINER (droits
  -- super-admin de l'UI bornes ; 0/0 pour les autres viewers —
  -- fix 403 du 12/11, ne pas réouvrir de SELECT direct ici).
  EXECUTE 'SELECT coalesce((b ->> ''total'')::int, 0),
                  coalesce((b ->> ''actives'')::int, 0)
           FROM (SELECT public.encheck_bornes_compter(' || v_ent_lit || ') AS b) x'
  INTO v_bornes_total, v_bornes_actives;

  -- La synthèse proprement dite.
  -- ⚠️ Template volontairement SUR UNE SEULE LIGNE : le SQL dynamique est
  --    exécuté tel quel. (Le formater/aligner sur plusieurs lignes via le
  --    connecteur API a corrompu la requête — incident 11/11.)
  v_sql := 'WITH hm AS ( SELECT EXTRACT(ISODOW FROM (a.check_time AT TIME ZONE ' || v_tz || ')::date)::int AS js, EXTRACT(HOUR FROM (a.check_time AT TIME ZONE ' || v_tz || '))::int AS h, count(*)::int AS c FROM public.attendances a WHERE lower(trim(a.check_type)) IN (''in'', ''i'', ''entree'') AND (a.check_time AT TIME ZONE ' || v_tz || ')::date BETWEEN ' || v_d_debut || ' AND ' || v_d_fin || v_w_att || ' GROUP BY 1, 2 ) SELECT jsonb_build_object( ''ok'', true, ''entreprise'', ' || v_ent_lit || ', ''fuseau'', ' || v_tz || ', ''jours'', ' || v_jours || ', ''employes_actifs'', ' || v_actifs || ', ''sante'', jsonb_build_object(''assiduite'', ' || coalesce(v_assiduite::text, 'null') || ', ''regularite'', ' || coalesce(v_regularite::text, 'null') || '), ''bornes'', jsonb_build_object(''total'', ' || v_bornes_total || ', ''actives'', ' || v_bornes_actives || '), ''tendance'', ( SELECT jsonb_build_object( ''entrees_7j'', coalesce(sum(CASE WHEN t.d BETWEEN ' || v_d_s7 || ' AND ' || v_d_fin || ' THEN t.n END), 0), ''entrees_7j_prev'', coalesce(sum(CASE WHEN t.d BETWEEN ' || v_d_prev || ' AND ' || v_d_s7 || '::date - 1 THEN t.n END), 0)) FROM ( SELECT (a.check_time AT TIME ZONE ' || v_tz || ')::date AS d, count(*)::int AS n FROM public.attendances a WHERE lower(trim(a.check_type)) IN (''in'', ''i'', ''entree'') AND (a.check_time AT TIME ZONE ' || v_tz || ')::date BETWEEN ' || v_d_prev || ' AND ' || v_d_fin || v_w_att || ' GROUP BY 1 ) t ), ''serie'', coalesce(( SELECT jsonb_agg(jsonb_build_object( ''d'', to_char(dj.j, ''YYYY-MM-DD''), ''jour_semaine'', EXTRACT(ISODOW FROM dj.j)::int, ''entrees'', coalesce(s.n, 0), ''presents'', coalesce(s.p, 0)) ORDER BY dj.j) FROM generate_series(' || v_d_debut || '::timestamptz, ' || v_d_fin || '::timestamptz, interval ''1 day'') dj(j) LEFT JOIN ( SELECT (a.check_time AT TIME ZONE ' || v_tz || ')::date AS dj2, count(*) FILTER ( WHERE lower(trim(a.check_type)) IN (''in'', ''i'', ''entree'') )::int AS n, count(DISTINCT a.employee_id)::int AS p FROM public.attendances a WHERE (a.check_time AT TIME ZONE ' || v_tz || ')::date BETWEEN ' || v_d_debut || ' AND ' || v_d_fin || v_w_att || ' GROUP BY 1 ) s ON s.dj2 = dj.j ), ''[]''::jsonb), ''heatmap'', ( SELECT jsonb_agg(hour_array ORDER BY jour) FROM ( SELECT g.jour AS jour, (SELECT jsonb_agg(coalesce(m.c, 0)::int ORDER BY hh) FROM generate_series(0, 23) hh LEFT JOIN hm m ON m.js = g.jour AND m.h = hh) AS hour_array FROM generate_series(1, 7) g(jour) ) heat ) )';

  EXECUTE v_sql INTO v_json;

  RETURN v_json;
END;
$$;

-- Droits inchangés du fix 403 (12/11) : authenticated uniquement.
REVOKE EXECUTE ON FUNCTION public.encheck_dashboard_synthese(uuid, integer, text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.encheck_dashboard_synthese(uuid, integer, text) FROM anon;
GRANT EXECUTE ON FUNCTION public.encheck_dashboard_synthese(uuid, integer, text) TO authenticated;
