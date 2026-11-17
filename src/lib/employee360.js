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

// ─────────────────────────────────────────────────────────────
// PR ② — activité détaillée, rythme & régularité, tâches
// ─────────────────────────────────────────────────────────────

const JOURS_SEMAINE = {
  1: 'lundi', 2: 'mardi', 3: 'mercredi', 4: 'jeudi',
  5: 'vendredi', 6: 'samedi', 7: 'dimanche',
}

/**
 * Les jours travaillés, lisibles — les mêmes règles que la
 * fenêtre de planning (ModaleHoraires) : « du lundi au
 * vendredi », « tous les jours », ou la liste nominative.
 * null si rien n'est déclaré.
 */
export function libelleJoursSemaine(jours) {
  const liste = (Array.isArray(jours) ? jours : [])
    .map(Number)
    .filter((jour) => JOURS_SEMAINE[jour])
    .sort((a, b) => a - b)
  if (liste.length === 0) return null
  if (liste.length === 7) return 'tous les jours'
  if (liste.length === 5 && [1, 2, 3, 4, 5].every((jour) => liste.includes(jour))) return 'du lundi au vendredi'
  if (liste.length === 6 && [1, 2, 3, 4, 5, 6].every((jour) => liste.includes(jour))) return 'du lundi au samedi'
  return liste.map((jour) => JOURS_SEMAINE[jour]).join(', ')
}

/** « 8h05 » à partir de secondes — le même format que le moteur. */
export function secondesVersHeures(secondes) {
  const s = Math.max(0, Math.round(Number(secondes) || 0))
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  return `${h}h${String(m).padStart(2, '0')}`
}

/**
 * Le rythme de l'employé depuis son plan du jour (celui que
 * construitPlanningsParJour a retenu). « defini: false » si
 * aucun horaire de référence — on ne devine pas.
 */
export function rythmePlanning({ plan = null, tolerance = null, perso = false }) {
  const start = plan?.start_time ? String(plan.start_time).slice(0, 5) : null
  const end = plan?.end_time ? String(plan.end_time).slice(0, 5) : null
  if (!start || !end) return { defini: false }
  const aPause = plan?.has_break !== false && plan?.break_start && plan?.break_end
  const joursListe = (Array.isArray(plan?.work_days) ? plan.work_days : [])
    .map(Number).filter((j) => j >= 1 && j <= 7).sort((a, b) => a - b)
  const pauseMinutes = aPause
    ? minutesEntreHeures(String(plan.break_start).slice(0, 5), String(plan.break_end).slice(0, 5))
    : null
  return {
    defini: true,
    perso: Boolean(perso),
    jours: libelleJoursSemaine(plan?.work_days),
    joursListe,
    journee: `${start} → ${end}`,
    pause: aPause
      ? `${String(plan.break_start).slice(0, 5)} – ${String(plan.break_end).slice(0, 5)}`
      : null,
    pauseMinutes,
    tolerance: Number(tolerance) > 0 ? Number(tolerance) : null,
  }
}

/**
 * Barres du mois : une case par jour écoulé, `heures` en heures
 * (nombre) — null si le jour n'a AUCUN pointage (pas de barre :
 * « pas de données », pas un 0 qui ferait foi).
 */
export function serieBarresMois(secondesParJour, dateDuJour) {
  const [annee, mois, jourNum] = String(dateDuJour || '').split('-').map(Number)
  if (!annee || !mois) return []
  const joursDansLeMois = new Date(Date.UTC(annee, mois, 0)).getUTCDate()
  const cases = []
  for (let j = 1; j <= Math.min(joursDansLeMois, jourNum); j += 1) {
    const iso = `${dateDuJour.slice(0, 8)}${String(j).padStart(2, '0')}`
    const entree = secondesParJour?.[iso]
    cases.push({
      numero: j,
      libelle: String(j),
      heures: entree?.pointe ? Math.max(0, Number(entree.secondes) || 0) / 3600 : null,
      estAujourdhui: j === jourNum,
    })
  }
  return cases
}

/**
 * Barres de l'année : une case par mois (12), même règle —
 * un mois sans le moindre pointage vaut null, pas 0.
 */
export function serieBarresAnnee(secondesParJour, dateDuJour) {
  const annee = Number(String(dateDuJour || '').slice(0, 4))
  const moisActuel = Number(String(dateDuJour || '').slice(5, 7))
  if (!annee) return []
  return Array.from({ length: 12 }, (_, i) => {
    const m = i + 1
    const joursDansLeMois = new Date(Date.UTC(annee, m, 0)).getUTCDate()
    let secondes = 0
    let pointe = false
    for (let j = 1; j <= joursDansLeMois; j += 1) {
      const iso = `${String(annee)}-${String(m).padStart(2, '0')}-${String(j).padStart(2, '0')}`
      const e = secondesParJour?.[iso]
      if (e?.pointe) { pointe = true; secondes += Math.max(0, Number(e.secondes) || 0) }
    }
    return { mois: m, libelle: MOIS_COURTS[i], heures: pointe ? secondes / 3600 : null, aVenir: m > moisActuel }
  })
}

/** Total en secondes d'une série de barres (les null ne comptent pas). */
export function totalSecondesSerie(serie) {
  return (serie || []).reduce((acc, c) => acc + (c.heures != null ? c.heures * 3600 : 0), 0)
}

/**
 * Jours distincts de [debut, fin] couverts par au moins un
 * congé — deux congés qui se chevauchent ne comptent qu'une
 * fois le même jour.
 */
export function joursAbsencesPeriode(absences, debut, fin) {
  const couverts = new Set()
  for (const a of absences || []) {
    if (!a?.start_date) continue
    const finAbs = a.end_date || a.start_date
    const d = a.start_date < debut ? debut : a.start_date
    const f = finAbs > fin ? fin : finAbs
    if (f < d) continue
    for (const jour of listeJoursInclusifs(d, f)) couverts.add(jour)
  }
  return couverts.size
}

const TACHES_TERMINEES = ['completed', 'validated']
const TACHES_CLOTURES = ['completed', 'validated', 'rejected', 'cancelled']

/**
 * Le compte des tâches attribuées : en cours, terminées sur la
 * période, à faire (échéance future non clôturée) + les trois
 * prochaines échéances. Rien d'inventé : `aucune: true` quand
 * la table ne connaît pas une seule tâche pour cet employé.
 */
export function resumerTaches(taches, dateDuJour, debutPeriode) {
  const liste = taches || []
  const dansPeriode = (instante) => {
    if (!instante) return false
    const le = String(instante).slice(0, 10)
    return le >= debutPeriode && le <= dateDuJour
  }
  const enCours = liste.filter((t) => ['in_progress', 'paused'].includes(t.status)).length
  const terminees = liste.filter((t) =>
    TACHES_TERMINEES.includes(t.status)
    && (dansPeriode(t.completed_at) || dansPeriode(t.validated_at))
  ).length
  const aVenir = liste
    .filter((t) => t?.due_at && String(t.due_at).slice(0, 10) >= dateDuJour && !TACHES_CLOTURES.includes(t.status))
    .sort((a, b) => String(a.due_at).localeCompare(String(b.due_at)))
  return {
    aucune: liste.length === 0,
    enCours,
    terminees,
    aVenirCount: aVenir.length,
    prochaines: aVenir.slice(0, 3).map((t) => ({ id: t.id, titre: t.title, statut: t.status, echeance: String(t.due_at).slice(0, 10) })),
  }
}

// ─────────────────────────────────────────────────────────────
// REFONTE BENTO (17/11) — ancienneté, contact, salaire, axes
// ─────────────────────────────────────────────────────────────

/** Ancienneté en jours entiers depuis hire_date (null si inconnu). */
export function joursAnciennete(dateEmbauche, reference = new Date()) {
  if (!dateEmbauche) return null
  const embauche = new Date(`${String(dateEmbauche).slice(0, 10)}T00:00:00Z`)
  if (Number.isNaN(embauche.getTime())) return null
  const ref = new Date(`${reference.toISOString().slice(0, 10)}T00:00:00Z`)
  const jours = Math.floor((ref.getTime() - embauche.getTime()) / 86400000)
  return jours >= 0 ? jours : null
}

/** « +229 97 48 21 33 » → « +22997482133 » — null si trop court. */
export function normaliserTelephone(telephone) {
  const brut = String(telephone || '').trim()
  if (!brut) return null
  const signe = brut.startsWith('+') ? '+' : ''
  const chiffres = signe ? brut.slice(1).replace(/\D/g, '') : brut.replace(/\D/g, '')
  if (chiffres.length < 6) return null
  return `${signe}${chiffres}`
}

/** Lien WhatsApp (wa.me) — null sans numéro exploitable. */
export function lienWhatsApp(telephone) {
  const n = normaliserTelephone(telephone)
  return n ? `https://wa.me/${n.replace(/^\+/, '')}` : null
}

/** Lien d'appel natif (tel:) — null sans numéro exploitable. */
export function lienAppel(telephone) {
  const n = normaliserTelephone(telephone)
  return n ? `tel:${n}` : null
}

/** Minutes entre deux heures « HH:MM » (une coupure peut franchir minuit). */
export function minutesEntreHeures(debut, fin) {
  const [h1, m1] = String(debut || '').split(':').map(Number)
  const [h2, m2] = String(fin || '').split(':').map(Number)
  if ([h1, m1, h2, m2].some((x) => !Number.isFinite(x))) return null
  const delta = (h2 * 60 + m2) - (h1 * 60 + m1)
  const d = (delta + 1440) % 1440
  return d > 0 ? d : null
}

const JOURS_COURTS_CHIPS = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim']

/** work_days [1..7] → chips « Lun », « Mar »… (ordre lundi → dimanche). */
export function chipsJoursTravailles(jours) {
  const liste = (Array.isArray(jours) ? jours : [])
    .map(Number).filter((j) => j >= 1 && j <= 7).sort((a, b) => a - b)
  return [...new Set(liste)].map((j) => JOURS_COURTS_CHIPS[j - 1])
}

/**
 * Les 12 mois de l'année en cours, un montant par mois (brut du bulletin
 * le plus récent du mois — null si aucun bulletin : un mois sans bulletin
 * n'est PAS un mois à zéro).
 */
export function serieSalaireAnnee(bulletins, dateDuJour) {
  const annee = Number(String(dateDuJour || '').slice(0, 4))
  const moisActuel = Number(String(dateDuJour || '').slice(5, 7))
  if (!annee) return []
  const parMois = {}
  for (const b of bulletins || []) {
    const ps = String(b?.period_start || '')
    if (Number(ps.slice(0, 4)) !== annee) continue
    const m = Number(ps.slice(5, 7))
    if (m < 1 || m > 12) continue
    const montant = Number(b.gross_salary)
    if (!Number.isFinite(montant)) continue
    const precedent = parMois[m]
    if (!precedent || String(b.period_end || '') >= String(precedent.period_end || '')) {
      parMois[m] = { montant, period_end: b.period_end || '' }
    }
  }
  return Array.from({ length: 12 }, (_, i) => {
    const m = i + 1
    return {
      mois: m,
      libelle: MOIS_COURTS[i],
      montant: parMois[m] ? parMois[m].montant : null,
      aVenir: m > moisActuel,
    }
  })
}

/** Total brut de l'année — null si aucun bulletin (pas un 0). */
export function totalSalaireAnnee(bulletins, dateDuJour) {
  const annee = String(dateDuJour || '').slice(0, 4)
  let total = 0
  let trouve = false
  for (const b of bulletins || []) {
    const ps = String(b?.period_start || '')
    if (!ps || ps.slice(0, 4) !== annee) continue
    const montant = Number(b.gross_salary)
    if (!Number.isFinite(montant)) continue
    total += montant
    trouve = true
  }
  return trouve ? total : null
}

/**
 * Variation du dernier mois COMPLET sur le précédent — comparer un mois
 * partiel, c'est mentir. null si l'un des deux mois est inconnu.
 */
export function tendanceSalaire(bulletins, dateDuJour) {
  const parts = String(dateDuJour || '').split('-').map(Number)
  if (parts.length !== 3) return null
  const [a, m] = parts
  const totalDuMois = (an, mo) => {
    let total = 0
    let trouve = false
    const cle = `${String(an).padStart(4, '0')}-${String(mo).padStart(2, '0')}`
    for (const b of bulletins || []) {
      const ps = String(b?.period_start || '')
      if (ps.slice(0, 7) !== cle) continue
      const montant = Number(b.gross_salary)
      if (!Number.isFinite(montant)) continue
      total += montant
      trouve = true
    }
    return trouve ? total : null
  }
  const [an1, mo1] = m > 1 ? [a, m - 1] : [a - 1, 12]
  const [an2, mo2] = mo1 > 1 ? [an1, mo1 - 1] : [an1 - 1, 12]
  const t1 = totalDuMois(an1, mo1)
  const t2 = totalDuMois(an2, mo2)
  if (t1 == null || t2 == null || t2 <= 0) return null
  return { pct: Math.round(((t1 - t2) / t2) * 100), comparaison: `${MOIS_COURTS[mo1 - 1]} vs ${MOIS_COURTS[mo2 - 1]}` }
}

/**
 * Une échelle lisible pour un graphe : plafond et gradations « nice »
 * (1, 2, 2,5, 5 × 10^n) — le pic ne dépasse jamais le cadre.
 */
export function echelleNice(valeurMax, graduations = 4) {
  const v = Math.max(0, Number(valeurMax) || 0)
  const brut = v / graduations
  if (brut <= 0) {
    return { plafond: graduations, pas: 1, graduations: Array.from({ length: graduations + 1 }, (_, i) => i) }
  }
  const puissance = Math.pow(10, Math.floor(Math.log10(brut)))
  const base = brut / puissance
  const nice = base <= 1 ? 1 : base <= 2 ? 2 : base <= 2.5 ? 2.5 : base <= 5 ? 5 : 10
  const pas = nice * puissance
  return {
    plafond: pas * graduations,
    pas,
    graduations: Array.from({ length: graduations + 1 }, (_, i) => pas * i),
  }
}

/** « FCFA » → « F », « EUR » → « € »… (l'abréviation des étiquettes). */
export function abreviationDevise(devise) {
  const d = String(devise || '').trim().toUpperCase()
  if (['FCFA', 'XOF', 'CFA', 'XAF'].includes(d)) return 'F'
  if (d === 'EUR') return '€'
  if (d === 'USD') return '$'
  if (d === 'GBP') return '£'
  if (d === 'MAD') return 'DH'
  return d
}

/** 155000, « FCFA » → « 155 000 FCFA ». */
export function libelleMontant(valeur, devise) {
  const v = Number(valeur)
  if (!Number.isFinite(v)) return '—'
  const fmt = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 }).format(v)
  const d = String(devise || '').trim()
  return d ? `${fmt} ${d}` : fmt
}

/** 150000 → « 150K » (l'axe du graphe salarial). */
export function libelleMontantCourt(valeur) {
  const v = Number(valeur)
  if (!Number.isFinite(v)) return '—'
  if (v >= 1000 && v % 1000 === 0) return `${v / 1000}K`
  if (v >= 1000) return `${(v / 1000).toFixed(1).replace('.', ',')}K`
  return `${v}`
}

export default libelleAnciennete
