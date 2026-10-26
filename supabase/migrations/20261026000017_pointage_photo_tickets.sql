-- Additive upload tickets. Existing Storage policies are NOT changed here.
CREATE TABLE IF NOT EXISTS public.pointage_photo_tickets (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), employee_id uuid NOT NULL,
 enterprise_id uuid NOT NULL, path text NOT NULL UNIQUE, created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.pointage_photo_tickets ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.pointage_photo_tickets FROM PUBLIC,anon,authenticated;
CREATE OR REPLACE FUNCTION public.encheck_photo_upload_reserver(p_jeton text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE scope jsonb:=public.encheck_employe_profil(p_jeton); emp uuid; ent uuid; object_path text;
BEGIN
 IF scope->>'ok' IS DISTINCT FROM 'true' THEN RETURN scope; END IF;
 emp:=(scope#>>'{employee,id}')::uuid; ent:=(scope#>>'{employee,enterprise_id}')::uuid;
 PERFORM pg_advisory_xact_lock(hashtextextended('pointage-photo:'||emp::text,0));
 IF (SELECT count(*) FROM public.pointage_photo_tickets WHERE employee_id=emp AND created_at>now()-interval '1 hour')>=10 THEN
  RETURN jsonb_build_object('ok',false,'raison','quota_photo');
 END IF;
 object_path:=ent::text||'/'||emp::text||'_'||gen_random_uuid()::text||'.jpg';
 INSERT INTO public.pointage_photo_tickets(employee_id,enterprise_id,path) VALUES(emp,ent,object_path);
 DELETE FROM public.pointage_photo_tickets WHERE employee_id=emp AND created_at<now()-interval '7 days';
 RETURN jsonb_build_object('ok',true,'path',object_path,'employee_id',emp,'enterprise_id',ent);
END $$;
REVOKE ALL ON FUNCTION public.encheck_photo_upload_reserver(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.encheck_photo_upload_reserver(text) TO anon,authenticated,service_role;
NOTIFY pgrst,'reload schema';
