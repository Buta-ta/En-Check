// src/hooks/useSpotlight.js
// (MAJ) :
// - Arrow navigation gérée proprement
// - debounce search conservé
// - expose setSelectedIndex

import { useState, useCallback, useEffect } from 'react'
import { searchSpotlight } from '../services/spotlightService'
import { saveSearchHistory } from '../services/searchCache'

export default function useSpotlight(admin) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState([])
  const [loading, setLoading] = useState(false)
  const [selectedIndex, setSelectedIndex] = useState(0)
  const [error, setError] = useState(null)

  const handleSearch = useCallback(async (searchQuery = query) => {
    const q = (searchQuery || '').trim()
    if (!q) { setResults([]); return }
    if (!admin) return

    setLoading(true)
    setError(null)

    try {
      const r = await searchSpotlight(q, admin)
      setResults(r || [])
      setSelectedIndex(0)
      if ((r || []).length > 0) saveSearchHistory(q, r.length, admin.id)
    } catch (err) {
      console.error('Erreur recherche spotlight:', err)
      setError(err.message || 'Erreur lors de la recherche')
      setResults([])
    } finally {
      setLoading(false)
    }
  }, [query, admin])

  useEffect(() => {
    if (!admin) return
    if (!query.trim()) { setResults([]); return }
    if (query.startsWith('/') && query.length < 2) return

    const t = setTimeout(() => handleSearch(), 300)
    return () => clearTimeout(t)
  }, [query, admin, handleSearch])

  const handleArrowNavigation = useCallback((e) => {
    if (!results.length) return

    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setSelectedIndex((prev) => Math.min(prev + 1, results.length - 1))
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault()
      setSelectedIndex((prev) => Math.max(prev - 1, 0))
    }
  }, [results.length])

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
    handleArrowNavigation,
    clearResults,
  }
}