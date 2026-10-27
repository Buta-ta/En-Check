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
//     bascule, raccourcis, action principale) ;
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
    const html = renderToStaticMarkup(<RemunerationsLoading darkMode onSkip={() => {}} />)
    expect(html).toContain('data-cultural-motif="bogolan"')
    expect(html).toContain('ec-cultural-top')
  })
})

describe('2. les repères sont toujours à la même place', () => {
  it('retour en premier, bascule en dernier — sur toutes les pages', () => {
    const entete = PAGE.slice(PAGE.indexOf('<header className="rw-entete">'), PAGE.indexOf('</header>'))
    expect(entete.indexOf('rw-retour')).toBeGreaterThan(-1)
    expect(entete.indexOf('rw-bascule')).toBeGreaterThan(entete.indexOf('rw-retour'))
    //  la bascule de thème est le dernier bouton de l'en-tête
    expect(entete.lastIndexOf('role="switch"')).toBeGreaterThan(
      entete.lastIndexOf('Recharger les rémunérations')
    )
    expect(entete).toContain('aria-checked={darkMode}')
    //  et c'est la même géométrie que sur les autres pages refondues
    const jf = readFileSync('src/pages/JoursFeries.css', 'utf8')
    expect(jf).toMatch(/\.jf-bascule \{[^}]*width: 38px;[^}]*height: 38px;/s)
    expect(CSS).toMatch(/\.rw-bascule \{[^}]*width: 38px;[^}]*height: 38px;/s)
    expect(CSS).toMatch(/\.rw-bascule \{[^}]*border-radius: 50%;/s)
  })

  it('les raccourcis vivent dans le seuil, pas dans l’en-tête', () => {
    const seuil = PAGE.slice(PAGE.indexOf('className="rw-seuil"'), PAGE.indexOf('</section>'))
    expect(seuil).toContain('<RaccourcisPages compact excludePaths={[\'/remunerations\']} />')
    const entete = PAGE.slice(PAGE.indexOf('<header'), PAGE.indexOf('</header>'))
    expect(entete).not.toContain('RaccourcisPages')
    expect(CSS).toContain('.rw-raccourcis .abs-raccourci')
  })

  it('l’action principale est une barre collée en bas, pas un bouton du fond', () => {
    expect(CSS).toMatch(/\.rw-barre \{[^}]*position: fixed;/s)
    expect(CSS).toMatch(/\.rw-barre \{[^}]*bottom: 18px;/s)
    expect(PAGE).toContain('className="rw-barre"')
    //  elle n'apparaît que s'il y a quelque chose à écrire
    expect(PAGE).toMatch(/\{modifications > 0 && \(/)
  })

  it('la page a deux thèmes, avec sa propre bascule', () => {
    expect(CSS).toContain('.rw-page.rw-clair {')
    expect(PAGE).toContain("const page = `rw-page${darkMode ? '' : ' rw-clair'}`")
    expect(PAGE).toContain('onClick={toggleTheme}')
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
    //  la palette de la page vient de la boue et du cuivre
    for (const couleur of ['#1A1009', '#2A1509', '#9C5321', '#D4813C', '#F4ECDD', '#231911']) {
      expect(CSS.toUpperCase()).toContain(couleur)
    }
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
    const html = renderToStaticMarkup(<RemunerationsLoading darkMode onSkip={() => {}} />)
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

  it('la coque, les mesures, les bandes et les raccourcis sont là', async () => {
    await monter()

    expect(hote.querySelector('.rw-page')).not.toBeNull()
    expect(hote.querySelector('[data-cultural-motif="bogolan"]')).not.toBeNull()
    expect(hote.querySelector('h1').textContent).toContain('Rémunérations')
    //  quatre mesures, pas trois
    expect(hote.querySelectorAll('.rw-mesure')).toHaveLength(4)
    //  une bande par salarié
    expect(hote.querySelectorAll('.rw-bande')).toHaveLength(3)
    expect(hote.querySelector('[data-testid="raccourcis-pages"]')).not.toBeNull()
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
    expect(texte(hote.querySelector('.rw-barre'))).toContain('1 bande modifiée')

    await ecrire(champ, '250000')
    expect(hote.querySelector('.rw-barre')).toBeNull()
  })

  it('la barre annonce le nombre exact de bandes touchées', async () => {
    await monter()
    await ecrire(champDe('Kossi ALABI', 'Mensuelle'), '300000')
    await ecrire(champDe('Yao KPODAR', 'Mensuelle'), '350000')

    expect(texte(hote.querySelector('.rw-barre'))).toContain('2 bandes modifiées')
    expect(hote.querySelector('.rw-barre').textContent).toContain('(2)')
    //  et le rappel du raccourci clavier
    expect(hote.querySelector('.rw-touche')).not.toBeNull()
  })

  it('enregistrer tout n’écrit que les bandes modifiées, avec les bonnes valeurs', async () => {
    await monter()
    await ecrire(champDe('Kossi ALABI', 'Mensuelle'), '300000')

    const bouton = hote.querySelector('.rw-barre .rw-bouton')
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
    expect(modale.textContent).toContain('un salaire ne se recopie pas par accident')
  })

  it('appliquer remplit les bandes choisies, sans rien écrire en base', async () => {
    await monter()
    const modale = await ouvrir('Kossi ALABI')

    const destinataire = [...modale.querySelectorAll('.rw-appliquer-item')]
      .find(b => texte(b).includes('Awa DOSSOU'))
    await clic(destinataire)
    expect(destinataire.getAttribute('aria-pressed')).toBe('true')

    const reprendre = [...modale.querySelectorAll('.rw-modale-pied .rw-bouton')]
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
    expect(texte(hote.querySelector('.rw-barre'))).toContain('1 bande modifiée')
  })

  it('sans destinataire, rien ne se passe et on le dit', async () => {
    await monter()
    const modale = await ouvrir('Kossi ALABI')
    const reprendre = [...modale.querySelectorAll('.rw-modale-pied .rw-bouton')]
      .find(b => texte(b).includes('Reprendre'))
    await clic(reprendre)
    //  la modale reste ouverte : on n'a rien appliqué
    expect(hote.querySelector('.rw-modale')).not.toBeNull()
  })
})

describe('8. le texte reste lisible dans les deux champs', () => {
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
    return CSS.slice(debut, CSS.indexOf('}', debut))
  }
  const jeton = (source, nom) => {
    const m = source.match(new RegExp(`--rw-${nom}: (#[a-fA-F0-9]{6});`))
    expect(m, nom).not.toBeNull()
    return m[1]
  }

  it('les trois niveaux de texte passent 4,5:1 sur les quatre fonds', () => {
    for (const [selecteur, nom] of [['.rw-page {', 'sombre'], ['.rw-page.rw-clair {', 'clair']]) {
      const b = bloc(selecteur)
      const fonds = ['nuit', 'panneau', 'panneau-2', 'creux']
      for (const niveau of ['encre', 'douce', 'faible']) {
        for (const fond of fonds) {
          expect(
            contraste(jeton(b, niveau), jeton(b, fond)),
            `${nom} · ${niveau} sur ${fond}`
          ).toBeGreaterThanOrEqual(4.5)
        }
      }
    }
  })

  it('les états et l’accent tiennent là où ils vivent', () => {
    for (const [selecteur, nom] of [['.rw-page {', 'sombre'], ['.rw-page.rw-clair {', 'clair']]) {
      const b = bloc(selecteur)
      //  l'accent est du texte sur le fond, le panneau et le seuil
      for (const fond of ['nuit', 'panneau', 'panneau-2']) {
        expect(contraste(jeton(b, 'cuivre'), jeton(b, fond)), `${nom} cuivre/${fond}`)
          .toBeGreaterThanOrEqual(4.5)
      }
      //  les badges d'état vivent sur le creux
      for (const etat of ['ok', 'attente', 'alerte']) {
        expect(contraste(jeton(b, etat), jeton(b, 'creux')), `${nom} ${etat}/creux`)
          .toBeGreaterThanOrEqual(4.5)
      }
    }
  })

  it('le texte des boutons cuivre reste lisible dessus', () => {
    const sombre = bloc('.rw-page {')
    const clair = bloc('.rw-page.rw-clair {')
    expect(contraste(jeton(sombre, 'sur-cuivre'), jeton(sombre, 'cuivre'))).toBeGreaterThanOrEqual(4.5)
    expect(contraste(jeton(clair, 'sur-cuivre'), jeton(clair, 'cuivre'))).toBeGreaterThanOrEqual(4.5)
  })
})
