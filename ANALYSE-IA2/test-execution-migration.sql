-- ═══════════════════════════════════════════════════════════════════════════
-- 🧪 FUMÉE D'EXÉCUTION RÉELLE — migration 20261016000001
--     « fondations_auto_close_structure »
-- ═══════════════════════════════════════════════════════════════════════════
--
-- ───────────────────────────────────────────────────────────────────────────
-- POURQUOI CE FICHIER EXISTE (et pourquoi il n'est PAS dans supabase/migrations)
-- ───────────────────────────────────────────────────────────────────────────
-- Un fichier de migration n'est jamais vérifié par le compilateur : le code
-- PL/pgSQL est une CHAÎNE pour Postgres, qui ne le lit qu'À LA PREMIÈRE
-- EXÉCUTION. Autrement dit, une erreur de colonne dans une fonction de clôture
-- ne se déclare pas au déploiement — elle se déclare à 04:30 du matin, dans les
-- logs d'un cron, la nuit où tout le monde dort.
--
-- C'est exactement ce qui s'est produit ici. Exécutée sur un vrai Postgres,
-- cette fumée a sorti trois bugs que la relecture n'avait pas vus :
--   1. `d.check_time` au lieu de `d.entree` dans la sélection de la cascade →
--      TOUTE la clôture pivotable échouait dès le premier cron ;
--   2. `round(double precision, integer)` n'existe pas → les statistiques du
--      mode ombre (ce que l'IA ARBITRE devait lire pour décider l'activation)
--      ne tournaient pas ;
--   3. `work_days` (JSONB) casté en `integer[]` → « malformed array literal »
--      dans la vitre de compatibilité appelée par le mobile ;
--   4. l'idempotence des rebonds : le contrôle « déjà traité » ne regardait que
--      l'entrée, donc chaque nuit re-marquait et re-journalisait les mêmes
--      doubles scans.
--
-- ───────────────────────────────────────────────────────────────────────────
-- COMMENT LE LANCER (localhost uniquement — JAMAIS sur la base de production)
-- ───────────────────────────────────────────────────────────────────────────
--   1. Un Postgres 15+ local, avec le squelette Supabase minimal (rôles
--      anon/authenticated/service_role, fonction auth.jwt()) : voir
--      `skel-supabase-local.sql` du même dossier.
--   2. Appliquer la migration à tester.
--   3. Lancer CE fichier :  psql "$DSN" -v ON_ERROR_STOP=0 -f ce-fichier.sql
--   4. Chercher les lignes « ok_* := true ». Une ligne « ÉCHEC … » = un
--      correctif qui n'est pas appliqué. `ON_ERROR_STOP=0` est volontaire :
--      on veut TOUTES les erreurs d'un seul passage, pas la première.
--
-- ⚠️ Aucune donnée de production ne doit transiter par ici : les écritures sont
--    réelles (attendances, journal, alertes) mais sur les ID '1111…1111' créés
--    par le squelette.
-- ═══════════════════════════════════════════════════════════════════════════

\set ON_ERROR_STOP 0
SET app.jwt_email = 'admin@test.local';

-- ── 0. Seed : trois entreprises, trois situations volontairement différentes ──
TRUNCATE public.attendances, public.encheck_clotures_estimees, public.encheck_pointages_journal,
         public.encheck_pipeline_runs, public.encheck_alertes, public.employee_schedules,
         public.work_schedules RESTART IDENTITY CASCADE;
DELETE FROM public.admins; DELETE FROM public.employees; DELETE FROM public.enterprises;
DELETE FROM public.encheck_reglages_pointage WHERE enterprise_id IS NOT NULL;

INSERT INTO public.enterprises (id, nom, timezone, is_active, auto_close_enabled, auto_close_time, auto_close_grace_minutes) VALUES
 -- A : grille par défaut 08:00→17:00 + auto-close 22:30 (+15 min de grâce)
 ('11111111-1111-1111-1111-111111111111','Test SARL','Africa/Porto-Novo',true, true ,'22:30:00',15),
 -- B : garde de nuit de 14 h annoncées → le plafond de 12 h doit la ramener
 ('55555555-5555-5555-5555-555555555555','Nuit SARL','Africa/Porto-Novo',true, false, NULL     ,NULL),
 -- C : aucune grille, aucun réglage → interdiction d'inventer un 08:00-17:00
 ('66666666-6666-6666-6666-666666666666','Vide SARL','Africa/Porto-Novo',true, false, NULL     ,NULL);

INSERT INTO public.employees (id, enterprise_id, matricule, first_name, last_name, is_active) VALUES
 ('22222222-2222-2222-2222-222222222222','11111111-1111-1111-1111-111111111111','MTX-1','Rachida','A.',true),
 ('22222222-2222-2222-2222-222222222223','55555555-5555-5555-5555-555555555555','MTX-2','Suleï','B.',true),
 ('22222222-2222-2222-2222-222222222224','66666666-6666-6666-6666-666666666666','MTX-3','Idriss','C.',true);

INSERT INTO public.admins (email, role, enterprise_id, is_active) VALUES
 ('admin@test.local','super_admin','11111111-1111-1111-1111-111111111111',true),
 ('autre@test.local','reader','11111111-1111-1111-1111-111111111111',true);

INSERT INTO public.work_schedules (id, enterprise_id, name, start_time, end_time, is_default, is_active, bascule, late_tolerance_minutes, work_days) VALUES
 ('33333333-3333-3333-3333-333333333333','11111111-1111-1111-1111-111111111111','Journée','08:00','17:00',true,true,240,15,'{1,2,3,4,5}'),
 ('33333333-3333-3333-3333-333333333334','55555555-5555-5555-5555-555555555555','Nuit longue','18:00','08:00',true,true,240,15,'{1,2,3,4,5}');

-- A : une entrée orpheline le 12 (le cas à estimer) + une journée fermée le 10
--     (qui servira de preuve pour la purge d'alerte : arrivée à l'heure pile).
INSERT INTO public.attendances (id, employee_id, enterprise_id, check_time, check_type, method) VALUES
 ('44444444-4444-4444-4444-444444444444','22222222-2222-2222-2222-222222222222','11111111-1111-1111-1111-111111111111','2026-10-12T07:02:00+00','in','qr_code'),
 ('44444444-4444-4444-4444-444444444440','22222222-2222-2222-2222-222222222222','11111111-1111-1111-1111-111111111111','2026-10-10T07:00:00+00','in','qr_code'),
 ('44444444-4444-4444-4444-444444444441','22222222-2222-2222-2222-222222222222','11111111-1111-1111-1111-111111111111','2026-10-10T16:05:00+00','out','pin');
-- B : entrée à 18:00 locales le 12 → fin prévue 08:00 J+1, soit 14 h → plafond 12 h
INSERT INTO public.attendances (employee_id, enterprise_id, check_time, check_type, method) VALUES
 ('22222222-2222-2222-2222-222222222223','55555555-5555-5555-5555-555555555555','2026-10-12T17:00:00+00','in','qr_code');
-- C : entrée seule, entreprise sans grille → Niveau 5 (entrée + 8 h)
INSERT INTO public.attendances (employee_id, enterprise_id, check_time, check_type, method) VALUES
 ('22222222-2222-2222-2222-222222222224','66666666-6666-6666-6666-666666666666','2026-10-12T09:00:00+00','in','qr_code');

-- ═══ 1. Mode OMBRE : on consigne la décision, on n'écrit RIEN dans attendances ═══
SELECT public.encheck_pipeline_cloture('11111111-1111-1111-1111-111111111111','ombre',TIMESTAMPTZ '2026-10-13 04:30:00+00') AS run_ombre;
DO $$
DECLARE n_att int; n_con int; n_appl boolean;
BEGIN
  SELECT count(*) INTO n_att FROM public.attendances WHERE employee_id='22222222-2222-2222-2222-222222222222';
  SELECT count(*), bool_and(applique = false) INTO n_con, n_appl
    FROM public.encheck_clotures_estimees WHERE enterprise_id='11111111-1111-1111-1111-111111111111';
  IF n_att <> 3 THEN RAISE EXCEPTION 'ÉCHEC ombre : % pointages pour A (3 attendus : le moteur ne doit rien écrire)', n_att; END IF;
  IF n_con <> 1 THEN RAISE EXCEPTION 'ÉCHEC ombre : % consignation (1 attendue : la décision doit être mesurée)', n_con; END IF;
  IF NOT COALESCE(n_appl, false) THEN RAISE EXCEPTION 'ÉCHEC ombre : applique doit valoir false en mode ombre'; END IF;
  RAISE NOTICE 'ok_ombre := true';
END $$;

-- ═══ 2. Mode ACTIF : la sortie estimée est marquée, jamais déguisée en badge ═══
SELECT json_agg(t) AS actif_a FROM public.encheck_cloturer_pivotable('11111111-1111-1111-1111-111111111111', TIMESTAMPTZ '2026-10-13 04:30:00+00','actif') t;
--  B est appelé avec « maintenant » au 14 : la garde du 12 à 18:00 n'a que 10 h
--  30 au 13 à 04:30 → elle n'est PAS encore un oubli (seuil 12 h). Vérifier qu'un
--  moteur honnête NE s'invente pas avant l'heure compte autant que le plafond.
SELECT json_agg(t) AS actif_b FROM public.encheck_cloturer_pivotable('55555555-5555-5555-5555-555555555555', TIMESTAMPTZ '2026-10-13 04:30:00+00','actif') t;
DO $$
DECLARE n int;
BEGIN
  SELECT count(*) INTO n FROM public.attendances WHERE employee_id='22222222-2222-2222-2222-222222222223' AND is_auto_closed;
  IF n <> 0 THEN RAISE EXCEPTION 'ÉCHEC seuil d''oubli : B clôturé après seulement 10 h 30 (il faut %s h)', (SELECT valeur FROM public.encheck_reglages_pointage WHERE cle='oubli_sortie_heures' AND enterprise_id IS NULL); END IF;
  RAISE NOTICE 'ok_oubli_pas_encore_mur := true (10 h 30 < 12 h : on n''invente rien encore)';
END $$;
SELECT json_agg(t) AS actif_b_mur FROM public.encheck_cloturer_pivotable('55555555-5555-5555-5555-555555555555', TIMESTAMPTZ '2026-10-14 04:30:00+00','actif') t;
SELECT json_agg(t) AS actif_c FROM public.encheck_cloturer_pivotable('66666666-6666-6666-6666-666666666666', TIMESTAMPTZ '2026-10-13 04:30:00+00','actif') t;
DO $$
DECLARE e record; n int;
BEGIN
  -- A : Niveau 3 (grille par défaut) = 17:00 locales
  SELECT * INTO e FROM public.attendances WHERE employee_id='22222222-2222-2222-2222-222222222222' AND is_auto_closed;
  IF e.id IS NULL THEN RAISE EXCEPTION 'ÉCHEC actif : aucune sortie estimée écrite pour A'; END IF;
  IF e.method <> 'auto_close' THEN RAISE EXCEPTION 'ÉCHEC doctrine §4.1 : method=% (auto_close en dur, jamais la méthode du badge d''entrée)', e.method; END IF;
  IF e.location_lat IS NOT NULL OR e.location_lng IS NOT NULL THEN RAISE EXCEPTION 'ÉCHEC doctrine : un GPS recopié sur une estimation (jamais de fausse preuve de présence)'; END IF;
  IF e.estimation_validee_le IS NOT NULL THEN RAISE EXCEPTION 'ÉCHEC doctrine : une estimation ne naît pas validée'; END IF;
  IF e.anomalie IS DISTINCT FROM 'sortie_presumee' THEN RAISE EXCEPTION 'ÉCHEC marquage : anomalie=% (sortie_presumee attendu)', e.anomalie; END IF;
  IF e.check_time <> TIMESTAMPTZ '2026-10-12 16:00:00+00' THEN RAISE EXCEPTION 'ÉCHEC niveau 3 : cible=% (17:00 locales, soit 16:00Z, attendues)', e.check_time; END IF;
  IF e.estimation_niveau <> 3 THEN RAISE EXCEPTION 'ÉCHEC traçabilité : estimation_niveau=% (3 attendu)', e.estimation_niveau; END IF;

  -- B : 14 h annoncées → 12 h inventées maximum
  SELECT count(*) INTO n FROM public.attendances WHERE employee_id='22222222-2222-2222-2222-222222222223'
    AND is_auto_closed AND check_time = TIMESTAMPTZ '2026-10-12T17:00:00+00' + interval '12 hours';
  IF n <> 1 THEN RAISE EXCEPTION 'ÉCHEC plafond §4.3 : la garde de 14 h n''a pas été ramenée à 12 h'; END IF;

  -- C : rien de connu → entrée + 8 h (et surtout pas 23:59 ni un horaire deviné)
  SELECT count(*) INTO n FROM public.attendances WHERE employee_id='22222222-2222-2222-2222-222222222224'
    AND is_auto_closed AND check_time = TIMESTAMPTZ '2026-10-12T09:00:00+00' + interval '8 hours';
  IF n <> 1 THEN RAISE EXCEPTION 'ÉCHEC niveau 5 : sans grille ni réglage, la seule réponse possible est entrée+8h'; END IF;
  RAISE NOTICE 'ok_actif := true (marquage, méthode, plafond, niveaux 3 et 5)';
END $$;

-- ═══ 3. Idempotence : deux passages du cron ne doivent jamais doubler une estimation ═══
SELECT public.encheck_pipeline_cloture('11111111-1111-1111-1111-111111111111','actif',TIMESTAMPTZ '2026-10-13 04:30:00+00') AS rejouant;
DO $$
DECLARE n int;
BEGIN
  SELECT count(*) INTO n FROM public.attendances WHERE employee_id='22222222-2222-2222-2222-222222222222' AND is_auto_closed;
  IF n <> 1 THEN RAISE EXCEPTION 'ÉCHEC idempotence : % sorties estimées pour la même entrée (1 attendue)', n; END IF;
  SELECT count(*) INTO n FROM public.encheck_clotures_estimees WHERE enterprise_id='11111111-1111-1111-1111-111111111111';
  IF n <> 1 THEN RAISE EXCEPTION 'ÉCHEC idempotence : % consignations (1 attendue, UNIQUE(attendance_in_id))', n; END IF;
  RAISE NOTICE 'ok_idempotence := true';
END $$;

-- ═══ 4. Réconciliation : la vraie sortie arrive APRÈS l'estimation ═══
INSERT INTO public.attendances (employee_id, enterprise_id, check_time, check_type, method) VALUES
 ('22222222-2222-2222-2222-222222222222','11111111-1111-1111-1111-111111111111','2026-10-12T19:40:00+00','out','qr_code');
DO $$
DECLARE e record; c record; n int;
BEGIN
  SELECT * INTO e FROM public.attendances WHERE is_auto_closed AND employee_id='22222222-2222-2222-2222-222222222222';
  IF e.id IS NULL THEN RAISE EXCEPTION 'ÉCHEC réconciliation : l''estimation a été SUPPRIMÉE au lieu d''être marquée'; END IF;
  IF e.estimation_remplacee_le IS NULL THEN RAISE EXCEPTION 'ÉCHEC réconciliation : le trigger n''a pas posé estimation_remplacee_le'; END IF;
  IF e.anomalie IS DISTINCT FROM 'sortie_presumee_remplacee' THEN RAISE EXCEPTION 'ÉCHEC réconciliation : anomalie=%', e.anomalie; END IF;
  SELECT count(*) INTO n FROM public.attendances
   WHERE check_time::date = DATE '2026-10-12' AND employee_id='22222222-2222-2222-2222-222222222222';
  IF n <> 3 THEN RAISE EXCEPTION 'ÉCHEC réconciliation : % lignes pour A ce jour-là (3 attendues : entrée, estimation, vrai badge) — on ne supprime rien', n; END IF;
  SELECT * INTO c FROM public.encheck_clotures_estimees
   WHERE employee_id='22222222-2222-2222-2222-222222222222' AND jour_travail = DATE '2026-10-12';
  IF c.applique THEN RAISE EXCEPTION 'ÉCHEC réconciliation : la consignation doit passer en applique=false (elle n''a plus de valeur payée)'; END IF;
  RAISE NOTICE 'ok_reconciliation_trigger := true';
END $$;
SELECT public.encheck_reconcilier_estimations('11111111-1111-1111-1111-111111111111') AS reconcil_balayage;
SELECT niveau, sortie_estimee, sortie_reelle, ecart_minutes, applique
  FROM public.encheck_clotures_estimees ORDER BY maj_le DESC LIMIT 4;

-- ═══ 5. Tranchage humain : valider / écarter, avec refus pour un non-admin ═══
SELECT public.encheck_estimation_statuer(
         ARRAY[(SELECT a.id FROM public.attendances a
                 WHERE a.employee_id='22222222-2222-2222-2222-222222222223' AND a.is_auto_closed)],
         'valider', 'nuit confirmée par le contremaître') AS valide;
DO $$
DECLARE a record; n int;
BEGIN
  SELECT * INTO a FROM public.attendances WHERE employee_id='22222222-2222-2222-2222-222222222223' AND is_auto_closed;
  IF a.estimation_validee_le IS NULL THEN RAISE EXCEPTION 'ÉCHEC statuer : validation non enregistrée (0 ligne touchée)'; END IF;
  IF a.method <> 'auto_close' THEN RAISE EXCEPTION 'ÉCHEC doctrine : valider ne doit PAS réécrire method (=%)', a.method; END IF;
  SELECT count(*) INTO n FROM public.encheck_pointages_journal WHERE action='estimation_validee';
  IF n <> 1 THEN RAISE EXCEPTION 'ÉCHEC audit : % ligne(s) de journal pour la validation (1 attendue)', n; END IF;
  RAISE NOTICE 'ok_statuer_admin := true';
END $$;
DO $$
DECLARE oid uuid; avant int; apres int;
BEGIN
  SELECT id INTO oid FROM public.attendances WHERE is_auto_closed AND estimation_remplacee_le IS NOT NULL LIMIT 1;
  IF oid IS NULL THEN RAISE NOTICE 'ok_statuer_remplacee := skipped (aucune estimation remplacée en base)'; RETURN; END IF;
  SELECT count(*) INTO avant FROM public.attendances WHERE id = oid AND estimation_validee_le IS NOT NULL;
  BEGIN
    PERFORM public.encheck_estimation_statuer(ARRAY[oid], 'valider', 'tenter de valider une estimation périmée');
  EXCEPTION WHEN others THEN RAISE NOTICE '  refus attendu : %', SQLERRM;
  END;
  SELECT count(*) INTO apres FROM public.attendances WHERE id = oid AND estimation_validee_le IS NOT NULL;
  IF apres <> avant THEN RAISE EXCEPTION 'ÉCHEC : une estimation remplacée ne doit plus être validable (elle est périmée)'; END IF;
  RAISE NOTICE 'ok_statuer_remplacee := true';
END $$;

-- un « reader » ne tranche pas la paie
DO $$
DECLARE oid uuid;
BEGIN
  SELECT id INTO oid FROM public.attendances WHERE is_auto_closed LIMIT 1;
  IF oid IS NULL THEN RAISE NOTICE 'ok_rls_reader := skipped'; RETURN; END IF;
  SET ROLE authenticated; SET app.jwt_email = 'autre@test.local';
  BEGIN
    UPDATE public.attendances SET estimation_validee_le = now() WHERE id = oid;
    RESET ROLE;
    RAISE EXCEPTION 'ÉCHEC RLS : un reader a pu écrire directement dans attendances';
  EXCEPTION WHEN insufficient_privilege THEN
    RESET ROLE;
    RAISE NOTICE 'ok_rls_reader := true (écriture refusée)';
  END;
END $$;

-- le navigateur ne peut ni écrire les journaux, ni déclencher une clôture
SET ROLE authenticated;
DO $$
BEGIN
  BEGIN
    INSERT INTO public.encheck_pointages_journal (enterprise_id, action, motif) VALUES (NULL,'x','y');
    RAISE EXCEPTION 'ÉCHEC : le navigateur peut écrire dans le journal censé être append-only';
  EXCEPTION WHEN insufficient_privilege THEN RAISE NOTICE 'ok_journal_append_only := true';
  END;
  BEGIN
    PERFORM public.encheck_pipeline_cloture('11111111-1111-1111-1111-111111111111','actif');
    RAISE EXCEPTION 'ÉCHEC : le navigateur peut déclencher une clôture (écriture massive)';
  EXCEPTION WHEN insufficient_privilege THEN RAISE NOTICE 'ok_pipeline_revoque := true';
  END;
  BEGIN
    PERFORM public.encheck_alertes_scan('11111111-1111-1111-1111-111111111111');
    RAISE NOTICE 'ok_alias_alertes := true (balayer oui, écrire non)';
  EXCEPTION WHEN insufficient_privilege THEN
    RAISE EXCEPTION 'ÉCHEC : l''alias de balayage doit rester appelable depuis l''app';
  END;
END $$;
RESET ROLE;

-- ═══ 6. Rebonds QR : marquage sur motif prouvable, aucune suppression, idempotent ═══
INSERT INTO public.attendances (employee_id, enterprise_id, check_time, check_type, method) VALUES
 ('22222222-2222-2222-2222-222222222222','11111111-1111-1111-1111-111111111111','2026-10-13T07:00:00+00','in','qr_code'),
 ('22222222-2222-2222-2222-222222222222','11111111-1111-1111-1111-111111111111','2026-10-13T07:00:20+00','out','qr_code'),
 ('22222222-2222-2222-2222-222222222222','11111111-1111-1111-1111-111111111111','2026-10-13T07:00:35+00','in','qr_code'),
 ('22222222-2222-2222-2222-222222222222','11111111-1111-1111-1111-111111111111','2026-10-13T16:00:00+00','out','qr_code');
SELECT json_agg(t) AS apercu_rebonds FROM public.encheck_rebonds_neutraliser('11111111-1111-1111-1111-111111111111', false) t;
DO $$
DECLARE n int;
BEGIN
  SELECT count(*) INTO n FROM public.encheck_attendances_pour_test(); -- volontairement faux : doit échouer
  RAISE EXCEPTION 'ÉCHEC du harnais : cette fonction ne devrait pas exister';
EXCEPTION WHEN undefined_function THEN
  RAISE NOTICE 'ok_negatif := true (le harnais détecte bien les erreurs)';
END $$;
SELECT json_agg(t) AS rebonds_appliques FROM public.encheck_rebonds_neutraliser('11111111-1111-1111-1111-111111111111', true) t;
DO $$
DECLARE n int;
BEGIN
  SELECT count(*) INTO n FROM public.attendances WHERE check_time::date = DATE '2026-10-13'
    AND employee_id='22222222-2222-2222-2222-222222222222';
  IF n <> 4 THEN RAISE EXCEPTION 'ÉCHEC rebonds : % lignes pour A (4 attendues : on ne supprime JAMAIS un pointage)', n; END IF;
  SELECT count(*) INTO n FROM public.attendances WHERE check_time::date = DATE '2026-10-13' AND anomalie = 'rebond_qr';
  IF n <> 2 THEN RAISE EXCEPTION 'ÉCHEC rebonds : % lignes marquées (2 attendues : le faux OUT et le re-scan)', n; END IF;
  SELECT count(*) INTO n FROM public.encheck_pointages_journal WHERE action = 'rebond_neutralise';
  IF n <> 1 THEN RAISE EXCEPTION 'ÉCHEC rebonds : % journalisation (1 attendue)', n; END IF;
  -- second passage : rien de neuf (le OUT est déjà marqué → le motif ne matche plus)
  PERFORM public.encheck_rebonds_neutraliser('11111111-1111-1111-1111-111111111111', true);
  SELECT count(*) INTO n FROM public.encheck_pointages_journal WHERE action = 'rebond_neutralise';
  IF n <> 1 THEN RAISE EXCEPTION 'ÉCHEC idempotence rebonds : le second passage a rejoué (% lignes de journal)', n; END IF;
  RAISE NOTICE 'ok_rebonds := true (marquage, aucune suppression, idempotent)';
END $$;
SELECT public.encheck_nettoyer_rebonds_qr('11111111-1111-1111-1111-111111111111') AS ancien_nettoyage_neutre;
DO $$
DECLARE n int;
BEGIN
  SELECT count(*) INTO n FROM public.attendances WHERE check_time::date = DATE '2026-10-13'
    AND employee_id='22222222-2222-2222-2222-222222222222';
  IF n <> 4 THEN RAISE EXCEPTION 'ÉCHEC neutralisation de l''ancien nettoyage : % lignes pour A (4 attendues — cette fonction ne doit PLUS rien effacer)', n; END IF;
  RAISE NOTICE 'ok_ancien_nettoyage_neutre := true';
END $$;

-- ═══ 6bis. Le navigateur d'un NON-admin ne peut pas faire tourner le moteur ═══
SELECT count(*) AS alertes_avant_scan_non_admin FROM public.encheck_alertes;
DO $$
DECLARE n integer;
BEGIN
  SET ROLE authenticated; SET app.jwt_email = 'autre@test.local';   -- role='reader'
  SELECT public.encheck_alertes_scan('11111111-1111-1111-1111-111111111111') INTO n;
  RESET ROLE; SET app.jwt_email = 'admin@test.local';
  IF n <> 0 THEN RAISE EXCEPTION 'ÉCHEC garde : un reader a déclenché un balayage (retour=%, 0 attendu)', n; END IF;
  RAISE NOTICE 'ok_garde_scan_non_admin := true';
END $$;
DO $$
DECLARE n integer;
BEGIN
  SET ROLE authenticated; SET app.jwt_email = 'admin@test.local';   -- super_admin de A
  SELECT public.encheck_alertes_scan('11111111-1111-1111-1111-111111111111') INTO n;
  RESET ROLE;
  IF n IS NULL THEN RAISE EXCEPTION 'ÉCHEC garde : le balayage d''un admin doit répondre (pas NULL)'; END IF;
  RAISE NOTICE 'ok_garde_scan_admin := true ( purge=% )', n;
END $$;
DO $$
DECLARE n integer;
BEGIN
  -- pg_cron, lui, na pas de JWT : il doit passer, sinon la garde vide le cron.
  SET ROLE service_role;
  SELECT public.encheck_alertes_scan('11111111-1111-1111-1111-111111111111') INTO n;
  RESET ROLE;
  IF n IS NULL THEN RAISE EXCEPTION 'ÉCHEC : le chemin cron (sans JWT) ne doit pas être bloqué'; END IF;
  RAISE NOTICE 'ok_garde_cron := true';
END $$;

-- ═══ 7. Alertes : pas de correspondance par nom, entreprise obligatoire, preuve avant suppression ═══
INSERT INTO public.encheck_alertes (enterprise_id, employee_id, type, titre, jour, created_at) VALUES
 -- A : alerte de retard FAUSSE (le badge du 10 est à 08:00 pile, tolérance 15 min)
 ('11111111-1111-1111-1111-111111111111','22222222-2222-2222-2222-222222222222','retard','Retard à l''arrivée', DATE '2026-10-10', now() - interval '3 days'),
 -- C : même titre, autre entreprise → ne doit PAS être touchée par la purge de A
 ('66666666-6666-6666-6666-666666666666','22222222-2222-2222-2222-222222222224','retard','Retard à l''arrivée', DATE '2026-10-10', now() - interval '3 days');
SELECT json_agg(t) AS purge_apercu   FROM public.encheck_alertes_purger('11111111-1111-1111-1111-111111111111', false) t;
DO $$
DECLARE n int;
BEGIN
  SELECT count(*) INTO n FROM public.encheck_alertes WHERE enterprise_id='11111111-1111-1111-1111-111111111111';
  IF n <> 1 THEN RAISE EXCEPTION 'ÉCHEC purge : un aperçu (p_appliquer=false) a supprimé des alertes (% restantes, 1 attendue)', n; END IF;
  RAISE NOTICE 'ok_apercu_sans_destruction := true';
END $$;
SELECT json_agg(t) AS purge_appliquee FROM public.encheck_alertes_purger('11111111-1111-1111-1111-111111111111', true) t;
DO $$
DECLARE nrest int; nautre int; nj int;
BEGIN
  SELECT count(*) INTO nrest FROM public.encheck_alertes WHERE enterprise_id='11111111-1111-1111-1111-111111111111';
  SELECT count(*) INTO nautre FROM public.encheck_alertes WHERE enterprise_id='66666666-6666-6666-6666-666666666666';
  IF nautre <> 1 THEN RAISE EXCEPTION 'ÉCHEC cloisonnement : la purge d''UNE entreprise a touché une AUTRE (% alertes chez C, 1 attendue)', nautre; END IF;
  SELECT count(*) INTO nj FROM public.encheck_pointages_journal WHERE action='alerte_supprimee';
  IF nj <> (1 - nrest) THEN RAISE EXCEPTION 'ÉCHEC preuve : % alerte(s) supprimée(s) chez A mais % snapshot(s) — toute suppression doit être archivée', 1 - nrest, nj; END IF;
  IF nrest <> 0 THEN RAISE WARNING '  (la fausse alerte de retard de A n''a pas été recyclée : vérifier encheck_journee_recalculee)'; END IF;
  RAISE NOTICE 'ok_purge := true (restantes=% chez A, snapshots=%, autre entreprise intacte)', nrest, nj;
END $$;
SELECT motif AS refus_sans_entreprise FROM public.encheck_alertes_purger(NULL);
SELECT public.encheck_assainir_alertes_horaires('11111111-1111-1111-1111-111111111111') AS assainir_neutre;
DO $$
DECLARE n int;
BEGIN
  SELECT count(*) INTO n FROM public.encheck_alertes;
  IF n < 1 THEN RAISE EXCEPTION 'ÉCHEC neutralisation : encheck_assainir_alertes_horaires a encore supprimé des alertes (% restantes)', n; END IF;
  RAISE NOTICE 'ok_assainir_neutre := true';
END $$;
-- le générateur historique n'existe pas dans ce squelette : le scan doit s'excuser, pas casser
SELECT public.encheck_alertes_scan('11111111-1111-1111-1111-111111111111') AS scan_generateur_absent;
SELECT public.encheck_alertes_controler('11111111-1111-1111-1111-111111111111') AS alias_alias_sur;

-- ═══ 8. Grille : personnalisée > liée > défaut > RIEN (jamais de grille fantôme) ═══
INSERT INTO public.employee_schedules (employee_id, enterprise_id, schedule_id, use_custom_hours, custom_start_time, custom_end_time, custom_bascule, valide_du, is_active)
VALUES ('22222222-2222-2222-2222-222222222222','11111111-1111-1111-1111-111111111111',
        '33333333-3333-3333-3333-333333333333', true, '07:30','19:30', 240, DATE '2026-01-01', true);
DO $$
DECLARE g jsonb;
BEGIN
  SELECT public.encheck_grille_au_jour('22222222-2222-2222-2222-222222222222',
         '11111111-1111-1111-1111-111111111111', DATE '2026-10-14') INTO g;
  IF g->>'source' <> 'custom' OR g->>'end_time' <> '19:30' THEN
    RAISE EXCEPTION 'ÉCHEC grille personnalisée : source=% fin=%', g->>'source', g->>'end_time';
  END IF;
  IF (g->>'explicite')::boolean IS DISTINCT FROM true THEN
    RAISE EXCEPTION 'ÉCHEC doctrine : un horaire personnel est une décision écrite → Niveau 1 (% )', g;
  END IF;
  RAISE NOTICE 'ok_grille_custom := true';
END $$;
UPDATE public.employee_schedules SET use_custom_hours = false WHERE employee_id='22222222-2222-2222-2222-222222222222';
DO $$
DECLARE g jsonb;
BEGIN
  SELECT public.encheck_grille_au_jour('22222222-2222-2222-2222-222222222222',
         '11111111-1111-1111-1111-111111111111', DATE '2026-10-14') INTO g;
  IF g->>'source' <> 'liee' OR g->>'end_time' <> '17:00' THEN
    RAISE EXCEPTION 'ÉCHEC grille liée : source=% fin=%', g->>'source', g->>'end_time';
  END IF;
  IF (g->>'explicite')::boolean IS DISTINCT FROM true THEN
    RAISE EXCEPTION 'ÉCHEC doctrine : une grille LIÉE à l''employé est Niveau 1, sinon le Niveau 2 ne s exécuterait jamais';
  END IF;
  RAISE NOTICE 'ok_grille_liee := true';
END $$;
DELETE FROM public.employee_schedules WHERE employee_id='22222222-2222-2222-2222-222222222222';
DO $$
DECLARE g jsonb; gc jsonb;
BEGIN
  SELECT public.encheck_grille_au_jour('22222222-2222-2222-2222-222222222222',
         '11111111-1111-1111-1111-111111111111', DATE '2026-10-14') INTO g;
  IF g->>'source' <> 'defaut' OR (g->>'explicite')::boolean THEN
    RAISE EXCEPTION 'ÉCHEC : la grille PAR DÉFAUT ne doit pas être « explicite » (source=% explicite=%)', g->>'source', g->>'explicite';
  END IF;
  SELECT public.encheck_grille_au_jour('22222222-2222-2222-2222-222222222224',
         '66666666-6666-6666-6666-666666666666', DATE '2026-10-14') INTO gc;
  IF (gc->>'trouvee')::boolean THEN
    RAISE EXCEPTION 'ÉCHEC grille fantôme : une entreprise sans grille doit répondre trouvee=false (% )', gc;
  END IF;
  RAISE NOTICE 'ok_grille_defaut_sans_fantome := true';
END $$;
-- la vitre de compatibilité (celle que le mobile appelle) doit rendre le même jour
SELECT json_agg(x) AS vitre_compat FROM (
  SELECT * FROM public.encheck_resoudre_grille_employe(
    '22222222-2222-2222-2222-222222222222','11111111-1111-1111-1111-111111111111', DATE '2026-10-14')) x;

-- ═══ 9. Statistiques du mode ombre (le chiffre que l'arbitre lira) ═══
SELECT * FROM public.encheck_clotures_statistiques(NULL, 45);
SELECT to_jsonb(public.encheck_journee_recalculee('22222222-2222-2222-2222-222222222222',
        '11111111-1111-1111-1111-111111111111', DATE '2026-10-12')) AS journee_recalculee;

-- ═══ 10. Réglages : l'entreprise écrase le global, et le plafond suit ═══
INSERT INTO public.encheck_reglages_pointage (enterprise_id, cle, valeur)
VALUES ('11111111-1111-1111-1111-111111111111','plafond_invention_heures','7');
SELECT public.encheck_seuil('11111111-1111-1111-1111-111111111111','plafond_invention_heures',12) AS plafond_entreprise,
       public.encheck_seuil('55555555-5555-5555-5555-555555555555','plafond_invention_heures',12) AS plafond_global;
DO $$
DECLARE n int;
BEGIN
  UPDATE public.encheck_reglages_pointage SET valeur = '"actif"'::jsonb
   WHERE cle='mode_estimation' AND enterprise_id IS NULL;
  IF public.encheck_mode_estimation('55555555-5555-5555-5555-555555555555') <> 'actif' THEN
    RAISE EXCEPTION 'ÉCHEC réglage : le mode global changé en « actif » n''est pas lu (% )',
      public.encheck_mode_estimation('55555555-5555-5555-5555-555555555555');
  END IF;
  -- un employé FRAIS (D) chez A, une seule entrée orpheline : la sélection ne
  -- retient que LE dernier pointage de chacun, donc un salarié vierge est le seul
  -- moyen propre de tester un plafond sans interférer avec les cas précédents.
  INSERT INTO public.employees (id, enterprise_id, matricule, first_name, last_name, is_active) VALUES
   ('22222222-2222-2222-2222-222222222225','11111111-1111-1111-1111-111111111111','MTX-4','Fatou','D.',true)
   ON CONFLICT (id) DO NOTHING;
  INSERT INTO public.attendances (employee_id, enterprise_id, check_time, check_type, method) VALUES
   ('22222222-2222-2222-2222-222222222225','11111111-1111-1111-1111-111111111111','2026-10-08T04:00:00+00','in','qr_code');
  PERFORM public.encheck_cloturer_pivotable('11111111-1111-1111-1111-111111111111', TIMESTAMPTZ '2026-10-13 04:30:00+00','actif');
  SELECT count(*) INTO n FROM public.attendances
   WHERE check_time = TIMESTAMPTZ '2026-10-08T04:00:00+00' + interval '7 hours' AND is_auto_closed;
  IF n = 0 THEN
    RAISE EXCEPTION 'ÉCHEC seuil d''entreprise : cible attendue à 11:00Z. détail consignation: %',
      (SELECT coalesce(json_agg(row_to_json(t))::text,'rien') FROM public.encheck_clotures_estimees t
        WHERE t.employee_id='22222222-2222-2222-2222-222222222225');
  END IF;
  IF n <> 1 THEN RAISE EXCEPTION 'ÉCHEC seuil d''entreprise : le plafond de 7 h devait borner la cible à 11:00Z'; END IF;
  RAISE NOTICE 'ok_seuil_entreprise := true';
END $$;

-- ═══ 11. Hook du Niveau 2 : un corps vide ne doit JAMAIS bloquer la clôture ═══
SELECT to_jsonb(t) AS hook_dev1 FROM public.encheck_estimer_sortie_comportementale(
  '22222222-2222-2222-2222-222222222222','11111111-1111-1111-1111-111111111111',
  TIMESTAMPTZ '2026-10-12 07:02:00+00', 90, 28, 14, 5, 45, 30, 12) t;
DO $$
DECLARE n int;
BEGIN
  SELECT count(*) INTO n FROM public.encheck_clotures_estimees WHERE niveau LIKE '3-%' OR niveau LIKE '5-%';
  IF n < 1 THEN RAISE EXCEPTION 'ÉCHEC cascade : sans Niveau 2, les niveaux inférieurs doivent quand même répondre'; END IF;
  RAISE NOTICE 'ok_hook_dev1_traverse := true (% consignations aux niveaux 3/5)', n;
END $$;

-- ═══ 12. Carte des fonctions et gardes du catalogue ═══
SELECT count(*) AS fonctions_cartees FROM public.encheck_carte_fonctions;
SELECT proname, prosecdef AS definer, provolatile, coalesce(array_to_string(proconfig,','),'-') AS config
  FROM pg_proc WHERE proname IN ('encheck_cloturer_pivotable','encheck_estimation_statuer',
        'encheck_alertes_controler','encheck_alertes_scan','encheck_rebonds_neutraliser',
        'encheck_estimation_remplacer','encheck_alerte_journaliser') ORDER BY proname;
SELECT has_function_privilege('authenticated','public.encheck_cloturer_pivotable(uuid,timestamptz,text)','EXECUTE') AS nav_cloture,
       has_function_privilege('authenticated','public.encheck_estimation_statuer(uuid[],text,text)','EXECUTE')       AS nav_statuer,
       has_function_privilege('authenticated','public.encheck_alertes_controler(uuid)','EXECUTE')                      AS nav_alias_scan;
SELECT count(*) AS trigger_reconciliation_pose FROM pg_trigger t JOIN pg_class c ON c.oid = t.tgrelid
 WHERE t.tgname='trg_attendances_reconcilier_estimation' AND c.relname='attendances' AND NOT t.tgisinternal;
SELECT count(*) AS index_anti_doublon FROM pg_indexes WHERE indexname='attendances_estimation_unique';
SELECT count(*) AS jobs_cron_visibles FROM (SELECT 1) x WHERE to_regclass('cron.job') IS NOT NULL;
