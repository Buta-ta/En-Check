-- ═══════════════════════════════════════════════════════════════════════════
-- CALCUL FIGÉ — le bulletin d'hier ne doit pas changer demain
--
--  Aujourd'hui, `calculateEmployeeHours` recalcule tout à chaque affichage :
--  les heures du mois dernier dépendent donc des badges, des seuils et des
--  taux tels qu'ils sont MAINTENANT. Corriger un badge de mars change le
--  bulletin de mars — sans trace, sans comparaison possible.
--
--  Cette table garde une PHOTOGRAPHIE d'un calcul, accompagnée de deux
--  empreintes :
--    · empreinte_entrees  les pointages qui ont servi (identité + heure + type) ;
--    · empreinte_regles   les règles appliquées (seuils, taux horaires, fériés).
--  Si l'une des deux change, le snapshot est PÉRIMÉ — et on peut le dire,
--  au lieu de le remplacer en silence.
--
--  IMMUABILITÉ : les politiques RLS n'autorisent que SELECT et INSERT. Aucune
--  politique UPDATE ni DELETE n'existe, donc Postgres refuse les deux. Une
--  preuve qu'on peut réécrire n'est pas une preuve.
--
--  Idempotent : rejouable sans conséquence.
-- ═══════════════════════════════════════════════════════════════════════════

begin;

create table if not exists public.encheck_calcul_snapshots (
  id uuid primary key default gen_random_uuid(),
  enterprise_id uuid not null references public.enterprises(id) on delete cascade,
  employee_id uuid not null references public.employees(id) on delete cascade,
  periode_debut date not null,
  periode_fin date not null,
  -- Empreintes : ce qui a été LU et ce qui a été APPLIQUÉ.
  empreinte_entrees text not null,
  empreinte_regles text not null,
  -- Le calcul lui-même (mois, valorisation, fériés, alertes…).
  payload jsonb not null,
  total_brut numeric(14, 2),
  devise text,
  fige_le timestamptz not null default now(),
  fige_par uuid
);

-- Deux fois la même photo (mêmes entrées, mêmes règles) ne sert à rien.
create unique index if not exists encheck_calcul_snapshots_unique
  on public.encheck_calcul_snapshots (employee_id, periode_debut, periode_fin, empreinte_entrees, empreinte_regles);

-- Lecture : « le dernier calcul figé de ce salarié sur ce mois ».
create index if not exists encheck_calcul_snapshots_periode
  on public.encheck_calcul_snapshots (employee_id, periode_debut desc, fige_le desc);

comment on table public.encheck_calcul_snapshots is
  'Photographies immuables des calculs d''heures, avec empreintes des entrées et des règles.';
comment on column public.encheck_calcul_snapshots.empreinte_entrees is
  'Empreinte des pointages utilisés : si elle change, le calcul doit être refait.';
comment on column public.encheck_calcul_snapshots.empreinte_regles is
  'Empreinte des règles appliquées (seuils, taux, fériés).';

alter table public.encheck_calcul_snapshots enable row level security;

-- Rien pour anon/public ; l'application n'écrit que par INSERT.
revoke all on public.encheck_calcul_snapshots from public, anon;
grant select, insert on public.encheck_calcul_snapshots to authenticated;

drop policy if exists "calcul_snapshots_lecture" on public.encheck_calcul_snapshots;
create policy "calcul_snapshots_lecture" on public.encheck_calcul_snapshots
  for select to authenticated
  using (admin_has_access_to_enterprise(enterprise_id));

drop policy if exists "calcul_snapshots_creation" on public.encheck_calcul_snapshots;
create policy "calcul_snapshots_creation" on public.encheck_calcul_snapshots
  for insert to authenticated
  with check (admin_has_access_to_enterprise(enterprise_id));

--  Volontairement AUCUNE politique UPDATE / DELETE : une preuve qu'on peut
--  réécrire n'est pas une preuve.

commit;
