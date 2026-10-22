// ═══════════════════════════════════════════════════════════
// 🗑️ SUPPRIMER UNE ABSENCE — ET SON CONGÉ DANS LE PLANNING
//
// Une absence se supprime depuis le calendrier (tiroir), et
// supprimer une demande de congé doit retirer le congé du planning.
// ═══════════════════════════════════════════════════════════

import { it, expect, vi, beforeEach } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import { renderToStaticMarkup } from 'react-dom/server'
import { supprimerDemandeEtSesAbsences } from '../lienDemandeAbsence'
import Tiroir from '../../components/AbsenceTiroir'

const ROOT = path.resolve(import.meta.dirname, '../../..')
const lire = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8')

// ── Une fausse base : on enregistre tout ce qui est demandé ───────────
const { faux } = vi.hoisted(() => {
  const journal = []
  const lignes = { absences: [], leave_requests: [] }

  const correspond = (ligne, filtres) =>
    Object.entries(filtres).every(([col, val]) =>
      Array.isArray(val) ? val.includes(ligne[col]) : ligne[col] === val)

  const executer = (etat) => {
    const nom = etat.table
    const table = lignes[nom] || []
    if (etat.action === 'delete') {
      const touches = table.filter((l) => correspond(l, etat.filtres))
      lignes[etat.table] = table.filter((l) => !touches.includes(l))
      journal.push({ table: nom, action: 'delete', ids: touches.map((l) => l.id) })
      return { data: null, error: null }
    }
    const vues = table.filter((l) => correspond(l, etat.filtres))
    journal.push({ table: nom, action: 'select', filtres: { ...etat.filtres } })
    return { data: vues.map((l) => ({ ...l })), error: null }
  }

  const fabriquer = (table) => {
    const etat = { table, filtres: {}, action: 'select' }
    const chaine = {
      select: () => chaine,
      eq: (col, val) => { etat.filtres[col] = val; return chaine },
      in: (col, vals) => { etat.filtres[col] = vals; return chaine },
      delete: () => { etat.action = 'delete'; return chaine },
      // surtout PAS de maybeSingle : deux absences qui se chevauchent
      // le faisaient échouer, et le congé survivait dans le planning
      then: (resoudre, rejeter) => Promise.resolve(executer(etat)).then(resoudre, rejeter),
    }
    return chaine
  }

  return {
    faux: {
      journal,
      vider() { journal.length = 0; lignes.absences = []; lignes.leave_requests = [] },
      remplir(absences, demandes) { lignes.absences = absences; lignes.leave_requests = demandes },
      restantes: () => ({ absences: lignes.absences, leave_requests: lignes.leave_requests }),
      from: fabriquer,
    },
  }
})

vi.mock('../../lib/supabase', () => ({ supabase: { from: (table) => faux.from(table) } }))

const DEMANDE = {
  id: 'req-1',
  employee_id: 'e1',
  enterprise_id: 'ent-1',
  start_date: '2026-10-22',
  end_date: '2026-10-24',
  status: 'approuve',
  document_url: 'https://cdn.test/demande.pdf',
}

beforeEach(() => faux.vider())

it('1. supprimer une demande retire TOUTES les absences qu’elle avait créées', async () => {
  faux.remplir(
    [
      { id: 'a1', leave_request_id: 'req-1', employee_id: 'e1', start_date: '2026-10-22', end_date: '2026-10-24', document_url: 'https://cdn.test/a1.pdf', notes: '[Demande employé] anniversaire' },
      { id: 'a2', leave_request_id: 'req-1', employee_id: 'e1', start_date: '2026-10-23', end_date: '2026-10-25', document_url: null, notes: '[Demande employé] pont' },
      { id: 'a3', leave_request_id: null, employee_id: 'e2', start_date: '2026-10-22', end_date: '2026-10-24', document_url: null, notes: null },
    ],
    [DEMANDE]
  )

  const fichiersSupprimes = []
  const retirees = await supprimerDemandeEtSesAbsences(DEMANDE, {
    supprimerFichier: async (url) => fichiersSupprimes.push(url),
  })

  expect(retirees).toBe(2)
  // les deux absences de la demande sont parties, celle d'un autre employé reste
  const { absences, leave_requests } = faux.restantes()
  expect(absences.map((a) => a.id)).toEqual(['a3'])
  expect(leave_requests).toHaveLength(0)
  // les pièces jointes suivent : celle de la demande et celle de son absence
  expect(fichiersSupprimes).toContain('https://cdn.test/demande.pdf')
  expect(fichiersSupprimes).toContain('https://cdn.test/a1.pdf')
})

it('2. une ancienne demande (sans lien) est retrouvée par ses dates et sa trace', async () => {
  faux.remplir(
    [{ id: 'a1', leave_request_id: null, employee_id: 'e1', start_date: '2026-10-22', end_date: '2026-10-24', document_url: null, notes: '[Demande employé] mariage' }],
    [DEMANDE]
  )
  const retirees = await supprimerDemandeEtSesAbsences(DEMANDE, {})
  expect(retirees).toBe(1)
  expect(faux.restantes().absences).toHaveLength(0)
})

it('3. une absence saisie à la main aux mêmes dates n’est jamais effacée', async () => {
  faux.remplir(
    [{ id: 'a1', leave_request_id: null, employee_id: 'e1', start_date: '2026-10-22', end_date: '2026-10-24', document_url: null, notes: null }],
    [DEMANDE]
  )
  const retirees = await supprimerDemandeEtSesAbsences(DEMANDE, {})
  expect(retirees).toBe(0)
  // l'absence survit, seule la demande est retirée
  expect(faux.restantes().absences).toHaveLength(1)
  expect(faux.restantes().leave_requests).toHaveLength(0)
})

it('4. une demande refusée ne supprime aucune absence', async () => {
  faux.remplir(
    [{ id: 'a1', leave_request_id: null, employee_id: 'e1', start_date: '2026-10-22', end_date: '2026-10-24', document_url: null, notes: '[Demande employé] x' }],
    [{ ...DEMANDE, status: 'refuse' }]
  )
  const retirees = await supprimerDemandeEtSesAbsences({ ...DEMANDE, status: 'refuse' }, {})
  expect(retirees).toBe(0)
  expect(faux.restantes().absences).toHaveLength(1)
})

it('5. plus jamais de maybeSingle sur ce chemin : deux lignes ne font pas échouer la lecture', async () => {
  faux.remplir(
    [
      { id: 'a1', leave_request_id: 'req-1', employee_id: 'e1', start_date: '2026-10-22', end_date: '2026-10-24', document_url: null, notes: '' },
      { id: 'a2', leave_request_id: 'req-1', employee_id: 'e1', start_date: '2026-10-22', end_date: '2026-10-24', document_url: null, notes: '' },
    ],
    [DEMANDE]
  )
  await expect(supprimerDemandeEtSesAbsences(DEMANDE, {})).resolves.toBe(2)
  const suppressionAbsences = faux.journal.filter((j) => j.table === 'absences' && j.action === 'delete')
  expect(suppressionAbsences).toHaveLength(2)
})

// ═══════════════════════════════════════════════════════════
// 🗂️ LE TIROIR DU CALENDRIER
// ═══════════════════════════════════════════════════════════

const ABSENCE = {
  id: 'a1', employee_id: 'e1', enterprise_id: 'ent-1',
  start_date: '2026-10-22', end_date: '2026-10-24',
  reason: 'conge', status: 'approuve', count_holidays_as_leave: false,
  employees: { first_name: 'Awa', last_name: 'Ballo' },
}

it('6. le tiroir propose la suppression, en deux temps', () => {
  const html = renderToStaticMarkup(<Tiroir absence={ABSENCE} darkMode onSupprimer={() => {}} />)
  expect(html).toContain('data-testid="tiroir-supprimer"')
  expect(html).toContain('Supprimer l’absence')
  // la confirmation n'apparaît qu'après le premier clic
  expect(html).not.toContain('data-testid="tiroir-confirmer-suppression"')
})

it('7. sans gestionnaire de suppression, le tiroir reste en lecture seule', () => {
  const html = renderToStaticMarkup(<Tiroir absence={ABSENCE} darkMode />)
  expect(html).not.toContain('tiroir-supprimer')
})

it('8. le calendrier transmet la suppression, et la page la branche', () => {
  expect(lire('src/components/AbsencesCalendrier.jsx')).toContain('onSupprimer={(a) => { onSupprimer?.(a); setAbsenceActive(null) }}')
  expect(lire('src/pages/Absences.jsx')).toContain('onSupprimer={(a) => confirmDelete(a.id)}')
  // la vieille lecture en maybeSingle, qui faisait survivre le congé, a disparu
  const page = lire('src/pages/Absences.jsx')
  expect(page).not.toContain('linkedAbsence')
  const maybe = [...page.matchAll(/\.maybeSingle\(\)/g)]
  expect(maybe).toHaveLength(1) // celui des paramètres de paie, sans rapport
  expect(page).toContain("from('payroll_settings')")
  // l'approbation garde le lien vers la demande
  expect(lire('src/pages/Absences.jsx')).toContain('leave_request_id: selectedRequest.id')
})

it('9. la migration pose bien la colonne de liaison', () => {
  const sql = lire('supabase/migrations/20261022000001_absence_lien_demande.sql')
  expect(sql).toContain('ADD COLUMN IF NOT EXISTS leave_request_id')
  expect(sql).toContain('REFERENCES public.leave_requests')
})

// ═══════════════════════════════════════════════════════════
// 🛡️ GARDE-FOU : un rappel utilisé doit être déclaré
//
// Sans DOM dans les tests, un `onSupprimer?.(a)` dont le prop
// n'est pas dans la signature ne plante qu'AU CLIC, en
// production. On vérifie donc la signature à la source.
// ═══════════════════════════════════════════════════════════
const rappelsDeclare = (src, composant) => {
  const debut = src.indexOf(`function ${composant}({`)
  expect(debut).toBeGreaterThan(-1)
  const signature = src.slice(debut, src.indexOf('}) {', debut))
  const utilises = [...new Set([...src.matchAll(/\bon([A-Z]\w*)\?\.\(/g)].map((m) => `on${m[1]}`))]
  return { signature, utilises }
}

it('10. le calendrier déclare bien tous les rappels qu’il appelle', () => {
  const { signature, utilises } = rappelsDeclare(lire('src/components/AbsencesCalendrier.jsx'), 'AbsencesCalendrier')
  expect(utilises.length).toBeGreaterThan(3)
  utilises.forEach((nom) => expect(signature).toContain(nom))
  // celui qui a cassé en production :
  expect(utilises).toContain('onSupprimer')
  expect(signature).toContain('onSupprimer')
})

it('11. le tiroir et la carte de demande déclarent eux aussi leurs rappels', () => {
  const tiroir = rappelsDeclare(lire('src/components/AbsenceTiroir.jsx'), 'AbsenceTiroir')
  tiroir.utilises.forEach((nom) => expect(tiroir.signature).toContain(nom))

  // la carte passe ses rappels par une fabrique (`stop(...)`) : on vérifie
  // donc la signature directement
  const carte = rappelsDeclare(lire('src/components/DemandeCongeCard.jsx'), 'DemandeCongeCard')
  for (const nom of ['onVoir', 'onApprouver', 'onRefuser', 'onSupprimer']) {
    expect(carte.signature).toContain(nom)
  }
})
