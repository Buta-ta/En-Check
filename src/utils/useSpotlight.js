// ═══════════════════════════════════════════════════════════
// 🪝 HOOK SPOTLIGHT - Gestion état global de la recherche
// ═══════════════════════════════════════════════════════════

import { useState, useCallback, useEffect } from 'react'
import { searchSpotlight } from '../services/spotlightService'
import { saveSearchHistory } from '../services/searchCache'

export default function useSpotlight(admin) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState([])
  const [loading, setLoading] = useState(false)
  const [selectedIndex, setSelectedIndex] = useState(0)
  const [error, setError] = useState(null)

  // ═══ RECHERCHE ═══
  const handleSearch = useCallback(async (searchQuery = query) => {
    if (!searchQuery || !searchQuery.trim()) {
      setResults([])
      return
    }

    setLoading(true)
    setError(null)

    try {
      const searchResults = await searchSpotlight(searchQuery, admin)
      setResults(searchResults)
      setSelectedIndex(0)

      // Sauvegarder dans l'historique
      if (searchResults.length > 0) {
        saveSearchHistory(searchQuery, searchResults.length, admin.id)
      }
    } catch (err) {
      console.error('Erreur recherche spotlight:', err)
      setError(err.message || 'Erreur lors de la recherche')
      setResults([])
    } finally {
      setLoading(false)
    }
  }, [query, admin])

  // ═══ DEBOUNCE AUTO-SEARCH ═══
  useEffect(() => {
    if (!query.trim()) {
      setResults([])
      return
    }

    // Ne pas chercher si c'est une commande slash incomplète
    if (query.startsWith('/') && query.length < 3) {
      return
    }

    const debounceTimer = setTimeout(() => {
      handleSearch()
    }, 300) // 300ms debounce

    return () => clearTimeout(debounceTimer)
  }, [query, handleSearch])

  // ═══ NAVIGATION CLAVIER ═══
  const handleKeyDown = useCallback((e) => {
    if (results.length === 0) return

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault()
        setSelectedIndex((prev) => 
          prev < results.length - 1 ? prev + 1 : prev
        )
        break

      case 'ArrowUp':
        e.preventDefault()
        setSelectedIndex((prev) => 
          prev > 0 ? prev - 1 : 0
        )
        break

      case 'Enter':
        if (results[selectedIndex]) {
          // Géré par le composant parent
        }
        break

      default:
        break
    }
  }, [results, selectedIndex])

  // ═══ CLEAR RESULTS ═══
  const clearResults = useCallback(() => {
    setResults([])
    setSelectedIndex(0)
    setError(null)
  }, [])

  return {
    query,
    setQuery,
    results,
    loading,
    error,
    selectedIndex,
    setSelectedIndex,
    handleSearch,
    handleKeyDown,
    clearResults,
  }
}