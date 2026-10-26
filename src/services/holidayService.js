// src/services/holidayService.js
// ══════════════════════════════════════════════════════════
// 📅 SERVICE JOURS FÉRIÉS — Multi-tenant, multi-pays
// Logique : jours globaux (superadmin) + propres à l'enterprise
//           + système d'opt-out/override par enterprise
// ══════════════════════════════════════════════════════════

import { db } from '../lib/db'

// ── Codes pays francophones supportés ──
//  Le Bénin ouvre la liste africaine : c'est le premier marché.
export const SUPPORTED_COUNTRIES = [
  { code: 'FR', name: 'France',           flag: '🇫🇷' },
  { code: 'BE', name: 'Belgique',         flag: '🇧🇪' },
  { code: 'CH', name: 'Suisse',           flag: '🇨🇭' },
  { code: 'BJ', name: 'Bénin',            flag: '🇧🇯' },
  { code: 'SN', name: 'Sénégal',          flag: '🇸🇳' },
  { code: 'CI', name: 'Côte d\'Ivoire',   flag: '🇨🇮' },
  { code: 'CM', name: 'Cameroun',         flag: '🇨🇲' },
  { code: 'MA', name: 'Maroc',            flag: '🇲🇦' },
  { code: 'TN', name: 'Tunisie',          flag: '🇹🇳' },
  { code: 'DZ', name: 'Algérie',          flag: '🇩🇿' },
  { code: 'MG', name: 'Madagascar',       flag: '🇲🇬' },
  { code: 'ML', name: 'Mali',             flag: '🇲🇱' },
  { code: 'BF', name: 'Burkina Faso',     flag: '🇧🇫' },
  { code: 'NE', name: 'Niger',            flag: '🇳🇪' },
  { code: 'OTHER', name: 'Autre / Custom',flag: '🌍' },
]

class HolidayService {
  // ── Cache mémoire ──
  static _cache = new Map()
  static _cacheExpiry = new Map()
  static CACHE_TTL = 5 * 60 * 1000 // 5 min

  // ════════════════════════════════════════════════════════
  // LECTURE
  // ════════════════════════════════════════════════════════

  /**
   * Charge TOUS les jours fériés applicables à une enterprise
   * pour une année donnée.
   *
   * Logique de priorité :
   * 1. Jours propres à l'enterprise (enterprise_id = X)
   * 2. Jours globaux (enterprise_id IS NULL) filtrés par override
   *    → is_enabled = false → exclus
   *    → custom_* → valeurs surchargées
   *
   * @param {string} enterpriseId
   * @param {number} year - défaut: année courante
   * @returns {Array} jours fériés résolus et dédoublonnés
   */
  static async getHolidaysForEnterprise(enterpriseId, year = null, { strict = false } = {}) {
    const targetYear = year || new Date().getFullYear()
    const cacheKey = `${enterpriseId}_${targetYear}`

    // Vérif cache
    if (!strict && this._cache.has(cacheKey)) {
      const expiry = this._cacheExpiry.get(cacheKey)
      if (Date.now() < expiry) return this._cache.get(cacheKey)
    }

    try {
      // 1. Charger les globaux (enterprise_id IS NULL)
      const { data: globals, error: gErr } = await db()
        .from('public_holidays')
        .select('*')
        .is('enterprise_id', null)
        .order('date', { ascending: true })

      if (gErr) throw gErr

      // 2. Charger les propres à l'enterprise
      const { data: owned, error: oErr } = await db()
        .from('public_holidays')
        .select('*')
        .eq('enterprise_id', enterpriseId)
        .order('date', { ascending: true })

      if (oErr) throw oErr

      // 3. Charger les overrides de cette enterprise sur les globaux
      const { data: overrides, error: ovErr } = await db()
        .from('enterprise_holiday_overrides')
        .select('*')
        .eq('enterprise_id', enterpriseId)

      if (ovErr) throw ovErr

      // Construire map des overrides : holiday_id → override
      const overrideMap = new Map()
      ;(overrides || []).forEach(ov => overrideMap.set(ov.holiday_id, ov))

      // 4. Résoudre les globaux avec les overrides
      const resolvedGlobals = this._resolveHolidays(
        globals || [],
        targetYear,
        overrideMap
      )

      // 5. Résoudre les propres (pas d'override, ce sont les siens)
      const resolvedOwned = this._resolveHolidays(
        owned || [],
        targetYear,
        new Map()
      )

      // 6. Fusionner : les propres écrasent les globaux à même date
      const merged = this._mergeHolidays(resolvedGlobals, resolvedOwned)

      // Mise en cache
      if (!strict) {
        this._cache.set(cacheKey, merged)
        this._cacheExpiry.set(cacheKey, Date.now() + this.CACHE_TTL)
      }

      return merged
    } catch (err) {
      if (strict) throw err
      console.error('HolidayService.getHolidaysForEnterprise:', err)
      return []
    }
  }

  /**
   * Jours fériés sur une plage de dates
   * Gère le multi-année automatiquement
   */
  static async getHolidaysForRange(enterpriseId, startDate, endDate, { strict = false } = {}) {
    try {
      const start = new Date(startDate + 'T12:00:00Z')
      const end   = new Date(endDate   + 'T12:00:00Z')

      const years = new Set()
      for (let year = start.getUTCFullYear(); year <= end.getUTCFullYear(); year++) years.add(year)

      const allHolidays = []
      for (const year of years) {
        const holidays = await this.getHolidaysForEnterprise(enterpriseId, year, { strict })
        allHolidays.push(...holidays)
      }

      // Filtrer la plage exacte
      return allHolidays.filter(h => h.date >= startDate && h.date <= endDate)
    } catch (err) {
      if (strict) throw err
      console.error('HolidayService.getHolidaysForRange:', err)
      return []
    }
  }

  /**
   * Vérifie si une date est un jour férié actif
   * @returns {object|null}
   */
  static async isHoliday(enterpriseId, dateStr) {
    const year = new Date(dateStr + 'T12:00:00Z').getUTCFullYear()
    const holidays = await this.getHolidaysForEnterprise(enterpriseId, year)
    return holidays.find(h => h.date === dateStr) || null
  }

  /**
   * Charge les jours fériés GLOBAUX (pour l'interface superadmin)
   */
  static async getGlobalHolidays() {
    try {
      const { data, error } = await db()
        .from('public_holidays')
        .select('*')
        .is('enterprise_id', null)
        .order('country_code', { ascending: true })
        .order('date', { ascending: true })

      if (error) throw error
      return data || []
    } catch (err) {
      console.error('HolidayService.getGlobalHolidays:', err)
      return []
    }
  }

  /**
   * Charge les overrides d'une enterprise sur les globaux
   */
  static async getEnterpriseOverrides(enterpriseId) {
    try {
      const { data, error } = await db()
        .from('enterprise_holiday_overrides')
        .select('*')
        .eq('enterprise_id', enterpriseId)

      if (error) throw error
      return data || []
    } catch (err) {
      console.error('HolidayService.getEnterpriseOverrides:', err)
      return []
    }
  }

  // ════════════════════════════════════════════════════════
  // ÉCRITURE — Jours propres à l'enterprise
  // ════════════════════════════════════════════════════════

  static async createHoliday(enterpriseId, data) {
    try {
      const adminData = JSON.parse(localStorage.getItem('admin') || '{}')

      const { error } = await db()
        .from('public_holidays')
        .insert({
          enterprise_id: enterpriseId,
          name: data.name.trim(),
          date: data.date,
          is_recurring: data.is_recurring ?? true,
          country_code: data.country_code || 'OTHER',
          is_worked: data.is_worked ?? false,
          overtime_rate: parseInt(data.overtime_rate) || 100,
          created_by: adminData.id || null,
        })

      if (error) throw error
      this._invalidateCache(enterpriseId)
      return { success: true }
    } catch (err) {
      console.error('HolidayService.createHoliday:', err)
      return { success: false, error: err.message }
    }
  }

  static async updateHoliday(holidayId, enterpriseId, data) {
    try {
      const { error } = await db()
        .from('public_holidays')
        .update({
          name: data.name.trim(),
          date: data.date,
          is_recurring: data.is_recurring ?? true,
          is_worked: data.is_worked ?? false,
          overtime_rate: parseInt(data.overtime_rate) || 100,
          updated_at: new Date().toISOString(),
        })
        .eq('id', holidayId)
        .eq('enterprise_id', enterpriseId) // Sécurité : ne peut modifier que les siens

      if (error) throw error
      this._invalidateCache(enterpriseId)
      return { success: true }
    } catch (err) {
      console.error('HolidayService.updateHoliday:', err)
      return { success: false, error: err.message }
    }
  }

  static async deleteHoliday(holidayId, enterpriseId) {
    try {
      const { error } = await db()
        .from('public_holidays')
        .delete()
        .eq('id', holidayId)
        .eq('enterprise_id', enterpriseId) // Sécurité

      if (error) throw error
      this._invalidateCache(enterpriseId)
      return { success: true }
    } catch (err) {
      console.error('HolidayService.deleteHoliday:', err)
      return { success: false, error: err.message }
    }
  }

  // ════════════════════════════════════════════════════════
  // ÉCRITURE — Overrides sur les jours globaux
  // ════════════════════════════════════════════════════════

  /**
   * Active ou désactive un jour férié global pour une enterprise
   */
  static async toggleGlobalHoliday(enterpriseId, holidayId, isEnabled) {
    try {
      // Upsert sur la contrainte unique (enterprise_id, holiday_id)
      const { error } = await db()
        .from('enterprise_holiday_overrides')
        .upsert(
          {
            enterprise_id: enterpriseId,
            holiday_id: holidayId,
            is_enabled: isEnabled,
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'enterprise_id,holiday_id' }
        )

      if (error) throw error
      this._invalidateCache(enterpriseId)
      return { success: true }
    } catch (err) {
      console.error('HolidayService.toggleGlobalHoliday:', err)
      return { success: false, error: err.message }
    }
  }

  /**
   * Surcharge les paramètres d'un jour férié global
   * (nom, taux, is_worked) pour une enterprise
   */
  static async overrideGlobalHoliday(enterpriseId, holidayId, overrideData) {
    try {
      const { error } = await db()
        .from('enterprise_holiday_overrides')
        .upsert(
          {
            enterprise_id: enterpriseId,
            holiday_id: holidayId,
            is_enabled: true,
            custom_name: overrideData.custom_name || null,
            custom_overtime_rate: overrideData.custom_overtime_rate != null
              ? parseInt(overrideData.custom_overtime_rate)
              : null,
            custom_is_worked: overrideData.custom_is_worked ?? null,
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'enterprise_id,holiday_id' }
        )

      if (error) throw error
      this._invalidateCache(enterpriseId)
      return { success: true }
    } catch (err) {
      console.error('HolidayService.overrideGlobalHoliday:', err)
      return { success: false, error: err.message }
    }
  }

  // ════════════════════════════════════════════════════════
  // UTILITAIRES PUBLICS
  // ════════════════════════════════════════════════════════

  /**
   * Construit un Set de dates fériées pour lookup O(1)
   * Usage : dans les boucles de calcul (Retards, Absences...)
   * @returns {Set<string>} ex: Set { '2025-05-01', '2025-07-14' }
   */
  static buildHolidaySet(holidays) {
    return new Set(holidays.map(h => h.date))
  }

  /**
   * Construit une Map date → holiday pour accès rapide aux métadonnées
   * @returns {Map<string, object>}
   */
  static buildHolidayMap(holidays) {
    const map = new Map()
    holidays.forEach(h => map.set(h.date, h))
    return map
  }

  /**
   * Compte les jours fériés tombant un jour ouvré dans une plage
   * (exclut ceux qui tombent un samedi ou dimanche)
   */
  static countWorkdayHolidays(holidays, startDate, endDate) {
    return holidays.filter(h => {
      if (h.date < startDate || h.date > endDate) return false
      const dow = new Date(h.date + 'T12:00:00Z').getUTCDay()
      return dow !== 0 && dow !== 6
    }).length
  }

  /**
   * Compte les jours ouvrés dans une plage en excluant les fériés
   * Utile pour le décompte de congés
   *
   * @param {string} startDate - YYYY-MM-DD
   * @param {string} endDate   - YYYY-MM-DD
   * @param {Set<string>} holidaySet - résultat de buildHolidaySet()
   * @param {boolean} excludeWeekends - défaut true
   * @returns {number}
   */
  static countWorkingDays(startDate, endDate, holidaySet, excludeWeekends = true) {
    let count = 0
    const cursor = new Date(startDate + 'T12:00:00Z')
    const end    = new Date(endDate   + 'T12:00:00Z')

    while (cursor <= end) {
      const dateStr = cursor.toISOString().split('T')[0]
      const dow = cursor.getUTCDay()
      const isWeekend = dow === 0 || dow === 6
      const isFerie   = holidaySet.has(dateStr)

      if (!isFerie && (!excludeWeekends || !isWeekend)) {
        count++
      }
      cursor.setUTCDate(cursor.getUTCDate() + 1)
    }
    return count
  }

  /**
   * Invalide le cache (appeler après toute modification)
   */
  static _invalidateCache(enterpriseId = null) {
    if (enterpriseId) {
      for (const key of this._cache.keys()) {
        if (key.startsWith(enterpriseId)) {
          this._cache.delete(key)
          this._cacheExpiry.delete(key)
        }
      }
    } else {
      this._cache.clear()
      this._cacheExpiry.clear()
    }
  }

  // ════════════════════════════════════════════════════════
  // INTERNE
  // ════════════════════════════════════════════════════════

  /**
   * Résout les jours fériés pour une année cible.
   * - is_recurring = true → projette le même mois/jour sur targetYear
   * - is_recurring = false → garde la date exacte (si bonne année)
   * - Applique les overrides (is_enabled, custom_*)
   */
  static _resolveHolidays(holidays, targetYear, overrideMap) {
    const resolved = []

    holidays.forEach(holiday => {
      // Appliquer l'override s'il existe
      const override = overrideMap.get(holiday.id)

      // Désactivé par l'enterprise ?
      if (override && override.is_enabled === false) return

      // Résoudre la date
      const originalDate = new Date(holiday.date + 'T12:00:00Z')
      const originalYear = originalDate.getUTCFullYear()

      let resolvedDateStr
      if (holiday.is_recurring) {
        // Projeter sur l'année cible (même mois/jour)
        const month = String(originalDate.getUTCMonth() + 1).padStart(2, '0')
        const day   = String(originalDate.getUTCDate()).padStart(2, '0')
        resolvedDateStr = `${targetYear}-${month}-${day}`
      } else {
        // Date fixe : seulement si dans l'année cible
        if (originalYear !== targetYear) return
        resolvedDateStr = holiday.date
      }

      // Appliquer les surcharges de l'override
      resolved.push({
        ...holiday,
        date: resolvedDateStr,
        // Surcharges appliquées si définies
        name: override?.custom_name || holiday.name,
        overtime_rate: override?.custom_overtime_rate ?? holiday.overtime_rate,
        is_worked: override?.custom_is_worked ?? holiday.is_worked,
        // Méta
        is_global: holiday.enterprise_id === null,
        has_override: !!override,
      })
    })

    return resolved
  }

  /**
   * Fusionne globaux résolus + propres de l'enterprise.
   * Les propres (owned) gagnent sur les globaux à même date.
   */
  static _mergeHolidays(globals, owned) {
    const map = new Map()

    // 1. Insérer les globaux
    globals.forEach(h => map.set(h.date, h))

    // 2. Les propres écrasent
    owned.forEach(h => map.set(h.date, h))

    // 3. Trier par date
    return [...map.values()].sort((a, b) => a.date.localeCompare(b.date))
  }
}

export default HolidayService