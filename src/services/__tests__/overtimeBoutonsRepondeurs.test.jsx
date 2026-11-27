// @vitest-environment jsdom
/*  ┌────────────────────────────────────────────────────────────────────────┐
    │  « LES BOUTONS EXPORTER CSV ET RÈGLES DE CALCUL NE SONT PAS            │
    │   FONCTIONNELS. » (fondateur, 27/11, capture à l'appui : les deux       │
    │   boutons en beige, sans cerclage.)                                      │
    │                                                                          │
    │  Ils étaient « désactivés » — `disabled={loading || error || !rows.length}`│
    │  et `disabled={enterpriseId === 'all' && isSuperAdmin}` — donc le clic   │
    │  était AVALÉ : aucune réponse, aucune raison, aucun mouvement. Un        │
    │  bouton inerte n'apprend rien à celui qui le regarde ; ici de surcroît    │
    │  l'état désactivé du kit (fond `surface2`, bordure transparente) se        │
    │  lisait comme une impression ratée, pas comme un refus.                  │
    │                                                                          │
    │  Ce fichier verrouille la loi neuve : un bouton de cet écran soit FAIT,   │
    │  soit DIT. Le `disabled` ne garde qu'une justification — ce qui est en    │
    │  train d'arriver (chargement, erreur réseau). Tout le reste devient un    │
    │  avis écrit (`role="status"`) ET un focus envoyé sur la commande qui     │
    │  débloque. Les deux sont vérifiés ici, stylo en main : `onExport`/       │
    │  `onSettings` espionnés, `document.activeElement` comparé.               │
    └────────────────────────────────────────────────────────────────────────┘ */
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { renderToStaticMarkup } from 'react-dom/server'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import OvertimeDashboard from '../../components/OvertimeDashboard'
import { overtimePeriod } from '../../utils/overtimePresentation'

const row = (id, dateStr, worked, overtime) => ({
  employee: { id, first_name: 'Amina', last_name: id },
  dateStr,
  totalSecondes: worked,
  overtime: {
    totalOvertimeSeconds: overtime,
    contractualSeconds: 28800,
    overtimeSeconds: overtime,
    rateApplied: 25,
  },
})
const rows = [
  row('a', '2026-10-01', 32400, 3600),
  row('a', '2026-10-08', 36000, 7200),
  row('b', '2026-10-08', 28800, 0),
]

const props = (sur) => ({
  rows,
  dates: overtimePeriod('2026-10-23', 'monthly'),
  mode: 'monthly',
  setMode: vi.fn(),
  selectedDate: '2026-10-23',
  setDate: vi.fn(),
  loading: false,
  error: null,
  retry: vi.fn(),
  enterprises: [{ id: 'ent', name: 'Atelier de Porto-Novo' }],
  enterpriseId: 'all',
  setEnterprise: vi.fn(),
  isSuperAdmin: true,
  canEdit: true,
  onSettings: vi.fn(),
  onExport: vi.fn(),
  ...sur,
})

const parTexte = (host, libelle) =>
  [...host.querySelectorAll('button')].find(
    (b) => b.textContent.trim() === libelle || b.getAttribute('aria-label') === libelle,
  )

let host, root
beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true
  host = document.createElement('div')
  document.body.append(host)
  root = createRoot(host)
})
afterEach(() => {
  root.unmount()
  host.remove()
})
const monter = async (p) => {
  await act(async () => root.render(<OvertimeDashboard {...p} />))
}
const toucher = async (b) => {
  await act(async () => b.click())
}

it('refuse d’exporter le vide en le disant, au lieu d’avaler le clic', async () => {
  const p = props({ rows: [] })
  await monter(p)
  const bouton = parTexte(host, 'Exporter CSV')
  expect(bouton, 'le bouton doit exister').toBeTruthy()
  //  plus désactivé : un refus muet est un bug, un refus écrit est une réponse.
  expect(bouton.disabled, 'un bouton qui sait pourquoi il dit non reste vivant').toBe(false)
  await toucher(bouton)
  expect(p.onExport).not.toHaveBeenCalled()
  const avis = host.querySelector('.ot-avis')
  expect(avis).toBeTruthy()
  expect(avis.getAttribute('role')).toBe('status')
  expect(avis.textContent).toContain('Rien à exporter')
  expect(avis.textContent).toContain('que ses colonnes')
  //  et le geste utile est proposé là où il débloque : le champ de période.
  expect(document.activeElement.id).toBe('ot-filtre-date')
})

it('n’ouvre pas les règles sur « Toutes les entreprises » sans mener au sélecteur', async () => {
  const p = props({})
  await monter(p)
  await toucher(parTexte(host, 'Règles de calcul'))
  expect(p.onSettings).not.toHaveBeenCalled()
  const avis = host.querySelector('.ot-avis')
  expect(avis.textContent).toContain('Une entreprise à la fois')
  //  le focus part sur LE champ qui rendra le prochain clic fécond
  expect(document.activeElement.id).toBe('ot-filtre-entreprise')
})

it('fait les deux gestes dès que la condition est réunie', async () => {
  const p = props({ enterpriseId: 'ent' })
  await monter(p)
  await toucher(parTexte(host, 'Exporter CSV'))
  expect(p.onExport).toHaveBeenCalledTimes(1)
  await toucher(parTexte(host, 'Règles de calcul'))
  expect(p.onSettings).toHaveBeenCalledTimes(1)
  expect(host.querySelector('.ot-avis')).toBeNull()
})

it('enterrer l’avis avec la situation, pas avec un chronomètre', async () => {
  const p = props({})
  await monter(p)
  await toucher(parTexte(host, 'Règles de calcul'))
  expect(host.querySelector('.ot-avis')).toBeTruthy()
  //  une entreprise est choisie : le refus n'a plus d'objet, il doit disparaître
  //  sans que personne ne clique deux fois.
  await monter(props({ ...p, enterpriseId: 'ent' }))
  expect(host.querySelector('.ot-avis')).toBeNull()
})

it('reste désactivé pendant ce qui arrive vraiment — le chargement et l’erreur', async () => {
  /*  le `disabled` n'a plus qu'UNE justification : ce que l'utilisateur ne
        peut pas changer en cliquant. Le chargement et l'erreur réseau sont de
        ceux-là ; « il n'y a rien sur la période » n'en est pas. */
  for (const etat of [{ loading: true }, { error: 'Impossible de charger' }]) {
    await monter(props(etat))
    expect(parTexte(host, 'Exporter CSV').disabled).toBe(true)
  }
})

it('donne à chaque vide une cause chiffrée et une sortie', () => {
  const vide = renderToStaticMarkup(<OvertimeDashboard {...props({ rows: [] })} />)
  //  le mot d'avant est gardé mot pour mot — il est le titre, plus le seul
  //  élément de la phrase.
  expect(vide).toContain('Aucun pointage clôturé sur cette période.')
  expect(vide).toContain('Aucune heure supplémentaire sur cette période.')
  //  la cause : des nombres déjà calculés par la page, en mono, rien d'inventé
  expect(vide).toMatch(/Du 2026-10-01 au 2026-10-31/)
  /*  le même nombre, DEUX fois : le trou du graphe et le trou de la liste
        examinent la MÊME période, et s'ils s'écrivaient des durées différentes
        l'un des deux mentirait. L'aiguille compte donc les deux occurrences. */
  expect(vide.match(/<strong class="ot-vide-nombre">31<\/strong>/g) || []).toHaveLength(2)
  expect(vide).toContain('journée')
  expect(vide).toContain('seuls les couples entrée')
  expect(vide).toContain('travaillées sur')
  expect(vide).toContain('aucune ne dépasse le seuil')
  //  la sortie : UN geste, celui qui change la cause
  //  le geste, pas l'aria-label de la flèche du filtre : `<button>` entier.
  expect(vide).toMatch(/<button type="button" class="ch-btn-contour">Période précédente<\/button>|class="ch-btn-contour">Période précédente/)
  //  et la table vide ne fait plus semblant d'avoir des colonnes
  expect(vide).not.toContain('ot-table-head')
  expect(vide.match(/role="status"/g)).toHaveLength(2)
  const plein = renderToStaticMarkup(<OvertimeDashboard {...props({})} />)
  expect(plein).toContain('ot-table-head')
  expect(plein).not.toContain('ot-vide')
})

it('fait reculer la période depuis l’état vide, et effacer la recherche du sien', async () => {
  const p = props({ rows: [], setDate: vi.fn() })
  await monter(p)
  await toucher(parTexte(host, 'Période précédente'))
  //  mensuel, 2026-10-23 → premier jour du mois précédent : c'est `shift(-1)`,
  //  le MÊME que la flèche du filtre — pas un second calcul d'un autre bord.
  expect(p.setDate).toHaveBeenCalledWith('2026-09-01')

  const avecRecherche = props({})
  await monter(avecRecherche)
  const champ = host.querySelector('.ot-search input')
  const setValeur = Object.getOwnPropertyDescriptor(
    window.HTMLInputElement.prototype,
    'value',
  ).set
  await act(async () => {
    setValeur.call(champ, 'zzz')
    champ.dispatchEvent(new Event('input', { bubbles: true }))
  })
  expect(host.textContent).toContain('Aucun employé ne correspond à la recherche.')
  //  `textContent` et non le HTML : React coupe `employé{'s'}` d'un commentaire
  //  et une aiguille sur la chaîne crue chercherait un mot qui n'existe pas.
  expect(host.textContent).toContain('2 employés ont des heures')
  const geste = parTexte(host, 'Effacer la recherche')
  expect(geste).toBeTruthy()
  await toucher(geste)
  expect(host.querySelector('.ot-search input').value).toBe('')
  expect(host.querySelector('.ot-vide')).toBeNull()
})
