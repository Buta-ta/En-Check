// ═══════════════════════════════════════════════════════════
// FICHE EMPLOYÉ (360°) — la logique pure de /employes/:id
//
// Ce que ces tests défendent :
//  · aucune donnée inventée (ancienneté nulle ≠ « 0 mois ») ;
//  · « absent » seulement après la fin du poste (doctrine P0) ;
//  · jamais de pourcentage sur un échantillon trop mince ;
//  · le fil d'activité trie et regroupe sans rien ajouter.
// ═══════════════════════════════════════════════════════════

import { describe, it, expect } from 'vitest'
import {
  construireFilActivite,
  etatPresenceDuJour,
  joursPointesDuMois,
  joursPrevusDepuisPlans,
  libelleAnciennete,
  libelleJourRelatif,
  listeJoursInclusifs,
  pourcentageSiEchantillon,
  retardDuJour,
  grillePresenceMois,
  libelleJoursSemaine,
  secondesVersHeures,
  rythmePlanning,
  serieBarresMois,
  serieBarresAnnee,
  totalSecondesSerie,
  joursAbsencesPeriode,
  resumerTaches,
  joursAnciennete,
  normaliserTelephone,
  lienWhatsApp,
  lienAppel,
  minutesEntreHeures,
  chipsJoursTravailles,
  serieSalaireAnnee,
  totalSalaireAnnee,
  tendanceSalaire,
  echelleNice,
  abreviationDevise,
  libelleMontant,
  libelleMontantCourt,
} from '../../lib/employee360'

describe('listeJoursInclusifs — itération de dates locales', () => {
  it('couvre le mois, y compris le passage de mois et d’année', () => {
    const jours = listeJoursInclusifs('2026-01-29', '2026-02-02')
    expect(jours).toEqual(['2026-01-29', '2026-01-30', '2026-01-31', '2026-02-01', '2026-02-02'])
  })

  it('janvier→février 2028 (bissextile) et fin d’année', () => {
    expect(listeJoursInclusifs('2028-01-30', '2028-02-01')).toEqual(['2028-01-30', '2028-01-31', '2028-02-01'])
    expect(listeJoursInclusifs('2026-12-30', '2027-01-01')).toEqual(['2026-12-30', '2026-12-31', '2027-01-01'])
  })

  it('un seul jour et entrée vide', () => {
    expect(listeJoursInclusifs('2026-03-15', '2026-03-15')).toEqual(['2026-03-15'])
    expect(listeJoursInclusifs(null, '2026-03-15')).toEqual([])
  })
})

describe('libelleAnciennete — jamais un 0 inventé', () => {
  const ref = new Date('2026-10-15T12:00:00Z')

  it('sans hire_date : null (l’écran dira « non renseignée »)', () => {
    expect(libelleAnciennete(null, ref)).toBeNull()
    expect(libelleAnciennete(undefined, ref)).toBeNull()
  })

  it('moins d’un mois, un mois, plusieurs mois', () => {
    expect(libelleAnciennete('2026-10-02', ref)).toBe('Moins d’un mois')
    expect(libelleAnciennete('2026-09-15', ref)).toBe('1 mois')
    expect(libelleAnciennete('2026-06-15', ref)).toBe('4 mois')
  })

  it('années et restes', () => {
    expect(libelleAnciennete('2025-10-15', ref)).toBe('1 an')
    expect(libelleAnciennete('2024-07-01', ref)).toBe('2 ans et 3 mois')
    expect(libelleAnciennete('2024-10-16', ref)).toBe('1 an et 11 mois')
  })

  it('une embauche future n’est pas une ancienneté', () => {
    expect(libelleAnciennete('2027-01-01', ref)).toBeNull()
  })
})

describe('libelleJourRelatif — les mots du fil d’activité', () => {
  it('aujourd’hui / hier / date courte', () => {
    expect(libelleJourRelatif('2026-10-15', '2026-10-15')).toBe('Aujourd’hui')
    expect(libelleJourRelatif('2026-10-14', '2026-10-15')).toBe('Hier')
    // jeudi 12 novembre 2026
    expect(libelleJourRelatif('2026-11-12', '2026-11-15')).toBe('jeu. 12 nov.')
  })
})

describe('joursPointesDuMois — une entrée fait la journée', () => {
  it('ne compte que les jours avec une entrée, dédoublonnés', () => {
    const atts = [
      { check_time: '2026-10-10T07:05:00Z', check_type: 'in' },
      { check_time: '2026-10-10T16:55:00Z', check_type: 'out' },
      { check_time: '2026-10-11T07:10:00Z', check_type: 'in' },
      { check_time: '2026-10-12T17:00:00Z', check_type: 'out' }, // sortie sans entrée
      { check_time: '2026-09-30T07:00:00Z', check_type: 'in' }, // hors période
    ]
    // Fuseau d’Abidjan/Cotonou : UTC+1 — les heures de jour restent dans le jour.
    expect(joursPointesDuMois(atts, '2026-10-01', '2026-10-31', 'Africa/Porto-Novo')).toEqual(['2026-10-10', '2026-10-11'])
  })

  it('la date se juge dans le fuseau de l’entreprise', () => {
    // 2026-10-15T23:30Z = 00:30 le 16 à Porto-Novo (UTC+1) : c’est le 16 qui compte.
    const atts = [{ check_time: '2026-10-15T23:30:00Z', check_type: 'in' }]
    expect(joursPointesDuMois(atts, '2026-10-01', '2026-10-31', 'Africa/Porto-Novo')).toEqual(['2026-10-16'])
    // Idem en UTC : c’est le 15.
    expect(joursPointesDuMois(atts, '2026-10-01', '2026-10-31', 'UTC')).toEqual(['2026-10-15'])
  })
})

describe('joursPrevusDepuisPlans — l’avenir n’est pas dû', () => {
  const plans = { '2026-10-01': {}, '2026-10-02': {}, '2026-10-06': {}, '2026-10-07': {}, '2026-10-10': {}, '2026-10-20': {} }

  it('ne compte que les jours prévus entre le début et aujourd’hui', () => {
    expect(joursPrevusDepuisPlans(plans, '2026-10-01', '2026-10-31', '2026-10-08')).toBe(4)
  })

  it('un planning nul donne zéro, pas d’erreur', () => {
    expect(joursPrevusDepuisPlans(null, '2026-10-01', '2026-10-31', '2026-10-08')).toBe(0)
    expect(joursPrevusDepuisPlans({}, '2026-10-01', '2026-10-31', '2026-10-08')).toBe(0)
  })
})

describe('pourcentageSiEchantillon — pas de % sur du vent', () => {
  it('sous le seuil : null', () => {
    expect(pourcentageSiEchantillon(1, 2)).toBeNull()
    expect(pourcentageSiEchantillon(14, 14)).toBeNull()
    expect(pourcentageSiEchantillon(0, 0)).toBeNull()
  })

  it('au seuil et au-delà : un pourcentage borné', () => {
    expect(pourcentageSiEchantillon(15, 15)).toBe(100)
    expect(pourcentageSiEchantillon(11, 22)).toBe(50)
  })
})

describe('etatPresenceDuJour — les mots de la maison', () => {
  const entree = { check_time: '2026-10-15T07:12:00Z', check_type: 'in' }
  const sortie = { check_time: '2026-10-15T15:58:00Z', check_type: 'out' }

  it('en pause prime sur tout', () => {
    const etat = etatPresenceDuJour({ firstIn: entree, lastPunch: entree, activePause: { id: 'p1' } })
    expect(etat.state).toBe('en_pause')
    expect(etat.libelle).toBe('En pause')
  })

  it('en poste, puis pointage terminé', () => {
    expect(etatPresenceDuJour({ firstIn: entree, lastPunch: entree }).state).toBe('en_poste')
    expect(etatPresenceDuJour({ firstIn: entree, lastPunch: sortie }).state).toBe('termine')
  })

  it('congé, sans pointage', () => {
    const etat = etatPresenceDuJour({ absenceDuJour: { reason: 'Maternité' } })
    expect(etat.state).toBe('en_conge')
    expect(etat.libelle).toBe('En congé')
  })

  it('P0 : « pas encore pointé » tant que le poste court, « absent » après', () => {
    expect(etatPresenceDuJour({}).state).toBe('non_pointe')
    expect(etatPresenceDuJour({}).libelle).toBe('pas encore pointé')
    expect(etatPresenceDuJour({ finPosteDepassee: true }).state).toBe('absent')
    expect(etatPresenceDuJour({ finPosteDepassee: true }).libelle).toBe('absent')
  })
})

describe('retardDuJour — jugé à l’heure de l’entreprise', () => {
  const plan = { start_time: '08:00:00', end_time: '17:00:00' }

  it('dans la tolérance : pas de retard', () => {
    // 08:10 à Porto-Novo (UTC+1) vs 08:00 + 15 min → pas de retard.
    expect(retardDuJour({ firstIn: { check_time: '2026-10-15T07:10:00Z' }, planDuJour: plan, fuseau: 'Africa/Porto-Novo' })).toBeNull()
  })

  it('au-delà : le dépassement en minutes', () => {
    // 08:23 à Porto-Novo vs 08:00 → 23 min > 15 min.
    expect(retardDuJour({ firstIn: { check_time: '2026-10-15T07:23:00Z' }, planDuJour: plan, fuseau: 'Africa/Porto-Novo' })).toBe(23)
  })

  it('sans plan, service de nuit, ou pas d’entrée : null', () => {
    expect(retardDuJour({ firstIn: { check_time: '2026-10-15T07:23:00Z' }, planDuJour: null, fuseau: 'Africa/Porto-Novo' })).toBeNull()
    expect(retardDuJour({ firstIn: { check_time: '2026-10-15T22:30:00Z' }, planDuJour: { start_time: '22:00:00', end_time: '06:00:00' }, fuseau: 'Africa/Porto-Novo' })).toBeNull()
    expect(retardDuJour({ firstIn: null, planDuJour: plan, fuseau: 'Africa/Porto-Novo' })).toBeNull()
  })
})

describe('construireFilActivite — trié, groupé, sans invention', () => {
  const groupees = construireFilActivite({
    attendances: [
      { id: 'a1', check_time: '2026-10-15T07:12:00Z', check_type: 'in' },
      { id: 'a2', check_time: '2026-10-15T07:30:00Z', check_type: 'out' }, // sortie sans entrée, mais un événement
      { id: 'a3', check_time: '2026-10-14T07:05:00Z', check_type: 'in' },
    ],
    pauses: [
      { id: 'p1', debutISO: '2026-10-15T12:00:00Z', finISO: '2026-10-15T12:45:00Z' },
    ],
    absences: [
      { id: 'ab1', start_date: '2026-10-08', end_date: '2026-10-09', reason: 'Maladie' },
    ],
    dateDuJour: '2026-10-15',
    fuseau: 'Africa/Porto-Novo',
  })

  it('les jours descendent, les étiquettes sont honnêtes', () => {
    expect(groupees.map((g) => g.libelle)).toEqual(['Aujourd’hui', 'Hier', 'jeu. 8 oct.'])
  })

  it('l’ordre dans le jour : le plus récent d’abord', () => {
    expect(groupees[0].entrees.map((e) => e.type)).toEqual(['pause_fin', 'pause_debut', 'sortie', 'entree'])
  })

  it('l’absence porte sa période et un libellé avec motif', () => {
    const absence = groupees[2].entrees[0]
    expect(absence.type).toBe('absence')
    expect(absence.libelle).toBe('Congé (Maladie)')
    expect(absence.periode).toBe('jusqu’au 2026-10-09')
  })

  it('le plafond de 14 événements est respecté', () => {
    const atts = Array.from({ length: 20 }, (_, i) => ({
      id: `x${i}`,
      check_time: `2026-10-${11 + (i % 5)}T0${i % 10}:00:00Z`,
      check_type: 'in',
    }))
    const res = construireFilActivite({ attendances: atts, dateDuJour: '2026-10-15', fuseau: 'UTC' })
    const total = res.reduce((acc, g) => acc + g.entrees.length, 0)
    expect(total).toBe(14)
  })

  it('aucune donnée : aucun groupe, pas de jour inventé', () => {
    expect(construireFilActivite({ dateDuJour: '2026-10-15', fuseau: 'UTC' })).toEqual([])
  })
})

describe('grillePresenceMois — une case par jour, un état par case', () => {
  const plans = { '2026-10-05': {}, '2026-10-06': {}, '2026-10-12': {} }

  it('pointé / prévu / hors planning / à venir', () => {
    const { cases } = grillePresenceMois({
      dateDuJour: '2026-10-15',
      joursPointes: ['2026-10-05', '2026-10-07'],
      plansParJour: plans,
    })
    expect(cases).toHaveLength(31)
    expect(cases.find((c) => c.jour === '2026-10-05').etat).toBe('pointe')
    expect(cases.find((c) => c.jour === '2026-10-06').etat).toBe('prevu')
    expect(cases.find((c) => c.jour === '2026-10-07').etat).toBe('pointe')
    expect(cases.find((c) => c.jour === '2026-10-08').etat).toBe('non_prevu')
    expect(cases.find((c) => c.jour === '2026-10-16').etat).toBe('avenir')
  })

  it('mois court (février 2026) et date nulle', () => {
    expect(grillePresenceMois({ dateDuJour: '2026-02-28', joursPointes: [], plansParJour: {} }).cases).toHaveLength(28)
    expect(grillePresenceMois({ dateDuJour: null, joursPointes: [], plansParJour: {} }).cases).toEqual([])
  })
})


describe('libelleJoursSemaine — les jours travaillés, lisibles', () => {
  it('« du lundi au vendredi », « tous les jours », du lundi au samedi', () => {
    expect(libelleJoursSemaine([1, 2, 3, 4, 5])).toBe('du lundi au vendredi')
    expect(libelleJoursSemaine([1, 2, 3, 4, 5, 6, 7])).toBe('tous les jours')
    expect(libelleJoursSemaine([1, 2, 3, 4, 5, 6])).toBe('du lundi au samedi')
  })

  it('liste nominative sinon, null si rien, tolère le désordre et les valeurs inconnues', () => {
    expect(libelleJoursSemaine([3, 1])).toBe('lundi, mercredi')
    expect(libelleJoursSemaine([0, 9, 'x'])).toBeNull()
    expect(libelleJoursSemaine(null)).toBeNull()
    expect(libelleJoursSemaine('1,2')).toBeNull()
  })
})

describe('secondesVersHeures — le format du moteur', () => {
  it('arrondit et forme « HhMM »', () => {
    expect(secondesVersHeures(0)).toBe('0h00')
    expect(secondesVersHeures(3600)).toBe('1h00')
    expect(secondesVersHeures(8 * 3600 + 5 * 60 + 30)).toBe('8h05')
    expect(secondesVersHeures(-50)).toBe('0h00')
    expect(secondesVersHeures(null)).toBe('0h00')
  })
})

describe('rythmePlanning — le rythme depuis le plan du jour', () => {
  const plan = {
    start_time: '08:00:00', end_time: '17:00:00',
    has_break: true, break_start: '12:30:00', break_end: '13:15:00',
    work_days: [1, 2, 3, 4, 5],
  }

  it('lit la journée, la pause, les jours et la tolérance', () => {
    const r = rythmePlanning({ plan, tolerance: 15 })
    expect(r.defini).toBe(true)
    expect(r.journee).toBe('08:00 → 17:00')
    expect(r.pause).toBe('12:30 – 13:15')
    expect(r.jours).toBe('du lundi au vendredi')
    expect(r.tolerance).toBe(15)
    expect(r.perso).toBe(false)
  })

  it('pas de planning → defini: false (on ne devine pas)', () => {
    expect(rythmePlanning({ plan: null }).defini).toBe(false)
    expect(rythmePlanning({ plan: { start_time: '08:00:00' } }).defini).toBe(false)
  })

  it('sans pause déclarée, « pause: null » ; tolérance nulle ou absente → null', () => {
    const r = rythmePlanning({ plan: { ...plan, has_break: false, break_start: null, break_end: null }, tolerance: 0 })
    expect(r.pause).toBeNull()
    expect(r.tolerance).toBeNull()
  })
})

describe('serieBarresMois / serieBarresAnnee — barres sans invention', () => {
  const P = (iso, heures, pointe = true) => ({ [iso]: { secondes: heures * 3600, pointe } })

  it('mois : un jour par case, jusqu’à aujourd’hui, null sans pointage', () => {
    const serie = serieBarresMois({
      '2026-11-01': { secondes: 8 * 3600, pointe: true },
      '2026-11-02': { secondes: 0, pointe: false },
      '2026-11-03': { secondes: 9.5 * 3600, pointe: true },
    }, '2026-11-03')
    expect(serie).toHaveLength(3)
    expect(serie[0]).toMatchObject({ numero: 1, libelle: '1', heures: 8, estAujourdhui: false })
    expect(serie[1].heures).toBeNull() // jour sans AUCUN pointage : pas de barre
    expect(serie[2]).toMatchObject({ heures: 9.5, estAujourdhui: true })
  })

  it('mois : les jours à venir n’apparaissent pas', () => {
    expect(serieBarresMois({}, '2026-11-15')).toHaveLength(15)
    expect(serieBarresMois({}, '2026-02-10')).toHaveLength(10)
  })

  it('année : 12 mois, total par mois, null si mois sans pointage, aVenir au-delà', () => {
    const serie = serieBarresAnnee({
      '2026-03-10': { secondes: 8 * 3600, pointe: true },
      '2026-03-11': { secondes: 4 * 3600, pointe: true },
      '2026-11-01': { secondes: 6 * 3600, pointe: true },
      '2026-12-01': { secondes: 100 * 3600, pointe: true }, // futur : compté dans le mois, mais aVenir
    }, '2026-11-15')
    expect(serie).toHaveLength(12)
    const mars = serie.find((c) => c.mois === 3)
    expect(mars.heures).toBeCloseTo(12, 5)
    expect(serie.find((c) => c.mois === 6).heures).toBeNull()
    expect(serie.find((c) => c.mois === 11).aVenir).toBe(false)
    expect(serie.find((c) => c.mois === 12).aVenir).toBe(true)
  })

  it('totalSecondesSerie : les null ne comptent pas', () => {
    const serie = serieBarresMois({
      '2026-11-01': { secondes: 8 * 3600, pointe: true },
      '2026-11-02': { secondes: 0, pointe: false },
    }, '2026-11-02')
    expect(totalSecondesSerie(serie)).toBe(8 * 3600)
    expect(totalSecondesSerie([])).toBe(0)
  })
})

describe('joursAbsencesPeriode — jours distincts couverts', () => {
  it('compte les jours du chevauchement avec la période', () => {
    const abs = [{ start_date: '2026-11-05', end_date: '2026-11-07' }]
    expect(joursAbsencesPeriode(abs, '2026-11-01', '2026-11-30')).toBe(3)
    expect(joursAbsencesPeriode(abs, '2026-11-06', '2026-11-30')).toBe(2)
    expect(joursAbsencesPeriode(abs, '2026-11-10', '2026-11-30')).toBe(0)
  })

  it('un jour couvert deux fois (deux congés) ne compte qu’une fois', () => {
    const abs = [
      { start_date: '2026-11-05', end_date: '2026-11-06' },
      { start_date: '2026-11-06', end_date: '2026-11-08' },
    ]
    expect(joursAbsencesPeriode(abs, '2026-11-01', '2026-11-30')).toBe(4)
  })

  it('absence à un seul jour, sans end_date', () => {
    expect(joursAbsencesPeriode([{ start_date: '2026-11-12' }], '2026-11-01', '2026-11-30')).toBe(1)
    expect(joursAbsencesPeriode([], '2026-11-01', '2026-11-30')).toBe(0)
  })
})

describe('resumerTaches — le compte des tâches attribuées', () => {
  const T = (o) => ({ id: o.id, title: o.titre, status: o.statut, due_at: o.due, completed_at: o.termine || null, validated_at: null })

  it('aucune tâche → aucune: true', () => {
    expect(resumerTaches([], '2026-11-15', '2026-11-01').aucune).toBe(true)
  })

  it('en cours = in_progress + paused ; à faire = échéance future non clôturée', () => {
    const taches = [
      T({ id: 1, titre: 'A', statut: 'in_progress', due: '2026-11-20' }),
      T({ id: 2, titre: 'B', statut: 'paused', due: '2026-11-25' }),
      T({ id: 3, titre: 'C', statut: 'assigned', due: '2026-11-22' }),
      T({ id: 4, titre: 'D', statut: 'in_progress', due: '2026-10-01' }), // échéance passée
      T({ id: 5, titre: 'E', statut: 'completed', due: '2026-11-30', termine: '2026-11-10T10:00:00Z' }), // clôturée : hors « à faire »
    ]
    const r = resumerTaches(taches, '2026-11-15', '2026-11-01')
    expect(r.aucune).toBe(false)
    expect(r.enCours).toBe(3) // A (in_progress) + B (paused) + D (in_progress)
    expect(r.aVenirCount).toBe(3)
    expect(r.prochaines.map((t) => t.titre)).toEqual(['A', 'C', 'B']) // triées par échéance
    expect(r.prochaines[0].echeance).toBe('2026-11-20')
  })

  it('terminées : sur la période, via completed_at OU validated_at', () => {
    const taches = [
      { id: 1, title: 'A', status: 'completed', due_at: null, completed_at: '2026-11-10T10:00:00Z', validated_at: null },
      { id: 2, title: 'B', status: 'validated', due_at: null, completed_at: '2026-09-02T10:00:00Z', validated_at: '2026-11-12T10:00:00Z' },
      { id: 3, title: 'C', status: 'validated', due_at: null, completed_at: '2026-09-02T10:00:00Z', validated_at: '2026-09-12T10:00:00Z' },
      { id: 4, title: 'D', status: 'rejected', due_at: null, completed_at: '2026-11-09T10:00:00Z', validated_at: null },
    ]
    expect(resumerTaches(taches, '2026-11-15', '2026-11-01').terminees).toBe(2) // A + B (validation du mois)
  })
})

// ─────────────────────────────────────────────────────────────
// REFONTE BENTO (17/11) — anciennete, contact, salaire, axes
// ─────────────────────────────────────────────────────────────

describe('joursAnciennete — des jours entiers, jamais negatifs', () => {
  it('compte les jours depuis hire_date', () => {
    expect(joursAnciennete('2026-10-15', new Date('2026-10-18T12:00:00Z'))).toBe(3)
  })

  it('null si hire_date inconnu ou invalide', () => {
    expect(joursAnciennete(null, new Date('2026-10-18T12:00:00Z'))).toBeNull()
    expect(joursAnciennete('demain', new Date('2026-10-18T12:00:00Z'))).toBeNull()
  })

  it('null si hire_date apres la reference (jamais de jour negatif)', () => {
    expect(joursAnciennete('2026-11-01', new Date('2026-10-18T12:00:00Z'))).toBeNull()
  })
})

describe('normaliserTelephone / liens de contact', () => {
  it('garde le signe plus et les chiffres', () => {
    expect(normaliserTelephone('+229 97 48 21 33')).toBe('+22997482133')
    expect(normaliserTelephone('22997482133')).toBe('22997482133')
    expect(normaliserTelephone('097482133 ')).toBe('097482133')
  })

  it('null sans numero exploitable', () => {
    expect(normaliserTelephone('')).toBeNull()
    expect(normaliserTelephone(null)).toBeNull()
    expect(normaliserTelephone('+123')).toBeNull()
  })

  it('construit wa.me sans le signe plus', () => {
    expect(lienWhatsApp('+229 97 48 21 33')).toBe('https://wa.me/22997482133')
    expect(lienWhatsApp('pas un numero')).toBeNull()
  })

  it('construit le lien tel: avec le signe plus', () => {
    expect(lienAppel('+229 97 48 21 33')).toBe('tel:+22997482133')
    expect(lienAppel(null)).toBeNull()
  })
})

describe('minutesEntreHeures — la pause, meme apres minuit', () => {
  it('compte les minutes d une coupure classique', () => {
    expect(minutesEntreHeures('12:30', '13:15')).toBe(45)
  })

  it('franchit minuit sans negatif', () => {
    expect(minutesEntreHeures('23:30', '00:30')).toBe(60)
  })

  it('null sur des heures illisibles ou duree nulle', () => {
    expect(minutesEntreHeures('12:30', '12:30')).toBeNull()
    expect(minutesEntreHeures('xx', '12:30')).toBeNull()
  })
})

describe('chipsJoursTravailles — work_days en chips lues', () => {
  it('transforme [1,2,3,4,5] en Lun..Ven', () => {
    expect(chipsJoursTravailles([1, 2, 3, 4, 5])).toEqual(['Lun', 'Mar', 'Mer', 'Jeu', 'Ven'])
  })

  it('trie, dedouble, ignore le hors-borne', () => {
    expect(chipsJoursTravailles([5, 1, 1, 9, 0])).toEqual(['Lun', 'Ven'])
    expect(chipsJoursTravailles(null)).toEqual([])
  })
})

describe('serieSalaireAnnee — un bulletin par mois, jamais de zero invente', () => {
  const bulletins = [
    { period_start: '2026-01-01', period_end: '2026-01-31', gross_salary: 150000 },
    { period_start: '2026-02-01', period_end: '2026-02-28', gross_salary: 155000 },
    { period_start: '2026-11-01', period_end: '2026-11-30', gross_salary: 160000 },
  ]

  it('aligne les 12 mois sur la date du jour', () => {
    const serie = serieSalaireAnnee(bulletins, '2026-11-15')
    expect(serie).toHaveLength(12)
    expect(serie[0]).toMatchObject({ mois: 1, montant: 150000, aVenir: false })
    expect(serie[11].montant).toBeNull()
    expect(serie[11].aVenir).toBe(true)
  })

  it('un mois sans bulletin vaut null (pas un 0)', () => {
    const serie = serieSalaireAnnee(bulletins, '2026-11-15')
    expect(serie[2].montant).toBeNull() // mars
    expect(serie[10].montant).toBe(160000) // novembre
  })

  it('plusieurs bulletins sur un mois : le plus recent gagne', () => {
    const serie = serieSalaireAnnee([
      { period_start: '2026-03-01', period_end: '2026-03-31', gross_salary: 100 },
      { period_start: '2026-03-01', period_end: '2026-03-15', gross_salary: 200 },
    ], '2026-11-15')
    expect(serie[2].montant).toBe(100)
  })

  it('ignore les bulletins des autres annees', () => {
    const serie = serieSalaireAnnee(
      [{ period_start: '2025-11-01', period_end: '2025-11-30', gross_salary: 999999 }],
      '2026-11-15')
    expect(serie.every((c) => c.montant === null)).toBe(true)
  })
})

describe('totalSalaireAnnee — le brut de l annee, ou null', () => {
  it('somme les bruts de l annee en cours', () => {
    expect(totalSalaireAnnee([
      { period_start: '2026-01-01', period_end: '2026-01-31', gross_salary: 100000 },
      { period_start: '2026-02-01', period_end: '2026-02-28', gross_salary: 155000 },
    ], '2026-11-15')).toBe(255000)
  })

  it('null sans bulletin (jamais un 0 qui ferait foi)', () => {
    expect(totalSalaireAnnee([], '2026-11-15')).toBeNull()
    expect(totalSalaireAnnee(
      [{ period_start: '2025-01-01', period_end: '2025-01-31', gross_salary: 100000 }],
      '2026-11-15')).toBeNull()
  })
})

describe('tendanceSalaire — deux mois COMPLETS seulement', () => {
  it('compare le dernier mois complet au precedent', () => {
    const t = tendanceSalaire([
      { period_start: '2026-09-01', period_end: '2026-09-30', gross_salary: 100000 },
      { period_start: '2026-10-01', period_end: '2026-10-31', gross_salary: 112000 },
    ], '2026-11-15')
    expect(t).toMatchObject({ pct: 12, comparaison: 'oct. vs sept.' })
  })

  it('null si un des deux mois manque', () => {
    expect(tendanceSalaire(
      [{ period_start: '2026-10-01', period_end: '2026-10-31', gross_salary: 100000 }],
      '2026-11-15')).toBeNull()
  })

  it('null si le mois de base est nul (pas de division par zero)', () => {
    expect(tendanceSalaire([
      { period_start: '2026-09-01', period_end: '2026-09-30', gross_salary: 0 },
      { period_start: '2026-10-01', period_end: '2026-10-31', gross_salary: 100000 },
    ], '2026-11-15')).toBeNull()
  })

  it('decembre en reference : compare novembre et octobre de l annee courante', () => {
    const t = tendanceSalaire([
      { period_start: '2026-10-01', period_end: '2026-10-31', gross_salary: 100000 },
      { period_start: '2026-11-01', period_end: '2026-11-30', gross_salary: 80000 },
    ], '2026-12-10')
    expect(t.pct).toBe(-20)
  })
})

describe('echelleNice — un plafond lisible qui contient le pic', () => {
  it('monte a 200 pour un pic a 175', () => {
    const e = echelleNice(175, 4)
    expect(e.plafond).toBe(200)
    expect(e.graduations).toEqual([0, 50, 100, 150, 200])
    expect(e.plafond).toBeGreaterThanOrEqual(175)
  })

  it('monte a 200K pour un pic a 155000', () => {
    const e = echelleNice(155000, 4)
    expect(e.plafond).toBe(200000)
    expect(e.graduations[4]).toBe(200000)
  })

  it('reste lisible sur les petits nombres', () => {
    const e = echelleNice(3, 4)
    expect(e.plafond).toBeGreaterThanOrEqual(3)
    expect(e.graduations).toHaveLength(5)
  })

  it('sans pic : une echelle de secours, pas un zero diviseur', () => {
    const e = echelleNice(0, 4)
    expect(e.plafond).toBeGreaterThan(0)
    expect(e.graduations).toHaveLength(5)
  })
})

describe('libelles de montants — l unite sur chaque chiffre (P0)', () => {
  it('libelleMontant garde la devise en clair', () => {
    // fr-FR separe par une espace etroite insécable (U+202F) : on
    // compare au format du moteur lui-meme, pas a une espace dure.
    const n1745 = new Intl.NumberFormat('fr-FR').format(1745000)
    const n155 = new Intl.NumberFormat('fr-FR').format(155000)
    expect(libelleMontant(1745000, 'FCFA')).toBe(`${n1745} FCFA`)
    expect(libelleMontant(155000, 'EUR')).toBe(`${n155} EUR`)
    expect(libelleMontant(123)).toBe('123')
    expect(libelleMontant('nan', 'FCFA')).toBe('—')
  })

  it('libelleMontantCourt abridge pour l axe', () => {
    expect(libelleMontantCourt(150000)).toBe('150K')
    expect(libelleMontantCourt(50000)).toBe('50K')
    expect(libelleMontantCourt(1250)).toBe('1,3K')
    expect(libelleMontantCourt(900)).toBe('900')
  })

  it('abreviationDevise raccourcit les couronnes de la region', () => {
    expect(abreviationDevise('FCFA')).toBe('F')
    expect(abreviationDevise('XOF')).toBe('F')
    expect(abreviationDevise('EUR')).toBe('€')
    expect(abreviationDevise('MAD')).toBe('DH')
    expect(abreviationDevise('BRL')).toBe('BRL')
  })
})

describe('rythmePlanning — chips de jours + duree de pause', () => {
  const plan = {
    start_time: '08:00:00', end_time: '17:00:00',
    work_days: [1, 2, 3, 4, 5],
    has_break: true, break_start: '12:30:00', break_end: '13:15:00',
  }

  it('ajoute joursListe et pauseMinutes aux champs existants', () => {
    const r = rythmePlanning({ plan, tolerance: 15, perso: false })
    expect(r.defini).toBe(true)
    expect(r.joursListe).toEqual([1, 2, 3, 4, 5])
    expect(r.pauseMinutes).toBe(45)
    expect(r.journee).toBe('08:00 → 17:00')
  })

  it('sans pause declaree : pauseMinutes null', () => {
    const r = rythmePlanning({ plan: { ...plan, has_break: false }, tolerance: null, perso: true })
    expect(r.pauseMinutes).toBeNull()
    expect(r.joursListe).toEqual([1, 2, 3, 4, 5])
  })
})

describe('resumerTaches — le statut rejoint les echeances', () => {
  it('expose le statut de chaque prochaine echeance', () => {
    const r = resumerTaches([
      { id: 1, title: 'A', status: 'in_progress', due_at: '2026-11-20T09:00:00Z', completed_at: null, validated_at: null },
      { id: 2, title: 'B', status: 'assigned', due_at: '2026-11-25T09:00:00Z', completed_at: null, validated_at: null },
    ], '2026-11-15', '2026-11-01')
    expect(r.prochaines.map((t) => t.statut)).toEqual(['in_progress', 'assigned'])
    expect(r.aVenirCount).toBe(2)
  })
})
