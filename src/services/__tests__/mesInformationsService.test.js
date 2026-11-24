// src/services/__tests__/mesInformationsService.test.js
// ═══════════════════════════════════════════════════════════════════════════
// 👁️ « CE QU'ON M'A DIT », CÔTÉ CLIENT — lire, compter, marquer sans mentir
//
// Trois choses que la relecture ne prouve pas :
//   1. la RPC de lecture est appelée SANS identifiant : le destinataire vient de
//      la session, pas de l'écran ;
//   2. un identifiant vide est refusé AVANT l'appel réseau ;
//   3. `consulteLe` nul reste nul : jamais une date inventée pour faire joli.
// ═══════════════════════════════════════════════════════════════════════════

import { beforeEach, describe, expect, it, vi } from 'vitest'

const rpc = vi.fn()
vi.mock('../../lib/db', () => ({ db: () => ({ rpc }) }))

const {
  EVENEMENTS_INFORMATION,
  libelleEvenement,
  normaliserMesInformations,
  compterAConsulter,
  mesInformations,
  marquerConsultee,
} = await import('../mesInformations')

beforeEach(() => rpc.mockReset())

describe('Normaliser ce qu’on m’a dit', () => {
  it('le texte émis est repris tel quel — il ne se recalcule pas', () => {
    const [i] = normaliserMesInformations([
      {
        id: 'x',
        cle: 'alerte_hebdo_heures',
        evenement: 'valeur_personnelle_posee',
        contenu: 'Phrase figée le 1ᵉʳ octobre.',
        consulte_le: null,
      },
    ])
    expect(i.contenu).toBe('Phrase figée le 1ᵉʳ octobre.')
  })

  it('non consultée : l’état est écrit en MOTS, jamais une couleur', () => {
    const [i] = normaliserMesInformations([{ id: 'x', evenement: 'valeur_personnelle_posee' }])
    expect(i.etat).toBe('a_consulter')
    expect(i.etatLibelle).toBe('À consulter')
    expect(i.consulteLe).toBeNull()
  })

  it('consultée : la date de la base est reprise, et l’état change de mot', () => {
    const [i] = normaliserMesInformations([
      { id: 'x', evenement: 'valeur_personnelle_retiree', consulte_le: '2026-10-20T09:00:00Z' },
    ])
    expect(i.etat).toBe('consultee')
    expect(i.etatLibelle).toBe('Consultée')
    expect(i.consulteLe).toBe('2026-10-20T09:00:00Z')
  })

  it('les quatre événements ont chacun une phrase française', () => {
    expect(Object.keys(EVENEMENTS_INFORMATION)).toEqual([
      'valeur_personnelle_posee',
      'valeur_personnelle_verrouillee',
      'valeur_personnelle_retiree',
      'reglage_personnel_conserve',
    ])
  })

  it('un événement inconnu rend le code plutôt qu’une phrase inventée', () => {
    expect(libelleEvenement('autre_chose')).toBe('autre_chose')
    expect(libelleEvenement(null)).toBe('Information')
  })

  it('une valeur nulle reste nulle : pas de 0 h inventé', () => {
    const [i] = normaliserMesInformations([{ id: 'x', valeur_avant: null, valeur_apres: '40' }])
    expect(i.valeurAvant).toBeNull()
    expect(i.valeurApres).toBe(40)
  })

  it('une réponse qui n’est pas une liste ne fait pas planter l’écran', () => {
    expect(normaliserMesInformations(null)).toEqual([])
    expect(normaliserMesInformations({})).toEqual([])
  })
})

describe('Compter ce qui reste à lire', () => {
  it('compte les non-consultées seulement', () => {
    expect(
      compterAConsulter([
        { id: 1, consulteLe: null },
        { id: 2, consulteLe: '2026-10-20T09:00:00Z' },
        { id: 3, consulteLe: null },
      ]),
    ).toBe(2)
  })

  it('liste vide ou absente : zéro, pas une erreur', () => {
    expect(compterAConsulter([])).toBe(0)
    expect(compterAConsulter(null)).toBe(0)
  })
})

describe('Appeler la base', () => {
  it('la lecture ne transmet AUCUN identifiant', async () => {
    rpc.mockResolvedValue({ data: [], error: null })
    await mesInformations()

    expect(rpc).toHaveBeenCalledTimes(1)
    const [nom, args] = rpc.mock.calls[0]
    expect(nom).toBe('encheck_informations_employe')
    expect(args).toBeUndefined()
  })

  it('la lecture rend des objets normalisés', async () => {
    rpc.mockResolvedValue({
      data: [{ id: 'x', evenement: 'valeur_personnelle_posee', contenu: 'Dit.', consulte_le: null }],
      error: null,
    })
    const lignes = await mesInformations()
    expect(lignes[0].etatLibelle).toBe('À consulter')
  })

  it('le marquage passe l’identifiant sous `p_information`', async () => {
    rpc.mockResolvedValue({ data: '2026-10-20T09:00:00Z', error: null })
    const d = await marquerConsultee('abc')
    expect(rpc).toHaveBeenCalledWith('encheck_information_consultee', { p_information: 'abc' })
    expect(d).toBe('2026-10-20T09:00:00Z')
  })

  it('un identifiant vide est refusé AVANT l’appel réseau', async () => {
    await expect(marquerConsultee(null)).rejects.toThrow(/Information manquante/)
    await expect(marquerConsultee('')).rejects.toThrow(/Information manquante/)
    expect(rpc).not.toHaveBeenCalled()
  })

  it('« aucune fiche employé » devient une phrase actionnable', async () => {
    rpc.mockResolvedValue({ data: null, error: { message: 'aucune fiche employe pour ce compte' } })
    await expect(mesInformations()).rejects.toThrow(/demandez à votre administration/)
  })

  it('« ne vous est pas adressée » n’est pas traduit en erreur technique', async () => {
    rpc.mockResolvedValue({ data: null, error: { message: 'cette information ne vous est pas adressee' } })
    await expect(marquerConsultee('abc')).rejects.toThrow(/ne vous est pas adressée/)
  })

  it('une information disparue est dite, pas masquée', async () => {
    rpc.mockResolvedValue({ data: null, error: { message: 'information inconnue' } })
    await expect(marquerConsultee('abc')).rejects.toThrow(/n’existe plus/)
  })

  it('un serveur sans la migration rend un message, pas une page blanche', async () => {
    rpc.mockResolvedValue({ data: null, error: { code: 'PGRST202', message: 'not found' } })
    await expect(mesInformations()).rejects.toThrow(/pas encore ouvert/)
  })
})
