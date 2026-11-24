-- ═══════════════════════════════════════════════════════════════════════════
-- 🔐 FERMER SA PROPRE PAUSE — PAR JETON DE SESSION
--
-- Pourquoi cette migration existe
-- -------------------------------
-- L'audit du 23/11 a montré que `encheck_pause_fermer(p_employee, p_fin, p_motif)`
-- est exécutable par `anon` (rôle anonyme, clé publique) et prend l'employé et
-- l'heure de fin en paramètres, sans rien vérifier. Mesuré sur la production :
--
--   • `anon` lit `encheck_pauses_en_cours(<entreprise>)` → 14 employés,
--     3 entreprises, avec noms et matricules (SECURITY DEFINER) ;
--   • `anon` peut appeler `encheck_pause_fermer(<employé>, <fin arbitraire>)`
--     et écrire une durée de pause de son choix.
--
-- Cette faille est PRÉEXISTANTE pour `encheck_pause_ouvrir`, et je l'ai
-- aggravée en ajoutant le motif à `encheck_pause_fermer`. Elle n'est pas
-- corrigée par cette migration : la révoquer maintenant casserait l'app
-- Pointage, qui n'a pas d'autre chemin. Voir
-- `docs/SECURITE-ECRITURES-ANONYMES.md` pour la séquence de bascule.
--
-- Ce que cette migration ajoute
-- -----------------------------
-- Le chemin sûr, disponible immédiatement : l'app prouve QUI elle est avec le
-- jeton de session qu'elle détient déjà, et ne choisit plus l'employé.
-- Purement additif : aucune fonction existante n'est modifiée ni supprimée,
-- donc aucun appelant actuel ne peut être cassé.
-- ═══════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.encheck_ma_pause_fermer(
  p_jeton text,
  p_fin   timestamptz DEFAULT now(),
  p_motif text DEFAULT 'reprise'
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
  --  `encheck_session_employe` renvoie 4 colonnes : on les nomme.
  --  `SELECT * INTO` d'un type de table aligne par position et a déjà
  --  produit un 22P02 en production (device_id text → colonne uuid).
  SELECT employee_id, enterprise_id
    INTO v_emp, v_ent
    FROM public.encheck_session_employe(p_jeton);

  IF v_emp IS NULL OR v_ent IS NULL THEN
    RAISE EXCEPTION 'Session employé invalide ou expirée.'
      USING ERRCODE = '42501';
  END IF;

  --  On délègue : une seule définition de « fermer une pause », donc une
  --  seule règle de validation et un seul calcul de durée.
  RETURN public.encheck_pause_fermer(v_emp, p_fin, p_motif);
END;
$$;

COMMENT ON FUNCTION public.encheck_ma_pause_fermer(text, timestamptz, text) IS
  'Ferme la pause ouverte de l''employé identifié par le jeton de session. L''employé n''est jamais un paramètre : le jeton le désigne.';

GRANT EXECUTE ON FUNCTION public.encheck_ma_pause_fermer(text, timestamptz, text)
  TO anon, authenticated, service_role;

-- ═══════════════════════════════════════════════════════════════════════════
-- ⚠️ CE QUE CETTE MIGRATION NE FAIT PAS — ET QUI RESTE OUVERT
--
--   1. `encheck_pause_fermer` reste exécutable par `anon` : c'est l'appel
--      actuel de l'app Pointage. Le révoquer sans bascule préalable casse
--      le pointage en production.
--
--   2. `encheck_pause_ouvrir` a le même défaut, pour la même raison.
--
--   3. `encheck_pauses_en_cours` est exécutable par `anon` et expose noms et
--      matricules des employés en pause. `SET LOCAL ROLE anon` renvoie 14
--      lignes sur 3 entreprises.
--
--   La révocation est écrite, prête, dans `docs/SECURITE-ECRITURES-ANONYMES.md`.
--   Elle ne doit être appliquée qu'APRÈS que l'app Pointage appelle
--   `encheck_ma_pause_fermer` — et pas avant.
-- ═══════════════════════════════════════════════════════════════════════════
