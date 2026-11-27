// @vitest-environment jsdom
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, afterEach, it, expect, vi } from 'vitest'
import HeuresSupplementaires from '../../pages/HeuresSupplementaires'

const mocks = vi.hoisted(() => ({
  calculate: vi.fn(),
  save: vi.fn(),
  toggleTheme: vi.fn(),
  fail: false,
  /*  LA LIGNE DE L'ENTREPRISE, telle que le rail la veut. Deux champs y sont
        comptables et pas décoratifs : `logo_url` (sans lui, la pastille retombe
        sur la lettre et l'aiguille ci-dessous n'a rien à lire) et
        `module_heures_supplementaires` (la fabrique de sections du rail garde la
        rubrique par ce drapeau). L'adresse est PUBLIQUE : `PhotoSignee` la laisse
        telle quelle, donc le test peint l'image sans simposer un `storage`. */
  entreprise: {
    id: 'ent',
    name: 'Usine Sokale',
    code: 'SOK',
    logo_url:
      'https://exemple.supabase.co/storage/v1/object/public/photos/sokale.png',
    module_heures_supplementaires: true,
  },
}))
vi.mock('../../contexts/ThemeContext', () => ({
  //  `toggleTheme` est lu par la page pour BRANCHER la commande de la barre :
  //  un mock qui ne rendrait que `darkMode` laisserait `surTheme` indéfini, et
  //  le composant le remplacerait par son neutre — l'aiguille du thème ne
  //  pourrait plus rien dire.
  useTheme: () => ({ darkMode: false, toggleTheme: mocks.toggleTheme }),
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
/*  LE PROJETEUR — pourquoi le harnais doit CONNAÎTRE la liste des colonnes.
    Un faux `select: () => query` qui jette l'argument rend invisible la leçon
    écrite dans la page Absences : « la requête ne DEMANDAIT PAS `logo_url` ».
    Une mock qui renvoie de toute façon la ligne complète ne peut jamais être
    contredit par un `select('id, name')` — et l'aiguille de l'image resterait
    verte avec le défaut d'origine. Le harnais suit donc le contrat : `*` rend la
    ligne telle quelle, une liste la réduit à ses colonnes. */
function projection(colonnes, ligne) {
  if (!ligne || !colonnes || colonnes.includes('*')) return ligne
  const gardes = colonnes.split(',').map((c) => c.trim())
  return Object.fromEntries(
    Object.entries(ligne).filter(([champ]) => gardes.includes(champ)),
  )
}

vi.mock('../../lib/supabase', () => ({
  supabase: {
    from: (table) => {
      /*  Les colonnes demandées vivent dans LA CHAÎNE, pas dans une variable de
            module : deux requêtes en concurrence ne doivent pas se marcher sur la
            liste, sinon le projecteur mentirait sur l'une des deux. */
      let colonnesDemandees = ''
      const query = {
        select: (colonnes) => {
          colonnesDemandees = colonnes
          return query
        },
        eq: () => query,
        in: () => query,
        gte: () => query,
        lte: () => query,
        order: () => query,
        /*  `maybeSingle` est le terminal que la page emploie pour la ligne du
            RAIL d'un compte non super (la politique d'accès ne lui laisse pas
            lire la table entière). Un harnais qui ne connaît que `range` fait
            planter la page sur `requete.eq(...).maybeSingle is not a function` :
            le mock suit le contrat du composant, pas l'inverse. */
        maybeSingle: async () =>
          table === 'enterprises'
            ? { error: null, data: projection(colonnesDemandees, mocks.entreprise) }
            : { error: null, data: null },
        single: async () =>
          table === 'enterprises'
            ? { error: null, data: projection(colonnesDemandees, mocks.entreprise) }
            : { error: null, data: null },
        range: async () => ({
          error: mocks.fail ? new Error('offline') : null,
          data:
            table === 'enterprises'
              ? [projection(colonnesDemandees, mocks.entreprise)]
              : (
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
                : []
            ),
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
/*  Le chemin d'entrée est une aiguille en soi : le rail allume sa rubrique en
    comparant `item.path` au `pathname` du routeur. Monté à `/`, aucun item ne
    s'allume — et un rail qui ne sait pas où il est n'est pas un rail. */
async function mount(chemin = '/') {
  await act(async () =>
    root.render(
      <MemoryRouter initialEntries={[chemin]}>
        <HeuresSupplementaires />
      </MemoryRouter>,
    ),
  )
}
/*  Remonter sur une AUTRE adresse demande une RACINE neuve : React refuse
    `render` sur un root démonté (« Cannot update an unmounted root »), et ce
    n'est pas un caprice du harnais — c'est la garantie que deux rendus ne se
    partagent pas l'arbre. Le conteneur, lui, reste le même. */
async function remount(chemin) {
  await act(async () => root.unmount())
  root = createRoot(host)
  await mount(chemin)
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

/*  ──────────────────────────────────────────────────────────────────────────
    LA BARRE ET SON RAIL — la demande du 27/11 : « ramène la sidebar + son rail
    dans cette page, et n'oublie pas d'afficher les images des entreprises qui y
    sont ». Trois aiguilles, et elles ne sont pas décoratives :

      · la barre doit être ENFANT DIRECT de `.coque-admin` — `SidebarUnique.css`
        pose le registre par-dessus la page avec `.coque-admin > .sb`. Un wrapper
        de plus, et la barre redevient un flex-item qui ôte 254 px au `main` à
        chaque dépliage (la faute du 08/11, écrite dans CoqueAdmin.jsx) ;
      · la rubrique allumée se lit sur le CHEMIN du routeur, pas sur une classe
        que le rail porte tout le temps : la même page montée ailleurs doit
        allumer une autre rubrique, sinon l'aiguille ne verrouille rien ;
      · « l'image de l'entreprise » est un fait de REQUÊTE, pas de maquette : la
        pastille lit `logo_url`, et un `select('id, name')` laisse la lettre du
        nom à l'écran sans jamais dire qu'il a manqué une colonne. Le harnais ne
        fournit cette ligne que par `maybeSingle` — le terminal du compte
        d'entreprise — donc supprimer la branche non super du chargement éteint
        la bande et fait rougir ici, pas dans un commentaire.
    ────────────────────────────────────────────────────────────────────────── */
it('monte la barre et son rail autour de la page, allumés à sa rubrique', async () => {
  await mount('/heures-supplementaires')
  const barre = host.querySelector('.coque-admin > .sb')
  expect(
    barre,
    'la barre n’est plus enfant direct de `.coque-admin` : le registre va de nouveau manger 254 px au lieu de passer par-dessus',
  ).toBeTruthy()
  expect(barre.querySelector('.sb-rail'), 'la barre est là, son rail a disparu').toBeTruthy()
  expect(
    [...barre.querySelectorAll('.sb-rail-item.is-actif')].map((b) => b.getAttribute('aria-label')),
    'le rail ne sait pas sur quelle rubrique il est',
  ).toEqual(['Paie'])

  //  Et l'aiguille ci-dessus n'est pas une coutume : montée à une autre adresse,
  //    la même barre doit allumer AUTRE chose.
  await remount('/pointages')
  expect(
    [...host.querySelectorAll('.sb-rail-item.is-actif')].map((b) => b.getAttribute('aria-label')),
  ).toEqual(['Temps de travail'])
})

it('peint l’IMAGE de l’entreprise dans la barre, pas sa lettre', async () => {
  await mount('/heures-supplementaires')
  const bande = host.querySelector('.sb-rail .se-bande')
  expect(
    bande,
    'pas de bande d’entreprise dans le rail : la page ne monte plus ses entreprises pour ce rôle',
  ).toBeTruthy()
  const image = bande.querySelector('img')
  expect(
    image,
    'la pastille retombe sur la lettre du nom : `logo_url` n’arrive pas jusqu’à la barre (la requête ne le demande pas, ou la liste est vide)',
  ).toBeTruthy()
  expect(image.getAttribute('src')).toContain(
    '/storage/v1/object/public/photos/sokale.png',
  )
  expect(bande.querySelector('.se-bande-nom')?.textContent).toBe('Usine Sokale')
})

it('garde les étages du tiroir en ordre : corps scrollable entre l’en-tête et le pied', async () => {
  await mount('/heures-supplementaires')
  await click('Règles de calcul')
  const tiroir = host.querySelector('dialog.ot-drawer')
  expect(tiroir, 'le tiroir des règles ne s’est pas ouvert').toBeTruthy()
  /*  L'ORDRE est le défaut du 27/11 : le pied est peint APRÈS le corps, donc un
        corps qui déborde (sans `overflow-y`) se retrouve RAYÉ par le pied et la
        bande du bas — le dernier réglage du tiroir devenait illisible et
        hors d'écran. Rendre le pied ou la bande premier enfant ne se voit pas
        à l'œil sur une capture de 600 px de haut ; ça se verrouille ici. */
  expect([...tiroir.querySelectorAll(':scope > div')].map((d) => d.className)).toEqual([
    'ec-cultural-band ec-cultural-top',
    'ot-rules-header',
    'ot-rules-body',
    'ot-rules-footer',
    'ec-cultural-band ec-cultural-bottom',
  ])
})
