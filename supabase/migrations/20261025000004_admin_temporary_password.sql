begin;
create table if not exists public.admin_password_requirements(
 admin_id uuid primary key,password_fingerprint text not null,created_at timestamptz not null default now()
);
alter table public.admin_password_requirements enable row level security;
revoke all on public.admin_password_requirements from public,anon,authenticated;
-- Fingerprint of the salted Auth hash, never the password or the Auth hash itself.
create or replace function public.encheck_password_change_required()
returns boolean language sql stable security definer set search_path=pg_catalog,public as $$
 select exists(select 1 from public.admin_password_requirements r join public.admins a on a.id=r.admin_id join auth.users u on u.id=a.user_id where a.user_id=auth.uid() and r.password_fingerprint=md5(u.encrypted_password));
$$;
create or replace function public.encheck_admin_request_guard()
returns void language plpgsql security definer set search_path=pg_catalog,public as $$
begin
 if auth.uid() is not null and exists(select 1 from public.admins where user_id=auth.uid()) then
  if not public.encheck_admin_session_valid() then raise exception 'Session administrateur non autorisée. Reconnectez-vous et vérifiez votre second facteur.' using errcode='42501'; end if;
  if public.encheck_password_change_required() and coalesce(current_setting('request.path',true),'')<>'/rpc/encheck_account_password_status' then
   raise exception 'Changement du mot de passe temporaire obligatoire.' using errcode='42501';
  end if;
 end if;
end $$;
create or replace function public.encheck_account_password_status()
returns boolean language plpgsql security definer set search_path=pg_catalog,public as $$
begin
 if not public.encheck_admin_session_valid() then raise exception 'Session administrateur non autorisée.' using errcode='42501'; end if;
 return public.encheck_password_change_required();
end $$;
create or replace function public.encheck_account_password(p_admin_id uuid,p_password text,p_reason text)
returns void language plpgsql security definer set search_path=pg_catalog,public as $$
declare actor public.admins%rowtype; target public.admins%rowtype; result jsonb; service_oid regprocedure; returns_void boolean;
begin
 perform public.encheck_admin_request_guard();
 if coalesce(current_setting('pgrst.db_pre_request',true),'')<>'public.encheck_admin_request_guard' then raise exception 'Activez le contrôle REST/RPC avant de remettre un mot de passe temporaire.'; end if;
 perform pg_advisory_xact_lock(240102026);
 select * into strict actor from public.admins where user_id=auth.uid() and is_active and role='super_admin' for update;
 if p_admin_id=actor.id then raise exception 'Utilisez Mon compte pour modifier votre propre mot de passe.'; end if;
 if p_password is null or length(p_password) not between 12 and 72 or octet_length(p_password)>72 then raise exception 'Le nouveau mot de passe doit contenir de 12 à 72 caractères, avec un maximum de 72 octets UTF-8.'; end if;
 if p_reason is null or length(trim(p_reason)) not between 5 and 500 then raise exception 'Un motif de 5 à 500 caractères est requis.'; end if;
 if position(p_password in p_reason)>0 then raise exception 'Le motif ne doit pas contenir le mot de passe.'; end if;
 select * into strict target from public.admins where id=p_admin_id for update;
 service_oid := to_regprocedure('public.encheck_admin_definir_mot_de_passe(uuid,text)');
 if service_oid is null then
   raise exception 'Le service serveur de changement de mot de passe doit être installé et vérifié.';
 end if;
 select prorettype='void'::regtype into returns_void from pg_proc where oid=service_oid;
 begin
   select to_jsonb(public.encheck_admin_definir_mot_de_passe(target.id,p_password)) into result;
   -- Only void (exception-on-failure) or explicitly successful results are accepted.
   if not returns_void and not coalesce((result='true'::jsonb or
     (jsonb_typeof(result)='object' and (result->'ok'='true'::jsonb or result->'success'='true'::jsonb)
       and coalesce(result->'error','null'::jsonb)='null'::jsonb
       and coalesce(result->'ok','true'::jsonb)<>'false'::jsonb
       and coalesce(result->'success','true'::jsonb)<>'false'::jsonb)),false) then
     raise exception 'Résultat du service non confirmé.';
   end if;
 exception when others then
   -- Never relay a legacy service error that might contain credential material.
   raise exception 'Le service de connexion a refusé la modification. Aucun changement n’a été enregistré.';
 end;
 insert into public.admin_session_revocations(session_id,user_id,actor_id,reason)
 select s.id,s.user_id,actor.id,'Remplacement du mot de passe par le support' from auth.sessions s join public.admins a on a.user_id=s.user_id where a.id=target.id
 on conflict(session_id) do nothing;
 insert into public.admin_password_requirements(admin_id,password_fingerprint)
 select a.id,md5(u.encrypted_password) from public.admins a join auth.users u on u.id=a.user_id where a.id=target.id and coalesce(u.encrypted_password,'')<>''
 on conflict(admin_id) do update set password_fingerprint=excluded.password_fingerprint,created_at=now();
 if not found then raise exception 'Identité Auth non confirmée. Modification annulée.'; end if;
 insert into public.admin_account_events(actor_id,target_id,action,reason)
 values(actor.id,target.id,'password_changed',trim(p_reason));
end $$;
revoke all on function public.encheck_account_password(uuid,text,text) from public,anon,authenticated;
grant execute on function public.encheck_account_password(uuid,text,text) to authenticated;
revoke all on function public.encheck_password_change_required(),public.encheck_account_password_status() from public,anon,authenticated;
grant execute on function public.encheck_account_password_status() to authenticated;
-- Retire known legacy password entry points; the SECURITY DEFINER wrapper
-- retains owner access. Other historical Auth RPCs still require audit.
do $$ declare f record; begin
 for f in select oid::regprocedure signature from pg_proc where pronamespace='public'::regnamespace and proname in ('encheck_admin_definir_mot_de_passe','update_admin_password') loop
  execute format('revoke all on function %s from public,anon,authenticated',f.signature);
 end loop;
end $$;
create or replace function public.encheck_audit_auth_password()
returns trigger language plpgsql security definer set search_path=pg_catalog,public as $$
begin
 if new.encrypted_password is distinct from old.encrypted_password then
  insert into public.admin_account_events(actor_id,target_id,action)
  select null,id,'auth_password_updated' from public.admins where user_id=new.id;
 end if;
 return new;
end $$;
revoke all on function public.encheck_audit_auth_password() from public,anon,authenticated;
drop trigger if exists encheck_auth_password_audit on auth.users;
create trigger encheck_auth_password_audit after update of encrypted_password on auth.users for each row execute function public.encheck_audit_auth_password();
commit;
