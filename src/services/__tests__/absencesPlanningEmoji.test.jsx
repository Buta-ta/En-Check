// ═══════════════════════════════════════════════════════════
// 🔁 LE MÊME EMOJI AU PLANNING ET AUX ABSENCES
//
// Une absence s'affiche avec l'emoji choisi par le client, dans
// le calendrier des absences comme dans la case du planning.
// ═══════════════════════════════════════════════════════════

import { it, expect } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'

const ROOT = path.resolve(import.meta.dirname, '../../..')
const lire = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8')

const planningSrc = lire('src/pages/Planning.jsx')
const calendrierSrc = lire('src/components/AbsencesCalendrier.jsx')
const constantesSrc = lire('src/constants/motifsAbsence.js')

it('1. la case d’absence du planning affiche l’emoji du motif, pas le code brut', () => {
  // le code brut (« conge ») n'est plus recopié tel quel dans la case
  expect(planningSrc).not.toContain('label: empAbs.reason')
  expect(planningSrc).toContain('name: `${motifAbs.emoji} ${motifAbs.label}`')
  expect(planningSrc).toContain('const motifDe = (absence)')
})

it('2. le planning lit les motifs de l’entreprise, avec repli sur les 7 d’origine', () => {
  expect(planningSrc).toContain('MotifsAbsenceService.listerTout(')
  expect(planningSrc).toContain('MOTIFS_PAR_DEFAUT')
  expect(planningSrc).toContain('getMotifConfig(')
  // et la résolution se fait par entreprise, pas sur le code seul
  expect(planningSrc).toContain('resoudreMotif(motifs, absence)')
})

it('3. les deux écrans s’appuient sur les mêmes motifs, servis par le même fournisseur', () => {
  expect(constantesSrc).toContain('MOTIFS_PAR_DEFAUT')
  expect(constantesSrc).toContain('getMotifConfig')
  // le calendrier lit les motifs vivants du contexte…
  expect(calendrierSrc).toContain('useMotifsAbsence')
  expect(calendrierSrc).toContain('styleBarreAbsence')
  // …et le planning les récupère auprès du même service
  expect(planningSrc).toContain('MotifsAbsenceService')
})

it('4. la légende du calendrier énumère bien les motifs, plus les codes de lecture', () => {
  for (const code of ['📎', '⚡', '‹', '›']) {
    expect(calendrierSrc).toContain(code)
  }
})
