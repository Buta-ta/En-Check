-- DANGER : uniquement une base PostgreSQL VIDE, LOCALE et JETABLE.
-- Exemple : psql -X -v ON_ERROR_STOP=1 -d encheck_test_jetable -f tests/sql/run-cohorte.sql
-- Aucune connexion Supabase / production ne doit être utilisée pour ces fixtures.
\set ON_ERROR_STOP on
\ir cohorte-fixture.sql
\ir ../../supabase/migrations/20261017000006_methode_estimation.sql
\ir ../../supabase/migrations/20261017000007_analyse_cohorte_ombre.sql
-- Réexécution : vérification de l'idempotence.
\ir ../../supabase/migrations/20261017000006_methode_estimation.sql
\ir ../../supabase/migrations/20261017000007_analyse_cohorte_ombre.sql
\ir cohorte-assertions.sql
