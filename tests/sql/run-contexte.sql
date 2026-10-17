-- UNIQUEMENT base locale VIDE et JETABLE. Ne jamais exécuter ces fixtures en production.
-- psql -X -d encheck_contexte_test -f tests/sql/run-contexte.sql
\set ON_ERROR_STOP on
\ir cohorte-fixture.sql
\ir contexte-fixture.sql
\ir ../../supabase/migrations/20261017000006_methode_estimation.sql
\ir ../../supabase/migrations/20261017000007_analyse_cohorte_ombre.sql
\ir ../../supabase/migrations/20261017000008_propositions_contextuelles.sql
\ir ../../supabase/migrations/20261017000008_propositions_contextuelles.sql
\ir contexte-assertions.sql
