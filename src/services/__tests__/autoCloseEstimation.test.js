// ═══════════════════════════════════════════════════════════════════════════
// 🧪 TESTS — ESTIMATION DE SORTIE (arbitrage n°1 · « on invente, on marque,
//            on n'encaisse pas »)
// ═══════════════════════════════════════════════════════════════════════════
//
// POURQUOI CE FICHIER EXISTE
//   La clôture automatique existait depuis des mois SANS test : chacun de ses
//   seuils avait été changé à la main, dans un seul des deux moteurs, et la
//   paie payait des heures inventées. Ces tests verrouillent les six règles
//   que l'IA ARBITRE a validées, pour qu'elles ne puissent plus se
//   ré-écarter du contrat :
//     1. les seuils viennent d'UNE seule table, sinon du contrat par défaut ;
//     2. la cascade a bien CINQ niveaux, dans cet ordre, et le niveau est tracé ;
//     3. une heure inventée ne dépasse jamais `plafondInventionHeures` ;
//     4. une heure inventée n'est jamais dans le futur ;
//     5. une sortie présumée non validée ne rentre dans AUCUN calcul de paie ;
//     6. les heures autour de minuit se comparent en cercle (le piège du
//        `BETWEEN '21:30' AND '01:30'` qui renvoie zéro ligne).
//
//   Aucun de ces tests n'appelle Supabase pour de vrai : la couche réseau est
//   mockée, y compris le cas « table pas encore migrée » (point 1.b).

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

vi.mock('../../lib/supabase', () => ({
  supabase: { from: vi.fn() },
  supabaseEmployee: { from: vi.fn() },
  default: { from: vi.fn() },
}))

import {
  SEUILS_PAR_DEFAUT,
  chargerSeuilsPointage,
  invaliderCacheSeuils,
  estEstimationNonValidee,
  estEstimationRemplacee,
  estRebondNeutralise,
  filtrerPointagesPayables,
  etiquetteEstimation,
  minutesDuJour,
  distanceCirculaireMinutes,
  dansLaFenetre,
  validerCibleEstimation,
} from '../seuilsPointage'
import { __internal, calculerSortieAutoClose } from '../hoursCalculator'
import { setActiveTimezone, resetActiveTimezone } from '../../utils/timezoneUtils'

const { resoudrePointagesJournee } = __internal

// Un tour d'horloge complet, pour les comparaisons circulaires.
const JOUR_MINUTES = 1440

describe('1. Seuils — une seule source (décision §4.4)', () => {
  beforeEach(() => invaliderCacheSeuils())

  it('a) verrouille lharmonisation : oubli = plafond = 12 h, appariement = 16 h', () => {
    // Ces trois nombres étaient TROIS valeurs différentes selon le moteur
    // (12 h pointeuse, 14 h SQL, 16 h JS). L'arbitrage a tranché : 12 h pour
    // tout ce qui touche à l'oubli, 16 h gardés pour la seule tolérance
    // d'appariement (une garde de 13 h reste une garde, ce n'est pas un oubli).
    expect(SEUILS_PAR_DEFAUT.oubliSortieHeures).toBe(12)
    expect(SEUILS_PAR_DEFAUT.plafondInventionHeures).toBe(12)
    expect(SEUILS_PAR_DEFAUT.oubliSortieHeures).toBe(SEUILS_PAR_DEFAUT.plafondInventionHeures)
    expect(SEUILS_PAR_DEFAUT.appariementHeures).toBe(16)
    expect(SEUILS_PAR_DEFAUT.appariementHeures).toBeGreaterThanOrEqual(SEUILS_PAR_DEFAUT.oubliSortieHeures)
  })

  it("b) ne casse pas quand la table n'existe pas encore (base non migrée)", async () => {
    const { supabase } = await import('../../lib/supabase')
    supabase.from.mockImplementation(() => {
      throw new Error('relation "encheck_reglages_pointage" does not exist')
    })

    const seuils = await chargerSeuilsPointage('entreprise-1')
    expect(seuils).toMatchObject(SEUILS_PAR_DEFAUT)
  })

  it('c) les réglages de lentreprise écrasent le global, et le mode se lit', async () => {
    const { supabase } = await import('../../lib/supabase')
    supabase.from.mockImplementation(() => ({
      select: () => ({
        or: () =>
          Promise.resolve({
            data: [
              { cle: 'oubli_sortie_heures', valeur: 10, enterprise_id: null },
              { cle: 'oubli_sortie_heures', valeur: 9, enterprise_id: 'ent-1' },
              { cle: 'mode_estimation', valeur: '"actif"', enterprise_id: null },
            ],
            error: null,
          }),
      }),
    }))

    const seuils = await chargerSeuilsPointage('ent-1')
    expect(seuils.oubliSortieHeures).toBe(9)     // l'entreprise gagne
    expect(seuils.modeEstimation).toBe('actif')  // texte JSON déshabillé
    expect(seuils.plafondInventionHeures).toBe(12) // non écrasé → contrat
  })

  it('d) la cohérence est réparée si un réglage est incohérent', async () => {
    const { supabase } = await import('../../lib/supabase')
    supabase.from.mockImplementation(() => ({
      select: () => ({
        or: () => Promise.resolve({
          data: [
            { cle: 'oubli_sortie_heures', valeur: 20, enterprise_id: null },
            { cle: 'appariement_heures', valeur: 4, enterprise_id: null },
            { cle: 'plafond_invention_heures', valeur: 0, enterprise_id: null },
          ],
          error: null,
        }),
      }),
    }))

    const seuils = await chargerSeuilsPointage('ent-2')
    // Un appariement plus court que le seuil d'oubli ferait éclater les journées
    // en deux : on remonte au seuil d'oubli, jamais on ne descends plus bas.
    expect(seuils.appariementHeures).toBe(20)
    // Un plafond à 0 signifierait « on ninvente rien du tout » : interdit,
    // on retombe sur le contrat (12 h) plutôt que de geler la clôture.
    expect(seuils.plafondInventionHeures).toBe(12)
  })
})

describe('2. Fenêtre circulaire — le piège de minuit (§5, Niveau 2)', () => {
  it('compare 23:30 et 00:30 à 60 minutes, pas 1410', () => {
    expect(distanceCirculaireMinutes(23 * 60 + 30, 30)).toBe(60)
    expect(dansLaFenetre('23:30', '00:30', 90)).toBe(true)
  })

  it('garde la borne symétrique : 90 min = dans, 91 min = hors', () => {
    expect(distanceCirculaireMinutes(0, 90)).toBe(90)
    expect(dansLaFenetre(0, 90, 90)).toBe(true)
    expect(dansLaFenetre(0, 91, 90)).toBe(false)
  })

  it('lit les formats réels de la base (HH:MM:SS, Date, minutes)', () => {
    expect(minutesDuJour('22:15:00')).toBe(22 * 60 + 15)
    expect(minutesDuJour(new Date(2026, 9, 12, 22, 15))).toBe(22 * 60 + 15)
    expect(minutesDuJour(null)).toBeNull()
    expect(minutesDuJour('pas une heure')).toBeNull()
    expect(distanceCirculaireMinutes(null, 60)).toBeNull()
  })

  it('ne renvoie jamais une distance supérieure à un demi-tour', () => {
    for (let a = 0; a < JOUR_MINUTES; a += 37) {
      for (let b = 0; b < JOUR_MINUTES; b += 53) {
        const d = distanceCirculaireMinutes(a, b)
        expect(d).toBeGreaterThanOrEqual(0)
        expect(d).toBeLessThanOrEqual(720)
        expect(d).toBe(distanceCirculaireMinutes(b, a)) // symétrie
      }
    }
  })
})

describe('3. Garde-fous dune cible estimée (§4.3)', () => {
  const entree = Date.parse('2026-10-12T07:00:00.000Z') // 08:00 à Cotonou
  const apres = entree + 24 * 3600000

  it('refuse une cible avant lentrée', () => {
    expect(validerCibleEstimation(entree, entree - 1000, SEUILS_PAR_DEFAUT, apres).motif)
      .toBe('cible_avant_entree')
  })

  it('refuse une session plus courte que la durée minimale (1 minute = doublon)', () => {
    expect(validerCibleEstimation(entree, entree + 60000, SEUILS_PAR_DEFAUT, apres).motif)
      .toBe('session_trop_courte')
  })

  it('plafonne à `plafondInventionHeures` au lieu de refuser (12 h, pas 14)', () => {
    const r = validerCibleEstimation(entree, entree + 20 * 3600000, SEUILS_PAR_DEFAUT, apres)
    expect(r.ok).toBe(true)
    expect(r.plafonnee).toBe(true)
    expect(r.minutes).toBe(12 * 60)
  })

  it('refuse une cible dans le futur : on ne facture pas une heure pas encore sonnée', () => {
    const maintenant = entree + 3600000
    const r = validerCibleEstimation(entree, maintenant + 7200000, SEUILS_PAR_DEFAUT, maintenant)
    expect(r.ok).toBe(false)
    expect(r.motif).toBe('cible_dans_le_futur')
  })
})

describe('4. Cascade à 5 niveaux (Niveau 1 → 5)', () => {
  beforeEach(() => setActiveTimezone('Africa/Porto-Novo'))
  afterEach(() => resetActiveTimezone())

  const REF = '2026-10-20T10:00:00.000Z' // « maintenant » figé, pour un test déterministe

  it('Niveau 1 : horaire personnel explicite, tracé comme niveau 1', () => {
    const out = calculerSortieAutoClose('2026-10-12T07:00:00.000Z', {
      plan: { start_time: '08:00:00', end_time: '17:00:00' },
      estimation: { heure_sortie: '19:30:00' }, // présent mais NON utilisé
      referenceNow: REF,
    })
    expect(out.toISOString()).toBe('2026-10-12T16:00:00.000Z') // 17:00 locales
    expect(out.autoCloseNiveau).toBe(1)
  })

  it('Niveau 2 : sans horaire personnel, cest lapprentissage qui passe AVANT le défaut', () => {
    // C'est le trou n°1 de l'audit : l'ancienne version saissait la grille par
    // défaut dès quelle existait, donc le Niveau 2 ne servidorait jamais.
    const out = calculerSortieAutoClose('2026-10-12T07:00:00.000Z', {
      plan: null,
      estimation: { heure_sortie: '18:15:00' },
      planDefaut: { start_time: '08:00:00', end_time: '17:00:00' },
      referenceNow: REF,
    })
    expect(out.toISOString()).toBe('2026-10-12T17:15:00.000Z') // 18:15 locales
    expect(out.autoCloseNiveau).toBe(2)
  })

  it('Niveau 3 : grille par défaut seulement si aucun étage au-dessus', () => {
    const out = calculerSortieAutoClose('2026-10-12T07:00:00.000Z', {
      plan: null,
      planDefaut: { start_time: '08:00:00', end_time: '16:30:00' },
      referenceNow: REF,
    })
    expect(out.toISOString()).toBe('2026-10-12T15:30:00.000Z') // 16:30 locales
    expect(out.autoCloseNiveau).toBe(3)
  })

  it('Niveau 4 : auto_close_time + grâce de lentreprise', () => {
    const out = calculerSortieAutoClose('2026-10-12T07:00:00.000Z', {
      plan: null,
      enterpriseCfg: {
        autoCloseEnabled: true,
        autoCloseTime: '19:00:00',
        autoCloseGraceMinutes: 15,
        timezone: 'Africa/Porto-Novo',
      },
      referenceNow: REF,
    })
    expect(out.toISOString()).toBe('2026-10-12T18:15:00.000Z') // 19:15 locales
    expect(out.autoCloseNiveau).toBe(4)
  })

  it('Niveau 5 : plus rien de connu → entrée + 8 h (et PAS 23:59)', () => {
    const out = calculerSortieAutoClose('2026-10-12T07:00:00.000Z', {
      plan: null,
      enterpriseCfg: { autoCloseEnabled: false },
      referenceNow: REF,
    })
    expect(out.toISOString()).toBe('2026-10-12T15:00:00.000Z')
    expect(out.autoCloseNiveau).toBe(5)
  })

  it('pas de grille fantôme : une entreprise sans grille répond niveau 5', () => {
    // L'ancienne migration inventait une grille « 08:00-17:00 » quand aucune
    // n'existait : des dizaines de journées ont été clôturées sur un horaire
    // que personne navait choisi. Vérifié dans le SQL, et ici côté app.
    const out = calculerSortieAutoClose('2026-10-12T07:00:00.000Z', {
      plan: null,
      planDefaut: null,
      enterpriseCfg: { autoCloseEnabled: true, autoCloseTime: null },
      referenceNow: REF,
    })
    expect(out.autoCloseNiveau).toBe(5)
    expect(out.toISOString()).toBe('2026-10-12T15:00:00.000Z')
  })

  it('grille de JOUR sur entrée de NUIT : on descend, on ne clôt pas à une heure déjà passée', () => {
    // Entrée 21:00 locales (20:00Z), grille 08:00→17:00 : la fin prévue est
    // DÉJÀ passée. L'ancien code renvoyait 17:00… avant l'entrée, donc 0, puis
    // plafonnait n'importe comment. Maintenant : Niveau 5.
    const out = calculerSortieAutoClose('2026-10-12T20:00:00.000Z', {
      plan: { start_time: '08:00:00', end_time: '17:00:00' },
      referenceNow: '2026-10-13T10:00:00.000Z',
    })
    expect(out.autoCloseNiveau).toBe(5)
    expect(out.toISOString()).toBe('2026-10-13T04:00:00.000Z') // 21:00 + 8 h = 05:00 J+1
  })

  it('plafond : 12 h inventées maximum (et plus 14 h)', () => {
    const out = calculerSortieAutoClose('2026-10-12T07:00:00.000Z', {
      plan: { start_time: '08:00:00', end_time: '23:59:00' }, // 16 h de garde annoncées
      referenceNow: REF,
    })
    expect(out.toISOString()).toBe('2026-10-12T19:00:00.000Z') // +12 h, pas +16
  })

  it('jamais dans le futur : journée en cours = arrêté à « maintenant »', () => {
    const out = calculerSortieAutoClose('2026-10-12T07:00:00.000Z', {
      plan: null,
      referenceNow: '2026-10-12T09:00:00.000Z', // seulement 2 h après lentrée
    })
    expect(out.toISOString()).toBe('2026-10-12T09:00:00.000Z')
  })

  it('seuils lus depuis la base : le plafond de lentreprise change le résultat', () => {
    const out = calculerSortieAutoClose('2026-10-12T07:00:00.000Z', {
      plan: { start_time: '08:00:00', end_time: '23:00:00' },
      seuils: { ...SEUILS_PAR_DEFAUT, plafondInventionHeures: 6 },
      referenceNow: REF,
    })
    expect(out.toISOString()).toBe('2026-10-12T13:00:00.000Z') // +6 h
  })
})

describe('5. Doctrine §4.1 — ce qui est payable, ce qui ne lest pas', () => {
  beforeEach(() => setActiveTimezone('Africa/Porto-Novo'))
  afterEach(() => resetActiveTimezone())

  it('estimation non validée → exclue', () => {
    expect(estEstimationNonValidee({ is_auto_closed: true })).toBe(true)
    expect(estEstimationNonValidee({ is_auto_closed: 'true' })).toBe(true) // texte Postgres
  })

  it('estimation validée par un humain → payable', () => {
    expect(estEstimationNonValidee({ is_auto_closed: true, estimation_validee_le: '2026-10-13T08:00:00Z' }))
      .toBe(false)
  })

  it('estimation écartée puis remplacée par un vrai badge → jamais payable, jamais supprimée', () => {
    const remplacee = { is_auto_closed: true, estimation_remplacee_le: '2026-10-12T22:01:00Z' }
    expect(estEstimationNonValidee(remplacee)).toBe(true)
    expect(estEstimationRemplacee(remplacee)).toBe(true)
  })

  it('badge réel → payable (le filtre ne touche pas ce qui na pas été inventé)', () => {
    expect(estEstimationNonValidee({ is_auto_closed: false, method: 'qr_code' })).toBe(false)
    expect(filtrerPointagesPayables([
      { id: 'a', is_auto_closed: false },
      { id: 'b', is_auto_closed: true },
      { id: 'c', anomalie: 'rebond_qr' },
    ]).map((x) => x.id)).toEqual(['a'])
  })

  it('libellés lisibles pour un humain, pas des booléens', () => {
    expect(etiquetteEstimation({ is_auto_closed: true })).toBe('⏳ présumée — non payée')
    expect(etiquetteEstimation({ is_auto_closed: true, estimation_validee_le: 'x' })).toBe('présumée, validée')
    expect(etiquetteEstimation({ is_auto_closed: true, estimation_remplacee_le: 'x' }))
      .toBe('remplacée par un pointage réel')
    expect(etiquetteEstimation({ is_auto_closed: false })).toBe('')
    expect(estRebondNeutralise({ anomalie: 'rebond_qr' })).toBe(true)
  })

  it('sur des données réalistes de double scan, total = séance réelle', () => {
    // 06:32:20 → 06:32:32 = double scan QR. Il ne doit PAS fermer la session,
    // et il ne doit PAS non plus être supprimé de la base (avant : `DELETE`).
    const rows = [
      { check_type: 'in', check_time: '2026-10-12T05:32:20.000Z' },
      { check_type: 'out', check_time: '2026-10-12T05:32:32.000Z' },
      { check_type: 'out', check_time: '2026-10-12T15:00:00.000Z' },
    ]
    const res = resoudrePointagesJournee(rows, '2026-10-12', { seuils: SEUILS_PAR_DEFAUT })
    expect(res.totalSecondes).toBe(9 * 3600 + 27 * 60 + 40) // 05:32:20 → 15:00:00
    expect(res.validPairs.length).toBe(1)
    // Le double scan reste VISIBLE (audit), il ne ferme simplement rien.
    expect(res.attendances.length).toBe(3)
  })
})
