begin;
create table if not exists public.admin_account_preferences (
 admin_id uuid primary key references public.admins(id),phone text not null default '',job_title text not null default '',home_path text not null default '/dashboard',email_notifications boolean not null default true,updated_at timestamptz not null default now()
);
alter table public.admin_account_preferences enable row level security;
revoke all on public.admin_account_preferences from public,anon,authenticated;
create table if not exists public.admin_session_revocations (
 session_id uuid primary key,user_id uuid not null,actor_id uuid not null,reason text not null,created_at timestamptz not null default now()
);
alter table public.admin_session_revocations enable row level security;
revoke all on public.admin_session_revocations from public,anon,authenticated;

create or replace function public.encheck_admin_session_valid()
returns boolean language sql stable security definer set search_path=pg_catalog,public as $$
 select exists(select 1 from public.admins a join auth.sessions s on s.user_id=a.user_id
 where a.user_id=auth.uid() and a.is_active is true and s.id::text=auth.jwt()->>'session_id'
 and (s.not_after is null or s.not_after>now())
 and not exists(select 1 from public.admin_session_revocations r where r.session_id=s.id)
 and (not exists(select 1 from auth.mfa_factors f where f.user_id=a.user_id and f.status='verified') or auth.jwt()->>'aal'='aal2'));
$$;
create or replace function public.encheck_admin_request_guard()
returns void language plpgsql security definer set search_path=pg_catalog,public as $$
begin
 if auth.uid() is not null and exists(select 1 from public.admins where user_id=auth.uid()) and not public.encheck_admin_session_valid() then
   raise exception 'Session administrateur non autorisée. Reconnectez-vous et vérifiez votre second facteur.' using errcode='42501';
 end if;
end $$;
create or replace function public.encheck_account_security_status()
returns jsonb language plpgsql security definer set search_path=pg_catalog,public as $$
begin
 perform public.encheck_admin_request_guard();
 if not exists(select 1 from public.admins where user_id=auth.uid() and is_active is true) then raise exception 'Accès refusé.' using errcode='42501'; end if;
 return jsonb_build_object('rest_guard_active',coalesce(current_setting('pgrst.db_pre_request',true),'')='public.encheck_admin_request_guard');
end $$;
create or replace function public.encheck_account_preferences(p_values jsonb default null)
returns jsonb language plpgsql security definer set search_path=pg_catalog,public as $$
declare actor public.admins%rowtype; prefs public.admin_account_preferences%rowtype;
begin
 perform public.encheck_admin_request_guard();
 select * into strict actor from public.admins where user_id=auth.uid() and is_active is true;
 if p_values is not null then
  if jsonb_typeof(p_values)<>'object' or p_values-array['phone','job_title','home_path','email_notifications']<>'{}'::jsonb then raise exception 'Préférences non autorisées.'; end if;
  if coalesce(jsonb_typeof(p_values->'phone'),'null')<>'string' or coalesce(jsonb_typeof(p_values->'job_title'),'null')<>'string' or length(p_values->>'phone')>40 or length(p_values->>'job_title')>100 or coalesce(jsonb_typeof(p_values->'email_notifications'),'null')<>'boolean' then raise exception 'Préférences invalides.'; end if;
  if coalesce(p_values->>'home_path','') not in ('/dashboard','/mon-compte','/pointages','/planning','/employes') then raise exception 'Page d’accueil non autorisée.'; end if;
  insert into public.admin_account_preferences(admin_id,phone,job_title,home_path,email_notifications) values(actor.id,trim(p_values->>'phone'),trim(p_values->>'job_title'),p_values->>'home_path',(p_values->>'email_notifications')::boolean)
  on conflict(admin_id) do update set phone=excluded.phone,job_title=excluded.job_title,home_path=excluded.home_path,email_notifications=excluded.email_notifications,updated_at=now();
  update public.admins set alertes_email=(p_values->>'email_notifications')::boolean where id=actor.id;
  insert into public.admin_account_events(actor_id,target_id,action) values(actor.id,actor.id,'preferences_updated');
 end if;
 select * into prefs from public.admin_account_preferences where admin_id=actor.id;
 return jsonb_build_object('phone',coalesce(prefs.phone,''),'job_title',coalesce(prefs.job_title,''),'home_path',coalesce(prefs.home_path,'/dashboard'),'email_notifications',coalesce(prefs.email_notifications,actor.alertes_email,true));
end $$;
create or replace function public.encheck_account_sessions(p_admin_id uuid default null)
returns table(id uuid,created_at timestamptz,updated_at timestamptz,user_agent text,ip text,revoked boolean,is_current boolean)
language plpgsql security definer set search_path=pg_catalog,public as $$
declare actor public.admins%rowtype; target public.admins%rowtype;
begin
 perform public.encheck_admin_request_guard();
 select * into strict actor from public.admins where user_id=auth.uid() and is_active is true;
 select * into strict target from public.admins where admins.id=coalesce(p_admin_id,actor.id);
 if actor.id<>target.id and actor.role is distinct from 'super_admin' then raise exception 'Accès refusé.' using errcode='42501'; end if;
 return query select s.id,s.created_at,s.updated_at,left(s.user_agent,512),s.ip::text,exists(select 1 from public.admin_session_revocations r where r.session_id=s.id),s.id::text=auth.jwt()->>'session_id' from auth.sessions s where s.user_id=target.user_id and (s.not_after is null or s.not_after>now()) order by s.created_at desc limit 100;
end $$;
create or replace function public.encheck_account_revoke_session(p_session_id uuid,p_reason text)
returns void language plpgsql security definer set search_path=pg_catalog,public as $$
declare actor public.admins%rowtype; target public.admins%rowtype; v_session_user uuid;
begin
 perform public.encheck_admin_request_guard();
 if coalesce(current_setting('pgrst.db_pre_request',true),'')<>'public.encheck_admin_request_guard' then raise exception 'Le contrôle serveur des sessions doit être activé avant cette action.'; end if;
 select * into strict actor from public.admins where user_id=auth.uid() and is_active is true;
 select user_id into strict v_session_user from auth.sessions where id=p_session_id;
 select * into strict target from public.admins where user_id=v_session_user;
 if actor.id<>target.id and actor.role is distinct from 'super_admin' then raise exception 'Accès refusé.' using errcode='42501'; end if;
 if p_reason is null or length(trim(p_reason)) not between 5 and 500 then raise exception 'Motif requis (5 à 500 caractères).'; end if;
 insert into public.admin_session_revocations(session_id,user_id,actor_id,reason) values(p_session_id,v_session_user,actor.id,trim(p_reason)) on conflict(session_id) do nothing;
 if found then insert into public.admin_account_events(actor_id,target_id,action,reason) values(actor.id,target.id,'session_revoked',trim(p_reason)); end if;
end $$;
revoke all on function public.encheck_admin_session_valid(),public.encheck_admin_request_guard(),public.encheck_account_security_status(),public.encheck_account_preferences(jsonb),public.encheck_account_sessions(uuid),public.encheck_account_revoke_session(uuid,text) from public,anon;
grant execute on function public.encheck_admin_request_guard() to anon,authenticated;
grant execute on function public.encheck_account_security_status(),public.encheck_account_preferences(jsonb),public.encheck_account_sessions(uuid),public.encheck_account_revoke_session(uuid,text) to authenticated;
commit;
