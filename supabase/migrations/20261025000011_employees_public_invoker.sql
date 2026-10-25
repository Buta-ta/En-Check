-- Targeted production fix applied on 2026-10-25; changes no employee rows.
-- Keep authenticated privileges, but enforce underlying caller RLS.
ALTER VIEW public.employees_public SET (security_invoker = true);
REVOKE ALL ON public.employees_public FROM PUBLIC, anon;
