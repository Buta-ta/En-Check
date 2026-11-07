// ═══════════════════════════════════════════════════════════
// LA FENÊTRE — le même cadre pour toutes les décisions de la page
//
// Un seul dessin : le voile, la planche, l'en-tête, le corps, le
// pied. Échap ferme, le premier contrôle prend le focus, la page
// derrière ne défile plus. `taille="large"` élargit la planche pour
// le composeur de courriels.
// ═══════════════════════════════════════════════════════════

import { useEffect, useRef } from 'react'
import { X } from 'lucide-react'

export default function FenetreModale({
  eyebrow,
  titre,
  labelledBy,
  surFermer,
  pied,
  taille = 'normale',
  children,
}) {
  const panneau = useRef(null)

  useEffect(() => {
    const surTouche = (evenement) => { if (evenement.key === 'Escape') surFermer() }
    window.addEventListener('keydown', surTouche)
    const ancien = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', surTouche)
      document.body.style.overflow = ancien
    }
  }, [surFermer])

  useEffect(() => {
    const premier = panneau.current?.querySelector('button, input, select, textarea, [tabindex]')
    if (premier) premier.focus({ preventScroll: true })
  }, [])

  return (
    <div
      className="ms-voile"
      onMouseDown={(evenement) => { if (evenement.target === evenement.currentTarget) surFermer() }}
    >
      <div
        className="ms-fenetre"
        data-taille={taille}
        role="dialog"
        aria-modal="true"
        aria-labelledby={labelledBy}
        ref={panneau}
      >
        <header className="ms-fenetre-tete">
          <div>
            {eyebrow && <p className="ms-eyebrow">{eyebrow}</p>}
            <h2 className="ms-fenetre-titre" id={labelledBy}>{titre}</h2>
          </div>
          <button type="button" className="ms-fenetre-fermer" onClick={surFermer} aria-label="Fermer">
            <X size={15} />
          </button>
        </header>
        <div className="ms-fenetre-corps">{children}</div>
        {pied && <footer className="ms-fenetre-pied">{pied}</footer>}
      </div>
    </div>
  )
}
