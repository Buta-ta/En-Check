-- ═══════════════════════════════════════════════════════════════
-- FIX 403 PROD (12/11) — synthèse dashboard : comptage des bornes
--
-- Symptôme : /rest/v1/rpc/encheck_dashboard_synthese → 403 pour les
-- admins connectés, la couche analytique se retirait silencieusement.
--
-- Cause : encheck_dashboard_synthese (SECURITY INVOKER) comptait les
-- bornes par un SELECT direct sur public.pointage_bornes, mais le rôle
-- `authenticated` n'a PAS de GRANT SELECT sur cette table (42501, que
-- PostgREST renvoie en 403). Les tests précédents avaient été faits en
-- service_role (tout-puissant) : l'échec n'était pas visible.
--
-- Pourquoi PAS un simple `GRANT SELECT ... TO authenticated` :
-- la politique RLS de lecture (encheck_custom_row_allowed) renvoie
-- true pour tout utilisateur SANS rôle admin → la liste complète des
-- bornes de la plateforme aurait fuité à n'importe quel compte
-- authentifié. La table ne doit rester lisible que via le chemin
-- sécurisé super-admin (encheck_borne_admin_guard), comme l'UI
-- d'administration des bornes.
--
-- Fix :
--   1. encheck_bornes_compter(uuid) — SECURITY DEFINER, même garde
--      stricte que l'UI bornes (super-admin AAL2, session valide,
--      guard sécurité actif). Pas d'exception : les autres appelants
--      reçoivent {'total':0,'actives':0}, la synthèse reste verte
--      pour tous les viewers du dashboard.
--   2. encheck_dashboard_synthese — le comptage passe par ce helper.
--   3. Droits resserres sur les deux fonctions (plus d'EXECUTE PUBLIC).
--
-- Idempotence : CREATE OR REPLACE / GRANT / REVOKE. Aucune donnée
-- modifiée.
-- ═══════════════════════════════════════════════════════════════

-- ── 1. Helper de comptage (même garde que l'UI bornes, sans exception)
CREATE OR REPLACE FUNCTION public.encheck_bornes_compter(p_enterprise_id uuid DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
-- Compte les bornes de pointage visibles par l'appelant, avec la même
-- règle d'accès que l'UI d'administration des bornes
-- (encheck_borne_admin_guard : super-admin avec MFA AAL2, session
-- valide, garde sécurité active). Contrairement à l'UI, aucun
-- EXCEPTION : les autres appelants reçoivent 0/0 pour que la synthèse
-- du dashboard continue de fonctionner pour tous (incident 403 du
-- 12/11).
DECLARE
  v_total integer;
  v_actives integer;
  v_w text := '';
BEGIN
  BEGIN
    PERFORM public.encheck_borne_admin_guard();
  EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object('total', 0, 'actives', 0);
  END;

  IF p_enterprise_id IS NOT NULL THEN
    v_w := ' AND enterprise_id = ' || quote_literal(p_enterprise_id::text);
  END IF;

  EXECUTE 'SELECT count(*)::int,
                  count(*) FILTER (
                    WHERE revoque_le IS NULL AND (expire_le IS NULL OR expire_le > now())
                  )::int
           FROM public.pointage_bornes
           WHERE 1 = 1' || v_w
  INTO v_total, v_actives;

  RETURN jsonb_build_object('total', v_total, 'actives', v_actives);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.encheck_bornes_compter(uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.encheck_bornes_compter(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.encheck_bornes_compter(uuid) TO authenticated;

-- ── 2. Synthèse : le comptage des bornes passe par le helper
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
  v_assiduite int := 0;
  v_regularite int := 0;
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
    -- d'un jour à l'autre sur 7 jours (100 = effectif stable)
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
       ) x'
    INTO v_regularite;
  END IF;

  -- Bornes de pointage (révoquées / expirées écartées des actives).
  -- ⚠️ PAS de SELECT direct ici : le rôle authenticated n'a pas le droit
  -- sur pointage_bornes (403 prod du 12/11), et il ne faut PAS l'ouvrir
  -- (le RLS de la table renvoie true hors rôle admin → fuite). Le helper
  -- SECURITY DEFINER applique la garde super-admin de l'UI bornes et
  -- rend 0/0 aux autres viewers.
  EXECUTE 'SELECT coalesce((b ->> ''total'')::int, 0),
                  coalesce((b ->> ''actives'')::int, 0)
           FROM (SELECT public.encheck_bornes_compter(' || v_ent_lit || ') AS b) x'
  INTO v_bornes_total, v_bornes_actives;

  -- La synthèse proprement dite.
  -- ⚠️ Template volontairement SUR UNE SEULE LIGNE : le SQL dynamique est
  --    exécuté tel quel. (Le formater/aligner sur plusieurs lignes via le
  --    connecteur API a corrompu la requête — incident 11/11.)
  v_sql := 'WITH hm AS ( SELECT EXTRACT(ISODOW FROM (a.check_time AT TIME ZONE ' || v_tz || ')::date)::int AS js, EXTRACT(HOUR FROM (a.check_time AT TIME ZONE ' || v_tz || '))::int AS h, count(*)::int AS c FROM public.attendances a WHERE lower(trim(a.check_type)) IN (''in'', ''i'', ''entree'') AND (a.check_time AT TIME ZONE ' || v_tz || ')::date BETWEEN ' || v_d_debut || ' AND ' || v_d_fin || v_w_att || ' GROUP BY 1, 2 ) SELECT jsonb_build_object( ''ok'', true, ''entreprise'', ' || v_ent_lit || ', ''fuseau'', ' || v_tz || ', ''jours'', ' || v_jours || ', ''employes_actifs'', ' || v_actifs || ', ''sante'', jsonb_build_object(''assiduite'', ' || v_assiduite || ', ''regularite'', ' || v_regularite || '), ''bornes'', jsonb_build_object(''total'', ' || v_bornes_total || ', ''actives'', ' || v_bornes_actives || '), ''tendance'', ( SELECT jsonb_build_object( ''entrees_7j'', coalesce(sum(CASE WHEN t.d BETWEEN ' || v_d_s7 || ' AND ' || v_d_fin || ' THEN t.n END), 0), ''entrees_7j_prev'', coalesce(sum(CASE WHEN t.d BETWEEN ' || v_d_prev || ' AND ' || v_d_s7 || '::date - 1 THEN t.n END), 0)) FROM ( SELECT (a.check_time AT TIME ZONE ' || v_tz || ')::date AS d, count(*)::int AS n FROM public.attendances a WHERE lower(trim(a.check_type)) IN (''in'', ''i'', ''entree'') AND (a.check_time AT TIME ZONE ' || v_tz || ')::date BETWEEN ' || v_d_prev || ' AND ' || v_d_fin || v_w_att || ' GROUP BY 1 ) t ), ''serie'', coalesce(( SELECT jsonb_agg(jsonb_build_object( ''d'', to_char(dj.j, ''YYYY-MM-DD''), ''jour_semaine'', EXTRACT(ISODOW FROM dj.j)::int, ''entrees'', coalesce(s.n, 0), ''presents'', coalesce(s.p, 0)) ORDER BY dj.j) FROM generate_series(' || v_d_debut || '::timestamptz, ' || v_d_fin || '::timestamptz, interval ''1 day'') dj(j) LEFT JOIN ( SELECT (a.check_time AT TIME ZONE ' || v_tz || ')::date AS dj2, count(*) FILTER ( WHERE lower(trim(a.check_type)) IN (''in'', ''i'', ''entree'') )::int AS n, count(DISTINCT a.employee_id)::int AS p FROM public.attendances a WHERE (a.check_time AT TIME ZONE ' || v_tz || ')::date BETWEEN ' || v_d_debut || ' AND ' || v_d_fin || v_w_att || ' GROUP BY 1 ) s ON s.dj2 = dj.j ), ''[]''::jsonb), ''heatmap'', ( SELECT jsonb_agg(hour_array ORDER BY jour) FROM ( SELECT g.jour AS jour, (SELECT jsonb_agg(coalesce(m.c, 0)::int ORDER BY hh) FROM generate_series(0, 23) hh LEFT JOIN hm m ON m.js = g.jour AND m.h = hh) AS hour_array FROM generate_series(1, 7) g(jour) ) heat ) )';

  EXECUTE v_sql INTO v_json;

  RETURN v_json;
END;
$$;

-- ── 3. Droits : authenticated (+ service_role) uniquement.
--    L'API Supabase accorde explicitement EXECUTE à anon à la création :
--    on la retire aussi (PUBLIC et anon), pour ne garder que les trois
--    rôles autorisés.
REVOKE EXECUTE ON FUNCTION public.encheck_dashboard_synthese(uuid, integer, text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.encheck_dashboard_synthese(uuid, integer, text) FROM anon;
GRANT EXECUTE ON FUNCTION public.encheck_dashboard_synthese(uuid, integer, text) TO authenticated;
