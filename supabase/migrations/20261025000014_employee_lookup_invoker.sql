-- These lookups must not borrow the owner's ability to bypass employee RLS.
-- Preserve signatures/bodies and execution from owner/service-role callers.
ALTER FUNCTION public.encheck_employe_par_id(uuid) SECURITY INVOKER;
ALTER FUNCTION public.get_employees_by_enterprise(uuid) SECURITY INVOKER;
ALTER FUNCTION public.encheck_adms_carte_pins(uuid) SECURITY INVOKER;
REVOKE EXECUTE ON FUNCTION public.encheck_employe_par_id(uuid), public.get_employees_by_enterprise(uuid), public.encheck_adms_carte_pins(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.encheck_employe_par_id(uuid), public.get_employees_by_enterprise(uuid), public.encheck_adms_carte_pins(uuid) TO authenticated, service_role;
