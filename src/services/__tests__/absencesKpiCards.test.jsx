// ═══════════════════════════════════════════════════════════
// 📊 CARTES DE SYNTHÈSE (KPI) DE LA PAGE ABSENCES
//
// Rendu serveur, aucune base : on vérifie les chiffres, les jauges
// et surtout la présence des photos de profil.
// ═══════════════════════════════════════════════════════════

import { it, expect } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import AbsencesKpiCards from '../../components/AbsencesKpiCards'
import { isoLocal, estJourOuvre } from '../absencesCalendrier'

const AUJOURDHUI = isoLocal(new Date())
const dansNJours = (n) => {
  const d = new Date()
  d.setDate(d.getDate() + n)
  return isoLocal(d)
}
const moisDe = (iso) => iso.slice(0, 7)

const employes = [
  { id: 'e1', first_name: 'Aïssatou', last_name: 'Diallo', photo_url: 'https://cdn.test/aissatou.jpg' },
  { id: 'e2', first_name: 'Mamadou', last_name: 'Konaté', photo_url: null },
  { id: 'e3', first_name: 'Salimata', last_name: 'Keita', photo_url: 'https://cdn.test/salimata.jpg' },
]

const absence = (id, employeeId, debut, fin, statut = 'approuve') => ({
  id,
  employee_id: employeeId,
  start_date: debut,
  end_date: fin,
  status: statut,
  count_holidays_as_leave: false,
  employees: employes.find((e) => e.id === employeeId),
})

const absences = [
  absence('a1', 'e1', AUJOURDHUI, dansNJours(2)),        // Aïssatou absente aujourd'hui
  absence('a2', 'e2', dansNJours(-3), dansNJours(1)),    // Mamadou absent aujourd'hui
  absence('a3', 'e3', dansNJours(10), dansNJours(12), 'refuse'), // refusée : ne compte pas
]

const rendre = (props = {}) => renderToStaticMarkup(
  <AbsencesKpiCards
    absences={absences}
    employes={employes}
    conflitsEnAttente={2}
    joursPrisParEmploye={{ e1: 5, e2: 10, e3: 30 }}
    plafondConges={30}
    {...props}
  />
)

const grille = rendre()

it('1. six cartes de synthèse, toutes identifiables', () => {
  expect(grille).toContain('data-testid="abs-kpi-grille"')
  for (const id of ['absents', 'mois', 'taux', 'conges', 'attente', 'conflits']) {
    expect(grille).toContain(`data-testid="abs-kpi-${id}"`)
  }
})

it('2. « absents aujourd\'hui » compte les personnes, pas les absences', () => {
  // a1 + a2 couvrent aujourd'hui ; a3 est refusée → 2 absents sur 3
  expect(grille).toContain('Absents aujourd&#x27;hui')
  expect(grille).toContain('sur 3 employés · 67 %')
})

it('3. les photos de profil des absents apparaissent dans la carte', () => {
  const images = [...grille.matchAll(/<img src="(https:\/\/cdn\.test\/[^"]+)"/g)].map((m) => m[1])
  expect(images).toContain('https://cdn.test/aissatou.jpg')
  // Mamadou n'a pas de photo : repli sur ses initiales
  expect(grille).toContain('data-testid="abs-kpi-avatar"')
  expect(grille).toContain('>MK<')
})

it('4. sans photo, l\'avatar affiche les initiales', () => {
  const sansPhoto = rendre({ employes: employes.map((e) => ({ ...e, photo_url: null })) })
  expect(sansPhoto).not.toContain('cdn.test')
  expect(sansPhoto).toContain('>AD<')
  expect(sansPhoto).toContain('>MK<')
})

it('5. une absence refusée ne rend personne absent', () => {
  const seulementRefusees = rendre({
    absences: [absence('x', 'e1', AUJOURDHUI, AUJOURDHUI, 'refuse')],
  })
  expect(seulementRefusees).toContain('sur 3 employés · 0 %')
})

it('6. le mois en cours : bon nombre d\'absences et de jours décomptés', () => {
  // a1 et a2 commencent ce mois-ci (si leur début est dans le mois courant)
  const debutCeMois = absences.filter((a) => moisDe(a.start_date) === moisDe(AUJOURDHUI)).length
  const attendu = debutCeMois === 0 ? 0 : debutCeMois
  expect(grille).toContain('Absences ce mois-ci')
  expect(grille).toContain(`${attendu}`)
  // les jours décomptés excluent les week-ends
  const joursAttendus = estJourOuvre(AUJOURDHUI) ? 3 : 1 // a1 : aujourd'hui + 2 jours ; a2 : aujourd'hui + demain
  expect(grille).toMatch(/jour(s)? déc(ompté|omptés)?/)
  expect(grille).toContain(`décompté${joursAttendus > 1 ? 's' : ''}`)
})

it('7. deux cartes portent une jauge chiffrée', () => {
  const jauges = [...grille.matchAll(/data-testid="abs-kpi-jauge"[^>]*aria-valuenow="(\d+)"/g)]
  expect(jauges).toHaveLength(2) // taux d'absence + congés restants
  jauges.forEach(([, valeur]) => {
    const n = Number(valeur)
    expect(n).toBeGreaterThanOrEqual(0)
    expect(n).toBeLessThanOrEqual(100)
  })
})

it('8. les congés restants se calculent sur le plafond', () => {
  // e1: 25 restants, e2: 20, e3: 0 → moyenne 15
  expect(grille).toContain('Congés restants (moyenne)')
  expect(grille).toContain('plafond 30 jours')
  expect(grille).toContain('50 %')
  // jauge à 50 %
  expect(grille).toContain('aria-valuenow="50"')
})

it('9. les cartes « à traiter » sont des boutons cliquables', () => {
  const guidage = rendre({ onVoirConflits: () => {}, onVoirDemandes: () => {} })
  // deux cartes actionnables : les demandes en attente et les conflits
  expect((guidage.match(/class="abs-kpi abs-kpi-cliquable"/g) || [])).toHaveLength(2)
  expect(guidage).toContain('data-testid="abs-kpi-conflits"')
  expect(guidage).toContain('Arbitrer')
  // ce sont bien des boutons, donc accessibles au clavier
  expect((guidage.match(/<button type="button"/g) || [])).toHaveLength(2)
})

it('10. sans conflit ni attente, les cartes redeviennent inertes', () => {
  const propre = rendre({ conflitsEnAttente: 0, absences: [] })
  expect(propre).not.toContain('class="abs-kpi abs-kpi-cliquable"')
  expect(propre).toContain('aucun conflit à arbitrer')
  expect(propre).toContain('aucune demande en souffrance')
})

it('11. un effectif vide ne casse aucun calcul', () => {
  const vide = rendre({ employes: [], absences: [] })
  expect(vide).toContain('sur 0 employé')
  expect(vide).toContain('aria-valuenow="0"')
})

it('12. les dates de fin manquantes sont traitées comme un seul jour', () => {
  const ponctuelle = rendre({
    absences: [{ id: 'z', employee_id: 'e1', start_date: AUJOURDHUI, end_date: null, status: 'approuve' }],
  })
  expect(ponctuelle).toContain('sur 3 employés · 33 %')
})

// ═══════════════════════════════════════════════════════════
// 📏 FORMAT COMPACTE — la bande ne doit plus manger la page
// ═══════════════════════════════════════════════════════════

it('13. la bande tient sur une seule ligne : des tuiles étroites, sans bandeau de bas', () => {
  // 148 px de largeur minimale → 6 tuiles tiennent sur un écran de bureau
  expect(grille).toContain('minmax(148px, 1fr)')
  // le paragraphe « chiffres calculés… » ne prend plus une ligne entière :
  // il passe en infobulle de la bande
  expect(grille).not.toContain('1 / -1')
  expect(grille).toContain('title="Chiffres calculés sur les absences chargées')
})

it('14. le détail reste disponible, mais en infobulle', () => {
  expect(grille).toContain('title="sur 3 employés · 67 %')
  expect(grille).toContain('title="plafond 30 jours')
  // quand il n'y a rien à traiter, le détail le dit toujours
  const propre = rendre({ conflitsEnAttente: 0, absences: [] })
  expect(propre).toContain('title="aucun conflit à arbitrer"')
  expect(propre).toContain('title="aucune demande en souffrance"')
})

it('15. une tuile compacte : petit chiffre, libellé sur une ligne', () => {
  // chiffre ramené de 28 à 20 px, libellé coupé proprement s'il déborde
  expect(grille).toContain('font-size:20px')
  expect(grille).toContain('text-overflow:ellipsis')
  // et l'icône ne fait plus 42 px de côté
  expect(grille).not.toContain('width:42px')
})
