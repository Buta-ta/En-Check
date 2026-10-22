import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import { renderToStaticMarkup } from 'react-dom/server'
import React from 'react'
import {
  MOTIFS_PAR_DEFAUT,
  PALETTE_MOTIFS,
  EMOJIS_MOTIFS,
  getMotifConfig,
  styleBarreAbsence,
} from '../../constants/motifsAbsence'
import {
  codeDepuisLabel,
  codeDisponible,
  fondDepuisCouleur,
} from '../motifsAbsenceService'
import { useMotifsAbsence } from '../../hooks/useMotifsAbsence'
import MotifsManager from '../../components/AbsencesMotifsManager'

const ROOT = path.resolve(import.meta.dirname, '../../..')
const lire = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8')

const serviceSrc = lire('src/services/motifsAbsenceService.js')
const contexteSrc = lire('src/contexts/MotifsAbsenceContext.jsx')
const managerSrc = lire('src/components/AbsencesMotifsManager.jsx')
const dockSrc = lire('src/components/AbsencesDock.jsx')
const calendrierSrc = lire('src/components/AbsencesCalendrier.jsx')
const migration = lire('supabase/migrations/20261021000004_absence_motifs_personnalisables.sql')
const absencesSrc = lire('src/pages/Absences.jsx')

describe('Motifs d’absence personnalisables', () => {
  it('1. un libellé devient un code stable et lisible', () => {
    expect(codeDepuisLabel('Congé payé')).toBe('conge-paye')
    expect(codeDepuisLabel('Formation')).toBe('formation')
    expect(codeDepuisLabel('  Absence / injustifiée !! ')).toBe('absence-injustifiee')
    expect(codeDepuisLabel('')).toBe('motif')
  })

  it('2. un nouveau motif ne peut pas écraser un motif d’origine', () => {
    const existants = [{ code: 'conge' }, { code: 'conge-2' }]
    expect(codeDisponible('conge', existants)).toBe('conge-3')
    // un code libre est conservé tel quel
    expect(codeDisponible('teletravail', existants)).toBe('teletravail')
  })

  it('3. le fond translucide se déduit de la couleur choisie', () => {
    expect(fondDepuisCouleur('#10B981')).toBe('rgba(16,185,129,0.15)')
    expect(fondDepuisCouleur('10B981')).toBe('rgba(16,185,129,0.15)')
    expect(fondDepuisCouleur('pas-une-couleur')).toBe('rgba(156,163,175,0.15)')
  })

  it('4. un motif personnalisé est utilisé partout où le motif compte', () => {
    const motifsMaison = [
      { id: 'teletravail', label: 'Télétravail', color: '#14B8A6', bg: 'rgba(20,184,166,0.15)', emoji: '🏠' },
    ]
    expect(getMotifConfig('teletravail', motifsMaison).label).toBe('Télétravail')
    // motif inconnu → repli, jamais de case vide
    expect(getMotifConfig('inexistant', motifsMaison).id).toBe('autre')

    const barre = styleBarreAbsence({ reason: 'teletravail', status: 'approuve' }, motifsMaison)
    expect(barre.bordure).toBe('#14B8A6')
    const attente = styleBarreAbsence({ reason: 'teletravail', status: 'en_attente' }, motifsMaison)
    expect(attente.pointillee).toBe(true)
    expect(attente.bordure).toBe('#14B8A6') // le motif reste identifiable
  })

  it('5. les 7 motifs d’origine restent le repli, avec couleurs et emojis', () => {
    expect(MOTIFS_PAR_DEFAUT).toHaveLength(7)
    MOTIFS_PAR_DEFAUT.forEach((m) => {
      expect(m.emoji).toBeTruthy()
      expect(m.color).toMatch(/^#/)
    })
    expect(PALETTE_MOTIFS.length).toBeGreaterThanOrEqual(10)
    expect(EMOJIS_MOTIFS.length).toBeGreaterThanOrEqual(20)
  })
})

describe('Doctrine : suppression réelle, transfert des absences', () => {
  it('6. la suppression est bien un effacement définitif de la ligne', () => {
    expect(serviceSrc).toContain("from('absence_motifs')")
    expect(serviceSrc).toMatch(/\.delete\s*\(\s*\)\s*\n?\s*\.eq\('id', id\)/)
    // plus aucune trace de la corbeille : on ne archive plus
    expect(serviceSrc).not.toContain('archive_le:')
    expect(serviceSrc).not.toContain('async archiver')
    expect(serviceSrc).not.toContain('async restaurer')
    // l'uuid de la ligne survit à la normalisation (sinon UPDATE/DELETE visent le code)
    expect(serviceSrc).toContain('rowId: ligne.id')
  })

  it('6 bis. avant de supprimer, on peut transférer les absences vers un autre motif', () => {
    expect(serviceSrc).toContain('async reassigner')
    expect(serviceSrc).toContain("update({ reason: codeCible })")
    expect(serviceSrc).toContain(".eq('reason', codeSource)")
    // et on ne touche pas aux absences des autres entreprises
    expect(serviceSrc).toContain(".eq('enterprise_id', enterpriseId)")
  })

  it('6 ter. chaque entreprise reçoit sa copie des motifs d’origine', () => {
    expect(serviceSrc).toContain('assurerMotifsEntreprise')
    // la copie garde le CODE (les absences restent valides) mais devient modifiable
    expect(serviceSrc).toContain('enterprise_id: enterpriseId')
    expect(serviceSrc).toContain('is_system: false')
  })

  it('7. la migration crée la table, les politiques RLS et les 7 motifs', () => {
    expect(migration).toContain('CREATE TABLE IF NOT EXISTS public.absence_motifs')
    expect(migration).toContain('ENABLE ROW LEVEL SECURITY')
    expect(migration).toContain('admin_has_access_to_enterprise(enterprise_id)')
    expect(migration).toContain("'conge'")
    expect(migration).toContain("'autre'")
    expect(migration).toContain('encheck_absence_motifs_usages')
    // unicité du code par portée : la copie d'entreprise peut exister
    expect(migration).toContain('absence_motifs_code_entreprise_uniq')
  })

  it('8. le gestionnaire annonce le nombre d’absences et propose un transfert', () => {
    expect(managerSrc).toContain('Supprimer définitivement')
    expect(managerSrc).toContain('abs-motifs-transfert')
    expect(managerSrc).toContain('abs-motifs-confirmer-suppression')
    // garde-fous : dernier motif protégé + nombre d'absences annoncé
    expect(managerSrc).toContain('motifs.length <= 1')
    expect(managerSrc).toMatch(/absence\{/)
    // la suppression passe par le fournisseur, jamais par un delete direct
    expect(managerSrc).not.toMatch(/supabase\.delete/)
    expect(managerSrc).not.toContain('Corbeille')
    // emoji libre : on peut coller celui de son téléphone
    expect(managerSrc).toContain('abs-motifs-emoji-libre')
  })

  it('9. si la base ne répond pas, l’écran garde les motifs d’origine', () => {
    expect(contexteSrc).toContain('MOTIFS_PAR_DEFAUT')
    expect(contexteSrc).toContain('setMotifs(MOTIFS_PAR_DEFAUT)')
    // le hook reste utilisable hors provider
    expect(typeof useMotifsAbsence).toBe('function')
  })
})

describe('Diffusion des motifs personnalisés', () => {
  it('10. le dock propose les motifs du contexte, pas une liste figée', () => {
    expect(dockSrc).toContain('useMotifsAbsence')
    expect(dockSrc).toContain('{motifs.map((m) => (')
  })

  it('11. le calendrier colore ses barres avec les motifs du contexte', () => {
    expect(calendrierSrc).toContain('useMotifsAbsence')
    expect(calendrierSrc).toContain('styleBarreAbsence(seg.absence, motifs)')
    // le filtre est « en creux » : un motif créé plus tard est visible aussitôt
    expect(calendrierSrc).toContain('motifsMasques')
    expect(calendrierSrc).toContain('{motifs.map((m) => (')
  })

  it('12. les photos de profil sont chargées et affichées', () => {
    expect(absencesSrc).toContain('photo_url')
    expect(calendrierSrc).toContain('ligne.employe.photo_url')
    expect(calendrierSrc).toContain('objectFit')
  })

  it('13. le gestionnaire est branché dans l’onglet Configuration', () => {
    expect(absencesSrc).toContain('AbsencesMotifsManager')
    expect(absencesSrc).toContain('<AbsencesMotifsManager absences={absences} />')
    expect(absencesSrc).toContain('<MotifsAbsenceProvider')
  })
})

describe('Rendu du gestionnaire de motifs', () => {
  it('14. il se monte et liste les motifs avec leur nombre d’usages', () => {
    const html = renderToStaticMarkup(
      React.createElement(MotifsManager, {
        absences: [
          { reason: 'conge' },
          { reason: 'conge' },
          { reason: 'maladie' },
        ],
      })
    )
    expect(html).toContain('Motifs d’absence')
    expect(html).toContain('Congé payé')
    expect(html).toContain('Nouveau motif')
    expect(html).toContain('2 absences') // les usages sont comptés
    expect(html).not.toContain('Corbeille') // plus de corbeille : on supprime pour de vrai
    expect(html).toContain('abs-motifs-supprimer')
    expect(html).toContain('abs-motifs-modifier')
  })

  it('15. un motif utilisé ne se supprime pas sans transfert', () => {
    const html = renderToStaticMarkup(
      React.createElement(MotifsManager, { absences: [{ reason: 'conge' }] })
    )
    // pas de dialogue ouvert au montage : la suppression se décide motif par motif
    expect(html).not.toContain('abs-motifs-suppression')
    expect(html).toContain('abs-motifs-manager')
  })
})
