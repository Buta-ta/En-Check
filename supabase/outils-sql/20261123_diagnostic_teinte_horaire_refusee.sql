-- ═══════════════════════════════════════
-- DIAGNOSTIC — « la base a refusé ma teinte (HTTP 400) »
-- ═══════════════════════════════════════
--  À copier-coller intégralement dans Supabase → SQL Editor → Run.
--
--  Le 23/11/2026, le fondateur signale : « j'essaie de modifier la couleur d'un
--  modèle appliqué à une case mais j'ai eu erreur : Failed to load resource:
--  the server responded with a status of 400 ». Un 400 dans une console de
--  navigateur ne dit pas la cause. Ce fichier la cherche là où elle peut être,
--  en six constats numérotés, et s'arrête de conclure dès qu'un constat parle.
--
--  Les causes possibles étaient au nombre de quatre, et elles se ressemblent
--  toutes depuis le poste : une valeur hors format (CHECK), une colonne que la
--  base ne connaît pas (migration non appliquée), une clé de fusion absente
--  (l'`upsert` demande UNIQUE sur `employee_id`), un droit refusé (RLS). Ce
--  diagnostic les sépare. Il ne répare rien : la réparation est du côté de la
--  page (src/services/ecritureHorairesEmploye.js) et, si le constat 2 ou 3
--  parle, de la migration à appliquer.
--
--  Lecture seule : aucune écriture, aucun UPDATE, aucun INSERT, aucune fonction
--  métier appelée, aucun effet de bord. Les sections 1 à 5 ne touchent que
--  information_schema, pg_constraint et pg_policies ; la section 6 lit la table
--  sans la modifier.
-- ═══════════════════════════════════════

-- ─── 1. Les deux colonnes de teinte sont-elles là ? ───────────────
--  `custom_color` (la teinte de l'horaire entier) et `custom_day_colors` (la
--  carte des teintes par jour) viennent de deux migrations distinctes. Si l'une
--  manque, la page qui l'écrit reçoit un 400 « Could not find the ... column »
--  — et c'est la migration qu'il faut appliquer, pas le code qu'il faut changer.
select
  c.column_name,
  c.data_type,
  c.is_nullable,
  case
    when c.column_name = 'custom_color'
      then 'attendu : text, nullable — migration 20261122000002'
    when c.column_name = 'custom_day_colors'
      then 'attendu : jsonb, nullable — migration 20261122000004'
    else 'colonne voisine, donnée pour le contexte'
  end as attendu
from information_schema.columns c
where c.table_schema = 'public'
  and c.table_name = 'employee_schedules'
order by c.ordinal_position;

-- ─── 2. La clé de fusion existe-t-elle ? ───────────────────────────
--  La page écrit avec `upsert(..., { onConflict: "employee_id" })`. Sans
--  contrainte (ou index unique) sur cette colonne, PostgREST répond 400 avec le
--  code PGRST204 — et la ligne d'horaire ne peut pas être enregistrée par ce
--  chemin, quelle que soit la valeur envoyée.
select
  coalesce(string_agg(k.conname || ' — ' || pg_get_constraintdef(k.oid), E'\n'),
            'AUCUNE contrainte sur employee_id : l''upsert de la page ne peut pas aboutir (PGRST204)')
    as contraintes_sur_employee_id
from pg_constraint k
where k.conrelid = 'public.employee_schedules'::regclass
  and k.conname ~ 'employee_id'
  and k.contype in ('u', 'p');

-- ─── 3. Les deux règles de format sont-elles posées, et lesquelles ? ─
--  Un 400 sur une teinte est le plus souvent un 23514 : la valeur n'est pas un
--  hexadécimal à six chiffres. Ce constat montre la règle TELLE QU'ELLE EST EN
--  BASE — si elle a été assouplie à la main un jour, c'est ici que ça se voit.
select
  k.conname,
  pg_get_constraintdef(k.oid) as regle_en_vigueur,
  case k.conname
    when 'employee_schedules_custom_color_chk'
      then 'teinte de l''horaire entier : #rrggbb ou NULL'
    when 'employee_schedules_custom_day_colors_chk'
      then 'carte des teintes par jour : objet dont CHAQUE valeur est #rrggbb'
    else 'autre contrainte de la table'
  end as ce_quelle_interdit
from pg_constraint k
where k.conrelid = 'public.employee_schedules'::regclass
  and k.contype = 'c'
order by k.conname;

-- ─── 4. Y a-t-il déjà, en base, une valeur que cette règle refuse ? ─
--  Le cas n'est pas théorique : une valeur écrite AVANT la contrainte (ou à la
--  main dans l'éditeur) reste là, et la moindre réécriture de la ligne repasse
--  par le contrôle — donc échoue. Une carte `[]`, un texte, un `#abc` ou un
--  `#rrggbbaa` suffisent à rendre une ligne définitivement inenregistrable.
select
  count(*) filter (
    where es.custom_color is not null
      and es.custom_color !~ '^#[0-9a-fA-F]{6}$'
  ) as teintes_ligne_hors_format,
  count(*) filter (
    where es.custom_day_colors is not null
      and jsonb_typeof(es.custom_day_colors) <> 'object'
  ) as cartes_non_objet,
  count(*) filter (
    where jsonb_path_exists(
      es.custom_day_colors,
      '$.*?(!(@ like_regex "^#[0-9a-fA-F]{6}$"))'
    )
  ) as teintes_de_case_hors_format,
  count(*) filter (where es.custom_day_colors is not null) as cartes_renseignees,
  count(*) as lignes_de_la_table,
  case
    when count(*) filter (
      where (es.custom_color is not null and es.custom_color !~ '^#[0-9a-fA-F]{6}$')
         or (es.custom_day_colors is not null and jsonb_typeof(es.custom_day_colors) <> 'object')
         or jsonb_path_exists(es.custom_day_colors, '$.*?(!(@ like_regex "^#[0-9a-fA-F]{6}$"))')
    ) = 0
      then 'RIEN À REPRENDRE : la base est propre, le 400 vient de la valeur envoyée, pas de ce qui est stocké'
    else 'REPRENDRE ICI : ces lignes ne pourront pas être réenregistrées telles quelles'
  end as verdict
from public.employee_schedules es;

-- ─── 5. Un droit refuse-t-il l'écriture ? ──────────────────────────
--  Un refus de politique de ligne se présente comme 42501 (traduit en 400 ou en
--  403 selon la version de l'API). `filtre_de_valeur` à vrai veut dire que la
--  politique peut refuser CE qu'on écrit, pas seulement ce qu'on lit : sur ce
--  projet, `encheck_mfa_obligation` et `encheck_admin_session_restrictive` ont
--  les deux filtres — une session sans MFA vérifié ou sur un canal non autorisé
--  voit donc ses écritures refusées, LECTURE COMPRIS. Si l'écran affiche bien
--  les horaires, ces deux-là laissent passer, et le 400 n'est pas un droit.
--  La dernière colonne dit si le projet utilise des rôles personnalisés : sans
--  aucun rôle, les politiques `encheck_custom_*` renvoient vrai et ne sont pas
--  en cause.
select
  p.polname as policy,
  case p.polcmd
    -- `*` est la valeur rendue par Postgres 17 pour « toutes les commandes » ;
    -- `a` reste traitée parce que les versions plus anciennes l'écrivaient.
    when 'r' then 'SELECT' when '*' then 'ALL' when 'a' then 'ALL'
    when 'w' then 'UPDATE' when 'i' then 'INSERT' when 'd' then 'DELETE'
    else p.polcmd::text
  end as commande,
  pg_get_expr(p.polqual, p.polrelid) is not null as filtre_de_lecture,
  pg_get_expr(p.polwithcheck, p.polrelid) is not null as filtre_de_valeur,
  (select count(*) from public.admin_permission_roles) as roles_personalises_crees
from pg_policy p
where p.polrelid = 'public.employee_schedules'::regclass
order by p.polname;

-- ─── 6. Ce que la page a écrit en dernier ──────────────────────────
--  Les cinq dernières lignes touchées, avec leurs teintes. C'est là qu'on voit
--  si une teinte est bien partie (`#rrggbb`), si la carte des jours porte la
--  bonne clé de date, et si un `updated_at` récent contredit le « ça n'a pas
--  marché » du poste — auquel cas l'enregistrement a réussi et le 400 vient
--  d'une AUTRE écriture de la même page.
select
  es.employee_id,
  e.matricule,
  trim(coalesce(e.first_name, '') || ' ' || coalesce(e.last_name, '')) as collaborateur,
  es.use_custom_hours,
  es.custom_start_time,
  es.custom_end_time,
  es.custom_color,
  es.custom_day_colors,
  es.updated_at
from public.employee_schedules es
left join public.employees e on e.id = es.employee_id
order by es.updated_at desc nulls last
limit 5;

-- ═══════════════════════════════════════
--  COMMENTAIRE DES CONSTATS (à lire dans l'ordre)
--
--   1. une colonne manque            → appliquer la migration nommée en face
--   2. aucune contrainte sur
--      employee_id                  → l'écriture par `upsert` est impossible :
--                                     c'est la PAGE qu'il faut changer (relire
--                                     la ligne, puis UPDATE ou INSERT), pas la
--                                     contrainte qu'il faut inventer — la table
--                                     garde un historique (`valide_du`,
--                                     `valide_au`) et n'est pas « une ligne par
--                                     collaborateur » par nature
--   3. la règle de format diffère    → la base a été modifiée à la main : la
--                                     page et la base ne parlent plus du même
--                                     format, trancher avant d'écrire
--   4. des lignes hors format        → réparer ces lignes d'abord, sinon la
--                                     moindre retouche de la ligne échouera
--   5. filtre de valeur sur UPDATE   → un refus de droit, pas un refus de format
--   6. `updated_at` récent et juste  → l'enregistrement est passé : chercher le
--                                     400 dans une autre écriture de la page
--                                     (le dépôt d'un modèle, l'approbation
--                                     d'une demande)
-- ═══════════════════════════════════════
