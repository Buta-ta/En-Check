import { describe, it, expect } from 'vitest'
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

  it('2. Absences est encadrée de bogolan ; le ndebele reste l’artiste du badge', () => {
    // 24/11 : « utilise le bogolan comme motif, remplace l'autre ». 26/11 : le
    // fondateur a refusé le cadre qui faisait le tour de la page — « tu n'as fait
    // qu'entourer l'ancienne page d'une bande motif. je ne veux pas de ça. » Le
    // motif n'est donc plus une bordure : il est LE BORD BAS de la section du haut,
    // une lisière de 34 px sous la feuille du titre. Un seul exemplaire sur la
    // page (les tiroirs gardent les leurs), jamais la toile entière du `<main>`.
    expect(absencesSrc).not.toContain('<PageCulturalBand')
    expect(absencesSrc).not.toContain('abs-section-cadre')
    expect(absencesSrc).toContain('<AbsencesCulturalBand position="tete"/>')
    expect(absencesSrc.split('<AbsencesCulturalBand').length - 1).toBe(1)
    expect(absencesSrc).not.toContain('<AbsencesCulturalBand position="bottom"/>')
    expect(absencesSrc).not.toContain('KenteAmberWeaveSvg')
    // les deux tiroirs gardent leurs bandeaux : une feuille qui glisse n’a pas
    // besoin d’un cadre, elle a besoin d’une lisière en haut et d’une en bas
    expect(lire('src/components/AbsenceTiroir.jsx')).toContain('<AbsencesCulturalBand drawer/>')
    expect(lire('src/components/AbsencesCulturalBand.jsx')).toContain('aria-hidden="true"')
    expect(lire('src/components/AbsencesCulturalBand.jsx')).toContain('abs-bogolan-band')
    // PROTECTION : « remplacer le motif » ne veut pas dire « jeter l’image ».
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
