// ═══════════════════════════════════════════════════════════
// TABLEAU DE BORD — MISE EN PAGE PERSONNALISABLE
// État + persistance (locale et distante) de la disposition :
// widgets KPI, éléments de la barre du haut, actions rapides,
// filtres et modales d'activité. Ne fait que retenir l'ordre
// choisi par l'administrateur.
// ═══════════════════════════════════════════════════════════
import { useEffect, useRef, useState } from 'react'
import { loadRemoteDashboardPreferences, saveRemoteDashboardPreferences } from './dashboardPreferencesService'
import {
  DEFAULT_DASHBOARD_WIDGETS,
  addDashboardWidget,
  moveDashboardWidget,
  moveDashboardWidgetByOffset,
  normalizeDashboardWidgetIds,
  removeDashboardWidget,
} from './dashboardWidgets'
import {
  ALL_TOPBAR_AVAILABLE_IDS,
  DEFAULT_TOPBAR_LEFT_ITEM_IDS,
  DEFAULT_TOPBAR_RIGHT_ITEM_IDS,
  TOPBAR_LEFT_CATALOG,
  TOPBAR_RIGHT_CATALOG,
  readDashboardLayoutIds,
  readDashboardWidgetLayout,
} from './experienceCatalogs'

export function useDashboardLayout({ admin, retardsOptionActive, widgetCatalog, quickActionCatalog }) {
  const availableWidgets = widgetCatalog.filter((widget) => widget.available !== false)
  const availableWidgetIds = availableWidgets.map((widget) => widget.id)
  const defaultWidgetIds = DEFAULT_DASHBOARD_WIDGETS.filter((id) => availableWidgetIds.includes(id))
  const widgetStorageKey = `encheck_dashboard_widgets_v1:${admin?.id || 'preview'}:${admin?.selectedEnterprise?.id || admin?.enterprise_id || 'all'}`
  const [widgetIds, setWidgetIds] = useState(() => readDashboardWidgetLayout(widgetStorageKey, availableWidgetIds, defaultWidgetIds))
  const [isCustomizing, setIsCustomizing] = useState(false)
  const [isWidgetCatalogOpen, setIsWidgetCatalogOpen] = useState(false)
  const [draggedWidgetId, setDraggedWidgetId] = useState(null)

  const topbarLeftCatalog = TOPBAR_LEFT_CATALOG
  const topbarRightCatalog = TOPBAR_RIGHT_CATALOG
  const topbarLeftAvailableIds = ALL_TOPBAR_AVAILABLE_IDS
  const topbarRightAvailableIds = ALL_TOPBAR_AVAILABLE_IDS
  const defaultTopbarLeftItemIds = DEFAULT_TOPBAR_LEFT_ITEM_IDS
  const defaultTopbarRightItemIds = DEFAULT_TOPBAR_RIGHT_ITEM_IDS
  const layoutOwnerKey = `${admin?.id || 'preview'}:${admin?.selectedEnterprise?.id || admin?.enterprise_id || 'all'}`
  const topbarLeftStorageKey = `encheck_dashboard_topbar_left_v2:${layoutOwnerKey}`
  const topbarRightStorageKey = `encheck_dashboard_topbar_right_v2:${layoutOwnerKey}`
  const [topbarLeftItemIds, setTopbarLeftItemIds] = useState(() => readDashboardLayoutIds(topbarLeftStorageKey, topbarLeftAvailableIds, defaultTopbarLeftItemIds, true))
  const [topbarRightItemIds, setTopbarRightItemIds] = useState(() => readDashboardLayoutIds(topbarRightStorageKey, topbarRightAvailableIds, defaultTopbarRightItemIds, true))
  const [isTopbarCustomizing, setIsTopbarCustomizing] = useState(false)
  const [isTopbarCatalogOpen, setIsTopbarCatalogOpen] = useState(false)
  const [draggedTopbarItemId, setDraggedTopbarItemId] = useState(null)
  const [activityFilter, setActivityFilter] = useState('all')
  // L'option « retards » peut être coupée par le module : le filtre retenu
  // revient alors à « tout », sans passer par un état intermédiaire.
  const filtreActivite = !retardsOptionActive && activityFilter === 'late' ? 'all' : activityFilter
  const [selectedActivityItem, setSelectedActivityItem] = useState(null)
  const [isForgottenExitModalOpen, setIsForgottenExitModalOpen] = useState(false)
  const [exitTimesById, setExitTimesById] = useState({})
  const enterpriseScopeKey = String(admin?.selectedEnterprise?.id || admin?.enterprise_id || 'all')

  const availableQuickActionIds = quickActionCatalog.map((action) => action.id)
  const defaultQuickActionIds = ['add-employee', 'attendance', 'planning', 'reports'].filter((id) => availableQuickActionIds.includes(id))
  const quickActionStorageKey = `encheck_dashboard_quick_actions_v1:${layoutOwnerKey}`
  const [quickActionIds, setQuickActionIds] = useState(() => readDashboardLayoutIds(quickActionStorageKey, availableQuickActionIds, defaultQuickActionIds, true))
  const [isCustomizingQuickActions, setIsCustomizingQuickActions] = useState(false)
  const [isQuickActionCatalogOpen, setIsQuickActionCatalogOpen] = useState(false)
  const [draggedQuickActionId, setDraggedQuickActionId] = useState(null)
  useEffect(() => {
    ;[
      '/images/pointage-loading-pin.jpg',
      '/images/pointage-loading-qr.jpg',
      '/images/employes-loading-badge.jpg',
      '/images/employes-loading-team.jpg',
    ].forEach((src) => {
      const img = new window.Image()
      img.src = src
    })
  }, [])

  useEffect(() => {
    try {
      window.localStorage.setItem(widgetStorageKey, JSON.stringify(widgetIds))
    } catch {
      // La personnalisation reste fonctionnelle même si le stockage est bloqué.
    }
  }, [widgetStorageKey, widgetIds])

  useEffect(() => {
    try {
      window.localStorage.setItem(topbarLeftStorageKey, JSON.stringify(topbarLeftItemIds))
    } catch {
      // La disposition reste utilisable si le stockage du navigateur est bloqué.
    }
  }, [topbarLeftStorageKey, topbarLeftItemIds])

  useEffect(() => {
    try {
      window.localStorage.setItem(topbarRightStorageKey, JSON.stringify(topbarRightItemIds))
    } catch {
      // La disposition reste utilisable si le stockage du navigateur est bloqué.
    }
  }, [topbarRightStorageKey, topbarRightItemIds])

  useEffect(() => {
    try {
      window.localStorage.setItem(quickActionStorageKey, JSON.stringify(quickActionIds))
    } catch {
      // La disposition reste utilisable si le stockage du navigateur est bloqué.
    }
  }, [quickActionStorageKey, quickActionIds])

  //  Les tableaux `availableWidgetIds` / `defaultWidgetIds` / `availableQuickActionIds`
  //  sont reconstruits à CHAQUE rendu. Les mettre tels quels dans les dépendances
  //  de l'effet le relançait donc après chaque clic : il relisait les préférences
  //  distantes — qui ne sont enregistrées qu'après 650 ms de temporisation — et
  //  réappliquait l'ANCIENNE liste. Le widget qu'on venait de retirer réapparaissait
  //  aussitôt. D'où : dépendances en signatures texte + chargement une seule fois
  //  par périmètre, pour qu'une modification locale ne soit plus jamais écrasée.
  const widgetCatalogSignature = availableWidgetIds.join('|')
  const quickActionSignature = availableQuickActionIds.join('|')
  const remotePrefsLoadedRef = useRef('')

  useEffect(() => {
    let cancelled = false
    if (!admin?.id) return undefined
    const clePerimetre = `${admin.id}:${enterpriseScopeKey}:${widgetCatalogSignature}:${quickActionSignature}`
    if (remotePrefsLoadedRef.current === clePerimetre) return undefined
    loadRemoteDashboardPreferences(admin.id, enterpriseScopeKey).then((remote) => {
      if (cancelled || !remote) return
      remotePrefsLoadedRef.current = clePerimetre
      if (Array.isArray(remote.widgetIds)) {
        const nextWidgets = normalizeDashboardWidgetIds(remote.widgetIds, availableWidgetIds, defaultWidgetIds)
        if (nextWidgets.length) setWidgetIds(nextWidgets)
      }
      if (Array.isArray(remote.topbarLeftItemIds)) {
        const validLeft = remote.topbarLeftItemIds.filter((id) => topbarLeftAvailableIds.includes(id))
        setTopbarLeftItemIds(validLeft)
      }
      if (Array.isArray(remote.topbarRightItemIds)) {
        const validRight = remote.topbarRightItemIds.filter((id) => topbarRightAvailableIds.includes(id))
        setTopbarRightItemIds(validRight)
      }
      if (Array.isArray(remote.quickActionIds)) {
        const validActions = remote.quickActionIds.filter((id) => availableQuickActionIds.includes(id))
        setQuickActionIds(validActions)
      }
    })
    return () => {
      cancelled = true
    }
  }, [
    admin?.id,
    enterpriseScopeKey,
    widgetCatalogSignature,
    quickActionSignature,
    topbarLeftAvailableIds,
    topbarRightAvailableIds,
  ])

  useEffect(() => {
    if (!admin?.id) return undefined
    const timer = window.setTimeout(() => {
      saveRemoteDashboardPreferences(admin.id, enterpriseScopeKey, {
        widgetIds,
        topbarLeftItemIds,
        topbarRightItemIds,
        quickActionIds,
      })
    }, 650)
    return () => window.clearTimeout(timer)
  }, [admin?.id, enterpriseScopeKey, widgetIds, topbarLeftItemIds, topbarRightItemIds, quickActionIds])

  const visibleWidgets = widgetIds
    .map((id) => availableWidgets.find((widget) => widget.id === id))
    .filter(Boolean)
  const unaddedWidgets = availableWidgets.filter((widget) => !widgetIds.includes(widget.id))
  const allTopbarCatalog = [...topbarLeftCatalog, ...topbarRightCatalog]
  const visibleTopbarLeftItems = topbarLeftItemIds
    .map((id) => allTopbarCatalog.find((item) => item.id === id))
    .filter(Boolean)
  const visibleTopbarRightItems = topbarRightItemIds
    .map((id) => allTopbarCatalog.find((item) => item.id === id))
    .filter(Boolean)
  const unaddedTopbarItems = allTopbarCatalog.filter((item) =>
    !topbarLeftItemIds.includes(item.id) && !topbarRightItemIds.includes(item.id),
  )
  const hasTopbarCustomizeButton = topbarLeftItemIds.includes('dashboard-customize') || topbarRightItemIds.includes('dashboard-customize')
  const quickActions = quickActionIds
    .map((id) => quickActionCatalog.find((action) => action.id === id))
    .filter(Boolean)
  const unaddedQuickActions = quickActionCatalog.filter((action) => !quickActionIds.includes(action.id))

  const handleWidgetDragStart = (event, widgetId) => {
    event.dataTransfer.effectAllowed = 'move'
    event.dataTransfer.setData('text/plain', widgetId)
    setDraggedWidgetId(widgetId)
  }
  const handleWidgetDrop = (event, targetId) => {
    event.preventDefault()
    const sourceId = event.dataTransfer.getData('text/plain') || draggedWidgetId
    if (sourceId) setWidgetIds((current) => moveDashboardWidget(current, sourceId, targetId))
    setDraggedWidgetId(null)
  }
  const addWidget = (widgetId) => {
    setWidgetIds((current) => addDashboardWidget(current, widgetId))
    setIsCustomizing(true)
    setIsWidgetCatalogOpen(false)
  }
  const removeWidget = (widgetId) => setWidgetIds((current) => removeDashboardWidget(current, widgetId))
  const moveWidget = (widgetId, offset) => setWidgetIds((current) => moveDashboardWidgetByOffset(current, widgetId, offset))
  const resetWidgets = () => setWidgetIds(defaultWidgetIds)

  const addTopbarItem = (item) => {
    if (item.region === 'left') setTopbarLeftItemIds((current) => addDashboardWidget(current, item.id))
    else setTopbarRightItemIds((current) => addDashboardWidget(current, item.id))
    setIsCustomizing(true)
    setIsTopbarCustomizing(true)
    setIsTopbarCatalogOpen(false)
  }
  const removeTopbarItem = (itemId, region) => {
    const setter = region === 'left' ? setTopbarLeftItemIds : setTopbarRightItemIds
    setter((current) => removeDashboardWidget(current, itemId))
  }
  const moveTopbarItem = (itemId, offset, region) => {
    const setter = region === 'left' ? setTopbarLeftItemIds : setTopbarRightItemIds
    setter((current) => moveDashboardWidgetByOffset(current, itemId, offset))
  }
  const handleTopbarDragStart = (event, itemId) => {
    event.dataTransfer.effectAllowed = 'move'
    event.dataTransfer.setData('text/plain', itemId)
    setDraggedTopbarItemId(itemId)
  }
  const handleTopbarDrop = (event, targetId, targetRegion) => {
    event.preventDefault()
    event.stopPropagation()
    const sourceId = event.dataTransfer.getData('text/plain') || draggedTopbarItemId
    const sourceRegion = topbarLeftItemIds.includes(sourceId)
      ? 'left'
      : topbarRightItemIds.includes(sourceId) ? 'right' : null
    if (sourceId && sourceRegion) {
      if (sourceRegion === targetRegion) {
        if (targetId) {
          const setter = targetRegion === 'left' ? setTopbarLeftItemIds : setTopbarRightItemIds
          setter((current) => moveDashboardWidget(current, sourceId, targetId))
        }
      } else {
        const sourceSetter = sourceRegion === 'left' ? setTopbarLeftItemIds : setTopbarRightItemIds
        const targetSetter = targetRegion === 'left' ? setTopbarLeftItemIds : setTopbarRightItemIds
        sourceSetter((current) => removeDashboardWidget(current, sourceId))
        targetSetter((current) => {
          const next = removeDashboardWidget(current, sourceId)
          const targetIndex = targetId ? next.indexOf(targetId) : -1
          next.splice(targetIndex < 0 ? next.length : targetIndex, 0, sourceId)
          return next
        })
      }
    }
    setDraggedTopbarItemId(null)
  }
  const resetTopbarLayout = () => {
    setTopbarLeftItemIds(defaultTopbarLeftItemIds)
    setTopbarRightItemIds(defaultTopbarRightItemIds)
  }

  const addQuickAction = (actionId) => {
    setQuickActionIds((current) => addDashboardWidget(current, actionId))
    setIsCustomizingQuickActions(true)
    setIsQuickActionCatalogOpen(false)
  }
  const removeQuickAction = (actionId) => setQuickActionIds((current) => removeDashboardWidget(current, actionId))
  const moveQuickAction = (actionId, offset) => setQuickActionIds((current) => moveDashboardWidgetByOffset(current, actionId, offset))
  const handleQuickActionDragStart = (event, actionId) => {
    event.dataTransfer.effectAllowed = 'move'
    event.dataTransfer.setData('text/plain', actionId)
    setDraggedQuickActionId(actionId)
  }
  const handleQuickActionDrop = (event, targetId) => {
    event.preventDefault()
    const sourceId = event.dataTransfer.getData('text/plain') || draggedQuickActionId
    if (sourceId) setQuickActionIds((current) => moveDashboardWidget(current, sourceId, targetId))
    setDraggedQuickActionId(null)
  }
  const resetQuickActions = () => setQuickActionIds(defaultQuickActionIds)

  const toggleDashboardCustomize = () => {
    setIsCustomizing((value) => {
      const next = !value
      if (!next) setIsTopbarCustomizing(false)
      return next
    })
  }

  return {
    widgetIds, isCustomizing, setIsCustomizing, isWidgetCatalogOpen, setIsWidgetCatalogOpen,
    draggedWidgetId, setDraggedWidgetId, visibleWidgets, unaddedWidgets,
    topbarLeftItemIds, topbarRightItemIds, isTopbarCustomizing, setIsTopbarCustomizing,
    isTopbarCatalogOpen, setIsTopbarCatalogOpen, draggedTopbarItemId, setDraggedTopbarItemId,
    visibleTopbarLeftItems, visibleTopbarRightItems, unaddedTopbarItems, hasTopbarCustomizeButton,
    activityFilter, setActivityFilter, filtreActivite,
    selectedActivityItem, setSelectedActivityItem,
    isForgottenExitModalOpen, setIsForgottenExitModalOpen, exitTimesById, setExitTimesById,
    quickActionIds, isCustomizingQuickActions, setIsCustomizingQuickActions,
    isQuickActionCatalogOpen, setIsQuickActionCatalogOpen, draggedQuickActionId,
    quickActions, unaddedQuickActions,
    handleWidgetDragStart, handleWidgetDrop, addWidget, removeWidget, moveWidget, resetWidgets,
    addTopbarItem, removeTopbarItem, moveTopbarItem, handleTopbarDragStart, handleTopbarDrop, resetTopbarLayout,
    addQuickAction, removeQuickAction, moveQuickAction, handleQuickActionDragStart, handleQuickActionDrop, resetQuickActions,
    toggleDashboardCustomize,
  }
}
