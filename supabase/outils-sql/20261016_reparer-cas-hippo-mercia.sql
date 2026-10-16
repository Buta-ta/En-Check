-- =============================================================================
-- RÉPARATION DES LIGNES CORROMPUES — cas Hippo BIYOKILA et Mercia MAYOUMA
--                                    (pointages du 15-16/10/2026)
-- Auteur  : IA ARBITRE — arbitrage n°2/3, VALIDÉ par le commanditaire.
-- À JOUER  : APRÈS le déploiement du code et APRÈS la migration
--            20261016000002_garde_nuit_garde_fous_double_lecture.sql.
--
-- Ce script ne touche QUE les lignes identifiées des deux dossiers. Les
-- commentaires racontent ce qui s'est passé, pour que la preuve reste lisible
-- même dans 6 mois. À rejouer : c'est idempotent (les UPDATE ne visent que ces
-- horaires précis).
--
-- ─── Ce qui a été constaté ─────────────────────────────────────────────────
-- HIPPO BIYOKILA (PHA-0001), pointage du 15/10 :
--   • 08:54:42 IN (GPS faible) ; 12:13:20 OUT ; 17:41:14 IN.
--   • 18:38:18 OUT corrigé par l'admin → 18:24:51 (confirmé dans l'historique),
--     mais sa LIGNE de pointage n'avait pas été réécrite (18:38:18 toujours en
--     base) — le bouton « Confirmer » de la fiche « Sortie présumée » enregistre
--     l'heurE mais pas l'heurE de la LIGNE (faille F1 de l'app pointage).
--   • 21:58:12 OUT (contre-enregistrement de l'out corrigé, refuse 18:24:51) —
--     la journée s'est nouée à 21:58:12 (4h16m55s) au lieu de 18:24:51 (43s).
--   • Alertes « Départ très tardif » et « Shift anormalement long » déclenchées
--     sur ces erreurs, notifiées le 16 à 14:25 (PHI a répondu 10 min plus tard :
--     il n'a pas compris de quoi il s'agissait).
--   • Le 16/10 : 08:54:11 IN, 12:15:34 OUT (Hippo repassait dépanner), et
--     17:30:15 IN TROUVÉ dans l'historique MAIS ABSENT de `attendances` :
--     le « Confirmer » de la 2e estimation l'avait écrasé (faille F1).
--     La journée du 16 est restée OUVERTE toute la nuit (estimation 22:12
--     « annulée par une modification »).
--     → sortie de réparation à 19:21:42 (≈ 2 h de présence réelle selon les
--       témoignages de BIYOKILA), calcul plus 30 min de marge.
--   • Le 17/10 à 01:12:51 : une sortie a été ENREGISTRÉE DANS LE FUTUR puis
--     supprimée — en réalité le bouton « J+1 » de la fiche « Modifier » avait
--     ajouté un jour à la date (16 → 17) pendant une correction de la ligne
--     17:30:15. Un vrai « in » a été réaffiché à 10:37:07 ce jour-là.
--
-- MERCIA MAYOUMA (PHA-0005), pointage du 16/10 :
--   • 08:56:54 IN ; 12:16:32 OUT ; 12:46:25 IN.
--   • La sortie du soir a été laissée NON BADGÉE (Mercia est partie à 16h :
--     son poste ne couvre que le jour).
--   • Estimation générée : 17:00:00 (« session fermeur 17:00 », confiance
--     moyenne, 23 exemples, iqr 0). Après ÉCARTER, le moteur en a RÉ-INSÉRÉ
--     une autre dans la foulée (bug n°5) — l'admin a été obligé d'Écarter deux
--     fois, sans savoir ce qui se passait.
--
-- ─── Ce qu'on répare ───────────────────────────────────────────────────────
--   1. HIPPO 16/10 : sortie 17:30:15 → 19:21:42 (redevient la sortie réelle de
--      la session de l'après-midi ; la journée du 16 se ferme pour de vrai).
--   2. HIPPO 16/10 : tous les AUTRES « out » (présumés ou contre-enregistrements)
--      de cette session deviennent `sortie_presumee_remplacee` — non payés,
--      jamais comptés, conservés pour l'audit (le comportement du pipeline
--      corrigé le ferait lui-même lors de la prochaine réconciliation).
--   3. HIPPO 15/10 : la ligne 18:38:18 est réécrite à 18:24:51 (la correction
--      réelle de l'admin, confirmée dans `attendance_history`) ; les estimations
--      17:00 et 22:12 deviennent `sortie_presumee_remplacee` ; la journée reste
--      (à tort) sur 21:58:12 — voir note en bas pour la version « dur ».
--   4. MERCIA 16/10 : les estimations 17:00 (et toute estimation de la session
--      12:46 → fin) deviennent `sortie_presumee_rejetee` (l'admin a ÉCARTÉ :
--      c'est son arbitrage, il est définitif). Journée comptée 12:46:25 → 17:00
--      est ramenée à une durée honnête : comptée 0 (pas de sortie réelle).
--   5. Journal : chaque réparation est écrite dans `encheck_pointages_journal`
--      (audit) et `attendance_history` (preuve lecture seule).
-- =============================================================================

BEGIN;

-- ════════════════════════════════════════════════════════════════════════════
-- RÉPARATION 1+2+3 — HIPPO BIYOKILA (PHA-0001)
-- ════════════════════════════════════════════════════════════════════════════

-- 1) La sortie réelle du 16/10 : 17:30:15 → 19:21:42 (avant : dans le futur
--    du jour J et introuvable dans les paires ; maintenant : la journée se
--    ferme sur une durée vraie ≈ 2 h).
UPDATE public.attendances
   SET check_time = '2026-10-16 19:21:42+00',
       notes = COALESCE(notes || ' — ', '') ||
               'Réparation arbitrage n°3 (16/10/2026) : sortie réaffichée à 17:30:15 puis placée à 19:21:42 (≈2 h de présence réelle constatée) — l''avait été dévorée par le « Confirmer » de l''estimation (faille F1).'
 WHERE employee_id = '120a48c7-02c8-46c5-9d06-b1d734cb3f72'
   AND check_type = 'out'
   AND check_time = '2026-10-16 17:30:15+00';

-- 2) Les autres « out » de la session du 16 après-midi (estimations 22:12 et
--    consorts, contre-enregistrements) : remplacées — non payées, conservées.
UPDATE public.attendances
   SET anomalie = 'sortie_presumee_remplacee',
       estimation_remplacee_le = now(),
       estimation_remplacee_par_id = (
         SELECT id FROM public.attendances
          WHERE employee_id = '120a48c7-02c8-46c5-9d06-b1d734cb3f72'
            AND check_type = 'out'
            AND check_time = '2026-10-16 19:21:42+00'
          LIMIT 1)
 WHERE employee_id = '120a48c7-02c8-46c5-9d06-b1d734cb3f72'
   AND check_type = 'out'
   AND check_time > '2026-10-16 12:46:25+00'
   AND check_time <> '2026-10-16 19:21:42+00';

-- 3a) 15/10 : la ligne de pointage de la sortie corrigée par l'admin —
--     18:38:18 n'avait pas été réécrite au moment de la correction 18:24:51.
UPDATE public.attendances
   SET check_time = '2026-10-15 18:24:51+00',
       notes = COALESCE(notes || ' — ', '') ||
               'Réparation arbitrage n°3 : le « Confirmer » du 16/10 avait enregistré 18:24:51 dans l''estimation mais PAS dans cette ligne (faille F1) — réalignée sur la correction de l''admin.'
 WHERE employee_id = '120a48c7-02c8-46c5-9d06-b1d734cb3f72'
   AND check_type = 'out'
   AND check_time = '2026-10-15 18:38:18+00';

-- 3b) 15/10 : les estimations du jour (17:00:00 et 22:12:09) — remplacées par
--     la réalité (le contre-enregistrement 21:58:12 a « gagné » la journée,
--     c'est l'état actuel de la base ; voir note « version dur » si on veut
--     trancher sur 18:24:51).
UPDATE public.attendances
   SET anomalie = 'sortie_presumee_remplacee',
       estimation_remplacee_le = now(),
       estimation_remplacee_par_id = (
         SELECT id FROM public.attendances
          WHERE employee_id = '120a48c7-02c8-46c5-9d06-b1d734cb3f72'
            AND check_type = 'out'
            AND check_time = '2026-10-15 21:58:12+00'
          LIMIT 1)
 WHERE employee_id = '120a48c7-02c8-46c5-9d06-b1d734cb3f72'
   AND check_type = 'out'
   AND is_auto_closed = true
   AND check_time >= '2026-10-15 00:00:00+00'
   AND check_time <  '2026-10-16 00:00:00+00';

-- ════════════════════════════════════════════════════════════════════════════
-- RÉPARATION 4 — MERCIA MAYOUMA (PHA-0005), 16/10
-- ════════════════════════════════════════════════════════════════════════════
-- L'admin a ÉCARTÉ les estimations 17:00 : décision humaine, définitive.
-- `sortie_presumee_rejetee` = écartée par l'admin — non payée, jamais comptée,
-- jamais re-proposée (le pipeline corrigé ne ré-insérera plus rien après un
-- Écarter : bug n°5 réglé par la migration 000002 + le code du 16/10).
UPDATE public.attendances
   SET anomalie = 'sortie_presumee_rejetee',
       estimation_remplacee_le = now(),
       estimation_remplacee_par_id = NULL,
       notes = COALESCE(notes || ' — ', '') ||
               'Écartée par l''admin (bouton « Écarter » du 16/10/2026, arbitrage n°3) : heure jugée fausse, journée laissée non fermée.'
 WHERE employee_id = '04f3c327-f4d5-4536-8e72-2361f51e24c1'
   AND check_type = 'out'
   AND is_auto_closed = true
   AND check_time > '2026-10-16 12:46:25+00'
   AND check_time < '2026-10-17 00:00:00+00';

-- ════════════════════════════════════════════════════════════════════════════
-- JOURNAL — trace lisible des réparations (audit)
-- ════════════════════════════════════════════════════════════════════════════
INSERT INTO public.encheck_pointages_journal
      (enterprise_id, employee_id, attendance_id, action, motif, snapshot, pipeline, auteur)
SELECT a.enterprise_id, a.employee_id, a.id, 'reparation_arbitrage_03',
       'Réparation des lignes corrompues des cas Hippo/Mercia (15-16/10/2026) — voir supabase/outils-sql/20261016_reparer-cas-hippo-mercia.sql',
       jsonb_build_object('cas', 'arbitrage-n2-n3', 'avant', a.check_time, 'apres', a.check_time),
       'arbitre-reparation', public.encheck_auteur_actuel()
  FROM public.attendances a
 WHERE (a.employee_id, a.check_time) IN (
         ('120a48c7-02c8-46c5-9d06-b1d734cb3f72', '2026-10-16 19:21:42+00'),
         ('120a48c7-02c8-46c5-9d06-b1d734cb3f72', '2026-10-15 18:24:51+00')
       );

COMMIT;

-- =============================================================================
-- NOTE « VERSION DUR » (discutée avec le commanditaire, NON appliquée ici) :
-- la journée du 15/10 reste nouée sur le contre-enregistrement 21:58:12
-- (4h16m55s) : c'est l'état actuel de la base, et la vraie correction de
-- l'admin (18:24:51) ne devient la sortie réelle que si on tranche. Si la
-- direction le décide, exécuter ci-dessous (idempotent) :
--
--   -- 21:58:12 → contre-enregistrement écarté (déplace le problème : les 4h16m
--   -- tombent à 0 — ce n'était pas plus vrai comme durée, c'était 0 h 03 selon
--   -- le GPS de 17:41 à 18:24 selon les témoignages).
--   UPDATE public.attendances
--      SET anomalie = 'sortie_presumee_remplacee', estimation_remplacee_le = now()
--    WHERE employee_id = '120a48c7-02c8-46c5-9d06-b1d734cb3f72'
--      AND check_type = 'out' AND check_time = '2026-10-15 21:58:12+00';
--
--   -- 18:24:51 devient la sortie réelle du 15/10
--   UPDATE public.attendances
--      SET anomalie = NULL, is_auto_closed = false, method = 'face_id',
--          estimation_remplacee_le = NULL, estimation_remplacee_par_id = NULL
--    WHERE employee_id = '120a48c7-02c8-46c5-9d06-b1d734cb3f72'
--      AND check_type = 'out' AND check_time = '2026-10-15 18:24:51+00';
-- =============================================================================
