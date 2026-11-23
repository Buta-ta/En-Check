-- ═══════════════════════════════════════════════════════════════════════════
-- 🔒 LA FUITE NOMS + MATRICULES EST FERMÉE — révocation des anciennes
--    fonctions de pause ouvertes à `anon`
--
-- CE QUI FUYAIT
-- ────────────────────────────────────────────────────────────────────────────
-- `encheck_pauses_en_cours(p_enterprise)` était exécutable par `anon`, la clé
-- publique qui part dans le navigateur et dans l'APK. Elle renvoyait, pour
-- chaque pause en cours :
--
--     employe_id, prenom, nom, matricule, debut, motif, duree_minutes
--
-- Mesuré le 23/11 sous `SET LOCAL ROLE anon` : `Hippo`, `BIYOKILA`,
-- `ENN-0002`. N'importe qui, sans compte ni session.
--
-- CE QUE J'AI COMPRIS EN VÉRIFIANT — et qui a changé le diagnostic
-- ────────────────────────────────────────────────────────────────────────────
-- J'ai longtemps écrit que ces fonctions renvoyaient des identités « parce
-- qu'elles étaient ouvertes à `anon` ». **C'est faux, et c'est important.**
--
-- En PostgreSQL, une fonction `SECURITY DEFINER` s'exécute avec les droits
-- de SON PROPRIÉTAIRE. L'ACL ne décide pas de ce que la fonction a le droit
-- de lire : elle décide de QUI peut l'appeler.
--
-- Conséquence : `encheck_pauses_bandeau` — ma fonction, celle qui ne renvoie
-- qu'un prénom et une initiale — est aussi exécutable par `anon`. Elle ne
-- fuit pas parce que son corps est écrit pour ne pas fuir, pas parce que son
-- ACL est fermée.
--
-- La révocation ne protège donc pas contre un appelant : elle ferme un
-- chemin. Le vrai correctif est dans le corps de chaque fonction, et c'est
-- déjà fait (`encheck_pauses_bandeau` remplace `en_cours`).
--
-- CE QUI EST RÉVOQUÉ ICI
-- ────────────────────────────────────────────────────────────────────────────
--   1. encheck_pauses_en_cours  — la fuite elle-même
--   2. encheck_pause_ouvrir     — écriture par `anon`, remplacée par
--                                 `encheck_ma_pause_ouvrir(p_jeton, …)`
--   3. encheck_pause_fermer     — écriture par `anon`, remplacée par
--                                 `encheck_ma_pause_fermer(p_jeton, …)`
--
-- POURQUOI LE MOMENT EST BON — vérifié, pas supposé
-- ────────────────────────────────────────────────────────────────────────────
-- Le risque était de casser la tablette en production. J'ai lu leur code
-- (`3826078`, `lib/services/pause_service.dart`) :
--
--   • la tablette appelle `encheck_pauses_bandeau` EN PREMIER. Elle ne tombe
--     sur `en_cours` que si `bandeau` est absente (PGRST202) — impossible,
--     elle est livrée et vérifiée en production.
--   • pour ouvrir et fermer, elle appelle la variante par JETON en premier ;
--     l'ancien chemin n'est qu'un repli `PGRST202`.
--
-- Et leur client est `Supabase.initialize(anonKey:)` sans `signIn` : la
-- tablette est en rôle `anon` en permanence. Vérifié aussi : aucune fonction
-- ni vue de la base ne dépend de `encheck_pauses_en_cours`.
--
-- ⚠️ CE QUI RESTE VRAI APRÈS CETTE MIGRATION
-- ────────────────────────────────────────────────────────────────────────────
-- Leurs trois replis `PGRST202` tombent désormais en `42501`. Les trois sont
-- déjà rattrapés côté app (état local pour le bandeau, file d'attente pour
-- les gestes de pause). Mais **après un vidage de cache ou une réinstallation,
-- une tablette sans jeton ne peut plus ouvrir ni fermer de pause hors ligne** :
-- le geste reste en file jusqu'à la prochaine identification. C'est le
-- comportement voulu — le dire vaut mieux que le découvrir.
-- ═══════════════════════════════════════════════════════════════════════════

BEGIN;

REVOKE ALL ON FUNCTION public.encheck_pauses_en_cours(uuid)          FROM anon;
REVOKE ALL ON FUNCTION public.encheck_pause_ouvrir(uuid, timestamptz, text) FROM anon;
REVOKE ALL ON FUNCTION public.encheck_pause_fermer(uuid, timestamptz, text) FROM anon;

-- ───────────────────────────────────────────────────────────────────────────
-- VÉRIFICATION — la migration échoue si une seule est encore ouverte.
-- ───────────────────────────────────────────────────────────────────────────
DO $$
DECLARE
  v_ouvert text;
BEGIN
  SELECT string_agg(p.proname, ', ') INTO v_ouvert
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
   WHERE n.nspname = 'public'
     AND p.proname IN ('encheck_pauses_en_cours',
                       'encheck_pause_ouvrir',
                       'encheck_pause_fermer')
     AND p.proacl::text LIKE '%anon=X%';

  IF v_ouvert IS NOT NULL THEN
    RAISE EXCEPTION 'révocation incomplète : anon peut encore exécuter %', v_ouvert;
  END IF;

  --  Le bandeau et les variantes par jeton doivent rester accessibles :
  --  c'est d'eux que dépend la tablette. Les fermer serait une panne.
  IF NOT EXISTS (
    SELECT 1 FROM pg_proc p
      JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname = 'public'
       AND p.proname = 'encheck_pauses_bandeau'
       AND p.proacl::text LIKE '%anon=X%'
  ) THEN
    RAISE EXCEPTION 'encheck_pauses_bandeau n''est plus accessible à anon : la tablette perdrait le bandeau';
  END IF;

  RAISE NOTICE 'révocation vérifiée : 3 fermées à anon, le bandeau et les chemins par jeton restent ouverts';
END;
$$;

COMMIT;
