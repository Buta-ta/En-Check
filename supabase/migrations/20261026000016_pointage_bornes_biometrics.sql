-- Additive stage 3a. No legacy RPC, bucket or real device is altered.
CREATE TABLE IF NOT EXISTS public.pointage_bornes (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), device_id text NOT NULL UNIQUE,
 enterprise_id uuid NOT NULL REFERENCES public.enterprises(id), secret_hash text NOT NULL,
 expire_le timestamptz NOT NULL, revoque_le timestamptz, cree_le timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.pointage_borne_sessions (
 jeton_hash text PRIMARY KEY, borne_id uuid NOT NULL REFERENCES public.pointage_bornes(id),
 expire_le timestamptz NOT NULL, revoque_le timestamptz, cree_le timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.pointage_borne_events (
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY, actor_id uuid NOT NULL,
 borne_id uuid NOT NULL, action text NOT NULL, motif text NOT NULL, cree_le timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.pointage_bornes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pointage_borne_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pointage_borne_events ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.pointage_bornes,public.pointage_borne_sessions,public.pointage_borne_events FROM PUBLIC,anon,authenticated;

CREATE OR REPLACE FUNCTION public.encheck_borne_admin_guard()
RETURNS uuid LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE actor uuid; security jsonb;
BEGIN
 IF auth.uid() IS NULL OR auth.jwt()->>'aal' IS DISTINCT FROM 'aal2'
 OR (SELECT count(*) FROM public.admins WHERE user_id=auth.uid())<>1 THEN
  RAISE EXCEPTION 'Superadministrateur avec MFA requis.' USING ERRCODE='42501';
 END IF;
 SELECT id INTO actor FROM public.admins WHERE user_id=auth.uid() AND is_active IS TRUE AND role='super_admin';
 IF actor IS NULL OR NOT EXISTS(SELECT 1 FROM auth.sessions WHERE user_id=auth.uid()
   AND id::text=auth.jwt()->>'session_id' AND (not_after IS NULL OR not_after>now())) THEN
  RAISE EXCEPTION 'Session administrateur refusée.' USING ERRCODE='42501';
 END IF;
 -- Respect the full Admin guard when it is deployed; never bypass its refusal.
 IF to_regclass('public.admin_session_revocations') IS NOT NULL AND to_regprocedure('public.encheck_account_security_status()') IS NULL THEN
  RAISE EXCEPTION 'Migration de sécurité administrateur incomplète.' USING ERRCODE='42501';
 END IF;
 IF to_regprocedure('public.encheck_account_security_status()') IS NOT NULL THEN
  EXECUTE 'select public.encheck_account_security_status()' INTO security;
  IF security->>'rest_guard_active' IS DISTINCT FROM 'true' OR security->>'custom_role_restricted'='true' THEN
   RAISE EXCEPTION 'Contrôle administrateur non actif.' USING ERRCODE='42501';
  END IF;
 END IF;
 RETURN actor;
END $$;

CREATE OR REPLACE FUNCTION public.encheck_borne_creer(p_device_id text,p_enterprise_id uuid,p_expire_le timestamptz,p_motif text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE actor uuid:=public.encheck_borne_admin_guard(); bid uuid; secret text;
BEGIN
 IF p_device_id IS NULL OR length(btrim(p_device_id)) NOT BETWEEN 1 AND 128
 OR p_motif IS NULL OR length(btrim(p_motif)) NOT BETWEEN 5 AND 500 OR p_motif ~ '(bs1_|bk1_)'
 OR p_expire_le IS NULL OR p_expire_le<=now() OR p_expire_le>now()+interval '90 days'
 OR NOT EXISTS(SELECT 1 FROM public.enterprises WHERE id=p_enterprise_id AND is_active IS TRUE) THEN
  RAISE EXCEPTION 'Paramètres de borne invalides.';
 END IF;
 secret:='bs1_'||replace(gen_random_uuid()::text||gen_random_uuid()::text,'-','');
 INSERT INTO public.pointage_bornes(device_id,enterprise_id,secret_hash,expire_le)
 VALUES(btrim(p_device_id),p_enterprise_id,encode(sha256(convert_to(secret,'UTF8')),'hex'),p_expire_le) RETURNING id INTO bid;
 INSERT INTO public.pointage_borne_events(actor_id,borne_id,action,motif) VALUES(actor,bid,'created',btrim(p_motif));
 RETURN jsonb_build_object('ok',true,'borne_id',bid,'device_id',btrim(p_device_id),'secret',secret,'expire_le',p_expire_le);
END $$;

CREATE OR REPLACE FUNCTION public.encheck_borne_revoquer(p_borne_id uuid,p_motif text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE actor uuid:=public.encheck_borne_admin_guard();
BEGIN
 IF p_motif IS NULL OR length(btrim(p_motif)) NOT BETWEEN 5 AND 500 OR p_motif ~ '(bs1_|bk1_)' THEN RAISE EXCEPTION 'Motif requis.'; END IF;
 UPDATE public.pointage_bornes SET revoque_le=coalesce(revoque_le,now()) WHERE id=p_borne_id;
 IF NOT FOUND THEN RAISE EXCEPTION 'Borne introuvable.'; END IF;
 UPDATE public.pointage_borne_sessions SET revoque_le=coalesce(revoque_le,now()) WHERE borne_id=p_borne_id;
 INSERT INTO public.pointage_borne_events(actor_id,borne_id,action,motif) VALUES(actor,p_borne_id,'revoked',btrim(p_motif));
 RETURN jsonb_build_object('ok',true);
END $$;

CREATE OR REPLACE FUNCTION public.encheck_borne_secret_renouveler(p_borne_id uuid,p_motif text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE actor uuid:=public.encheck_borne_admin_guard(); b public.pointage_bornes%ROWTYPE; secret text;
BEGIN
 IF p_motif IS NULL OR length(btrim(p_motif)) NOT BETWEEN 5 AND 500 OR p_motif ~ '(bs1_|bk1_)' THEN RAISE EXCEPTION 'Motif requis.'; END IF;
 SELECT * INTO b FROM public.pointage_bornes WHERE id=p_borne_id FOR UPDATE;
 IF NOT FOUND OR b.revoque_le IS NOT NULL OR b.expire_le<=now() THEN RAISE EXCEPTION 'Borne indisponible.'; END IF;
 secret:='bs1_'||replace(gen_random_uuid()::text||gen_random_uuid()::text,'-','');
 UPDATE public.pointage_bornes SET secret_hash=encode(sha256(convert_to(secret,'UTF8')),'hex') WHERE id=b.id;
 UPDATE public.pointage_borne_sessions SET revoque_le=coalesce(revoque_le,now()) WHERE borne_id=b.id;
 INSERT INTO public.pointage_borne_events(actor_id,borne_id,action,motif) VALUES(actor,b.id,'rotated',btrim(p_motif));
 RETURN jsonb_build_object('ok',true,'borne_id',b.id,'secret',secret,'expire_le',b.expire_le);
END $$;

CREATE OR REPLACE FUNCTION public.encheck_bornes_lister()
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=pg_catalog,public AS $$
BEGIN
 PERFORM public.encheck_borne_admin_guard();
 RETURN jsonb_build_object('ok',true,'bornes',(SELECT coalesce(jsonb_agg(jsonb_build_object(
 'id',id,'device_id',device_id,'enterprise_id',enterprise_id,'expire_le',expire_le,'revoque_le',revoque_le,'cree_le',cree_le) ORDER BY cree_le,id),'[]') FROM public.pointage_bornes));
END $$;

CREATE OR REPLACE FUNCTION public.encheck_borne_authentifier(p_device_id text,p_secret text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE b public.pointage_bornes%ROWTYPE; token text; expiry timestamptz;
BEGIN
 IF p_device_id IS NULL OR length(p_device_id)>128 OR p_secret IS NULL OR length(p_secret)<>68 THEN
  RETURN jsonb_build_object('ok',false,'raison','appareil_inconnu');
 END IF;
 SELECT * INTO b FROM public.pointage_bornes WHERE device_id=p_device_id FOR UPDATE;
 IF NOT FOUND OR b.secret_hash IS DISTINCT FROM encode(sha256(convert_to(p_secret,'UTF8')),'hex') THEN
  RETURN jsonb_build_object('ok',false,'raison','appareil_inconnu');
 END IF;
 IF b.revoque_le IS NOT NULL THEN RETURN jsonb_build_object('ok',false,'raison','appareil_revoque'); END IF;
 IF b.expire_le<=now() THEN RETURN jsonb_build_object('ok',false,'raison','appareil_expire'); END IF;
 IF NOT EXISTS(SELECT 1 FROM public.enterprises WHERE id=b.enterprise_id AND is_active IS TRUE) THEN
  RETURN jsonb_build_object('ok',false,'raison','entreprise_inactive');
 END IF;
 expiry:=least(b.expire_le,now()+interval '24 hours');
 token:='bk1_'||replace(gen_random_uuid()::text||gen_random_uuid()::text,'-','');
 UPDATE public.pointage_borne_sessions SET revoque_le=coalesce(revoque_le,now()) WHERE borne_id=b.id;
 INSERT INTO public.pointage_borne_sessions(jeton_hash,borne_id,expire_le) VALUES(encode(sha256(convert_to(token,'UTF8')),'hex'),b.id,expiry);
 -- Bound retained expired sessions, without deleting active credentials.
 DELETE FROM public.pointage_borne_sessions WHERE borne_id=b.id AND expire_le<now()-interval '7 days';
 RETURN jsonb_build_object('ok',true,'jeton_borne',token,'enterprise_id',b.enterprise_id,'expire_le',expiry);
END $$;

CREATE OR REPLACE FUNCTION public.encheck_borne_scope(p_jeton text)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE s public.pointage_borne_sessions%ROWTYPE; b public.pointage_bornes%ROWTYPE;
BEGIN
 IF p_jeton IS NULL OR length(p_jeton)<>68 OR left(p_jeton,4)<>'bk1_' THEN RETURN jsonb_build_object('ok',false,'raison','jeton_invalide'); END IF;
 SELECT * INTO s FROM public.pointage_borne_sessions WHERE jeton_hash=encode(sha256(convert_to(p_jeton,'UTF8')),'hex');
 IF NOT FOUND THEN RETURN jsonb_build_object('ok',false,'raison','jeton_invalide'); END IF;
 SELECT * INTO b FROM public.pointage_bornes WHERE id=s.borne_id;
 IF NOT FOUND THEN RETURN jsonb_build_object('ok',false,'raison','jeton_invalide'); END IF;
 IF s.revoque_le IS NOT NULL OR b.revoque_le IS NOT NULL THEN RETURN jsonb_build_object('ok',false,'raison','appareil_revoque'); END IF;
 IF least(s.expire_le,b.expire_le)<=now() THEN RETURN jsonb_build_object('ok',false,'raison','appareil_expire'); END IF;
 IF NOT EXISTS(SELECT 1 FROM public.enterprises WHERE id=b.enterprise_id AND is_active IS TRUE) THEN RETURN jsonb_build_object('ok',false,'raison','entreprise_inactive'); END IF;
 RETURN jsonb_build_object('ok',true,'enterprise_id',b.enterprise_id,'expire_le',least(s.expire_le,b.expire_le));
END $$;

CREATE OR REPLACE FUNCTION public.encheck_borne_employee_payload(p_employee_id uuid,p_enterprise_id uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE e public.employees%ROWTYPE; v_schedules jsonb;
BEGIN
 SELECT * INTO e FROM public.employees WHERE id=p_employee_id AND enterprise_id=p_enterprise_id AND is_active IS TRUE;
 IF NOT FOUND THEN RETURN NULL; END IF;
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
 RETURN jsonb_build_object(
   'id',e.id,'enterprise_id',e.enterprise_id,'matricule',e.matricule,
   'first_name',e.first_name,'last_name',e.last_name,'photo_url',e.photo_url,
   'is_active',e.is_active,'department',e.department,'position',e.position,
   'employee_schedules',v_schedules);
END $$;

CREATE OR REPLACE FUNCTION public.encheck_visage_lister_v2(p_jeton text,p_portee text)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE scope jsonb; ent uuid; emp uuid; items jsonb;
BEGIN
 IF p_portee='personne' THEN
  scope:=public.encheck_employe_profil(p_jeton);
  IF scope->>'ok' IS DISTINCT FROM 'true' THEN RETURN scope; END IF;
  ent:=(scope#>>'{employee,enterprise_id}')::uuid; emp:=(scope#>>'{employee,id}')::uuid;
 ELSIF p_portee='borne' THEN
  scope:=public.encheck_borne_scope(p_jeton);
  IF scope->>'ok' IS DISTINCT FROM 'true' THEN RETURN scope; END IF;
  ent:=(scope->>'enterprise_id')::uuid;
 ELSE RETURN jsonb_build_object('ok',false,'raison','portee_invalide'); END IF;
 IF (SELECT count(*) FROM public.face_enrollments f JOIN public.employees e ON e.id=f.employee_id AND e.enterprise_id=ent AND e.is_active IS TRUE
 WHERE f.enterprise_id=ent AND (emp IS NULL OR f.employee_id=emp) AND (emp IS NOT NULL OR (f.status='approved' AND f.is_active IS TRUE)))>2000 THEN
  RETURN jsonb_build_object('ok',false,'raison','volume_non_pris_en_charge');
 END IF;
 SELECT coalesce(jsonb_agg(jsonb_build_object('id',f.id,'employee_id',e.id,'enterprise_id',ent,
 'status',f.status,'is_active',f.is_active,'created_at',f.created_at,'updated_at',f.updated_at,
 'first_name',e.first_name,'last_name',e.last_name,'matricule',e.matricule,'photo_url',e.photo_url)
 ||CASE WHEN f.status='approved' AND f.is_active IS TRUE THEN jsonb_build_object('face_embedding',f.face_embedding) ELSE '{}'::jsonb END
 ORDER BY f.created_at DESC,f.id),'[]') INTO items
 FROM public.face_enrollments f JOIN public.employees e ON e.id=f.employee_id AND e.enterprise_id=ent AND e.is_active IS TRUE
 WHERE f.enterprise_id=ent AND (emp IS NULL OR f.employee_id=emp)
 AND (emp IS NOT NULL OR (f.status='approved' AND f.is_active IS TRUE));
 RETURN jsonb_build_object('ok',true,'portee',p_portee,'enterprise_id',ent,'employee_id',emp,'expire_le',scope->'expire_le','enrolements',items);
END $$;

CREATE OR REPLACE FUNCTION public.encheck_borne_personnel(p_jeton_borne text,p_maj_depuis timestamptz DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE scope jsonb:=public.encheck_borne_scope(p_jeton_borne); faces jsonb; ent uuid; staff jsonb;
BEGIN
 IF scope->>'ok' IS DISTINCT FROM 'true' THEN RETURN scope; END IF;
 ent:=(scope->>'enterprise_id')::uuid;
 IF (SELECT count(*) FROM public.employees WHERE enterprise_id=ent AND is_active IS TRUE)>1000 THEN
  RETURN jsonb_build_object('ok',false,'raison','volume_non_pris_en_charge');
 END IF;
 faces:=public.encheck_visage_lister_v2(p_jeton_borne,'borne');
 IF faces->>'ok' IS DISTINCT FROM 'true' THEN RETURN faces; END IF;
 SELECT coalesce(jsonb_agg(public.encheck_borne_employee_payload(id,ent) ORDER BY id),'[]') INTO staff
 FROM public.employees WHERE enterprise_id=ent AND is_active IS TRUE;
 RETURN jsonb_build_object('ok',true,'mode','snapshot_complet','enterprise_id',ent,'employes',staff,
 'embeddings',faces->'enrolements','maj',statement_timestamp(),'cache_expire_le',scope->'expire_le');
END $$;

REVOKE ALL ON FUNCTION public.encheck_borne_admin_guard(),public.encheck_borne_scope(text),public.encheck_borne_employee_payload(uuid,uuid),public.encheck_borne_creer(text,uuid,timestamptz,text),public.encheck_borne_revoquer(uuid,text),public.encheck_borne_secret_renouveler(uuid,text),public.encheck_bornes_lister(),public.encheck_borne_authentifier(text,text),public.encheck_visage_lister_v2(text,text),public.encheck_borne_personnel(text,timestamptz) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.encheck_borne_creer(text,uuid,timestamptz,text),public.encheck_borne_revoquer(uuid,text),public.encheck_borne_secret_renouveler(uuid,text),public.encheck_bornes_lister() TO authenticated;
GRANT EXECUTE ON FUNCTION public.encheck_borne_authentifier(text,text),public.encheck_visage_lister_v2(text,text),public.encheck_borne_personnel(text,timestamptz) TO anon,authenticated,service_role;
NOTIFY pgrst,'reload schema';
