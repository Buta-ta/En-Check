-- Exécuter après fixture + migrations 000006 et 000007, en base jetable seulement.
DO $$
DECLARE e uuid:=gen_random_uuid(); sara uuid:=gen_random_uuid(); reine uuid:=gen_random_uuid();
 a uuid:=gen_random_uuid(); b uuid:=gen_random_uuid(); source uuid; r jsonb; out_id uuid;
BEGIN
 INSERT INTO attendances(employee_id,enterprise_id,check_time,check_type) VALUES
 (sara,e,'2026-05-05 08:47:42+01','in') RETURNING id INTO source;
 INSERT INTO attendances(employee_id,enterprise_id,check_time,check_type) VALUES
 (a,e,'2026-05-05 08:47:25+01','in'),(a,e,'2026-05-05 15:31:45+01','out'),
 (b,e,'2026-05-05 08:47:54+01','in'),(b,e,'2026-05-05 15:32:27+01','out');
 r:=encheck_analyser_pointage(source);
 ASSERT r->>'kind'='sortie_cohorte', r::text;
 ASSERT (r->>'proposed_out')::timestamptz='2026-05-05 15:32:06+01'::timestamptz, r::text;
 ASSERT r->>'payable'='false';
 UPDATE attendances SET check_time='2026-05-05 20:03:00+01' WHERE employee_id=b AND check_type='out';
 ASSERT encheck_analyser_pointage(source)->>'kind'='divergence';
 UPDATE attendances SET check_time='2026-05-05 15:32:27+01',is_auto_closed=true,method='auto_close' WHERE employee_id=b AND check_type='out';
 ASSERT encheck_analyser_pointage(source)->>'kind'='insuffisant';
 UPDATE attendances SET is_auto_closed=false,method='qr',enterprise_id=gen_random_uuid() WHERE employee_id=b AND check_type='out';
 ASSERT encheck_analyser_pointage(source)->>'kind'='insuffisant';
 PERFORM set_config('test.admin','false',true);
 BEGIN
   PERFORM encheck_analyser_pointage(source);
   RAISE EXCEPTION 'Autorisation manquante';
 EXCEPTION WHEN insufficient_privilege THEN NULL;
 END;
 PERFORM set_config('test.admin','true',true);
 INSERT INTO attendances(employee_id,enterprise_id,check_time,check_type) VALUES
 (reine,e,'2026-05-06 20:03:00+01','in') RETURNING id INTO source;
 INSERT INTO attendances(employee_id,enterprise_id,check_time,check_type) VALUES
 (reine,e,'2026-05-06 20:03:08+01','out'),
 (a,e,'2026-05-06 20:02:38+01','out'),(b,e,'2026-05-06 20:02:46+01','out');
 r:=encheck_analyser_pointage(source);
 ASSERT r->>'kind'='depart_probable', r::text;
 ASSERT r->>'proposed_in' IS NULL;
 ASSERT (r->>'proposed_out')::timestamptz='2026-05-06 20:03:08+01'::timestamptz;
 DELETE FROM attendances WHERE employee_id=b AND check_time='2026-05-06 20:02:46+01';
 ASSERT encheck_analyser_pointage(source)->>'kind'='ambigu';
 -- La méthode historique qr reste autorisée, une valeur arbitraire non.
 BEGIN
 INSERT INTO attendances(employee_id,enterprise_id,check_time,check_type,method) VALUES (a,e,now(),'out','inconnue');
 RAISE EXCEPTION 'Méthode inconnue acceptée';
 EXCEPTION WHEN check_violation THEN NULL;
 END;
 BEGIN
 INSERT INTO attendances(employee_id,enterprise_id,check_time,check_type,method,is_auto_closed) VALUES (a,e,now(),'out','auto_close',false);
 RAISE EXCEPTION 'Estimation sans marque acceptée';
 EXCEPTION WHEN check_violation THEN NULL;
 END;
 BEGIN
 INSERT INTO attendances(employee_id,enterprise_id,check_time,check_type,method,is_auto_closed) VALUES (a,e,now(),'in','auto_close',true);
 RAISE EXCEPTION 'Entrée auto_close acceptée';
 EXCEPTION WHEN check_violation THEN NULL;
 END;
 INSERT INTO attendances(employee_id,enterprise_id,check_time,check_type,method,is_auto_closed)
 VALUES(a,e,now(),'out','auto_close',true) RETURNING id INTO out_id;
 ASSERT out_id IS NOT NULL;
 -- Nuit : comparaison d’instants, pas de découpage arbitraire à minuit.
 DELETE FROM attendances;
 INSERT INTO attendances(employee_id,enterprise_id,check_time,check_type) VALUES
 (sara,e,'2026-05-07 22:00:00+01','in') RETURNING id INTO source;
 INSERT INTO attendances(employee_id,enterprise_id,check_time,check_type) VALUES
 (a,e,'2026-05-07 22:00:10+01','in'),(a,e,'2026-05-08 05:59:50+01','out'),
 (b,e,'2026-05-07 22:00:20+01','in'),(b,e,'2026-05-08 06:00:10+01','out');
 ASSERT encheck_analyser_pointage(source)->>'kind'='sortie_cohorte';
 UPDATE encheck_reglages_pointage SET valeur='0' WHERE cle='cohorte_arrivee_minutes';
 ASSERT encheck_analyser_pointage(source)->>'kind'='insuffisant';
 UPDATE encheck_reglages_pointage SET valeur='5' WHERE cle='cohorte_arrivee_minutes';
 RAISE NOTICE 'Scénarios cohorte/méthode : OK';
END $$;
