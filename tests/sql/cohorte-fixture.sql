-- UNIQUEMENT base locale VIDE et jetable, JAMAIS Supabase production.
CREATE ROLE anon; CREATE ROLE authenticated;
CREATE TABLE public.attendances (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), employee_id uuid NOT NULL, enterprise_id uuid NOT NULL,
 check_time timestamptz NOT NULL, check_type text NOT NULL, method varchar(20) NOT NULL DEFAULT 'qr',
 is_auto_closed boolean DEFAULT false, modifie_le timestamptz, anomalie text,
 CONSTRAINT attendances_method_check CHECK (method IN ('qr','pin'))
);
CREATE TABLE public.encheck_reglages_pointage (cle text, valeur jsonb, enterprise_id uuid, commentaire text);
CREATE UNIQUE INDEX reg_global ON encheck_reglages_pointage(cle) WHERE enterprise_id IS NULL;
CREATE FUNCTION encheck_est_admin_de(uuid) RETURNS boolean LANGUAGE sql AS $$ SELECT coalesce(current_setting('test.admin',true),'true')='true' $$;
CREATE FUNCTION encheck_seuil(p_enterprise uuid,p_cle text,p_defaut numeric) RETURNS numeric LANGUAGE sql AS $$
 SELECT coalesce((SELECT (valeur #>> '{}')::numeric FROM encheck_reglages_pointage WHERE cle=p_cle AND enterprise_id=p_enterprise),
 (SELECT (valeur #>> '{}')::numeric FROM encheck_reglages_pointage WHERE cle=p_cle AND enterprise_id IS NULL),p_defaut)
$$;
