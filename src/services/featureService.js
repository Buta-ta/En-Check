// ═══════════════════════════════════════════════════════════
// 🔐 SERVICE DE GESTION DES FEATURES PAYANTES
// ═══════════════════════════════════════════════════════════

import { db } from '../lib/db'

export const FEATURES = {
  MODIFICATION_POINTAGES: 'modification_pointages',
  MULTI_ENTREPRISES: 'multi_entreprises',
  NOTIFICATIONS_PUSH: 'notifications_push',
  GESTION_CONGES: 'gestion_conges',
  HEURES_SUPPLEMENTAIRES: 'heures_supplementaires',
  PHOTO_POINTAGE: 'photo_pointage',
  SUPPORT_IA: 'support_ia',
  ESPACE_EMPLOYE: 'espace_employe',

  // 🌍 NOUVELLES FEATURES GÉOFENCING & RECO FACIALE
  GEOFENCING: 'geofencing',
  RECONNAISSANCE_FACIALE: 'reconnaissance_faciale',
  CARTE_TEMPS_REEL: 'carte_temps_reel',

  // 💰 NOUVELLE FEATURE FICHES DE PAIE
  FICHES_PAIE: 'fiches_paie',
  // 📋 NOUVELLES FEATURES TÂCHES & ÉQUIPES
  GESTION_TACHES: 'gestion_taches',
  GESTION_EQUIPES: 'gestion_equipes',
  PREDICTIONS: 'predictions',
}

// ─── Les dates d'effet d'une grille horaire ──────────────────────────────────
//  Une grille porte la période pendant laquelle elle fait autorité. Ces trois
//  fonctions sont la seule définition de cette règle dans toute l'application :
//  une version sans date de début vaut depuis toujours, sans date de fin vaut
//  sans fin, et entre deux versions c'est la plus récemment déclarée qui gagne.
const DATE_SANS_DEBUT = '1900-01-01'

function jourISO(valeur) {
  if (valeur instanceof Date) {
    const a = valeur.getFullYear()
    const m = String(valeur.getMonth() + 1).padStart(2, '0')
    const j = String(valeur.getDate()).padStart(2, '0')
    return `${a}-${m}-${j}`
  }
  return String(valeur || '').slice(0, 10)
}

function grilleValableLe(grille, jour) {
  if (!grille) return false
  if (!jour) return true
  const debut = grille.valide_du ? String(grille.valide_du).slice(0, 10) : DATE_SANS_DEBUT
  const fin = grille.valide_au ? String(grille.valide_au).slice(0, 10) : null
  if (jour < debut) return false
  if (fin && jour > fin) return false
  return true
}

function cleVersion(grille) {
  const debut = grille && grille.valide_du ? String(grille.valide_du).slice(0, 10) : DATE_SANS_DEBUT
  //  À date d'effet égale, la dernière créée l'emporte : c'est celle que
  //  quelqu'un vient de déclarer.
  const creation = grille && grille.created_at ? String(grille.created_at) : ''
  return `${debut}|${creation}`
}

const PLANS_CONFIG = {
  gratuit: {
    features: [],
    max_entreprises: 1,
    max_employes: 10,
  },
  pro: {
    features: [
      FEATURES.MODIFICATION_POINTAGES,
      FEATURES.MULTI_ENTREPRISES,
      FEATURES.HEURES_SUPPLEMENTAIRES,
    ],
    max_entreprises: 3,
    max_employes: 50,
  },
  entreprise: {
    features: [
      FEATURES.MODIFICATION_POINTAGES,
      FEATURES.MULTI_ENTREPRISES,
      FEATURES.NOTIFICATIONS_PUSH,
      FEATURES.GESTION_CONGES,
      FEATURES.HEURES_SUPPLEMENTAIRES,
      FEATURES.PHOTO_POINTAGE,
      FEATURES.SUPPORT_IA,
      FEATURES.ESPACE_EMPLOYE,
      FEATURES.FICHES_PAIE,
    ],
    max_entreprises: 999,
    max_employes: 999,
  },
}

class FeatureService {
  static async hasFeature(entrepriseId, featureCode) {
    try {
      const adminData = JSON.parse(localStorage.getItem('admin') || '{}')
      if (adminData.role === 'super_admin') {
        return true
      }

      const { data: enterprise } = await db()
        .from('enterprises')
        .select(`
          module_modification_pointages,
          module_planning,
          module_retards,
          module_heures_supplementaires,
          module_photo_pointage,
          module_conges,
          module_rapports_avances,
          module_espace_employe,
          module_geolocalisation,
          module_reconnaissance_faciale,
          module_carte_temps_reel,
          module_fiches_paie,
          module_taches,
          module_predictions
        `)
        .eq('id', entrepriseId)
        .single()

      if (enterprise) {
        const moduleMapping = {
          [FEATURES.MODIFICATION_POINTAGES]: enterprise.module_modification_pointages,
          [FEATURES.HEURES_SUPPLEMENTAIRES]: enterprise.module_heures_supplementaires,
          [FEATURES.PHOTO_POINTAGE]: enterprise.module_photo_pointage,
          [FEATURES.GESTION_CONGES]: enterprise.module_conges,
          [FEATURES.ESPACE_EMPLOYE]: enterprise.module_espace_employe,

          [FEATURES.GEOFENCING]: enterprise.module_geolocalisation,
          [FEATURES.RECONNAISSANCE_FACIALE]: enterprise.module_reconnaissance_faciale,
          [FEATURES.CARTE_TEMPS_REEL]: enterprise.module_carte_temps_reel,

          [FEATURES.FICHES_PAIE]: enterprise.module_fiches_paie,
                  // 📋 NOUVELLES FEATURES TÂCHES & ÉQUIPES
          [FEATURES.GESTION_TACHES]: enterprise.module_taches,
          [FEATURES.GESTION_EQUIPES]: enterprise.module_taches,
          [FEATURES.PREDICTIONS]: enterprise.module_predictions,


        }

        if (
          moduleMapping[featureCode] !== undefined &&
          moduleMapping[featureCode] === true
        ) {
          return true
        }
      }

      const { data: abonnement } = await db()
        .from('abonnements')
        .select('plan, features_actives, date_expiration')
        .eq('enterprise_id', entrepriseId)
        .single()

      if (!abonnement) return false

      if (abonnement.date_expiration) {
        const expirationDate = new Date(abonnement.date_expiration)
        if (expirationDate < new Date()) return false
      }

      const planFeatures = PLANS_CONFIG[abonnement.plan]?.features || []
      const featuresActives = abonnement.features_actives || []

      return planFeatures.includes(featureCode) || featuresActives.includes(featureCode)
    } catch (error) {
      console.error('Erreur vérification feature:', error)
      return false
    }
  }

  // === NOUVELLE MÉTHODE POUR L'ESPACE EMPLOYÉ ===
  static async hasFeatureForEmployee(entrepriseId, featureCode) {
    try {
      const { data: enterprise } = await db()
        .from('enterprises')
        .select(`
          module_modification_pointages,
          module_planning,
          module_retards,
          module_heures_supplementaires,
          module_photo_pointage,
          module_conges,
          module_rapports_avances,
          module_espace_employe,
          module_geolocalisation,
          module_reconnaissance_faciale,
          module_carte_temps_reel,
          module_fiches_paie
        `)
        .eq('id', entrepriseId)
        .single()

      if (enterprise) {
        const moduleMapping = {
          [FEATURES.MODIFICATION_POINTAGES]: enterprise.module_modification_pointages,
          [FEATURES.HEURES_SUPPLEMENTAIRES]: enterprise.module_heures_supplementaires,
          [FEATURES.PHOTO_POINTAGE]: enterprise.module_photo_pointage,
          [FEATURES.GESTION_CONGES]: enterprise.module_conges,
          [FEATURES.ESPACE_EMPLOYE]: enterprise.module_espace_employe,

          [FEATURES.GEOFENCING]: enterprise.module_geolocalisation,
          [FEATURES.RECONNAISSANCE_FACIALE]: enterprise.module_reconnaissance_faciale,
          [FEATURES.CARTE_TEMPS_REEL]: enterprise.module_carte_temps_reel,

          [FEATURES.FICHES_PAIE]: enterprise.module_fiches_paie,
                  // 📋 NOUVELLES FEATURES TÂCHES & ÉQUIPES
          [FEATURES.GESTION_TACHES]: enterprise.module_taches,
          [FEATURES.GESTION_EQUIPES]: enterprise.module_taches, // même module
          [FEATURES.PREDICTIONS]: enterprise.module_predictions,

        }

        if (moduleMapping[featureCode] === true) {
          return true
        }
      }

      const { data: abonnement } = await db()
        .from('abonnements')
        .select('plan, features_actives, date_expiration')
        .eq('enterprise_id', entrepriseId)
        .single()

      if (!abonnement) return false

      if (abonnement.date_expiration) {
        if (new Date(abonnement.date_expiration) < new Date()) return false
      }

      const planFeatures = PLANS_CONFIG[abonnement.plan]?.features || []
      const featuresActives = abonnement.features_actives || []

      return planFeatures.includes(featureCode) || featuresActives.includes(featureCode)
    } catch (error) {
      console.error('Erreur vérification feature employé:', error)
      return false
    }
  }

  static async getEntrepriseFeatures(enterpriseId) {
    try {
      const { data: abonnement } = await db()
        .from('abonnements')
        .select('plan, features_actives')
        .eq('enterprise_id', enterpriseId)
        .single()

      if (!abonnement) return PLANS_CONFIG.gratuit.features

      const planFeatures = PLANS_CONFIG[abonnement.plan]?.features || []
      const featuresActives = abonnement.features_actives || []

      return [...new Set([...planFeatures, ...featuresActives])]
    } catch (err) {
      console.error('Erreur récupération features:', err)
      return []
    }
  }

  static async getEntreprisePlan(enterpriseId) {
    try {
      const { data: abonnement } = await db()
        .from('abonnements')
        .select('*')
        .eq('enterprise_id', enterpriseId)
        .single()

      if (!abonnement) {
        return {
          plan: 'gratuit',
          features: PLANS_CONFIG.gratuit.features,
          expired: false,
        }
      }

      const expired = abonnement.date_expiration
        ? new Date(abonnement.date_expiration) < new Date()
        : false

      const planFeatures = PLANS_CONFIG[abonnement.plan]?.features || []
      const featuresActives = abonnement.features_actives || []

      return {
        plan: abonnement.plan,
        features: [...new Set([...planFeatures, ...featuresActives])],
        expired,
        date_expiration: abonnement.date_expiration,
      }
    } catch (err) {
      console.error('Erreur récupération plan:', err)
      return {
        plan: 'gratuit',
        features: [],
        expired: false,
      }
    }
  }

  static async toggleFeature(enterpriseId, featureCode, activate) {
    try {
      const { data: abonnement } = await db()
        .from('abonnements')
        .select('features_actives')
        .eq('enterprise_id', enterpriseId)
        .single()

      let featuresActives = abonnement?.features_actives || []

      if (activate) {
        if (!featuresActives.includes(featureCode)) {
          featuresActives.push(featureCode)
        }
      } else {
        featuresActives = featuresActives.filter(f => f !== featureCode)
      }

      if (abonnement) {
        await db()
          .from('abonnements')
          .update({ features_actives: featuresActives })
          .eq('enterprise_id', enterpriseId)
      } else {
        await db()
          .from('abonnements')
          .insert({
            enterprise_id: enterpriseId,
            plan: 'gratuit',
            features_actives: featuresActives,
            date_activation: new Date().toISOString().split('T')[0],
          })
      }

      return true
    } catch (err) {
      console.error('Erreur toggle feature:', err)
      return false
    }
  }

  static async changePlan(enterpriseId, newPlan, options = {}) {
    try {
      const adminData = JSON.parse(localStorage.getItem('admin') || '{}')

      const abonnementData = {
        enterprise_id: enterpriseId,
        plan: newPlan,
        date_activation: new Date().toISOString().split('T')[0],
        date_expiration: options.date_expiration || null,
        notes: options.notes || null,
        montant_mensuel: options.montant_mensuel || null,
        created_by: adminData.id,
        updated_at: new Date().toISOString(),
      }

      const { error } = await db()
        .from('abonnements')
        .upsert(abonnementData, { onConflict: 'enterprise_id' })

      if (error) throw error
      return true
    } catch (err) {
      console.error('Erreur changement plan:', err)
      return false
    }
  }

  // ═══════════════════════════════════════════════════════════
  // ⏱️ HEURES SUPPLÉMENTAIRES
  // ═══════════════════════════════════════════════════════════

  static getDefaultOvertimeSettings() {
    return {
      calculation_mode: 'daily',
      daily_threshold: 8,
      daily_threshold_major: 10,
      overtime_major_after_hours: 2,
      weekly_threshold: 40,
      weekly_threshold_major: 48,
      rate_normal: 25,
      rate_major: 50,
      rate_sunday: 100,
      rate_holiday: 100,
      include_weekends: true,
      auto_calculate: true,
      require_approval: false,
    }
  }

  static async getOvertimeSettings(enterpriseId) {
    try {
      const { data, error } = await db()
        .from('overtime_settings')
        .select('*')
        .eq('enterprise_id', enterpriseId)
        .maybeSingle()

      if (!data && !error) {
        return this.getDefaultOvertimeSettings()
      }

      if (error) throw error
      return { ...this.getDefaultOvertimeSettings(), ...data }
    } catch (err) {
      console.error('Erreur récupération overtime settings:', err)
      return this.getDefaultOvertimeSettings()
    }
  }

  static async saveOvertimeSettings(enterpriseId, settings) {
    try {
      const { data: existing } = await db()
        .from('overtime_settings')
        .select('id')
        .eq('enterprise_id', enterpriseId)
        .single()

      const dataToSave = {
        enterprise_id: enterpriseId,
        calculation_mode: settings.calculation_mode || 'daily',
        daily_threshold: parseFloat(settings.daily_threshold) || 8,
        daily_threshold_major: parseFloat(settings.daily_threshold_major) || 10,
        overtime_major_after_hours: parseFloat(settings.overtime_major_after_hours) || 2,
        weekly_threshold: parseFloat(settings.weekly_threshold) || 40,
        weekly_threshold_major: parseFloat(settings.weekly_threshold_major) || 48,
        rate_normal: parseFloat(settings.rate_normal) || 25,
        rate_major: parseFloat(settings.rate_major) || 50,
        rate_sunday: parseFloat(settings.rate_sunday) || 100,
        rate_holiday: parseFloat(settings.rate_holiday) || 100,
        include_weekends: settings.include_weekends ?? true,
        auto_calculate: settings.auto_calculate ?? true,
        require_approval: settings.require_approval ?? false,
        updated_at: new Date().toISOString(),
      }

      if (existing) {
        const { error } = await db()
          .from('overtime_settings')
          .update(dataToSave)
          .eq('enterprise_id', enterpriseId)
        if (error) throw error
      } else {
        const { error } = await db()
          .from('overtime_settings')
          .insert({ ...dataToSave, created_at: new Date().toISOString() })
        if (error) throw error
      }

      return true
    } catch (err) {
      console.error('Erreur sauvegarde overtime settings:', err)
      return false
    }
  }

  static calculateContractualSeconds(schedule) {
    if (!schedule || !schedule.start_time || !schedule.end_time) return null

    const parseTime = (timeStr) => {
      if (!timeStr) return 0
      const parts = timeStr.split(':').map(Number)
      return (parts[0] || 0) * 60 + (parts[1] || 0)
    }

    const startMinutes = parseTime(schedule.start_time)
    const endMinutes = parseTime(schedule.end_time)
    if (endMinutes <= startMinutes) return null

    let contractMinutes = endMinutes - startMinutes

    if (schedule.has_break && schedule.break_start && schedule.break_end) {
      const breakStartMinutes = parseTime(schedule.break_start)
      const breakEndMinutes = parseTime(schedule.break_end)
      if (breakEndMinutes > breakStartMinutes) {
        contractMinutes -= (breakEndMinutes - breakStartMinutes)
      }
    }

    if (contractMinutes <= 0) return null
    return contractMinutes * 60
  }

  static calculateOvertimeWithSchedule(totalWorkedSeconds, schedule, overtimeSettings, date = new Date()) {
    const config = { ...this.getDefaultOvertimeSettings(), ...(overtimeSettings || {}) }

    const emptyResult = {
      overtimeSeconds: 0,
      overtimeMajorSeconds: 0,
      totalOvertimeSeconds: 0,
      rateApplied: 0,
      rateMajorApplied: 0,
      hasOvertime: false,
      contractualSeconds: 0,
      thresholdSource: 'none',
    }

    if (!totalWorkedSeconds || totalWorkedSeconds <= 0) return emptyResult

    const dateObj = date instanceof Date ? date : new Date(date)
    const jsDay = dateObj.getDay()
    const planningDay = jsDay === 0 ? 7 : jsDay
    const isSunday = jsDay === 0
    const isSaturday = jsDay === 6

    if (schedule) {
      const contractualSeconds = this.calculateContractualSeconds(schedule)
      const isWorkDay = schedule.work_days && Array.isArray(schedule.work_days) && schedule.work_days.includes(planningDay)

      if (!isWorkDay) {
        if (!config.include_weekends && (isSaturday || isSunday)) {
          return { ...emptyResult, thresholdSource: 'weekend_excluded' }
        }
        const rate = isSunday ? (parseFloat(config.rate_sunday) || 100) : (parseFloat(config.rate_normal) || 25)
        return {
          overtimeSeconds: totalWorkedSeconds,
          overtimeMajorSeconds: 0,
          totalOvertimeSeconds: totalWorkedSeconds,
          rateApplied: rate,
          rateMajorApplied: parseFloat(config.rate_major) || 50,
          hasOvertime: true,
          contractualSeconds: 0,
          thresholdSource: 'non_work_day',
        }
      }

      if (contractualSeconds && contractualSeconds > 0) {
        return this._computeOvertime(totalWorkedSeconds, contractualSeconds, config, isSunday, 'planning')
      }
    }

    const fallbackThreshold = (parseFloat(config.daily_threshold) || 8) * 3600
    return this._computeOvertime(totalWorkedSeconds, fallbackThreshold, config, isSunday, 'settings')
  }

  static _computeOvertime(totalWorkedSeconds, thresholdSeconds, config, isSunday, thresholdSource) {
    const majorAfterSeconds = (parseFloat(config.overtime_major_after_hours) || 2) * 3600
    const thresholdMajorSeconds = thresholdSeconds + majorAfterSeconds

    let overtimeSeconds = 0
    let overtimeMajorSeconds = 0
    let rateApplied = parseFloat(config.rate_normal) || 25
    let rateMajorApplied = parseFloat(config.rate_major) || 50

    if (totalWorkedSeconds > thresholdSeconds) {
      if (totalWorkedSeconds > thresholdMajorSeconds) {
        overtimeSeconds = majorAfterSeconds
        overtimeMajorSeconds = totalWorkedSeconds - thresholdMajorSeconds
      } else {
        overtimeSeconds = totalWorkedSeconds - thresholdSeconds
        overtimeMajorSeconds = 0
      }

      if (isSunday) {
        rateApplied = parseFloat(config.rate_sunday) || 100
        rateMajorApplied = parseFloat(config.rate_sunday) || 100
      }
    }

    const totalOvertimeSeconds = overtimeSeconds + overtimeMajorSeconds

    return {
      overtimeSeconds,
      overtimeMajorSeconds,
      totalOvertimeSeconds,
      rateApplied,
      rateMajorApplied,
      hasOvertime: totalOvertimeSeconds > 0,
      contractualSeconds: thresholdSeconds,
      thresholdSource,
    }
  }

  //  Une grille horaire est-elle en vigueur à cette date ?
  //  Sans date de début, elle vaut depuis toujours ; sans date de fin, elle vaut
  //  sans fin. C'est ce qui rend les changements d'horaires inoffensifs pour le
  //  passé : une version déclarée aujourd'hui ne s'applique jamais avant sa date.
  static grilleValableLe(grille, jour) {
    return grilleValableLe(grille, jour)
  }

  static getApplicableSchedule(enterpriseId, date, allSchedules = []) {
    if (!allSchedules || allSchedules.length === 0) return null

    const dateObj = new Date(date)
    const jsDay = dateObj.getDay()
    const planningDay = jsDay === 0 ? 7 : jsDay

    const enterpriseSchedules = allSchedules.filter(
      s => s.enterprise_id === enterpriseId && s.is_active !== false
    )
    if (enterpriseSchedules.length === 0) return null

    // ── LA DATE D'ABORD ────────────────────────────────────────────────────
    //  Parmi les grilles valables ce jour-là, c'est la DERNIÈRE VERSION
    //  DÉCLARÉE qui l'emporte — celle dont la date de début est la plus
    //  récente. Sans cette règle, une nouvelle grille marquée « par défaut »
    //  changerait aussi l'horaire des mois déjà passés.
    const jour = jourISO(date)
    const valables = enterpriseSchedules.filter(s => grilleValableLe(s, jour))
    if (valables.length === 0) return null

    const cle = valables.reduce((max, s) => (cleVersion(s) > max ? cleVersion(s) : max), cleVersion(valables[0]))
    const actives = valables.filter(s => cleVersion(s) === cle)

    // 1. Priorité absolue : planning par défaut compatible avec ce jour
    const defaultScheduleForDay = actives.find(
      s =>
        s.is_default === true &&
        s.work_days &&
        Array.isArray(s.work_days) &&
        s.work_days.includes(planningDay)
    )
    if (defaultScheduleForDay) return defaultScheduleForDay

    // 2. Sinon autre planning compatible avec ce jour
    const byDay = actives.find(
      s =>
        s.work_days &&
        Array.isArray(s.work_days) &&
        s.work_days.includes(planningDay)
    )
    if (byDay) return byDay

    // 3. Sinon planning par défaut même si le jour n'est pas listé
    const defaultSchedule = actives.find(s => s.is_default === true)
    if (defaultSchedule) return defaultSchedule

    // 4. Fallback
    return actives[0] || null
  }

  static async loadSchedules(enterpriseIds) {
    try {
      const ids = Array.isArray(enterpriseIds) ? enterpriseIds : [enterpriseIds]
      const validIds = ids.filter(id => id && id !== 'all')
      if (validIds.length === 0) return []

      const { data, error } = await db()
        .from('work_schedules')
        .select('*')
        .in('enterprise_id', validIds)
        .eq('is_active', true)
        .order('is_default', { ascending: false })

      if (error) throw error
      return data || []
    } catch (err) {
      console.error('Erreur chargement plannings:', err)
      return []
    }
  }

  static formatOvertimeDisplay(seconds) {
    if (!seconds || seconds <= 0) return ''
    const hours = Math.floor(seconds / 3600)
    const minutes = Math.floor((seconds % 3600) / 60)
    if (hours > 0 && minutes > 0) return `+${hours}h${minutes.toString().padStart(2, '0')}`
    if (hours > 0) return `+${hours}h`
    return `+${minutes}min`
  }

  static formatContractualDisplay(seconds) {
    if (!seconds || seconds <= 0) return '—'
    const hours = Math.floor(seconds / 3600)
    const minutes = Math.floor((seconds % 3600) / 60)
    return `${hours}h${minutes.toString().padStart(2, '0')}`
  }




    // ═══════════════════════════════════════════════════════════
  // ⏱️ HELPERS CENTRALISÉS HEURES SUP / PLANNINGS EMPLOYÉ
  // ═══════════════════════════════════════════════════════════

  static getPlanningDayFromDate(dateStr) {
    const jsDay = new Date(dateStr + 'T12:00:00Z').getUTCDay()
    return jsDay === 0 ? 7 : jsDay
  }

  static parseTimeToMinutes(timeStr) {
    if (!timeStr) return 0
    const parts = timeStr.split(':').map(Number)
    return (parts[0] || 0) * 60 + (parts[1] || 0)
  }

  static calculateEmployeeScheduleContractualSeconds(employeeSchedule, dateStr) {
    if (!employeeSchedule) return null

    const planningDay = this.getPlanningDayFromDate(dateStr)

    // Horaires personnalisés employé
    if (employeeSchedule.use_custom_hours) {
      const workDays = employeeSchedule.custom_work_days || []
      if (!workDays.includes(planningDay)) {
        return {
          contractualSeconds: 0,
          isWorkDay: false,
          scheduleSource: 'employee_custom',
          schedule: employeeSchedule,
        }
      }

      const startMinutes = this.parseTimeToMinutes(employeeSchedule.custom_start_time)
      const endMinutes = this.parseTimeToMinutes(employeeSchedule.custom_end_time)

      if (endMinutes <= startMinutes) {
        return {
          contractualSeconds: 0,
          isWorkDay: true,
          scheduleSource: 'employee_custom',
          schedule: employeeSchedule,
        }
      }

      let contractMinutes = endMinutes - startMinutes

      if (
        employeeSchedule.custom_has_break &&
        employeeSchedule.custom_break_start &&
        employeeSchedule.custom_break_end
      ) {
        const breakStart = this.parseTimeToMinutes(employeeSchedule.custom_break_start)
        const breakEnd = this.parseTimeToMinutes(employeeSchedule.custom_break_end)
        if (breakEnd > breakStart) {
          contractMinutes -= (breakEnd - breakStart)
        }
      }

      return {
        contractualSeconds: Math.max(0, contractMinutes * 60),
        isWorkDay: true,
        scheduleSource: 'employee_custom',
        schedule: employeeSchedule,
      }
    }

    // Planning entreprise lié à l'employé
    if (employeeSchedule.schedule_id && employeeSchedule.work_schedules) {
      const ws = employeeSchedule.work_schedules
      const workDays = ws.work_days || []

      if (!workDays.includes(planningDay)) {
        return {
          contractualSeconds: 0,
          isWorkDay: false,
          scheduleSource: 'employee_linked_schedule',
          schedule: ws,
        }
      }

      const contractualSeconds = this.calculateContractualSeconds(ws) || 0

      return {
        contractualSeconds,
        isWorkDay: true,
        scheduleSource: 'employee_linked_schedule',
        schedule: ws,
      }
    }

    return null
  }

  static calculateOvertimeFromThreshold(totalWorkedSeconds, thresholdSeconds, config, dateStr, thresholdSource = 'manual') {
    const safeConfig = { ...this.getDefaultOvertimeSettings(), ...(config || {}) }

    const emptyResult = {
      overtimeSeconds: 0,
      overtimeMajorSeconds: 0,
      totalOvertimeSeconds: 0,
      rateApplied: 0,
      rateMajorApplied: 0,
      hasOvertime: false,
      contractualSeconds: thresholdSeconds || 0,
      thresholdSource,
    }

    if (!totalWorkedSeconds || totalWorkedSeconds <= 0) return emptyResult

    const jsDay = new Date(dateStr + 'T12:00:00Z').getUTCDay()
    const isSunday = jsDay === 0
    const isSaturday = jsDay === 6

    // Jour sans temps contractuel (jour non ouvré)
    if ((isSaturday || isSunday) && (!thresholdSeconds || thresholdSeconds === 0)) {
      if (!safeConfig.include_weekends) {
        return {
          ...emptyResult,
          thresholdSource: 'weekend_excluded',
        }
      }

      const rate = isSunday
        ? (parseFloat(safeConfig.rate_sunday) || 100)
        : (parseFloat(safeConfig.rate_normal) || 25)

      return {
        overtimeSeconds: totalWorkedSeconds,
        overtimeMajorSeconds: 0,
        totalOvertimeSeconds: totalWorkedSeconds,
        rateApplied: rate,
        rateMajorApplied: parseFloat(safeConfig.rate_major) || 50,
        hasOvertime: totalWorkedSeconds > 0,
        contractualSeconds: 0,
        thresholdSource,
      }
    }

    const majorAfterSeconds = (parseFloat(safeConfig.overtime_major_after_hours) || 2) * 3600
    const thresholdMajorSeconds = (thresholdSeconds || 0) + majorAfterSeconds

    let overtimeSeconds = 0
    let overtimeMajorSeconds = 0
    let rateApplied = parseFloat(safeConfig.rate_normal) || 25
    let rateMajorApplied = parseFloat(safeConfig.rate_major) || 50

    if (totalWorkedSeconds > (thresholdSeconds || 0)) {
      if (totalWorkedSeconds > thresholdMajorSeconds) {
        overtimeSeconds = majorAfterSeconds
        overtimeMajorSeconds = totalWorkedSeconds - thresholdMajorSeconds
      } else {
        overtimeSeconds = totalWorkedSeconds - (thresholdSeconds || 0)
        overtimeMajorSeconds = 0
      }

      if (isSunday) {
        rateApplied = parseFloat(safeConfig.rate_sunday) || 100
        rateMajorApplied = parseFloat(safeConfig.rate_sunday) || 100
      }
    }

    const totalOvertimeSeconds = overtimeSeconds + overtimeMajorSeconds

    return {
      overtimeSeconds,
      overtimeMajorSeconds,
      totalOvertimeSeconds,
      rateApplied,
      rateMajorApplied,
      hasOvertime: totalOvertimeSeconds > 0,
      contractualSeconds: thresholdSeconds || 0,
      thresholdSource,
    }
  }

  static calculateOvertimeForEmployeeDay({
    totalWorkedSeconds,
    employeeSchedule = null,
    enterpriseId,
    dateStr,
    allSchedules = [],
    overtimeSettings = null,
    holiday = null,
  }) {
    const config = { ...this.getDefaultOvertimeSettings(), ...(overtimeSettings || {}) }
    const isHoliday = !!holiday

    // Jour férié non travaillé : tout temps travaillé = heures sup
    if (isHoliday && holiday && !holiday.is_worked) {
      const rate = holiday.overtime_rate ?? 100
      return {
        overtimeSeconds: totalWorkedSeconds,
        overtimeMajorSeconds: 0,
        totalOvertimeSeconds: totalWorkedSeconds,
        rateApplied: rate,
        rateMajorApplied: rate,
        hasOvertime: totalWorkedSeconds > 0,
        contractualSeconds: 0,
        thresholdSource: 'holiday',
        appliedSchedule: null,
      }
    }

    // 1. Priorité planning employé
    const employeeScheduleResult = this.calculateEmployeeScheduleContractualSeconds(employeeSchedule, dateStr)
    if (employeeScheduleResult) {
      if (!employeeScheduleResult.isWorkDay) {
        return {
          ...this.calculateOvertimeFromThreshold(
            totalWorkedSeconds,
            0,
            config,
            dateStr,
            'employee_non_work_day'
          ),
          appliedSchedule: employeeScheduleResult.schedule,
        }
      }

      const settingsWithHolidayRate = isHoliday && holiday?.is_worked
        ? { ...config, rate_holiday: holiday.overtime_rate ?? 100 }
        : config

      return {
        ...this.calculateOvertimeFromThreshold(
          totalWorkedSeconds,
          employeeScheduleResult.contractualSeconds,
          settingsWithHolidayRate,
          dateStr,
          employeeScheduleResult.scheduleSource
        ),
        appliedSchedule: employeeScheduleResult.schedule,
      }
    }

    // 2. Planning entreprise
    const enterpriseSchedule = this.getApplicableSchedule(enterpriseId, dateStr, allSchedules)
    if (enterpriseSchedule) {
      const settingsWithHolidayRate = isHoliday && holiday?.is_worked
        ? { ...config, rate_holiday: holiday.overtime_rate ?? 100 }
        : config

      return {
        ...this.calculateOvertimeWithSchedule(
          totalWorkedSeconds,
          enterpriseSchedule,
          settingsWithHolidayRate,
          new Date(dateStr + 'T12:00:00Z')
        ),
        appliedSchedule: enterpriseSchedule,
      }
    }

    // 3. Fallback sur seuil journalier par défaut
    const fallbackThresholdSeconds = (parseFloat(config.daily_threshold) || 8) * 3600
    return {
      ...this.calculateOvertimeFromThreshold(
        totalWorkedSeconds,
        fallbackThresholdSeconds,
        config,
        dateStr,
        'settings_default'
      ),
      appliedSchedule: null,
    }
  }
}

export default FeatureService