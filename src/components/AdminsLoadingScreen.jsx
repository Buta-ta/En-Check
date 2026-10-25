import { useEffect, useState } from 'react'
import { ArrowRight, ShieldCheck, Users } from 'lucide-react'
import PageCulturalBand from './PageCulturalBand'
import EnCheckBrandMark from './EnCheckBrandMark'
import { CulturalCornerMotifSvg } from './AfroCulturalSvg'
import './AdminsLoadingScreen.css'

// ═══════════════════════════════════════════════════════════
// 🧵 CHARGEMENT COMPTES & ACCÈS — la case de BD
//
// Une seule illustration, deux lectures : la caméra se déplace
// dans la case comme on lit une planche — d'abord la main qui
// jette les cauris du Fa, puis le plateau où le signe se lit.
//
// Rien n'est inventé sur les données : la légende dit ce qui
// charge vraiment (comptes, entreprises, rôles), et l'animation
// n'affirme aucun résultat.
// ═══════════════════════════════════════════════════════════

const LECTURES = [
  {
    cle: 'jet',
    cartouche: 'Étape 1 · Les cauris sont jetés',
    legende: 'Lecture des comptes, des entreprises et des accès de connexion…',
    Icone: Users,
  },
  {
    cle: 'signe',
    cartouche: 'Étape 2 · Le signe se lit',
    legende: 'Composition des rôles, des permissions et des entreprises couvertes…',
    Icone: ShieldCheck,
  },
]

export default function AdminsLoadingScreen({ darkMode = true, onSkip }) {
  const [lecture, setLecture] = useState(0)
  const [progression, setProgression] = useState(12)

  useEffect(() => {
    const pas = window.setInterval(() => {
      setLecture((precedent) => (precedent === 0 ? 1 : 0))
    }, 2400)
    const barre = window.setInterval(() => {
      setProgression((precedent) => (precedent >= 94 ? 16 : precedent + 5))
    }, 280)
    return () => {
      window.clearInterval(pas)
      window.clearInterval(barre)
    }
  }, [])

  const courante = LECTURES[lecture]
  const IconeCourante = courante.Icone

  return (
    <div
      className="aa-loading"
      data-theme={darkMode ? 'dark' : 'light'}
      role="status"
      aria-live="polite"
      aria-busy="true"
      aria-label="Chargement des comptes et des accès"
    >
      <CulturalCornerMotifSvg className="aa-loading-corner is-top-left" />
      <CulturalCornerMotifSvg className="aa-loading-corner is-top-right" />
      <CulturalCornerMotifSvg className="aa-loading-corner is-bottom-left" />
      <CulturalCornerMotifSvg className="aa-loading-corner is-bottom-right" />

      <div className="aa-loading-inner">
        <div className="aa-loading-brand">
          <EnCheckBrandMark size={52} loading />
          <div className="aa-loading-brand-copy">
            <strong>En-Check</strong>
            <span>On gère !</span>
          </div>
        </div>

        <div className="aa-loading-bande">
          <PageCulturalBand pathname="/admins" placement="loading" />
        </div>

        <h1 className="aa-loading-titre">Chargement des comptes et des accès…</h1>

        {/* La case : un montage ivoire, un trait d'encre, la caméra qui bouge */}
        <figure className="aa-loading-case" data-lecture={courante.cle}>
          <div className="aa-loading-scene">
            <img
              src="/images/admins-loading-fa.jpg"
              alt="Cauris jetés sur le plateau de divination du Fa"
              loading="eager"
              decoding="async"
            />
          </div>
          <figcaption className="aa-loading-cartouche">
            <span>
              <IconeCourante size={13} strokeWidth={2.2} />
              {courante.cartouche}
            </span>
            <span className="aa-loading-cartouche-point" aria-hidden="true" />
          </figcaption>
        </figure>

        <div className="aa-loading-etapes">
          {LECTURES.map((temps, index) => {
            const Icone = temps.Icone
            return (
              <button
                key={temps.cle}
                type="button"
                className={`aa-loading-etape${index === lecture ? ' is-active' : ''}`}
                aria-pressed={index === lecture}
                onClick={() => setLecture(index)}
              >
                <span>{temps.cartouche.replace('Étape ', '')}</span>
                <Icone size={14} />
              </button>
            )
          })}
        </div>

        <div className="aa-loading-barre" aria-hidden="true">
          <div className="aa-loading-barre-remplissage" style={{ width: `${progression}%` }} />
        </div>

        <div className="aa-loading-pied">
          <p className="aa-loading-sous-titre">{courante.legende}</p>
          {onSkip && (
            <button type="button" className="aa-loading-passer" onClick={onSkip}>
              Passer l’animation
              <ArrowRight size={13} />
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
