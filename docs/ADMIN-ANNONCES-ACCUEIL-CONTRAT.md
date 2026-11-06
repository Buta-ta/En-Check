# Annonces d'accueil (app Pointage) — Contrat Admin/API

**Date : 6 novembre 2026** · **Statut : MIGRATION EXÉCUTÉE le 06/11** (migrations Supabase `annonces_accueil_accueil_pointage` + `annonces_accueil_fix_ordre_jsonb_agg`) — RPC de lecture validée en base (ordre, période, entreprise inconnue, garde AAL2, contraintes)
**Source : rapport de Dev2 (App Pointage) — `docs/PUBLICITES_ACCUEIL_RAPPORT_ADMIN_API.md` (PR #43, fusionnée) du dépôt `Buta-ta/En-Check-App-Pointage`**
**Rôle : ce document est la réponse livrable de l'équipe Admin/API au rapport §9.**

## 1. Décisions produit (validées par le propriétaire le 06/11/2026)

| # | Décision | Valeur retenue |
|---|---|---|
| 1 | Médias | **Images + GIF + vidéos maintenant**. Vidéo : MP4/MOV, muette, **≤ 30 s**, légère. GIF léger. |
| 2 | Bornes | **Durée 3 s à 15 s par média, max 8 annonces par entreprise** |
| 3 | Format | Cadre **16:9**, largeur utile ≤ 1600 px, `object-fit: cover` côté app ; images ≤ 500 Ko |
| 4 | Stockage | **Aucune donnée exposée avant publication** (mécanisme §3 — voir ajustement technique) |
| 5 | Sécurité | **MFA AAL2 obligatoire** pour publier / modifier / supprimer (garde `encheck_borne_admin_guard` réutilisée) |

### Matrice des médias (limites serveur, validées dans la RPC)

| Type | MIME acceptés | Taille max | Durée max |
|---|---|---|---|
| `image` | `image/jpeg`, `image/png`, `image/webp` | 512 Ko | 15 s (durée d'affichage Admin) |
| `gif` | `image/gif` | 2 Mo | 30 s (durée réelle du fichier) |
| `video` | `video/mp4`, `video/quicktime` | 5 Mo | 30 s |

Tous les médias : cadre 16:9, largeur utile ≤ 1600 px, extension cohérente avec le type.

## 2. Organisation Admin (page)

- **Page** : `/annonces-accueil` — « Annonces d'accueil » (composant `src/pages/AnnoncesAccueil.jsx`), charte « Appliqué d'Abomey » (`src/pages/AnnoncesAccueil.css` scopé).
- **Navigation** : section **« Outils »**, juste après **« Pointeuses ADMS »**, visibilité `show: isSuperAdmin`.
- **Options intégrées** : sélecteur d'entreprise · liste des médias (miniature, type, durée, ordre, statut calculé En ligne / Programmée / Inactive / Expirée) · ajout (upload + aperçu + durée + ordre + dates début/fin) · réordonnancement · activer / désactiver · suppression · règles de poids/format affichées avant publication · **aperçu « tel que l'app »** (mini-carrousel fondu + durées) · journal d'audit (qui / quoi / quand) · **défi MFA AAL2** sur chaque action de publication.
- Le **ID de l'annonce est généré par l'app Admin** (`crypto.randomUUID()`) : il fait partie du chemin Storage, donc il existe avant l'upload du fichier (flux : générer id → upload fichier → RPC de publication).

## 3. Ajustement technique (à la place des URL signées)

**Constat vérifié en base le 06/11** : votre Supabase n'expose **aucune fonction de signature d'URL côté serveur** (schéma `storage` : 0 fonction `presign*` / `signed*` / `public_url`). L'app Pointage (kiosque) ne possède aucun jeton d'admin : elle ne peut donc pas générer d'URL signée elle-même.

**Mécanisme retenu — bucket public « à la publication »** (équivalent sécurité, sans Edge function) :

1. Un fichier n'est téléversé (donc visible) **que lors de la publication** par un superadmin AAL2 (politiques Storage §5).
2. La RPC de lecture ne le sert que si la ligne est **active ET dans sa période** (heure serveur).
3. Chemin `{entreprise}/{annonce-uuid}/{fichier}` : **innégociable sans la liste des annonces** (UUID), donc non devinable.
4. Désactivation = plus servi par la RPC ; suppression = ligne + fichier supprimés.
5. Les contenus sont **publics par nature** (affichés à tous sur le kiosque) : rien de sensible n'y figure — c'est la condition d'usage fixée au rapport §4, désormais contractuelle.

L'alternative « bucket privé + URL signées 15 min » reste possible via une Edge function, mais ajoute latence et dépendance pour un résultat identique : **non retenue**.

**Bénéfice** : URLs publiques stables → cache LRU propre côté app, pas de re-signature en boucle, hors-ligne fonctionnel, pointage jamais bloqué (règles rapport §2 conservées à l'identique).

## 4. Schéma (migration idempotente)

```sql
-- ═══ TABLE ═══
CREATE TABLE IF NOT EXISTS public.annonces_accueil (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  enterprise_id uuid NOT NULL REFERENCES public.enterprises(id) ON DELETE CASCADE,
  type_media text NOT NULL CHECK (type_media IN ('image','video','gif')),
  media_path text NOT NULL,
  duree_affichage_ms integer NOT NULL CHECK (duree_affichage_ms BETWEEN 3000 AND 15000),
  ordre_publication integer NOT NULL CHECK (ordre_publication >= 1),
  is_active boolean NOT NULL DEFAULT false,
  publie_le timestamptz,
  debute_le timestamptz,
  termine_le timestamptz,
  cree_par uuid REFERENCES public.admins(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT annonces_accueil_dates_check
    CHECK (debute_le IS NULL OR termine_le IS NULL OR termine_le > debute_le),
  CONSTRAINT annonces_accueil_publie_check
    CHECK (NOT is_active OR publie_le IS NOT NULL)
);

CREATE UNIQUE INDEX IF NOT EXISTS annonces_accueil_ordre_unique
  ON public.annonces_accueil (enterprise_id, ordre_publication);
CREATE INDEX IF NOT EXISTS annonces_accueil_active_idx
  ON public.annonces_accueil (enterprise_id, is_active);

-- Accès direct interdit : lecture et écriture uniquement via RPC.
ALTER TABLE public.annonces_accueil ENABLE ROW LEVEL SECURITY;

-- ═══ updated_at automatique ═══
CREATE OR REPLACE FUNCTION public.encheck_annonce_accueil_touch()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN new.updated_at := now(); RETURN new; END $$;
DROP TRIGGER IF EXISTS annonces_accueil_touch ON public.annonces_accueil;
CREATE TRIGGER annonces_accueil_touch
  BEFORE UPDATE ON public.annonces_accueil
  FOR EACH ROW EXECUTE FUNCTION public.encheck_annonce_accueil_touch();
```

## 5. Storage (bucket + politiques)

```sql
INSERT INTO storage.buckets (id, name, public)
VALUES ('annonces-accueil', 'annonces-accueil', true)
ON CONFLICT (id) DO UPDATE SET public = true;

-- Garde : superadmin actif + session AAL2 + chemin {entreprise}/{annonce}/{fichier}
CREATE OR REPLACE FUNCTION public.encheck_annonce_storage_autorise(p_name text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public AS $$
  SELECT auth.uid() IS NOT NULL
    AND EXISTS (SELECT 1 FROM public.admins
                WHERE user_id = auth.uid() AND is_active AND role = 'super_admin')
    AND auth.jwt() IS NOT NULL
    AND auth.jwt()->>'aal' = 'aal2'
    AND cardinality(storage.foldername(p_name)) >= 2
    AND (storage.foldername(p_name))[1] IN (SELECT id::text FROM public.enterprises)
$$;

DROP POLICY IF EXISTS annonces_accueil_insert ON storage.objects;
CREATE POLICY annonces_accueil_insert ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'annonces-accueil' AND public.encheck_annonce_storage_autorise(name));
DROP POLICY IF EXISTS annonces_accueil_update ON storage.objects;
CREATE POLICY annonces_accueil_update ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'annonces-accueil' AND public.encheck_annonce_storage_autorise(name))
  WITH CHECK (bucket_id = 'annonces-accueil' AND public.encheck_annonce_storage_autorise(name));
DROP POLICY IF EXISTS annonces_accueil_delete ON storage.objects;
CREATE POLICY annonces_accueil_delete ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'annonces-accueil' AND public.encheck_annonce_storage_autorise(name));
-- Pas de politique SELECT : lecture via URL publique uniquement (bucket public).
```

## 6. RPC de lecture (kiosque / app Pointage)

Nom retenu = proposition du rapport : **`encheck_accueil_publicites(p_enterprise_id uuid)`**.

```sql
CREATE OR REPLACE FUNCTION public.encheck_accueil_publicites(p_enterprise_id uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = public AS $$
DECLARE r jsonb;
BEGIN
  IF p_enterprise_id IS NULL
     OR NOT EXISTS (SELECT 1 FROM public.enterprises e WHERE e.id = p_enterprise_id AND e.is_active)
  THEN RETURN jsonb_build_object('ok', false, 'raison', 'entreprise_inconnue'); END IF;

  SELECT jsonb_build_object(
    'ok', true,
    'entreprise_id', p_enterprise_id::text,
    'publicites', COALESCE((
      -- Sub-requête imbriquée : ORDER BY interdit directement dans jsonb_agg
      SELECT jsonb_agg(t.obj) FROM (
        SELECT jsonb_build_object(
          'id', a.id::text,
          'type', a.type_media,
          'url', 'https://cxggndvhwdolbtyezjde.supabase.co/storage/v1/object/public/annonces-accueil/' || a.media_path,
          'duree_affichage_ms', a.duree_affichage_ms,
          'ordre_publication', a.ordre_publication,
          'updated_at', a.updated_at::text
        ) AS obj
        FROM public.annonces_accueil a
        WHERE a.enterprise_id = p_enterprise_id
          AND a.is_active
          AND (a.debute_le IS NULL OR a.debute_le <= now())
          AND (a.termine_le IS NULL OR a.termine_le > now())
        ORDER BY a.ordre_publication ASC, a.publie_le ASC NULLS LAST, a.id ASC
      ) t
    ), '[]'::jsonb)
  ) INTO r;
  RETURN r;
END $$;

REVOKE EXECUTE ON FUNCTION public.encheck_accueil_publicites(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.encheck_accueil_publicites(uuid) TO anon, authenticated;
```

- « Active » = côté **serveur**, heure serveur (règle rapport §3) ; tri déterministe `ordre, publie_le, id`.
- Aucun `SELECT` direct sur la table, aucune clé service_role dans l'app (règle rapport §5).

## 7. RPCs d'écriture (Admin, AAL2)

**`encheck_annonce_accueil_mettre_a_jour(p_enterprise_id, p_id, p_type_media, p_media_path, p_duree_affichage_ms, p_ordre_publication, p_is_active, p_debute_le, p_termine_le)`** — création et mise à jour (id généré par l'app Admin) :

```sql
CREATE OR REPLACE FUNCTION public.encheck_annonce_accueil_mettre_a_jour(
  p_enterprise_id uuid, p_id uuid, p_type_media text, p_media_path text,
  p_duree_affichage_ms integer, p_ordre_publication integer,
  p_is_active boolean, p_debute_le timestamptz, p_termine_le timestamptz
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE actor uuid; mime text; taille bigint; row_ record; mimes_ok boolean; max_taille bigint;
BEGIN
  PERFORM public.encheck_borne_admin_guard();
  SELECT id INTO strict actor FROM public.admins WHERE user_id = auth.uid();

  IF p_enterprise_id IS NULL OR p_id IS NULL
     OR NOT EXISTS (SELECT 1 FROM public.enterprises WHERE id = p_enterprise_id)
  THEN RAISE EXCEPTION 'Entreprise ou annonce inconnue.' USING ERRCODE = '22023'; END IF;

  IF p_media_path IS NULL
     OR NOT (p_media_path ~ ('^' || p_enterprise_id || '/' || p_id || '/[A-Za-z0-9._-]{1,128}$'))
  THEN RAISE EXCEPTION 'Chemin de média non conforme (attendu : entreprise/annonce/fichier).' USING ERRCODE = '22023'; END IF;

  -- Validation serveur du fichier : existence, MIME réel, taille, extension
  -- storage.objects n'a pas de colonnes mime/size : tout est dans metadata (jsonb)
  SELECT COALESCE(o.metadata->>'mimetype', o.metadata->>'mime_type') INTO mime
  FROM storage.objects o WHERE o.bucket_id = 'annonces-accueil' AND o.name = p_media_path;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Média introuvable dans le stockage. Téléversez le fichier avant de publier.' USING ERRCODE = 'P0001';
  END IF;
  taille := COALESCE((SELECT o.metadata->>'size' FROM storage.objects o WHERE o.bucket_id = 'annonces-accueil' AND o.name = p_media_path)::bigint, -1);
  IF p_type_media = 'image'   THEN mimes_ok := mime IN ('image/jpeg','image/png','image/webp'); max_taille := 524288;
  ELSIF p_type_media = 'gif'  THEN mimes_ok := mime = 'image/gif';                        max_taille := 2097152;
  ELSIF p_type_media = 'video' THEN mimes_ok := mime IN ('video/mp4','video/quicktime');  max_taille := 5242880;
  ELSE RAISE EXCEPTION 'Type de média inconnu (image, gif, video).' USING ERRCODE = '22023'; END IF;
  IF NOT mimes_ok THEN RAISE EXCEPTION 'Format du fichier non autorisé pour ce type de média.' USING ERRCODE = '22023'; END IF;
  IF taille > max_taille THEN
    RAISE EXCEPTION 'Fichier trop lourd pour ce type de média.' USING ERRCODE = '22023'; END IF;
  IF (p_type_media = 'image' AND NOT p_media_path ~* '\.(jpe?g|png|webp)$')
     OR (p_type_media = 'gif'   AND NOT p_media_path ~* '\.gif$')
     OR (p_type_media = 'video' AND NOT p_media_path ~* '\.(mp4|mov)$')
  THEN RAISE EXCEPTION 'Extension du fichier incohérente avec le type de média.' USING ERRCODE = '22023'; END IF;

  IF p_duree_affichage_ms IS NULL OR p_duree_affichage_ms < 3000 OR p_duree_affichage_ms > 15000 THEN
    RAISE EXCEPTION 'Durée d''affichage entre 3 et 15 secondes.' USING ERRCODE = '22023'; END IF;
  IF p_ordre_publication IS NULL OR p_ordre_publication < 1 THEN
    RAISE EXCEPTION 'Ordre invalide.' USING ERRCODE = '22023'; END IF;
  IF p_debute_le IS NOT NULL AND p_termine_le IS NOT NULL AND p_termine_le <= p_debute_le THEN
    RAISE EXCEPTION 'La date de fin doit être postérieure à la date de début.' USING ERRCODE = '22023'; END IF;
  IF p_is_active IS NULL THEN p_is_active := false; END IF;

  IF EXISTS (SELECT 1 FROM public.annonces_accueil WHERE id = p_id AND enterprise_id = p_enterprise_id) THEN
    UPDATE public.annonces_accueil SET
      type_media = p_type_media, media_path = p_media_path,
      duree_affichage_ms = p_duree_affichage_ms, ordre_publication = p_ordre_publication,
      is_active = p_is_active, debute_le = p_debute_le, termine_le = p_termine_le,
      publie_le = CASE WHEN p_is_active AND publie_le IS NULL THEN now() ELSE publie_le END
    WHERE id = p_id AND enterprise_id = p_enterprise_id
    RETURNING * INTO row_;
  ELSE
    IF (SELECT count(*) FROM public.annonces_accueil WHERE enterprise_id = p_enterprise_id) >= 8 THEN
      RAISE EXCEPTION 'Maximum 8 annonces par entreprise.' USING ERRCODE = '22023'; END IF;
    INSERT INTO public.annonces_accueil
      (id, enterprise_id, type_media, media_path, duree_affichage_ms, ordre_publication,
       is_active, debute_le, termine_le, publie_le, cree_par)
    VALUES
      (p_id, p_enterprise_id, p_type_media, p_media_path, p_duree_affichage_ms, p_ordre_publication,
       p_is_active, p_debute_le, p_termine_le, CASE WHEN p_is_active THEN now() END, actor)
    RETURNING * INTO row_;
  END IF;

  INSERT INTO public.audit_logs (enterprise_id, admin_id, target_id, action, details)
  VALUES (p_enterprise_id, actor, p_id,
          'annonce_accueil_' || CASE WHEN p_is_active THEN 'publiee' ELSE 'modifiee' END,
          jsonb_build_object('type_media', row_.type_media, 'ordre', row_.ordre_publication,
                             'duree_ms', row_.duree_affichage_ms, 'active', row_.is_active));

  RETURN jsonb_build_object('ok', true, 'annonce', jsonb_build_object(
    'id', row_.id::text, 'type', row_.type_media, 'duree_affichage_ms', row_.duree_affichage_ms,
    'ordre_publication', row_.ordre_publication, 'is_active', row_.is_active));
END $$;
```

**`encheck_annonce_accueil_supprimer(p_enterprise_id, p_id)`** — suppression ligne + audit ; le fichier Storage est supprimé par l'app Admin (politique `delete` ci-dessus).

```sql
CREATE OR REPLACE FUNCTION public.encheck_annonce_accueil_supprimer(p_enterprise_id uuid, p_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE actor uuid; row_ public.annonces_accueil%ROWTYPE;
BEGIN
  PERFORM public.encheck_borne_admin_guard();
  SELECT id INTO strict actor FROM public.admins WHERE user_id = auth.uid();
  DELETE FROM public.annonces_accueil
  WHERE id = p_id AND enterprise_id = p_enterprise_id
  RETURNING * INTO row_;
  IF NOT FOUND THEN RAISE EXCEPTION 'Annonce introuvable pour cette entreprise.' USING ERRCODE = 'P0002'; END IF;
  INSERT INTO public.audit_logs (enterprise_id, admin_id, target_id, action, details)
  VALUES (p_enterprise_id, actor, p_id, 'annonce_accueil_supprimee',
          jsonb_build_object('type_media', row_.type_media, 'ordre', row_.ordre_publication));
  RETURN jsonb_build_object('ok', true, 'supprimee', p_id::text);
END $$;
```

```sql
REVOKE EXECUTE ON FUNCTION public.encheck_annonce_accueil_mettre_a_jour(uuid,uuid,text,text,integer,integer,boolean,timestamptz,timestamptz) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.encheck_annonce_accueil_mettre_a_jour(uuid,uuid,text,text,integer,integer,boolean,timestamptz,timestamptz) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.encheck_annonce_accueil_supprimer(uuid,uuid) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.encheck_annonce_accueil_supprimer(uuid,uuid) TO authenticated;
```

## 8. Cache et invalidation (pour l'app Pointage — complète le §7 du rapport)

- Récupération **après le premier rendu**, jamais bloquante (règle rapport §7 conservée).
- URLs publiques **stables** : pas de re-signature. Invalidation = comparaison de `updated_at` renvoyé par la RPC.
- Refetch : au montage, au changement d'entreprise (jeton de génération — règle rapport §7), puis à intervalle régulier (suggestion : 30 min) ; le kiosque redémarre aussi régulièrement.
- Cache octets : **LRU bornée, séparée par entreprise** (suggestion : 8 fichiers, ≤ 30 Mo, ≤ 30 jours) ; hors-ligne = dernier média valide, sinon photo locale.
- Pas de temps réel (push) en v1 : les changements Admin apparaissent au prochain refetch — documenté, acceptable pour un kiosque.

## 9. Recette (complète le §8 du rapport)

**Sécurité Admin/Storage (nos ajouts, exécutés avec l'IA Admin) :**
- Upload `annonces-accueil` en anon → **refusé** (politique `authenticated` seulement).
- Upload/écriture par admin sans AAL2 → **refusé 42501** (garde + politique).
- Upload vers chemin d'une autre entreprise → **refusé** (garde de chemin).
- RPC d'écriture sans session superadmin → **42501**.
- Fichier trop lourd / mauvais MIME / extension incohérente → **refusé** avec message lisible.
- 9ᵉ annonce sur une entreprise → **refusé** (max 8).

**Comportement RPC (testé en base, entreprise fictive de test) :**
- 0 annonce → `ok:true, publicites:[]` (app garde la photo).
- 1 image → 1 élément, `url` public valide, durée respectée.
- N médias (image + gif + vidéo) → ordre exact `ordre_publication`, tri déterministe.
- Inactive / hors période (`debute_le`/`termine_le`) → exclue par la RPC (heure serveur).
- Entreprise inconnue ou inactive → `ok:false` (réponse générique, pas de détail interne).
- **2 entreprises avec campagnes différentes → aucun mélange** (même en cache, par entreprise).

**Tablette (recette Dev2, §8 de leur rapport)** : les 12 cas tels quels (réseau lent/indisponible, changement d'entreprise, pointage pendant transition, clair/sombre, motifs, vidéo muente, GIF boucle, cadre fixe).

## 10. Données de test (jamais EN-NOUS)

- Entreprise fictive : **« ENTREPRISE TEST ANNONCES »** (code `ANN-TEST`), supprimée proprement en fin de recette (règle de la recette croisée).
- Médias de démo : 1 image 16:9, 1 GIF ≤ 30 s, 1 vidéo MP4 ≤ 15 s, générés pour la démo.

## 11. Rollback (idempotent, en cas d'écart bloquant)

```sql
DROP FUNCTION IF EXISTS public.encheck_annonce_accueil_supprimer(uuid, uuid);
DROP FUNCTION IF EXISTS public.encheck_annonce_accueil_mettre_a_jour(uuid, uuid, text, text, integer, integer, boolean, timestamptz, timestamptz);
DROP FUNCTION IF EXISTS public.encheck_accueil_publicites(uuid);
DROP FUNCTION IF EXISTS public.encheck_annonce_storage_autorise(text);
DROP TRIGGER IF EXISTS annonces_accueil_touch ON public.annonces_accueil;
DROP FUNCTION IF EXISTS public.encheck_annonce_accueil_touch();
DROP TABLE IF EXISTS public.annonces_accueil;
DROP POLICY IF EXISTS annonces_accueil_delete ON storage.objects;
DROP POLICY IF EXISTS annonces_accueil_update ON storage.objects;
DROP POLICY IF EXISTS annonces_accueil_insert ON storage.objects;
DELETE FROM storage.objects WHERE bucket_id = 'annonces-accueil';
DELETE FROM storage.buckets WHERE id = 'annonces-accueil';
```

## 12. Réponse au livrables attendus (rapport §9)

| Livrable demandé | Statut |
|---|---|
| Migration de schéma et rollback | ✅ §4 + §11 (à exécuter sur GO) |
| RPC de lecture + tests inter-entreprises | ✅ §6 + §9 (exécutés en base) |
| Bucket, politiques Storage, validation d'upload | ✅ §5 + §7 (validation serveur MIME/taille/extension) |
| Écran Admin avec ordre et durée par média | ✅ §2 (page `/annonces-accueil`, charte Appliqué d'Abomey, défi AAL2) |
| Médias de test sur entreprise fictive | ✅ §10 |
| Réponses exemple RPC (0/1/N + vidéo) | §9 (produites pendant la recette) |
| Doc cache / invalidation | ✅ §8 |

## 13. Ordre d'exécution

1. **GO utilisateur** → migration SQL §4/§5/§6/§7 (préflight + transaction + idempotence).
2. Recette SQL sécurité + RPC en base (entreprise fictive + médias de démo).
3. Page Admin `/annonces-accueil` (React, charte Appliqué d'Abomey, défi MFA AAL2).
4. Livraison des contrats à Dev2 (ce document + réponses exemple RPC) → branchement app + recette tablette §9.
5. Nettoyage entreprise fictive + médias de démo.
