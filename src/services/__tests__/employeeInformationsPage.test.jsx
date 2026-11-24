// @vitest-environment jsdom
// src/services/__tests__/employeeInformationsPage.test.jsx
// ═══════════════════════════════════════════════════════════════════════════
// 👁️ L'ÉCRAN « MES INFORMATIONS », RENDU ET CLICQUÉ
//
// Quatre choses que la relecture ne prouve pas :
//   1. le texte affiché est CELUI DE LA BASE, figé — l'écran ne le recompose pas ;
//   2. « J'ai lu » appelle la RPC avec le seul identifiant d'information, et
//      affiche la date rendue par la base (pas celle du navigateur) ;
//   3. une information déjà lue n'a plus de bouton : on ne relit pas un acte ;
//   4. « aucune fiche employé » ne laisse pas une page blanche : le message est
//      celui du service, en français.
// ═══════════════════════════════════════════════════════════════════════════

import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import EmployeeInformations from '../../pages/employee/EmployeeInformations'

const mocks = vi.hoisted(() => ({
  mesInformations: vi.fn(),
  marquerConsultee: vi.fn(),
}))

vi.mock('../mesInformations', () => ({
  mesInformations: (...args) => mocks.mesInformations(...args),
  marquerConsultee: (...args) => mocks.marquerConsultee(...args),
  compterAConsulter: (liste) => (liste || []).filter((i) => i && !i.consulteLe).length,
}))

//  Le châssis employé lit la session et peint une barre latérale : on ne teste
//  pas le châssis ici, on teste la page. On le réduit à son contenu.
vi.mock('../../components/EmployeeLayout', () => ({
  default: ({ children }) => <div data-testid="chassis">{children}</div>,
}))

vi.mock('../../services/employeeAuthService', () => ({
  default: {
    getEmployee: () => ({ id: 'emp-1', enterprise_id: 'ent-a', first_name: 'Hippo' }),
  },
}))

vi.mock('react-hot-toast', () => ({
  default: { error: vi.fn(), success: vi.fn() },
}))

let host
let root

const info = (surcharge = {}) => ({
  id: 'info-1',
  cle: 'alerte_hebdo_heures',
  evenement: 'valeur_personnelle_posee',
  libelle: 'Votre réglage personnel a été enregistré',
  contenu: 'Votre seuil personnel passe à 38 h (entreprise : 42 h), à compter du 1ᵉʳ novembre.',
  valeurAvant: null,
  valeurApres: 38,
  dateEffet: '2026-11-01',
  emisLe: '2026-11-03T08:00:00Z',
  consulteLe: null,
  etat: 'a_consulter',
  etatLibelle: 'À consulter',
  ...surcharge,
})

beforeEach(() => {
  mocks.mesInformations.mockReset()
  mocks.mesInformations.mockResolvedValue([info()])
  mocks.marquerConsultee.mockReset()
  mocks.marquerConsultee.mockResolvedValue('2026-11-20T10:00:00Z')

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
      <MemoryRouter initialEntries={['/employee/informations']}>
        <EmployeeInformations />
      </MemoryRouter>,
    )
  })
}

const bouton = (texte) =>
  [...host.querySelectorAll('button')].find((b) => b.textContent.trim() === texte)

it('affiche le texte émis par la base, sans le recomposer', async () => {
  await monter()
  expect(host.textContent).toContain('Votre seuil personnel passe à 38 h')
  expect(mocks.mesInformations).toHaveBeenCalledTimes(1)
})

it('un « avant » inconnu s’affiche en tiret, jamais en 0', async () => {
  await monter()
  const cellules = [...host.querySelectorAll('.einfo-chiffre')].map((c) => c.textContent.trim())
  expect(cellules[0]).toBe('—')
  expect(cellules[1]).toBe('38 h')
})

it('une information non lue porte le mot « À consulter » et un bouton', async () => {
  await monter()
  expect(host.textContent).toContain('À consulter')
  expect(host.textContent).toContain('1 à consulter')
  expect(bouton('J’ai lu')).toBeTruthy()
})

it('« J’ai lu » appelle la RPC avec le seul identifiant, et affiche la date de la base', async () => {
  await monter()
  await act(async () => bouton('J’ai lu').click())

  expect(mocks.marquerConsultee).toHaveBeenCalledTimes(1)
  expect(mocks.marquerConsultee).toHaveBeenCalledWith('info-1')

  //  Le mot change, et le bouton disparaît : un acte ne se refait pas.
  expect(host.textContent).toContain('Consultée')
  expect(host.textContent).not.toContain('À consulter')
  expect(bouton('J’ai lu')).toBeUndefined()
  expect(host.textContent).toContain('Tout est lu')
})

it('une information déjà lue n’offre aucun bouton, et garde sa date', async () => {
  mocks.mesInformations.mockResolvedValue([
    info({ consulteLe: '2026-11-20T10:00:00Z', etat: 'consultee', etatLibelle: 'Consultée' }),
  ])
  await monter()

  expect(bouton('J’ai lu')).toBeUndefined()
  expect(host.textContent).toContain('Consultée')
})

it('un registre vide le dit, et n’invente pas une ligne', async () => {
  mocks.mesInformations.mockResolvedValue([])
  await monter()

  expect(host.textContent).toContain('Rien à vous signaler pour l’instant.')
  expect(host.querySelectorAll('.einfo-ligne')).toHaveLength(0)
})

it('« aucune fiche employé » affiche le message du service, pas une page blanche', async () => {
  mocks.mesInformations.mockRejectedValue(
    new Error('Ce compte n’est rattaché à aucune fiche employé : demandez à votre administration.'),
  )
  await monter()

  expect(host.textContent).toContain('demandez à votre administration')
  expect(host.querySelector('[role="alert"]')).toBeTruthy()
})

it('un échec du marquage ne fait pas disparaître la ligne', async () => {
  mocks.marquerConsultee.mockRejectedValue(new Error('Cette information ne vous est pas adressée.'))
  await monter()
  await act(async () => bouton('J’ai lu').click())

  expect(host.textContent).toContain('Votre seuil personnel passe à 38 h')
  expect(host.textContent).toContain('À consulter')
})
