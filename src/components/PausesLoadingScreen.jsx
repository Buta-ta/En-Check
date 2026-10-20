import { useEffect, useState } from 'react'
import { ArrowRight, CheckCircle2, Coffee, Timer } from 'lucide-react'
import EnCheckBrandMark from './EnCheckBrandMark'
import { CulturalCornerMotifSvg, KenteFriezeSvg } from './AfroCulturalSvg'
import '../pages/PointagesAfroTech.css'

export default function PausesLoadingScreen({ darkMode = true, onSkip }) {
  const [activeStep, setActiveStep] = useState(0)
  const [progress, setProgress] = useState(14)

  useEffect(() => {
    const stepTimer = window.setInterval(() => {
      setActiveStep((prev) => (prev === 0 ? 1 : 0))
    }, 2250)
    const progressTimer = window.setInterval(() => {
      setProgress((prev) => (prev >= 96 ? 24 : prev + 6))
    }, 240)
    return () => {
      window.clearInterval(stepTimer)
      window.clearInterval(progressTimer)
    }
  }, [])

  return (
    <div
      className="pointages-afrotech-shell pointages-loading-screen"
      data-theme={darkMode ? 'dark' : 'light'}
      role="status"
      aria-live="polite"
    >
      <CulturalCornerMotifSvg className="pointages-corner-svg is-top-left" />
      <CulturalCornerMotifSvg className="pointages-corner-svg is-top-right" />
      <CulturalCornerMotifSvg className="pointages-corner-svg is-bottom-left" />
      <CulturalCornerMotifSvg className="pointages-corner-svg is-bottom-right" />

      <div className="pointages-loading-inner">
        <div className="pointages-loading-brand">
          <EnCheckBrandMark className="pointages-loading-mark" size={58} loading />
          <div className="pointages-loading-brand-copy">
            <strong>En-Check</strong>
            <span>On gère !</span>
          </div>
        </div>

        <KenteFriezeSvg className="pointages-loading-frieze" />

        <h1 className="pointages-loading-title">Chargement de l’espace Pauses…</h1>

        <div className="pointages-loading-stage">
          <div
            className={`pointages-loading-scene${activeStep === 0 ? ' is-active' : ''}`}
            onClick={() => setActiveStep(0)}
          >
            <img
              src="/images/pointage-loading-qr.jpg"
              alt="Pointage des pauses réelles par les collaborateurs"
              loading="eager"
              decoding="async"
            />
            <div className="pointages-loading-scene-caption">
              <span>
                <Coffee size={14} style={{ verticalAlign: 'middle', marginRight: 6 }} />
                Étape 1 · Pauses réellement pointées (non présumées)
              </span>
              <CheckCircle2 size={15} color="#4ADE80" />
            </div>
          </div>

          <div
            className={`pointages-loading-scene${activeStep === 1 ? ' is-active' : ''}`}
            onClick={() => setActiveStep(1)}
          >
            <img
              src="/images/employes-loading-team.jpg"
              alt="Contrôle des pauses en direct et séparation des pauses présumées"
              loading="eager"
              decoding="async"
            />
            <div className="pointages-loading-scene-caption">
              <span>
                <Timer size={14} style={{ verticalAlign: 'middle', marginRight: 6 }} />
                Étape 2 · Chronomètre en direct & Pauses présumées séparées
              </span>
              <CheckCircle2 size={15} color="#4ADE80" />
            </div>
          </div>
        </div>

        <div className="pointages-loading-steps">
          <button
            type="button"
            className={`pointages-loading-step${activeStep === 0 ? ' is-active' : ''}`}
            onClick={() => setActiveStep(0)}
          >
            <span>1. Historique des pauses réelles</span>
            <CheckCircle2 size={15} />
          </button>
          <button
            type="button"
            className={`pointages-loading-step${activeStep === 1 ? ' is-active' : ''}`}
            onClick={() => setActiveStep(1)}
          >
            <span>2. Pauses en direct & Présumées à statuer</span>
            <CheckCircle2 size={15} />
          </button>
        </div>

        <div className="pointages-loading-bar-track" aria-hidden="true">
          <div className="pointages-loading-bar-fill" style={{ width: `${progress}%` }} />
        </div>

        <div className="pointages-loading-footer">
          <p className="pointages-loading-subtitle">
            {activeStep === 0
              ? 'Étape 1/2 · Lecture de l’historique des pauses réellement effectuées…'
              : 'Étape 2/2 · Séparation des pauses présumées de la grille et calcul du chronomètre en direct…'}
          </p>
          {onSkip && (
            <button type="button" className="pointages-loading-skip" onClick={onSkip}>
              <span>Passer l’animation</span>
              <ArrowRight size={13} />
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
