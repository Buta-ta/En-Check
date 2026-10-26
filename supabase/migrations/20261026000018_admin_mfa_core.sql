-- Minimal MFA/session core only. Does not enable the global REST hook.
-- Preserve any newer installed guards; never replay the full Admin migration chain.
BEGIN;
CREATE TABLE IF NOT EXISTS public.admin_session_revocations (
 session_id uuid PRIMARY KEY,user_id uuid NOT NULL,actor_id uuid NOT NULL,
 reason text NOT NULL,created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.admin_session_revocations ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.admin_session_revocations FROM PUBLIC,anon,authenticated;
DO $install$
BEGIN
 IF to_regprocedure('public.encheck_admin_session_valid()') IS NULL THEN
 EXECUTE $ddl$CREATE FUNCTION public.encheck_admin_session_valid()
 RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,public AS $body$
 SELECT (SELECT count(*) FROM public.admins WHERE user_id=auth.uid())=1 AND
 EXISTS(SELECT 1 FROM public.admins a JOIN auth.sessions s ON s.user_id=a.user_id
 WHERE a.user_id=auth.uid() AND a.is_active IS TRUE AND s.id::text=auth.jwt()->>'session_id'
 AND (s.not_after IS NULL OR s.not_after>now())
 AND NOT EXISTS(SELECT 1 FROM public.admin_session_revocations r WHERE r.session_id=s.id)
 AND (NOT EXISTS(SELECT 1 FROM auth.mfa_factors f WHERE f.user_id=a.user_id AND f.status='verified')
 OR auth.jwt()->>'aal'='aal2'));
 $body$ $ddl$;
 END IF;
 IF to_regprocedure('public.encheck_admin_request_guard()') IS NULL THEN
 EXECUTE $ddl$CREATE FUNCTION public.encheck_admin_request_guard()
 RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $body$
 BEGIN
 IF auth.uid() IS NOT NULL AND EXISTS(SELECT 1 FROM public.admins WHERE user_id=auth.uid())
 AND NOT public.encheck_admin_session_valid() THEN
 RAISE EXCEPTION 'Session administrateur non autorisée. Reconnectez-vous et vérifiez votre second facteur.' USING ERRCODE='42501';
 END IF;
 END $body$ $ddl$;
 END IF;
 IF to_regprocedure('public.encheck_account_security_status()') IS NULL THEN
 EXECUTE $ddl$CREATE FUNCTION public.encheck_account_security_status()
 RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $body$
 BEGIN
 PERFORM public.encheck_admin_request_guard();
 IF NOT public.encheck_admin_session_valid() THEN RAISE EXCEPTION 'Accès refusé.' USING ERRCODE='42501'; END IF;
 RETURN jsonb_build_object('rest_guard_active',coalesce(current_setting('pgrst.db_pre_request',true),'')='public.encheck_admin_request_guard');
 END $body$ $ddl$;
 END IF;
END $install$;
REVOKE ALL ON FUNCTION public.encheck_admin_session_valid(),public.encheck_admin_request_guard(),public.encheck_account_security_status() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.encheck_admin_request_guard() TO anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.encheck_account_security_status() TO authenticated;
NOTIFY pgrst,'reload schema';
COMMIT;
