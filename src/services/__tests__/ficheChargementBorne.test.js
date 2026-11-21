// La fiche d'un collaborateur (/employes/:id) doit afficher la scène validée
// de l'annuaire, branchée sur ses VRAIES requêtes. Ces contrôles lisent la
// source : ils vérifient que chaque requête est bien déclarée dans un groupe,
// sinon la jauge monterait sans raison.
import { readFileSync } from 'node:fs'
import { describe, it, expect } from 'vitest'

const page = readFileSync('src/pages/Employee360.jsx', 'utf8')
const ecran = readFileSync('src/components/EmployesLoadingScreen.jsx', 'utf8')

const nomsSuivis = [...page.matchAll(/suivre\(\s*'([a-zA-Z]+)'/g)].map((m) => m[1])
const blocGroupes = page.slice(
  page.indexOf('export const ETAPES_CHARGEMENT_FICHE'),
  page.indexOf('const NOMBRE_REQUETES_FICHE'),
)
const nomsGroupes = [...blocGroupes.matchAll(/requetes: \[([^\]]+)\]/g)]
  .flatMap((m) => m[1].split(',').map((x) => x.trim().replace(/'/g, '')).filter(Boolean))

describe('Fiche employé — écran de chargement sur la progression réelle', () => {
  it('remplace le point pulsant par la scène de l’annuaire', () => {
    expect(page).toContain('<EmployesLoadingScreen')
    expect(page).toContain('etapes={ETAPES_CHARGEMENT_FICHE}')
    expect(page).toContain('progression={progressionChargement}')
    expect(page).toContain('dataReady={!chargement}')
    // L'ancien indicateur doit avoir disparu du JSX comme du CSS.
    expect(page).not.toContain('Lecture de la fiche…')
    expect(page).not.toContain('e360-charge')
    const css = readFileSync('src/pages/Employee360.css', 'utf8')
    expect(css).not.toContain('.e360-charge')
  })

  it('suit les 13 requêtes réelles, chacune dans un seul groupe', () => {
    expect(nomsSuivis).toHaveLength(13)
    expect(new Set(nomsSuivis).size).toBe(13)
    expect([...nomsGroupes].sort()).toEqual([...nomsSuivis].sort())
  })

  it('ne force la scène qu’à la première ouverture', () => {
    expect(page).toContain('dureeMin={dejaVueRef.current ? 0 : EMPLOYES_INTRO_MS}')
    expect(page).toContain('const [plancherFait, setPlancherFait] = useState(')
    // Sous jsdom (les 102 tests d'intégration), aucun plancher : la page se rend tout de suite.
    expect(page).toContain('/jsdom/i.test(navigator.userAgent')
  })

  it('garde la jauge silencieuse si un autre appel de fiche a démarré', () => {
    expect(page).toContain('if (numeroDuTour !== tourRef.current) return resultat')
    expect(page).toContain('tourRef.current += 1')
    expect(page).toContain('requetesRef.current.clear()')
  })

  it('expose les textes réglables de l’écran, sans dupliquer le composant', () => {
    for (const prop of ['etapes = ETAPES_CHARGEMENT_EMPLOYES', 'marque', 'titrePret', 'statutPret', 'legende', 'dureeMin = EMPLOYES_INTRO_MS']) {
      expect(ecran).toContain(prop)
    }
    // Le minuteur se règle une seule fois au montage : une mise à jour de
    // progression ne doit pas le remettre à zéro.
    expect(ecran).toContain('}, [])')
    expect(ecran).toContain('const dureeRef = useRef(dureeMin)')
  })

  it('reste en français, sans anglicisme d’interface', () => {
    const textes = [...page.matchAll(/(?:court|detail|titrePret|statutPret|legende|marque)=[{'"` ]*([^'"`\n}]+)/g)].map((m) => m[1])
    expect(textes.join(' ')).not.toMatch(/\b(Loading|Loading…|Chargement de la fiche de|Employee|Dashboard)\b/i)
    expect(page).toContain('Chargement de la fiche')
  })
})
