// ═══════════════════════════════════════════════════════════════════════════
// 🧪 TESTS — GARDE DE NUIT, GARDES-FOUS, ET CE QUI EST PAYÉ
// ═══════════════════════════════════════════════════════════════════════════
//  LE RÉCIT DU 16/10/2026 (« Hippo BIYOKILA », PHA-0001) EN DEUX LIGNES
//    10:57:20 — IN réel, 17:30:15 — OUT réel (l'admin corrige à 19:21), puis
//    le lendemain : la fiche « Modifier » pousse une sortie au 17/10 01:12:51
//    parce que le bouton « J+1 » ajoute UN JOUR à la date affichée. La journée
//    du 16 se noue sur un instant qui n'est pas encore arrivé : 14 h 15 de
//    service inventées, deux fausses alertes envoyées aux responsables.
//
//  CE QUE VERROUILLE CE FICHIER (arbitrage n°2/3, code du 16/10/2026)
//    · A4/C1 — un badge ne peut pas se trouver dans le futur : le moteur
//      l'affiche (`__futur`) pour que l'admin le voie, mais ne l'apparie JAMAIS
//      et n'invente rien à sa place (cas 1) ;
//    · C6 — « la paie suit la doctrine » : une durée inventée ne gonfle JAMAIS
//      les heures travaillées ; elle vit dans `totalSecondesPresumes`, affichée
//      à part, NON PAYÉE tant qu'un humain ne l'a pas validée (cas 2, 3) ;
//    · C4 — « on invente, on marque, on n'encaisse pas » : une estimation
//      ÉCARTÉE (ou remplacée) n'est comptée nulle part, et le moteur ne la
//      REDÉVINE PAS (cas 4, cas Mercia 16/10 : après « Écarter », le moteur
//      ré-insérait une autre estimation dans la foulée — l'admin a dû écarter
//      deux fois) ;
//    · C2/C3 — les états d'estimation se lisent dans `anomalie` (ce que la
//      fiche a écrit), pas seulement dans `estimation_remplacee_le` (ce que la
//      base renseigne) : ÉCARTÉE ≠ VALIDÉE ≠ REMPLACÉE ≠ EN ATTENTE (cas 5) ;
//    · B1 — NON-RÉTROACTIVITÉ : la règle « non validée = non payable » ne
//      s'applique qu'aux pointages du 16/10/2026 INCLUS ET APRÈS. Avant :
//      l'ancienne comptabilité a payé ces heures de bonne foi, on n'efface pas
//      un bulletin. Une ligne sans date n'est pas « avant la borne » : inconnu
//      = strict (cas 6).
//
//  Aucun appel réseau : `../../lib/supabase` est mocké, comme dans le reste de la suite.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

vi.mock('../../lib/supabase', () => ({
  supabase: { from: vi.fn() },
  supabaseEmployee: { from: vi.fn() },
  default: { from: vi.fn() },
}))

import {
  SEUILS_PAR_DEFAUT,
  estEstimationAStatuer,
  estEstimationEcartee,
  estEstimationNonValidee,
  estJourneeOubliBadge,
  estLigneHorsCalcul,
  etiquetteEstimation,
  filtrerPointagesPayables,
} from '../seuilsPointage'
import { __internal } from '../hoursCalculator'
import { setActiveTimezone, resetActiveTimezone } from '../../utils/timezoneUtils'

const { resoudrePointagesJournee } = __internal

beforeEach(() => setActiveTimezone('Africa/Porto-Novo'))
afterEach(() => resetActiveTimezone())

const TZ = '+01:00' // Porto-Novo, sans changement d'heure

function badge(temps, type, extra = {}) {
  return {
    id: `${type}-${temps}`,
    employee_id: 'emp-1',
    enterprise_id: 'ent-1',
    check_time: `${temps}${TZ}`,
    check_type: type,
    method: 'pin',
    is_auto_closed: false,
    ...extra,
  }
}

const seuilsAvec = (sur) => ({ ...SEUILS_PAR_DEFAUT, ...sur })

// ───────────────────────────────────────────────────────────────────────────
// 1) GARDE-FOU « DATE FUTURE » — le récit Hippo du 16/10, en petits carrés
// ───────────────────────────────────────────────────────────────────────────
describe('garde-fou date future — le récit Hippo du 16/10', () => {
  const entree16 = badge('2026-10-16T10:57:20', 'in')
  const sortieFaussaire = badge('2026-10-17T01:12:51', 'out')

  it('1) une sortie datée du FUTUR ne s’apparie JAMAIS — et si elle est du jour, elle s’affiche marquée', () => {
    // referenceNow = 16/10 à 22:00 : le pointage « du 17 à 01:12 » n'existe pas encore.
    const r = resoudrePointagesJournee([entree16, sortieFaussaire], '2026-10-16', {
      enableAutoClose: false,
      referenceNow: '2026-10-16T22:00:00+01:00',
      seuils: seuilsAvec({ appariementHeures: 16 }),
    })

    // AVANT (le bug) : la paire se formait quand même — 14 h 15 de service
    // inventées, et les alertes « Départ très tardif » / « Shift anormalement
    // long » partaient aux responsables.
    expect(r.validPairs).toHaveLength(0)
    expect(r.totalSecondes).toBe(0)
    expect(r.lastOut).toBeNull()
    expect(r.firstIn?.check_time).toBe(entree16.check_time)

    // Une sortie « future » DU JOUR est VISIBLE (pour qu'un humain la corrige)
    // et marquée `__futur` — jamais appariée.
    const sortieDuJourFuture = badge('2026-10-16T23:59:00', 'out')
    const r2 = resoudrePointagesJournee([entree16, sortieDuJourFuture], '2026-10-16', {
      enableAutoClose: false,
      referenceNow: '2026-10-16T22:00:00+01:00',
      seuils: seuilsAvec({ appariementHeures: 16 }),
    })
    expect(r2.validPairs).toHaveLength(0)
    const faussaire = r2.attendances.find((a) => a.id === sortieDuJourFuture.id)
    expect(faussaire).toBeTruthy()
    expect(faussaire.__futur).toBe(true)
  })

  it('2) et rien n’est inventé à sa place : la session reste « en cours »', () => {
    // Même armé, l'auto-close ne doit pas fermer une journée dont la sortie
    // « existe déjà » (mais dans le futur) — il ne doit pas non plus en
    // inventer une seconde. (referenceNow = 10 h après l'entrée : sous le
    // seuil d'oubli de 12 h.)
    const r = resoudrePointagesJournee([entree16, sortieFaussaire], '2026-10-16', {
      enableAutoClose: true,
      referenceNow: '2026-10-16T21:00:00+01:00',
      seuils: seuilsAvec({ appariementHeures: 16, oubliSortieHeures: 12, plafondInventionHeures: 12 }),
    })
    expect(r.validPairs).toHaveLength(0)
    expect(r.attendances.filter((a) => a.is_auto_closed)).toHaveLength(0)
    expect(r.lastOut).toBeNull()
    expect(r.firstIn?.check_time).toBe(entree16.check_time) // « en service », pas « absent »
  })
})

// ───────────────────────────────────────────────────────────────────────────
// 2) C6 — LA PAIE SUIT LA DOCTRINE : inventé ≠ payé
// ───────────────────────────────────────────────────────────────────────────
describe('durées : réelles payées, présumées affichées à part', () => {
  const entreeMercia = badge('2026-10-16T12:46:25', 'in')

  it('2) une estimation non validée va dans totalSecondesPresumes, JAMAIS dans le total payé', () => {
    const r = resoudrePointagesJournee([entreeMercia], '2026-10-16', {
      enableAutoClose: true,
      referenceNow: '2026-10-17T09:00:00+01:00',
      seuils: seuilsAvec({ appariementHeures: 16, oubliSortieHeures: 12, plafondInventionHeures: 12 }),
      enterpriseCfg: { autoCloseEnabled: true, autoCloseTime: '17:00:00', autoCloseGraceMinutes: 0 },
    })

    // Cas Mercia 16/10 : sortie jamais badgée, fermeur de 17:00.
    expect(r.validPairs).toHaveLength(1)
    const [paire] = r.validPairs
    expect(paire.out.is_auto_closed).toBe(true)
    // 12:46:25 → 17:00:00 = 4 h 13 min 35 s = 15215 s — INVENTÉS :
    expect(r.totalSecondes).toBe(0)               // rien payé, rien « travaillé »
    expect(r.totalSecondesPresumes).toBe(15215)  // affiché à part, à valider
  })

  it('3) la même estimation, une fois VALIDÉE par un humain, devient payée', () => {
    const sortieValidee = badge('2026-10-16T17:00:00', 'out', {
      is_auto_closed: true,
      anomalie: 'sortie_presumee',
      estimation_source_id: entreeMercia.id,
      estimation_validee_le: '2026-10-16T20:00:00Z',
    })
    const r = resoudrePointagesJournee([entreeMercia, sortieValidee], '2026-10-16', {
      enableAutoClose: false,
      referenceNow: '2026-10-17T09:00:00+01:00',
      seuils: seuilsAvec({ appariementHeures: 16 }),
    })
    expect(r.validPairs).toHaveLength(1)
    expect(r.totalSecondes).toBe(15215)          // validée = payée
    expect(r.totalSecondesPresumes).toBe(0)
  })
})

// ───────────────────────────────────────────────────────────────────────────
// 3) C4 — ÉCARTÉE : non comptée nulle part, et jamais re-devinée
// ───────────────────────────────────────────────────────────────────────────
describe('estimation écartée — le cas Mercia après « Écarter »', () => {
  const entreeMercia = badge('2026-10-16T12:46:25', 'in')
  const estimationEcartee = badge('2026-10-16T17:00:00', 'out', {
    is_auto_closed: true,
    anomalie: 'sortie_presumee_rejetee',
    estimation_source_id: entreeMercia.id,
    estimation_remplacee_le: '2026-10-16T20:10:00Z',
  })

  it('4) après « Écarter » : rien n’est compté, et le moteur ne ré-invente PAS', () => {
    const r = resoudrePointagesJournee([entreeMercia, estimationEcartee], '2026-10-16', {
      enableAutoClose: true,
      referenceNow: '2026-10-17T09:00:00+01:00', // le lendemain : l'oubli est avéré
      seuils: seuilsAvec({ appariementHeures: 16, oubliSortieHeures: 12, plafondInventionHeures: 12 }),
      enterpriseCfg: { autoCloseEnabled: true, autoCloseTime: '17:00:00', autoCloseGraceMinutes: 0 },
    })

    // L'estimation écartée n'est plus une sortie :
    expect(r.validPairs).toHaveLength(0)
    expect(r.totalSecondes).toBe(0)
    expect(r.totalSecondesPresumes).toBe(0)
    expect(r.lastOut).toBeNull()
    // …et LE MOTEUR NE REDÉVINE PAS (bug du 16/10 : il ré-insérait la même
    // estimation dans la foulée — l'admin a dû écarter deux fois).
    expect(r.attendances.filter((a) => a.is_auto_closed)).toHaveLength(1) // juste la ligne d'audit
    // La décision reste VISIBLE sur l'écran :
    expect(r.estimationEcartee).toBeTruthy()
    expect(r.estimationEcartee.heure).toBe(estimationEcartee.check_time)
    expect(estLigneHorsCalcul(estimationEcartee)).toBe(true)
  })
})

// ───────────────────────────────────────────────────────────────────────────
// 4) C2/C3 — LES ÉTATS SE LISENT DANS `anomalie` (« ÉCARTÉE » ≠ « REMPLACÉE »)
// ───────────────────────────────────────────────────────────────────────────
describe('états d’estimation — ce que la fiche a écrit, pas ce que la base renseigne', () => {
  const base = {
    check_type: 'out',
    is_auto_closed: true,
    anomalie: 'sortie_presumee',
  }

  it('5a) EN ATTENTE : à statuer, non payée, libellé « ⏳ présumée — non payée »', () => {
    const att = { ...base }
    expect(estEstimationAStatuer(att)).toBe(true)
    expect(estEstimationNonValidee(att)).toBe(true)
    expect(etiquetteEstimation(att)).toBe('⏳ présumée — non payée')
  })

  it('5b) VALIDÉE : plus à statuer, payée', () => {
    const att = { ...base, estimation_validee_le: '2026-10-16T20:00:00Z' }
    expect(estEstimationAStatuer(att)).toBe(false)
    expect(estEstimationNonValidee(att)).toBe(false)
    expect(etiquetteEstimation(att)).toBe('présumée, validée')
  })

  it('5c) ÉCARTÉE : plus à statuer (le bouton disparaît), mais JAMAIS PAYÉE', () => {
    // C'est LE bug du 16/10 : estEstimationNonValidee revenait à true tant que
    // `estimation_remplacee_le` était rempli — les boutons restaient affichés
    // à vie après « Écarter ». Deux prédicats, deux métiers :
    //   · estEstimationAStatuer  → les boutons (Valider/Écarter) ;
    //   · estEstimationNonValidee → la PAIE (elle ne doit PAS s'assouplir).
    const att = { ...base, anomalie: 'sortie_presumee_rejetee', estimation_remplacee_le: '2026-10-16T20:10:00Z' }
    expect(estEstimationAStatuer(att)).toBe(false)    // plus de bouton
    expect(estEstimationNonValidee(att)).toBe(true)   // toujours non payée
    expect(estEstimationEcartee(att)).toBe(true)
    expect(etiquetteEstimation(att)).toBe("écartée par l'admin — non payée")
  })

  it('5d) REMPLACÉE par un vrai badge : non payée telle quelle, libellé honnête', () => {
    // Bug 2 du cas Mercia : l'écran disait « ✅ Sortie réelle récupérée » en
    // testant seulement `estimation_remplacee_le` — or « Écarter » remplit la
    // même colonne. Le libellé se lit dans `anomalie`.
    const att = { ...base, anomalie: 'sortie_presumee_remplacee', estimation_remplacee_le: '2026-10-16T20:10:00Z' }
    expect(estEstimationEcartee(att)).toBe(false)
    expect(estEstimationAStatuer(att)).toBe(false)
    expect(etiquetteEstimation(att)).toBe('remplacée par un pointage réel')
    expect(estLigneHorsCalcul(att)).toBe(true) // jamais comptée, jamais appariée
  })
})

// ───────────────────────────────────────────────────────────────────────────
// 5) B1 — NON-RÉTROACTIVITÉ : la règle s'applique du 16/10/2026 inclus
// ───────────────────────────────────────────────────────────────────────────
describe('paie — non-rétroactivité de la règle « non validée = non payée »', () => {
  const nonValidee = (check_time) => ({
    check_type: 'out',
    is_auto_closed: true,
    anomalie: 'sortie_presumee',
    check_time,
  })

  it('6a) AVANT le 16/10/2026 : comptée (l’ancienne comptabilité l’avait payée)', () => {
    const lignes = [nonValidee('2026-10-15T18:24:51Z')]
    expect(filtrerPointagesPayables(lignes)).toHaveLength(1)
  })

  it('6b) DU 16/10/2026 inclus : NON comptée tant que non validée', () => {
    const lignes = [nonValidee('2026-10-16T17:00:00Z')]
    expect(filtrerPointagesPayables(lignes)).toHaveLength(0)
    // …sauf si un humain l'a validée :
    const validee = [{ ...nonValidee('2026-10-16T17:00:00Z'), estimation_validee_le: '2026-10-16T20:00:00Z' }]
    expect(filtrerPointagesPayables(validee)).toHaveLength(1)
  })

  it('6c) sans date : inconnu = strict, jamais comptée', () => {
    const lignes = [nonValidee(undefined)]
    expect(filtrerPointagesPayables(lignes)).toHaveLength(0)
  })
})

// ───────────────────────────────────────────────────────────────────────────
// 6) C5 — LE COMPTEUR « OUBLIS BADGE » — le cas MADEDE, 16/10 (après « Écarter »)
// ───────────────────────────────────────────────────────────────────────────
describe('compteur Oublis badge — une journée sans sortie réelle EST un oubli', () => {
  const entree = badge('2026-10-16T08:52:11', 'in')
  const estim17h = (sur = {}) => badge('2026-10-16T17:00:00', 'out', {
    is_auto_closed: true,
    anomalie: 'sortie_presumee',
    estimation_source_id: entree.id,
    ...sur,
  })
  //  Le lendemain de l'arrivée, après 8 h : le seuil est mesuré sur la SESSION
  //  (l'arrivée de 08:52), jamais sur la supposition de 17:00.
  const MAINTENANT = new Date('2026-10-16T18:30:00+01:00').getTime()

  it('7a) arrivée seule, journée commencée depuis +8 h : oubli', () => {
    expect(estJourneeOubliBadge([entree], MAINTENANT)).toBe(true)
  })

  it('7b) supposée à statuer (⏳) : oubli — la supposition masque l’oubli, elle ne le règle pas', () => {
    expect(estJourneeOubliBadge([entree, estim17h()], MAINTENANT)).toBe(true)
  })

  it('7c) supposée ÉCARTÉE (🚫) : oubli RECOMPTÉ — l’admin vient de dire « cette heure est fausse », la vraie sortie manque plus que jamais (cas MADEDE 16/10)', () => {
    const ecartee = estim17h({
      anomalie: 'sortie_presumee_rejetee',
      estimation_remplacee_le: '2026-10-16T18:20:00Z',
    })
    expect(estJourneeOubliBadge([entree, ecartee], MAINTENANT)).toBe(true)
  })

  it('7d) supposée VALIDÉE : plus un oubli — l’humain a tranché l’heure, elle fait foi', () => {
    const validee = estim17h({ estimation_validee_le: '2026-10-16T18:20:00Z' })
    expect(estJourneeOubliBadge([entree, validee], MAINTENANT)).toBe(false)
  })

  it('7e) supposée REMPLACÉE par un vrai badge : plus un oubli — la vérité terrain est arrivée', () => {
    const remplacee = estim17h({
      anomalie: 'sortie_presumee_remplacee',
      estimation_remplacee_le: '2026-10-16T19:21:42Z',
    })
    const vraiOut = badge('2026-10-16T19:21:42', 'out')
    expect(estJourneeOubliBadge([entree, remplacee, vraiOut], MAINTENANT)).toBe(false)
  })

  it('7f) vraie sortie après l’arrivée : jamais un oubli', () => {
    const vraiOut = badge('2026-10-16T17:20:00', 'out')
    expect(estJourneeOubliBadge([entree, vraiOut], MAINTENANT)).toBe(false)
  })

  it('7g) session commencée depuis moins de 8 h : pas (encore) un oubli', () => {
    expect(estJourneeOubliBadge([entree], new Date('2026-10-16T12:00:00+01:00').getTime())).toBe(false)
  })

  it('7h) fin de garde de nuit rattachée à la veille (sortie seule) : pas un oubli', () => {
    const sortieNuit = badge('2026-10-16T01:14:00', 'out')
    expect(estJourneeOubliBadge([sortieNuit], MAINTENANT)).toBe(false)
  })
})
