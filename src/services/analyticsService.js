// ═══════════════════════════════════════════════════════════
// 📊 ANALYTICS SERVICE — Landing Page Tracking
// ═══════════════════════════════════════════════════════════

import { supabase } from '../lib/supabase'

function getSessionId() {
  const key = 'enc_session_id'
  let sid = sessionStorage.getItem(key)
  if (!sid) {
    sid = `sess_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    sessionStorage.setItem(key, sid)
  }
  return sid
}

function getDeviceType() {
  const ua = navigator.userAgent
  if (/tablet|ipad|playbook|silk/i.test(ua)) return 'tablet'
  if (/mobile|android|iphone|ipod|blackberry|opera mini|iemobile/i.test(ua)) return 'mobile'
  return 'desktop'
}

function isReturningVisitor() {
  const key = 'enc_visited'
  const visited = localStorage.getItem(key)
  if (!visited) {
    localStorage.setItem(key, Date.now().toString())
    return false
  }
  return true
}

async function getGeoLocation() {
  const cached = sessionStorage.getItem('enc_geo')
  if (cached) {
    try { return JSON.parse(cached) } catch { /* ignore */ }
  }

  const apis = [
    {
      url: 'https://ip-api.com/json/?fields=status,country,countryCode,city,regionName,isp',
      parse: (d) => ({
        country: d.country || null,
        country_code: d.countryCode || null,
        city: d.city || null,
        region: d.regionName || null,
        isp: d.isp || null,
      }),
      check: (d) => d.status === 'success',
    },
    {
      url: 'https://ipapi.co/json/',
      parse: (d) => ({
        country: d.country_name || null,
        country_code: d.country_code || null,
        city: d.city || null,
        region: d.region || null,
        isp: d.org || null,
      }),
      check: (d) => !d.error,
    },
  ]

  for (const api of apis) {
    try {
      const res = await fetch(api.url, { signal: AbortSignal.timeout(4000) })
      if (!res.ok) continue
      const data = await res.json()
      if (!api.check(data)) continue
      const geo = api.parse(data)
      sessionStorage.setItem('enc_geo', JSON.stringify(geo))
      return geo
    } catch { continue }
  }

  return { country: null, country_code: null, city: null, region: null, isp: null }
}

class AnalyticsService {
  constructor() {
    this.sessionId = getSessionId()
    this.visitId = null
    this.startTime = Date.now()
    this.sectionsViewed = new Set()
    this.ctaClicks = []
    this.initialized = false
    this._updateTimer = null
  }

  async init() {
    if (this.initialized) return
    this.initialized = true

    try {
      const geo = await getGeoLocation()

      const { data, error } = await supabase
        .from('landing_page_visits')
        .insert({
          session_id: this.sessionId,
          page: 'landing',
          referrer: document.referrer || null,
          user_agent: navigator.userAgent,
          device_type: getDeviceType(),
          is_returning: isReturningVisitor(),
          country: geo.country,
          country_code: geo.country_code,
          city: geo.city,
          region: geo.region,
          isp: geo.isp,
          sections_viewed: [],
          cta_clicks: [],
          duration_seconds: 0,
        })
        .select('id')
        .single()

      if (!error && data) {
        this.visitId = data.id
        // Mise à jour de la durée toutes les 30 secondes
        this._updateTimer = setInterval(() => this._updateVisit(), 30000)
      }
    } catch (err) {
      console.warn('Analytics init error:', err)
    }
  }

  trackSection(sectionId) {
    this.sectionsViewed.add(sectionId)
    this._updateVisit()
  }

  trackCTA(ctaName) {
    this.ctaClicks.push({
      name: ctaName,
      timestamp: new Date().toISOString(),
    })
    this._updateVisit()
  }

  async _updateVisit() {
    if (!this.visitId) return
    const durationSeconds = Math.floor((Date.now() - this.startTime) / 1000)
    try {
      await supabase
        .from('landing_page_visits')
        .update({
          duration_seconds: durationSeconds,
          sections_viewed: Array.from(this.sectionsViewed),
          cta_clicks: this.ctaClicks,
          updated_at: new Date().toISOString(),
        })
        .eq('id', this.visitId)
    } catch { /* silencieux */ }
  }

  async finalize() {
    if (this._updateTimer) clearInterval(this._updateTimer)
    await this._updateVisit()
  }
}

export const analytics = new AnalyticsService()

// ─── Récupérer les stats pour l'admin ──────────────────────

export async function getLandingPageStats({ days = 30 } = {}) {
  const since = new Date()
  since.setDate(since.getDate() - days)

  const { data, error } = await supabase
    .from('landing_page_visits')
    .select('*')
    .gte('created_at', since.toISOString())
    .order('created_at', { ascending: false })

  if (error) throw error
  return computeStats(data || [])
}


// ─── Suppression des stats ─────────────────────────────────

export async function deleteVisitById(visitId) {
  if (!visitId) throw new Error('ID de visite manquant')
  
  const { error } = await supabase
    .from('landing_page_visits')
    .delete()
    .eq('id', visitId)

  if (error) {
    console.error('Delete error:', error)
    throw new Error(error.message || 'Erreur lors de la suppression')
  }
  return { success: true }
}

export async function deleteVisitsByDateRange(startDate, endDate) {
  const { error } = await supabase
    .from('landing_page_visits')
    .delete()
    .gte('created_at', new Date(startDate).toISOString())
    .lte('created_at', new Date(endDate).toISOString())

  if (error) throw new Error(error.message || 'Erreur lors de la suppression')
  return { success: true }
}

export async function deleteAllVisits() {
  // Récupérer tous les IDs puis les supprimer (plus sûr)
  const { data, error: fetchError } = await supabase
    .from('landing_page_visits')
    .select('id')

  if (fetchError) throw new Error(fetchError.message)

  if (!data || data.length === 0) {
    return { success: true, message: 'Aucune donnée à supprimer' }
  }

  const ids = data.map((row) => row.id)

  // Supprimer par batch de 100
  for (let i = 0; i < ids.length; i += 100) {
    const batch = ids.slice(i, i + 100)
    const { error } = await supabase
      .from('landing_page_visits')
      .delete()
      .in('id', batch)

    if (error) throw new Error(error.message)
  }

  return { success: true }
}

export async function deleteVisitsByCountry(countryCode) {
  if (!countryCode) throw new Error('Code pays manquant')

  const { error } = await supabase
    .from('landing_page_visits')
    .delete()
    .eq('country_code', countryCode)

  if (error) {
    console.error('Delete by country error:', error)
    throw new Error(error.message || 'Erreur lors de la suppression')
  }
  return { success: true }
}

function computeStats(visits) {
  const total = visits.length
  const returning = visits.filter((v) => v.is_returning).length
  const newVisitors = total - returning

  const avgDuration =
    total > 0
      ? Math.round(visits.reduce((acc, v) => acc + (v.duration_seconds || 0), 0) / total)
      : 0

  const byDevice = visits.reduce((acc, v) => {
    const key = v.device_type || 'unknown'
    acc[key] = (acc[key] || 0) + 1
    return acc
  }, {})

  const byCountry = visits.reduce((acc, v) => {
    const key = v.country || 'Inconnu'
    if (!acc[key]) acc[key] = { count: 0, code: v.country_code }
    acc[key].count += 1
    return acc
  }, {})

  const byCity = visits.reduce((acc, v) => {
    if (!v.city) return acc
    const key = `${v.city}${v.country_code ? ` (${v.country_code})` : ''}`
    acc[key] = (acc[key] || 0) + 1
    return acc
  }, {})

  const sectionCounts = {}
  visits.forEach((v) => {
    ;(v.sections_viewed || []).forEach((s) => {
      sectionCounts[s] = (sectionCounts[s] || 0) + 1
    })
  })

  const ctaCounts = {}
  visits.forEach((v) => {
    ;(v.cta_clicks || []).forEach((c) => {
      ctaCounts[c.name] = (ctaCounts[c.name] || 0) + 1
    })
  })

  const visitsByDay = {}
  visits.forEach((v) => {
    const day = v.created_at.split('T')[0]
    visitsByDay[day] = (visitsByDay[day] || 0) + 1
  })

  const bounces = visits.filter((v) => (v.duration_seconds || 0) < 10).length
  const bounceRate = total > 0 ? Math.round((bounces / total) * 100) : 0

  return {
    total,
    newVisitors,
    returning,
    avgDuration,
    bounceRate,
    byDevice,
    byCountry,
    byCity,
    sectionCounts,
    ctaCounts,
    visitsByDay,
    rawVisits: visits,
  }
}