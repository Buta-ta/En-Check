begin;
create table if not exists public.admin_session_observations(
 session_id uuid primary key,admin_id uuid not null,user_agent text not null default '',
 unfamiliar boolean not null default false,acknowledged_at timestamptz,created_at timestamptz not null default now()
);
alter table public.admin_session_observations enable row level security;
revoke all on public.admin_session_observations from public,anon,authenticated;
create or replace function public.encheck_account_session_seen()
returns boolean language plpgsql security definer set search_path=pg_catalog,public as $$
declare actor uuid; session_row auth.sessions; unfamiliar boolean;
begin
 perform public.encheck_admin_request_guard();
 select id into strict actor from public.admins where user_id=auth.uid() and is_active is true for update;
 select * into strict session_row from auth.sessions where user_id=auth.uid() and id::text=auth.jwt()->>'session_id';
 unfamiliar:=coalesce(session_row.user_agent,'')<>'' and exists(select 1 from public.admin_session_observations where admin_id=actor)
 and not exists(select 1 from public.admin_session_observations where admin_id=actor and user_agent=left(coalesce(session_row.user_agent,''),512));
 insert into public.admin_session_observations(session_id,admin_id,user_agent,unfamiliar) values(session_row.id,actor,left(coalesce(session_row.user_agent,''),512),unfamiliar) on conflict(session_id) do nothing;
 if found and unfamiliar then insert into public.admin_account_events(actor_id,target_id,action) values(actor,actor,'unfamiliar_browser'); end if;
 return unfamiliar;
end $$;
create or replace function public.encheck_account_session_alerts(p_acknowledge uuid default null)
returns table(session_id uuid,user_agent text,created_at timestamptz) language plpgsql security definer set search_path=pg_catalog,public as $$
declare actor uuid;
begin
 perform public.encheck_admin_request_guard();
 select id into strict actor from public.admins where user_id=auth.uid() and is_active is true;
 if p_acknowledge is not null then
  update public.admin_session_observations s set acknowledged_at=now() where s.session_id=p_acknowledge and admin_id=actor and unfamiliar and acknowledged_at is null;
  if found then insert into public.admin_account_events(actor_id,target_id,action) values(actor,actor,'session_alert_acknowledged'); end if;
 end if;
 return query select s.session_id,s.user_agent,s.created_at from public.admin_session_observations s where s.admin_id=actor and s.unfamiliar and s.acknowledged_at is null order by s.created_at desc limit 50;
end $$;
revoke all on function public.encheck_account_session_seen(),public.encheck_account_session_alerts(uuid) from public,anon,authenticated;
grant execute on function public.encheck_account_session_seen(),public.encheck_account_session_alerts(uuid) to authenticated;
commit;
