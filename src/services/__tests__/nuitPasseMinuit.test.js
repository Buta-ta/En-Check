// ═══════════════════════════════════════════════════════════════════════════
// 🧪 TESTS — UNE SORTIE QUI PASSE MINUIT (incident du 16/10, « Hippo BIYOKILA »)
// ═══════════════════════════════════════════════════════════════════════════
//  CE QUI S'EST PASSÉ, EN CHIFFRES RÉELS
//    entrée pointée : mercredi 15/10 à 08:54:39
//    sortie pointée : jeudi   16/10 à 01:14:00   (badge réel, présent en base,
//                       l'appli de pointage avait bien redemandé un choix)
//    durée réelle   : 16 h 19 min 21 s
//
//    Écran du 15 : « ✓ Présent · Entrée 08:54:39 · Sortie --:--:-- · 0 sec »
//    Écran du 16 : « ✗ Absent · 🚩 Pointage signalé par le serveur »
//
//  LA RÈGLE QUI A MORDU, et qu'aucun test ne couvrait
//    `resoudrePointagesJournee()` ne reliait une sortie à l'entrée ouverte que si
//      `sortie - entrée <= appariementHeures`        (16 h, seuil arbitré, verrouillé
//                                                      par autoCloseEstimation.test.js 1.a)
//    16 h 19 dépasse de **19 minutes**. Et le `else` de cette branche effaçait
//    `openIn`/`openDay` : le bloc « oubli de dépointage », qui exige
//    `openDay === selectedDate`, ne se déclenchait donc plus non plus. Résultat : une
//    journée ni fermée par un badge, ni fermée par une estimation — ouverte à vie,
//    à 0 seconde.
//
//  L'ARBITRAGE DU 16/10/2026 (cas n°2) — CE QUI A CHANGÉ, ET POURQUOI
//    Ce fichier a d'abord écrit l'ancien comportement. L'arbitrage n°2 l'a
//    changé VOLONTAIREMENT (règle R2, « garde de nuit ») :
//      · une sortie RÉELLE pointée avant 06:00 le lendemain appartient à la
//        garde de la veille, même au-delà de la tolérance d'appariement,
//        dans la limite de `gardeMaxHeures` (22 h, seuil DB `garde_max_heures`) ;
//      · deux vrais badges ne se perdent plus — jamais une estimation à la
//        place d'une réalité ;
//      · le `else` n'écrase plus `openIn` (A4) : la journée reste consultable.
//    Les cas 1 et 2 verrouillent donc MAINTENANT la règle arbitrée. Si quelqu'un
//    la change, ce test le dira — il ne bénit pas le comportement, il l'écrit.
//
//  CE QUE VERROUILLE CE FICHIER
//    · la règle R2 arbitrée (cas 1, 2) : la garde de 16 h 19 se ferme sur le
//      BADGE RÉEL, et rien n'est inventé ;
//    · qu'un plafond, ça garde : au-delà de `gardeMaxHeures` (22 h), même en
//      pleine nuit, on n'apparie plus (cas 2b) ;
//    · que la règle porte sur le CRÉNEAU horaire : une sortie à 07:00 n'est pas
//      une fin de garde, même dans la fenêtre (cas 2c) ;
//    · qu'un relevé de seuil plus large (override entreprise à 20 h,
//      `supabase/outils-sql/regler-appariement-nuit.sql`) referme la journée SUR LE
//      BADGE RÉEL et pas sur une estimation (cas 3) ;
//    · que la nuit ordinaire n'est pas cassée par ce débat (cas 4) ;
//    · qu'un plafond, ça garde : une sortie 36 h après l'entrée ne doit JAMAIS être
//      appariée, même à 20 h (cas 5) ;
//    · qu'une sortie avalée par la veille ne crée pas de journée fantôme le
//      lendemain — et que ce lendemain annonce désormais la FIN DE GARDE DE NUIT
//      (A6) au lieu d'un « ✗ Absent » (cas 6).
//
//  Aucun appel réseau : `../../lib/supabase` est mocké, comme dans le reste de la suite.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

vi.mock('../../lib/supabase', () => ({
  supabase: { from: vi.fn() },
  supabaseEmployee: { from: vi.fn() },
  default: { from: vi.fn() },
}))

import { SEUILS_PAR_DEFAUT } from '../seuilsPointage'
import { __internal } from '../hoursCalculator'
import { setActiveTimezone, resetActiveTimezone } from '../../utils/timezoneUtils'

const { resoudrePointagesJournee } = __internal

// Porto-Novo = UTC+1, sans changement d'heure : les heures du récit sont donc
// écrites avec leur décalage, pas converties en UTC « pour que ça marche ».
const TZ = '+01:00'
const H16 = 58761 // 16 h 19 min 21 s, en secondes — la durée exacte du cas vécu

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

// Les deux badges d'Hippo, tels qu'ils sont en base.
const entree15 = badge('2026-10-15T08:54:39', 'in')
const sortie16 = badge('2026-10-16T01:14:00', 'out', {
  suspect: true,
  suspect_reason: `hors_fenetre:${H16}_seconds`,
})
const LIGNES = [entree15, sortie16]

const seuilsAvec = (sur) => ({ ...SEUILS_PAR_DEFAUT, ...sur })
const J15 = '2026-10-15'
const options = (sur = {}) => ({
  enableAutoClose: false,
  referenceNow: '2026-10-16T09:00:00',
  ...sur,
})

beforeEach(() => setActiveTimezone('Africa/Porto-Novo'))
afterEach(() => resetActiveTimezone())

describe('sortie qui passe minuit — la règle R2 arbitrée (garde de nuit)', () => {
  it('1) la garde de 16 h 19 se ferme sur le BADGE RÉEL (règle R2, arbitrage n°2)', () => {
    const r = resoudrePointagesJournee(LIGNES, J15, {
      ...options(),
      seuils: seuilsAvec({ appariementHeures: 16 }),
    })

    // AVANT l'arbitrage : validPairs vide, « Sortie --:--:-- · 0 sec » (le 15/10).
    // MAINTENANT : la sortie de 01:14 (avant 06:00) est la fin de la garde de la
    // veille — deux vrais badges, jamais une estimation à la place d'une réalité.
    expect(r.validPairs).toHaveLength(1)
    const [paire] = r.validPairs
    expect(paire.in.check_time).toBe(entree15.check_time)
    expect(paire.out.check_time).toBe(sortie16.check_time)
    expect(paire.out.is_auto_closed).toBe(false)          // jamais une invention
    expect(r.totalSecondes).toBe(H16)                     // 16 h 19 min 21 s, exactement
    expect(r.totalSecondesPresumes).toBe(0)
    expect(r.lastOut?.check_time).toBe(sortie16.check_time)
  })

  it('2) avec l’auto-close armé, rien n’est inventé non plus : la journée est fermée', () => {
    const r = resoudrePointagesJournee(LIGNES, J15, {
      ...options(),
      enableAutoClose: true,
      enterpriseCfg: { autoCloseEnabled: true, autoCloseTime: '23:59:00', autoCloseGraceMinutes: 30 },
      seuils: seuilsAvec({ appariementHeures: 16, oubliSortieHeures: 12, plafondInventionHeures: 12 }),
    })

    // Le badge réel ferme la journée : le moteur d'estimation n'a RIEN à faire.
    expect(r.validPairs).toHaveLength(1)
    expect(r.attendances.filter((a) => a.is_auto_closed)).toHaveLength(0)
    expect(r.lastOut?.check_time).toBe(sortie16.check_time)
    expect(r.lastOut?.is_auto_closed).toBe(false)
    expect(r.nonRattachees ?? []).toHaveLength(0)
  })

  it('2b) un plafond reste un plafond : au-delà de gardeMaxHeures (22 h), plus de R2', () => {
    const lignes = [
      badge('2026-10-15T08:00:00', 'in'),
      badge('2026-10-16T06:30:00', 'out'),   // 22 h 30 : en pleine nuit, mais trop long
    ]
    const r = resoudrePointagesJournee(lignes, J15, {
      ...options(),
      seuils: seuilsAvec({ appariementHeures: 16 }),   // gardeMaxHeures = 22 (défaut)
    })
    expect(r.validPairs).toHaveLength(0)
    expect(r.totalSecondes).toBe(0)
  })

  it('2c) la règle porte sur le créneau : une sortie à 07:00 n’est pas une fin de garde', () => {
    const lignes = [
      badge('2026-10-15T08:00:00', 'in'),
      badge('2026-10-16T07:00:00', 'out'),   // 23 h mais à 07:00 : hors créneau < 06:00
    ]
    const r = resoudrePointagesJournee(lignes, J15, {
      ...options(),
      seuils: seuilsAvec({ appariementHeures: 16 }),
    })
    expect(r.validPairs).toHaveLength(0)
  })
})

describe('sortie qui passe minuit — ce que change un relevé de tolérance', () => {
  it('3) à 20 h (override entreprise), la journée se ferme sur le BADGE RÉEL', () => {
    const r = resoudrePointagesJournee(LIGNES, J15, {
      ...options(),
      seuils: seuilsAvec({ appariementHeures: 20 }),
    })

    expect(r.validPairs).toHaveLength(1)
    const [paire] = r.validPairs
    expect(paire.in.check_time).toBe(entree15.check_time)
    expect(paire.out.check_time).toBe(sortie16.check_time)
    expect(paire.out.is_auto_closed).toBe(false)          // pas une invention
    expect(r.totalSecondes).toBe(H16)                     // 16 h 19 min 21 s, exactement
    expect(r.lastOut?.check_time).toBe(sortie16.check_time)
    // La sortie est rattachée au 15 : c’est là qu'elle avait été pointée en réponse
    // à l’entrée, et le badge du 16 cesse d’être un orphelin.
    expect(r.attendances.map((a) => a.check_time)).toEqual([
      entree15.check_time,
      sortie16.check_time,
    ])
  })

  it('4) la nuit ordinaire restait déjà appariable à 16 h (22:00 → 02:00)', () => {
    const lignes = [
      badge('2026-10-15T22:00:00', 'in'),
      badge('2026-10-16T02:00:00', 'out'),
    ]
    const r = resoudrePointagesJournee(lignes, J15, {
      ...options(),
      seuils: seuilsAvec({ appariementHeures: 16 }),
    })
    expect(r.validPairs).toHaveLength(1)
    expect(r.totalSecondes).toBe(4 * 3600)
  })

  it('5) un plafond reste un plafond : 36 h plus tard, même à 20 h, on n’apparie pas', () => {
    const lignes = [
      badge('2026-10-15T08:00:00', 'in'),
      badge('2026-10-17T08:00:00', 'out'),   // deux jours plus tard : ce n'est plus une garde
    ]
    const r = resoudrePointagesJournee(lignes, J15, {
      ...options(),
      seuils: seuilsAvec({ appariementHeures: 20 }),
    })
    expect(r.validPairs).toHaveLength(0)
    expect(r.totalSecondes).toBe(0)
  })

  it('6) le 16 au matin ne devient pas une journée fantôme : la sortie appartient au 15', () => {
    const r = resoudrePointagesJournee(LIGNES, '2026-10-16', {
      ...options(),
      seuils: seuilsAvec({ appariementHeures: 16 }),
    })
    // Aucune entrée le 16 : rien n'est compté au 16. Mais l'écran annonce
    // MAINTENANT (A6) « 🌙 Fin de garde de nuit » — c'est la fin de la veille,
    // pas un employé qui a déserté, et le 🚩 « hors fenêtre » disparaît.
    expect(r.firstIn).toBeNull()
    expect(r.validPairs).toHaveLength(0)
    expect(r.totalSecondes).toBe(0)
    expect(r.nuitRattachee).not.toBeNull()
    expect(r.nuitRattachee?.jourOrigine).toBe('2026-10-15')
    expect(r.nuitRattachee?.heure).toBe(sortie16.check_time)
    expect(r.nuitRattachee?.dureeSecondes).toBe(H16)
  })
})

describe('fenêtre de requête de l’écran — pourquoi le badge est quand même chargé', () => {
  it('7) la page demande J-1 12:00 → J+1 14:00 : la sortie est dans la réponse', () => {
    // Ce test n'a pas de sens « moteur » : il protège une hypothèse. Si quelqu'un
    // réduit la fenêtre de la requête `attendances` de Pointages.jsx à la journée
    // stricte (BETWEEN 00:00 ET 23:59), le cas ci-dessus devient insolvable côté
    // client — la sortie n'arrivera plus jamais dans les lignes, et l'écran ne pourra
    // plus rien rattacher du tout. Les commentaires de la requête (l.842-844)
    // expliquent pourquoi elle est large ; ce test la garde visible.
    const uneJourneeStricte = [entree15]           // la sortie du 16 n'est pas chargée
    const r = resoudrePointagesJournee(uneJourneeStricte, J15, {
      ...options(),
      seuils: seuilsAvec({ appariementHeures: 20 }),
    })
    expect(r.validPairs).toHaveLength(0)
    expect(r.lastOut).toBeNull()
    // La journée ouverte SANS sortie est le cas que l'auto-close sait traiter,
    // lui : la différence entre « pas de sortie » et « sortie non chargée » ne se
    // voit donc que si l'on conserve la fenêtre élargie.
    const avecSortie = resoudrePointagesJournee(LIGNES, J15, {
      ...options(),
      seuils: seuilsAvec({ appariementHeures: 20 }),
    })
    expect(avecSortie.validPairs).toHaveLength(1)
  })
})
