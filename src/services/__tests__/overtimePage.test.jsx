// @vitest-environment jsdom
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, afterEach, it, expect, vi } from 'vitest'
import HeuresSupplementaires from '../../pages/HeuresSupplementaires'

const mocks = vi.hoisted(() => ({
  calculate: vi.fn(),
  save: vi.fn(),
  fail: false,
}))
vi.mock('../../contexts/ThemeContext', () => ({
  useTheme: () => ({ darkMode: false }),
}))
vi.mock('../../components/PageHeader', () => ({ default: () => null }))
vi.mock('../holidayService', () => ({
  default: { isHoliday: async () => null },
}))
vi.mock('../featureService', () => ({
  FEATURES: { HEURES_SUPPLEMENTAIRES: 'overtime' },
  default: {
    hasFeature: async () => true,
    getOvertimeSettings: async () => ({
      rate_normal: 25,
      rate_major: 50,
      overtime_major_after_hours: 2,
    }),
    //  ⚠️ Depuis G7, la page lit la version AVEC ORIGINE : `getOvertimeSettings`
    //  fusionne les défauts avec la ligne en base et perd le fait qu'un seuil
    //  ait été choisi. Le mock doit donc exposer le même contrat que le vrai
    //  service (settings + provenance), sinon la page ne reçoit rien.
    getOvertimeSettingsAvecOrigine: async () => ({
      settings: {
        rate_normal: 25,
        rate_major: 50,
        overtime_major_after_hours: 2,
      },
      provenance: { origine: 'entreprise', motif: 'test' },
    }),
    loadSchedules: async () => [],
    calculateOvertimeForEmployeeDay: mocks.calculate,
    saveOvertimeSettings: mocks.save,
  },
}))
vi.mock('../../lib/supabase', () => ({
  supabase: {
    from: (table) => {
      const query = {
        select: () => query,
        eq: () => query,
        in: () => query,
        gte: () => query,
        lte: () => query,
        order: () => query,
        range: async () => ({
          error: mocks.fail ? new Error('offline') : null,
          data:
            table === 'employees'
              ? [
                  {
                    id: 'a',
                    enterprise_id: 'ent',
                    first_name: 'Amina',
                    photo_url: '/profile-amina.jpg',
                    last_name: 'D.',
                  },
                ]
              : table === 'attendances'
                ? [
                    {
                      employee_id: 'a',
                      check_type: 'in',
                      check_time: '2026-10-22T22:00:00Z',
                    },
                    {
                      employee_id: 'a',
                      check_type: 'out',
                      check_time: '2026-10-23T07:00:00Z',
                    },
                    {
                      employee_id: 'a',
                      check_type: 'in',
                      check_time: '2026-10-23T09:00:00Z',
                    },
                    {
                      employee_id: 'a',
                      check_type: 'out',
                      check_time: '2026-10-23T18:00:00Z',
                    },
                  ]
                : [],
        }),
      }
      return query
    },
  },
}))
let root, host
beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date('2026-10-23T12:00:00Z'))
  globalThis.IS_REACT_ACT_ENVIRONMENT = true
  mocks.fail = false
  mocks.calculate.mockReset().mockImplementation(({ totalWorkedSeconds }) => ({
    contractualSeconds: 28800,
    totalOvertimeSeconds: Math.max(0, totalWorkedSeconds - 28800),
    overtimeSeconds: Math.max(0, totalWorkedSeconds - 28800),
    rateApplied: 25,
  }))
  mocks.save.mockReset().mockResolvedValue(true)
  localStorage.setItem(
    'admin',
    JSON.stringify({ role: 'admin', enterprise_id: 'ent' }),
  )
  HTMLDialogElement.prototype.showModal = function () {
    this.setAttribute('open', '')
  }
  HTMLDialogElement.prototype.close = function () {
    this.removeAttribute('open')
  }
  host = document.createElement('div')
  document.body.append(host)
  root = createRoot(host)
})
afterEach(async () => {
  await act(async () => root.unmount())
  host.remove()
  vi.restoreAllMocks()
  vi.useRealTimers()
})
async function mount() {
  await act(async () =>
    root.render(
      <MemoryRouter>
        <HeuresSupplementaires />
      </MemoryRouter>,
    ),
  )
}
async function click(text) {
  const button = [...host.querySelectorAll('button')].find(
    (b) => b.textContent === text,
  )
  expect(button).toBeTruthy()
  await act(async () => button.click())
}
it('uses the engine separately for every day of the month and aggregates overnight work once', async () => {
  await mount()
  mocks.calculate.mockClear()
  await click('Mois')
  const calls = mocks.calculate.mock.calls.map(([arg]) => arg)
  expect(calls).toHaveLength(31)
  expect(calls.find((c) => c.dateStr === '2026-10-22').totalWorkedSeconds).toBe(
    32400,
  )
  expect(calls.find((c) => c.dateStr === '2026-10-23').totalWorkedSeconds).toBe(
    32400,
  )
  expect(host.querySelectorAll('.ot-employee')).toHaveLength(1)
  expect(host.querySelector('.ot-stats').textContent).toContain('18h')
  expect(host.querySelector('.ot-stats').textContent).toContain('2h')
})
it('preserves draft on save failure and makes the rules explanations collapsible', async () => {
  await mount()
  await click('Règles de calcul')
  expect(host.querySelector('dialog[open]')).toBeTruthy()
  expect(host.querySelectorAll('dialog .ec-cultural-band')).toHaveLength(2)
  expect(host.querySelectorAll('dialog .ot-rules-section')).toHaveLength(4)
  expect(
    host
      .querySelectorAll('.ot-rules-section')[2]
      .querySelector('#ot-rate_sunday'),
  ).toBeTruthy()
  //  ⏰ Seuil et alerte : deux objets distincts, dans leur propre section.
  expect(host.querySelector('#ot-weekly_threshold')).toBeTruthy()
  expect(host.querySelector('#ot-alerte_hebdo_activee').checked).toBe(false)
  expect(host.querySelector('dialog details[open]')).toBeNull()
  expect(host.querySelector('label[for="ot-rate_normal"]')).toBeTruthy()
  mocks.save.mockRejectedValueOnce(new Error('offline'))
  await click('Sauvegarder')
  expect(host.querySelector('dialog[open]')).toBeTruthy()
  expect(
    [...host.querySelectorAll('button')].find(
      (b) => b.textContent === 'Sauvegarder',
    ).disabled,
  ).toBe(false)
  await click('Sauvegarder')
  expect(host.querySelector('dialog')).toBeNull()
})
it('refuses to activate the weekly alert without a usable threshold', async () => {
  await mount()
  await click('Règles de calcul')

  const caseAlerte = host.querySelector('#ot-alerte_hebdo_activee')
  await act(async () => caseAlerte.click())
  expect(caseAlerte.checked).toBe(true)

  //  Aucun seuil saisi : la sauvegarde doit refuser plutôt que d'enregistrer
  //  une alerte qui ne pourrait jamais se déclencher.
  mocks.save.mockClear()
  await click('Sauvegarder')
  expect(mocks.save).not.toHaveBeenCalled()
  expect(host.querySelector('dialog[open]')).toBeTruthy()
})

it('saves the threshold and the activation as two distinct values', async () => {
  await mount()
  await click('Règles de calcul')

  const seuil = host.querySelector('#ot-weekly_threshold')
  const setValeur = Object.getOwnPropertyDescriptor(
    window.HTMLInputElement.prototype,
    'value',
  ).set
  await act(async () => {
    setValeur.call(seuil, '45')
    seuil.dispatchEvent(new Event('input', { bubbles: true }))
  })
  await act(async () => host.querySelector('#ot-alerte_hebdo_activee').click())

  mocks.save.mockClear()
  mocks.save.mockResolvedValue(true)
  await click('Sauvegarder')

  expect(mocks.save).toHaveBeenCalledTimes(1)
  const [, payload] = mocks.save.mock.calls[0]
  expect(payload.weekly_threshold).toBe(45)
  expect(payload.alerte_hebdo_activee).toBe(true)
})

it('does not turn query errors into a zero-hours result and supports retry', async () => {
  vi.spyOn(console, 'error').mockImplementation(() => {})
  mocks.fail = true
  await mount()
  expect(host.querySelector('[role="alert"]').textContent).toContain(
    'Impossible de charger',
  )
  expect(host.querySelector('.ot-stats')).toBeNull()
  mocks.fail = false
  await click('Réessayer')
  expect(host.querySelector('[role="alert"]')).toBeNull()
  expect(host.querySelector('.ot-stats')).toBeTruthy()
})

it('shows the existing employee photo in overtime results', async () => {
  await mount()
  expect(host.querySelector('.ot-avatar img').getAttribute('src')).toBe(
    '/profile-amina.jpg',
  )
})

// ─────────────────────────────────────────────────────────────────────────────
//  G7 / V-B3 — « contrôle indisponible », sur l'écran qui affiche des heures
// ─────────────────────────────────────────────────────────────────────────────
//
//  Le défaut d'origine n'était pas dans la logique : la page affichait des
//  heures et un seuil sans jamais dire que le contrôle hebdomadaire n'était
//  pas fait. Un tableau plein de chiffres muet là-dessus se lit comme une
//  conformité constatée.

it('dit que le contrôle n’est pas fait quand aucun seuil n’est choisi', async () => {
  //  Le mock du service rend des réglages SANS seuil hebdomadaire : c'est le
  //  cas d'un client neuf, où le défaut produit ne doit pas alerter (5.3.1).
  const FeatureService = (await import('../featureService')).default
  const initial = FeatureService.getOvertimeSettingsAvecOrigine
  FeatureService.getOvertimeSettingsAvecOrigine = async () => ({
    settings: { rate_normal: 25, rate_major: 50, overtime_major_after_hours: 2 },
    provenance: { origine: 'defaut_produit', motif: 'aucune règle enregistrée' },
  })
  try {
    await mount()
    const ligne = host.querySelector('.ot-controle-indisponible')
    expect(ligne).toBeTruthy()
    expect(ligne.textContent).toContain('Contrôle indisponible')
    expect(ligne.textContent).toMatch(/Aucun seuil hebdomadaire choisi/)
    //  Et ce n'est PAS une alerte au sens des lecteurs d'écran.
    expect(ligne.getAttribute('role')).toBe('status')
  } finally {
    FeatureService.getOvertimeSettingsAvecOrigine = initial
  }
})

it('ne dit rien quand le seuil est choisi ET l’alerte activée', async () => {
  const FeatureService = (await import('../featureService')).default
  const initial = FeatureService.getOvertimeSettingsAvecOrigine
  FeatureService.getOvertimeSettingsAvecOrigine = async () => ({
    settings: {
      rate_normal: 25,
      rate_major: 50,
      overtime_major_after_hours: 2,
      weekly_threshold: 45,
      alerte_hebdo_activee: true,
    },
    provenance: { origine: 'entreprise', motif: 'valeur choisie' },
  })
  try {
    await mount()
    expect(host.querySelector('.ot-controle-indisponible')).toBeNull()
  } finally {
    FeatureService.getOvertimeSettingsAvecOrigine = initial
  }
})

it('nomme une origine incertaine sans retirer l’alerte', async () => {
  const FeatureService = (await import('../featureService')).default
  const initial = FeatureService.getOvertimeSettingsAvecOrigine
  FeatureService.getOvertimeSettingsAvecOrigine = async () => ({
    settings: {
      rate_normal: 25,
      rate_major: 50,
      overtime_major_after_hours: 2,
      weekly_threshold: 48,
      alerte_hebdo_activee: true,
    },
    provenance: {
      origine: 'historique_incertain',
      motif: 'valeur identique à un défaut du produit',
    },
  })
  try {
    await mount()
    const ligne = host.querySelector('.ot-controle-indisponible')
    expect(ligne.textContent).toContain('Origine à confirmer')
    expect(ligne.textContent).toContain('48 h')
  } finally {
    FeatureService.getOvertimeSettingsAvecOrigine = initial
  }
})
