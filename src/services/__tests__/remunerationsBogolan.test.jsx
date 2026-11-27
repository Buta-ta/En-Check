// ═══════════════════════════════════════════════════════════
// 🟤 LA REFONTE DES RÉMUNÉRATIONS — ce que les tests défendent
//
// Le bogolan n'est pas un décor posé sur la page : c'est la
// métaphore de la complétude. Une bande non teintée est une bande
// dont il manque un chiffre — donc un salarié qui coûte zéro dans
// les calculs.
//
//   · le motif est celui de la Paie, et le bandeau le dit ;
//   · les repères d'habitude sont à leur place (retour, entreprise,
//     action principale) — la bascule de thème et le bandeau de
//     raccourcis sont tombés le 8 novembre 2026, et les tests ci-dessous
//     défendent maintenant leur ABSENCE ;
//   · le tableau de treize colonnes n'existe plus ;
//   · « Enregistrer (n) » compte de VRAIS écarts, pas des frappes ;
//   · « Reprendre pour… » ne recopie jamais un salaire par défaut ;
//   · rien n'est écrit avant la demande.
// ═══════════════════════════════════════════════════════════

// @vitest-environment jsdom

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { renderToStaticMarkup } from 'react-dom/server'
import { MemoryRouter } from 'react-router-dom'
import { readFileSync } from 'node:fs'

import Remunerations from '../../pages/Remunerations'
import RemunerationsLoading from '../../components/RemunerationsLoading'
import PageCulturalBand from '../../components/PageCulturalBand'
import { culturalMotifForPath } from '../../components/culturalMotif'
import {
  BogolanMedaillonSvg, BogolanTeinture, BogolanLosangeSvg, BogolanPanSvg,
} from '../../components/RemunerationsBogolan'

const PAGE = readFileSync('src/pages/Remunerations.jsx', 'utf8')
const CSS = readFileSync('src/pages/Remunerations.css', 'utf8')
const CHARGEMENT = readFileSync('src/components/RemunerationsLoading.jsx', 'utf8')

/** Le corps d'une règle CSS, à partir de son sélecteur exact (en début de ligne). */
const regle = (selecteur) => {
  const propre = selecteur.replace(/\s*\{$/, '')
  const motif = new RegExp(`(^|\n)${propre.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')} \\{`)
  const trouve = motif.exec(CSS)
  expect(trouve, selecteur).not.toBeNull()
  const debut = trouve.index + trouve[1].length
  return CSS.slice(debut, CSS.indexOf('}', debut))
}
// ── la palette, résolue jusqu'au jeton ──────────────────────────────
//  Huit novembre 2026 : la page ne peint plus rien elle-même. On ne peut
//  donc plus la contrôler en lisant des hex dans sa feuille — il faut
//  suivre la chaîne complète, `--rw-*` → `--charte-*` → le thème posé à la
//  racine. Ce résolveur fait en sRGB ce que fait le navigateur, et c'est
//  lui qui juge les contrastes : la page n'a plus de couleur à montrer.
const TOKENS = readFileSync('src/styles/tokens.css', 'utf8')
const ALIAS = regle('.rw-page,\n.rw-chargement')
const sansCommentaires = (t) => t.replace(/\/\*[\s\S]*?\*\//g, '')
const racineDu = (theme) => {
  const i = TOKENS.indexOf("[data-theme='dark']")
  const blocs = sansCommentaires(TOKENS.slice(0, i))
  return theme === 'sombre' ? `${blocs}\n${sansCommentaires(TOKENS.slice(i))}` : blocs
}
const canaux = (hex) => hex.replace('#', '').match(/[0-9a-f]{2}/gi).map(v => parseInt(v, 16))
const versHex = (trois) => `#${trois.map(v => Math.round(v).toString(16).padStart(2, '0')).join('')}`
const melange = (a, b, part) => {
  const [x, y] = [a, b].map(canaux)
  return versHex(x.map((v, i) => v * part + y[i] * (1 - part)))
}
const resoudre = (valeur, theme) => {
  const ref = /^var\((--[\w-]+)\)$/.exec(valeur)
  if (ref) {
    const nom = ref[1]
    const source = nom.startsWith('--rw-') ? sansCommentaires(ALIAS) : racineDu(theme)
    const m = new RegExp(`${nom}:\\s*([^;]+);`).exec(source)
    expect(m, nom).not.toBeNull()
    return resoudre(m[1].trim(), theme)
  }
  const mix = /^color-mix\(in srgb,\s*(.+?)\s+(\d+)%,\s*(.+)\)$/.exec(valeur)
  if (mix) {
    return melange(resoudre(mix[1].trim(), theme), resoudre(mix[3].trim(), theme), Number(mix[2]) / 100)
  }
  expect(valeur, 'valeur de couleur non résolue').toMatch(/^#[0-9a-fA-F]{6}$/)
  return valeur.toLowerCase()
}
/** La couleur d'un jeton de la page, une fois mélangée au thème demandé. */
const encre = (nom, theme) => resoudre(`var(--rw-${nom})`, theme)
const luminance = (hex) => {
  const [r, g, b] = canaux(hex).map(c => c / 255)
    .map(c => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4))
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}
const contraste = (a, b) => {
  const [x, y] = [luminance(a), luminance(b)].sort((m, n) => n - m)
  return (x + 0.05) / (y + 0.05)
}

// ── la base simulée ────────────────────────────────────────
const { etat } = vi.hoisted(() => ({
  etat: { profils: [], ecritures: [], misesAJour: [] },
}))

const SOCIETE = { id: 'ent1', name: 'Kandi SARL', code: 'KANDI', currency: 'XOF', country_code: 'BJ' }

const EMPLOYES = [
  { id: 'e1', first_name: 'Kossi', last_name: 'ALABI', matricule: 'E-001', position: 'Chauffeur', department: 'Logistique', contract_type: 'CDI' },
  { id: 'e2', first_name: 'Awa', last_name: 'DOSSOU', matricule: 'E-002', position: 'Couturière', department: 'Atelier', contract_type: null },
  { id: 'e3', first_name: 'Yao', last_name: 'KPODAR', matricule: 'E-003', position: 'Chef d’équipe', department: 'Atelier', contract_type: 'CDD' },
]

const profilsDeBase = () => ([
  {
    employee_id: 'e1', salary_type: 'monthly', base_salary: 250000, hourly_rate: 0, daily_rate: 0,
    transport_allowance: 20000, housing_allowance: 0, fixed_bonus: 0,
    contract_hours_per_month: 173, contract_days_per_month: 26, overtime_eligible: true,
  },
  {
    //  e2 n'a aucun profil : c'est la bande à teindre
  },
  {
    employee_id: 'e3', salary_type: 'monthly', base_salary: 300000, hourly_rate: 0, daily_rate: 0,
    transport_allowance: 0, housing_allowance: 0, fixed_bonus: 0,
    contract_hours_per_month: 173, contract_days_per_month: 26, overtime_eligible: true,
  },
])

vi.mock('../../lib/supabase', () => {
  const requete = (table, colonnes = '') => {
    const reponse = () => {
      if (table === 'enterprises') {
        return colonnes.includes('currency')
          ? { data: SOCIETE, error: null }
          : { data: [SOCIETE], error: null }
      }
      if (table === 'employees') return { data: EMPLOYES, error: null }
      return { data: etat.profils, error: null }
    }

    const q = {
      select: (c = '') => requete(table, c),
      eq: () => q,
      order: () => Promise.resolve(reponse()),
      maybeSingle: () => Promise.resolve(reponse()),
      then: (ok, ko) => Promise.resolve(reponse()).then(ok, ko),
      upsert: (charge) => {
        etat.ecritures.push(charge)
        return Promise.resolve({ error: null })
      },
      update: (morceau) => {
        etat.misesAJour.push(morceau)
        return { eq: () => Promise.resolve({ error: null }) }
      },
    }
    return q
  }

  return { supabase: { from: (table) => requete(table) } }
})

vi.mock('../../contexts/ThemeContext', () => ({
  useTheme: () => ({ darkMode: true, toggleTheme: vi.fn() }),
}))

// ── les outils de manipulation ─────────────────────────────
const ecrire = async (element, valeur) => {
  const proto = element.tagName === 'SELECT'
    ? window.HTMLSelectElement.prototype
    : window.HTMLInputElement.prototype
  const setter = Object.getOwnPropertyDescriptor(proto, 'value').set
  await act(async () => {
    setter.call(element, valeur)
    element.dispatchEvent(new window.Event(
      element.tagName === 'SELECT' ? 'change' : 'input', { bubbles: true }
    ))
  })
}

const clic = async (element) => {
  await act(async () => {
    element.dispatchEvent(new window.MouseEvent('click', { bubbles: true }))
  })
}

const texte = (el) => (el?.textContent || '').replace(/\s+/g, ' ')

describe('1. le motif est celui de la Paie, et le bandeau le dit', () => {
  it('la route des rémunérations porte le pagne de boue', () => {
    expect(culturalMotifForPath('/remunerations')).toBe('bogolan')
    expect(culturalMotifForPath('/remunerations/')).toBe('bogolan')
    expect(culturalMotifForPath('/remunerations?ent=e1')).toBe('bogolan')
    //  la même famille que la page qu'elle nourrit
    expect(culturalMotifForPath('/paie')).toBe('bogolan')
    expect(culturalMotifForPath('/fiches-paie')).toBe('bogolan')
  })

  it('le bandeau est le vrai fichier bogolan, pas une image inventée', () => {
    const html = renderToStaticMarkup(<PageCulturalBand pathname="/remunerations" />)
    expect(html).toContain('data-cultural-motif="bogolan"')
    const bandCss = readFileSync('src/components/PageCulturalBand.css', 'utf8')
    expect(bandCss).toContain(
      ".ec-cultural-band[data-cultural-motif='bogolan'] { background-image: url('/images/paie-bogolan-haut.webp')"
    )
    expect(bandCss).toContain(
      ".ec-cultural-band[data-cultural-motif='bogolan'].ec-cultural-bottom { background-image: url('/images/paie-bogolan-bas.webp')"
    )
    //  et la page en pose deux : en haut et en bas
    expect(PAGE).toContain('<PageCulturalBand pathname="/remunerations" />')
    expect(PAGE).toContain('<PageCulturalBand pathname="/remunerations" placement="bottom" />')
  })

  it('le chargement emploie le même motif que la page', () => {
    const html = renderToStaticMarkup(<RemunerationsLoading onSkip={() => {}} />)
    expect(html).toContain('data-cultural-motif="bogolan"')
    expect(html).toContain('ec-cultural-top')
  })
})

describe('2. les repères sont toujours à la même place', () => {
  it('retour en premier, entreprise en dernier — et plus de bascule', () => {
    const entete = PAGE.slice(PAGE.indexOf('<header className="rw-entete">'), PAGE.indexOf('</header>'))
    expect(entete.indexOf('rw-retour')).toBeGreaterThan(-1)
    //  le sélecteur d'entreprise reste l'objet le plus à droite de l'en-tête
    expect(entete.indexOf('rw-entreprise')).toBeGreaterThan(entete.indexOf('rw-retour'))
    expect(entete.indexOf('rw-entreprise')).toBeLessThan(entete.indexOf('Recharger les rémunérations'))
    //  la bascule de thème est tombée avec le bouton : le thème se règle
    //  dans le rail, comme sur le contrat de temps (overtimeBrandAlignment)
    expect(entete).not.toContain('toggleTheme')
    expect(entete).not.toContain('aria-checked={darkMode}')
    expect(entete).not.toContain('role="switch"')
    //  le carré de l'en-tête a gardé la case du kit, pour les deux boutons
    const carre = regle('.rw-retour,\n.rw-cadre')
    expect(carre).toContain('width: var(--rw-cadre);')
    expect(carre).toContain('height: var(--rw-cadre);')
    expect(carre).toContain('border: var(--rw-trait) solid var(--rw-ligne-forte);')
    expect(carre).toContain('border-radius: var(--charte-rayon-champ);')
  })

  it('le bandeau de raccourcis est tombé : le rail les dit déjà', () => {
    //  la page ne monte plus le composant, n'en garde plus la classe, et
    //  son seuil ne promet plus d'« accès rapides » qu'il ne montre pas
    expect(PAGE).not.toContain('RaccourcisPages')
    expect(PAGE).not.toContain('rw-raccourcis')
    expect(CSS).not.toContain('rw-raccourcis')
    expect(PAGE).toContain('aria-label="Entreprise, devise, période"')
    //  le raccourci clavier, lui, est un service rendu — pas un meuble :
    //  il reste collé au bouton qui écrit, dans la barre d'assemblage
    expect(PAGE).toContain('className="rw-touche"')
    expect(PAGE).toContain('raccourci.current = vue === \'contrats\' ? enregistrerTout : null')
    //  et le tableau de bord n'a pas bougé d'un pouce
    expect(PAGE).toContain("onClick={() => navigate('/dashboard')}")
  })

  it('l’action principale est une barre collée en bas, pas un bouton du fond', () => {
    expect(CSS).toMatch(/\.rw-barre \{[^}]*position: fixed;/s)
    expect(CSS).toMatch(/\.rw-barre \{[^}]*bottom: 18px;/s)
    expect(PAGE).toContain('className="rw-barre"')
    //  elle n'apparaît que s'il y a quelque chose à écrire
    expect(PAGE).toMatch(/\{modifications > 0 && \(/)
  })

  it('la page n’entretient pas un second thème à côté du global', () => {
    //  ce que défend ce verrou n'est pas « la page ignore le thème » mais
    //  « la page n'en tient pas un deuxième » : une classe locale, un
    //  `data-theme` posé par l'écran, l'ancre `encheck.theme`, une échelle
    //  de couleurs parallèle. Le rail décide, la page obéit aux jetons.
    expect(CSS).not.toContain('rw-clair')
    expect(PAGE).not.toContain('rw-clair')
    expect(PAGE).not.toContain('data-theme=')
    expect(PAGE).not.toContain('encheck.theme')
    expect(PAGE).not.toMatch(/<button[^>]*onClick=\{toggleTheme\}/)
    expect(CSS).not.toMatch(/Mode (sombre|clair)/)
    //  la page s'appelle elle-même, sans condition
    expect(PAGE).toContain('<div className="rw-page">')
    //  `color-scheme` se pose sur le champ qui prête sa liste, jamais sur
    //  la page : le système n'est pas une affaire d'écran
    expect(regle('.rw-page :is(input, select)')).toContain('color-scheme: light dark')
    expect(ALIAS).not.toContain('color-scheme')
    //  et le chargeur, qui monte hors de la page, relit la même couche
    expect(CHARGEMENT).not.toContain('darkMode')
    expect(CSS).toMatch(/\.rw-page,\n\.rw-chargement \{/)
  })
})

describe('3. le tableau de treize colonnes n’existe plus', () => {
  it('aucun tableau, aucune case à cocher nue', () => {
    expect(PAGE).not.toContain('<table')
    expect(PAGE).not.toContain('type="checkbox"')
    expect(PAGE).toContain('className="rw-interrupteur"')
    expect(PAGE).toContain("aria-checked={f.overtime_eligible !== false}")
    expect(CSS).toContain(".rw-interrupteur[aria-checked='true'] .rw-interrupteur-piste")
  })

  it('l’ancien décor ne revient pas : ni indigo, ni fond bleuté, ni carte blanche', () => {
    for (const interdit of ['#4F46E5', '#F8FAFC', '#EEF2FF', '#0F172A', '#6366F1', '#8B5CF6']) {
      expect(PAGE.toLowerCase(), interdit).not.toContain(interdit.toLowerCase())
      expect(CSS.toLowerCase(), interdit).not.toContain(interdit.toLowerCase())
    }
    //  la palette de la page ne s'écrit plus, elle se relit dans le kit :
    //  douze jetons traversent la feuille, et c'est tout ce qu'on lui demande
    for (const nom of ['sable', 'surface', 'surface2', 'tissu', 'encre', 'douce',
      'aplat', 'texte', 'bordure', 'succes', 'alerte', 'erreur']) {
      expect(CSS, `--charte-${nom}`).toContain(`var(--charte-${nom})`)
    }
    expect(CHARGEMENT).not.toMatch(/#[0-9a-fA-F]{3,8}/)
  })

  it('la page n’a plus de styles en ligne : tout vit dans la feuille', () => {
    expect(PAGE).not.toContain('const S = {')
    expect(PAGE).not.toContain('style={S.')
    expect(PAGE).toContain("import './Remunerations.css'")
  })
})

describe('4. les quatre pièces du motif ont un rôle', () => {
  it('chaque pièce est un SVG décoratif, sans texte inventé', () => {
    const pieces = [
      renderToStaticMarkup(<BogolanMedaillonSvg />),
      renderToStaticMarkup(<BogolanTeinture remplis={1} total={3} />),
      renderToStaticMarkup(<BogolanLosangeSvg />),
      renderToStaticMarkup(<BogolanPanSvg />),
    ]
    for (const html of pieces) {
      expect(html).toContain('<svg')
      expect(html).toContain('aria-hidden="true"')
      expect(html).toContain('focusable="false"')
    }
  })

  it('la jauge de teinture compte exactement les cases remplies', () => {
    for (const [remplis, total] of [[0, 3], [1, 3], [2, 3], [3, 3], [9, 3]]) {
      const html = renderToStaticMarkup(<BogolanTeinture remplis={remplis} total={total} />)
      expect(html.match(/<rect/g)).toHaveLength(3)
      expect(html).toContain(`data-remplis="${Math.min(remplis, 3)}"`)
    }
  })

  it('le médaillon garde les trois tons du pagne', () => {
    for (const ton of ['cuivre', 'craie', 'boue']) {
      expect(renderToStaticMarkup(<BogolanMedaillonSvg ton={ton} />)).toContain('<svg')
    }
    //  un ton inconnu retombe sur le cuivre plutôt que de casser
    expect(renderToStaticMarkup(<BogolanMedaillonSvg ton="inconnu" />)).toContain('<svg')
  })

  it('le chargement est dessiné, jamais photographié', () => {
    const html = renderToStaticMarkup(<RemunerationsLoading onSkip={() => {}} />)
    expect(html).not.toContain('<img')
    expect(html).toContain('rw-tenture')
    expect(html).toMatch(/rw-pan rw-pan-[1-6]/)
    expect(html).toContain('role="status"')
    expect(html).toContain('Passer l’animation')
    //  et il s'arrête pour qui préfère ne pas voir d'animation
    expect(CSS).toContain('@media (prefers-reduced-motion: reduce)')
    expect(CSS).toMatch(/\.rw-pan \{\s*animation: none;/)
  })
})

describe('5. la page se monte et se lit', () => {
  let hote
  let racine

  const monter = async () => {
    hote = document.createElement('div')
    document.body.append(hote)
    racine = createRoot(hote)
    await act(async () => {
      racine.render(<MemoryRouter><Remunerations /></MemoryRouter>)
    })
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1600)
    })
  }

  beforeEach(() => {
    vi.useFakeTimers()
    globalThis.IS_REACT_ACT_ENVIRONMENT = true
    window.localStorage.setItem('admin', JSON.stringify({ role: 'super_admin' }))
    etat.profils = profilsDeBase()
    etat.ecritures = []
    etat.misesAJour = []
  })

  afterEach(async () => {
    if (racine) await act(async () => racine.unmount())
    hote?.remove()
    racine = null
    vi.useRealTimers()
  })

  const bande = (nom) => [...hote.querySelectorAll('.rw-bande')]
    .find(b => texte(b).includes(nom))

  it('la coque, les mesures, les bandes sont là — et plus de raccourcis', async () => {
    await monter()

    expect(hote.querySelector('.rw-page')).not.toBeNull()
    expect(hote.querySelector('[data-cultural-motif="bogolan"]')).not.toBeNull()
    expect(hote.querySelector('h1').textContent).toContain('Rémunérations')
    //  quatre mesures, pas trois
    expect(hote.querySelectorAll('.rw-mesure')).toHaveLength(4)
    //  une bande par salarié
    expect(hote.querySelectorAll('.rw-bande')).toHaveLength(3)
    expect(hote.querySelector('[data-testid="raccourcis-pages"]')).toBeNull()
    //  et le pied de page en bogolan
    expect(hote.querySelector('.ec-cultural-bottom')).not.toBeNull()
  })

  it('la bande annonce ce qui manque, sans le dire en jargon', async () => {
    await monter()

    const kossi = bande('Kossi ALABI')
    expect(kossi).not.toBeNull()
    expect(texte(kossi)).toContain('à jour')
    expect(kossi.querySelector('.rw-manque')).toBeNull()
    //  trois cases de teinture, toutes pleines
    expect(kossi.querySelector('[data-testid="bogolan-teinture"]').dataset.remplis).toBe('3')

    const awa = bande('Awa DOSSOU')
    expect(texte(awa.querySelector('.rw-manque'))).toContain('le type de contrat')
    expect(texte(awa.querySelector('.rw-manque'))).toContain('la base mensuelle')
    expect(texte(awa.querySelector('.rw-manque'))).toContain('les heures du mois')
    expect(awa.querySelector('[data-testid="bogolan-teinture"]').dataset.remplis).toBe('0')
    expect(awa.dataset.etat).toBe('incomplet')
  })

  it('le coût de l’heure se déduit de la base et des heures', async () => {
    await monter()

    //  250 000 ÷ 173 = 1 445,09
    const cout = texte(bande('Kossi ALABI').querySelector('.rw-cout'))
    expect(cout).toContain('1 445')
    //  300 000 ÷ 173 = 1 734,10
    expect(texte(bande('Yao KPODAR').querySelector('.rw-cout'))).toContain('1 734')
    //  sans heures, aucun coût inventé
    expect(texte(bande('Awa DOSSOU').querySelector('.rw-cout'))).toContain('—')
  })

  it('les filtres séparent ce qui est prêt de ce qui manque', async () => {
    await monter()

    expect(hote.querySelectorAll('.rw-bande')).toHaveLength(3)

    const aCompleter = [...hote.querySelectorAll('.rw-filtre')]
      .find(b => b.textContent.includes('À compléter'))
    expect(texte(aCompleter)).toContain('(1)')
    await clic(aCompleter)

    expect(hote.querySelectorAll('.rw-bande')).toHaveLength(1)
    expect(texte(hote.querySelector('.rw-bande'))).toContain('Awa DOSSOU')

    const toutes = [...hote.querySelectorAll('.rw-filtre')].find(b => b.textContent.includes('Toutes'))
    await clic(toutes)
    expect(hote.querySelectorAll('.rw-bande')).toHaveLength(3)
  })

  it('la recherche suit le nom, le matricule et le poste', async () => {
    await monter()

    const champ = hote.querySelector('.rw-recherche input')
    await ecrire(champ, 'atelier')
    expect(hote.querySelectorAll('.rw-bande')).toHaveLength(2)

    await ecrire(champ, 'E-003')
    expect(hote.querySelectorAll('.rw-bande')).toHaveLength(1)
    expect(texte(hote.querySelector('.rw-bande'))).toContain('Yao KPODAR')

    await ecrire(champ, 'zzz')
    expect(hote.querySelectorAll('.rw-bande')).toHaveLength(0)
    expect(hote.textContent).toContain('Aucun salarié ne correspond')
  })
})

describe('6. « Enregistrer » compte de vrais écarts, pas des frappes', () => {
  let hote
  let racine

  const monter = async () => {
    hote = document.createElement('div')
    document.body.append(hote)
    racine = createRoot(hote)
    await act(async () => {
      racine.render(<MemoryRouter><Remunerations /></MemoryRouter>)
    })
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1600)
    })
  }

  beforeEach(() => {
    vi.useFakeTimers()
    globalThis.IS_REACT_ACT_ENVIRONMENT = true
    window.localStorage.setItem('admin', JSON.stringify({ role: 'super_admin' }))
    etat.profils = profilsDeBase()
    etat.ecritures = []
    etat.misesAJour = []
  })

  afterEach(async () => {
    if (racine) await act(async () => racine.unmount())
    hote?.remove()
    racine = null
    vi.useRealTimers()
  })

  const champDe = (nom, libelle) => hote.querySelector(`[aria-label="${libelle} de ${nom}"]`)

  it('au chargement, rien n’est modifié et rien n’est écrit', async () => {
    await monter()
    expect(hote.querySelector('.rw-barre')).toBeNull()
    expect(etat.ecritures).toHaveLength(0)
  })

  it('taper puis revenir à la valeur d’origine ne salit pas la page', async () => {
    await monter()
    const champ = champDe('Kossi ALABI', 'Mensuelle')

    await ecrire(champ, '999')
    expect(hote.querySelector('.rw-barre')).not.toBeNull()
    expect(texte(hote.querySelector('.rw-barre'))).toContain('1 ligne modifiée')

    await ecrire(champ, '250000')
    expect(hote.querySelector('.rw-barre')).toBeNull()
  })

  it('la barre annonce le nombre exact de bandes touchées', async () => {
    await monter()
    await ecrire(champDe('Kossi ALABI', 'Mensuelle'), '300000')
    await ecrire(champDe('Yao KPODAR', 'Mensuelle'), '350000')

    expect(texte(hote.querySelector('.rw-barre'))).toContain('2 lignes modifiées')
    expect(hote.querySelector('.rw-barre').textContent).toContain('(2)')
    //  et le rappel du raccourci clavier
    expect(hote.querySelector('.rw-touche')).not.toBeNull()
  })

  it('enregistrer tout n’écrit que les bandes modifiées, avec les bonnes valeurs', async () => {
    await monter()
    await ecrire(champDe('Kossi ALABI', 'Mensuelle'), '300000')

    const bouton = hote.querySelector('.rw-barre .ch-btn-pleine')
    await clic(bouton)

    expect(etat.ecritures).toHaveLength(1)
    expect(etat.ecritures[0]).toMatchObject({
      employee_id: 'e1',
      enterprise_id: 'ent1',
      salary_type: 'monthly',
      base_salary: 300000,
      contract_hours_per_month: 173,
      transport_allowance: 20000,
    })
    //  la nature du contrat n'est réécrite que si elle est connue
    expect(etat.misesAJour.some(m => m.contract_type === 'CDI')).toBe(true)
    //  et la page redevient propre
    expect(hote.querySelector('.rw-barre')).toBeNull()
  })

  it('⌘S / Ctrl+S enregistre aussi, sans quitter la page', async () => {
    await monter()
    await ecrire(champDe('Yao KPODAR', 'Mensuelle'), '310000')

    await act(async () => {
      window.dispatchEvent(new window.KeyboardEvent('keydown', { key: 's', ctrlKey: true, bubbles: true }))
    })

    expect(etat.ecritures).toHaveLength(1)
    expect(etat.ecritures[0].base_salary).toBe(310000)
  })

  it('le rythme choisi décide de ce qui est exigé', async () => {
    await monter()
    const rythme = hote.querySelector('[aria-label="Rythme de paie de Awa DOSSOU"]')
    await ecrire(rythme, 'hourly')

    const awa = [...hote.querySelectorAll('.rw-bande')].find(b => texte(b).includes('Awa DOSSOU'))
    const manque = texte(awa.querySelector('.rw-manque'))
    expect(manque).toContain('le taux horaire')
    expect(manque).toContain('les heures du mois')
    expect(manque).not.toContain('la base mensuelle')
  })
})

describe('7. « Reprendre pour… » ne recopie jamais un salaire par défaut', () => {
  let hote
  let racine

  const monter = async () => {
    hote = document.createElement('div')
    document.body.append(hote)
    racine = createRoot(hote)
    await act(async () => {
      racine.render(<MemoryRouter><Remunerations /></MemoryRouter>)
    })
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1600)
    })
  }

  beforeEach(() => {
    vi.useFakeTimers()
    globalThis.IS_REACT_ACT_ENVIRONMENT = true
    window.localStorage.setItem('admin', JSON.stringify({ role: 'super_admin' }))
    etat.profils = profilsDeBase()
    etat.ecritures = []
    etat.misesAJour = []
  })

  afterEach(async () => {
    if (racine) await act(async () => racine.unmount())
    hote?.remove()
    racine = null
    vi.useRealTimers()
  })

  const ouvrir = async (nom) => {
    const bande = [...hote.querySelectorAll('.rw-bande')].find(b => texte(b).includes(nom))
    const bouton = [...bande.querySelectorAll('.rw-bouton')]
      .find(b => texte(b).includes('Reprendre'))
    await clic(bouton)
    return hote.querySelector('.rw-modale')
  }

  it('la modale s’ouvre avec les bons champs cochés', async () => {
    await monter()
    const modale = await ouvrir('Kossi ALABI')

    expect(modale).not.toBeNull()
    expect(modale.getAttribute('aria-modal')).toBe('true')

    const puce = (libelle) => [...modale.querySelectorAll('.rw-champ-puce')]
      .find(b => b.textContent.trim() === libelle)

    //  ce qui se recopie sans risque
    for (const libelle of ['Heures', 'Transport', 'Le rythme', 'Heures supp.']) {
      expect(puce(libelle).getAttribute('aria-pressed'), libelle).toBe('true')
    }
    //  et ce qui ne se recopie pas par accident
    for (const libelle of ['Base mensuelle', 'Taux horaire', 'Taux journalier']) {
      expect(puce(libelle).getAttribute('aria-pressed'), libelle).toBe('false')
    }
    expect(modale.textContent).toContain('un salaire ne se recopie pas par défaut')
  })

  it('appliquer remplit les bandes choisies, sans rien écrire en base', async () => {
    await monter()
    const modale = await ouvrir('Kossi ALABI')

    const destinataire = [...modale.querySelectorAll('.rw-appliquer-item')]
      .find(b => texte(b).includes('Awa DOSSOU'))
    await clic(destinataire)
    expect(destinataire.getAttribute('aria-pressed')).toBe('true')

    const reprendre = [...modale.querySelectorAll('.rw-modale-pied .ch-btn-pleine')]
      .find(b => texte(b).includes('Reprendre'))
    await clic(reprendre)

    //  rien n'est parti à la base
    expect(etat.ecritures).toHaveLength(0)
    expect(hote.querySelector('.rw-modale')).toBeNull()

    //  les heures et le transport sont repris…
    expect(hote.querySelector('[aria-label="Heures / mois de Awa DOSSOU"]').value).toBe('173')
    expect(hote.querySelector('[aria-label="Transport de Awa DOSSOU"]').value).toBe('20000')
    //  …mais pas le salaire de Kossi
    expect(hote.querySelector('[aria-label="Mensuelle de Awa DOSSOU"]').value).toBe('')
    //  et la bande est bien marquée comme modifiée
    expect(texte(hote.querySelector('.rw-barre'))).toContain('1 ligne modifiée')
  })

  it('sans destinataire, rien ne se passe et on le dit', async () => {
    await monter()
    const modale = await ouvrir('Kossi ALABI')
    const reprendre = [...modale.querySelectorAll('.rw-modale-pied .ch-btn-pleine')]
      .find(b => texte(b).includes('Reprendre'))
    await clic(reprendre)
    //  la modale reste ouverte : on n'a rien appliqué
    expect(hote.querySelector('.rw-modale')).not.toBeNull()
  })
})

describe('8. le texte reste lisible, et la page n’a plus qu’une palette', () => {
  //  plus de thème local : les deux thèmes sont ceux du kit, et c'est le
  //  résolveur du haut de fichier qui les va-et-vient. Un seuil de 4,5 est
  //  une loi, pas une préférence : il se vérifie sur les deux.
  const FONDS = ['nuit', 'panneau', 'panneau-2', 'creux']
  const NIVEAUX = ['encre', 'douce', 'faible']

  for (const theme of ['clair', 'sombre']) {
    it(`les trois niveaux de texte passent 4,5:1 sur les quatre fonds (${theme})`, () => {
      for (const niveau of NIVEAUX) {
        for (const fond of FONDS) {
          expect(contraste(encre(niveau, theme), encre(fond, theme)), `${theme} · ${niveau} sur ${fond}`)
            .toBeGreaterThanOrEqual(4.5)
        }
      }
    })

    it(`l’accent écrit, les états et le texte d’un pan remplis tiennent (${theme})`, () => {
      //  le cuivre ÉCRIT est l'argile écrite du kit ; le cuivre PEINT est
      //  une figure et se juge à 3:1. Deux métiers, deux jetons.
      for (const fond of FONDS) {
        expect(contraste(encre('ocre', theme), encre(fond, theme)), `${theme} · écrit/${fond}`)
          .toBeGreaterThanOrEqual(4.5)
      }
      for (const fond of ['nuit', 'panneau', 'creux']) {
        expect(contraste(encre('cuivre', theme), encre(fond, theme)), `${theme} · peint/${fond}`)
          .toBeGreaterThanOrEqual(3)
      }
      for (const etat of ['ok', 'attente', 'alerte']) {
        expect(contraste(encre(etat, theme), encre('creux', theme)), `${theme} · ${etat}/creux`)
          .toBeGreaterThanOrEqual(4.5)
      }
      expect(contraste(encre('sur-cuivre', theme), encre('boue', theme)), `${theme} · texte sur un pan`)
        .toBeGreaterThanOrEqual(4.5)
    })
  }

  it('la feuille ne peint rien : toute couleur est un alias du kit', () => {
    expect(CSS).not.toMatch(/#[0-9a-fA-F]{3,8}\b/)
    expect(CSS).not.toMatch(/rgba?\(/)
    for (const nom of ['nuit', 'panneau', 'panneau-2', 'creux', 'encre', 'douce', 'faible',
      'cuivre', 'ocre', 'boue', 'ligne', 'ligne-forte', 'ok', 'attente', 'alerte', 'sur-cuivre']) {
      expect(ALIAS, `--rw-${nom}`).toContain(`--rw-${nom}:`)
    }
    //  un alias qui SERAIT une couleur = la charte au second degré
    expect(ALIAS).not.toMatch(/--rw-[a-z-]+:\s*#/)
    expect(ALIAS).not.toMatch(/--rw-[a-z-]+:\s*rgba?\(/)
  })
})

describe('9. le ton reste professionnel', () => {
  //  Les formules du carnet de croquis n'ont rien à faire dans un outil
  //  de paie : « le pagne de boue », « on teint le pagne »…
  const INTERDITS = [/pagne/i, /teint/i, /tiss/i, /\bboue\b/i, /couture/i]

  let hote
  let racine

  beforeEach(async () => {
    vi.useFakeTimers()
    globalThis.IS_REACT_ACT_ENVIRONMENT = true
    window.localStorage.setItem('admin', JSON.stringify({ role: 'super_admin' }))
    etat.profils = profilsDeBase()
    etat.ecritures = []
    etat.misesAJour = []
    hote = document.createElement('div')
    document.body.append(hote)
    racine = createRoot(hote)
    await act(async () => {
      racine.render(<MemoryRouter><Remunerations /></MemoryRouter>)
    })
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1600)
    })
  })

  afterEach(async () => {
    if (racine) await act(async () => racine.unmount())
    hote?.remove()
    racine = null
    vi.useRealTimers()
  })

  it('aucune formule d’atelier dans ce que lit l’utilisateur', () => {
    const visible = texte(hote)
    expect(visible.length).toBeGreaterThan(200)
    for (const interdit of INTERDITS) {
      expect(visible, String(interdit)).not.toMatch(interdit)
    }
  })

  it('ni dans l’écran de chargement', () => {
    const html = renderToStaticMarkup(<RemunerationsLoading onSkip={() => {}} />)
    const vu = html
      .replace(/<[^>]+>/g, ' ')
      .replace(/&[a-z]+;/g, ' ')
      .replace(/\s+/g, ' ')
    for (const interdit of INTERDITS) {
      expect(vu, String(interdit)).not.toMatch(interdit)
    }
    //  il dit ce qu'il fait, sans scène
    expect(vu).toContain('Chargement des rémunérations')
  })

  it('l’écran de chargement ne contient plus la formule d’atelier', () => {
    expect(CHARGEMENT).not.toContain('Le pagne de boue')
    expect(CHARGEMENT).not.toContain('On teint')
    expect(PAGE).not.toContain('Le pagne de boue')
  })

  it('la page dit « ligne » et « salarié », pas « bande »', () => {
    const visible = texte(hote)
    expect(visible).not.toMatch(/\bbandes?\b/i)
    //  mais les classes internes peuvent garder leur nom
    expect(CSS).toContain('.rw-bande')
  })
})

describe('10. le survol ne dégrade jamais la lisibilité', () => {
  const lireRegle = (selecteur) => regle(selecteur)

  it('survoler une ligne ne repeint plus le fond derrière les textes', () => {
    //  c'était la cause : le fond de la ligne variait sous les libellés
    //  de 9 px, et les cases s'y fondaient
    const survol = lireRegle('.rw-bande:hover')
    expect(survol).not.toContain('background')
    expect(survol).toContain('border-bottom-color')

    //  la tranche de gauche, elle, n'a aucun texte : elle peut changer
    expect(lireRegle('.rw-bande:hover .rw-bande-teinture')).toContain('background')
  })

  it('survoler une case ne change ni son fond ni la couleur de son texte', () => {
    const survol = lireRegle('.rw-case:hover')
    expect(survol).not.toContain('background')
    //  seuls des traits bougent
    expect(survol).toContain('border-color')

    //  le texte garde explicitement sa couleur de repos
    expect(lireRegle('.rw-case:hover .rw-case-champ')).toContain('color: var(--rw-encre)')
  })

  it('aucun champ n’est dimmé par une opacité', () => {
    //  à 72 %, le libellé tombait à 2,8:1 en clair
    expect(CSS).not.toMatch(/\.rw-case\[data-actif='non'\] \{[^}]*opacity/s)
    expect(regle(".rw-case[data-actif='non']")).toContain('border-style: dashed')
  })

  it('la case reste un champ : fond distinct de la ligne, dans les deux thèmes', () => {
    expect(regle('.rw-case')).toContain('background: var(--rw-creux)')
    //  les champs natifs ne reçoivent plus d'avis depuis la page : ils
    //  relisent le thème du système, et c'est le seul `color-scheme` ici
    expect(regle('.rw-page :is(input, select)')).toContain('color-scheme: light dark')
    expect(CSS.match(/color-scheme:/g)).toHaveLength(1)
    //  aucun fond natif ne peut se peindre par-dessus
    expect(regle('.rw-case-champ')).toContain('appearance: none')
  })

  it('le texte tient 4,5:1 sur le fond des cases et sur la case du rythme', () => {
    //  la case du rythme se teinte de 6 % de cuivre dans le creux : le
    //  lavis est un mélange colorimétrique, pas une opacité — il ne
    //  traversera donc jamais la ligne, et il se retourne avec le thème
    expect(regle('.rw-case[data-actif=\'oui\']')).toContain('color-mix(in srgb, var(--rw-cuivre) 6%, var(--rw-creux))')
    for (const theme of ['clair', 'sombre']) {
      const teinte = resoudre('color-mix(in srgb, var(--rw-cuivre) 6%, var(--rw-creux))', theme)
      const creux = encre('creux', theme)
      for (const niveau of ['encre', 'douce', 'faible']) {
        expect(contraste(encre(niveau, theme), creux), `${theme} ${niveau}/creux`)
          .toBeGreaterThanOrEqual(4.5)
        expect(contraste(encre(niveau, theme), teinte), `${theme} ${niveau}/case active`)
          .toBeGreaterThanOrEqual(4.5)
      }
    }
  })
})

describe('11. le brut adouci : l’encre, la bosse et rien d’autre', () => {
  //  Un contour de deux pixels ET une ombre franche sans flou posées sur le
  //  même objet — jamais deux anneaux l’un dans l’autre. C'est la loi que la
  //  feuille du contrat de temps s'est donnée ; la page s'y plie aux mêmes
  //  endroits, et le contrôle est littéral : la feuille ne contient plus un
  //  seul chiffre là où le kit a un jeton.
  const BOGOLAN_SRC = readFileSync('src/components/RemunerationsBogolan.jsx', 'utf8')
  //  un commentaire n'est pas une déclaration : la feuille est d'abord
  //  vidée de ses notes, sinon on se met à défendre ce qu'elle RAconte
  const DECL = CSS.replace(/\/\*[\s\S]*?\*\//g, '')

  it('aucun contour de un pixel, aucune ombre floue', () => {
    expect(DECL.match(/border[^;:]*:\s*1px/g)).toBeNull()
    expect(DECL).not.toMatch(/box-shadow:[^;]*\d+px \d+px \d+px/)
    //  les ombres de la page, c'est le jeton, ou rien
    const ombres = [...DECL.matchAll(/box-shadow:\s*([^;]+);/g)].map(m => m[1].trim())
    expect(ombres.length).toBeGreaterThan(4)
    for (const ombre of ombres) {
      expect(ombre, ombre).toMatch(
        /^(var\(--charte-ombre-dure\)|none|inset 0 0 0 var\(--rw-trait\) var\(--rw-[a-z0-9-]+\)|0 0 0 var\(--charte-espace-2\) var\(--rw-[a-z0-9-]+\))$/
      )
    }
  })

  it('les rayons, les tailles et les pas viennent du kit', () => {
    //  le seul rayon écrit en chiffre est le 0 du grain de trame
    const bruts = [...CSS.matchAll(/border-radius:\s*([^;]+);/g)]
      .map(m => m[1].trim())
      .filter(v => /^\d/.test(v))
    expect(bruts, bruts.join(' · ')).toEqual(['0'])
    expect(CSS).not.toMatch(/font-size:\s*[\d.]+px/)
    expect(CSS).not.toMatch(/(gap|padding|margin)(-[a-z]+)?:\s*[\d.]+px/)
    //  et le fond de la page ne sepeint pas d'un dégradé d'atelier
    expect(CSS).not.toMatch(/radial-gradient/)
    expect(CSS).not.toMatch(/backdrop-filter/)
  })

  it('la page ne connaît ni l’opacité qui délaye, ni l’important qui force', () => {
    expect(DECL).not.toMatch(/!important/)
    //  deux `opacity` hors des boucles de dessin, et une seule affaire : le
    //  pan de teinture qui n'est pas encore peint (`0`), et son repli (`1`)
    //  quand la préférence demande l'animation coupée. Aucun texte délayé —
    //  pour pâlit on mélange, on n'efface pas
    const opacites = [...DECL.matchAll(/(?:^|\n)\s*opacity:\s*([^;]+);/g)].map(m => m[1].trim())
    expect(opacites, opacites.join(' · ')).toEqual(['0', '1'])
  })

  it('le motif a gardé son dessin et perdu sa palette', () => {
    expect(BOGOLAN_SRC).not.toMatch(/#[0-9a-fA-F]{3,8}/)
    expect(BOGOLAN_SRC).not.toMatch(/rgba?\(/)
    //  les quatre signes sont toujours là, par classe
    for (const classe of ['rw-bo-cadre', 'rw-bo-losange', 'rw-bo-points', 'rw-bo-case', 'rw-bo-pan']) {
      //  des ancres entre guillemets : `rw-bo-points` est l'amorce de
      //  `rw-bo-points-doux`, et une aiguille sans borne se satisfait des deux
      expect(BOGOLAN_SRC, classe).toContain(`"${classe}"`)
      expect(CSS, classe).toContain(`.${classe} {`)
    }
    //  trois tons nommés, et le pigment se décide dans la feuille
    expect(BOGOLAN_SRC).toContain('rw-bogolan--${ton}')
    for (const ton of ['rw-bogolan--craie', 'rw-bogolan--boue']) {
      expect(CSS).toContain(`.${ton}`)
    }
  })

  it('un seul bouton plein par écran, et c’est celui du kit', () => {
    //  une barre par vue, jamais une barre par écran : les deux vues ne
    //  s'affichent pas ensemble, chacune a DONC sa pleine action à soi
    expect(PAGE.match(/className="rw-barre"/g)).toHaveLength(2)
    const pleines = [...PAGE.matchAll(/className="ch-btn-pleine"/g)]
    expect(pleines).toHaveLength(3)
    //  jamais un `rw-bouton` ne se remplit d'argile en plus : la pleine
    //  action de l'écran est unique, les autres restent en creux
    expect(PAGE).not.toContain('rw-bouton-principal')
    expect(CSS).not.toContain('.rw-bouton-principal')
  })
})
