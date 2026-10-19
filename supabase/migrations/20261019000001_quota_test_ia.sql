-- Compteur TECHNIQUE du test IA uniquement. Aucune table RH modifiée.
-- À exécuter avant de déployer test-ai-search. Trois essais/jour UTC/projet,
-- deux appels maximum par essai, même si plusieurs instances tournent.
BEGIN;
SET LOCAL lock_timeout = '5s';
DO $$
BEGIN
 IF to_regclass('public.admins') IS NULL THEN RAISE EXCEPTION 'Préflight : table admins absente'; END IF;
 IF EXISTS (SELECT 1 FROM (VALUES ('user_id'),('role'),('is_active')) c(nom)
   WHERE NOT EXISTS (SELECT 1 FROM pg_attribute WHERE attrelid='public.admins'::regclass
     AND attname=c.nom AND attnum>0 AND NOT attisdropped)) THEN
   RAISE EXCEPTION 'Préflight : admins.user_id, role et is_active requis pour authentifier le test';
 END IF;
END $$;
CREATE TABLE IF NOT EXISTS public.encheck_ai_test_quota (
 jour date PRIMARY KEY,
 essais integer NOT NULL CHECK (essais BETWEEN 1 AND 3)
);
ALTER TABLE public.encheck_ai_test_quota ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.encheck_ai_test_quota FROM PUBLIC, anon, authenticated;
CREATE OR REPLACE FUNCTION public.encheck_ai_test_reserver()
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE n integer;
BEGIN
 INSERT INTO public.encheck_ai_test_quota(jour,essais)
 VALUES ((now() AT TIME ZONE 'UTC')::date,1)
 ON CONFLICT(jour) DO UPDATE SET essais=encheck_ai_test_quota.essais+1
 WHERE encheck_ai_test_quota.essais<3
 RETURNING essais INTO n;
 RETURN jsonb_build_object('allowed', n IS NOT NULL, 'remaining',coalesce(3-n,0));
END $$;
REVOKE ALL ON FUNCTION public.encheck_ai_test_reserver() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.encheck_ai_test_reserver() TO service_role;
COMMIT;
