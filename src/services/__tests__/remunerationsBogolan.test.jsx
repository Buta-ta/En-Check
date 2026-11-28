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
    //  la page n'en pose plus qu'un : celui du bas. Le bandeau du haut est
    //  tombé quand l'en-tête est devenu une planche qui se cadre elle-même,
    //  et la couture de pointillés qui le doublait avec lui
    expect(PAGE).not.toContain('<PageCulturalBand pathname="/remunerations" />')
    expect(PAGE).toContain('<PageCulturalBand pathname="/remunerations" placement="bottom" />')
    expect(PAGE).not.toContain('rw-bordure')
    expect(CSS).not.toContain('.rw-bordure')
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
    //  la sidebar est revenue avec son rail : la fabrique de la maison, pas
    //  une seconde barre écrite à la main dans la page
    expect(hote.querySelector('aside[aria-label="Rubriques"]')).not.toBeNull()
    expect(hote.querySelector('.sb-rail')).not.toBeNull()
    expect(hote.querySelector('[data-cultural-motif="bogolan"]')).not.toBeNull()
    expect(hote.querySelector('h1').textContent).toContain('Rémunérations')
    //  quatre mesures, pas trois
    expect(hote.querySelectorAll('.rw-mesure')).toHaveLength(4)
    //  une bande par salarié
    expect(hote.querySelectorAll('.rw-bande')).toHaveLength(3)
    expect(hote.querySelector('[data-testid="raccourcis-pages"]')).toBeNull()
    //  et le pied de page en bogolan
    expect(hote.querySelector('.ec-cultural-bottom')).not.toBeNull()
    //  l'en-tête est un bloc cerclé d'étoffe, posé DANS la coque. Le tissu est
    //  peint par la feuille : le DOM du bloc ne porte qu'un seul enfant, son
    //  corps — pas de span de bandeau à côté, ni de doublure à entretenir
    const entete = hote.querySelector('.rw-entete')
    expect(entete.children).toHaveLength(1)
    expect(entete.firstElementChild.className).toBe('rw-entete-corps')
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
    //  les ombres de la page, c'est le jeton, ou rien — et la liste n'a plus
    //  AUCUNE exception : la planche rognée emportait avec elle ses trois
    //  traits internes, le seul `box-shadow` non jeton de la feuille. Tenue
    //  littéralement, pour qu'aucun flou ne se glisse dans un trou en douce.
    const ombres = [...DECL.matchAll(/box-shadow:\s*([^;]+);/g)]
      .map(m => m[1].replace(/\s+/g, ' ').trim())
    expect(ombres.length).toBeGreaterThan(4)
    for (const ombre of ombres) {
      expect(ombre, ombre).toMatch(
        /^(var\(--charte-ombre-dure\)|none|inset 0 0 0 var\(--rw-trait\) var\(--rw-[a-z0-9-]+\)|0 0 0 var\(--charte-espace-2\) var\(--rw-[a-z0-9-]+\))$/
      )
    }
    //  l'ombre du bloc cerclé est le jeton du kit, posé sur le calque du tissu
    //  une seule fois : pas de seconde chute peinte à la main par-dessus
    expect(CSS).toMatch(/\.rw-entete::before \{[^}]*box-shadow: var\(--charte-ombre-dure\);/s)
    expect(CSS).toMatch(/\.rw-entete::after \{[^}]*\}/s)
    expect(CSS.match(/\.rw-entete[^:]*::after \{[^}]*box-shadow/g)).toBeNull()
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

// ═══════════════════════════════════════════════════════════
// 12. L'ENVELOPPE — LE TISSU FAIT LE TOUR DU BLOC
//     8/12, après la maquette : « quand je disais entourer, je veux que ça
//     ressemble à ça ». Le mot d'ordre n'est pas deux bandes, c'est un CERCLE.
// ═══════════════════════════════════════════════════════════
describe('12. l’enveloppe : le tissu fait le tour du bloc', () => {
  const DECL12 = CSS.replace(/\/\*[\s\S]*?\*\//g, '')
  const regle12 = (selecteur) => {
    const i = DECL12.indexOf(`\n${selecteur} {`)
    if (i < 0) return null
    return DECL12.slice(i, DECL12.indexOf('}', i))
  }
  const CAGE = regle12('.rw-entete')
  const TISSU = regle12('.rw-entete::before')
  const PLAQUE = regle12('.rw-entete::after')

  it('le bloc est cerclé, pas souligné', () => {
    expect(CAGE, 'la cage').not.toBeNull()
    //  posée dans la colonne de la coque, jamais collée aux bords de l'écran
    expect(CAGE).toContain('width: var(--rw-colonne)')
    expect(CAGE).toMatch(/margin: [^;]*var\(--charte-espace-\d\) auto/)
    expect(CAGE).not.toMatch(/border-bottom/)
    //  LE tissu EST la marge intérieure : une seule cote pour les quatre côtés
    expect(CAGE).toContain('padding: var(--rw-tissu)')
    //  le fond plat est la seule chose que la cage peigne, et il est là pour
    //  le collage : sans lui, le contenu passerait VU dans les encoches des
    //  quatre coins (la loi est à §14). Pas d'image, pas de dégradé ici —
    //  le raccourci `background` suffirait à en poser un.
    expect(CAGE).toContain('background-color: var(--rw-nuit)')
    expect(CAGE).not.toMatch(/\bbackground(?!-color)|linear-gradient/)
    //  et la cage ne rogne rien : `.empv3-entete` le dit en toutes lettres,
    //  un `overflow: hidden` ici couperait l'ombre dure du bloc
    expect(CAGE).not.toMatch(/overflow:\s*hidden/)
    //  les deux calques sont dessous le contenu, sinon les boutons disparaissent
    expect(CAGE).toContain('isolation: isolate')
    expect(TISSU).toContain('z-index: -2')
    expect(PLAQUE).toContain('z-index: -1')
    expect(PAGE).toContain('className="rw-entete"')
    //  et le tissu n'est pas un objet du DOM : un `<span>` de bandeau serait
    //  un second entourage, posé à côté de celui de la feuille
    expect(PAGE).not.toContain('rw-entete-bandeau')
    expect(CSS).not.toContain('rw-entete-bandeau')
  })

  it('quatre côtés, pas deux', () => {
    expect(TISSU, 'le tissu').not.toBeNull()
    //  une couche par bord : deux horizontales, deux verticales
    expect(TISSU).toContain('background-repeat: repeat-x, repeat-x, repeat-y, repeat-y')
    expect(TISSU).toContain('background-position: left top, left bottom, left top, right top')
    const images = TISSU.slice(TISSU.indexOf('background-image'), TISSU.indexOf('background-repeat'))
    expect((images.match(/var\(--rw-tissu-haut\)/g) || [])).toHaveLength(2)
    expect((images.match(/var\(--rw-tissu-filet\)/g) || [])).toHaveLength(2)
    //  la bande ne flotte pas : elle est à cru sur les quatre bords du bloc
    const i = TISSU.indexOf('inset')
    expect(TISSU.slice(i, TISSU.indexOf(';', i))).toBe('inset: 0')
  })

  it('le motif est celui de la maison, à échelle uniforme', () => {
    //  les deux fichiers que lit déjà `.e360-tete` de la fiche salarié
    const fiche = readFileSync('src/pages/Employee360.css', 'utf8')
    for (const [juron, fichier] of [
      ['--rw-tissu-haut', 'paie-bogolan-haut.webp'],
      ['--rw-tissu-filet', 'bogolan-vertical.webp'],
    ]) {
      expect(CSS, juron).toContain(`${juron}: url('/images/${fichier}')`)
      expect(fiche, `${fichier} est le fichier de la maison`).toContain(fichier)
    }
    //  C4 : chaque couche est ramenée à la cote sur UN seul axe, `auto` sur
    //  l'autre — une échelle uniforme, jamais un 100% qui écrase le tissage
    const taille = TISSU.slice(TISSU.indexOf('background-size'))
    expect(taille).toContain('auto var(--rw-tissu), auto var(--rw-tissu),')
    expect(taille).toContain('var(--rw-tissu) auto, var(--rw-tissu) auto')
    expect(taille).not.toMatch(/100%/)
    //  et la cote est un pas d'échelle de la maison, pas un chiffre de la page
    const d = CSS.indexOf('--rw-tissu:')
    expect(CSS.slice(d, CSS.indexOf(';', d))).toContain('var(--charte-espace-5)')
  })

  it('les quatre coins sont pleins, et l’ombre est une seule', () => {
    //  là où les deux fichiers se rejoignent : le fond du bogolan, pas un trou
    expect(TISSU).toContain('background-color: var(--charte-tissu)')
    //  le trait dur du kit, à flou zéro — le « double passage de feutre »
    expect(TISSU).toContain('box-shadow: var(--charte-ombre-dure)')
    expect(TISSU).not.toMatch(/box-shadow:[^;]*\d+px \d+px [1-9]/)
    //  une seule ombre pour le bloc : ni seconde chute, ni lavis sous la plaque
    expect(CSS).not.toContain('--rw-chute')
    expect(PLAQUE).not.toMatch(/box-shadow|filter:/)
    expect(PLAQUE).not.toMatch(/translate/)
  })

  it('la plaque est du papier reculé, pas une planche meublée', () => {
    expect(PLAQUE, 'la plaque').not.toBeNull()
    //  `inset` au jeton d'épaisseur : si la bande change de cote, la plaque
    //  suit seule — quatre marges seraient quatre chiffres à entretenir
    expect(PLAQUE).toContain('inset: var(--rw-tissu)')
    expect(PLAQUE).toContain('background: var(--rw-panneau)')
    //  ni coupe, ni clou, ni trait : le contour du bloc, c'est le tissage
    expect(PLAQUE).not.toMatch(/clip-path|border:|box-shadow/)
    for (const tombe of ['--rw-coupe', '--rw-billet', '--rw-coings', '--rw-filetage',
      '--rw-agrafe', 'clip-path: var(--rw-billet)']) {
      expect(DECL12, `${tombe} est tombé avec la planche`).not.toContain(tombe)
    }
    //  et le rythme du bloc a bien descendu dans le corps, pas sur la cage
    const corps = regle12('.rw-entete-corps')
    expect(corps).toContain('padding: var(--charte-espace-4) var(--charte-espace-5)')
  })

  it('le cartouche de l’entreprise est entouré, pas barré', () => {
    const cart = regle12('.rw-entreprise')
    expect(cart).toContain('border: var(--rw-trait) solid var(--rw-cuivre)')
    expect(cart).not.toMatch(/border-left:/)
    //  et le tiers droit porte une souche, qui tombe sur petit écran
    const droite = regle12('.rw-entete-droite')
    expect(droite).toContain('border-left: var(--rw-trait) solid var(--rw-ligne)')
    const repli = DECL12.slice(DECL12.indexOf('@media (max-width: 760px)'))
    expect(repli.slice(0, repli.indexOf('}', repli.indexOf('.rw-entete-droite'))))
      .toContain('border-left: 0')
  })

  it('sur petit écran, l’étoffe ne maigrit pas', () => {
    const repli = DECL12.slice(DECL12.indexOf('@media (max-width: 760px)'))
    const fin = repli.indexOf('}', repli.indexOf('.rw-entete-corps'))
    expect(repli.slice(0, fin)).toContain('padding: var(--charte-espace-3)')
    //  aucune règle ne redescend `--rw-tissu` : la bande reste à sa cote
    expect(repli).not.toMatch(/--rw-tissu:/)
    expect(repli).not.toMatch(/\.rw-entete \{[^}]*padding:/)
  })
})

// ═══════════════════════════════════════════════════════════
// 13. LE RAIL DE LA MAISON
// ═══════════════════════════════════════════════════════════
describe('13. la page est montée dans la fabrique de la maison', () => {
  const rail = () => {
    const d = PAGE.indexOf('<SidebarUnique')
    return PAGE.slice(d, PAGE.indexOf('/>', d))
  }

  it('la page est montée dans la fabrique de la maison', () => {
    expect(PAGE).toContain('<CoqueAdmin')
    expect(PAGE).toContain('sidebar={')
    expect(PAGE).toContain('<SidebarUnique')
    expect(PAGE).toContain('sections={sectionsNav}')
    expect(PAGE).toContain('sectionsNavAdmin({')
    //  le rail n'a PAS les vues de la page : deux interrupteurs pour la même
    //  lampe, et l'un des deux mentirait (la leçon de `Planning.jsx`)
    expect(rail(), 'le rail ne reçoit pas `vues`').not.toMatch(/\bvues=/)
    expect(rail()).not.toMatch(/\bvueActive=/)
  })

  it('le rail porte le profil des entreprises', () => {
    expect(rail()).toContain('entreprises={societes}')
    expect(rail()).toContain('entrepriseActive={entrepriseActive}')
    expect(rail()).toContain('surEntreprise={surEntreprise}')
    //  la cause de la panne du 26/11 : sans la colonne, la pastille n'a rien
    //  à signer et retombe sur la lettre
    const q = PAGE.indexOf('const chargerEntreprises')
    const requete = PAGE.slice(q, PAGE.indexOf('setSocietes(data', q))
    expect(requete).toContain(".select('id, name, code, logo_url')")
    //  et le rail passe par le SEUL chemin de la page : l'identifiant, et
    //  l'effet qui le regarde recharge tout
    expect(PAGE).toContain('if (id === selectedEntId) return')
    expect(PAGE).toContain('setSelectedEntId(id)')
    expect(PAGE).toMatch(/if \(selectedEntId\) chargerTout\(selectedEntId\)/)
    const q2 = PAGE.indexOf('const surEntreprise')
    const corps = PAGE.slice(q2, PAGE.indexOf('\n  }', q2))
    expect(corps, 'un second chemin de chargement, et la réponse en retard de '
      + "l'entreprise quittée écrit sur la nouvelle").not.toContain('chargerTout')
  })

  it('le rail commande le thème, la page ne se rhabille pas', () => {
    //  `useTheme()` est revenu dans la page, et c'est voulu : non pas pour
    //  l'habiller, mais pour brancher la commande du rail. Le verrou du 26/12
    //  tenait autre chose — un SECOND thème entretenu par l'écran.
    expect(PAGE).toContain('const { darkMode, toggleTheme } = useTheme()')
    expect(rail()).toContain('darkMode={darkMode}')
    expect(rail()).toContain('surTheme={toggleTheme}')
    const d = PAGE.indexOf('<SidebarUnique')
    const horsRail = PAGE.slice(0, d) + PAGE.slice(PAGE.indexOf('/>', d) + 2)
    //  le seul `toggleTheme` hors du rail est LA déstructure qui l'alimente :
    //  ni bouton, ni props d'habillage
    expect(horsRail.match(/toggleTheme/g), horsRail.slice(0, 40)).toHaveLength(1)
    expect(horsRail).not.toMatch(/onClick=\{toggleTheme\}/)
    expect(horsRail).not.toMatch(/darkMode=\{darkMode\}/)
    expect(PAGE.match(/toggleTheme/g)).toHaveLength(2)
    expect(PAGE).not.toContain('data-theme=')
    expect(PAGE).not.toContain('encheck.theme')
    expect(PAGE).not.toMatch(/<button[^>]*onClick=\{toggleTheme\}/)
  })
})

// ═══════════════════════════════════════════════════════════
// 14. LE BLOC RESTE EN HAUT, LE RESTE GLISSE DESSOUS
//     8/12 : « je veux que tu maintiennes ce bloc-là fixe et tout le reste va
//     glisser dedans quand je scrolle — en desktop, mobile et tablette ».
//     Une seule façon de le tenir sans se mentir : le coller EN CSS, et
//     vérifier que rien, dans la page ni autour, ne peut défaire le collage.
// ═══════════════════════════════════════════════════════════
describe('14. le bloc est collé en haut, le reste défile dessous', () => {
  const DECL14 = CSS.replace(/\/\*[\s\S]*?\*\//g, '')
  const regle14 = (source, selecteur) => {
    const i = source.indexOf(`\n${selecteur} {`)
    if (i < 0) return null
    return source.slice(i, source.indexOf('}', i))
  }
  const CAGE = regle14(DECL14, '.rw-entete')
  //  tous les blocs @media de la feuille, avec leur corps borné à la main :
  //  `indexOf('}')` rendrait un tronc dès qu'une règle imbriquée (`@supports`,
  //  `@media` dans `@media`) apparaît dans le palier
  const MEDIAS = []
  for (const m of DECL14.matchAll(/@media[^{]+\{/g)) {
    let profondeur = 1
    let i = m.index + m[0].length
    while (i < DECL14.length && profondeur > 0) {
      if (DECL14[i] === '{') profondeur += 1
      else if (DECL14[i] === '}') profondeur -= 1
      i += 1
    }
    MEDIAS.push({ tete: m[0].trim(), corps: DECL14.slice(m.index + m[0].length, i) })
  }
  const etages = (selecteur) => {
    const r = regle14(DECL14, selecteur)
    return r ? parseInt(/z-index:\s*(\d+)/.exec(r)[1], 10) : null
  }

  it('collé en CSS : sticky, à zéro, pas fixed', () => {
    expect(CAGE, 'la cage').not.toBeNull()
    expect(CAGE).toMatch(/position:\s*sticky/)
    expect(CAGE).toContain('top: 0')
    //  `fixed` aurait demandé trois choses en double : la hauteur à compenser
    //  sur le contenu, la mesure au redimensionnement, et le geste du retour
    expect(CAGE).not.toMatch(/position:\s*fixed/)
    //  et `top: 0` et pas 8 px : tout centimètre laissé entre le bord de
    //  l'écran et le bloc est un couloir où le contenu continue de courir
    expect(CAGE).not.toMatch(/top:\s*(?!0)[1-9]/)
    //  à `sticky` seulement — ni `scroll-snap`, ni `position: -webkit-sticky`
    //  de rattrapage : la propriété est tenue depuis 2017
    expect(CSS).not.toMatch(/-webkit-sticky|scroll-snap/)
  })

  it('le collage est un mot de la feuille, pas un montage', () => {
    //  pas de porteuse ajoutée pour l'occasion autour de l'en-tête
    expect(PAGE).toMatch(/<div className="rw-page">\s*\{\/\*[\s\S]*?\*\/\}\s*<header className="rw-entete">/)
    //  pas d'écouteur de défilement, pas d'observateur, pas de mesure : ce
    //  qu'on ne calcule pas ne se déracine pas au redimensionnement
    for (const interdit of ['onScroll', "addEventListener('scroll'", 'IntersectionObserver',
      'getBoundingClientRect', 'scrollTop']) {
      expect(PAGE, interdit).not.toContain(interdit)
    }
    //  et le bloc reste un seul enfant, collé avec son propre contenu
    expect(PAGE).toContain('<div className="rw-entete-corps">')
    //  la marge haute est gardée : au repos le bloc n'est pas collé, il est
    //  posé — c'est le défilement qui l'amène au bord
    expect(CAGE).toMatch(/margin: var\(--charte-espace-\d\) auto/)
  })

  it('le cache est opaque, et au jeton', () => {
    //  sans fond, le contenu passe dans les six pixels des encoches arrondies
    expect(CAGE).toContain('background-color: var(--rw-nuit)')
    //  le fond est celui de la page, pas une couleur écrite à la main
    expect(CSS).toMatch(/--rw-nuit: var\(--charte-sable\);/)
    //  et le rayon du cache est LE RAYON DU BLOC : une seule mesure pour
    //  l'étoffe et pour son fond, sinon les encoches se redécalent
    expect(CAGE).toContain('border-radius: var(--rw-rayon-bloc)')
    expect(regle14(DECL14, '.rw-entete::before')).toContain('border-radius: var(--rw-rayon-bloc)')
    expect(CSS).toMatch(/--rw-rayon-bloc: var\(--charte-rayon-champ\)/)
  })

  it('coller le bloc ne le fait pas passer devant ce qui se pose dessus', () => {
    const ETAGE = etages('.rw-entete')
    expect(CAGE, "coller, c'est aussi se donner un étage").toContain('z-index: 20')
    expect(Number.isInteger(ETAGE), 'un étage explicite, sinon le voile du mois '
      + 'passerait devant un bloc collé sans étage').toBe(true)
    //  l'île que la cage se donne — les enfants de l'en-tête ne montent pas
    //  plus haut que lui, et lui ne monte pas plus haut qu'un autre îlot
    expect(CAGE).toContain('isolation: isolate')
    //  l'échelle déjà écrite par la page : voile du mois, registre, barre
    //  d'assemblage, modale — le bloc collé reste SOUS les quatre
    for (const dessus of ['.rw-mois-voile', '.rw-mois-liste', '.rw-barre', '.rw-voile']) {
      expect(etages(dessus), `${dessus} doit rester au-dessus du bloc collé`)
        .toBeGreaterThan(ETAGE)
    }
    //  et le rail : collé lui aussi, à 74, plus haut que nous — c'est le bon
    //  sens, et c'est la correction d'un accident déjà vécu (à 2, le bandeau
    //  collant du Planning, à 60, passait devant le registre ouvert). Les
    //  deux ne se recouvrent pas — le rail est une colonne, le bloc est centré
    //  dans la sienne —, mais sur téléphone replié le rail commande le bas de
    //  l'écran : si l'un des deux devait passer devant l'autre, ce n'est pas
    //  l'en-tête. Le registre d'entreprises, lui, est PORTÉ HORS DU RAIL
    //  (`.se-liste--flottante`, `fixed`, à 78) et n'a donc rien à négocier.
    const rail = readFileSync('src/components/SidebarUnique.css', 'utf8')
      .replace(/\/\*[\s\S]*?\*\//g, '')
    const iRail = rail.indexOf('.coque-admin > .sb,')
    expect(iRail).toBeGreaterThan(-1)
    const regleRail = rail.slice(iRail, rail.indexOf('}', iRail))
    expect(regleRail, 'le rail est collé, lui aussi').toContain('position: sticky')
    const ETAGE_RAIL = parseInt(/z-index:\s*(\d+)/.exec(regleRail)[1], 10)
    expect(ETAGE_RAIL, 'le rail ne doit pas passer SOUS un bloc collé de la page')
      .toBeGreaterThan(ETAGE)
    expect(rail).toMatch(/\.se-liste--flottante \{[^}]*z-index: 78/)
    expect(rail).toMatch(/\.se-liste--flottante \{[^}]*position: fixed/)
  })

  it('aucun carcan au-dessus de lui', () => {
    //  `sticky` ne survit pas dans un ancêtre qui défile à la place de la
    //  page, ni derrière un `overflow: hidden`, une `contain`, un `filter` ou
    //  un `transform` posés sur le chemin : les quatre portent un contexte de
    //  position, et le premier ou le dernier coupent la page en deux
    const PORTEURS = [
      //  le porteur de page est la ligne d'alias des jetons ; sa règle finit
      //  au premier `}` + retombée et pas au premier `}` venu : `.rw-coque` a
      //  un `padding` écrit sur deux lignes
      { nom: 'la page', source: DECL14, index: DECL14.indexOf('.rw-page,\n.rw-chargement {') },
      { nom: 'la colonne', source: DECL14, index: DECL14.indexOf('.rw-coque {') },
      { nom: 'la boîte vide', source: DECL14, index: DECL14.indexOf('.rw-vide {') },
    ]
    const coque = readFileSync('src/components/coque/CoqueAdmin.css', 'utf8')
      .replace(/\/\*[\s\S]*?\*\//g, '')
    for (const selecteur of ['.coque-admin {', '.coque-admin-page {']) {
      PORTEURS.push({ nom: selecteur, source: coque, index: coque.indexOf(selecteur) })
    }
    const vus = []
    for (const { nom, source, index } of PORTEURS) {
      expect(index, `la règle ${nom} a disparu de la feuille`).toBeGreaterThan(-1)
      const avant = index + 1
      const debut = source.lastIndexOf('{', avant - 1) + 1
      const fin = source.indexOf('}\n', avant)
      const r = source.slice(debut, fin)
      vus.push(`${nom} (${r.split('\n').filter((l) => l.includes(':')).length} déclarations)`)
      expect(r, `${nom} ne met pas la page en boîte`).not.toMatch(/overflow|contain:|filter:|transform:|will-change/)
      //  et ne la borne pas non plus en hauteur : une page à hauteur fixe
      //  n'a plus rien qui défile, le collage n'a donc plus de sens
      expect(r, `${nom} a une hauteur bornée`).not.toMatch(/(^|[\s;])height:|max-height:/)
    }
    //  preuve que la loi porte : les cinq porteurs de la page sont bien vus
    expect(vus).toHaveLength(5)
    //  la seule hauteur que la coque se donne est un plancher — un plancher
    //  ne coupe rien, il ne fait que garantir la taille de la feuille
    expect(coque).toMatch(/\.coque-admin \{[^}]*min-height: 100vh;/)
  })

  it('aux trois tailles : desktop, tablette, mobile', () => {
    expect(MEDIAS.length).toBeGreaterThan(2)
    const casseurs = []
    for (const { tete, corps } of MEDIAS) {
      for (const r of corps.matchAll(/\n\s*(\.rw-entete[^{,]*)\s*\{([^}]*)\}/g)) {
        if (/\bposition|(?<![-\w])top:|\bz-index|\boverflow/.test(r[2])) {
          casseurs.push(`${tete} → ${r[1].trim()} { ${r[2].trim()} }`)
        }
      }
      //  et aucun palier ne met la page en boîte, ce qui tuerait le collage
      if (/\.rw-page[^{]*\{[^}]*(overflow|height:)/.test(corps)) {
        casseurs.push(`${tete} → .rw-page en boîte`)
      }
    }
    expect(casseurs, 'un palier décollerait le bloc : ' + casseurs.join(' · ')).toEqual([])
    //  la preuve inverse : le palier mobile retouche bien l'en-tête (largeur,
    //  marges) — s'il ne le faisait plus, la loi du dessus serait vide
    const sept = MEDIAS.find((m) => m.tete.includes('max-width: 760px'))
    expect(sept.corps).toMatch(/\.rw-entete \{[^}]*width: calc/)
    //  et sur téléphone le bloc reste plus large que le contenu qu'il cache :
    //  12 px de gutter pour lui, 24 pour la coque — sinon des cartes
    //  continueraient de courir à sa droite et à sa gauche
    expect(sept.corps).toMatch(/\.rw-entete \{[^}]*var\(--charte-espace-3\)/)
    expect(regle14(DECL14, '.rw-coque')).toMatch(/padding: [^}]*var\(--charte-espace-5\)/)
  })
})

// ═══════════════════════════════════════════════════════════
// 15. LE LOGO DE L'ENTREPRISE, PARTOUT OÙ L'ICÔNE ÉTAIT
//     28/11 : « fais apparaître l'image profil de l'entreprise partout où
//     l'icône de l'entreprise apparaît dans cette page ». Ce que la page peut
//     garantir seule : d'où vient l'adresse, que les DEUX icônes la lisent,
//     qu'aucune ne s'habille d'un rond vide, et que le logo ne voyage pas
//     d'une entreprise à l'autre pendant un changement. La fabrication du rond
//     — signature, repli sur erreur, `object-fit` — appartient à
//     `PastilleEntreprise` et à `PhotoSignee`, et c'est tant mieux : la page
//     n'a pas le droit de la refaire.
// ═══════════════════════════════════════════════════════════
describe('15. le logo de l’entreprise remplace l’immeuble, aux deux icônes', () => {
  const APPELS = [...PAGE.matchAll(/<PastilleEntreprise[\s\S]*?\/>/g)].map(m => m[0])
  //  la rangée du seuil, entre son libellé et le nom qu'elle signe
  const rangee = () => {
    const d = PAGE.indexOf('className="rw-seuil-libelle">Entreprise<')
    return PAGE.slice(d, PAGE.indexOf('</div>', d))
  }

  it('deux icônes, deux pastilles, pas une troisième', () => {
    expect(APPELS).toHaveLength(2)
    //  l'immeuble n'est plus jamais posé seul : les deux `Building2` qui
    //  restent sont des `icone=` de repli, à l'intérieur de la pastille
    const batiments = [...PAGE.matchAll(/<Building2[^>]*\/>/g)].map(m => m[0])
    expect(batiments, 'deux icônes, et seulement en repli').toHaveLength(2)
    for (const b of batiments) {
      expect(b, 'un immeuble qui ne serait le repli de rien : ' + b).toContain('aria-hidden')
    }
    for (const a of APPELS) {
      expect(a, 'la pastille lit la source unique de la page').toContain('entreprise={entrepriseSignee}')
      expect(a, 'et le repli est l’icône d’avant, pas une lettre').toMatch(/icone=\{<Building2/)
      //  l'image est décorative — le nom est écrit à côté, un `alt` le ferait
      //  lire deux fois
      expect(a, 'la page n’invente pas de nom accessible par-dessus le texte').not.toMatch(/\balt=/)
    }
    //  la cote vient du lieu : le cartouche du haut est plus grand que la
    //  rangée du seuil, et c'est écrit à l'appel, pas dans un style
    expect(APPELS[0]).toMatch(/taille=\{20\}/)
    expect(APPELS[1]).toMatch(/taille=\{16\}/)
    expect(rangee()).toContain('taille={16}')
  })

  it('la colonne est lue par les DEUX requêtes qui peuvent répondre', () => {
    //  le rail (`chargerEntreprises`) la porte depuis la panne du 26/11 ;
    //  `chargerTout` est la requête de L'ENTREPRISE OUVERTE, la seule qui
    //  réponde aussi à un compte qui n'est pas `super_admin`. Sans elle, la
    //  page n'a de logo que pour les super-administrateurs.
    const rail = PAGE.indexOf('const chargerEntreprises')
    const liste = PAGE.slice(rail, PAGE.indexOf('setSocietes(data', rail))
    expect(liste).toContain(".select('id, name, code, logo_url')")
    const tout = PAGE.indexOf('const chargerTout')
    const courante = PAGE.slice(tout, PAGE.indexOf('.maybeSingle()', tout))
    expect(courante).toContain(".select('id, name, code, currency, country_code, logo_url')")
    //  et ce sont bien DEUX `select` qui portent la colonne — pas une écriture
    //  unique que les deux appels croiraient lire
    const avecLogo = [...PAGE.matchAll(/\.select\('([^']*)'\)/g)]
      .filter(m => m[1].includes('logo_url')).map(m => m[1])
    expect(avecLogo, 'les deux requêtes, dans l’ordre de la page').toEqual([
      'id, name, code, logo_url',
      'id, name, code, currency, country_code, logo_url',
    ])
  })

  it('le logo ne traverse pas d’une entreprise à l’autre', () => {
    //  `entrepriseSignee` est le SEUL objet que les icônes lisent, et il est
    //  borné par l'identifiant : la ligne chargée pour l'entreprise quittée
    //  est écartée tant que `selectedEntId` ne la désigne plus
    const d = PAGE.indexOf('const entrepriseSignee')
    expect(d).toBeGreaterThan(-1)
    const corps = PAGE.slice(d, PAGE.indexOf('\n  }', d))
    expect(corps).toContain('entreprise?.id === selectedEntId ? entreprise : null')
    expect(corps).toContain('...(entrepriseActive || null)')
    //  et la liste du rail passe DESSOUS dans la superposition : c'est elle
    //  qui suit le clic, la ligne chargée est en retard d'une requête
    expect(corps.indexOf('entreprise : null')).toBeLessThan(corps.indexOf('entrepriseActive'))
    expect(PAGE.match(/const entrepriseSignee/g)).toHaveLength(1)
  })

  it('la page ne se refait pas un chargeur d’image', () => {
    //  signer, cacher, retomber sur l'initiale : c'est `PhotoSignee`, le même
    //  que les avatars. Une page qui reprendrait `adresseSignee` aurait deux
    //  règles de cache à caler l'une contre l'autre.
    expect(PAGE).not.toMatch(/createSignedUrl|adresseSignee|PhotoSignee/)
    expect(PAGE).not.toMatch(/function PastilleEntreprise|const PastilleEntreprise/)
    expect(PAGE).toContain("import PastilleEntreprise from '../components/paie/PastilleEntreprise'")
    //  le composant est celui de la maison, importé comme à `FichesPaie` et à
    //  `PaieFiscalite` — pas un copié-collé local qui divergerait
    const commun = readFileSync('src/components/paie/PastilleEntreprise.jsx', 'utf8')
      .replace(/\/\*[\s\S]*?\*\//g, '')
    expect(commun).toContain('const logo = entreprise?.logo_url')
    expect(commun).toMatch(/if \(logo\) \{/)
    expect(commun).toContain('fallback={repli}')
  })
})
