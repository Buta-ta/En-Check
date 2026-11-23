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

import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, it, expect, vi } from 'vitest'
import MonEntreprise from '../../pages/MonEntreprise'

const mocks = vi.hoisted(() => ({
  ecrire: vi.fn(),
  resoudre: vi.fn(),
  historique: vi.fn(),
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

  host = document.createElement('div')
  document.body.append(host)
  root = createRoot(host)
})

afterEach(async () => {
  await act(async () => root.unmount())
  host.remove()
  vi.restoreAllMocks()
})

async function monter() {
  await act(async () => {
    root.render(
      <MemoryRouter>
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
  expect(host.textContent).toContain('depuis le 2026-09-01')
})
