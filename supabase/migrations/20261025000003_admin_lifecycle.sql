begin;
create table if not exists public.admin_account_archives(
 admin_id uuid primary key,actor_id uuid not null,successor_id uuid,reason text not null,created_at timestamptz not null default now()
);
alter table public.admin_account_archives enable row level security;
revoke all on public.admin_account_archives from public,anon,authenticated;
create table if not exists public.admin_support_delegations(
 id uuid primary key default gen_random_uuid(),target_id uuid not null,delegate_id uuid not null,actor_id uuid not null,
 expires_at timestamptz not null,reason text not null,revoked_at timestamptz,created_at timestamptz not null default now()
);
alter table public.admin_support_delegations enable row level security;
revoke all on public.admin_support_delegations from public,anon,authenticated;
create or replace function public.encheck_account_access(p_admin_id uuid,p_role text,p_enterprises uuid[],p_reason text)
returns void language plpgsql security definer set search_path=pg_catalog,public as $$
declare actor uuid;
begin
 perform public.encheck_admin_request_guard();
 perform pg_advisory_xact_lock(240102026);
 select id into strict actor from public.admins where user_id=auth.uid() and is_active is true and role='super_admin' for update;
 if p_admin_id=actor then raise exception 'Pas de modification de vos propres privilèges.'; end if;
 if p_role is null or p_role not in ('super_admin','admin','manager') or p_reason is null or length(trim(p_reason)) not between 5 and 500 then raise exception 'Rôle ou motif invalide.'; end if;
 if p_enterprises is null or cardinality(p_enterprises)>20 or (p_role<>'super_admin' and cardinality(p_enterprises)=0) or exists(select 1 from unnest(p_enterprises) e where e is null or not exists(select 1 from public.enterprises where id=e)) then raise exception 'Entreprises invalides (1 à 20 pour un administrateur standard).'; end if;
 perform 1 from public.admins where id=p_admin_id for update;
 if not found then raise exception 'Compte introuvable.'; end if;
 update public.admins set role=p_role,enterprise_id=p_enterprises[1] where id=p_admin_id;
 delete from public.admin_entreprises where admin_id=p_admin_id;
 insert into public.admin_entreprises(admin_id,enterprise_id,is_active) select p_admin_id,e,true from (select distinct unnest(p_enterprises) e) t;
 insert into public.admin_account_events(actor_id,target_id,action,reason) values(actor,p_admin_id,'access_updated',trim(p_reason));
end $$;
create or replace function public.encheck_account_archive(p_admin_id uuid,p_successor_id uuid,p_reason text)
returns void language plpgsql security definer set search_path=pg_catalog,public as $$
declare actor uuid; source public.admins;
begin
 perform public.encheck_admin_request_guard();
 perform pg_advisory_xact_lock(240102026);
 select id into strict actor from public.admins where user_id=auth.uid() and is_active is true and role='super_admin' for update;
 if actor=p_admin_id or p_reason is null or length(trim(p_reason)) not between 5 and 500 then raise exception 'Auto-archivage interdit ou motif invalide.'; end if;
 select * into strict source from public.admins where id=p_admin_id for update;
 if exists(select 1 from public.admin_account_archives where admin_id=p_admin_id) then raise exception 'Compte déjà archivé.'; end if;
 if p_successor_id is not null then
  if p_successor_id=p_admin_id or not exists(select 1 from public.admins where id=p_successor_id and is_active is true) then raise exception 'Repreneur actif distinct requis.'; end if;
  perform 1 from public.admins where id=p_successor_id for update;
  -- Transfer only enterprise access; no claim to transfer tasks or payroll approvals.
  update public.admin_entreprises set is_active=true where admin_id=p_successor_id and enterprise_id in (select enterprise_id from public.admin_entreprises where admin_id=p_admin_id and is_active is true union select source.enterprise_id where source.enterprise_id is not null);
  insert into public.admin_entreprises(admin_id,enterprise_id,is_active)
   select p_successor_id,e,true from (select enterprise_id e from public.admin_entreprises where admin_id=p_admin_id and is_active is true union select source.enterprise_id where source.enterprise_id is not null) t
   where not exists(select 1 from public.admin_entreprises where admin_id=p_successor_id and enterprise_id=e);
 end if;
 update public.admins set is_active=false where id=p_admin_id;
 update public.admin_entreprises set is_active=false where admin_id=p_admin_id;
 insert into public.admin_account_archives(admin_id,actor_id,successor_id,reason) values(p_admin_id,actor,p_successor_id,trim(p_reason));
 insert into public.admin_account_events(actor_id,target_id,action,reason) values(actor,p_admin_id,'account_archived',trim(p_reason));
end $$;
create or replace function public.encheck_account_restore(p_admin_id uuid,p_reason text)
returns void language plpgsql security definer set search_path=pg_catalog,public as $$
declare actor uuid;
begin
 perform public.encheck_admin_request_guard();
 perform pg_advisory_xact_lock(240102026);
 select id into strict actor from public.admins where user_id=auth.uid() and is_active is true and role='super_admin';
 if p_reason is null or length(trim(p_reason)) not between 5 and 500 then raise exception 'Motif requis.'; end if;
 delete from public.admin_account_archives where admin_id=p_admin_id;
 if not found then raise exception 'Compte non archivé.'; end if;
 -- Remains inactive; an explicit access review and reactivation are required.
 insert into public.admin_account_events(actor_id,target_id,action,reason) values(actor,p_admin_id,'account_restored',trim(p_reason));
end $$;
create or replace function public.encheck_guard_archived_admin()
returns trigger language plpgsql security definer set search_path=pg_catalog,public as $$
begin
 if exists(select 1 from public.admin_account_archives where admin_id=old.id) then
  raise exception 'Compte archivé : restauration préalable requise.';
 end if;
 return new;
end $$;
drop trigger if exists guard_archived_admin on public.admins;
create trigger guard_archived_admin before update on public.admins for each row execute function public.encheck_guard_archived_admin();
create or replace function public.encheck_support_grant(p_target_id uuid,p_delegate_id uuid,p_hours integer,p_reason text)
returns uuid language plpgsql security definer set search_path=pg_catalog,public as $$
declare actor uuid; result uuid;
begin
 perform public.encheck_admin_request_guard();
 select id into strict actor from public.admins where user_id=auth.uid() and is_active is true and role='super_admin';
 if p_hours is null or p_hours not between 1 and 24 or p_reason is null or length(trim(p_reason)) not between 5 and 500 or not exists(select 1 from public.admins where id=p_target_id) or not exists(select 1 from public.admins where id=p_delegate_id and is_active is true) then raise exception 'Délégation invalide (1 à 24 heures).'; end if;
 insert into public.admin_support_delegations(target_id,delegate_id,actor_id,expires_at,reason) values(p_target_id,p_delegate_id,actor,now()+make_interval(hours=>p_hours),trim(p_reason)) returning id into result;
 insert into public.admin_account_events(actor_id,target_id,action,reason) values(actor,p_target_id,'support_granted',trim(p_reason));
 return result;
end $$;
create or replace function public.encheck_support_revoke(p_target_id uuid,p_reason text)
returns void language plpgsql security definer set search_path=pg_catalog,public as $$
declare actor uuid;
begin
 perform public.encheck_admin_request_guard();
 select id into strict actor from public.admins where user_id=auth.uid() and is_active is true and role='super_admin';
 if p_reason is null or length(trim(p_reason)) not between 5 and 500 then raise exception 'Motif requis.'; end if;
 update public.admin_support_delegations set revoked_at=now() where target_id=p_target_id and revoked_at is null;
 insert into public.admin_account_events(actor_id,target_id,action,reason) values(actor,p_target_id,'support_revoked',trim(p_reason));
end $$;
create or replace function public.encheck_account_diagnostic(p_target_id uuid)
returns jsonb language plpgsql security definer set search_path=pg_catalog,public as $$
declare actor public.admins; target public.admins; result jsonb;
begin
 perform public.encheck_admin_request_guard();
 select * into strict actor from public.admins where user_id=auth.uid() and is_active is true;
 if actor.id<>p_target_id and actor.role is distinct from 'super_admin' and not exists(
  select 1 from public.admin_support_delegations d join public.admins issuer on issuer.id=d.actor_id where d.target_id=p_target_id and d.delegate_id=actor.id and d.expires_at>now() and d.revoked_at is null and issuer.role='super_admin' and issuer.is_active is true
 ) then raise exception 'Diagnostic non autorisé.' using errcode='42501'; end if;
 select * into strict target from public.admins where id=p_target_id;
 result:=jsonb_build_object('active',target.is_active,'auth_linked',exists(select 1 from auth.users where id=target.user_id),'mfa_verified',exists(select 1 from auth.mfa_factors where user_id=target.user_id and status='verified'),'archived',exists(select 1 from public.admin_account_archives where admin_id=target.id),'rest_guard_active',coalesce(current_setting('pgrst.db_pre_request',true),'')='public.encheck_admin_request_guard');
 insert into public.admin_account_events(actor_id,target_id,action) values(actor.id,target.id,'diagnostic_read');
 return result;
end $$;
revoke all on function public.encheck_account_access(uuid,text,uuid[],text),public.encheck_account_archive(uuid,uuid,text),public.encheck_account_restore(uuid,text),public.encheck_guard_archived_admin(),public.encheck_support_grant(uuid,uuid,integer,text),public.encheck_support_revoke(uuid,text),public.encheck_account_diagnostic(uuid) from public,anon,authenticated;
grant execute on function public.encheck_account_access(uuid,text,uuid[],text),public.encheck_account_archive(uuid,uuid,text),public.encheck_account_restore(uuid,text),public.encheck_support_grant(uuid,uuid,integer,text),public.encheck_support_revoke(uuid,text),public.encheck_account_diagnostic(uuid) to authenticated;
commit;
