begin;
create table if not exists public.admin_mfa_recovery_jobs(
 id uuid primary key default gen_random_uuid(),actor_id uuid not null,target_id uuid not null,user_id uuid not null,
 reason text not null,state text not null default 'requested' check(state in ('requested','completed','failed')),
 created_at timestamptz not null default now()
);
alter table public.admin_mfa_recovery_jobs enable row level security;
revoke all on public.admin_mfa_recovery_jobs from public,anon,authenticated;
create or replace function public.encheck_mfa_recovery_prepare(p_target_id uuid,p_confirm_email text,p_reason text)
returns public.admin_mfa_recovery_jobs language plpgsql security definer set search_path=pg_catalog,public as $$
declare actor uuid; target public.admins; job public.admin_mfa_recovery_jobs;
begin
 perform public.encheck_admin_request_guard();
 if coalesce(current_setting('pgrst.db_pre_request',true),'')<>'public.encheck_admin_request_guard' then raise exception 'Contrôle REST/RPC requis avant récupération.'; end if;
 if auth.jwt()->>'aal' is distinct from 'aal2' then raise exception 'Le superadministrateur doit vérifier son propre second facteur.' using errcode='42501'; end if;
 select id into strict actor from public.admins where user_id=auth.uid() and is_active is true and role='super_admin';
 if actor=p_target_id then raise exception 'Votre propre récupération nécessite un autre superadministrateur.'; end if;
 select * into strict target from public.admins where id=p_target_id for update;
 if target.user_id is null or lower(trim(p_confirm_email)) is distinct from lower(target.email) or p_reason is null or length(trim(p_reason)) not between 5 and 500 then raise exception 'Identité de récupération ou motif invalide.'; end if;
 if exists(select 1 from public.admin_mfa_recovery_jobs where target_id=p_target_id and created_at>now()-interval '2 minutes') then raise exception 'Une récupération vient d’être demandée. Attendez deux minutes et vérifiez son résultat.'; end if;
 insert into public.admin_session_revocations(session_id,user_id,actor_id,reason)
 select id,user_id,actor,'Récupération des facteurs par le support' from auth.sessions where user_id=target.user_id on conflict(session_id) do nothing;
 insert into public.admin_mfa_recovery_jobs(actor_id,target_id,user_id,reason) values(actor,p_target_id,target.user_id,trim(p_reason)) returning * into job;
 insert into public.admin_account_events(actor_id,target_id,action,reason) values(actor,p_target_id,'mfa_recovery_requested',trim(p_reason));
 return job;
end $$;
create or replace function public.encheck_mfa_recovery_finish(p_job_id uuid,p_success boolean)
returns void language plpgsql security definer set search_path=pg_catalog,public as $$
declare job public.admin_mfa_recovery_jobs;
begin
 select * into strict job from public.admin_mfa_recovery_jobs where id=p_job_id for update;
 if job.state<>'requested' then raise exception 'Résultat déjà enregistré.'; end if;
 update public.admin_mfa_recovery_jobs set state=case when p_success then 'completed' else 'failed' end where id=p_job_id;
 insert into public.admin_account_events(actor_id,target_id,action,reason) values(job.actor_id,job.target_id,case when p_success then 'mfa_recovery_completed' else 'mfa_recovery_failed' end,job.reason);
end $$;
revoke all on function public.encheck_mfa_recovery_prepare(uuid,text,text),public.encheck_mfa_recovery_finish(uuid,boolean) from public,anon,authenticated;
grant execute on function public.encheck_mfa_recovery_prepare(uuid,text,text) to authenticated;
grant execute on function public.encheck_mfa_recovery_finish(uuid,boolean) to service_role;
commit;
