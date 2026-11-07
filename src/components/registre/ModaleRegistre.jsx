// ═══════════════════════════════════════════════════════════════
// LA FENÊTRE DU REGISTRE — une seule coque pour les modales
//
// Les fenêtres de la page Employés (accès au portail, envoi des
// horaires, badge) partagent la même écriture : du papier, deux
// filets, un titre serif, un pied discret. Cette coque ne porte que
// le cadre — le contenu vient de l'appelant.
//
// Elle tient trois promesses : Échap ferme, le clic sur le voile
// ferme, et le fond ne défile plus tant qu'elle est ouverte.
// ═══════════════════════════════════════════════════════════════

import { useEffect, useId } from 'react'
import { X } from 'lucide-react'
import './ModaleRegistre.css'

export default function ModaleRegistre({
  eyebrow,
  titre,
  sousTitre,
  onClose,
  children,
  pied,
  largeur = 460,
}) {
  const titreId = useId()

  useEffect(() => {
    const surTouche = (evenement) => {
      if (evenement.key === 'Escape') onClose?.()
    }
    const ancienDebordement = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    document.addEventListener('keydown', surTouche)
    return () => {
      document.removeEventListener('keydown', surTouche)
      document.body.style.overflow = ancienDebordement
    }
  }, [onClose])

  return (
    <div
      className="rgm-voile"
      role="presentation"
      onMouseDown={(evenement) => {
        if (evenement.target === evenement.currentTarget) onClose?.()
      }}
    >
      <div
        className="rgm-fenetre"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titreId}
        style={{ '--rgm-largeur': `${largeur}px` }}
      >
        <header className="rgm-entete">
          <div className="rgm-entete-texte">
            {eyebrow && <p className="rgm-eyebrow">{eyebrow}</p>}
            <h2 className="rgm-titre" id={titreId}>{titre}</h2>
            {sousTitre && <p className="rgm-sous-titre">{sousTitre}</p>}
          </div>
          <button type="button" className="rgm-fermer" onClick={onClose} aria-label="Fermer">
            <X size={15} />
          </button>
        </header>

        <div className="rgm-corps">{children}</div>

        {pied && <footer className="rgm-pied">{pied}</footer>}
      </div>
    </div>
  )
}
