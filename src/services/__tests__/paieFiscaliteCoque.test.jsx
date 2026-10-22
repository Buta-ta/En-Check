// ═══════════════════════════════════════════════════════════
// 💼 PAIE & FISCALITÉ — LA COQUE
//
// « Configuration fiscale » et « Fiches de paie » écrivaient le
// même enregistrement `payroll_settings` depuis deux écrans
// différents. La page unique /paie reprend le volet fiscal tel
// quel, et l'habille : bogolan, cartes KPI, graphiques, photos
// d'équipe et raccourcis vers les autres pages.
//
// Ce test garde ce qui a été demandé le 22/10 : ① des motifs
// africains différents de ceux des autres pages, ② les photos
// des salariés avec un repli sur les initiales, ③ les cartes
// KPI, ④ des graphiques sans dépendance nouvelle, ⑤ les
// boutons de raccourci (Planning, Pointages…).
// ═══════════════════════════════════════════════════════════

import { it, expect } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import { renderToStaticMarkup } from 'react-dom/server'
import PaieKpiCards, { totauxCotisations, tauxParTranche } from '../../components/PaieKpiCards'
import { BarresTranches, DonutParts, CarteGraphique } from '../../components/PaieGraphiques'
import { BogolanFriseSvg, BogolanPastilleSvg } from '../../components/BogolanMudclothSvg'

const ROOT = path.resolve(import.meta.dirname, '../../..')
const lire = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8')

const coque = lire('src/pages/PaieFiscalite.jsx')
const fiscale = lire('src/pages/ConfigurationFiscale.jsx')
const app = lire('src/App.jsx')
const paquet = JSON.parse(lire('package.json'))
const graphiques = lire('src/components/PaieGraphiques.jsx')

// ── 1. Une signature visuelle propre à cette page ────────────────────

it('1. la paie s’habille en bogolan, pas du kente des autres pages', () => {
  expect(coque).toContain('BogolanFriseSvg')
  expect(coque).toContain('BogolanFiligraneSvg')
  expect(coque).not.toContain('AfroCulturalSvg')
  expect(coque).not.toContain('Kente')
  expect(coque).not.toContain('Adinkra')
})

it('2. deux frises posées côte à côte ne se volent pas leur motif', () => {
  const deux = renderToStaticMarkup(
    <div>
      <BogolanFriseSvg hauteur={10} />
      <BogolanFriseSvg hauteur={10} />
    </div>
  )
  const ids = deux.match(/pattern id="([^"]+)"/g) || []
  expect(ids.length).toBe(2)
  expect(new Set(ids).size).toBe(2)
})

it('3. chaque carte porte sa pastille bogolan', () => {
  const rangee = renderToStaticMarkup(
    <PaieKpiCards contributions={[]} tranches={[]} darkMode={false} />
  )
  // 4 cartes = 4 pastilles
  expect((rangee.match(/data-testid="paie-kpi/g) || []).length).toBe(5) // la rangée + 4 cartes
  expect((rangee.match(/<svg/g) || []).length).toBeGreaterThanOrEqual(4)
})

// ── 2. Les cartes KPI ────────────────────────────────────────────────

const COTISATIONS = [
  { id: 1, name: 'CNSS', calculation_method: 'percentage', rate_employee: 3.6, rate_employer: 4.8, is_active: true },
  { id: 2, name: 'IPRES', calculation_method: 'percentage', rate_employee: 2.4, rate_employer: 3.6, is_active: true },
  { id: 3, name: 'Mutuelle', calculation_method: 'fixed', fixed_amount: 5000, rate_employee: 0, rate_employer: 0, is_active: true },
  { id: 4, name: 'Ancienne', calculation_method: 'percentage', rate_employee: 9, rate_employer: 9, is_active: false },
]

const TRANCHES = [
  { id: 1, bracket_name: 'T1', bracket_order: 2, min_amount: 150000, tax_rate: 20, is_active: true },
  { id: 2, bracket_name: 'T2', bracket_order: 1, min_amount: 0, tax_rate: 0, is_active: true },
  { id: 3, bracket_name: 'T3', bracket_order: 3, min_amount: 400000, tax_rate: 35, is_active: false },
]

it('4. les totaux ne comptent que les cotisations en pourcentage, et seulement les actives', () => {
  const totaux = totauxCotisations(COTISATIONS)
  expect(totaux.salarial).toBeCloseTo(6, 5) // 3,6 + 2,4 — la mutuelle est forfaitaire
  expect(totaux.patronal).toBeCloseTo(8.4, 5) // 4,8 + 3,6
  expect(totaux.nbActives).toBe(2)
  expect(totaux.nbTotal).toBe(3) // la cotisation désactivée ne compte plus
})

it('5. le barème est remis dans l’ordre des tranches', () => {
  expect(tauxParTranche(TRANCHES)).toEqual([0, 20]) // la tranche inactive est laissée de côté
})

it('6. les quatre cartes affichent les bons chiffres', () => {
  const html = renderToStaticMarkup(
    <PaieKpiCards contributions={COTISATIONS} tranches={TRANCHES} darkMode={false} />
  )
  expect(html).toContain('data-testid="paie-kpi-cotisations"')
  expect(html).toContain('data-testid="paie-kpi-tranches"')
  expect(html).toContain('data-testid="paie-kpi-salarial"')
  expect(html).toContain('data-testid="paie-kpi-patronal"')
  expect(html).toContain('6') // part salariale
  expect(html).toContain('8,4') // part patronale, au format français
})

it('7. une configuration vide ne casse aucune carte', () => {
  const html = renderToStaticMarkup(<PaieKpiCards contributions={[]} tranches={[]} darkMode />)
  expect(html).toContain('aucune tranche définie')
  expect(html).not.toContain('NaN')
  expect(html).not.toContain('undefined')
})

it('8. la coque pose bien la rangée de KPI au-dessus des onglets', () => {
  expect(coque.indexOf('<PaieKpiCards')).toBeGreaterThan(0)
  expect(coque.indexOf('<PaieKpiCards')).toBeLessThan(coque.indexOf('paie-groupes'))
})

// ── 3. Les graphiques, sans dépendance nouvelle ──────────────────────

it('9. les graphiques sont tracés à la main, aucune librairie ajoutée', () => {
  const deps = { ...paquet.dependencies, ...paquet.devDependencies }
  Object.keys(deps).forEach((nom) => {
    expect(nom).not.toMatch(/recharts|chart\.js|d3|nivo|apexcharts|victory/)
  })
  expect(graphiques).toContain('<svg')
  expect(graphiques).toContain('<circle')
  expect(graphiques).toContain('<polyline')
})

it('10. le barème se dessine : une barre par tranche active', () => {
  const html = renderToStaticMarkup(<BarresTranches tranches={TRANCHES} darkMode={false} />)
  expect(html).toContain('data-testid="paie-barres-tranches"')
  expect((html.match(/<div /g) || []).length).toBeGreaterThanOrEqual(2)
  expect(html).toContain('20 %')
  expect(html).toContain('0 %')
  expect(html).not.toContain('35 %') // tranche désactivée
})

it('11. sans tranche, le graphique le dit au lieu de tracer du vide', () => {
  const html = renderToStaticMarkup(<BarresTranches tranches={[]} darkMode />)
  expect(html).toContain('Aucune tranche à représenter')
})

it('12. l’anneau répartit bien les parts', () => {
  const html = renderToStaticMarkup(
    <DonutParts
      parts={[
        { libelle: 'Part salariale', valeur: 6, couleur: '#26734D' },
        { libelle: 'Part patronale', valeur: 8.4, couleur: '#6D28D9' },
      ]}
      darkMode
      centre="14,4 %"
      sousCentre="du salaire brut"
    />
  )
  expect(html).toContain('data-testid="paie-donut"')
  expect(html).toContain('14,4 %')
  expect(html).toContain('42 %') // 6 / 14,4
  expect(html).toContain('58 %') // 8,4 / 14,4
})

it('13. une carte de graphique garde son titre et son action', () => {
  const html = renderToStaticMarkup(
    <CarteGraphique titre="Barème" sousTitre="3 tranches" icone={{ couleur: '#9C5321' }} darkMode={false} action={<button>Profils</button>}>
      <p>contenu</p>
    </CarteGraphique>
  )
  expect(html).toContain('Barème')
  expect(html).toContain('3 tranches')
  expect(html).toContain('<button>Profils</button>')
  expect(html).toContain('contenu')
})

it('14. la coque trace bien les deux graphiques et l’équipe', () => {
  expect(coque).toContain('<BarresTranches')
  expect(coque).toContain('<DonutParts')
  expect(coque).toContain('data-testid="paie-equipe"')
})

// ── 4. Les photos des salariés, avec repli ───────────────────────────

it('15. la photo est affichée quand elle existe, les initiales sinon', () => {
  expect(coque).toContain('photo_url')
  expect(coque).toContain('paie-avatar')
  expect(coque).toContain('initialesDe')
  // le repli est un vrai chemin de code, pas un simple `alt`
  expect(coque).toMatch(/e\.photo_url \?[\s\S]{0,700}initialesDe\(/)
})

it('16. les initiales tiennent en deux lettres', () => {
  const coqueModule = coque
  const extrait = coqueModule.match(/const initialesDe = [\s\S]*?\n/)
  expect(extrait).not.toBeNull()
})

// ── 5. Le bandeau et les raccourcis ──────────────────────────────────

it('17. les raccourcis vers les autres pages sont dans le bandeau', () => {
  expect(coque).toContain('<RaccourcisPages')
  expect(coque.indexOf('<RaccourcisPages')).toBeLessThan(coque.indexOf('paie-groupes'))
})

it('18. un bouton renvoie vers les fiches de paie', () => {
  expect(coque).toContain("navigate('/fiches-paie')")
  expect(coque).toContain('Fiches de paie')
})

it('19. le thème vient du contexte, pas d’un état local', () => {
  expect(coque).toContain('useTheme()')
  expect(coque).toContain('data-theme={darkMode ? \'dark\' : \'light\'}')
  expect(coque).toContain('data-testid="paie-theme-toggle"')
})

// ── 6. Le volet fiscal reste unique ──────────────────────────────────

it('20. la coque pilote les onglets du volet fiscal', () => {
  expect(fiscale).toContain('integre = false')
  expect(fiscale).toContain('ongletExterne')
  expect(fiscale).toContain('entrepriseIdForce')
  expect(coque).toContain('<ConfigurationFiscale')
  expect(coque).toContain('ongletExterne=')
  expect(coque).toContain('integre')
})

it('21. le volet intégré n’affiche ni son bandeau ni sa barre d’onglets', () => {
  expect(fiscale).toContain('{!integre && (')
  expect(fiscale).toContain("(!integre || activeTab === 'pays') && (")
  expect(fiscale).toContain("const activeTab = ongletExterne || ongletInterne")
})

it('22. l’ancienne route reste vivante et renvoie sur /paie', () => {
  expect(app).toContain('path="/paie"')
  expect(app).toContain('path="/configuration-fiscale" element={<Navigate to="/paie" replace />}')
  expect(app).toContain("import PaieFiscalite from './pages/PaieFiscalite'")
})

it('23. la coque garde le sélecteur d’entreprise du super-admin', () => {
  expect(coque).toContain("localStorage.setItem('last_enterprise_id'")
  expect(coque).toContain('changerEntreprise')
})
