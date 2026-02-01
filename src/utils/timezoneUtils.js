// ═══════════════════════════════════════════════════════════
// 🕐 UTILITAIRES DE GESTION DES FUSEAUX HORAIRES
// VERSION FINALE : AFFICHER L'HEURE UTC AVEC SECONDES
// ═══════════════════════════════════════════════════════════

/**
 * Formater une heure UTC en HH:MM:SS (AVEC secondes)
 * @param {string} utcDateString - Date ISO au format UTC
 * @returns {string} - Heure au format "HH:MM:SS" en UTC
 */
export const formaterHeureLocale = (utcDateString) => {
  if (!utcDateString) return '--:--:--'
  
  try {
    const date = new Date(utcDateString)
    const heures = date.getUTCHours().toString().padStart(2, '0')
    const minutes = date.getUTCMinutes().toString().padStart(2, '0')
    const secondes = date.getUTCSeconds().toString().padStart(2, '0')
    return `${heures}:${minutes}:${secondes}`
  } catch (error) {
    console.error('Erreur formatage heure:', error)
    return '--:--:--'
  }
}

/**
 * Formater une heure UTC en HH:MM (SANS secondes - version courte)
 * @param {string} utcDateString - Date ISO au format UTC
 * @returns {string} - Heure au format "HH:MM" en UTC
 */
export const formaterHeureLocaleShort = (utcDateString) => {
  if (!utcDateString) return '--:--'
  
  try {
    const date = new Date(utcDateString)
    const heures = date.getUTCHours().toString().padStart(2, '0')
    const minutes = date.getUTCMinutes().toString().padStart(2, '0')
    return `${heures}:${minutes}`
  } catch (error) {
    console.error('Erreur formatage heure:', error)
    return '--:--'
  }
}

/**
 * Calculer la durée entre deux dates UTC (en minutes)
 * @param {string} startUTC - Date de début UTC
 * @param {string} endUTC - Date de fin UTC
 * @returns {number} - Durée en minutes
 */
export const calculerDureeMinutes = (startUTC, endUTC) => {
  if (!startUTC || !endUTC) return 0
  const debut = new Date(startUTC)
  const fin = new Date(endUTC)
  return Math.round((fin - debut) / (1000 * 60))
}

/**
 * Calculer la durée entre deux dates UTC (en secondes exactes)
 * @param {string} startUTC - Date de début UTC
 * @param {string} endUTC - Date de fin UTC
 * @returns {number} - Durée en secondes
 */
export const calculerDureeSecondes = (startUTC, endUTC) => {
  if (!startUTC || !endUTC) return 0
  const debut = new Date(startUTC)
  const fin = new Date(endUTC)
  return Math.round((fin - debut) / 1000)
}

/**
 * Formater une durée en heures et minutes
 * @param {number} minutes - Durée en minutes
 * @returns {string} - Format "Xh YYmin"
 */
export const formaterDuree = (minutes) => {
  if (!minutes || minutes <= 0) return '--'
  const heures = Math.floor(minutes / 60)
  const mins = Math.round(minutes % 60)
  if (heures === 0) return `${mins}min`
  if (mins === 0) return `${heures}h`
  return `${heures}h${mins.toString().padStart(2, '0')}`
}

/**
 * Formater une durée en heures, minutes et secondes
 * @param {number} secondes - Durée en secondes
 * @returns {string} - Format "Xh YYmin ZZsec"
 */
export const formaterDureeComplete = (secondes) => {
  if (!secondes || secondes <= 0) return '0sec'
  
  const heures = Math.floor(secondes / 3600)
  const minutes = Math.floor((secondes % 3600) / 60)
  const secs = secondes % 60
  
  if (heures === 0 && minutes === 0) return `${secs}sec`
  if (heures === 0) return `${minutes}min ${secs}sec`
  if (minutes === 0 && secs === 0) return `${heures}h`
  if (secs === 0) return `${heures}h${minutes.toString().padStart(2, '0')}`
  
  return `${heures}h${minutes.toString().padStart(2, '0')}min ${secs}sec`
}

/**
 * Formater une date complète en français (UTC)
 * @param {string} utcDateString - Date ISO au format UTC
 * @returns {string} - Date formatée
 */
export const formaterDateLocale = (utcDateString) => {
  if (!utcDateString) return ''
  const date = new Date(utcDateString)
  return date.toLocaleDateString('fr-FR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC'
  })
}

/**
 * Formater une date et heure complète (UTC) avec secondes
 * @param {string} utcDateString - Date ISO au format UTC
 * @returns {string} - Date et heure formatées en UTC
 */
export const formaterDateHeureLocale = (utcDateString) => {
  if (!utcDateString) return ''
  const date = new Date(utcDateString)
  return date.toLocaleString('fr-FR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    timeZone: 'UTC'
  })
}

/**
 * Obtenir la date du jour au format YYYY-MM-DD (UTC)
 * @returns {string} - Date au format ISO
 */
export const obtenirDateDuJour = () => {
  const maintenant = new Date()
  return maintenant.toISOString().split('T')[0]
}

/**
 * Formater une date pour l'affichage (JJ/MM/AAAA) en UTC
 * @param {string} dateString - Date ISO
 * @returns {string} - Date formatée
 */
export const formaterDateCourte = (dateString) => {
  if (!dateString) return ''
  const date = new Date(dateString)
  return date.toLocaleDateString('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    timeZone: 'UTC'
  })
}

/**
 * Convertit une date locale en UTC pour Supabase
 * @param {string} localDateTime - Format: "2026-02-01T13:30"
 * @returns {string} - ISO string UTC
 */
export const convertirLocaleVersUTC = (localDateTime) => {
  if (!localDateTime) return null
  const date = new Date(localDateTime)
  return date.toISOString()
}

/**
 * Convertit une date UTC de Supabase en date locale
 * @param {string} utcString - ISO string UTC de Supabase
 * @returns {Date} - Objet Date en heure locale
 */
export const convertirUTCVersLocale = (utcString) => {
  if (!utcString) return null
  return new Date(utcString)
}

/**
 * Vérifie si on est dans la plage horaire (en heure locale)
 */
/**
 * Vérifie si on est dans la plage horaire (comparaison en UTC)
 */
export const estDansPlageHoraire = (dateDebut, dateFin) => {
  // Obtenir l'heure actuelle en UTC (pas locale)
  const maintenant = new Date()
  const maintenantUTC = new Date(maintenant.toISOString())
  
  const debut = dateDebut ? new Date(dateDebut) : null
  const fin = dateFin ? new Date(dateFin) : null
  
  console.log('⏰ Vérification plage horaire:')
  console.log('  Maintenant UTC:', maintenantUTC.toISOString())
  console.log('  Début:', debut?.toISOString())
  console.log('  Fin:', fin?.toISOString())
  
  if (debut && maintenantUTC < debut) {
    console.log('  ❌ Pas encore commencé')
    return false
  }
  
  if (fin && maintenantUTC > fin) {
    console.log('  ❌ Déjà terminé')
    return false
  }
  
  console.log('  ✅ Dans la plage')
  return true
}