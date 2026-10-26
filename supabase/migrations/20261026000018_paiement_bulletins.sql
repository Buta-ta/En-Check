-- ═══════════════════════════════════════════════════════════════════════════
-- PAIEMENT DES BULLETINS — savoir quand un salarié a réellement été payé
--
--  Jusqu'ici, `employee_payslips` savait qu'un bulletin avait été REMIS
--  (`status = 'sent'`, `sent_at`) — jamais qu'il avait été PAYÉ. Un rapport
--  de présence ne pouvait donc pas répondre à la question la plus simple
--  d'un salarié : « est-ce que j'ai été payé pour ces heures ? ».
--
--  Cette migration ajoute le seul fait qu'on ne pouvait pas déduire :
--    · paid_at            l'instant du paiement (NULL = pas encore payé) ;
--    · paid_by            l'administrateur qui l'a constaté ;
--    · payment_method     l'espèce / le canal (texte libre court, fermé à l'UI) ;
--    · payment_reference  la référence externe (transaction Mobile Money, chèque…).
--
--  Aucune donnée existante n'est touchée : toutes les fiches restent « non
--  payées » tant qu'un humain ne l'a pas constaté. Un bulletin remis n'est
--  pas un bulletin payé, et c'est exactement la distinction qu'on ajoute.
--
--  Idempotent : ADD COLUMN IF NOT EXISTS, rejouable sans conséquence.
-- ═══════════════════════════════════════════════════════════════════════════

begin;

alter table public.employee_payslips
  add column if not exists paid_at timestamptz,
  add column if not exists paid_by uuid,
  add column if not exists payment_method text,
  add column if not exists payment_reference text;

comment on column public.employee_payslips.paid_at is
  'Instant du paiement constaté par un administrateur. NULL = bulletin remis mais pas encore payé.';
comment on column public.employee_payslips.paid_by is
  'Administrateur qui a constaté le paiement.';
comment on column public.employee_payslips.payment_method is
  'Canal du paiement : espèces, mobile money, virement, chèque, autre.';
comment on column public.employee_payslips.payment_reference is
  'Référence externe du paiement (transaction, chèque, ordre de virement).';

-- Le rapport interroge les paiements d'une période : l'index suit la colonne.
create index if not exists idx_employee_payslips_paid_at
  on public.employee_payslips (enterprise_id, paid_at)
  where paid_at is not null;

-- Cohérence : une fiche payée a toujours une date, et une date n'existe que
-- si la fiche n'est pas supprimée. On ne réécrit pas l'historique, on garde
-- la contrainte souple pour ne bloquer aucune donnée existante.
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'employee_payslips_paid_at_coherent'
  ) then
    alter table public.employee_payslips
      add constraint employee_payslips_paid_at_coherent
      check (paid_at is null or paid_at > '2000-01-01'::timestamptz);
  end if;
end $$;

-- Le canal est un vocabulaire fermé : cinq mots, pas un champ libre. Une
-- faute de frappe ne doit pas créer un moyen de paiement fantôme.
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'employee_payslips_payment_method_connu'
  ) then
    alter table public.employee_payslips
      add constraint employee_payslips_payment_method_connu
      check (
        payment_method is null
        or payment_method in ('especes', 'mobile_money', 'virement', 'cheque', 'autre')
      );
  end if;
end $$;

commit;
