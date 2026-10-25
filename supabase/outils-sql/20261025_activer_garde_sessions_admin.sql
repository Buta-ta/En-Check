-- EXPLICIT ACTIVATION ONLY AFTER the new Login/MFA client is deployed and tested.
-- This hook protects REST/RPC, not service-role bypasses, Storage or Realtime.
-- Do not run blindly: review all Edge functions and historical authorization paths.
begin;
do $$
declare existing text;
begin
 if to_regprocedure('public.encheck_admin_request_guard()') is null then raise exception 'Migration de sécurité absente.'; end if;
 if exists(select 1 from public.admins where user_id is null and is_active is true) then raise exception 'Lier les administrateurs actifs à Auth avant activation.'; end if;
 if exists(select 1 from public.admins where user_id is not null group by user_id having count(*)>1) then raise exception 'Identités Auth administrateur ambiguës.'; end if;
 for existing in select unnest(setconfig) from pg_db_role_setting where setrole=(select oid from pg_roles where rolname='authenticator') loop
  if existing like 'pgrst.db_pre_request=%' and existing<>'pgrst.db_pre_request=public.encheck_admin_request_guard' then raise exception 'Un hook existe déjà : composer les contrôles avant activation.'; end if;
 end loop;
end $$;
alter role authenticator set pgrst.db_pre_request='public.encheck_admin_request_guard';
notify pgrst,'reload config';
commit;
