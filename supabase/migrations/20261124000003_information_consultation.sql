-- 👁️ « J'AI LU » — marquer une information consultée, depuis l'espace employé
--
-- LA LIMITE QUE CE FICHIER LÈVE
--   La migration `20261124000001` a posé le devoir d'informer : quand un réglage
--   personnel est posé, verrouillé ou retiré, la base écrit elle-même une
--   information destinée à l'employé, avec son texte figé. Mais `consulte_le`
--   restait nul pour toujours : la colonne existait, et **aucun chemin
--   d'écriture n'existait**, ni côté administrateur (c'est volontaire : on ne
--   lit pas à la place de quelqu'un) ni côté employé (l'écran n'était pas
--   branché). Une information qu'on ne peut pas marquer lue n'est pas une
--   information : c'est une trace d'émission.
--
-- CE QUE CE FICHIER FAIT — ET RIEN DE PLUS
--   1. `encheck_employe_courant()` — qui parle. La fiche employé est déduite de
--      la session (`employees.user_id = auth.uid()`), en un seul endroit.
--   2. `encheck_informations_employe()` — la lecture, côté employé. Elle ne
--      prend AUCUN identifiant : un employé ne peut donc pas lire les
--      informations d'un collègue, même en changeant un paramètre d'URL : il n'y
--      a pas de paramètre.
--   3. `encheck_information_consultee(id)` — le marquage. Trois refus, tous
--      dans la base : une information destinée à quelqu'un d'autre, un
--      identifiant inconnu, une session sans fiche employé. Et une règle : on
--      n'écrase jamais une date déjà posée — la première lecture est la bonne.
--
-- ⚠️ CE QUE CE FICHIER NE FAIT PAS
--   · aucune notification : on n'envoie rien, on enregistre un fait ;
--   · aucune information n'est créée, modifiée ni supprimée ici — le texte émis
--     reste figé, c'est le principe même (§3.5.g) ;
--   · aucun écran d'administration ne peut marquer « consultée » à la place de
--     l'employé : les fonctions ci-dessous exigent une session employé.
--
-- ⚠️ AUCUN MONTANT DE PAIE N'EST TOUCHÉ.

-- ─────────────────────────────────────────────────────────────────────────────
--  1. Qui parle ? L'employé de la session, et personne d'autre
-- ─────────────────────────────────────────────────────────────────────────────

--  Pourquoi une fonction et pas une jointure recopiée dans chaque RPC : la
--  règle « un compte = une fiche employé » doit avoir UN seul énoncé. Si demain
--  la table change de colonne, on corrige ici et nulle part ailleurs.
create or replace function public.encheck_employe_courant()
returns uuid
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  select e.id
  from public.employees e
  where e.user_id = auth.uid()
  limit 1
$$;

comment on function public.encheck_employe_courant() is
  'La fiche employé du compte connecté, ou NULL. Un compte sans fiche n''a aucun droit : on ne devine pas.';

revoke all on function public.encheck_employe_courant() from public;
grant execute on function public.encheck_employe_courant() to authenticated, service_role;

-- ─────────────────────────────────────────────────────────────────────────────
--  2. La lecture — « ce qu'on m'a dit »
-- ─────────────────────────────────────────────────────────────────────────────

create or replace function public.encheck_informations_employe()
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
  consulte_le timestamptz
)
language plpgsql
stable
security definer
set search_path = pg_catalog, public
as $$
declare
  v_employe uuid := public.encheck_employe_courant();
begin
  if v_employe is null then
    raise exception 'aucune fiche employe pour ce compte' using errcode = '42501';
  end if;

  return query
    select i.id, i.cle, i.evenement, i.contenu,
           i.valeur_avant, i.valeur_apres, i.valeur_entreprise,
           i.date_effet, i.emis_le, i.consulte_le
    from public.encheck_informations_regle i
    where i.employe_id = v_employe
    --  Les non-consultées d'abord : on lit ce qu'on n'a pas lu.
    order by i.consulte_le nulls first, i.emis_le desc, i.id desc;
end;
$$;

comment on function public.encheck_informations_employe() is
  'Les informations destinées à l''employé connecté, non consultées d''abord. Aucun identifiant en paramètre : le destinataire vient de la session.';

revoke all on function public.encheck_informations_employe() from public;
grant execute on function public.encheck_informations_employe() to authenticated, service_role;

-- ─────────────────────────────────────────────────────────────────────────────
--  3. Le marquage — « j'ai lu », une fois, et jamais à la place d'un autre
-- ─────────────────────────────────────────────────────────────────────────────

create or replace function public.encheck_information_consultee(p_information uuid)
returns timestamptz
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_employe uuid := public.encheck_employe_courant();
  v_ligne public.encheck_informations_regle%rowtype;
begin
  if v_employe is null then
    raise exception 'aucune fiche employe pour ce compte' using errcode = '42501';
  end if;

  select i.* into v_ligne
  from public.encheck_informations_regle i
  where i.id = p_information;

  if not found then
    raise exception 'information inconnue' using errcode = '22023';
  end if;

  --  Le destinataire, et lui seul. Ce contrôle est ici parce qu'un écran peut
  --  être contourné ; la base, non.
  if v_ligne.employe_id <> v_employe then
    raise exception 'cette information ne vous est pas adressee' using errcode = '42501';
  end if;

  --  La première lecture est la bonne. Un second clic ne déplace pas la date :
  --  sinon « consultée le » dirait seulement « dernier clic », et ne prouverait
  --  plus rien sur le moment où la personne a réellement découvert le texte.
  if v_ligne.consulte_le is not null then
    return v_ligne.consulte_le;
  end if;

  update public.encheck_informations_regle i
     set consulte_le = now()
   where i.id = v_ligne.id
     and i.consulte_le is null
  returning i.consulte_le into v_ligne.consulte_le;

  return v_ligne.consulte_le;
end;
$$;

comment on function public.encheck_information_consultee(uuid) is
  'Marque une information comme consultée par l''employé connecté. Refuse une information destinée à un autre, et ne déplace jamais une date déjà posée.';

revoke all on function public.encheck_information_consultee(uuid) from public;
grant execute on function public.encheck_information_consultee(uuid) to authenticated, service_role;
