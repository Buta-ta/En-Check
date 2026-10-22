// ═══════════════════════════════════════════════════════════
// 🗓️ CALENDRIER — MODES JOUR · SEMAINE · MOIS
//
// Même discipline que les autres tests : calculs purs d'un côté,
// rendu serveur de l'autre, sans base ni navigateur.
// ═══════════════════════════════════════════════════════════

import { it, expect } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import AbsencesCalendrier from '../../components/AbsencesCalendrier'
import {
  joursDeLaSemaine,
  jourUnique,
  debutDeSemaine,
  ajouterJours,
  joursDeLaPeriode,
  deplacerPeriode,
  segmentSurJours,
  titrePeriode,
  nomJourLong,
  jourIso,
} from '../absencesCalendrier'

// ── 1. Les calculs purs ───────────────────────────────────────────────
it('1. le lundi ouvre la semaine, même pour un dimanche', () => {
  expect(debutDeSemaine('2026-10-21')).toBe('2026-10-19') // mercredi → lundi
  expect(debutDeSemaine('2026-10-25')).toBe('2026-10-19') // dimanche → lundi précédent
  expect(debutDeSemaine('2026-10-19')).toBe('2026-10-19') // lundi → lui-même
})

it('2. une semaine fait 7 jours, du lundi au dimanche', () => {
  const jours = joursDeLaSemaine('2026-10-21')
  expect(jours).toHaveLength(7)
  expect(jours[0].iso).toBe('2026-10-19')
  expect(jours[0].weekday).toBe(1) // lundi
  expect(jours[6].iso).toBe('2026-10-25')
  expect(jours[6].weekend).toBe(true) // dimanche
  expect(jours[5].weekend).toBe(true) // samedi
})

it('3. une semaine à cheval sur deux mois reste continue', () => {
  const jours = joursDeLaSemaine('2026-11-01') // dimanche
  expect(jours[0].iso).toBe('2026-10-26')
  expect(jours[6].iso).toBe('2026-11-01')
})

it('4. ajouter des jours franchit les mois et les années', () => {
  expect(ajouterJours('2026-10-21', 7)).toBe('2026-10-28')
  expect(ajouterJours('2026-10-21', -21)).toBe('2026-09-30')
  expect(ajouterJours('2026-12-31', 1)).toBe('2027-01-01')
})

it('5. le mode jour ne renvoie qu’un seul jour', () => {
  const jours = jourUnique('2026-10-21')
  expect(jours).toHaveLength(1)
  expect(jours[0].iso).toBe('2026-10-21')
})

it('6. deplacerPeriode avance d’un mois, d’une semaine ou d’un jour', () => {
  const contexte = { annee: 2026, mois: 9, jourIso: '2026-10-21' }

  const mois = deplacerPeriode('mois', contexte, 1)
  expect(mois.annee).toBe(2026)
  expect(mois.mois).toBe(10)

  const moisPrecedent = deplacerPeriode('mois', { ...contexte, mois: 0 }, -1)
  expect(moisPrecedent.annee).toBe(2025)
  expect(moisPrecedent.mois).toBe(11)

  expect(deplacerPeriode('semaine', contexte, 1).jourIso).toBe('2026-10-28')
  expect(deplacerPeriode('semaine', contexte, -1).jourIso).toBe('2026-10-14')
  expect(deplacerPeriode('jour', contexte, 1).jourIso).toBe('2026-10-22')
  expect(deplacerPeriode('jour', contexte, -1).jourIso).toBe('2026-10-20')
})

it('7. joursDeLaPeriode sert les trois modes avec la même forme', () => {
  const contexte = { annee: 2026, mois: 9, jourIso: '2026-10-21' }
  expect(joursDeLaPeriode('mois', contexte)).toHaveLength(31)
  expect(joursDeLaPeriode('semaine', contexte)).toHaveLength(7)
  expect(joursDeLaPeriode('jour', contexte)).toHaveLength(1)
  joursDeLaPeriode('semaine', contexte).forEach((j) => {
    expect(j).toHaveProperty('iso')
    expect(j).toHaveProperty('weekday')
    expect(j).toHaveProperty('weekend')
  })
})

it('8. un segment est découpé sur n’importe quelle période', () => {
  const semaine = joursDeLaSemaine('2026-10-21') // lun 19 → dim 25

  // absence à cheval : commence avant, finit pendant
  expect(segmentSurJours('2026-10-15', '2026-10-21', semaine)).toEqual({
    debut: 0, fin: 2, coupeeAvant: true, coupeeApres: false,
  })

  // absence entièrement dans la semaine
  expect(segmentSurJours('2026-10-20', '2026-10-22', semaine)).toEqual({
    debut: 1, fin: 3, coupeeAvant: false, coupeeApres: false,
  })

  // absence qui finit après
  expect(segmentSurJours('2026-10-24', '2026-11-03', semaine)).toEqual({
    debut: 5, fin: 6, coupeeAvant: false, coupeeApres: true,
  })

  // absence hors période
  expect(segmentSurJours('2026-11-02', '2026-11-04', semaine)).toBeNull()
  expect(segmentSurJours('2026-10-01', '2026-10-05', semaine)).toBeNull()
})

it('9. un segment d’un seul jour, en mode jour, couvre toute la case', () => {
  const jour = jourUnique('2026-10-21')
  expect(segmentSurJours('2026-10-21', '2026-10-21', jour)).toEqual({
    debut: 0, fin: 0, coupeeAvant: false, coupeeApres: false,
  })
  expect(segmentSurJours('2026-10-22', '2026-10-22', jour)).toBeNull()
})

it('10. les dates horodatées de Supabase sont découpées au jour', () => {
  const semaine = joursDeLaSemaine('2026-10-21')
  const seg = segmentSurJours('2026-10-19T08:00:00Z', '2026-10-21T18:30:00Z', semaine)
  expect(seg).toEqual({ debut: 0, fin: 2, coupeeAvant: false, coupeeApres: false })
  expect(jourIso('2026-10-19T08:00:00Z')).toBe('2026-10-19')
  expect(jourIso(null)).toBeNull()
})

it('11. les titres parlent français', () => {
  const contexte = { annee: 2026, mois: 9, jourIso: '2026-10-21' }
  expect(titrePeriode('jour', jourUnique('2026-10-21'), contexte)).toBe('Mer 21 Oct. 2026')
  expect(titrePeriode('mois', [], contexte)).toBe('Octobre 2026')

  const semaine = joursDeLaSemaine('2026-10-21')
  // Même libellé compact que la page Planning : « Lun 19 – Dim 25 Oct. 2026 »
  const titreSemaine = titrePeriode('semaine', semaine, contexte)
  expect(titreSemaine).toBe('Lun 19 – Dim 25 Oct. 2026')

  // Une semaine à cheval sur deux mois garde le mois du dernier jour
  const aCheval = titrePeriode('semaine', joursDeLaSemaine('2026-11-01'), contexte)
  expect(aCheval).toBe('Lun 26 – Dim 1 Nov. 2026')
  expect(nomJourLong('2026-10-21')).toBe('Mercredi 21 oct. 2026')
})

// ── 2. Le rendu : les trois modes ─────────────────────────────────────
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
  created_at: '2026-10-01T08:00:00Z',
  employees: { first_name: 'Aïssatou', last_name: 'Diallo', matricule: 'ENN-0001' },
  ...extra,
})

// semaine du lundi 19 au dimanche 25 octobre 2026
const absences = [
  absence('a1', 'e1', '2026-10-19', '2026-10-21', 'conge', 'approuve'),
  absence('a2', 'e2', '2026-10-15', '2026-10-23', 'maladie', 'en_attente'),
  absence('a3', 'e3', '2026-10-30', '2026-11-02', 'formation', 'approuve'), // hors période
]

const rendre = (mode) => renderToStaticMarkup(
  <AbsencesCalendrier
    absences={absences}
    employes={employes}
    annee={2026}
    mois={9}
    mode={mode}
    jourInitial="2026-10-21"
    darkMode
    joursPrisParEmploye={{ e1: 4 }}
    plafondConges={30}
  />
)

const grilleMois = rendre('mois')
const grilleSemaine = rendre('semaine')
const grilleJour = rendre('jour')

it('11 bis. sans réglage, le calendrier s’ouvre sur la SEMAINE', () => {
  const parDefaut = renderToStaticMarkup(
    <AbsencesCalendrier
      absences={absences}
      employes={employes}
      annee={2026}
      mois={9}
      jourInitial="2026-10-21"
      darkMode
    />
  )
  expect(parDefaut).toContain('data-mode="semaine"')
  expect((parDefaut.match(/data-jour="/g) || [])).toHaveLength(7)
  // un seul bouton est actif, et c'est celui de la semaine
  expect((parDefaut.match(/aria-pressed="true"/g) || [])).toHaveLength(1)
  const i = parDefaut.indexOf('abs-cal-mode-semaine')
  expect(parDefaut.slice(Math.max(0, i - 260), i)).toContain('aria-pressed="true"')
})

it('12. le sélecteur jour · semaine · mois est toujours là', () => {
  for (const grille of [grilleMois, grilleSemaine, grilleJour]) {
    expect(grille).toContain('data-testid="abs-cal-modes"')
    expect(grille).toContain('data-testid="abs-cal-mode-jour"')
    expect(grille).toContain('data-testid="abs-cal-mode-semaine"')
    expect(grille).toContain('data-testid="abs-cal-mode-mois"')
  }
})

it('13. le mode mois affiche les 31 jours d’octobre', () => {
  expect(grilleMois).toContain('data-mode="mois"')
  expect(grilleMois).toContain('Octobre 2026')
  expect((grilleMois.match(/data-jour="/g) || [])).toHaveLength(31)
  expect(grilleMois).not.toContain('abs-cal-feuille-jour')
})

it('14. le mode semaine n’affiche que les 7 jours de la semaine visée', () => {
  expect(grilleSemaine).toContain('data-mode="semaine"')
  expect(grilleSemaine).toContain('Lun 19 – Dim 25 Oct. 2026')
  const jours = [...grilleSemaine.matchAll(/data-jour="([\d-]+)"/g)].map((m) => m[1])
  expect(jours).toEqual([
    '2026-10-19', '2026-10-20', '2026-10-21', '2026-10-22',
    '2026-10-23', '2026-10-24', '2026-10-25',
  ])
  expect(grilleSemaine).not.toContain('abs-cal-feuille-jour')
})

it('15. le mode jour n’affiche qu’un seul jour', () => {
  expect(grilleJour).toContain('data-mode="jour"')
  const jours = [...grilleJour.matchAll(/data-jour="([\d-]+)"/g)].map((m) => m[1])
  expect(jours).toEqual(['2026-10-21'])
})

it('16. les barres suivent la période : rien hors de la semaine', () => {
  // a3 (30 oct → 2 nov) est hors de la semaine du 19 : aucune barre pour elle
  const barresSemaine = (grilleSemaine.match(/data-testid="abs-cal-barre"/g) || []).length
  expect(barresSemaine).toBe(2) // a1 + a2

  // en mode mois, les trois absences d’octobre sont dessinées
  const barresMois = (grilleMois.match(/data-testid="abs-cal-barre"/g) || []).length
  expect(barresMois).toBe(3)
})

it('17. le mode jour dresse la feuille du jour : absents et présents', () => {
  expect(grilleJour).toContain('data-testid="abs-cal-feuille-jour"')
  expect(grilleJour).toContain('Mercredi 21 oct. 2026')
  expect(grilleJour).toContain('2 absents sur 3 employés')
  expect(grilleJour).toContain('Présents (1)')
  expect(grilleJour).toContain('Salimata') // la seule présente
})

it('18. une barre est positionnée en pourcentage de la période', () => {
  // en mode jour, la barre occupe toute la largeur de l’unique colonne
  expect(grilleJour).toContain('left:calc(0% + 2px)')
  expect(grilleJour).toContain('width:calc(100% - 4px)')
  // en mode semaine, a1 va du lundi 19 au mercredi 21 → index 0 → 2
  expect(grilleSemaine).toContain('left:calc(0% + 2px)')
  expect(grilleSemaine).toContain('width:calc(42')
})

it('19. le dépôt suit le mode : une case de la période est surlignée', () => {
  // la piste de dépôt existe dans les trois modes
  for (const grille of [grilleMois, grilleSemaine, grilleJour]) {
    expect(grille).toContain('data-drop-lane="e1"')
    expect(grille).toContain('data-drop-lane="e2"')
  }
})

it('20. un employé sans absence reste listé dans les trois modes', () => {
  for (const grille of [grilleMois, grilleSemaine, grilleJour]) {
    expect(grille).toContain('Aïssatou')
    expect(grille).toContain('Mamadou')
    expect(grille).toContain('Salimata')
  }
})
