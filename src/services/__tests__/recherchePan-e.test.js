import { describe, it, expect, vi, beforeEach } from 'vitest'

// ─────────────────────────────────────────────────────────────────────────────
//  F5 — une recherche en panne n'est plus une recherche vide
//
//  Le défaut tenait en huit mots identiques dans `globalSearch` :
//
//        .catch(() => [])
//
//  Mais en creusant, le vrai défaut était pire, et ailleurs : les huit sources
//  lisaient `const { data } = await q` — l'`error` de Supabase était JETÉE.
//  Le `.catch` était donc du code mort : rien ne rejetait jamais. Une base
//  muette rendait `data = null`, donc `[]`, donc « aucun résultat ».
//
//  Ce qui est réellement emprunté par l'utilisateur : `parseQuery` route
//  presque tout vers EMPLOYEE_SEARCH (voir le constat au plan, §8 point 4).
//  C'est ce chemin-là qui doit parler quand il tombe.
// ─────────────────────────────────────────────────────────────────────────────

const faux = { panne: false }

function chaine() {
  const erreur = faux.panne
  const o = {
    select: () => o, eq: () => o, in: () => o, ilike: () => o, or: () => o,
    gte: () => o, lte: () => o, order: () => o, limit: () => o, not: () => o,
    range: () => o,
    maybeSingle: () => reponse(erreur),
    single: () => reponse(erreur),
    then: (ok, ko) => reponse(erreur).then(ok, ko),
  }
  return o
}

function reponse(erreur) {
  return Promise.resolve(
    erreur
      ? { data: null, count: null, error: { message: 'connexion perdue', code: '08006' } }
      : { data: [], count: 0, error: null },
  )
}

vi.mock('../../lib/supabase', () => ({
  supabase: {
    from: () => chaine(),
    rpc: () => Promise.resolve({ data: [], error: null }),
  },
}))

const { searchSpotlight } = await import('../spotlightService')

const admin = { enterprise_id: 'ent-1' }

beforeEach(() => {
  faux.panne = false
  vi.spyOn(console, 'error').mockImplementation(() => {})
  vi.spyOn(console, 'warn').mockImplementation(() => {})
})

describe('🔍 F5 — la recherche ne confond plus panne et vacuité', () => {
  it('une base muette produit une carte, plus un « aucun résultat »', async () => {
    faux.panne = true
    const res = await searchSpotlight('amina', admin)
    expect(res.length).toBe(1)
    expect(res[0].title).toMatch(/indisponible/i)
    expect(res[0].action).toBe('focusSearch')
    //  Et surtout : ce n'est PAS un tableau vide, qui se lirait « personne ».
    expect(res).not.toEqual([])
  })

  it('une recherche qui réussit sans résultat reste muette', async () => {
    //  Le silence doit rester possible : c'est le vrai « aucun résultat ».
    const res = await searchSpotlight('personne-inexistante', admin)
    expect(res).toEqual([])
  })

  it('aucune panne ne remonte en rejet non géré', async () => {
    //  `searchSpotlight` est appelée à chaque frappe, sans try/catch côté
    //  appelant : une promesse rejetée casserait la saisie en cours.
    faux.panne = true
    await expect(searchSpotlight('amina', admin)).resolves.toBeTruthy()
    //  La panne est TRACÉE, pas avalée en silence.
    expect(console.error).toHaveBeenCalled()
  })

  it('une requête vide ne déclenche rien du tout', async () => {
    faux.panne = true
    expect(await searchSpotlight('   ', admin)).toEqual([])
  })

  it('la carte parle des pages métier : l’utilisateur n’est pas bloqué', async () => {
    faux.panne = true
    const [carte] = await searchSpotlight('amina', admin)
    expect(carte.subtitle).toMatch(/pages métier/i)
  })
})
