// src/components/SpotlightSearchModal.jsx

import { useState, useEffect, useRef } from 'react'
import { X, Sparkles } from 'lucide-react'
import EnCheckBrandMark from './EnCheckBrandMark'
import { useNavigate } from 'react-router-dom'
import SearchBar from './SpotlightSearch/SearchBar'
import SearchResults from './SpotlightSearch/SearchResults'
import useSpotlight from '../hooks/useSpotlight'
import '../styles/spotlightModal.css'

export default function SpotlightSearchModal({ admin, onClose, isOpen }) {
  const navigate = useNavigate()
  const inputRef = useRef(null)

  const {
    query,
    setQuery,
    results,
    loading,
    selectedIndex,
    setSelectedIndex,
    handleSearch,
    handleArrowNavigation,
    clearResults,
  } = useSpotlight(admin)

  const activeEnterpriseId = admin?.selectedEnterprise?.id || admin?.enterprise_id
  const isMultiEntreprise = admin?.role === 'super_admin' || admin?.entreprises?.length > 1
  const canSearch = !isMultiEntreprise || !!activeEnterpriseId

  // ═══ BLOQUER SCROLL DU DASHBOARD ═══
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }

    return () => {
      document.body.style.overflow = ''
    }
  }, [isOpen])

  // ═══ AUTO-FOCUS INPUT ═══
  useEffect(() => {
    if (isOpen && inputRef.current) {
      setTimeout(() => {
        inputRef.current.focus()
      }, 100)
    }
  }, [isOpen])

  // ═══ GESTION CLAVIER ═══
  const handleInputKeyDown = (e) => {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      handleArrowNavigation(e)
      return
    }

    if (e.key === 'Enter') {
      e.preventDefault()
      if (!canSearch) return

      if (results.length > 0) {
        handleResultSelect(results[selectedIndex])
        return
      }

      handleSearch()
      return
    }

    if (e.key === 'Escape') {
      if (query) {
        setQuery('')
        clearResults()
      } else {
        onClose()
      }
    }
  }

  // ═══ SÉLECTION RÉSULTAT ═══
  const handleResultSelect = (result) => {
    if (!result) return

    // Actions spéciales
    if (result.type === 'action') {
      if (result.action === 'goDashboard') navigate('/dashboard')
      if (result.action === 'goReports') navigate('/rapports')
      if (result.action === 'goMap') navigate('/carte-temps-reel')
      if (result.action === 'goPredictions') navigate('/predictions')
      onClose()
      return
    }

    // Type download_app : ne rien faire (géré par la carte)
    if (result.type === 'download_app') {
      return
    }

    // Navigation classique
    if (result.type === 'employee') navigate(`/employes?id=${result.id}`)
    else if (result.type === 'attendance') navigate('/pointages')
    else if (result.type === 'retard') navigate('/retards')
    else if (result.type === 'task') navigate(`/taches/${result.id}`)
    else if (result.type === 'hours_detail') {
      console.log('Détails heures:', result)
    }

    onClose()
  }

  // ═══ EXEMPLES DE RECHERCHE NATURELLE ═══
  const naturalExamples = [
    { text: 'heures Amadou ce mois', icon: '⏰' },
    { text: 'absents aujourd\'hui', icon: '🚫' },
    { text: 'tâches Fatoumata', icon: '🎯' },
  ]

  // ═══ HANDLER EXEMPLE NATUREL ═══
  const handleNaturalExample = (text) => {
    setQuery(text)
    handleSearch(text)
  }

  return (
    <>
      {/* ═══════════════════════════════════════════════════════ */}
      {/* OVERLAY SIMPLE (SANS ORBES) */}
      {/* ═══════════════════════════════════════════════════════ */}
      <div 
        className="spotlight-modal-overlay"
        onClick={onClose}
      />

      {/* ═══════════════════════════════════════════════════════ */}
      {/* MODAL COMPACT CENTRÉ */}
      {/* ═══════════════════════════════════════════════════════ */}
      <div 
        className="spotlight-modal-compact"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header simplifié */}
        <div className="spotlight-modal-header-compact">
          <div className="spotlight-modal-logo-compact">
            <EnCheckBrandMark size={26} loading={loading} />
            <span>EN-CHECK</span>
          </div>

          <button 
            className="spotlight-modal-close-btn"
            onClick={onClose}
            aria-label="Fermer"
          >
            <X size={20} />
          </button>
        </div>

        {/* Barre de recherche */}
        <div className="spotlight-modal-search-wrapper">
          <SearchBar
            ref={inputRef}
            query={query}
            setQuery={(v) => {
              setQuery(v)
              if (selectedIndex !== 0) setSelectedIndex(0)
            }}
            onKeyDown={handleInputKeyDown}
            loading={loading}
            onScanClick={null}
          />

          {loading && (
            <div className="spotlight-modal-progress">
              <div className="spotlight-modal-progress-bar" />
            </div>
          )}
        </div>

        {/* Résultats (scrollable) */}
        {results.length > 0 && (
          <div className="spotlight-modal-results-compact">
            <SearchResults
              results={results}
              selectedIndex={selectedIndex}
              onSelect={handleResultSelect}
            />
          </div>
        )}

        {/* Exemples (seulement si pas de résultats) */}
        {!query && !results.length && canSearch && (
          <div className="spotlight-modal-examples">
            <div className="spotlight-examples-header">
              <Sparkles size={16} color="#F59E0B" />
              <span>Exemples de recherche :</span>
            </div>
            <div className="spotlight-examples-list">
              {naturalExamples.map((example, index) => (
                <button
                  key={index}
                  className="spotlight-example-item"
                  onClick={() => handleNaturalExample(example.text)}
                >
                  <span className="spotlight-example-icon">{example.icon}</span>
                  <span className="spotlight-example-text">{example.text}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Message multi-entreprise */}
        {!canSearch && (
          <div className="spotlight-modal-warning">
            <EnCheckBrandMark size={34} loading={loading} />
            <p>Sélectionnez une entreprise pour rechercher</p>
          </div>
        )}

        {/* Footer raccourcis */}
        <div className="spotlight-modal-footer-compact">
          <span><kbd>ESC</kbd> Fermer</span>
          <span><kbd>↑</kbd><kbd>↓</kbd> Naviguer</span>
          <span><kbd>Enter</kbd> Sélectionner</span>
        </div>
      </div>
    </>
  )
}