-- À exécuter manuellement après 000007. Aucun badge historique réécrit.
-- Lecture : planning + historique personnel + cohorte, abstention en cas de conflit.
-- Décision : relecture serveur, heure attendue, garde-fous et journal atomiques.
BEGIN;
SET LOCAL lock_timeout = '5s';
DO $$
DECLARE missing text;
BEGIN
 SELECT string_agg(x.nom, ', ') INTO missing FROM (VALUES
 ('encheck_analyser_pointage'),('encheck_grille_au_jour'),('encheck_heure_de_fin_prevue'),
 ('encheck_mode_estimation'),('encheck_fuseau'),('encheck_seuil'),('encheck_est_admin_de'),('encheck_auteur_actuel')) x(nom)
 WHERE NOT EXISTS(SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
 WHERE n.nspname='public' AND p.proname=x.nom);
 IF missing IS NOT NULL THEN RAISE EXCEPTION 'Préflight : fonctions absentes : %. Exécuter le socle et 000007.',missing; END IF;
 IF to_regclass('public.employees') IS NULL OR to_regclass('public.encheck_pointages_journal') IS NULL THEN
 RAISE EXCEPTION 'Préflight : employees ou journal absent.'; END IF;
 SELECT string_agg(x.nom, ', ') INTO missing FROM (VALUES
 ('estimation_source_id'),('estimation_validee_le'),('estimation_validee_par'),('estimation_remplacee_le'),
 ('estimation_niveau'),('estimation_confiance'),('estimation_detail')) x(nom)
 WHERE NOT EXISTS(SELECT 1 FROM pg_attribute WHERE attrelid='public.attendances'::regclass
 AND attname=x.nom AND attnum>0 AND NOT attisdropped);
 IF missing IS NOT NULL THEN RAISE EXCEPTION 'Préflight : colonnes absentes : %',missing; END IF;
END $$;
INSERT INTO public.encheck_reglages_pointage(cle,valeur,commentaire) VALUES
 ('contexte_ecart_minutes','30','Écart maximal entre cohorte, planning et historique'),
 ('contexte_historique_jours','28','Historique personnel avant la journée examinée'),
 ('contexte_historique_min','3','Nombre de journées distinctes nécessaires'),
 ('contexte_historique_arrivee_minutes','90','Proximité circulaire des arrivées historiques')
ON CONFLICT DO NOTHING;

-- Les champs optionnels ne sont jamais référencés statiquement.
-- Un périmètre renseigné d’un seul côté n’est pas une correspondance.
CREATE OR REPLACE FUNCTION public.encheck_perimetre_compatible(p_a uuid,p_b uuid,p_ent uuid,p_date timestamptz)
RETURNS boolean LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE a jsonb; b jsonb; k text; ta text[]; tb text[];
BEGIN
 IF NOT public.encheck_est_admin_de(p_ent) THEN RETURN false; END IF;
 SELECT to_jsonb(e) INTO a FROM public.employees e WHERE e.id=p_a AND e.enterprise_id=p_ent;
 SELECT to_jsonb(e) INTO b FROM public.employees e WHERE e.id=p_b AND e.enterprise_id=p_ent;
 IF a IS NULL OR b IS NULL THEN RETURN false; END IF;
 FOREACH k IN ARRAY ARRAY['site_id','location_id','team_id'] LOOP
   IF nullif(a->>k,'') IS DISTINCT FROM nullif(b->>k,'') THEN RETURN false; END IF;
 END LOOP;
 -- Appartenances datées : pas de projection d’une équipe rejointe après la journée.
 IF to_regclass('public.team_members') IS NOT NULL THEN
   EXECUTE $q$ SELECT array_agg(j->>'team_id' ORDER BY j->>'team_id') FROM
     (SELECT to_jsonb(m) j FROM public.team_members m) t
     WHERE j->>'employee_id'=$1::text AND nullif(j->>'joined_at','')::timestamptz<=$2
       AND (nullif(j->>'removed_at','') IS NULL OR (j->>'removed_at')::timestamptz>$2)
       AND (j->>'is_active' IS DISTINCT FROM 'false' OR nullif(j->>'removed_at','') IS NOT NULL)
   $q$ INTO ta USING p_a,p_date;
   EXECUTE $q$ SELECT array_agg(j->>'team_id' ORDER BY j->>'team_id') FROM
     (SELECT to_jsonb(m) j FROM public.team_members m) t
     WHERE j->>'employee_id'=$1::text AND nullif(j->>'joined_at','')::timestamptz<=$2
       AND (nullif(j->>'removed_at','') IS NULL OR (j->>'removed_at')::timestamptz>$2)
       AND (j->>'is_active' IS DISTINCT FROM 'false' OR nullif(j->>'removed_at','') IS NOT NULL)
   $q$ INTO tb USING p_b,p_date;
   IF (ta IS NOT NULL OR tb IS NOT NULL) AND NOT coalesce(ta && tb,false) THEN RETURN false; END IF;
 END IF;
 RETURN true;
END $$;
REVOKE ALL ON FUNCTION public.encheck_perimetre_compatible(uuid,uuid,uuid,timestamptz) FROM PUBLIC,anon,authenticated;

CREATE OR REPLACE FUNCTION public.encheck_proposer_pointage(p_source uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE s public.attendances%ROWTYPE; r jsonb; g jsonb; tz text; plan timestamptz;
 candidate timestamptz; history timestamptz; tolerance numeric; days integer; minimum integer;
 arrival_window numeric; max_hours numeric; min_minutes numeric; n integer; spread numeric;
 median_seconds double precision; proofs jsonb; candidate_day date; entry_seconds numeric;
BEGIN
 SELECT * INTO s FROM public.attendances WHERE id=p_source;
 IF NOT FOUND THEN RAISE EXCEPTION 'Pointage inaccessible' USING ERRCODE='42501'; END IF;
 IF NOT public.encheck_est_admin_de(s.enterprise_id) THEN RAISE EXCEPTION 'Pointage inaccessible' USING ERRCODE='42501'; END IF;
 IF public.encheck_mode_estimation(s.enterprise_id)='desactive' THEN
   RETURN jsonb_build_object('kind','desactive','eligible',false,'reason','Les estimations sont désactivées pour cette entreprise.');
 END IF;
 IF EXISTS(SELECT 1 FROM public.attendances WHERE estimation_source_id=p_source) THEN
   RETURN jsonb_build_object('kind','deja_consignee','eligible',false,'reason','Une estimation existe déjà : conserver sa décision et recharger la fiche.');
 END IF;
 r:=public.encheck_analyser_pointage(p_source);
 -- Ne pas transformer un départ suspect ou une divergence en journée forfaitaire.
 IF r->>'kind' IS DISTINCT FROM 'sortie_cohorte' THEN RETURN r||jsonb_build_object('eligible',false); END IF;
 -- Vérifier tous les témoins retenus ; on s’abstient plutôt que sélectionner après coup.
 IF EXISTS(SELECT 1 FROM jsonb_array_elements(r->'evidence') x
   LEFT JOIN public.attendances a ON a.id=(x->>'entree_id')::uuid
   WHERE a.id IS NULL
     OR nullif(to_jsonb(a)->>'geofence_id','') IS DISTINCT FROM nullif(to_jsonb(s)->>'geofence_id','')
     OR NOT public.encheck_perimetre_compatible(s.employee_id,a.employee_id,s.enterprise_id,s.check_time)) THEN
   RETURN r||jsonb_build_object('kind','perimetre_incompatible','eligible',false,
     'reason','Les collègues retenus ne partagent pas les mêmes sites/équipes renseignés. Confirmation manuelle nécessaire.');
 END IF;
 tz:=public.encheck_fuseau(s.enterprise_id);
 candidate_day:=(s.check_time AT TIME ZONE tz)::date;
 IF candidate_day >= (now() AT TIME ZONE tz)::date THEN
   RETURN r||jsonb_build_object('kind','en_cours','eligible',false,'reason','Journée encore en cours : aucune proposition activée.');
 END IF;
 tolerance:=public.encheck_seuil(s.enterprise_id,'contexte_ecart_minutes',30);
 days:=public.encheck_seuil(s.enterprise_id,'contexte_historique_jours',28)::integer;
 minimum:=public.encheck_seuil(s.enterprise_id,'contexte_historique_min',3)::integer;
 arrival_window:=public.encheck_seuil(s.enterprise_id,'contexte_historique_arrivee_minutes',90);
 max_hours:=public.encheck_seuil(s.enterprise_id,'plafond_invention_heures',12);
 min_minutes:=public.encheck_seuil(s.enterprise_id,'duree_minimale_session_minutes',30);
 IF tolerance<=0 OR days NOT BETWEEN 1 AND 366 OR minimum<3 OR arrival_window<=0 OR max_hours<=0 OR min_minutes<=0 THEN
   RETURN jsonb_build_object('kind','reglages_invalides','eligible',false,'reason','Réglages de contexte incohérents.');
 END IF;
 candidate:=(r->>'proposed_out')::timestamptz;
 IF EXISTS(SELECT 1 FROM public.attendances a WHERE a.employee_id=s.employee_id AND a.enterprise_id=s.enterprise_id
   AND a.check_type='in' AND a.check_time>s.check_time AND a.check_time<=candidate) THEN
   RETURN r||jsonb_build_object('eligible',false,'reason','Une autre entrée apparaît avant la sortie proposée : vérifier les sessions.');
 END IF;
 g:=public.encheck_grille_au_jour(s.employee_id,s.enterprise_id,candidate_day);
 plan:=public.encheck_heure_de_fin_prevue(s.check_time,g,tz);
 r:=r||jsonb_build_object('planning',plan,'planning_source',g->>'source');
 IF plan IS NOT NULL AND abs(extract(epoch FROM plan-candidate))>tolerance*60 THEN
   RETURN r||jsonb_build_object('kind','conflit_planning','eligible',false,
     'reason','Le planning et les départs du groupe divergent. Aucune heure activée : vérifier avec le responsable.');
 END IF;
 entry_seconds:=extract(epoch FROM (s.check_time AT TIME ZONE tz)::time);
 -- Historique PERSONNEL uniquement, sessions consécutives, avant le jour examiné.
 WITH events AS (
   SELECT a.*,lead(check_time) OVER w out_time,lead(check_type) OVER w out_type,
     lead(is_auto_closed) OVER w out_auto,lead(method) OVER w out_method,
     lead(modifie_le) OVER w out_modified,lead(anomalie) OVER w out_anomaly
   FROM public.attendances a WHERE employee_id=s.employee_id AND enterprise_id=s.enterprise_id
     AND check_time>=s.check_time-make_interval(days=>days)
     AND check_time<(candidate_day::timestamp AT TIME ZONE tz)
   WINDOW w AS (ORDER BY check_time,id)
 ), samples AS (
   SELECT *, (check_time AT TIME ZONE tz)::date d,
     extract(epoch FROM (out_time AT TIME ZONE tz)-((check_time AT TIME ZONE tz)::date)::timestamp) seconds
   FROM events WHERE check_type='in' AND out_type='out'
     AND is_auto_closed IS NOT TRUE AND out_auto IS NOT TRUE
     AND method IS DISTINCT FROM 'auto_close' AND out_method IS DISTINCT FROM 'auto_close'
     AND modifie_le IS NULL AND out_modified IS NULL AND anomalie IS NULL AND out_anomaly IS NULL
     AND extract(epoch FROM out_time-check_time) BETWEEN min_minutes*60 AND max_hours*3600
     AND least(abs(extract(epoch FROM (check_time AT TIME ZONE tz)::time)-entry_seconds),
       86400-abs(extract(epoch FROM (check_time AT TIME ZONE tz)::time)-entry_seconds))<=arrival_window*60
 ), single_days AS (
   SELECT * FROM samples WHERE d IN (SELECT d FROM samples GROUP BY d HAVING count(*)=1)
 ) SELECT count(*),max(seconds)-min(seconds),percentile_cont(0.5) WITHIN GROUP(ORDER BY seconds::double precision),
   jsonb_agg(jsonb_build_object('entree',check_time,'sortie',out_time)) INTO n,spread,median_seconds,proofs FROM single_days;
 IF n>=minimum THEN
   IF spread>tolerance*60 THEN
     RETURN r||jsonb_build_object('kind','historique_variable','eligible',false,'history_count',n,
       'reason','Historique personnel variable : aucune proposition activée sans vérification.');
   END IF;
   history:=(candidate_day::timestamp+make_interval(secs=>median_seconds)) AT TIME ZONE tz;
   r:=r||jsonb_build_object('history_out',history,'history_count',n,'history_evidence',proofs);
   IF abs(extract(epoch FROM history-candidate))>tolerance*60 THEN
     RETURN r||jsonb_build_object('kind','conflit_historique','eligible',false,
       'reason','Les habitudes personnelles et les départs du groupe divergent. Vérification nécessaire.');
   END IF;
 END IF;
 IF candidate>now() OR extract(epoch FROM candidate-s.check_time) NOT BETWEEN min_minutes*60 AND max_hours*3600 THEN
   RETURN r||jsonb_build_object('eligible',false,'reason','Proposition hors des limites de durée autorisées.');
 END IF;
 RETURN r||jsonb_build_object('eligible',true,'source_id',p_source,'history_count',n,'payable',false,
   'reason','Sorties concordantes du groupe, sans contradiction détectée. Planning et historique vérifiés lorsqu’ils sont disponibles ; périmètre limité aux informations renseignées. Validation humaine requise.');
END $$;
REVOKE ALL ON FUNCTION public.encheck_proposer_pointage(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.encheck_proposer_pointage(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.encheck_proposition_decider(
 p_source uuid, p_decision text, p_attendue timestamptz,
 p_ajustement_minutes integer DEFAULT 0, p_motif text DEFAULT NULL
) RETURNS jsonb LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE s public.attendances%ROWTYPE; r jsonb; target timestamptz; row_id uuid;
BEGIN
 SELECT * INTO s FROM public.attendances WHERE id=p_source;
 IF NOT FOUND THEN RAISE EXCEPTION 'Pointage inaccessible' USING ERRCODE='42501'; END IF;
 IF NOT public.encheck_est_admin_de(s.enterprise_id) THEN RAISE EXCEPTION 'Pointage inaccessible' USING ERRCODE='42501'; END IF;
 IF p_decision IS NULL OR p_decision NOT IN ('valider','rejeter') OR p_ajustement_minutes IS NULL THEN
   RETURN jsonb_build_object('ok',false,'erreur','Décision invalide.'); END IF;
 -- Très court verrou d’écriture : évite une arrivée QR/cron entre relecture et insertion.
 -- Limité à 5 secondes d’attente, aucun appel réseau dans la transaction.
 PERFORM set_config('lock_timeout','5s',true);
 LOCK TABLE public.attendances IN SHARE ROW EXCLUSIVE MODE;
 r:=public.encheck_proposer_pointage(p_source);
 IF r->>'eligible' IS DISTINCT FROM 'true' OR p_attendue IS NULL
    OR (r->>'proposed_out')::timestamptz IS DISTINCT FROM p_attendue THEN
   RETURN jsonb_build_object('ok',false,'erreur','Les indices ont changé ou une décision existe déjà. Rechargez la journée.'); END IF;
 SELECT * INTO s FROM public.attendances WHERE id=p_source;
 IF p_ajustement_minutes<>0 AND nullif(btrim(p_motif),'') IS NULL THEN
   RETURN jsonb_build_object('ok',false,'erreur','Un motif est requis pour ajuster l’heure.'); END IF;
 target:=p_attendue+make_interval(mins=>p_ajustement_minutes);
 IF target>now() OR extract(epoch FROM target-s.check_time) NOT BETWEEN
   public.encheck_seuil(s.enterprise_id,'duree_minimale_session_minutes',30)*60
   AND public.encheck_seuil(s.enterprise_id,'plafond_invention_heures',12)*3600 THEN
   RETURN jsonb_build_object('ok',false,'erreur','Heure ajustée hors des limites autorisées.'); END IF;
 INSERT INTO public.attendances(employee_id,enterprise_id,check_time,check_type,method,is_auto_closed,
   estimation_source_id,estimation_niveau,estimation_confiance,estimation_detail,
   estimation_validee_le,estimation_validee_par,estimation_remplacee_le,anomalie)
 VALUES(s.employee_id,s.enterprise_id,target,'out','auto_close',true,p_source,2,NULL,
   r||jsonb_build_object('motif',p_motif,'ajustement_minutes',p_ajustement_minutes),
   CASE WHEN p_decision='valider' THEN now() END,
   CASE WHEN p_decision='valider' THEN public.encheck_auteur_actuel() END,
   CASE WHEN p_decision='rejeter' THEN now() END,
   CASE WHEN p_decision='rejeter' THEN 'sortie_presumee_rejetee' END) RETURNING id INTO row_id;
 INSERT INTO public.encheck_pointages_journal(enterprise_id,employee_id,attendance_id,action,motif,snapshot,pipeline,auteur)
 VALUES(s.enterprise_id,s.employee_id,row_id,
   CASE WHEN p_decision='valider' THEN 'estimation_validee' ELSE 'estimation_rejetee' END,
   coalesce(p_motif,p_decision),r||jsonb_build_object('heure_retenue',target),
   'encheck_proposition_decider',public.encheck_auteur_actuel());
 RETURN jsonb_build_object('ok',true,'ligne_id',row_id,'statut',p_decision);
END $$;
REVOKE ALL ON FUNCTION public.encheck_proposition_decider(uuid,text,timestamptz,integer,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.encheck_proposition_decider(uuid,text,timestamptz,integer,text) TO authenticated;
COMMIT;
