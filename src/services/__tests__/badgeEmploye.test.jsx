// ═══════════════════════════════════════════════════════════
// LA CARTE DE SERVICE
//
// Ce que ces tests défendent :
//
//   · la carte est un objet imprimé : elle ne dépend pas du thème
//     de la page, elle porte le papier, la couleur de l'entreprise
//     et rien d'autre ;
//   · ce qui est affiché est vrai — une donnée absente disparaît
//     au lieu d'être inventée, et le QR porte le jeton du badge,
//     pas le matricule ;
//   · la fenêtre se ferme (Échap, clic sur le voile) et l'échec
//     d'un export se dit en français, sans `alert` ;
//   · aucun code technique (hexadécimal, nom de champ) ne fuit
//     dans l'interface.
// ═══════════════════════════════════════════════════════════

// @vitest-environment jsdom

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { readFileSync } from 'node:fs'

import BadgeEmploye from '../../components/BadgeEmploye'

const html2canvas = vi.hoisted(() => vi.fn())
vi.mock('html2canvas', () => ({ default: html2canvas }))

const CSS = readFileSync('src/components/BadgeEmploye.css', 'utf8')

const personne = (extra = {}) => ({
  id: 'emp-1',
  first_name: 'Adjoua',
  last_name: 'Kouassi',
  matricule: 'EMP-0042',
  position: 'Responsable des opérations',
  department: 'Logistique',
  contract_type: 'CDI',
  hire_date: '2021-03-12',
  qr_token: 'jeton-42',
  ...extra,
})

let hote
let racine

beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true
  hote = document.createElement('div')
  document.body.appendChild(hote)
  racine = createRoot(hote)
  html2canvas.mockReset()
})

afterEach(() => {
  act(() => racine.unmount())
  hote.remove()
  document.body.style.overflow = ''
})

async function rendre(props = {}) {
  await act(async () => {
    racine.render(
      <BadgeEmploye
        employee={personne()}
        entrepriseName="AfroTech Bénin"
        primaryColor="#D4AF37"
        onClose={() => {}}
        {...props}
      />
    )
  })
  return hote
}

const carte = () => hote.querySelector('[data-testid="badge-carte"]')

describe('la carte de service', () => {
  it('écrit le nom, le poste, le département et les données de service', async () => {
    await rendre()
    const texte = carte().textContent
    expect(texte).toContain('Adjoua Kouassi')
    expect(texte).toContain('Responsable des opérations')
    expect(texte).toContain('Logistique')
    expect(texte).toContain('Matricule')
    expect(texte).toContain('EMP-0042')
    expect(texte).toContain('Contrat')
    expect(texte).toContain('CDI')
    expect(texte).toContain('12 mars 2021')
    expect(texte).toContain('AfroTech Bénin')
  })

  it('ne fabrique pas une ligne quand la donnée manque', async () => {
    await rendre({ employee: personne({ contract_type: '', hire_date: '' }) })
    const texte = carte().textContent
    expect(texte).toContain('Matricule')
    expect(texte).not.toContain('Contrat')
    expect(texte).not.toContain('Entrée')
    expect(texte).not.toContain('Poste à préciser')
  })

  it('porte la couleur de l’entreprise et choisit un texte lisible dessus', async () => {
    await rendre()
    const bandeau = carte().querySelector('header')
    expect(bandeau.style.background).toBe('rgb(212, 175, 55)')
    // l'or est clair : le nom s'écrit à l'encre, pas en blanc
    expect(bandeau.querySelector('p').style.color).toBe('rgb(28, 20, 13)')

    await rendre({ primaryColor: '#1E3A8A' })
    const bandeauSombre = carte().querySelector('header')
    expect(bandeauSombre.style.background).toBe('rgb(30, 58, 138)')
    // le bleu est sombre : le nom passe au papier clair
    expect(bandeauSombre.querySelector('p').style.color).toBe('rgb(247, 241, 230)')
  })

  it('retombe sur l’or de la maison quand la couleur est illisible', async () => {
    await rendre({ primaryColor: 'pas-une-couleur' })
    expect(carte().querySelector('header').style.background).toBe('rgb(212, 175, 55)')
  })

  it('fait porter le jeton au QR, pas le matricule', async () => {
    await rendre()
    const chemin = () => carte().querySelector('svg path[fill="#1c140d"]').getAttribute('d')
    const avecJeton = chemin()

    await rendre({ employee: personne({ qr_token: 'jeton-99' }) })
    expect(chemin()).not.toBe(avecJeton)

    // sans jeton, on retombe sur le matricule — mais la carte le dit
    await rendre({ employee: personne({ qr_token: '' }) })
    expect(chemin()).toBeTruthy()
  })

  it('le dit quand il n’y a rien à encoder', async () => {
    await rendre({ employee: personne({ qr_token: '', matricule: '' }) })
    expect(carte().textContent).toContain('QR à générer')
    expect(carte().querySelector('svg path[fill="#1c140d"]')).toBeNull()
  })

  it('affiche les initiales quand il n’y a pas de photo', async () => {
    await rendre()
    expect(carte().textContent).toContain('AK')
    expect(carte().querySelector('img')).toBeNull()

    await rendre({ employee: personne({ photo_url: 'https://exemple.test/photo.jpg' }) })
    expect(carte().querySelector('img').getAttribute('src')).toBe('https://exemple.test/photo.jpg')
  })

  it('n’affiche aucun code technique dans la fenêtre', async () => {
    await rendre()
    const texte = hote.textContent
    expect(texte).not.toMatch(/#[0-9a-f]{6}/i)
    expect(texte).not.toMatch(/qr_token|primary_color|hire_date|contract_type/)
    expect(texte).not.toMatch(/[\u2600-\u27bf]/u)
  })

  it('annonce la taille réelle du fichier exporté', async () => {
    await rendre()
    expect(hote.textContent).toContain('900 × 1500 px')
  })
})

describe('la fenêtre du badge', () => {
  it('se ferme à Échap et au clic sur le voile, pas au clic dedans', async () => {
    const onClose = vi.fn()
    await rendre({ onClose })

    act(() => {
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
    })
    expect(onClose).toHaveBeenCalledTimes(1)

    const voile = hote.querySelector('.bge-voile')
    act(() => {
      carte().dispatchEvent(new MouseEvent('mousedown', { bubbles: true }))
    })
    expect(onClose).toHaveBeenCalledTimes(1)

    act(() => {
      voile.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }))
    })
    expect(onClose).toHaveBeenCalledTimes(2)
  })

  it('garde le fond immobile tant que la fenêtre est ouverte', async () => {
    await rendre()
    expect(document.body.style.overflow).toBe('hidden')
    act(() => racine.unmount())
    expect(document.body.style.overflow).toBe('')
    racine = createRoot(hote)
  })

  it('dit l’échec d’un export au lieu de crier dans une alerte', async () => {
    html2canvas.mockRejectedValueOnce(new Error('canvas absent'))
    const alerte = vi.spyOn(window, 'alert').mockImplementation(() => {})
    await rendre()

    const bouton = [...hote.querySelectorAll('button')].find((b) => b.textContent.includes('Télécharger'))
    await act(async () => {
      bouton.dispatchEvent(new MouseEvent('click', { bubbles: true }))
      await Promise.resolve()
    })

    expect(alerte).not.toHaveBeenCalled()
    expect(hote.querySelector('[role="alert"]').textContent).toMatch(/n’a pas pu être généré/)
    alerte.mockRestore()
  })

  it('exporte en 3× par-dessus un fond transparent', async () => {
    html2canvas.mockResolvedValueOnce({
      toDataURL: () => 'data:image/png;base64,AAAA',
    })
    await rendre()

    const bouton = [...hote.querySelectorAll('button')].find((b) => b.textContent.includes('Télécharger'))
    const lien = { click: vi.fn(), download: '', href: '' }
    const creation = vi.spyOn(document, 'createElement').mockReturnValueOnce(lien)
    await act(async () => {
      bouton.dispatchEvent(new MouseEvent('click', { bubbles: true }))
      await Promise.resolve()
      await Promise.resolve()
    })

    expect(html2canvas).toHaveBeenCalledWith(
      carte(),
      expect.objectContaining({ scale: 3, backgroundColor: null })
    )
    expect(lien.download).toBe('badge-emp-0042.png')
    creation.mockRestore()
  })
})

describe('la feuille de la fenêtre', () => {
  it('reste dans la palette du registre', () => {
    expect(CSS).toMatch(/\.bge-fenetre \{[^}]*background: #f5f0e6/)
    expect(CSS).toMatch(/\[data-theme='dark'\] \.bge-fenetre \{[^}]*background: #17110b/)
  })

  it('ne colorie ni ne remplit un texte au survol', () => {
    const regles = CSS.match(/[^{}]*:hover[^{}]*\{[^}]*\}/g) || []
    expect(regles.length).toBeGreaterThan(2)
    for (const regle of regles) {
      const corps = regle.slice(regle.indexOf('{') + 1)
      expect(corps, regle).not.toMatch(/(^|;)\s*background(-color)?\s*:/)
      expect(corps, regle).not.toMatch(/(^|;)\s*opacity\s*:/)
      expect(corps.replace(/border-color\s*:/g, ''), regle).not.toMatch(/(^|;)\s*color\s*:/)
    }
  })
})
