# `supabase/outils-sql/` — du SQL utilitaire, **pas** des migrations

## La règle, en deux phrases

Un fichier SQL qui **modifie la structure** de la base va dans `supabase/migrations/` :
il est numéroté, rejouable, et `supabase db push` l'applique (c'est le cas de
`../migrations/20261016000001_fondations_auto_close_structure.sql`).

Un fichier SQL qui **observe, vérifie ou aide à tester** va ici. Il n'est jamais
appliqué automatiquement, et il ne laisse aucune trace dans
`supabase_migrations.schema_migrations`. Rien dans ce dossier ne doit donc porter un
nom en `AAAAMMJJHHMMSS_…` : ce préfixe est ce qui dit « applique-moi ça ».

## Qui se lance où

| Fichier | Se lance | Effet |
|---|---|---|
| `controle-integrite-migration.sql` | **éditeur SQL Supabase, après la migration** | lecture seule — dit `RIEN NE MANQUE` ou énumère ce qui manque |
| `exporter-fonctions-prod-only.sql` | **éditeur SQL Supabase** | lecture seule — récupère le code des fonctions qui ne vivent que dans la prod |
| `diagnostic-auto-close-probleme2.sql` | éditeur SQL Supabase ou local, **facultatif** | lecture seule — le constat chiffré d'avant correctif |
| `squelette-supabase-local.sql` | ⛔ **Postgres local seulement** | monte un faux Supabase (rôles, `auth`, tables partagées) |
| `test-execution-migration.sql` | ⛔ **Postgres local seulement**, après le squelette | 25 assertions : la migration, exécutée pour de vrai |

Les deux derniers sont la raison de deux erreurs vues dans l'éditeur le 16/10 :
collés en prod, ils échouent (`\set` n'est pas du SQL — c'est une méta-commande psql —
et `CREATE FUNCTION auth.jwt()` n'est pas permis), et `test-execution-migration.sql`
**tronque** les tables. Un outil de test n'a rien à faire dans un éditeur branché sur
une base de paie : d'où ce dossier, séparé des migrations, et ces lignes en tête de
fichier.

## Relancer la fumée après une modification de la migration

```bash
# Base JETABLE. Ne jamais pointer sur la prod.
PGURL=postgres://postgres:mdp@localhost:5433/postgres
psql "$PGURL" -f squelette-supabase-local.sql
psql "$PGURL" -v ON_ERROR_STOP=1 -f ../migrations/20261016000001_fondations_auto_close_structure.sql
psql "$PGURL" -v ON_ERROR_STOP=1 -f ../migrations/20261016000001_fondations_auto_close_structure.sql  # rejouable ?
psql "$PGURL" -v ON_ERROR_STOP=0 -f test-execution-migration.sql
```

Il doit défiler **25 lignes `ok_… := true`** et **aucune ligne `ÉCHEC …`**. Le
`ON_ERROR_STOP=0` de la dernière ligne est voulu : on veut la liste complète des
règles violées, pas seulement la première.

## Le harnais a une raison d'être

Postgres ne compile le corps d'une fonction PL/pgSQL qu'à sa **première exécution**.
Une migration peut donc s'appliquer « sans erreur » et casser au premier cron, à
04:30. C'est en exécutant vraiment le fichier que quatre bugs sont sortis — dont un
`round(double precision, integer)` qui aurait cassé les statistiques du mode ombre,
seules données sur lesquelles l'arbitre peut décider d'activer la clôture automatique.

**Une migration non exécutée est une migration non testée.**

## Ce que ce dossier ne contient pas, et pourquoi

`ANALYSE-IA2/`, à la racine du dépôt, garde les **notes** destinées à l'humain qui
arbitre (`README-EXECUTION.md`, `SYNTHESE-POUR-ARBITRE.md`) : de la prose, pas du SQL.
Un commentaire de `20261016000001_…` pointe encore vers l'ancien emplacement des
outils : il est resté volontairement **en l'état**, parce que la migration est déjà
appliquée en production et que changer ne serait-ce qu'un octet du fichier rendrait le
dépôt différent de la base. Le chemin exact, le 16/10, valait plus qu'un commentaire
propre.
