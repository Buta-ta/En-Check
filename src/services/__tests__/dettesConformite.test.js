// src/services/__tests__/dettesConformite.test.js
// ═══════════════════════════════════════════════════════════════════════════
// 🧹 LES DEUX DETTES DE L'AUDIT (constats F4 et F5)
//
// F4 — les bornes 110 % / 70 % du taux de charge étaient écrites en dur au
//      milieu du calcul : impossible de les ajuster sans toucher au code.
//
// F5 — `searchSpotlight` est appelée à chaque frappe, sans `try/catch` : la
//      moindre panne d'une source remontait en rejet non géré. Pire, une
//      recherche cassée et une recherche vide étaient indiscernables pour
//      l'utilisateur.
// ═══════════════════════════════════════════════════════════════════════════

import { afterEach, describe, expect, it, vi } from 'vitest'
import { __internal } from '../hoursCalculator'
import { SEUILS_PAR_DEFAUT } from '../seuilsPointage'

const { from } = vi.hoisted(() => ({ from: vi.fn() }))

vi.mock('../../lib/supabase', () => ({
  supabase: { from },
  supabaseEmployee: { from },
  default: { from },
}))

const { generateAlerts } = __internal

const alertsAvec = (rate, seuils) => generateAlerts({
  today: {},
  month: { rate, anomalies: [] },
  year: null,
  hasPlan: true,
  seuils,
}).map(a => a.message).join(' | ')

afterEach(() => {
  from.mockReset()
  vi.restoreAllMocks()
})

describe('F4 — les bornes de surcharge viennent des réglages', () => {
  it('les valeurs par défaut restent 110 % et 70 %', () => {
    expect(SEUILS_PAR_DEFAUT.surchargePourcent).toBe(110)
    expect(SEUILS_PAR_DEFAUT.sousUtilisationPourcent).toBe(70)
  })

  it('un taux de 108 % ne déclenche rien par défaut, mais alerte si la borne est à 105', () => {
    expect(alertsAvec(108, SEUILS_PAR_DEFAUT)).not.toContain('Surcharge')
    expect(alertsAvec(108, { ...SEUILS_PAR_DEFAUT, surchargePourcent: 105 })).toContain('Surcharge détectée : 108%')
  })

  it('la borne de sous-utilisation est réglable elle aussi', () => {
    expect(alertsAvec(78, SEUILS_PAR_DEFAUT)).not.toContain('Sous-utilisation')
    expect(alertsAvec(78, { ...SEUILS_PAR_DEFAUT, sousUtilisationPourcent: 80 }))
      .toContain('Sous-utilisation : seulement 78%')
  })

  it('sans seuils du tout, on retombe sur les défauts (aucune alerte fantôme)', () => {
    expect(alertsAvec(100, null)).not.toContain('Surcharge')
    expect(alertsAvec(100, null)).not.toContain('Sous-utilisation')
  })
})

describe('F5 — la recherche ne casse plus l’écran', () => {
  it('une panne totale rend une carte visible, au lieu de rejeter', async () => {
    const erreur = new Error('database unavailable')
    from.mockImplementation(() => { throw erreur })
    vi.spyOn(console, 'error').mockImplementation(() => {})
    vi.spyOn(console, 'warn').mockImplementation(() => {})

    const { searchSpotlight } = await import('../spotlightService')
    const resultats = await searchSpotlight('awa', { selectedEnterprise: { id: 'ent-1' } })

    expect(Array.isArray(resultats)).toBe(true)
    expect(resultats).toHaveLength(1)
    expect(resultats[0].title).toContain('indisponible')
    //  La différence qui compte : « en panne » n'est pas « aucun résultat ».
    expect(resultats[0].subtitle).toContain('Réessayez')
  })

  it('une requête vide reste silencieuse (pas de carte d’erreur parasite)', async () => {
    const { searchSpotlight } = await import('../spotlightService')
    await expect(searchSpotlight('   ', { selectedEnterprise: { id: 'ent-1' } })).resolves.toEqual([])
  })

  it('sans entreprise active, le message reste celui d’avant', async () => {
    const { searchSpotlight } = await import('../spotlightService')
    const resultats = await searchSpotlight('awa', {})

    expect(resultats[0].id).toBe('need-enterprise')
  })
})
