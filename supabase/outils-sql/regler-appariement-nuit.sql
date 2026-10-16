-- ═══════════════════════════════════════════════════════════════════════════
--  EN-CHECK — OUTIL — ÉLARGIR LA TOLÉRANCE D'APPARIEMENT POUR UNE ENTREPRISE
--  (« une sortie qui passe minuit doit rattacher sa journée »)
-- ═══════════════════════════════════════════════════════════════════════════
--  ⚠️⚠️ CE FICHIER ÉCRIT EN BASE. ⚠️⚠️
--     Il n'est PAS en lecture seule, contrairement aux autres outils du dossier.
--     Il ne modifie AUCUNE structure, AUCUNE ligne de `attendances`, AUCUN bulletin :
--     une seule ligne de réglage (une valeur de seuil, pour UNE entreprise).
--     Il est ici, dans `outils-sql/`, et non dans `migrations/`, précisément parce
--     qu'il ne doit JAMAIS rencontrer un `supabase db push` : un réglage d'entreprise
--     n'est pas une structure, et il se rejoue à la main ou pas du tout.
--
--  PROBLÈME RÉSOLU (16/10, Hippo BIYOKILA — ENN-0002)
--  ─────────────────────────────────────────────────
--     entrée réelle 15/10 08:54:39 · sortie réelle 16/10 01:14 · 16 h 19 min 21 s.
--     La tolérance d'appariement vaut 16 h (`appariement_heures`, migration
--     20261016000001 l.111). 19 minutes de trop et la sortie n'est rattachée à
--     rien : l'écran du 15 reste « Sortie --:--:-- · 0 sec », celui du 16 affiche
--     « ✗ Absent » plus le 🚩 du serveur.
--     Le même 16 est consulté par la base pour décider si un VRAI badge remplace une
--     estimation (migration l.1139 et l.1204) : en mode « actif », cette journée
--     aurait donc été PAYÉE SUR L'ESTIMATION (12 h max, `plafond_invention_heures`)
--     au lieu des 16 h 19 réellement pointées. C'est pour ça que le réglage se
--     change à la base, et pas seulement dans l'affichage.
--
--  POURQUOI UNE OVERRIDE ENTREPRISE PLUTÔT QUE DE MONTER LE GLOBAL
--  ──────────────────────────────────────────────────────────────
--     `encheck_seuil()` cherche : override entreprise → valeur globale → défaut codé
--     (migration l.134-141). Le JS fait le même ordre (seuilsPointage.js l.88-96).
--     Ajouter la ligne de CETTE entreprise ne change donc rien pour les autres.
--     Un patron qui finit à 1 h du matin n'est pas une règle d'entreprise : c'est
--     son contrat de travail. Le chiffre de 16 h reste la norme ailleurs.
--
--  APRÈS EXÉCUTION : rien à redéployer, mais recharger la page Pointages — le JS
--  met les seuils en cache par entreprise (`_cache`, l.68) jusqu'au prochain
--  rechargement. Le 15 devrait alors afficher `Sortie 01:14` et `16h19`.
--
--  Ce fichier est vérifiable : l'empreinte du fichier complet est donnée par
--  `sha256sum` dans le dépôt (`git show HEAD:supabase/outils-sql/regler-appariement-nuit.sql`)
--  et la section 5 prouve que le collage a été complet.
-- ═══════════════════════════════════════════════════════════════════════════


-- ─────────────────────────────────────────────────────────────────────────────
--  0. LA CIBLE — UNE SEULE LIGNE À ÉDITER : le matricule du salarié concerné.
--      L'entreprise est déduite de lui (pas de uuid à recopier, pas de copier-coller
--      d'une vue rendue).
-- ─────────────────────────────────────────────────────────────────────────────
SELECT set_config('regl.matricule', 'ENN-0002', false);
SELECT set_config('regl.valeur',    '20',       false);   -- nouvelles heures de tolérance


-- ─────────────────────────────────────────────────────────────────────────────
--  1. AVANT — ce que la base applique aujourd'hui, et la valeur qui va être écrite
-- ─────────────────────────────────────────────────────────────────────────────
SELECT e.matricule, en.id AS enterprise_id, en.name AS entreprise,
       public.encheck_seuil(en.id, 'appariement_heures', 16) AS appariement_avant,
       (SELECT r.valeur FROM public.encheck_reglages_pointage r
         WHERE r.cle = 'appariement_heures' AND r.enterprise_id = en.id) AS override_actuel,
       current_setting('regl.valeur')::numeric                            AS appariement_apres
  FROM public.employees e
  JOIN public.enterprises en ON en.id = e.enterprise_id
 WHERE e.matricule = current_setting('regl.matricule', true);

-- Contrôle préalable NON NÉGOCIABLE : la nouvelle valeur doit rester cohérente avec
-- les deux autres chiffres de la même famille. En dessous du seuil d'oubli, une
-- garde normale est coupée en deux journées (c'est le commentaire de
-- `chargerSeuilsPointage`, l.128-136, côté JS) ; au-dessus de 24 h, on accepte
-- d'apparier une sortie du surlendemain, ce n'est plus une garde mais une erreur.
SELECT CASE
         WHEN v.apres <= v.oubli
           THEN '⛔ REFUSÉ : ' || v.apres || ' h <= seuil d''oubli (' || v.oubli
                || ' h). Une journée normale serait coupée en deux.'
         WHEN v.apres > 24
           THEN '⛔ REFUSÉ : ' || v.apres || ' h > 24 h. Au-delà, on apparie n''importe quoi.'
         WHEN v.apres < 16
           THEN '⚠️ DIMINUTION : tu resserres sous le défaut (16 h) — des gardes '
                || 'longues vont se détacher. Volontaire ?'
         ELSE 'ok : ' || v.apres || ' h, entre l''oubli (' || v.oubli
              || ' h) et le plafond de 24 h. Tu peux lancer la section 2.'
       END AS controle_prealable
  FROM (SELECT current_setting('regl.valeur')::numeric AS apres,
               public.encheck_seuil(
                 (SELECT en.id FROM public.employees e
                    JOIN public.enterprises en ON en.id = e.enterprise_id
                   WHERE e.matricule = current_setting('regl.matricule', true)),
                 'oubli_sortie_heures', 12)::numeric AS oubli) v;


-- ─────────────────────────────────────────────────────────────────────────────
--  2. ÉCRIRE — une ligne, idempotent (relançable : il remet la même valeur)
--      ON CONFLICT cible l'index partiel `encheck_reglages_pointage_entreprise_key`
--      (migration l.106) en répétant sa prédicat, sinon Postgres ne le trouve pas.
--      BEGIN/COMMIT explicites : si l'UPDATE ne touche aucune ligne, ROLLBACK.
-- ─────────────────────────────────────────────────────────────────────────────
BEGIN;

INSERT INTO public.encheck_reglages_pointage AS r (enterprise_id, cle, valeur, commentaire, maj_le)
SELECT en.id, 'appariement_heures', to_jsonb(current_setting('regl.valeur')::numeric),
       'Override posé le ' || to_char(now(), 'YYYY-MM-DD')
         || ' : gardes réelles au-delà de 16 h (sortie après minuit). '
         || 'Cas déclencheur : ' || current_setting('regl.matricule', true)
         || ' — 15/10 08:54:39 → 16/10 01:14 = 16 h 19.',
       now()
  FROM public.employees e
  JOIN public.enterprises en ON en.id = e.enterprise_id
 WHERE e.matricule = current_setting('regl.matricule', true)
ON CONFLICT (enterprise_id, cle) WHERE enterprise_id IS NOT NULL
DO UPDATE SET valeur = to_jsonb(current_setting('regl.valeur')::numeric),
              commentaire = EXCLUDED.commentaire,
              maj_le = now();

-- Contrôle dans la même transaction : doit renvoyer 1. S'il renvoie 0, le matricule
-- est introuvable et RIEN n'a été écrit — le COMMIT qui suit ne commite alors qu'une
-- ligne orpheline absente, donc aucun dégât, mais rien d'utile non plus.
SELECT count(*) AS lignes_ecrites
  FROM public.encheck_reglages_pointage
 WHERE cle = 'appariement_heures'
   AND enterprise_id = (SELECT e.enterprise_id FROM public.employees e
                         WHERE e.matricule = current_setting('regl.matricule', true))
   AND valeur = to_jsonb(current_setting('regl.valeur')::numeric);

COMMIT;


-- ─────────────────────────────────────────────────────────────────────────────
--  3. APRÈS — le nouveau verdict sur la journée qui a posé problème
--      (le même calcul que la section C du diagnostic, en une requête)
-- ─────────────────────────────────────────────────────────────────────────────
SELECT to_char(i.check_time AT TIME ZONE 'UTC', 'YYYY-MM-DD HH24:MI') AS entree,
       to_char(min(o.check_time) AT TIME ZONE 'UTC', 'YYYY-MM-DD HH24:MI') AS sortie,
       round(EXTRACT(EPOCH FROM (min(o.check_time) - i.check_time)) / 3600.0, 3) AS duree_heures,
       public.encheck_seuil(e.enterprise_id, 'appariement_heures', 16) AS appariement_desormais,
       CASE
         WHEN EXTRACT(EPOCH FROM (min(o.check_time) - i.check_time)) / 3600.0
              <= public.encheck_seuil(e.enterprise_id, 'appariement_heures', 16)
           THEN 'ok : la sortie rattache bien la journée → l''écran du 15 affichera l''heure et la durée'
         ELSE '⚠️ toujours refusée — la valeur n''a pas été lue (cache JS ?) ou ne suffit pas'
       END AS verdict
  FROM public.attendances i
  JOIN public.employees e ON e.id = i.employee_id
  LEFT JOIN public.attendances o
         ON o.employee_id = i.employee_id AND lower(o.check_type::text) = 'out'
        AND o.check_time > i.check_time AND o.check_time <= i.check_time + interval '36 hours'
        AND o.is_auto_closed = false
 WHERE e.matricule = current_setting('regl.matricule', true)
   AND lower(i.check_type::text) = 'in'
   AND i.check_time >= date_trunc('day', now()) - interval '10 days'
   AND i.is_auto_closed = false
 GROUP BY i.id, i.check_time, e.enterprise_id
 ORDER BY i.check_time DESC;


-- ─────────────────────────────────────────────────────────────────────────────
--  4. CE QUE ÇA CHANGE AILLEURS — à lire AVANT de garder le réglage
--      Le même seuil gouverne la réconciliation « un vrai badge remplace
--      l'estimation » : l'élargir veut dire qu'un badge réel jusqu'à N h après
--      l'entrée écrasera l'estimation. C'est le comportement voulu, mais il faut
--      le savoir, et ça touche ces lignes-ci :
-- ─────────────────────────────────────────────────────────────────────────────
SELECT count(*) AS estimations_encore_vivantes_entre_16_et_20_h
  FROM public.attendances e
  JOIN public.attendances i ON i.id = e.estimation_source_id
 WHERE e.is_auto_closed = true
   AND e.estimation_remplacee_le IS NULL
   AND EXISTS (SELECT 1 FROM public.attendances r
                WHERE r.employee_id = e.employee_id
                  AND lower(r.check_type::text) = 'out'
                  AND r.is_auto_closed = false
                  AND r.check_time >  i.check_time
                  AND r.check_time <= i.check_time + interval '20 hours')
   AND EXTRACT(EPOCH FROM (
         (SELECT min(r.check_time) FROM public.attendances r
           WHERE r.employee_id = e.employee_id AND lower(r.check_type::text) = 'out'
             AND r.is_auto_closed = false AND r.check_time > i.check_time) - i.check_time
       )) / 3600.0 > 16;

SELECT e.matricule, count(*) FILTER (WHERE e2.is_auto_closed) AS lignes_estimees,
       count(*) AS lignes_total
  FROM public.attendances e2
  JOIN public.employees e ON e.id = e2.employee_id
 WHERE e.enterprise_id = (SELECT e3.enterprise_id FROM public.employees e3
                           WHERE e3.matricule = current_setting('regl.matricule', true))
   AND e2.check_time >= now() - interval '30 days'
 GROUP BY e.matricule
 ORDER BY lignes_total DESC
 LIMIT 15;


-- ─────────────────────────────────────────────────────────────────────────────
--  5. PREUVE DE FIN DE COLLAGE
-- ─────────────────────────────────────────────────────────────────────────────
SELECT 'FIN DU RÉGLAGE — sections 0 à 5 collées entièrement' AS etat,
       public.encheck_seuil(
         (SELECT e.enterprise_id FROM public.employees e
           WHERE e.matricule = current_setting('regl.matricule', true)),
         'appariement_heures', 16) AS appariement_en_vigueur,
       current_setting('regl.valeur')::numeric AS valeur_demandee;


-- ─────────────────────────────────────────────────────────────────────────────
--  6. ANNULER (à décommenter seulement pour revenir en arrière)
--      Supprimer l'override fait retomber l'entreprise sur la valeur globale (16) :
--      c'est exactement l'état d'avant, rien d'autre n'est touché.
-- ─────────────────────────────────────────────────────────────────────────────
-- BEGIN;
-- DELETE FROM public.encheck_reglages_pointage
--  WHERE cle = 'appariement_heures'
--    AND enterprise_id = (SELECT e.enterprise_id FROM public.employees e
--                          WHERE e.matricule = 'ENN-0002');   -- ⬅️ le même matricule
-- COMMIT;
-- SELECT public.encheck_seuil((SELECT e.enterprise_id FROM public.employees e
--                               WHERE e.matricule = 'ENN-0002'),
--                             'appariement_heures', 16) AS revenu_a;   -- attendu : 16
