-- Applied separately to production on 2026-10-25 as a targeted security fix.
-- Internal SECURITY DEFINER callers keep owner privileges; no account data changes.
REVOKE ALL ON FUNCTION public.encheck_auth_creer_compte(text,text,text,text,text,uuid) FROM PUBLIC, anon, authenticated;
