import { supabase } from '../lib/supabase'

let remoteSyncSupported = true

export async function loadRemoteDashboardPreferences(adminId, scopeKey) {
  if (!adminId || !remoteSyncSupported) return null
  try {
    const { data, error } = await supabase
      .from('admins')
      .select('dashboard_preferences')
      .eq('id', adminId)
      .maybeSingle()

    if (error) {
      if (String(error.message || '').includes('dashboard_preferences') || error.code === '42703') {
        remoteSyncSupported = false
      }
      return null
    }

    const allPrefs = data?.dashboard_preferences
    if (!allPrefs || typeof allPrefs !== 'object') return null
    const scoped = allPrefs[scopeKey]
    return scoped && typeof scoped === 'object' ? scoped : null
  } catch {
    return null
  }
}

export async function saveRemoteDashboardPreferences(adminId, scopeKey, layoutPayload) {
  if (!adminId || !remoteSyncSupported) return false
  try {
    const { data: existing, error: readError } = await supabase
      .from('admins')
      .select('dashboard_preferences')
      .eq('id', adminId)
      .maybeSingle()

    if (readError) {
      if (String(readError.message || '').includes('dashboard_preferences') || readError.code === '42703') {
        remoteSyncSupported = false
      }
      return false
    }

    const basePrefs = existing?.dashboard_preferences && typeof existing.dashboard_preferences === 'object'
      ? existing.dashboard_preferences
      : {}

    const nextPrefs = {
      ...basePrefs,
      [scopeKey]: {
        ...layoutPayload,
        updatedAt: new Date().toISOString(),
      },
    }

    const { error: writeError } = await supabase
      .from('admins')
      .update({ dashboard_preferences: nextPrefs })
      .eq('id', adminId)

    if (writeError) {
      if (String(writeError.message || '').includes('dashboard_preferences') || writeError.code === '42703') {
        remoteSyncSupported = false
      }
      return false
    }

    return true
  } catch {
    return false
  }
}
