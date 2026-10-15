-- ═══════════════════════════════════════════════════════════════════════════
-- CONTRÔLE D'INTÉGRITÉ APRÈS EXÉCUTION DE LA MIGRATION
--     20261016000001_fondations_auto_close_structure.sql
-- ═══════════════════════════════════════════════════════════════════════════
--
-- POURQUOI CE FICHIER EXISTE
--   Un fichier de migration de 100 Ko collé à la main dans un éditeur web peut être
--   ROGNÉ (le presse-papiers d'une page rendue coupe, ou remplace la première ligne
--   par le titre du fichier — c'est exactement l'erreur « trailing junk after numeric
--   literal » vue le 16/10). Le pire n'est pas l'erreur : c'est le copier-coller
--   tronqué QUI PASSE SANS ERREUR. Comme l'éditeur valide ce qu'il a reçu, on se
--   retrouve avec la moitié de la structure, et le cron de 04:30 échoue trois nuits
--   plus tard sans que personne ne fasse le lien.
--
--   Ce script ne change RIEN (lecture seule). Il énumère ce que la migration DOIT
--   avoir laissé derrière elle et imprime ce qui manque. Un copier-coller tronqué ne
--   peut pas rater cette liste : il en sort forcément des lignes.
--
-- COMMENT L'UTILISER
--   1. vérifier l'empreinte du fichier avant de le coller :
--        sha256sum 20261016000001_fondations_auto_close_structure.sql
--        → 9954e5f8d239dfadadcf54ed125abf5c0aa6721436d33929e4c4d43f9f232454  (2 016 lignes, 103 323 octets)
--      et vérifier que la ligne 1 commence bien par deux tirets (« -- ═══… ») ;
--   2. appliquer la migration ;
--   3. coller CE fichier en entier dans l'éditeur SQL et l'exécuter :
--      il doit répondre une seule ligne, « RIEN NE MANQUE ».
--
--   À lancer aussi après toute migration de suivi, et après que IA DEV 1 a remplacé
--   le corps d'`encheck_estimer_sortie_comportementale` : ce contrôle est le garde-fou
--   commun des deux chantiers.

WITH attendu(nom, type, pourquoi) AS (
  VALUES
  -- ── les 5 tables nouvelles ───────────────────────────────────────────────
   ('public.encheck_reglages_pointage','table','source UNIQUE des seuils (§4.4) — sans elle, des chiffres restent en dur dans le code'),
   ('public.encheck_clotures_estimees','table','journal du mode ombre : ce que lit l''arbitre pour décider d''activer'),
   ('public.encheck_pointages_journal','table','preuve avant destruction (rebonds, purges)'),
   ('public.encheck_pipeline_runs','table','traçabilité des tours du moteur + verrous'),
   ('public.encheck_carte_fonctions','table','qui possède quelle fonction (§4.4, fin du monkey-patch)'),
  -- ── les 7 colonnes d'estimation ajoutées à la table partagée `attendances` ─
   ('attendances.estimation_source_id','colonne','d''où vient la sortie estimée'),
   ('attendances.estimation_niveau','colonne','niveau 1 à 5 de la cascade'),
   ('attendances.estimation_confiance','colonne','confiance affichée à l''humain'),
   ('attendances.estimation_detail','colonne','explication lisible'),
   ('attendances.estimation_validee_le','colonne','VALIDATION HUMAINE = seule porte d''entrée dans la paie'),
   ('attendances.estimation_validee_par','colonne','qui a validé'),
   ('attendances.estimation_remplacee_le','colonne','marque une estimation remplacée, jamais supprimée'),
   ('encheck_clotures_estimees.ecart_minutes','colonne','écart mesuré contre la vraie sortie (il vit dans le journal d''ombre, PAS dans attendances : une présumption ne devient pas une donnée de paie)'),
  -- ── les fonctions qui portent la doctrine ────────────────────────────────
   ('encheck_cloturer_pivotable','fonction','la cascade à 5 niveaux, plafond + mode ombre'),
   ('encheck_estimation_statuer','fonction','valider / écarter, garde admin DANS la fonction'),
   ('encheck_estimation_remplacer','fonction','réconciliation : marquer, pas effacer'),
   ('encheck_reconcilier_estimations','fonction','balayage de réconciliation'),
   ('encheck_rebonds_neutraliser','fonction','marque les doubles scans au lieu de les supprimer'),
   ('encheck_grille_au_jour','fonction','résolveur UNIQUE de grille, sans grille fantôme'),
   ('encheck_resoudre_grille_employe','fonction','vitre de compatibilité pour le mobile'),
   ('encheck_seuil','fonction','lit les seuils (plus aucun nombre en dur)'),
   ('encheck_mode_estimation','fonction','ombre / actif / désactivé'),
   ('encheck_alertes_scan','fonction','seul point d''entrée appelable par le navigateur, sous garde'),
   ('encheck_alertes_controler','fonction','alias sûr (délègue au scan) — voir le piège du rejeu 20261015000002'),
   ('encheck_pipeline_cloture','fonction','moteur : pg_cron uniquement, aucune GRANT navigateur'),
   ('encheck_pipeline_toutes_entreprises','fonction','orchestrateur nommé du cron'),
   ('encheck_alertes_scan_toutes_entreprises','fonction','une entreprise après l''autre, jamais en global'),
   ('encheck_alertes_purger','fonction','purge = entreprise obligatoire + snapshot avant'),
   ('encheck_alerte_journaliser','fonction','écriture du journal'),
   ('encheck_generateur_alertes','fonction','sélectionne la version du générateur historique'),
   ('encheck_nettoyer_rebonds_qr','fonction','ancienne destructive, rendue inoffensive'),
   ('encheck_assainir_alertes_horaires','fonction','ancienne regex sur texte français, neutralisée'),
   ('encheck_clotures_statistiques','fonction','mesures du mode ombre'),
   ('encheck_est_admin_de','fonction','le contrôle d''autorité utilisé par les gardes'),
   ('encheck_estimer_sortie_comportementale','fonction','NIVEAU 2 — corps volontairement vide, propriété IA DEV 1'),
   ('encheck_cloturer_sorties_oubliees','fonction','ancienne entrée, redirigée vers la cascade'),
   ('encheck_auteur_actuel','fonction','auteur des validations, depuis le JWT'),
  -- ── les garde-fous qui ne se voient pas dans `desc` ──────────────────────
   ('attendances_estimation_unique','index','anti-doublon : une estimation par employé et par jour'),
   ('attendances_estimations_a_valider','index','file « à valider » de la page Pointages'),
   ('encheck_clotures_estimees_suivi','index','lecture des statistiques d''ombre'),
  ('encheck_reglages_admin_all','politique','réglages : écriture admin seulement'),
   ('encheck_journal_admin_select','politique','journal : append-only, lecture admin'),
   ('encheck_carte_admin_select','politique','carte des fonctions'),
   ('trg_attendances_reconcilier_estimation','trigger','la réconciliation déclenchée par un vrai badge'),
  -- ── réglages de départ attendus ─────────────────────────────────────────
   ('public.encheck_reglages_pointage#10','lignes','les 10 clés de seuils livrées avec la migration')
)
SELECT 'MANQUANT' AS etat, a.type, a.nom, a.pourquoi
  FROM attendu a
 WHERE CASE a.type
    WHEN 'table' THEN to_regclass(a.nom) IS NULL
    WHEN 'colonne' THEN NOT EXISTS (
          SELECT 1 FROM information_schema.columns
           WHERE table_schema='public' AND table_name=split_part(a.nom,'.',1)
             AND column_name=split_part(a.nom,'.',2))
    WHEN 'fonction' THEN NOT EXISTS (
          SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
           WHERE n.nspname='public' AND p.proname=a.nom)
    WHEN 'index' THEN NOT EXISTS (
          SELECT 1 FROM pg_indexes WHERE schemaname='public' AND indexname=a.nom)
    WHEN 'politique' THEN NOT EXISTS (
          SELECT 1 FROM pg_policies WHERE schemaname='public' AND policyname=a.nom)
    WHEN 'trigger' THEN NOT EXISTS (
          SELECT 1 FROM pg_trigger tg JOIN pg_class c ON c.oid=tg.tgrelid
            JOIN pg_namespace n ON n.oid=c.relnamespace
           WHERE n.nspname='public' AND tg.tgname=a.nom AND NOT tg.tgisinternal)
    WHEN 'lignes' THEN COALESCE((SELECT count(*) FROM public.encheck_reglages_pointage),0)
                       < right(a.nom,2)::int
    ELSE false
  END
UNION ALL
-- Ligne de synthèse : c'est ELLE qu'on regarde en premier.
SELECT CASE WHEN count(*) = 0 THEN 'RIEN NE MANQUE' ELSE 'MIGRATION INCOMPLETE' END,
       count(*)::text || ' objet(s) manquant(s)',
       'la migration doit être rejouée en entier (elle est idempotence-prouvée : deux applications de suite sont propres)',
       'sha256 attendu 9954e5f8…2454 · 2 016 lignes · 103 323 octets'
  FROM attendu a
 WHERE CASE a.type
    WHEN 'table' THEN to_regclass(a.nom) IS NULL
    WHEN 'colonne' THEN NOT EXISTS (
          SELECT 1 FROM information_schema.columns
           WHERE table_schema='public' AND table_name=split_part(a.nom,'.',1)
             AND column_name=split_part(a.nom,'.',2))
    WHEN 'fonction' THEN NOT EXISTS (
          SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
           WHERE n.nspname='public' AND p.proname=a.nom)
    WHEN 'index' THEN NOT EXISTS (
          SELECT 1 FROM pg_indexes WHERE schemaname='public' AND indexname=a.nom)
    WHEN 'politique' THEN NOT EXISTS (
          SELECT 1 FROM pg_policies WHERE schemaname='public' AND policyname=a.nom)
    WHEN 'trigger' THEN NOT EXISTS (
          SELECT 1 FROM pg_trigger tg JOIN pg_class c ON c.oid=tg.tgrelid
            JOIN pg_namespace n ON n.oid=c.relnamespace
           WHERE n.nspname='public' AND tg.tgname=a.nom AND NOT tg.tgisinternal)
    WHEN 'lignes' THEN COALESCE((SELECT count(*) FROM public.encheck_reglages_pointage),0)
                       < right(a.nom,2)::int
    ELSE false
  END
ORDER BY 1;

-- ═══════════════════════════════════════════════════════════════════════════
-- Trois lectures d'accompagnement, à faire dans le même onglet si le contrôle
-- est vert — elles disent si la migration est bien en mode SANS RISQUE.
-- ═══════════════════════════════════════════════════════════════════════════
-- 1) Le mode doit être « ombre » : le moteur consigne, il n'écrit rien dans les pointages.
SELECT coalesce(public.encheck_mode_estimation(NULL), '(non réglé → ombre par défaut)') AS mode;

-- 2) Zéro heure inventée ne doit encore être arrivée dans `attendances`.
SELECT count(*) AS heures_inventees_en_prod
  FROM public.attendances WHERE estimation_source_id IS NOT NULL;

-- 3) La grille fantôme doit être morte : quand rien n'est réglé pour un employé,
--    le résolveur doit répondre `trouvee = false` et NON deviner 08:00-17:00.
SELECT e.matricule,
       public.encheck_grille_au_jour(e.id, e.enterprise_id, CURRENT_DATE)->>'trouvee' AS trouvee,
       public.encheck_grille_au_jour(e.id, e.enterprise_id, CURRENT_DATE)->>'source'   AS source
  FROM public.employees e
 ORDER BY e.matricule
 LIMIT 20;

