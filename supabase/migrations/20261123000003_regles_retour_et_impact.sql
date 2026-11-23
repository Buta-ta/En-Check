-- ⏰ RETOUR À LA RÈGLE D'ENTREPRISE + APERÇU D'IMPACT (G5)
--
-- DEUX MANQUES comblés ici, tous les deux découverts en construisant la fiche
-- employé :
--
-- 1. LE RETOUR À L'ENTREPRISE n'avait aucune expression.
--    Les trois états promis (§3.5) sont `suit_entreprise`, `personnelle`,
--    `personnelle_verrouillee`. Or écrire une valeur personnelle `NULL` était
--    lu comme « le plus récent gagne, valeur nulle » — donc un employé sans
--    règle du tout, et non un employé qui revient à la règle commune.
--    Désormais : une version PERSONNELLE avec `valeur IS NULL` est un
--    ABANDON explicite. Elle reste dans l'historique (on saura qu'il y a eu un
--    arrangement puis un retour), mais elle ne participe plus à la résolution.
--    ⚠️ Une valeur `NULL` au niveau ENTREPRISE garde son sens : « non
--    configuré », c'est-à-dire rien du tout.
--
-- 2. L'APERÇU D'IMPACT (protection (a) du §3.3) n'existait pas.
--    « Le plus récent gagne » a un prix : un changement d'entreprise peut
--    remplacer des valeurs personnelles plus anciennes, en silence. La RPC
--    `encheck_regle_impact` dit, AVANT d'écrire : combien d'employés changent
--    de valeur, lesquels, et lesquels sont verrouillés (donc refusés).
--
-- ⚠️ Aucun montant de paie n'est touché : ces règles ne servent qu'au contrôle
--    du temps de travail.

-- ─────────────────────────────────────────────────────────────────────────────
--  1) Résolution : l'abandon personnel ne participe plus
-- ─────────────────────────────────────────────────────────────────────────────

--  Obsolète : conservée pour ne rien casser si un client l'appelle encore.
create or replace function public.encheck_regles_tt_personnelle_abandonnee(
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
  --  Un employé est « revenu à l'entreprise » quand sa dernière version
  --  personnelle applicable est une valeur NULL : c'est un acte, pas un oubli.
  select coalesce((
    select a.valeur is null
    from public.encheck_regles_temps_travail a
    where a.entreprise_id = p_entreprise
      and a.cle = p_cle
      and a.employe_id = p_employe
      and a.employe_id is not null
      and a.date_effet <= p_date
    order by a.date_effet desc, a.maj_le desc, a.id desc
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
    --  Un ABANDON personnel annule TOUTES ses versions personnelles antérieures :
    --  sinon l'ancienne valeur, plus récente que la règle d'entreprise, resterait
    --  gagnante et le retour ne changerait rien.
    and not (r.employe_id is not null
             and public.encheck_regles_tt_personnelle_abandonnee(p_entreprise, p_employe, p_cle, p_date))
  order by
    r.date_effet desc,
    r.maj_le desc,
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
      --  Le retour à l'entreprise est un acte : il annule les versions
      --  personnelles antérieures, il ne se contente pas de les suivre.
      and not (r.employe_id is not null
               and public.encheck_regles_tt_personnelle_abandonnee(p_entreprise, p_employe, p_cle, p_date))
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
--  2) Aperçu d'impact : ce que le changement va remplacer, nommé
-- ─────────────────────────────────────────────────────────────────────────────

create or replace function public.encheck_regle_impact(
  p_entreprise uuid,
  p_cle text,
  p_valeur numeric,
  p_date date default current_date
)
returns jsonb
language plpgsql
stable
security definer
set search_path = pg_catalog, public
as $$
declare
  v_employes int := 0;
  v_changes int := 0;
  v_verrouilles int := 0;
  v_details jsonb := '[]'::jsonb;
  v_emp record;
  v_actuelle numeric;
begin
  if not public.admin_has_access_to_enterprise(p_entreprise) then
    raise exception 'acces refuse a cette entreprise' using errcode = '42501';
  end if;

  --  Tous les employés qui ont DÉJÀ une règle applicable (entreprise ou
  --  personnelle) sont concernés par un changement d'entreprise.
  for v_emp in
    select distinct r.employe_id
    from public.encheck_regles_temps_travail r
    where r.entreprise_id = p_entreprise
      and r.cle = p_cle
      and r.employe_id is not null
      and r.date_effet <= p_date
  loop
    v_employes := v_employes + 1;

    v_actuelle := public.encheck_regles_tt_valeur(p_entreprise, v_emp.employe_id, p_cle, p_date);

    if v_actuelle is distinct from p_valeur then
      v_changes := v_changes + 1;

      if public.encheck_regles_tt_personnelle_verrouillee(p_entreprise, v_emp.employe_id, p_cle, p_date) then
        v_verrouilles := v_verrouilles + 1;
      end if;

      v_details := v_details || jsonb_build_object(
        'employe_id', v_emp.employe_id,
        'valeur_actuelle', v_actuelle,
        'nouvelle_valeur', p_valeur,
        'verrouillee', public.encheck_regles_tt_personnelle_verrouillee(p_entreprise, v_emp.employe_id, p_cle, p_date)
      );
    end if;
  end loop;

  return jsonb_build_object(
    'employes_concernes', v_employes,
    'valeurs_changees', v_changes,
    'dont_verrouillees', v_verrouilles,
    --  `true` = l'écriture sera refusée tant qu'un super-admin n'a pas levé
    --  les verrous : l'écran doit le dire AVANT, pas après l'erreur.
    'ecriture_bloquee', v_verrouilles > 0 and not public.encheck_est_super_admin(),
    'details', v_details
  );
end;
$$;

revoke all on function
  public.encheck_regles_tt_personnelle_abandonnee(uuid, uuid, text, date),
  public.encheck_regle_impact(uuid, text, numeric, date)
from public;
grant execute on function
  public.encheck_regles_tt_personnelle_abandonnee(uuid, uuid, text, date),
  public.encheck_regle_impact(uuid, text, numeric, date)
to authenticated, service_role;

comment on function public.encheck_regle_impact(uuid, text, numeric, date) is
  'Aperçu d''impact avant écriture : combien d''employés changent de valeur, lesquels, et lesquels sont verrouillés. Protection (a) du §3.3.';
