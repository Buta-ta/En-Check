-- LECTURE SEULE. À exécuter dans l'éditeur SQL Supabase.
-- Aucun badge, planning, droit, notification ou alerte n'est modifié.
-- Exporter le résultat CSV : la fonction productrice n'est pas versionnée dans les dépôts.
-- On doit connaître son code AVANT de modifier le chemin de pointage en production.
SELECT p.oid::regprocedure::text AS fonction,
       pg_get_functiondef(p.oid) AS definition
FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
WHERE n.nspname='public' AND p.prokind='f'
  AND NOT EXISTS (SELECT 1 FROM pg_depend d WHERE d.objid=p.oid AND d.classid='pg_proc'::regclass AND d.deptype='e')
  AND (
    p.proname IN ('encheck_alerte_poser','encheck_alertes_controler_interne',
      'encheck_punch','encheck_signaux_controler','encheck_grille_au_jour','encheck_journee_recalculee')
    OR p.prosrc ILIKE '%retard%'
    OR p.prosrc ILIKE '%late_arrival%'
    OR p.prosrc ILIKE '%encheck_alerte_poser%'
  )
ORDER BY p.proname, p.oid;
