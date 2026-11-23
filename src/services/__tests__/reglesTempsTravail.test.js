// src/services/__tests__/reglesTempsTravail.test.js
// ═══════════════════════════════════════════════════════════════════════════
// 🧭 LE SERVICE DES RÈGLES — traducteur, pas calculateur
//
// Ce que ces tests verrouillent :
//   1. la résolution ne fabrique jamais une valeur : « aucune » reste « aucune » ;
//   2. les origines sont nommées sans jamais dire « légal » ;
//   3. les bornes techniques préviennent AVANT l'appel (message clair), sans
//      prétendre remplacer le contrôle serveur ;
//   4. les erreurs de la RPC deviennent des phrases françaises utilisables ;
//   5. l'écriture transmet exactement ce qu'elle a reçu — pas un défaut inventé.
//
// ⚠️ Valeurs FICTIVES. Aucune n'est une obligation légale.
// ═══════════════════════════════════════════════════════════════════════════

import { beforeEach, describe, expect, it, vi } from 'vitest'

const rpc = vi.fn()

vi.mock('../../lib/db', () => ({ db: () => ({ rpc }) }))

const {
  BORNES,
  CLES,
  CLES_PERSONNALISABLES,
  ecrire,
  historique,
  libelleOrigine,
  normaliserHistorique,
  normaliserResolution,
  resoudre,
  validerValeur,
} = await import('../reglesTempsTravail')

beforeEach(() => {
  rpc.mockReset()
})

describe('Résolution', () => {
  it('sans règle, rend « aucune » et une valeur nulle — pas 48 h', async () => {
    rpc.mockResolvedValue({ data: [{ valeur: null, origine: 'aucune' }], error: null })
    const r = await resoudre({ entrepriseId: 'ent', cle: CLES.ALERTE_HEBDO })

    expect(r.valeur).toBeNull()
    expect(r.origine).toBe('aucune')
    expect(r.libelle).toContain('aucune')
  })

  it('transmet l’employé et la date à la RPC, sans les inventer', async () => {
    rpc.mockResolvedValue({ data: [], error: null })
    await resoudre({
      entrepriseId: 'ent',
      employeId: 'emp',
      cle: CLES.ALERTE_HEBDO,
      date: '2026-10-24',
    })

    expect(rpc).toHaveBeenCalledWith('encheck_regle_resolue', {
      p_entreprise: 'ent',
      p_employe: 'emp',
      p_cle: 'alerte_hebdo_heures',
      p_date: '2026-10-24',
    })
  })

  it('convertit le numeric en nombre et garde la trace de qui a décidé', async () => {
    rpc.mockResolvedValue({
      data: [{
        valeur: '38.00',
        origine: 'employe',
        date_effet: '2026-09-01',
        maj_par: 'admin-1',
        maj_le: '2026-09-01T10:00:00Z',
        verrouille: true,
        regle_id: 'regle-1',
      }],
      error: null,
    })
    const r = await resoudre({ entrepriseId: 'ent', employeId: 'emp', cle: CLES.ALERTE_HEBDO })

    expect(r.valeur).toBe(38)
    expect(r.verrouille).toBe(true)
    expect(r.majPar).toBe('admin-1')
    expect(r.dateEffet).toBe('2026-09-01')
  })

  it('une réponse vide ne devient pas une valeur', () => {
    const r = normaliserResolution(undefined)
    expect(r.valeur).toBeNull()
    expect(r.origine).toBe('aucune')
  })
})

describe('Origines : nommées sans jamais promettre une loi', () => {
  it('aucun libellé ne contient « légal »', () => {
    for (const origine of ['employe', 'contrat', 'entreprise', 'aucune', 'inconnue']) {
      expect(libelleOrigine(origine).toLowerCase()).not.toContain('légal')
    }
  })

  it('l’origine personnelle est nommée comme telle', () => {
    expect(libelleOrigine('employe')).toContain('personnelle')
  })
})

describe('Bornes techniques — prévenir avant l’aller-retour', () => {
  it('accepte une valeur dans les bornes', () => {
    expect(validerValeur(CLES.ALERTE_HEBDO, 45).ok).toBe(true)
    expect(validerValeur(CLES.REPOS_MINIMUM, 11).ok).toBe(true)
  })

  it('accepte « non configuré » (null explicite)', () => {
    expect(validerValeur(CLES.ALERTE_HEBDO, null).ok).toBe(true)
  })

  it('refuse zéro, le négatif et le non-nombre', () => {
    for (const valeur of [0, -3, 'abc', NaN]) {
      const verdict = validerValeur(CLES.ALERTE_HEBDO, valeur)
      expect(verdict.ok).toBe(false)
      expect(verdict.message).toContain('nulle ou négative')
    }
  })

  it('refuse un repos de plus de 24 h et un seuil de plus de 168 h', () => {
    expect(validerValeur(CLES.REPOS_MINIMUM, 25).ok).toBe(false)
    expect(validerValeur(CLES.ALERTE_HEBDO, 169).ok).toBe(false)
    expect(BORNES[CLES.ALERTE_HEBDO].max).toBe(168)
  })

  it('les clés non personnalisables n’ont pas de borne : elles ne s’écrivent pas par employé', () => {
    expect(CLES_PERSONNALISABLES).not.toContain(CLES.DECLENCHEMENT_PAIE_HEBDO)
    expect(CLES_PERSONNALISABLES).not.toContain(CLES.PLAFOND_LEGAL)
    expect(CLES_PERSONNALISABLES).toHaveLength(3)
  })
})

describe('Écriture', () => {
  it('transmet la valeur et le verrou tels quels', async () => {
    rpc.mockResolvedValue({ data: 'regle-9', error: null })
    const id = await ecrire({
      entrepriseId: 'ent',
      employeId: 'emp',
      cle: CLES.ALERTE_HEBDO,
      valeur: 38,
      dateEffet: '2026-10-01',
      verrouille: true,
    })

    expect(id).toBe('regle-9')
    expect(rpc).toHaveBeenCalledWith('encheck_regle_ecrire', {
      p_entreprise: 'ent',
      p_employe: 'emp',
      p_cle: 'alerte_hebdo_heures',
      p_valeur: 38,
      p_date_effet: '2026-10-01',
      p_verrouille: true,
    })
  })

  it('n’appelle même pas la base quand la borne est dépassée', async () => {
    await expect(
      ecrire({ entrepriseId: 'ent', cle: CLES.REPOS_MINIMUM, valeur: 25 }),
    ).rejects.toThrow(/borne technique/)
    expect(rpc).not.toHaveBeenCalled()
  })

  it('traduit un refus de verrou en français', async () => {
    rpc.mockResolvedValue({
      data: null,
      error: { message: 'valeur personnelle verrouillee : seul un super-administrateur peut lever le verrou' },
    })
    await expect(
      ecrire({ entrepriseId: 'ent', employeId: 'emp', cle: CLES.ALERTE_HEBDO, valeur: 39 }),
    ).rejects.toThrow(/verrouillée : seul un super-administrateur/)
  })

  it('traduit un refus d’accès sans révéler la structure de la base', async () => {
    rpc.mockResolvedValue({ data: null, error: { message: 'acces refuse a cette entreprise' } })
    await expect(
      ecrire({ entrepriseId: 'ent', cle: CLES.ALERTE_HEBDO, valeur: 45 }),
    ).rejects.toThrow('Accès refusé à cette entreprise.')
  })
})

describe('Historique', () => {
  it('rend les versions dans l’ordre fourni par le serveur, avec le chaînage', async () => {
    rpc.mockResolvedValue({
      data: [
        { id: 'v2', cle: 'alerte_hebdo_heures', valeur: '46.00', date_effet: '2026-10-01', remplace_id: 'v1', maj_le: '2026-10-01T09:00:00Z' },
        { id: 'v1', cle: 'alerte_hebdo_heures', valeur: '45.00', date_effet: '2026-09-01', remplace_id: null, maj_le: '2026-09-01T09:00:00Z' },
      ],
      error: null,
    })
    const versions = await historique({ entrepriseId: 'ent', cle: CLES.ALERTE_HEBDO })

    expect(versions).toHaveLength(2)
    expect(versions[0].valeur).toBe(46)
    expect(versions[0].remplaceId).toBe('v1')
    expect(versions[1].valeur).toBe(45)
  })

  it('une ligne vide reste vide : rien n’est reconstitué', () => {
    expect(normaliserHistorique([])).toEqual([])
  })
})
