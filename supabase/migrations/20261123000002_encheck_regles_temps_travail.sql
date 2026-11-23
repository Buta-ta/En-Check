-- ⏰ RÈGLES DE TEMPS DE TRAVAIL — table versionnée, résolution, écriture contrôlée
--
-- CE QUE CE FICHIER APPORTE (constat G3)
--   Aujourd'hui, les seuils du temps de travail vivent dans `overtime_settings` :
--   une seule ligne par entreprise, écrasée à chaque sauvegarde. On ne sait donc
--   ni ce qui s'appliquait le 12 mars, ni qui a changé quoi, ni pourquoi. Et rien
--   ne permet une valeur par employé.
--
-- CE QUE CE FICHIER NE FAIT PAS — ET C'EST VOLONTAIRE
--   Il ne branche RIEN. Aucun calcul existant ne lit cette table : `hoursCalculator`,
--   la paie et les écrans continuent de fonctionner exactement comme avant.
--   Le branchement est le lot suivant, avec la garantie « aucune rupture de service ».
--
-- PRINCIPE DE RÉSOLUTION (arbitrage du fondateur, 24/10/2026)
--   Pour une clé et une date : toutes les versions dont `date_effet <= date`,
--   sur les portées entreprise / contrat / employé.
--     · gagne la `date_effet` la plus grande ;
--     · à égalité, le `maj_le` le plus grand ;
--     · à égalité, la portée la plus étroite (employé > contrat > entreprise).
--   EXCEPTION : une valeur personnelle VERROUILLÉE gagne, même contre un acte
--   d'entreprise plus récent. La levée du verrou n'est possible que par un
--   super-administrateur (§3.5.c).
--   Aucune version applicable ⇒ `aucune`. On n'invente pas un défaut ici : c'est
--   l'appelant qui décide s'il retombe sur 48 h, et il le dit.

create table if not exists public.encheck_regles_temps_travail (
  id uuid primary key default gen_random_uuid(),
  cle text not null,
  entreprise_id uuid not null,
  --  NULL = règle d'entreprise. Non nul = décision nominative.
  employe_id uuid null,
  --  Emplacement réservé : un contrat pourra porter la règle sans refonte.
  contrat_id uuid null,
  --  NULL explicite = « non configuré », distinct de « ligne absente ».
  valeur numeric null,
  date_effet date not null default current_date,
  verrouille boolean not null default false,
  maj_le timestamptz not null default now(),
  maj_par uuid null,
  --  Chaînage des versions : l'historique ne réécrit jamais une ligne.
  remplace_id uuid null references public.encheck_regles_temps_travail(id),
  constraint encheck_regles_tt_cle check (
    cle in (
      'repos_minimum_heures',
      'alerte_hebdo_heures',
      'alerte_hebdo_niveau2_heures',
      'declenchement_paie_hebdo_heures',
      'plafond_legal_heures'
    )
  ),
  --  ⚠️ Certaines clés ne se personnalisent pas (§3.5.a) : une règle de paie
  --  ne se négocie pas salarié par salarié.
  constraint encheck_regles_tt_cle_personnalisable check (
    employe_id is null
    or cle in (
      'repos_minimum_heures',
      'alerte_hebdo_heures',
      'alerte_hebdo_niveau2_heures'
    )
  ),
  --  Une valeur à zéro ne serait pas un réglage : ce serait la suppression du
  --  contrôle. Les bornes fines (24 h, 168 h) sont dans la RPC d'écriture, qui
  --  peut les expliquer en français ; ici on garde le plancher absolu.
  constraint encheck_regles_tt_valeur check (valeur is null or valeur > 0)
);

create index if not exists encheck_regles_tt_entreprise_idx
  on public.encheck_regles_temps_travail (entreprise_id, cle, date_effet)
  where employe_id is null;

create index if not exists encheck_regles_tt_employe_idx
  on public.encheck_regles_temps_travail (employe_id, cle, date_effet)
  where employe_id is not null;

alter table public.encheck_regles_temps_travail enable row level security;

--  Lecture : seulement pour qui a accès à l'entreprise.
drop policy if exists encheck_regles_tt_lecture on public.encheck_regles_temps_travail;
create policy encheck_regles_tt_lecture on public.encheck_regles_temps_travail
  for select to authenticated
  using (public.admin_has_access_to_enterprise(entreprise_id));

--  Écriture : AUCUNE politique. Une valeur ne s'écrit que par
--  `encheck_regle_ecrire`, qui contrôle les bornes et le verrou. Un client ne
--  peut donc pas « corriger » l'histoire en modifiant une ligne.
revoke insert, update, delete on public.encheck_regles_temps_travail from anon, authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
--  Résolution
-- ─────────────────────────────────────────────────────────────────────────────

--  Le verrou appartient à la valeur personnelle COURANTE, pas à son passé :
--  si un super-administrateur écrit une nouvelle valeur non verrouillée, le
--  verrou tombe à cet instant — et l'historique garde la trace de l'ancienne.
create or replace function public.encheck_regles_tt_personnelle_verrouillee(
  p_entreprise uuid,
  p_employe uuid,
  p_cle text,
  p_date date default current_date
)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  select coalesce((
    select r.verrouille
    from public.encheck_regles_temps_travail r
    where r.entreprise_id = p_entreprise
      and r.cle = p_cle
      and r.employe_id = p_employe
      and r.employe_id is not null
      and r.date_effet <= p_date
    order by r.date_effet desc, r.maj_le desc, r.id desc
    limit 1
  ), false);
$$;

create or replace function public.encheck_regles_tt_valeur(
  p_entreprise uuid,
  p_employe uuid,
  p_cle text,
  p_date date default current_date
)
returns numeric
language plpgsql
stable
security definer
set search_path = pg_catalog, public
as $$
declare
  v_valeur numeric;
begin
  --  Une valeur personnelle verrouillée passe avant tout acte plus récent.
  if public.encheck_regles_tt_personnelle_verrouillee(p_entreprise, p_employe, p_cle, p_date) then
    select r.valeur into v_valeur
    from public.encheck_regles_temps_travail r
    where r.entreprise_id = p_entreprise
      and r.cle = p_cle
      and r.employe_id = p_employe
      and r.date_effet <= p_date
    order by r.date_effet desc, r.maj_le desc, r.id desc
    limit 1;
    return v_valeur;
  end if;

  select r.valeur into v_valeur
  from public.encheck_regles_temps_travail r
  where r.entreprise_id = p_entreprise
    and r.cle = p_cle
    and (r.employe_id is null or r.employe_id = p_employe)
    and r.date_effet <= p_date
  order by
    r.date_effet desc,
    r.maj_le desc,
    --  Portée la plus étroite d'abord : employé (0) > contrat (1) > entreprise (2).
    case when r.employe_id is not null then 0
         when r.contrat_id is not null then 1
         else 2 end,
    r.id desc
  limit 1;

  return v_valeur;
end;
$$;

create or replace function public.encheck_regle_resolue(
  p_entreprise uuid,
  p_employe uuid,
  p_cle text,
  p_date date default current_date
)
returns table (
  valeur numeric,
  origine text,
  date_effet date,
  maj_par uuid,
  maj_le timestamptz,
  verrouille boolean,
  regle_id uuid
)
language plpgsql
stable
security definer
set search_path = pg_catalog, public
as $$
declare
  v_ligne public.encheck_regles_temps_travail%rowtype;
begin
  if not public.admin_has_access_to_enterprise(p_entreprise) then
    raise exception 'acces refuse a cette entreprise' using errcode = '42501';
  end if;

  --  Le verrou se teste d'abord : il est une exception à « le plus récent gagne ».
  --  Il porte sur la valeur personnelle COURANTE : une nouvelle version non
  --  verrouillée le lève de fait (l'ancienne reste dans l'historique).
  if public.encheck_regles_tt_personnelle_verrouillee(p_entreprise, p_employe, p_cle, p_date) then
    select r.* into v_ligne
    from public.encheck_regles_temps_travail r
    where r.entreprise_id = p_entreprise
      and r.cle = p_cle
      and r.employe_id = p_employe
      and r.employe_id is not null
      and r.date_effet <= p_date
    order by r.date_effet desc, r.maj_le desc, r.id desc
    limit 1;
  else
    select r.* into v_ligne
    from public.encheck_regles_temps_travail r
    where r.entreprise_id = p_entreprise
      and r.cle = p_cle
      and (r.employe_id is null or r.employe_id = p_employe)
      and r.date_effet <= p_date
    order by
      r.date_effet desc,
      r.maj_le desc,
      case when r.employe_id is not null then 0
           when r.contrat_id is not null then 1
           else 2 end,
      r.id desc
    limit 1;
  end if;

  if not found then
    --  Aucune version applicable : on le dit, on n'invente pas 48 h.
    return query select null::numeric, 'aucune'::text, null::date, null::uuid, null::timestamptz, false, null::uuid;
    return;
  end if;

  return query select
    v_ligne.valeur,
    case when v_ligne.employe_id is not null then 'employe'
         when v_ligne.contrat_id is not null then 'contrat'
         else 'entreprise' end,
    v_ligne.date_effet,
    v_ligne.maj_par,
    v_ligne.maj_le,
    v_ligne.verrouille,
    v_ligne.id;
end;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
--  Écriture — la seule porte
-- ─────────────────────────────────────────────────────────────────────────────

create or replace function public.encheck_regle_ecrire(
  p_entreprise uuid,
  p_employe uuid,
  p_cle text,
  p_valeur numeric,
  p_date_effet date default current_date,
  p_verrouille boolean default false
)
returns uuid
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_admin uuid := public.current_admin_id();
  v_precedent uuid;
  v_plafond numeric;
  v_nouvel_id uuid;
begin
  if not public.admin_has_access_to_enterprise(p_entreprise) then
    raise exception 'acces refuse a cette entreprise' using errcode = '42501';
  end if;

  if p_valeur is not null and p_valeur <= 0 then
    raise exception 'valeur invalide : une valeur nulle ou negative ne regle rien' using errcode = '22023';
  end if;

  if p_employe is not null then
    if p_cle not in ('repos_minimum_heures', 'alerte_hebdo_heures', 'alerte_hebdo_niveau2_heures') then
      raise exception 'la cle % ne se personnalise pas par employe', p_cle using errcode = '22023';
    end if;
    if not exists (
      select 1 from public.employees e
      where e.id = p_employe and e.enterprise_id = p_entreprise
    ) then
      raise exception 'employe hors de cette entreprise' using errcode = '22023';
    end if;
  end if;

  --  Bornes techniques (§3.5.a) : elles vivent ici, pas seulement à l'écran.
  if p_valeur is not null then
    if p_cle = 'repos_minimum_heures' and p_valeur > 24 then
      raise exception 'repos minimum : 24 h au plus' using errcode = '22023';
    end if;
    if p_cle in ('alerte_hebdo_heures', 'alerte_hebdo_niveau2_heures') and p_valeur > 168 then
      raise exception 'seuil hebdomadaire : 168 h au plus (une semaine)' using errcode = '22023';
    end if;
    if p_cle = 'alerte_hebdo_niveau2_heures' then
      v_plafond := public.encheck_regles_tt_valeur(p_entreprise, p_employe, 'alerte_hebdo_heures', p_date_effet);
      if v_plafond is not null and p_valeur <= v_plafond then
        raise exception 'le second niveau doit depasser le premier' using errcode = '22023';
      end if;
    end if;
  end if;

  --  ⚠️ LE VERROU EST UNE EXCEPTION À « LE PLUS RÉCENT GAGNE » (§3.5.c).
  --  Deux gestes sont réservés au super-administrateur : poser un verrou, et le
  --  lever. Un administrateur ordinaire peut écrire une valeur personnelle
  --  ordinaire — mais pas s'approprier un verrou ni en défaire un.
  if coalesce(p_verrouille, false) then
    if p_employe is null then
      raise exception 'le verrou ne s''applique qu''a une valeur personnelle' using errcode = '22023';
    end if;
    if not public.encheck_est_super_admin() then
      raise exception 'poser un verrou est reserve a un super-administrateur' using errcode = '42501';
    end if;
  end if;

  --  Lever un verrou existant, c'est écrire une nouvelle version non verrouillée
  --  sur une valeur qui l'était : interdit hors super-administrateur.
  if not coalesce(p_verrouille, false) then
    if p_employe is not null
       and public.encheck_regles_tt_personnelle_verrouillee(p_entreprise, p_employe, p_cle, p_date_effet)
       and not public.encheck_est_super_admin() then
      raise exception 'valeur personnelle verrouillee : seul un super-administrateur peut lever le verrou'
        using errcode = '42501';
    end if;
  end if;

  --  Et une valeur personnelle verrouillée n'est pas écrasée par une règle
  --  d'entreprise plus récente.
  if p_employe is null then
    if exists (
      select 1
      from (select distinct r.employe_id
            from public.encheck_regles_temps_travail r
            where r.entreprise_id = p_entreprise
              and r.cle = p_cle
              and r.employe_id is not null) e
      where public.encheck_regles_tt_personnelle_verrouillee(p_entreprise, e.employe_id, p_cle, p_date_effet)
    ) and not public.encheck_est_super_admin() then
      raise exception 'valeur personnelle verrouillee : la regle d''entreprise ne peut pas la remplacer'
        using errcode = '42501';
    end if;
  end if;

  select r.id into v_precedent
  from public.encheck_regles_temps_travail r
  where r.entreprise_id = p_entreprise
    and r.cle = p_cle
    and r.employe_id is not distinct from p_employe
  order by r.date_effet desc, r.maj_le desc, r.id desc
  limit 1;

  insert into public.encheck_regles_temps_travail
    (cle, entreprise_id, employe_id, valeur, date_effet, verrouille, maj_par, remplace_id)
  values
    (p_cle, p_entreprise, p_employe, p_valeur, p_date_effet, coalesce(p_verrouille, false), v_admin, v_precedent)
  returning id into v_nouvel_id;

  return v_nouvel_id;
end;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
--  Historique — qui, quand, avant → après
-- ─────────────────────────────────────────────────────────────────────────────

create or replace function public.encheck_regle_historique(
  p_entreprise uuid,
  p_employe uuid default null,
  p_cle text default null
)
returns table (
  id uuid,
  cle text,
  employe_id uuid,
  valeur numeric,
  date_effet date,
  verrouille boolean,
  maj_le timestamptz,
  maj_par uuid,
  remplace_id uuid
)
language plpgsql
stable
security definer
set search_path = pg_catalog, public
as $$
begin
  if not public.admin_has_access_to_enterprise(p_entreprise) then
    raise exception 'acces refuse a cette entreprise' using errcode = '42501';
  end if;

  return query
    select r.id, r.cle, r.employe_id, r.valeur, r.date_effet, r.verrouille,
           r.maj_le, r.maj_par, r.remplace_id
    from public.encheck_regles_temps_travail r
    where r.entreprise_id = p_entreprise
      and (p_employe is null or r.employe_id = p_employe)
      and (p_cle is null or r.cle = p_cle)
    order by r.date_effet desc, r.maj_le desc, r.id desc;
end;
$$;

revoke all on function
  public.encheck_regles_tt_personnelle_verrouillee(uuid, uuid, text, date),
  public.encheck_regles_tt_valeur(uuid, uuid, text, date),
  public.encheck_regle_resolue(uuid, uuid, text, date),
  public.encheck_regle_ecrire(uuid, uuid, text, numeric, date, boolean),
  public.encheck_regle_historique(uuid, uuid, text)
from public;

grant execute on function
  public.encheck_regles_tt_personnelle_verrouillee(uuid, uuid, text, date),
  public.encheck_regles_tt_valeur(uuid, uuid, text, date),
  public.encheck_regle_resolue(uuid, uuid, text, date),
  public.encheck_regle_ecrire(uuid, uuid, text, numeric, date, boolean),
  public.encheck_regle_historique(uuid, uuid, text)
to authenticated, service_role;

comment on table public.encheck_regles_temps_travail is
  'Règles de temps de travail versionnées (clé × portée × date d''effet). Écriture par RPC seulement ; aucune ligne n''est modifiée ni supprimée.';
comment on column public.encheck_regles_temps_travail.valeur is
  'NULL explicite = non configuré. Aucune de ces valeurs n''est une règle légale : ce sont des paramètres d''entreprise ou des décisions nominatives.';
