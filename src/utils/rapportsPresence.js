// ═══════════════════════════════════════════════════════════
// ⏱️ PRÉSENCE, PAUSES ET DURÉE EFFECTIVE — le calcul du rapport
//
// Le rapport comptait la présence brute : badge d'entrée, badge de
// sortie. La page Pointages, elle, DÉDUIT les pauses réellement
// effectuées. Deux écrans, deux totaux pour la même journée.
//
// Ce module ne réinvente aucune règle : il applique celles qui sont
// déjà écrites dans `pausesService.minutesPausesDeductibles` —
//   · une pause réelle se déduit ;
//   · une pause présumée VALIDÉE se déduit ;
//   · une pause présumée en attente se marque, jamais ne s'encaisse ;
//   · une pause écartée ne compte jamais ;
//   · une pause déjà matérialisée par un badge Sortie → Entrée n'est
//     pas déduite deux fois.
//
// Tout est pur : aucune requête, aucune impression. C'est ici qu'on
// vérifie les totaux.
// ═══════════════════════════════════════════════════════════

import { minutesPausesDeductibles } from '../services/pausesService'

/** Le jour d'un badge, à la même convention que le reste du rapport. */
export function cleJour(checkTime) {
  if (!checkTime) return null
  const brut = String(checkTime)
  const direct = brut.slice(0, 10)
  if (/^\d{4}-\d{2}-\d{2}$/.test(direct)) return direct
  const d = new Date(brut)
  return Number.isNaN(d.getTime()) ? null : d.toISOString().slice(0, 10)
}

/** '7h38' — jamais '7,63 h'. */
export function heuresMinutes(minutes) {
  const m = Math.round(Number(minutes) || 0)
  if (m <= 0) return '0h00'
  const h = Math.floor(m / 60)
  return `${h}h${String(m % 60).padStart(2, '0')}`
}

/** '08:12' depuis un instant ISO, dans le fuseau du navigateur. */
export function heureLocale(checkTime) {
  if (!checkTime) return null
  const d = new Date(checkTime)
  if (Number.isNaN(d.getTime())) return null
  return d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
}

/** Range les badges payables d'un employé par jour. */
export function badgesParJour(attendances = [], employeeId = null) {
  const parJour = new Map()
  for (const a of attendances || []) {
    if (!a) continue
    if (employeeId && a.employee_id !== employeeId) continue
    const jour = cleJour(a.check_time)
    if (!jour) continue
    if (!parJour.has(jour)) parJour.set(jour, [])
    parJour.get(jour).push(a)
  }
  for (const liste of parJour.values()) {
    liste.sort((x, y) => new Date(x.check_time) - new Date(y.check_time))
  }
  return parJour
}

/**
 * Les pauses déductibles d'un employé sur la période.
 *
 * @param {Array} pauses  lignes `construirePauses(...).paies` (une par pause)
 * @param {Array} attendances badges déjà filtrés sur les pointages payables
 * @returns {{
 *   minutes: number,          // ce qui se retire vraiment du travail
 *   parJour: Object,          // jour -> minutes déduites
 *   retenues: Array,          // le détail de ce qui a été retiré
 *   presumeesMinutes: number, // présumées en attente : marquées, non déduites
 *   presumeesNombre: number,
 *   ecarteesNombre: number,
 *   nombre: number,           // pauses réellement effectuées (réelles + validées)
 * }}
 */
export function pausesDeductiblesPourEmploye({
  pauses = [],
  attendances = [],
  employeeId = null,
  toleranceMinutes = 5,
} = {}) {
  const badges = badgesParJour(attendances, employeeId)

  const pausesEmploye = (pauses || []).filter(
    (p) => p && (!employeeId || !p.employe_id || p.employe_id === employeeId)
  )

  const parJourPauses = new Map()
  for (const p of pausesEmploye) {
    const jour = p.jour || cleJour(p.debutISO)
    if (!jour) continue
    if (!parJourPauses.has(jour)) parJourPauses.set(jour, [])
    parJourPauses.get(jour).push(p)
  }

  let minutes = 0
  const parJour = {}
  const retenues = []

  for (const [jour, liste] of parJourPauses) {
    const resultat = minutesPausesDeductibles(liste, badges.get(jour) || [], { toleranceMinutes })
    if (resultat.minutes > 0) {
      parJour[jour] = resultat.minutes
      minutes += resultat.minutes
      retenues.push(...resultat.retenues.map((r) => ({ ...r, jour })))
    }
  }

  const presumees = pausesEmploye.filter((p) => p.statut === 'presumee' && !p.ouverte)
  const ecartees = pausesEmploye.filter((p) => p.statut === 'ecartee')
  const effectuees = pausesEmploye.filter(
    (p) => !p.ouverte && (p.statut === 'reelle' || p.statut === 'validee')
  )

  return {
    minutes,
    parJour,
    retenues,
    presumeesMinutes: presumees.reduce((t, p) => t + (Number(p.dureeMinutes) || 0), 0),
    presumeesNombre: presumees.length,
    ecarteesNombre: ecartees.length,
    nombre: effectuees.length,
  }
}

/**
 * Le registre jour par jour d'un seul employé.
 *
 * @param {Object} minutesParJour  jour -> minutes de présence (calcul du rapport)
 * @param {Object} pausesParJour   jour -> minutes de pause déduites
 */
export function construireJournees({
  attendances = [],
  employeeId = null,
  minutesParJour = {},
  pausesParJour = {},
  geofencesById = {},
  paieDuJour = null,
} = {}) {
  const badges = badgesParJour(attendances, employeeId)
  const jours = new Set([...badges.keys(), ...Object.keys(pausesParJour || {})])

  const lignes = [...jours]
    .filter(Boolean)
    .sort((a, b) => String(b).localeCompare(String(a)))
    .map((jour) => {
      const liste = badges.get(jour) || []
      const entree = liste.find((a) => String(a.check_type).toLowerCase() === 'in') || null
      const sorties = liste.filter((a) => String(a.check_type).toLowerCase() === 'out')
      const sortie = sorties.length > 0 ? sorties[sorties.length - 1] : null

      const presenceMinutes = Number(minutesParJour?.[jour] ?? 0) || 0
      const pauseMinutes = Number(pausesParJour?.[jour] ?? 0) || 0
      const effectifMinutes = Math.max(0, presenceMinutes - pauseMinutes)

      return {
        jour,
        entree: heureLocale(entree?.check_time),
        sortie: heureLocale(sortie?.check_time),
        presenceMinutes,
        pauseMinutes,
        effectifMinutes,
        zone: entree?.geofence_id ? geofencesById[entree.geofence_id] || 'Zone inconnue' : 'Hors zone',
        paie: paieDuJour ? paieDuJour(jour) : null,
      }
    })

  return lignes
}

/**
 * Le résumé de présence d'un employé : brut, pauses, effectif.
 * Utilisé par le registre comme par les documents.
 */
export function resumerPresence({ presenceMinutes = 0, pauses = {} } = {}) {
  const pauseMinutes = Number(pauses?.minutes) || 0
  return {
    presenceMinutes,
    pauseMinutes,
    effectifMinutes: Math.max(0, presenceMinutes - pauseMinutes),
    presumeesMinutes: Number(pauses?.presumeesMinutes) || 0,
    presumeesNombre: Number(pauses?.presumeesNombre) || 0,
    pausesNombre: Number(pauses?.nombre) || 0,
    ecarteesNombre: Number(pauses?.ecarteesNombre) || 0,
  }
}
