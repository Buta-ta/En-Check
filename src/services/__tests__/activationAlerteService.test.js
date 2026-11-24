// src/services/__tests__/activationAlerteService.test.js
// ═══════════════════════════════════════════════════════════════════════════
// ⏰ L'ACTIVATION DE L'ALERTE, CÔTÉ CLIENT — traduire sans mentir
//
// Trois choses que la relecture ne prouve pas :
//   1. « jamais décidée » n'est pas « désactivée » : `active` vaut `null`, pas
//      `false` — sinon l'écran prête un acte à personne ;
//   2. un état inconnu retombe sur « jamais décidée », jamais sur « activée » ;
//   3. l'écriture passe par la valeur 1 / 0, et refuse tout ce qui n'est pas
//      un booléen AVANT l'appel.
// ═══════════════════════════════════════════════════════════════════════════

import { beforeEach, describe, expect, it, vi } from 'vitest'

const rpc = vi.fn()
vi.mock('../../lib/db', () => ({ db: () => ({ rpc }) }))

const {
  ETATS_ACTIVATION,
  activationAlerte,
  ecrireActivationAlerte,
  normaliserActivation,
} = await import('../reglesTempsTravail')

beforeEach(() => rpc.mockReset())

describe('Normaliser une activation', () => {
  it('« jamais décidée » : active vaut null, jamais false', () => {
    const a = normaliserActivation({
      active: null,
      etat: 'jamais_decidee',
      depuis: null,
      maj_par: null,
      maj_le: null,
      regle_id: null,
    })
    expect(a.active).toBeNull()
    expect(a.etat).toBe('jamais_decidee')
    expect(a.libelle).toBe('Jamais décidée')
  })

  it('une ligne absente ne fabrique pas une décision', () => {
    const a = normaliserActivation(null)
    expect(a.active).toBeNull()
    expect(a.etat).toBe('jamais_decidee')
    expect(a.dateEffet).toBeNull()
  })

  it('activée : l’état, le libellé et la date d’effet sont rendus', () => {
    const a = normaliserActivation({
      active: true, etat: 'activee', depuis: '2026-11-03', maj_par: 'admin-1', maj_le: '2026-11-03T08:00:00Z', regle_id: 'r1',
    })
    expect(a.active).toBe(true)
    expect(a.etat).toBe('activee')
    expect(a.libelle).toBe('Activée')
    expect(a.dateEffet).toBe('2026-11-03')
    expect(a.majPar).toBe('admin-1')
  })

  it('désactivée : false est une décision, pas une absence', () => {
    const a = normaliserActivation({ active: false, etat: 'desactivee', depuis: '2026-11-03' })
    expect(a.active).toBe(false)
    expect(a.etat).toBe('desactivee')
    expect(a.libelle).toBe('Désactivée')
  })

  it('un état inconnu retombe sur « jamais décidée », jamais sur « activée »', () => {
    const a = normaliserActivation({ active: true, etat: 'peut_etre' })
    expect(a.etat).toBe('jamais_decidee')
    expect(a.active).toBeNull()
  })

  it('un état contradictoire avec le booléen ne devient pas un mensonge', () => {
    //  « activee » annoncé avec `active: false` : on ne tranche pas, on avoue.
    const a = normaliserActivation({ active: false, etat: 'activee' })
    expect(a.active).toBeNull()
    expect(a.etat).toBe('jamais_decidee')
  })

  it('les trois états sont écrits en mots', () => {
    expect(ETATS_ACTIVATION).toEqual({
      activee: 'Activée',
      desactivee: 'Désactivée',
      jamais_decidee: 'Jamais décidée',
    })
  })
})

describe('Lire l’activation', () => {
  it('la RPC reçoit l’entreprise et la date, rien d’autre', async () => {
    rpc.mockResolvedValue({ data: [{ active: true, etat: 'activee', depuis: '2026-11-03' }], error: null })
    await activationAlerte({ entrepriseId: 'ent-1', date: '2026-11-15' })

    expect(rpc).toHaveBeenCalledWith('encheck_activation_alerte', {
      p_entreprise: 'ent-1',
      p_date: '2026-11-15',
    })
  })

  it('sans date, on n’en invente pas : `null` laisse la base décider', async () => {
    rpc.mockResolvedValue({ data: [], error: null })
    await activationAlerte({ entrepriseId: 'ent-1' })
    expect(rpc.mock.calls[0][1].p_date).toBeNull()
  })

  it('une réponse vide rend « jamais décidée »', async () => {
    rpc.mockResolvedValue({ data: [], error: null })
    const a = await activationAlerte({ entrepriseId: 'ent-1' })
    expect(a.etat).toBe('jamais_decidee')
    expect(a.active).toBeNull()
  })

  it('un refus d’accès devient une phrase française', async () => {
    rpc.mockResolvedValue({ data: null, error: { message: 'acces refuse a cette entreprise' } })
    await expect(activationAlerte({ entrepriseId: 'ent-1' })).rejects.toThrow(/Accès refusé/)
  })

  it('un serveur sans la migration est dit, pas masqué', async () => {
    rpc.mockResolvedValue({ data: null, error: { code: 'PGRST202', message: 'nope' } })
    await expect(activationAlerte({ entrepriseId: 'ent-1' })).rejects.toThrow(/pas encore installée/)
  })
})

describe('Écrire l’activation — une version, pas un booléen écrasé', () => {
  it('activée s’écrit 1, avec la clé dédiée et sans employé', async () => {
    rpc.mockResolvedValue({ data: 'regle-1', error: null })
    const id = await ecrireActivationAlerte({ entrepriseId: 'ent-1', actif: true, dateEffet: '2026-11-03' })

    expect(rpc).toHaveBeenCalledWith('encheck_regle_ecrire', {
      p_entreprise: 'ent-1',
      p_employe: null,
      p_cle: 'alerte_hebdo_activee',
      p_valeur: 1,
      p_date_effet: '2026-11-03',
      p_verrouille: false,
    })
    expect(id).toBe('regle-1')
  })

  it('désactivée s’écrit 0 — et 0 n’est pas « rien »', async () => {
    rpc.mockResolvedValue({ data: 'regle-2', error: null })
    await ecrireActivationAlerte({ entrepriseId: 'ent-1', actif: false })
    expect(rpc.mock.calls[0][1].p_valeur).toBe(0)
  })

  it('un non-booléen est refusé AVANT l’appel : « peut-être » n’est pas une décision', async () => {
    await expect(ecrireActivationAlerte({ entrepriseId: 'ent-1', actif: null })).rejects.toThrow(/booléen/)
    await expect(ecrireActivationAlerte({ entrepriseId: 'ent-1', actif: 'oui' })).rejects.toThrow(/booléen/)
    await expect(ecrireActivationAlerte({ entrepriseId: 'ent-1', actif: 0 })).rejects.toThrow(/booléen/)
    expect(rpc).not.toHaveBeenCalled()
  })

  it('le verrou est explicitement refusé : une activation n’est pas une valeur personnelle', async () => {
    rpc.mockResolvedValue({ data: 'regle-3', error: null })
    await ecrireActivationAlerte({ entrepriseId: 'ent-1', actif: true })
    expect(rpc.mock.calls[0][1].p_verrouille).toBe(false)
  })

  it('une erreur de bornes remonte en français', async () => {
    rpc.mockResolvedValue({ data: null, error: { message: 'valeur invalide : une valeur nulle ou negative ne regle rien' } })
    await expect(ecrireActivationAlerte({ entrepriseId: 'ent-1', actif: true })).rejects.toThrow(/invvalide|invalide/i)
  })
})
