-- UNIQUEMENT base locale jetable : fixtures + migrations 000006, 000007, 000008.
DO $$
DECLARE e uuid:=gen_random_uuid(); sara uuid:=gen_random_uuid(); a uuid:=gen_random_uuid(); b uuid:=gen_random_uuid();
 source uuid; r jsonb; target timestamptz; i integer;
BEGIN
 INSERT INTO employees(id,enterprise_id) VALUES(sara,e),(a,e),(b,e);
 INSERT INTO attendances(employee_id,enterprise_id,check_time,check_type)
 VALUES(sara,e,'2026-05-05 08:47:42+01','in') RETURNING id INTO source;
 INSERT INTO attendances(employee_id,enterprise_id,check_time,check_type) VALUES
 (a,e,'2026-05-05 08:47:25+01','in'),(a,e,'2026-05-05 15:31:45+01','out'),
 (b,e,'2026-05-05 08:47:54+01','in'),(b,e,'2026-05-05 15:32:27+01','out');
 r:=encheck_proposer_pointage(source); ASSERT r->>'eligible'='true',r::text;
 target:=(r->>'proposed_out')::timestamptz;
 ASSERT target='2026-05-05 15:32:06+01'::timestamptz;
 ASSERT r->>'history_count'='0';
 UPDATE employees SET site_id=gen_random_uuid() WHERE id=b;
 ASSERT encheck_proposer_pointage(source)->>'eligible'='false';
 UPDATE employees SET site_id=NULL WHERE id=b;
 INSERT INTO team_members VALUES(sara,gen_random_uuid(),'2026-01-01',NULL,true);
 ASSERT encheck_proposer_pointage(source)->>'kind'='perimetre_incompatible';
 UPDATE team_members SET joined_at='2026-06-01';
 ASSERT encheck_proposer_pointage(source)->>'eligible'='true';
 DELETE FROM team_members;
 PERFORM set_config('test.plan','2026-05-05 17:00:00+01',true);
 ASSERT encheck_proposer_pointage(source)->>'kind'='conflit_planning';
 PERFORM set_config('test.plan','',true);
 FOR i IN 1..3 LOOP
   INSERT INTO attendances(employee_id,enterprise_id,check_time,check_type) VALUES
   (sara,e,'2026-05-05 08:47:42+01'::timestamptz-make_interval(days=>i),'in'),
   (sara,e,'2026-05-05 17:00:00+01'::timestamptz-make_interval(days=>i),'out');
 END LOOP;
 ASSERT encheck_proposer_pointage(source)->>'kind'='conflit_historique';
 UPDATE attendances SET check_time=check_time-interval '88 minutes' WHERE employee_id=sara AND check_type='out';
 ASSERT encheck_proposer_pointage(source)->>'eligible'='true';
 ASSERT encheck_proposition_decider(source,'valider',target+interval '1 minute')->>'ok'='false';
 ASSERT encheck_proposition_decider(source,'valider',target,10,NULL)->>'ok'='false';
 ASSERT encheck_proposition_decider(source,'valider',target,10000,'test')->>'ok'='false';
 PERFORM set_config('test.admin','false',true);
 BEGIN PERFORM encheck_proposition_decider(source,'valider',target);
 RAISE EXCEPTION 'Accès indu'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 PERFORM set_config('test.admin','true',true);
 r:=encheck_proposition_decider(source,'valider',target,5,'Responsable confirme 5 minutes de plus');
 ASSERT r->>'ok'='true',r::text;
 ASSERT EXISTS(SELECT 1 FROM attendances WHERE id=(r->>'ligne_id')::uuid AND is_auto_closed AND method='auto_close'
 AND estimation_validee_le IS NOT NULL AND check_time=target+interval '5 minutes');
 ASSERT (SELECT count(*) FROM encheck_pointages_journal WHERE attendance_id=(r->>'ligne_id')::uuid)=1;
 ASSERT encheck_proposition_decider(source,'valider',target)->>'ok'='false';
 ASSERT encheck_proposer_pointage(source)->>'kind'='deja_consignee';
 -- Rejet consigné, jamais recréé, aucun badge réel effacé.
 DELETE FROM attendances WHERE estimation_source_id=source;
 r:=encheck_proposition_decider(source,'rejeter',target);
 ASSERT r->>'ok'='true',r::text;
 ASSERT EXISTS(SELECT 1 FROM attendances WHERE id=(r->>'ligne_id')::uuid AND estimation_remplacee_le IS NOT NULL
 AND estimation_validee_le IS NULL AND anomalie='sortie_presumee_rejetee');
 ASSERT encheck_proposer_pointage(source)->>'eligible'='false';
 ASSERT EXISTS(SELECT 1 FROM attendances WHERE id=source AND check_type='in');
 DELETE FROM attendances WHERE estimation_source_id=source;
 INSERT INTO attendances(employee_id,enterprise_id,check_time,check_type) VALUES(sara,e,target,'out');
 ASSERT encheck_proposition_decider(source,'valider',target)->>'ok'='false';
 -- Reine : ne jamais fabriquer une entrée ni une journée payée.
 DELETE FROM attendances;
 INSERT INTO attendances(employee_id,enterprise_id,check_time,check_type)
 VALUES(sara,e,'2026-05-06 20:03:00+01','in') RETURNING id INTO source;
 INSERT INTO attendances(employee_id,enterprise_id,check_time,check_type) VALUES
 (sara,e,'2026-05-06 20:03:08+01','out'),(a,e,'2026-05-06 20:02:38+01','out'),(b,e,'2026-05-06 20:02:46+01','out');
 r:=encheck_proposer_pointage(source);
 ASSERT r->>'kind'='depart_probable'; ASSERT r->>'eligible'='false';
 ASSERT encheck_proposition_decider(source,'valider',(r->>'proposed_out')::timestamptz)->>'ok'='false';
 -- Nuit : la proposition du lendemain conserve son instant et sa date.
 DELETE FROM attendances;
 INSERT INTO attendances(employee_id,enterprise_id,check_time,check_type)
 VALUES(sara,e,'2026-05-07 22:00:00+01','in') RETURNING id INTO source;
 INSERT INTO attendances(employee_id,enterprise_id,check_time,check_type) VALUES
 (a,e,'2026-05-07 22:00:10+01','in'),(a,e,'2026-05-08 05:59:50+01','out'),
 (b,e,'2026-05-07 22:00:20+01','in'),(b,e,'2026-05-08 06:00:10+01','out');
 r:=encheck_proposer_pointage(source);
 ASSERT r->>'eligible'='true',r::text;
 ASSERT (r->>'proposed_out')::timestamptz='2026-05-08 06:00:00+01'::timestamptz;
 RAISE NOTICE 'Contexte + décision : assertions réussies';
END $$;
