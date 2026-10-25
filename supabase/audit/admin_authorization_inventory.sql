-- READ ONLY. One JSON result, no account rows or function bodies/secrets.
-- Repeat after schema changes; a non-empty inventory is NOT proof of safety.
select jsonb_build_object(
 'generated_at',now(),
 'policies',(select coalesce(jsonb_agg(to_jsonb(p)),'[]') from (select schemaname,tablename,policyname,permissive,roles,cmd,qual,with_check from pg_policies where schemaname in ('public','storage','realtime') order by schemaname,tablename,policyname) p),
 'functions',(select coalesce(jsonb_agg(to_jsonb(f)),'[]') from (
  select p.oid::regprocedure::text signature,p.prosecdef security_definer,p.provolatile volatility,p.proconfig settings,
   has_function_privilege('anon',p.oid,'execute') anon_execute,
   has_function_privilege('authenticated',p.oid,'execute') authenticated_execute,
   md5(p.prosrc) implementation_fingerprint,md5(pg_get_functiondef(p.oid)) definition_fingerprint,
   p.prosrc ~* '(insert[[:space:]]+into|update|delete[[:space:]]+from)[[:space:]]+auth[.]' mentions_direct_auth_mutation
  from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.prokind='f' order by 1
 ) f),
 'views',(select coalesce(jsonb_agg(to_jsonb(v)),'[]') from (select c.relname,c.reloptions from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relkind in ('v','m') order by 1) v),
 'identity_dependencies',(select coalesce(jsonb_agg(to_jsonb(d)),'[]') from (select conrelid::regclass::text source,confrelid::regclass::text target,pg_get_constraintdef(oid) definition from pg_constraint where contype='f' and confrelid in ('public.admins'::regclass,'auth.users'::regclass) order by 1,2) d),
 'identity_preflight',jsonb_build_object(
   'active_without_auth',(select count(*) from public.admins where is_active is true and user_id is null),
   'ambiguous_auth_bindings',(select count(*) from (select user_id from public.admins where user_id is not null group by user_id having count(*)>1) duplicates),
   'active_shared_employee_identity',(select count(*) from public.admins a where a.is_active is true and exists(select 1 from public.employees e where e.user_id=a.user_id))
 )
) as inventory;
