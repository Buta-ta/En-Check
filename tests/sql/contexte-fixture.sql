-- UNIQUEMENT après cohorte-fixture dans une base vide jetable.
ALTER TABLE attendances ADD COLUMN estimation_source_id uuid,
 ADD COLUMN estimation_validee_le timestamptz, ADD COLUMN estimation_validee_par uuid,
 ADD COLUMN estimation_remplacee_le timestamptz, ADD COLUMN estimation_niveau smallint,
 ADD COLUMN estimation_confiance text, ADD COLUMN estimation_detail jsonb;
CREATE UNIQUE INDEX estimation_source_unique ON attendances(estimation_source_id) WHERE estimation_source_id IS NOT NULL AND estimation_remplacee_le IS NULL;
CREATE TABLE employees(id uuid PRIMARY KEY,enterprise_id uuid,site_id uuid);
CREATE TABLE encheck_pointages_journal(enterprise_id uuid,employee_id uuid,attendance_id uuid,action text,motif text,snapshot jsonb,pipeline text,auteur uuid);
CREATE FUNCTION encheck_auteur_actuel() RETURNS uuid LANGUAGE sql AS $$ SELECT '00000000-0000-0000-0000-000000000001'::uuid $$;
CREATE FUNCTION encheck_fuseau(uuid) RETURNS text LANGUAGE sql AS $$ SELECT 'Africa/Porto-Novo'::text $$;
-- Plannings contrôlables pour tester la confrontation sans copier les tables producteur.
CREATE FUNCTION encheck_grille_au_jour(uuid,uuid,date) RETURNS jsonb LANGUAGE sql AS $$ SELECT jsonb_build_object('source','test','end',nullif(current_setting('test.plan',true),'')) $$;
CREATE FUNCTION encheck_heure_de_fin_prevue(timestamptz,jsonb,text) RETURNS timestamptz LANGUAGE sql AS $$ SELECT ($2->>'end')::timestamptz $$;

CREATE TABLE team_members(employee_id uuid,team_id uuid,joined_at timestamptz,removed_at timestamptz,is_active boolean);
