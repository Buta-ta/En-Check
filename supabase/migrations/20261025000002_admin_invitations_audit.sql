begin;
create table if not exists public.admin_invitations (
 id uuid primary key default gen_random_uuid(), email text not null,
 first_name text not null,last_name text not null,enterprise_id uuid not null references public.enterprises(id),
 actor_id uuid not null,user_id uuid, state text not null default 'sending' check(state in ('sending','sent','failed','cancelled','accepted')),
 expires_at timestamptz not null default now()+interval '7 days', last_sent_at timestamptz not null default now(),
 created_at timestamptz not null default now()
);
create unique index if not exists admin_invitation_pending_email on public.admin_invitations(lower(email)) where state in ('sending','sent','failed');
alter table public.admin_invitations enable row level security;
revoke all on public.admin_invitations from public,anon,authenticated;
grant select on public.admin_invitations to authenticated;
drop policy if exists invitations_read on public.admin_invitations;
create policy invitations_read on public.admin_invitations for select to authenticated using(exists(select 1 from public.admins where user_id=auth.uid() and is_active is true and role='super_admin'));

create or replace function public.encheck_invitation_prepare(p_email text,p_first_name text,p_last_name text,p_enterprise_id uuid,p_id uuid default null)
returns public.admin_invitations language plpgsql security definer set search_path=pg_catalog,public as $$
declare actor uuid; item public.admin_invitations;
begin
 perform public.encheck_admin_request_guard();
 select id into strict actor from public.admins where user_id=auth.uid() and is_active is true and role='super_admin';
 if (select count(*) from public.admin_account_events where actor_id=actor and action='invitation_requested' and created_at>now()-interval '1 hour')>=20 then raise exception 'Limite horaire atteinte.'; end if;
 if p_id is not null then
  select * into strict item from public.admin_invitations where id=p_id for update;
  if item.state not in ('sent','failed') or item.last_sent_at>now()-interval '60 seconds' then raise exception 'Invitation non renouvelable ou délai de 60 secondes non écoulé.'; end if;
  update public.admin_invitations set state='sending',last_sent_at=now(),expires_at=now()+interval '7 days',actor_id=actor where id=p_id returning * into item;
 else
  if p_email is null or length(p_email)>254 or trim(p_email) !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' or p_first_name is null or p_last_name is null or length(trim(p_first_name)) not between 1 and 80 or length(trim(p_last_name)) not between 1 and 80 then raise exception 'Coordonnées invalides.'; end if;
  if exists(select 1 from public.admins where lower(trim(email))=lower(trim(p_email))) then raise exception 'Un compte existe déjà pour cette adresse.'; end if;
  if (select count(*) from public.admin_invitations where actor_id=actor and last_sent_at>now()-interval '1 hour')>=20 then raise exception 'Limite horaire atteinte.'; end if;
  insert into public.admin_invitations(email,first_name,last_name,enterprise_id,actor_id) values(lower(trim(p_email)),trim(p_first_name),trim(p_last_name),p_enterprise_id,actor) returning * into item;
 end if;
 insert into public.admin_account_events(actor_id,target_id,action,reason) values(actor,actor,'invitation_requested',item.id::text);
 return item;
end $$;
-- Called only by the authenticated Edge handler using its server-only service key.
create or replace function public.encheck_invitation_delivery(p_id uuid,p_user_id uuid,p_success boolean)
returns void language plpgsql security definer set search_path=pg_catalog,public as $$
declare item public.admin_invitations;
begin
 select * into strict item from public.admin_invitations where id=p_id for update;
 if item.state<>'sending' then raise exception 'État modifié pendant l’envoi.'; end if;
 if p_success and (p_user_id is null or exists(select 1 from public.admins where user_id=p_user_id)) then raise exception 'Identité non admissible.'; end if;
 update public.admin_invitations set state=case when p_success then 'sent' else 'failed' end,user_id=coalesce(p_user_id,user_id) where id=p_id;
 insert into public.admin_account_events(actor_id,target_id,action,reason) values(item.actor_id,item.actor_id,case when p_success then 'invitation_sent' else 'invitation_failed' end,item.id::text);
end $$;
create or replace function public.encheck_invitation_cancel(p_id uuid)
returns void language plpgsql security definer set search_path=pg_catalog,public as $$
declare actor uuid;
begin
 perform public.encheck_admin_request_guard();
 select id into strict actor from public.admins where user_id=auth.uid() and is_active is true and role='super_admin';
 update public.admin_invitations set state='cancelled' where id=p_id and state in ('sending','sent','failed');
 if not found then raise exception 'Invitation non annulable.'; end if;
 insert into public.admin_account_events(actor_id,target_id,action,reason) values(actor,actor,'invitation_cancelled',p_id::text);
end $$;
create or replace function public.encheck_invitation_accept()
returns uuid language plpgsql security definer set search_path=pg_catalog,public as $$
declare item public.admin_invitations; new_id uuid; verified_email text;
begin
 select email into strict verified_email from auth.users where id=auth.uid() and email_confirmed_at is not null;
 select * into strict item from public.admin_invitations where user_id=auth.uid() and state='sent' and expires_at>now() and lower(email)=lower(verified_email) for update;
 if not exists(select 1 from public.admins where id=item.actor_id and is_active is true and role='super_admin') then raise exception 'Invitation à renouveler par un superadministrateur actif.'; end if;
 if exists(select 1 from public.admins where user_id=auth.uid() or lower(email)=lower(verified_email)) then raise exception 'Compte déjà existant.'; end if;
 insert into public.admins(user_id,email,first_name,last_name,role,is_active,enterprise_id,password_hash)
 values(auth.uid(),verified_email,item.first_name,item.last_name,'admin',true,item.enterprise_id,'!supabase-auth-only!') returning id into new_id;
 insert into public.admin_entreprises(admin_id,enterprise_id,is_active) values(new_id,item.enterprise_id,true);
 update public.admin_invitations set state='accepted' where id=item.id;
 insert into public.admin_account_events(actor_id,target_id,action,reason) values(item.actor_id,new_id,'invitation_accepted',item.id::text);
 return new_id;
end $$;
create or replace function public.encheck_account_sync_email()
returns text language plpgsql security definer set search_path=pg_catalog,public as $$
declare actor public.admins; verified_email text;
begin
 perform public.encheck_admin_request_guard();
 select * into strict actor from public.admins where user_id=auth.uid() and is_active is true for update;
 select email into strict verified_email from auth.users where id=auth.uid() and email_confirmed_at is not null;
 if actor.email is distinct from verified_email then
  if exists(select 1 from public.admins where id<>actor.id and lower(email)=lower(verified_email)) then raise exception 'Adresse déjà rattachée.'; end if;
  update public.admins set email=verified_email where id=actor.id;
  insert into public.admin_account_events(actor_id,target_id,action) values(actor.id,actor.id,'email_verified');
 end if;
 return verified_email;
end $$;
-- No passwords, tokens, addresses or profile values in the audit payload.
-- actor_id is nullable only for trusted backend operations without an Auth identity.
alter table public.admin_account_events alter column actor_id drop not null;
create or replace function public.encheck_audit_admin_legacy()
returns trigger language plpgsql security definer set search_path=pg_catalog,public as $$
declare actor uuid; target uuid; action_name text;
begin
 select id into actor from public.admins where user_id=auth.uid() order by id limit 1;
 if tg_table_name='admin_entreprises' then
  if tg_op='DELETE' then target:=old.admin_id; else target:=new.admin_id; end if;
  action_name:='enterprise_access_'||lower(tg_op);
 else
  if tg_op='DELETE' then target:=old.id; else target:=new.id; end if;
  if tg_op='UPDATE' then
   if (to_jsonb(new)-array['last_login_at','updated_at','failed_attempts','last_failed_at','locked_until','lockout_count','lockout_window_start']) is not distinct from (to_jsonb(old)-array['last_login_at','updated_at','failed_attempts','last_failed_at','locked_until','lockout_count','lockout_window_start']) then return new; end if;
  end if;
  action_name:='account_'||lower(tg_op);
 end if;
 insert into public.admin_account_events(actor_id,target_id,action,reason) values(actor,target,action_name,'Modification enregistrée par le serveur');
 if tg_op='DELETE' then return old; else return new; end if;
end $$;
drop trigger if exists admin_legacy_audit on public.admins;
create trigger admin_legacy_audit after insert or update or delete on public.admins for each row execute function public.encheck_audit_admin_legacy();
drop trigger if exists admin_enterprise_audit on public.admin_entreprises;
create trigger admin_enterprise_audit after insert or update or delete on public.admin_entreprises for each row execute function public.encheck_audit_admin_legacy();
revoke all on function public.encheck_invitation_prepare(text,text,text,uuid,uuid),public.encheck_invitation_delivery(uuid,uuid,boolean),public.encheck_invitation_cancel(uuid),public.encheck_invitation_accept(),public.encheck_account_sync_email(),public.encheck_audit_admin_legacy() from public,anon,authenticated;
grant execute on function public.encheck_invitation_prepare(text,text,text,uuid,uuid),public.encheck_invitation_cancel(uuid),public.encheck_invitation_accept(),public.encheck_account_sync_email() to authenticated;
grant execute on function public.encheck_invitation_delivery(uuid,uuid,boolean) to service_role;
commit;
