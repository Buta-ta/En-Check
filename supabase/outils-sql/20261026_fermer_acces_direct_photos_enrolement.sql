-- NOT EXECUTED automatically. Run only after coordinated tablet/Admin recipe.
-- Existing broad permissive policies cannot bypass these restrictive policies.
BEGIN;
CREATE OR REPLACE FUNCTION public.encheck_face_storage_read_allowed(p_name text)
RETURNS boolean LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE ent uuid;
BEGIN
 IF auth.uid() IS NULL OR p_name !~ '^[0-9a-fA-F-]{36}/[^/]+$' THEN RETURN false; END IF;
 BEGIN ent:=split_part(p_name,'/',1)::uuid; EXCEPTION WHEN invalid_text_representation THEN RETURN false; END;
 IF (SELECT count(*) FROM public.admins WHERE user_id=auth.uid())<>1 THEN RETURN false; END IF;
 IF NOT EXISTS(SELECT 1 FROM auth.sessions WHERE user_id=auth.uid() AND id::text=auth.jwt()->>'session_id'
 AND (not_after IS NULL OR not_after>now())) THEN RETURN false; END IF;
 IF to_regprocedure('public.encheck_admin_session_valid()') IS NOT NULL THEN
  IF NOT public.encheck_admin_session_valid() THEN RETURN false; END IF;
 END IF;
 RETURN EXISTS(SELECT 1 FROM public.admins a WHERE a.user_id=auth.uid() AND a.is_active IS TRUE AND
 (a.role='super_admin' OR (a.role IN ('admin','manager') AND (a.enterprise_id=ent OR EXISTS(
 SELECT 1 FROM public.admin_entreprises l WHERE l.admin_id=a.id AND l.enterprise_id=ent AND l.is_active IS TRUE)))));
END $$;
REVOKE ALL ON FUNCTION public.encheck_face_storage_read_allowed(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.encheck_face_storage_read_allowed(text) TO anon,authenticated;
DROP POLICY IF EXISTS encheck_face_private_read ON storage.objects;
CREATE POLICY encheck_face_private_read ON storage.objects AS RESTRICTIVE FOR SELECT TO anon,authenticated
 USING(bucket_id<>'face-enrollments' OR public.encheck_face_storage_read_allowed(name));
DROP POLICY IF EXISTS encheck_face_broker_upload ON storage.objects;
CREATE POLICY encheck_face_broker_upload ON storage.objects AS RESTRICTIVE FOR INSERT TO anon,authenticated
 WITH CHECK(bucket_id<>'face-enrollments');
DROP POLICY IF EXISTS encheck_face_no_client_delete ON storage.objects;
CREATE POLICY encheck_face_no_client_delete ON storage.objects AS RESTRICTIVE FOR DELETE TO anon,authenticated
 USING(bucket_id<>'face-enrollments');
DROP POLICY IF EXISTS encheck_face_no_client_update ON storage.objects;
CREATE POLICY encheck_face_no_client_update ON storage.objects AS RESTRICTIVE FOR UPDATE TO anon,authenticated
 USING(bucket_id<>'face-enrollments') WITH CHECK(bucket_id<>'face-enrollments');
COMMIT;
