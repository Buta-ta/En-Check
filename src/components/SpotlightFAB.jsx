// src/components/SpotlightFAB.jsx

import { useState, useEffect } from 'react'
import { Search } from 'lucide-react'
import SpotlightSearchModal from './SpotlightSearchModal'
import '../styles/spotlightFAB.css'

export default function SpotlightFAB({ admin }) {
  const [isOpen, setIsOpen] = useState(false)
  const [isHovered, setIsHovered] = useState(false)

  // ═══ GESTION RACCOURCI ⌘K ═══
  useEffect(() => {
    const handleKeyPress = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        setIsOpen(true)
      }
      if (e.key === 'Escape' && isOpen) {
        setIsOpen(false)
      }
    }

    window.addEventListener('keydown', handleKeyPress)
    return () => window.removeEventListener('keydown', handleKeyPress)
  }, [isOpen])

  const handleOpen = () => {
    setIsOpen(true)
    
    // Vibration mobile
    if (navigator.vibrate) {
      navigator.vibrate([10, 5, 10])
    }
  }

  const handleClose = () => {
    setIsOpen(false)
  }

  return (
    <>
      {/* ═══════════════════════════════════════════════════════ */}
      {/* BOUTON FLOTTANT (VERSION STATIQUE) */}
      {/* ═══════════════════════════════════════════════════════ */}
      <button
        className={`spotlight-fab ${isHovered ? 'spotlight-fab--hovered' : ''} ${isOpen ? 'spotlight-fab--hidden' : ''}`}
        onClick={handleOpen}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        aria-label="Ouvrir la recherche intelligente"
        title="Recherche rapide (⌘K)"
      >
        {/* Icône centrale */}
        <div className="spotlight-fab__icon">
          <Search size={28} color="#000" />
        </div>

        {/* Pattern décoratif (statique) */}
        <svg className="spotlight-fab__pattern" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
          <path d="M50 20 L60 40 L80 40 L65 52 L70 70 L50 58 L30 70 L35 52 L20 40 L40 40 Z" 
                fill="currentColor" 
                opacity="0.1" />
        </svg>
      </button>

      {/* ═══════════════════════════════════════════════════════ */}
      {/* MODAL SPOTLIGHT SEARCH */}
      {/* ═══════════════════════════════════════════════════════ */}
      {isOpen && (
        <SpotlightSearchModal 
          admin={admin} 
          onClose={handleClose}
          isOpen={isOpen}
        />
      )}
    </>
  )
}