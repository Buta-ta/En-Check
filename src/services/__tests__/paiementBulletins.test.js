// ═══════════════════════════════════════════════════════════
// 💳 PAYÉ N'EST PAS ENVOYÉ
//
// Ce que ces tests gardent :
//   ① une fiche payée gagne sur une fiche seulement remise ;
//   ② à rang égal, la période la plus récente gagne ;
//   ③ la marque disparaît si la base ne connaît pas encore les
//     colonnes de paiement — sans casser la lecture des bulletins ;
//   ④ on n'écrit jamais un paiement incomplet.
// ═══════════════════════════════════════════════════════════

import { describe, it, expect, beforeEach, vi } from 'vitest'

const faux = {
  lignes: [],
  colonnesPayees: true,
  misesAJour: [],
  vider() {
    faux.lignes = []
    faux.colonnesPayees = true
    faux.misesAJour = []
  },
}

vi.mock('../../lib/supabase', () => {
  const construire = () => {
    let colonnes = ''
    const requete = {
      select: (c) => { colonnes = c; return requete },
      eq: () => requete,
      lte: () => requete,
      gte: () => requete,
      in: () => requete,
      or: () => requete,
      update: (valeurs) => {
        faux.misesAJour.push(valeurs)
        return requete
      },
      order: () => {
        if (!faux.colonnesPayees && colonnes.includes('paid_at')) {
          return Promise.resolve({
            data: null,
            error: { code: '42703', message: 'column "paid_at" does not exist' },
          })
        }
        if (faux.misesAJour.length > 0) return Promise.resolve({ data: null, error: null })
        return Promise.resolve({ data: faux.lignes, error: null })
      },
      then: (resolve) => resolve({ data: null, error: null }),
    }
    return requete
  }
  return { supabase: { from: () => construire() } }
})

const {
  MOYENS_PAIEMENT,
  libelleMoyen,
  chargerBulletinsPeriode,
  marquerPaye,
  resumerPaieParEmploye,
} = await import('../paiementBulletins.js')

beforeEach(() => faux.vider())

const bulletin = (over = {}) => ({
  employee_id: 'e1',
  period_start: '2026-09-01',
  period_end: '2026-09-30',
  gross_salary: 250000,
  net_salary: 210000,
  sent_at: '2026-09-30T10:00:00+00:00',
  paid_at: null,
  payment_method: null,
  payment_reference: null,
  status: 'sent',
  is_deleted: false,
  ...over,
})

describe('1. les moyens de paiement', () => {
  it('en propose cinq, en français', () => {
    expect(MOYENS_PAIEMENT.map(m => m.cle)).toEqual([
      'especes', 'mobile_money', 'virement', 'cheque', 'autre',
    ])
    expect(libelleMoyen('mobile_money')).toBe('Mobile Money')
    expect(libelleMoyen('inconnu')).toBe('inconnu')
    expect(libelleMoyen(null)).toBe('—')
  })
})

describe('2. l’état de paie par employé', () => {
  it('distingue calculé, émis et payé', () => {
    const map = resumerPaieParEmploye([
      bulletin({ employee_id: 'calcule', sent_at: null }),
      bulletin({ employee_id: 'emis' }),
      bulletin({ employee_id: 'paye', paid_at: '2026-10-02T09:00:00+00:00', payment_method: 'virement' }),
    ])
    expect(map.get('calcule').statut).toBe('calcule')
    expect(map.get('emis').statut).toBe('emis')
    expect(map.get('paye').statut).toBe('paye')
    expect(map.get('paye').moyen).toBe('virement')
    expect(map.get('paye').payeLe).toBe('2026-10-02T09:00:00+00:00')
  })

  it('fait gagner le paiement sur l’envoi, même sur une période plus ancienne', () => {
    const map = resumerPaieParEmploye([
      bulletin({ employee_id: 'e1', period_start: '2026-09-01', period_end: '2026-09-30' }),
      bulletin({
        employee_id: 'e1',
        period_start: '2026-08-01',
        period_end: '2026-08-31',
        paid_at: '2026-09-01T08:00:00+00:00',
      }),
    ])
    expect(map.get('e1').statut).toBe('paye')
    expect(map.get('e1').periodEnd).toBe('2026-08-31')
  })

  it('garde la période la plus récente à rang égal', () => {
    const map = resumerPaieParEmploye([
      bulletin({ employee_id: 'e1', period_start: '2026-08-01', period_end: '2026-08-31' }),
      bulletin({ employee_id: 'e1', period_start: '2026-09-01', period_end: '2026-09-30' }),
    ])
    expect(map.get('e1').periodEnd).toBe('2026-09-30')
  })

  it('ignore les fiches supprimées et les lignes vides', () => {
    const map = resumerPaieParEmploye([
      bulletin({ employee_id: 'e1', is_deleted: true }),
      null,
      bulletin({ employee_id: 'e2' }),
    ])
    expect(map.has('e1')).toBe(false)
    expect(map.get('e2').statut).toBe('emis')
  })
})

describe('3. lire les bulletins d’une période', () => {
  it('lit les colonnes de paiement quand elles existent', async () => {
    faux.lignes = [bulletin()]
    const { bulletins, paiementConnu } = await chargerBulletinsPeriode({
      enterpriseId: 'ent-1',
      dateDebut: '2026-09-01',
      dateFin: '2026-09-30',
      employeeIds: ['e1'],
    })
    expect(paiementConnu).toBe(true)
    expect(bulletins).toHaveLength(1)
  })

  it('retombe sur les colonnes historiques sans rien inventer', async () => {
    faux.colonnesPayees = false
    faux.lignes = [bulletin({ paid_at: undefined, payment_method: undefined })]
    const { bulletins, paiementConnu } = await chargerBulletinsPeriode({
      enterpriseId: 'ent-1',
      dateDebut: '2026-09-01',
      dateFin: '2026-09-30',
    })
    expect(paiementConnu).toBe(false)
    expect(bulletins).toHaveLength(1)
    const map = resumerPaieParEmploye(bulletins)
    expect(map.get('e1').statut).toBe('emis')
  })
})

describe('4. marquer un paiement', () => {
  it('refuse un bulletin incomplet', async () => {
    const r = await marquerPaye({ employeeId: 'e1' })
    expect(r.ok).toBe(false)
    expect(r.message).toMatch(/incomplet/i)
  })

  it('refuse un moyen de paiement inconnu', async () => {
    const r = await marquerPaye({
      enterpriseId: 'ent-1',
      employeeId: 'e1',
      periodStart: '2026-09-01',
      periodEnd: '2026-09-30',
      methode: 'bitcoin',
    })
    expect(r.ok).toBe(false)
    expect(r.message).toMatch(/moyen de paiement/i)
    expect(faux.misesAJour).toHaveLength(0)
  })

  it('écrit la date, le moyen et la référence', async () => {
    const r = await marquerPaye({
      enterpriseId: 'ent-1',
      employeeId: 'e1',
      periodStart: '2026-09-01',
      periodEnd: '2026-09-30',
      paidAt: '2026-10-02T12:00:00.000Z',
      methode: 'mobile_money',
      reference: ' MM-1029 ',
      adminId: 'admin-1',
    })
    expect(r.ok).toBe(true)
    expect(faux.misesAJour).toHaveLength(1)
    expect(faux.misesAJour[0]).toEqual({
      paid_at: '2026-10-02T12:00:00.000Z',
      paid_by: 'admin-1',
      payment_method: 'mobile_money',
      payment_reference: 'MM-1029',
    })
  })
})
