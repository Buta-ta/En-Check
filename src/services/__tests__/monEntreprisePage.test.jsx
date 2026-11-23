// @vitest-environment jsdom
// src/services/__tests__/monEntreprisePage.test.jsx
// ═══════════════════════════════════════════════════════════════════════════
// 🏢 L'ÉCRAN « MON ENTREPRISE », RENDU ET CLICQUÉ
//
// Trois choses que la relecture ne prouve pas :
//   1. un modèle est PROPOSÉ, pas appliqué : ouvrir la confirmation n'écrit rien ;
//   2. confirmer écrit la valeur — et seulement là ;
//   3. une entreprise non rattachée au compte est REFUSÉE, même si son
//      identifiant traîne dans le stockage local.
// ═══════════════════════════════════════════════════════════════════════════

import { act, useEffect } from 'react'
import { createRoot } from 'react-dom/client'
import { MemoryRouter, useLocation } from 'react-router-dom'
import { afterEach, beforeEach, describe, it, expect, vi } from 'vitest'
import MonEntreprise from '../../pages/MonEntreprise'

const mocks = vi.hoisted(() => ({
  ecrire: vi.fn(),
  resoudre: vi.fn(),
  historique: vi.fn(),
  apercuImpact: vi.fn(),
  entreprise: {
    id: 'ent-a',
    name: 'Entreprise fictive',
    code: 'FICT',
    country_code: 'BJ',
    currency: 'XOF',
    timezone: 'Africa/Porto-Novo',
    is_active: true,
  },
}))

vi.mock('../reglesTempsTravail', () => ({
  resoudre: (...args) => mocks.resoudre(...args),
  ecrire: (...args) => mocks.ecrire(...args),
  historique: (...args) => mocks.historique(...args),
  apercuImpact: (...args) => mocks.apercuImpact(...args),
}))

vi.mock('../../lib/supabase', () => {
  const reponse = () => ({
    select: () => ({
      eq: () => ({
        order: async () => ({ data: [mocks.entreprise], error: null }),
        maybeSingle: async () => ({ data: mocks.entreprise, error: null }),
      }),
    }),
  })
  return { supabase: { from: () => reponse() } }
})

let host
let root

beforeEach(() => {
  localStorage.setItem('admin', JSON.stringify({ role: 'admin', enterprise_id: 'ent-a' }))
  mocks.ecrire.mockReset()
  mocks.ecrire.mockResolvedValue('nouvelle-version')
  mocks.resoudre.mockReset()
  mocks.resoudre.mockResolvedValue({ valeur: null, origine: 'aucune', libelle: 'aucune règle enregistrée', dateEffet: null })
  mocks.historique.mockReset()
  mocks.historique.mockResolvedValue([])
  mocks.apercuImpact.mockReset()
  mocks.apercuImpact.mockResolvedValue({
    employesConcernes: 0,
    valeursChangees: 0,
    dontVerrouillees: 0,
    ecritureBloquee: false,
    details: [],
  })

  host = document.createElement('div')
  document.body.append(host)
  root = createRoot(host)
})

afterEach(async () => {
  await act(async () => root.unmount())
  host.remove()
  vi.restoreAllMocks()
})

//  Où le routeur croit être. On lit le VRAI routeur — un `useLocation` dans
//  le contexte de `MemoryRouter` — au lieu de remplacer le module : le simuler
//  entier bloquait la suite (un `await` qui ne se résolvait plus). L'affectation
//  passe par un effet : écrire hors du rendu, jamais pendant.
const suivi = { chemin: null }
function Observateur() {
  const { pathname } = useLocation()
  useEffect(() => {
    suivi.chemin = pathname
  }, [pathname])
  return null
}

async function monter({ entrees = ['/mon-entreprise'], index = 0, idx = 0 } = {}) {
  suivi.chemin = null
  window.history.replaceState({ idx }, '')
  await act(async () => {
    root.render(
      <MemoryRouter initialEntries={entrees} initialIndex={index}>
        <Observateur />
        <MonEntreprise />
      </MemoryRouter>,
    )
  })
}

const bouton = (texte) =>
  [...host.querySelectorAll('button')].find((b) => b.textContent.trim() === texte)

it('affiche le modèle comme une proposition, jamais comme appliqué', async () => {
  await monter()
  expect(host.textContent).toContain('Proposition du produit — non appliquée')
  expect(host.textContent).not.toContain('Modèle confirmé par l’entreprise')
})

it('ouvrir la confirmation n’écrit RIEN', async () => {
  await monter()
  await act(async () => bouton('Utiliser le modèle 48 h').click())

  expect(mocks.ecrire).not.toHaveBeenCalled()
  expect(host.textContent).toContain('Confirmer l’application')
})

it('confirmer écrit la valeur du modèle, avec la date du jour', async () => {
  await monter()
  await act(async () => bouton('Utiliser le modèle 48 h').click())
  await act(async () => bouton('Confirmer l’application').click())

  expect(mocks.ecrire).toHaveBeenCalledTimes(1)
  const appel = mocks.ecrire.mock.calls[0][0]
  expect(appel.cle).toBe('alerte_hebdo_heures')
  expect(appel.valeur).toBe(48)
  expect(appel.entrepriseId).toBe('ent-a')
  expect(appel.dateEffet).toMatch(/^\d{4}-\d{2}-\d{2}$/)
})

it('refuse une entreprise qui n’est pas la sienne', async () => {
  localStorage.setItem(
    'admin',
    JSON.stringify({ role: 'admin', selectedEnterprise: { id: 'ent-autre' } }),
  )
  //  La base ne renvoie que l'entreprise réelle du compte (ent-a).
  await monter()

  expect(host.textContent).toContain('Accès refusé')
  expect(host.textContent).not.toContain('Règles de temps de travail')
})

it('affiche une valeur en vigueur avec son origine et sa date', async () => {
  mocks.resoudre.mockResolvedValue({
    valeur: 45,
    origine: 'entreprise',
    libelle: 'règle de l’entreprise',
    dateEffet: '2026-09-01',
  })
  await monter()

  expect(host.textContent).toContain('45 h')
  //  La date est écrite en clair depuis la refonte du 24/11/2026.
  expect(host.textContent).toContain('depuis le 1 sept. 2026')
})

it('montre l’impact avant d’écrire, et refuse si un verrou bloque', async () => {
  mocks.resoudre.mockResolvedValue({
    valeur: 42,
    origine: 'entreprise',
    libelle: 'règle de l’entreprise',
    dateEffet: '2026-09-01',
  })
  mocks.apercuImpact.mockResolvedValue({
    employesConcernes: 12,
    valeursChangees: 3,
    dontVerrouillees: 1,
    ecritureBloquee: true,
    details: [],
  })

  await monter()
  await act(async () => bouton('Modifier').click())

  //  Saisir une nouvelle valeur, puis cocher la confirmation.
  const champ = host.querySelector('.me-edition input[type="number"]')
  const setValeur = Object.getOwnPropertyDescriptor(
    window.HTMLInputElement.prototype,
    'value',
  ).set
  await act(async () => {
    setValeur.call(champ, '44')
    champ.dispatchEvent(new Event('input', { bubbles: true }))
  })
  const caseConfirme = host.querySelector('.me-case input[type="checkbox"]')
  await act(async () => caseConfirme.click())

  expect(mocks.apercuImpact).toHaveBeenCalledTimes(1)
  expect(mocks.apercuImpact.mock.calls[0][0]).toMatchObject({
    entrepriseId: 'ent-a',
    cle: 'alerte_hebdo_heures',
    valeur: 44,
  })
  expect(host.textContent).toContain('3 employés verraient leur valeur remplacée')
  expect(host.textContent).toContain('l’enregistrement sera refusé')

  const enregistrer = bouton('Enregistrer')
  expect(enregistrer.disabled).toBe(true)
})

describe('Le bouton retour', () => {
  it('existe, se nomme, et n’est pas une icône muette', async () => {
    await monter()
    const retour = host.querySelector('.me-retour')

    expect(retour).not.toBeNull()
    expect(retour.tagName).toBe('BUTTON')
    expect(retour.getAttribute('aria-label')).toBe('Retour à la page précédente')
    //  La flèche est un dessin : sans le mot, un lecteur d'écran n'annonce rien.
    expect(retour.textContent.trim()).toBe('')
  })

  it('revient en arrière quand on vient d’une autre page', async () => {
    await monter({ entrees: ['/dashboard', '/mon-entreprise'], index: 1, idx: 1 })
    expect(suivi.chemin).toBe('/mon-entreprise')

    await act(async () => host.querySelector('.me-retour').click())

    //  On est revenu LÀ D'OÙ L'ON VENAIT, pas sur une adresse devinée.
    expect(suivi.chemin).toBe('/dashboard')
  })

  it('sans historique, il aboutit au tableau de bord — jamais dans le vide', async () => {
    await monter({ entrees: ['/mon-entreprise'], index: 0, idx: 0 })

    await act(async () => host.querySelector('.me-retour').click())

    expect(suivi.chemin).toBe('/dashboard')
  })

  it('l’écran d’accès refusé porte le retour lui aussi', async () => {
    localStorage.setItem(
      'admin',
      JSON.stringify({ role: 'admin', selectedEnterprise: { id: 'ent-autre' } }),
    )
    await monter()

    expect(host.textContent).toContain('Accès refusé')
    expect(host.querySelector('.me-retour')).not.toBeNull()
  })
})
