-- Read-only triage, NOT an authorization or an automatic approval.
-- No employee rows, session tokens, function bodies, or secret values returned.
-- Text-based caller detection misses dynamic names and external clients.
select p.oid::regprocedure::text as signature,
       p.prorettype::regtype::text as result_type,
       p.prosecdef as security_definer,
       has_function_privilege('anon',p.oid,'execute') as anon_execute,
       has_function_privilege('authenticated',p.oid,'execute') as authenticated_execute,
       has_function_privilege('service_role',p.oid,'execute') as service_execute,
       pg_get_userbyid(p.proowner) as owner,
       md5(pg_get_functiondef(p.oid)) as definition_fingerprint,
       p.prorettype = 'trigger'::regtype as trigger_only,
       pg_get_function_identity_arguments(p.oid) ~* '(jeton|token)' as token_argument_hint,
       coalesce((select jsonb_agg(c.oid::regprocedure::text order by c.oid::regprocedure::text)
         from pg_proc c where c.pronamespace='public'::regnamespace
         and c.oid<>p.oid and position(p.proname in c.prosrc)>0),'[]'::jsonb) as possible_sql_callers
from pg_proc p
where p.pronamespace='public'::regnamespace and p.prokind='f'
  and (p.prosecdef or p.proname in ('encheck_employe_par_id','get_employees_by_enterprise','encheck_adms_carte_pins'))
order by signature;
