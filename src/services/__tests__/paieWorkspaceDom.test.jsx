// @vitest-environment jsdom
import React, { act, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, afterEach, it, expect, vi } from 'vitest'
import { readFileSync } from 'node:fs'
const state = vi.hoisted(() => ({ enterprises: [], error: null }))
vi.mock('../../lib/supabase', () => ({ supabase: { from: () => ({ select() { return this }, eq() { return this }, order: async () => ({ data: state.enterprises, error: state.error }) }) } }))
vi.mock('../../contexts/ThemeContext', () => ({ useTheme: () => ({ darkMode: false, toggleTheme: vi.fn() }) }))
vi.mock('../../components/RaccourcisPages', () => ({ default: () => <nav>Pointages · Planning</nav> }))
vi.mock('../../components/PaieEntreprises', () => ({ default: () => <div>Copies administratives</div> }))
vi.mock('../../pages/FichesPaie', () => ({ default: function Draft({ entrepriseIdForce }) { const [value, setValue] = useState(''); return <input aria-label={`Brouillon ${entrepriseIdForce}`} value={value} onChange={e => setValue(e.target.value)}/> } }))
vi.mock('../../pages/ConfigurationFiscale', () => ({ default: () => <div>Éditeur fiscal</div> }))
import PaieFiscalite, { paieAccess } from '../../pages/PaieFiscalite'
import PaiePreparation, { resumePreparation, grouperControles } from '../../components/PaiePreparation'
let host, root
beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true
  state.enterprises = [{ id: 'A', name: 'Entreprise A', country_code: 'COG', currency: 'XAF', logo_url: 'https://exemple/logo-a.png', module_fiches_paie: true, module_config_fiscale: true }, { id: 'B', name: 'Entreprise B', module_fiches_paie: false, module_config_fiscale: true }]
  state.error = null
  localStorage.setItem('admin', JSON.stringify({ id: 'admin', role: 'admin', enterprise_id: 'A', entreprises: [{ id: 'A' }, { id: 'B' }] }))
  host = document.createElement('div'); document.body.appendChild(host); root = createRoot(host)
})
afterEach(async () => { await act(async () => root.unmount()); host.remove(); vi.restoreAllMocks() })
const render = async element => { await act(async () => { root.render(element) }) }
const click = async label => { const button = [...host.querySelectorAll('button')].find(b => b.textContent.trim() === label.trim()); expect(button).toBeTruthy(); await act(async () => button.click()) }
const input = async (el, value) => { await act(async () => { Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(el, value); el.dispatchEvent(new Event('input', { bubbles: true })) }) }
it('matrice des deux modules : fiscalité seule, paie seule, aucun, super-admin', () => {
  expect(paieAccess({ module_config_fiscale: true }, false)).toEqual({ fiscal: true, bulletins: false })
  expect(paieAccess({ module_fiches_paie: true }, false)).toEqual({ fiscal: false, bulletins: true })
  expect(paieAccess({}, false)).toEqual({ fiscal: false, bulletins: false })
  expect(paieAccess({}, true)).toEqual({ fiscal: true, bulletins: true })
})
it('trois sections et les deux bandeaux validés, brouillon conservé en changeant de volet', async () => {
  await render(<MemoryRouter><PaieFiscalite/></MemoryRouter>)
  expect(host.querySelectorAll('.pw-tabs button')).toHaveLength(3)
  //  Une seule bande de motif demeure : celle du pied. Celle du haut a
  //  disparu le 27/11 — le bogolan entoure maintenant le bloc de tête.
  expect(host.querySelectorAll('.pw-bogolan')).toHaveLength(1)
  expect(host.querySelector('.pw-bogolan-top')).toBeNull()
  const draft = host.querySelector('[aria-label="Brouillon A"]')
  await input(draft, 'En cours')
  await click('Fiscalité')
  expect(draft.closest('[hidden]')).toBeTruthy()
  await click('Bulletins')
  expect(host.querySelector('[aria-label="Brouillon A"]')).toBe(draft)
  expect(draft.value).toBe('En cours')
})
it('changement entreprise confirmé : le volet précédent est démonté et les droits sont recalculés', async () => {
  vi.spyOn(window, 'confirm').mockReturnValue(true)
  await render(<MemoryRouter><PaieFiscalite/></MemoryRouter>)
  const previous = host.querySelector('[aria-label="Brouillon A"]')
  const select = host.querySelector('.pw-bandeau-entreprise select')
  expect(select).toBeTruthy()
  await act(async () => { select.value = 'B'; select.dispatchEvent(new Event('change', { bubbles: true })) })
  expect(previous.isConnected).toBe(false)
  expect(host.querySelectorAll('.pw-tabs button')).toHaveLength(1)
  expect(host.querySelector('.pw-tabs').textContent).toBe('Fiscalité')
})
it('le bloc de tête est celui des Retards : cadre bogolan, ni raccourcis ni bouton de thème', async () => {
  await render(<MemoryRouter><PaieFiscalite/></MemoryRouter>)
  const source = readFileSync('src/pages/PaieFiscalite.jsx', 'utf8')
  const css = readFileSync('src/pages/PaieWorkspace.css', 'utf8')

  //  « Un bloc encerclé du bandeau bogolan » : la toile est en CADRE, et
  //  c'est la planche posée dessus qui masque le milieu.
  const cadre = host.querySelector('.pw-cadre')
  expect(cadre).toBeTruthy()
  expect(cadre.querySelector('.ec-cultural-cadre')).toBeTruthy()
  expect(cadre.querySelector('.ec-cultural-cadre').getAttribute('data-cultural-motif')).toBe('bogolan')
  expect(cadre.querySelector('.pw-planche')).toBeTruthy()

  //  Repris tel quel du `.rt-cadre` / `.rt-bandeau` des Retards.
  expect(css).toMatch(/\.pw-cadre \{[^}]*--pw-cadre-epaisseur: 26px;/)
  expect(css).toMatch(/\.pw-cadre \{[^}]*--ec-cadre-epaisseur: var\(--pw-cadre-epaisseur\);/)
  expect(css).toMatch(/\.pw-bandeau button\.pw-retour \{[^}]*width: 36px;/)
  expect(css).toMatch(/\.pw-bandeau-titre h1 \{[^}]*font-size: 17px;/)

  //  Les deux retraits du 27/11 : plus de raccourcis, plus de bascule de thème.
  expect(host.querySelector('.pw-shortcuts')).toBeNull()
  expect(source).not.toContain('RaccourcisPages')
  expect(source).not.toMatch(/aria-label=\{darkMode \? 'Mode clair' : 'Mode sombre'\}/)

  //  Le titre et son sous-titre, l'entreprise à droite.
  expect(host.querySelector('.pw-bandeau-titre h1').textContent).toContain('Paie & Fiscalité')
  expect(host.querySelector('.pw-bandeau-titre p').textContent).toBe('Vos équipes. Votre rythme.')
  expect(host.querySelector('.pw-bandeau-entreprise select')).toBeTruthy()
})

it('le bloc de tête est collant, et seul le contenu défile dessous', async () => {
  await render(<MemoryRouter><PaieFiscalite/></MemoryRouter>)
  const css = readFileSync('src/pages/PaieWorkspace.css', 'utf8')

  //  « Je ne veux pas que ce bloc bouge quand je scrolle, mais que tout le
  //  reste puisse glisser dessous. » Deux étages, dans cet ordre.
  const fixe = host.querySelector('.pw-fixe')
  const defile = host.querySelector('.pw-defile')
  expect(fixe).toBeTruthy()
  expect(defile).toBeTruthy()
  expect(fixe.compareDocumentPosition(defile) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()

  //  Le cadre bogolan et les DEUX barres sont dans la partie fixe…
  expect(fixe.querySelector('.pw-cadre')).toBeTruthy()
  expect(fixe.querySelector('.ec-cultural-cadre')).toBeTruthy()
  expect(fixe.querySelector('.pw-tabs')).toBeTruthy()
  expect(fixe.querySelector('.pw-subtabs')).toBeTruthy()

  //  …et le contenu des volets dans celle qui défile.
  expect(defile.querySelector('.pw-main')).toBeTruthy()
  //  (`closest` marche pour les deux cas : un `.pw-main` même caché est
  //  toujours rattaché à SON étage, quel que soit celui qui est monté.)
  expect(defile.querySelector('.pw-main').closest('.pw-fixe')).toBeNull()
  expect(defile.querySelector('.pw-main').closest('.pw-defile')).toBe(defile)

  //  Collant, pas figé : le défilement reste celui de la page.
  expect(css).toMatch(/\.pw-fixe \{[^}]*position: sticky;/)
  expect(css).toMatch(/\.pw-fixe \{[^}]*top: 0;/)
  //  Un fond opaque, sans quoi le contenu se verrait à travers le bogolan.
  expect(css).toMatch(/\.pw-fixe \{[^}]*background: var\(--paie-bg\);/)
  expect(css).toMatch(/\.pw-fixe \.pw-tabs \{[^}]*background: var\(--paie-bg-elevated\);/)

  //  Sur téléphone, la barre rendrait l'écran au bandeau : elle redevient normale.
  //  On lit la DERNIÈRE règle du fichier : plusieurs paliers 820 existent
  //  depuis les débuts de la page, c'est celui-ci qui décide.
  const dernierPalier = css.slice(css.lastIndexOf('@media (max-width: 820px)'))
  expect(dernierPalier).toMatch(/\.pw-fixe \{\s*position: static;\s*\}/)
})

it('la sidebar et son rail sont revenus, avec les logos des entreprises', async () => {
  await render(<MemoryRouter><PaieFiscalite/></MemoryRouter>)
  const source = readFileSync('src/pages/PaieFiscalite.jsx', 'utf8')

  //  « Ramène aussi la sidebar + son rail » : la coque partagée, pas une
  //  barre réécrite pour cette page.
  expect(host.querySelector('.coque-admin')).toBeTruthy()
  expect(host.querySelector('.coque-admin > .sb')).toBeTruthy()
  expect(host.querySelector('.sb-rail')).toBeTruthy()
  expect(source).toContain('<CoqueAdmin')
  expect(source).toContain('<SidebarUnique')

  //  « avec les images profil des entreprises affichées » : sans `logo_url`
  //  dans la lecture, la bande du rail retombe sur l'initiale.
  expect(source).toContain('logo_url')

  //  Le rail s'allume sur Paie & fiscalité, et les autres rubriques sont là.
  expect(host.querySelector('.sb-rail').textContent.length).toBeGreaterThan(0)
})

it('une erreur réseau ne devient pas un zéro salarié', async () => {
  state.error = { message: 'Connexion interrompue' }
  await render(<MemoryRouter><PaieFiscalite/></MemoryRouter>)
  expect(host.querySelector('[role="alert"]').textContent).toContain('Connexion interrompue')
  expect(host.querySelector('main')).toBeNull()
})
const employees = [{ id: '1', first_name: 'Awa', last_name: 'D.' }, { id: '2', first_name: 'Paul', last_name: 'B.' }]
const profiles = [{ employee_id: '1', salary_type: 'monthly', base_salary: 250000 }]
it('les graphiques et statuts viennent des profils et calculs, sans données fictives', async () => {
  expect(resumePreparation(employees, profiles).ready).toBe(1)
  const props = { employees, profiles, currency: 'XAF', start: '2026-10-01', end: '2026-10-31', onGenerate: vi.fn(), onHistory: vi.fn(), onNavigate: vi.fn(), onEmployee: vi.fn() }
  await render(<PaiePreparation {...props} previewRows={[]}/>)
  expect(host.textContent).toContain('Le graphique apparaîtra après le calcul')
  await click('Vérifier et calculer'); expect(props.onGenerate).toHaveBeenCalledTimes(1)
  await click(' Historique'); expect(props.onHistory).toHaveBeenCalledTimes(1)
  await input(host.querySelector('[aria-label="Rechercher un salarié"]'), 'Paul')
  expect(host.querySelectorAll('tbody tr')).toHaveLength(1)
  await render(<PaiePreparation {...props} previewRows={[{ grossSalary: 250000, netSalary: 220000 }]}/>)
  expect(host.querySelector('[aria-label="Graphique des bulletins calculés"]').textContent).toContain('220')
  expect(host.textContent).not.toContain('Le graphique apparaîtra après le calcul')
})
it('les actions intégrées sont branchées au vrai moteur et à l’historique', () => {
  const source = readFileSync('src/pages/FichesPaie.jsx', 'utf8')
  expect(source).toContain('onGenerate={handleTryGenerate}')
  expect(source).toContain('onHistory={() => { loadHistory(); setShowHistoryModal(true) }}')
  expect(source).toContain("integre && activeTab === 'preview'")
  expect(source).toContain('settings: persistedSettings')
})

it('les contrôles sont regroupés par identifiant sans perdre les remarques', () => {
  expect(grouperControles([
    { employeeId: 'A', employee: 'Emma B.', reason: 'N° CNSS manquant' },
    { employeeId: 'A', employee: 'Emma B.', reason: 'Date d’embauche manquante' },
    { employeeId: 'B', employee: 'Emma B.', reason: 'Aucun profil' },
  ])).toEqual([
    { key: 'A', name: 'Emma B.', reasons: ['N° CNSS manquant', 'Date d’embauche manquante'] },
    { key: 'B', name: 'Emma B.', reasons: ['Aucun profil'] },
  ])
})
it('médaillons de navigation accessibles et contexte entreprise explicite', async () => {
  await render(<MemoryRouter><PaieFiscalite/></MemoryRouter>)
  expect(host.querySelectorAll('.pw-coin-tab')).toHaveLength(5)
  expect(host.querySelectorAll('.pw-coin-tab[aria-current="page"]')).toHaveLength(1)
  expect(host.querySelector('[aria-label="Entreprise"]')).toBeTruthy()
  expect(host.querySelector('[aria-label="Pays fiscal et devise"]').textContent).toContain('COG')
  await click('Profils salariés')
  expect(host.querySelector('.pw-coin-tab[aria-current="page"]').textContent).toBe('Profils salariés')
})
it('affiche toutes les anomalies, y compris après la quatrième, dans une liste regroupée', async () => {
  const issues = Array.from({ length: 6 }, (_, i) => ({ employeeId: 'A', employee: 'Emma B.', reason: `Contrôle ${i + 1}` }))
  await render(<PaiePreparation employees={employees} profiles={profiles} previewRows={[]} issues={issues} start="2026-10-01" end="2026-10-31"/>)
  expect(host.querySelectorAll('.pw-issue-person')).toHaveLength(1)
  expect(host.querySelectorAll('.pw-issue-person li')).toHaveLength(6)
  expect(host.querySelector('.pw-review-summary').textContent).toContain('1 salarié concerné')
  expect(host.querySelector('.pw-table-footer').textContent).toContain('2 sur 2 salariés')
})
