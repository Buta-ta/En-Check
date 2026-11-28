import { describe, it, expect } from 'vitest'
import {
  agregerParSemaine,
  evaluerSeuilsHebdo,
  messageDepassement,
} from '../plafondHebdomadaire'
import {
  RAISONS_INDISPONIBLE,
  pourquoiControleIndisponible,
} from '../../lib/controleDisponible'
import { __internal } from '../hoursCalculator'

const { buildDaySummariesStrict } = __internal
const H = (h) => h * 3600

// ─────────────────────────────────────────────────────────────────────────────
//  LES QUATRE BOUTS DU CONTRÔLE HEBDOMADAIRE
//
//  Quatre questions posées le 24/10/2026, quatre réponses vérifiées ici.
//  Chacune décrit un cas où le moteur parlait plus vite qu'il ne savait.
//
//    1. LE DIMANCHE — une semaine n'est pas finie tant que son dernier jour
//       n'est pas fini (bascule + fuseau), pas à minuit sonnant ;
//    2. PLUSIEURS SEMAINES — quand deux semaines disent deux choses, chacune
//       doit être NOMMÉE, et une semaine passée mal couverte n'est pas
//       « en cours » ;
//    3. LE SEUIL QUI DÉCLENCHE — l'alerte part du seuil choisi, pas du second
//       niveau ; le chiffre affiché et le seuil nommé parlent du même barème ;
//    4. LA GARDE DE NUIT — la même nuit ne change pas selon la fenêtre, et une
//       sortie estimée ne se paie pas comme une sortie réelle.
//
//  ⚠️ Toutes les valeurs (8 h, 40 h, 48 h, 11 h) sont FICTIVES. Aucune n'est
//  une règle légale, aucune ne vient d'une entreprise réelle.
// ─────────────────────────────────────────────────────────────────────────────

const semainePleine = (heuresParJour) =>
  Object.fromEntries(
    ['2026-10-19', '2026-10-20', '2026-10-21', '2026-10-22', '2026-10-23', '2026-10-24', '2026-10-25']
      .map((d) => [d, H(heuresParJour)]),
  )

// ─────────────────────────────────────────────────────────────────────────────
//  1. LE DIMANCHE
// ─────────────────────────────────────────────────────────────────────────────
describe('☀️ 1. Le dimanche — la semaine n’est pas finie à minuit', () => {
  it('un dimanche à 10 h, six jours sur sept sont échus', () => {
    const semaines = agregerParSemaine({
      secondesParJour: semainePleine(8),
      debut: '2026-10-19',
      fin: '2026-10-25',
      aujourdHui: '2026-10-25',
      jourEnCours: '2026-10-25', // la journée du dimanche n'est pas close
    })
    expect(semaines[0].joursEchues).toBe(6)
  })

  it('et une semaine sous le seuil n’est pas déclarée « sans dépassement »', () => {
    //  6 × 8 h = 48 h, sous un seuil de 56 h : le moteur dirait « normal » si la
    //  journée du dimanche était comptée comme révolue. Elle ne l'est pas.
    const semaines = agregerParSemaine({
      secondesParJour: semainePleine(8),
      debut: '2026-10-19',
      fin: '2026-10-25',
      aujourdHui: '2026-10-25',
      jourEnCours: '2026-10-25',
    })
    const evaluation = evaluerSeuilsHebdo({ semaines, seuil: 56, source: 'entreprise' })
    expect(evaluation.semaines[0].partielle).toBe(true)
    expect(evaluation.semaines[0].niveau).toBe('non_evalue')
  })

  it('le lundi, la même semaine est révolue et redevient évaluable', () => {
    //  Ce que l'on veut : la semaine se ferme quand elle est FINIE, pas avant,
    //  et pas indéfiniment.
    const semaines = agregerParSemaine({
      secondesParJour: semainePleine(8),
      debut: '2026-10-19',
      fin: '2026-10-25',
      aujourdHui: '2026-10-26',
      jourEnCours: '2026-10-26', // c'est la semaine SUIVANTE qui est en cours
    })
    expect(semaines[0].joursEchues).toBe(7)
    const evaluation = evaluerSeuilsHebdo({ semaines, seuil: 48, source: 'entreprise' })
    expect(evaluation.semaines[0].partielle).toBe(false)
  })

  it('un dépassement déjà constaté le dimanche reste prononcé', () => {
    //  La correction ne doit pas rendre muette une alerte vraie : 7 × 8 h = 56 h.
    const semaines = agregerParSemaine({
      secondesParJour: semainePleine(8),
      debut: '2026-10-19',
      fin: '2026-10-25',
      aujourdHui: '2026-10-24',
      jourEnCours: '2026-10-24',
    })
    const evaluation = evaluerSeuilsHebdo({ semaines, seuil: 48, source: 'entreprise' })
    expect(evaluation.semaines[0].depasse).toBe(true)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
//  2. PLUSIEURS SEMAINES, PLUSIEURS VÉRITÉS
// ─────────────────────────────────────────────────────────────────────────────
describe('🗓️ 2. Plusieurs semaines — chacune est nommée', () => {
  const deuxSemaines = () => ({
    disponible: true,
    seuil: 40,
    source: 'entreprise',
    aujourd_hui: '2026-10-24',
    semaines: [
      //  Celle-ci a dépassé : la carte d'alerte parle d'elle.
      { debut: '2026-10-05', fin: '2026-10-11', heures: 50, depasse: true, joursEchues: 7, a_venir: false },
      //  Celle-là n'a pas commencé : la ligne parle d'elle, et seulement d'elle.
      { debut: '2026-10-26', fin: '2026-11-01', heures: 0, depasse: false, joursEchues: 0, a_venir: true, partielle: true },
    ],
  })

  it('la ligne nomme la semaine à venir au lieu de dire « cette semaine »', () => {
    const etat = pourquoiControleIndisponible(deuxSemaines())
    expect(etat).not.toBeNull()
    //  Sans le nom, le message semble relativiser l'alerte affichée à côté.
    expect(etat.raison).toMatch(/26 oct\./)
    expect(etat.raison).toMatch(/pas encore commencé/i)
  })

  it('le dépassement constaté n’est ni masqué ni relativisé', () => {
    const etat = pourquoiControleIndisponible(deuxSemaines())
    //  Le mot « dépassement » n'apparaît pas dans la ligne : elle ne parle que
    //  de la semaine non contrôlée. La carte, elle, garde son message.
    expect(etat.raison.toLowerCase()).not.toContain('conforme')
    expect(etat.raison.toLowerCase()).not.toContain('légal')
  })

  it('une semaine PASSÉE mal couverte n’est pas décrite comme « en cours »', () => {
    //  Ici la semaine est derrière nous, mais la fenêtre ne la couvre qu'en
    //  partie : attendre un verdict qui ne viendra jamais serait un mensonge.
    const etat = pourquoiControleIndisponible({
      disponible: true,
      seuil: 40,
      source: 'entreprise',
      aujourd_hui: '2026-11-20',
      semaines: [
        { debut: '2026-10-05', fin: '2026-10-11', heures: 10, depasse: false, joursEchues: 3, a_venir: false, partielle: true },
      ],
    })
    expect(etat).not.toBeNull()
    expect(etat.raison).toMatch(/partiellement/i)
    expect(etat.raison).not.toMatch(/n’est pas terminée/i)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
//  3. LE SEUIL QUI DÉCLENCHE
// ─────────────────────────────────────────────────────────────────────────────
describe('⚖️ 3. Le seuil d’alerte déclenche, le second niveau qualifie', () => {
  const semaineDe = (heures) => [{
    debut: '2026-10-05', fin: '2026-10-11',
    secondes: H(heures), joursDansLaPeriode: 7, joursEchues: 7,
  }]

  it('45 h déclenchent l’alerte au seuil de 40 h', () => {
    //  Avant : rien. Le déclenchement se mesurait au maximum des deux seuils
    //  (48 h), donc une entreprise ayant choisi 40 h ne voyait jamais 45 h.
    const evaluation = evaluerSeuilsHebdo({
      semaines: semaineDe(45), seuil: 40, seuilMajeur: 48, source: 'entreprise',
    })
    expect(evaluation.semaines[0].depasse).toBe(true)
    expect(evaluation.semaines[0].depassement_heures).toBe(5)
    expect(evaluation.semaines[0].depassement_niveau_haut_heures).toBe(0)
  })

  it('le message nomme le seuil de 40 h et non celui de 48 h', () => {
    const evaluation = evaluerSeuilsHebdo({
      semaines: semaineDe(45), seuil: 40, seuilMajeur: 48, source: 'entreprise',
    })
    const message = messageDepassement(evaluation)
    expect(message).toContain('40 h')
    expect(message).not.toContain('48 h') // aucun second niveau franchi
  })

  it('50 h : 10 h au-delà du seuil, dont 2 h au second niveau', () => {
    //  Le chiffre affiché et le seuil nommé parlent enfin du même barème.
    const evaluation = evaluerSeuilsHebdo({
      semaines: semaineDe(50), seuil: 40, seuilMajeur: 48, source: 'entreprise',
    })
    expect(evaluation.semaines[0].depassement_heures).toBe(10)
    expect(evaluation.semaines[0].depassement_niveau_haut_heures).toBe(2)
    const message = messageDepassement(evaluation)
    expect(message).toContain('40 h')
    expect(message).toContain('second niveau')
  })

  it('sans second niveau configuré, la mention ne s’invente pas', () => {
    const evaluation = evaluerSeuilsHebdo({
      semaines: semaineDe(50), seuil: 40, seuilMajeur: null, source: 'entreprise',
    })
    expect(evaluation.semaines[0].depassement_heures).toBe(10)
    expect(messageDepassement(evaluation)).not.toContain('second niveau')
  })

  it('aucun message ne contient le mot « légal »', () => {
    for (const majeur of [null, 48]) {
      const evaluation = evaluerSeuilsHebdo({
        semaines: semaineDe(62), seuil: 40, seuilMajeur: majeur, source: 'entreprise',
      })
      expect(messageDepassement(evaluation).toLowerCase()).not.toContain('légal')
    }
  })
})

// ─────────────────────────────────────────────────────────────────────────────
//  4. LA GARDE DE NUIT EN LIMITE DE PÉRIODE
// ─────────────────────────────────────────────────────────────────────────────
describe('🌙 4. Une garde ne change pas de valeur selon la fenêtre', () => {
  const pointage = (iso, type) => ({
    id: `${iso}-${type}`, check_time: iso, check_type: type,
    is_auto_closed: false, method: 'badge',
  })

  //  Garde : dimanche 04/10 22:00 → lundi 05/10 06:00. 8 h.
  const garde = [
    pointage('2026-10-04T22:00:00.000Z', 'in'),
    pointage('2026-10-05T06:00:00.000Z', 'out'),
  ]

  const resumer = (finMois) => buildDaySummariesStrict({
    attendances: garde, enterpriseCfg: {}, plan: null, plansParJour: null,
    debutAnnee: '2026-01-01', finAnnee: '2026-12-31',
    debutMois: '2026-09-01', finMois,
    basculeMinutes: 0, seuils: null,
  })

  it('la garde vaut 8 h le dimanche 04/10, quelle que soit la fin de fenêtre', () => {
    //  C'est le point signalé : « 50 h ou 46 h selon la fenêtre de lecture ».
    //  Mesuré ici : la fenêtre ne change PAS le total.
    const fenetreLarge = resumer('2026-10-31')['2026-10-04'].totalSeconds
    const fenetreCourte = resumer('2026-10-04')['2026-10-04'].totalSeconds
    expect(fenetreLarge).toBe(H(8))
    expect(fenetreCourte).toBe(H(8))
    expect(fenetreLarge).toBe(fenetreCourte)
  })

  it('la garde est portée par sa journée d’OUVERTURE, pas du lendemain', () => {
    const summaries = resumer('2026-10-31')
    expect(summaries['2026-10-04'].totalSeconds).toBe(H(8))
    //  Le 05/10 ne la recompte pas : la journée n'existe même pas dans les
    //  résumés (aucun pointage ne lui appartient en propre). Absence vaut zéro,
    //  et c'est le comportement voulu : pas de duplication.
    const lendemain = summaries['2026-10-05']
    expect(lendemain ? lendemain.totalSeconds : 0).toBe(0)
  })

  it('une sortie estimée porte le même total, mais elle est MARQUÉE', () => {
    //  Le risque réel du point 4 : rien ne distingue, dans le total, une garde
    //  fermée par un vrai badge d'une garde fermée par une estimation.
    const sansSortie = buildDaySummariesStrict({
      attendances: [pointage('2026-10-04T22:00:00.000Z', 'in')],
      enterpriseCfg: {}, plan: null, plansParJour: null,
      debutAnnee: '2026-01-01', finAnnee: '2026-12-31',
      debutMois: '2026-09-01', finMois: '2026-10-31',
      basculeMinutes: 0, seuils: null,
    })['2026-10-04']

    expect(sansSortie.totalSeconds).toBe(H(8)) // l'estimation produit bien 8 h
    //  …mais elle est déclarée comme telle. C'est ce drapeau qui empêche
    //  l'estimation de gonfler la paie (`estimation_validee_le`).
    expect(sansSortie.hasAutoCloseVirtual).toBe(true)
    expect(sansSortie.hasAutoClosedOut).toBe(true)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
//  Aucune raison affichée ne doit rassurer à tort.
// ─────────────────────────────────────────────────────────────────────────────
describe('🚫 Aucun message ne déguise une absence de verdict en conformité', () => {
  it('aucune raison ne contient « conforme », « légal » ou « aucune anomalie »', () => {
    const texte = Object.values(RAISONS_INDISPONIBLE).join(' ').toLowerCase()
    expect(texte).not.toContain('conforme')
    expect(texte).not.toContain('légal')
    expect(texte).not.toContain('legal')
    expect(texte).not.toContain('aucune anomalie')
  })
})
