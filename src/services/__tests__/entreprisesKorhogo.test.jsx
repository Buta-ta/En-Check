// @vitest-environment jsdom
// ═══════════════════════════════════════════════════════════
// 🎨 LA TOILE DE KORHOGO — la page Entreprises
//
// Ce que ces tests gardent :
//   ① le motif de la page est la toile de Korhogo, et il est
//     branché sur les deux bandeaux comme sur les autres pages ;
//   ② chaque entreprise est un cadre peint — nom, licence,
//     chiffres, modules — et son dépliant dit tout ;
//   ③ le formulaire ne perd aucun champ ni aucune règle : pays
//     fiscal, préfixe de matricules, 22 modules réels, licence ;
//   ④ plus une seule alerte du navigateur : les avis vivent
//     dans la page.
// ═══════════════════════════════════════════════════════════

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { MemoryRouter } from 'react-router-dom'
import { renderToStaticMarkup } from 'react-dom/server'
import Entreprises from '../../pages/Entreprises'
import PageCulturalBand, { culturalMotifForPath } from '../../components/PageCulturalBand'

const ROOT = path.resolve(import.meta.dirname, '../../..')
const lire = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8')

const source = lire('src/pages/Entreprises.jsx')
const css = lire('src/pages/Entreprises.css')
const bande = lire('src/components/PageCulturalBand.jsx')
const svg = lire('src/components/KorhogoSvg.jsx')

// ── Le faux Supabase ───────────────────────────────────────
const journal = []
const mock = vi.hoisted(() => ({ from: vi.fn() }))

vi.mock('../../lib/supabase', () => ({
  supabase: {
    from: mock.from,
    storage: {
      from: () => ({
        upload: async () => ({ error: null }),
        getPublicUrl: () => ({ data: { publicUrl: 'https://exemple.test/logo.png' } }),
      }),
    },
  },
}))

vi.mock('../../contexts/ThemeContext', () => ({
  useTheme: () => ({ darkMode: true, toggleTheme: vi.fn() }),
}))

vi.mock('../../services/taxationService', () => ({
  default: { initializeEnterpriseFromCountry: vi.fn(async () => ({ success: true })) },
}))

const ENTREPRISE = {
  id: 'e1',
  name: 'Pharmacie Blanche Gomes',
  code: 'PBG471',
  email: 'contact@pbg.bj',
  phone: '+229 01 97 00 00 00',
  address: 'Cotonou, quartier Ganhi',
  sector: 'Santé',
  country_code: 'BJ',
  matricule_prefix: 'PBG',
  primary_color: '#8B3E1D',
  logo_url: null,
  license_type: 'premium',
  auto_close_enabled: true,
  auto_close_time: '22:00',
  auto_close_grace_minutes: 15,
  module_planning: true,
  module_fiches_paie: true,
  employees: [{ count: 12 }],
  attendances: [{ count: 340 }],
}

const PAYS = [
  { country_code: 'BJ', country_name: 'Bénin', currency: 'XOF', default_tax_brackets: [{ min: 0 }] },
  {
    country_code: 'TG',
    country_name: 'Togo',
    currency: 'XOF',
    default_tax_brackets: [],
  },
]

function brancher(liste = [ENTREPRISE]) {
  mock.from.mockImplementation((table) => {
    const q = {
      select: () => q,
      eq: () => q,
      order: async () => ({
        data: table === 'countries_payroll_config' ? PAYS : liste,
      }),
      insert: (payload) => {
        journal.push({ table, op: 'insert', payload })
        return q
      },
      update: (payload) => {
        journal.push({ table, op: 'update', payload })
        return q
      },
      single: async () => ({ data: { id: 'e9' }, error: null }),
    }
    return q
  })
}

let host
let root

beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true
  journal.length = 0
  localStorage.setItem('admin', JSON.stringify({ id: 'a1', role: 'super_admin', first_name: 'Buta' }))
  brancher()
  host = document.createElement('div')
  document.body.append(host)
  root = createRoot(host)
})

afterEach(async () => {
  await act(async () => root.unmount())
  host.remove()
  localStorage.clear()
})

async function monter(liste) {
  if (liste) brancher(liste)
  await act(async () =>
    root.render(
      <MemoryRouter initialEntries={['/entreprises']}>
        <Entreprises />
      </MemoryRouter>,
    ),
  )
  await act(async () => {
    await new Promise((r) => setTimeout(r, 720))
  })
}

const cliquer = async (el) => {
  await act(async () => el.click())
}

// rend la page et s'arrête sur l'écran de chargement (avant les 650 ms)
async function monterSurLeChargement() {
  await act(async () =>
    root.render(
      <MemoryRouter initialEntries={['/entreprises']}>
        <Entreprises />
      </MemoryRouter>,
    ),
  )
}

// ── 1. Le motif ────────────────────────────────────────────

describe('1. la toile de Korhogo', () => {
  it('devient le motif de la page Entreprises', () => {
    expect(culturalMotifForPath('/entreprises')).toBe('korhogo')
    expect(culturalMotifForPath('/entreprises/e1')).toBe('korhogo')
    // les autres pages gardent leur identité
    expect(culturalMotifForPath('/planning')).toBe('kuba')
    expect(culturalMotifForPath('/admins')).toBe('abomey')
    expect(bande).toContain("if (page === 'entreprises') return 'korhogo'")
  })

  it('est dessiné en SVG maison, pas en photo', () => {
    const rendu = renderToStaticMarkup(<PageCulturalBand pathname="/entreprises" />)
    expect(rendu).toContain('data-cultural-motif="korhogo"')
    expect(rendu).toContain('<svg')
    // une frise de neuf tuiles, comme Abomey
    expect(svg).toContain('NB_TUILES = 9')
    expect(svg).toContain('viewBox={`0 0 ${TUILE * NB_TUILES} 120`}')
    expect(svg).toContain('preserveAspectRatio="xMidYMid slice"')
    // les quatre emblèmes du pays sénoufo
    for (const embleme of ['Soleil', 'Calao', 'Cameleon', 'Caiman']) {
      expect(svg).toContain(`function ${embleme}`)
    }
  })

  it('garde les hauteurs communes : 76 px en haut, 32 px en bas', () => {
    // aucune règle propre à korhogo ne vient grossir la bande
    expect(css).not.toMatch(/ec-cultural-top\[data-cultural-motif='korhogo'\][^}]*height:\s*1[0-9]{2}px/)
    expect(css).toMatch(
      /\.en-pied \.ec-cultural-bottom\[data-cultural-motif='korhogo'\]\s*\{\s*height:\s*32px/,
    )
  })
})

// ── 2. Le registre ─────────────────────────────────────────

describe('2. le registre', () => {
  it('pose la bande haute et la bande basse, comme les autres pages', async () => {
    await monter()
    const bandes = host.querySelectorAll('.ec-cultural-band')
    expect(bandes.length).toBe(2)
    expect(bandes[0].className).toContain('ec-cultural-top')
    expect(bandes[1].className).toContain('ec-cultural-bottom')
    expect(host.querySelector('.en-pied')).not.toBeNull()
  })

  it('porte les raccourcis de pages', async () => {
    await monter()
    expect(host.querySelectorAll('.en-raccourcis .abs-raccourci').length).toBeGreaterThan(3)
  })

  it('affiche chaque maison dans un cadre peint', async () => {
    await monter()
    const carte = host.querySelector('.en-carte')
    expect(carte).not.toBeNull()
    expect(carte.getAttribute('data-ouvert')).toBe('non')
    expect(host.querySelector('.en-nom').textContent).toBe('Pharmacie Blanche Gomes')
    expect(host.querySelector('.en-licence').textContent).toBe('Premium')
    expect([...host.querySelectorAll('.en-chiffre b')].map((b) => b.textContent)).toEqual([
      '12',
      '340',
    ])
    expect(host.querySelector('.en-modules-pastille').textContent).toBe('2 modules allumés')
  })

  it('déplie la fiche : contact, fermeture, modules', async () => {
    await monter()
    await cliquer(host.querySelector('.en-actions .en-action'))
    expect(host.querySelector('.en-carte').getAttribute('data-ouvert')).toBe('oui')
    const detail = host.querySelector('.en-detail')
    expect(detail.textContent).toContain('Cotonou, quartier Ganhi')
    expect(detail.textContent).toContain('15 min de tolérance')
    expect(detail.textContent).toContain('22:00')
    // les 22 modules sont listés, allumés ou éteints
    expect(host.querySelectorAll('.en-module-etat').length).toBe(22)
    expect(host.querySelectorAll('.en-module-etat[data-actif="oui"]').length).toBe(2)
  })

  it('compte les chiffres du registre dans le panneau', async () => {
    await monter()
    const chiffres = [...host.querySelectorAll('.en-mesure b')].map((b) => b.textContent)
    expect(chiffres.slice(0, 3)).toEqual(['1', '12', '340'])
    // les licences : 1 premium, 0 basic, 0 enterprise
    expect(chiffres.slice(3)).toEqual(['0', '1', '0'])
  })

  it('filtre par nom, code, secteur ou email', async () => {
    await monter()
    const champ = host.querySelector('.en-recherche input')
    const saisir = async (valeur) => {
      await act(async () => {
        const setter = Object.getOwnPropertyDescriptor(
          window.HTMLInputElement.prototype,
          'value',
        ).set
        setter.call(champ, valeur)
        champ.dispatchEvent(new Event('input', { bubbles: true }))
      })
    }
    await saisir('pbg')
    expect(host.querySelectorAll('.en-carte').length).toBe(1)
    await saisir('santé')
    expect(host.querySelectorAll('.en-carte').length).toBe(1)
    await saisir('inexistant')
    expect(host.querySelectorAll('.en-carte').length).toBe(0)
    expect(host.querySelector('.en-vide')).not.toBeNull()
  })

  it('n’a plus une seule alerte du navigateur', () => {
    expect(source).not.toMatch(/[^.]\balert\(/)
    expect(source).not.toMatch(/\bconfirm\(/)
    expect(css).toContain('.en-avis')
  })
})

// ── 2 bis. Le chargement ───────────────────────────────────

describe('2 bis. la scène de chargement', () => {
  it('montre la scène avant le registre, jamais une page blanche', async () => {
    await monterSurLeChargement()
    expect(host.querySelector('.ch-scene')).not.toBeNull()
    expect(host.querySelector('.en-corps')).toBeNull()
    expect(host.textContent).toContain('Chargement des entreprises…')
    // la toile de la page est déjà tendue : bandeau haut + bordure tissée
    expect(host.querySelector('.ec-cultural-band')).not.toBeNull()
    expect(host.querySelector('.en-bordure')).not.toBeNull()

    // puis le registre prend la place de la scène
    await act(async () => {
      await new Promise((r) => setTimeout(r, 720))
    })
    expect(host.querySelector('.ch-scene')).toBeNull()
    expect(host.querySelector('.en-corps')).not.toBeNull()
  })

  it('se joue en deux temps : la paperasse, puis le carton allumé', async () => {
    await monterSurLeChargement()
    const temps1 = host.querySelector('.ch-t1')
    const temps2 = host.querySelector('.ch-t2')
    expect(temps1).not.toBeNull()
    expect(temps2).not.toBeNull()
    // le premier temps : la pile est haute, l'écran est éteint
    expect(temps1.querySelector('[data-allume="non"]')).not.toBeNull()
    expect(temps1.querySelector('[data-sourire="oui"]')).toBeNull()
    // le second : la pile a fondu, le carton s'allume, le sourire arrive
    expect(temps2.querySelector('[data-allume="oui"]')).not.toBeNull()
    expect(temps2.querySelector('[data-sourire="oui"]')).not.toBeNull()
    expect(temps1.querySelectorAll('rect').length).toBeGreaterThan(
      temps2.querySelectorAll('rect').length,
    )
    // la bulle de pensée n'existe qu'au second temps
    expect(temps2.querySelectorAll('g').length).toBeGreaterThan(0)
    expect(host.querySelectorAll('.ch-etape').length).toBe(2)
    expect(host.querySelector('.ch-etape--1').textContent).toBe('Étape 1 · La paperasse')
    expect(host.querySelector('.ch-etape--2').textContent).toBe('Étape 2 · Le carton s’allume')
  })

  it('est un dessin en SVG, pas une photo', () => {
    const composant = lire('src/components/ChargementEntreprises.jsx')
    const feuille = lire('src/components/ChargementEntreprises.css')
    expect(composant).toContain('<svg')
    expect(composant).not.toContain('<img')
    expect(composant).not.toMatch(/\.(png|jpg|jpeg|webp)['"]/)
    // la scène est décorative : le texte porte l'information
    expect(composant).toContain('aria-hidden="true"')
    // les deux temps sont pilotés en CSS, sans minuteur JavaScript
    expect(feuille).toContain('@keyframes ch-premier-temps')
    expect(feuille).toContain('@keyframes ch-second-temps')
    expect(composant).not.toContain('setInterval')
    expect(composant).not.toContain('setTimeout')
  })

  it('se fige sur le sourire quand on réduit les animations', () => {
    const feuille = lire('src/components/ChargementEntreprises.css')
    const bloc = feuille.slice(feuille.indexOf('@media (prefers-reduced-motion: reduce)'))
    expect(bloc).toContain('.ch-t1')
    expect(bloc).toMatch(/\.ch-t1\s*\{\s*opacity:\s*0/)
    expect(bloc).toMatch(/\.ch-t2\s*\{\s*opacity:\s*1/)
  })

  it('tient l’écran 650 ms, et recharge sans y revenir', () => {
    expect(source).toContain('loadData({ dureeMin: 650 })')
    expect(source).toContain('dureeMin = 0')
    // après un enregistrement ou une sortie, pas de retour au chargement
    expect(source).toContain('loadData({ silencieux: true })')
    expect(source).not.toMatch(/\n\s+loadData\(\)\n/)
  })
})

// ── 3. Le formulaire ───────────────────────────────────────

describe('3. le formulaire', () => {
  it('ouvre un carton en cinq sections', async () => {
    await monter()
    await cliquer(host.querySelector('.en-entete-actions .en-bouton'))
    expect(host.querySelector('.en-carton')).not.toBeNull()
    const sections = [...host.querySelectorAll('.en-carton legend')].map((l) => l.textContent.trim())
    expect(sections).toEqual([
      'L’identité',
      'Les coordonnées',
      'Le pays et les matricules',
      'La fermeture automatique',
      'La licence et les modules',
    ])
  })

  it('donne un exemple dans chaque champ de saisie', async () => {
    await monter()
    await cliquer(host.querySelector('.en-entete-actions .en-bouton'))
    const champs = [...host.querySelectorAll('.en-champ input, .en-champ textarea')].filter(
      (c) => c.type !== 'color' && c.type !== 'number' && c.type !== 'time',
    )
    expect(champs.length).toBeGreaterThanOrEqual(5)
    for (const champ of champs) {
      expect(champ.placeholder, `${champ.id || champ.type} sans exemple`).toBeTruthy()
    }
  })

  it('garde 22 modules, chacun une vraie case à cocher', async () => {
    await monter()
    await cliquer(host.querySelector('.en-entete-actions .en-bouton'))
    const sceaux = [...host.querySelectorAll('.en-sceau')]
    expect(sceaux.length).toBe(22)
    for (const sceau of sceaux) {
      const input = sceau.querySelector('input[type="checkbox"]')
      expect(input).not.toBeNull()
      // le libellé reste accessible : le texte est dans le <label>
      expect(sceau.textContent.length).toBeGreaterThan(3)
    }
    // les cinq groupes sont annoncés avec leur compte
    const groupes = [...host.querySelectorAll('.en-sceaux-groupe')].map((g) => g.textContent)
    expect(groupes.length).toBe(6)
    expect(groupes[0]).toContain('Le pointage')
    expect(groupes[0]).toContain('0 sur 5')
  })

  it('coche un module et l’envoie à l’enregistrement', async () => {
    await monter()
    await cliquer(host.querySelector('.en-entete-actions .en-bouton'))

    const nom = host.querySelector('#en-nom')
    await act(async () => {
      const setter = Object.getOwnPropertyDescriptor(
        window.HTMLInputElement.prototype,
        'value',
      ).set
      setter.call(nom, 'EN-NOUS')
      nom.dispatchEvent(new Event('input', { bubbles: true }))
    })
    // le préfixe suit le nom tant qu'on crée
    expect(host.querySelector('#en-prefixe').value).toBe('ENN')

    const sceau = [...host.querySelectorAll('.en-sceau')].find((s) =>
      s.textContent.includes('Planning'),
    )
    await cliquer(sceau.querySelector('input[type="checkbox"]'))

    await cliquer([...host.querySelectorAll('.en-carton-pied .en-bouton')].pop())

    const insert = journal.find((j) => j.op === 'insert')
    expect(insert).toBeDefined()
    expect(insert.table).toBe('enterprises')
    expect(insert.payload.name).toBe('EN-NOUS')
    expect(insert.payload.is_active).toBe(true)
    expect(insert.payload.code).toMatch(/^ENNO\d{3}$/)
    expect(insert.payload.matricule_prefix).toBe('ENN')
    expect(insert.payload.module_planning).toBe(true)
    // tous les modules partent, même ceux restés éteints
    expect(Object.keys(insert.payload).filter((k) => k.startsWith('module_')).length).toBe(22)
  })

  it('prévient quand le pays choisi n’a pas de barème', async () => {
    await monter()
    await cliquer(host.querySelector('.en-entete-actions .en-bouton'))
    const pays = host.querySelector('#en-pays')
    const options = [...pays.options].map((o) => o.value)
    expect(options).toEqual(['', 'BJ', 'TG'])
    await act(async () => {
      const setter = Object.getOwnPropertyDescriptor(
        window.HTMLSelectElement.prototype,
        'value',
      ).set
      setter.call(pays, 'TG')
      pays.dispatchEvent(new Event('change', { bubbles: true }))
    })
    const aide = [...host.querySelectorAll('.en-aide[data-ton="alerte"]')].map((a) => a.textContent)
    expect(aide.join(' ')).toContain('zéro impôt')
  })

  it('n’enregistre pas une maison sans nom', async () => {
    await monter()
    await cliquer(host.querySelector('.en-entete-actions .en-bouton'))
    await cliquer([...host.querySelectorAll('.en-carton-pied .en-bouton')].pop())
    expect(journal.find((j) => j.op === 'insert')).toBeUndefined()
    expect(host.querySelector('.en-carton .en-avis').textContent).toContain(
      'Le nom de l’entreprise est obligatoire',
    )
  })
})

// ── 4. La suppression ──────────────────────────────────────

describe('4. la sortie du registre', () => {
  it('refuse de retirer une maison qui a encore des employés', async () => {
    await monter()
    await cliquer(host.querySelector('.en-action[data-ton="danger"]'))
    const dialogue = host.querySelector('[role="alertdialog"]')
    expect(dialogue).not.toBeNull()
    expect(dialogue.textContent).toContain('12 employés')
    const bouton = [...dialogue.querySelectorAll('button')].find((b) =>
      b.textContent.includes('Retirer du registre'),
    )
    expect(bouton.disabled).toBe(true)
    expect(journal.find((j) => j.op === 'update')).toBeUndefined()
  })

  it('retire une maison vide en douceur, sans effacer ses données', async () => {
    await monter([{ ...ENTREPRISE, employees: [{ count: 0 }] }])
    await cliquer(host.querySelector('.en-action[data-ton="danger"]'))
    const bouton = [...host.querySelectorAll('[role="alertdialog"] button')].find((b) =>
      b.textContent.includes('Retirer du registre'),
    )
    expect(bouton.disabled).toBe(false)
    await cliquer(bouton)
    const update = journal.find((j) => j.op === 'update')
    expect(update.payload).toEqual({ is_active: false })
    expect(host.querySelector('.en-avis[data-ton="succes"]')).not.toBeNull()
  })
})

// ── 5. L'habillage ─────────────────────────────────────────

describe('5. l’habillage', () => {
  it('tient dans un cadre peint, pas dans une carte générique', () => {
    expect(css).toMatch(/\.en-carte\s*\{[^}]*border:\s*2px solid var\(--en-noir\)/)
    expect(css).toMatch(/\.en-carte::before\s*\{[^}]*border:\s*1px dashed var\(--en-couture\)/)
    expect(css).toContain('.en-page.en-dark')
    // la palette de la toile
    for (const jeton of ['--en-fond', '--en-ocre', '--en-terre', '--en-encre', '--en-champ']) {
      expect(css).toContain(`${jeton}:`)
    }
  })

  it('passe au téléphone et respecte les animations réduites', () => {
    expect(css).toMatch(/@media \(max-width: 720px\)[\s\S]*\.en-champs\s*\{[^}]*grid-template-columns: minmax\(0, 1fr\)/)
    expect(css).toMatch(/@media \(max-width: 600px\)[\s\S]*\.en-actions\s*\{[^}]*width:\s*100%/)
    expect(css).toContain('@media (prefers-reduced-motion: reduce)')
  })

  it('ne montre aucun nom technique à l’écran', async () => {
    await monter()
    const texte = host.textContent
    for (const interdit of ['Auto-Close', 'ADMS', 'Geofencing', 'module_qr_scanner', 'is_active']) {
      expect(texte).not.toContain(interdit)
    }
  })
})
