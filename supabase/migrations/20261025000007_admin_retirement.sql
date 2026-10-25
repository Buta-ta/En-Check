-- Irreversible profile retirement, never DELETE/CASCADE of the historical admin row.
-- Requires account migrations 20261024.. and 20261025000001..06.
begin;
create table if not exists public.admin_retirement_requests (
 id uuid primary key default gen_random_uuid(),target_id uuid not null,
 requested_by uuid not null,approved_by uuid,reason text not null,
 state text not null default 'requested' check(state in ('requested','cancelled','auth_pending','shared_identity_preserved','completed')),
 auth_user_id uuid,created_at timestamptz not null default now(),completed_at timestamptz,assets_cleaned_at timestamptz
);
create unique index if not exists admin_retirement_one_open on public.admin_retirement_requests(target_id) where state<>'cancelled';
alter table public.admin_retirement_requests enable row level security;
revoke all on public.admin_retirement_requests from public,anon,authenticated;
grant select(id,target_id,requested_by,approved_by,reason,state,created_at,completed_at,assets_cleaned_at) on public.admin_retirement_requests to authenticated;
drop policy if exists admin_retirement_read on public.admin_retirement_requests;
create policy admin_retirement_read on public.admin_retirement_requests for select to authenticated using(exists(select 1 from public.admins where user_id=auth.uid() and is_active is true and role='super_admin'));

create or replace function public.encheck_require_superadmin_aal2()
returns uuid language plpgsql security definer set search_path=pg_catalog,public as $$
declare actor uuid;
begin
 perform public.encheck_admin_request_guard();
 if auth.jwt()->>'aal' is distinct from 'aal2' then raise exception 'Vérifiez votre second facteur avant cette opération.' using errcode='42501'; end if;
 if coalesce(current_setting('pgrst.db_pre_request',true),'')<>'public.encheck_admin_request_guard' then raise exception 'Le contrôle REST/RPC doit être activé.'; end if;
 select id into strict actor from public.admins where user_id=auth.uid() and is_active is true and role='super_admin' for update;
 return actor;
end $$;

create or replace function public.encheck_account_responsibilities(p_target_id uuid)
returns jsonb language plpgsql security definer set search_path=pg_catalog,public as $$
declare actor uuid; pending bigint;
begin
 actor:=public.encheck_require_superadmin_aal2();
 perform 1 from public.admins where id=p_target_id;
 if not found then raise exception 'Compte introuvable.'; end if;
 select count(*) into pending from public.prospects where assigned_to=p_target_id and coalesce(status,'') not in ('signe','perdu');
 return jsonb_build_object('open_prospects',pending,'historical_authorship_preserved',true);
end $$;
create or replace function public.encheck_account_transfer_responsibilities(p_target_id uuid,p_successor_id uuid,p_reason text)
returns integer language plpgsql security definer set search_path=pg_catalog,public as $$
declare actor uuid; moved integer;
begin
 perform pg_advisory_xact_lock(240102026);
 actor:=public.encheck_require_superadmin_aal2();
 if p_target_id=p_successor_id or p_reason is null or length(trim(p_reason)) not between 5 and 500 then raise exception 'Repreneur distinct et motif requis.'; end if;
 perform 1 from public.admins where id in (p_target_id,p_successor_id) order by id for update;
 if not exists(select 1 from public.admins where id=p_target_id) then raise exception 'Compte source introuvable.'; end if;
 -- Prospection currently has a superadmin-only write policy. Do not assign
 -- operational responsibility to someone who cannot act on it.
 if not exists(select 1 from public.admins where id=p_successor_id and is_active is true and role='super_admin') then raise exception 'Le repreneur doit être un superadministrateur actif.'; end if;
 update public.prospects set assigned_to=p_successor_id,updated_by=actor,updated_at=now()
 where assigned_to=p_target_id and coalesce(status,'') not in ('signe','perdu');
 get diagnostics moved=row_count;
 insert into public.admin_account_events(actor_id,target_id,action,reason) values(actor,p_target_id,'responsibilities_transferred',trim(p_reason)||' · Repreneur '||p_successor_id::text||' · Prospects ouverts : '||moved::text);
 return moved;
end $$;

create or replace function public.encheck_retirement_request(p_target_id uuid,p_reason text)
returns uuid language plpgsql security definer set search_path=pg_catalog,public as $$
declare actor uuid; result uuid; subject_auth uuid;
begin
 perform pg_advisory_xact_lock(240102026);
 actor:=public.encheck_require_superadmin_aal2();
 if actor=p_target_id or p_reason is null or length(trim(p_reason)) not between 5 and 500 then raise exception 'Auto-suppression interdite ou motif invalide.'; end if;
 select user_id into subject_auth from public.admins where id=p_target_id and is_active is false for update;
 if not found or not exists(select 1 from public.admin_account_archives where admin_id=p_target_id and created_at<=now()-interval '7 days') then raise exception 'Le compte doit être inactif et archivé depuis au moins sept jours.'; end if;
 insert into public.admin_retirement_requests(target_id,requested_by,reason,auth_user_id) values(p_target_id,actor,trim(p_reason),subject_auth) returning id into result;
 insert into public.admin_account_events(actor_id,target_id,action,reason) values(actor,p_target_id,'retirement_requested',trim(p_reason));
 return result;
end $$;
create or replace function public.encheck_retirement_cancel(p_request_id uuid)
returns void language plpgsql security definer set search_path=pg_catalog,public as $$
declare actor uuid; target uuid;
begin
 perform pg_advisory_xact_lock(240102026);
 actor:=public.encheck_require_superadmin_aal2();
 update public.admin_retirement_requests set state='cancelled',auth_user_id=null where id=p_request_id and state='requested' returning target_id into target;
 if not found then raise exception 'Demande non annulable.'; end if;
 insert into public.admin_account_events(actor_id,target_id,action) values(actor,target,'retirement_cancelled');
end $$;

-- Approving also seals the profile in one SQL transaction. Auth cleanup is a
-- separate resumable step; failure cannot reactivate the administrative identity.
create or replace function public.encheck_retirement_execute(p_request_id uuid)
returns jsonb language plpgsql security definer set search_path=pg_catalog,public as $$
declare actor uuid; job public.admin_retirement_requests; target public.admins; shared boolean;
begin
 perform pg_advisory_xact_lock(240102026);
 actor:=public.encheck_require_superadmin_aal2();
 select * into strict job from public.admin_retirement_requests where id=p_request_id for update;
 if actor=job.requested_by or actor=job.target_id then raise exception 'Un autre superadministrateur doit approuver la suppression.'; end if;
 if job.state in ('auth_pending','shared_identity_preserved','completed') then return jsonb_build_object('id',job.id,'state',job.state,'auth_user_id',job.auth_user_id); end if;
 if job.state<>'requested' then raise exception 'Demande non exécutable.'; end if;
 perform 1 from public.admins where id=job.requested_by and is_active is true and role='super_admin' for update;
 if not found then raise exception 'Le demandeur doit encore être superadministrateur actif.'; end if;
 select * into strict target from public.admins where id=job.target_id for update;
 if target.user_id is distinct from job.auth_user_id then raise exception 'Identité Auth modifiée depuis la demande : nouvelle approbation requise.'; end if;
 if target.is_active is distinct from false or not exists(select 1 from public.admin_account_archives where admin_id=target.id and created_at<=now()-interval '7 days') then raise exception 'Archivage de sept jours requis.'; end if;
 if exists(select 1 from public.prospects where assigned_to=target.id and coalesce(status,'') not in ('signe','perdu')) then raise exception 'Transférez d’abord les prospects encore ouverts.'; end if;
 shared:=target.user_id is not null and (exists(select 1 from public.employees where user_id=target.user_id) or exists(select 1 from public.admins where user_id=target.user_id and id<>target.id));
 -- Block known administrative REST sessions; employee sessions sharing Auth
 -- remain outside this admin request guard after unlinking the admin profile.
 insert into public.admin_session_revocations(session_id,user_id,actor_id,reason)
 select id,user_id,actor,'Clôture définitive du profil administrateur' from auth.sessions where user_id=target.user_id on conflict(session_id) do nothing;
 delete from public.admin_account_archives where admin_id=target.id;
 delete from public.admin_entreprises where admin_id=target.id;
 delete from public.admin_account_preferences where admin_id=target.id;
 delete from public.admin_password_requirements where admin_id=target.id;
 delete from public.admin_session_observations where admin_id=target.id;
 update public.admin_support_delegations set revoked_at=now() where (target_id=target.id or delegate_id=target.id) and revoked_at is null;
 update public.admins set user_id=null,email='deleted-'||id::text||'@invalid.invalid',username=null,
 first_name='Compte supprimé',last_name='',photo_url=null,password_hash='!retired!',role='admin',enterprise_id=null,is_active=false,
 alertes_email=false,dashboard_preferences='{}'::jsonb,failed_attempts=0,locked_until=null,last_failed_at=null,last_login_at=null
 where id=target.id;
 update public.admin_retirement_requests set approved_by=actor,auth_user_id=target.user_id,
 state=case when shared then 'shared_identity_preserved' when target.user_id is null then 'completed' else 'auth_pending' end,
 completed_at=case when shared or target.user_id is null then now() else null end where id=job.id returning * into job;
 insert into public.admin_account_events(actor_id,target_id,action,reason) values(actor,target.id,'profile_retired',job.reason);
 return jsonb_build_object('id',job.id,'state',job.state,'auth_user_id',job.auth_user_id);
end $$;
create or replace function public.encheck_retirement_finish(p_request_id uuid)
returns void language plpgsql security definer set search_path=pg_catalog,public as $$
declare job public.admin_retirement_requests;
begin
 select * into strict job from public.admin_retirement_requests where id=p_request_id for update;
 if job.state='completed' then return; end if;
 if job.state not in ('auth_pending','shared_identity_preserved') then raise exception 'État non finalisable.'; end if;
 if exists(select 1 from storage.objects where bucket_id='admin-avatars' and name like job.auth_user_id::text||'/%') then raise exception 'Nettoyage des photos non confirmé.'; end if;
 if job.state='shared_identity_preserved' then
  if job.assets_cleaned_at is null then insert into public.admin_account_events(actor_id,target_id,action) values(job.approved_by,job.target_id,'retirement_assets_cleaned'); end if;
  update public.admin_retirement_requests set assets_cleaned_at=now(),completed_at=now() where id=job.id;
  return;
 end if;
 if exists(select 1 from auth.users where id=job.auth_user_id) then raise exception 'Suppression Auth non confirmée.'; end if;
 update public.admin_retirement_requests set state='completed',auth_user_id=null,completed_at=now(),assets_cleaned_at=now() where id=job.id;
 insert into public.admin_account_events(actor_id,target_id,action) values(job.approved_by,job.target_id,'auth_identity_deleted');
end $$;

create or replace function public.encheck_guard_retired_admin()
returns trigger language plpgsql security definer set search_path=pg_catalog,public as $$
begin
 if exists(select 1 from public.admin_retirement_requests where target_id=old.id and state in ('auth_pending','shared_identity_preserved','completed')) then raise exception 'Profil définitivement clôturé : modification et suppression de la trace historique interdites.'; end if;
 if tg_op='DELETE' then return old; end if; return new;
end $$;
drop trigger if exists guard_retired_admin on public.admins;
create trigger guard_retired_admin before update or delete on public.admins for each row execute function public.encheck_guard_retired_admin();
-- Protect against unlinking an employee/other application by an Auth API delete,
-- including a new reference created after the administrative profile was sealed.
create or replace function public.encheck_guard_retired_auth_delete()
returns trigger language plpgsql security definer set search_path=pg_catalog,public as $$
declare ref record; linked boolean;
begin
 if not exists(select 1 from public.admin_retirement_requests where auth_user_id=old.id and state in ('auth_pending','shared_identity_preserved')) then return old; end if;
 if exists(select 1 from public.admin_retirement_requests where auth_user_id=old.id and state='shared_identity_preserved') then raise exception 'Identité partagée : suppression Auth interdite par ce parcours.'; end if;
 for ref in
  select n.nspname,t.relname,a.attname,c.conkey from pg_constraint c
  join pg_class t on t.oid=c.conrelid join pg_namespace n on n.oid=t.relnamespace
  join pg_attribute a on a.attrelid=t.oid and a.attnum=c.conkey[1]
  where c.contype='f' and c.confrelid='auth.users'::regclass and n.nspname<>'auth'
 loop
  if cardinality(ref.conkey)<>1 then raise exception 'Dépendance Auth composite à examiner.'; end if;
  execute format('select exists(select 1 from %I.%I where %I=$1)',ref.nspname,ref.relname,ref.attname) into linked using old.id;
  if linked then raise exception 'Identité encore référencée : nettoyage Auth suspendu.'; end if;
 end loop;
 return old;
end $$;
drop trigger if exists encheck_retired_auth_delete on auth.users;
create trigger encheck_retired_auth_delete before delete on auth.users for each row execute function public.encheck_guard_retired_auth_delete();
create or replace function public.encheck_guard_prospect_owner()
returns trigger language plpgsql security definer set search_path=pg_catalog,public as $$
begin
 if tg_op='UPDATE' and new.assigned_to is not distinct from old.assigned_to then return new; end if;
 if new.assigned_to is not null then
  perform 1 from public.admins where id=new.assigned_to and is_active is true for update;
  if not found then raise exception 'Le responsable du prospect doit être un compte actif.'; end if;
 end if;
 return new;
end $$;
drop trigger if exists encheck_prospect_owner on public.prospects;
create trigger encheck_prospect_owner before insert or update of assigned_to on public.prospects for each row execute function public.encheck_guard_prospect_owner();

revoke all on function public.encheck_require_superadmin_aal2(),public.encheck_account_responsibilities(uuid),public.encheck_account_transfer_responsibilities(uuid,uuid,text),public.encheck_retirement_request(uuid,text),public.encheck_retirement_cancel(uuid),public.encheck_retirement_execute(uuid),public.encheck_retirement_finish(uuid),public.encheck_guard_retired_admin(),public.encheck_guard_retired_auth_delete(),public.encheck_guard_prospect_owner() from public,anon,authenticated;
grant execute on function public.encheck_account_responsibilities(uuid),public.encheck_account_transfer_responsibilities(uuid,uuid,text),public.encheck_retirement_request(uuid,text),public.encheck_retirement_cancel(uuid),public.encheck_retirement_execute(uuid) to authenticated;
grant execute on function public.encheck_retirement_finish(uuid) to service_role;
commit;
