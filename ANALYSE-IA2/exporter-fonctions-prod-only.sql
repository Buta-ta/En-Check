-- ═══════════════════════════════════════════════════════════════════════════
-- 📤 EXPORTER LES FONCTIONS QUI NE VIVENT QUE DANS LA BASE
--     (décision §4.4 de l'arbitrage n°1 : « la base n'est pas une poubelle »)
-- ═══════════════════════════════════════════════════════════════════════════
--
-- LE PROBLÈME, EN FRANÇAIS SIMPLE
--   Certaines fonctions critiques n'existent QUE dans la base de production :
--   personne n'a jamais écrit leur code dans `supabase/migrations/`. Elles ont
--   été créées à la main dans l'éditeur SQL un jour d'urgence. Conséquence :
--   · si une migration recrée une fonction de ce nom (`CREATE OR REPLACE`), elle
--     ÉCRASE la version de production sans prévenir — et la version écrasée est
--     perdue, parce qu'elle n'est nulle part ailleurs ;
--   · si la base tombe et doit être reconstruite à partir des migrations, ces
--     fonctions n'existent plus : la pointeuse cesse d'enregistrer les badges.
--
-- CE QUE FAIT CE SCRIPT
--   Il ne change RIEN. Il LIT et affiche le code source exact de ces fonctions,
--   prêt à être copié dans un nouveau fichier de migration. À lancer DANS
--   L'ÉDITEUR SQL de Supabase (project `cxggndvhwdolbtyezjde`), en une seule fois,
--   puis à copier-coller le résultat vers IA DEV 2 (ou à coller directement dans
--   `supabase/migrations/20261017…export_fonctions_prod.sql`).
--
--   ⚠️ Le résultat s'affiche dans la grille en bas de l'éditeur : une ligne par
--      fonction, très longue. Utiliser « Download CSV » ou le copier cellule par
--      cellule — ne pas le recopier à la main.

-- ── 1. Les fonctions dont on SAIT qu'elles sont critiques et non versionnées ──
SELECT p.oid::regprocedure::text AS fonction,
       pg_get_functiondef(p.oid)  AS code_source_a_copier,
       pg_size_pretty(octet_length(pg_get_functiondef(p.oid))::bigint) AS taille,
       (SELECT count(*) FROM pg_depend d
         WHERE d.objid = p.oid AND d.deptype = 'e') AS est_une_extension
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
 WHERE n.nspname = 'public'
   AND p.proname IN (
     'encheck_punch',                       -- chemin d'écriture des pointeuses
     'replace_attendance_day',              -- correction admin atomique (+ attendance_history)
     'encheck_alertes_controler_interne',   -- génératrice d'alertes historique
     'encheck_signaux_controler',           -- signaux d'assiduité
     'encheck_alertes_controler_v2',        -- variantes éventuelles…
     'encheck_alertes_lister',
     'encheck_assainir_alertes_horaires',
     'encheck_nettoyer_rebonds_qr',
     'encheck_cloturer_sorties_oubliees',
     'encheck_resoudre_grille_employe'
   )
 ORDER BY p.proname;

-- ── 2. Liste COMPLÈTE des fonctions de `public` non taguées par une extension ──
--  sert à repérer les autres orphelines, y compris celles qu'on ne soupçonnait pas :
--  toute fonction « non versionnée » de cette liste doit finir dans un fichier de
--  migration, ou être explicitement déclarée comme abandonnée dans la carte.
SELECT p.proname,
       pg_get_function_identity_arguments(p.oid) AS arguments,
       r.rolname                                 AS proprietaire,
       p.prosecdef                               AS security_definer,
       p.prorettype::regtype::text               AS retour,
       obj_description(p.oid, 'pg_proc')         AS commentaire
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
  JOIN pg_roles r     ON r.oid = p.proowner
 WHERE n.nspname = 'public'
   AND NOT EXISTS (SELECT 1 FROM pg_depend d WHERE d.objid = p.oid AND d.deptype = 'e')
 ORDER BY p.proname;

-- ── 3. Les DÉCLENCHEURS posés sur des tables partagées ──
--  Un trigger peut détruire des données sans qu'aucune fonction appelante ne le
--  mentionne. Ils sont aussi obligatoires dans l'export.
SELECT tg.tgname AS declencheur,
       cl.relname AS table_sur_laquelle,
       CASE tg.tgevent & 4  WHEN 4 THEN 'INSERT ' ELSE '' END ||
       CASE tg.tgevent & 8  WHEN 8 THEN 'UPDATE ' ELSE '' END ||
       CASE tg.tgevent & 16 WHEN 16 THEN 'DELETE ' ELSE '' END AS sur_evenement,
       CASE WHEN tg.tgtype::int & 1 = 1 THEN 'BEFORE' ELSE 'AFTER' END AS moment,
       pn.nspname || '.' || p.proname AS fonction_appelee,
       (SELECT count(*) FROM pg_depend d WHERE d.objid = p.oid AND d.deptype = 'e') AS vient_d_une_extension
  FROM pg_trigger tg
  JOIN pg_class     cl ON cl.oid = tg.tgrelid
  JOIN pg_proc      p  ON p.oid  = tg.tgfoid
  JOIN pg_namespace pn ON pn.oid = p.pronamespace
 WHERE NOT tg.tgisinternal
   AND cl.relname IN ('attendances','employees','enterprises','absences','work_schedules',
                      'employee_schedules','attendance_history','pointages_photos','encheck_alertes')
 ORDER BY cl.relname, tg.tgname;

-- ── 4. Copier une fonction précise, proprement (une seule ligne de résultat) ──
--  Décommenter et remplacer le nom si besoin.
-- SELECT pg_get_functiondef('public.encheck_punch(uuid, text, timestamp with time zone)'::regprocedure);

-- ── 5. After the export: what the map (carte) must contain (it is written by the
--    migration, but this query confirms nothing is missing).
SELECT fonction, proprietaire, depot, versionnee, contrat, maj_le::date AS maj
  FROM public.encheck_carte_fonctions
 ORDER BY versionnee, fonction;

-- ═══════════════════════════════════════════════════════════════════════════
-- CE QU'IL FAUT EN FAIRE (check-list)
-- ═══════════════════════════════════════════════════════════════════════════
--   1. Coller chaque `code_source_a_copier` dans
--      `supabase/migrations/20261017000001_export_fonctions_prod_only.sql`,
--      précédé de `CREATE OR REPLACE FUNCTION …` tels quels (ne rien « améliorer » :
--      l'export doit être CONFORME, les correctifs viendront ensuite et en séparé).
--   2. Mettre `versionnee = true` et `depot = 'En-Check'` dans
--      `public.encheck_carte_fonctions` pour chaque fonction exportée.
--   3. Écrire les deux phrases de contrat au-dessus de chaque fonction : qui
--      l'appelle, ce qu'elle a le droit d'écrire, et ce qui casse si on la modifie.
--   4. Ne JAMAIS laisser une fonction critique uniquement dans la base : c'est
--      exactement ce qui a rendu le génératrice d'alertes invisible pendant des
--      mois, et qui a permis qu'un monkey-patch de migration la recouvre.
