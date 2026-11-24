import { describe, it, expect } from 'vitest'
import { culturalMotifForPath } from '../../components/culturalMotif.js'
import fs from 'node:fs'
import path from 'node:path'

const ROOT = path.resolve(import.meta.dirname, '../../..')
const lire = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8')

const svgSrc = lire('src/components/AfroCulturalSvg.jsx')
const absencesSrc = lire('src/pages/Absences.jsx')
const planningSrc = lire('src/pages/Planning.jsx')

// Bloc source du seul composant concerné, pour ne pas tester les autres frises
const debut = svgSrc.indexOf('export function KenteAmberWeaveSvg')
const fin = svgSrc.indexOf('export function WovenKenteBadgeSvg')
const bandeAmbre = svgSrc.slice(debut, fin)

const blocCss = lire('src/pages/AbsencesAfroTech.css')

describe('Patrimoine Kente conservé · Absences passée au bogolan', () => {
  it('1. la frise ambre existe et est exportée', () => {
    expect(debut).toBeGreaterThan(-1)
    expect(svgSrc).toContain('export function KenteAmberWeaveSvg')
    expect(bandeAmbre).toContain('id="encheck-kente-amber"')
  })

  it('2. le bogolan a quitté l’en-tête d’Absences, l’identité de la page reste', () => {
    // 24/11 : « utilise le bogolan comme motif, remplace l'autre ». 26/11 : le cadre
    // est refusé, la lisière le remplace. 27/11 : le fondateur choisit le transat et
    // décide « un bandeau motif bogolan servira autrement » — la page ne monte donc
    // plus aucune bande au-dessus du contenu. Le tissu reste dans les deux tiroirs,
    // qui sont des feuilles qui glissent, et l'identité de la page ne bouge pas :
    // l'écran de chargement et les motifs la lisent encore en bogolan.
    expect(absencesSrc).not.toContain('<PageCulturalBand')
    expect(absencesSrc).not.toContain('<AbsencesCulturalBand')
    expect(lire('src/pages/AbsencesAfroTech.css')).not.toContain('.abs-bogolan-tete')
    expect(culturalMotifForPath('/absences')).toBe('bogolan')
    // les deux tiroirs gardent leurs bandeaux
    expect(lire('src/components/AbsenceTiroir.jsx')).toContain('<AbsencesCulturalBand drawer/>')
    expect(lire('src/components/AbsencesCulturalBand.jsx')).toContain('aria-hidden="true"')
    expect(lire('src/components/AbsencesCulturalBand.jsx')).toContain('abs-bogolan-band')
    // PROTECTION : « servir autrement » ne veut pas dire « jeter l'image ».
    // Le ndebele reste sur le disque et reste le visuel du badge employé.
    expect(fs.existsSync(path.join(ROOT, 'public/images/absences-ndebele.webp'))).toBe(true)
    expect(lire('src/components/badge/motifs.js')).toContain("image: '/images/absences-ndebele.webp'")
    // et plus une seule feuille de style de la page ne peint le ndebele
    expect(blocCss).not.toContain("url('/images/absences-ndebele.webp')")
  })
  it('3. la frise est strictement orange · jaune · noir : ni émeraude, ni indigo, ni bleu', () => {
    expect(bandeAmbre).not.toMatch(/#1E5E3E|#1F6A45|#288256|#10B981|#26734D|#24384A/i)
  })

  it('4. le bandeau couvre toute la largeur et garde les proportions du motif', () => {
    expect(blocCss).toMatch(/width:\s*100%/)

    expect(blocCss).toContain('background-size: auto 100%')
    expect(blocCss).toContain('height: 76px')
    expect(blocCss).toContain('height: 32px')
  })

  it('5. elle conserve la trame Kente à 6 blocs : rayures, damier, losange, chevrons, tissage, sabliers', () => {
    // Rayures horizontales or sur cuivre
    expect(bandeAmbre).toContain('width="38" height="28"')
    // Damier : une grille de petits carrés
    expect(bandeAmbre).toContain('width="9" height="7"')
    // Losange royal
    expect(bandeAmbre).toMatch(/polygon points="94,2 112,14 94,26 76,14"/)
    // Chevrons tissés
    expect(bandeAmbre).toMatch(/M120 3 L130 14 L120 25/)
    // Sabliers Adinkra
    expect(bandeAmbre).toMatch(/polygon\s+points="206,3 234,3 220,14 234,25 206,25 220,14"/)
  })

  it('6. Planning utilise le nouveau motif kuba sans changer le SVG Kente partagé', () => {
    // Le 22/11, la toile kuba ne couronne plus la page : elle ENCADRE le
    // bandeau de commande (`placement="cadre"`), une seule toile pour quatre
    // lisières. Et le même jour, le fondateur a retiré la bande de pied
    // (« enlève le bandeau motif en bas ») : la page ne porte plus qu'un seul
    // motif, et ce n'est plus une promesse que la feuille du bas tait.
    expect(planningSrc).toContain('<PageCulturalBand pathname="/planning" placement="cadre" />')
    expect(planningSrc).not.toContain('<PageCulturalBand pathname="/planning"/>')
    expect(planningSrc).not.toContain('<PageCulturalBand pathname="/planning" placement="bottom"/>')
    expect(planningSrc).not.toContain('placement="bottom"')
    expect(planningSrc).not.toContain('KenteWovenTapestrySvg')
    expect(svgSrc).toContain('export function KenteWovenTapestrySvg')
  })
})
