// ═══════════════════════════════════════════════════════════
// 🧶 LA REFONTE DES JOURS FÉRIÉS — ce que les tests défendent
//
// Le motif du Lesotho n'est pas un décor posé sur une page : la page
// entière en découle. Ces tests tiennent les points qui cassent
// silencieusement une refonte :
//
//   · le bandeau suit la route et reste la même identité que Pauses ;
//   · la lisière de l'année place chaque fête au bon mois, y compris
//     les fêtes récurrentes ramenées à l'année affichée ;
//   · le chargement est dessiné, pas photographié ;
//   · le vieux décor violet ne revient pas par une porte dérobée ;
//   · les contrôles sont dessinés (interrupteurs), pas des cases.
// ═══════════════════════════════════════════════════════════

// @vitest-environment jsdom

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { renderToStaticMarkup } from 'react-dom/server'
import { MemoryRouter } from 'react-router-dom'
import { readFileSync } from 'node:fs'
import JoursFeries from '../../pages/JoursFeries'
import PageCulturalBand from '../../components/PageCulturalBand'
import { culturalMotifForPath } from '../../components/culturalMotif'
import JoursFeriesAnnee from '../../components/JoursFeriesAnnee'
import JoursFeriesLoading from '../../components/JoursFeriesLoading'
import {
  LesothoSceauSvg,
  LesothoLosangeSvg,
  LesothoCoutureSvg,
  LesothoLisiereSvg,
} from '../../components/LesothoMotif'

//  Les services sont simulés : on teste la page, pas la base.
const { basculer } = vi.hoisted(() => ({ basculer: vi.fn(async () => ({ success: true })) }))

vi.mock('../../lib/supabase', () => ({
  supabase: {
    from: (table) => {
      const lignes = table === 'enterprises'
        ? [{ id: 'e1', name: 'Kandi SARL', code: 'KANDI' }]
        : [{ id: 'p1', name: 'Ouverture de l’usine', date: '2026-03-09', is_recurring: false, is_worked: false, overtime_rate: 100 }]
      const requete = {
        select: () => requete,
        eq: () => requete,
        order: () => Promise.resolve({ data: lignes, error: null }),
      }
      return requete
    },
  },
}))

vi.mock('../../contexts/ThemeContext', () => ({
  useTheme: () => ({ darkMode: true, toggleTheme: vi.fn() }),
}))

vi.mock('../../services/holidayService', async (importOriginal) => {
  const original = await importOriginal()
  return {
    ...original,
    default: {
      getGlobalHolidays: async () => [
        { id: 'g1', name: 'Fête de l’Indépendance', date: '1960-08-01', is_recurring: true, country_code: 'ZZ', is_worked: false, overtime_rate: 100 },
        { id: 'g2', name: 'Noël', date: '2024-12-25', is_recurring: true, country_code: 'ZZ', is_worked: false, overtime_rate: 100 },
      ],
      getEnterpriseOverrides: async () => [],
      toggleGlobalHoliday: basculer,
    },
  }
})

const PAGE = readFileSync('src/pages/JoursFeries.jsx', 'utf8')
const CSS = readFileSync('src/pages/JoursFeries.css', 'utf8')
const BAND_CSS = readFileSync('src/components/PageCulturalBand.css', 'utf8')

const globalHolidays = [
  { id: 'g1', name: 'Fête de l’Indépendance', date: '1960-08-01', is_recurring: true, country_code: 'ZZ', is_worked: false, overtime_rate: 100 },
  { id: 'g2', name: 'Noël', date: '2024-12-25', is_recurring: true, country_code: 'ZZ', is_worked: false, overtime_rate: 100 },
  { id: 'g3', name: 'Journée des Martyrs', date: '2026-01-16', is_recurring: false, country_code: 'ZZ', is_worked: true, overtime_rate: 50 },
]

const ownHolidays = [
  { id: 'p1', name: 'Ouverture de l’usine', date: '2026-03-09', is_recurring: false, is_worked: false, overtime_rate: 100 },
]

describe('1. le bandeau suit la page, et c’est bien le Lesotho', () => {
  it('la route des jours fériés porte le motif du textile', () => {
    expect(culturalMotifForPath('/jours-feries')).toBe('lesotho')
    expect(culturalMotifForPath('/jours-feries?annee=2026')).toBe('lesotho')
    expect(culturalMotifForPath('/jours-feries/')).toBe('lesotho')
    //  la même identité que Pauses, et pas un repli sur le Kente
    expect(culturalMotifForPath('/pauses')).toBe('lesotho')
  })

  it('le bandeau est un vrai bandeau Lesotho, pas une image inventée', () => {
    const html = renderToStaticMarkup(<PageCulturalBand pathname="/jours-feries" />)
    expect(html).toContain('data-cultural-motif="lesotho"')
    expect(html).toContain('ec-cultural-top')
    expect(BAND_CSS).toContain(".ec-cultural-band[data-cultural-motif='lesotho'] { background-image: url('/images/pauses-lesotho.webp')")
    //  même hauteur que les autres pages, et le filet du bas
    expect(BAND_CSS).toContain('.ec-cultural-band { width: 100%; height: 76px;')
    expect(BAND_CSS).toContain('.ec-cultural-bottom { height: 32px; }')
  })

  it('la page et son chargement portent tous les deux le bandeau', () => {
    expect(PAGE).toContain('<PageCulturalBand pathname="/jours-feries" />')
    const html = renderToStaticMarkup(<JoursFeriesLoading darkMode />)
    expect(html.match(/data-cultural-motif="lesotho"/g)).toHaveLength(2)
    expect(html).toContain('ec-cultural-bottom')
  })
})

describe('2. la lisière de l’année place chaque fête', () => {
  const html = renderToStaticMarkup(
    <JoursFeriesAnnee
      annee={2026}
      globalHolidays={globalHolidays}
      ownHolidays={ownHolidays}
      isGlobalEnabled={() => true}
      prochain={{ jour: 16, mois: 0 }}
    />
  )

  it('les douze mois sont tissés', () => {
    expect(html.match(/class="jf-annee-mois"/g)).toHaveLength(12)
    for (const mois of ['janv.', 'févr.', 'mars', 'juin', 'juil.', 'déc.']) {
      expect(html).toContain(mois)
    }
  })

  it('une fête récurrente est ramenée à l’année affichée', () => {
    //  1960-08-01 doit tomber en août 2026, pas en 1960
    expect(html).toContain('1 août — Fête de l’Indépendance')
    expect(html).toContain('25 décembre — Noël')
  })

  it('une fête datée d’une autre année ne s’affiche pas', () => {
    //  « Journée des Martyrs » est datée de 2026 : elle doit être là
    expect(html).toContain('16 janvier — Journée des Martyrs, fête du pays, travaillée')
    //  mais pas en 2027
    const autre = renderToStaticMarkup(
      <JoursFeriesAnnee annee={2027} globalHolidays={globalHolidays} ownHolidays={[]} />
    )
    expect(autre).not.toContain('Journée des Martyrs')
    //  les récurrentes, elles, suivent
    expect(autre).toContain('1 août — Fête de l’Indépendance')
  })

  it('les fêtes de l’entreprise se distinguent de celles du pays', () => {
    expect(html).toContain('data-origine="entreprise"')
    expect(html).toContain('9 mars — Ouverture de l’usine, fête de l’entreprise')
  })

  it('la prochaine fête, si elle tombe après l’année affichée, est dite à côté', () => {
    const html = renderToStaticMarkup(
      <JoursFeriesAnnee
        annee={2026}
        globalHolidays={globalHolidays}
        ownHolidays={[]}
        noteSuivante="La prochaine fête tombe en 2027 : lundi 1 février 2027."
      />
    )
    expect(html).toContain('La prochaine fête tombe en 2027')
    expect(html).toContain('jf-annee-suite')
  })

  it('une fête désactivée est marquée comme telle', () => {
    const desactive = renderToStaticMarkup(
      <JoursFeriesAnnee annee={2026} globalHolidays={globalHolidays} ownHolidays={[]} isGlobalEnabled={id => id !== 'g2'} />
    )
    expect(desactive).toContain('25 décembre — Noël, fête du pays, désactivée')
  })
})

describe('3. le chargement est dessiné', () => {
  const html = renderToStaticMarkup(<JoursFeriesLoading darkMode onSkip={() => {}} />)

  it('aucune photographie : une scène vectorielle', () => {
    expect(html).not.toContain('<img')
    expect(html).toContain('<svg')
    expect(html).toContain('jf-metier')
    expect(html).toContain('jf-metier-navette')
    expect(html).toContain('jf-metier-trame')
  })

  it('il annonce ce qu’il fait, et ne prétend rien de plus', () => {
    expect(html).toContain('role="status"')
    expect(html).toContain('Chargement des jours fériés du pays et de ceux de votre entreprise.')
    expect(html).toContain('Aucune date n’est')
    expect(html).toContain('Passer l’animation')
  })

  it('il s’arrête pour qui préfère ne pas voir d’animation', () => {
    expect(CSS).toContain('@media (prefers-reduced-motion: reduce)')
    expect(CSS).toMatch(/\.jf-metier-trame \{\s*animation: none;/)
    expect(CSS).toMatch(/\.jf-losange \{\s*animation: none;\s*opacity: 1;/)
  })
})

describe('4. le vieux décor ne revient pas', () => {
  it('plus de violet, plus de fond nocturne d’origine', () => {
    expect(PAGE).not.toMatch(/#8b5cf6/i)
    expect(PAGE).not.toMatch(/#7c3aed/i)
    expect(PAGE).not.toMatch(/#0a0a0f/i)
    expect(PAGE).not.toMatch(/rgba\(139,\s*92,\s*246/i)
    expect(CSS).not.toMatch(/#8b5cf6/i)
    expect(CSS).not.toMatch(/linear-gradient\(135deg,\s*#8b5cf6/i)
    //  et aucune orbite décorative de l'ancienne page
    expect(PAGE).not.toContain('bgOrb')
  })

  it('les couleurs viennent du textile : indigo, crème, terre cuite', () => {
    for (const couleur of ['#14263c', '#efe7d7', '#b4622a', '#8b3e1d', '#08151f']) {
      expect(CSS.toLowerCase()).toContain(couleur)
    }
  })

  it('la page a bien deux thèmes, et pas un seul fond sombre', () => {
    expect(CSS).toContain('.jf-page.jf-clair {')
    expect(PAGE).toContain("className={`jf-page${darkMode ? '' : ' jf-clair'}`}")
    expect(PAGE).toContain("aria-checked={darkMode}")
    expect(PAGE).toContain("role=\"switch\"")
  })

  it('les contrôles sont dessinés, pas des cases à cocher', () => {
    expect(PAGE).not.toContain('type="checkbox"')
    expect(PAGE).toContain('className="jf-interrupteur"')
    expect(PAGE).toContain("aria-checked={active}")
    expect(PAGE).toContain("aria-pressed={form.is_recurring}")
    expect(PAGE).toContain("aria-pressed={form.is_worked}")
    expect(CSS).toContain('.jf-interrupteur[aria-checked=\'true\']::after')
  })
})

describe('5. les autres écrans restent à portée', () => {
  it('les raccourcis de page sont dans la coque', () => {
    expect(PAGE).toContain("import RaccourcisPages from '../components/RaccourcisPages'")
    expect(PAGE).toContain('<RaccourcisPages compact excludePaths={[\'/jours-feries\']} />')
    expect(CSS).toContain('.jf-raccourcis .abs-raccourci')
  })

  it('l’explication est repliée, pas imposée', () => {
    expect(PAGE).toContain('<details className="jf-explication">')
    expect(PAGE).toContain('Ce qu’un jour férié change dans les calculs')
  })
})

describe('6. les cinq pièces du motif se dessinent', () => {
  it('chaque pièce est un SVG décoratif, sans texte inventé', () => {
    const pieces = [
      renderToStaticMarkup(<LesothoSceauSvg />),
      renderToStaticMarkup(<LesothoLosangeSvg />),
      renderToStaticMarkup(<LesothoCoutureSvg />),
      renderToStaticMarkup(<LesothoLisiereSvg />),
    ]
    for (const html of pieces) {
      expect(html).toContain('<svg')
      expect(html).toContain('aria-hidden="true"')
      expect(html).toContain('focusable="false"')
    }
    //  la lisière s'étire : elle ne doit pas se déformer au passage
    expect(pieces[3]).toContain('preserveAspectRatio="none"')
  })

  it('le sceau garde les trois tons du textile', () => {
    for (const ton of ['indigo', 'terre', 'craie']) {
      expect(renderToStaticMarkup(<LesothoSceauSvg ton={ton} />)).toContain('<svg')
    }
    //  un ton inconnu retombe sur la terre cuite plutôt que de casser
    expect(renderToStaticMarkup(<LesothoSceauSvg ton="inexistant" />)).toContain('<svg')
  })
})

describe('7. le texte reste lisible dans les deux thèmes', () => {
  const luminance = (hex) => {
    const [r, g, b] = hex.replace('#', '').match(/[0-9a-f]{2}/gi)
      .map(h => parseInt(h, 16) / 255)
      .map(c => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4))
    return 0.2126 * r + 0.7152 * g + 0.0722 * b
  }
  const contraste = (a, b) => {
    const [x, y] = [luminance(a), luminance(b)].sort((m, n) => n - m)
    return (x + 0.05) / (y + 0.05)
  }
  const bloc = (selecteur) => {
    const debut = CSS.indexOf(selecteur)
    expect(debut).toBeGreaterThan(-1)
    const fin = CSS.indexOf('}', debut)
    return CSS.slice(debut, fin)
  }
  const jeton = (source, nom) => {
    const m = source.match(new RegExp(`--jf-${nom}: (#[a-fA-F0-9]{6});`))
    expect(m, nom).not.toBeNull()
    return m[1]
  }

  it('les trois niveaux de texte passent 4,5:1, en sombre comme en clair', () => {
    const sombre = bloc('.jf-page {')
    const clair = bloc('.jf-page.jf-clair {')

    for (const [source, nom] of [[sombre, 'sombre'], [clair, 'clair']]) {
      const fonds = [jeton(source, 'panneau'), jeton(source, 'nuit')]
      for (const niveau of ['craie', 'craie-douce', 'craie-faible']) {
        for (const fond of fonds) {
          expect(
            contraste(jeton(source, niveau), fond),
            `${nom} · ${niveau} sur ${fond}`
          ).toBeGreaterThanOrEqual(4.5)
        }
      }
      //  le petit texte d'accent (l'eyebrow) doit tenir aussi
      expect(contraste(jeton(source, 'terre-clair'), jeton(source, 'panneau')), nom).toBeGreaterThanOrEqual(4.5)
    }
  })

  it('le bouton de suppression garde un texte lisible sur son rouge', () => {
    expect(contraste('#fff6ea', '#a83226')).toBeGreaterThanOrEqual(4.5)
  })
})

describe('8. la page se monte et répond', () => {
  let hote
  let racine

  beforeEach(async () => {
    vi.useFakeTimers()
    globalThis.IS_REACT_ACT_ENVIRONMENT = true
    window.localStorage.setItem('admin', JSON.stringify({
      role: 'admin',
      enterprise_id: 'e1',
      selectedEnterprise: { id: 'e1', name: 'Kandi SARL' },
    }))
    hote = document.createElement('div')
    document.body.append(hote)
    racine = createRoot(hote)

    await act(async () => {
      racine.render(<MemoryRouter><JoursFeries /></MemoryRouter>)
    })
    //  le plancher du chargement (1 400 ms) puis les lectures
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1600)
    })
  })

  afterEach(async () => {
    await act(async () => racine.unmount())
    hote.remove()
    vi.useRealTimers()
    basculer.mockClear()
  })

  it('la coque s’affiche avec son bandeau, son titre et ses mesures', () => {
    expect(hote.querySelector('.jf-page')).not.toBeNull()
    expect(hote.querySelector('[data-cultural-motif="lesotho"]')).not.toBeNull()
    expect(hote.querySelector('h1').textContent).toContain('Jours fériés')
    expect(hote.querySelectorAll('.jf-mesure')).toHaveLength(4)
    expect(hote.querySelector('.jf-annee')).not.toBeNull()
    expect(hote.querySelector('[data-testid="raccourcis-pages"]')).not.toBeNull()
  })

  it('le registre du pays liste les fêtes, avec un interrupteur dessiné', () => {
    expect(hote.querySelectorAll('.jf-jour')).toHaveLength(2)
    const interrupteur = hote.querySelector('.jf-interrupteur')
    expect(interrupteur).not.toBeNull()
    expect(interrupteur.getAttribute('role')).toBe('switch')
    expect(interrupteur.getAttribute('aria-checked')).toBe('true')
    //  aucune case à cocher native dans la page
    expect(hote.querySelector('input[type="checkbox"]')).toBeNull()
  })

  it('l’interrupteur bascule la fête pour cette entreprise', async () => {
    const interrupteur = hote.querySelector('.jf-interrupteur')
    await act(async () => {
      interrupteur.dispatchEvent(new window.MouseEvent('click', { bubbles: true }))
    })
    expect(basculer).toHaveBeenCalledWith('e1', 'g1', false)
  })

  it('un pays absent du catalogue affiche son code, sans drapeau inventé', async () => {
    //  les données de test portent « ZZ » : un code que le catalogue ignore
    //  (le Bénin, lui, y est entré : c'est le modèle de fêtes du round 19)
    const pastille = [...hote.querySelectorAll('.jf-pays-puce')]
      .find(b => b.textContent.includes('ZZ'))
    expect(pastille).toBeTruthy()
    expect(pastille.querySelector('.jf-pays-drapeau')).toBeNull()
    //  la ligne de registre affiche le code, pas un globe générique
    const meta = hote.querySelector('.jf-jour-meta')
    expect(meta.textContent).toContain('ZZ')
    expect(meta.textContent).not.toContain('🌍')
  })

  it('le second registre montre les fêtes de l’entreprise', async () => {
    const ongletMaison = hote.querySelector('#jf-onglet-maison')
    await act(async () => {
      ongletMaison.dispatchEvent(new window.MouseEvent('click', { bubbles: true }))
    })
    expect(ongletMaison.getAttribute('aria-selected')).toBe('true')
    expect(hote.textContent).toContain('Ouverture de l’usine')
    expect(hote.querySelector('.jf-jour[data-origine="entreprise"]')).not.toBeNull()
  })

  it('les deux registres portent leur onglet et leur panneau', () => {
    expect(hote.querySelector('[role="tablist"]')).not.toBeNull()
    expect(hote.querySelector('#jf-onglet-pays').getAttribute('aria-selected')).toBe('true')
    expect(hote.querySelector('#jf-registre-pays')).not.toBeNull()
  })
})
