-- ⏰ « M'alerter au-delà de ce seuil » : une case, distincte de la valeur
--
-- DÉCISION DU FONDATEUR (24/10/2026)
--   Le seuil et l'alerte ne sont pas la même chose. Un seuil sert aussi à
--   pré-remplir un contrat, un formulaire, une simulation ; il ne dit pas
--   « prévenez-moi quand on le dépasse ». L'alerte est donc une activation
--   EXPLICITE, et elle n'est jamais déduite d'une valeur.
--
-- POURQUOI `default false`
--   Parce qu'une alerte est une affirmation adressée à quelqu'un. On ne
--   l'invente pas : ni à partir du défaut produit (48 h), ni à partir d'un
--   seuil hérité de l'ancien `|| 48`, ni en supposant que « qui a saisi 45 h
--   voulait être prévenu ». Les entreprises existantes démarrent donc en
--   silence et confirment la case en connaissance de cause.
--
-- ⚠️ AUCUN MONTANT N'EST TOUCHÉ : cette colonne ne sert qu'au contrôle du temps
--    de travail, jamais au calcul de la paie.
--
-- ⚠️ CONSTAT DE REPRODUCTIBILITÉ
--    `overtime_settings` n'a AUCUNE migration de création dans ce dépôt : la
--    table n'existe qu'en base. Ce fichier est donc écrit pour être inoffensif
--    même si la table manque (rejeu sur une base neuve), et le manque est
--    consigné dans docs/PLAN-REGLAGES-TEMPS-TRAVAIL.md (G3 remplace la table).

do $$
begin
  if to_regclass('public.overtime_settings') is null then
    raise notice 'overtime_settings absente : colonne alerte_hebdo_activee non créée (rien à migrer)';
    return;
  end if;

  --  Idempotent : rejouable sans erreur.
  alter table public.overtime_settings
    add column if not exists alerte_hebdo_activee boolean not null default false;

  comment on column public.overtime_settings.alerte_hebdo_activee is
    'Activation EXPLICITE de l''alerte de dépassement hebdomadaire. Jamais déduite d''un seuil ni d''un défaut produit. N''affecte aucun montant de paie.';
end
$$;
