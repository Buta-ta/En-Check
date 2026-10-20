import { describe, it, expect, beforeEach } from 'vitest'
import { setActiveTimezone } from '../../utils/timezoneUtils'
import {
  construirePauses,
  badgeStatut,
  badgeAnomalie,
  formatDuree,
  exportCsvPauses,
  STATUTS_A_STATUER,
  estPausePresumee,
  estPauseNonPresumee,
  estPauseReelleEffectuee,
  filtrerHistoriquePausesReelles,
  filtrerPausesPresumees,
  fusionnerPausesEmploye,
  formaterTempsPauseEnDirect,
  formaterChronoPauseDigital,
} from '../pausesService.js'

beforeEach(() => {
  setActiveTimezone('Africa/Porto-Novo')
})

describe('⏸ Service Pauses — présentation pure (16/10/2026)', () => {
  const ligneReelle = {
    id: '11111111-1111-1111-1111-111111111111',
    employe_id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    prenom: 'Jean', nom: 'Dupont', matricule: 'EMP-004',
    entreprise_nom: 'Société X', enterprise_id: '99999999-9999-9999-9999-999999999999',
    jour: '2026-10-16',
    debut: '2026-10-16T12:05:00+01:00',
    fin: '2026-10-16T13:00:00+01:00',
    duree_minutes: 55,
    statut: 'reelle', source: 'pointee', motif: 'Repas', anomalie: null,
  }
  const lignePresumee = {
    ...ligneReelle,
    id: '22222222-2222-2222-2222-222222222222',
    debut: '2026-10-16T12:00:00+01:00',
    fin: '2026-10-16T13:00:00+01:00',
    duree_minutes: 60,
    statut: 'presumee', source: 'presumee', motif: null, anomalie: null,
  }
  const ligneSansReprise = {
    ...ligneReelle,
    id: '33333333-3333-3333-3333-333333333333',
    fin: null,
    duree_minutes: 233,
    statut: 'reelle', anomalie: 'sans_reprise',
  }

  it('formatDuree affiche « 45 min » puis « 2h35 » (pédagogique)', () => {
    expect(formatDuree(45)).toBe('45 min')
    expect(formatDuree(155)).toBe('2h35')
    expect(formatDuree(0)).toBe('0 min')
    expect(formatDuree(null)).toBe('0 min')
  })

  it('construirePauses : pause réelle (déclarée) + tri jour/début', () => {
    const { paies, stats } = construirePauses([ligneReelle, lignePresumee])
    expect(paies).toHaveLength(2)
    // jour identique → tri décroissant sur l'heure de début (12:05 avant 12:00)
    expect(paies[0].id).toBe('11111111-1111-1111-1111-111111111111')
    expect(paies[0].employe).toBe('Jean Dupont')
    expect(paies[0].debutHHMM).toBe('12:05')
    expect(paies[0].finHHMM).toBe('13:00')
    expect(paies[0].dureeMinutes).toBe(55)
    expect(paies[0].statut).toBe('reelle')
    expect(paies[0].aStatuer).toBe(true)
    expect(stats.nbReelles).toBe(1)
    expect(stats.nbPresumees).toBe(1)
    // 55 + 60 minutes de pause
    expect(stats.dureeTotale).toBe(115)
  })

  it('distingue strictement pauses présumées et pauses non présumées (réellement effectuées)', () => {
    const { paies, stats } = construirePauses([ligneReelle, lignePresumee])
    expect(estPauseNonPresumee(paies[0])).toBe(true)
    expect(estPauseReelleEffectuee(paies[0])).toBe(true)
    expect(estPausePresumee(paies[0])).toBe(false)

    expect(estPausePresumee(paies[1])).toBe(true)
    expect(estPauseNonPresumee(paies[1])).toBe(false)
    expect(estPauseReelleEffectuee(paies[1])).toBe(false)

    const historiqueReel = filtrerHistoriquePausesReelles(paies)
    expect(historiqueReel).toHaveLength(1)
    expect(historiqueReel[0].id).toBe(ligneReelle.id)

    const presumees = filtrerPausesPresumees(paies)
    expect(presumees).toHaveLength(1)
    expect(presumees[0].id).toBe(lignePresumee.id)

    expect(stats.nbReellesEffectuees).toBe(1)
    expect(stats.dureeReelleMinutes).toBe(55)
    expect(stats.nbPresumeesTotal).toBe(1)
    expect(stats.nbPresumeesAStatuer).toBe(1)
  })

  it('ne crée jamais de fausse pause réelle à partir d’un intervalle Sortie → Entrée dans attendances (cas Hippo BIYOKILA 10:00:36→10:07:22)', () => {
    const validPairs = [
      {
        in: { id: 'in-1', check_time: '2026-10-20T08:00:00+01:00', check_type: 'in' },
        out: { id: 'out-1', check_time: '2026-10-20T10:00:36+01:00', check_type: 'out' },
      },
      {
        in: { id: 'in-2', check_time: '2026-10-20T10:07:22+01:00', check_type: 'in' },
        out: null,
      },
    ]

    const merged = fusionnerPausesEmploye({
      pausesTable: [],
      validPairs,
      employee: { id: 'emp-hippo', first_name: 'Hippo', last_name: 'BIYOKILA', matricule: 'MAT-01' },
      scheduleInfo: { mode: 'general', hasBreak: true },
      selectedDate: '2026-10-20',
    })

    expect(merged).toHaveLength(0)
    expect(filtrerHistoriquePausesReelles(merged)).toHaveLength(0)
  })

  it('pause ouverte (sans reprise) : finHHMM null, OUVERTE signalée', () => {
    const { paies, stats } = construirePauses([ligneSansReprise])
    expect(paies[0].ouverte).toBe(true)
    expect(paies[0].finHHMM).toBeNull()
    expect(stats.nbOuvertes).toBe(1)
    expect(stats.nbAnomalies).toBe(1)
  })

  it('STATUTS_A_STATUER = réelle + presumee (jamais les décisions)', () => {
    expect(STATUTS_A_STATUER).toEqual(['reelle', 'presumee'])
    const { paies } = construirePauses([
      ligneReelle, lignePresumee,
      { ...ligneReelle, id: '44444444-4444-4444-4444-444444444444', statut: 'validee' },
      { ...ligneReelle, id: '55555555-5555-5555-5555-555555555555', statut: 'ecartee' },
    ])
    expect(paies.filter(p => p.aStatuer)).toHaveLength(2)
    // une ligne écartée ne compte plus dans le temps de pause
    const s = construirePauses([
      ligneReelle,
      { ...ligneReelle, id: '66666666-6666-6666-6666-666666666666', statut: 'ecartee' },
    ])
    expect(s.stats.dureeTotale).toBe(55)
  })

  it('badges de statut et d\'anomalie (doctrine : on MARQUE)', () => {
    expect(badgeStatut('presumee').label).toBe('Présumée')
    expect(badgeStatut('reelle').label).toBe('Pause réelle')
    expect(badgeStatut('validee').color).toBe('#3B82F6')
    expect(badgeStatut('inconnu').label).toBe('inconnu')
    expect(badgeAnomalie('sans_reprise').label).toBe('🚫 Sans reprise')
    expect(badgeAnomalie('trop_longue').label).toBe('⚠️ Très longue')
    expect(badgeAnomalie(null)).toBeNull()
  })

  it('export CSV : entêtes FR + échappement des guillemets (séparateur ;)', () => {
    const { paies } = construirePauses([ligneReelle])
    const csv = exportCsvPauses(paies)
    const lignes = csv.split('\n')
    expect(lignes[0]).toContain('Durée (min)')
    expect(lignes[0]).toContain('Anomalie')
    expect(lignes[1]).toContain('Jean Dupont')
    expect(lignes[1]).toContain('Pause réelle')
  })

  it('formaterTempsPauseEnDirect et formaterChronoPauseDigital : chronomètre dynamique seconde par seconde', () => {
    const startIso = '2026-10-20T12:15:00+01:00'
    const startMs = new Date(startIso).getTime()
    const pauseOuverte = {
      id: 'pause-open-1',
      ouverte: true,
      debutISO: startIso,
      dureeMinutes: 0,
    }
    // +14m 22s
    const now14m22s = startMs + (14 * 60 + 22) * 1000
    expect(formaterTempsPauseEnDirect(pauseOuverte, now14m22s)).toBe('14m 22s')
    expect(formaterChronoPauseDigital(pauseOuverte, now14m22s)).toBe('14:22')

    // +1h 05m 09s
    const now1h05m09s = startMs + (3600 + 5 * 60 + 9) * 1000
    expect(formaterTempsPauseEnDirect(pauseOuverte, now1h05m09s)).toBe('1h 05m 09s')
    expect(formaterChronoPauseDigital(pauseOuverte, now1h05m09s)).toBe('01:05:09')
  })
})
