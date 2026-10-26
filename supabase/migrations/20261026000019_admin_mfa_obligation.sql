-- Deploy before client, activate separately ONLY after channel/recovery review.
BEGIN;
CREATE TABLE IF NOT EXISTS public.admin_mfa_policy_config(id boolean PRIMARY KEY DEFAULT true CHECK(id),enabled boolean NOT NULL DEFAULT false);
INSERT INTO public.admin_mfa_policy_config(id) VALUES(true) ON CONFLICT DO NOTHING;
CREATE TABLE IF NOT EXISTS public.admin_mfa_requirements(admin_id uuid PRIMARY KEY REFERENCES public.admins(id),actor_id uuid NOT NULL,reason text NOT NULL,created_at timestamptz NOT NULL DEFAULT now());
ALTER TABLE public.admin_mfa_policy_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_mfa_requirements ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.admin_mfa_policy_config,public.admin_mfa_requirements FROM PUBLIC,anon,authenticated;
CREATE OR REPLACE FUNCTION public.encheck_mfa_access_allowed() RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,public AS $$
 SELECT NOT EXISTS(SELECT 1 FROM public.admins a JOIN public.admin_mfa_requirements r ON r.admin_id=a.id WHERE a.user_id=auth.uid())
 OR (auth.jwt()->>'aal'='aal2' AND EXISTS(SELECT 1 FROM auth.mfa_factors WHERE user_id=auth.uid() AND status='verified')) IS TRUE;
$$;
CREATE OR REPLACE FUNCTION public.encheck_mfa_obligation_statut() RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE actor uuid;
BEGIN
 IF (SELECT count(*) FROM public.admins WHERE user_id=auth.uid())<>1 THEN RAISE EXCEPTION 'Accès refusé.' USING ERRCODE='42501'; END IF;
 SELECT id INTO actor FROM public.admins WHERE user_id=auth.uid() AND is_active IS TRUE;
 IF actor IS NULL OR NOT EXISTS(SELECT 1 FROM auth.sessions s WHERE s.user_id=auth.uid() AND s.id::text=auth.jwt()->>'session_id' AND (s.not_after IS NULL OR s.not_after>now()) AND NOT EXISTS(SELECT 1 FROM public.admin_session_revocations r WHERE r.session_id=s.id)) THEN RAISE EXCEPTION 'Session refusée.' USING ERRCODE='42501'; END IF;
 RETURN jsonb_build_object('required',EXISTS(SELECT 1 FROM public.admin_mfa_requirements WHERE admin_id=actor),'satisfied',public.encheck_mfa_access_allowed(),'rest_guard_active',coalesce(current_setting('pgrst.db_pre_request',true),'')='public.encheck_admin_request_guard');
END $$;
DO $install$ BEGIN
 IF to_regprocedure('public.encheck_admin_request_guard_before_mfa()') IS NULL THEN
 IF to_regprocedure('public.encheck_admin_request_guard()') IS NULL THEN RAISE EXCEPTION 'Installer le socle MFA018 avant019.'; END IF;
 EXECUTE replace(pg_get_functiondef('public.encheck_admin_request_guard()'::regprocedure),'public.encheck_admin_request_guard()', 'public.encheck_admin_request_guard_before_mfa()');
 END IF;
END $install$;
CREATE OR REPLACE FUNCTION public.encheck_admin_request_guard() RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
BEGIN
 -- Only a read-only own-status RPC bypasses the MFA challenge, never business data.
 IF current_setting('request.path',true)='/rpc/encheck_mfa_obligation_statut' THEN PERFORM public.encheck_mfa_obligation_statut(); RETURN; END IF;
 IF NOT public.encheck_mfa_access_allowed() THEN RAISE EXCEPTION 'MFA_ENROLLMENT_REQUIRED' USING ERRCODE='42501'; END IF;
 PERFORM public.encheck_admin_request_guard_before_mfa();
END $$;
CREATE OR REPLACE FUNCTION public.encheck_mfa_exiger(p_admin_id uuid,p_motif text) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE actor uuid;
BEGIN
 PERFORM public.encheck_admin_request_guard();
 IF NOT EXISTS(SELECT 1 FROM public.admin_mfa_policy_config WHERE enabled) OR coalesce(current_setting('pgrst.db_pre_request',true),'')<>'public.encheck_admin_request_guard' THEN RAISE EXCEPTION 'Obligation indisponible : activation coordonnée requise.'; END IF;
 IF NOT public.encheck_admin_session_valid() OR auth.jwt()->>'aal' IS DISTINCT FROM 'aal2' THEN RAISE EXCEPTION 'MFA requise.' USING ERRCODE='42501'; END IF;
 SELECT id INTO actor FROM public.admins WHERE user_id=auth.uid() AND is_active IS TRUE AND role='super_admin';
 IF actor IS NULL OR actor=p_admin_id THEN RAISE EXCEPTION 'Autre compte requis.' USING ERRCODE='42501'; END IF;
 IF p_motif IS NULL OR length(btrim(p_motif)) NOT BETWEEN 5 AND 500 THEN RAISE EXCEPTION 'Motif requis.'; END IF;
 PERFORM 1 FROM public.admins a JOIN auth.users u ON u.id=a.user_id WHERE a.id=p_admin_id AND a.is_active IS TRUE AND (SELECT count(*) FROM public.admins b WHERE b.user_id=a.user_id)=1 FOR UPDATE OF a;
 IF NOT FOUND THEN RAISE EXCEPTION 'Compte actif lié à Auth requis.'; END IF;
 INSERT INTO public.admin_mfa_requirements(admin_id,actor_id,reason) VALUES(p_admin_id,actor,btrim(p_motif)) ON CONFLICT DO NOTHING;
 RETURN jsonb_build_object('ok',true,'required',true);
END $$;
CREATE OR REPLACE FUNCTION public.encheck_mfa_exigence_lire(p_admin_id uuid) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=pg_catalog,public AS $$
BEGIN
 PERFORM public.encheck_admin_request_guard();
 IF NOT public.encheck_admin_session_valid() OR auth.jwt()->>'aal' IS DISTINCT FROM 'aal2' OR NOT EXISTS(SELECT 1 FROM public.admins WHERE user_id=auth.uid() AND is_active IS TRUE AND role='super_admin') THEN RAISE EXCEPTION 'Superadmin MFA requis.' USING ERRCODE='42501'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.admins WHERE id=p_admin_id) THEN RAISE EXCEPTION 'Compte introuvable.'; END IF;
 RETURN jsonb_build_object('required',EXISTS(SELECT 1 FROM public.admin_mfa_requirements WHERE admin_id=p_admin_id),'configured',EXISTS(SELECT 1 FROM public.admins a JOIN auth.mfa_factors f ON f.user_id=a.user_id WHERE a.id=p_admin_id AND f.status='verified'));
END $$;
-- Restrictive policies prevent legacy permissive RLS from bypassing this obligation.
DO $policies$ DECLARE t record; BEGIN
 FOR t IN SELECT n.nspname,c.relname FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE c.relkind='r' AND c.relrowsecurity AND (n.nspname='public' OR (n.nspname='storage' AND c.relname='objects') OR (n.nspname='realtime' AND c.relname='messages')) LOOP
 EXECUTE format('DROP POLICY IF EXISTS encheck_mfa_obligation ON %I.%I',t.nspname,t.relname);
 EXECUTE format('CREATE POLICY encheck_mfa_obligation ON %I.%I AS RESTRICTIVE FOR ALL TO authenticated USING ((SELECT public.encheck_mfa_access_allowed())) WITH CHECK ((SELECT public.encheck_mfa_access_allowed()))',t.nspname,t.relname);
 END LOOP;
END $policies$;
REVOKE ALL ON FUNCTION public.encheck_admin_request_guard_before_mfa(),public.encheck_mfa_access_allowed(),public.encheck_mfa_obligation_statut(),public.encheck_mfa_exiger(uuid,text),public.encheck_mfa_exigence_lire(uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.encheck_mfa_access_allowed(),public.encheck_mfa_obligation_statut(),public.encheck_mfa_exiger(uuid,text),public.encheck_mfa_exigence_lire(uuid) TO authenticated;
NOTIFY pgrst,'reload schema';
COMMIT;
