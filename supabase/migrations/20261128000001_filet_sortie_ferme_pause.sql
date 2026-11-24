-- ═══════════════════════════════════════════════════════════════════════════
-- 🪢 FILET « UNE SORTIE FERME LA PAUSE » — version appliquée en production
--
-- ORIGINE
-- ────────────────────────────────────────────────────────────────────────────
-- Écrit par le lot App Pointage, validation du fondateur du 23/11. Appliqué
-- en production sans passer par ce dépôt ; cette migration le **remet dans
-- le dépôt** pour que l'état décrit par le code soit l'état de la base.
--
-- LE PROBLÈME QU'IL RÉSOUT
-- ────────────────────────────────────────────────────────────────────────────
-- Le 17/11, une pause a été ouverte à 15:42 et une sortie pointée à 17:20.
-- La pause n'a jamais été fermée : elle est restée ouverte 5,9 jours, et le
-- bandeau de la borne affichait « Hippo B. 141:07 ». Le moteur d'alerte
-- avait pourtant signalé « Pause sans reprise » dès 17:00 — **une alerte
-- signale, elle ne corrige pas.** Rien ne fermait une pause dont la sortie
-- était pointée. C'est ce trou que ce filet bouche.
--
-- LES TROIS GARDE-FOUS (ce que la validation engage)
--   1. BORNÉ   — la pause se ferme à `NEW.check_time`, l'heure du pointage,
--                jamais une heure inventée ; la fermeture délègue à
--                `encheck_pause_fermer` (une seule définition de « fermer »).
--   2. VISIBLE — `motif_fermeture = 'sortie'` + trace au journal
--                (`pause_fermee_sortie_auto`).
--   3. RATTRAPABLE — le manager garde valider / écarter / restaurer ; le
--                jugement tourne comme d'habitude.
--
-- CE QUE JE N'AI PAS REPRIS DE LEUR VERSION
-- ────────────────────────────────────────────────────────────────────────────
-- Leur ACL laissait `anon` et `authenticated` exécuter les deux fonctions.
-- Aucune des deux n'est appelée par l'app (vérifié sur les 90 fichiers Dart
-- de `3826078` : 0 appel) — elles ne servent qu'en interne, par le
-- déclencheur. Et `encheck_pause_clore_sortie` est **SECURITY DEFINER** :
-- la laisser ouverte à `anon`, c'est permettre de fermer la pause de
-- n'importe qui sans session. Révoqué, comme le reste du lot.
--
-- ⚠️ ÉTAT : déjà appliqué en production. Cette migration documente et
--    reproduit l'état, elle ne le crée pas. Rejouée, elle est sans effet
--    de bord (CREATE OR REPLACE idempotent).
-- ═══════════════════════════════════════════════════════════════════════════

BEGIN;

-- ───────────────────────────────────────────────────────────────────────────
-- 1. La capacité : ferme la pause ouverte À L'HEURE DE LA SORTIE POINTÉE
-- ───────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.encheck_pause_clore_sortie(
  p_employee uuid,
  p_instant  timestamptz
)
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE
  v_res jsonb;
  v_id  uuid;
  v_ent uuid;
BEGIN
  IF p_employee IS NULL OR p_instant IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'raison', 'parametres');
  END IF;

  v_res := public.encheck_pause_fermer(p_employee, p_instant, 'sortie');

  IF COALESCE((v_res ->> 'ok')::boolean, false) THEN
    v_id := (v_res ->> 'pause_id')::uuid;
    SELECT enterprise_id INTO v_ent FROM public.encheck_pauses WHERE id = v_id;
    BEGIN
      PERFORM public.encheck_journal_tracer(
        'encheck_pauses', v_id, v_ent, p_employee,
        'Pause ouverte au pointage de sortie : fermee automatiquement a l''heure de la sortie pointee. Aucune heure inventee.',
        'pause_fermee_sortie_auto');
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING 'Trace sortie-pause non ecrite : %', SQLERRM;
    END;
  END IF;

  RETURN v_res;
END;
$$;

-- ───────────────────────────────────────────────────────────────────────────
-- 2. Le déclencheur : toute sortie pointée, quelle qu'en soit la source
-- ───────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.encheck_pause_filet_sortie()
RETURNS trigger
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
BEGIN
  IF lower(COALESCE(NEW.check_type, '')) = 'out' THEN
    BEGIN
      PERFORM public.encheck_pause_clore_sortie(NEW.employee_id, NEW.check_time);
    EXCEPTION WHEN OTHERS THEN
      --  Le filet ne doit JAMAIS faire échouer un pointage. Un employé qui
      --  badge doit badger, même si la fermeture de pause part de travers.
      RAISE WARNING 'Filet sortie-pause non applique : %', SQLERRM;
    END;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS encheck_pause_filet_sortie ON public.attendances;
CREATE TRIGGER encheck_pause_filet_sortie
  AFTER INSERT ON public.attendances
  FOR EACH ROW EXECUTE FUNCTION public.encheck_pause_filet_sortie();

-- ───────────────────────────────────────────────────────────────────────────
-- 3. Les droits : internes, donc fermés
-- ───────────────────────────────────────────────────────────────────────────
REVOKE ALL ON FUNCTION public.encheck_pause_clore_sortie(uuid, timestamptz)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.encheck_pause_filet_sortie()
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.encheck_pause_clore_sortie(uuid, timestamptz)
  TO postgres, service_role;
GRANT EXECUTE ON FUNCTION public.encheck_pause_filet_sortie()
  TO postgres, service_role;

-- ───────────────────────────────────────────────────────────────────────────
-- VÉRIFICATION
-- ───────────────────────────────────────────────────────────────────────────
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger t
      JOIN pg_class c ON c.oid = t.tgrelid
      JOIN pg_namespace n ON n.oid = c.relnamespace
     WHERE n.nspname = 'public' AND c.relname = 'attendances'
       AND t.tgname = 'encheck_pause_filet_sortie' AND t.tgenabled = 'O'
  ) THEN
    RAISE EXCEPTION 'le déclencheur encheck_pause_filet_sortie n''est pas actif';
  END IF;

  IF EXISTS (
    SELECT 1 FROM pg_proc p
      JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname = 'public'
       AND p.proname IN ('encheck_pause_clore_sortie','encheck_pause_filet_sortie')
       AND (p.proacl::text LIKE '%anon=X%' OR p.proacl::text LIKE '%authenticated=X%')
  ) THEN
    RAISE EXCEPTION 'les fonctions du filet restent ouvertes à anon/authenticated';
  END IF;

  RAISE NOTICE 'filet sortie-pause vérifié : déclencheur actif, fonctions internes';
END;
$$;

COMMIT;
