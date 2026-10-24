-- ═══════════════════════════════════════════════════════════
-- 🔌 LES TABLES QUI MANQUAIENT À LA PUBLICATION TEMPS RÉEL
--
-- Pourquoi cette migration existe
-- ───────────────────────────────────────────────────────────
-- Un écran ne reçoit les changements d'une table que si elle
-- figure dans la publication `supabase_realtime`. Trois tables
-- n'y étaient pas :
--
--   · encheck_pauses   → arrivée avec les pauses intelligentes
--     (20261016000004), elle n'a jamais été ajoutée.
--   · messages_systeme → la bannière de messages ne se mettait
--     jamais à jour sans recharger.
--
-- ⚠️ CE QUI REND CE DÉFAUT SILENCIEUX
--    L'écran Pointages ouvrait UN SEUL canal avec DEUX
--    abonnements. Sur Supabase, l'abonnement se négocie en bloc :
--    si une seule des tables n'est pas publiée, le serveur refuse
--    le canal ENTIER. Les pointages (`attendances`, pourtant bien
--    publiée) cessèrent donc aussi d'arriver — et, comme le code
--    n'écoutait pas l'état de l'abonnement, personne ne le voyait.
--
--    Le correctif côté application (un canal par table + écoute de
--    l'état) est livré en même temps. Cette migration-ci traite la
--    cause : les tables existent et sont publiées.
--
-- Coût : zéro. La publication ne copie rien, elle désigne les
-- tables dont les changements sont diffusés. Aucune réécriture,
-- aucun redémarrage.
--
-- Réversible : `alter publication supabase_realtime drop table …`.
-- (À noter : `drop table public.encheck_pauses` est une SUPPRESSION
--  de données, ce n'est pas la même chose — ne pas confondre.)
-- ═══════════════════════════════════════════════════════════

do $$
declare
  t text;
begin
  foreach t in array array['encheck_pauses', 'messages_systeme']
  loop
    -- la table existe-t-elle ?
    if not exists (
      select 1
      from pg_class c
      join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'public' and c.relname = t and c.relkind = 'r'
    ) then
      raise notice 'Table %.% absente — rien à publier.', 'public', t;
      continue;
    end if;

    -- déjà publiée ? alors on ne fait rien (la migration est rejouable)
    if exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime'
        and schemaname = 'public'
        and tablename = t
    ) then
      raise notice 'Table %.% déjà publiée.', 'public', t;
      continue;
    end if;

    execute format('alter publication supabase_realtime add table public.%I', t);
    raise notice 'Table %.% publiée.', 'public', t;
  end loop;
end
$$;

-- ── Contrôle ────────────────────────────────────────────────
-- Les deux tables doivent apparaître ici :
--   select tablename from pg_publication_tables
--   where pubname = 'supabase_realtime' and schemaname = 'public'
--   order by 1;
