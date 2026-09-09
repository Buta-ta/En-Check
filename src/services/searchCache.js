// ═══════════════════════════════════════════════════════════
// 💾 SEARCH CACHE - Historique et cache des recherches
// ═══════════════════════════════════════════════════════════

const HISTORY_KEY = 'spotlight_search_history'
const FAVORITES_KEY = 'spotlight_favorites'
const MAX_HISTORY = 20

/**
 * Sauvegarder une recherche dans l'historique
 */
export function saveSearchHistory(query, resultsCount, adminId) {
  try {
    const history = getSearchHistory(adminId)

    const newEntry = {
      query,
      resultsCount,
      timestamp: Date.now(),
    }

    // Retirer si déjà présent (éviter doublons)
    const filtered = history.filter(h => h.query !== query)

    // Ajouter en tête
    const updated = [newEntry, ...filtered].slice(0, MAX_HISTORY)

    const key = `${HISTORY_KEY}_${adminId}`
    localStorage.setItem(key, JSON.stringify(updated))
  } catch (error) {
    console.error('Erreur sauvegarde historique:', error)
  }
}

/**
 * Récupérer l'historique de recherche
 */
export function getSearchHistory(adminId) {
  try {
    const key = `${HISTORY_KEY}_${adminId}`
    const stored = localStorage.getItem(key)
    return stored ? JSON.parse(stored) : []
  } catch (error) {
    console.error('Erreur lecture historique:', error)
    return []
  }
}

/**
 * Effacer l'historique
 */
export function clearSearchHistory(adminId) {
  try {
    const key = `${HISTORY_KEY}_${adminId}`
    localStorage.removeItem(key)
  } catch (error) {
    console.error('Erreur effacement historique:', error)
  }
}

/**
 * Ajouter une recherche aux favoris
 */
export function addToFavorites(query, adminId) {
  try {
    const favorites = getFavorites(adminId)

    if (!favorites.includes(query)) {
      favorites.push(query)
      const key = `${FAVORITES_KEY}_${adminId}`
      localStorage.setItem(key, JSON.stringify(favorites))
    }
  } catch (error) {
    console.error('Erreur ajout favori:', error)
  }
}

/**
 * Récupérer les favoris
 */
export function getFavorites(adminId) {
  try {
    const key = `${FAVORITES_KEY}_${adminId}`
    const stored = localStorage.getItem(key)
    return stored ? JSON.parse(stored) : []
  } catch (error) {
    console.error('Erreur lecture favoris:', error)
    return []
  }
}

/**
 * Retirer un favori
 */
export function removeFromFavorites(query, adminId) {
  try {
    const favorites = getFavorites(adminId)
    const updated = favorites.filter(f => f !== query)
    
    const key = `${FAVORITES_KEY}_${adminId}`
    localStorage.setItem(key, JSON.stringify(updated))
  } catch (error) {
    console.error('Erreur suppression favori:', error)
  }
}

/**
 * Obtenir suggestions basées sur l'historique
 */
export function getSuggestions(partialQuery, adminId) {
  const history = getSearchHistory(adminId)
  const favorites = getFavorites(adminId)

  if (!partialQuery || partialQuery.length < 2) {
    return {
      history: history.slice(0, 5),
      favorites,
    }
  }

  // Filtrer historique par correspondance
  const matchingHistory = history
    .filter(h => h.query.toLowerCase().includes(partialQuery.toLowerCase()))
    .slice(0, 5)

  const matchingFavorites = favorites
    .filter(f => f.toLowerCase().includes(partialQuery.toLowerCase()))

  return {
    history: matchingHistory,
    favorites: matchingFavorites,
  }
}