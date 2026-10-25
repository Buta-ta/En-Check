-- Applied as a targeted production correction, 2026-10-25.
-- Internal SECURITY DEFINER caller remains able to execute as owner.
REVOKE ALL ON FUNCTION public.encheck_assurer_identite(uuid,text) FROM PUBLIC, anon, authenticated;
