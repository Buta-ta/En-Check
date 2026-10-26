-- Requires 018/019. No activation or factor removal is performed by migration.
BEGIN;
-- Drain old Edge workers before deployment; do not migrate an unfinished legacy job.
DO $legacy$ DECLARE unfinished boolean; BEGIN
 IF to_regclass('public.admin_mfa_recovery_jobs') IS NOT NULL THEN
  EXECUTE 'SELECT EXISTS(SELECT 1 FROM public.admin_mfa_recovery_jobs WHERE state<>''completed'')' INTO unfinished;
  IF unfinished THEN RAISE EXCEPTION 'Vérifier les récupérations historiques avant migration.'; END IF;
 END IF;
 IF to_regprocedure('public.encheck_mfa_recovery_prepare(uuid,text,text)') IS NOT NULL THEN
  REVOKE ALL ON FUNCTION public.encheck_mfa_recovery_prepare(uuid,text,text) FROM PUBLIC,anon,authenticated;
 END IF;
END $legacy$;
CREATE TABLE IF NOT EXISTS public.admin_mfa_recoveries_v2(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), actor_id uuid NOT NULL,
 actor_user_id uuid NOT NULL,actor_session_id uuid NOT NULL,
 target_id uuid NOT NULL REFERENCES public.admins(id),user_id uuid NOT NULL,
 reason text NOT NULL, state text NOT NULL DEFAULT 'pending' CHECK(state IN ('pending','running','completed','failed')),
 created_at timestamptz NOT NULL DEFAULT now(),claimed_at timestamptz,finished_at timestamptz
);
ALTER TABLE public.admin_mfa_recoveries_v2 ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.admin_mfa_recoveries_v2 FROM PUBLIC,anon,authenticated;
CREATE OR REPLACE FUNCTION public.encheck_mfa_recovery_prepare_v2(p_target_id uuid,p_confirm_email text,p_reason text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE actor uuid; target public.admins; job uuid;
BEGIN
 PERFORM public.encheck_admin_request_guard();
 IF NOT EXISTS(SELECT 1 FROM public.admin_mfa_policy_config WHERE enabled) OR coalesce(current_setting('pgrst.db_pre_request',true),'')<>'public.encheck_admin_request_guard' THEN RAISE EXCEPTION 'Activation coordonnée requise.'; END IF;
 IF NOT public.encheck_admin_session_valid() OR auth.jwt()->>'aal' IS DISTINCT FROM 'aal2' OR NOT EXISTS(SELECT 1 FROM auth.mfa_factors WHERE user_id=auth.uid() AND status='verified') THEN RAISE EXCEPTION 'MFA requise.' USING ERRCODE='42501'; END IF;
 SELECT id INTO actor FROM public.admins WHERE user_id=auth.uid() AND is_active IS TRUE AND role='super_admin';
 IF actor IS NULL OR actor=p_target_id THEN RAISE EXCEPTION 'Autre superadmin requis.' USING ERRCODE='42501'; END IF;
 IF p_reason IS NULL OR length(btrim(p_reason)) NOT BETWEEN 5 AND 500 THEN RAISE EXCEPTION 'Motif requis.'; END IF;
 SELECT * INTO STRICT target FROM public.admins WHERE id=p_target_id FOR UPDATE;
 IF target.is_active IS DISTINCT FROM true OR target.user_id IS NULL OR target.user_id=auth.uid()
 OR (SELECT count(*) FROM public.admins WHERE user_id=target.user_id)<>1
 OR NOT EXISTS(SELECT 1 FROM auth.users WHERE id=target.user_id AND lower(email)=lower(btrim(p_confirm_email)))
 OR lower(target.email) IS DISTINCT FROM lower(btrim(p_confirm_email)) THEN RAISE EXCEPTION 'Identité cible non confirmée.'; END IF;
 IF EXISTS(SELECT 1 FROM public.admin_mfa_recoveries_v2 WHERE user_id=target.user_id AND (state IN ('pending','running') OR created_at>now()-interval '2 minutes')) THEN RAISE EXCEPTION 'Récupération en cours ou récente : vérifier son état.'; END IF;
 -- Create/preserve obligation BEFORE any provider operation, including voluntary MFA users.
 INSERT INTO public.admin_mfa_requirements(admin_id,actor_id,reason) VALUES(target.id,actor,btrim(p_reason)) ON CONFLICT DO NOTHING;
 INSERT INTO public.admin_session_revocations(session_id,user_id,actor_id,reason)
 SELECT id,user_id,actor,btrim(p_reason) FROM auth.sessions WHERE user_id=target.user_id ON CONFLICT DO NOTHING;
 INSERT INTO public.admin_mfa_recoveries_v2(actor_id,actor_user_id,actor_session_id,target_id,user_id,reason) VALUES(actor,auth.uid(),(auth.jwt()->>'session_id')::uuid,target.id,target.user_id,btrim(p_reason)) RETURNING id INTO job;
 RETURN jsonb_build_object('id',job);
END $$;
CREATE OR REPLACE FUNCTION public.encheck_mfa_recovery_claim_v2(p_job_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE job public.admin_mfa_recoveries_v2;
BEGIN
 SELECT * INTO STRICT job FROM public.admin_mfa_recoveries_v2 WHERE id=p_job_id FOR UPDATE;
 IF job.state<>'pending' OR job.created_at<now()-interval '2 minutes' THEN RAISE EXCEPTION 'Intervention non réutilisable ou expirée.'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.admins WHERE id=job.actor_id AND user_id=job.actor_user_id AND is_active IS TRUE AND role='super_admin') OR NOT EXISTS(SELECT 1 FROM auth.sessions WHERE id=job.actor_session_id AND user_id=job.actor_user_id AND (not_after IS NULL OR not_after>now())) OR EXISTS(SELECT 1 FROM public.admin_session_revocations WHERE session_id=job.actor_session_id) OR NOT EXISTS(SELECT 1 FROM auth.mfa_factors WHERE user_id=job.actor_user_id AND status='verified') THEN RAISE EXCEPTION 'Intervenant indisponible.'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.admins WHERE id=job.target_id AND user_id=job.user_id AND is_active IS TRUE) THEN RAISE EXCEPTION 'Cible modifiée.'; END IF;
 UPDATE public.admin_mfa_recoveries_v2 SET state='running',claimed_at=clock_timestamp() WHERE id=job.id;
 RETURN jsonb_build_object('user_id',job.user_id);
END $$;
CREATE OR REPLACE FUNCTION public.encheck_mfa_recovery_finish_v2(p_job_id uuid,p_success boolean)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE job public.admin_mfa_recoveries_v2; completed boolean;
BEGIN
 SELECT * INTO STRICT job FROM public.admin_mfa_recoveries_v2 WHERE id=p_job_id FOR UPDATE;
 IF job.state IN ('completed','failed') THEN RETURN jsonb_build_object('completed',job.state='completed'); END IF;
 IF job.state<>'running' THEN RAISE EXCEPTION 'Intervention non démarrée.'; END IF;
 completed:=p_success IS TRUE AND EXISTS(SELECT 1 FROM public.admins WHERE id=job.target_id AND user_id=job.user_id AND is_active IS TRUE) AND NOT EXISTS(SELECT 1 FROM auth.mfa_factors WHERE user_id=job.user_id);
 -- Include sessions created while Auth deletion was running. Never clear the obligation.
 INSERT INTO public.admin_session_revocations(session_id,user_id,actor_id,reason)
 SELECT id,user_id,job.actor_id,job.reason FROM auth.sessions WHERE user_id=job.user_id ON CONFLICT DO NOTHING;
 UPDATE public.admin_mfa_recoveries_v2 SET state=CASE WHEN completed THEN 'completed' ELSE 'failed' END,finished_at=clock_timestamp() WHERE id=job.id;
 RETURN jsonb_build_object('completed',completed);
END $$;
CREATE OR REPLACE FUNCTION public.encheck_mfa_recovery_status_v2(p_target_id uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=pg_catalog,public AS $$
BEGIN
 PERFORM public.encheck_admin_request_guard();
 IF NOT public.encheck_admin_session_valid() OR auth.jwt()->>'aal' IS DISTINCT FROM 'aal2' OR NOT EXISTS(SELECT 1 FROM public.admins WHERE user_id=auth.uid() AND is_active IS TRUE AND role='super_admin') THEN RAISE EXCEPTION 'Superadmin MFA requis.' USING ERRCODE='42501'; END IF;
 RETURN coalesce((SELECT jsonb_build_object('state',state,'created_at',created_at,'finished_at',finished_at) FROM public.admin_mfa_recoveries_v2 WHERE target_id=p_target_id ORDER BY created_at DESC,id DESC LIMIT 1),jsonb_build_object('state','none'));
END $$;
-- Preserve 019's MFA test; additionally block recovery in progress/failed and old sessions.
DO $install$ BEGIN
 IF to_regprocedure('public.encheck_mfa_access_before_recovery()') IS NULL THEN
 EXECUTE replace(pg_get_functiondef('public.encheck_mfa_access_allowed()'::regprocedure),'public.encheck_mfa_access_allowed()', 'public.encheck_mfa_access_before_recovery()');
 END IF;
END $install$;
CREATE OR REPLACE FUNCTION public.encheck_mfa_access_allowed() RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,public AS $$
 SELECT public.encheck_mfa_access_before_recovery()
 AND NOT EXISTS(SELECT 1 FROM public.admin_session_revocations WHERE user_id=auth.uid() AND session_id::text=auth.jwt()->>'session_id')
 AND coalesce((SELECT state='completed' FROM public.admin_mfa_recoveries_v2 WHERE user_id=auth.uid() ORDER BY created_at DESC,id DESC LIMIT 1),true);
$$;
REVOKE ALL ON FUNCTION public.encheck_mfa_access_before_recovery(),public.encheck_mfa_recovery_prepare_v2(uuid,text,text),public.encheck_mfa_recovery_claim_v2(uuid),public.encheck_mfa_recovery_finish_v2(uuid,boolean),public.encheck_mfa_recovery_status_v2(uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.encheck_mfa_recovery_prepare_v2(uuid,text,text),public.encheck_mfa_recovery_status_v2(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.encheck_mfa_recovery_claim_v2(uuid),public.encheck_mfa_recovery_finish_v2(uuid,boolean) TO service_role;
NOTIFY pgrst,'reload schema';
COMMIT;
