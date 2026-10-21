// ═══════════════════════════════════════════════════════════════════════════
// SORTIE MANQUANTE — une journée non fermée ne reste pas « en cours » à vie
//   Cas réel (Hippo BIYOKILA, 19/10) : entrée badgée, aucune sortie, puis une
//   nouvelle entrée le lendemain. L'entrée du 19 était écrasée dans l'état du
//   moteur, donc jamais auto-clôturée : la case du planning clignotait
//   « en cours · non planifié » sans fin, y compris sur un jour révolu.
//   Le moteur retient désormais la session ouverte de CHAQUE jour et lui
//   applique la règle d'auto-clôture — la même que la page Pointages.
// ═══════════════════════════════════════════════════════════════════════════

import { describe, it, expect } from 'vitest'
import { resoudrePointagesJournee } from '../hoursCalculator'

const ENT_AUTO_CLOSE = {
  autoCloseEnabled: true,
  autoCloseTime: '22:00:00',
  autoCloseGraceMinutes: 0,
}

const badge = (id, check_time, check_type) => ({
  id,
  employee_id: 'emp-1',
  enterprise_id: 'ent-1',
  check_time,
  check_type,
})

describe('Sortie manquante — la règle d’auto-clôture rattrape la journée', () => {
  it('1. une entrée sans sortie, écrasée par une entrée du lendemain, est fermée', () => {
    const journees = [
      badge('a1', '2026-10-19T10:42:57Z', 'in'),
      badge('a2', '2026-10-20T09:07:22Z', 'in'),
      badge('a3', '2026-10-20T22:43:27Z', 'out'),
    ]
    const r = resoudrePointagesJournee(journees, '2026-10-19', {
      enableAutoClose: true,
      enterpriseCfg: ENT_AUTO_CLOSE,
      referenceNow: '2026-10-21T12:00:00Z',
    })

    //  La journée n'est plus « en cours » : une sortie (auto-clôturée) existe.
    expect(r.firstIn?.id).toBe('a1')
    expect(r.lastOut).toBeTruthy()
    expect(r.lastOut.is_auto_closed).toBe(true)
  })

  it('2. cette sortie inventée est marquée et jamais comptée comme travaillée', () => {
    const journees = [
      badge('a1', '2026-10-19T10:42:57Z', 'in'),
      badge('a2', '2026-10-20T09:07:22Z', 'in'),
      badge('a3', '2026-10-20T22:43:27Z', 'out'),
    ]
    const r = resoudrePointagesJournee(journees, '2026-10-19', {
      enableAutoClose: true,
      enterpriseCfg: ENT_AUTO_CLOSE,
      referenceNow: '2026-10-21T12:00:00Z',
    })

    //  « On invente, on marque, on n'encaisse pas » : la durée estimée est
    //  isolée dans `totalSecondesPresumes`, le temps travaillé reste à 0.
    expect(r.totalSecondes).toBe(0)
    expect(r.totalSecondesPresumes).toBeGreaterThan(0)
    expect(r.pausesDeductibles).toEqual([])
  })

  it('3. une session encore jeune n’est PAS coupée (garde de nuit en cours)', () => {
    //  Entrée hier soir à 23:30, nouvelle entrée aujourd’hui à 00:30 : la garde
    //  de la veille peut toujours être en train de se terminer. On ne la ferme
    //  pas — seul un délai d'oubli écoulé ou un jour révolu la déclare manquante.
    const journees = [
      badge('a1', '2026-10-19T23:30:00Z', 'in'),
      badge('a2', '2026-10-20T00:30:00Z', 'in'),
    ]
    const r = resoudrePointagesJournee(journees, '2026-10-19', {
      enableAutoClose: true,
      enterpriseCfg: ENT_AUTO_CLOSE,
      referenceNow: '2026-10-20T01:00:00Z',
    })

    expect(r.firstIn?.id).toBe('a1')
    expect(r.lastOut).toBeNull()
  })

  it('4. la session du jour en cours reste « en cours » (aucune invention)', () => {
    const journees = [badge('a1', '2026-10-21T09:00:00Z', 'in')]
    const r = resoudrePointagesJournee(journees, '2026-10-21', {
      enableAutoClose: true,
      enterpriseCfg: ENT_AUTO_CLOSE,
      referenceNow: '2026-10-21T10:00:00Z',
    })

    expect(r.lastOut).toBeNull()
    expect(r.totalSecondes).toBe(0)
    expect(r.totalSecondesPresumes).toBe(0)
  })

  it('5. une journée normalement fermée n’est pas touchée', () => {
    const journees = [
      badge('a1', '2026-10-20T09:07:22Z', 'in'),
      badge('a2', '2026-10-20T22:43:27Z', 'out'),
      badge('a3', '2026-10-21T09:41:36Z', 'in'),
    ]
    const r = resoudrePointagesJournee(journees, '2026-10-20', {
      enableAutoClose: true,
      enterpriseCfg: ENT_AUTO_CLOSE,
      referenceNow: '2026-10-21T12:00:00Z',
    })

    expect(r.lastOut?.id).toBe('a2')
    expect(r.lastOut.is_auto_closed).toBeFalsy()
    expect(r.totalSecondes).toBeGreaterThan(0)
    expect(r.totalSecondesPresumes).toBe(0)
  })

  it('6. sans auto-clôture demandée, aucune sortie n’est inventée', () => {
    const journees = [
      badge('a1', '2026-10-19T10:42:57Z', 'in'),
      badge('a2', '2026-10-20T09:07:22Z', 'in'),
    ]
    const r = resoudrePointagesJournee(journees, '2026-10-19', {
      enterpriseCfg: ENT_AUTO_CLOSE,
      referenceNow: '2026-10-21T12:00:00Z',
    })

    expect(r.lastOut).toBeNull()
    expect(r.totalSecondesPresumes).toBe(0)
  })
})
