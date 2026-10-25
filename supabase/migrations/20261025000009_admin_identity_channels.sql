-- Staged hardening. Deploy Login/MFA/password checkpoint first, then audit
-- shared employee/admin identities and historical clients before activation.
begin;
do $$ begin
 if exists(select 1 from public.admins where is_active is true and user_id is null) or exists(select 1 from public.admins where user_id is not null group by user_id having count(*)>1) then raise exception 'Identités administrateur à réconcilier avant activation.'; end if;
end $$;
create or replace function public.encheck_admin_channel_allowed()
returns boolean language sql stable security definer set search_path=pg_catalog,public as $$
 select not exists(select 1 from public.admin_session_revocations where session_id::text=auth.jwt()->>'session_id') and (
 not exists(select 1 from public.admins where user_id=auth.uid())
 or (public.encheck_admin_session_valid() and not public.encheck_password_change_required()));
$$;
create or replace function public.current_admin_id()
returns uuid language sql stable security definer set search_path=pg_catalog,public as $$
 select a.id from public.admins a where a.user_id=auth.uid() and a.is_active is true
 and (select count(*) from public.admins x where x.user_id=auth.uid())=1
 and public.encheck_admin_channel_allowed();
$$;
create or replace function public.is_super_admin()
returns boolean language sql stable security definer set search_path=pg_catalog,public as $$
 select exists(select 1 from public.admins where id=public.current_admin_id() and role='super_admin');
$$;
create or replace function public.encheck_admin_courant()
returns uuid language sql stable security definer set search_path=pg_catalog,public as $$
 select public.current_admin_id();
$$;
-- No email fallback, no side-effect attaching an Auth identity from a role check.
create or replace function public.encheck_est_super_admin()
returns boolean language sql stable security definer set search_path=pg_catalog,public as $$
 select public.is_super_admin();
$$;
create or replace function public.admin_has_access_to_enterprise(target_enterprise_id uuid)
returns boolean language sql stable security definer set search_path=pg_catalog,public as $$
 select exists(select 1 from public.admins a where a.id=public.current_admin_id() and
 (a.role='super_admin' or exists(select 1 from public.admin_entreprises ae where ae.admin_id=a.id and ae.enterprise_id=target_enterprise_id and ae.is_active is true)));
$$;
revoke all on function public.encheck_admin_channel_allowed(),public.current_admin_id(),public.is_super_admin(),public.encheck_admin_courant(),public.encheck_est_super_admin(),public.admin_has_access_to_enterprise(uuid) from public;
grant execute on function public.encheck_admin_channel_allowed(),public.current_admin_id(),public.is_super_admin(),public.encheck_admin_courant(),public.encheck_est_super_admin(),public.admin_has_access_to_enterprise(uuid) to authenticated,anon,service_role;
-- AND with every existing permissive policy. Never creates a new grant and
-- deliberately leaves employee-only/anonymous identities to existing policies.
do $$ declare item record; begin
 for item in select n.nspname,c.relname,c.relrowsecurity from pg_class c join pg_namespace n on n.oid=c.relnamespace where c.relkind in ('r','p') and
 (n.nspname='public' or (n.nspname='storage' and c.relname='objects') or (n.nspname='realtime' and c.relname='messages')) loop
  if not item.relrowsecurity then raise exception 'RLS absente sur %.% : audit requis avant activation.',item.nspname,item.relname; end if;
  execute format('drop policy if exists encheck_admin_session_restrictive on %I.%I',item.nspname,item.relname);
  execute format('create policy encheck_admin_session_restrictive on %I.%I as restrictive for all to authenticated using ((select public.encheck_admin_channel_allowed())) with check ((select public.encheck_admin_channel_allowed()))',item.nspname,item.relname);
 end loop;
end $$;
commit;
