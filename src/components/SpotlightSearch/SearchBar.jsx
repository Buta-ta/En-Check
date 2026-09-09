// src/components/SpotlightSearch/SearchBar.jsx
// (MAJ) : ne déclenche plus automatiquement la recherche sur Enter
// -> le parent décide : Enter = ouvrir sélection si résultats, sinon lancer recherche

import { useEffect, useRef } from 'react'
import { Search, Camera, Loader } from 'lucide-react'
import useTypewriter from '../../hooks/useTypewriter'

const PLACEHOLDERS = [
  "🔍 Chercher un employé par nom ou matricule...",
  "⏱️ Calculer les heures travaillées d'un employé...",
  "📸 Scanner un QR code employé...",
  "📊 Afficher les statistiques du jour...",
  "👥 Voir qui est absent aujourd'hui...",
  "⚡ Taper '/' pour les commandes rapides...",
  "🎯 Rechercher des tâches urgentes...",
  "💰 Consulter les fiches de paie...",
  "🗺️ Ouvrir la carte temps réel...",
  "🔮 Voir les prédictions...",
]

export default function SearchBar({ query, setQuery, onKeyDown, loading, onScanClick }) {
  const inputRef = useRef(null)
  const { currentPlaceholder } = useTypewriter(PLACEHOLDERS, !query)

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  return (
    <div className="search-bar-container">
      <div className={`search-bar ${query ? 'search-bar-active' : ''} ${loading ? 'search-bar-loading' : ''}`}>
        <div className="search-bar-icon">
          {loading ? <Loader size={24} className="search-bar-loader" /> : <Search size={24} />}
        </div>

        <input
          ref={inputRef}
          id="spotlight-search-input"
          type="text"
          className="search-bar-input"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder={currentPlaceholder}
          autoComplete="off"
          spellCheck="false"
        />

        {!query && (
          <div className="search-bar-shortcut">
            <kbd className="search-bar-kbd">⌘K</kbd>
          </div>
        )}

        {onScanClick && ( // ✅ Afficher seulement si onScanClick existe
  <button
    className="spotlight-search-scan"
    onClick={onScanClick}
    title="Scanner QR Code"
  >
    <Camera size={20} />
  </button>
)}

        <div className="search-bar-border"></div>
      </div>

      {query.startsWith('/') && (
        <div className="search-bar-hint">
          💡 Commandes : /stats, /absents, /retards, /scan, /export, /map
        </div>
      )}
    </div>
  )
}