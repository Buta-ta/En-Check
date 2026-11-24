-- ⏰ L'ACTIVATION DE L'ALERTE ENTRE DANS L'HISTOIRE (G5-bis)
--
-- LA LIMITE QUE CE FICHIER LÈVE
--   Depuis G1/G6, le seuil d'alerte vit dans `encheck_regles_temps_travail` :
--   on sait quelle valeur s'applique et depuis quand. Mais l'ACTIVATION —
--   « m'alerter au-delà de ce seuil » — restait une colonne booléenne de
--   `overtime_settings`, écrasée à chaque sauvegarde. Conséquence mesurée :
--   on ne pouvait pas dire QUI a coché la case, ni QUAND, ni si elle l'était
--   le mois dernier. C'est exactement le défaut que G3 corrige pour les
--   valeurs, laissé ouvert pour l'activation.
--
-- CE QUE CE FICHIER FAIT — ET RIEN DE PLUS
--   1. `alerte_hebdo_activee` devient une clé de la table versionnée. La case
--      n'est plus un booléen posé dans un formulaire : c'est une VERSION, avec
--      auteur, date d'effet et historique. 1 = activée, 0 = désactivée —
--      et l'absence de ligne veut dire « jamais décidé », ce qui n'est pas
--      « désactivé » : le produit ne déduit rien.
--   2. La RPC `encheck_regle_ecrire` accepte cette clé, bornée à {0, 1}, et
--      REFUSE tout le reste — une activation n'est pas un nombre d'heures.
--   3. Une fonction de lecture dédiée rend l'état d'activation avec son auteur
--      et sa date, pour que l'écran puisse dire « activée le 3 novembre par … ».
--
-- ⚠️ LE BRANCHEMENT DU MOTEUR EST UN PAS DISTINCT
--    `hoursCalculator` continue de lire `overtime_settings.alerte_hebdo_activee`
--    tant que le pas suivant n'est pas fait. Aucun calcul de paie ne change,
--    aucun client ne voit son alerte bouger.
--
-- ⚠️ AUCUNE VALEUR N'EST PRÉSENTÉE COMME LÉGALE. L'activation est un choix
--    d'entreprise ; le seuil qu'elle surveille non plus (D5).

-- ─────────────────────────────────────────────────────────────────────────────
--  1. La clé entre dans la contrainte
-- ─────────────────────────────────────────────────────────────────────────────

--  On remplace la contrainte au lieu d'en ajouter une seconde : deux
--  contraintes sur la même colonne, et c'est la plus permissive qui gagne
--  silencieusement. Une seule liste, un seul endroit à relire.
alter table public.encheck_regles_temps_travail
  drop constraint if exists encheck_regles_tt_cle;

alter table public.encheck_regles_temps_travail
  add constraint encheck_regles_tt_cle check (
    cle in (
      'repos_minimum_heures',
      'alerte_hebdo_heures',
      'alerte_hebdo_niveau2_heures',
      'declenchement_paie_hebdo_heures',
      'plafond_legal_heures',
      --  G5-bis : la case « m'alerter » a maintenant une histoire.
      'alerte_hebdo_activee'
    )
  );

--  ⚠️ `0` EST UNE VALEUR LÉGITIME POUR CETTE CLÉ, ET SEULEMENT POUR ELLE.
--  Partout ailleurs, zéro voudrait dire « supprimer le contrôle » — d'où le
--  plancher général (`valeur > 0`). Ici, zéro veut dire « désactivée », qui est
--  un acte positif et tracé. Une seule exception, nommée, plutôt qu'un plancher
--  affaibli pour tout le monde.
alter table public.encheck_regles_temps_travail
  drop constraint if exists encheck_regles_tt_valeur;
alter table public.encheck_regles_temps_travail
  add constraint encheck_regles_tt_valeur check (
    (cle = 'alerte_hebdo_activee' and (valeur is null or valeur in (0, 1)))
    or (cle <> 'alerte_hebdo_activee' and (valeur is null or valeur > 0))
  );

-- ─────────────────────────────────────────────────────────────────────────────
--  2. L'écriture — sur-ensemble strict de la version précédente
-- ─────────────────────────────────────────────────────────────────────────────

--  ⚠️⚠️ CE CORPS N'EST PAS UNE RÉÉCRITURE, C'EST UN AJOUT.
--  Recréer cette fonction depuis la version d'origine lui a un jour retiré
--  l'émission `encheck_informations_regle` du §3.5.g — une régression
--  silencieuse, invisible aux tests de la migration seule. Le corps ci-dessous
--  reprend TOUT ce que faisait la version précédente, puis ajoute la branche
--  d'activation. Garde permanente : la migration est jouée APRÈS `0001` dans
--  `reglesTempsTravailSql.test.js`, qui vérifie toujours l'émission (37 tests).
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

  --  ⚠️ L'ACTIVATION N'EST PAS UN NOMBRE D'HEURES (G5-bis) : 0 y est une
  --  valeur légitime (« désactivée »), et null n'en est pas une. Elle se
  --  contrôle donc AVANT la règle générale « une valeur nulle ne règle rien »,
  --  et ne se personnalise pas : une alerte est un contrôle d'entreprise, la
  --  laisser nominative reviendrait à permettre à chacun de s'y soustraire.
  if p_cle = 'alerte_hebdo_activee' then
    if coalesce(p_valeur, -1) not in (0, 1) then
      raise exception 'l''activation de l''alerte vaut 0 ou 1, pas %', p_valeur using errcode = '22023';
    end if;
    if p_employe is not null then
      raise exception 'l''activation de l''alerte est une decision d''entreprise : elle ne se personnalise pas'
        using errcode = '22023';
    end if;
    if coalesce(p_verrouille, false) then
      raise exception 'le verrou ne s''applique qu''a une valeur personnelle' using errcode = '22023';
    end if;
  elsif p_valeur is not null and p_valeur <= 0 then
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
  if p_valeur is not null and p_cle <> 'alerte_hebdo_activee' then
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
    --
    --  ⚠️ L'ACTIVATION N'ÉMET AUCUNE INFORMATION : elle ne retire à personne un
    --  réglage personnel. Elle est tracée par sa propre version (auteur, date),
    --  et l'écran de l'employé la lit par `encheck_activation_alerte`. Émettre
    --  ici un message « votre réglage a changé » serait faux : rien de personnel
    --  n'a bougé.
    if p_cle <> 'alerte_hebdo_activee' then
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
  end if;

  return v_nouvel_id;
end;
$$;

revoke all on function public.encheck_regle_ecrire(uuid, uuid, text, numeric, date, boolean) from public;
grant execute on function public.encheck_regle_ecrire(uuid, uuid, text, numeric, date, boolean)
  to authenticated, service_role;

-- ─────────────────────────────────────────────────────────────────────────────
--  3. La lecture : l'état d'activation, avec son auteur et sa date
-- ─────────────────────────────────────────────────────────────────────────────

--  Pourquoi une fonction dédiée alors que `encheck_regle_resolue` sait déjà
--  rendre n'importe quelle clé : parce que l'activation se lit SANS employé et
--  se répond en trois mots à l'écran (« activée », « désactivée », « jamais
--  décidée »), et qu'un booléen nullable n'a pas la même lecture qu'un nombre
--  d'heures. On garde la traduction en français côté base, là où on ne peut pas
--  la contourner, et l'écran ne fait que l'afficher.
--
--  ⚠️ AVERTISSEMENT SUR `encheck_regle_resolue` ET LES VALEURS À ZÉRO.
--  La fonction de résolution d'origine écarte les valeurs nulles et ne rend que
--  des nombres positifs. L'activation à 0 (« désactivée ») ne se lit donc PAS
--  par elle : c'est précisément pour cela que la lecture ci-dessous interroge
--  la table directement. Ne pas « simplifier » en la remplaçant par
--  `encheck_regle_resolue` : on perdrait le seul état qui dit « non ».
create or replace function public.encheck_activation_alerte(
  p_entreprise uuid,
  p_date date default current_date
)
returns table (
  active boolean,
  etat text,
  depuis date,
  maj_par uuid,
  maj_le timestamptz,
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

  select r.* into v_ligne
  from public.encheck_regles_temps_travail r
  where r.entreprise_id = p_entreprise
    and r.cle = 'alerte_hebdo_activee'
    and r.employe_id is null
    and r.date_effet <= p_date
  order by r.date_effet desc, r.maj_le desc, r.id desc
  limit 1;

  if not found then
    --  « jamais décidée » n'est PAS « désactivée » : le premier dit qu'aucun
    --  humain ne s'est prononcé, le second qu'un humain a dit non. Confondre
    --  les deux, c'est prêter un acte à personne.
    return query select null::boolean, 'jamais_decidee'::text, null::date, null::uuid, null::timestamptz, null::uuid;
    return;
  end if;

  return query select
    (v_ligne.valeur = 1),
    case when v_ligne.valeur = 1 then 'activee' else 'desactivee' end,
    v_ligne.date_effet,
    v_ligne.maj_par,
    v_ligne.maj_le,
    v_ligne.id;
end;
$$;

revoke all on function public.encheck_activation_alerte(uuid, date) from public;
grant execute on function public.encheck_activation_alerte(uuid, date) to authenticated, service_role;

comment on function public.encheck_activation_alerte(uuid, date) is
  'État de l''activation de l''alerte hebdomadaire : activee / desactivee / jamais_decidee, avec l''auteur et la date de l''acte. Ne lit PAS overtime_settings.';
