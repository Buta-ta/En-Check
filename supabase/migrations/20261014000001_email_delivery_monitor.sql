-- Email delivery monitoring for the superadmin console.
-- Safe to run more than once. No email is sent by this migration.

CREATE TABLE IF NOT EXISTS public.encheck_email_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  enterprise_id uuid REFERENCES public.enterprises(id) ON DELETE SET NULL,
  sujet text NOT NULL DEFAULT '',
  nb_alertes integer NOT NULL DEFAULT 0,
  destinataires text NOT NULL DEFAULT '',
  destinataires_json jsonb NOT NULL DEFAULT '[]'::jsonb,
  resultats_destinataires jsonb NOT NULL DEFAULT '[]'::jsonb,
  nb_destinataires integer NOT NULL DEFAULT 0,
  envoyes integer NOT NULL DEFAULT 0,
  echecs integer NOT NULL DEFAULT 0,
  erreur text,
  source text NOT NULL DEFAULT 'tableau_de_bord',
  duree_ms integer,
  statut text NOT NULL DEFAULT 'failed',
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  fournisseur text NOT NULL DEFAULT 'inconnu',
  provider_message_id text,
  retry_of uuid REFERENCES public.encheck_email_logs(id) ON DELETE SET NULL,
  archived_at timestamptz,
  cree_le timestamptz NOT NULL DEFAULT now()
);

-- Accommodate an earlier manually-created log table, if one already exists.
ALTER TABLE public.encheck_email_logs
  ADD COLUMN IF NOT EXISTS id uuid DEFAULT gen_random_uuid(),
  ADD COLUMN IF NOT EXISTS enterprise_id uuid,
  ADD COLUMN IF NOT EXISTS sujet text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS nb_alertes integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS destinataires text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS destinataires_json jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS resultats_destinataires jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS nb_destinataires integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS envoyes integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS echecs integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS erreur text,
  ADD COLUMN IF NOT EXISTS source text NOT NULL DEFAULT 'tableau_de_bord',
  ADD COLUMN IF NOT EXISTS duree_ms integer,
  ADD COLUMN IF NOT EXISTS statut text NOT NULL DEFAULT 'failed',
  ADD COLUMN IF NOT EXISTS payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS fournisseur text NOT NULL DEFAULT 'inconnu',
  ADD COLUMN IF NOT EXISTS provider_message_id text,
  ADD COLUMN IF NOT EXISTS retry_of uuid,
  ADD COLUMN IF NOT EXISTS archived_at timestamptz,
  ADD COLUMN IF NOT EXISTS cree_le timestamptz NOT NULL DEFAULT now();

-- Backfill the status of any rows written by the earlier sender version.
UPDATE public.encheck_email_logs
   SET statut = CASE
     WHEN envoyes > 0 AND echecs > 0 THEN 'partial'
     WHEN envoyes > 0 THEN 'accepted'
     ELSE 'failed'
   END
 WHERE statut = 'failed'
   AND (envoyes > 0 OR echecs > 0);

CREATE INDEX IF NOT EXISTS encheck_email_logs_recent_idx
  ON public.encheck_email_logs (cree_le DESC);
CREATE INDEX IF NOT EXISTS encheck_email_logs_enterprise_recent_idx
  ON public.encheck_email_logs (enterprise_id, cree_le DESC);
CREATE INDEX IF NOT EXISTS encheck_email_logs_retry_idx
  ON public.encheck_email_logs (retry_of) WHERE retry_of IS NOT NULL;

ALTER TABLE public.encheck_email_logs ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.encheck_email_logs FROM anon;
REVOKE ALL ON public.encheck_email_logs FROM authenticated;
GRANT SELECT ON public.encheck_email_logs TO authenticated;
GRANT UPDATE (archived_at) ON public.encheck_email_logs TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.encheck_email_logs TO service_role;

DROP POLICY IF EXISTS encheck_email_logs_superadmin_read ON public.encheck_email_logs;
CREATE POLICY encheck_email_logs_superadmin_read
  ON public.encheck_email_logs
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
        FROM public.admins a
       WHERE a.is_active = true
         AND a.role = 'super_admin'
         AND (
           a.user_id = auth.uid()
           OR lower(a.email) = lower(auth.jwt() ->> 'email')
         )
    )
  );

DROP POLICY IF EXISTS encheck_email_logs_superadmin_archive ON public.encheck_email_logs;
CREATE POLICY encheck_email_logs_superadmin_archive
  ON public.encheck_email_logs
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
        FROM public.admins a
       WHERE a.is_active = true
         AND a.role = 'super_admin'
         AND (
           a.user_id = auth.uid()
           OR lower(a.email) = lower(auth.jwt() ->> 'email')
         )
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
        FROM public.admins a
       WHERE a.is_active = true
         AND a.role = 'super_admin'
         AND (
           a.user_id = auth.uid()
           OR lower(a.email) = lower(auth.jwt() ->> 'email')
         )
    )
  );
