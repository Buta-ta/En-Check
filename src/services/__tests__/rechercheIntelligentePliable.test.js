// ═══════════════════════════════════════════════════════════
// LA RECHERCHE INTELLIGENTE SE REPLIE — round 48
//
//   « je veux la possibilité de retracter la barre de recherche
//     intelligente »
//
// Le bandeau du bas occupe 180 px sur chaque page. On ajoute un
// bouton « Replier » : la barre se range en pastille, et la
// pastille la rouvre. Trois garde-fous :
//
//   ① elle est OUVERTE par défaut — personne ne perd la recherche
//     sans l'avoir demandé (règle du round 13) ;
//   ② repliée, elle reste VISIBLE et cliquable sur la page — rien
//     n'est supprimé (règle du round 40) ;
//   ③ le choix est retenu d'une page à l'autre, et se défait.
// ═══════════════════════════════════════════════════════════

import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'

const ROOT = path.resolve(import.meta.dirname, '../../..')
const lire = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8')

const dock = lire('src/components/AssistantDock.jsx')
const css = lire('src/styles/assistantDock.css')

// La règle de survol ne touche jamais au texte : ni couleur, ni fond, ni opacité.
const reglesDeSurvol = css.match(/[^{}]*(?:rallumer|replier)[^{}]*:hover[^{}]*\{[^}]*\}/g) || []

describe('la recherche intelligente est ouverte par défaut', () => {
  it('rien dans le stockage signifie « ouverte »', () => {
    expect(dock).toContain("localStorage.getItem(RECHERCHE_REPLIEE_KEY) === '1'")
    expect(dock).toContain('catch { return false }')
  })

  it('l’état de départ vient de ce choix retenu', () => {
    expect(dock).toContain('const [repliee, setRepliee] = useState(lireRechercheRepliee)')
  })

  it('aucun repli automatique : seul le bouton replie', () => {
    // setRepliee n'est appelé qu'à un endroit : la bascule elle-même.
    expect((dock.match(/setRepliee\(/g) || []).length).toBe(1)
    // …et la bascule n'est déclenchée que par les deux boutons.
    expect((dock.match(/replierRecherche\(/g) || []).length).toBe(3) // définition + 2 boutons
    expect(dock).toContain('onClick={() => replierRecherche(true)}')
    expect(dock).toContain('onClick={() => replierRecherche(false)}')
  })

  it('la bascule ne passe jamais par un effet', () => {
    expect(dock).not.toContain('useEffect(() => {\n    setRepliee')
  })
})

describe('une fois repliée, elle reste sur la page', () => {
  it('le bandeau se range au lieu de disparaître', () => {
    expect(dock).toContain("className={`ec-assistant-dock${repliee ? ' is-repliee' : ''}`}")
    // le `hidden` existant ne sert qu'à la fenêtre de conversation
    expect(dock).toContain('hidden={opened}')
  })

  it('la pastille nomme la recherche et la rouvre', () => {
    expect(dock).toContain('className="ec-assistant-rallumer"')
    expect(dock).toContain('Recherche intelligente')
    expect(dock).toContain('onClick={() => replierRecherche(false)}')
    expect(dock).toContain('aria-expanded="false"')
    expect(dock).toContain('aria-controls="ec-assistant-recherche"')
  })

  it('le champ garde son identifiant et son étiquette', () => {
    expect(dock).toContain('id="ec-assistant-recherche"')
    expect(dock).toContain('aria-label="Votre recherche En-Check"')
    expect(dock).toContain('placeholder={placeholder}')
  })

  it('la hauteur de page suit le repli', () => {
    expect(dock).toContain("className={`ec-assistant-space${repliee ? ' is-repliee' : ''}`}")
    expect(css).toContain('.ec-assistant-space.is-repliee { height: 96px; }')
    expect(css).toContain('.ec-assistant-dock.is-repliee {')
  })
})

describe('le bouton de repli est dessiné, pas un mot nu', () => {
  it('un chevron, un libellé, une étiquette d’état', () => {
    expect(dock).toContain('className="ec-assistant-replier"')
    expect(dock).toContain('<ChevronDown size={15} aria-hidden="true" />')
    expect(dock).toContain('<ChevronUp size={16} aria-hidden="true" />')
    expect(dock).toContain('aria-expanded="true"')
    expect(dock).toContain('title="Replier la barre de recherche — elle reste à portée de clic"')
  })

  it('le survol change la bordure et l’anneau, jamais le texte', () => {
    expect(reglesDeSurvol.length).toBeGreaterThanOrEqual(2)
    reglesDeSurvol.forEach((regle) => {
      expect(regle).not.toMatch(/(^|[\s;{])color:/)
      expect(regle).not.toMatch(/(^|[\s;{])background(-color)?:/)
      expect(regle).not.toMatch(/(^|[\s;{])opacity:/)
      expect(regle).toMatch(/border-color:|box-shadow:/)
    })
  })

  it('la pastille et le bouton ont leurs styles dédiés', () => {
    expect(css).toContain('.ec-assistant-rallumer {')
    expect(css).toContain('.ec-assistant-replier {')
    expect(css).toContain('.ec-assistant-rangee {')
  })

  it('le petit écran garde le bouton de repli', () => {
    expect(css).toContain('.ec-assistant-label span.ec-assistant-label-droite { display: inline-flex; }')
    expect(css).toContain('.ec-assistant-replier span { display: none; }')
  })
})

describe('le choix est retenu… et se défait', () => {
  it('il s’écrit à chaque bascule', () => {
    expect(dock).toContain("localStorage.setItem(RECHERCHE_REPLIEE_KEY, repliee ? '1' : '0')")
    expect(dock).toContain('retenirRechercheRepliee(etat)')
  })

  it('un stockage refusé ne casse pas la barre', () => {
    expect(dock).toContain("catch { /* stockage refusé : la barre reste utilisable */ }")
  })

  it('le repli ferme les exemples, pour ne les rouvrir qu’à la demande', () => {
    expect(dock).toContain('if (etat) setExamplesOpen(false)')
  })

  it('la pastille reste au-dessus des cartes de page', () => {
    const blocDock = css.slice(css.indexOf('.ec-assistant-dock {'))
    expect(blocDock.slice(0, 220)).toContain('z-index: 80;')
  })
})
