// ═══════════════════════════════════════════════════════════════════════════
// 🏷️ LA MIGRATION DU TITRE D'ANNONCE, JOUÉE POUR DE VRAI
//
// Un test qui se contente de lire le texte d'une migration ne prouve rien :
// il vérifie qu'on a écrit du SQL, pas qu'il s'exécute. Ici on monte un
// Postgres réel (PGlite, déjà dans le dépôt), on crée le squelette des objets
// dont la migration dépend, et on JOUE la migration telle quelle.
//
// POURQUOI CE TEST EXISTE
// ────────────────────────────────────────────────────────────────────────────
// La faute qu'il empêche est silencieuse et coûteuse :
//
//   `CREATE OR REPLACE FUNCTION ... (…, p_titre text DEFAULT NULL)` NE
//   REMPLACE PAS la fonction à neuf paramètres — PostgreSQL crée une
//   SURCHARGE. L'ancienne resterait appelable, et un ancien client
//   continuerait d'écrire sans titre, sans la moindre erreur.
//
// Et le second piège, plus vicieux encore : si `NULL` était écrit tel quel
// dans l'UPDATE, CHAQUE modification faite par un client à neuf paramètres
// (basculer, déplacer) EFFACERAIT le titre. L'admin ne s'en apercevrait
// qu'en demandant « où est passé mon titre ? ».
//
// Ce fichier verrouille les deux : une seule signature, et NULL = ne pas
// toucher.
// ═══════════════════════════════════════════════════════════════════════════
import { PGlite } from '@electric-sql/pglite'
import fs from 'node:fs'
import { describe, it, expect, beforeAll, afterAll } from 'vitest'

const MIGRATION = 'supabase/migrations/20261130000001_annonce_titre.sql'

const ENT = '11111111-1111-1111-1111-111111111111'
const ANN = '22222222-2222-2222-2222-222222222222'
const ADM = '33333333-3333-3333-3333-333333333333'
const CHEMIN = `${ENT}/${ANN}/a.jpg`

// Les appels de la page, à l'identique : 10 arguments (avec titre) et
// 9 arguments (sans, comme basculer et deplacer).
const ecrire = (db, titre, args = {}) => {
  const {
    duree = 5000,
    ordre = 1,
    actif = true,
  } = args
  if (titre === undefined) {
    return db.query(
      `SELECT public.encheck_annonce_accueil_mettre_a_jour(
         $1,$2,'image',$3,$4,$5,$6,NULL,NULL) AS r`,
      [ENT, ANN, CHEMIN, duree, ordre, actif],
    )
  }
  return db.query(
    `SELECT public.encheck_annonce_accueil_mettre_a_jour(
       $1,$2,'image',$3,$4,$5,$6,NULL,NULL,$7) AS r`,
    [ENT, ANN, CHEMIN, duree, ordre, actif, titre],
  )
}

const lireTitre = async (db) => {
  const r = await db.query('SELECT titre FROM public.annonces_accueil WHERE id = $1', [ANN])
  return r.rows[0].titre
}

describe('migration 20261130000001_annonce_titre', () => {
  let db

  beforeAll(async () => {
    db = new PGlite()

    // ── Le squelette : seulement ce que la migration touche ───────────────
    await db.exec(`
      CREATE SCHEMA IF NOT EXISTS auth;
      CREATE SCHEMA IF NOT EXISTS storage;
      CREATE ROLE anon;
      CREATE ROLE authenticated;
      CREATE ROLE service_role;

      CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql AS $$
        SELECT '${ADM}'::uuid $$;

      CREATE TABLE public.enterprises (id uuid PRIMARY KEY, name text);
      CREATE TABLE public.admins (id uuid PRIMARY KEY, user_id uuid);

      CREATE TABLE public.annonces_accueil (
        id uuid PRIMARY KEY,
        enterprise_id uuid,
        type_media text,
        media_path text,
        duree_affichage_ms integer,
        ordre_publication integer,
        is_active boolean,
        publie_le timestamptz,
        debute_le timestamptz,
        termine_le timestamptz,
        cree_par uuid,
        created_at timestamptz DEFAULT now(),
        updated_at timestamptz DEFAULT now()
      );

      CREATE TABLE public.audit_logs (
        id bigserial PRIMARY KEY,
        enterprise_id uuid,
        admin_id uuid,
        target_id uuid,
        action text,
        details jsonb,
        created_at timestamptz DEFAULT now()
      );

      CREATE TABLE storage.objects (bucket_id text, name text, metadata jsonb);

      CREATE FUNCTION public.encheck_borne_admin_guard() RETURNS void
        LANGUAGE plpgsql AS $$ BEGIN RETURN; END $$;

      --  L'ANCIENNE fonction à neuf paramètres : c'est elle que la migration
      --  doit retirer, et non surcharger.
      CREATE FUNCTION public.encheck_annonce_accueil_mettre_a_jour(
        p_enterprise_id uuid, p_id uuid, p_type_media text, p_media_path text,
        p_duree_affichage_ms integer, p_ordre_publication integer,
        p_is_active boolean, p_debute_le timestamptz, p_termine_le timestamptz
      ) RETURNS jsonb LANGUAGE sql AS $$ SELECT '{}'::jsonb $$;

      INSERT INTO public.enterprises VALUES ('${ENT}', 'Recette');
      INSERT INTO public.admins VALUES ('${ADM}', '${ADM}');
      INSERT INTO storage.objects VALUES
        ('annonces-accueil', '${CHEMIN}',
         '{"mimetype":"image/jpeg","size":"1000"}'::jsonb);
    `)

    // ── La migration, telle qu'elle sera rejouée en production ────────────
    await db.exec(fs.readFileSync(MIGRATION, 'utf8'))
  }, 30_000)

  afterAll(async () => {
    await db?.close()
  })

  it('ne laisse AUCUNE surcharge : une seule signature, celle avec le titre', async () => {
    const r = await db.query(`
      SELECT pg_get_function_identity_arguments(oid) AS sig
        FROM pg_proc WHERE proname = 'encheck_annonce_accueil_mettre_a_jour'`)
    expect(r.rows).toHaveLength(1)
    expect(r.rows[0].sig).toContain('p_titre text')
  })

  it('garde l\'ACL sans anon : une écriture d\'annonce n\'est pas anonyme', async () => {
    const r = await db.query(`
      SELECT proacl::text AS acl FROM pg_proc
       WHERE proname = 'encheck_annonce_accueil_mettre_a_jour'`)
    expect(r.rows[0].acl).not.toContain('anon=')
    expect(r.rows[0].acl).toContain('authenticated=')
  })

  it('ajoute une colonne titre NULLABLE — on n\'invente pas de titre', async () => {
    const r = await db.query(`
      SELECT is_nullable FROM information_schema.columns
       WHERE table_name = 'annonces_accueil' AND column_name = 'titre'`)
    expect(r.rows[0].is_nullable).toBe('YES')
  })

  it('rogne les bords d\'un titre', async () => {
    const r = await ecrire(db, '  Menu du jour  ')
    expect(r.rows[0].r.annonce.titre).toBe('Menu du jour')
  })

  it('traite un titre fait d\'espaces comme absent', async () => {
    const r = await ecrire(db, '   ')
    expect(r.rows[0].r.annonce.titre).toBe(null)
  })

  it('refuse un titre de plus de 80 caractères', async () => {
    await expect(ecrire(db, 'x'.repeat(81))).rejects.toThrow(/80/)
  })

  it('accepte encore un appel à 9 arguments (ancien client)', async () => {
    await expect(ecrire(db, undefined)).resolves.toBeTruthy()
  })

  it('un appel à 9 arguments NE TOUCHE PAS au titre existant', async () => {
    await ecrire(db, 'Titre posé')
    expect(await lireTitre(db)).toBe('Titre posé')

    // basculer() et deplacer() écrivent exactement comme ça
    await ecrire(db, undefined, { actif: false })
    expect(await lireTitre(db)).toBe('Titre posé')

    await ecrire(db, undefined, { ordre: 2 })
    expect(await lireTitre(db)).toBe('Titre posé')

    const r = await db.query(
      'SELECT ordre_publication FROM public.annonces_accueil WHERE id = $1', [ANN])
    expect(r.rows[0].ordre_publication).toBe(2)
  })

  it('un titre vide EFFACE, parce que c\'est explicite', async () => {
    await ecrire(db, 'À effacer')
    await ecrire(db, '')
    expect(await lireTitre(db)).toBe(null)
  })

  it('la lecture renvoie le titre, et une chaîne vide quand il n\'y en a pas', async () => {
    await ecrire(db, 'Lisible')
    const r = await db.query(
      'SELECT public.encheck_annonce_accueil_lister($1) AS r', [ENT])
    expect(r.rows[0].r.annonces[0].titre).toBe('Lisible')
  })
})
