import { useEffect, useState } from 'react'
import { CheckCircle2, QrCode, Smartphone } from 'lucide-react'
import EnCheckBrandMark from './EnCheckBrandMark'
import '../pages/PointagesAfroTech.css'

export default function PointagesLoadingScreen({ darkMode = false }) {
  const [activeStep, setActiveStep] = useState(0)

  useEffect(() => {
    const timer = window.setInterval(() => {
      setActiveStep((prev) => (prev === 0 ? 1 : 0))
    }, 1350)
    return () => window.clearInterval(timer)
  }, [])

  return (
    <div
      className="pointages-afrotech-shell pointages-loading-screen"
      data-theme={darkMode ? 'dark' : 'light'}
      role="status"
      aria-live="polite"
    >
      <div className="pointages-loading-inner">
        <div className="pointages-loading-brand">
          <EnCheckBrandMark className="pointages-loading-mark" size={56} loading />
          <div className="pointages-loading-brand-copy">
            <strong>En-Check</strong>
            <span>On gère !</span>
          </div>
        </div>

        <h1 className="pointages-loading-title">Chargement de la page Pointages…</h1>

        <div className="pointages-loading-stage">
          <div className={`pointages-loading-scene${activeStep === 0 ? ' is-active' : ''}`}>
            <img
              src="/images/pointage-loading-pin.jpg"
              alt="Collaboratrice composant son code PIN sur une borne En-Check"
              loading="eager"
              decoding="async"
            />
            <div className="pointages-loading-scene-caption">
              <span><Smartphone size={13} style={{ verticalAlign: 'middle', marginRight: 5 }} />Pointage par Code PIN</span>
              <CheckCircle2 size={14} color="#4ADE80" />
            </div>
          </div>

          <div className={`pointages-loading-scene${activeStep === 1 ? ' is-active' : ''}`}>
            <img
              src="/images/pointage-loading-qr.jpg"
              alt="Validation d'un pointage par badge QR Code sur un terminal En-Check"
              loading="eager"
              decoding="async"
            />
            <div className="pointages-loading-scene-caption">
              <span><QrCode size={13} style={{ verticalAlign: 'middle', marginRight: 5 }} />Pointage par QR Code & Photo</span>
              <CheckCircle2 size={14} color="#4ADE80" />
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
            {activeStep === 1 && <CheckCircle2 size={15} />}
          </button>
        </div>

        <div className="pointages-loading-bar-track" aria-hidden="true">
          <div className="pointages-loading-bar-fill" />
        </div>

        <p className="pointages-loading-subtitle">
          {activeStep === 0
            ? 'Vérification des codes PIN et horaires du jour…'
            : 'Synchronisation des scans QR, photos signées et positions…'}
        </p>
      </div>
    </div>
  )
}
