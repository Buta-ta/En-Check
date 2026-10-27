// src/hooks/useTabAnimations.js

import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { calculateAllTriggers } from '../services/triggerCalculator'
import { TABS_CONFIG, getHighestPriority } from '../utils/animationConfig'
import useRealtimeAttendances from './useRealtimeAttendances'
import useRealtimeTasks from './useRealtimeTasks'

const STORAGE_PREFIX = 'tab_seen'
const REFRESH_INTERVAL = 2 * 60 * 1000 // 2 minutes
const MIN_CALC_INTERVAL = 5000 // 5 secondes minimum entre calculs

const useTabAnimations = (admin, enterpriseId, enabledModules = {}) => {
  const [tabStates, setTabStates] = useState({})
  const [isCalculating, setIsCalculating] = useState(false)
  
  // ✅ Refs pour éviter les boucles
  const refreshIntervalRef = useRef(null)
  const lastCalculationRef = useRef(0)
  const abortControllerRef = useRef(null)
  const isFetchingRef = useRef(false)

  // ✅ Stabiliser les paramètres avec useMemo
  const stableParams = useMemo(() => ({
    adminId: admin?.id,
    enterpriseId,
    enabledModulesKey: JSON.stringify(enabledModules)
  }), [admin?.id, enterpriseId, enabledModules])

  // ✅ Créer une clé d'initialisation stable
  const initKey = useMemo(() => 
    `${stableParams.adminId}-${stableParams.enterpriseId}`,
    [stableParams.adminId, stableParams.enterpriseId]
  )

  // ══════════════════════════════════════════════════════════
  // HELPERS
  // ══════════════════════════════════════════════════════════

  const getStorageKey = useCallback((tabKey) => {
    if (!stableParams.adminId || !stableParams.enterpriseId || !tabKey) return null
    return `${STORAGE_PREFIX}_${stableParams.adminId}_${stableParams.enterpriseId}_${tabKey}`
  }, [stableParams.adminId, stableParams.enterpriseId])

  const getLastSeenAt = useCallback((tabKey) => {
    const key = getStorageKey(tabKey)
    if (!key) return null
    return localStorage.getItem(key)
  }, [getStorageKey])

  const setLastSeenAt = useCallback((tabKey, iso) => {
    const key = getStorageKey(tabKey)
    if (!key) return
    localStorage.setItem(key, iso)
  }, [getStorageKey])

  // ✅ isModuleEnabled stable
  const isModuleEnabled = useCallback((tabKey) => {
    const isSuperAdmin = admin?.role === 'super_admin'
    if (isSuperAdmin) return true

    const alwaysEnabled = ['EMPLOYES', 'POINTAGES', 'JOURS_FERIES']
    if (alwaysEnabled.includes(tabKey)) return true

    const moduleMap = {
      ABSENCES: enabledModules.moduleConges,
      PLANNING: enabledModules.modulePlanning,
      TACHES: enabledModules.moduleTaches,
      GEOFENCING: enabledModules.moduleGeofencing,
      RETARDS: enabledModules.moduleRetards,
      HEURES_SUP: enabledModules.moduleHeuresSup,
      FICHES_PAIE: enabledModules.moduleFichesPaie,
      PREDICTIONS: enabledModules.modulePredictions,
    }

    return moduleMap[tabKey] || false
  }, [admin?.role, enabledModules])

  // ✅ shouldAnimateTab stable
  const shouldAnimateTab = useCallback((tabKey, triggersData) => {
    if (!triggersData) return false

    const latest = triggersData.latest_event_at
    if (!latest) return false

    const lastSeen = getLastSeenAt(tabKey)
    if (!lastSeen) return true

    return new Date(latest).getTime() > new Date(lastSeen).getTime()
  }, [getLastSeenAt])

  // ✅ buildTabState stable
  const buildTabState = useCallback((tabKey, triggersData) => {
    const tabConfig = TABS_CONFIG[tabKey]
    if (!tabConfig || !isModuleEnabled(tabKey)) return null

    const activeTriggers = []
    let totalCount = 0

    Object.entries(tabConfig.triggers).forEach(([triggerKey, triggerConfig]) => {
      if (triggerKey === 'latest_event_at') return

      const count = triggersData[triggerKey] || 0
      const threshold = triggerConfig.threshold || 0
      
      if (count > threshold) {
        activeTriggers.push({
          key: triggerKey,
          count,
          priority: triggerConfig.priority,
          label: triggerConfig.label,
          icon: triggerConfig.icon,
          duration: triggerConfig.duration,
        })
        totalCount += count
      }
    })

    if (activeTriggers.length === 0) {
      activeTriggers.push({
        key: 'generic',
        count: 1,
        priority: 'info',
        label: 'Nouveau',
        icon: '•',
        duration: 20,
      })
      totalCount = 1
    }

    const highestPriority = getHighestPriority(activeTriggers)

    return {
      tabKey,
      activeTriggers,
      totalCount,
      highestPriority,
      color: tabConfig.color,
      path: tabConfig.path,
      timestamp: new Date().toISOString(),
    }
  }, [isModuleEnabled])

  // ══════════════════════════════════════════════════════════
  // FONCTION REFRESH (OPTIMISÉE)
  // ══════════════════════════════════════════════════════════

  const refreshAllTriggers = useCallback(async () => {
    if (!stableParams.adminId || !stableParams.enterpriseId) {
      console.log('⏭️ useTabAnimations: paramètres manquants, skip')
      return
    }

    // Vérifier si déjà en cours
    if (isFetchingRef.current) {
      console.log('⏭️ useTabAnimations: calcul en cours, skip')
      return
    }

    // Throttle : minimum 5s entre calculs
    const now = Date.now()
    if (now - lastCalculationRef.current < MIN_CALC_INTERVAL) {
      console.log('⏭️ useTabAnimations: trop tôt, skip')
      return
    }

    // Annuler le calcul précédent si existe
    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
    }

    abortControllerRef.current = new AbortController()
    isFetchingRef.current = true
    lastCalculationRef.current = now
    setIsCalculating(true)

    try {
      console.log('🔄 useTabAnimations: Calcul des triggers')

      const allTriggers = await calculateAllTriggers(
        stableParams.enterpriseId, 
        admin
      )

      // Vérifier si annulé
      if (abortControllerRef.current.signal.aborted) {
        console.log('❌ useTabAnimations: Calcul annulé')
        return
      }

      const newTabStates = {}

      Object.keys(TABS_CONFIG).forEach((tabKey) => {
        const triggersData = allTriggers[tabKey]
        if (!triggersData || !isModuleEnabled(tabKey)) return

        if (shouldAnimateTab(tabKey, triggersData)) {
          const tabState = buildTabState(tabKey, triggersData)
          if (tabState) {
            newTabStates[tabKey] = tabState
          }
        }
      })

      // ✅ Comparer avant de mettre à jour
      setTabStates(prev => {
        const prevKeys = Object.keys(prev).sort().join(',')
        const newKeys = Object.keys(newTabStates).sort().join(',')
        
        if (prevKeys === newKeys) {
          console.log('🔄 useTabAnimations: Même contenu, skip update')
          return prev
        }
        
        console.log('✅ useTabAnimations: Triggers mis à jour', newTabStates)
        return newTabStates
      })

    } catch (error) {
      if (error.name !== 'AbortError') {
        console.error('❌ useTabAnimations: Erreur calcul', error)
      }
    } finally {
      isFetchingRef.current = false
      setIsCalculating(false)
    }
  }, [
    stableParams.adminId,
    stableParams.enterpriseId,
    admin,
    isModuleEnabled,
    shouldAnimateTab,
    buildTabState
  ])

  // ══════════════════════════════════════════════════════════
  // REALTIME HANDLERS (OPTIMISÉS)
  // ══════════════════════════════════════════════════════════

  const handleNewAttendance = useCallback((attendance) => {
    if (!isModuleEnabled('POINTAGES')) return

    const latest = attendance?.created_at || attendance?.check_time
    if (!latest) return

    const lastSeen = getLastSeenAt('POINTAGES')
    if (lastSeen && new Date(latest).getTime() <= new Date(lastSeen).getTime()) {
      return
    }

    console.log('🔔 useTabAnimations: Nouveau pointage')

    setTabStates(prev => ({
      ...prev,
      POINTAGES: {
        tabKey: 'POINTAGES',
        activeTriggers: [{
          key: 'new_attendances',
          count: 1,
          priority: 'info',
          label: 'Nouveau pointage',
          icon: '•',
          duration: 10
        }],
        totalCount: 1,
        highestPriority: 'info',
        color: '#6366F1',
        path: '/pointages',
        timestamp: new Date().toISOString(),
      }
    }))
  }, [isModuleEnabled, getLastSeenAt])

  const handleTaskChange = useCallback((task) => {
    if (!isModuleEnabled('TACHES')) return

    const latest = task?.updated_at || task?.created_at
    if (!latest) return

    const lastSeen = getLastSeenAt('TACHES')
    if (lastSeen && new Date(latest).getTime() <= new Date(lastSeen).getTime()) {
      return
    }

    console.log('🔔 useTabAnimations: Nouvelle tâche')

    setTabStates(prev => ({
      ...prev,
      TACHES: {
        tabKey: 'TACHES',
        activeTriggers: [{
          key: 'new_tasks',
          count: 1,
          priority: 'info',
          label: 'Nouvelle tâche',
          icon: '•',
          duration: 15
        }],
        totalCount: 1,
        highestPriority: 'info',
        color: '#F59E0B',
        path: '/employes?vue=taches',
        timestamp: new Date().toISOString(),
      }
    }))
  }, [isModuleEnabled, getLastSeenAt])

  // ══════════════════════════════════════════════════════════
  // ACTIONS
  // ══════════════════════════════════════════════════════════

  const markTabAsViewed = useCallback((tabKey) => {
    if (!tabKey) return
    
    const nowIso = new Date().toISOString()
    setLastSeenAt(tabKey, nowIso)

    console.log('👁️ useTabAnimations: Marquer comme vu', tabKey)

    setTabStates(prev => {
      const next = { ...prev }
      delete next[tabKey]
      return next
    })
  }, [setLastSeenAt])

  const clearTab = useCallback((tabKey) => {
    setTabStates(prev => {
      const next = { ...prev }
      delete next[tabKey]
      return next
    })
  }, [])

  // ══════════════════════════════════════════════════════════
  // REALTIME SUBSCRIPTIONS
  // ══════════════════════════════════════════════════════════

  useRealtimeAttendances(stableParams.enterpriseId, handleNewAttendance)
  useRealtimeTasks(stableParams.enterpriseId, handleTaskChange)

  // ══════════════════════════════════════════════════════════
  // INIT + POLLING
  // ══════════════════════════════════════════════════════════

  useEffect(() => {
    if (!stableParams.adminId || !stableParams.enterpriseId) {
      console.log('⏭️ useTabAnimations: Pas de params, skip init')
      return
    }

    console.log('🎬 useTabAnimations: Init pour', initKey)

    // Nettoyer l'intervalle précédent
    if (refreshIntervalRef.current) {
      clearInterval(refreshIntervalRef.current)
    }

    // Nettoyer l'abort controller précédent
    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
    }

    // Premier calcul
    refreshAllTriggers()

    // Polling toutes les 2 minutes
    refreshIntervalRef.current = setInterval(() => {
      refreshAllTriggers()
    }, REFRESH_INTERVAL)

    // Cleanup
    return () => {
      console.log('🧹 useTabAnimations: Cleanup')
      
      if (refreshIntervalRef.current) {
        clearInterval(refreshIntervalRef.current)
      }
      
      if (abortControllerRef.current) {
        abortControllerRef.current.abort()
      }
    }
  }, [initKey, stableParams.adminId, stableParams.enterpriseId, refreshAllTriggers])

  // ══════════════════════════════════════════════════════════
  // RETURN
  // ══════════════════════════════════════════════════════════

  return {
    tabStates,
    isCalculating,
    markTabAsViewed,
    clearTab,
    refreshAllTriggers: useCallback(() => {
      lastCalculationRef.current = 0 // Force refresh
      refreshAllTriggers()
    }, [refreshAllTriggers])
  }
}

export default useTabAnimations