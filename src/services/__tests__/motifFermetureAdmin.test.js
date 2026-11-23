// ═══════════════════════════════════════════════════════════════════════════
// 🧾 LE MOTIF DE FERMETURE — VISIBLE PAR L'ADMIN, ET PAR LUI SEUL
//
// Décision du fondateur (26/11) : « ce n'est pas à l'employé de voir pourquoi
// sa pause s'est fermée mais à l'admin de l'entreprise ».
//
// Deux exigences que ces tests tiennent ensemble :
//   1. l'administrateur DOIT le voir (sinon la colonne ne sert à rien) ;
//   2. quand la base ne sait pas, on n'affiche RIEN — pas un badge vide,
//      pas un « reprise » par défaut sur les pauses d'avant le 23/11.
// ═══════════════════════════════════════════════════════════════════════════
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import {
  MOTIFS_FERMETURE,
  libelleMotifFermeture,
  badgeMotifFermeture,
  construirePauses,
  exportCsvPauses,
} from '../pausesService'

describe('🧾 Motif de fermeture — libellés', () => {
  it('nomme les deux causes, et seulement celles-là', () => {
    expect(Object.keys(MOTIFS_FERMETURE).sort()).toEqual(['reprise', 'sortie'])
    expect(MOTIFS_FERMETURE.sortie.label).toBe('Fin de journée')
    expect(MOTIFS_FERMETURE.reprise.label).toBe('Reprise du service')
  })

  it('n’invente pas de cause quand la base ne sait pas', () => {
    //  Les 27 pauses antérieures au 23/11 n'ont pas de motif. Afficher
    //  « Reprise du service » sur une pause de septembre serait un mensonge
    //  documenté dans un écran d'administration.
    expect(libelleMotifFermeture({ motif_fermeture: null })).toBeNull()
    expect(libelleMotifFermeture({})).toBeNull()
    expect(libelleMotifFermeture(null)).toBeNull()
    expect(badgeMotifFermeture({ motif_fermeture: null })).toBeNull()
  })

  it('ignore une valeur inconnue au lieu de la relayer', () => {
    //  Si une version future de l'app écrit autre chose, l'écran ne doit pas
    //  afficher un mot cru à l'administrateur.
    expect(libelleMotifFermeture({ motif_fermeture: 'nimportequoi' })).toBeNull()
  })
})

describe('🧾 Motif de fermeture — propagation jusqu’aux écrans', () => {
  it('traverse construirePauses sans être perdu', () => {
    const { paies } = construirePauses([
      { id: 'a', statut: 'reelle', source: 'pointee', jour: '2026-11-24',
        debut: '2026-11-24T12:00:00Z', fin: '2026-11-24T13:00:00Z',
        duree_minutes: 60, motif_fermeture: 'sortie' },
      { id: 'b', statut: 'reelle', source: 'pointee', jour: '2026-11-22',
        debut: '2026-11-22T12:00:00Z', fin: '2026-11-22T13:00:00Z',
        duree_minutes: 60, motif_fermeture: null },
    ])
    const avec = paies.find((p) => p.id === 'a')
    const sans = paies.find((p) => p.id === 'b')
    expect(avec.motifFermeture).toBe('sortie')
    expect(avec.motifFermetureLabel).toBe('Fin de journée')
    expect(sans.motifFermeture).toBeNull()
    expect(sans.motifFermetureLabel).toBeNull()
  })

  it('sort dans le CSV, vide quand il n’y a pas de motif', () => {
    const csv = exportCsvPauses([
      { jour: '2026-11-24', employe: 'A', debutHHMM: '12:00', finHHMM: '13:00',
        dureeMinutes: 60, statut: 'reelle', motifFermetureLabel: 'Fin de journée' },
      { jour: '2026-11-22', employe: 'B', debutHHMM: '12:00', finHHMM: '13:00',
        dureeMinutes: 60, statut: 'reelle', motifFermetureLabel: null },
    ])
    const [entetes, l1, l2] = csv.split('\n')
    expect(entetes).toContain('Fin de pause')
    expect(l1).toContain('Fin de journée')
    expect(l2).not.toContain('Fin de journée')
    //  Pas de « reprise » inventé sur la ligne sans motif.
    expect(l2).not.toContain('Reprise')
  })
})

describe('🚫 Ce badge ne doit apparaître que côté admin', () => {
  it('n’est pas rendu dans un écran employé', () => {
    //  `EmployeeHeures.jsx` est l'écran de l'espace employé. Le badge du
    //  motif n'a rien à y faire : le fondateur l'a tranché le 26/11.
    const employe = readFileSync('src/pages/employee/EmployeeHeures.jsx', 'utf8')
    expect(employe).not.toContain('motifFermeture')
    expect(employe).not.toContain('motif_fermeture')
    expect(employe).not.toContain('badgeMotifFermeture')
  })

  it('est bien rendu dans la page admin des pauses', () => {
    const admin = readFileSync('src/components/PausesAfroTechSections.jsx', 'utf8')
    expect(admin).toContain('badgeMotifFermeture')
  })
})
