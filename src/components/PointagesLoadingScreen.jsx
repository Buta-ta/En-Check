import PageCulturalBand from './PageCulturalBand'
import { useEffect, useState } from 'react'
import { ArrowRight, CheckCircle2, QrCode, Smartphone } from 'lucide-react'
import EnCheckBrandMark from './EnCheckBrandMark'
import { CulturalCornerMotifSvg } from './AfroCulturalSvg'
import '../pages/PointagesAfroTech.css'

export default function PointagesLoadingScreen({ darkMode = true, onSkip }) {
  const [activeStep, setActiveStep] = useState(0)
  const [progress, setProgress] = useState(14)

  useEffect(() => {
    const stepTimer = window.setInterval(() => {
      setActiveStep((prev) => (prev === 0 ? 1 : 0))
    }, 2300)
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

        <PageCulturalBand pathname="/pointages" placement="loading"/>

        <h1 className="pointages-loading-title">Chargement de la page Pointages…</h1>

        <div className="pointages-loading-stage">
          <div
            className={`pointages-loading-scene${activeStep === 0 ? ' is-active' : ''}`}
            onClick={() => setActiveStep(0)}
          >
            <img
              src="/images/pointage-loading-pin.jpg"
              alt="Collaboratrice composant son code PIN sur une borne En-Check"
              loading="eager"
              decoding="async"
            />
            <div className="pointages-loading-scene-caption">
              <span>
                <Smartphone size={14} style={{ verticalAlign: 'middle', marginRight: 6 }} />
                Étape 1 · Pointage par Code PIN
              </span>
              <CheckCircle2 size={15} color="#4ADE80" />
            </div>
          </div>

          <div
            className={`pointages-loading-scene${activeStep === 1 ? ' is-active' : ''}`}
            onClick={() => setActiveStep(1)}
          >
            <img
              src="/images/pointage-loading-qr.jpg"
              alt="Validation d'un pointage par badge QR Code sur un terminal En-Check"
              loading="eager"
              decoding="async"
            />
            <div className="pointages-loading-scene-caption">
              <span>
                <QrCode size={14} style={{ verticalAlign: 'middle', marginRight: 6 }} />
                Étape 2 · Pointage par QR Code & Photo
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
            <span>1. Vérification Code PIN</span>
            <CheckCircle2 size={15} />
          </button>
          <button
            type="button"
            className={`pointages-loading-step${activeStep === 1 ? ' is-active' : ''}`}
            onClick={() => setActiveStep(1)}
          >
            <span>2. Synchronisation QR & Photos</span>
            <CheckCircle2 size={15} />
          </button>
        </div>

        <div className="pointages-loading-bar-track" aria-hidden="true">
          <div className="pointages-loading-bar-fill" style={{ width: `${progress}%` }} />
        </div>

        <div className="pointages-loading-footer">
          <p className="pointages-loading-subtitle">
            {activeStep === 0
              ? 'Étape 1/2 · Vérification des codes PIN et horaires du jour…'
              : 'Étape 2/2 · Synchronisation des scans QR, photos signées et positions…'}
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
