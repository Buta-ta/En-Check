// src/services/__tests__/reglesTempsTravailSql.test.js
// ═══════════════════════════════════════════════════════════════════════════
// 🗄️ RÈGLES DE TEMPS DE TRAVAIL — exécutées dans un vrai Postgres (PGlite)
//
// Ce que ce fichier vérifie, et que la relecture seule ne montrerait pas :
//   1. la table refuse l'écriture directe d'un client (RLS + privilèges) ;
//   2. une entreprise ne lit ni n'écrit les règles d'une autre ;
//   3. l'arbitrage « l'acte explicite le plus récent gagne » ;
//   4. le VERROU est bien l'exception : il survit à un acte d'entreprise postérieur ;
//   5. les bornes et les clés non personnalisables sont refusées DANS la RPC ;
//   6. l'historique est append-only : chaque écriture chaîne la précédente.
//
// ⚠️ Valeurs FICTIVES (38 h, 42 h, 45 h, 25 h). Aucune n'est une règle légale.
// ═══════════════════════════════════════════════════════════════════════════

import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { PGlite } from '@electric-sql/pglite'
import { readFileSync } from 'node:fs'

const MIGRATIONS = [
  'supabase/migrations/20261123000002_encheck_regles_temps_travail.sql',
  'supabase/migrations/20261123000003_regles_retour_et_impact.sql',
  'supabase/migrations/20261124000001_informations_regle.sql',
]

const ENTS = {
  a: '11111111-1111-4111-8111-111111111111',
  b: '22222222-2222-4222-8222-222222222222',
}
const ADMINS = {
  normal: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  super: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
  autre: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
}
const EMPLOYES = {
  a1: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
  a2: 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',
  b1: 'ffffffff-ffff-4fff-8fff-ffffffffffff',
}

let db

/** Endosse un administrateur : les RPC lisent l'identité par ce réglage. */
async function endosser(adminId, role = 'authenticated') {
  await db.exec('reset role')
  await db.query("select set_config('app.admin_id', $1, false)", [adminId])
  if (role) await db.exec(`set role ${role}`)
}

/** PGlite peut rendre une `date` en objet Date : on compare sur YYYY-MM-DD. */
const iso = (v) => (v instanceof Date ? v.toISOString().slice(0, 10) : String(v).slice(0, 10))

async function resoudre({ entreprise, employe = null, cle = 'alerte_hebdo_heures', date = '2026-10-24' }) {
  const { rows } = await db.query(
    'select * from public.encheck_regle_resolue($1, $2, $3, $4)',
    [entreprise, employe, cle, date],
  )
  return rows[0]
}

/** Écriture directe, hors RPC : réservée au propriétaire de la base dans ce test. */
async function semer({ entreprise, employe = null, cle, valeur, date, verrouille = false, maj = null }) {
  await db.exec('reset role')
  const { rows } = await db.query(
    `insert into public.encheck_regles_temps_travail
       (cle, entreprise_id, employe_id, valeur, date_effet, verrouille, maj_le)
     values ($1,$2,$3,$4,$5,$6, coalesce($7::timestamptz, now()))
     returning id`,
    [cle, entreprise, employe, valeur, date, verrouille, maj],
  )
  return rows[0].id
}

beforeAll(async () => {
  db = new PGlite()
  await db.exec(`
    create role anon;
    create role authenticated;
    create role service_role;

    create table public.admins (id uuid primary key, role text not null);
    create table public.admin_entreprises (
      admin_id uuid, enterprise_id uuid, is_active boolean default true
    );
    create table public.employees (id uuid primary key, enterprise_id uuid not null);

    create or replace function public.current_admin_id() returns uuid
      language sql stable as $$
        select nullif(current_setting('app.admin_id', true), '')::uuid
      $$;

    create or replace function public.encheck_est_super_admin() returns boolean
      language sql stable as $$
        select exists(select 1 from public.admins a
                      where a.id = public.current_admin_id() and a.role = 'super_admin')
      $$;

    create or replace function public.admin_has_access_to_enterprise(target uuid)
      returns boolean language sql stable as $$
        select exists(
          select 1 from public.admins a
          where a.id = public.current_admin_id()
            and (a.role = 'super_admin'
                 or exists (select 1 from public.admin_entreprises ae
                            where ae.admin_id = a.id and ae.enterprise_id = target
                              and ae.is_active is true)))
      $$;

    insert into public.admins (id, role) values
      ('${ADMINS.normal}', 'admin'),
      ('${ADMINS.super}', 'super_admin'),
      ('${ADMINS.autre}', 'admin');

    insert into public.admin_entreprises (admin_id, enterprise_id) values
      ('${ADMINS.normal}', '${ENTS.a}'),
      ('${ADMINS.autre}', '${ENTS.b}');

    insert into public.employees (id, enterprise_id) values
      ('${EMPLOYES.a1}', '${ENTS.a}'),
      ('${EMPLOYES.a2}', '${ENTS.a}'),
      ('${EMPLOYES.b1}', '${ENTS.b}');
  `)
  for (const fichier of MIGRATIONS) await db.exec(readFileSync(fichier, 'utf8'))
}, 60000)

afterAll(async () => {
  await db?.close()
})

beforeEach(async () => {
  await db.exec('reset role')
  await db.exec('delete from public.encheck_informations_regle')
  await db.exec('delete from public.encheck_regles_temps_travail')
  await db.query("select set_config('app.admin_id', $1, false)", [ADMINS.normal])
})

describe('La table refuse d’être écrite par un client', () => {
  it('aucune insertion directe, même authentifié', async () => {
    await endosser(ADMINS.normal)
    await expect(
      db.query(
        `insert into public.encheck_regles_temps_travail (cle, entreprise_id, valeur)
         values ('alerte_hebdo_heures', $1, 40)`,
        [ENTS.a],
      ),
    ).rejects.toThrow()
  })

  it('aucune mise à jour non plus : l’histoire ne se réécrit pas', async () => {
    await semer({ entreprise: ENTS.a, cle: 'alerte_hebdo_heures', valeur: 40, date: '2026-01-01' })
    await endosser(ADMINS.normal)
    await expect(
      db.query('update public.encheck_regles_temps_travail set valeur = 10'),
    ).rejects.toThrow()
  })
})

describe('Résolution : l’acte explicite le plus récent gagne', () => {
  it('sans aucune règle, la réponse est « aucune » — pas un 48 h inventé', async () => {
    const r = await resoudre({ entreprise: ENTS.a })
    expect(r.origine).toBe('aucune')
    expect(r.valeur).toBeNull()
  })

  it('une règle d’entreprise est trouvée avec son origine', async () => {
    await semer({ entreprise: ENTS.a, cle: 'alerte_hebdo_heures', valeur: 45, date: '2026-09-01' })
    const r = await resoudre({ entreprise: ENTS.a })
    expect(Number(r.valeur)).toBe(45)
    expect(r.origine).toBe('entreprise')
    expect(iso(r.date_effet)).toBe('2026-09-01')
  })

  it('une valeur personnelle plus récente écrase la règle d’entreprise', async () => {
    await semer({ entreprise: ENTS.a, cle: 'alerte_hebdo_heures', valeur: 45, date: '2026-09-01' })
    await semer({ entreprise: ENTS.a, employe: EMPLOYES.a1, cle: 'alerte_hebdo_heures', valeur: 38, date: '2026-10-01' })
    const r = await resoudre({ entreprise: ENTS.a, employe: EMPLOYES.a1 })
    expect(Number(r.valeur)).toBe(38)
    expect(r.origine).toBe('employe')
  })

  it('et un acte d’entreprise plus récent reprend la main — la règle du fondateur', async () => {
    await semer({ entreprise: ENTS.a, employe: EMPLOYES.a1, cle: 'alerte_hebdo_heures', valeur: 38, date: '2026-09-01' })
    await semer({ entreprise: ENTS.a, cle: 'alerte_hebdo_heures', valeur: 42, date: '2026-10-01' })
    const r = await resoudre({ entreprise: ENTS.a, employe: EMPLOYES.a1 })
    expect(Number(r.valeur)).toBe(42)
    expect(r.origine).toBe('entreprise')
  })

  it('à date d’effet égale, la portée la plus étroite l’emporte', async () => {
    await semer({ entreprise: ENTS.a, cle: 'alerte_hebdo_heures', valeur: 45, date: '2026-10-01' })
    await semer({ entreprise: ENTS.a, employe: EMPLOYES.a1, cle: 'alerte_hebdo_heures', valeur: 38, date: '2026-10-01' })
    const r = await resoudre({ entreprise: ENTS.a, employe: EMPLOYES.a1 })
    expect(r.origine).toBe('employe')
  })

  it('une version future ne s’applique pas avant sa date d’effet', async () => {
    await semer({ entreprise: ENTS.a, cle: 'alerte_hebdo_heures', valeur: 45, date: '2026-09-01' })
    await semer({ entreprise: ENTS.a, cle: 'alerte_hebdo_heures', valeur: 35, date: '2026-12-01' })
    expect(Number((await resoudre({ entreprise: ENTS.a, date: '2026-10-24' })).valeur)).toBe(45)
    expect(Number((await resoudre({ entreprise: ENTS.a, date: '2026-12-02' })).valeur)).toBe(35)
  })
})

describe('Le verrou est l’exception à « le plus récent gagne »', () => {
  it('une valeur personnelle verrouillée survit à un acte d’entreprise plus récent', async () => {
    await semer({ entreprise: ENTS.a, employe: EMPLOYES.a1, cle: 'alerte_hebdo_heures', valeur: 38, date: '2026-09-01', verrouille: true })
    await semer({ entreprise: ENTS.a, cle: 'alerte_hebdo_heures', valeur: 42, date: '2026-10-01' })

    const r = await resoudre({ entreprise: ENTS.a, employe: EMPLOYES.a1 })
    expect(Number(r.valeur)).toBe(38)
    expect(r.verrouille).toBe(true)
    //  …et les autres employés suivent bien la nouvelle règle.
    expect(Number((await resoudre({ entreprise: ENTS.a, employe: EMPLOYES.a2 })).valeur)).toBe(42)
  })
})

describe('Cloisonnement entre entreprises', () => {
  it('un administrateur ne lit pas les règles d’une autre entreprise', async () => {
    await endosser(ADMINS.normal)
    await expect(resoudre({ entreprise: ENTS.b })).rejects.toThrow(/acces refuse/)
  })

  it('et ne peut pas y écrire', async () => {
    await endosser(ADMINS.normal)
    await expect(
      db.query("select public.encheck_regle_ecrire($1, null, 'alerte_hebdo_heures', 40, '2026-10-01', false)", [ENTS.b]),
    ).rejects.toThrow(/acces refuse/)
  })

  it('l’historique est cloisonné de la même façon', async () => {
    await endosser(ADMINS.normal)
    await expect(
      db.query('select * from public.encheck_regle_historique($1, null, null)', [ENTS.b]),
    ).rejects.toThrow(/acces refuse/)
  })
})

describe('Écriture : bornes et clés, contrôlées dans la RPC', () => {
  it('écrit une version et chaîne la précédente', async () => {
    await endosser(ADMINS.normal)
    const premier = await db.query(
      "select public.encheck_regle_ecrire($1, null, 'alerte_hebdo_heures', 45, '2026-09-01', false) as id",
      [ENTS.a],
    )
    const second = await db.query(
      "select public.encheck_regle_ecrire($1, null, 'alerte_hebdo_heures', 46, '2026-10-01', false) as id",
      [ENTS.a],
    )
    expect(second.rows[0].id).not.toBe(premier.rows[0].id)

    const histo = await db.query('select * from public.encheck_regle_historique($1, null, $2)', [ENTS.a, 'alerte_hebdo_heures'])
    expect(histo.rows).toHaveLength(2)
    //  La plus récente d'abord, et elle sait ce qu'elle a remplacé.
    expect(Number(histo.rows[0].valeur)).toBe(46)
    expect(histo.rows[0].remplace_id).toBe(premier.rows[0].id)
    //  La version remplacée est toujours là : rien n'est effacé.
    expect(Number(histo.rows[1].valeur)).toBe(45)
  })

  it('refuse un repos de plus de 24 h', async () => {
    await endosser(ADMINS.normal)
    await expect(
      db.query("select public.encheck_regle_ecrire($1, null, 'repos_minimum_heures', 25, '2026-10-01', false)", [ENTS.a]),
    ).rejects.toThrow(/24 h au plus/)
  })

  it('refuse une valeur nulle ou négative', async () => {
    await endosser(ADMINS.normal)
    await expect(
      db.query("select public.encheck_regle_ecrire($1, null, 'alerte_hebdo_heures', 0, '2026-10-01', false)", [ENTS.a]),
    ).rejects.toThrow()
  })

  it('refuse de personnaliser une clé de paie', async () => {
    await endosser(ADMINS.normal)
    await expect(
      db.query(
        "select public.encheck_regle_ecrire($1, $2, 'declenchement_paie_hebdo_heures', 40, '2026-10-01', false)",
        [ENTS.a, EMPLOYES.a1],
      ),
    ).rejects.toThrow(/ne se personnalise pas/)
  })

  it('refuse un employé d’une autre entreprise', async () => {
    await endosser(ADMINS.normal)
    await expect(
      db.query("select public.encheck_regle_ecrire($1, $2, 'alerte_hebdo_heures', 40, '2026-10-01', false)", [ENTS.a, EMPLOYES.b1]),
    ).rejects.toThrow(/hors de cette entreprise/)
  })

  it('refuse un second niveau sous le premier', async () => {
    await endosser(ADMINS.normal)
    await db.query("select public.encheck_regle_ecrire($1, null, 'alerte_hebdo_heures', 45, '2026-09-01', false)", [ENTS.a])
    await expect(
      db.query("select public.encheck_regle_ecrire($1, null, 'alerte_hebdo_niveau2_heures', 44, '2026-10-01', false)", [ENTS.a]),
    ).rejects.toThrow(/depasser le premier/)
  })
})

describe('Verrou : deux gestes réservés au super-administrateur', () => {
  it('un administrateur ordinaire ne peut pas poser un verrou', async () => {
    await endosser(ADMINS.normal)
    await expect(
      db.query("select public.encheck_regle_ecrire($1, $2, 'alerte_hebdo_heures', 38, '2026-10-01', true)", [ENTS.a, EMPLOYES.a1]),
    ).rejects.toThrow(/super-administrateur/)
  })

  it('un super-administrateur pose le verrou, et un acte d’entreprise ne l’écrase plus', async () => {
    await endosser(ADMINS.super)
    await db.query("select public.encheck_regle_ecrire($1, $2, 'alerte_hebdo_heures', 38, '2026-09-01', true)", [ENTS.a, EMPLOYES.a1])

    await endosser(ADMINS.normal)
    await expect(
      db.query("select public.encheck_regle_ecrire($1, null, 'alerte_hebdo_heures', 42, '2026-10-01', false)", [ENTS.a]),
    ).rejects.toThrow(/verrouillee/)

    expect(Number((await resoudre({ entreprise: ENTS.a, employe: EMPLOYES.a1 })).valeur)).toBe(38)
  })

  it('lui seul peut lever le verrou', async () => {
    await endosser(ADMINS.super)
    await db.query("select public.encheck_regle_ecrire($1, $2, 'alerte_hebdo_heures', 38, '2026-09-01', true)", [ENTS.a, EMPLOYES.a1])

    await endosser(ADMINS.normal)
    await expect(
      db.query("select public.encheck_regle_ecrire($1, $2, 'alerte_hebdo_heures', 39, '2026-10-01', false)", [ENTS.a, EMPLOYES.a1]),
    ).rejects.toThrow(/lever le verrou/)

    await endosser(ADMINS.super)
    await db.query("select public.encheck_regle_ecrire($1, $2, 'alerte_hebdo_heures', 39, '2026-10-01', false)", [ENTS.a, EMPLOYES.a1])
    const r = await resoudre({ entreprise: ENTS.a, employe: EMPLOYES.a1 })
    expect(Number(r.valeur)).toBe(39)
    expect(r.verrouille).toBe(false)
  })
})

describe('Retour à la règle d’entreprise', () => {
  it('une valeur personnelle NULL est un ABANDON, pas un « non configuré »', async () => {
    await semer({ entreprise: ENTS.a, cle: 'alerte_hebdo_heures', valeur: 42, date: '2026-09-01' })
    await semer({ entreprise: ENTS.a, employe: EMPLOYES.a1, cle: 'alerte_hebdo_heures', valeur: 38, date: '2026-09-15' })
    expect(Number((await resoudre({ entreprise: ENTS.a, employe: EMPLOYES.a1 })).valeur)).toBe(38)

    //  L'employé revient à la règle commune : nouvelle version personnelle nulle.
    await semer({ entreprise: ENTS.a, employe: EMPLOYES.a1, cle: 'alerte_hebdo_heures', valeur: null, date: '2026-10-01' })

    const r = await resoudre({ entreprise: ENTS.a, employe: EMPLOYES.a1 })
    expect(Number(r.valeur)).toBe(42)
    expect(r.origine).toBe('entreprise')
  })

  it('l’abandon reste dans l’historique : on saura qu’il y a eu un arrangement', async () => {
    await semer({ entreprise: ENTS.a, employe: EMPLOYES.a1, cle: 'alerte_hebdo_heures', valeur: 38, date: '2026-09-01' })
    await semer({ entreprise: ENTS.a, employe: EMPLOYES.a1, cle: 'alerte_hebdo_heures', valeur: null, date: '2026-10-01' })

    const { rows } = await db.query(
      'select * from public.encheck_regle_historique($1, $2, $3)',
      [ENTS.a, EMPLOYES.a1, 'alerte_hebdo_heures'],
    )
    expect(rows).toHaveLength(2)
    expect(rows[0].valeur).toBeNull()
  })

  it('un abandon personnel ne masque pas une valeur d’entreprise absente', async () => {
    await semer({ entreprise: ENTS.a, employe: EMPLOYES.a1, cle: 'alerte_hebdo_heures', valeur: 38, date: '2026-09-01' })
    await semer({ entreprise: ENTS.a, employe: EMPLOYES.a1, cle: 'alerte_hebdo_heures', valeur: null, date: '2026-10-01' })

    const r = await resoudre({ entreprise: ENTS.a, employe: EMPLOYES.a1 })
    expect(r.valeur).toBeNull()
    expect(r.origine).toBe('aucune')
  })
})

describe('Aperçu d’impact avant écriture', () => {
  const impact = async ({ entreprise = ENTS.a, cle = 'alerte_hebdo_heures', valeur = 44, date = '2026-10-20' }) => {
    const { rows } = await db.query(
      'select public.encheck_regle_impact($1, $2, $3, $4) as r',
      [entreprise, cle, valeur, date],
    )
    return rows[0].r
  }

  it('compte les employés dont la valeur changerait', async () => {
    await semer({ entreprise: ENTS.a, employe: EMPLOYES.a1, cle: 'alerte_hebdo_heures', valeur: 38, date: '2026-09-01' })
    await semer({ entreprise: ENTS.a, employe: EMPLOYES.a2, cle: 'alerte_hebdo_heures', valeur: 44, date: '2026-09-01' })

    await endosser(ADMINS.normal)
    const r = await impact({ valeur: 44 })

    expect(r.employes_concernes).toBe(2)
    //  a1 passe de 38 à 44 ; a2 est déjà à 44, rien ne change pour lui.
    expect(r.valeurs_changees).toBe(1)
    expect(r.details).toHaveLength(1)
    expect(r.details[0].employe_id).toBe(EMPLOYES.a1)
    expect(Number(r.details[0].valeur_actuelle)).toBe(38)
  })

  it('signale les verrous, et que l’écriture sera refusée', async () => {
    await semer({ entreprise: ENTS.a, employe: EMPLOYES.a1, cle: 'alerte_hebdo_heures', valeur: 38, date: '2026-09-01', verrouille: true })

    await endosser(ADMINS.normal)
    const r = await impact({ valeur: 44 })
    expect(r.dont_verrouillees).toBe(1)
    expect(r.ecriture_bloquee).toBe(true)

    //  Pour un super-administrateur, le verrou est levable : l'écriture passe.
    await endosser(ADMINS.super)
    const rSuper = await impact({ valeur: 44 })
    expect(rSuper.dont_verrouillees).toBe(1)
    expect(rSuper.ecriture_bloquee).toBe(false)
  })

  it('sans aucun employé concerné, l’impact est vide — pas une estimation inventée', async () => {
    await endosser(ADMINS.normal)
    const r = await impact({ valeur: 44 })
    expect(r.employes_concernes).toBe(0)
    expect(r.valeurs_changees).toBe(0)
    expect(r.details).toEqual([])
  })

  it('est cloisonné par entreprise', async () => {
    await endosser(ADMINS.normal)
    await expect(impact({ entreprise: ENTS.b })).rejects.toThrow(/acces refuse/)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
//  Le devoir d'informer (§3.5.g) — « toujours informer », mais enregistré
// ─────────────────────────────────────────────────────────────────────────────

describe('Le devoir d’informer — un enregistrement, pas un message volatil', () => {
  async function lireInformations(entreprise, employe) {
    await db.exec('reset role')
    const { rows } = await db.query(
      'select * from public.encheck_informations_regle($1, $2)',
      [entreprise, employe],
    )
    return rows
  }

  it('poser une valeur personnelle crée UNE information, avec destinataire, date et texte figé', async () => {
    await endosser(ADMINS.normal)
    await db.query("select public.encheck_regle_ecrire($1, null, 'alerte_hebdo_heures', 45, '2026-09-01', false)", [ENTS.a])
    await db.query("select public.encheck_regle_ecrire($1, $2, 'alerte_hebdo_heures', 38, '2026-10-01', false)", [ENTS.a, EMPLOYES.a1])

    const infos = await lireInformations(ENTS.a, EMPLOYES.a1)
    expect(infos).toHaveLength(1)
    expect(infos[0].evenement).toBe('valeur_personnelle_posee')
    //  Ce qui a été dit : la valeur, la date, et l'écart avec l'entreprise.
    expect(infos[0].contenu).toContain('38 h')
    expect(infos[0].contenu).toContain('45 h')
    expect(infos[0].contenu).toContain('01/10/2026')
    expect(Number(infos[0].valeur_avant)).toBe(45)
    expect(Number(infos[0].valeur_apres)).toBe(38)
    //  Qui a décidé, quand : la preuve d'émission.
    expect(infos[0].emis_par).toBe(ADMINS.normal)
    expect(infos[0].emis_le).toBeTruthy()
    expect(infos[0].consulte_le).toBeNull()
  })

  it('une règle d’entreprise sans verrou n’informe personne : rien n’a changé pour personne', async () => {
    await endosser(ADMINS.normal)
    await db.query("select public.encheck_regle_ecrire($1, null, 'alerte_hebdo_heures', 45, '2026-09-01', false)", [ENTS.a])

    expect(await lireInformations(ENTS.a, EMPLOYES.a1)).toHaveLength(0)
  })

  it('sans valeur d’entreprise, la phrase le DIT au lieu d’inventer un repère', async () => {
    await endosser(ADMINS.normal)
    await db.query("select public.encheck_regle_ecrire($1, $2, 'repos_minimum_heures', 11, '2026-10-01', false)", [ENTS.a, EMPLOYES.a1])

    const infos = await lireInformations(ENTS.a, EMPLOYES.a1)
    expect(infos[0].contenu).toContain('Aucune valeur d’entreprise n’est enregistrée')
    expect(infos[0].valeur_entreprise).toBeNull()
  })

  it('un verrou se dit verrouillé, et nomme qui peut le lever', async () => {
    await endosser(ADMINS.super)
    await db.query("select public.encheck_regle_ecrire($1, $2, 'alerte_hebdo_heures', 38, '2026-10-01', true)", [ENTS.a, EMPLOYES.a1])

    const infos = await lireInformations(ENTS.a, EMPLOYES.a1)
    expect(infos[0].evenement).toBe('valeur_personnelle_verrouillee')
    expect(infos[0].contenu).toContain('verrouillé')
    expect(infos[0].contenu).toContain('super-administrateur')
  })

  it('le retour à l’entreprise informe de la règle qui s’applique désormais', async () => {
    await endosser(ADMINS.normal)
    await db.query("select public.encheck_regle_ecrire($1, null, 'alerte_hebdo_heures', 45, '2026-09-01', false)", [ENTS.a])
    await db.query("select public.encheck_regle_ecrire($1, $2, 'alerte_hebdo_heures', 38, '2026-10-01', false)", [ENTS.a, EMPLOYES.a1])
    await db.query("select public.encheck_regle_ecrire($1, $2, 'alerte_hebdo_heures', null, '2026-11-01', false)", [ENTS.a, EMPLOYES.a1])

    const infos = await lireInformations(ENTS.a, EMPLOYES.a1)
    expect(infos[0].evenement).toBe('valeur_personnelle_retiree')
    expect(infos[0].contenu).toContain('45 h')
    expect(infos[0].contenu).toContain('01/11/2026')
    //  L'ancienne décision n'est pas réécrite : la ligne précédente reste.
    expect(infos).toHaveLength(2)
    expect(infos[1].evenement).toBe('valeur_personnelle_posee')
  })

  it('une règle d’entreprise qui n’atteint pas un verrou le dit à la personne qui le garde', async () => {
    await endosser(ADMINS.super)
    await db.query("select public.encheck_regle_ecrire($1, $2, 'alerte_hebdo_heures', 38, '2026-09-01', true)", [ENTS.a, EMPLOYES.a1])
    await db.query("select public.encheck_regle_ecrire($1, null, 'alerte_hebdo_heures', 42, '2026-10-01', false)", [ENTS.a])

    const infos = await lireInformations(ENTS.a, EMPLOYES.a1)
    const conserve = infos.find((i) => i.evenement === 'reglage_personnel_conserve')
    expect(conserve).toBeTruthy()
    expect(conserve.contenu).toContain('38 h')
    expect(conserve.contenu).toContain('42 h')
    expect(conserve.contenu).toContain('reste applicable')
    //  Et la valeur n'a pas bougé.
    expect(Number((await resoudre({ entreprise: ENTS.a, employe: EMPLOYES.a1 })).valeur)).toBe(38)
  })

  it('aucun client ne peut fabriquer une information à la main', async () => {
    await endosser(ADMINS.normal)
    await expect(
      db.query(
        `insert into public.encheck_informations_regle
           (entreprise_id, employe_id, cle, evenement, contenu, date_effet)
         values ($1, $2, 'alerte_hebdo_heures', 'valeur_personnelle_posee', 'faux', '2026-10-01')`,
        [ENTS.a, EMPLOYES.a1],
      ),
    ).rejects.toThrow()
  })

  it('ni réécrire une information déjà émise', async () => {
    await endosser(ADMINS.normal)
    await db.query("select public.encheck_regle_ecrire($1, $2, 'alerte_hebdo_heures', 38, '2026-10-01', false)", [ENTS.a, EMPLOYES.a1])
    await expect(
      db.query("update public.encheck_informations_regle set contenu = 'autre chose'"),
    ).rejects.toThrow()
  })

  it('est cloisonné : un administrateur d’une autre entreprise ne la lit pas', async () => {
    await endosser(ADMINS.normal)
    await db.query("select public.encheck_regle_ecrire($1, $2, 'alerte_hebdo_heures', 38, '2026-10-01', false)", [ENTS.a, EMPLOYES.a1])

    await endosser(ADMINS.autre)
    await expect(
      db.query('select * from public.encheck_informations_regle($1, $2)', [ENTS.a, EMPLOYES.a1]),
    ).rejects.toThrow(/acces refuse/)
  })
})
