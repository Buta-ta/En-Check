// ═══════════════════════════════════════════════════════════
// 🏢 UN MOTIF PAR ENTREPRISE, MÊME EN VUE « TOUTES ENTREPRISES »
//
// Chaque société possède sa copie des 7 motifs (mêmes codes). Quand
// un écran affiche plusieurs entreprises à la fois, une absence doit
// être habillée avec le motif de SA maison — sinon le réglage du
// client semble sans effet (emoji d'origine figé à l'écran).
// ═══════════════════════════════════════════════════════════

import { it, expect } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import { resoudreMotif } from '../motifsAbsenceService'

const ROOT = path.resolve(import.meta.dirname, '../../..')
const lire = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8')

const ATT = '586d6be9-2ed9-4a4e-a9e3-d7e465a1a5df'   // AfroTech (celle du client)
const AUTRE = '11111111-2222-3333-4444-555555555555' // une autre société

// Le jeu réel : les globaux + les deux copies personnalisées
const MOTIFS = [
  { id: 'maternite', label: 'Maternité/Paternité', emoji: '👶', color: '#8B5CF6', entrepriseId: null },
  { id: 'conge', label: 'Congé payé', emoji: '🌴', color: '#10B981', entrepriseId: null },
  { id: 'maternite', label: 'Maternité/Pater..', emoji: '👶🏾', color: '#84CC16', entrepriseId: ATT },
  { id: 'musique', label: 'Musique', emoji: '🎙️', color: '#10B981', entrepriseId: ATT },
  { id: 'maternite', label: 'Congé naissance', emoji: '🍼', color: '#F472B6', entrepriseId: AUTRE },
]

it('1. une absence prend le motif de SA propre entreprise', () => {
  const absenceAfro = { reason: 'maternite', enterprise_id: ATT }
  const m = resoudreMotif(MOTIFS, absenceAfro)
  expect(m.emoji).toBe('👶🏾')
  expect(m.color).toBe('#84CC16')
  expect(m.label).toBe('Maternité/Pater..')

  const absenceAutre = { reason: 'maternite', enterprise_id: AUTRE }
  expect(resoudreMotif(MOTIFS, absenceAutre).emoji).toBe('🍼')
})

it('2. sans copie pour cette entreprise, on retombe sur le motif d’origine', () => {
  const absence = { reason: 'conge', enterprise_id: AUTRE }
  const m = resoudreMotif(MOTIFS, absence)
  expect(m.emoji).toBe('🌴')
  expect(m.entrepriseId).toBe(null)
})

it('3. un motif créé de toutes pièces reste trouvable par son code', () => {
  expect(resoudreMotif(MOTIFS, { reason: 'musique', enterprise_id: ATT }).emoji).toBe('🎙️')
  // mais il n'existe pas chez l'autre société, et pas chez les globaux
  expect(resoudreMotif(MOTIFS, { reason: 'musique', enterprise_id: AUTRE })).toBe(null)
})

it('4. jamais d’erreur : code inconnu ou absence vide → null', () => {
  expect(resoudreMotif(MOTIFS, { reason: 'inexistant', enterprise_id: ATT })).toBe(null)
  expect(resoudreMotif(MOTIFS, {})).toBe(null)
  expect(resoudreMotif(MOTIFS, null)).toBe(null)
  expect(resoudreMotif([], { reason: 'conge' })).toBe(null)
  // un code passé en clair fonctionne aussi
  expect(resoudreMotif(MOTIFS, 'conge').emoji).toBe('🌴')
})

it('5. le planning et le calendrier emploient cette règle commune', () => {
  expect(lire('src/pages/Planning.jsx')).toContain('resoudreMotif(motifs, absence)')
  expect(lire('src/contexts/MotifsAbsenceContext.jsx')).toContain('resoudreMotif(toutes, absence)')
  // et le planning ne lit plus une seule entreprise : il les prend toutes
  expect(lire('src/pages/Planning.jsx')).toContain('MotifsAbsenceService.listerTout()')
  expect(lire('src/services/motifsAbsenceService.js')).toContain('async listerTout()')
})
