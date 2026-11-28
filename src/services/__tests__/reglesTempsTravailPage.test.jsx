// @vitest-environment jsdom
// src/services/__tests__/reglesTempsTravailPage.test.jsx
// ═══════════════════════════════════════════════════════════════════════════
// 👤 LA FICHE EMPLOYÉ, RENDUE ET CLICQUÉE — ce que la relecture ne prouve pas
//
//   1. les trois états s'écrivent en MOTS, clé par clé ;
//   2. « aucune valeur » affiche « non configuré » et « contrôle indisponible »,
//      jamais « 0 h » ni une coche verte ;
//   3. ouvrir un réglage n'écrit RIEN : l'aperçu vient avant ;
//   4. un verrou désactive l'enregistrement, et le dit ;
//   5. le retour à l'entreprise demande une confirmation et n'emprunte pas le
//      chemin d'une écriture ordinaire ;
//   6. les informations enregistrées affichent le texte ÉMIS, ou disent qu'il
//      n'y en a aucune.
// ═══════════════════════════════════════════════════════════════════════════

import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import ReglesTempsTravail from '../../components/ReglesTempsTravail'

const mocks = vi.hoisted(() => ({
  resoudre: vi.fn(),
  ecrire: vi.fn(),
  revenirEntreprise: vi.fn(),
  informations: vi.fn(),
}))

vi.mock('../reglesTempsTravail', async () => {
  const reel = await vi.importActual('../reglesTempsTravail')
  return {
    validerValeur: reel.validerValeur,
    resoudre: (...a) => mocks.resoudre(...a),
    ecrire: (...a) => mocks.ecrire(...a),
    revenirEntreprise: (...a) => mocks.revenirEntreprise(...a),
    informations: (...a) => mocks.informations(...a),
  }
})

let host
let root

beforeEach(() => {
  mocks.resoudre.mockReset()
  mocks.ecrire.mockReset()
  mocks.revenirEntreprise.mockReset()
  mocks.informations.mockReset()

  mocks.resoudre.mockResolvedValue({
    valeur: 45,
    origine: 'entreprise',
    dateEffet: '2026-09-01',
    verrouille: false,
  })
  mocks.ecrire.mockResolvedValue('nouvelle-version')
  mocks.revenirEntreprise.mockResolvedValue('version-abandon')
  mocks.informations.mockResolvedValue([])

  host = document.createElement('div')
  document.body.append(host)
  root = createRoot(host)
})

afterEach(async () => {
  await act(async () => root.unmount())
  host.remove()
  vi.restoreAllMocks()
})

async function monter(props = {}) {
  await act(async () => {
    root.render(
      <MemoryRouter>
        <ReglesTempsTravail
          entrepriseId="ent-a"
          employeId="emp-1"
          nomEmploye="Emma BAYLE"
          //  ⚠️ Le fuseau de l'ENTREPRISE est désormais requis pour calculer
          //  la date d'effet (décision B0-a). Sans lui, l'enregistrement est
          //  REFUSÉ : c'est le comportement voulu, et un test dédié le vérifie.
          fuseau="Africa/Porto-Novo"
          {...props}
        />
      </MemoryRouter>,
    )
  })
}

const bouton = (texte) =>
  [...host.querySelectorAll('button')].find((b) => b.textContent.trim() === texte)

//  Depuis le 24/11/2026, les règles vivent dans une MODALE : la fiche ne porte
//  plus qu'une bande. On ouvre donc la modale comme le ferait un humain — le
//  reste des assertions ne change pas : c'est le même contenu, au même endroit
//  pour la personne qui lit.
async function ouvrirRegles(props = {}) {
  await monter(props)
  await act(async () => bouton('Voir les règles').click())
}

describe('La bande, et la modale qui la complète', () => {
  it('la fiche ne porte plus le registre : la bande seule, avant le clic', async () => {
    await monter()
    //  Ce que le fondateur a demandé : plus de bloc imposant en haut de fiche.
    expect(host.querySelector('.rtt-bande')).not.toBeNull()
    expect(host.querySelector('.rtt-modale')).toBeNull()
    expect(host.textContent).not.toContain('Règle de l’entreprise')
    expect(host.querySelectorAll('.rtt-ligne')).toHaveLength(0)
  })

  it('la modale est un vrai dialogue : rôle, aria-modal, Échap la referme', async () => {
    await ouvrirRegles()

    const modale = host.querySelector('.rtt-modale')
    expect(modale.getAttribute('role')).toBe('dialog')
    expect(modale.getAttribute('aria-modal')).toBe('true')
    expect(modale.getAttribute('aria-labelledby')).toBe('rtt-titre')

    await act(async () => {
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
    })
    expect(host.querySelector('.rtt-modale')).toBeNull()
    //  La bande, elle, reste : on n'a rien perdu de la fiche.
    expect(host.querySelector('.rtt-bande')).not.toBeNull()
  })
})

describe('Les trois états, en mots', () => {

  it('suit l’entreprise par défaut, avec sa date', async () => {
    await ouvrirRegles()
    expect(host.textContent).toContain('Règle de l’entreprise')
    expect(host.textContent).toContain('depuis le 1 sept. 2026')
    expect(host.textContent).toContain('45 h')
  })

  it('une valeur nominative se dit personnelle, et datée', async () => {
    mocks.resoudre.mockImplementation(async ({ cle }) =>
      cle === 'alerte_hebdo_heures'
        ? { valeur: 52, origine: 'employe', dateEffet: '2026-11-03', verrouille: false }
        : { valeur: 45, origine: 'entreprise', dateEffet: '2026-09-01', verrouille: false },
    )
    await ouvrirRegles()
    expect(host.textContent).toContain('Réglage personnel')
    expect(host.textContent).toContain('décidé le 3 nov. 2026')
    expect(host.textContent).toContain('52 h')
  })

  it('un verrou se dit verrouillé, pas « décidé »', async () => {
    mocks.resoudre.mockImplementation(async () => ({
      valeur: 38,
      origine: 'employe',
      dateEffet: '2026-10-01',
      verrouille: true,
    }))
    await ouvrirRegles()
    expect(host.textContent).toContain('Réglage personnel · verrouillé')
  })

  it('sans valeur : « non configuré » et « contrôle indisponible », jamais 0 h', async () => {
    mocks.resoudre.mockResolvedValue({
      valeur: null,
      origine: 'aucune',
      dateEffet: null,
      verrouille: false,
    })
    await ouvrirRegles()
    expect(host.textContent).toContain('Aucune valeur')
    expect(host.textContent).toContain('non configuré')
    expect(host.textContent).toContain('contrôle indisponible')
    expect(host.textContent).not.toMatch(/\b0 h\b/)
  })
})

describe('L’aperçu vient avant l’écriture', () => {
  it('ouvrir un réglage n’écrit RIEN et montre l’impact', async () => {
    await ouvrirRegles()
    await act(async () => bouton('Régler').click())

    expect(mocks.ecrire).not.toHaveBeenCalled()
    expect(host.textContent).toContain('Aperçu d’impact')
    expect(host.textContent).toContain('Personnes concernées')
    expect(host.textContent).toContain('Nouvelle valeur')
  })

  it('enregistrer transmet la clé, l’employé et la valeur saisie', async () => {
    await ouvrirRegles()
    //  La deuxième ligne : le seuil d'alerte hebdomadaire (168 h au plus).
    await act(async () => host.querySelectorAll('.rtt-action')[1].click())

    const champ = host.querySelector('.rtt-champ input[type="number"]')
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set
    await act(async () => {
      setter.call(champ, '52')
      champ.dispatchEvent(new Event('input', { bubbles: true }))
    })

    await act(async () => bouton('Enregistrer').click())

    expect(mocks.ecrire).toHaveBeenCalledTimes(1)
    const appel = mocks.ecrire.mock.calls[0][0]
    expect(appel).toMatchObject({
      entrepriseId: 'ent-a',
      employeId: 'emp-1',
      cle: 'alerte_hebdo_heures',
      valeur: 52,
      verrouille: false,
    })
    expect(appel.dateEffet).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    expect(mocks.revenirEntreprise).not.toHaveBeenCalled()
  })

  it('une valeur hors bornes est refusée AVANT l’appel, avec un motif', async () => {
    await ouvrirRegles()
    await act(async () => bouton('Régler').click())

    const champ = host.querySelector('.rtt-champ input[type="number"]')
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set
    await act(async () => {
      setter.call(champ, '30')
      champ.dispatchEvent(new Event('input', { bubbles: true }))
    })
    await act(async () => bouton('Enregistrer').click())

    expect(mocks.ecrire).not.toHaveBeenCalled()
    expect(host.textContent).toContain('dépasse la borne technique de 24 h')
  })

  it('un verrou bloque l’enregistrement et le dit', async () => {
    mocks.resoudre.mockResolvedValue({
      valeur: 38,
      origine: 'employe',
      dateEffet: '2026-10-01',
      verrouille: true,
    })
    await ouvrirRegles()
    await act(async () => bouton('Régler').click())

    expect(host.textContent).toContain('Cette valeur est verrouillée')
    expect(bouton('Enregistrer').disabled).toBe(true)
  })

  it('un super-administrateur peut écrire malgré le verrou', async () => {
    mocks.resoudre.mockResolvedValue({
      valeur: 38,
      origine: 'employe',
      dateEffet: '2026-10-01',
      verrouille: true,
    })
    await ouvrirRegles({ superAdmin: true })
    await act(async () => bouton('Régler').click())

    expect(bouton('Enregistrer').disabled).toBe(false)
    expect(host.textContent).toContain('Verrouiller ce réglage')
  })
})

describe('Le retour à la règle de l’entreprise est un acte distinct', () => {
  it('demande une confirmation, puis appelle le retour — pas l’écriture ordinaire', async () => {
    mocks.resoudre.mockImplementation(async ({ cle }) =>
      cle === 'alerte_hebdo_heures'
        ? { valeur: 52, origine: 'employe', dateEffet: '2026-11-03', verrouille: false }
        : { valeur: 45, origine: 'entreprise', dateEffet: '2026-09-01', verrouille: false },
    )
    await ouvrirRegles()

    //  La deuxième ligne est la valeur personnelle.
    await act(async () => host.querySelectorAll('.rtt-action')[1].click())
    await act(async () => bouton('Revenir à la règle de l’entreprise').click())

    expect(mocks.revenirEntreprise).not.toHaveBeenCalled()
    expect(host.textContent).toContain('reste dans l’historique')

    await act(async () => bouton('Confirmer le retour').click())

    expect(mocks.revenirEntreprise).toHaveBeenCalledTimes(1)
    expect(mocks.revenirEntreprise.mock.calls[0][0]).toMatchObject({
      entrepriseId: 'ent-a',
      employeId: 'emp-1',
      cle: 'alerte_hebdo_heures',
    })
    expect(mocks.ecrire).not.toHaveBeenCalled()
  })

  it('ne propose pas le retour sur une règle d’entreprise', async () => {
    await ouvrirRegles()
    await act(async () => bouton('Régler').click())
    expect(bouton('Revenir à la règle de l’entreprise')).toBeUndefined()
  })
})

describe('Les informations enregistrées', () => {
  it('affiche le texte émis, sa date et le fait qu’il n’a pas été consulté', async () => {
    mocks.informations.mockResolvedValue([
      {
        id: 'i1',
        cle: 'alerte_hebdo_heures',
        evenement: 'valeur_personnelle_posee',
        contenu: 'Le réglage personnel « seuil d’alerte hebdomadaire » est fixé à 52 h à compter du 03/11/2026.',
        emisLe: '2026-11-03T09:00:00Z',
        consulteLe: null,
      },
    ])
    await ouvrirRegles()

    expect(host.textContent).toContain('Informations enregistrées')
    expect(host.textContent).toContain('est fixé à 52 h')
    expect(host.textContent).toContain('non consultée')
  })

  it('sans information, le dit — et n’en invente pas une', async () => {
    await ouvrirRegles()
    expect(host.textContent).toContain('Aucune information enregistrée pour cette personne.')
    expect(host.querySelectorAll('.rtt-table tbody tr')).toHaveLength(0)
  })

  it('si le journal est indisponible, les trois états restent lisibles — et le manque est dit', async () => {
    mocks.informations.mockRejectedValue(new Error('Cette fonction n’est pas encore installée sur ce serveur.'))
    await ouvrirRegles()

    expect(host.textContent).toContain('Règle de l’entreprise')
    expect(host.textContent).toContain('Cette fonction n’est pas encore installée sur ce serveur.')
    expect(host.textContent).not.toContain('Aucune information enregistrée')
  })

  it('une erreur de service s’affiche en clair, et l’écran ne fait pas semblant', async () => {
    mocks.resoudre.mockRejectedValue(new Error('Cette fonction n’est pas encore installée sur ce serveur.'))
    await ouvrirRegles()

    expect(host.textContent).toContain('Cette fonction n’est pas encore installée sur ce serveur.')
    expect(host.textContent).not.toContain('Règle de l’entreprise')
  })

  it('sans fuseau d’entreprise, l’enregistrement est REFUSÉ — jamais daté en UTC', async () => {
    //  ⚠️ Décision B0-a : la date d'effet se calcule dans le fuseau de
    //  l'entreprise. Sans fuseau, `dateEffetAuLundi` refuse. L'écran doit
    //  refuser ET le dire, jamais retomber sur la date UTC du jour.
    await ouvrirRegles({ fuseau: null })
    await act(async () => host.querySelectorAll('.rtt-action')[1].click())

    const champ = host.querySelector('.rtt-champ input[type="number"]')
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set
    await act(async () => {
      setter.call(champ, '52')
      champ.dispatchEvent(new Event('input', { bubbles: true }))
    })

    await act(async () => bouton('Enregistrer').click())

    //  Aucune écriture n'est partie.
    expect(mocks.ecrire).toHaveBeenCalledTimes(0)
    //  Et le refus est nommé à l'écran.
    expect(host.textContent).toMatch(/fuseau de l’entreprise absent/i)
  })
})
