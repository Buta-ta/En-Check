import PageCulturalBand from './PageCulturalBand'
// ═══════════════════════════════════════════════════════════════════════════
// 📅 ÉCRAN DE CHARGEMENT PLANNING — identique à l'écran Pointages
// Deux scènes rythmées (Étape 1 / Étape 2) : le planning En-Check projeté,
// puis la construction de la grille de la semaine.
// ═══════════════════════════════════════════════════════════════════════════

import { useEffect, useState } from 'react'
import { ArrowRight, CalendarDays, CheckCircle2, LayoutGrid, Users } from 'lucide-react'
import EnCheckBrandMark from './EnCheckBrandMark'
import { CulturalCornerMotifSvg } from './AfroCulturalSvg'
import '../pages/PointagesAfroTech.css'

export default function PlanningLoadingScreen({ darkMode = true, onSkip }) {
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

        <PageCulturalBand pathname="/planning" placement="loading"/>

        <h1 className="pointages-loading-title">Chargement du planning En-Check…</h1>

        <div className="pointages-loading-stage">
          <div
            className={`pointages-loading-scene${activeStep === 0 ? ' is-active' : ''}`}
            onClick={() => setActiveStep(0)}
          >
            <img
              src="/images/planning-loading-ecran.jpg"
              alt="Le planning En-Check projeté sur grand écran devant une équipe"
              loading="eager"
              decoding="async"
            />
            <div className="pointages-loading-scene-caption">
              <span>
                <CalendarDays size={14} style={{ verticalAlign: 'middle', marginRight: 6 }} />
                Étape 1 · Le planning En-Check projeté à l’équipe
              </span>
              <CheckCircle2 size={15} color="#4ADE80" />
            </div>
          </div>

          <div
            className={`pointages-loading-scene${activeStep === 1 ? ' is-active' : ''}`}
            onClick={() => setActiveStep(1)}
          >
            <img
              src="/images/planning-loading-grid-femme.jpg"
              alt="Construction de la grille de la semaine et placement des créneaux"
              loading="eager"
              decoding="async"
            />
            <div className="pointages-loading-scene-caption">
              <span>
                <LayoutGrid size={14} style={{ verticalAlign: 'middle', marginRight: 6 }} />
                Étape 2 · Grille de la semaine & pose des créneaux
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
            <span>1. Modèles, équipes & disponibilités</span>
            <Users size={15} />
          </button>
          <button
            type="button"
            className={`pointages-loading-step${activeStep === 1 ? ' is-active' : ''}`}
            onClick={() => setActiveStep(1)}
          >
            <span>2. Grille de la semaine & créneaux</span>
            <CheckCircle2 size={15} />
          </button>
        </div>

        <div className="pointages-loading-bar-track" aria-hidden="true">
          <div className="pointages-loading-bar-fill" style={{ width: `${progress}%` }} />
        </div>

        <div className="pointages-loading-footer">
          <p className="pointages-loading-subtitle">
            {activeStep === 0
              ? 'Étape 1/2 · Chargement des modèles (horaires, repos, congés) et des équipes…'
              : 'Étape 2/2 · Construction de la grille de la semaine et placement des créneaux…'}
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
