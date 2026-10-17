-- Correctif de compatibilité, à exécuter manuellement en production.
-- Ne modifie aucun badge et ne supprime aucune protection des méthodes historiques.
-- La définition RÉELLE de la contrainte est lue en base, jamais devinée.
-- Seul auto_close est ajouté, uniquement pour une sortie explicitement présumée.
-- En cas de schéma inattendu : transaction annulée, transmettre le message exact.
BEGIN;
SET LOCAL lock_timeout = '5s';
DO $$
DECLARE
  v_oid oid;
  v_expr text;
  v_keys smallint[];
  v_method smallint;
  v_comment text;
  v_missing text;
BEGIN
  IF to_regclass('public.attendances') IS NULL THEN
    RAISE EXCEPTION 'Préflight : table attendances absente. Rien appliqué.';
  END IF;
  SELECT string_agg(x.nom, ', ') INTO v_missing
  FROM (VALUES ('method'), ('is_auto_closed'), ('check_type')) x(nom)
  WHERE NOT EXISTS (SELECT 1 FROM pg_attribute
    WHERE attrelid = 'public.attendances'::regclass AND attname = x.nom
      AND attnum > 0 AND NOT attisdropped);
  IF v_missing IS NOT NULL THEN
    RAISE EXCEPTION 'Préflight : colonnes absentes : %. Rien appliqué.', v_missing;
  END IF;
  SELECT attnum INTO v_method FROM pg_attribute
    WHERE attrelid = 'public.attendances'::regclass AND attname = 'method'
      AND atttypid IN ('text'::regtype, 'varchar'::regtype);
  IF v_method IS NULL THEN
    RAISE EXCEPTION 'Préflight : type de method inattendu (texte requis). Rien appliqué.';
  END IF;
  -- Verrou court : aucune fenêtre pendant laquelle la contrainte serait absente.
  LOCK TABLE public.attendances IN ACCESS EXCLUSIVE MODE;
  SELECT oid, pg_get_expr(conbin, conrelid), conkey,
         obj_description(oid, 'pg_constraint')
    INTO v_oid, v_expr, v_keys, v_comment
    FROM pg_constraint WHERE conrelid = 'public.attendances'::regclass
      AND conname = 'attendances_method_check' AND contype = 'c';
  IF v_oid IS NULL THEN
    RAISE EXCEPTION 'Préflight : attendances_method_check introuvable. Rien appliqué.';
  END IF;
  IF v_comment LIKE 'encheck:method-estimation:v1;%' THEN RETURN; END IF;
  IF v_keys IS DISTINCT FROM ARRAY[v_method]::smallint[] OR v_expr IS NULL THEN
    RAISE EXCEPTION 'Préflight : la contrainte porte sur plusieurs colonnes. Analyse manuelle requise. Rien appliqué.';
  END IF;
  RAISE NOTICE 'Contrainte historique conservée : %', v_expr;
  ALTER TABLE public.attendances DROP CONSTRAINT attendances_method_check;
  EXECUTE format(
    'ALTER TABLE public.attendances ADD CONSTRAINT attendances_method_check CHECK '
    || '(((%s) AND method IS DISTINCT FROM ''auto_close'') OR '
    || '(method = ''auto_close'' AND is_auto_closed IS TRUE AND check_type IS NOT DISTINCT FROM ''out''))',
    v_expr);
  EXECUTE format('COMMENT ON CONSTRAINT attendances_method_check ON public.attendances IS %L',
    'encheck:method-estimation:v1; historique=' || v_expr || '; commentaire=' || coalesce(v_comment, ''));
END $$;
COMMIT;

-- Résultat visible à conserver avec le compte rendu de déploiement.
SELECT conname, pg_get_constraintdef(oid) AS definition,
       obj_description(oid, 'pg_constraint') AS historique
FROM pg_constraint WHERE conrelid = 'public.attendances'::regclass
  AND conname = 'attendances_method_check';
