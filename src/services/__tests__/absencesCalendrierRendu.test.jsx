import { it, expect } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import AbsencesCalendrier from '../../components/AbsencesCalendrier'
import AbsenceTiroir from '../../components/AbsenceTiroir'

const employes = [
  { id: 'e1', first_name: 'Aïssatou', last_name: 'Diallo', enterprise_id: 'ent1' },
  { id: 'e2', first_name: 'Mamadou', last_name: 'Konaté', enterprise_id: 'ent1' },
  { id: 'e3', first_name: 'Salimata', last_name: 'Keita', enterprise_id: 'ent1' },
]

const absence = (id, employeeId, start, end, reason, status, extra = {}) => ({
  id,
  employee_id: employeeId,
  enterprise_id: 'ent1',
  start_date: start,
  end_date: end,
  reason,
  status,
  notes: null,
  document_url: null,
  count_holidays_as_leave: false,
  created_at: '2025-04-01T08:00:00Z',
  employees: { first_name: 'Aïssatou', last_name: 'Diallo', matricule: 'ENN-0001' },
  ...extra,
})

const absences = [
  absence('a1', 'e1', '2025-04-14', '2025-04-18', 'conge', 'approuve'),
  absence('a2', 'e2', '2025-03-30', '2025-04-02', 'maladie', 'en_attente'), // à cheval sur mars
  absence('a3', 'e2', '2025-04-21', '2025-04-22', 'formation', 'refuse'),
  absence('a4', 'e1', '2025-05-05', '2025-05-09', 'conge', 'approuve'), // hors du mois affiché
]

const grille = renderToStaticMarkup(
  <AbsencesCalendrier
    absences={absences}
    employes={employes}
    annee={2025}
    mois={3}
    mode="mois"
    darkMode
    joursPrisParEmploye={{ e1: 4 }}
    plafondConges={30}
  />
)

it('1. le calendrier se monte et affiche le mois demandé', () => {
  expect(grille).toContain('Avril 2025')
  expect(grille).toContain('Employé')
  expect(grille).toContain('data-testid="abs-cal-barre"')
})

it('2. une ligne par employé, absence ou pas', () => {
  expect(grille).toContain('Aïssatou')
  expect(grille).toContain('Diallo')
  expect(grille).toContain('Mamadou')
  expect(grille).toContain('Salimata') // employé sans aucune absence
})

it('3. trois barres dessinées, celle de mai ignorée', () => {
  const nbBarres = (grille.match(/data-testid="abs-cal-barre"/g) || []).length
  expect(nbBarres).toBe(3)
  expect(grille).toContain('data-statut="approuve"')
  expect(grille).toContain('data-statut="en_attente"')
  expect(grille).toContain('data-statut="refuse"')
})

it('4. les libellés de motif sont lisibles, pas des identifiants', () => {
  expect(grille).toContain('Congé payé')
  expect(grille).toContain('Maladie')
  expect(grille).toContain('Formation')
  expect(grille).not.toMatch(/>\s*conge\s*</)
})

it('5. une absence à cheval sur le mois précédent est signalée', () => {
  expect(grille).toContain('‹')
})

it('6. le solde de congés est affiché par employé', () => {
  expect(grille).toContain('26/30') // 30 - 4 jours pris
  expect(grille).toContain('30/30') // employé qui n'a rien pris
})

it('7. la légende explique chaque façon de dessiner une barre', () => {
  expect(grille).toContain('En attente (contour pointillé)')
  expect(grille).toContain('Refusé (barré)')
  expect(grille).toContain('à cheval sur la période')
})

it('8. le tiroir affiche une absence en attente avec les deux décisions', () => {
  const html = renderToStaticMarkup(
    <AbsenceTiroir absence={absences[1]} darkMode joursOuvres={4} solde={{ pris: 4, plafond: 30, restant: 26 }} />
  )
  expect(html).toContain('role="dialog"')
  expect(html).toContain('Maladie')
  expect(html).toContain('En attente')
  expect(html).toContain('data-testid="tiroir-approuver"')
  expect(html).toContain('data-testid="tiroir-refuser"')
  expect(html).toContain('4 jours')
  expect(html).toContain('26 j restants')
  // la doctrine a changé : supprimer est possible, et confirmé en deux temps
  expect(html).toContain('La suppression l’efface partout, planning compris')
})

it('9. le tiroir d’une absence déjà approuvée ne propose pas de l’approuver deux fois', () => {
  const html = renderToStaticMarkup(<AbsenceTiroir absence={absences[0]} darkMode joursOuvres={5} />)
  expect(html).not.toContain('data-testid="tiroir-approuver"')
  expect(html).toContain('data-testid="tiroir-refuser"')
})

it('10. le tiroir d’une absence refusée peut être réapprouvée', () => {
  const html = renderToStaticMarkup(<AbsenceTiroir absence={absences[2]} darkMode joursOuvres={2} />)
  expect(html).toContain('data-testid="tiroir-approuver"')
  expect(html).not.toContain('data-testid="tiroir-refuser"')
})
