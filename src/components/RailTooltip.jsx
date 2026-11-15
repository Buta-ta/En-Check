import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'

// ═══════════════════════════════════════════════════════════
// Tooltip du mode rail — le libellé d'un élément réduit en
// icône, affiché à droite de la barre au survol ou au focus.
//
// Rendu dans un portail (position fixe) : la barre défile et
// masque tout ce qui déborde, alors que le tooltip doit vivre
// hors de la barre, au-dessus du contenu.
// ═══════════════════════════════════════════════════════════

export default function RailTooltip({ texte, actif, ancre }) {
  const [position, setPosition] = useState(null)

  useEffect(() => {
    if (!actif) {
      setPosition(null)
      return undefined
    }
    const mesurer = () => {
      const element = ancre.current
      if (!element) return
      const cadre = element.getBoundingClientRect()
      setPosition({ top: cadre.top + cadre.height / 2, left: cadre.right + 12 })
    }
    mesurer()
    // On capture scroll/resize : la position suit la barre
    // défilante et la fenêtre pendant que le libellé est visible.
    window.addEventListener('resize', mesurer)
    window.addEventListener('scroll', mesurer, true)
    return () => {
      window.removeEventListener('resize', mesurer)
      window.removeEventListener('scroll', mesurer, true)
    }
  }, [actif, ancre])

  if (!actif || !position) return null

  return createPortal(
    <span
      className="sn-rail-tooltip"
      role="tooltip"
      aria-hidden="true"
      style={{ top: position.top, left: position.left }}
    >
      {texte}
    </span>,
    document.body
  )
}
