import { describe, it, expect, vi, beforeEach } from 'vitest'

// ─────────────────────────────────────────────────────────────────────────────
//  F5-bis — TOUS les chemins de panne de la recherche, pas seulement le global
//
//  Le premier lot F5 corrigeait `globalSearch` et les huit sources. Mais
//  `dispatchRecherche` a HUIT branches, et chacune lit la base à sa façon :
//
//      COMMAND · EMPLOYEE_HOURS · EMPLOYEE_SEARCH · TASK_SEARCH
//      ATTENDANCE_SEARCH · ABSENCE_SEARCH · PAYSLIP_SEARCH · global
//
//  Une seule était testée en panne. Ce fichier les couvre toutes.
//
//  Ce qui est vérifié, chemin par chemin : la panne remonte au point d'entrée,
//  qui rend une CARTE — jamais un tableau vide, jamais un écran qui se lirait
//  « il n'y a rien ». Et une recherche qui réussit mais ne trouve rien reste
//  muette : c'est le seul « rien » qui ait le droit d'être silencieux.
// ─────────────────────────────────────────────────────────────────────────────

const faux = { panne: false, tablesEnPanne: new Set(), resultat: null }

function chaine(table) {
  const erreur = faux.panne || faux.tablesEnPanne.has(table)
  const o = {
    select: () => o, eq: () => o, in: () => o, ilike: () => o, or: () => o,
    gte: () => o, lte: () => o, order: () => o, limit: () => o, not: () => o,
    range: () => o, is: () => o, contains: () => o,
    maybeSingle: () => reponse(erreur, table),
    single: () => reponse(erreur, table),
    then: (ok, ko) => reponse(erreur, table).then(ok, ko),
  }
  return o
}

function reponse(erreur, table) {
  return Promise.resolve(
    erreur
      ? { data: null, count: null, error: { message: 'connexion perdue', code: '08006' } }
      : { data: table === 'employees' && faux.resultat ? faux.resultat : [], count: 0, error: null },
  )
}

vi.mock('../../lib/supabase', () => ({
  supabase: {
    from: (t) => chaine(t),
    rpc: () => Promise.resolve({ data: [], error: null }),
  },
}))

vi.mock('../holidayService', () => ({
  default: {
    isHoliday: () =>
      faux.panne
        ? Promise.reject(new Error('fériés indisponibles'))
        : Promise.resolve(null),
  },
}))

const { searchSpotlight } = await import('../spotlightService')

const admin = { enterprise_id: 'ent-1' }

//  Chaque cas porte la requête qui route VERS cette branche (voir
//  `queryParser`), et le nom de la branche pour que l'échec soit lisible.
const CHEMINS = [
  ['EMPLOYEE_SEARCH', 'amina'],
  ['TASK_SEARCH', 'tâche urgente'],
  ['ATTENDANCE_SEARCH', 'pointage de lundi'],
  ['ABSENCE_SEARCH', 'congé maladie'],
  ['PAYSLIP_SEARCH', 'bulletin de paie'],
  ['EMPLOYEE_HOURS', 'heures de amina'],
  ['COMMAND stats', 'stats'],
  ['COMMAND absents', 'absents'],
]

beforeEach(() => {
  faux.panne = false
  faux.tablesEnPanne = new Set()
  faux.resultat = null
  vi.spyOn(console, 'error').mockImplementation(() => {})
  vi.spyOn(console, 'warn').mockImplementation(() => {})
})

describe('🔍 F5-bis — chaque branche de recherche survit à sa panne', () => {
  for (const [branche, requete] of CHEMINS) {
    it(`${branche} : la panne devient une carte, jamais un vide`, async () => {
      faux.panne = true
      const res = await searchSpotlight(requete, admin)
      //  Aucun rejet : on est appelé à chaque frappe.
      expect(Array.isArray(res)).toBe(true)
      expect(res.length).toBe(1)
      expect(res[0].id).toBe('search-unavailable')
      expect(res[0].title).toMatch(/indisponible/i)
    })
  }

  for (const [branche, requete] of CHEMINS) {
    it(`${branche} : sans panne, on ne crie pas « indisponible »`, async () => {
      //  Le pendant indispensable : quand la base répond correctement et qu'il
      //  n'y a rien à trouver, on ne dit JAMAIS « indisponible ».
      //  `stats` fait exception : cette commande rend toujours une synthèse
      //  (« 0 présent • 0 en congé • 0 absent »), même quand la base est vide.
      //  Ce n'est pas une panne déguisée, c'est le contrat de la commande.
      const res = await searchSpotlight(requete, admin)
      expect(res.some((r) => r.id === 'search-unavailable')).toBe(false)
      if (branche !== 'COMMAND stats') expect(res).toEqual([])
    })
  }

  it('la carte de panne ne prétend jamais qu’il n’y a aucun résultat', async () => {
    faux.panne = true
    for (const [, requete] of CHEMINS) {
      const [carte] = await searchSpotlight(requete, admin)
      const texte = `${carte.title} ${carte.subtitle}`.toLowerCase()
      //  Les tournures qui feraient croire à une absence de données.
      expect(texte).not.toContain('aucun résultat')
      expect(texte).not.toContain('aucune donnée')
      expect(texte).not.toContain('personne')
    }
  })
})

// ─────────────────────────────────────────────────────────────────────────────
//  F5-ter — une seule source en panne, et RIEN trouvé
//
//  Dernier endroit où le défaut se cachait. Tant que les autres sources
//  ramènent quelque chose, le silence est honnête : on a trouvé des résultats,
//  la panne est marginale. Mais si le total est VIDE et qu'une source était en
//  panne, alors « aucun résultat » est FAUX — l'assistant affichait pourtant
//  « Je n'ai trouvé aucune fiche correspondant à… ».
//
//  C'est le pire des trois cas F5 : une phrase affirmative, complète, crédible,
//  et démentie par une panne que personne ne voit.
// ─────────────────────────────────────────────────────────────────────────────

describe('🔍 F5-ter — une panne isolée ne se déguise pas en « aucun résultat »', () => {
  const brancherPanne = (tables) => {
    faux.tablesEnPanne = new Set(tables)
  }

  it('une seule source en panne + rien trouvé ⇒ carte, pas « aucun résultat »', async () => {
    faux.panne = false
    brancherPanne(['tasks'])
    const res = await searchSpotlight('ab', admin)
    expect(res).toHaveLength(1)
    expect(res[0].id).toBe('search-unavailable')
    expect(res[0].subtitle).toMatch(/Recherche partielle/i)
    expect(res[0].subtitle).toMatch(/tâches/)
    //  Le point du lot : la carte DIT que ce n'est pas une absence de résultat.
    expect(res[0].subtitle).toMatch(/pas une absence de résultat/i)
  })

  it('une source en panne mais des résultats ailleurs ⇒ silence', async () => {
    //  On a trouvé quelque chose : crier « partiel » serait du bruit.
    faux.panne = false
    brancherPanne(['tasks'])
    //  Le nom doit CORRESPONDRE à la requête : `searchEmployees` filtre avec
    //  Fuse (threshold 0.3), un faux résultat trop éloigné serait écarté et le
    //  test ne prouverait rien.
    faux.resultat = [{ id: 'e1', first_name: 'Abdoul', last_name: 'Bio', matricule: 'AB-01', is_active: true }]
    const res = await searchSpotlight('ab', admin)
    expect(res.some((r) => r.id === 'search-unavailable')).toBe(false)
    faux.resultat = null
  })

  it('aucune panne et rien trouvé ⇒ silence, le vrai « aucun résultat »', async () => {
    faux.panne = false
    brancherPanne([])
    const res = await searchSpotlight('ab', admin)
    expect(res).toEqual([])
  })

  it('l’accord du message suit le nombre de sources', async () => {
    faux.panne = false
    brancherPanne(['tasks'])
    const une = (await searchSpotlight('ab', admin))[0].subtitle
    expect(une).toMatch(/la source « tâches » n’a pas répondu/)

    brancherPanne(['tasks', 'teams'])
    const deux = (await searchSpotlight('ab', admin))[0].subtitle
    expect(deux).toMatch(/2 sources n’ont pas répondu/)
  })
})
