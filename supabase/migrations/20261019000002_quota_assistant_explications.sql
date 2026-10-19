-- Compteur technique uniquement : 30 demandes/jour UTC/projet, 5/utilisateur.
-- Deux appels maximum par demande. Aucune donnée RH modifiée.
BEGIN;
SET LOCAL lock_timeout = '5s';
DO $$
BEGIN
 IF to_regclass('public.admins') IS NULL THEN RAISE EXCEPTION 'Préflight : admins absente'; END IF;
 IF EXISTS (SELECT 1 FROM (VALUES ('user_id'),('is_active')) c(nom)
  WHERE NOT EXISTS (SELECT 1 FROM pg_attribute WHERE attrelid='public.admins'::regclass AND attname=c.nom AND attnum>0 AND NOT attisdropped)) THEN
  RAISE EXCEPTION 'Préflight : admins.user_id et is_active requis';
 END IF;
END $$;
CREATE TABLE IF NOT EXISTS public.encheck_ai_explanation_quota (
 day date NOT NULL, scope text NOT NULL, used integer NOT NULL CHECK (used BETWEEN 1 AND 30),
 PRIMARY KEY(day,scope)
);
ALTER TABLE public.encheck_ai_explanation_quota ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.encheck_ai_explanation_quota FROM PUBLIC,anon,authenticated;
CREATE OR REPLACE FUNCTION public.encheck_ai_explanation_reserve(p_user uuid)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE d date := (now() AT TIME ZONE 'UTC')::date;
BEGIN
 IF p_user IS NULL THEN RETURN false; END IF;
 -- Single transaction-scoped lock: both ceilings checked/incremented atomically.
 PERFORM pg_advisory_xact_lock(190019,2);
 IF coalesce((SELECT used FROM public.encheck_ai_explanation_quota WHERE day=d AND scope='project'),0)>=30
 OR coalesce((SELECT used FROM public.encheck_ai_explanation_quota WHERE day=d AND scope=p_user::text),0)>=5 THEN RETURN false; END IF;
 INSERT INTO public.encheck_ai_explanation_quota(day,scope,used) VALUES(d,'project',1),(d,p_user::text,1)
 ON CONFLICT(day,scope) DO UPDATE SET used=encheck_ai_explanation_quota.used+1;
 RETURN true;
END $$;
REVOKE ALL ON FUNCTION public.encheck_ai_explanation_reserve(uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.encheck_ai_explanation_reserve(uuid) TO service_role;
COMMIT;
