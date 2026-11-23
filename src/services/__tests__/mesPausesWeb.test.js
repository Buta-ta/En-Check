// ═══════════════════════════════════════════════════════════════════════════
// 🕒 « MES PAUSES » — ce que l'employé voit de ses propres pauses
//
// Deux règles à tenir ensemble :
//   1. il voit SES pauses, et l'identité vient du JWT — jamais d'un
//      paramètre (la RPC n'en prend aucun) ;
//   2. il ne voit PAS pourquoi sa pause s'est fermée. Décision du fondateur
//      du 26/11 : c'est une information d'administration.
// ═══════════════════════════════════════════════════════════════════════════
import { describe, it, expect, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import {
  chargerMesPauses,
  presenterMesPauses,
  dureeLisible,
  totalMinutes,
  ANOMALIES_EMPLOYE,
} from '../mesPausesService'

describe('🕒 Chargement — l’identité vient de la session', () => {
  it('n’envoie aucun paramètre d’identité à la base', async () => {
    //  `encheck_pauses_mes_pauses_web()` ne prend qu'une fenêtre en jours.
    //  Si un `p_employee` apparaissait ici, n'importe qui lirait les pauses
    //  d'un collègue.
    const rpc = vi.fn().mockResolvedValue({ data: [], error: null })
    await chargerMesPauses({ rpc })
    expect(rpc).toHaveBeenCalledWith('encheck_pauses_mes_pauses_web', {})
    const [, params] = rpc.mock.calls[0]
    expect(params).not.toHaveProperty('p_employee')
    expect(params).not.toHaveProperty('p_employe')
  })

  it('ne lève jamais : une erreur rend une liste vide', async () => {
    //  Une section secondaire ne doit pas casser la page des heures.
    const rpc = vi.fn().mockRejectedValue(new Error('réseau'))
    await expect(chargerMesPauses({ rpc })).resolves.toEqual({ pauses: [], erreur: true })
  })

  it('signale l’erreur sans la propager quand le serveur refuse', async () => {
    const rpc = vi.fn().mockResolvedValue({ data: null, error: { code: '42501' } })
    await expect(chargerMesPauses({ rpc })).resolves.toEqual({ pauses: [], erreur: true })
  })
})

describe('🚫 Ce que l’employé ne doit PAS voir', () => {
  it('n’affiche jamais le motif de fermeture', () => {
    //  Même si le serveur envoyait la colonne par erreur, la présentation
    //  ne doit pas la porter jusqu'à l'écran.
    const [ligne] = presenterMesPauses([{
      id: 'x', jour: '2026-11-24', statut: 'reelle', duree_minutes: 60,
      debut: '2026-11-24T12:00:00Z', fin: '2026-11-24T13:00:00Z',
      motif_fermeture: 'sortie',
    }])
    expect(ligne).not.toHaveProperty('motifFermeture')
    expect(JSON.stringify(ligne)).not.toContain('sortie')
    expect(JSON.stringify(ligne)).not.toContain('Reprise')
  })

  it('ne montre pas une pause écartée par l’administration', () => {
    const lignes = presenterMesPauses([
      { id: 'a', jour: '2026-11-24', statut: 'reelle', duree_minutes: 30 },
      { id: 'b', jour: '2026-11-23', statut: 'ecartee', duree_minutes: 90 },
    ])
    expect(lignes.map((l) => l.id)).toEqual(['a'])
  })

  it('n’affiche pas de libellé d’anomalie inconnu', () => {
    const [ligne] = presenterMesPauses([
      { id: 'x', jour: '2026-11-24', statut: 'reelle', anomalie: 'valeur_future' },
    ])
    expect(ligne.anomalie).toBeNull()
  })

  it('les libellés restent neutres', () => {
    //  « Dépassement » est un jugement d'administration adressé à un
    //  salarié. Côté employé, on dit « plus longue que prévu », sans
    //  reproche et sans chiffre.
    expect(ANOMALIES_EMPLOYE.depassement).toBe('Plus longue que prévu')
    expect(ANOMALIES_EMPLOYE.depassement).not.toMatch(/dépassement/i)
  })
})

describe('🕒 Présentation', () => {
  it('écrit une durée lisible, jamais « 111 min »', () => {
    expect(dureeLisible(45)).toBe('45 min')
    expect(dureeLisible(111)).toBe('1 h 51')
    expect(dureeLisible(120)).toBe('2 h')
    expect(dureeLisible(0)).toBe('0 min')
  })

  it('marque une pause encore ouverte', () => {
    const [ligne] = presenterMesPauses([
      { id: 'x', jour: '2026-11-24', statut: 'reelle', debut: '2026-11-24T12:00:00Z', fin: null },
    ])
    expect(ligne.ouverte).toBe(true)
    expect(ligne.duree).toBeNull()
  })

  it('trie de la plus récente à la plus ancienne', () => {
    const lignes = presenterMesPauses([
      { id: 'vieux', jour: '2026-10-01', statut: 'reelle' },
      { id: 'recent', jour: '2026-11-24', statut: 'reelle' },
    ])
    expect(lignes[0].id).toBe('recent')
  })

  it('n’additionne que les pauses fermées', () => {
    const total = totalMinutes([
      { ouverte: false, dureeMinutes: 60 },
      { ouverte: false, dureeMinutes: 30 },
      { ouverte: true, dureeMinutes: 0 },
    ])
    expect(total).toBe(90)
  })
})

describe('🔌 Le contrat serveur et l’écran restent alignés', () => {
  it('la RPC ne renvoie pas motif_fermeture', () => {
    const sql = readFileSync(
      'supabase/migrations/20261126000001_motif_fermeture_lecture_admin.sql', 'utf8')
    const fn = sql.slice(sql.indexOf('FUNCTION public.encheck_pauses_mes_pauses_web'))
    const retour = fn.slice(fn.indexOf('RETURNS TABLE('), fn.indexOf('LANGUAGE plpgsql'))
    expect(retour).not.toContain('motif_fermeture')
  })

  it('la page des heures n’affiche pas non plus le motif', () => {
    const page = readFileSync('src/pages/employee/EmployeeHeures.jsx', 'utf8')
    const section = readFileSync('src/components/employee/MesPausesSection.jsx', 'utf8')
    expect(page).not.toContain('motifFermeture')
    expect(section).not.toContain('motifFermeture')
    expect(section).not.toContain('motif_fermeture')
  })
})
