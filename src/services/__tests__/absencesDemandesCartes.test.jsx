// ═══════════════════════════════════════════════════════════
// 📨 BLOC « DEMANDES EMPLOYÉS » — CARTES REDESIGNÉES
//
// On vérifie que chaque demande est lisible d'un coup d'œil :
// avatar de l'employé, motif aux couleurs de l'entreprise,
// pastille de statut, boutons d'action toujours visibles.
// ═══════════════════════════════════════════════════════════

import { it, expect, vi, beforeEach } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import { renderToStaticMarkup } from 'react-dom/server'
import { DemandeCongeCard } from '../../components/DemandeCongeCard'

const ROOT = path.resolve(import.meta.dirname, '../../..')
const absencesSrc = fs.readFileSync(path.join(ROOT, 'src/pages/Absences.jsx'), 'utf8')

/** Les motifs renvoyés par le contexte — modifiables par chaque test */
const { etat } = vi.hoisted(() => ({ etat: { motifs: [] } }))
vi.mock('../../hooks/useMotifsAbsence', () => ({
  useMotifsAbsence: () => ({
    motifs: etat.motifs,
    motifPour: (d) => etat.motifs.find((m) => m.id === (typeof d === 'string' ? d : d?.reason)) || null,
  }),
}))

const MOTIFS_MAISON = [
  { id: 'conge', label: 'Congé payé', color: '#14B8A6', bg: 'rgba(20,184,166,0.15)', emoji: '🌴' },
  { id: 'musique', label: 'Musique', color: '#10B981', bg: 'rgba(16,185,129,0.15)', emoji: '🎙️' },
  { id: 'formation', label: 'Formation', color: '#8B5CF6', bg: 'rgba(139,92,246,0.15)', emoji: '🎓' },
]

beforeEach(() => { etat.motifs = MOTIFS_MAISON })

const cleJour = (d) => {
  const dt = d instanceof Date ? d : new Date(`${String(d).slice(0, 10)}T12:00:00Z`)
  return dt.toISOString().slice(0, 10)
}
const fmtDate = (d) => new Date(`${String(d).slice(0, 10)}T12:00:00Z`)
  .toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' })

const dansNJours = (n) => {
  const d = new Date()
  d.setDate(d.getDate() + n)
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10)
}

const demande = (id, opts = {}) => ({
  id,
  status: 'en_attente',
  start_date: dansNJours(10),
  end_date: dansNJours(12),
  reason: 'conge',
  days_count: 3,
  comment: '',
  document_url: null,
  employees: { first_name: 'Awa', last_name: 'Ballo', matricule: 'ENN-0001' },
  ...opts,
})

const lesDemandes = [
  demande('req-1', { status: 'en_attente', employees: { first_name: 'Awa', last_name: 'Ballo' } }),
  demande('req-2', { status: 'approuve', employees: { first_name: 'Kofi', last_name: 'Mensah' }, reason: 'musique' }),
  demande('req-3', { status: 'refuse', employees: { first_name: 'Fatou', last_name: 'Sow' }, reason: 'formation' }),
]

const rendre = (props = {}) => renderToStaticMarkup(
  <DemandeCongeCard demande={demande('req-x')} cleJour={cleJour} fmtDate={fmtDate} {...props} />
)

const cartes = (extras = []) => renderToStaticMarkup(
  <div>
    {lesDemandes.map((d, i) => (
      <DemandeCongeCard
        key={d.id}
        demande={{ ...d, ...(extras[i] || {}) }}
        cleJour={cleJour}
        fmtDate={fmtDate}
      />
    ))}
  </div>
)

it('1. les trois demandes du bloc, dans l’ordre, avec le nom de l’employé et le statut', () => {
  const html = cartes()
  const blocs = html.split('data-testid="demande-card"').slice(1)
  expect(blocs).toHaveLength(3)
  expect(blocs[0]).toContain('data-statut="attente"')
  expect(blocs[1]).toContain('data-statut="approuve"')
  expect(blocs[2]).toContain('data-statut="refuse"')
  expect(html).toContain('Awa Ballo')
  expect(html).toContain('Kofi Mensah')
  expect(html).toContain('Fatou Sow')
  expect(html).toContain('⏳ En attente')
  expect(html).toContain('✅ Approuvée')
  expect(html).toContain('❌ Refusée')
})

it('2. chaque carte porte l’avatar de l’employé (ses initiales)', () => {
  const html = cartes()
  expect(html).toContain('>AB<')
  expect(html).toContain('>KM<')
  expect(html).toContain('>FS<')
})

it('3. le motif affiché est celui de l’entreprise : couleur et emoji', () => {
  const html = rendre({ demande: demande('req-1', { reason: 'musique' }) })
  expect(html).toContain('🎙️ Musique')
  expect(html).toContain('#10B981')
  expect(html).toContain('border-left:3px solid #10B981') // la barre de gauche prend la couleur du motif
})

it('4. un motif inconnu ne laisse jamais de case vide', () => {
  const html = rendre({ demande: demande('req-1', { reason: 'code-inconnu' }) })
  expect(html).toContain('📋')
  expect(html).toContain('code-inconnu')
})

it('5. les boutons d’action ne s’affichent que sur une demande en attente', () => {
  const attente = rendre({ demande: demande('req-1', { status: 'en_attente' }) })
  const approuvee = rendre({ demande: demande('req-2', { status: 'approuve' }) })
  expect(attente).toContain('data-testid="demande-approuver"')
  expect(attente).toContain('data-testid="demande-refuser"')
  expect(attente).toContain('Approuver')
  expect(attente).toContain('Refuser')
  expect(approuvee).not.toContain('demande-approuver')
  // une demande déjà traitée peut être retirée
  expect(approuvee).toContain('data-testid="demande-supprimer"')
})

it('6. pendant le traitement, les boutons sont désactivés', () => {
  const html = rendre({ demande: demande('req-1'), busy: true })
  const boutons = (html.match(/<button[^>]*data-testid="demande-(approuver|refuser)"[^>]*>/g) || [])
  expect(boutons).toHaveLength(2)
  boutons.forEach((b) => expect(b).toContain('disabled'))
})

it('7. la période, la durée et les pièces jointes sont lisibles', () => {
  const html = rendre({
    demande: demande('req-1', { days_count: 3, documents: [{ name: 'cert.pdf' }, { name: 'lettre.pdf' }] }),
  })
  expect(html).toContain(`${fmtDate(demande().start_date)} → ${fmtDate(demande().end_date)}`)
  expect(html).toContain('3 j')
  expect(html).toContain('2 pièces jointes')
  // une seule pièce, à l'ancienne (document_url)
  expect(rendre({ demande: demande('req-1', { document_url: 'https://cdn/x.pdf' }) })).toContain('1 pièce jointe')
})

it('8. une demande qui commence aujourd’hui est signalée', () => {
  const html = rendre({ demande: demande('req-1', { start_date: dansNJours(0) }) })
  expect(html).toContain('data-jour="' + dansNJours(0) + '"')
  expect(html).toContain('commence aujourd’hui')
  // et pas de mauvaise surprise pour les autres
  expect(rendre({ demande: demande('req-1', { start_date: dansNJours(4) }) })).not.toContain('commence aujourd’hui')
})

it('9. les chips de filtrage et l’état vide sont ceux demandés', () => {
  expect(absencesSrc).toContain('📨 Toutes')
  expect(absencesSrc).toContain('⏳ En attente')
  expect(absencesSrc).toContain('✅ Approuvées')
  expect(absencesSrc).toContain('❌ Refusées')
  expect(absencesSrc).toContain('Aucune demande')
  expect(absencesSrc).toContain('pas encore soumis de demandes de congé')
  expect(absencesSrc).toContain('<DemandeCongeCard')
})

it('10. le bloc n’utilise plus l’ancienne présentation en colonnes', () => {
  expect(absencesSrc).not.toContain('className="req-card"')
})
