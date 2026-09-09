// src/services/connectionLogService.js

import { db } from '../lib/db'

class ConnectionLogService {
  
  static getDeviceType() {
    const ua = navigator.userAgent
    if (/tablet|ipad|playbook|silk/i.test(ua)) return 'tablet'
    if (/mobile|iphone|ipod|android|blackberry|opera mini|iemobile/i.test(ua)) return 'mobile'
    return 'desktop'
  }

  // ═══ RÉCUPÉRER IP + GÉOLOCALISATION (CORRIGÉ POUR HTTPS/VERCEL) ═══
  static async getIPAndLocation() {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 8000)

    try {
      // ── Stratégie 1 : ipapi.co (HTTPS gratuit, 1000 req/jour) ──
      const response = await fetch('https://ipapi.co/json/', {
        signal: controller.signal,
      })
      clearTimeout(timeoutId)

      if (response.ok) {
        const data = await response.json()
        
        // ipapi.co peut retourner une erreur dans le JSON
        if (!data.error) {
          return {
            ip: data.ip,
            country: data.country_name,
            country_code: data.country_code,
            region: data.region,
            city: data.city,
            latitude: data.latitude,
            longitude: data.longitude,
          }
        }
      }

      throw new Error('ipapi.co failed')
    } catch (error1) {
      clearTimeout(timeoutId)
      console.warn('ipapi.co échoué, tentative fallback...', error1.message)

      // ── Stratégie 2 : ipwho.is (HTTPS gratuit, illimité) ──
      try {
        const controller2 = new AbortController()
        const timeoutId2 = setTimeout(() => controller2.abort(), 5000)

        const response2 = await fetch('https://ipwho.is/', {
          signal: controller2.signal,
        })
        clearTimeout(timeoutId2)

        if (response2.ok) {
          const data2 = await response2.json()
          if (data2.success !== false) {
            return {
              ip: data2.ip,
              country: data2.country,
              country_code: data2.country_code,
              region: data2.region,
              city: data2.city,
              latitude: data2.latitude,
              longitude: data2.longitude,
            }
          }
        }

        throw new Error('ipwho.is failed')
      } catch (error2) {
        console.warn('ipwho.is échoué, tentative fallback 3...', error2.message)

        // ── Stratégie 3 : ip-api.com via HTTPS (fallback basique) ──
        try {
          const controller3 = new AbortController()
          const timeoutId3 = setTimeout(() => controller3.abort(), 5000)

          // Utiliser ipapi.com (avec un seul 'i') — différent de ipapi.co
          const response3 = await fetch('https://ipapi.com/ip_api.php?ip=check', {
            signal: controller3.signal,
          })
          clearTimeout(timeoutId3)

          // Dernier recours : au moins récupérer l'IP
          const ipResponse = await fetch('https://api.ipify.org?format=json')
          const ipData = await ipResponse.json()
          return { ip: ipData.ip }
        } catch (error3) {
          console.error('Toutes les APIs de géoloc ont échoué:', error3)
          return { ip: null }
        }
      }
    }
  }

  // ═══ Le reste du fichier reste IDENTIQUE ═══

  static async logAdminConnection(admin, success = true, failureReason = null) {
    try {
      const locationData = await this.getIPAndLocation()
      
      await db().from('connection_logs').insert({
        user_type: 'admin',
        admin_id: admin?.id || admin || null,
        employee_id: null,
        enterprise_id: admin?.enterprise_id || admin?.selectedEnterprise?.id || null,
        ip_address: locationData.ip,
        user_agent: navigator.userAgent,
        device_type: this.getDeviceType(),
        login_method: 'email',
        success,
        failure_reason: failureReason,
        country: locationData.country || null,
        country_code: locationData.country_code || null,
        region: locationData.region || null,
        city: locationData.city || null,
        latitude: locationData.latitude || null,
        longitude: locationData.longitude || null,
      })
    } catch (error) {
      console.error('Erreur log connexion admin:', error)
    }
  }

  static async logEmployeeConnection(employee, success = true, failureReason = null) {
    try {
      const locationData = await this.getIPAndLocation()
      
      await db().from('connection_logs').insert({
        user_type: 'employee',
        admin_id: null,
        employee_id: employee?.id || null,
        enterprise_id: employee?.enterprise_id || null,
        ip_address: locationData.ip,
        user_agent: navigator.userAgent,
        device_type: this.getDeviceType(),
        login_method: employee?.email ? 'email' : 'phone',
        success,
        failure_reason: failureReason,
        country: locationData.country || null,
        country_code: locationData.country_code || null,
        region: locationData.region || null,
        city: locationData.city || null,
        latitude: locationData.latitude || null,
        longitude: locationData.longitude || null,
      })
    } catch (error) {
      console.error('Erreur log connexion employé:', error)
    }
  }

  static async getLogs(filters = {}) {
    try {
      let query = db()
        .from('connection_logs')
        .select(`
          *,
          admins:admin_id ( id, email, first_name, last_name, role ),
          employees:employee_id ( id, matricule, first_name, last_name, position, email, phone ),
          enterprises:enterprise_id ( id, name )
        `)
        .order('connected_at', { ascending: false })

      if (filters.user_type) query = query.eq('user_type', filters.user_type)
      if (filters.enterprise_id && filters.enterprise_id !== 'all') query = query.eq('enterprise_id', filters.enterprise_id)
      if (filters.date_from) query = query.gte('connected_at', `${filters.date_from}T00:00:00`)
      if (filters.date_to) query = query.lte('connected_at', `${filters.date_to}T23:59:59`)
      if (filters.success !== undefined && filters.success !== '') query = query.eq('success', filters.success)
      if (filters.has_location) query = query.not('latitude', 'is', null)
      query = query.limit(filters.limit || 200)

      const { data, error } = await query
      if (error) throw error
      return data || []
    } catch (error) {
      console.error('Erreur récupération logs:', error)
      return []
    }
  }

  static async getGeoLocatedConnections(hours = 24, enterpriseId = null) {
    try {
      const since = new Date()
      since.setHours(since.getHours() - hours)

      let query = db()
        .from('connection_logs')
        .select(`
          *,
          admins:admin_id ( id, email, first_name, last_name, role ),
          employees:employee_id ( id, matricule, first_name, last_name, position, photo_url ),
          enterprises:enterprise_id ( id, name )
        `)
        .gte('connected_at', since.toISOString())
        .eq('success', true)
        .not('latitude', 'is', null)
        .not('longitude', 'is', null)
        .order('connected_at', { ascending: false })

      if (enterpriseId && enterpriseId !== 'all') query = query.eq('enterprise_id', enterpriseId)

      const { data, error } = await query
      if (error) throw error
      return data || []
    } catch (error) {
      console.error('Erreur récupération connexions géolocalisées:', error)
      return []
    }
  }

  static async getStats(enterpriseId = null, days = 7) {
    try {
      const dateFrom = new Date()
      dateFrom.setDate(dateFrom.getDate() - days)

      let query = db()
        .from('connection_logs')
        .select('user_type, success, connected_at, employee_id, admin_id, country, city')
        .gte('connected_at', dateFrom.toISOString())
        .eq('success', true)

      if (enterpriseId && enterpriseId !== 'all') query = query.eq('enterprise_id', enterpriseId)

      const { data, error } = await query
      if (error) throw error

      const logs = data || []
      const uniqueAdmins = new Set(logs.filter(l => l.admin_id).map(l => l.admin_id))
      const uniqueEmployees = new Set(logs.filter(l => l.employee_id).map(l => l.employee_id))
      const uniqueCountries = new Set(logs.filter(l => l.country).map(l => l.country))
      const uniqueCities = new Set(logs.filter(l => l.city).map(l => l.city))
      
      return {
        totalConnections: logs.length,
        adminConnections: logs.filter(l => l.user_type === 'admin').length,
        employeeConnections: logs.filter(l => l.user_type === 'employee').length,
        uniqueAdmins: uniqueAdmins.size,
        uniqueEmployees: uniqueEmployees.size,
        uniqueDays: [...new Set(logs.map(l => l.connected_at.split('T')[0]))].length,
        uniqueCountries: uniqueCountries.size,
        uniqueCities: uniqueCities.size,
      }
    } catch (error) {
      console.error('Erreur stats connexions:', error)
      return { 
        totalConnections: 0, adminConnections: 0, employeeConnections: 0,
        uniqueAdmins: 0, uniqueEmployees: 0, uniqueDays: 0,
        uniqueCountries: 0, uniqueCities: 0,
      }
    }
  }
}

export default ConnectionLogService