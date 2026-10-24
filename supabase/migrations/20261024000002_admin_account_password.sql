-- Requires account workspace migration and the existing password service.
-- No password is included in the audit event or returned to the browser.
begin;
create or replace function public.encheck_account_password(p_admin_id uuid,p_password text,p_reason text)
returns void language plpgsql security definer set search_path=pg_catalog,public as $$
declare actor public.admins%rowtype; target public.admins%rowtype; result jsonb; service_oid regprocedure; returns_void boolean;
begin
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
 insert into public.admin_account_events(actor_id,target_id,action,reason)
 values(actor.id,target.id,'password_changed',trim(p_reason));
end $$;
revoke all on function public.encheck_account_password(uuid,text,text) from public,anon;
grant execute on function public.encheck_account_password(uuid,text,text) to authenticated;
commit;
