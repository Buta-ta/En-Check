-- ═══════════════════════════════════════════════════════════════════════════
--  EN-CHECK — OUTIL — DIAGNOSTIC « UNE SORTIE QUI PASSE MINUIT »
-- ═══════════════════════════════════════════════════════════════════════════
--  EXÉCUTER : Dashboard Supabase → SQL Editor → coller le fichier ENTIER → Run.
--             psql convient aussi : ce script ne contient AUCUNE méta-commande
--             psql (pas de \set, pas de \echo) et ne dépend d'aucun rôle local.
--  ⚠️ 100 % LECTURE SEULE. Aucun INSERT / UPDATE / DELETE / ALTER / CREATE / GRANT.
--     Tu peux le relancer trente fois, il ne change rien à la base.
--
--  LE CAS QUI A ÉCRIT CE SCRIPT (16/10 — Hippo BIYOKILA, ENN-0002, « Associé »)
--  ──────────────────────────────────────────────────────────────────────────
--     entrée réelle : mercredi 15/10 à 08:54:39
--     sortie réelle : jeudi   16/10 à 01:14   (l'appli de pointage lui a bien
--                      demandé un choix, il a répondu, le badge EST en base)
--     durée réelle  : 16 h 19 min 21 s
--
--  Écran du 15 : « ✓ Présent · Entrée 08:54:39 · Sortie --:--:-- · 0 sec »
--  Écran du 16 : « ✗ Absent · 🚩 Pointage signalé par le serveur »
--  La sortie existe donc, mais n'est rattachée à AUCUNE journée.
--
--  LA RÈGLE EN CAUSE, avec ses lignes exactes dans le dépôt :
--    · `appariement_heures` vaut 16 (migration 20261016000001, l.111) et il est lu
--      des DEUX côtés : `chargerSeuilsPointage()` côté app (seuilsPointage.js
--      l.79-137), `encheck_seuil(ent,'appariement_heures',16)` côté base
--      (migration l.1139 et l.1204). Un seul chiffre, deux moteurs.
--    · `resoudrePointagesJournee()` (hoursCalculator.js l.1566-1573) ne relie une
--      sortie à l'entrée ouverte que si `sortie - entrée <= appariement_heures`.
--      16 h 19 dépasse de 19 minutes → pas d'appariement. Et pire : la branche
--      `else` (l.1594-1597) efface `openIn`/`openDay`, donc le bloc « oubli de
--      dépointage » (l.1610, qui exige `openDay === selectedDate`) ne se déclenche
--      même plus. La journée reste ouverte à vie, sans sortie réelle NI estimée.
--    · le 16/10 au matin, la sortie orpheline est le seul badge du jour → statut
--      calculé « absent », et le drapeau `suspect` posé par le serveur (motif
--      probable `hors_fenetre:58761_seconds`, traduit par `raisonSuspect()`,
--      Pointages.jsx l.176) remonte en 🚩.
--
--  CE QUE RÉPOND CE SCRIPT :
--    A  les chiffres réellement appliqués à CETTE entreprise (override ou global ?)
--    B  les badges bruts des derniers jours, avec l'écart entrée→sortie calculé
--    C  ⭐ le verdict : cet écart passe-t-il la règle ? de combien il la manque
--    D  l'ampleur : un cas isolé, ou des dizaines par mois ?
--    E  ce que le serveur a signalé et pour quel motif (l'alignement Dev 1)
--    F  ce que la base a consigné pour ces lignes (le risque paie, pas l'affichage)
--    G  preuve que le collage est complet
--
--  UNE SEULE LIGNE À CHANGER : le matricule, à la section 0.
-- ═══════════════════════════════════════════════════════════════════════════


-- ─────────────────────────────────────────────────────────────────────────────
--  0. LA CIBLE — une seule ligne à éditer
-- ─────────────────────────────────────────────────────────────────────────────
SELECT set_config('diag.matricule', 'ENN-0002', false);
SELECT set_config('diag.jours', '4', false);   -- recul des sections B et C, en jours


-- ─────────────────────────────────────────────────────────────────────────────
--  A. LES CHIFFRES RÉELLEMENT APPLIQUÉS À CETTE ENTREPRISE
--      `encheck_seuil()` est dans l'ordre : override entreprise → valeur globale →
--      défaut codé (migration l.134-141). C'est LUI que les deux moteurs consultent,
--      donc c'est lui qu'on regarde, pas ce que le dépôt contient.
-- ─────────────────────────────────────────────────────────────────────────────
SELECT e.matricule,
       nullif(trim(concat_ws(' ', e.first_name, e.last_name)), '') AS nom,
       en.id             AS enterprise_id,
       en.name           AS entreprise,
       en.timezone       AS fuseau_entreprise,
       en.auto_close_enabled,
       en.auto_close_time,
       en.auto_close_grace_minutes,
       public.encheck_seuil(en.id, 'oubli_sortie_heures',      12) AS oubli_sortie_heures,
       public.encheck_seuil(en.id, 'plafond_invention_heures', 12) AS plafond_invention_heures,
       public.encheck_seuil(en.id, 'appariement_heures',       16) AS appariement_heures_applique,
       public.encheck_mode_estimation(en.id)                        AS mode_estimation
  FROM public.employees e
  JOIN public.enterprises en ON en.id = e.enterprise_id
 WHERE e.matricule = current_setting('diag.matricule', true);

-- Les lignes de réglages qui EXISTENT pour cette clef : s'il n'y a que la ligne
-- `enterprise_id IS NULL`, l'entreprise n'a aucun override et c'est le global (16)
-- qui s'applique partout — donc le lever pour une seule entreprise est une
-- ADDITION, pas une modification du comportement des autres.
SELECT (r.enterprise_id IS NULL) AS global, r.cle, r.valeur,
       coalesce(r.commentaire, '—') AS commentaire, r.maj_le
  FROM public.encheck_reglages_pointage r
 WHERE r.cle IN ('appariement_heures','oubli_sortie_heures',
                 'plafond_invention_heures','mode_estimation')
   AND ( r.enterprise_id = (SELECT enterprise_id FROM public.employees
                             WHERE matricule = current_setting('diag.matricule', true))
         OR r.enterprise_id IS NULL )
 ORDER BY r.cle, global DESC;

-- Garde-fou : 0 ligne ici = le matricule n'existe pas (ou la session a été coupée
-- entre la section 0 et celle-ci). Dans ce cas remplace
-- current_setting('diag.matricule', true) par le matricule entre guillemets.
SELECT CASE WHEN count(*) = 0
            THEN 'AUCUN SALARIÉ TROUVÉ pour ce matricule : rien d''autre ne sera affiché'
            ELSE 'ok_cible_trouvee : ' || count(*) END AS etat
  FROM public.employees
 WHERE matricule = current_setting('diag.matricule', true);


-- ─────────────────────────────────────────────────────────────────────────────
--  B. LES BADGES BRUTS, avec l'écart jusqu'à la dernière entrée qui les précède
-- ─────────────────────────────────────────────────────────────────────────────
WITH cible AS (
  SELECT e.id AS employee_id, e.enterprise_id
    FROM public.employees e
   WHERE e.matricule = current_setting('diag.matricule', true)
),
bruts AS (
  SELECT a.id, a.check_time, a.check_type, a.method, a.is_auto_closed,
         a.anomalie, a.estimation_source_id, a.estimation_niveau,
         a.estimation_validee_le, a.estimation_remplacee_le,
         a.suspect, a.suspect_reason, a.modifie_le, a.notes
    FROM public.attendances a
    JOIN cible c ON c.employee_id = a.employee_id
   WHERE a.check_time >= date_trunc('day', now())
                          - make_interval(days => current_setting('diag.jours')::int)
     AND a.check_time <  date_trunc('day', now()) + interval '1 day'
)
SELECT to_char(check_time AT TIME ZONE 'UTC', 'YYYY-MM-DD HH24:MI:SS') AS badge,
       lower(check_type::text)             AS type,
       coalesce(method, '—')               AS methode,
       CASE WHEN is_auto_closed THEN 'OUI' ELSE 'non' END AS estime,
       CASE WHEN estimation_validee_le   IS NOT NULL THEN 'OUI' ELSE 'non' END AS validee,
       CASE WHEN estimation_remplacee_le IS NOT NULL THEN 'OUI' ELSE 'non' END AS remplacee,
       CASE WHEN suspect THEN 'OUI' ELSE 'non' END AS suspect,
       coalesce(suspect_reason, '—')       AS motif_serveur,
       (SELECT to_char(max(x.check_time) AT TIME ZONE 'UTC', 'MM-DD HH24:MI:SS')
          FROM bruts x
         WHERE lower(x.check_type::text) = 'in' AND x.check_time < bruts.check_time) AS entree_ouverte_avant,
       round(EXTRACT(EPOCH FROM (
                bruts.check_time
                - (SELECT max(x.check_time) FROM bruts x
                    WHERE lower(x.check_type::text) = 'in' AND x.check_time < bruts.check_time)
              )) / 3600.0, 2)              AS ecart_heures
  FROM bruts
 ORDER BY check_time;


-- ─────────────────────────────────────────────────────────────────────────────
--  C. ⭐ LE VERDICT, pour chaque entrée suivie d'une sortie
--      `duree_reelle_heures` vs `appariement_heures_applique` : c'est ici que la
--      journée du 15 a été perdue, et c'est ce chiffre qui répond à la question.
-- ─────────────────────────────────────────────────────────────────────────────
WITH cible AS (
  SELECT e.id AS employee_id, e.enterprise_id
    FROM public.employees e
   WHERE e.matricule = current_setting('diag.matricule', true)
),
paires AS (
  SELECT i.id AS entree_id, i.check_time AS entree,
         public.encheck_seuil(c.enterprise_id, 'appariement_heures', 16)::numeric AS hrs,
         min(o.check_time)  AS premiere_sortie
    FROM public.attendances i
    JOIN cible c ON c.employee_id = i.employee_id
    LEFT JOIN public.attendances o
           ON o.employee_id = i.employee_id
          AND lower(o.check_type::text) = 'out'
          AND o.check_time >  i.check_time
          AND o.check_time <= i.check_time + interval '36 hours'
   WHERE lower(i.check_type::text) = 'in'
     AND i.check_time >= date_trunc('day', now())
                           - make_interval(days => current_setting('diag.jours')::int)
   GROUP BY i.id, i.check_time, c.enterprise_id
)
SELECT to_char(entree AT TIME ZONE 'UTC', 'YYYY-MM-DD "à "HH24:MI:SS') AS entree,
       to_char(premiere_sortie AT TIME ZONE 'UTC', 'YYYY-MM-DD "à "HH24:MI:SS') AS sortie_reelle_juste_apres,
       round(EXTRACT(EPOCH FROM (premiere_sortie - entree)) / 3600.0, 3)       AS duree_reelle_heures,
       hrs                                                                      AS appariement_applique,
       CASE
         WHEN premiere_sortie IS NULL
           THEN 'aucune sortie après cette entrée → estimation légitime (ou journée en cours)'
         WHEN EXTRACT(EPOCH FROM (premiere_sortie - entree)) / 3600.0 <= hrs
           THEN 'ok : sortie appariée, journée fermée proprement'
         ELSE '⭐ REFUSÉE PAR LA RÈGLE — badge réel ignoré de '
              || round((EXTRACT(EPOCH FROM (premiere_sortie - entree)) / 3600.0 - hrs) * 60)::int
              || ' min au-dessus de la tolérance de ' || hrs || ' h'
       END AS verdict,
       CASE
         WHEN premiere_sortie IS NOT NULL
          AND EXTRACT(EPOCH FROM (premiere_sortie - entree)) / 3600.0 > hrs
          AND date_trunc('day', premiere_sortie) > date_trunc('day', entree)
          AND EXTRACT(HOUR FROM premiere_sortie AT TIME ZONE 'UTC') < 6
         THEN 'et elle passe minuit avant 06:00 : suite évidente de la garde'
         ELSE '—'
       END AS indice_minuit
  FROM paires
 ORDER BY entree DESC;


-- ─────────────────────────────────────────────────────────────────────────────
--  D. L'AMPLEUR — « un cas isolé » se corrige à la main, « 40 par mois » s'appelle
--      une règle. 30 jours, tous salariés, sorties RÉELLES seulement (is_auto_closed
--      = false), appariement tel que la base le calcule pour chaque entreprise.
-- ─────────────────────────────────────────────────────────────────────────────
SELECT en.name                                   AS entreprise,
       count(*)                                  AS entrees_avec_sortie_hors_tolerance,
       count(*) FILTER (WHERE j.cart = 0)        AS meme_jour,
       count(*) FILTER (WHERE j.cart = 1)        AS sortie_j_plus_1,
       round(max(j.heures), 2)                   AS plus_longue_heures,
       round(avg(j.heures), 2)                   AS moyenne_heures
  FROM (
        SELECT i.enterprise_id,
               EXTRACT(EPOCH FROM (min(o.check_time) - i.check_time)) / 3600.0 AS heures,
               EXTRACT(DAY FROM (date_trunc('day', min(o.check_time))
                                   - date_trunc('day', i.check_time)))::int  AS cart
          FROM public.attendances i
          JOIN public.attendances o
            ON o.employee_id  = i.employee_id
           AND lower(o.check_type::text) = 'out'
           AND o.check_time >  i.check_time
           AND o.check_time <= i.check_time + interval '36 hours'
           AND o.is_auto_closed = false
         WHERE lower(i.check_type::text) = 'in'
           AND i.is_auto_closed = false
           AND i.check_time >= now() - interval '30 days'
         GROUP BY i.id, i.enterprise_id, i.check_time
       ) j
  JOIN public.enterprises en ON en.id = j.enterprise_id
 WHERE j.heures > public.encheck_seuil(j.enterprise_id, 'appariement_heures', 16)
 GROUP BY en.name
 ORDER BY entrees_avec_sortie_hors_tolerance DESC;

-- Et pour LE salarié ciblé, ses gardes longues des 30 derniers jours : est-ce son
-- régime normal (un patron qui finit à 1 h du matin tous les soirs) ou un accident ?
SELECT to_char(i.check_time AT TIME ZONE 'UTC', 'YYYY-MM-DD HH24:MI') AS entree,
       to_char(min(o.check_time) AT TIME ZONE 'UTC', 'YYYY-MM-DD HH24:MI') AS sortie,
       round(EXTRACT(EPOCH FROM (min(o.check_time) - i.check_time)) / 3600.0, 2) AS heures,
       CASE WHEN EXTRACT(EPOCH FROM (min(o.check_time) - i.check_time)) / 3600.0
                 > public.encheck_seuil(e.enterprise_id, 'appariement_heures', 16)
            THEN '⚠️ au-dessus de la tolérance → journée non appariable'
            ELSE 'ok' END AS regime
  FROM public.attendances i
  JOIN public.employees e ON e.id = i.employee_id
  LEFT JOIN public.attendances o
         ON o.employee_id  = i.employee_id
        AND lower(o.check_type::text) = 'out'
        AND o.check_time >  i.check_time
        AND o.check_time <= i.check_time + interval '36 hours'
        AND o.is_auto_closed = false
 WHERE e.matricule = current_setting('diag.matricule', true)
   AND lower(i.check_type::text) = 'in'
   AND i.is_auto_closed = false
   AND i.check_time >= now() - interval '30 days'
 GROUP BY i.id, i.check_time, e.enterprise_id
 ORDER BY i.check_time DESC;


-- ─────────────────────────────────────────────────────────────────────────────
--  E. CE QUE LE SERVEUR A SIGNALÉ — l'alignement Dev 1 se joue ici
--      Si le motif porte le même 16 que la base (`hors_fenetre:57600_…` = 16 h),
--      un seul réglage déplace les deux moteurs. Si le chiffre est DIFFÉRENT, il
--      existe un second seuil codé en dur côté Dev 1 : à lui de l'aligner, pas à
--      nous de le deviner.
-- ─────────────────────────────────────────────────────────────────────────────
SELECT coalesce(a.suspect_reason, '(aucun motif)') AS motif_brut,
       count(*)                                    AS badges,
       to_char(min(a.check_time) AT TIME ZONE 'UTC', 'YYYY-MM-DD HH24:MI') AS premier,
       to_char(max(a.check_time) AT TIME ZONE 'UTC', 'YYYY-MM-DD HH24:MI') AS dernier
  FROM public.attendances a
  JOIN public.employees e ON e.id = a.employee_id
 WHERE e.matricule = current_setting('diag.matricule', true)
   AND a.check_time >= now() - interval '30 days'
 GROUP BY 1
 ORDER BY badges DESC;

-- Tous les badges suspects de l'entreprise sur 14 jours, avec l'écart mesuré
-- jusqu'à la dernière entrée : c'est cet écart que le serveur a jugé « hors fenêtre ».
SELECT to_char(a.check_time AT TIME ZONE 'UTC', 'YYYY-MM-DD HH24:MI:SS') AS badge,
       e.matricule,
       lower(a.check_type::text) AS type,
       coalesce(a.suspect_reason, '—') AS motif,
       round(EXTRACT(EPOCH FROM (a.check_time - (
              SELECT max(p.check_time) FROM public.attendances p
               WHERE p.employee_id = a.employee_id
                 AND lower(p.check_type::text) = 'in'
                 AND p.check_time < a.check_time))) / 3600.0, 2) AS ecart_avec_derniere_entree
  FROM public.attendances a
  JOIN public.employees e ON e.id = a.employee_id
 WHERE a.suspect = true
   AND a.check_time >= now() - interval '14 days'
   AND e.enterprise_id = (SELECT enterprise_id FROM public.employees
                           WHERE matricule = current_setting('diag.matricule', true))
 ORDER BY a.check_time DESC
 LIMIT 40;


-- ─────────────────────────────────────────────────────────────────────────────
--  F. CE QUE LA BASE A CONSIGNÉ POUR CES LIGNES
--      Mode « ombre »  : une ligne dans encheck_clotures_estimees, attendances
--                        intacte → l'écran peut rester faux sans consequence paie.
--      Mode « actif »  : l'estimation EST écrite dans attendances (is_auto_closed).
--      Le trou entre les deux, pour une garde de 16 h 19 plafonnée à 12 h, c'est
--      4 h 19 de temps de travail qui n'existera nulle part.
-- ─────────────────────────────────────────────────────────────────────────────
SELECT to_char(c.cree_le AT TIME ZONE 'UTC', 'YYYY-MM-DD HH24:MI') AS consigne_le,
       c.jour_travail, c.niveau, c.nb_exemples, c.ecart_minutes,
       coalesce(c.confiance, '—') AS confiance,
       c.applique,
       coalesce(c.motif_rejet, '—') AS motif_rejet,
       to_char(c.entree AT TIME ZONE 'UTC', 'MM-DD HH24:MI')          AS entree,
       to_char(c.sortie_estimee AT TIME ZONE 'UTC', 'MM-DD HH24:MI')  AS sortie_estimee,
       to_char(c.sortie_reelle AT TIME ZONE 'UTC', 'MM-DD HH24:MI')   AS sortie_reelle,
       round(EXTRACT(EPOCH FROM (coalesce(c.sortie_reelle, now()) - c.entree)) / 3600.0, 2)
        AS heures_reelles
  FROM public.encheck_clotures_estimees c
  JOIN public.employees e ON e.id = c.employee_id
 WHERE e.matricule = current_setting('diag.matricule', true)
 ORDER BY c.cree_le DESC
 LIMIT 20;

SELECT to_char(j.horodatage AT TIME ZONE 'UTC', 'YYYY-MM-DD HH24:MI') AS quand,
       j.action, j.motif, coalesce(j.pipeline, '—') AS pipeline, j.snapshot
  FROM public.encheck_pointages_journal j
  JOIN public.employees e ON e.id = j.employee_id
 WHERE e.matricule = current_setting('diag.matricule', true)
   AND j.horodatage >= now() - interval '7 days'
 ORDER BY j.horodatage DESC
 LIMIT 25;

SELECT p.pipeline,
       to_char(p.demarre_le AT TIME ZONE 'UTC', 'YYYY-MM-DD HH24:MI') AS demarre,
       coalesce(p.mode, '—') AS mode, p.ecritures, p.consignations, p.ignores,
       coalesce(p.avertissement, '—') AS avertissement
  FROM public.encheck_pipeline_runs p
 WHERE p.demarre_le >= now() - interval '3 days'
 ORDER BY p.demarre_le DESC
 LIMIT 15;


-- ─────────────────────────────────────────────────────────────────────────────
--  G. PREUVE DE FIN DE COLLAGE
--      Sans cette ligne dans les résultats, le collage a été tronqué (aperçu
--      rendu, sélection partielle) : recolle depuis le fichier BRUT téléchargé,
--      et vérifie l'empreinte avant de conclure quoi que ce soit.
-- ─────────────────────────────────────────────────────────────────────────────
SELECT 'FIN DU DIAGNOSTIC — sections A à G collées entièrement' AS etat,
       current_setting('diag.matricule', true)                    AS matricule_utilise,
       now()                                                      AS execute_le;
