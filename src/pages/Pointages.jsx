// ═══════════════════════════════════════════════════════════
// 📊 PAGE POINTAGES AFROFUTURISTE V3
// + ALERTES INTELLIGENTES + STATS ENRICHIES + RECHERCHE
// + TRI + SESSIONS MULTIPLES + GROUPEMENT PAR STATUT
// + PARTAGE WHATSAPP + NOM ADMIN (pas UUID)
// ═══════════════════════════════════════════════════════════
import { useState, useEffect, useMemo, useReducer, useCallback, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { useNavigate, useSearchParams } from 'react-router-dom'
import PageHeader from '../components/PageHeader'
import {
  Footprints, Calendar, Building2, Download, Users, Clock,
  UserCheck, UserX, LogIn, LogOut, ChevronLeft, ChevronRight,
  Trash2, AlertTriangle, X, Camera, Eye, Activity, ArrowRight,
  Edit, Lock, Sparkles, ShieldCheck, CheckCircle2, Ban, Timer,
  TrendingUp, MapPin, ScanFace, Search, ArrowUpDown, ChevronDown,
  ChevronUp, WifiOff, RefreshCw, Shield, Zap, BarChart3,
  AlertCircle, Info, Filter, Share2, MessageCircle, Send,
  Smartphone, Copy, Check, Upload, Radio
} from 'lucide-react'
import toast from 'react-hot-toast'
import { etiquetteEstimation, estEstimationNonValidee } from '../services/seuilsPointage'
import {
  formaterHeureLocale,
  calculerDureeSecondes,
  formaterDureeComplete,
  minutesDepuisMinuit,
  jourLocal,
  heureLocaleVersUTC,
  getHeuresMinutesLocales,
} from '../utils/timezoneUtils'

import ModifierPointage from '../components/ModifierPointage'
// import des pointages depuis une clé USB (fichier de pointeuse)
import ImporterPointages from '../components/ImporterPointages'
// la photo de pointage vient d'un bucket privé : cette pièce
// signe son adresse au moment de l'affichage (les lignes gardent leur photo_url :
// c'est elle que lit la suppression de photo juste en dessous).
import PhotoSignee from '../components/PhotoSignee'
import FeatureService, { FEATURES } from '../services/featureService'
import HolidayService from '../services/holidayService'
import { resoudrePointagesJournee } from '../services/hoursCalculator'

// ═══════════════════════════════════════════════════════════
// 🔧 REDUCER POUR GÉRER LES ÉTATS COMPLEXES
// ═══════════════════════════════════════════════════════════
const initialState = {
  pointages: [],
  entreprises: [],
  conflicts: [],
  adminsMap: {}, // Map UUID -> {first_name, last_name}
  loading: true,
  error: null,
  isOnline: typeof navigator !== 'undefined' ? navigator.onLine : true,
  lastSync: null,

  // Modals
  showDeleteModal: false,
  itemToDelete: null,
  deleteConfirmText: '',
  showModifierModal: false,
  pointageToModify: null,
  showUpgradeModal: false,
  upgradeFeatureName: '',
  showPhotoModal: false,
  selectedPhoto: null,
  showDeletePhotoModal: false,
  photoToDelete: null,
  showConflictModal: false,
  selectedConflict: null,
  conflictNote: '',
  resolvingConflict: false,
  showAlertsPanel: false,
  showShareModal: false,
  shareData: null,
  expandedCards: {},
  expandedGroups: { present: true, conflit_absence_pointage: true, en_conge: false, jour_ferie: false, absent: false },
}

function reducer(state, action) {
  switch (action.type) {
    case 'SET_POINTAGES':
      return { ...state, pointages: action.payload, loading: false, error: null, lastSync: new Date() }
    case 'SET_ENTREPRISES':
      return { ...state, entreprises: action.payload }
    case 'SET_CONFLICTS':
      return { ...state, conflicts: action.payload }
    case 'SET_ADMINS_MAP':
      return { ...state, adminsMap: action.payload }
    case 'SET_LOADING':
      return { ...state, loading: action.payload }
    case 'SET_ERROR':
      return { ...state, error: action.payload, loading: false }
    case 'SET_ONLINE':
      return { ...state, isOnline: action.payload }
    case 'OPEN_DELETE_MODAL':
      return { ...state, showDeleteModal: true, itemToDelete: action.payload, deleteConfirmText: '' }
    case 'CLOSE_DELETE_MODAL':
      return { ...state, showDeleteModal: false, itemToDelete: null, deleteConfirmText: '' }
    case 'SET_DELETE_CONFIRM_TEXT':
      return { ...state, deleteConfirmText: action.payload }
    case 'OPEN_MODIFIER_MODAL':
      return { ...state, showModifierModal: true, pointageToModify: action.payload }
    case 'CLOSE_MODIFIER_MODAL':
      return { ...state, showModifierModal: false, pointageToModify: null }
    case 'OPEN_UPGRADE_MODAL':
      return { ...state, showUpgradeModal: true, upgradeFeatureName: action.payload }
    case 'CLOSE_UPGRADE_MODAL':
      return { ...state, showUpgradeModal: false, upgradeFeatureName: '' }
    case 'OPEN_PHOTO_MODAL':
      return { ...state, showPhotoModal: true, selectedPhoto: action.payload }
    case 'CLOSE_PHOTO_MODAL':
      return { ...state, showPhotoModal: false, selectedPhoto: null }
    case 'OPEN_DELETE_PHOTO_MODAL':
      return { ...state, showDeletePhotoModal: true, photoToDelete: action.payload }
    case 'CLOSE_DELETE_PHOTO_MODAL':
      return { ...state, showDeletePhotoModal: false, photoToDelete: null }
    case 'OPEN_CONFLICT_MODAL':
      return { ...state, showConflictModal: true, selectedConflict: action.payload, conflictNote: '' }
    case 'CLOSE_CONFLICT_MODAL':
      return { ...state, showConflictModal: false, selectedConflict: null, conflictNote: '' }
    case 'SET_CONFLICT_NOTE':
      return { ...state, conflictNote: action.payload }
    case 'SET_RESOLVING_CONFLICT':
      return { ...state, resolvingConflict: action.payload }
    case 'TOGGLE_ALERTS_PANEL':
      return { ...state, showAlertsPanel: !state.showAlertsPanel }
    case 'OPEN_SHARE_MODAL':
      return { ...state, showShareModal: true, shareData: action.payload }
    case 'CLOSE_SHARE_MODAL':
      return { ...state, showShareModal: false, shareData: null }
    case 'TOGGLE_CARD_EXPANDED':
      return {
        ...state,
        expandedCards: {
          ...state.expandedCards,
          [action.payload]: !state.expandedCards[action.payload]
        }
      }
    case 'TOGGLE_GROUP_EXPANDED':
      return {
        ...state,
        expandedGroups: {
          ...state.expandedGroups,
          [action.payload]: !state.expandedGroups[action.payload]
        }
      }
    default:
      return state
  }
}

// TRADUIRE LA RAISON QUE LE SERVEUR A ÉCRITE.
//    `suspect_reason` est un code, pas une phrase : plusieurs raisons peuvent
//    être empilées, séparées par « | ». On les rend lisibles pour un gérant,
//    et on garde le code brut en dernier recours plutôt que d'inventer.
function raisonSuspect(raison) {
  if (!raison) return 'raison non précisée'

  const lisible = String(raison)
    .split('|')
    .map(brut => brut.trim())
    .filter(Boolean)
    .map(morceau => {
      if (morceau.startsWith('pointage_rapproche:rattrapage')) {
        return 'deux pointages rapprochés (relevé après coup)'
      }
      const proche = morceau.match(/^pointage_rapproche:(\d+)_secondes?$/)
      if (proche) {
        return `pointage à ${proche[1]} s du précédent`
      }
      const horloge = morceau.match(/^horloge_decalee:(-?\d+)_secondes?$/)
      if (horloge) {
        return `horloge du poste décalée de ${Math.abs(Number(horloge[1]))} s`
      }
      const horsFenetre = morceau.match(/^hors_fenetre:(\d+)_secondes?$/)
      if (horsFenetre) {
        return `pointage hors de la fenêtre autorisée (${Math.round(Number(horsFenetre[1]) / 3600)} h)`
      }
      return morceau.replace(/_/g, ' ')
    })

  return lisible.join(' · ')
}

// Vrai si la raison empilée contient une tentative de pointage antidaté :
// c'est plus grave qu'un simple décalage d'horloge.
function raisonGrave(raison) {
  const s = String(raison || '')
  return s.includes('hors_fenetre') || s.includes('delai_incoherent')
    || s.includes('delai_au_dela')
}

export { resoudrePointagesJournee }

// ═══════════════════════════════════════════════════════════
// 🔍 DÉTECTION D'ANOMALIES
// ═══════════════════════════════════════════════════════════
function detectAnomalies(pointages) {
  const anomalies = []

  pointages.forEach(p => {
    const empName = `${p.employee.first_name} ${p.employee.last_name}`
    const empId = p.employee.id

    if (p.lastOut?.is_auto_closed) {
      //  Trois états, trois messages — et ils ne veulent pas dire la même chose
      //  côté argent :
      //    · présumée EN ATTENTE  → rien n'est payé, il faut trancher ;
      //    · présumée VALIDÉE     → payé, sur décision humaine ;
      //    · REMPLACÉE            → l'employé a fini par badger : l'estimation est
      //      conservée pour mesurer l'erreur, mais ce n'est plus elle qui compte.
      const validee = !!p.lastOut.estimation_validee_le
      const remplacee = !!p.lastOut.estimation_remplacee_le
      const niveau = p.lastOut.estimation_niveau
      anomalies.push({
        type: 'auto_closed',
        severity: remplacee ? 'info' : validee ? 'info' : 'warning',
        icon: remplacee ? '✅' : validee ? '✅' : '⏳',
        employee: empName, employeeId: empId,
        message: remplacee
          ? `Sortie réelle récupérée`
          : validee
            ? `Sortie présumée validée`
            : `Sortie présumée — à valider`,
        detail: remplacee
          ? `Estimation du ${formaterHeureLocale(p.lastOut.check_time)} remplacée par un vrai badge (conservée pour l'audit)`
          : `Fermée à ${formaterHeureLocale(p.lastOut.check_time)}${niveau ? ` · Niveau ${niveau}` : ''}` +
            (validee ? ' · comptée dans la paie' : ' · NON comptée dans la paie'),
      })
    }

    if (p.firstIn) {
      const inHour = getHeuresMinutesLocales(p.firstIn.check_time).heures
      if (inHour < 5) {
        anomalies.push({
          type: 'early_arrival', severity: 'info', icon: '🌅',
          employee: empName, employeeId: empId,
          message: `Arrivée très matinale`,
          detail: `Pointage à ${formaterHeureLocale(p.firstIn.check_time)}`
        })
      }
    }

    if (p.lastOut && !p.lastOut.is_auto_closed) {
      const outHour = getHeuresMinutesLocales(p.lastOut.check_time).heures
      if (outHour >= 23 || outHour < 2) {
        anomalies.push({
          type: 'late_departure', severity: 'info', icon: '🌙',
          employee: empName, employeeId: empId,
          message: `Départ très tardif`,
          detail: `Sortie à ${formaterHeureLocale(p.lastOut.check_time)}`
        })
      }
    }

    if (p.totalSecondes > 12 * 3600) {
      anomalies.push({
        type: 'long_shift', severity: 'warning', icon: '⏰',
        employee: empName, employeeId: empId,
        message: `Shift anormalement long`,
        detail: `${formaterDureeComplete(p.totalSecondes)} travaillées`
      })
    }

    if (p.status === 'present' && p.totalSecondes > 0 && p.totalSecondes < 2 * 3600) {
      anomalies.push({
        type: 'short_shift', severity: 'info', icon: '⚡',
        employee: empName, employeeId: empId,
        message: `Shift très court`,
        detail: `Seulement ${formaterDureeComplete(p.totalSecondes)}`
      })
    }

    if (p.firstIn?.is_within_zone === false) {
      anomalies.push({
        type: 'out_of_zone', severity: 'critical', icon: '📍',
        employee: empName, employeeId: empId,
        message: `Pointage hors zone`,
        detail: p.firstIn.distance_meters
          ? `À ${p.firstIn.distance_meters < 1000 ? Math.round(p.firstIn.distance_meters) + 'm' : (p.firstIn.distance_meters / 1000).toFixed(1) + 'km'} du site`
          : 'Distance inconnue'
      })
    }

    if (p.firstIn?.gps_accuracy && p.firstIn.gps_accuracy > 100) {
      anomalies.push({
        type: 'gps_imprecise', severity: 'info', icon: '📡',
        employee: empName, employeeId: empId,
        message: `Position GPS imprécise`,
        detail: `Précision : ${Math.round(p.firstIn.gps_accuracy)}m`
      })
    }

    if (p.firstIn?.liveness_passed === false) {
      anomalies.push({
        type: 'liveness_failed', severity: 'critical', icon: '🚨',
        employee: empName, employeeId: empId,
        message: `Échec anti-spoofing`,
        detail: `Liveness non validé`
      })
    }

    if (p.firstIn?.face_score && p.firstIn.face_score < 0.7) {
      anomalies.push({
        type: 'low_face_score', severity: 'warning', icon: '👤',
        employee: empName, employeeId: empId,
        message: `Score facial faible`,
        detail: `Confiance : ${(p.firstIn.face_score * 100).toFixed(0)}%`
      })
    }

    if (p.firstIn?.face_attempts && p.firstIn.face_attempts > 3) {
      anomalies.push({
        type: 'multiple_attempts', severity: 'warning', icon: '🔄',
        employee: empName, employeeId: empId,
        message: `Tentatives multiples`,
        detail: `${p.firstIn.face_attempts} tentatives`
      })
    }

    const modifie = p.attendances.find(x => x.modifie_le)
    if (modifie) {
      anomalies.push({
        type: 'modified', severity: 'info', icon: '✏️',
        employee: empName, employeeId: empId,
        message: `Pointage modifié`,
        //  La carte dit ce qu'elle sait de source sûre : la date du geste, inscrite
        //  sur le pointage par le serveur au moment de la correction. Le nom de la
        //  personne et le motif sont dans le journal des pointages de la journée.
        detail: modifie.modifie_le
          ? `Correction faite le ${new Date(modifie.modifie_le).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })} — le journal de la journée dit par qui et pourquoi`
          : `Modification manuelle effectuée`
      })
    }

    const atts = p.attendances
    for (let i = 1; i < atts.length; i++) {
      if (atts[i].check_type === atts[i - 1].check_type) {
        anomalies.push({
          type: 'consecutive_same', severity: 'warning', icon: '🔁',
          employee: empName, employeeId: empId,
          message: `Double ${atts[i].check_type.toUpperCase()} consécutif`,
          detail: `${formaterHeureLocale(atts[i - 1].check_time)} puis ${formaterHeureLocale(atts[i].check_time)}`
        })
        break
      }
    }

    // deux pointages à quelques secondes d'intervalle, même de
    //    types DIFFÉRENTS : une entrée suivie d'une sortie 9 secondes plus tard.
    //    La règle ci-dessus ne voit que deux fois le MÊME type — ce cas-là était
    //    donc totalement invisible (il est dans la production du 25/09).
    //    C'est presque toujours un geste double sur la tablette : le premier
    //    pointage part avec le type que l'application proposait, l'employé
    //    recommence, et c'est le second qui est juste. Sans signal, la journée
    //    garde une session fantôme de quelques secondes — ou reste ouverte si
    //    l'employé est parti après le premier geste.
    //   Seuil : 60 secondes, le MÊME que côté base.
    for (let i = 1; i < atts.length; i++) {
      const ecartSecondes = Math.abs(
        (new Date(atts[i].check_time) - new Date(atts[i - 1].check_time)) / 1000
      )
      if (ecartSecondes < 60) {
        anomalies.push({
          type: 'close_punches', severity: 'warning', icon: '⏱️',
          employee: empName, employeeId: empId,
          message: `Deux pointages à ${Math.round(ecartSecondes)} s d'intervalle`,
          detail: `${formaterHeureLocale(atts[i - 1].check_time)} puis ${formaterHeureLocale(atts[i].check_time)} — à vérifier`
        })
        break
      }
    }

    // CE QUE LE SERVEUR A DÉJÀ SIGNALÉ LUI-MÊME.
    //    Jusqu'ici, toutes les alertes visibles ici étaient RECALCULÉES par le
    //    navigateur : elles ne voyaient donc rien en dehors de la journée
    //    affichée, et ignoraient ce que la base sait déjà. Or le serveur pose
    //    lui-même un drapeau (`suspect` + `suspect_reason`) depuis la 09 —
    //    horloge du poste décalée, pointage antidaté — et depuis la 20 : deux
    //    pointages à moins de 60 secondes d'intervalle. Ce drapeau n'était lu
    //    par AUCUN écran. Le voici, traduit en clair.
    const signales = atts.filter(a => a.suspect === true)
    if (signales.length > 0) {
      const dernier = signales.reduce((plusRecent, a) =>
        new Date(a.check_time) > new Date(plusRecent.check_time) ? a : plusRecent
      )
      anomalies.push({
        type: 'server_flagged',
        severity: signales.some(a => raisonGrave(a.suspect_reason))
          ? 'critical' : 'warning',
        icon: '🚩',
        employee: empName, employeeId: empId,
        message: signales.length > 1
          ? `${signales.length} pointages signalés par le serveur`
          : 'Pointage signalé par le serveur',
        detail: `${formaterHeureLocale(dernier.check_time)} — ${raisonSuspect(dernier.suspect_reason)}`
      })
    }
  })

  return anomalies
}

// ═══════════════════════════════════════════════════════════
// 📊 CALCUL STATS ENRICHIES
// ═══════════════════════════════════════════════════════════
function calculateEnrichedStats(pointages, hasOvertimeFeature) {
  const presents = pointages.filter(p => p.status === 'present')
  const totalEmployees = pointages.length
  const presentWithTime = presents.filter(p => p.totalSecondes > 0)
  const avgSeconds = presentWithTime.length > 0
    ? presentWithTime.reduce((s, p) => s + p.totalSecondes, 0) / presentWithTime.length
    : 0

  // heure d'arrivée MOYENNE calculée en heure locale de
  // l'entreprise. (L'ancien « FIX » de getHours() vers getUTCHours() avait
  // corrigé l'heure du navigateur… mais introduit l'heure du fuseau UTC.)
  const arrivals = presents.filter(p => p.firstIn).map(p => minutesDepuisMinuit(p.firstIn.check_time))

  const departures = presents.filter(p => p.lastOut).map(p => minutesDepuisMinuit(p.lastOut.check_time))

  const avgArrival = arrivals.length > 0
    ? Math.round(arrivals.reduce((s, m) => s + m, 0) / arrivals.length)
    : null
  const avgDeparture = departures.length > 0
    ? Math.round(departures.reduce((s, m) => s + m, 0) / departures.length)
    : null

  const formatMinutes = (mins) => {
    if (mins === null) return '--:--'
    const h = Math.floor(mins / 60)
    const m = mins % 60
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`
  }

  return {
    presents: presents.length,
    absents: pointages.filter(p => p.status === 'absent').length,
    en_conge: pointages.filter(p => p.status === 'en_conge').length,
    joursFeries: pointages.filter(p => p.status === 'jour_ferie').length,
    conflits: pointages.filter(p => p.status === 'conflit_absence_pointage').length,
    withPhotos: pointages.filter(p => p.hasPhoto).length,
    faceCount: pointages.filter(p => p.hasFaceRecognition && p.status === 'present').length,
    //  Oublis de badge : le dernier geste de la journée est une arrivée, et il date
    //  de plus de 8 heures — la sortie n'a jamais été pointée. Même seuil que l'alerte
    //  « Sortie manquante », pour que l'écran et la cloche disent la même chose.
    //  (L'ancienne mesure lisait un indicateur que rien ne remplissait jamais : d'où
    //  le 0 permanent.)
    autoClosedCount: (() => {
      const SEUIL_OUBLI = 8 * 3600 * 1000
      let oublis = 0
      for (const p of pointages) {
        const gestes = (p.attendances || [])
          .map((a) => ({ t: new Date(a.check_time).getTime(), type: String(a.check_type || '').toLowerCase() }))
          .filter((g) => !isNaN(g.t))
          .sort((a, b) => b.t - a.t)
        const dernier = gestes[0]
        if (dernier && dernier.type === 'in' && Date.now() - dernier.t > SEUIL_OUBLI) oublis++
      }
      return oublis
    })(),
    modifiedCount: pointages.filter(p => p.attendances.some(a => a.modifie_le)).length,
    outOfZoneCount: pointages.filter(p => p.firstIn?.is_within_zone === false).length,
    overtimeCount: pointages.filter(p => p.overtimeData?.hasOvertime).length,
    totalOvertimeSeconds: pointages.reduce((sum, p) => sum + (p.overtimeData?.totalOvertimeSeconds || 0), 0),
    totalEmployees,
    presenceRate: totalEmployees > 0 ? Math.round((presents.length / totalEmployees) * 100) : 0,
    avgWorkTime: avgSeconds,
    avgArrivalTime: formatMinutes(avgArrival),
    avgDepartureTime: formatMinutes(avgDeparture),
  }
}

// ═══════════════════════════════════════════════════════════
// 📲 GÉNÉRATION MESSAGE WHATSAPP
// ═══════════════════════════════════════════════════════════
function generateWhatsAppMessage(pointage, selectedDate) {
  const p = pointage
  const dateFormatted = new Date(selectedDate).toLocaleDateString('fr-FR', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
  })

  let statusText = ''
  let statusEmoji = ''
  switch (p.status) {
    case 'present':
      statusText = 'Présent'
      statusEmoji = '✅'
      break
    case 'absent':
      statusText = 'Absent'
      statusEmoji = '❌'
      break
    case 'en_conge':
      statusText = p.absenceReason === 'maladie' ? 'Maladie' : 'Congé'
      statusEmoji = '🌴'
      break
    case 'jour_ferie':
      statusText = 'Jour férié'
      statusEmoji = '🎌'
      break
    case 'conflit_absence_pointage':
      statusText = 'Conflit RH'
      statusEmoji = '⚠️'
      break
    default:
      statusText = 'Inconnu'
      statusEmoji = '❓'
  }

  let message = `📋 *POINTAGE — ${dateFormatted}*\n`
  message += `━━━━━━━━━━━━━━━━━\n`
  message += `👤 *${p.employee.first_name} ${p.employee.last_name}*\n`
  message += `🔢 Matricule: ${p.employee.matricule}\n`
  if (p.employee.position) {
    message += `💼 Poste: ${p.employee.position}\n`
  }
  message += `━━━━━━━━━━━━━━━━━\n`
  message += `${statusEmoji} Statut: *${statusText}*\n`

  if (p.status === 'present' || p.status === 'conflit_absence_pointage') {
    if (p.firstIn) {
      message += `⏰ Entrée: ${formaterHeureLocale(p.firstIn.check_time)}\n`
    }
    if (p.lastOut) {
      message += `⏰ Sortie: ${formaterHeureLocale(p.lastOut.check_time)}${p.lastOut.is_auto_closed ? ' _(auto)_' : ''}\n`
    }
    if (p.totalSecondes > 0) {
      message += `⏱️ Durée: *${formaterDureeComplete(p.totalSecondes)}*\n`
    }
    if (p.validPairs && p.validPairs.length > 1) {
      message += `📊 Sessions: ${p.validPairs.length}\n`
    }
  }

  message += `━━━━━━━━━━━━━━━━━\n`

  if (p.firstIn?.is_within_zone !== null && p.firstIn?.is_within_zone !== undefined) {
    message += p.firstIn.is_within_zone
      ? `📍 Position: Dans la zone ✓\n`
      : `📍 Position: ⚠️ Hors zone\n`
  }

  if (p.hasFaceRecognition) {
    message += `👤 Méthode: Reconnaissance faciale\n`
  }

  if (p.overtimeData?.hasOvertime) {
    message += `⏱️ Heures sup: ${FeatureService.formatOvertimeDisplay(p.overtimeData.totalOvertimeSeconds)}\n`
  }

  message += `━━━━━━━━━━━━━━━━━\n`
  message += `_Envoyé depuis En-Check_`

  return message
}

function generateDailyReportMessage(stats, pointages, selectedDate, entrepriseName) {
  const dateFormatted = new Date(selectedDate).toLocaleDateString('fr-FR', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
  })

  let message = `📊 *RAPPORT POINTAGES*\n`
  message += `📅 ${dateFormatted}\n`
  if (entrepriseName && entrepriseName !== 'all') {
    message += `🏢 ${entrepriseName}\n`
  }
  message += `━━━━━━━━━━━━━━━━━\n`
  message += `✅ Présents: *${stats.presents}*\n`
  message += `❌ Absents: *${stats.absents}*\n`
  message += `🌴 Congés: *${stats.en_conge}*\n`
  if (stats.joursFeries > 0) {
    message += `🎌 Jours fériés: *${stats.joursFeries}*\n`
  }
  if (stats.conflits > 0) {
    message += `⚠️ Conflits: *${stats.conflits}*\n`
  }
  message += `━━━━━━━━━━━━━━━━━\n`
  message += `📈 Taux présence: *${stats.presenceRate}%*\n`
  message += `⏱️ Temps moyen: *${formaterDureeComplete(stats.avgWorkTime)}*\n`
  message += `⏰ Arrivée moy: ${stats.avgArrivalTime}\n`
  message += `⏰ Départ moy: ${stats.avgDepartureTime}\n`

  if (stats.autoClosedCount > 0) {
    message += `━━━━━━━━━━━━━━━━━\n`
    message += `⚠️ Oublis badge: ${stats.autoClosedCount}\n`
  }
  if (stats.outOfZoneCount > 0) {
    message += `📍 Hors zone: ${stats.outOfZoneCount}\n`
  }
  if (stats.overtimeCount > 0) {
    message += `⏱️ H. Sup: ${stats.overtimeCount} employé(s)\n`
  }

  message += `━━━━━━━━━━━━━━━━━\n`
  message += `_Envoyé depuis En-Check_`

  return message
}

function shareOnWhatsApp(text, phoneNumber = null) {
  const encoded = encodeURIComponent(text)
  const url = phoneNumber
    ? `https://wa.me/${phoneNumber.replace(/[^0-9]/g, '')}?text=${encoded}`
    : `https://wa.me/?text=${encoded}`
  window.open(url, '_blank')
}

// ═══════════════════════════════════════════════════════════
// 🎯 COMPOSANT PRINCIPAL
// ═══════════════════════════════════════════════════════════
export default function Pointages() {
  const [admin, setAdmin] = useState(null)
  const [afficherImport, setAfficherImport] = useState(false)   //
  const [state, dispatch] = useReducer(reducer, initialState)
  const [searchParams, setSearchParams] = useSearchParams()
  const navigate = useNavigate()
  const loadingRef = useRef(false)

  // Filtres persistés dans l'URL
  const selectedDate = searchParams.get('date') || jourLocal(new Date()) || new Date().toISOString().split('T')[0]
  const selectedEntrepriseId = searchParams.get('entreprise') || 'all'

  // un import doit viser UNE entreprise précise. Quand le
  // filtre est sur « toutes », on retombe sur l'entreprise de l'administrateur.
  const entreprisePourImport =
    (selectedEntrepriseId && selectedEntrepriseId !== 'all')
      ? selectedEntrepriseId
      : (admin?.selectedEnterprise?.id || admin?.enterprise_id || null)
  const searchQuery = searchParams.get('q') || ''
  const filterPhotos = searchParams.get('photos') || 'all'
  const filterGPS = searchParams.get('gps') || 'tous'
  const filterMethode = searchParams.get('methode') || 'toutes'
  const filterStatus = searchParams.get('status') || 'tous'
  const sortBy = searchParams.get('sort') || 'name_asc'
  const viewMode = searchParams.get('view') || 'grouped' // 'grouped' ou 'list'

  const updateFilter = useCallback((key, value) => {
    setSearchParams(prev => {
      const next = new URLSearchParams(prev)
      if (value === '' || value === 'all' || value === 'tous' || value === 'toutes' || value === 'name_asc' || value === 'grouped') {
        next.delete(key)
      } else {
        next.set(key, value)
      }
      return next
    }, { replace: true })
  }, [setSearchParams])

  // ═════════════════════════════════════════════════════════════════════
  // ⏳ SORTIES PRÉSUMÉES — tranchage humain (arbitrage n°1, §4.1 et §5)
  // ═════════════════════════════════════════════════════════════════════
  //  Une sortie ESTIMÉE par le moteur de clôture n'est pas un badge. Elle est
  //  marquée, affichée, et EXCLUE de la paie tant qu'un humain n'a pas tranché.
  //    · « Valider »  = « cette heure est juste, on peut la payer » ;
  //    · « Écarter »  = « non » → la ligne RESTE en base (c'est la mesure de
  //      l'erreur de l'algorithme, sans elle on ne saura jamais si le Niveau 2
  //      apprend juste) mais ne sera jamais payée.
  //  Le contrôle d'autorisation est DANS la fonction SQL (`encheck_estimation_
  //  statuer`, SECURITY DEFINER + test admin interne) : un bouton caché ici ne
  //  serait pas une sécurité, seulement du maquillage.
  const [estimationEnCours, setEstimationEnCours] = useState(null)

  const statuerEstimation = async (attendanceId, action) => {
    if (!attendanceId) return
    setEstimationEnCours(`${attendanceId}:${action}`)
    try {
      const { error } = await supabase.rpc('encheck_estimation_statuer', {
        p_ids: [attendanceId],
        p_action: action,
      })
      if (error) {
        toast.error(`Le traitement de cette estimation a échoué : ${error.message}`)
      } else {
        toast.success(
          action === 'rejeter'
            ? 'Estimation écartée — la journée reste sans sortie payée.'
            : 'Estimation validée — la journée compte désormais normalement.',
        )
        await loadPointages()
      }
    } finally {
      setEstimationEnCours(null)
    }
  }

  // Permissions
  const [canEditPointages, setCanEditPointages] = useState(false)
  const [checkingPermissions, setCheckingPermissions] = useState(true)
  const [hasOvertimeFeature, setHasOvertimeFeature] = useState(false)
  const [overtimeSettings, setOvertimeSettings] = useState(null)
  const [holidaysByEnterprise, setHolidaysByEnterprise] = useState({})
  const [holidayMapsByEnterprise, setHolidayMapsByEnterprise] = useState({})

  // Détection online/offline
  useEffect(() => {
    const handleOnline = () => {
      dispatch({ type: 'SET_ONLINE', payload: true })
      toast.success('Connexion rétablie', { icon: '🌐' })
      loadPointages()
    }
    const handleOffline = () => {
      dispatch({ type: 'SET_ONLINE', payload: false })
      toast.error('Connexion perdue', { icon: '📡', duration: 5000 })
    }
    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)
    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [])

  // Init admin
  useEffect(() => {
    const adminData = localStorage.getItem('admin')
    if (!adminData) { navigate('/login'); return }
    const parsed = JSON.parse(adminData)
    setAdmin(parsed)
    if (parsed.role === 'super_admin') {
      loadEntreprises(parsed)
    } else {
      const activeId = parsed.selectedEnterprise?.id || parsed.enterprise_id
      if (!searchParams.get('entreprise')) {
        updateFilter('entreprise', activeId)
      }
    }
  }, [navigate])

  // Permissions check
  useEffect(() => {
    const check = async () => {
      if (!admin) return
      setCheckingPermissions(true)
      if (admin.role === 'super_admin') {
        setCanEditPointages(true)
        setCheckingPermissions(false)
        return
      }
      const eid = admin.selectedEnterprise?.id || admin.enterprise_id
      if (eid && eid !== 'all') {
        try {
          const ok = await FeatureService.hasFeature(eid, FEATURES.MODIFICATION_POINTAGES)
          setCanEditPointages(ok)
        } catch { setCanEditPointages(false) }
      } else { setCanEditPointages(false) }
      setCheckingPermissions(false)
    }
    check()
  }, [admin, selectedEntrepriseId])

  // Overtime feature check
  useEffect(() => {
    const check = async () => {
      if (!admin) return
      const eid = admin.role === 'super_admin'
        ? selectedEntrepriseId
        : (admin.selectedEnterprise?.id || admin.enterprise_id)

      if (!eid || eid === 'all') {
        if (admin.role === 'super_admin') {
          setHasOvertimeFeature(true)
          setOvertimeSettings({
            daily_threshold: 8, daily_threshold_major: 10,
            rate_normal: 25, rate_major: 50, rate_sunday: 100,
            rate_holiday: 100, include_weekends: true,
          })
        } else {
          setHasOvertimeFeature(false)
          setOvertimeSettings(null)
        }
        return
      }
      try {
        const has = await FeatureService.hasFeature(eid, FEATURES.HEURES_SUPPLEMENTAIRES)
        setHasOvertimeFeature(has)
        if (has) {
          const s = await FeatureService.getOvertimeSettings(eid)
          setOvertimeSettings(s)
        } else { setOvertimeSettings(null) }
      } catch {
        setHasOvertimeFeature(false)
        setOvertimeSettings(null)
      }
    }
    check()
  }, [admin, selectedEntrepriseId])

  // Chargement principal
  useEffect(() => {
    if (admin) loadPointages()
  }, [admin, selectedDate, selectedEntrepriseId])

  const loadEntreprises = async (adminData) => {
    if (adminData.role === 'super_admin') {
      const { data } = await supabase
        .from('enterprises').select('*').eq('is_active', true).order('name')
      dispatch({ type: 'SET_ENTREPRISES', payload: data || [] })
    }
  }

  const loadPointages = async () => {
    if (loadingRef.current) return
    if (!state.isOnline) {
      toast.error('Impossible de charger — vous êtes hors-ligne')
      return
    }
    loadingRef.current = true
    dispatch({ type: 'SET_LOADING', payload: true })

    try {
      let targetEid = selectedEntrepriseId
      if (admin.role !== 'super_admin') {
        targetEid = admin.selectedEnterprise?.id || admin.enterprise_id
      }

      // Charger les admins pour mapper UUID -> nom
      const { data: adminsData } = await supabase
        .from('admins')
        .select('id, first_name, last_name, email')

      const adminsMap = {}
      adminsData?.forEach(a => {
        adminsMap[a.id] = {
          first_name: a.first_name,
          last_name: a.last_name,
          email: a.email,
          fullName: `${a.first_name || ''} ${a.last_name || ''}`.trim() || a.email || 'Admin'
        }
      })
      dispatch({ type: 'SET_ADMINS_MAP', payload: adminsMap })

      let employeesQuery = supabase
        .from('employees')
        .select('*, enterprises(name, auto_close_enabled, auto_close_time, auto_close_grace_minutes)')
        .eq('is_active', true)
      if (targetEid !== 'all') employeesQuery = employeesQuery.eq('enterprise_id', targetEid)
      const { data: employees, error: empError } = await employeesQuery
      if (empError) throw empError

      // Fenêtre élargie en heure locale : de la veille (J-1) à 12:00 jusqu'au lendemain (J+1) à 14:00
      // afin d'identifier les gardes de nuit commencées à J-1 et d'inclure les sorties de nuit à J+1.
      const prevDateObj = new Date(`${selectedDate}T00:00:00Z`)
      prevDateObj.setUTCDate(prevDateObj.getUTCDate() - 1)
      const prevDateStr = prevDateObj.toISOString().split('T')[0]

      const nextDateObj = new Date(`${selectedDate}T00:00:00Z`)
      nextDateObj.setUTCDate(nextDateObj.getUTCDate() + 1)
      const nextDateStr = nextDateObj.toISOString().split('T')[0]

      const queryStartISO =
        heureLocaleVersUTC(prevDateStr, 12, 0, 0) ||
        new Date(`${prevDateStr}T12:00:00Z`).toISOString()
      const queryEndISO =
        heureLocaleVersUTC(nextDateStr, 14, 0, 0) ||
        new Date(`${nextDateStr}T14:00:00Z`).toISOString()

      // Sorties PRÉSUMÉES : `anomalie` + les quatre colonnes `estimation_*` arrivent
      // avec la migration des fondations (20261016000001). Sans elles, l'écran ne peut
      // pas distinguer « le moteur a deviné » de « l'employé a badgé » — et le manager
      // ne peut ni valider ni savoir ce qui a été écarté de la paie.
      // ⚠️ Ces explications restent ICI, en commentaire JavaScript : à l'intérieur du
      //    gabarit `.select(`...`)` elles ne sont PAS des commentaires — elles partent
      //    dans l'URL et PostgREST répond 400 (PGRST100 « failed to parse select
      //    parameter »), ce qui vide l'écran de pointages. C'est arrivé en prod le
      //    16/10. Aucun `//` ni `--` ne doit jamais entrer dans une chaîne select.
      let attQuery = supabase
        .from('attendances')
        .select(`
          id, employee_id, enterprise_id, check_time, check_type,
          method, is_auto_closed, location_lat, location_lng,
          anomalie, estimation_validee_le, estimation_remplacee_le,
          estimation_niveau, estimation_confiance,
          gps_accuracy, is_within_zone, distance_meters, geofence_id,
          face_score, face_verified, liveness_passed, face_attempts,
          notes, modifie_le, modifie_par, created_at,
          origine, decision_raison, modifie_par_employe,
          suspect, suspect_reason, clock_skew_seconds, device_id,
          pointages_photos (id, photo_url)
        `)
        .gte('check_time', queryStartISO)
        .lte('check_time', queryEndISO)
        .order('check_time', { ascending: true })

      if (targetEid !== 'all') attQuery = attQuery.eq('enterprise_id', targetEid)
      const { data: attendances, error: attError } = await attQuery
      if (attError) throw attError

      let absQuery = supabase
        .from('absences').select('*')
        .lte('start_date', selectedDate).gte('end_date', selectedDate)
      if (targetEid !== 'all') absQuery = absQuery.eq('enterprise_id', targetEid)
      const { data: absencesData } = await absQuery

      let conflictsQuery = supabase
        .from('attendance_conflicts').select('*')
        .order('created_at', { ascending: false })
      if (targetEid !== 'all') conflictsQuery = conflictsQuery.eq('enterprise_id', targetEid)
      const { data: conflictsData } = await conflictsQuery
      dispatch({ type: 'SET_CONFLICTS', payload: conflictsData || [] })

      const attendancesDuJourSeul = (attendances || []).filter(
        a => (jourLocal(a.check_time) || a.check_time.split('T')[0]) === selectedDate
      )
      await createMissingConflicts(attendancesDuJourSeul, absencesData || [], conflictsData || [])

      const { data: refreshedConflicts } = await conflictsQuery
      dispatch({ type: 'SET_CONFLICTS', payload: refreshedConflicts || [] })

      const enterpriseIds = targetEid !== 'all'
        ? [targetEid]
        : [...new Set(employees?.map(e => e.enterprise_id).filter(Boolean) || [])]

      const [allSchedules, { data: empSchedulesData }] = await Promise.all([
        FeatureService.loadSchedules(enterpriseIds),
        supabase
          .from('employee_schedules')
          .select('*, work_schedules(*)')
          .eq('is_active', true),
      ])
      const employeeSchedulesMap = {}
      ;(empSchedulesData || []).forEach(es => {
        if (es.employee_id) employeeSchedulesMap[es.employee_id] = es
      })

      const holidaySets = {}
      const holidayMaps = {}
      await Promise.all(
        enterpriseIds.map(async (entId) => {
          const holidays = await HolidayService.getHolidaysForRange(entId, selectedDate, selectedDate)
          const active = holidays.filter(h => !h.is_worked)
          holidaySets[entId] = HolidayService.buildHolidaySet(active)
          holidayMaps[entId] = HolidayService.buildHolidayMap(active)
        })
      )
      setHolidaysByEnterprise(holidaySets)
      setHolidayMapsByEnterprise(holidayMaps)

      const pointagesData = employees?.map(employee => {
        const employeeHolidaySet = holidaySets[employee.enterprise_id] || new Set()
        const employeeHolidayMap = holidayMaps[employee.enterprise_id] || new Map()
        const holidayToday = employeeHolidayMap.get(selectedDate) || null
        const isHolidayToday = employeeHolidaySet.has(selectedDate)

        const rawEmpAttendances = (attendances || []).filter(a => a.employee_id === employee.id)
        const defaultSchedule = FeatureService.getApplicableSchedule(
          employee.enterprise_id,
          selectedDate,
          allSchedules
        )
        const enterpriseCfg = {
          autoCloseEnabled: employee.enterprises?.auto_close_enabled === true,
          autoCloseTime: (employee.enterprises?.auto_close_time || '23:59:00').slice(0, 8),
          autoCloseGraceMinutes: Number(employee.enterprises?.auto_close_grace_minutes || 0),
        }
        const {
          attendances: empAttendances,
          validPairs,
          totalSecondes,
          firstIn,
          lastOut,
        } = resoudrePointagesJournee(rawEmpAttendances, selectedDate, {
          enableAutoClose: true,
          employeeSchedule: employeeSchedulesMap[employee.id] || null,
          defaultSchedule,
          enterpriseCfg,
        })

        const employeeAbsence = absencesData?.find(abs => abs.employee_id === employee.id)
        const employeeConflicts = (refreshedConflicts || []).filter(
          c => c.employee_id === employee.id && c.status === 'pending'
        )

        let status = 'absent'
        let absenceReason = null
        let conflictData = null

        if (firstIn && employeeAbsence && employeeConflicts.length > 0) {
          status = 'conflit_absence_pointage'
          absenceReason = employeeAbsence.reason
          conflictData = employeeConflicts[0]
        } else if (firstIn) {
          status = 'present'
        } else if (employeeAbsence) {
          status = 'en_conge'
          absenceReason = employeeAbsence.reason
        } else if (isHolidayToday) {
          status = 'jour_ferie'
        }

        const hasPhoto = empAttendances.some(a => a.pointages_photos?.length > 0)
        const hasFaceRecognition = empAttendances.some(
          a => a.method === 'face' || a.method === 'pin_face'
        )

        // Règle anti-fraude : aucune heure supplémentaire automatique sur un oubli de dépointage (Auto-Close)
        let overtimeData = null
        if (hasOvertimeFeature && totalSecondes > 0 && !lastOut?.is_auto_closed) {
          overtimeData = FeatureService.calculateOvertimeForEmployeeDay({
            totalWorkedSeconds: totalSecondes,
            employeeSchedule: employeeSchedulesMap[employee.id] || null,
            enterpriseId: employee.enterprise_id,
            dateStr: selectedDate,
            allSchedules,
            overtimeSettings,
            holiday: holidayToday,
          })
        }

        return {
          employee, firstIn, lastOut, totalSecondes, status,
          absenceReason, attendances: empAttendances, hasPhoto,
          conflictData, employeeAbsence, overtimeData,
          hasFaceRecognition, isHolidayToday, holidayToday, validPairs,
        }
      }) || []

      dispatch({ type: 'SET_POINTAGES', payload: pointagesData })
    } catch (error) {
      console.error('Erreur chargement pointages:', error)
      dispatch({ type: 'SET_ERROR', payload: error.message || 'Erreur lors du chargement' })
      toast.error('Erreur lors du chargement')
    }
    loadingRef.current = false
  }

  const createMissingConflicts = async (attendances, absences, existingConflicts) => {
    if (!attendances.length || !absences.length) return
    const toCreate = []
    for (const attendance of attendances) {
      const relatedAbsence = absences.find(abs => abs.employee_id === attendance.employee_id)
      if (relatedAbsence) {
        const exists = existingConflicts.some(c =>
          c.attendance_id === attendance.id &&
          c.absence_id === relatedAbsence.id &&
          c.conflict_type === 'attendance_during_absence'
        )
        if (!exists) {
          toCreate.push({
            employee_id: attendance.employee_id,
            enterprise_id: attendance.enterprise_id,
            attendance_id: attendance.id,
            absence_id: relatedAbsence.id,
            conflict_type: 'attendance_during_absence',
            status: 'pending'
          })
        }
      }
    }
    if (toCreate.length > 0) {
      try {
        const { error } = await supabase.from('attendance_conflicts').insert(toCreate)
        if (error && error.code !== '23505') console.error('Erreur création conflits:', error)
      } catch (error) { console.error('Erreur création conflits:', error) }
    }
  }

  // ═══════════════════════════════════════════════════════════
  // 🔍 FILTRAGE + TRI + RECHERCHE (MÉMORISÉ)
  // ═══════════════════════════════════════════════════════════
  const filteredAndSortedPointages = useMemo(() => {
    let result = [...state.pointages]

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim()
      result = result.filter(p =>
        `${p.employee.first_name} ${p.employee.last_name}`.toLowerCase().includes(q) ||
        p.employee.matricule?.toLowerCase().includes(q) ||
        p.employee.position?.toLowerCase().includes(q)
      )
    }

    if (filterStatus !== 'tous') {
      result = result.filter(p => p.status === filterStatus)
    }

    if (filterPhotos === 'with_photo') result = result.filter(p => p.hasPhoto)
    if (filterPhotos === 'without_photo') result = result.filter(p => !p.hasPhoto)

    if (filterGPS === 'dans_zone') result = result.filter(p => p.firstIn?.is_within_zone === true)
    if (filterGPS === 'hors_zone') result = result.filter(p => p.firstIn?.is_within_zone === false)
    if (filterGPS === 'non_verifie') result = result.filter(p => p.firstIn && p.firstIn.is_within_zone === null)

    if (filterMethode === 'face') result = result.filter(p => p.hasFaceRecognition)
    if (filterMethode === 'sans_face') result = result.filter(p => !p.hasFaceRecognition && p.status === 'present')

    result.sort((a, b) => {
      switch (sortBy) {
        case 'name_asc':
          return `${a.employee.last_name}`.localeCompare(`${b.employee.last_name}`)
        case 'name_desc':
          return `${b.employee.last_name}`.localeCompare(`${a.employee.last_name}`)
        case 'arrival_asc':
          if (!a.firstIn) return 1
          if (!b.firstIn) return -1
          return a.firstIn.check_time.localeCompare(b.firstIn.check_time)
        case 'arrival_desc':
          if (!a.firstIn) return 1
          if (!b.firstIn) return -1
          return b.firstIn.check_time.localeCompare(a.firstIn.check_time)
        case 'duration_desc':
          return b.totalSecondes - a.totalSecondes
        case 'duration_asc':
          return a.totalSecondes - b.totalSecondes
        case 'status':
          const statusOrder = { conflit_absence_pointage: 0, present: 1, en_conge: 2, jour_ferie: 3, absent: 4 }
          return (statusOrder[a.status] || 5) - (statusOrder[b.status] || 5)
        case 'overtime_desc':
          return (b.overtimeData?.totalOvertimeSeconds || 0) - (a.overtimeData?.totalOvertimeSeconds || 0)
        default:
          return 0
      }
    })

    return result
  }, [state.pointages, searchQuery, filterStatus, filterPhotos, filterGPS, filterMethode, sortBy])

  // Groupement par statut
  const groupedPointages = useMemo(() => {
    const groups = {
      present: { label: 'Présents', emoji: '✅', color: '#10B981', items: [] },
      conflit_absence_pointage: { label: 'Conflits RH', emoji: '⚠️', color: '#F97316', items: [] },
      en_conge: { label: 'Congés / Absences justifiées', emoji: '🌴', color: '#8B5CF6', items: [] },
      jour_ferie: { label: 'Jours fériés', emoji: '🎌', color: '#8B5CF6', items: [] },
      absent: { label: 'Absents', emoji: '❌', color: '#EF4444', items: [] },
    }
    filteredAndSortedPointages.forEach(p => {
      if (groups[p.status]) {
        groups[p.status].items.push(p)
      }
    })
    return groups
  }, [filteredAndSortedPointages])

  // Anomalies
  const anomalies = useMemo(() => detectAnomalies(state.pointages), [state.pointages])

  // Stats
  const stats = useMemo(
    () => calculateEnrichedStats(state.pointages, hasOvertimeFeature),
    [state.pointages, hasOvertimeFeature]
  )

  // ═══════════════════════════════════════════════════════════
  // 🎬 ACTIONS
  // ═══════════════════════════════════════════════════════════
  const changeDate = (days) => {
    const date = new Date(selectedDate)
    date.setDate(date.getDate() + days)
    updateFilter('date', date.toISOString().split('T')[0])
  }

  const formatDate = (dateStr) => {
    return new Date(dateStr).toLocaleDateString('fr-FR', {
      weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
    })
  }

  const getAdminName = (adminId) => {
    if (!adminId) return null
    const admin = state.adminsMap[adminId]
    return admin ? admin.fullName : adminId.substring(0, 8) + '...'
  }

  const getMethodeDisplay = (method) => {
    switch (method) {
      case 'face': return { icon: '👤', label: 'Visage' }
      case 'pin_face': return { icon: '🔢👤', label: 'PIN+Visage' }
      case 'qr_code': return { icon: '📷', label: 'QR Code' }
      case 'qr_photo': return { icon: '📷', label: 'QR+Photo' }
      case 'pin_photo': return { icon: '🔢📸', label: 'PIN+Photo' }
      default: return { icon: '🔢', label: 'PIN' }
    }
  }

  // Photos
  const openPhotoModal = (attendance, employee) => {
    const photo = attendance.pointages_photos?.[0]
    if (photo) {
      dispatch({
        type: 'OPEN_PHOTO_MODAL',
        payload: { ...photo, employee, attendance, check_time: attendance.check_time, check_type: attendance.check_type }
      })
    }
  }

  const handleDeletePhoto = async () => {
    if (!state.photoToDelete) return
    dispatch({ type: 'SET_LOADING', payload: true })
    try {
      const urlParts = state.photoToDelete.photo_url.split('/attendance-photos/')
      const filePath = urlParts[1]
      if (filePath) await supabase.storage.from('attendance-photos').remove([filePath])
      const { error } = await supabase.from('pointages_photos').delete().eq('id', state.photoToDelete.id)
      if (error) throw error
      toast.success('Photo supprimée')
      dispatch({ type: 'CLOSE_PHOTO_MODAL' })
      dispatch({ type: 'CLOSE_DELETE_PHOTO_MODAL' })
      loadPointages()
    } catch {
      toast.error('Erreur lors de la suppression')
    }
    dispatch({ type: 'SET_LOADING', payload: false })
  }

  // Suppression
  const getDeleteTargetName = () => {
    if (!state.itemToDelete) return ''
    const p = state.pointages.find(p => p.employee.id === state.itemToDelete)
    return p ? `${p.employee.first_name} ${p.employee.last_name}` : ''
  }

  const isDeleteConfirmed = () => {
    const target = getDeleteTargetName()
    return state.deleteConfirmText.trim().toLowerCase() === target.toLowerCase()
  }

  const handleDelete = async () => {
    if (!state.itemToDelete || !isDeleteConfirmed()) return
    dispatch({ type: 'SET_LOADING', payload: true })
    try {
      const startOfDay = `${selectedDate}T00:00:00`
      const endOfDay = `${selectedDate}T23:59:59`
      const { error } = await supabase.from('attendances').delete()
        .eq('employee_id', state.itemToDelete)
        .gte('check_time', startOfDay).lte('check_time', endOfDay)
      if (error) throw error
      toast.success('Pointages supprimés')
      loadPointages()
      dispatch({ type: 'CLOSE_DELETE_MODAL' })
    } catch {
      toast.error('Impossible de supprimer')
    }
    dispatch({ type: 'SET_LOADING', payload: false })
  }

  const handleEditClick = async (employeeId) => {
    if (!canEditPointages) {
      dispatch({ type: 'OPEN_UPGRADE_MODAL', payload: 'Modification des Pointages' })
      return
    }
    const p = state.pointages.find(p => p.employee.id === employeeId)
    if (p && p.attendances.length > 0) {
      const modifiedAtts = p.attendances.filter(a => a.modifie_le)
      if (modifiedAtts.length > 0) {
        const latestModified = modifiedAtts.sort((a, b) =>
          new Date(b.modifie_le) - new Date(a.modifie_le)
        )[0]
        try {
          const { data: freshAtt } = await supabase
            .from('attendances')
            .select('modifie_le')
            .eq('id', latestModified.id)
            .single()

          if (freshAtt && freshAtt.modifie_le !== latestModified.modifie_le) {
            toast.error('Ce pointage a été modifié par quelqu\'un d\'autre. Rechargement...', { duration: 4000 })
            loadPointages()
            return
          }
        } catch { }
      }
    }
    dispatch({ type: 'OPEN_MODIFIER_MODAL', payload: employeeId })
  }

  // Conflits
  const canManageConflict = ['admin', 'manager', 'super_admin'].includes(admin?.role)

  const resolveConflict = async (action) => {
    if (!state.selectedConflict?.conflictData) return
    dispatch({ type: 'SET_RESOLVING_CONFLICT', payload: true })
    try {
      const conflictId = state.selectedConflict.conflictData.id
      const absenceId = state.selectedConflict.employeeAbsence?.id

      if (action === 'kept_absence') {
        const { error } = await supabase.from('attendance_conflicts').update({
          status: 'resolved', resolution_action: 'kept_absence',
          notes: state.conflictNote || 'Absence maintenue',
          resolved_by: admin.id, resolved_at: new Date().toISOString()
        }).eq('id', conflictId)
        if (error) throw error
        toast.success('Conflit résolu')
      } else if (action === 'cancelled_absence') {
        if (absenceId) {
          const { error: delErr } = await supabase.from('absences').delete().eq('id', absenceId)
          if (delErr) throw delErr
        }
        const { error } = await supabase.from('attendance_conflicts').update({
          status: 'resolved', resolution_action: 'cancelled_absence',
          notes: state.conflictNote || 'Absence annulée',
          resolved_by: admin.id, resolved_at: new Date().toISOString()
        }).eq('id', conflictId)
        if (error) throw error
        toast.success('Conflit résolu')
      } else if (action === 'ignored_conflict') {
        const { error } = await supabase.from('attendance_conflicts').update({
          status: 'ignored', resolution_action: 'ignored_conflict',
          notes: state.conflictNote || 'Conflit ignoré',
          resolved_by: admin.id, resolved_at: new Date().toISOString()
        }).eq('id', conflictId)
        if (error) throw error
        toast.success('Conflit ignoré')
      }
      dispatch({ type: 'CLOSE_CONFLICT_MODAL' })
      loadPointages()
    } catch {
      toast.error('Erreur lors de la résolution')
    }
    dispatch({ type: 'SET_RESOLVING_CONFLICT', payload: false })
  }

  // Partage WhatsApp
  const handleShareEmployee = (pointage) => {
    const message = generateWhatsAppMessage(pointage, selectedDate)
    dispatch({ type: 'OPEN_SHARE_MODAL', payload: { type: 'employee', pointage, message } })
  }

  const handleShareDailyReport = () => {
    const entrepriseName = selectedEntrepriseId !== 'all'
      ? state.entreprises.find(e => e.id === selectedEntrepriseId)?.name || ''
      : ''
    const message = generateDailyReportMessage(stats, filteredAndSortedPointages, selectedDate, entrepriseName)
    dispatch({ type: 'OPEN_SHARE_MODAL', payload: { type: 'report', message } })
  }

  const copyToClipboard = async (text) => {
    try {
      await navigator.clipboard.writeText(text)
      toast.success('Copié dans le presse-papier')
    } catch {
      toast.error('Impossible de copier')
    }
  }

  // Export CSV
  const exportCSV = () => {
    const headers = [
      'Matricule', 'Nom', 'Prénom', 'Poste', 'Entrée', 'Sortie',
      'Temps total', 'Nb sessions', 'Statut', 'Méthode', 'Reco Faciale',
      'Score Facial', 'Liveness', 'Photo', 'Oubli Badge', 'Dans Zone GPS',
      'Distance (m)', 'Précision GPS (m)', 'Conflit', 'Modifié', 'Modifié par', 'Notes',
      ...(hasOvertimeFeature ? ['Heures Sup', 'H.Sup Majorées', 'Taux Normal', 'Taux Majoré'] : [])
    ]

    const escape = (v) => {
      if (v == null) return ''
      const s = String(v)
      return s.includes(',') || s.includes('"') || s.includes('\n') || s.includes(';')
        ? `"${s.replace(/"/g, '""')}"` : s
    }

    const rows = filteredAndSortedPointages.map(p => {
      const modifiedBy = p.attendances.find(a => a.modifie_par)?.modifie_par
      return [
        escape(p.employee.matricule),
        escape(p.employee.last_name),
        escape(p.employee.first_name),
        escape(p.employee.position),
        escape(formaterHeureLocale(p.firstIn?.check_time)),
        escape(formaterHeureLocale(p.lastOut?.check_time)),
        escape(formaterDureeComplete(p.totalSecondes)),
        p.validPairs?.length || 0,
        escape(p.status === 'present' ? 'Présent'
          : p.status === 'en_conge' ? 'En congé'
            : p.status === 'jour_ferie' ? 'Jour férié'
              : p.status === 'conflit_absence_pointage' ? 'Conflit'
                : 'Absent'),
        escape(p.firstIn?.method || ''),
        p.hasFaceRecognition ? 'Oui' : 'Non',
        p.firstIn?.face_score ? (p.firstIn.face_score * 100).toFixed(0) + '%' : '',
        p.firstIn?.liveness_passed === true ? 'OK' : p.firstIn?.liveness_passed === false ? 'KO' : '',
        p.hasPhoto ? 'Oui' : 'Non',
        p.lastOut?.is_auto_closed
          ? (p.lastOut.estimation_validee_le ? 'Oui — validée' : 'Oui — PRÉSUMÉE, non payée')
          : 'Non',
        p.firstIn?.is_within_zone === true ? 'Oui' : p.firstIn?.is_within_zone === false ? 'Non' : '',
        p.firstIn?.distance_meters != null ? Math.round(p.firstIn.distance_meters) : '',
        p.firstIn?.gps_accuracy != null ? Math.round(p.firstIn.gps_accuracy) : '',
        p.status === 'conflit_absence_pointage' ? 'Oui' : 'Non',
        p.attendances.some(a => a.modifie_le) ? 'Oui' : 'Non',
        escape(modifiedBy ? getAdminName(modifiedBy) : ''),
        escape(p.attendances.find(a => a.notes)?.notes || ''),
        ...(hasOvertimeFeature ? [
          p.overtimeData?.hasOvertime ? escape(formaterDureeComplete(p.overtimeData.overtimeSeconds)) : '0',
          p.overtimeData?.overtimeMajorSeconds ? escape(formaterDureeComplete(p.overtimeData.overtimeMajorSeconds)) : '0',
          p.overtimeData?.hasOvertime ? `${p.overtimeData.rateApplied}%` : '',
          p.overtimeData?.overtimeMajorSeconds ? `${p.overtimeData.rateMajorApplied}%` : '',
        ] : [])
      ]
    })

    const BOM = '\uFEFF'
    const csvContent = BOM + [headers.join(';'), ...rows.map(row => row.join(';'))].join('\n')
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement('a')
    link.href = URL.createObjectURL(blob)
    link.download = `pointages_${selectedDate}.csv`
    link.click()
  }

  // ═══════════════════════════════════════════════════════════
  // 🎨 RENDER
  // ═══════════════════════════════════════════════════════════

  // Skeleton Loading
  if (state.loading && !state.pointages.length) {
    return (
      <>
        <style>{skeletonCSS}</style>
        <div style={styles.container}>
          <div style={styles.bgPattern}></div>
          <PageHeader title="POINTAGES" />
          <main style={styles.main}>
            <SkeletonLoader />
          </main>
        </div>
      </>
    )
  }

  // État d'erreur
  if (state.error) {
    return (
      <div style={styles.container}>
        <div style={styles.bgPattern}></div>
        <PageHeader title="POINTAGES" />
        <main style={styles.main}>
          <div style={styles.errorContainer}>
            <div style={styles.errorIcon}><AlertTriangle size={48} color="#EF4444" /></div>
            <h2 style={styles.errorTitle}>Erreur de chargement</h2>
            <p style={styles.errorMessage}>{state.error}</p>
            <button onClick={loadPointages} style={styles.retryBtn}>
              <RefreshCw size={18} />
              <span>Réessayer</span>
            </button>
          </div>
        </main>
      </div>
    )
  }

  const activeFiltersCount = [
    searchQuery, filterStatus !== 'tous', filterPhotos !== 'all',
    filterGPS !== 'tous', filterMethode !== 'toutes'
  ].filter(Boolean).length

  const anomaliesCritical = anomalies.filter(a => a.severity === 'critical')
  const anomaliesWarning = anomalies.filter(a => a.severity === 'warning')

  return (
    <>
      <style>{componentCSS}</style>

      <div style={styles.container}>
        <div style={styles.bgPattern}></div>
        <div style={styles.bgOrb1}></div>
        <div style={styles.bgOrb2}></div>

        {/* Offline banner */}
        {!state.isOnline && (
          <div style={styles.offlineBanner} role="alert">
            <WifiOff size={18} />
            <span>Vous êtes hors-ligne</span>
          </div>
        )}

        <PageHeader title="POINTAGES" />

        <main style={styles.main}>
          {/* ═══ TITRE + BADGES ═══ */}
          <div style={styles.titleSection}>
            <div style={styles.titleLeft}>
              <div style={styles.titleIcon}>
                <Clock size={24} color="#F59E0B" />
              </div>
              <div>
                <h2 style={styles.pageTitle}>Suivi des Pointages</h2>
                <p style={styles.pageSubtitle}>{formatDate(selectedDate)}</p>
              </div>
            </div>
            <div style={styles.titleRight}>
              {!checkingPermissions && (
                <div style={{
                  ...styles.permBadge,
                  background: canEditPointages ? 'rgba(16,185,129,0.1)' : 'rgba(245,158,11,0.1)',
                  borderColor: canEditPointages ? 'rgba(16,185,129,0.25)' : 'rgba(245,158,11,0.25)',
                  color: canEditPointages ? '#10B981' : '#F59E0B'
                }}>
                  {canEditPointages ? <><Edit size={12} /> Modif. ON</> : <><Lock size={12} /> Lecture</>}
                </div>
              )}
              {anomalies.length > 0 && (
                <button
                  onClick={() => dispatch({ type: 'TOGGLE_ALERTS_PANEL' })}
                  style={{
                    ...styles.alertsBadge,
                    background: anomaliesCritical.length > 0 ? 'rgba(239,68,68,0.12)' : 'rgba(249,115,22,0.12)',
                    borderColor: anomaliesCritical.length > 0 ? 'rgba(239,68,68,0.3)' : 'rgba(249,115,22,0.25)',
                    color: anomaliesCritical.length > 0 ? '#EF4444' : '#F97316',
                  }}
                  aria-label={`${anomalies.length} alertes`}
                >
                  <AlertTriangle size={14} />
                  <span>{anomalies.length}</span>
                </button>
              )}
              <button onClick={handleShareDailyReport} style={styles.shareReportBtn} aria-label="Partager rapport">
                <Share2 size={14} />
                <span className="desktop-only">Partager</span>
              </button>
            </div>
          </div>

          {/* ═══ PANNEAU ALERTES ═══ */}
          {state.showAlertsPanel && anomalies.length > 0 && (
            <AlertsPanel
              anomalies={anomalies}
              onClose={() => dispatch({ type: 'TOGGLE_ALERTS_PANEL' })}
            />
          )}

          {/* ═══ FILTRES ═══ */}
          <FiltersSection
            selectedDate={selectedDate}
            selectedEntrepriseId={selectedEntrepriseId}
            searchQuery={searchQuery}
            filterStatus={filterStatus}
            filterMethode={filterMethode}
            filterPhotos={filterPhotos}
            filterGPS={filterGPS}
            sortBy={sortBy}
            viewMode={viewMode}
            entreprises={state.entreprises}
            admin={admin}
            hasOvertimeFeature={hasOvertimeFeature}
            activeFiltersCount={activeFiltersCount}
            loading={state.loading}
            onChangeDate={changeDate}
            onUpdateFilter={updateFilter}
            onExportCSV={exportCSV}
            onImport={() => setAfficherImport(true)}
            onRefresh={loadPointages}
            onResetFilters={() => {
              setSearchParams(prev => {
                const next = new URLSearchParams()
                if (prev.get('date')) next.set('date', prev.get('date'))
                if (prev.get('entreprise')) next.set('entreprise', prev.get('entreprise'))
                return next
              }, { replace: true })
            }}
          />

          {/* ═══ STATS ═══ */}
          <StatsSection stats={stats} hasOvertimeFeature={hasOvertimeFeature} />

          {/* ═══ LISTE HEADER ═══ */}
          <div style={styles.listHeader}>
            <div style={styles.listHeaderLeft}>
              <div style={styles.listHeaderIcon}>
                <Users size={18} color="#F59E0B" />
              </div>
              <h3 style={styles.listTitle}>
                Détail des présences
                <span style={styles.listCount}>{filteredAndSortedPointages.length}</span>
                {filteredAndSortedPointages.length !== state.pointages.length && (
                  <span style={styles.listFiltered}>/ {state.pointages.length}</span>
                )}
              </h3>
            </div>
            <div style={styles.listHeaderRight}>
              <button
                onClick={() => updateFilter('view', viewMode === 'grouped' ? 'list' : 'grouped')}
                style={styles.viewToggleBtn}
                aria-label="Changer de vue"
              >
                {viewMode === 'grouped' ? <BarChart3 size={14} /> : <Users size={14} />}
                <span className="desktop-only">{viewMode === 'grouped' ? 'Vue groupée' : 'Vue liste'}</span>
              </button>
              {state.loading && state.pointages.length > 0 && (
                <RefreshCw size={16} className="spin-icon" color="#F59E0B" />
              )}
            </div>
          </div>

          {/* ═══ LISTE DES POINTAGES ═══ */}
          {filteredAndSortedPointages.length === 0 ? (
            <EmptyState
              searchQuery={searchQuery}
              activeFiltersCount={activeFiltersCount}
              onResetFilters={() => {
                setSearchParams(prev => {
                  const next = new URLSearchParams()
                  if (prev.get('date')) next.set('date', prev.get('date'))
                  if (prev.get('entreprise')) next.set('entreprise', prev.get('entreprise'))
                  return next
                }, { replace: true })
              }}
            />
          ) : viewMode === 'grouped' ? (
            <GroupedList
              groups={groupedPointages}
              expandedGroups={state.expandedGroups}
              expandedCards={state.expandedCards}
              adminsMap={state.adminsMap}
              canEdit={canEditPointages}
              statuerEstimation={statuerEstimation}
              estimationEnCours={estimationEnCours}
              canManageConflict={canManageConflict}
              hasOvertimeFeature={hasOvertimeFeature}
              anomalies={anomalies}
              onToggleGroup={(status) => dispatch({ type: 'TOGGLE_GROUP_EXPANDED', payload: status })}
              onToggleCard={(id) => dispatch({ type: 'TOGGLE_CARD_EXPANDED', payload: id })}
              onEdit={handleEditClick}
              onDelete={(id) => dispatch({ type: 'OPEN_DELETE_MODAL', payload: id })}
              onConflict={(p) => dispatch({ type: 'OPEN_CONFLICT_MODAL', payload: p })}
              onPhotoClick={openPhotoModal}
              onShare={handleShareEmployee}
              getMethodeDisplay={getMethodeDisplay}
              getAdminName={getAdminName}
            />
          ) : (
            <FlatList
              pointages={filteredAndSortedPointages}
              expandedCards={state.expandedCards}
              adminsMap={state.adminsMap}
              canEdit={canEditPointages}
              statuerEstimation={statuerEstimation}
              estimationEnCours={estimationEnCours}
              canManageConflict={canManageConflict}
              hasOvertimeFeature={hasOvertimeFeature}
              anomalies={anomalies}
              onToggleCard={(id) => dispatch({ type: 'TOGGLE_CARD_EXPANDED', payload: id })}
              onEdit={handleEditClick}
              onDelete={(id) => dispatch({ type: 'OPEN_DELETE_MODAL', payload: id })}
              onConflict={(p) => dispatch({ type: 'OPEN_CONFLICT_MODAL', payload: p })}
              onPhotoClick={openPhotoModal}
              onShare={handleShareEmployee}
              getMethodeDisplay={getMethodeDisplay}
              getAdminName={getAdminName}
            />
          )}
        </main>

        {/* ═══ MODALS ═══ */}

        {/* Modal Suppression */}
        {state.showDeleteModal && (
          <DeleteModal
            targetName={getDeleteTargetName()}
            confirmText={state.deleteConfirmText}
            isConfirmed={isDeleteConfirmed()}
            selectedDate={selectedDate}
            formatDate={formatDate}
            onConfirmTextChange={(t) => dispatch({ type: 'SET_DELETE_CONFIRM_TEXT', payload: t })}
            onCancel={() => dispatch({ type: 'CLOSE_DELETE_MODAL' })}
            onConfirm={handleDelete}
          />
        )}

        {/* Modal Photo */}
        {state.showPhotoModal && state.selectedPhoto && (
          <PhotoModal
            photo={state.selectedPhoto}
            onClose={() => dispatch({ type: 'CLOSE_PHOTO_MODAL' })}
            onDelete={() => dispatch({ type: 'OPEN_DELETE_PHOTO_MODAL', payload: state.selectedPhoto })}
          />
        )}

        {/* Modal Suppression Photo */}
        {state.showDeletePhotoModal && (
          <ConfirmModal
            icon={<Camera size={28} color="#6366F1" />}
            iconBg="rgba(99,102,241,0.15)"
            title="Supprimer la photo ?"
            text="Cette action est irréversible."
            onCancel={() => dispatch({ type: 'CLOSE_DELETE_PHOTO_MODAL' })}
            onConfirm={handleDeletePhoto}
            confirmLabel="Supprimer"
          />
        )}

        {/* Modal Upgrade */}
        {state.showUpgradeModal && (
          <UpgradeModal
            featureName={state.upgradeFeatureName}
            onClose={() => dispatch({ type: 'CLOSE_UPGRADE_MODAL' })}
          />
        )}

        {/* Modal Conflit */}
        {state.showConflictModal && state.selectedConflict && (
          <ConflictModal
            conflict={state.selectedConflict}
            conflictNote={state.conflictNote}
            resolving={state.resolvingConflict}
            onNoteChange={(n) => dispatch({ type: 'SET_CONFLICT_NOTE', payload: n })}
            onResolve={resolveConflict}
            onClose={() => dispatch({ type: 'CLOSE_CONFLICT_MODAL' })}
          />
        )}

        {/* Modal Partage WhatsApp */}
        {state.showShareModal && state.shareData && (
          <ShareModal
            data={state.shareData}
            onClose={() => dispatch({ type: 'CLOSE_SHARE_MODAL' })}
            onShareWhatsApp={(msg, phone) => shareOnWhatsApp(msg, phone)}
            onCopy={copyToClipboard}
          />
        )}

        {/* import depuis une pointeuse (fichier USB) */}
        <ImporterPointages
          open={afficherImport}
          onClose={() => setAfficherImport(false)}
          enterpriseId={entreprisePourImport}
          onImported={() => { loadPointages(); }}
        />

        {state.showModifierModal && (
          <ModifierPointage
            employeeId={state.pointageToModify}
            selectedDate={selectedDate}
            pointagesJournee={(() => {
              const employeeData = state.pointages.find(p => p.employee.id === state.pointageToModify)
              return employeeData?.attendances || []
            })()}
            onClose={() => dispatch({ type: 'CLOSE_MODIFIER_MODAL' })}
            onSuccess={loadPointages}
          />
        )}
      </div>
    </>
  )
}

// ═══════════════════════════════════════════════════════════
// 📦 SOUS-COMPOSANTS
// ═══════════════════════════════════════════════════════════

function SkeletonLoader() {
  return (
    <>
      <div className="skeleton-header">
        <div className="skeleton-bar skeleton-bar-lg"></div>
        <div className="skeleton-bar skeleton-bar-sm"></div>
      </div>
      <div className="skeleton-filters">
        {[1, 2, 3, 4].map(i => <div key={i} className="skeleton-bar skeleton-bar-filter"></div>)}
      </div>
      <div className="skeleton-stats-grid">
        {[1, 2, 3, 4, 5, 6].map(i => (
          <div key={i} className="skeleton-stat-card">
            <div className="skeleton-circle"></div>
            <div className="skeleton-stat-text">
              <div className="skeleton-bar skeleton-bar-number"></div>
              <div className="skeleton-bar skeleton-bar-label"></div>
            </div>
          </div>
        ))}
      </div>
      {[1, 2, 3, 4, 5].map(i => (
        <div key={i} className="skeleton-card" style={{ animationDelay: `${i * 0.1}s` }}>
          <div className="skeleton-card-top">
            <div className="skeleton-avatar"></div>
            <div className="skeleton-card-info">
              <div className="skeleton-bar skeleton-bar-name"></div>
              <div className="skeleton-bar skeleton-bar-meta"></div>
            </div>
            <div className="skeleton-bar skeleton-bar-badge"></div>
          </div>
        </div>
      ))}
    </>
  )
}

function AlertsPanel({ anomalies, onClose }) {
  const critical = anomalies.filter(a => a.severity === 'critical')
  const warning = anomalies.filter(a => a.severity === 'warning')
  const info = anomalies.filter(a => a.severity === 'info')

  return (
    <div style={styles.alertsPanel} role="region" aria-label="Alertes du jour">
      <div style={styles.alertsPanelHeader}>
        <div style={styles.alertsPanelTitle}>
          <AlertTriangle size={18} color="#F97316" />
          <span>Alertes du jour</span>
          <span style={styles.alertsPanelCount}>{anomalies.length}</span>
        </div>
        <button onClick={onClose} style={styles.alertsCloseBtn} aria-label="Fermer">
          <X size={16} />
        </button>
      </div>

      {critical.length > 0 && (
        <div style={styles.alertSection}>
          <div style={{ ...styles.alertSectionTitle, color: '#EF4444' }}>
            🚨 Critiques ({critical.length})
          </div>
          {critical.map((a, i) => (
            <div key={`c-${i}`} style={{ ...styles.alertItem, borderColor: 'rgba(239,68,68,0.2)' }}>
              <span style={styles.alertIcon}>{a.icon}</span>
              <div style={styles.alertContent}>
                <span style={styles.alertEmployee}>{a.employee}</span>
                <span style={styles.alertMessage}>{a.message}</span>
                <span style={styles.alertDetail}>{a.detail}</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {warning.length > 0 && (
        <div style={styles.alertSection}>
          <div style={{ ...styles.alertSectionTitle, color: '#F59E0B' }}>
            ⚠️ Avertissements ({warning.length})
          </div>
          {warning.map((a, i) => (
            <div key={`w-${i}`} style={{ ...styles.alertItem, borderColor: 'rgba(245,158,11,0.2)' }}>
              <span style={styles.alertIcon}>{a.icon}</span>
              <div style={styles.alertContent}>
                <span style={styles.alertEmployee}>{a.employee}</span>
                <span style={styles.alertMessage}>{a.message}</span>
                <span style={styles.alertDetail}>{a.detail}</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {info.length > 0 && (
        <div style={styles.alertSection}>
          <div style={{ ...styles.alertSectionTitle, color: '#6366F1' }}>
            ℹ️ Informations ({info.length})
          </div>
          {info.map((a, i) => (
            <div key={`i-${i}`} style={{ ...styles.alertItem, borderColor: 'rgba(99,102,241,0.15)' }}>
              <span style={styles.alertIcon}>{a.icon}</span>
              <div style={styles.alertContent}>
                <span style={styles.alertEmployee}>{a.employee}</span>
                <span style={styles.alertMessage}>{a.message}</span>
                <span style={styles.alertDetail}>{a.detail}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ═══════════════════════════════════════════════════════════
function FiltersSection({
  selectedDate, selectedEntrepriseId, searchQuery,
  filterStatus, filterMethode, filterPhotos, filterGPS,
  sortBy, viewMode, entreprises, admin, hasOvertimeFeature,
  activeFiltersCount, loading,
  onChangeDate, onUpdateFilter, onExportCSV, onImport, onRefresh, onResetFilters
}) {
  const formatDateShort = (dateStr) => {
    return new Date(dateStr).toLocaleDateString('fr-FR', {
      weekday: 'short', day: 'numeric', month: 'short'
    })
  }

  return (
    <div style={styles.filtersContainer}>
      {/* Navigation date */}
      <div style={styles.dateNavRow}>
        <button
          className="afro-nav-btn"
          onClick={() => onChangeDate(-1)}
          style={styles.dateNavBtn}
          aria-label="Jour précédent"
        >
          <ChevronLeft size={20} />
        </button>

        <div style={styles.dateInputWrap}>
          <Calendar size={16} color="#F59E0B" />
          <input
            type="date"
            value={selectedDate}
            onChange={(e) => onUpdateFilter('date', e.target.value)}
            style={styles.dateInput}
            aria-label="Sélectionner une date"
          />
        </div>

        <button
          className="afro-nav-btn"
          onClick={() => onChangeDate(1)}
          style={styles.dateNavBtn}
          aria-label="Jour suivant"
        >
          <ChevronRight size={20} />
        </button>

        <button
          className="afro-nav-btn"
          onClick={() => onUpdateFilter('date', jourLocal(new Date()) || new Date().toISOString().split('T')[0])}
          style={{ ...styles.dateNavBtn, padding: '8px 14px', fontSize: '12px', fontWeight: '700', color: '#F59E0B' }}
          aria-label="Aujourd'hui"
        >
          Auj.
        </button>
      </div>

      {/* Barre de recherche */}
      <div style={styles.searchRow}>
        <div style={styles.searchInputWrap}>
          <Search size={16} color="#888" />
          <input
            type="text"
            placeholder="Rechercher (nom, matricule, poste)..."
            value={searchQuery}
            onChange={(e) => onUpdateFilter('q', e.target.value)}
            style={styles.searchInput}
            aria-label="Rechercher un employé"
          />
          {searchQuery && (
            <button
              onClick={() => onUpdateFilter('q', '')}
              style={styles.searchClearBtn}
              aria-label="Effacer"
            >
              <X size={14} />
            </button>
          )}
        </div>

        {activeFiltersCount > 0 && (
          <button onClick={onResetFilters} style={styles.clearAllFiltersBtn}>
            <X size={14} />
            <span>{activeFiltersCount} filtre{activeFiltersCount > 1 ? 's' : ''}</span>
          </button>
        )}
      </div>

      {/* Filtres */}
      <div style={styles.filterRow}>
        {admin?.role === 'super_admin' && (
          <div style={styles.filterGroup}>
            <Building2 size={14} color="#F59E0B" />
            <select
              value={selectedEntrepriseId}
              onChange={(e) => onUpdateFilter('entreprise', e.target.value)}
              style={styles.filterSelect}
              aria-label="Filtrer par entreprise"
            >
              <option value="all">Toutes les entreprises</option>
              {entreprises.map(ent => (
                <option key={ent.id} value={ent.id}>{ent.name}</option>
              ))}
            </select>
          </div>
        )}

        <div style={styles.filterGroup}>
          <Filter size={14} color="#10B981" />
          <select
            value={filterStatus}
            onChange={(e) => onUpdateFilter('status', e.target.value)}
            style={styles.filterSelect}
            aria-label="Filtrer par statut"
          >
            <option value="tous">Tous les statuts</option>
            <option value="present">✓ Présents</option>
            <option value="absent">✗ Absents</option>
            <option value="en_conge">🌴 En congé</option>
            <option value="jour_ferie">🎌 Jour férié</option>
            <option value="conflit_absence_pointage">⚠ Conflits</option>
          </select>
        </div>

        <div style={styles.filterGroup}>
          <ScanFace size={14} color="#6366F1" />
          <select
            value={filterMethode}
            onChange={(e) => onUpdateFilter('methode', e.target.value)}
            style={styles.filterSelect}
            aria-label="Filtrer par méthode"
          >
            <option value="toutes">Toutes méthodes</option>
            <option value="face">👤 Reco faciale</option>
            <option value="sans_face">🔢 Sans reco</option>
          </select>
        </div>

        <div style={styles.filterGroup}>
          <Camera size={14} color="#8B5CF6" />
          <select
            value={filterPhotos}
            onChange={(e) => onUpdateFilter('photos', e.target.value)}
            style={styles.filterSelect}
            aria-label="Filtrer par photo"
          >
            <option value="all">Photos: Tous</option>
            <option value="with_photo">📸 Avec</option>
            <option value="without_photo">Sans photo</option>
          </select>
        </div>

        <div style={styles.filterGroup}>
          <MapPin size={14} color="#10B981" />
          <select
            value={filterGPS}
            onChange={(e) => onUpdateFilter('gps', e.target.value)}
            style={styles.filterSelect}
            aria-label="Filtrer par GPS"
          >
            <option value="tous">GPS: Tous</option>
            <option value="dans_zone">✓ Dans zone</option>
            <option value="hors_zone">⚠ Hors zone</option>
            <option value="non_verifie">Non vérifié</option>
          </select>
        </div>

        <div style={styles.filterGroup}>
          <ArrowUpDown size={14} color="#F59E0B" />
          <select
            value={sortBy}
            onChange={(e) => onUpdateFilter('sort', e.target.value)}
            style={styles.filterSelect}
            aria-label="Trier par"
          >
            <option value="name_asc">Nom A→Z</option>
            <option value="name_desc">Nom Z→A</option>
            <option value="arrival_asc">Arrivée ↑</option>
            <option value="arrival_desc">Arrivée ↓</option>
            <option value="duration_desc">Durée ↓</option>
            <option value="duration_asc">Durée ↑</option>
            <option value="status">Par statut</option>
            {hasOvertimeFeature && <option value="overtime_desc">H.Sup ↓</option>}
          </select>
        </div>

        <button
          className="afro-export-btn"
          onClick={onExportCSV}
          style={styles.exportBtn}
          aria-label="Exporter CSV"
        >
          <Download size={16} />
          <span className="desktop-only">CSV</span>
        </button>

        <button
          className="afro-import-btn"
          onClick={onImport}
          style={styles.importBtn}
          aria-label="Importer des pointages depuis une pointeuse"
          title="Importer un fichier de pointeuse (clé USB)"
        >
          <Upload size={16} />
          <span className="desktop-only">Importer</span>
        </button>

        <button
          className="afro-nav-btn"
          onClick={onRefresh}
          style={{ ...styles.dateNavBtn, padding: '10px' }}
          aria-label="Rafraîchir"
          disabled={loading}
        >
          <RefreshCw size={16} className={loading ? 'spin-icon' : ''} />
        </button>
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════
function StatsSection({ stats, hasOvertimeFeature }) {
  return (
    <div style={styles.statsSection}>
      <div style={styles.statsGrid}>
        <StatCard
          icon={<UserCheck size={22} color="#10B981" />}
          iconBg="rgba(16,185,129,0.15)"
          value={stats.presents}
          label="Présents"
          sub={`${stats.presenceRate}%`}
          subColor="#10B981"
        />
        <StatCard
          icon={<UserX size={22} color="#EF4444" />}
          iconBg="rgba(239,68,68,0.15)"
          value={stats.absents}
          label="Absents"
        />
        <StatCard
          icon={<Calendar size={22} color="#8B5CF6" />}
          iconBg="rgba(139,92,246,0.15)"
          value={stats.en_conge}
          label="En congé"
        />
        <StatCard
          icon={<Calendar size={22} color="#C084FC" />}
          iconBg="rgba(192,132,252,0.15)"
          value={stats.joursFeries}
          label="Fériés"
        />
        <StatCard
          icon={<ScanFace size={22} color="#6366F1" />}
          iconBg="rgba(99,102,241,0.15)"
          value={stats.faceCount}
          label="Reco faciale"
        />
        <StatCard
          icon={<ShieldCheck size={22} color="#F97316" />}
          iconBg="rgba(249,115,22,0.15)"
          value={stats.conflits}
          label="Conflits"
        />
        {hasOvertimeFeature && (
          <StatCard
            icon={<Timer size={22} color="#F97316" />}
            iconBg="rgba(249,115,22,0.15)"
            value={stats.overtimeCount}
            label="H. Sup"
            sub={stats.totalOvertimeSeconds > 0
              ? FeatureService.formatOvertimeDisplay(stats.totalOvertimeSeconds)
              : null}
            subColor="#F97316"
          />
        )}
      </div>

      {/* Stats détaillées */}
      <div style={styles.statsDetailRow}>
        <StatDetail icon={<Clock size={13} color="#888" />} label="Temps moyen" value={formaterDureeComplete(stats.avgWorkTime)} />
        <StatDetail icon={<LogIn size={13} color="#10B981" />} label="Arrivée moy." value={stats.avgArrivalTime} />
        <StatDetail icon={<LogOut size={13} color="#F59E0B" />} label="Départ moy." value={stats.avgDepartureTime} />
        <StatDetail icon={<AlertTriangle size={13} color="#EF4444" />} label="Oublis badge" value={stats.autoClosedCount} />
        <StatDetail icon={<Edit size={13} color="#6366F1" />} label="Modifiés" value={stats.modifiedCount} />
        {stats.outOfZoneCount > 0 && (
          <StatDetail icon={<MapPin size={13} color="#EF4444" />} label="Hors zone" value={stats.outOfZoneCount} valueColor="#EF4444" />
        )}
      </div>
    </div>
  )
}

function StatCard({ icon, iconBg, value, label, sub, subColor }) {
  return (
    <div className="afro-stat-card" style={styles.statCard}>
      <div style={{ ...styles.statIconWrap, background: iconBg }}>{icon}</div>
      <div style={styles.statContent}>
        <span style={styles.statNumber}>{value}</span>
        <span style={styles.statLabel}>{label}</span>
        {sub && (
          <span style={{
            fontSize: '11px',
            color: subColor || '#888',
            fontWeight: '700',
            fontFamily: "'SF Mono', monospace"
          }}>
            {sub}
          </span>
        )}
      </div>
    </div>
  )
}

function StatDetail({ icon, label, value, valueColor }) {
  return (
    <div style={styles.statsDetailItem}>
      {icon}
      <span style={styles.statsDetailLabel}>{label}</span>
      <span style={{ ...styles.statsDetailValue, color: valueColor || '#FFF' }}>{value}</span>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════
function EmptyState({ searchQuery, activeFiltersCount, onResetFilters }) {
  return (
    <div style={styles.empty}>
      <div style={styles.emptyIcon}><Search size={48} color="#F59E0B" /></div>
      <p style={styles.emptyTitle}>
        {searchQuery ? 'Aucun résultat' : 'Aucun employé trouvé'}
      </p>
      <p style={styles.emptySubtitle}>
        {searchQuery
          ? `Aucun employé ne correspond à "${searchQuery}"`
          : 'Modifiez vos filtres ou sélectionnez une autre date'}
      </p>
      {(searchQuery || activeFiltersCount > 0) && (
        <button onClick={onResetFilters} style={styles.emptyResetBtn}>
          Réinitialiser les filtres
        </button>
      )}
    </div>
  )
}

// ═══════════════════════════════════════════════════════════
function GroupedList({
  groups, expandedGroups, expandedCards, adminsMap,
  canEdit, canManageConflict, hasOvertimeFeature, anomalies,
  statuerEstimation, estimationEnCours,
  onToggleGroup, onToggleCard, onEdit, onDelete,
  onConflict, onPhotoClick, onShare, getMethodeDisplay, getAdminName
}) {
  const groupOrder = ['conflit_absence_pointage', 'present', 'en_conge', 'jour_ferie', 'absent']

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
      {groupOrder.map(status => {
        const group = groups[status]
        if (!group || group.items.length === 0) return null

        const isExpanded = expandedGroups[status]

        return (
          <div key={status} style={styles.groupContainer}>
            <button
              onClick={() => onToggleGroup(status)}
              style={styles.groupHeader}
              aria-expanded={isExpanded}
            >
              <div style={styles.groupHeaderLeft}>
                <span style={styles.groupEmoji}>{group.emoji}</span>
                <span style={{ ...styles.groupLabel, color: group.color }}>
                  {group.label}
                </span>
                <span style={{
                  ...styles.groupCount,
                  background: `${group.color}15`,
                  color: group.color,
                  border: `1px solid ${group.color}30`
                }}>
                  {group.items.length}
                </span>
              </div>
              <div style={styles.groupHeaderRight}>
                {status === 'present' && group.items.length > 0 && (
                  <span style={styles.groupAvgTime}>
                    moy. {(() => {
                      const withTime = group.items.filter(p => p.totalSecondes > 0)
                      if (!withTime.length) return '--'
                      const avg = withTime.reduce((s, p) => s + p.totalSecondes, 0) / withTime.length
                      return formaterDureeComplete(avg)
                    })()}
                  </span>
                )}
                {isExpanded
                  ? <ChevronUp size={16} color="#888" />
                  : <ChevronDown size={16} color="#888" />}
              </div>
            </button>

            {isExpanded && (
              <div style={styles.groupItems}>
                {group.items.map((p, index) => (
                  <PointageCard
                    key={p.employee.id}
                    pointage={p}
                    index={index}
                    expanded={!!expandedCards[p.employee.id]}
                    adminsMap={adminsMap}
                    canEdit={canEdit}
                    canManageConflict={canManageConflict}
                    hasOvertimeFeature={hasOvertimeFeature}
                    anomalies={anomalies.filter(a => a.employeeId === p.employee.id)}
                    onToggleExpand={() => onToggleCard(p.employee.id)}
                    onEdit={() => onEdit(p.employee.id)}
                    onDelete={() => onDelete(p.employee.id)}
                    onConflict={() => onConflict(p)}
                    onPhotoClick={(att) => onPhotoClick(att, p.employee)}
                    onShare={() => onShare(p)}
                    getMethodeDisplay={getMethodeDisplay}
                    getAdminName={getAdminName}
                    statuerEstimation={statuerEstimation}
                    estimationEnCours={estimationEnCours}
                  />
                ))}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

// ═══════════════════════════════════════════════════════════
function FlatList({
  pointages, expandedCards, adminsMap,
  canEdit, canManageConflict, hasOvertimeFeature, anomalies,
  statuerEstimation, estimationEnCours,
  onToggleCard, onEdit, onDelete,
  onConflict, onPhotoClick, onShare, getMethodeDisplay, getAdminName
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
      {pointages.map((p, index) => (
        <PointageCard
          key={p.employee.id}
          pointage={p}
          index={index}
          expanded={!!expandedCards[p.employee.id]}
          adminsMap={adminsMap}
          canEdit={canEdit}
          canManageConflict={canManageConflict}
          hasOvertimeFeature={hasOvertimeFeature}
          anomalies={anomalies.filter(a => a.employeeId === p.employee.id)}
          onToggleExpand={() => onToggleCard(p.employee.id)}
          onEdit={() => onEdit(p.employee.id)}
          onDelete={() => onDelete(p.employee.id)}
          onConflict={() => onConflict(p)}
          onPhotoClick={(att) => onPhotoClick(att, p.employee)}
          onShare={() => onShare(p)}
          getMethodeDisplay={getMethodeDisplay}
          getAdminName={getAdminName}
          statuerEstimation={statuerEstimation}
          estimationEnCours={estimationEnCours}
        />
      ))}
    </div>
  )
}

// ═══════════════════════════════════════════════════════════
// `statuerEstimation` et `estimationEnCours` viennent du composant de page, via
// GroupedList et FlatList : la carte ne les déclare pas elle-même, sinon le bouton
// « Valider » référence un identifiant libre et c'est TOUTE la page qui part en
// ReferenceError (c'est ce qui est arrivé le 16/10, après la PR #6 — et `npm test`
// comme `vite build` ne le voyaient pas : voir src/services/__tests__/
// cablagePointageCard.test.js et eslint.gate.config.js).
function PointageCard({
  pointage: p, index, expanded, adminsMap,
  canEdit, canManageConflict, hasOvertimeFeature, anomalies,
  statuerEstimation, estimationEnCours,
  onToggleExpand, onEdit, onDelete, onConflict, onPhotoClick, onShare,
  getMethodeDisplay, getAdminName
}) {
  const statusConfig = {
    present: {
      color: '#10B981', bg: 'rgba(16,185,129,0.12)',
      border: 'rgba(16,185,129,0.25)', label: '✓ Présent', dotColor: '#10B981'
    },
    absent: {
      color: '#EF4444', bg: 'rgba(239,68,68,0.12)',
      border: 'rgba(239,68,68,0.25)', label: '✗ Absent', dotColor: '#EF4444'
    },
    en_conge: {
      color: '#8B5CF6', bg: 'rgba(139,92,246,0.12)', border: 'rgba(139,92,246,0.25)',
      label: `🌴 ${p.absenceReason === 'maladie' ? 'Maladie' : p.absenceReason === 'conge' ? 'Congé' : 'Absence'}`,
      dotColor: '#8B5CF6'
    },
    jour_ferie: {
      color: '#8B5CF6', bg: 'rgba(139,92,246,0.12)', border: 'rgba(139,92,246,0.25)',
      label: `🎌 ${p.holidayToday?.name || 'Jour férié'}`, dotColor: '#8B5CF6'
    },
    conflit_absence_pointage: {
      color: '#F97316', bg: 'rgba(249,115,22,0.12)', border: 'rgba(249,115,22,0.25)',
      label: `⚠ Conflit`, dotColor: '#F97316'
    }
  }

  const sc = statusConfig[p.status] || statusConfig.absent
  const methode = p.firstIn ? getMethodeDisplay(p.firstIn.method) : null
  const hasAnomalies = anomalies.length > 0
  const hasCriticalAnomaly = anomalies.some(a => a.severity === 'critical')
  const isModified = p.attendances.some(a => a.modifie_le)
  const hasMultipleSessions = (p.validPairs?.length || 0) > 1
  const modifiedEntry = p.attendances.find(a => a.modifie_le)
  const modifiedByName = modifiedEntry?.modifie_par
    ? getAdminName(modifiedEntry.modifie_par)
    : null

  // Une correction faite par l'EMPLOYÉ depuis l'application de pointage,
  // pas par un administrateur. Le détail (ancien type, nouveau type, date)
  // est conservé dans la table `attendance_corrections`.
  const correctionEmploye = p.attendances.find(a => a.modifie_par_employe)

  return (
    <div
      className="afro-pointage-card"
      style={{
        ...styles.pointageCard,
        animationDelay: `${index * 0.04}s`,
        borderColor: hasCriticalAnomaly
          ? 'rgba(239,68,68,0.25)'
          : p.hasFaceRecognition
            ? 'rgba(99,102,241,0.15)'
            : 'rgba(255,255,255,0.06)',
      }}
      role="listitem"
    >
      {/* TOP ROW */}
      <div style={styles.cardTopRow}>
        <div style={styles.cardLeft}>
          <div style={{ ...styles.avatar, border: `2px solid ${sc.dotColor}40` }}>
            {p.employee.photo_url ? (
              <img src={p.employee.photo_url} alt="" style={styles.avatarImg} />
            ) : (
              <span style={styles.avatarInitials}>
                {p.employee.first_name?.[0]}{p.employee.last_name?.[0]}
              </span>
            )}
            <div style={{ ...styles.statusDot, background: sc.dotColor }}></div>
          </div>

          <div style={styles.employeeInfo}>
            <div style={styles.employeeNameRow}>
              <span style={styles.employeeName}>
                {p.employee.first_name} {p.employee.last_name}
              </span>
              {p.hasFaceRecognition && (
                <span className="face-badge" style={styles.faceBadge} title="Reconnaissance faciale">
                  <ScanFace size={10} /> Reco
                </span>
              )}
              {isModified && (
                <span style={styles.modifiedBadgeInline} title="Pointage modifié">✏️</span>
              )}
              {p.hasPhoto && (
                <span style={styles.photoBadgeInline} title="Photo disponible">📸</span>
              )}
            </div>
            <div style={styles.employeeMeta}>
              <span style={styles.employeeMatricule}>{p.employee.matricule}</span>
              {p.employee.position && (
                <span style={styles.employeePosition}>• {p.employee.position}</span>
              )}
              {methode && (
                <span style={styles.methodeBadge}>
                  {methode.icon} {methode.label}
                </span>
              )}
            </div>
          </div>
        </div>

        <div style={styles.cardRight}>
          {hasOvertimeFeature && p.overtimeData?.hasOvertime && (
            <div className="overtime-badge" style={styles.overtimeBadge}>
              <Timer size={11} />
              <span>{FeatureService.formatOvertimeDisplay(p.overtimeData.totalOvertimeSeconds)}</span>
            </div>
          )}
          <div style={{
            ...styles.statusBadge,
            background: sc.bg,
            color: sc.color,
            border: `1px solid ${sc.border}`
          }}>
            {sc.label}
          </div>
        </div>
      </div>

      {/* ANOMALIES INLINE */}
      {hasAnomalies && (
        <div style={styles.anomaliesInline}>
          {anomalies.slice(0, expanded ? anomalies.length : 2).map((a, i) => (
            <div key={i} style={{
              ...styles.anomalyChip,
              background: a.severity === 'critical'
                ? 'rgba(239,68,68,0.08)'
                : a.severity === 'warning'
                  ? 'rgba(245,158,11,0.08)'
                  : 'rgba(99,102,241,0.06)',
              borderColor: a.severity === 'critical'
                ? 'rgba(239,68,68,0.2)'
                : a.severity === 'warning'
                  ? 'rgba(245,158,11,0.2)'
                  : 'rgba(99,102,241,0.12)',
              color: a.severity === 'critical'
                ? '#EF4444'
                : a.severity === 'warning'
                  ? '#F59E0B'
                  : '#6366F1',
            }}>
              <span>{a.icon}</span>
              <span>{a.message}</span>
            </div>
          ))}
          {!expanded && anomalies.length > 2 && (
            <span style={styles.anomalyMore}>
              +{anomalies.length - 2}
            </span>
          )}
        </div>
      )}

      {/* TIME ROW */}
      {(p.status === 'present' || p.status === 'conflit_absence_pointage') && (
        <div style={styles.timeRow}>
          <div style={styles.timeBlock}>
            <div style={{ ...styles.timeIconWrap, background: 'rgba(16,185,129,0.12)' }}>
              <LogIn size={14} color="#10B981" />
            </div>
            <div style={styles.timeInfo}>
              <span style={styles.timeLabel}>Entrée</span>
              <span style={{ ...styles.timeValue, color: '#10B981' }}>
                {formaterHeureLocale(p.firstIn?.check_time)}
              </span>
            </div>
          </div>

          <div style={styles.timeSeparator}>
            <div style={styles.timeLine}></div>
            <ArrowRight size={14} color="#F59E0B" />
            <div style={styles.timeLine}></div>
          </div>

          <div style={styles.timeBlock}>
            <div style={{
              ...styles.timeIconWrap,
              background: p.lastOut?.is_auto_closed
                ? 'rgba(239,68,68,0.12)'
                : 'rgba(245,158,11,0.12)'
            }}>
              {p.lastOut?.is_auto_closed
                ? <AlertTriangle size={14} color="#EF4444" />
                : <LogOut size={14} color="#F59E0B" />}
            </div>
            <div style={styles.timeInfo}>
              <span style={{
                ...styles.timeLabel,
                color: p.lastOut?.is_auto_closed ? '#EF4444' : '#666'
              }}>
                {p.lastOut?.is_auto_closed
                  ? (p.lastOut.estimation_validee_le
                      ? 'Sortie présumée ✓'
                      : (p.lastOut.estimation_remplacee_le
                          ? 'Sortie (estimation remplacée)'
                          : 'Sortie présumée ⏳'))
                  : 'Sortie'}
              </span>
              <span style={{
                ...styles.timeValue,
                color: p.lastOut?.is_auto_closed ? '#EF4444' : '#F59E0B'
              }}>
                {formaterHeureLocale(p.lastOut?.check_time)}
              </span>
            </div>
          </div>

          <div style={styles.durationBadge}>
            <Clock size={12} color="#F59E0B" />
            <span style={styles.durationText}>
              {formaterDureeComplete(p.totalSecondes)}
            </span>
          </div>

          {/* ⏳ SORTIE PRÉSUMÉE — bandeau de décision (1 clic, §5).
              Disparaît dès qu'un humain a validé ou qu'un vrai badge est arrivé :
              on ne demande jamais deux fois la même chose. */}
          {estEstimationNonValidee(p.lastOut) && (
            <div style={styles.estimationBar}>
              <AlertCircle size={13} color="#F59E0B" />
              <span style={styles.estimationTexte}>
                {etiquetteEstimation(p.lastOut)}
                {p.lastOut.estimation_niveau
                  ? ` · origine : niveau ${p.lastOut.estimation_niveau}` : ''}
                {p.lastOut.estimation_confiance != null
                  ? ` · confiance ${Math.round(p.lastOut.estimation_confiance * 100)}%` : ''}
              </span>
              {canEdit && (
                <span style={styles.estimationActions}>
                  <button
                    type="button"
                    style={styles.estimationBtnOk}
                    disabled={estimationEnCours === `${p.lastOut.id}:valider`}
                    onClick={() => statuerEstimation(p.lastOut.id, 'valider')}
                    title="Compter cette sortie dans la paie"
                  >
                    <CheckCircle2 size={12} /> Valider
                  </button>
                  <button
                    type="button"
                    style={styles.estimationBtnNo}
                    disabled={estimationEnCours === `${p.lastOut.id}:rejeter`}
                    onClick={() => statuerEstimation(p.lastOut.id, 'rejeter')}
                    title="Ne pas payer (la ligne reste en base pour l'audit)"
                  >
                    <Ban size={12} /> Écarter
                  </button>
                </span>
              )}
            </div>
          )}
        </div>
      )}

      {/* CONTENU ÉTENDU */}
      {expanded && (
        <>
          {/* Sessions multiples */}
          {hasMultipleSessions && (
            <div style={styles.sessionsContainer}>
              <div style={styles.sessionsTitle}>
                <BarChart3 size={13} color="#6366F1" />
                <span>{p.validPairs.length} sessions</span>
              </div>
              {p.validPairs.map((pair, i) => {
                const dur = calculerDureeSecondes(pair.in.check_time, pair.out.check_time)
                return (
                  <div key={i} style={styles.sessionItem}>
                    <span style={styles.sessionIndex}>#{i + 1}</span>
                    <span style={styles.sessionTime}>
                      {formaterHeureLocale(pair.in.check_time)} → {formaterHeureLocale(pair.out.check_time)}
                    </span>
                    <span style={styles.sessionDuration}>
                      {formaterDureeComplete(dur)}
                    </span>
                    {pair.out.is_auto_closed && (
                      <span style={styles.sessionAutoClosed}>Auto</span>
                    )}
                  </div>
                )
              })}
            </div>
          )}

          {/* Overtime */}
          {hasOvertimeFeature && p.overtimeData?.hasOvertime && (
            <div style={styles.overtimeRow}>
              <Timer size={14} color="#F97316" />
              <div style={styles.overtimeRowInfo}>
                <span style={styles.overtimeRowTitle}>Heures supplémentaires</span>
                <div style={styles.overtimeRowDetails}>
                  <span style={styles.overtimeDetailChip}>
                    <span style={styles.overtimeDetailLabel}>Normal</span>
                    <span style={styles.overtimeDetailValue}>
                      {FeatureService.formatOvertimeDisplay(p.overtimeData.overtimeSeconds)}
                    </span>
                    <span style={styles.overtimeDetailRate}>
                      ({p.overtimeData.rateApplied}%)
                    </span>
                  </span>
                  {p.overtimeData.overtimeMajorSeconds > 0 && (
                    <span style={{
                      ...styles.overtimeDetailChip,
                      borderColor: 'rgba(239,68,68,0.2)',
                      background: 'rgba(239,68,68,0.06)'
                    }}>
                      <span style={styles.overtimeDetailLabel}>Majoré</span>
                      <span style={{ ...styles.overtimeDetailValue, color: '#EF4444' }}>
                        {FeatureService.formatOvertimeDisplay(p.overtimeData.overtimeMajorSeconds)}
                      </span>
                      <span style={{ ...styles.overtimeDetailRate, color: '#EF4444' }}>
                        ({p.overtimeData.rateMajorApplied}%)
                      </span>
                    </span>
                  )}
                  <span style={styles.overtimeTotalChip}>
                    Total: {FeatureService.formatOvertimeDisplay(p.overtimeData.totalOvertimeSeconds)}
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Conflit */}
          {p.status === 'conflit_absence_pointage' && (
            <div style={styles.conflictInfoBox}>
              <AlertTriangle size={16} color="#F97316" />
              <div>
                <span style={styles.conflictInfoTitle}>Conflit RH détecté</span>
                <span style={styles.conflictInfoSub}>
                  Pointage enregistré pendant une période d'absence active.
                </span>
              </div>
            </div>
          )}

          {/* Jour férié */}
          {p.status === 'jour_ferie' && (
            <div style={styles.holidayBox}>
              <Calendar size={16} color="#8B5CF6" />
              <div>
                <span style={styles.holidayTitle}>Jour férié</span>
                <span style={styles.holidaySub}>
                  {p.holidayToday?.name || 'Jour férié actif'}
                </span>
              </div>
            </div>
          )}

          {/* Reconnaissance faciale */}
          {p.hasFaceRecognition && p.status === 'present' && (
            <div style={styles.faceRow}>
              <ScanFace size={14} color="#6366F1" />
              <div style={styles.faceInfo}>
                <span style={styles.faceLabel}>Biométrique</span>
                <div style={styles.faceDetails}>
                  <span style={styles.faceBadgeRow}>👤 Reconnaissance faciale</span>
                  {p.firstIn?.face_score && (
                    <span style={styles.faceScore}>
                      Confiance : {(p.firstIn.face_score * 100).toFixed(0)}%
                    </span>
                  )}
                  {p.firstIn?.liveness_passed !== null && p.firstIn?.liveness_passed !== undefined && (
                    <span style={{
                      ...styles.faceScoreBadge,
                      background: p.firstIn.liveness_passed
                        ? 'rgba(16,185,129,0.12)'
                        : 'rgba(239,68,68,0.12)',
                      color: p.firstIn.liveness_passed ? '#10B981' : '#EF4444',
                      border: `1px solid ${p.firstIn.liveness_passed
                        ? 'rgba(16,185,129,0.25)'
                        : 'rgba(239,68,68,0.25)'}`
                    }}>
                      {p.firstIn.liveness_passed ? '✓ Liveness OK' : '⚠ Liveness KO'}
                    </span>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Photos */}
          {p.hasPhoto && (
            <div style={styles.photosRow}>
              <div style={styles.photosLabel}>
                <Camera size={12} color="#6366F1" /> Photos
              </div>
              <div style={styles.photoThumbnails}>
                {p.attendances.filter(a => a.pointages_photos?.length > 0).map(a => (
                  <div
                    key={a.id}
                    className="afro-thumbnail"
                    style={styles.thumbnailContainer}
                    onClick={() => onPhotoClick(a)}
                    role="button"
                    tabIndex={0}
                    aria-label="Voir la photo"
                    onKeyDown={(e) => e.key === 'Enter' && onPhotoClick(a)}
                  >
                    <PhotoSignee
                      url={a.pointages_photos[0].photo_url}
                      alt="Photo pointage"
                      style={styles.thumbnail}
                    />
                    <div className="thumb-overlay" style={styles.thumbnailOverlay}>
                      <Eye size={14} color="#FFF" />
                    </div>
                    <span style={{
                      ...styles.thumbnailType,
                      background: a.check_type === 'in'
                        ? 'rgba(16,185,129,0.9)'
                        : 'rgba(245,158,11,0.9)'
                    }}>
                      {a.check_type === 'in' ? 'IN' : 'OUT'}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* GPS */}
          {p.firstIn && (p.firstIn.location_lat || p.firstIn.is_within_zone !== null) && (
            <div style={styles.geoRow}>
              <MapPin size={14} color={
                p.firstIn.is_within_zone === true ? '#10B981'
                  : p.firstIn.is_within_zone === false ? '#EF4444'
                    : '#888'
              } />
              <div style={styles.geoInfo}>
                <span style={styles.geoLabel}>Position GPS</span>
                <div style={styles.geoDetails}>
                  {p.firstIn.location_lat && p.firstIn.location_lng ? (
                    <a
                      href={`https://www.google.com/maps?q=${p.firstIn.location_lat},${p.firstIn.location_lng}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={styles.geoLink}
                    >
                      📍 {Number(p.firstIn.location_lat).toFixed(4)}, {Number(p.firstIn.location_lng).toFixed(4)}
                    </a>
                  ) : (
                    <span style={{ color: '#666', fontSize: '12px' }}>Non disponible</span>
                  )}
                  {p.firstIn.is_within_zone !== null && p.firstIn.is_within_zone !== undefined && (
                    <span style={{
                      ...styles.geoBadge,
                      background: p.firstIn.is_within_zone
                        ? 'rgba(16,185,129,0.12)'
                        : 'rgba(239,68,68,0.12)',
                      color: p.firstIn.is_within_zone ? '#10B981' : '#EF4444',
                      border: `1px solid ${p.firstIn.is_within_zone
                        ? 'rgba(16,185,129,0.25)'
                        : 'rgba(239,68,68,0.25)'}`
                    }}>
                      {p.firstIn.is_within_zone ? '✓ Dans zone' : '⚠ Hors zone'}
                    </span>
                  )}
                  {p.firstIn.distance_meters != null && (
                    <span style={styles.geoDistance}>
                      {p.firstIn.distance_meters < 1000
                        ? `${Math.round(p.firstIn.distance_meters)}m`
                        : `${(p.firstIn.distance_meters / 1000).toFixed(1)}km`}
                    </span>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Provenance du pointage */}
          {(() => {
            const ref = p.firstIn || p.lastOut
            if (!ref) return null
            const d = String(ref.device_id || '')
            let libelle = null
            let couleur = '#6B7280'
            let fond = 'rgba(107,114,128,.12)'

            if (d.startsWith('ADMS ')) {
              libelle = 'Pointeuse réseau' + (d.slice(5) ? ' — ' + d.slice(5) : '')
              couleur = '#0F766E'
              fond = 'rgba(20,184,166,.12)'
            } else if (ref.method === 'import' || d.toLowerCase().startsWith('import')) {
              libelle = 'Fichier importé' + (d.replace(/^import\s*/i, '') ? ' — ' + d.replace(/^import\s*/i, '') : '')
              couleur = '#6D28D9'
              fond = 'rgba(139,92,246,.12)'
            } else if (ref.method === 'face' || ref.method === 'pin_face') {
              libelle = 'Application mobile — reconnaissance du visage'
            } else if (ref.method === 'pin') {
              libelle = 'Application mobile — code confidentiel'
            } else if (ref.method === 'qr') {
              libelle = 'Application mobile — badge'
            } else if (ref.method === 'manual') {
              libelle = 'Saisie manuelle'
              couleur = '#B45309'
              fond = 'rgba(245,158,11,.14)'
            } else if (d) {
              libelle = d
            }

            if (!libelle) return null
            return (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8 }}>
                <Radio size={13} color={couleur} />
                <span style={{ ...styles.geoLabel }}>Provenance</span>
                <span style={{
                  display: 'inline-flex', alignItems: 'center', gap: 5,
                  padding: '2px 9px', borderRadius: 6, fontSize: 11.5,
                  fontWeight: 700, background: fond, color: couleur,
                }}>
                  {libelle}
                </span>
              </div>
            )
          })()}

          {/* Modification audit */}
          {isModified && modifiedEntry && (
            <div style={styles.modifiedRow}>
              <Edit size={13} color={correctionEmploye ? "#F59E0B" : "#6366F1"} />
              <span style={styles.modifiedText}>
                Modifié le{' '}
                {new Date(modifiedEntry.modifie_le).toLocaleString('fr-FR')}
                {modifiedByName && (
                  <> par <strong style={{ color: '#E5E5E5' }}>{modifiedByName}</strong></>
                )}
                {!modifiedByName && correctionEmploye && (
                  <> par <strong style={{ color: '#F59E0B' }}>l'employé</strong>
                    {' '}(depuis l'application de pointage)
                  </>
                )}
              </span>
            </div>
          )}
        </>
      )}

      {/* ACTIONS */}
      {(p.status === 'present' || p.status === 'absent' ||
        p.status === 'conflit_absence_pointage' || p.status === 'jour_ferie') && (
          <div style={styles.actionsRow}>
            <button
              onClick={onToggleExpand}
              style={styles.expandBtn}
              aria-label={expanded ? 'Réduire' : 'Voir détails'}
              aria-expanded={expanded}
            >
              {expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
              <span className="desktop-only">{expanded ? 'Réduire' : 'Détails'}</span>
              {hasMultipleSessions && !expanded && (
                <span style={styles.sessionCountBadge}>
                  {p.validPairs.length} sessions
                </span>
              )}
            </button>

            <div style={styles.actionsRight}>
              <button
                onClick={onShare}
                style={styles.shareBtn}
                aria-label="Partager sur WhatsApp"
                title="Partager sur WhatsApp"
              >
                <Share2 size={15} />
                <span className="desktop-only">Partager</span>
              </button>

              {p.status === 'conflit_absence_pointage' && canManageConflict && (
                <button
                  className="afro-conflict-btn"
                  onClick={onConflict}
                  style={styles.conflictActionBtn}
                  aria-label="Gérer le conflit"
                >
                  <ShieldCheck size={15} />
                  <span className="desktop-only">Conflit</span>
                </button>
              )}

              <button
                className={`afro-action-btn ${!canEdit ? 'afro-locked-btn' : ''}`}
                onClick={onEdit}
                style={{ ...styles.editBtn, ...(canEdit ? {} : styles.editBtnLocked) }}
                aria-label={canEdit ? 'Modifier' : 'Verrouillé'}
              >
                {canEdit ? <Edit size={15} /> : <Lock size={15} />}
                <span className="desktop-only">
                  {canEdit ? 'Modifier' : 'Verrouillé'}
                </span>
                {!canEdit && <Sparkles size={10} color="#F59E0B" />}
              </button>

              {(p.status === 'present' || p.status === 'conflit_absence_pointage') && (
                <button
                  className="afro-delete-btn"
                  onClick={onDelete}
                  style={styles.deleteBtn}
                  aria-label="Supprimer"
                >
                  <Trash2 size={15} />
                  <span className="desktop-only">Supprimer</span>
                </button>
              )}
            </div>
          </div>
        )}
    </div>
  )
}

// ═══════════════════════════════════════════════════════════
// 📦 MODALS
// ═══════════════════════════════════════════════════════════
function DeleteModal({ targetName, confirmText, isConfirmed, selectedDate, formatDate, onConfirmTextChange, onCancel, onConfirm }) {
  return (
    <div style={styles.modalOverlay} role="dialog" aria-modal="true">
      <div style={styles.confirmModal}>
        <div style={styles.modalIconWrap}>
          <AlertTriangle size={28} color="#EF4444" />
        </div>
        <h3 style={styles.modalTitle}>Confirmer la suppression</h3>
        <p style={styles.modalText}>
          Vous allez supprimer <strong>tous les pointages</strong> de{' '}
          <strong style={{ color: '#F59E0B' }}>{targetName}</strong> pour le {formatDate(selectedDate)}.
        </p>
        <div style={styles.confirmInputGroup}>
          <label style={styles.confirmLabel}>
            Tapez le nom complet pour confirmer :
          </label>
          <div style={styles.confirmInputExample}>{targetName}</div>
          <input
            type="text"
            value={confirmText}
            onChange={(e) => onConfirmTextChange(e.target.value)}
            placeholder="Tapez le nom ici..."
            autoFocus
            style={{
              ...styles.confirmInput,
              borderColor: confirmText && !isConfirmed
                ? 'rgba(239,68,68,0.5)'
                : isConfirmed
                  ? 'rgba(16,185,129,0.5)'
                  : 'rgba(255,255,255,0.1)'
            }}
          />
        </div>
        <div style={styles.modalButtons}>
          <button onClick={onCancel} style={styles.cancelBtn}>Annuler</button>
          <button
            onClick={onConfirm}
            disabled={!isConfirmed}
            style={{
              ...styles.confirmDeleteBtn,
              opacity: isConfirmed ? 1 : 0.4,
              cursor: isConfirmed ? 'pointer' : 'not-allowed',
            }}
          >
            <Trash2 size={16} /> Supprimer
          </button>
        </div>
      </div>
    </div>
  )
}

function ConfirmModal({ icon, iconBg, title, text, onCancel, onConfirm, confirmLabel }) {
  return (
    <div style={styles.modalOverlay} role="dialog" aria-modal="true">
      <div style={styles.confirmModal}>
        <div style={{ ...styles.modalIconWrap, background: iconBg }}>{icon}</div>
        <h3 style={styles.modalTitle}>{title}</h3>
        <p style={styles.modalText}>{text}</p>
        <div style={styles.modalButtons}>
          <button onClick={onCancel} style={styles.cancelBtn}>Annuler</button>
          <button onClick={onConfirm} style={styles.confirmDeleteBtn}>{confirmLabel}</button>
        </div>
      </div>
    </div>
  )
}

function PhotoModal({ photo, onClose, onDelete }) {
  return (
    <div style={styles.modalOverlay} onClick={onClose} role="dialog" aria-modal="true">
      <div style={styles.photoModal} onClick={(e) => e.stopPropagation()}>
        <button onClick={onClose} style={styles.closeModalBtn} aria-label="Fermer">
          <X size={20} />
        </button>
        <div style={styles.photoContainer}>
          <PhotoSignee url={photo.photo_url} alt="Photo de pointage" style={styles.fullPhoto} />
        </div>
        <div style={styles.photoModalFooter}>
          <div style={styles.photoModalInfo}>
            <span style={{ color: '#FFF', fontSize: '13px', fontWeight: '600' }}>
              {photo.employee?.first_name} {photo.employee?.last_name}
            </span>
            <span style={{ color: '#888', fontSize: '12px' }}>
              {photo.check_type === 'in' ? 'Entrée' : 'Sortie'} — {formaterHeureLocale(photo.check_time)}
            </span>
          </div>
          <button onClick={onDelete} style={styles.deletePhotoBtn}>
            <Trash2 size={14} /> Supprimer
          </button>
        </div>
      </div>
    </div>
  )
}

function UpgradeModal({ featureName, onClose }) {
  return (
    <div style={styles.modalOverlay} onClick={onClose} role="dialog" aria-modal="true">
      <div style={styles.upgradeModal} onClick={(e) => e.stopPropagation()}>
        <button onClick={onClose} style={styles.closeModalBtn} aria-label="Fermer">
          <X size={20} />
        </button>
        <div style={styles.upgradeHeader}>
          <div style={styles.upgradeIconWrap}>
            <Lock size={32} color="#F59E0B" />
          </div>
          <h2 style={styles.upgradeTitle}>Module non activé</h2>
          <p style={styles.upgradeSubtitle}>
            {featureName} nécessite l'activation du module correspondant.
          </p>
        </div>
        <div style={styles.upgradeBody}>
          <div style={styles.upgradeFeatureCard}>
            <div style={styles.upgradeFeatureIcon}>
              <Edit size={24} color="#8B5CF6" />
            </div>
            <div>
              <h4 style={styles.upgradeFeatureName}>{featureName || 'Module Premium'}</h4>
              <p style={styles.upgradeFeatureDesc}>
                Contactez votre administrateur système pour activer ce module.
              </p>
            </div>
          </div>
          <div style={styles.upgradeBenefits}>
            <p style={styles.upgradeBenefitItem}>✓ Correction des oublis de pointage</p>
            <p style={styles.upgradeBenefitItem}>✓ Historique des modifications</p>
            <p style={styles.upgradeBenefitItem}>✓ Traçabilité complète</p>
          </div>
        </div>
        <div style={styles.upgradeFooter}>
          <button onClick={onClose} style={styles.upgradeOkBtn}>J'ai compris</button>
        </div>
      </div>
    </div>
  )
}

function ConflictModal({ conflict, conflictNote, resolving, onNoteChange, onResolve, onClose }) {
  return (
    <div style={styles.modalOverlay} onClick={onClose} role="dialog" aria-modal="true">
      <div style={styles.conflictModal} onClick={(e) => e.stopPropagation()}>
        <div style={styles.conflictModalHeader}>
          <div style={styles.conflictModalTitleWrap}>
            <div style={styles.conflictModalIcon}>
              <AlertTriangle size={24} color="#F97316" />
            </div>
            <div>
              <h2 style={styles.conflictModalTitle}>Gérer le conflit</h2>
              <p style={styles.conflictModalSubtitle}>
                {conflict.employee.first_name} {conflict.employee.last_name}
              </p>
            </div>
          </div>
          <button onClick={onClose} style={styles.closeBtn} aria-label="Fermer">
            <X size={20} />
          </button>
        </div>
        <div style={styles.conflictModalBody}>
          <div style={styles.conflictSummary}>
            <div style={styles.conflictSummaryItem}>
              <span style={styles.conflictSummaryLabel}>Employé</span>
              <span style={styles.conflictSummaryValue}>
                {conflict.employee.first_name} {conflict.employee.last_name}
              </span>
            </div>
            <div style={styles.conflictSummaryItem}>
              <span style={styles.conflictSummaryLabel}>Motif absence</span>
              <span style={styles.conflictSummaryValue}>
                {conflict.absenceReason === 'maladie' ? 'Maladie'
                  : conflict.absenceReason === 'conge' ? 'Congé'
                    : conflict.absenceReason || 'Absence'}
              </span>
            </div>
            <div style={styles.conflictSummaryItem}>
              <span style={styles.conflictSummaryLabel}>Pointage</span>
              <span style={styles.conflictSummaryValue}>
                {formaterHeureLocale(conflict.firstIn?.check_time)}
              </span>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <label style={styles.fieldLabel}>Note de résolution (optionnel)</label>
            <textarea
              value={conflictNote}
              onChange={(e) => onNoteChange(e.target.value)}
              style={styles.textarea}
              placeholder="Ex: Retour anticipé validé par le responsable..."
            />
          </div>

          <div style={styles.conflictActionsList}>
            <button
              onClick={() => onResolve('kept_absence')}
              style={styles.resolveBtnKeep}
              disabled={resolving}
            >
              <CheckCircle2 size={18} />
              <div style={styles.resolveBtnTextWrap}>
                <span style={styles.resolveBtnTitle}>Maintenir l'absence</span>
                <span style={styles.resolveBtnSub}>Le pointage reste, l'absence est conservée</span>
              </div>
            </button>
            <button
              onClick={() => onResolve('cancelled_absence')}
              style={styles.resolveBtnCancel}
              disabled={resolving}
            >
              <ShieldCheck size={18} />
              <div style={styles.resolveBtnTextWrap}>
                <span style={styles.resolveBtnTitle}>Annuler l'absence</span>
                <span style={styles.resolveBtnSub}>L'absence est supprimée</span>
              </div>
            </button>
            <button
              onClick={() => onResolve('ignored_conflict')}
              style={styles.resolveBtnIgnore}
              disabled={resolving}
            >
              <Ban size={18} />
              <div style={styles.resolveBtnTextWrap}>
                <span style={styles.resolveBtnTitle}>Ignorer le conflit</span>
                <span style={styles.resolveBtnSub}>Marquer comme vu</span>
              </div>
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

function ShareModal({ data, onClose, onShareWhatsApp, onCopy }) {
  const [phone, setPhone] = useState('')
  const [copied, setCopied] = useState(false)

  const handleCopy = async () => {
    await onCopy(data.message)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div style={styles.modalOverlay} onClick={onClose} role="dialog" aria-modal="true">
      <div style={styles.shareModal} onClick={(e) => e.stopPropagation()}>
        <button onClick={onClose} style={styles.closeModalBtn} aria-label="Fermer">
          <X size={20} />
        </button>

        <div style={styles.shareModalHeader}>
          <div style={styles.shareModalIcon}>
            <Share2 size={24} color="#10B981" />
          </div>
          <div>
            <h2 style={styles.shareModalTitle}>
              {data.type === 'report' ? 'Partager le rapport' : 'Partager le pointage'}
            </h2>
            {data.type === 'employee' && data.pointage && (
              <p style={styles.shareModalSub}>
                {data.pointage.employee.first_name} {data.pointage.employee.last_name}
              </p>
            )}
          </div>
        </div>

        {/* Aperçu du message */}
        <div style={styles.sharePreview}>
          <pre style={styles.sharePreviewText}>{data.message}</pre>
        </div>

        {/* Numéro de téléphone optionnel */}
        <div style={styles.sharePhoneGroup}>
          <label style={styles.sharePhoneLabel}>
            <Smartphone size={14} color="#888" />
            Numéro WhatsApp (optionnel)
          </label>
          <input
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="+221 77 000 00 00"
            style={styles.sharePhoneInput}
          />
          <span style={styles.sharePhoneHint}>
            Laissez vide pour choisir le destinataire dans WhatsApp
          </span>
        </div>

        {/* Actions */}
        <div style={styles.shareActions}>
          <button onClick={handleCopy} style={styles.shareCopyBtn}>
            {copied ? <Check size={16} /> : <Copy size={16} />}
            <span>{copied ? 'Copié !' : 'Copier'}</span>
          </button>
          <button
            onClick={() => {
              onShareWhatsApp(data.message, phone || null)
              onClose()
            }}
            style={styles.shareWhatsAppBtn}
          >
            <MessageCircle size={18} />
            <span>Envoyer sur WhatsApp</span>
          </button>
        </div>
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════
// 🎨 CSS
// ═══════════════════════════════════════════════════════════
const skeletonCSS = `
  @keyframes shimmer {
    0% { background-position: -200% 0; }
    100% { background-position: 200% 0; }
  }
  @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }

  .skeleton-bar {
    background: linear-gradient(90deg,
      rgba(255,255,255,0.04) 25%,
      rgba(255,255,255,0.08) 50%,
      rgba(255,255,255,0.04) 75%
    );
    background-size: 200% 100%;
    animation: shimmer 1.5s infinite;
    border-radius: 8px;
  }
  .skeleton-header {
    padding: 20px 0;
    display: flex;
    flex-direction: column;
    gap: 8px;
    max-width: 300px;
  }
  .skeleton-bar-lg { height: 28px; width: 260px; }
  .skeleton-bar-sm { height: 16px; width: 180px; }
  .skeleton-filters {
    display: flex;
    gap: 10px;
    flex-wrap: wrap;
    margin-bottom: 20px;
  }
  .skeleton-bar-filter { height: 44px; flex: 1 1 200px; min-width: 150px; }
  .skeleton-stats-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
    gap: 14px;
    margin-bottom: 24px;
  }
  .skeleton-stat-card {
    background: rgba(20,20,35,0.6);
    border: 1px solid rgba(255,255,255,0.04);
    border-radius: 16px;
    padding: 20px;
    display: flex;
    align-items: center;
    gap: 14px;
  }
  .skeleton-circle {
    width: 48px; height: 48px; border-radius: 14px;
    background: linear-gradient(90deg,
      rgba(255,255,255,0.04) 25%,
      rgba(255,255,255,0.08) 50%,
      rgba(255,255,255,0.04) 75%
    );
    background-size: 200% 100%;
    animation: shimmer 1.5s infinite;
    flex-shrink: 0;
  }
  .skeleton-stat-text { display: flex; flex-direction: column; gap: 6px; }
  .skeleton-bar-number { height: 30px; width: 40px; }
  .skeleton-bar-label { height: 14px; width: 70px; }
  .skeleton-card {
    background: rgba(20,20,35,0.6);
    border: 1px solid rgba(255,255,255,0.04);
    border-radius: 16px;
    padding: 18px;
    margin-bottom: 10px;
    animation: fadeIn 0.5s ease forwards;
    opacity: 0;
  }
  .skeleton-card-top {
    display: flex;
    align-items: center;
    gap: 12px;
    margin-bottom: 14px;
  }
  .skeleton-avatar {
    width: 44px; height: 44px; border-radius: 12px;
    background: linear-gradient(90deg,
      rgba(255,255,255,0.04) 25%,
      rgba(255,255,255,0.08) 50%,
      rgba(255,255,255,0.04) 75%
    );
    background-size: 200% 100%;
    animation: shimmer 1.5s infinite;
    flex-shrink: 0;
  }
  .skeleton-card-info { flex: 1; display: flex; flex-direction: column; gap: 6px; }
  .skeleton-bar-name { height: 16px; width: 60%; }
  .skeleton-bar-meta { height: 12px; width: 40%; }
  .skeleton-bar-badge { height: 28px; width: 90px; border-radius: 14px; }
`

const componentCSS = `
  @keyframes fadeInUp {
    from { opacity: 0; transform: translateY(16px); }
    to { opacity: 1; transform: translateY(0); }
  }
  @keyframes pulseGlow {
    0%, 100% { box-shadow: 0 0 4px rgba(249,115,22,0.3); }
    50% { box-shadow: 0 0 12px rgba(249,115,22,0.6); }
  }
  @keyframes facePulse {
    0%, 100% { box-shadow: 0 0 4px rgba(99,102,241,0.3); }
    50% { box-shadow: 0 0 10px rgba(99,102,241,0.6); }
  }
  @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }

  .spin-icon { animation: spin 1s linear infinite; }

  .afro-pointage-card {
    transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1) !important;
    animation: fadeInUp 0.35s ease forwards;
    opacity: 0;
  }
  .afro-pointage-card:hover {
    transform: translateY(-1px) !important;
    box-shadow: 0 8px 32px rgba(0,0,0,0.3) !important;
    border-color: rgba(245,158,11,0.2) !important;
  }
  .afro-stat-card { transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1); }
  .afro-stat-card:hover {
    transform: translateY(-4px) scale(1.01) !important;
    box-shadow: 0 12px 40px rgba(0,0,0,0.35) !important;
  }
  .afro-nav-btn:hover {
    background: rgba(245,158,11,0.15) !important;
    color: #F59E0B !important;
  }
  .afro-export-btn:hover {
    background: linear-gradient(135deg, #D97706, #B45309) !important;
    transform: translateY(-1px) !important;
  }
  .afro-thumbnail:hover { transform: scale(1.1) !important; }
  .afro-thumbnail:hover .thumb-overlay { opacity: 1 !important; }
  .afro-action-btn:hover {
    background: rgba(245,158,11,0.12) !important;
    color: #F59E0B !important;
  }
  .afro-delete-btn:hover {
    background: rgba(239,68,68,0.12) !important;
    color: #EF4444 !important;
  }
  .afro-conflict-btn:hover { background: rgba(249,115,22,0.15) !important; }
  .afro-locked-btn { opacity: 0.5; cursor: not-allowed !important; }
  .overtime-badge { animation: pulseGlow 2s ease-in-out infinite; }
  .face-badge { animation: facePulse 2.5s ease-in-out infinite; }

  .desktop-only { display: inline; }
  @media (max-width: 768px) {
    .desktop-only { display: none !important; }
  }

  ::-webkit-scrollbar { width: 5px; }
  ::-webkit-scrollbar-track { background: #0A0A0F; }
  ::-webkit-scrollbar-thumb { background: #F59E0B; border-radius: 3px; }
  select option { background: #141423; color: #E5E5E5; }
`

// ═══════════════════════════════════════════════════════════
// 🎨 STYLES
// ═══════════════════════════════════════════════════════════
const styles = {
  container: {
    minHeight: '100vh', background: '#0A0A0F',
    position: 'relative', overflow: 'hidden'
  },
  bgPattern: {
    position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
    backgroundImage: `
      radial-gradient(circle at 15% 50%, rgba(245,158,11,0.03) 0%, transparent 50%),
      radial-gradient(circle at 85% 20%, rgba(99,102,241,0.03) 0%, transparent 50%)
    `,
    pointerEvents: 'none', zIndex: 0
  },
  bgOrb1: {
    position: 'fixed', top: '-15%', right: '-10%',
    width: '500px', height: '500px', borderRadius: '50%',
    background: 'radial-gradient(circle, rgba(245,158,11,0.04) 0%, transparent 70%)',
    pointerEvents: 'none', zIndex: 0
  },
  bgOrb2: {
    position: 'fixed', bottom: '-25%', left: '-10%',
    width: '600px', height: '600px', borderRadius: '50%',
    background: 'radial-gradient(circle, rgba(99,102,241,0.03) 0%, transparent 70%)',
    pointerEvents: 'none', zIndex: 0
  },

  offlineBanner: {
    position: 'fixed', top: 0, left: 0, right: 0, zIndex: 1000,
    background: 'linear-gradient(135deg, #DC2626, #B91C1C)',
    color: '#FFF', padding: '10px 20px',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    gap: '10px', fontSize: '13px', fontWeight: '600'
  },

  main: {
    padding: 'clamp(12px, 3vw, 24px)',
    maxWidth: '1400px', margin: '0 auto',
    position: 'relative', zIndex: 1
  },

  // Error
  errorContainer: {
    textAlign: 'center', padding: '80px 20px',
    background: 'rgba(20,20,35,0.6)', borderRadius: '24px',
    border: '1px solid rgba(239,68,68,0.15)',
    maxWidth: '500px', margin: '40px auto'
  },
  errorIcon: {
    width: '80px', height: '80px', borderRadius: '20px',
    background: 'rgba(239,68,68,0.1)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    margin: '0 auto 24px'
  },
  errorTitle: { color: '#FFF', fontSize: '22px', fontWeight: '700', margin: '0 0 12px' },
  errorMessage: { color: '#888', fontSize: '14px', margin: '0 0 28px', lineHeight: '1.5' },
  retryBtn: {
    display: 'inline-flex', alignItems: 'center', gap: '8px',
    background: 'linear-gradient(135deg, #F59E0B, #D97706)',
    color: '#000', border: 'none', borderRadius: '12px',
    padding: '14px 28px', fontSize: '15px', fontWeight: '700', cursor: 'pointer'
  },

  // Title
  titleSection: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    marginBottom: '20px', flexWrap: 'wrap', gap: '12px'
  },
  titleLeft: { display: 'flex', alignItems: 'center', gap: '14px' },
  titleIcon: {
    width: '48px', height: '48px', borderRadius: '14px',
    background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.2)',
    display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0
  },
  pageTitle: {
    color: '#FFF', fontSize: 'clamp(18px, 3.5vw, 26px)',
    fontWeight: '600', margin: 0
  },
  pageSubtitle: {
    color: '#888', fontSize: '13px',
    margin: '2px 0 0 0', textTransform: 'capitalize'
  },
  titleRight: {
    display: 'flex', alignItems: 'center',
    gap: '8px', flexWrap: 'wrap'
  },
  permBadge: {
    display: 'flex', alignItems: 'center', gap: '5px',
    padding: '5px 12px', borderRadius: '20px',
    fontSize: '11px', fontWeight: '600', border: '1px solid', whiteSpace: 'nowrap'
  },
  alertsBadge: {
    display: 'flex', alignItems: 'center', gap: '6px',
    padding: '6px 12px', borderRadius: '20px',
    fontSize: '12px', fontWeight: '700', border: '1px solid', cursor: 'pointer',
    background: 'none'
  },
  shareReportBtn: {
    display: 'flex', alignItems: 'center', gap: '6px',
    background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.25)',
    color: '#10B981', padding: '6px 14px', borderRadius: '20px',
    fontSize: '12px', fontWeight: '600', cursor: 'pointer',
    transition: 'all 0.2s'
  },

  // Alerts Panel
  alertsPanel: {
    background: 'rgba(20,20,35,0.9)', backdropFilter: 'blur(12px)',
    border: '1px solid rgba(249,115,22,0.15)', borderRadius: '18px',
    padding: '20px', marginBottom: '20px',
    maxHeight: '380px', overflowY: 'auto'
  },
  alertsPanelHeader: {
    display: 'flex', justifyContent: 'space-between',
    alignItems: 'center', marginBottom: '16px'
  },
  alertsPanelTitle: {
    display: 'flex', alignItems: 'center', gap: '10px',
    color: '#FFF', fontSize: '15px', fontWeight: '700'
  },
  alertsPanelCount: {
    background: 'rgba(249,115,22,0.15)', color: '#F97316',
    padding: '2px 10px', borderRadius: '10px',
    fontSize: '12px', fontWeight: '700'
  },
  alertsCloseBtn: {
    background: 'rgba(255,255,255,0.06)',
    border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: '8px', padding: '6px', cursor: 'pointer',
    color: '#888', display: 'flex'
  },
  alertSection: { marginBottom: '12px' },
  alertSectionTitle: {
    fontSize: '11px', fontWeight: '700', marginBottom: '8px',
    textTransform: 'uppercase', letterSpacing: '0.5px'
  },
  alertItem: {
    display: 'flex', alignItems: 'flex-start', gap: '10px',
    padding: '9px 11px', borderRadius: '10px', border: '1px solid',
    marginBottom: '5px', background: 'rgba(255,255,255,0.02)'
  },
  alertIcon: { fontSize: '15px', flexShrink: 0, marginTop: '1px' },
  alertContent: {
    display: 'flex', flexDirection: 'column', gap: '2px', flex: 1
  },
  alertEmployee: { color: '#FFF', fontSize: '13px', fontWeight: '600' },
  alertMessage: { color: '#CCC', fontSize: '12px' },
  alertDetail: {
    color: '#888', fontSize: '11px',
    fontFamily: "'SF Mono', monospace"
  },

  // Filters
  filtersContainer: {
    marginBottom: '20px',
    display: 'flex', flexDirection: 'column', gap: '10px'
  },
  dateNavRow: {
    display: 'flex', alignItems: 'center', gap: '6px',
    background: 'rgba(20,20,35,0.8)', backdropFilter: 'blur(10px)',
    border: '1px solid rgba(255,255,255,0.06)',
    borderRadius: '14px', padding: '5px'
  },
  dateNavBtn: {
    background: 'rgba(245,158,11,0.08)',
    border: '1px solid rgba(245,158,11,0.12)',
    borderRadius: '10px', padding: '10px', color: '#F59E0B',
    cursor: 'pointer', display: 'flex', alignItems: 'center',
    justifyContent: 'center', transition: 'all 0.2s ease', flexShrink: 0
  },
  dateInputWrap: {
    display: 'flex', alignItems: 'center', gap: '8px',
    flex: 1, justifyContent: 'center', padding: '0 6px'
  },
  dateInput: {
    border: 'none', background: 'transparent',
    fontSize: '14px', color: '#FFF', cursor: 'pointer',
    outline: 'none', fontFamily: 'inherit', maxWidth: '140px'
  },
  searchRow: {
    display: 'flex', gap: '8px', alignItems: 'center'
  },
  searchInputWrap: {
    display: 'flex', alignItems: 'center', gap: '10px',
    background: 'rgba(20,20,35,0.8)', backdropFilter: 'blur(10px)',
    border: '1px solid rgba(255,255,255,0.06)',
    padding: '10px 16px', borderRadius: '12px', flex: 1
  },
  searchInput: {
    border: 'none', background: 'transparent',
    fontSize: '14px', color: '#E5E5E5', outline: 'none',
    width: '100%', fontFamily: 'inherit'
  },
  searchClearBtn: {
    background: 'rgba(255,255,255,0.06)', border: 'none',
    borderRadius: '6px', padding: '4px', cursor: 'pointer',
    color: '#888', display: 'flex', flexShrink: 0
  },
  clearAllFiltersBtn: {
    display: 'flex', alignItems: 'center', gap: '6px',
    background: 'rgba(239,68,68,0.08)',
    border: '1px solid rgba(239,68,68,0.15)',
    color: '#EF4444', borderRadius: '10px', padding: '8px 14px',
    fontSize: '12px', fontWeight: '600', cursor: 'pointer',
    whiteSpace: 'nowrap', flexShrink: 0
  },
  filterRow: {
    display: 'flex', gap: '8px',
    flexWrap: 'wrap', alignItems: 'stretch'
  },
  filterGroup: {
    display: 'flex', alignItems: 'center', gap: '8px',
    background: 'rgba(20,20,35,0.8)', backdropFilter: 'blur(10px)',
    border: '1px solid rgba(255,255,255,0.06)',
    padding: '8px 12px', borderRadius: '10px',
    flex: '1 1 150px', minWidth: '120px'
  },
  filterSelect: {
    border: 'none', background: 'transparent',
    fontSize: '13px', color: '#E5E5E5', cursor: 'pointer',
    outline: 'none', width: '100%', fontFamily: 'inherit'
  },
  exportBtn: {
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    gap: '6px', background: 'linear-gradient(135deg, #F59E0B, #D97706)',
    color: '#000', padding: '10px 16px', borderRadius: '10px',
    border: 'none', fontWeight: '700', fontSize: '13px',
    cursor: 'pointer', transition: 'all 0.3s', flexShrink: 0
  },

  // bouton d'import. Violet volontairement : l'œil ne doit pas
  // confondre « sortir mes données » (doré) et « faire entrer des pointages »
  // (violet), deux gestes aux conséquences très différentes.
  importBtn: {
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    gap: '6px', background: 'linear-gradient(135deg, #6366F1, #4338CA)',
    color: '#fff', padding: '10px 16px', borderRadius: '10px',
    border: 'none', fontWeight: '700', fontSize: '13px',
    cursor: 'pointer', transition: 'all 0.3s', flexShrink: 0
  },

  // Stats
  statsSection: { marginBottom: '24px' },
  statsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 145px), 1fr))',
    gap: '10px', marginBottom: '10px'
  },
  statCard: {
    background: 'rgba(20,20,35,0.8)', backdropFilter: 'blur(10px)',
    borderRadius: '16px', padding: 'clamp(12px, 2.5vw, 18px)',
    display: 'flex', alignItems: 'center', gap: '12px',
    border: '1px solid rgba(255,255,255,0.06)', cursor: 'default'
  },
  statIconWrap: {
    width: '42px', height: '42px', borderRadius: '12px',
    display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0
  },
  statContent: { display: 'flex', flexDirection: 'column', minWidth: 0 },
  statNumber: {
    fontSize: 'clamp(20px, 3vw, 28px)',
    fontWeight: '700', color: '#FFF', lineHeight: 1
  },
  statLabel: { fontSize: '11px', color: '#888', fontWeight: '500', marginTop: '2px' },

  statsDetailRow: {
    display: 'flex', gap: '8px', flexWrap: 'wrap',
    padding: '10px 14px',
    background: 'rgba(20,20,35,0.5)',
    border: '1px solid rgba(255,255,255,0.04)',
    borderRadius: '12px'
  },
  statsDetailItem: {
    display: 'flex', alignItems: 'center', gap: '6px',
    flex: '1 1 auto', minWidth: 'fit-content'
  },
  statsDetailLabel: { color: '#666', fontSize: '11px', whiteSpace: 'nowrap' },
  statsDetailValue: {
    color: '#FFF', fontSize: '12px', fontWeight: '700',
    fontFamily: "'SF Mono', monospace"
  },

  // List header
  listHeader: {
    display: 'flex', justifyContent: 'space-between',
    alignItems: 'center', marginBottom: '12px'
  },
  listHeaderLeft: { display: 'flex', alignItems: 'center', gap: '10px' },
  listHeaderIcon: {
    width: '34px', height: '34px', borderRadius: '10px',
    background: 'rgba(245,158,11,0.1)',
    display: 'flex', alignItems: 'center', justifyContent: 'center'
  },
  listTitle: {
    color: '#FFF', fontSize: '15px', fontWeight: '600',
    margin: 0, display: 'flex', alignItems: 'center', gap: '8px'
  },
  listCount: {
    background: 'rgba(245,158,11,0.15)', color: '#F59E0B',
    padding: '2px 9px', borderRadius: '10px',
    fontSize: '12px', fontWeight: '700'
  },
  listFiltered: { color: '#666', fontSize: '12px' },
  listHeaderRight: {
    display: 'flex', alignItems: 'center', gap: '10px'
  },
  viewToggleBtn: {
    display: 'flex', alignItems: 'center', gap: '6px',
    background: 'rgba(255,255,255,0.04)',
    border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: '10px', padding: '7px 12px',
    color: '#888', cursor: 'pointer', fontSize: '12px',
    fontWeight: '600', transition: 'all 0.2s'
  },

  // Empty
  empty: {
    textAlign: 'center', padding: '50px 20px',
    background: 'rgba(20,20,35,0.6)', borderRadius: '20px',
    border: '1px solid rgba(255,255,255,0.06)'
  },
  emptyIcon: {
    width: '72px', height: '72px', borderRadius: '18px',
    background: 'rgba(245,158,11,0.08)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    margin: '0 auto 18px'
  },
  emptyTitle: { color: '#FFF', fontSize: '17px', fontWeight: '600', margin: '0 0 6px' },
  emptySubtitle: { color: '#666', fontSize: '13px', margin: '0 0 20px' },
  emptyResetBtn: {
    background: 'rgba(245,158,11,0.1)',
    border: '1px solid rgba(245,158,11,0.2)',
    color: '#F59E0B', borderRadius: '10px',
    padding: '10px 24px', fontSize: '13px',
    fontWeight: '600', cursor: 'pointer'
  },

  // Group
  groupContainer: {
    background: 'rgba(20,20,35,0.5)',
    border: '1px solid rgba(255,255,255,0.05)',
    borderRadius: '16px', overflow: 'hidden'
  },
  groupHeader: {
    width: '100%', display: 'flex', justifyContent: 'space-between',
    alignItems: 'center', padding: '14px 18px',
    background: 'transparent', border: 'none', cursor: 'pointer',
    transition: 'background 0.2s',
  },
  groupHeaderLeft: { display: 'flex', alignItems: 'center', gap: '10px' },
  groupHeaderRight: { display: 'flex', alignItems: 'center', gap: '10px' },
  groupEmoji: { fontSize: '18px' },
  groupLabel: { fontSize: '14px', fontWeight: '700' },
  groupCount: {
    padding: '2px 10px', borderRadius: '10px',
    fontSize: '12px', fontWeight: '700'
  },
  groupAvgTime: {
    color: '#666', fontSize: '11px',
    fontFamily: "'SF Mono', monospace"
  },
  groupItems: {
    display: 'flex', flexDirection: 'column',
    gap: '6px', padding: '0 8px 8px 8px'
  },

  // Pointage Card
  pointageCard: {
    background: 'rgba(20,20,35,0.7)', backdropFilter: 'blur(10px)',
    borderRadius: '14px', border: '1px solid',
    padding: 'clamp(12px, 2.5vw, 16px)',
    display: 'flex', flexDirection: 'column', gap: '10px',
    overflow: 'hidden'
  },
  cardTopRow: {
    display: 'flex', justifyContent: 'space-between',
    alignItems: 'center', gap: '10px'
  },
  cardLeft: {
    display: 'flex', alignItems: 'center',
    gap: '10px', flex: 1, minWidth: 0
  },
  cardRight: {
    display: 'flex', alignItems: 'center',
    gap: '6px', flexWrap: 'wrap', justifyContent: 'flex-end'
  },
  avatar: {
    width: '42px', height: '42px', borderRadius: '12px',
    background: 'linear-gradient(135deg, rgba(245,158,11,0.2), rgba(245,158,11,0.05))',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    overflow: 'hidden', flexShrink: 0, position: 'relative'
  },
  avatarImg: { width: '100%', height: '100%', objectFit: 'cover' },
  avatarInitials: {
    color: '#F59E0B', fontWeight: '700',
    fontSize: '14px', letterSpacing: '1px'
  },
  statusDot: {
    position: 'absolute', bottom: '-1px', right: '-1px',
    width: '10px', height: '10px', borderRadius: '50%',
    border: '2px solid #0F0F19'
  },
  employeeInfo: { flex: 1, minWidth: 0 },
  employeeNameRow: {
    display: 'flex', alignItems: 'center',
    gap: '6px', flexWrap: 'wrap'
  },
  employeeName: { fontWeight: '600', color: '#FFF', fontSize: '14px' },
  employeeMeta: {
    display: 'flex', alignItems: 'center', gap: '6px',
    color: '#666', fontSize: '11px', marginTop: '2px', flexWrap: 'wrap'
  },
  employeeMatricule: { fontFamily: "'SF Mono', monospace", fontSize: '11px' },
  employeePosition: { color: '#555', fontSize: '11px' },
  faceBadge: {
    display: 'inline-flex', alignItems: 'center', gap: '3px',
    background: 'rgba(99,102,241,0.12)',
    border: '1px solid rgba(99,102,241,0.3)',
    color: '#6366F1', padding: '1px 7px', borderRadius: '6px',
    fontSize: '9px', fontWeight: '700'
  },
  modifiedBadgeInline: { fontSize: '12px' },
  photoBadgeInline: { fontSize: '12px' },
  methodeBadge: {
    display: 'inline-flex', alignItems: 'center',
    background: 'rgba(255,255,255,0.04)',
    border: '1px solid rgba(255,255,255,0.06)',
    color: '#888', padding: '0px 6px', borderRadius: '5px',
    fontSize: '10px', fontWeight: '600'
  },
  statusBadge: {
    padding: '4px 11px', borderRadius: '14px',
    fontSize: '11px', fontWeight: '700', whiteSpace: 'nowrap'
  },
  overtimeBadge: {
    display: 'flex', alignItems: 'center', gap: '4px',
    background: 'rgba(249,115,22,0.12)',
    border: '1px solid rgba(249,115,22,0.3)',
    color: '#F97316', padding: '3px 8px', borderRadius: '8px',
    fontSize: '10px', fontWeight: '800', fontFamily: "'SF Mono', monospace"
  },

  // Anomalies
  anomaliesInline: {
    display: 'flex', flexWrap: 'wrap', gap: '5px', alignItems: 'center'
  },
  anomalyChip: {
    display: 'inline-flex', alignItems: 'center', gap: '5px',
    padding: '2px 9px', borderRadius: '7px',
    fontSize: '11px', fontWeight: '600', border: '1px solid'
  },
  anomalyMore: { color: '#888', fontSize: '11px', fontWeight: '600' },

  // Time row
  timeRow: {
    display: 'flex', alignItems: 'center', gap: '8px',
    background: 'rgba(255,255,255,0.02)', borderRadius: '10px',
    padding: '10px', flexWrap: 'wrap'
  },
  timeBlock: {
    display: 'flex', alignItems: 'center', gap: '8px',
    flex: '1 1 auto', minWidth: '90px'
  },
  timeIconWrap: {
    width: '28px', height: '28px', borderRadius: '8px',
    display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0
  },
  timeInfo: { display: 'flex', flexDirection: 'column' },
  timeLabel: {
    fontSize: '9px', textTransform: 'uppercase',
    letterSpacing: '0.8px', fontWeight: '600', color: '#666'
  },
  timeValue: {
    fontSize: '15px', fontWeight: '700',
    fontFamily: "'SF Mono', monospace", letterSpacing: '0.5px'
  },
  timeSeparator: {
    display: 'flex', alignItems: 'center', gap: '4px', flex: '0 0 auto'
  },
  timeLine: { width: '14px', height: '1px', background: 'rgba(245,158,11,0.2)' },
  durationBadge: {
    display: 'flex', alignItems: 'center', gap: '5px',
    background: 'rgba(245,158,11,0.08)',
    border: '1px solid rgba(245,158,11,0.15)',
    padding: '5px 10px', borderRadius: '8px', marginLeft: 'auto'
  },
  durationText: {
    color: '#F59E0B', fontSize: '12px', fontWeight: '700',
    fontFamily: "'SF Mono', monospace"
  },

  // Sessions
  sessionsContainer: {
    background: 'rgba(99,102,241,0.04)',
    border: '1px solid rgba(99,102,241,0.1)',
    borderRadius: '10px', padding: '10px'
  },
  sessionsTitle: {
    display: 'flex', alignItems: 'center', gap: '6px',
    color: '#6366F1', fontSize: '11px', fontWeight: '700',
    marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.5px'
  },
  sessionItem: {
    display: 'flex', alignItems: 'center', gap: '8px',
    padding: '5px 8px', borderRadius: '6px',
    background: 'rgba(255,255,255,0.02)',
    marginBottom: '4px', flexWrap: 'wrap'
  },
  sessionIndex: {
    color: '#6366F1', fontWeight: '700',
    fontSize: '11px', fontFamily: "'SF Mono', monospace"
  },
  sessionTime: {
    color: '#CCC', fontFamily: "'SF Mono', monospace", fontSize: '12px'
  },
  sessionDuration: {
    color: '#F59E0B', fontWeight: '700',
    fontFamily: "'SF Mono', monospace",
    fontSize: '12px', marginLeft: 'auto'
  },
  estimationBar: {
    display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap',
    marginTop: 8, padding: '7px 10px',
    background: 'rgba(245,158,11,0.10)',
    border: '1px solid rgba(245,158,11,0.35)',
    borderRadius: 10,
  },
  estimationTexte: { fontSize: 11.5, color: '#B45309', fontWeight: 600, flex: 1, minWidth: 160 },
  estimationActions: { display: 'inline-flex', gap: 6 },
  estimationBtnOk: {
    display: 'inline-flex', alignItems: 'center', gap: 4,
    padding: '4px 9px', fontSize: 11.5, fontWeight: 700, cursor: 'pointer',
    background: '#10B981', color: '#fff', border: 'none', borderRadius: 8,
  },
  estimationBtnNo: {
    display: 'inline-flex', alignItems: 'center', gap: 4,
    padding: '4px 9px', fontSize: 11.5, fontWeight: 700, cursor: 'pointer',
    background: 'transparent', color: '#B45309',
    border: '1px solid rgba(180,83,9,0.45)', borderRadius: 8,
  },
  sessionAutoClosed: {
    background: 'rgba(239,68,68,0.1)', color: '#EF4444',
    padding: '1px 6px', borderRadius: '4px',
    fontSize: '9px', fontWeight: '700'
  },

  // Overtime
  overtimeRow: {
    display: 'flex', alignItems: 'flex-start', gap: '10px',
    background: 'rgba(249,115,22,0.05)',
    border: '1px solid rgba(249,115,22,0.12)',
    borderRadius: '10px', padding: '10px'
  },
  overtimeRowInfo: {
    display: 'flex', flexDirection: 'column', gap: '6px', flex: 1
  },
  overtimeRowTitle: {
    color: '#F97316', fontSize: '11px', fontWeight: '700',
    textTransform: 'uppercase', letterSpacing: '0.5px'
  },
  overtimeRowDetails: {
    display: 'flex', gap: '6px', flexWrap: 'wrap', alignItems: 'center'
  },
  overtimeDetailChip: {
    display: 'flex', alignItems: 'center', gap: '5px',
    padding: '3px 8px', borderRadius: '6px',
    background: 'rgba(249,115,22,0.06)',
    border: '1px solid rgba(249,115,22,0.15)', fontSize: '11px'
  },
  overtimeDetailLabel: {
    color: '#888', fontWeight: '600',
    textTransform: 'uppercase', fontSize: '8px', letterSpacing: '0.3px'
  },
  overtimeDetailValue: {
    color: '#F97316', fontWeight: '800', fontFamily: "'SF Mono', monospace"
  },
  overtimeDetailRate: { color: '#F97316', fontWeight: '600', opacity: 0.7, fontSize: '9px' },
  overtimeTotalChip: {
    display: 'flex', alignItems: 'center', gap: '4px',
    padding: '3px 10px', borderRadius: '6px',
    background: 'rgba(249,115,22,0.15)',
    border: '1px solid rgba(249,115,22,0.3)',
    color: '#F97316', fontSize: '11px', fontWeight: '800',
    fontFamily: "'SF Mono', monospace"
  },

  // Conflict / Holiday
  conflictInfoBox: {
    display: 'flex', alignItems: 'flex-start', gap: '10px',
    background: 'rgba(249,115,22,0.06)',
    border: '1px solid rgba(249,115,22,0.15)',
    borderRadius: '10px', padding: '10px'
  },
  conflictInfoTitle: {
    display: 'block', color: '#F97316',
    fontSize: '12px', fontWeight: '700'
  },
  conflictInfoSub: {
    display: 'block', color: '#BFA48A',
    fontSize: '11px', marginTop: '2px'
  },
  holidayBox: {
    display: 'flex', alignItems: 'flex-start', gap: '10px',
    background: 'rgba(139,92,246,0.06)',
    border: '1px solid rgba(139,92,246,0.15)',
    borderRadius: '10px', padding: '10px'
  },
  holidayTitle: {
    display: 'block', color: '#8B5CF6',
    fontSize: '12px', fontWeight: '700'
  },
  holidaySub: {
    display: 'block', color: '#C4B5FD',
    fontSize: '11px', marginTop: '2px'
  },

  // Face
  faceRow: {
    display: 'flex', alignItems: 'flex-start', gap: '10px',
    background: 'rgba(99,102,241,0.04)',
    border: '1px solid rgba(99,102,241,0.12)',
    borderRadius: '10px', padding: '10px'
  },
  faceInfo: { display: 'flex', flexDirection: 'column', gap: '5px', flex: 1 },
  faceLabel: {
    color: '#6366F1', fontSize: '10px', fontWeight: '700',
    textTransform: 'uppercase', letterSpacing: '0.5px'
  },
  faceDetails: { display: 'flex', flexWrap: 'wrap', gap: '6px', alignItems: 'center' },
  faceBadgeRow: { color: '#6366F1', fontSize: '12px', fontWeight: '600' },
  faceScore: {
    color: '#888', fontSize: '11px', fontWeight: '600',
    fontFamily: "'SF Mono', monospace",
    background: 'rgba(255,255,255,0.04)',
    padding: '2px 7px', borderRadius: '5px'
  },
  faceScoreBadge: {
    padding: '2px 8px', borderRadius: '6px', fontSize: '10px',
    fontWeight: '700', display: 'inline-flex', alignItems: 'center', gap: '3px'
  },

  // Photos
  photosRow: {
    display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap'
  },
  photosLabel: {
    display: 'flex', alignItems: 'center', gap: '5px',
    color: '#6366F1', fontSize: '10px', fontWeight: '700',
    textTransform: 'uppercase', letterSpacing: '0.5px'
  },
  photoThumbnails: { display: 'flex', gap: '6px', flexWrap: 'wrap' },
  thumbnailContainer: {
    position: 'relative', cursor: 'pointer',
    borderRadius: '8px', overflow: 'hidden',
    border: '2px solid rgba(245,158,11,0.25)',
    transition: 'all 0.2s', flexShrink: 0
  },
  thumbnail: { width: '40px', height: '40px', objectFit: 'cover', display: 'block' },
  thumbnailOverlay: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    background: 'rgba(0,0,0,0.5)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    opacity: 0, transition: 'opacity 0.2s'
  },
  thumbnailType: {
    position: 'absolute', bottom: '2px', right: '2px',
    padding: '1px 4px', borderRadius: '3px',
    fontSize: '7px', fontWeight: '800', color: '#000'
  },

  // GPS
  geoRow: {
    display: 'flex', alignItems: 'flex-start', gap: '10px',
    background: 'rgba(16,185,129,0.03)',
    border: '1px solid rgba(16,185,129,0.08)',
    borderRadius: '10px', padding: '10px'
  },
  geoInfo: { display: 'flex', flexDirection: 'column', gap: '5px', flex: 1 },
  geoLabel: {
    color: '#10B981', fontSize: '10px', fontWeight: '700',
    textTransform: 'uppercase', letterSpacing: '0.5px'
  },
  geoDetails: { display: 'flex', flexWrap: 'wrap', gap: '6px', alignItems: 'center' },
  geoLink: {
    color: '#10B981', fontSize: '11px', textDecoration: 'none',
    fontFamily: "'SF Mono', monospace",
    borderBottom: '1px dashed rgba(16,185,129,0.3)'
  },
  geoBadge: {
    padding: '2px 8px', borderRadius: '6px', fontSize: '10px',
    fontWeight: '700', display: 'inline-flex', alignItems: 'center', gap: '3px'
  },
  geoDistance: {
    color: '#888', fontSize: '10px', fontWeight: '600',
    fontFamily: "'SF Mono', monospace",
    background: 'rgba(255,255,255,0.04)',
    padding: '2px 7px', borderRadius: '5px'
  },

  // Modified
  modifiedRow: {
    display: 'flex', alignItems: 'center', gap: '8px',
    padding: '6px 10px',
    background: 'rgba(99,102,241,0.04)',
    border: '1px solid rgba(99,102,241,0.1)',
    borderRadius: '8px'
  },
  modifiedText: { color: '#888', fontSize: '11px' },

  // Actions
  actionsRow: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    borderTop: '1px solid rgba(255,255,255,0.04)',
    paddingTop: '10px', marginTop: '2px',
    gap: '8px', flexWrap: 'wrap'
  },
  actionsRight: { display: 'flex', gap: '5px', flexWrap: 'wrap' },
  expandBtn: {
    display: 'flex', alignItems: 'center', gap: '5px',
    background: 'rgba(255,255,255,0.04)',
    border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: '8px', padding: '6px 11px',
    color: '#888', cursor: 'pointer', fontSize: '12px',
    fontWeight: '600', transition: 'all 0.2s'
  },
  sessionCountBadge: {
    background: 'rgba(99,102,241,0.1)', color: '#6366F1',
    padding: '1px 7px', borderRadius: '6px',
    fontSize: '10px', fontWeight: '700'
  },
  shareBtn: {
    display: 'flex', alignItems: 'center', gap: '5px',
    background: 'rgba(16,185,129,0.08)',
    border: '1px solid rgba(16,185,129,0.15)',
    borderRadius: '8px', padding: '6px 11px',
    color: '#10B981', cursor: 'pointer', fontSize: '12px',
    fontWeight: '600', transition: 'all 0.2s'
  },
  conflictActionBtn: {
    display: 'flex', alignItems: 'center', gap: '5px',
    background: 'rgba(249,115,22,0.08)',
    border: '1px solid rgba(249,115,22,0.15)',
    borderRadius: '8px', padding: '6px 11px',
    color: '#F97316', cursor: 'pointer', fontSize: '12px',
    fontWeight: '600', transition: 'all 0.2s'
  },
  editBtn: {
    display: 'flex', alignItems: 'center', gap: '5px',
    background: 'rgba(245,158,11,0.08)',
    border: '1px solid rgba(245,158,11,0.12)',
    borderRadius: '8px', padding: '6px 11px',
    color: '#F59E0B', cursor: 'pointer', fontSize: '12px',
    fontWeight: '600', transition: 'all 0.2s'
  },
  editBtnLocked: {
    background: 'rgba(100,100,100,0.06)',
    borderColor: 'rgba(100,100,100,0.1)', color: '#888'
  },
  deleteBtn: {
    display: 'flex', alignItems: 'center', gap: '5px',
    background: 'rgba(239,68,68,0.08)',
    border: '1px solid rgba(239,68,68,0.12)',
    borderRadius: '8px', padding: '6px 11px',
    color: '#EF4444', cursor: 'pointer', fontSize: '12px',
    fontWeight: '600', transition: 'all 0.2s'
  },

  // Modals communs
  modalOverlay: {
    position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
    background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(8px)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    padding: '16px', zIndex: 1000
  },
  confirmModal: {
    background: '#141423', border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: '22px', width: '100%', maxWidth: '460px',
    padding: 'clamp(20px, 5vw, 32px)', textAlign: 'center',
    boxShadow: '0 20px 60px rgba(0,0,0,0.5)'
  },
  modalIconWrap: {
    width: '60px', height: '60px', borderRadius: '16px',
    background: 'rgba(239,68,68,0.12)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    margin: '0 auto 18px'
  },
  modalTitle: {
    fontSize: '18px', fontWeight: '700', color: '#FFF', marginBottom: '10px'
  },
  modalText: {
    color: '#888', marginBottom: '20px', lineHeight: 1.6, fontSize: '13px'
  },
  confirmInputGroup: { textAlign: 'left', marginBottom: '22px' },
  confirmLabel: {
    display: 'block', color: '#CCC', fontSize: '12px',
    marginBottom: '8px', fontWeight: '500'
  },
  confirmInputExample: {
    background: 'rgba(245,158,11,0.08)',
    border: '1px solid rgba(245,158,11,0.15)',
    borderRadius: '8px', padding: '8px 12px',
    color: '#F59E0B', fontSize: '14px', fontWeight: '700',
    marginBottom: '10px', fontFamily: "'SF Mono', monospace"
  },
  confirmInput: {
    width: '100%', padding: '11px 14px',
    borderRadius: '10px', border: '1px solid',
    background: 'rgba(255,255,255,0.04)', color: '#FFF',
    fontSize: '14px', outline: 'none', fontFamily: 'inherit',
    boxSizing: 'border-box', transition: 'border-color 0.2s'
  },
  modalButtons: { display: 'flex', gap: '10px' },
  cancelBtn: {
    flex: 1, padding: '12px',
    background: 'rgba(255,255,255,0.06)',
    border: '1px solid rgba(255,255,255,0.1)',
    color: '#E5E5E5', borderRadius: '12px',
    fontWeight: '600', fontSize: '13px', cursor: 'pointer'
  },
  confirmDeleteBtn: {
    flex: 1, padding: '12px',
    background: 'linear-gradient(135deg, #EF4444, #B91C1C)',
    color: '#FFF', border: 'none', borderRadius: '12px',
    fontWeight: '700', fontSize: '13px', cursor: 'pointer',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    gap: '6px', transition: 'opacity 0.2s'
  },
  closeModalBtn: {
    position: 'absolute', top: '12px', right: '12px',
    background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(10px)',
    border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: '10px', width: '36px', height: '36px',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    cursor: 'pointer', color: '#FFF', zIndex: 10
  },

  // Photo Modal
  photoModal: {
    background: '#141423', border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: '22px', width: '100%', maxWidth: '520px',
    maxHeight: '90vh', overflow: 'hidden', position: 'relative',
    display: 'flex', flexDirection: 'column',
    boxShadow: '0 20px 60px rgba(0,0,0,0.5)'
  },
  photoContainer: {
    background: '#000', display: 'flex', alignItems: 'center',
    justifyContent: 'center', flex: 1, overflow: 'hidden', minHeight: '200px'
  },
  fullPhoto: { width: '100%', maxHeight: '50vh', objectFit: 'contain' },
  photoModalFooter: {
    padding: '14px 18px', borderTop: '1px solid rgba(255,255,255,0.06)',
    display: 'flex', justifyContent: 'space-between', alignItems: 'center'
  },
  photoModalInfo: { display: 'flex', flexDirection: 'column', gap: '2px' },
  deletePhotoBtn: {
    display: 'flex', alignItems: 'center', gap: '6px',
    background: 'rgba(239,68,68,0.1)',
    border: '1px solid rgba(239,68,68,0.2)',
    color: '#EF4444', borderRadius: '8px',
    padding: '7px 14px', fontSize: '12px', fontWeight: '600', cursor: 'pointer'
  },

  // Upgrade Modal
  upgradeModal: {
    background: '#141423', border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: '22px', width: '100%', maxWidth: '460px',
    maxHeight: '90vh', overflow: 'auto', position: 'relative',
    boxShadow: '0 20px 60px rgba(0,0,0,0.5)'
  },
  upgradeHeader: {
    textAlign: 'center', padding: '36px 28px 20px',
    borderBottom: '1px solid rgba(255,255,255,0.06)'
  },
  upgradeIconWrap: {
    width: '64px', height: '64px', borderRadius: '18px',
    background: 'rgba(245,158,11,0.1)',
    border: '1px solid rgba(245,158,11,0.2)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    margin: '0 auto 18px'
  },
  upgradeTitle: {
    color: '#FFF', fontSize: '20px', fontWeight: '700', margin: '0 0 8px'
  },
  upgradeSubtitle: { color: '#888', fontSize: '13px', margin: 0, lineHeight: 1.5 },
  upgradeBody: { padding: '20px 28px' },
  upgradeFeatureCard: {
    display: 'flex', alignItems: 'flex-start', gap: '14px',
    padding: '18px', background: 'rgba(139,92,246,0.06)',
    border: '1px solid rgba(139,92,246,0.12)',
    borderRadius: '14px', marginBottom: '16px'
  },
  upgradeFeatureIcon: {
    width: '44px', height: '44px', borderRadius: '12px',
    background: 'rgba(139,92,246,0.15)',
    display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0
  },
  upgradeFeatureName: {
    color: '#FFF', fontSize: '15px', fontWeight: '600', margin: '0 0 4px'
  },
  upgradeFeatureDesc: { color: '#888', fontSize: '12px', margin: 0, lineHeight: 1.5 },
  upgradeBenefits: {
    background: 'rgba(16,185,129,0.05)',
    border: '1px solid rgba(16,185,129,0.12)',
    borderRadius: '10px', padding: '14px'
  },
  upgradeBenefitItem: {
    color: '#10B981', fontSize: '12px', margin: '0 0 6px',
    display: 'flex', alignItems: 'center', gap: '6px'
  },
  upgradeFooter: {
    padding: '18px 28px 28px',
    borderTop: '1px solid rgba(255,255,255,0.06)', textAlign: 'center'
  },
  upgradeOkBtn: {
    padding: '12px 28px',
    background: 'linear-gradient(135deg, #F59E0B, #D97706)',
    color: '#000', border: 'none', borderRadius: '12px',
    fontSize: '14px', fontWeight: '700', cursor: 'pointer'
  },

  // Conflict Modal
  conflictModal: {
    background: '#141423', border: '1px solid rgba(249,115,22,0.2)',
    borderRadius: '22px', width: '100%', maxWidth: '540px',
    maxHeight: '90vh', overflow: 'auto',
    boxShadow: '0 20px 60px rgba(0,0,0,0.5)'
  },
  conflictModalHeader: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    padding: '20px', borderBottom: '1px solid rgba(255,255,255,0.06)'
  },
  conflictModalTitleWrap: { display: 'flex', alignItems: 'center', gap: '12px' },
  conflictModalIcon: {
    width: '42px', height: '42px', borderRadius: '12px',
    background: 'rgba(249,115,22,0.12)',
    display: 'flex', alignItems: 'center', justifyContent: 'center'
  },
  conflictModalTitle: {
    color: '#FFF', fontSize: '18px', fontWeight: '700', margin: 0
  },
  conflictModalSubtitle: { color: '#F97316', fontSize: '12px', margin: '3px 0 0' },
  closeBtn: {
    width: '34px', height: '34px', borderRadius: '10px',
    background: 'rgba(255,255,255,0.06)',
    border: '1px solid rgba(255,255,255,0.1)',
    color: '#888', display: 'flex', alignItems: 'center',
    justifyContent: 'center', cursor: 'pointer'
  },
  conflictModalBody: {
    padding: '20px', display: 'flex', flexDirection: 'column', gap: '18px'
  },
  conflictSummary: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))',
    gap: '10px'
  },
  conflictSummaryItem: {
    background: 'rgba(255,255,255,0.03)',
    border: '1px solid rgba(255,255,255,0.05)',
    borderRadius: '10px', padding: '12px'
  },
  conflictSummaryLabel: {
    display: 'block', color: '#666', fontSize: '10px',
    marginBottom: '5px', textTransform: 'uppercase', letterSpacing: '0.5px'
  },
  conflictSummaryValue: {
    display: 'block', color: '#FFF', fontSize: '13px', fontWeight: '600'
  },
  fieldLabel: { color: '#E5E5E5', fontSize: '12px', fontWeight: '500' },
  textarea: {
    minHeight: '80px', resize: 'vertical',
    padding: '12px 14px', borderRadius: '10px',
    border: '1px solid rgba(255,255,255,0.1)',
    background: 'rgba(255,255,255,0.04)',
    color: '#FFF', fontFamily: 'inherit', fontSize: '13px', outline: 'none'
  },
  conflictActionsList: { display: 'flex', flexDirection: 'column', gap: '10px' },
  resolveBtnKeep: {
    display: 'flex', alignItems: 'center', gap: '12px', padding: '14px',
    borderRadius: '12px', border: '1px solid rgba(16,185,129,0.2)',
    background: 'rgba(16,185,129,0.06)', color: '#10B981',
    cursor: 'pointer', textAlign: 'left'
  },
  resolveBtnCancel: {
    display: 'flex', alignItems: 'center', gap: '12px', padding: '14px',
    borderRadius: '12px', border: '1px solid rgba(99,102,241,0.2)',
    background: 'rgba(99,102,241,0.06)', color: '#6366F1',
    cursor: 'pointer', textAlign: 'left'
  },
  resolveBtnIgnore: {
    display: 'flex', alignItems: 'center', gap: '12px', padding: '14px',
    borderRadius: '12px', border: '1px solid rgba(107,114,128,0.2)',
    background: 'rgba(107,114,128,0.06)', color: '#9CA3AF',
    cursor: 'pointer', textAlign: 'left'
  },
  resolveBtnTextWrap: { display: 'flex', flexDirection: 'column', gap: '3px' },
  resolveBtnTitle: { fontSize: '13px', fontWeight: '700' },
  resolveBtnSub: { fontSize: '11px', opacity: 0.8 },

  // Share Modal
  shareModal: {
    background: '#141423', border: '1px solid rgba(16,185,129,0.15)',
    borderRadius: '22px', width: '100%', maxWidth: '520px',
    maxHeight: '90vh', overflow: 'auto', position: 'relative',
    boxShadow: '0 20px 60px rgba(0,0,0,0.5)'
  },
  shareModalHeader: {
    display: 'flex', alignItems: 'center', gap: '14px',
    padding: '20px 20px 16px'
  },
  shareModalIcon: {
    width: '46px', height: '46px', borderRadius: '14px',
    background: 'rgba(16,185,129,0.1)',
    border: '1px solid rgba(16,185,129,0.2)',
    display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0
  },
  shareModalTitle: {
    color: '#FFF', fontSize: '18px', fontWeight: '700', margin: 0
  },
  shareModalSub: { color: '#10B981', fontSize: '13px', margin: '3px 0 0' },
  sharePreview: {
    margin: '0 20px',
    background: 'rgba(255,255,255,0.02)',
    border: '1px solid rgba(255,255,255,0.06)',
    borderRadius: '12px', padding: '14px',
    maxHeight: '200px', overflowY: 'auto'
  },
  sharePreviewText: {
    color: '#CCC', fontSize: '12px', lineHeight: '1.6',
    fontFamily: "'SF Mono', monospace",
    margin: 0, whiteSpace: 'pre-wrap', wordBreak: 'break-word'
  },
  sharePhoneGroup: {
    display: 'flex', flexDirection: 'column', gap: '6px',
    padding: '16px 20px 8px'
  },
  sharePhoneLabel: {
    display: 'flex', alignItems: 'center', gap: '6px',
    color: '#888', fontSize: '12px', fontWeight: '600',
    textTransform: 'uppercase', letterSpacing: '0.5px'
  },
  sharePhoneInput: {
    padding: '11px 14px', border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: '10px', background: 'rgba(255,255,255,0.04)',
    color: '#FFF', fontSize: '14px', outline: 'none', fontFamily: 'inherit'
  },
  sharePhoneHint: {
    color: '#555', fontSize: '11px'
  },
  shareActions: {
    display: 'flex', gap: '10px', padding: '16px 20px 24px',
    flexWrap: 'wrap'
  },
  shareCopyBtn: {
    display: 'flex', alignItems: 'center', gap: '7px',
    background: 'rgba(255,255,255,0.06)',
    border: '1px solid rgba(255,255,255,0.1)',
    color: '#E5E5E5', borderRadius: '12px',
    padding: '12px 20px', fontSize: '14px',
    fontWeight: '600', cursor: 'pointer', flex: '0 0 auto'
  },
  shareWhatsAppBtn: {
    display: 'flex', alignItems: 'center', gap: '8px',
    background: 'linear-gradient(135deg, #25D366, #128C7E)',
    color: '#FFF', border: 'none', borderRadius: '12px',
    padding: '12px 24px', fontSize: '14px',
    fontWeight: '700', cursor: 'pointer', flex: 1,
    justifyContent: 'center'
  },
}