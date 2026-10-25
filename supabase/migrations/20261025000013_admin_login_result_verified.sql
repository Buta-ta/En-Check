-- Client claims of success/failure are not authentication evidence.
-- Failed attempts must be rate-limited by Auth, not by an anonymous writer
-- accepting an arbitrary administrator UUID. No account rows changed on install.
CREATE OR REPLACE FUNCTION public.admin_login_result(
 p_admin_id uuid, p_success boolean, p_reason text DEFAULT NULL
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog, public AS $$
DECLARE v_signed_in_at timestamptz;
BEGIN
 IF auth.uid() IS NULL OR p_success IS DISTINCT FROM true THEN
  RAISE EXCEPTION 'Une connexion vérifiée est requise.' USING ERRCODE='42501';
 END IF;
 SELECT last_sign_in_at INTO v_signed_in_at FROM auth.users WHERE id=auth.uid();
 IF v_signed_in_at IS NULL THEN
  RAISE EXCEPTION 'Connexion Auth non confirmée.' USING ERRCODE='42501';
 END IF;
 UPDATE public.admins SET failed_attempts=0,locked_until=NULL,last_login_at=v_signed_in_at
 WHERE id=p_admin_id AND user_id=auth.uid() AND is_active IS TRUE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Compte non autorisé.' USING ERRCODE='42501'; END IF;
 RETURN jsonb_build_object('ok',true,'essais',0,'blocage_pose',false,'raison','connexion_reussie');
END;
$$;
REVOKE ALL ON FUNCTION public.admin_login_result(uuid,boolean,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.admin_login_result(uuid,boolean,text) TO authenticated;
