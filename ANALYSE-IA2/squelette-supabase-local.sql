-- ═══════════════════════════════════════════════════════════════════════════
-- SQUELETTE « SUPABASE LOCAL » — uniquement pour la fumée d'exécution
-- ═══════════════════════════════════════════════════════════════════════════
--  À quoi ça sert : faire tourner une migration EN VRAI sur un Postgres local,
--  sans toucher à la base de production. Postgres ne compile le code PL/pgSQL
--  qu'à la PREMIÈRE exécution : une migration peut donc être « appliquée sans
--  erreur » et casser quand même au premier cron. Ce fichier crée le strict
--  minimum dont une migration dépend quand elle n'est pas dans Supabase :
--    · les rôles `anon` / `authenticated` / `service_role` (les GRANT/REVOKE visent
--      ces rôles, ils doivent exister) ;
--    · `auth.jwt()`, lu par les politiques RLS — branché ici sur le réglage de
--      session `app.jwt_email` pour pouvoir SIMULER un admin puis un reader ;
--    · les tables partagées avec l'app pointage (`attendances`, `enterprises`,
--      `work_schedules`, `employee_schedules`, `encheck_alertes`, `pointages_photos`)
--      avec les seules colonnes que la migration touche.
--
--  ⚠️ JAMAIS sur la production. ⚠️ Les colonnes optionnelles sont ici TOUJOURS
--     présentes : ce squelette prouve que la logique marche, pas que la
--     dégradation douce marche. Pour cette dernière, enlever une colonne du
--     squelette et relancer — la migration doit continuer de tourner, en
--     descendant d'un étage (c'est le contrat des lectures `to_jsonb`).
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='anon')         THEN CREATE ROLE anon NOLOGIN; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='authenticated')THEN CREATE ROLE authenticated NOLOGIN; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='service_role') THEN CREATE ROLE service_role NOLOGIN; END IF;
END $$;

CREATE SCHEMA IF NOT EXISTS auth;
CREATE OR REPLACE FUNCTION auth.jwt() RETURNS jsonb LANGUAGE sql STABLE AS $f$
  SELECT jsonb_build_object('email', coalesce(nullif(current_setting('app.jwt_email', true), ''), 'admin@test.local'))
$f$;

CREATE TABLE IF NOT EXISTS public.enterprises (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nom text, timezone text DEFAULT 'Africa/Porto-Novo', is_active boolean DEFAULT true,
  auto_close_enabled boolean DEFAULT false, auto_close_time time, auto_close_grace_minutes integer
);
CREATE TABLE IF NOT EXISTS public.employees (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), enterprise_id uuid, matricule text,
  first_name text, last_name text, is_active boolean DEFAULT true, contrat text,
  team_id uuid, poste_id text
);
CREATE TABLE IF NOT EXISTS public.users (id uuid PRIMARY KEY, email text);
CREATE TABLE IF NOT EXISTS public.admins (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), email text, role text,
  enterprise_id uuid, is_active boolean DEFAULT true
);
CREATE TABLE IF NOT EXISTS public.admin_entreprises (
  admin_id uuid, enterprise_id uuid, is_active boolean DEFAULT true
);
CREATE TABLE IF NOT EXISTS public.attendances (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id uuid, enterprise_id uuid,
  check_time timestamptz NOT NULL, check_type text NOT NULL,
  method text, is_auto_closed boolean NOT NULL DEFAULT false,
  location_lat double precision, location_lng double precision,
  gps_accuracy double precision, is_within_zone boolean, distance_meters integer,
  geofence_id uuid, face_score integer, face_verified boolean, liveness_passed boolean,
  face_attempts integer, notes text, modifie_le timestamptz, modifie_par uuid,
  suspect boolean, suspect_reason text, clock_skew_seconds integer, device_id text,
  created_at timestamptz DEFAULT now(), updated_at timestamptz DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.work_schedules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), enterprise_id uuid, name text,
  start_time time, end_time time, has_break boolean DEFAULT true,
  break_start time, break_end time, work_days integer[] DEFAULT '{1,2,3,4,5}',
  bascule integer DEFAULT 0, is_default boolean DEFAULT false, is_active boolean DEFAULT true,
  valide_du date, valide_au date, late_tolerance_minutes integer,
  created_at timestamptz DEFAULT now(), updated_at timestamptz DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.employee_schedules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), employee_id uuid, enterprise_id uuid,
  schedule_id uuid, is_active boolean DEFAULT true, use_custom_hours boolean DEFAULT false,
  custom_start_time time, custom_end_time time, custom_has_break boolean,
  custom_break_start time, custom_break_end time, custom_work_days integer[],
  custom_bascule integer, valide_du date, valide_au date,
  created_at timestamptz DEFAULT now(), updated_at timestamptz DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.encheck_alertes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), enterprise_id uuid, employee_id uuid,
  type text, gravite text, titre text, message text, cle text, jour date,
  metadata jsonb DEFAULT '{}'::jsonb, created_at timestamptz DEFAULT now(),
  resolved_at timestamptz
);
CREATE TABLE IF NOT EXISTS public.pointages_photos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), attendance_id uuid, photo_url text,
  created_at timestamptz DEFAULT now()
);
-- Lecture par le rôle « navigateur » comme en production (l'écriture, elle, passe
-- par les RPC : c'est justement ce que la fumée vérifie).
GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
GRANT SELECT ON public.attendances, public.encheck_alertes, public.employees, public.enterprises TO authenticated;
