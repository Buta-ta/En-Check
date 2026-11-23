-- ═══════════════════════════════════════════════════════════════════════════
-- 🧾 LE MOTIF DE FERMETURE, VISIBLE CÔTÉ ADMIN — ET LA VUE « MES PAUSES » WEB
--
-- Deux choses, et il faut les lire ensemble :
--
--   A. `encheck_pauses_lire` (ADMIN) renvoie désormais `motif_fermeture`,
--      et gagne la garde d'identité qui lui manquait. C'est mon périmètre.
--
--   B. `encheck_pauses_mes_pauses_web()` (EMPLOYÉ) est la variante web de
--      `encheck_pauses_mes_pauses`. Contrat partagé avec l'App Pointage :
--      sans elle, la vue « mes pauses » du web n'a aucun jeton à présenter,
--      puisque l'espace employé web s'authentifie par Supabase Auth et non
--      par une session de tablette.
--
--      ⚠️ Elle ne renvoie PAS `motif_fermeture`. Décision du fondateur du
--      26/11 : « ce n'est pas à l'employé de voir pourquoi sa pause s'est
--      fermée, mais à l'admin de l'entreprise ». Le motif est une
--      information d'administration. Une version intermédiaire l'exposait :
--      retirée le même jour.
--
-- ⚠️ HISTORIQUE — CE QUI S'EST PASSÉ LE 26/11, ET POURQUOI CE FICHIER
--    DIFFÈRE DE CE QUI A ÉTÉ APPLIQUÉ D'ABORD
--
--    La première version reconstruisait `encheck_pauses_lire` à l'identique
--    (garde basée sur `auth.jwt() ->> 'email'`), en ajoutant la colonne. Elle
--    a été appliquée en production. Deux problèmes :
--
--      1. elle redonnait EXECUTE à `anon`. Un `GRANT ... TO authenticated`
--         ne retire pas un droit existant, et `anon` en avait un. Mesuré :
--         `anon` apparaissait de nouveau dans `proacl`. RÉVOQUÉ depuis ;
--
--      2. si `auth.jwt()` est vide — ce qui arrive en appel direct avec la
--         clé publique — la garde d'origine ne s'appliquait PAS et la
--         fonction renvoyait les pauses de toute l'entreprise.
--
--    La version ci-dessous refuse explicitement sans identité, et révoque
--    `anon` avant de le ré-accorder à qui de droit.
--
-- Les deux fonctions sont mesurées en production : `anon` → `42501`,
-- `motif_fermeture` en dernière colonne, les 17 colonnes d'origine intactes
-- dans le même ordre (aucun des 7 écrans consommateurs n'est décalé).
-- ═══════════════════════════════════════════════════════════════════════════

BEGIN;

-- ── A. Lecture admin : la garde d'abord, la colonne ensuite ────────────────
DROP FUNCTION IF EXISTS public.encheck_pauses_lire(uuid, date, date);

CREATE OR REPLACE FUNCTION public.encheck_pauses_lire(
  p_enterprise uuid DEFAULT NULL,
  p_du        date DEFAULT NULL,
  p_au        date DEFAULT NULL
)
RETURNS TABLE(
  id              uuid,
  employe_id      uuid,
  prenom          text,
  nom             text,
  matricule       text,
  enterprise_id   uuid,
  entreprise_nom  text,
  jour            date,
  debut           timestamptz,
  fin             timestamptz,
  duree_minutes   integer,
  statut          text,
  source          text,
  motif           text,
  anomalie        text,
  prevue_minutes  integer,
  ecart_minutes   integer,
  motif_fermeture text          --  NOUVEAU : 'reprise' | 'sortie' | NULL (avant le 23/11)
)
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
DECLARE
  v_uid     uuid;
  v_email   text;
  v_du      date;
  v_au      date;
  v_est_adm boolean;
BEGIN
  v_uid   := auth.uid();
  v_email := NULLIF(coalesce(auth.jwt() ->> 'email', ''), '');

  --  GARDE. La version d'origine ne s'appliquait que si un e-mail était
  --  présent dans le JWT : sans identité, elle ne filtrait rien. Ici, pas
  --  d'identité = pas de lecture.
  v_est_adm := EXISTS (
    SELECT 1 FROM public.admins a
     WHERE COALESCE(a.is_active, true) = true
       AND (a.user_id = v_uid OR (v_email IS NOT NULL AND lower(a.email) = lower(v_email)))
  );
  IF NOT v_est_adm THEN
    RAISE EXCEPTION 'non autorisé : lecture des pauses réservée aux administrateurs'
      USING ERRCODE = '42501';
  END IF;

  IF p_enterprise IS NOT NULL THEN
    IF NOT public.encheck_est_admin_de(p_enterprise) THEN
      RAISE EXCEPTION 'non autorisé pour cette entreprise' USING ERRCODE = '42501';
    END IF;
  ELSIF NOT EXISTS (
    SELECT 1 FROM public.admins a
     WHERE COALESCE(a.is_active, true) = true AND a.role = 'super_admin'
       AND (a.user_id = v_uid OR (v_email IS NOT NULL AND lower(a.email) = lower(v_email)))
  ) THEN
    RAISE EXCEPTION 'non autorisé : la vue toutes entreprises est réservée au super admin'
      USING ERRCODE = '42501';
  END IF;

  v_du := COALESCE(p_du, CURRENT_DATE - 7);
  v_au := COALESCE(p_au, CURRENT_DATE);

  RETURN QUERY
    SELECT p.id, e.id,
           e.first_name::text, e.last_name::text, e.matricule::text,
           ent.id, ent.name::text, p.jour,
           p.debut, p.fin, p.duree_minutes,
           p.statut, p.source, p.motif, p.anomalie,
           CASE WHEN p.anomalie = 'depassement' THEN (d.res ->> 'prevue_minutes')::int END,
           CASE WHEN p.anomalie = 'depassement' THEN (d.res ->> 'ecart')::int END,
           p.motif_fermeture
      FROM public.encheck_pauses p
      JOIN public.employees e  ON e.id = p.employee_id
      JOIN public.enterprises ent ON ent.id = p.enterprise_id
      CROSS JOIN LATERAL (
        SELECT CASE WHEN p.anomalie = 'depassement'
                    THEN public.encheck_pause_depassement(
                           p.employee_id, p.enterprise_id, p.jour, p.duree_minutes)
               END AS res
      ) d
     WHERE p.jour BETWEEN v_du AND v_au
       AND (p_enterprise IS NULL OR p.enterprise_id = p_enterprise)
     ORDER BY p.jour DESC, e.last_name, e.first_name, p.debut;
END;
$function$;

--  `REVOKE ... FROM PUBLIC` est indispensable : un GRANT ne retire rien, et
--  `anon` avait EXECUTE. C'est précisément l'erreur commise le 26/11.
REVOKE ALL ON FUNCTION public.encheck_pauses_lire(uuid, date, date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.encheck_pauses_lire(uuid, date, date)
  TO authenticated, service_role;

COMMENT ON FUNCTION public.encheck_pauses_lire(uuid, date, date) IS
  'Lecture admin des pauses. La dernière colonne, motif_fermeture, dit si la pause s''est fermée par reprise ou par sortie (NULL avant le 23/11). Réservée aux administrateurs.';

-- ── B. Vue « mes pauses » de l'espace web employé ──────────────────────────
DROP FUNCTION IF EXISTS public.encheck_pauses_mes_pauses_web();

CREATE OR REPLACE FUNCTION public.encheck_pauses_mes_pauses_web(
  p_jours integer DEFAULT 365
)
RETURNS TABLE(
  id              uuid,
  jour            date,
  debut           timestamptz,
  fin             timestamptz,
  duree_minutes   integer,
  statut          text,
  source          text,
  motif           text,
  anomalie        text
)
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_uid     uuid;
  v_emp     uuid;
  v_ent     uuid;
  v_fenetre integer;
BEGIN
  v_uid := auth.uid();
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'non autorisé : connexion requise' USING ERRCODE = '42501';
  END IF;

  --  L'identité vient du JWT. Aucun paramètre ne dit QUI on est.
  SELECT e.id, e.enterprise_id INTO v_emp, v_ent
    FROM public.employees e
   WHERE e.user_id = v_uid
   LIMIT 1;

  IF v_emp IS NULL THEN
    RAISE EXCEPTION 'non autorisé : aucun employé lié à ce compte' USING ERRCODE = '42501';
  END IF;

  --  365 jours par défaut : mesuré le 26/11, une fenêtre de 30 jours
  --  renvoyait 0 pause pour un employé qui en a 23, la dernière datant du
  --  20/11. Une vue « mes pauses » vide n'a pas de sens.
  v_fenetre := LEAST(GREATEST(COALESCE(p_jours, 365), 1), 3650);

  RETURN QUERY
    SELECT p.id, p.jour, p.debut, p.fin,
           p.duree_minutes, p.statut, p.source, p.motif, p.anomalie
      FROM public.encheck_pauses p
     WHERE p.employee_id = v_emp
       AND p.enterprise_id = v_ent
       AND p.jour >= CURRENT_DATE - v_fenetre
     ORDER BY p.debut DESC;
END;
$$;

REVOKE ALL ON FUNCTION public.encheck_pauses_mes_pauses_web(integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.encheck_pauses_mes_pauses_web(integer)
  TO authenticated, service_role;

COMMENT ON FUNCTION public.encheck_pauses_mes_pauses_web(integer) IS
  'Vue « mes pauses » de l''espace web employé. L''employé vient du JWT (auth.uid()), jamais d''un paramètre.';

COMMIT;

-- ═══════════════════════════════════════════════════════════════════════════
-- ⚠️ CE QUE CETTE MIGRATION NE FAIT PAS
--
--   1. Elle ne touche pas `encheck_pauses_mes_pauses` (la variante par jeton
--      de tablette). Deux variantes coexistent parce que deux espaces
--      existent : la tablette a une session, le web a un compte.
--
--   1 bis. AUCUNE des deux variantes employé n'expose `motif_fermeture`.
--      Ce n'est pas un oubli : c'est une décision. Le motif ne sort que par
--      `encheck_pauses_lire`, réservée aux administrateurs.
--
--   2. Elle ne remplit pas `motif_fermeture` pour le passé : les pauses
--      antérieures au 23/11 restent à NULL. NULL = « on ne sait pas ».
--
--   3. Elle ne crée aucun écran. L'UI de « mes pauses » côté web employé
--      n'existe pas encore — cette fonction est le contrat, pas la vue.
-- ═══════════════════════════════════════════════════════════════════════════
