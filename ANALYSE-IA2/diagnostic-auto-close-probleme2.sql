-- ═══════════════════════════════════════════════════════════════════════════
--  EN-CHECK — ANALYSE IA2 — DIAGNOSTIC « AUTO-CLOSE COMPORTEMENTAL » (PROBLÈME 2)
-- ═══════════════════════════════════════════════════════════════════════════
--  PROJET     : cxggndvhwdolbtyezjde
--  EXÉCUTER   : Dashboard Supabase → SQL Editor → coller → Run
--  ⚠️ 100 % LECTURE SEULE (SELECT uniquement). Aucun INSERT / UPDATE / DELETE /
--     ALTER / CREATE / GRANT. Tu peux relancer autant de fois que tu veux.
--
--  POURQUOI CE SCRIPT
--  ──────────────────
--  Le Dev 1 propose d'inventer l'heure de sortie d'un employé qui a oublié de
--  dépointer, en apprenant ses habitudes (médiane des durées sur 60 jours dans
--  une fenêtre d'arrivée ±2 h), puis l'habitude des collègues, puis +8 h.
--  plutot que de débattre de principes, on mesure sur TES VRAIES DONNÉES :
--  la section E rejoue le scénario — on cache la sortie réelle, on laisse le
--  modèle la deviner, on compare avec la vérité. C'est ce chiffre qui décide.
--
--  SECTION  RÔLE
--  A        le modèle a-t-il les colonnes nécessaires ?
--  B        qui a le droit d'appeler les fonctions qui suppriment/insèrent ?
--  C        l'apprentissage sera-t-il écrasé par la grille par défaut ? (piège n°1)
--  D        ce que l'auto-close actuel a déjà inventé
--  E        ⭐ BACKTEST : précision réelle des 2 candidats (durée vs horaire)
--  F        une habitude tient-elle 60 jours ? (dérive des régimes)
--  G        combien de journées sont ouvertes maintenant (demande réelle)
--
--  Exécute dans l'ordre, une section à la fois. Si une requête échoue parce
--  qu'une colonne n'existe pas (ex. `modifie_le`), dis-le-moi : j'adapte.
-- ═══════════════════════════════════════════════════════════════════════════


-- ──────────────────────────────────────────────────────────────────────────
--  A. ÉTAT DES COLONNES
-- ──────────────────────────────────────────────────────────────────────────
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'attendances'
ORDER BY ordinal_position;

SELECT column_name, data_type, column_default
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'enterprises'
  AND column_name LIKE 'auto_close%'
ORDER BY column_name;

SELECT t.table_name,
       (SELECT count(*) FROM information_schema.columns c
         WHERE c.table_schema='public' AND c.table_name=t.table_name) AS nb_colonnes,
       (SELECT relrowsecurity FROM pg_class pc JOIN pg_namespace pn ON pn.oid=pc.relnamespace
         WHERE pc.relname=t.table_name AND pn.nspname='public') AS rls_active
FROM information_schema.tables t
WHERE t.table_schema='public'
  AND t.table_name IN ('attendances','attendance_history','attendance_corrections',
                       'pointages_photos','radar_signals','encheck_alertes','alertes')
ORDER BY t.table_name;

-- Le DELETE d'une ligne d'attendances entraîne-t-il la suppression en cascade
-- de la preuve (photos, journal de correction, historique) ?
SELECT c.conname AS contrainte,
       c.confrelid::regclass AS table_enfant,
       CASE c.confdeltype WHEN 'c' THEN '⚠️ ON DELETE CASCADE'
                          WHEN 'r' THEN 'RESTRICT'
                          WHEN 'n' THEN 'SET NULL'
                          ELSE c.confdeltype::text END AS comportement_suppression
FROM pg_constraint c
WHERE c.contype='f'
  AND c.confrelid = 'public.attendances'::regclass
ORDER BY 2;


-- ──────────────────────────────────────────────────────────────────────────
--  B. QUI PEUT ÉCRIRE / ÉCRASER ?
--  Le socle Radar (migration 20261012000001 §9) faisait REVOKE ... FROM PUBLIC,
--  anon, authenticated + GRANT TO postgres, service_role. Les deux nouvelles
--  fonctions de nettoyage/clôture n'ont rien de tel dans la migration du 15/10.
-- ──────────────────────────────────────────────────────────────────────────
SELECT p.proname AS fonction,
       p.prosecdef AS security_definer,
       pg_get_userbyid(p.proowner) AS proprietaire,
       (p.proacl IS NULL) AS acl_nulle_DONE_TOUS_PEUVENT_APPELER,
       COALESCE(string_agg(DISTINCT r.rolname, ', ' ORDER BY r.rolname), '(personne)') AS roles_autorises
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
LEFT JOIN LATERAL aclexplode(p.proacl) acl ON TRUE
LEFT JOIN pg_roles r ON r.oid = acl.grantee
WHERE n.nspname='public'
  AND p.proname IN ('encheck_nettoyer_rebonds_qr','encheck_cloturer_sorties_oubliees',
                    'encheck_alertes_controler','encheck_alertes_controler_interne',
                    'encheck_assainir_alertes_horaires','encheck_resoudre_grille_employe',
                    'encheck_punch','replace_attendance_day','radar_run_all')
GROUP BY p.oid, p.proname, p.prosecdef, p.proowner
ORDER BY p.proname;

-- L'orchestrateur du Dev 1 est-il toujours en place ? (le piège du « rename » :
-- si quelqu'un refait un CREATE OR REPLACE sur encheck_alertes_controler depuis
-- l'éditeur SQL, la clôture + le nettoyage + l'assainissement disparaissent
-- SILENCIEUSEMENT sans message d'erreur)
SELECT p.proname,
       (position('encheck_cloturer_sorties_oubliees' in p.prosrc) > 0) AS appelle_cloture,
       (position('encheck_nettoyer_rebonds_qr'       in p.prosrc) > 0) AS appelle_nettoyage,
       (position('encheck_assainir_alertes_horaires' in p.prosrc) > 0) AS appelle_assainissement,
       length(p.prosrc) AS longueur_source
FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
WHERE n.nspname='public'
  AND p.proname IN ('encheck_alertes_controler','encheck_alertes_controler_interne');

-- Un cron serveur s'occupe-t-il de la clôture, ou dépend-elle du navigateur
-- d'un admin qui ouvre le tableau de bord (throttle sessionStorage 5 min) ?
-- ⚠️ si la requête renvoie « permission denied for table job » : normal, le rôle
--    SQL est rarement superuser. Dans ce cas, vérifie à la main : menu
--    Database → Extensions (pg_cron activé ?) puis, dans l'onglet « Jobs »
--    ou via le log, cherche un job qui appellerait encheck_cloturer_sorties_oubliees.
--    S'il n'y en a pas, la clôture ne se déclenche QUE quand un admin ouvre le
--    dashboard → c'est le trou n°6 de mon analyse.
SELECT jobname, schedule, command FROM cron.job ORDER BY jobname;


-- ──────────────────────────────────────────────────────────────────────────
--  C. PIÈGE N°1 — l'apprentissage ne s'exécutera jamais là où une grille
--     par défaut existe, car le Niveau 1 de la cascade est testé AVANT.
-- ──────────────────────────────────────────────────────────────────────────
SELECT count(*) AS entreprises_actives,
       count(*) FILTER (WHERE EXISTS (
          SELECT 1 FROM public.work_schedules ws
           WHERE ws.enterprise_id=e.id AND COALESCE(ws.is_active,true)=true
             AND ws.start_time IS NOT NULL AND ws.end_time IS NOT NULL)) AS avec_une_grille,
       count(*) FILTER (WHERE EXISTS (
          SELECT 1 FROM public.work_schedules ws
           WHERE ws.enterprise_id=e.id AND COALESCE(ws.is_default,false)=true)) AS avec_grille_defaut,
       count(*) FILTER (WHERE COALESCE(e.auto_close_enabled,false)) AS auto_close_actif,
       count(*) FILTER (WHERE COALESCE(e.auto_close_enabled,false)
                          AND e.auto_close_time::text LIKE '23:5%') AS auto_close_a_2359
FROM public.enterprises e
WHERE COALESCE(e.is_active,true)=true;

SELECT CASE WHEN es.use_custom_hours IS true AND es.custom_start_time IS NOT NULL
              THEN '1. horaire personnalisé'
            WHEN es.schedule_id IS NOT NULL THEN '2. grille liée'
            WHEN es.id IS NULL THEN '3. aucune grille → grille entreprise'
            ELSE '4. ligne de planning vide' END AS situation,
       count(*) AS nb_employes
FROM public.employees emp
LEFT JOIN public.employee_schedules es
       ON es.employee_id = emp.id AND COALESCE(es.is_active,true)=true
WHERE COALESCE(emp.is_active,true)=true
GROUP BY 1 ORDER BY 2 DESC;


-- ──────────────────────────────────────────────────────────────────────────
--  D. CE QUE L'AUTO-CLOSE ACTUEL A DÉJÀ INVENTÉ
-- ──────────────────────────────────────────────────────────────────────────
WITH t AS (
  SELECT a.employee_id, a.check_time,
         LAG(a.check_time) OVER (PARTITION BY a.employee_id ORDER BY a.check_time) AS t_prev,
         lower(left(a.check_type::text,1)) AS sens,
         COALESCE(a.is_auto_closed,false) AS fab
  FROM public.attendances a
  WHERE a.check_time >= now() - interval '30 days'
)
SELECT (t.check_time AT TIME ZONE 'Africa/Porto-Novo')::date AS jour,
       count(*)                            AS lignes_fabriquees,
       count(DISTINCT t.employee_id)       AS employs,
       round(avg(extract(epoch from (t.check_time - t.t_prev))/3600.0)::numeric,2) AS duree_moyenne_h,
       max(extract(epoch from (t.check_time - t.t_prev))/3600.0)::numeric(6,2)     AS pire_duree_h
FROM t
WHERE t.fab AND t.sens='o' AND t.t_prev IS NOT NULL
GROUP BY 1 ORDER BY 1 DESC
LIMIT 40;

-- Les pointages fabriqués portent-ils la méthode de l'entrée (qr/pin/face/gps)
-- et une position GPS, c'est-à-dire sont-ils indiscernables d'un vrai badge ?
SELECT COALESCE(a.method,'(nul)') AS methode,
       count(*) AS lignes_auto_fermees,
       count(*) FILTER (WHERE a.location_lat IS NOT NULL) AS avec_gps
FROM public.attendances a
WHERE COALESCE(a.is_auto_closed,false)=true
  AND a.check_time >= now() - interval '30 days'
GROUP BY 1 ORDER BY 2 DESC;


-- ──────────────────────────────────────────────────────────────────────────
--  E. ⭐ BACKTEST — « deviner la sortie, ça marche vraiment ? »
--  P1 = habitude de DURÉE (proposition Dev 1) : entrée_du_jour + médiane des
--       durées de ce même employé sur 60 j, arrivées à ±2 h (fenêtre circulaire)
--  P2 = habitude d'HORAIRE DE SORTIE (mon amendement) : l'heure de sortie
--       habituelle du cluster, qui ne s'allonge pas quand l'employé est en retard
--  Lecture : err > 0 = heures INVENTÉES (paie en trop) ; err < 0 = heures
--            RETRANCHÉES au réel (employé lésé).
-- ──────────────────────────────────────────────────────────────────────────
WITH pts AS (
  SELECT a.id, a.employee_id, a.check_time,
         lower(left(a.check_type::text,1)) AS sens,
         floor(extract(epoch from (a.check_time AT TIME ZONE 'Africa/Porto-Novo'))/60)::bigint AS m
  FROM public.attendances a
  WHERE a.check_time >= now() - interval '70 days'
    AND NOT COALESCE(a.is_auto_closed,false)
    AND a.modifie_le IS NULL
),
paires AS (
  SELECT i.employee_id, i.check_time AS t_in, i.m AS in_m, o.m AS out_m,
         (o.m - i.m) AS duree
  FROM pts i
  JOIN LATERAL (                       -- le pointage SUIVANT doit être une sortie
    SELECT p.m, p.sens FROM pts p
    WHERE p.employee_id = i.employee_id AND p.m > i.m
    ORDER BY p.m LIMIT 1
  ) o ON o.sens = 'o' AND o.m <= i.m + 16*60
  WHERE i.sens = 'i'
),
propres AS (                          -- journée complète et crédible
  SELECT * FROM paires WHERE duree BETWEEN 30 AND 16*60
),
hist AS (
  SELECT cur.employee_id, cur.t_in, cur.in_m, cur.out_m, cur.duree,
         h.duree AS h_duree, h.out_m AS h_out
  FROM propres cur
  JOIN propres h
    ON  h.employee_id = cur.employee_id
    AND h.t_in <  cur.t_in
    AND h.t_in >= cur.t_in - interval '60 days'
    AND LEAST(
          abs(((h.in_m % 1440)+1440)%1440 - ((cur.in_m % 1440)+1440)%1440),
          1440 - abs(((h.in_m % 1440)+1440)%1440 - ((cur.in_m % 1440)+1440)%1440)
        ) <= 120
),
pred AS (
  SELECT employee_id, t_in, in_m, out_m, duree,
         count(*) AS n,
         percentile_cont(0.5) WITHIN GROUP (ORDER BY h_duree) AS med_duree,
         percentile_cont(0.5) WITHIN GROUP (
             ORDER BY ((((h_out - (in_m + 480) + 720) % 1440) + 1440) % 1440) - 720
         ) AS med_decal
  FROM hist
  GROUP BY employee_id, t_in, in_m, out_m, duree
  HAVING count(*) >= 3
),
notes AS (
  SELECT employee_id, t_in, n,
         round((in_m + med_duree) - out_m)                    AS err_p1,
         round((in_m + 480 + med_decal) - out_m)              AS err_p2
  FROM pred
)
SELECT (SELECT count(*) FROM propres) AS journees_propres_dans_la_base,
       count(*)                       AS journees_predicibles,
       round(100.0*count(*) / NULLIF((SELECT count(*) FROM propres),0)) AS couverture_pct,
       round(percentile_cont(0.5) WITHIN GROUP (ORDER BY abs(err_p1)))  AS P1_ecart_median_min,
       round(avg(abs(err_p1)))                                            AS P1_erreur_moyenne_min,
       round(100.0*count(*) FILTER (WHERE abs(err_p1)<=15)/count(*))     AS P1_dans_15_min_pct,
       round(100.0*count(*) FILTER (WHERE abs(err_p1)<=30)/count(*))     AS P1_dans_30_min_pct,
       round(100.0*count(*) FILTER (WHERE err_p1> 60)/count(*))          AS P1_heures_inventees_pct,
       round(100.0*count(*) FILTER (WHERE err_p1<-60)/count(*))           AS P1_heures_retranchees_pct,
       round(percentile_cont(0.5) WITHIN GROUP (ORDER BY abs(err_p2)))   AS P2_ecart_median_min,
       round(100.0*count(*) FILTER (WHERE abs(err_p2)<=15)/count(*))      AS P2_dans_15_min_pct,
       round(100.0*count(*) FILTER (WHERE abs(err_p2)<=30)/count(*))      AS P2_dans_30_min_pct,
       round(100.0*count(*) FILTER (WHERE err_p2> 60)/count(*))           AS P2_heures_inventees_pct,
       round(100.0*count(*) FILTER (WHERE err_p2<-60)/count(*))           AS P2_heures_retranchees_pct
FROM notes;

-- Variante par employé : qui est prédictible, qui ne l'est pas du tout.
WITH pts AS (
  SELECT a.id, a.employee_id, a.check_time,
         lower(left(a.check_type::text,1)) AS sens,
         floor(extract(epoch from (a.check_time AT TIME ZONE 'Africa/Porto-Novo'))/60)::bigint AS m
  FROM public.attendances a
  WHERE a.check_time >= now() - interval '70 days'
    AND NOT COALESCE(a.is_auto_closed,false) AND a.modifie_le IS NULL
),
paires AS (
  SELECT i.employee_id, i.check_time AS t_in, i.m AS in_m, o.m AS out_m, (o.m - i.m) AS duree
  FROM pts i
  JOIN LATERAL (SELECT p.m, p.sens FROM pts p
                WHERE p.employee_id = i.employee_id AND p.m > i.m
                ORDER BY p.m LIMIT 1) o
        ON o.sens = 'o' AND o.m <= i.m + 16*60
  WHERE i.sens = 'i'
),
propres AS (SELECT * FROM paires WHERE duree BETWEEN 30 AND 16*60),
hist AS (
  SELECT cur.employee_id, cur.t_in, cur.in_m, cur.out_m, h.duree AS h_duree
  FROM propres cur JOIN propres h
    ON h.employee_id = cur.employee_id
   AND h.t_in < cur.t_in AND h.t_in >= cur.t_in - interval '60 days'
   AND LEAST(abs(((h.in_m%1440)+1440)%1440 - ((cur.in_m%1440)+1440)%1440),
             1440-abs(((h.in_m%1440)+1440)%1440 - ((cur.in_m%1440)+1440)%1440)) <= 120
),
pred AS (
  SELECT employee_id, t_in, in_m, out_m, count(*) AS n,
         percentile_cont(0.5) WITHIN GROUP (ORDER BY h_duree) AS med_duree
  FROM hist GROUP BY 1,2,3,4 HAVING count(*) >= 3
)
SELECT e.matricule,
       trim(coalesce(e.first_name,'')||' '||coalesce(e.last_name,'')) AS employe,
       count(*) AS j_testees,
       round(avg(n)) AS exemples_par_jour,
       round(percentile_cont(0.5) WITHIN GROUP (ORDER BY abs((in_m+med_duree)-out_m))) AS ecart_median_min,
       round(100.0*count(*) FILTER (WHERE abs((in_m+med_duree)-out_m)<=15)/count(*))  AS dans_15_min_pct
FROM pred p JOIN public.employees e ON e.id = p.employee_id
GROUP BY e.id, e.matricule, employe
ORDER BY j_testees DESC
LIMIT 30;


-- ──────────────────────────────────────────────────────────────────────────
--  F. UNE HABITUDE TIENT-ELLE 60 JOURS ? (dérive de régime → médiane périmée)
-- ──────────────────────────────────────────────────────────────────────────
WITH pts AS (
  SELECT a.employee_id, a.check_time,
         lower(left(a.check_type::text,1)) AS sens,
         floor(extract(epoch from (a.check_time AT TIME ZONE 'Africa/Porto-Novo'))/60)::bigint AS m,
         (a.check_time AT TIME ZONE 'Africa/Porto-Novo')::date AS jour
  FROM public.attendances a
  WHERE a.check_time >= now() - interval '90 days'
    AND NOT COALESCE(a.is_auto_closed,false) AND a.modifie_le IS NULL
),
paires AS (
  SELECT i.employee_id, i.check_time AS t_in, i.jour, (o.m - i.m) AS duree
  FROM pts i
  JOIN LATERAL (SELECT p.m, p.sens FROM pts p
                WHERE p.employee_id=i.employee_id AND p.m>i.m ORDER BY p.m LIMIT 1) o
        ON o.sens='o' AND o.m <= i.m + 16*60
  WHERE i.sens='i' AND (o.m - i.m) BETWEEN 30 AND 16*60
),
recents AS (SELECT employee_id, count(*) n, percentile_cont(0.5) WITHIN GROUP (ORDER BY duree) med
            FROM paires WHERE t_in >= now() - interval '30 days' GROUP BY 1),
anciens AS (SELECT employee_id, count(*) n, percentile_cont(0.5) WITHIN GROUP (ORDER BY duree) med
             FROM paires WHERE t_in <  now() - interval '30 days' GROUP BY 1),
tous AS (SELECT employee_id, count(*) n FROM paires GROUP BY 1)
SELECT e.matricule,
       trim(coalesce(e.first_name,'')||' '||coalesce(e.last_name,'')) AS employe,
       tous.n AS journees_90j,
       r.n AS n_30j,  round(r.med/60.0, 2) AS mediane_recent_h,
       a.n AS n_j60_31, round(a.med/60.0, 2) AS mediane_passe_h,
       round(abs(coalesce(r.med,0)-coalesce(a.med,0))/60.0, 2) AS derive_h
FROM tous
JOIN public.employees e ON e.id = tous.employee_id
LEFT JOIN recents r ON r.employee_id = tous.employee_id
LEFT JOIN anciens a ON a.employee_id = tous.employee_id
WHERE tous.n >= 10
ORDER BY derive_h DESC NULLS LAST
LIMIT 30;


-- ──────────────────────────────────────────────────────────────────────────
--  G. COMBIEN DE JOURNÉES SONT OUVERTES MAINTENANT (la demande réelle)
-- ──────────────────────────────────────────────────────────────────────────
WITH t AS (
  SELECT a.employee_id, a.check_time, a.method, a.check_type,
         LEAD(a.check_type) OVER (PARTITION BY a.employee_id ORDER BY a.check_time) AS suiv_type,
         LEAD(a.check_time) OVER (PARTITION BY a.employee_id ORDER BY a.check_time) AS suiv_time
  FROM public.attendances a
  WHERE a.check_time >= now() - interval '60 days'
)
SELECT e.matricule,
       trim(coalesce(e.first_name,'')||' '||coalesce(e.last_name,'')) AS employe,
       ent.name AS entreprise,
       t.check_time AT TIME ZONE 'Africa/Porto-Novo' AS entree,
       t.method AS methode_entree,
       round(extract(epoch from (now() - t.check_time))/3600.0, 1) AS heures_ouvertes,
       CASE WHEN t.suiv_type IS NULL THEN 'aucun pointage après'
            ELSE 'pointage après: ' || t.suiv_type END AS situation
FROM t
JOIN public.employees e ON e.id = t.employee_id
LEFT JOIN public.enterprises ent ON ent.id = e.enterprise_id
WHERE lower(left(t.check_type::text,1))='i'
  AND t.check_time <= now() - interval '14 hours'
  AND (t.suiv_type IS NULL OR t.suiv_type NOT ILIKE 'o%')
ORDER BY t.check_time DESC
LIMIT 100;
