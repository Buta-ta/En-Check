-- LOCAL TEST ONLY: never execute on production (consumes the day's quotas).
DO $$
DECLARE i integer; u integer;
BEGIN
 ASSERT NOT public.encheck_ai_explanation_reserve(NULL);
 FOR u IN 1..6 LOOP
  FOR i IN 1..5 LOOP
   ASSERT public.encheck_ai_explanation_reserve(('00000000-0000-0000-0000-'||lpad(u::text,12,'0'))::uuid);
  END LOOP;
  ASSERT NOT public.encheck_ai_explanation_reserve(('00000000-0000-0000-0000-'||lpad(u::text,12,'0'))::uuid);
 END LOOP;
 ASSERT NOT public.encheck_ai_explanation_reserve('00000000-0000-0000-0000-000000000007');
 ASSERT (SELECT used FROM public.encheck_ai_explanation_quota WHERE scope='project')=30;
 ASSERT NOT has_function_privilege('authenticated','public.encheck_ai_explanation_reserve(uuid)','EXECUTE');
 ASSERT NOT has_function_privilege('anon','public.encheck_ai_explanation_reserve(uuid)','EXECUTE');
 ASSERT has_function_privilege('service_role','public.encheck_ai_explanation_reserve(uuid)','EXECUTE');
 ASSERT NOT has_table_privilege('authenticated','public.encheck_ai_explanation_quota','SELECT');
END $$;
