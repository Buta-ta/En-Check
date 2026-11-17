// ═══════════════════════════════════════════════════════════
// FICHE EMPLOYÉ (360°) — logique pure de la page /employes/:id
//
// La page ne fait que lire et disposer ; les jugements
// (anciens, présent ou pas, retards, libellés) vivent ici,
// testés, sans supabase ni React. Règles de la maison :
//  · jamais de donnée inventée — une donnée absente est
//    signalée, pas remplie par un 0 ;
//  · le mot « absent » n'existe qu'après la fin du poste
//    (doctrine P0, lib/etatPresence) ;
//  · aucun pourcentage sur un échantillon trop mince.
// ═══════════════════════════════════════════════════════════

import { formaterHeureLocaleShort, jourLocal } from '../utils/timezoneUtils'
import { libelleSansPointage } from './etatPresence'

const MOIS_COURTS = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.']

/** Heure « HH:MM » à l'heure du fuseau donné, ou null si pas d'heure. */
const heureNette = (instanteUTC, fuseau) => {
  const h = formaterHeureLocaleShort(instanteUTC, fuseau)
  return h && !h.startsWith('--') ? h : null
}
const JOURS_COURTS = ['dim.', 'lun.', 'mar.', 'mer.', 'jeu.', 'ven.', 'sam.']

/**
 * Itère les jours 'YYYY-MM-DD' de [debut, fin] inclus.
 * Les dates sont manipulées dans le fuseau de l'entreprise
 * (jamais la date du navigateur) : on avance de 86 400 s sur
 * des dates à minuit, sans jamais repasser par new Date().
 */
export function listeJoursInclusifs(debut, fin) {
  const jours = []
  if (!debut || !fin) return jours
  let courant = debut
  // Garde-fou : on ne tourne jamais plus de 5 années, même si les
  // dates sont mal formées.
  for (let i = 0; i < 1500 && courant <= fin; i += 1) {
    jours.push(courant)
    const [a, m, j] = courant.split('-').map(Number)
    const suivant = new Date(Date.UTC(a, m - 1, j + 1))
    courant = suivant.toISOString().slice(0, 10)
  }
  return jours
}

/**
 * Ancienneté honnête depuis hire_date. null quand on ne sait rien
 * (l'afficheur écrit alors « non renseignée », jamais « 0 mois »).
 */
export function libelleAnciennete(dateEmbauche, reference = new Date()) {
  if (!dateEmbauche) return null
  const embauche = new Date(`${String(dateEmbauche).slice(0, 10)}T00:00:00Z`)
  if (Number.isNaN(embauche.getTime())) return null
  const ref = new Date(`${reference.toISOString().slice(0, 10)}T00:00:00Z`)
  let mois = (ref.getUTCFullYear() - embauche.getUTCFullYear()) * 12
    + (ref.getUTCMonth() - embauche.getUTCMonth())
  if (ref.getUTCDate() < embauche.getUTCDate()) mois -= 1
  if (mois < 0) return null
  if (mois < 1) return 'Moins d’un mois'
  if (mois < 12) return mois === 1 ? '1 mois' : `${mois} mois`
  const ans = Math.floor(mois / 12)
  const reste = mois % 12
  if (reste === 0) return ans === 1 ? '1 an' : `${ans} ans`
  return `${ans === 1 ? '1' : ans} an${ans > 1 ? 's' : ''} et ${reste === 1 ? '1 mois' : `${reste} mois`}`
}

/**
 * « Aujourd’hui » / « Hier » / « mer. 12 nov. » — pour le fil
 * d'activité. Comparaison sur dates 'YYYY-MM-DD' du fuseau
 * de l'entreprise.
 */
export function libelleJourRelatif(jourISO, dateDuJour) {
  if (!jourISO || !dateDuJour) return jourISO || ''
  if (jourISO === dateDuJour) return 'Aujourd’hui'
  // « Hier » = le jour précédent celui de dateDuJour (jamais l’inverse).
  const [da, dm, dj] = dateDuJour.split('-').map(Number)
  const hierDuJour = new Date(Date.UTC(da, dm - 1, dj - 1)).toISOString().slice(0, 10)
  if (jourISO === hierDuJour) return 'Hier'
  const [a, m, j] = jourISO.split('-').map(Number)
  const dt = new Date(Date.UTC(a, m - 1, j))
  return `${JOURS_COURTS[dt.getUTCDay()]} ${j} ${MOIS_COURTS[m - 1]}`
}

/**
 * Les jours du mois où l'employé a pointé à l'ENTRÉE au moins
 * une fois (dates 'YYYY-MM-DD' du fuseau entreprise, triés).
 * Une sortie sans entrée ne compte pas comme une journée pointée.
 */
export function joursPointesDuMois(attendances, dateDebut, dateFin, fuseau) {
  const vus = new Set()
  for (const a of attendances || []) {
    if (!a?.check_time) continue
    if (String(a.check_type || '').toLowerCase() !== 'in') continue
    const jour = jourLocal(a.check_time, fuseau)
    if (jour && jour >= dateDebut && jour <= dateFin) vus.add(jour)
  }
  return [...vus].sort()
}

/**
 * Les jours PRÉVUS par le planning entre dateDebut et dateFin
 * (et pas après aujourd'hui : l'avenir n'est pas dû).
 * plansParJour vient de construirePlanningsParJour (même moteur
 * que retards/absences) : les clés sont des 'YYYY-MM-DD'.
 */
export function joursPrevusDepuisPlans(plansParJour, dateDebut, dateFin, dateDuJour) {
  const borne = dateDuJour && dateDuJour < dateFin ? dateDuJour : dateFin
  return listeJoursInclusifs(dateDebut, borne).filter((jour) => Boolean(plansParJour?.[jour])).length
}

/**
 * Pourcentage d'échantillon — mais seulement si l'échantillon
 * mérite un pourcentage (sinon null : l'afficheur écrit « — »
 * ou la fraction, jamais un % sur 2 jours).
 */
export function pourcentageSiEchantillon(valeur, total, seuilMin = 15) {
  if (!total || total < seuilMin) return null
  const p = Math.round((valeur / total) * 100)
  return Math.max(0, Math.min(100, p))
}

/**
 * L'état du jour, en mots de la maison.
 *  · activePause        → « En pause »
 *  · entrée sans sortie → « En poste »
 *  · entrée + sortie    → « Pointage terminé »
 *  · absence couvrant le jour → « En congé »
 *  · rien du tout       → « Pas encore pointé » tant que le poste
 *    court, « Absent » seulement après la fin du poste (P0).
 */
export function etatPresenceDuJour({
  firstIn = null,
  lastPunch = null,
  activePause = null,
  absenceDuJour = null,
  finPosteDepassee = false,
}) {
  const lastOut = lastPunch && String(lastPunch.check_type || '').toLowerCase() === 'out' ? lastPunch : null
  const entreeHHMM = firstIn ? heureNette(firstIn.check_time) : null
  const sortieHHMM = lastOut ? heureNette(lastOut.check_time) : null

  if (activePause) {
    return { state: 'en_pause', libelle: 'En pause', entreeHHMM, sortieHHMM: null, activePause }
  }
  if (firstIn && !lastOut) {
    return { state: 'en_poste', libelle: 'En poste', entreeHHMM, sortieHHMM: null, activePause: null }
  }
  if (firstIn && lastOut) {
    return { state: 'termine', libelle: 'Pointage terminé', entreeHHMM, sortieHHMM, activePause: null }
  }
  if (absenceDuJour) {
    return { state: 'en_conge', libelle: 'En congé', entreeHHMM: null, sortieHHMM: null, activePause: null, absenceDuJour }
  }
  return {
    state: finPosteDepassee ? 'absent' : 'non_pointe',
    libelle: libelleSansPointage(finPosteDepassee, true),
    entreeHHMM: null,
    sortieHHMM: null,
    activePause: null,
  }
}

/**
 * Le retard du jour, si le planning en donne la référence.
 * Seuil = late_tolerance_minutes de la grille (défaut 15 min) —
 * la même tolérance que compterRetardsDuJour. null si aucun
 * horaire de référence, ou si c'est un service de nuit (la
 * comparaison d'heures brutes n'y est pas fiable : on ne juge
 * pas ce qu'on ne peut pas mesurer honnêtement).
 * Retourne le dépassement en minutes, ou null.
 */
export function retardDuJour({ firstIn, planDuJour, fuseau, toleranceMinutes = 15 }) {
  if (!firstIn?.check_time || !planDuJour?.start_time) return null
  // Les « time » de Postgres sont « HH:MM:SS » : on ne garde que HH:MM.
  const debutPlan = String(planDuJour.start_time).slice(0, 5)
  const finPlan = String(planDuJour.end_time || '').slice(0, 5)
  if (!/^\d{2}:\d{2}$/.test(debutPlan)) return null
  if (finPlan && finPlan < debutPlan) return null // service de nuit
  const [h1, m1] = debutPlan.split(':').map(Number)
  // L'heure d'entrée DANS LE FUSEAU DE L'ENTREPRISE : la journée
  // se vit à l'heure de l'entreprise, pas du navigateur.
  const heureLocale = heureNette(firstIn.check_time, fuseau)
  if (!heureLocale) return null
  const [h2, m2] = heureLocale.split(':').map(Number)
  const depassement = (h2 * 60 + m2) - (h1 * 60 + m1)
  if (depassement <= (Number(toleranceMinutes) || 15)) return null
  return depassement
}

/**
 * Le fil d'activité des N jours : pointages, pauses réelles,
 * congés — triés du plus récent au plus ancien, groupés par jour.
 * Rien d'inventé : un jour sans événement n'apparaît pas.
 */
export function construireFilActivite({
  attendances = [],
  pauses = [],
  absences = [],
  dateDuJour,
  fuseau,
  maxEntrees = 14,
}) {
  const evenements = []

  for (const a of attendances || []) {
    if (!a?.check_time) continue
    const type = String(a.check_type || '').toLowerCase()
    const estEntree = type === 'in'
    const estSortie = type === 'out'
    if (!estEntree && !estSortie) continue
    evenements.push({
      id: `att-${a.id}`,
      type: estEntree ? 'entree' : 'sortie',
      jour: jourLocal(a.check_time, fuseau),
      heure: heureNette(a.check_time, fuseau),
      horodatage: new Date(a.check_time).getTime(),
      libelle: estEntree ? 'Pointage à l’entrée' : 'Pointage à la sortie',
    })
  }

  for (const pa of pauses || []) {
    if (!pa?.debutISO) continue
    const debutJour = jourLocal(pa.debutISO, fuseau)
    const debutHeure = heureNette(pa.debutISO, fuseau)
    evenements.push({
      id: `pause-debut-${pa.id}`,
      type: 'pause_debut',
      jour: debutJour,
      heure: debutHeure,
      horodatage: new Date(pa.debutISO).getTime(),
      libelle: 'Début de pause',
    })
    if (pa.finISO) {
      evenements.push({
        id: `pause-fin-${pa.id}`,
        type: 'pause_fin',
        jour: jourLocal(pa.finISO, fuseau),
        heure: heureNette(pa.finISO, fuseau),
        horodatage: new Date(pa.finISO).getTime(),
        libelle: 'Reprise de poste',
      })
    }
  }

  for (const ab of absences || []) {
    if (!ab?.start_date) continue
    // Un seul événement par absence (pas un par jour) ; l'échéance
    // est lisible sur la période.
    evenements.push({
      id: `absence-${ab.id}`,
      type: 'absence',
      jour: ab.start_date,
      heure: null,
      horodatage: new Date(`${ab.start_date}T00:00:00`).getTime(),
      libelle: ab.reason ? `Congé (${ab.reason})` : 'Congé',
      periode: ab.end_date && ab.end_date !== ab.start_date ? `jusqu’au ${ab.end_date}` : null,
    })
  }

  evenements.sort((x, y) => (y.horodatage || 0) - (x.horodatage || 0))
  const retenus = evenements.slice(0, maxEntrees)

  // Groupement par jour (du plus récent au plus ancien).
  const groupes = []
  let jourCourant = null
  for (const e of retenus) {
    if (e.jour !== jourCourant) {
      jourCourant = e.jour
      groupes.push({ jour: e.jour, libelle: libelleJourRelatif(e.jour, dateDuJour), entrees: [] })
    }
    groupes[groupes.length - 1].entrees.push(e)
  }
  return groupes
}

/**
 * La grille du mois pour l'affichage « présence du mois » :
 * une case par jour (debut → aujourd'hui) avec un état :
 *  · 'pointe'       → journée pointée (entrée enregistrée)
 *  · 'prevu'        → jour prévu au planning, pas pointé
 *  · 'non_prevu'    → jour hors planning
 *  · 'avenir'       → après aujourd'hui (n'affiché qu'en filigrane)
 */
export function grillePresenceMois({
  dateDuJour,
  joursPointes,
  plansParJour,
}) {
  const [annee, mois] = (dateDuJour || '').split('-').map(Number)
  if (!annee || !mois) return { cases: [], totalCases: 0 }
  const joursDansLeMois = new Date(Date.UTC(annee, mois, 0)).getUTCDate()
  const points = new Set(joursPointes || [])
  const cases = []
  for (let j = 1; j <= joursDansLeMois; j += 1) {
    const jour = `${dateDuJour.slice(0, 8)}${String(j).padStart(2, '0')}`
    let etat
    if (jour > dateDuJour) etat = 'avenir'
    else if (points.has(jour)) etat = 'pointe'
    else if (plansParJour?.[jour]) etat = 'prevu'
    else etat = 'non_prevu'
    cases.push({ jour, numero: j, etat })
  }
  return { cases, totalCases: cases.length }
}

export default libelleAnciennete
