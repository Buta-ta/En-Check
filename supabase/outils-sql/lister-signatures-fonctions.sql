-- ═══════════════════════════════════════════════════════════════════════════
--  EN-CHECK — OUTIL — SIGNATURES RÉELLES DES FONCTIONS APPELÉES PAR L'APP
-- ═══════════════════════════════════════════════════════════════════════════
--  EXÉCUTER : éditeur SQL Supabase → coller → Run.  ⚠️ 100 % LECTURE SEULE.
--
--  POURQUOI
--  Le 16/10 au soir, « Valider / Écarter » sur une sortie présumée répondait :
--      404 — Could not find the function
--      public.encheck_estimation_statuer(p_action, p_ids) in the schema cache
--  parce que l'appel JS envoyait la clé `p_action` là où la base déclare
--  `p_decision`. PostgREST construit une signature avec les NOMS que tu envoies :
--  un nom qui ne correspond à rien n'est pas une erreur de typage, c'est une
--  fonction introuvable. `src/services/__tests__/cablageRpc.test.js` vérifie
--  désormais ce contrat pour TOUTES les fonctions déclarées dans
--  `supabase/migrations/` de CE dépôt — mais 28 des fonctions appelées par le
--  `src/` ne sont déclarées nulle part ici : elles vivent dans le dépôt de Dev 1
--  ou n'ont jamais été rapatriées. Pour celles-là, le garde-fou sait qu'il ne voit
--  rien, et il le dit. Ce script sert à combler l'angle mort en 30 secondes :
--  colle la requête 1, copie-moi le résultat, j'ajoute les signatures manquantes
--  au dépôt (en fichier de référence, pas en migration : rien à appliquer) et le
--  test passera sur les 34 appels, plus 28.
--
--  La requête 2 répond à une question plus large : y a-t-il dans la base des
--  fonctions `encheck_%` que le dépôt ne connaît pas du tout (dérive entre la
--  prod et le code versionné) ?
-- ═══════════════════════════════════════════════════════════════════════════


-- ─────────────────────────────────────────────────────────────────────────────
--  1. LES SIGNATURES DES FONCTIONS APPELÉES DEPUIS LE src/ SANS DÉCLARATION ICI
--      `pg_get_function_arguments` rend exactement la liste `nom type [DEFAULT …]`
--      que PostgREST utilise pour résoudre un appel par noms d'arguments.
-- ─────────────────────────────────────────────────────────────────────────────
SELECT p.proname                                       AS fonction,
       pg_get_function_arguments(p.oid)                 AS arguments_declares,
       pg_get_function_result(p.oid)                    AS retour,
       p.prosecdef                                      AS security_definer,
       pg_get_function_identity_arguments(p.oid)       AS signature_canonique
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
 WHERE n.nspname = 'public'
   AND p.proname IN (
        'encheck_import_batch','encheck_journal_lire','replace_attendance_day',
        'encheck_module_actif','encheck_alertes_marquer','encheck_signaux_controler',
        'encheck_alertes_lister','encheck_admin_definir_mot_de_passe','update_admin_password',
        'create_admin_auth_user','encheck_cout_periode','encheck_cout_projeter',
        'encheck_mois_pointes','encheck_cout_controler','set_employee_password',
        'create_employee_auth_user','encheck_employe_pin_machine','admin_login_precheck',
        'admin_login_result','encheck_employes_sans_pin','encheck_adms_appareil_ajouter',
        'encheck_entreprise_par_code','encheck_pointages_historique','encheck_punch',
        'encheck_employee_login_qr','employee_login_precheck','get_employees_triggers',
        -- les trois fonctions dont le code n'existe que dans la prod (carte des
        -- fonctions du 16/10, versionnee = false) : leur contrat intéresse aussi
        'encheck_alertes_controler_interne'
       )
 ORDER BY p.proname;

-- Doit rendre 28 lignes. Une fonction absente de ce résultat = elle n'existe PAS
-- sous ce nom dans `public` : l'appel qui la cible est un candidat direct au même
-- 404 que celui d'hier soir (autre orthographe, autre schéma, ou jamais créée).
-- Compare avec la liste du test pour savoir laquelle manque.


-- ─────────────────────────────────────────────────────────────────────────────
--  2. CE QUE LA BASE SAIT, ELLE, SUR L'APPAREIL APPELÉ PAR LE BOUTON CABOSSÉ
--      À coller si tu veux voir de tes yeux pourquoi `p_action` ne passe pas.
-- ─────────────────────────────────────────────────────────────────────────────
SELECT p.proname AS fonction,
       pg_get_function_identity_arguments(p.oid) AS ce_que_postgrest_attend,
       CASE WHEN p.proname = 'encheck_estimation_statuer'
            THEN 'lenvoi d un objet {"p_ids":[…],"p_action":"valider"} ne forme aucune
                  de ces signatures ; {"p_ids":[…],"p_decision":"valider"} forme la bonne'
            ELSE '—' END AS lecture
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
 WHERE n.nspname = 'public' AND p.proname LIKE 'encheck_estimation_%'
 ORDER BY p.proname;


-- ─────────────────────────────────────────────────────────────────────────────
--  3. LES FONCTIONS encheck_% DE LA BASE QUE CE DÉPÔT NE DÉCLARE PAS
--      (la dérive prod ↔ dépôt, en une ligne par fonction orpheline)
--      La liste de droite est celle des CREATE FUNCTION des migrations du dépôt ;
--      si tu lis ce script dans Supabase, la liste de gauche est vide de ton côté
--      — la comparaison se fait donc en deux temps : exporte d'abord, croise ensuite.
-- ─────────────────────────────────────────────────────────────────────────────
SELECT p.proname AS fonction,
       pg_get_function_arguments(p.oid) AS arguments,
       p.prosecdef AS security_definer,
       (SELECT count(*) FROM pg_proc q
         WHERE q.pronamespace = p.pronamespace AND q.proname = p.proname) AS nb_surcharges
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
 WHERE n.nspname = 'public'
   AND (p.proname LIKE 'encheck_%' OR p.proname IN ('replace_attendance_day',
        'update_admin_password', 'create_admin_auth_user', 'admin_login_precheck',
        'admin_login_result', 'set_employee_password', 'create_employee_auth_user',
        'employee_login_precheck', 'get_employees_triggers'))
 ORDER BY p.proname;


-- ─────────────────────────────────────────────────────────────────────────────
--  4. PREUVE DE FIN DE COLLAGE
-- ─────────────────────────────────────────────────────────────────────────────
SELECT 'FIN DES SIGNATURES — sections 1 à 3 collées entièrement' AS etat, now() AS execute_le;
