// ═══════════════════════════════════════════════════════════
// 🎯 BOUTON ONGLET AVEC LUMIÈRE ROTATIVE - ARRÊT AU CLIC
// ═══════════════════════════════════════════════════════════

import React, { useEffect, useState, useRef, useCallback, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { ChevronRight } from 'lucide-react'
import { PRIORITY_STYLES } from '../utils/animationConfig'

const AnimatedTabButton = ({ 
  tabState, 
  icon: Icon, 
  label, 
  path, 
  onClick,
  style,
  className = ''
}) => {
  const navigate = useNavigate()
  const [isAnimating, setIsAnimating] = useState(false)
  const animationTimerRef = useRef(null)
  const isClickingRef = useRef(false)
  
  // ═══ SI PAS DE tabState, RENDU SIMPLE ═══
  const hasValidTabState = useMemo(() => {
    return tabState && tabState.tabKey
  }, [tabState])

  // ═══ CLEANUP DES TIMERS ═══
  useEffect(() => {
    return () => {
      if (animationTimerRef.current) {
        clearTimeout(animationTimerRef.current)
      }
    }
  }, [])

  // ═══ GESTION DE L'ANIMATION ═══
  useEffect(() => {
    if (!hasValidTabState) return

    // Arrêter immédiatement si déjà vu
    if (tabState.viewed) {
      setIsAnimating(false)
      if (animationTimerRef.current) {
        clearTimeout(animationTimerRef.current)
        animationTimerRef.current = null
      }
      return
    }

    // Démarrer l'animation si non vu
    if (!tabState.viewed && tabState.activeTriggers?.length > 0) {
      setIsAnimating(true)
      
      const highestPriorityTrigger = tabState.activeTriggers.reduce((highest, current) => {
        const priorityOrder = { critical: 4, high: 3, medium: 2, low: 1, info: 0 }
        return priorityOrder[current.priority] > priorityOrder[highest.priority] ? current : highest
      }, tabState.activeTriggers[0])

      // Nettoyer le timer précédent
      if (animationTimerRef.current) {
        clearTimeout(animationTimerRef.current)
      }

      // Arrêter l'animation après la durée définie
      if (highestPriorityTrigger.duration > 0) {
        animationTimerRef.current = setTimeout(() => {
          setIsAnimating(false)
          animationTimerRef.current = null
        }, highestPriorityTrigger.duration * 1000)
      }
    } else {
      setIsAnimating(false)
    }

  }, [hasValidTabState, tabState?.viewed, tabState?.activeTriggers])

  // ═══ HANDLER CLICK OPTIMISÉ ═══
  const handleClick = useCallback((e) => {
    // Empêcher les clics multiples
    if (isClickingRef.current) {
      e.preventDefault()
      return
    }
    
    isClickingRef.current = true

    // Arrêter l'animation immédiatement
    setIsAnimating(false)
    
    // Nettoyer le timer d'animation
    if (animationTimerRef.current) {
      clearTimeout(animationTimerRef.current)
      animationTimerRef.current = null
    }
    
    // Marquer comme vu (si tabState valide)
    if (hasValidTabState && onClick) {
      onClick(tabState.tabKey)
    }
    
    // Naviguer
    if (path) {
      navigate(path)
    }

    // Réinitialiser le flag après un délai
    setTimeout(() => {
      isClickingRef.current = false
    }, 300)
  }, [hasValidTabState, tabState?.tabKey, onClick, path, navigate])

  // ═══ RENDU BOUTON NORMAL (non animé) ═══
  if (!hasValidTabState || !isAnimating || tabState.viewed) {
    return (
      <button
        className={`afro-nav-btn ${className}`}
        style={style}
        onClick={handleClick}
      >
        <Icon size={20} color={tabState?.color || '#F59E0B'} />
        <span>{label}</span>
        <ChevronRight size={16} color="#666" />
      </button>
    )
  }

  // ═══ RENDU BOUTON ANIMÉ ═══
  const priorityStyle = PRIORITY_STYLES[tabState.highestPriority] || PRIORITY_STYLES.medium
  const tabColor = tabState.color || '#F59E0B'
  const tabKey = tabState.tabKey

  const hexToRgb = (hex) => {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex)
    return result 
      ? `${parseInt(result[1], 16)}, ${parseInt(result[2], 16)}, ${parseInt(result[3], 16)}`
      : '245, 158, 11'
  }

  const rgbColor = hexToRgb(tabColor)

  return (
    <>
      <style>{`
        @keyframes rotate-border-light-${tabKey} {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }

        @keyframes pulse-glow-${tabKey} {
          0%, 100% { opacity: 0.5; }
          50% { opacity: 1; }
        }

        @keyframes shake-critical-${tabKey} {
          0%, 100% { transform: translateX(0); }
          10%, 30%, 50%, 70%, 90% { transform: translateX(-2px); }
          20%, 40%, 60%, 80% { transform: translateX(2px); }
        }

        .animated-tab-wrapper-${tabKey} {
          position: relative;
          width: 100%;
          margin-bottom: 8px;
        }

        .animated-tab-btn-${tabKey} {
          position: relative;
          display: flex;
          align-items: center;
          gap: 14px;
          padding: 14px 16px;
          border-radius: 12px;
          background: rgba(${rgbColor}, 0.08);
          border: 1px solid rgba(${rgbColor}, 0.3);
          color: #E5E5E5;
          font-size: 15px;
          font-weight: 500;
          cursor: pointer;
          width: 100%;
          text-align: left;
          transition: all 0.3s ease;
          overflow: visible;
          z-index: 1;
          ${tabState.highestPriority === 'critical' ? `animation: shake-critical-${tabKey} 0.5s ease-in-out infinite;` : ''}
        }

        .animated-tab-btn-${tabKey}:hover {
          background: rgba(${rgbColor}, 0.15);
          transform: translateX(2px);
        }

        .animated-tab-btn-${tabKey}:active {
          transform: scale(0.98);
        }

        .rotating-border-light-${tabKey} {
          position: absolute;
          top: -3px;
          left: -3px;
          right: -3px;
          bottom: -3px;
          border-radius: 14px;
          background: conic-gradient(
            from 0deg,
            transparent 0deg,
            transparent 60deg,
            ${tabColor} 90deg,
            ${tabColor} 180deg,
            transparent 210deg,
            transparent 360deg
          );
          animation: rotate-border-light-${tabKey} ${priorityStyle.animationDuration} linear infinite;
          z-index: -1;
          pointer-events: none;
        }

        .glow-effect-${tabKey} {
          position: absolute;
          top: 50%;
          left: 50%;
          width: 120%;
          height: 120%;
          transform: translate(-50%, -50%);
          background: radial-gradient(
            circle,
            rgba(${rgbColor}, 0.3) 0%,
            rgba(${rgbColor}, 0.15) 40%,
            transparent 70%
          );
          border-radius: 50%;
          animation: pulse-glow-${tabKey} ${priorityStyle.animationDuration} ease-in-out infinite;
          z-index: -2;
          pointer-events: none;
          filter: blur(20px);
        }

        .inner-border-${tabKey} {
          position: absolute;
          top: 2px;
          left: 2px;
          right: 2px;
          bottom: 2px;
          border-radius: 10px;
          background: rgba(15, 15, 25, 0.95);
          z-index: 0;
          pointer-events: none;
        }

        .btn-content-${tabKey} {
          position: relative;
          z-index: 2;
          display: flex;
          align-items: center;
          gap: 14px;
          width: 100%;
        }

        .btn-label-${tabKey} {
          flex: 1;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .btn-chevron-${tabKey} {
          flex-shrink: 0;
          transition: transform 0.3s ease;
        }

        .animated-tab-btn-${tabKey}:hover .btn-chevron-${tabKey} {
          transform: translateX(4px);
        }
      `}</style>

      <div className={`animated-tab-wrapper-${tabKey}`}>
        <div className={`rotating-border-light-${tabKey}`}></div>
        <div className={`glow-effect-${tabKey}`}></div>

        <button
          className={`animated-tab-btn-${tabKey}`}
          onClick={handleClick}
          aria-label={label}
        >
          <div className={`inner-border-${tabKey}`}></div>

          <div className={`btn-content-${tabKey}`}>
            <Icon size={20} color={tabColor} strokeWidth={2} />
            <span className={`btn-label-${tabKey}`}>{label}</span>
            <ChevronRight 
              size={16} 
              color={tabColor} 
              className={`btn-chevron-${tabKey}`}
            />
          </div>
        </button>
      </div>
    </>
  )
}

export default React.memo(AnimatedTabButton)