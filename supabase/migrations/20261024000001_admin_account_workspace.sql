-- First account-management milestone. Review/apply in staging before production.
begin;
create table if not exists public.admin_account_events (
 id bigint generated always as identity primary key,
 actor_id uuid not null, target_id uuid not null,
 action text not null, reason text not null default '', created_at timestamptz not null default now()
);
alter table public.admin_account_events enable row level security;
revoke all on public.admin_account_events from anon, authenticated;
grant select on public.admin_account_events to authenticated;
drop policy if exists account_events_read on public.admin_account_events;
create policy account_events_read on public.admin_account_events for select to authenticated using (
 exists(select 1 from public.admins a where a.user_id=auth.uid() and a.is_active and (a.role='super_admin' or a.id=target_id))
);
create or replace function public.encheck_account_profile(p_first_name text,p_last_name text,p_photo_url text default null)
returns void language plpgsql security definer set search_path=pg_catalog,public as $$
declare actor public.admins%rowtype;
begin
 select * into strict actor from public.admins where user_id=auth.uid() and is_active for update;
 if length(trim(p_first_name)) not between 1 and 80 or length(trim(p_last_name)) not between 1 and 80 or p_first_name is null or p_last_name is null then raise exception 'Nom et prénom requis (80 caractères maximum).'; end if;
 if p_photo_url is not null and (length(p_photo_url)>500 or p_photo_url !~ ('^https://[a-z0-9.-]+/storage/v1/object/public/admin-avatars/' || auth.uid()::text || '/[a-zA-Z0-9-]+\.(jpg|png|webp)$')) then raise exception 'Photo non autorisée.'; end if;
 update public.admins set first_name=trim(p_first_name),last_name=trim(p_last_name),photo_url=coalesce(p_photo_url,photo_url) where id=actor.id;
 insert into public.admin_account_events(actor_id,target_id,action) values(actor.id,actor.id,'profile_updated');
end $$;
create or replace function public.encheck_account_status(p_admin_id uuid,p_active boolean,p_reason text)
returns void language plpgsql security definer set search_path=pg_catalog,public as $$
declare actor public.admins%rowtype; target public.admins%rowtype;
begin
 -- Serialize changes to prevent concurrent removal of the last active superadmin.
 perform pg_advisory_xact_lock(240102026);
 select * into strict actor from public.admins where user_id=auth.uid() and is_active and role='super_admin' for update;
 if p_active is null or p_reason is null or length(trim(p_reason)) not between 5 and 500 then raise exception 'Un motif de 5 à 500 caractères est requis.'; end if;
 select * into strict target from public.admins where id=p_admin_id for update;
 if target.id=actor.id then raise exception 'Vous ne pouvez pas suspendre votre propre compte.'; end if;
 if not p_active and target.role='super_admin' and (select count(*) from public.admins where role='super_admin' and is_active)<=1 then raise exception 'Le dernier superadmin actif doit être conservé.'; end if;
 update public.admins set is_active=p_active where id=target.id;
 insert into public.admin_account_events(actor_id,target_id,action,reason) values(actor.id,target.id,case when p_active then 'reactivated' else 'suspended' end,trim(p_reason));
end $$;
revoke all on function public.encheck_account_profile(text,text,text) from public,anon;
revoke all on function public.encheck_account_status(uuid,boolean,text) from public,anon;
grant execute on function public.encheck_account_profile(text,text,text) to authenticated;
grant execute on function public.encheck_account_status(uuid,boolean,text) to authenticated;
do $$ begin
 if exists(select 1 from storage.buckets where id='admin-avatars' and not public) then raise exception 'Le bucket admin-avatars existe en privé : migration interrompue, configuration à vérifier.'; end if;
end $$;
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values('admin-avatars','admin-avatars',true,2097152,array['image/jpeg','image/png','image/webp']) on conflict(id) do nothing;
drop policy if exists admin_avatar_insert on storage.objects;
create policy admin_avatar_insert on storage.objects for insert to authenticated with check(bucket_id='admin-avatars' and (storage.foldername(name))[1]=auth.uid()::text and exists(select 1 from public.admins where user_id=auth.uid() and is_active));
drop policy if exists admin_avatar_delete on storage.objects;
create policy admin_avatar_delete on storage.objects for delete to authenticated using(bucket_id='admin-avatars' and (storage.foldername(name))[1]=auth.uid()::text);
-- Protect the last superadmin even through older management paths.
create or replace function public.encheck_guard_last_superadmin()
returns trigger language plpgsql security definer set search_path=pg_catalog,public as $$
begin
 if old.role='super_admin' and old.is_active and
   (tg_op='DELETE' or new.role is distinct from 'super_admin' or new.is_active is distinct from true) then
   perform pg_advisory_xact_lock(240102026);
   if (select count(*) from public.admins where role='super_admin' and is_active)<=1 then
     raise exception 'Le dernier superadmin actif doit être conservé.';
   end if;
 end if;
 if tg_op='DELETE' then return old; end if;
 return new;
end $$;
revoke all on function public.encheck_guard_last_superadmin() from public,anon,authenticated;
drop trigger if exists encheck_last_superadmin on public.admins;
create trigger encheck_last_superadmin before update or delete on public.admins for each row execute function public.encheck_guard_last_superadmin();
commit;
