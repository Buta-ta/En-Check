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

describe('Doctrine : on archive, on n’efface jamais', () => {
  it('6. le service ne contient aucun effacement physique', () => {
    expect(serviceSrc).toContain("from('absence_motifs')")
    expect(serviceSrc).not.toMatch(/\.delete\s*\(/)
    // archiver / restaurer passent par archive_le
    expect(serviceSrc).toContain('archive_le: new Date().toISOString()')
    expect(serviceSrc).toContain('archive_le: null')
  })

  it('7. la migration crée la table, les politiques RLS et les 7 motifs', () => {
    expect(migration).toContain('CREATE TABLE IF NOT EXISTS public.absence_motifs')
    expect(migration).toContain('ENABLE ROW LEVEL SECURITY')
    expect(migration).toContain('admin_has_access_to_enterprise(enterprise_id)')
    expect(migration).toContain("'conge'")
    expect(migration).toContain("'autre'")
    expect(migration).toContain('encheck_absence_motifs_usages')
    expect(migration).toContain('archive_le')
  })

  it('8. le gestionnaire prévient avant d’archiver et garde une corbeille', () => {
    expect(managerSrc).toContain('Archiver')
    expect(managerSrc).toContain('Corbeille')
    expect(managerSrc).toContain('Restaurer')
    expect(managerSrc).toContain('restaurer(m.id)')
    // garde-fous : dernier motif protégé + nombre d'absences annoncé
    expect(managerSrc).toContain('motifs.length <= 1')
    expect(managerSrc).toMatch(/absence\{/)
    expect(managerSrc).not.toMatch(/\.delete\s*\(/)
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
    expect(html).not.toContain('Corbeille') // rien d'archivé au départ
  })
})
