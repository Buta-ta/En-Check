-- Explicit operator step, NOT an automatic migration.
-- Deploy all five legacy Edge guards + client first. Review business RPCs,
-- embedded computed fields, views and policies using the inventory script.
-- This enables ASSIGNMENT, not an authorization bypass or a rollback switch.
begin;
do $$ declare blockers text[]; begin
 if to_regprocedure('public.encheck_custom_roles_blockers()') is null then raise exception 'Migration des permissions absente.'; end if;
 blockers:=public.encheck_custom_roles_blockers();
 if cardinality(blockers)>0 then raise exception 'Activation refusée : %',blockers; end if;
 update public.admin_permission_settings set enabled=true where singleton;
 if not found then raise exception 'Paramètres de permissions absents.'; end if;
end $$;
commit;
