// ═══════════════════════════════════════════════════════════════════════════
// SERVICE PAUSES — présentation pure des lignes de `encheck_pauses_lire`
// Distinction stricte :
//   · Pauses réellement effectuées (non présumées : pointées ou saisies admin)
//   · Pauses présumées (créneaux de la grille horaire, non pointées)
//   · Jamais d'invention de pause à partir des pointages Entrée/Sortie (`attendances`)
// ═══════════════════════════════════════════════════════════════════════════
import {
  formaterHeureLocale,
  getHeuresMinutesLocales,
  minutesDepuisMinuit,
} from '../utils/timezoneUtils'

export const STATUTS_BADGES = {
  reelle: { label: 'Pause réelle', color: '#10B981' },
  presumee: { label: 'Présumée', color: '#F59E0B' },
  validee: { label: 'Validée', color: '#3B82F6' },
  ecartee: { label: 'Écartée', color: '#9CA3AF' },
}

export const ANOMALIES_BADGES = {
  sans_reprise: { label: '🚫 Sans reprise', color: '#EF4444' },
  trop_longue: { label: '⚠️ Très longue', color: '#F97316' },
}

export const STATUTS_A_STATUER = ['reelle', 'presumee']

function hhmm (timestamptz) {
  if (!timestamptz) return '--:--'
  return String(timestamptz).slice(11, 16)
}

/**
 * Retourne `true` si la pause est une pause présumée (issue de la grille horaire,
 * non pointée par l'employé).
 */
export function estPausePresumee (p) {
  if (!p) return false
  return p.statut === 'presumee' || p.source === 'presumee'
}

/**
 * Retourne `true` uniquement si la pause a été réellement effectuée (non présumée) :
 * pointée par l'employé (`source === 'pointee'`) ou enregistrée par l'admin (`source === 'admin'`),
 * et non écartée. Jamais une pause présumée ni un intervalle entre 2 pointages d'entrée/sortie.
 */
export function estPauseNonPresumee (p) {
  if (!p) return false
  if (p.statut === 'ecartee' || p.statut === 'presumee') return false
  if (p.source === 'presumee' || p.source === 'inter_sessions') return false
  return true
}

export const estPauseReelleEffectuee = estPauseNonPresumee

/**
 * Filtre une liste de pauses pour ne retenir que l'historique des pauses réellement effectuées
 * (pauses non présumées).
 */
export function filtrerHistoriquePausesReelles (pauses = []) {
  return (pauses || []).filter((p) => estPauseReelleEffectuee(p))
}

/**
 * Filtre une liste de pauses pour ne retenir que les pauses présumées (hors écartées).
 */
export function filtrerPausesPresumees (pauses = []) {
  return (pauses || []).filter((p) => estPausePresumee(p) && p.statut !== 'ecartee')
}

/**
 * Pauses à afficher dans la page POINTAGES.
 *
 * Doctrine « On invente, on marque, on n'encaisse pas » : une pause présumée
 * VALIDÉE par un humain n'est pas effacée de l'écran — elle reste visible,
 * mais jamais mélangée aux pauses réellement pointées : son libellé rappelle
 * son origine (« ✓ Pause présumée validée »).
 * Les pauses ÉCARTÉES restent invisibles partout : elles ne sont pas payées.
 */
export function pausesVisiblesDansPointages (pauses = []) {
  return (pauses || []).filter((p) => {
    if (!p) return false
    if (p.statut === 'ecartee') return false
    if (estPauseReelleEffectuee(p)) return true
    return estPausePresumee(p) && p.statut === 'validee'
  })
}

/**
 * Vrai si la pause est une pause présumée validée par un humain.
 * Une pause présumée validée reste « d'origine présumée » : elle n'est pas
 * comptée comme réelle, elle est seulement rendue visible.
 */
export function estPresumeeValidee (p) {
  return Boolean(p) && estPausePresumee(p) && p.statut === 'validee'
}

/**
 * Libellé explicite distinguant la nature exacte d'une pause :
 * pause réelle pointée (non présumée) vs pause présumée à statuer vs pause présumée validée.
 */
export function libelleNaturePause (p) {
  if (!p) return 'Pause'
  if (p.statut === 'ecartee') return '✕ Pause écartée'
  if (p.statut === 'presumee') return '⏳ Pause présumée — à statuer'
  if (p.source === 'presumee' && p.statut === 'validee') return '✓ Pause présumée validée'
  if (p.source === 'admin') return '✓ Pause réelle (saisie admin)'
  if (p.statut === 'validee') return '✓ Pause réelle validée'
  return '✓ Pause réelle pointée'
}

/**
 * Minutes de pause à DÉDUIRE du temps travaillé d'une journée.
 *
 * C'est le chaînon manquant entre les pauses et la paie : sans cette
 * déduction, une pause pointée depuis l'application (bouton Pause, sans
 * badge de sortie) restait comptée comme du travail, et un employé qui
 * prenait 90 min au lieu des 60 prévues était payé pour les 30 min de trop.
 *
 * Doctrine « on invente, on marque, on n'encaisse pas » :
 *  · une pause RÉELLE (pointée ou saisie admin), validée ou non, est déduite :
 *    ce temps n'est pas du travail ;
 *  · une pause PRÉSUMÉE n'est déduite QU'APRÈS validation par un humain —
 *    avant, elle est marquée, jamais encaissée ;
 *  · une pause ÉCARTÉE n'est jamais déduite ;
 *  · une pause déjà matérialisée par un badge Sortie → Entrée n'est PAS
 *    redéduite : l'intervalle ne compte déjà pas comme travaillé.
 *
 * @param {Array} pauses       lignes de pause de la journée (déjà filtrées)
 * @param {Array} attendances  pointages de la journée (pour éviter le double compte)
 * @param {Object} options     { toleranceMinutes = 5 }
 * @returns {{ minutes: number, retenues: Array }}
 */
export function minutesPausesDeductibles (pauses = [], attendances = [], options = {}) {
  const toleranceMs = Number(options.toleranceMinutes ?? 5) * 60000

  const badges = (attendances || [])
    .filter(Boolean)
    .map((a) => ({
      type: String(a.check_type || '').toLowerCase(),
      ms: new Date(a.check_time).getTime(),
    }))
    .filter((b) => Number.isFinite(b.ms))

  let minutes = 0
  const retenues = []

  for (const p of pauses || []) {
    if (!p) continue
    // Une pause écartée n'est jamais déduite : l'admin a dit « elle ne compte pas ».
    if (p.statut === 'ecartee') continue

    const presume = estPausePresumee(p)
    // Présomption non validée : on marque, on n'encaisse pas.
    if (presume && p.statut !== 'validee') continue
    if (!presume && !estPauseNonPresumee(p)) continue

    const debutBrut = p.debutISO || p.debut
    const finBrut = p.finISO || p.fin
    const debut = debutBrut ? new Date(debutBrut).getTime() : NaN
    const fin = finBrut ? new Date(finBrut).getTime() : NaN
    // Une pause ouverte (pas encore de reprise) n'a rien à déduire.
    if (!Number.isFinite(debut) || !Number.isFinite(fin) || fin <= debut) continue

    // Déjà exclue du temps travaillé par un badge Sortie → Entrée ?
    const dejaComptee =
      badges.some((b) => b.type === 'out' && Math.abs(b.ms - debut) <= toleranceMs) &&
      badges.some((b) => b.type === 'in' && Math.abs(b.ms - fin) <= toleranceMs)
    if (dejaComptee) continue

    const duree = Math.round((fin - debut) / 60000)
    if (duree <= 0) continue
    minutes += duree
    retenues.push({ id: p.id || null, minutes: duree, source: p.source || null, statut: p.statut || null })
  }

  return { minutes, retenues }
}

/**
 * Construit la liste affichable + les statistiques de la page Pauses.
 * @param {Array} lignesSql  lignes de `encheck_pauses_lire` ou `encheck_pauses`
 * @returns {{ paies: Array, stats: Object }}
 */
export function construirePauses (lignesSql) {
  const paies = []
  let nbReelles = 0
  let nbPresumees = 0
  let nbValidees = 0
  let nbEcartees = 0
  let nbOuvertes = 0
  let nbAnomalies = 0
  let dureeTotale = 0

  let nbReellesEffectuees = 0
  let dureeReelleMinutes = 0
  let nbPresumeesTotal = 0
  let nbPresumeesAStatuer = 0
  let nbPresumeesValidees = 0
  let dureePresumeeMinutes = 0

  for (const l of lignesSql || []) {
    const ouverte = !l.fin
    if (ouverte) nbOuvertes++
    if (l.anomalie) nbAnomalies++
    if (l.statut === 'reelle') nbReelles++
    else if (l.statut === 'presumee') nbPresumees++
    else if (l.statut === 'validee') nbValidees++
    else if (l.statut === 'ecartee') nbEcartees++

    const empId = l.employe_id || l.employee_id || null
    const debutMs = l.debut ? new Date(l.debut).getTime() : NaN
    const finMs = l.fin ? new Date(l.fin).getTime() : NaN
    const computedMin = Number.isFinite(debutMs) && Number.isFinite(finMs) && finMs >= debutMs
      ? Math.round((finMs - debutMs) / 60000)
      : 0
    const dureeMinutes = Number(l.duree_minutes ?? computedMin) || 0

    if (l.statut !== 'ecartee' && !ouverte) {
      dureeTotale += dureeMinutes
    }

    const estPresumee = estPausePresumee(l)
    const estNonPresumee = estPauseNonPresumee(l)

    if (estNonPresumee) {
      nbReellesEffectuees++
      if (!ouverte) dureeReelleMinutes += dureeMinutes
    } else if (estPresumee && l.statut !== 'ecartee') {
      nbPresumeesTotal++
      if (l.statut === 'presumee') nbPresumeesAStatuer++
      if (l.statut === 'validee') nbPresumeesValidees++
      if (!ouverte) dureePresumeeMinutes += dureeMinutes
    }

    paies.push({
      id: l.id,
      employe_id: empId,
      employe: `${l.prenom || l.employees?.first_name || ''} ${l.nom || l.employees?.last_name || ''}`.trim(),
      matricule: l.matricule || l.employees?.matricule || '',
      entreprise_nom: l.entreprise_nom || '',
      enterprise_id: l.enterprise_id,
      jour: l.jour,
      debutISO: l.debut || null,
      finISO: l.fin || null,
      debutHHMM: hhmm(l.debut),
      finHHMM: ouverte ? null : hhmm(l.fin),
      dureeMinutes,
      statut: l.statut,
      source: l.source,
      motif: l.motif,
      anomalie: l.anomalie,
      ouverte,
      aStatuer: STATUTS_A_STATUER.includes(l.statut),
      estPresumee,
      estNonPresumee,
      estReelleEffectuee: estNonPresumee,
      natureLabel: libelleNaturePause(l),
    })
  }

  paies.sort((a, b) => {
    if (a.jour !== b.jour) return String(b.jour || '').localeCompare(String(a.jour || ''))
    return String(b.debutHHMM || '').localeCompare(String(a.debutHHMM || ''))
  })

  return {
    paies,
    stats: {
      totalPauses: paies.length,
      nbReelles,
      nbPresumees,
      nbValidees,
      nbEcartees,
      nbOuvertes,
      nbAnomalies,
      dureeTotale,
      nbReellesEffectuees,
      dureeReelleMinutes,
      nbPresumeesTotal,
      nbPresumeesAStatuer,
      nbPresumeesValidees,
      dureePresumeeMinutes,
    },
  }
}

/**
 * Prépare les pauses d'un employé enregistrées dans `encheck_pauses` en distinguant
 * strictement les pauses non présumées (réellement effectuées) et les pauses présumées.
 * N'invente JAMAIS de fausse pause à partir des sessions d'entrée/sortie (`attendances`).
 */
export function fusionnerPausesEmploye ({
  pausesTable = [],
  scheduleInfo = null,
}) {
  const hasPlannedBreak = Boolean(
    scheduleInfo &&
    scheduleInfo.mode !== 'none' &&
    scheduleInfo.hasBreak
  )

  return (pausesTable || [])
    .filter((p) => p.statut !== 'ecartee' && p.source !== 'inter_sessions')
    .map((p) => {
      const estPresumee = estPausePresumee(p)
      const estNonPresumee = estPauseNonPresumee(p)
      return {
        ...p,
        debutHHMM: p.debutISO ? formaterHeureLocale(p.debutISO) : p.debutHHMM,
        finHHMM: p.finISO ? formaterHeureLocale(p.finISO) : p.finHHMM,
        estPresumee,
        estNonPresumee,
        estReelleEffectuee: estNonPresumee,
        natureLabel: libelleNaturePause(p),
        estNonPlanifiee: estNonPresumee && !hasPlannedBreak,
      }
    })
}

/**
 * Calcule en temps réel le temps écoulé d'une pause en cours (`ouverte === true`).
 */
export function formaterTempsPauseEnDirect (pause, nowMs = Date.now()) {
  if (!pause) return '0 min'
  const debutRaw = pause.debutISO || pause.debut || null
  const isOpen = Boolean(pause.ouverte ?? (!pause.finISO && !pause.fin && !pause.finHHMM))
  if (!isOpen || !debutRaw) {
    return formatDuree(pause.dureeMinutes ?? pause.duree_minutes)
  }
  const startMs = new Date(debutRaw).getTime()
  if (!Number.isFinite(startMs)) return formatDuree(pause.dureeMinutes ?? pause.duree_minutes)
  const elapsedSec = Math.max(0, Math.floor((nowMs - startMs) / 1000))
  const hours = Math.floor(elapsedSec / 3600)
  const mins = Math.floor((elapsedSec % 3600) / 60)
  const secs = elapsedSec % 60
  if (hours > 0) {
    return `${hours}h ${String(mins).padStart(2, '0')}m ${String(secs).padStart(2, '0')}s`
  }
  return `${String(mins).padStart(2, '0')}m ${String(secs).padStart(2, '0')}s`
}

/**
 * Format chronomètre digital (`MM:SS` ou `HH:MM:SS`) pour une pause réelle en cours.
 */
export function formaterChronoPauseDigital (pause, nowMs = Date.now()) {
  if (!pause) return '00:00'
  const debutRaw = pause.debutISO || pause.debut || null
  const isOpen = Boolean(pause.ouverte ?? (!pause.finISO && !pause.fin && !pause.finHHMM))
  if (!isOpen || !debutRaw) {
    return formatDuree(pause.dureeMinutes ?? pause.duree_minutes)
  }
  const startMs = new Date(debutRaw).getTime()
  if (!Number.isFinite(startMs)) return formatDuree(pause.dureeMinutes ?? pause.duree_minutes)
  const elapsedSec = Math.max(0, Math.floor((nowMs - startMs) / 1000))
  const hours = Math.floor(elapsedSec / 3600)
  const mins = Math.floor((elapsedSec % 3600) / 60)
  const secs = elapsedSec % 60
  if (hours > 0) {
    return `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`
  }
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`
}

/** Libellé/teinte du badge de statut (défaut : neutre). */
export function badgeStatut (statut) {
  return STATUTS_BADGES[statut] || { label: statut || '?', color: '#9CA3AF' }
}

/** Libellé/teinte du badge d'anomalie (null si aucune). */
export function badgeAnomalie (anomalie) {
  return anomalie ? (ANOMALIES_BADGES[anomalie] || { label: anomalie, color: '#EF4444' }) : null
}

/** Format « 1h57 » / « 45 min » pour une durée en minutes. */
export function formatDuree (minutes) {
  const m = Math.max(0, Number(minutes) || 0)
  if (m < 60) return `${m} min`
  return `${Math.floor(m / 60)}h${String(m % 60).padStart(2, '0')}`
}

/** Export CSV (séparateur point-virgule, Excel FR). */
export function exportCsvPauses (paies) {
  const entetes = ['Jour', 'Employé', 'Matricule', 'Entreprise', 'Début', 'Fin',
    'Durée (min)', 'Statut', 'Nature', 'Anomalie', 'Motif']
  const lignes = (paies || []).map(p => [
    p.jour, p.employe, p.matricule, p.entreprise_nom, p.debutHHMM,
    p.finHHMM || '', p.dureeMinutes, badgeStatut(p.statut).label,
    estPausePresumee(p) ? 'Présumée (grille)' : 'Réelle (non présumée)',
    (badgeAnomalie(p.anomalie) || {}).label || '', p.motif || '',
  ])
  return [entetes, ...lignes]
    .map(cols => cols.map(c => `"${String(c ?? '').replace(/"/g, '""')}"`).join(';'))
    .join('\n')
}

/**
 * Définition unique d'un service de nuit (partagée entre compteur, badge et filtre) :
 * 1) Fin de garde de nuit rattachée à la veille (`status === 'nuit_rattachee'`),
 * 2) Entrée pointée la nuit (`20h00 – 04h59`),
 * 3) Service commencé en soirée (`>= 18h00`) avec une vraie sortie le lendemain matin (`< 09h00`).
 */
export function estServiceDeNuit (p) {
  if (!p) return false
  if (p.status === 'nuit_rattachee') return true
  if (p.firstIn?.check_time) {
    const inParts = getHeuresMinutesLocales(p.firstIn.check_time)
    if (inParts && (inParts.heures >= 20 || inParts.heures < 5)) return true

    if (p.lastOut?.check_time && !p.lastOut.is_auto_closed && !p.lastOut.__virtual) {
      const outParts = getHeuresMinutesLocales(p.lastOut.check_time)
      if (
        inParts?.jourISO &&
        outParts?.jourISO &&
        outParts.jourISO > inParts.jourISO &&
        inParts.heures >= 18 &&
        outParts.heures < 9
      ) {
        return true
      }
    }
  }
  return false
}

/**
 * Définition unique d'un retard selon le planning applicable de l'employé.
 */
export function estPointageEnRetard (p) {
  if (p?.status !== 'present' || !p?.firstIn?.check_time) return false
  const sched = p?.scheduleInfo
  if (!sched || sched.mode === 'none' || !sched.startTime) return false
  const [h, m] = String(sched.startTime).split(':').map(Number)
  if (!Number.isFinite(h) || !Number.isFinite(m)) return false
  const startMins = h * 60 + m
  const tolerance = Number(sched.toleranceMinutes) || 0
  const checkMins = minutesDepuisMinuit(p.firstIn.check_time)
  return typeof checkMins === 'number' && checkMins > startMins + tolerance
}
