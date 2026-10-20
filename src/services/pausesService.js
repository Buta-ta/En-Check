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
  if (!pause.ouverte || !pause.debutISO) {
    return formatDuree(pause.dureeMinutes)
  }
  const startMs = new Date(pause.debutISO).getTime()
  if (!Number.isFinite(startMs)) return formatDuree(pause.dureeMinutes)
  const elapsedSec = Math.max(0, Math.floor((nowMs - startMs) / 1000))
  const hours = Math.floor(elapsedSec / 3600)
  const mins = Math.floor((elapsedSec % 3600) / 60)
  const secs = elapsedSec % 60
  if (hours > 0) {
    return `${hours}h ${String(mins).padStart(2, '0')}m ${String(secs).padStart(2, '0')}s`
  }
  return `${String(mins).padStart(2, '0')}m ${String(secs).padStart(2, '0')}s`
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
