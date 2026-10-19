-- Assertions uniquement sur une base locale jetable après migration quota.
DO $$
DECLARE n integer;
BEGIN
 FOR n IN 1..3 LOOP
   ASSERT (public.encheck_ai_test_reserver()->>'allowed')::boolean;
 END LOOP;
 ASSERT NOT (public.encheck_ai_test_reserver()->>'allowed')::boolean;
 ASSERT NOT (public.encheck_ai_test_reserver()->>'allowed')::boolean;
 ASSERT (SELECT essais FROM public.encheck_ai_test_quota WHERE jour=(now() AT TIME ZONE 'UTC')::date)=3;
 ASSERT NOT has_function_privilege('anon','public.encheck_ai_test_reserver()','EXECUTE');
 ASSERT NOT has_function_privilege('authenticated','public.encheck_ai_test_reserver()','EXECUTE');
 ASSERT has_function_privilege('service_role','public.encheck_ai_test_reserver()','EXECUTE');
 ASSERT NOT has_table_privilege('authenticated','public.encheck_ai_test_quota','SELECT');
 ASSERT NOT has_table_privilege('anon','public.encheck_ai_test_quota','INSERT');
END $$;
