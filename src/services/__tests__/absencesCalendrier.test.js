import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import {
  JOURS_SEMAINE,
  joursDuMois,
  nomMois,
  formaterDateCourt,
  formaterHorodatage,
  estJourOuvre,
  compterJoursOuvres,
  segmentDuMois,
  empilerSegments,
} from '../absencesCalendrier'
import { MOTIFS, STATUTS_ABSENCE, styleBarreAbsence, getMotifConfig } from '../../constants/motifsAbsence'

const ROOT = path.resolve(import.meta.dirname, '../../..')
const lire = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8')

const absencesSrc = lire('src/pages/Absences.jsx')
const calendrierSrc = lire('src/components/AbsencesCalendrier.jsx')
const tiroirSrc = lire('src/components/AbsenceTiroir.jsx')

describe('Calendrier mensuel des absences — calculs', () => {
  it('1. avril 2025 compte 30 jours, commence un mardi et marque les week-ends', () => {
    const jours = joursDuMois(2025, 3)
    expect(jours).toHaveLength(30)
    expect(jours[0].iso).toBe('2025-04-01')
    expect(jours[0].weekday).toBe(2) // 1 = lundi
    expect(JOURS_SEMAINE[jours[0].weekday - 1]).toBe('M')
    expect(jours[4].weekend).toBe(true) // 5 avril = samedi
    expect(jours[5].weekend).toBe(true) // 6 avril = dimanche
    expect(jours[6].weekend).toBe(false) // 7 avril = lundi
  })

  it('2. un jour ouvré n’est ni un week-end ni un férié', () => {
    expect(estJourOuvre('2025-04-14')).toBe(true) // lundi
    expect(estJourOuvre('2025-04-05')).toBe(false) // samedi
    expect(estJourOuvre('2025-04-16', new Set(['2025-04-16']))).toBe(false)
  })

  it('3. les jours comptés excluent week-ends et fériés, sauf si l’absence les inclut', () => {
    // du lundi 14 au vendredi 18 avril 2025
    expect(compterJoursOuvres('2025-04-14', '2025-04-18')).toBe(5)
    expect(compterJoursOuvres('2025-04-14', '2025-04-18', new Set(['2025-04-16']))).toBe(4)
    // count_holidays_as_leave → tous les jours calendaires
    expect(compterJoursOuvres('2025-04-14', '2025-04-18', new Set(['2025-04-16']), true)).toBe(5)
    // période inversée ou invalide → 0, jamais de boucle infinie
    expect(compterJoursOuvres('2025-04-18', '2025-04-14')).toBe(0)
    expect(compterJoursOuvres('', '')).toBe(0)
  })

  it('4. une absence à cheval sur le mois est coupée et signalée', () => {
    expect(segmentDuMois('2025-03-25', '2025-04-05', 2025, 3)).toEqual({
      debut: 1, fin: 5, coupeeAvant: true, coupeeApres: false,
    })
    expect(segmentDuMois('2025-04-10', '2025-05-03', 2025, 3)).toEqual({
      debut: 10, fin: 30, coupeeAvant: false, coupeeApres: true,
    })
    // hors du mois affiché → rien à dessiner
    expect(segmentDuMois('2025-05-01', '2025-05-10', 2025, 3)).toBeNull()
    expect(segmentDuMois('2025-03-01', '2025-03-20', 2025, 3)).toBeNull()
  })

  it('5. deux absences qui se chevauchent sont empilées, jamais superposées', () => {
    const empiles = empilerSegments([
      { debut: 1, fin: 5 },
      { debut: 3, fin: 8 },
      { debut: 9, fin: 10 },
    ])
    const rang = (d) => empiles.find((s) => s.debut === d).rangee
    expect(rang(1)).toBe(0)
    expect(rang(3)).toBe(1)
    expect(rang(9)).toBe(0)
    empiles.forEach((s) => expect(s.rangeesTotal).toBe(2))

    const disjoints = empilerSegments([{ debut: 1, fin: 2 }, { debut: 5, fin: 6 }])
    disjoints.forEach((s) => expect(s.rangee).toBe(0))
    disjoints.forEach((s) => expect(s.rangeesTotal).toBe(1))
  })

  it('6. les libellés sont en français et sans décalage de fuseau', () => {
    expect(nomMois(2025, 3)).toBe('Avril 2025')
    expect(formaterDateCourt('2025-04-01')).toBe('01/04/2025')
    expect(formaterDateCourt(null)).toBe('—')
    expect(formaterHorodatage(null)).toBe('—')
  })
})

describe('Calendrier mensuel des absences — couleurs et statuts', () => {
  it('7. le vocabulaire est unique : 7 motifs, 3 statuts en français', () => {
    expect(MOTIFS).toHaveLength(7)
    MOTIFS.forEach((m) => {
      expect(m.id).toBeTruthy()
      expect(m.label).toBeTruthy()
      expect(m.emoji).toBeTruthy()
      expect(m.color).toMatch(/^#/)
    })
    expect(Object.keys(STATUTS_ABSENCE).sort()).toEqual(['approuve', 'en_attente', 'refuse'])
    expect(getMotifConfig('inconnu').id).toBe('autre')
  })

  it('8. la couleur dit le motif, le trait dit le statut', () => {
    const approuvee = styleBarreAbsence({ reason: 'conge', status: 'approuve' })
    expect(approuvee.barree).toBe(false)
    expect(approuvee.pointillee).toBe(false)
    expect(approuvee.bordure).toBe('#10B981') // vert du motif congé

    const enAttente = styleBarreAbsence({ reason: 'conge', status: 'en_attente' })
    expect(enAttente.pointillee).toBe(true)
    expect(enAttente.barree).toBe(false)
    expect(enAttente.bordure).toBe('#10B981') // le motif reste identifiable

    const refusee = styleBarreAbsence({ reason: 'conge', status: 'refuse' })
    expect(refusee.barree).toBe(true)
    expect(refusee.pointillee).toBe(false)
    expect(refusee.bordure).toBe('#B91C1C')
  })
})

describe('Calendrier mensuel des absences — câblage', () => {
  it('9. la page Absences propose la vue Planning, qui est celle par défaut', () => {
    expect(absencesSrc).toContain("from '../components/AbsencesCalendrier'")
    expect(absencesSrc).toContain("useState('planning')")
    expect(absencesSrc).toContain("setViewMode('planning')")
    expect(absencesSrc).toContain("setViewMode('calendar')")
    expect(absencesSrc).toContain("setViewMode('list')")
    expect(absencesSrc).toContain('<AbsencesCalendrier')
  })

  it('10. la page ne redéfinit plus les motifs : une seule source de vérité', () => {
    expect(absencesSrc).not.toContain('const MOTIFS = [')
    expect(absencesSrc).toContain("from '../constants/motifsAbsence'")
  })

  it('11. une décision ne supprime jamais une absence : aucun delete dans les nouvelles vues', () => {
    // Aucun accès base : tout passe par les callbacks de la page
    expect(calendrierSrc).not.toMatch(/supabase/)
    expect(tiroirSrc).not.toMatch(/supabase/)
    // Et surtout aucune suppression d'absence (un Set.delete n'est pas concerné)
    expect(calendrierSrc).not.toMatch(/from\(['"]absences['"]\)[\s\S]{0,80}\.delete/)
    expect(tiroirSrc).not.toMatch(/from\(['"]absences['"]\)[\s\S]{0,80}\.delete/)
    // le tiroir ne propose qu'approuver, refuser et modifier
    expect(tiroirSrc).toContain('Approuver')
    expect(tiroirSrc).toContain('Refuser')
    expect(tiroirSrc).toContain('Modifier l’absence')
  })

  it('12. le tiroir est un vrai dialogue accessible, fermable au clavier', () => {
    expect(tiroirSrc).toContain('role="dialog"')
    expect(tiroirSrc).toContain('aria-modal="true"')
    expect(tiroirSrc).toContain("e.key === 'Escape'")
  })

  it('13. chaque barre porte son statut et chaque symbole est expliqué dans la légende', () => {
    expect(calendrierSrc).toContain('data-statut={a.status}')
    expect(calendrierSrc).toContain('En attente (contour pointillé)')
    expect(calendrierSrc).toContain('Refusé (barré)')
    expect(calendrierSrc).toContain('à cheval sur la période')
    expect(calendrierSrc).toContain('justificatif joint')
    expect(calendrierSrc).toContain('conflit de pointage')
  })

  it('14. le récapitulatif du mois distingue présents, en attente et refusées', () => {
    expect(calendrierSrc).toContain('en attente')
    expect(calendrierSrc).toContain('refusée')
    expect(calendrierSrc).toContain('compté')
  })
})
