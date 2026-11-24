-- ═══════════════════════════════════════════════════════════════════════════
-- 🏷️ UN TITRE PAR ANNONCE — la carte « Mes médias » peut enfin nommer

-- Le fondateur a choisi la maquette A des Annonces d'accueil, où chaque ligne
-- de la liste porte un TITRE lisible et non un simple type de fichier. La table
-- n'avait aucune colonne pour le porter : seulement `type_media`,
-- `media_path`, `duree_affichage_ms`, `ordre_publication`. Sans titre, la
-- colonne de gauche n'aurait affiché que « Image · N° 1 · 5 s », c'est-à-dire
-- du métadonnée, pas un nom.

-- DÉCISION DE PÉRIMÈTRE, assumée : on ajoute une colonne, on ne renomme rien.
--   Les deux annonces en production n'ont pas de titre. Un `NOT NULL` aurait
--   exigé de leur en inventer un — et un titre inventé par migration est pire
--   qu'un titre absent : il a l'air voulu. L'application retombe sur le
--   libellé du type tant que l'admin n'a pas nommé.

-- ⚠️ PIÈGE ÉVITÉ — À NE PAS RÉINTRODUIRE
--   `CREATE OR REPLACE FUNCTION ... (…, p_titre text DEFAULT NULL)` NE
--   REMPLACE PAS la fonction à neuf paramètres : PostgreSQL crée une
--   SURCHARGE. L'ancienne fonction resterait appelable, et un appelant qui
--   envoie neuf arguments continuerait d'écrire SANS titre, en silence.
--   Il faut donc DROP de l'ancienne signature, puis CREATE de la nouvelle,
--   puis réappliquer les droits (le DROP les emporte avec la fonction).

-- POURQUOI NULL VEUT DIRE « NE PAS TOUCHER », ET '' VEUT DIRE « EFFACER »
--   `p_titre` a une valeur par défaut : un ancien client qui envoie les neuf
--   paramètres d'origine reçoit donc `NULL` sans le savoir. Si l'on écrivait
--   ce NULL tel quel, chaque modification faite par un client ancien
--   EFFACERAIT le titre en silence — exactement le genre de perte qu'on ne
--   voit pas avant qu'un admin demande « où est passé mon titre ? ».
--   Convention retenue, et testée plus bas :
--     p_titre IS NULL  → on garde le titre existant (ou NULL à la création)
--     p_titre = ''     → on efface (l'admin a vidé le champ)
--     sinon            → on écrit le titre, bords rognés, 80 caractères max.

-- POURQUOI 80 CARACTÈRES
--   La ligne de la carte mesure 44 px de haut à côté d'une vignette de 46 px.
--   Au-delà d'environ 80 caractères le titre est tronqué par l'affichage de
--   toute façon. On le borne à l'entrée plutôt que de stocker du texte que
--   personne ne lira jamais.
-- ═══════════════════════════════════════════════════════════════════════════

-- ── 1. La colonne ──────────────────────────────────────────────────────────
ALTER TABLE public.annonces_accueil
  ADD COLUMN IF NOT EXISTS titre text;

COMMENT ON COLUMN public.annonces_accueil.titre IS
  'Nom lisible de l''annonce (80 caractères max). NULL = non nommée : l''admin affiche le libellé du type.';

-- ── 2. La contrainte de longueur ───────────────────────────────────────────
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conrelid = 'public.annonces_accueil'::regclass
       AND conname  = 'annonces_accueil_titre_longueur'
  ) THEN
    ALTER TABLE public.annonces_accueil
      ADD CONSTRAINT annonces_accueil_titre_longueur
      CHECK (titre IS NULL OR (length(btrim(titre)) BETWEEN 1 AND 80));
  END IF;
END;
$$;

-- ── 3. La lecture : le titre sort avec le reste ────────────────────────────
--  Même signature : CREATE OR REPLACE suffit, l'ACL est conservée.
CREATE OR REPLACE FUNCTION public.encheck_annonce_accueil_lister(p_enterprise_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE r jsonb;
BEGIN
  PERFORM public.encheck_borne_admin_guard();
  IF p_enterprise_id IS NULL OR NOT EXISTS (SELECT 1 FROM public.enterprises WHERE id = p_enterprise_id) THEN
    RETURN jsonb_build_object('ok', false, 'raison', 'entreprise_inconnue');
  END IF;
  SELECT jsonb_build_object('ok', true, 'entreprise_id', p_enterprise_id::text,
    'annonces', COALESCE((SELECT jsonb_agg(t.obj) FROM (SELECT jsonb_build_object(
      'id', a.id::text,
      'type', a.type_media,
      'url', 'https://cxggndvhwdolbtyezjde.supabase.co/storage/v1/object/public/annonces-accueil/' || a.media_path,
      'media_path', a.media_path,
      'titre', COALESCE(a.titre, ''),
      'duree_affichage_ms', a.duree_affichage_ms,
      'ordre_publication', a.ordre_publication,
      'is_active', a.is_active,
      'debute_le', COALESCE(a.debute_le::text, 'null'),
      'termine_le', COALESCE(a.termine_le::text, 'null'),
      'publie_le', COALESCE(a.publie_le::text, 'null'),
      'updated_at', a.updated_at::text,
      'statut', CASE WHEN NOT a.is_active THEN 'inactive'
                     WHEN a.debute_le IS NOT NULL AND a.debute_le > now() THEN 'programmee'
                     WHEN a.termine_le IS NOT NULL AND a.termine_le <= now() THEN 'expinee'
                     ELSE 'en_ligne' END) AS obj
      FROM public.annonces_accueil a
      WHERE a.enterprise_id = p_enterprise_id
      ORDER BY a.ordre_publication ASC, a.publie_le ASC NULLS LAST, a.id ASC) t), '[]'::jsonb),
    'journal', COALESCE((SELECT jsonb_agg(j.obj) FROM (SELECT jsonb_build_object(
      'action', l.action,
      'details', COALESCE(l.details, '{}'::jsonb),
      'created_at', l.created_at::text,
      'admin_id', COALESCE(l.admin_id::text, '')) AS obj
      FROM public.audit_logs l
      WHERE l.enterprise_id = p_enterprise_id AND l.action LIKE 'annonce_accueil_%'
      ORDER BY l.created_at DESC LIMIT 25) j), '[]'::jsonb)) INTO r;
  RETURN r;
END
$function$;

-- ── 4. L'écriture : on retire l'ancienne signature, puis on crée ───────────
DROP FUNCTION IF EXISTS public.encheck_annonce_accueil_mettre_a_jour(
  uuid, uuid, text, text, integer, integer, boolean, timestamptz, timestamptz
);

CREATE OR REPLACE FUNCTION public.encheck_annonce_accueil_mettre_a_jour(
  p_enterprise_id        uuid,
  p_id                   uuid,
  p_type_media           text,
  p_media_path           text,
  p_duree_affichage_ms   integer,
  p_ordre_publication    integer,
  p_is_active            boolean,
  p_debute_le            timestamp with time zone,
  p_termine_le           timestamp with time zone,
  p_titre                text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  actor uuid;
  mime text;
  taille bigint;
  row_ record;
  mimes_ok boolean;
  max_taille bigint;
  ancien_chemin text;
  v_titre text;
BEGIN
  PERFORM public.encheck_borne_admin_guard();
  SELECT id INTO strict actor FROM public.admins WHERE user_id = auth.uid();

  --  Le titre : voir l'en-tête. NULL = non fourni (on ne touche pas),
  --  '' = effacement explicite, sinon écriture rognée.
  v_titre := NULLIF(btrim(COALESCE(p_titre, '')), '');
  IF v_titre IS NOT NULL AND length(v_titre) > 80 THEN
    RAISE EXCEPTION 'Titre trop long : 80 caracteres au maximum.'
      USING ERRCODE = '22023';
  END IF;

  IF p_enterprise_id IS NULL OR p_id IS NULL OR NOT EXISTS (SELECT 1 FROM public.enterprises WHERE id = p_enterprise_id) THEN
    RAISE EXCEPTION 'Entreprise ou annonce inconnue.' USING ERRCODE = '22023';
  END IF;

  IF p_media_path IS NULL OR NOT (p_media_path ~ ('^' || p_enterprise_id || '/' || p_id || '/[A-Za-z0-9._-]{1,128}$')) THEN
    RAISE EXCEPTION 'Chemin de media non conforme (attendu : entreprise/annonce/fichier).' USING ERRCODE = '22023';
  END IF;

  SELECT COALESCE(o.metadata->>'mimetype', o.metadata->>'mime_type') INTO mime
    FROM storage.objects o
   WHERE o.bucket_id = 'annonces-accueil' AND o.name = p_media_path;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Media introuvable dans le stockage. Televersez le fichier avant de publier.' USING ERRCODE = 'P0001';
  END IF;

  taille := COALESCE((SELECT o.metadata->>'size' FROM storage.objects o
                       WHERE o.bucket_id = 'annonces-accueil' AND o.name = p_media_path)::bigint, -1);

  IF p_type_media = 'image' THEN
    mimes_ok := mime IN ('image/jpeg','image/png','image/webp'); max_taille := 524288;
  ELSIF p_type_media = 'gif' THEN
    mimes_ok := mime = 'image/gif'; max_taille := 2097152;
  ELSIF p_type_media = 'video' THEN
    mimes_ok := mime IN ('video/mp4','video/quicktime'); max_taille := 5242880;
  ELSE
    RAISE EXCEPTION 'Type de media inconnu (image, gif, video).' USING ERRCODE = '22023';
  END IF;

  IF NOT mimes_ok THEN
    RAISE EXCEPTION 'Format du fichier non autorise pour ce type de media.' USING ERRCODE = '22023';
  END IF;
  IF taille > max_taille THEN
    RAISE EXCEPTION 'Fichier trop lourd pour ce type de media.' USING ERRCODE = '22023';
  END IF;

  IF (p_type_media = 'image' AND NOT p_media_path ~* '[.](jpe?g|png|webp)$')
     OR (p_type_media = 'gif' AND NOT p_media_path ~* '[.]gif$')
     OR (p_type_media = 'video' AND NOT p_media_path ~* '[.](mp4|mov)$') THEN
    RAISE EXCEPTION 'Extension du fichier incoherente avec le type de media.' USING ERRCODE = '22023';
  END IF;

  IF p_duree_affichage_ms IS NULL OR p_duree_affichage_ms < 3000 OR p_duree_affichage_ms > 15000 THEN
    RAISE EXCEPTION 'Duree d affichage entre 3 et 15 secondes.' USING ERRCODE = '22023';
  END IF;

  IF p_ordre_publication IS NULL OR p_ordre_publication < 1 THEN
    RAISE EXCEPTION 'Ordre invalide.' USING ERRCODE = '22023';
  END IF;

  IF p_debute_le IS NOT NULL AND p_termine_le IS NOT NULL AND p_termine_le <= p_debute_le THEN
    RAISE EXCEPTION 'La date de fin doit etre posterieure a la date de debut.' USING ERRCODE = '22023';
  END IF;

  IF p_is_active IS NULL THEN p_is_active := false; END IF;

  SELECT media_path INTO ancien_chemin
    FROM public.annonces_accueil
   WHERE id = p_id AND enterprise_id = p_enterprise_id;

  IF EXISTS (SELECT 1 FROM public.annonces_accueil WHERE id = p_id AND enterprise_id = p_enterprise_id) THEN
    UPDATE public.annonces_accueil
       SET type_media = p_type_media,
           media_path = p_media_path,
           titre = CASE WHEN p_titre IS NULL THEN titre ELSE v_titre END,
           duree_affichage_ms = p_duree_affichage_ms,
           ordre_publication = p_ordre_publication,
           is_active = p_is_active,
           debute_le = p_debute_le,
           termine_le = p_termine_le,
           publie_le = CASE WHEN p_is_active AND publie_le IS NULL THEN now() ELSE publie_le END
     WHERE id = p_id AND enterprise_id = p_enterprise_id
    RETURNING * INTO row_;
  ELSE
    IF (SELECT count(*) FROM public.annonces_accueil WHERE enterprise_id = p_enterprise_id) >= 8 THEN
      RAISE EXCEPTION 'Maximum 8 annonces par entreprise.' USING ERRCODE = '22023';
    END IF;
    INSERT INTO public.annonces_accueil
      (id, enterprise_id, type_media, media_path, titre, duree_affichage_ms,
       ordre_publication, is_active, debute_le, termine_le, publie_le, cree_par)
    VALUES
      (p_id, p_enterprise_id, p_type_media, p_media_path, v_titre, p_duree_affichage_ms,
       p_ordre_publication, p_is_active, p_debute_le, p_termine_le,
       CASE WHEN p_is_active THEN now() END, actor)
    RETURNING * INTO row_;
  END IF;

  IF ancien_chemin IS NOT NULL AND ancien_chemin IS DISTINCT FROM p_media_path THEN
    DELETE FROM storage.objects WHERE bucket_id = 'annonces-accueil' AND name = ancien_chemin;
  END IF;

  INSERT INTO public.audit_logs (enterprise_id, admin_id, target_id, action, details)
  VALUES (p_enterprise_id, actor, p_id,
          'annonce_accueil_' || CASE WHEN p_is_active THEN 'publiee' ELSE 'modifiee' END,
          jsonb_build_object('type_media', row_.type_media, 'titre', row_.titre,
                             'ordre', row_.ordre_publication,
                             'duree_ms', row_.duree_affichage_ms,
                             'active', row_.is_active));

  RETURN jsonb_build_object('ok', true, 'annonce', jsonb_build_object(
    'id', row_.id::text, 'type', row_.type_media, 'titre', row_.titre,
    'duree_affichage_ms', row_.duree_affichage_ms,
    'ordre_publication', row_.ordre_publication, 'is_active', row_.is_active));
END
$function$;

-- ── 5. Les droits, réappliqués après le DROP ───────────────────────────────
--  L'ACL mesurée avant migration : postgres, authenticated, service_role.
--  AUCUN `anon` — une écriture d'annonce n'est pas une action anonyme.
REVOKE ALL ON FUNCTION public.encheck_annonce_accueil_mettre_a_jour(
  uuid, uuid, text, text, integer, integer, boolean, timestamptz, timestamptz, text
) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.encheck_annonce_accueil_mettre_a_jour(
  uuid, uuid, text, text, integer, integer, boolean, timestamptz, timestamptz, text
) TO authenticated, service_role;
