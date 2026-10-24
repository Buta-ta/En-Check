import { useEffect, useState } from 'react'
import '../pages/PointagesAfroTech.css'
import './PointagesLoadingScreen.css'

export const POINTAGES_INTRO_MS = 6000

export default function PointagesLoadingScreen({
  darkMode = true,
  onSkip,
  onIntroDone,
  dataReady = false,
}) {
  const [loaded, setLoaded] = useState(false)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    if (!onIntroDone) return
    const motion = window.matchMedia?.('(prefers-reduced-motion: reduce)')
    if (motion?.matches) {
      onIntroDone()
      return
    }
    const timer = window.setTimeout(onIntroDone, POINTAGES_INTRO_MS)
    const change = (event) => {
      if (event.matches) onIntroDone()
    }
    motion?.addEventListener?.('change', change)
    return () => {
      window.clearTimeout(timer)
      motion?.removeEventListener?.('change', change)
    }
  }, [onIntroDone])

  return (
    <section
      className="pointages-afrotech-shell pt-art-loading"
      data-theme={darkMode ? 'dark' : 'light'}
      aria-label="Chargement des pointages"
      aria-busy={!dataReady}
    >
      <div className="pt-art-card">
        {!failed && (
          <div
            className={`pt-art-scene${loaded ? ' is-loaded' : ''}`}
            aria-hidden="true"
          >
            <img
              src="/images/pointages-loading-approved.webp"
              alt=""
              width="1824"
              height="1026"
              decoding="async"
              fetchPriority="high"
              draggable={false}
              onLoad={() => setLoaded(true)}
              onError={() => setFailed(true)}
            />
            {/* Light only: the approved person, hand, phone and terminal are not redrawn. */}
            <div className="pt-art-terminal">
              <span />
            </div>
            <span className="pt-art-phone" />
          </div>
        )}
        <div className="pt-art-caption">
          <span className="pt-art-eyebrow">EN-CHECK · POINTAGES</span>
          <h1>
            {dataReady
              ? 'Les pointages sont prêts'
              : 'Chargement des pointages…'}
          </h1>
          <p role="status" aria-live="polite">
            {dataReady
              ? 'Vous pouvez passer l’animation pour consulter la liste.'
              : 'Lecture des pointages et préparation de la liste.'}
          </p>
          {onSkip && (
            <button
              type="button"
              className="pt-art-skip"
              onClick={onSkip}
              disabled={!dataReady}
            >
              Passer l’animation
            </button>
          )}
        </div>
      </div>
    </section>
  )
}
