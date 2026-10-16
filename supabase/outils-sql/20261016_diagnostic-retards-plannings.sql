-- ═══════════════════════════════════════════════════════════════════════════
-- DIAGNOSTIC RETARDS / PLANNINGS — 2026-10-16 — LECTURE SEULE
-- ═══════════════════════════════════════════════════════════════════════════
--  Ce script NE MODIFIE RIEN (aucun INSERT/UPDATE/DELETE). Il sert à trancher
--  les questions ouvertes du constat « Retards » du 16/10/2026 :
--
--    Q1. L'alerte d'Hippo annonce 08:00 / 177 min ; la page Retards annonce
--        09:00 / 1h57. Quelle grille était EN VIGUEUR le 16/10 ? (l'arbitre
--        = encheck_journee_recalculee, qui respecte les dates d'effet)
--    Q2. Pharmacie Blanche Gomes (pas d'option Planning) : d'où vient ce
--        « Prévu 08:00 ±15min » affiché pour ses employés ? Affectations
--        fantômes (inactives ? liées à une grille d'une AUTRE entreprise ?)
--    Q3. « 7 envoyés » pour une seule alerte : doublons d'abonnements push
--        ou destinataires légitimes ?
--
--  EXÉCUTION : copier-coller tout ce fichier dans l'éditeur SQL Supabase et
--  cliquer « Run ». Les résultats s'affichent section par section.
-- ═══════════════════════════════════════════════════════════════════════════

-- ─────────────────────────────────────────────────────────────────────────────
-- SECTION 1 — Les deux entreprises : option Planning & module Retards
-- ─────────────────────────────────────────────────────────────────────────────
SELECT 'SECTION 1 — entreprises (module_planning = FAUX ⇒ aucun jugement horaire possible)' AS info;

SELECT id,
       name,
       COALESCE(module_planning, false) AS module_planning,
       COALESCE(module_retards, false)  AS module_retards,
       COALESCE(is_active, true)        AS active
  FROM enterprises
 WHERE name ILIKE '%EN-NOUS%'
    OR name ILIKE '%Pharmacie%Blanche%'
 ORDER BY name;

-- ─────────────────────────────────────────────────────────────────────────────
-- SECTION 2 — Hippo : quelle grille était en vigueur le 16/10 ? (Q1)
-- ─────────────────────────────────────────────────────────────────────────────
--  « source = custom » + nom « Horaire personnalisé » + start 09:00 → l'alerte
--  (08:00) a tort. « source = defaut » + start 08:00 → la page a tort.
SELECT 'SECTION 2 — Hippo BIYOKILA, grille en vigueur le 2026-10-16 (L''ARBITRE)' AS info;

SELECT r.grille_nom,
       r.start_time AS heure_prevue,
       r.end_time,
       r.tolerance_minutes,
       r.source,
       r.explicite,
       r.est_jour_ouvre,
       r.trouvee,
       to_char((j->>'premiere_entree')::timestamptz, 'YYYY-MM-DD HH24:MI:SS') AS premiere_entree,
       (j->>'retard_minutes')::int AS retard_minutes
  FROM employees e
  CROSS JOIN LATERAL public.encheck_resoudre_grille_employe(e.id, e.enterprise_id, DATE '2026-10-16') r
  CROSS JOIN LATERAL public.encheck_journee_recalculee(e.id, e.enterprise_id, DATE '2026-10-16') j
 WHERE e.matricule ILIKE '%ENN-0002%'
    OR trim(COALESCE(e.first_name,'') || ' ' || COALESCE(e.last_name,'')) ILIKE '%Hippo%BIYOKILA%';

-- Détail des affectations individuelles d'Hippo (dates d'effet = la question)
SELECT 'SECTION 2 bis — employee_schedules d''Hippo (valide_du/valide_au : depuis quand ?)' AS info;

SELECT es.id,
       es.employee_id,
       es.schedule_id,
       es.use_custom_hours,
       es.custom_start_time,
       es.custom_end_time,
       COALESCE(es.is_active, true) AS is_active,
       es.valide_du,
       es.valide_au,
       es.created_at,
       ws.name              AS grille_liee_nom,
       ws.enterprise_id     AS grille_liee_entreprise_id,
       ws.start_time        AS grille_liee_debut,
       ws.end_time          AS grille_liee_fin,
       ws.late_tolerance_minutes AS grille_liee_tolerance,
       COALESCE(ws.is_active, true) AS grille_liee_active,
       (SELECT wse.name FROM enterprises wse WHERE wse.id = ws.enterprise_id) AS grille_liee_appartient_a
  FROM employees e
  LEFT JOIN employee_schedules es ON es.employee_id = e.id
  LEFT JOIN work_schedules ws     ON ws.id = es.schedule_id
 WHERE e.matricule ILIKE '%ENN-0002%'
    OR trim(COALESCE(e.first_name,'') || ' ' || COALESCE(e.last_name,'')) ILIKE '%Hippo%BIYOKILA%'
 ORDER BY es.created_at;

-- ─────────────────────────────────────────────────────────────────────────────
-- SECTION 3 — Pharmacie Blanche Gomes : d'où vient le « Prévu 08:00 » ? (Q2)
-- ─────────────────────────────────────────────────────────────────────────────
--  À lire : si is_active = false → la page Retards les utilisait alors qu'elle
--  ne devrait pas (corrigé par la migration 20261016000003). Si
--  « appartient_a » n'est PAS « Pharmacie Blanche Gomes » → fuite entre
--  entreprises (corrigé par le résolveur SQL, qui ne lie jamais une grille
--  inactive ; la règle module_planning coupe en plus tout jugement).
SELECT 'SECTION 3 — employés Pharmacie Blanche Gomes : affectations + grilles liées' AS info;

SELECT e.matricule,
       trim(COALESCE(e.first_name,'') || ' ' || COALESCE(e.last_name,'')) AS employe,
       es.id                    AS affectation_id,
       es.use_custom_hours,
       es.custom_start_time,
       es.schedule_id,
       COALESCE(es.is_active, true) AS affectation_active,
       es.valide_du,
       es.valide_au,
       ws.name                  AS grille_liee_nom,
       ws.start_time            AS grille_liee_debut,
       ws.end_time              AS grille_liee_fin,
       ws.late_tolerance_minutes AS grille_liee_tolerance,
       COALESCE(ws.is_active, true) AS grille_liee_active,
       (SELECT wse.name FROM enterprises wse WHERE wse.id = ws.enterprise_id) AS grille_liee_appartient_a
  FROM employees e
  LEFT JOIN employee_schedules es ON es.employee_id = e.id
  LEFT JOIN work_schedules ws     ON ws.id = es.schedule_id
  JOIN enterprises ent            ON ent.id = e.enterprise_id
 WHERE ent.name ILIKE '%Pharmacie%Blanche%'
   AND COALESCE(e.is_active, true) = true
 ORDER BY e.matricule, es.created_at;

-- Grilles par défaut déclarées pour la pharmacie (normalement : aucune)
SELECT 'SECTION 3 bis — work_schedules de la Pharmacie Blanche Gomes (normalement : vide)' AS info;

SELECT ws.id, ws.name, ws.is_default, COALESCE(ws.is_active, true) AS is_active,
       ws.start_time, ws.end_time, ws.late_tolerance_minutes
  FROM work_schedules ws
  JOIN enterprises ent ON ent.id = ws.enterprise_id
 WHERE ent.name ILIKE '%Pharmacie%Blanche%';

-- Ce que le résolveur unique décide pour eux le 16/10 (doit dire « aucune »)
SELECT 'SECTION 3 ter — verdict du résolveur SQL pour les pharmaciens le 2026-10-16' AS info;

SELECT e.matricule,
       trim(COALESCE(e.first_name,'') || ' ' || COALESCE(e.last_name,'')) AS employe,
       r.grille_nom, r.start_time, r.source, r.trouvee,
       (j->>'retard_minutes')::int AS retard_minutes
  FROM employees e
  JOIN enterprises ent ON ent.id = e.enterprise_id
  CROSS JOIN LATERAL public.encheck_resoudre_grille_employe(e.id, e.enterprise_id, DATE '2026-10-16') r
  CROSS JOIN LATERAL public.encheck_journee_recalculee(e.id, e.enterprise_id, DATE '2026-10-16') j
 WHERE ent.name ILIKE '%Pharmacie%Blanche%'
   AND COALESCE(e.is_active, true) = true
 ORDER BY e.matricule;

-- ─────────────────────────────────────────────────────────────────────────────
-- SECTION 4 — L'alerte elle-même + le moteur d'alertes installé
-- ─────────────────────────────────────────────────────────────────────────────
SELECT 'SECTION 4 — alertes « Retard à l''arrivée » autour du 16/10 (texte hérité = ''pour une tolérance de'')' AS info;

DO $$
DECLARE
  v_tbl     text;
  v_coldate text;
  v_sql     text;
BEGIN
  SELECT t.table_alertes, t.col_date INTO v_tbl, v_coldate
    FROM public.encheck_table_alertes() t;

  IF v_tbl IS NULL OR v_coldate IS NULL THEN
    RAISE NOTICE 'SECTION 4 : table d''alertes introuvable — section ignorée';
    RETURN;
  END IF;

  RAISE NOTICE 'SECTION 4 : table d''alertes = %, colonne de date = %', v_tbl, v_coldate;

  v_sql := format(
    'SELECT a.id,
            trim(COALESCE(e.first_name,'''' ) || '' '' || COALESCE(e.last_name,'''')) AS employe,
            e.matricule,
            (%I)::date AS jour,
            a.titre,
            a.detail,
            a.created_at
       FROM public.%I a
       LEFT JOIN public.employees e ON e.id = a.employee_id
      WHERE a.titre = %L
        AND (%I)::date BETWEEN DATE ''2026-10-14'' AND DATE ''2026-10-17''
      ORDER BY 4, 6',
    v_coldate, v_tbl, 'Retard à l''arrivée', v_coldate);

  EXECUTE v_sql;   -- résultat : la ligne Hippo avec son texte exact
END $$;

-- Quel générateur est installé en base (hors dépôts = moteur hérité) ?
SELECT 'SECTION 4 bis — moteur d''alertes installé (pg_proc)' AS info;

SELECT p.proname,
       pg_get_function_identity_arguments(p.oid) AS arguments,
       length(p.prosrc) AS taille_source
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
 WHERE n.nspname = 'public'
   AND p.proname IN ('encheck_generateur_alertes',
                     'encheck_alertes_controler_interne',
                     'encheck_alertes_controler_v2',
                     'encheck_alertes_controler',
                     'encheck_alertes_scan',
                     'encheck_alertes_purger',
                     'encheck_alertes_recalibrer')
 ORDER BY p.proname;

-- Mode d'estimation (la purge des alertes n'est branchée que si ≠ 'desactive')
SELECT 'SECTION 4 ter — mode estimation par entreprise (encheck_mode_estimation)' AS info;

SELECT ent.name,
       public.encheck_mode_estimation(ent.id) AS mode_estimation
  FROM enterprises ent
 WHERE ent.name ILIKE '%EN-NOUS%'
    OR ent.name ILIKE '%Pharmacie%Blanche%'
 ORDER BY ent.name;

-- ─────────────────────────────────────────────────────────────────────────────
-- SECTION 5 — « 7 envoyés » : doublons push ou vrais destinataires ? (Q3)
-- ─────────────────────────────────────────────────────────────────────────────
SELECT 'SECTION 5 — abonnements push par utilisateur (doublons = ancien bug subscribe())' AS info;

SELECT ps.user_type,
       ps.user_id,
       ps.enterprise_id,
       count(*)                                            AS nb_abonnements,
       count(*) FILTER (WHERE COALESCE(ps.is_active, true)) AS nb_actifs,
       count(DISTINCT ps.endpoint)                         AS nb_endpoints_distincts
  FROM push_subscriptions ps
 GROUP BY ps.user_type, ps.user_id, ps.enterprise_id
HAVING count(*) > 1
 ORDER BY nb_abonnements DESC;

SELECT 'SECTION 5 bis — journaux d''envois push autour du 16/10' AS info;

SELECT id, title, target_type, success_count, failed_count, created_at
  FROM push_logs
 WHERE created_at >= '2026-10-15'
 ORDER BY created_at DESC
 LIMIT 30;

-- ═══════════════════════════════════════════════════════════════════════════
-- FIN DU DIAGNOSTIC — RIEN N'A ÉTÉ MODIFIÉ.
-- Chaque réponse attendue est expliquée en tête de section.
-- ═══════════════════════════════════════════════════════════════════════════
