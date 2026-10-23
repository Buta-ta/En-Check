-- À VALIDER ET EXÉCUTER MANUELLEMENT, pas de déploiement automatique.
-- Transactionnel / idempotent. SECURITY INVOKER : conserve les RLS et privilèges
-- de l'appelant, avec contrôle administratif explicite supplémentaire.
-- Ce fichier ne modifie aucun barème ni bulletin existant.
BEGIN;
DO $$
DECLARE t text; missing text;
BEGIN
  IF to_regprocedure('public.admin_has_access_to_enterprise(uuid)') IS NULL THEN
    RAISE EXCEPTION 'Préflight : helper admin_has_access_to_enterprise(uuid) absent';
  END IF;
  FOREACH t IN ARRAY ARRAY['enterprises','payroll_settings','enterprise_payroll_contributions','enterprise_tax_brackets'] LOOP
    IF to_regclass('public.' || t) IS NULL THEN RAISE EXCEPTION 'Préflight : table % absente', t; END IF;
  END LOOP;
  SELECT string_agg(required.tbl || '.' || col, ', ') INTO missing
  FROM (VALUES
    ('enterprises', ARRAY['id','country_code','currency','fiscal_country_label']),
    ('payroll_settings', ARRAY['id','enterprise_id','custom_tax_rules','created_at','updated_at']),
    ('enterprise_payroll_contributions', ARRAY['id','enterprise_id','contribution_type','contribution_code','contribution_name','paid_by','calculation_method','rate_employee','rate_employer','fixed_amount','calculation_base','min_base','max_base','is_mandatory','is_active','display_order','notes']),
    ('enterprise_tax_brackets', ARRAY['id','enterprise_id','bracket_name','min_amount','max_amount','tax_rate','fixed_deduction','tax_type','bracket_order','is_active'])
  ) required(tbl, cols) CROSS JOIN LATERAL unnest(required.cols) col
  WHERE NOT EXISTS(SELECT 1 FROM information_schema.columns c WHERE c.table_schema='public' AND c.table_name=required.tbl AND c.column_name=col);
  IF missing IS NOT NULL THEN RAISE EXCEPTION 'Préflight : colonnes absentes %', missing; END IF;
  IF EXISTS (SELECT 1 FROM public.payroll_settings GROUP BY enterprise_id HAVING count(*) > 1) THEN
    RAISE EXCEPTION 'Préflight : plusieurs payroll_settings pour une entreprise';
  END IF;
END $$;

-- Verrou commun à tous les appels de ces deux RPC. Comparaison sur le JSON BRUT,
-- et non sur les règles fusionnées avec le pays.
CREATE OR REPLACE FUNCTION public.paie_enregistrer_regles(
  p_enterprise_id uuid, p_rules jsonb, p_expected_rules jsonb
) RETURNS boolean LANGUAGE plpgsql SECURITY INVOKER SET search_path = public, pg_temp AS $$
DECLARE old_rules jsonb; row_id uuid;
BEGIN
  IF NOT coalesce(public.admin_has_access_to_enterprise(p_enterprise_id), false) THEN
    RAISE EXCEPTION 'Accès administratif refusé' USING ERRCODE = '42501';
  END IF;
  IF jsonb_typeof(p_rules) IS DISTINCT FROM 'object' THEN RAISE EXCEPTION 'Règles invalides'; END IF;
  PERFORM 1 FROM public.enterprises WHERE id = p_enterprise_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Entreprise inaccessible' USING ERRCODE = '42501'; END IF;
  SELECT id, custom_tax_rules INTO row_id, old_rules FROM public.payroll_settings
    WHERE enterprise_id = p_enterprise_id FOR UPDATE;
  IF old_rules IS DISTINCT FROM p_expected_rules THEN
    RAISE EXCEPTION 'Conflit : les règles ont changé' USING ERRCODE = '40001';
  END IF;
  IF row_id IS NULL THEN
    INSERT INTO public.payroll_settings(enterprise_id, custom_tax_rules, created_at, updated_at)
      VALUES(p_enterprise_id, p_rules, now(), now());
  ELSE
    UPDATE public.payroll_settings SET custom_tax_rules = p_rules, updated_at = now() WHERE id = row_id;
    IF NOT FOUND THEN RAISE EXCEPTION 'Écriture refusée' USING ERRCODE = '42501'; END IF;
  END IF;
  RETURN true;
END $$;

CREATE OR REPLACE FUNCTION public.paie_remplacer_configuration(
  p_enterprise_id uuid, p_contributions jsonb, p_tranches jsonb, p_rules jsonb,
  p_country_code text DEFAULT NULL, p_currency text DEFAULT NULL, p_fiscal_label text DEFAULT NULL
) RETURNS boolean LANGUAGE plpgsql SECURITY INVOKER SET search_path = public, pg_temp AS $$
DECLARE row_id uuid; item jsonb;
BEGIN
  IF NOT coalesce(public.admin_has_access_to_enterprise(p_enterprise_id), false) THEN
    RAISE EXCEPTION 'Accès administratif refusé' USING ERRCODE = '42501';
  END IF;
  IF jsonb_typeof(p_contributions) IS DISTINCT FROM 'array'
     OR jsonb_typeof(p_tranches) IS DISTINCT FROM 'array'
     OR jsonb_typeof(p_rules) IS DISTINCT FROM 'object' THEN RAISE EXCEPTION 'Configuration invalide'; END IF;
  PERFORM 1 FROM public.enterprises WHERE id = p_enterprise_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Entreprise inaccessible' USING ERRCODE = '42501'; END IF;
  -- Tous les contrôles de forme AVANT suppression. Toute exception après celle-ci
  -- annule quand même la totalité de la fonction dans PostgreSQL.
  FOR item IN SELECT value FROM jsonb_array_elements(p_contributions) LOOP
    IF coalesce(item->>'contribution_code', item->>'code', '') = ''
      OR coalesce(item->>'paid_by', '') NOT IN ('employee','employer','both') THEN
      RAISE EXCEPTION 'Cotisation incomplète';
    END IF;
    IF coalesce((item->>'rate_employee')::numeric,0) < 0
      OR coalesce((item->>'rate_employer')::numeric,0) < 0
      OR coalesce((item->>'fixed_amount')::numeric,0) < 0 THEN RAISE EXCEPTION 'Cotisation négative'; END IF;
  END LOOP;
  FOR item IN SELECT value FROM jsonb_array_elements(p_tranches) LOOP
    IF coalesce((item->>'min_amount')::numeric,0) < 0
      OR coalesce((item->>'tax_rate')::numeric,0) NOT BETWEEN 0 AND 100
      OR ((item->>'max_amount')::numeric < coalesce((item->>'min_amount')::numeric,0)) THEN
      RAISE EXCEPTION 'Tranche invalide';
    END IF;
  END LOOP;
  DELETE FROM public.enterprise_payroll_contributions WHERE enterprise_id = p_enterprise_id;
  DELETE FROM public.enterprise_tax_brackets WHERE enterprise_id = p_enterprise_id;
  -- Si une politique RLS a caché des lignes, ne pas prétendre avoir remplacé la configuration.
  IF EXISTS(SELECT 1 FROM public.enterprise_payroll_contributions WHERE enterprise_id = p_enterprise_id)
    OR EXISTS(SELECT 1 FROM public.enterprise_tax_brackets WHERE enterprise_id = p_enterprise_id) THEN
    RAISE EXCEPTION 'Suppression refusée' USING ERRCODE = '42501';
  END IF;
  INSERT INTO public.enterprise_payroll_contributions(
    enterprise_id, contribution_type, contribution_code, contribution_name, paid_by,
    calculation_method, rate_employee, rate_employer, fixed_amount, calculation_base,
    min_base, max_base, is_mandatory, is_active, display_order, notes
  ) SELECT p_enterprise_id, coalesce(x->>'contribution_type',x->>'type','social'),
    coalesce(x->>'contribution_code',x->>'code'), coalesce(x->>'contribution_name',x->>'name',x->>'contribution_code',x->>'code'),
    x->>'paid_by', coalesce(x->>'calculation_method','percentage'),
    coalesce((x->>'rate_employee')::numeric,0),coalesce((x->>'rate_employer')::numeric,0),
    coalesce((x->>'fixed_amount')::numeric,0),coalesce(x->>'calculation_base','gross_salary'),
    (x->>'min_base')::numeric,(x->>'max_base')::numeric,
    coalesce((x->>'is_mandatory')::boolean,false),coalesce((x->>'is_active')::boolean,true),coalesce((x->>'display_order')::integer,0),x->>'notes'
    FROM jsonb_array_elements(p_contributions) x;
  INSERT INTO public.enterprise_tax_brackets(
    enterprise_id, bracket_name, min_amount, max_amount, tax_rate, fixed_deduction, tax_type, bracket_order, is_active
  ) SELECT p_enterprise_id,coalesce(x->>'bracket_name','Tranche'),coalesce((x->>'min_amount')::numeric,0),
    (x->>'max_amount')::numeric,coalesce((x->>'tax_rate')::numeric,0),coalesce((x->>'fixed_deduction')::numeric,0),
    coalesce(x->>'tax_type','irpp'),coalesce((x->>'bracket_order')::integer,0),coalesce((x->>'is_active')::boolean,true)
    FROM jsonb_array_elements(p_tranches) x;
  IF p_country_code IS NOT NULL THEN
    UPDATE public.enterprises SET country_code = p_country_code, currency = p_currency,
      fiscal_country_label = p_fiscal_label WHERE id = p_enterprise_id;
    IF NOT FOUND THEN RAISE EXCEPTION 'Écriture entreprise refusée' USING ERRCODE = '42501'; END IF;
  END IF;
  SELECT id INTO row_id FROM public.payroll_settings WHERE enterprise_id = p_enterprise_id FOR UPDATE;
  IF row_id IS NULL THEN
    INSERT INTO public.payroll_settings(enterprise_id,custom_tax_rules,created_at,updated_at)
      VALUES(p_enterprise_id,p_rules,now(),now());
  ELSE
    UPDATE public.payroll_settings SET custom_tax_rules=p_rules,updated_at=now() WHERE id=row_id;
    IF NOT FOUND THEN RAISE EXCEPTION 'Écriture règles refusée' USING ERRCODE = '42501'; END IF;
  END IF;
  RETURN true;
END $$;
REVOKE ALL ON FUNCTION public.paie_enregistrer_regles(uuid,jsonb,jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.paie_remplacer_configuration(uuid,jsonb,jsonb,jsonb,text,text,text) FROM PUBLIC;
-- Supabase peut accorder EXECUTE à anon via les privilèges par défaut.
REVOKE ALL ON FUNCTION public.paie_enregistrer_regles(uuid,jsonb,jsonb) FROM anon;
REVOKE ALL ON FUNCTION public.paie_remplacer_configuration(uuid,jsonb,jsonb,jsonb,text,text,text) FROM anon;
GRANT EXECUTE ON FUNCTION public.paie_enregistrer_regles(uuid,jsonb,jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.paie_remplacer_configuration(uuid,jsonb,jsonb,jsonb,text,text,text) TO authenticated;
COMMIT;
