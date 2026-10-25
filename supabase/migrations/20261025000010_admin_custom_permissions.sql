-- Restricted custom roles. Unknown tables/actions and unreviewed RPCs are DENIED.
-- Installation is not activation. See the explicit activation checklist/script.
begin;
create table if not exists public.admin_permission_roles(
 id uuid primary key default gen_random_uuid(),name text not null,grants jsonb not null,
 created_by uuid not null,created_at timestamptz not null default now()
);
create table if not exists public.admin_permission_bindings(
 admin_id uuid primary key references public.admins(id),role_id uuid not null references public.admin_permission_roles(id),
 assigned_by uuid not null,reason text not null,updated_at timestamptz not null default now()
);
create table if not exists public.admin_permission_settings(singleton boolean primary key default true check(singleton),enabled boolean not null default false);
insert into public.admin_permission_settings(singleton) values(true) on conflict do nothing;
create table if not exists public.admin_permission_rpc_reviews(name text primary key,fingerprint text not null);
create table if not exists public.admin_permission_public_rpc_reviews(signature text primary key,fingerprint text not null,review_note text not null);
alter table public.admin_permission_public_rpc_reviews enable row level security;
revoke all on public.admin_permission_public_rpc_reviews from public,anon,authenticated;
alter table public.admin_permission_roles enable row level security;
alter table public.admin_permission_bindings enable row level security;
alter table public.admin_permission_settings enable row level security;
alter table public.admin_permission_rpc_reviews enable row level security;
revoke all on public.admin_permission_roles,public.admin_permission_bindings,public.admin_permission_settings,public.admin_permission_rpc_reviews from public,anon,authenticated;

create or replace function public.encheck_custom_role_id()
returns uuid language plpgsql stable security definer set search_path=pg_catalog,public as $$
declare result uuid;
begin
 if (select count(*) from public.admins where user_id=auth.uid())>1 then raise exception 'Identité administrateur ambiguë.' using errcode='42501'; end if;
 select b.role_id into result from public.admin_permission_bindings b join public.admins a on a.id=b.admin_id where a.user_id=auth.uid();
 return result;
end $$;
create or replace function public.encheck_custom_has_permission(p_module text,p_action text,p_enterprise uuid)
returns boolean language sql stable security definer set search_path=pg_catalog,public as $$
 select public.encheck_admin_channel_allowed() and exists(
  select 1 from public.admin_permission_roles r,jsonb_array_elements(r.grants) g
  where r.id=public.encheck_custom_role_id() and g->>'module'=p_module
  and g->>'enterprise_id'=p_enterprise::text and (g->'actions') ? p_action
 );
$$;
create or replace function public.encheck_custom_row_allowed(p_table text,p_action text,p_row jsonb)
returns boolean language plpgsql stable security definer set search_path=pg_catalog,public as $$
declare module_name text; enterprise uuid; linked_enterprise uuid; actor uuid;
begin
 if public.encheck_custom_role_id() is null then return true; end if;
 if not public.encheck_admin_channel_allowed() then return false; end if;
 select id into strict actor from public.admins where user_id=auth.uid() and is_active is true;
 -- Own account metadata is readable, not directly editable. All mutations use
 -- the narrow reviewed self-service RPCs, never a direct role/profile PATCH.
 if p_action='read' then
  if p_table='admins' then return p_row->>'id'=actor::text; end if;
  if p_table='admin_account_events' then return p_row->>'target_id'=actor::text; end if;
  if p_table='admin_entreprises' then return p_row->>'admin_id'=actor::text; end if;
  if p_table='enterprises' then return exists(select 1 from public.admin_permission_roles r,jsonb_array_elements(r.grants) g where r.id=public.encheck_custom_role_id() and g->>'enterprise_id'=p_row->>'id'); end if;
 end if;
 module_name:=case p_table
  when 'employees' then 'employees'
  when 'attendances' then 'attendance'
  when 'work_schedules' then 'planning'
  when 'employee_payslips' then 'payroll'
  when 'payroll_bonuses' then 'payroll'
  when 'payroll_deductions' then 'payroll'
  when 'tasks' then 'tasks'
  when 'teams' then 'tasks'
  else null end;
 if module_name is null then return false; end if;
 enterprise:=nullif(p_row->>'enterprise_id','')::uuid;
 -- Prevent a permitted enterprise_id from disguising a foreign employee/team.
 if p_row->>'employee_id' is not null then
  select enterprise_id into linked_enterprise from public.employees where id=(p_row->>'employee_id')::uuid;
  if linked_enterprise is null or (enterprise is not null and linked_enterprise<>enterprise) then return false; end if;
  enterprise:=coalesce(enterprise,linked_enterprise);
 end if;
 if p_row->>'assigned_employee_id' is not null then
  select enterprise_id into linked_enterprise from public.employees where id=(p_row->>'assigned_employee_id')::uuid;
  if linked_enterprise is null or linked_enterprise is distinct from enterprise then return false; end if;
 end if;
 if p_row->>'team_id' is not null then
  select enterprise_id into linked_enterprise from public.teams where id=(p_row->>'team_id')::uuid;
  if linked_enterprise is null or linked_enterprise is distinct from enterprise then return false; end if;
 end if;
 if enterprise is null then return false; end if;
 return public.encheck_custom_has_permission(module_name,p_action,enterprise);
end $$;

-- Every current public table gets restrictive command-specific policies.
-- Private Storage and Realtime broadcast are unavailable to custom roles until
-- dedicated module-aware policies are reviewed. Public assets remain public.
do $$ declare t record; action text; command text; expression text; begin
 for t in select c.relname,c.relrowsecurity from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relkind in ('r','p') loop
  if not t.relrowsecurity then raise exception 'RLS absente sur %.',t.relname; end if;
  foreach action in array array['read','create','update','delete'] loop
   command:=case action when 'read' then 'select' when 'create' then 'insert' else action end;
   expression:=format('public.encheck_custom_row_allowed(%L,%L,to_jsonb(%I))',t.relname,action,t.relname);
   execute format('drop policy if exists %I on public.%I','encheck_custom_'||action,t.relname);
   execute format('create policy %I on public.%I as restrictive for %s to authenticated %s %s',
    'encheck_custom_'||action,t.relname,command,
    case when action='create' then '' else 'using ('||expression||')' end,
    case when action in ('create','update') then 'with check ('||expression||')' else '' end);
  end loop;
 end loop;
 for t in select n.nspname,c.relname from pg_class c join pg_namespace n on n.oid=c.relnamespace where (n.nspname='storage' and c.relname='objects') or (n.nspname='realtime' and c.relname='messages') loop
  execute format('drop policy if exists encheck_custom_channels on %I.%I',t.nspname,t.relname);
  execute format('create policy encheck_custom_channels on %I.%I as restrictive for all to authenticated using ((select public.encheck_custom_role_id()) is null) with check ((select public.encheck_custom_role_id()) is null)',t.nspname,t.relname);
 end loop;
end $$;

create or replace function public.encheck_custom_roles_blockers()
returns text[] language plpgsql stable security definer set search_path=pg_catalog,public as $$
declare blockers text[]:='{}';
begin
 if coalesce(current_setting('pgrst.db_pre_request',true),'')<>'public.encheck_admin_request_guard' then blockers:=array_append(blockers,'Hook REST/RPC inactif'); end if;
 if exists(select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relkind in ('v','m') and has_table_privilege('authenticated',c.oid,'select') and (c.relkind='m' or not coalesce(c.reloptions @> array['security_invoker=true'],false))) then blockers:=array_append(blockers,'Vues exposées sans security_invoker à auditer'); end if;
 -- Embedded computed relationships/columns can invoke functions WITHOUT an RPC
 -- path. Refuse activation while authenticated can call composite-argument functions.
 if exists(select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and has_function_privilege('authenticated',p.oid,'execute') and exists(select 1 from unnest(p.proargtypes::oid[]) a join pg_type t on t.oid=a where t.typtype='c')) then blockers:=array_append(blockers,'Fonctions sur lignes composites à auditer (relations/calculs imbriqués)'); end if;
 -- Even an invoker view may call a privileged function; require explicit review
 -- and removal/rewrite rather than assuming invoker alone makes it safe.
 if exists(select 1 from pg_rewrite r join pg_class c on c.oid=r.ev_class join pg_namespace n on n.oid=c.relnamespace join pg_depend d on d.classid='pg_rewrite'::regclass and d.objid=r.oid and d.refclassid='pg_proc'::regclass join pg_proc p on p.oid=d.refobjid join pg_namespace fn on fn.oid=p.pronamespace where n.nspname='public' and has_table_privilege('authenticated',c.oid,'select') and fn.nspname<>'pg_catalog') then blockers:=array_append(blockers,'Vues appelant des fonctions applicatives à auditer'); end if;
 if exists(select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relkind in ('r','p') and (not c.relrowsecurity or (select count(*) from pg_policy p where p.polrelid=c.oid and p.polname in ('encheck_custom_read','encheck_custom_create','encheck_custom_update','encheck_custom_delete') and not p.polpermissive)<>4)) then blockers:=array_append(blockers,'Couverture des politiques personnalisées incomplète'); end if;
 if exists(select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.prokind='f' and p.prosecdef and has_function_privilege('anon',p.oid,'execute') and not exists(select 1 from public.admin_permission_public_rpc_reviews r where r.signature=p.oid::regprocedure::text and r.fingerprint=md5(pg_get_functiondef(p.oid)))) then blockers:=array_append(blockers,'Fonctions SECURITY DEFINER anonymes non auditées'); end if;
 return blockers;
end $$;
create or replace function public.encheck_custom_guard_route()
returns void language plpgsql security definer set search_path=pg_catalog,public as $$
declare path text:=coalesce(current_setting('request.path',true),''); routine text;
begin
 if public.encheck_custom_role_id() is null then return; end if;
 -- Unknown/new schema objects cannot silently weaken restrictions.
 if cardinality(public.encheck_custom_roles_blockers())>0 then raise exception 'Permissions personnalisées : audit serveur requis.' using errcode='42501'; end if;
 if coalesce(nullif(current_setting('request.headers',true),''),'{}')::jsonb->>'accept-profile' is not null and coalesce(nullif(current_setting('request.headers',true),''),'{}')::jsonb->>'accept-profile'<>'public' then raise exception 'Schéma non autorisé.' using errcode='42501'; end if;
 if coalesce(nullif(current_setting('request.headers',true),''),'{}')::jsonb->>'content-profile' is not null and coalesce(nullif(current_setting('request.headers',true),''),'{}')::jsonb->>'content-profile'<>'public' then raise exception 'Schéma non autorisé.' using errcode='42501'; end if;
 if path like '/rpc/%' then
  routine:=substring(path from 6);
  if not exists(select 1 from public.admin_permission_rpc_reviews review join pg_proc p on p.proname=review.name and p.pronamespace='public'::regnamespace where review.name=routine and review.fingerprint=md5(pg_get_functiondef(p.oid)) and (select count(*) from pg_proc x where x.proname=routine and x.pronamespace='public'::regnamespace)=1) then
   raise exception 'Cette opération RPC n’est pas autorisée par le rôle personnalisé.' using errcode='42501';
  end if;
 end if;
end $$;
create or replace function public.encheck_admin_request_guard()
returns void language plpgsql security definer set search_path=pg_catalog,public as $$
begin
 if auth.uid() is not null and exists(select 1 from public.admins where user_id=auth.uid()) then
  if (select count(*) from public.admins where user_id=auth.uid())<>1 then raise exception 'Identité administrateur ambiguë.' using errcode='42501'; end if;
  if not public.encheck_admin_session_valid() then raise exception 'Session administrateur non autorisée.' using errcode='42501'; end if;
  if public.encheck_password_change_required() and coalesce(current_setting('request.path',true),'')<>'/rpc/encheck_account_password_status' then raise exception 'Changement du mot de passe temporaire obligatoire.' using errcode='42501'; end if;
  perform public.encheck_custom_guard_route();
 end if;
end $$;
create or replace function public.encheck_account_security_status()
returns jsonb language plpgsql security definer set search_path=pg_catalog,public as $$
begin
 perform public.encheck_admin_request_guard();
 if not exists(select 1 from public.admins where user_id=auth.uid() and is_active is true) then raise exception 'Accès refusé.' using errcode='42501'; end if;
 return jsonb_build_object('rest_guard_active',coalesce(current_setting('pgrst.db_pre_request',true),'')='public.encheck_admin_request_guard','custom_role_restricted',public.encheck_custom_role_id() is not null);
end $$;

create or replace function public.encheck_permission_roles_list()
returns jsonb language plpgsql security definer set search_path=pg_catalog,public as $$
begin
 perform public.encheck_admin_request_guard();
 if not public.is_super_admin() then raise exception 'Accès refusé.' using errcode='42501'; end if;
 return jsonb_build_object('enabled',(select enabled from public.admin_permission_settings where singleton),'blockers',public.encheck_custom_roles_blockers(),
 'roles',coalesce((select jsonb_agg(to_jsonb(r) order by created_at desc) from public.admin_permission_roles r),'[]'::jsonb),
 'bindings',coalesce((select jsonb_agg(jsonb_build_object('admin_id',admin_id,'role_id',role_id)) from public.admin_permission_bindings),'[]'::jsonb));
end $$;
create or replace function public.encheck_permission_role_create(p_name text,p_grants jsonb,p_reason text)
returns uuid language plpgsql security definer set search_path=pg_catalog,public as $$
declare actor uuid; grant_item jsonb; result uuid;
begin
 actor:=public.encheck_require_superadmin_aal2();
 if p_name is null or length(trim(p_name)) not between 2 and 80 or p_reason is null or length(trim(p_reason)) not between 5 and 500 then raise exception 'Nom et motif requis.'; end if;
 if jsonb_typeof(p_grants) is distinct from 'array' then raise exception 'Liste de permissions requise.'; end if;
 if jsonb_array_length(p_grants) not between 1 and 100 then raise exception 'Une à cent règles requises.'; end if;
 for grant_item in select value from jsonb_array_elements(p_grants) loop
  if jsonb_typeof(grant_item) is distinct from 'object' or grant_item-array['enterprise_id','module','actions']<>'{}'::jsonb or coalesce(grant_item->>'module','') not in ('employees','attendance','planning','payroll','tasks') then raise exception 'Module non autorisé.'; end if;
  if not exists(select 1 from public.enterprises where id::text=grant_item->>'enterprise_id') then raise exception 'Entreprise invalide.'; end if;
  if jsonb_typeof(grant_item->'actions') is distinct from 'array' then raise exception 'Actions invalides.'; end if;
  if not (grant_item->'actions') ? 'read' then raise exception 'La lecture est requise pour chaque module autorisé.'; end if;
  if jsonb_array_length(grant_item->'actions') not between 1 and 4 or exists(select 1 from jsonb_array_elements(grant_item->'actions') v where jsonb_typeof(v)<>'string' or v#>>'{}' not in ('read','create','update','delete')) then raise exception 'Actions invalides.'; end if;
 end loop;
 insert into public.admin_permission_roles(name,grants,created_by) values(trim(p_name),p_grants,actor) returning id into result;
 insert into public.admin_account_events(actor_id,target_id,action,reason) values(actor,actor,'permission_role_created',trim(p_reason)||' · '||result::text);
 return result;
end $$;
create or replace function public.encheck_permission_role_assign(p_admin_id uuid,p_role_id uuid,p_reason text)
returns void language plpgsql security definer set search_path=pg_catalog,public as $$
declare actor uuid; target public.admins; grants jsonb;
begin
 perform pg_advisory_xact_lock(240102026);
 actor:=public.encheck_require_superadmin_aal2();
 if p_admin_id=actor or p_reason is null or length(trim(p_reason)) not between 5 and 500 then raise exception 'Auto-attribution interdite ou motif invalide.'; end if;
 select * into strict target from public.admins where id=p_admin_id for update;
 if target.role='super_admin' or target.is_active is distinct from true or target.user_id is null then raise exception 'Choisissez un administrateur standard actif lié à Auth.'; end if;
 if exists(select 1 from public.employees where user_id=target.user_id) then raise exception 'Identité partagée avec un employé : séparer les parcours avant attribution.'; end if;
 if p_role_id is null then
  delete from public.admin_permission_bindings where admin_id=target.id;
  insert into public.admin_account_events(actor_id,target_id,action,reason) values(actor,target.id,'permission_role_removed',trim(p_reason));
  return;
 end if;
 if coalesce((select enabled from public.admin_permission_settings where singleton),false) is not true or cardinality(public.encheck_custom_roles_blockers())>0 then raise exception 'Activation des permissions personnalisées et audit des accès requis.'; end if;
 select r.grants into strict grants from public.admin_permission_roles r where r.id=p_role_id;
 update public.admins set role='admin',enterprise_id=(grants->0->>'enterprise_id')::uuid where id=target.id;
 delete from public.admin_entreprises where admin_id=target.id;
 insert into public.admin_entreprises(admin_id,enterprise_id,is_active) select target.id,(g->>'enterprise_id')::uuid,true from jsonb_array_elements(grants) g group by g->>'enterprise_id';
 insert into public.admin_permission_bindings(admin_id,role_id,assigned_by,reason) values(target.id,p_role_id,actor,trim(p_reason)) on conflict(admin_id) do update set role_id=excluded.role_id,assigned_by=excluded.assigned_by,reason=excluded.reason,updated_at=now();
 insert into public.admin_account_events(actor_id,target_id,action,reason) values(actor,target.id,'permission_role_assigned',trim(p_reason)||' · '||p_role_id::text);
end $$;
create or replace function public.encheck_my_permissions()
returns jsonb language plpgsql security definer set search_path=pg_catalog,public as $$
begin
 perform public.encheck_admin_request_guard();
 if public.current_admin_id() is null then raise exception 'Accès refusé.' using errcode='42501'; end if;
 return coalesce((select jsonb_build_object('name',name,'grants',(select jsonb_agg(g || jsonb_build_object('enterprise_name',(select e.name from public.enterprises e where e.id=(g->>'enterprise_id')::uuid))) from jsonb_array_elements(grants) g)) from public.admin_permission_roles where id=public.encheck_custom_role_id()),jsonb_build_object('name','Rôle historique','grants',null));
end $$;
-- Immutable role versions. To change grants, create a new version and reassign.
-- Fingerprints cover self-service RPC bodies; replacing one requires re-review.
insert into public.admin_permission_rpc_reviews(name,fingerprint)
 select p.proname,md5(pg_get_functiondef(p.oid)) from pg_proc p where p.pronamespace='public'::regnamespace and p.proname in (
 'encheck_account_password_status','encheck_account_security_status','encheck_account_profile','encheck_account_preferences','encheck_account_sessions','encheck_account_revoke_session','encheck_account_sync_email','encheck_account_session_seen','encheck_account_session_alerts','encheck_account_diagnostic','encheck_my_permissions'
 ) on conflict(name) do nothing;
-- Only these already-reviewed identity helpers are harmless for an anonymous
-- JWT: no identity means NULL/false, and the guard does not read business data.
insert into public.admin_permission_public_rpc_reviews(signature,fingerprint,review_note)
 select p.oid::regprocedure::text,md5(pg_get_functiondef(p.oid)),'Identity-only helper from migrations 09/10; no anonymous business data'
 from pg_proc p where p.pronamespace='public'::regnamespace and p.proname in ('current_admin_id','is_super_admin','encheck_admin_courant','encheck_est_super_admin','admin_has_access_to_enterprise','encheck_admin_request_guard','encheck_admin_channel_allowed')
 on conflict(signature) do nothing;
revoke all on function public.encheck_custom_role_id(),public.encheck_custom_has_permission(text,text,uuid),public.encheck_custom_row_allowed(text,text,jsonb),public.encheck_custom_roles_blockers(),public.encheck_custom_guard_route(),public.encheck_permission_roles_list(),public.encheck_permission_role_create(text,jsonb,text),public.encheck_permission_role_assign(uuid,uuid,text),public.encheck_my_permissions() from public,anon,authenticated;
grant execute on function public.encheck_custom_role_id(),public.encheck_custom_row_allowed(text,text,jsonb),public.encheck_permission_roles_list(),public.encheck_permission_role_create(text,jsonb,text),public.encheck_permission_role_assign(uuid,uuid,text),public.encheck_my_permissions() to authenticated;
create or replace function public.encheck_custom_business_write()
returns trigger language plpgsql security definer set search_path=pg_catalog,public as $$
declare actor uuid; old_row jsonb; new_row jsonb; field text;
begin
 if public.encheck_custom_role_id() is null then
  if tg_op='DELETE' then return old; end if; return new;
 end if;
 select id into strict actor from public.admins where user_id=auth.uid() and is_active is true;
 if tg_when='AFTER' then
  insert into public.admin_account_events(actor_id,target_id,action,reason) values(actor,actor,'permission_data_write',tg_table_name||' · '||tg_op);
  return null;
 end if;
 if tg_op='DELETE' then return old; end if;
 new_row:=to_jsonb(new);
 if tg_op='UPDATE' then old_row:=to_jsonb(old); end if;
 foreach field in array array['created_by','created_by_admin_id'] loop
  if tg_op='UPDATE' and new_row->field is distinct from old_row->field then raise exception 'Auteur historique non modifiable.'; end if;
  if tg_op='INSERT' and new_row->>field is not null and new_row->>field<>actor::text then raise exception 'Auteur de création invalide.'; end if;
 end loop;
 foreach field in array array['validated_by','approved_by','sent_by'] loop
  if (tg_op='INSERT' or new_row->field is distinct from old_row->field) and new_row->>field is not null and new_row->>field<>actor::text then raise exception 'Auteur de validation invalide.'; end if;
 end loop;
 new:=jsonb_populate_record(new,jsonb_build_object('updated_by',actor,'modifie_par',actor));
 return new;
end $$;
revoke all on function public.encheck_custom_business_write() from public,anon,authenticated;
do $$ declare t text; begin
 foreach t in array array['employees','attendances','work_schedules','employee_payslips','payroll_bonuses','payroll_deductions','tasks','teams'] loop
  if to_regclass('public.'||t) is not null then
   execute format('drop trigger if exists encheck_custom_write_guard on public.%I',t);
   execute format('drop trigger if exists encheck_custom_write_audit on public.%I',t);
   execute format('create trigger encheck_custom_write_guard before insert or update or delete on public.%I for each row execute function public.encheck_custom_business_write()',t);
   execute format('create trigger encheck_custom_write_audit after insert or update or delete on public.%I for each row execute function public.encheck_custom_business_write()',t);
  end if;
 end loop;
end $$;
create or replace function public.encheck_custom_binding_guard()
returns trigger language plpgsql security definer set search_path=pg_catalog,public as $$
begin
 if exists(select 1 from public.admin_permission_bindings where admin_id=old.id) then
  if new.user_id is null then
   delete from public.admin_permission_bindings where admin_id=old.id;
  elsif new.user_id is distinct from old.user_id or new.role is distinct from 'admin' then
   raise exception 'Retirez le rôle personnalisé avant de changer l’identité ou le rôle historique.';
  end if;
 end if;
 return new;
end $$;
revoke all on function public.encheck_custom_binding_guard() from public,anon,authenticated;
drop trigger if exists encheck_custom_binding_guard on public.admins;
create trigger encheck_custom_binding_guard before update on public.admins for each row execute function public.encheck_custom_binding_guard();
commit;
