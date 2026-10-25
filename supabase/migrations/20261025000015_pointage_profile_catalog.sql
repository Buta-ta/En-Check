-- Additive Pointage contract v1. No employee rows or existing sessions changed.
-- The issuer is internal: PIN/QR SECURITY DEFINER owners retain execution.
REVOKE ALL ON FUNCTION public.encheck_session_ouvrir(uuid,uuid,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.encheck_session_ouvrir(uuid,uuid,text) TO service_role;

-- Existing tokens could have been minted through the formerly public issuer.
-- New profile reads require fresh authentication after this permanent cutover.
CREATE TABLE IF NOT EXISTS public.pointage_profile_contract (
 singleton boolean PRIMARY KEY DEFAULT true CHECK(singleton),
 trusted_since timestamptz NOT NULL DEFAULT clock_timestamp()
);
ALTER TABLE public.pointage_profile_contract ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.pointage_profile_contract FROM PUBLIC,anon,authenticated;
INSERT INTO public.pointage_profile_contract(singleton) VALUES(true) ON CONFLICT DO NOTHING;

CREATE OR REPLACE FUNCTION public.encheck_employe_profil(p_jeton text)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path=pg_catalog,public AS $$
DECLARE
 s public.employee_sessions%ROWTYPE;
 e public.employees%ROWTYPE;
 v_trusted timestamptz;
 v_expire timestamptz;
 v_schedules jsonb;
BEGIN
 IF p_jeton IS NULL OR length(btrim(p_jeton))=0 OR octet_length(p_jeton)>1024 THEN
  RETURN jsonb_build_object('ok',false,'raison','jeton_invalide');
 END IF;
 SELECT * INTO s FROM public.employee_sessions WHERE jeton_hash=md5(btrim(p_jeton));
 IF NOT FOUND THEN RETURN jsonb_build_object('ok',false,'raison','jeton_invalide'); END IF;
 IF s.revoque_le IS NOT NULL THEN RETURN jsonb_build_object('ok',false,'raison','jeton_revoque'); END IF;
 SELECT trusted_since INTO v_trusted FROM public.pointage_profile_contract WHERE singleton;
 IF v_trusted IS NULL OR s.cree_le IS NULL OR s.cree_le < v_trusted THEN
  RETURN jsonb_build_object('ok',false,'raison','reauthentification_requise');
 END IF;
 -- This read endpoint never renews a session. Legacy punch TTL is unchanged.
 v_expire:=least(s.expire_le,s.cree_le+interval '12 hours');
 IF s.expire_le IS NULL OR v_expire<=statement_timestamp() THEN
  RETURN jsonb_build_object('ok',false,'raison','jeton_expire');
 END IF;
 SELECT * INTO e FROM public.employees WHERE id=s.employee_id;
 IF NOT FOUND OR e.enterprise_id IS DISTINCT FROM s.enterprise_id THEN
  RETURN jsonb_build_object('ok',false,'raison','jeton_invalide');
 END IF;
 IF e.is_active IS DISTINCT FROM true THEN RETURN jsonb_build_object('ok',false,'raison','employe_inactif'); END IF;
 IF NOT EXISTS(SELECT 1 FROM public.enterprises WHERE id=e.enterprise_id AND is_active IS TRUE) THEN
  RETURN jsonb_build_object('ok',false,'raison','entreprise_inactive');
 END IF;
 SELECT coalesce(jsonb_agg(jsonb_build_object(
   'employee_id',es.employee_id,'work_schedule_id',es.schedule_id,
   'use_custom_hours',es.use_custom_hours,
   'custom_start_time',es.custom_start_time,'custom_end_time',es.custom_end_time,
   'custom_has_break',es.custom_has_break,'custom_break_start',es.custom_break_start,
   'custom_break_end',es.custom_break_end,'custom_work_days',es.custom_work_days,
   'work_schedules',jsonb_build_object('id',w.id,'name',w.name,
     'start_time',w.start_time,'end_time',w.end_time,'work_days',w.work_days,
     'has_break',w.has_break,'break_start',w.break_start,'break_end',w.break_end)
 ) ORDER BY es.updated_at DESC NULLS LAST,es.created_at DESC NULLS LAST,es.id),'[]'::jsonb)
 INTO v_schedules
 FROM public.employee_schedules es JOIN public.work_schedules w ON w.id=es.schedule_id
 WHERE es.employee_id=e.id AND es.is_active IS TRUE
   AND w.enterprise_id=e.enterprise_id AND w.is_active IS TRUE;
 RETURN jsonb_build_object('ok',true,'expire_le',v_expire,'employee',jsonb_build_object(
   'id',e.id,'enterprise_id',e.enterprise_id,'matricule',e.matricule,
   'first_name',e.first_name,'last_name',e.last_name,'photo_url',e.photo_url,
   'is_active',e.is_active,'department',e.department,'position',e.position,
   'employee_schedules',v_schedules));
END;
$$;

CREATE OR REPLACE FUNCTION public.encheck_entreprises_publiques()
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER
SET search_path=pg_catalog,public AS $$
 SELECT jsonb_build_object('ok',true,'entreprises',coalesce(jsonb_agg(
   jsonb_build_object('id',e.id,'name',e.name,'logo_url',e.logo_url,
     'matricule_prefix',e.matricule_prefix,'pointage_mode',c.pointage_mode)
   ORDER BY e.name,e.id),'[]'::jsonb))
 FROM public.enterprises e LEFT JOIN public.face_recognition_config c ON c.enterprise_id=e.id
 WHERE e.is_active IS TRUE;
$$;
REVOKE ALL ON FUNCTION public.encheck_employe_profil(text),public.encheck_entreprises_publiques() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.encheck_employe_profil(text),public.encheck_entreprises_publiques() TO anon,authenticated,service_role;
NOTIFY pgrst,'reload schema';
