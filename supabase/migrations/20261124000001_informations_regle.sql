-- ✉️ LE DEVOIR D'INFORMER (§3.5.g) — l'information est un ENREGISTREMENT, pas un bandeau
--
-- CE QUE CE FICHIER APPORTE (G5-bis)
--   Une exception personnelle n'est acceptable que si elle est visible par ceux
--   qu'elle concerne. « Toujours informer » ne veut pas dire « afficher un
--   message qui disparaît » : il faut pouvoir prouver, des mois plus tard, que
--   la personne a été informée, de quoi, et quand.
--
--   Trois événements sont donc écrits par la RPC elle-même, jamais par l'écran :
--     1. une valeur personnelle est POSÉE            → l'employé concerné ;
--     2. une valeur personnelle est VERROUILLÉE      → l'employé concerné ;
--     3. une valeur personnelle est RETIRÉE          → l'employé concerné ;
--     4. une règle d'entreprise change et un réglage
--        personnel verrouillé n'est PAS concerné     → l'employé qui le garde.
--
--   Pourquoi dans `encheck_regle_ecrire` et pas dans le service ? Parce qu'un
--   écran peut oublier. Une écriture qui n'informe pas est exactement le défaut
--   que l'audit reproche ; la seule façon de ne pas l'oublier est de ne pas
--   pouvoir écrire sans informer.
--
-- CE QUE CE FICHIER NE FAIT PAS
--   · aucune notification envoyée (ni courriel, ni SMS) : on enregistre le fait
--     d'avoir émis l'information, on ne prétend pas qu'elle a été lue ;
--   · `consulte_le` reste NULL tant que personne ne l'a marquée consultée — et
--     aucun écran d'administration ne peut le faire à la place de l'employé ;
--   · aucune information n'est inventée : si l'origine est inconnue, la phrase
--     ne fabrique pas d'auteur.
--
-- ⚠️ Aucun montant de paie n'est touché.

-- ─────────────────────────────────────────────────────────────────────────────
--  1) La table — une information émise, avec son destinataire et sa date
-- ─────────────────────────────────────────────────────────────────────────────

create table if not exists public.encheck_informations_regle (
  id uuid primary key default gen_random_uuid(),
  entreprise_id uuid not null,
  --  Le destinataire. Non nul : une information s'adresse à quelqu'un.
  employe_id uuid not null,
  cle text not null,
  evenement text not null,
  --  Le TEXTE ÉMIS, figé. On ne le recalcule pas à l'affichage : ce qui a été
  --  dit le jour J ne doit pas changer parce qu'une règle a bougé depuis.
  contenu text not null,
  valeur_avant numeric null,
  valeur_apres numeric null,
  valeur_entreprise numeric null,
  date_effet date not null,
  regle_id uuid null,
  emis_le timestamptz not null default now(),
  emis_par uuid null,
  consulte_le timestamptz null,
  constraint encheck_informations_regle_evenement check (
    evenement in (
      'valeur_personnelle_posee',
      'valeur_personnelle_verrouillee',
      'valeur_personnelle_retiree',
      'reglage_personnel_conserve'
    )
  )
);

create index if not exists encheck_informations_regle_destinataire_idx
  on public.encheck_informations_regle (entreprise_id, employe_id, emis_le desc);

alter table public.encheck_informations_regle enable row level security;

drop policy if exists encheck_informations_regle_lecture on public.encheck_informations_regle;
create policy encheck_informations_regle_lecture on public.encheck_informations_regle
  for select to authenticated
  using (public.admin_has_access_to_enterprise(entreprise_id));

--  Écriture : AUCUNE politique. Une information ne s'écrit que par la RPC
--  d'écriture des règles : on ne peut ni la fabriquer, ni la corriger après coup.
revoke insert, update, delete on public.encheck_informations_regle from anon, authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
--  2) La phrase — une seule source pour ce qui est dit
-- ─────────────────────────────────────────────────────────────────────────────

--  Nombre lisible : « 11 », « 11.5 », jamais « 11.00 ».
create or replace function public.encheck_informations_nombre(p_valeur numeric)
returns text
language sql
immutable
set search_path = pg_catalog, public
as $$
  --  `to_char` d'un nombre entier rend « 45. » : on retire le point et les
  --  zéros de queue pour dire « 45 », « 11.5 », jamais « 45. » ni « 11.50 ».
  select case
    when p_valeur is null then null
    else regexp_replace(
           regexp_replace(to_char(p_valeur, 'FM999999990.99'), '0+$', ''),
           '\.$', ''
         )
  end;
$$;

create or replace function public.encheck_informations_libelle(p_cle text)
returns text
language sql
immutable
set search_path = pg_catalog, public
as $$
  select case p_cle
    when 'repos_minimum_heures' then 'repos entre deux journées'
    when 'alerte_hebdo_heures' then 'seuil d’alerte hebdomadaire'
    when 'alerte_hebdo_niveau2_heures' then 'second niveau d’alerte'
    else p_cle
  end;
$$;

--  Ce que dit l'information. Aucune de ces phrases ne prétend à une obligation :
--  ce sont des paramètres d'entreprise et des décisions nominatives (D5).
create or replace function public.encheck_informations_phrase(
  p_cle text,
  p_evenement text,
  p_avant numeric,
  p_apres numeric,
  p_entreprise numeric,
  p_date date
)
returns text
language sql
immutable
set search_path = pg_catalog, public
as $$
  with mots as (
    select
      public.encheck_informations_libelle(p_cle) as libelle,
      public.encheck_informations_nombre(p_avant) as avant,
      public.encheck_informations_nombre(p_apres) as apres,
      public.encheck_informations_nombre(p_entreprise) as entreprise,
      to_char(p_date, 'DD/MM/YYYY') as jour
  )
  select case p_evenement
    when 'valeur_personnelle_posee' then
      format('Le réglage personnel « %s » est fixé à %s h à compter du %s. %s',
        mots.libelle, mots.apres, mots.jour,
        case when mots.entreprise is null
          then 'Aucune valeur d’entreprise n’est enregistrée pour ce réglage.'
          else format('La règle de l’entreprise prévoit %s h.', mots.entreprise)
        end)
    when 'valeur_personnelle_verrouillee' then
      format('Le réglage personnel « %s » est fixé à %s h et verrouillé à compter du %s. %s Seul un super-administrateur peut désormais le modifier.',
        mots.libelle, mots.apres, mots.jour,
        case when mots.entreprise is null
          then 'Aucune valeur d’entreprise n’est enregistrée pour ce réglage.'
          else format('La règle de l’entreprise prévoit %s h.', mots.entreprise)
        end)
    when 'valeur_personnelle_retiree' then
      format('Le réglage personnel « %s » est retiré à compter du %s. %s',
        mots.libelle, mots.jour,
        case when mots.entreprise is null
          then 'Aucune valeur d’entreprise n’est enregistrée : plus aucune valeur ne s’applique à ce réglage.'
          else format('La règle de l’entreprise s’applique désormais : %s h.', mots.entreprise)
        end)
    when 'reglage_personnel_conserve' then
      format('La règle de l’entreprise du « %s » est passée à %s h au %s. Votre réglage personnel de %s h reste applicable : il est verrouillé.',
        mots.libelle, mots.entreprise, mots.jour, mots.avant)
    else null
  end
  from mots;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
--  3) L'écriture des règles émet l'information — on ne peut pas l'oublier
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
  v_avant numeric;
  v_entreprise numeric;
  v_evenement text;
  v_contenu text;
  v_emp record;
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
      raise exception 'le verrou ne s’applique qu’a une valeur personnelle' using errcode = '22023';
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
      raise exception 'valeur personnelle verrouillee : la regle d’entreprise ne peut pas la remplacer'
        using errcode = '42501';
    end if;
  end if;

  --  Ce qui s'appliquait AVANT l'écriture : c'est ce que l'information doit dire.
  v_entreprise := public.encheck_regles_tt_valeur(p_entreprise, null, p_cle, p_date_effet);
  v_avant := case
    when p_employe is null then v_entreprise
    else public.encheck_regles_tt_valeur(p_entreprise, p_employe, p_cle, p_date_effet)
  end;

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

  --  ── Le devoir d'informer (§3.5.g) ───────────────────────────────────────
  if p_employe is not null then
    v_evenement := case
      when p_valeur is null then 'valeur_personnelle_retiree'
      when coalesce(p_verrouille, false) then 'valeur_personnelle_verrouillee'
      else 'valeur_personnelle_posee'
    end;

    v_contenu := public.encheck_informations_phrase(
      p_cle, v_evenement, v_avant, p_valeur, v_entreprise, p_date_effet
    );

    insert into public.encheck_informations_regle
      (entreprise_id, employe_id, cle, evenement, contenu,
       valeur_avant, valeur_apres, valeur_entreprise, date_effet, regle_id, emis_par)
    values
      (p_entreprise, p_employe, p_cle, v_evenement, v_contenu,
       v_avant, p_valeur, v_entreprise, p_date_effet, v_nouvel_id, v_admin);
  else
    --  Une règle d'entreprise n'atteint pas un réglage verrouillé : la personne
    --  qui le garde doit l'apprendre. Et l'administrateur ne doit pas croire
    --  avoir tout changé — c'est l'aperçu d'impact qui le lui dit, avant.
    for v_emp in
      select distinct r.employe_id
      from public.encheck_regles_temps_travail r
      where r.entreprise_id = p_entreprise
        and r.cle = p_cle
        and r.employe_id is not null
    loop
      if public.encheck_regles_tt_personnelle_verrouillee(
           p_entreprise, v_emp.employe_id, p_cle, p_date_effet) then
        insert into public.encheck_informations_regle
          (entreprise_id, employe_id, cle, evenement, contenu,
           valeur_avant, valeur_apres, valeur_entreprise, date_effet, regle_id, emis_par)
        values (
          p_entreprise, v_emp.employe_id, p_cle, 'reglage_personnel_conserve',
          public.encheck_informations_phrase(
            p_cle, 'reglage_personnel_conserve',
            public.encheck_regles_tt_valeur(p_entreprise, v_emp.employe_id, p_cle, p_date_effet),
            null, p_valeur, p_date_effet
          ),
          public.encheck_regles_tt_valeur(p_entreprise, v_emp.employe_id, p_cle, p_date_effet),
          null, p_valeur, p_date_effet, v_nouvel_id, v_admin
        );
      end if;
    end loop;
  end if;

  return v_nouvel_id;
end;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
--  4) La lecture — ce qui a été dit à cette personne
-- ─────────────────────────────────────────────────────────────────────────────

create or replace function public.encheck_informations_regle(
  p_entreprise uuid,
  p_employe uuid
)
returns table (
  id uuid,
  cle text,
  evenement text,
  contenu text,
  valeur_avant numeric,
  valeur_apres numeric,
  valeur_entreprise numeric,
  date_effet date,
  emis_le timestamptz,
  emis_par uuid,
  consulte_le timestamptz
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
    select i.id, i.cle, i.evenement, i.contenu,
           i.valeur_avant, i.valeur_apres, i.valeur_entreprise,
           i.date_effet, i.emis_le, i.emis_par, i.consulte_le
    from public.encheck_informations_regle i
    where i.entreprise_id = p_entreprise
      and i.employe_id = p_employe
    order by i.emis_le desc, i.id desc;
end;
$$;

revoke all on function
  public.encheck_informations_nombre(numeric),
  public.encheck_informations_libelle(text),
  public.encheck_informations_phrase(text, text, numeric, numeric, numeric, date),
  public.encheck_informations_regle(uuid, uuid)
from public;

grant execute on function
  public.encheck_informations_nombre(numeric),
  public.encheck_informations_libelle(text),
  public.encheck_informations_phrase(text, text, numeric, numeric, numeric, date),
  public.encheck_informations_regle(uuid, uuid)
to authenticated, service_role;

comment on table public.encheck_informations_regle is
  'Informations émises vers un employé quand un réglage personnel est posé, verrouillé ou retiré (§3.5.g). Écrites par la RPC d’écriture seulement : preuve d’émission, jamais de réécriture.';
comment on column public.encheck_informations_regle.contenu is
  'Le texte exact qui a été émis, figé. Il n’est pas recalculé à l’affichage : ce qui a été dit ne change pas quand une règle change.';
comment on column public.encheck_informations_regle.consulte_le is
  'NULL = non consultée. Aucun administrateur ne peut cocher cette date à la place de l’employé.';
