-- ═══════════════════════════════════════════════════════════════════════════
-- 🔐 OUVRIR SA PAUSE PAR JETON — et le bandeau sans identités
--
-- Complète `20261124000001_ma_pause_fermer_par_jeton.sql`.
--
-- Deux manques relevés par l'App Pointage, tous les deux justes :
--
--   1. `encheck_pause_ouvrir` n'avait aucun équivalent par jeton. Ma
--      séquence de révocation la supprimait quand même : « Je pars en
--      pause » serait tombé. Corrigé ici.
--
--   2. `encheck_pauses_en_cours` ne sert pas qu'à l'administration : c'est
--      le bandeau de la borne partagée. La révoquer sans remplacement
--      supprime la fonctionnalité. Décision du fondateur : option (b),
--      une variante réduite — sans identifiant, sans matricule, sans nom
--      complet.
--
-- La variante de bandeau n'ajoute pas `prevue_minutes` au SQL. L'App
-- Pointage affiche déjà ses lignes figées, et `encheck_pause_prevue` est
-- STABLE SECURITY DEFINER : l'appeler une fois par ligne ouverte sur une
-- borne partagée donnerait une exécution par employé, par rafraîchissement.
-- Un seul `duree_minutes` suffit à écrire « En pause depuis 1:51 », et
-- l'écart au créneau se calcule côté app si elle en a besoin.
--
-- Purement additif : aucune fonction existante n'est modifiée ni révoquée.
-- ═══════════════════════════════════════════════════════════════════════════

-- ── 1. Ouvrir sa propre pause ──────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.encheck_ma_pause_ouvrir(
  p_jeton  text,
  p_debut  timestamptz DEFAULT now(),
  p_motif  text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql VOLATILE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_emp uuid;
  v_ent uuid;
BEGIN
  --  Variables nommées : `encheck_session_employe` renvoie 4 colonnes.
  --  `SELECT * INTO` d'un type de table aligne par position et a déjà
  --  produit un 22P02 en production.
  SELECT employee_id, enterprise_id
    INTO v_emp, v_ent
    FROM public.encheck_session_employe(p_jeton);

  IF v_emp IS NULL OR v_ent IS NULL THEN
    RAISE EXCEPTION 'Session employé invalide ou expirée.'
      USING ERRCODE = '42501';
  END IF;

  --  On délègue : idempotence, fermeture des pauses de la veille et
  --  validation de l'heure restent écrites à un seul endroit.
  RETURN public.encheck_pause_ouvrir(v_emp, p_debut, p_motif);
END;
$$;

COMMENT ON FUNCTION public.encheck_ma_pause_ouvrir(text, timestamptz, text) IS
  'Ouvre la pause de l''employé identifié par le jeton de session. L''employé n''est jamais un paramètre.';

GRANT EXECUTE ON FUNCTION public.encheck_ma_pause_ouvrir(text, timestamptz, text)
  TO anon, authenticated, service_role;

-- ── 2. Le bandeau de la borne, sans identités ──────────────────────────────
CREATE OR REPLACE FUNCTION public.encheck_pauses_bandeau(p_enterprise uuid)
RETURNS TABLE (
  affichage      text,
  debut          timestamptz,
  motif          text,
  duree_minutes  integer
)
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT
    --  Prénom + initiale : « Merveille B. ». Assez pour reconnaître qui
    --  est en pause, pas assez pour reconstituer une identité complète sur
    --  un écran que tout le monde voit.
    btrim(e.first_name) ||
      CASE
        WHEN NULLIF(btrim(e.last_name), '') IS NULL THEN ''
        ELSE ' ' || upper(left(btrim(e.last_name), 1)) || '.'
      END,
    p.debut,
    p.motif,
    GREATEST(0, (extract(epoch FROM (now() - p.debut)) / 60)::int)
  FROM public.encheck_pauses p
  JOIN public.employees e ON e.id = p.employee_id
 WHERE p.enterprise_id = p_enterprise
   AND p.fin IS NULL                        -- uniquement les pauses OUVERTES
   AND p.statut IN ('reelle', 'presumee')   -- jamais les pauses écartées
 ORDER BY p.debut;
$$;

COMMENT ON FUNCTION public.encheck_pauses_bandeau(uuid) IS
  'Bandeau des pauses en cours pour un écran partagé : prénom + initiale, jamais d''identifiant ni de matricule.';

GRANT EXECUTE ON FUNCTION public.encheck_pauses_bandeau(uuid)
  TO anon, authenticated, service_role;

-- ═══════════════════════════════════════════════════════════════════════════
-- ⚠️ CE QUE CETTE MIGRATION NE FAIT PAS
--
--   1. Elle ne révoque RIEN. `encheck_pause_ouvrir` et
--      `encheck_pauses_en_cours` restent exécutables par `anon` : l'app
--      actuelle en a encore besoin.
--
--   2. Elle ne corrige pas le défaut de fond — `encheck_pauses_bandeau`
--      expose les prénoms à qui détient la clé publique, exactement comme
--      `encheck_pauses_en_cours` avant elle. C'est un progrès (plus de
--      matricule, plus d'identifiant, plus de nom complet), pas une
--      fermeture. La fermeture réelle est le palier « bornes enrôlées »
--      évoqué avec l'App Pointage : même sortie, garde d'entrée
--      `encheck_borne_authentifier`.
--
--   3. `preuve d'exécution` : la variante de bandeau n'a pas encore été
--      mesurée en production. Voir le rapport — je ne l'affirme pas avant.
-- ═══════════════════════════════════════════════════════════════════════════
