export const DEFAULT_DASHBOARD_WIDGETS = ['present', 'review', 'late']

export function normalizeDashboardWidgetIds(ids, availableIds, fallbackIds = DEFAULT_DASHBOARD_WIDGETS) {
  const available = new Set(availableIds)
  const normalized = Array.isArray(ids)
    ? [...new Set(ids.filter((id) => typeof id === 'string' && available.has(id)))]
    : []

  if (normalized.length) return normalized
  return fallbackIds.filter((id) => available.has(id))
}

export function addDashboardWidget(ids, id) {
  if (!id || ids.includes(id)) return ids
  return [...ids, id]
}

export function removeDashboardWidget(ids, id) {
  return ids.filter((widgetId) => widgetId !== id)
}

export function moveDashboardWidget(ids, sourceId, targetId) {
  if (!sourceId || !targetId || sourceId === targetId) return ids
  const sourceIndex = ids.indexOf(sourceId)
  const targetIndex = ids.indexOf(targetId)
  if (sourceIndex < 0 || targetIndex < 0) return ids

  const next = [...ids]
  next.splice(sourceIndex, 1)
  next.splice(next.indexOf(targetId), 0, sourceId)
  return next
}

export function moveDashboardWidgetByOffset(ids, id, offset) {
  const index = ids.indexOf(id)
  const nextIndex = index + offset
  if (index < 0 || nextIndex < 0 || nextIndex >= ids.length) return ids

  const next = [...ids]
  const [widget] = next.splice(index, 1)
  next.splice(nextIndex, 0, widget)
  return next
}
