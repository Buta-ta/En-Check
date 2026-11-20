// ═══════════════════════════════════════════════════════════
// 🗂️ LE REGISTRE QUI SE FERME — le rabattement de la sidebar
//
// Son choix du 24/11, dans les cases : « C, le registre qui se ferme ».
// Le panneau ne rétrécit plus en fondu : il se comprime par PALIERS,
// comme un soufflet de registre, avec le contour qui reste net à chaque
// étape. C'est l'esprit mécanique de la charte poussé au bout.
//
// ⚠️ CE QUE ÇA DOIT RÉGLER : la transition de largeur habituelle écrase
// le texte pendant le trajet (les libellés se replient sur deux lignes).
// Ici, la largeur saute d'un palier à l'autre — 4 sauts nets — et le
// contenu est rogné, jamais comprimé.
//
// ⚠️ RESPECT : si le système demande de réduire les animations, on ferme
// d'un seul coup. Pas de paliers, pas de mouvement.
// ═══════════════════════════════════════════════════════════

import { useEffect, useRef, useState } from 'react'

const PALIERS = [100, 62, 30, 10, 0]   // en pourcentage de la largeur
const DUREE_PALIER = 46                 // ms entre deux paliers

export default function RegistreRepli({ ferme, largeur = 254, children, className = '' }) {
  const [etape, setEtape] = useState(ferme ? PALIERS.length - 1 : 0)
  const [animating, setAnimating] = useState(false)
  const precedent = useRef(ferme)
  const minuteries = useRef([])

  useEffect(() => {
    if (precedent.current === ferme) return
    precedent.current = ferme

    const reduire = typeof window !== 'undefined'
      && window.matchMedia
      && window.matchMedia('(prefers-reduced-motion: reduce)').matches

    // on nettoie une animation en cours
    minuteries.current.forEach(clearTimeout)
    minuteries.current = []

    if (reduire) {
      setEtape(ferme ? PALIERS.length - 1 : 0)
      return
    }

    setAnimating(true)
    // on descend ou on remonte les paliers, un par un
    const chemin = ferme
      ? [1, 2, 3, 4]
      : [3, 2, 1, 0]
    chemin.forEach((p, i) => {
      const t = setTimeout(() => {
        setEtape(p)
        if (i === chemin.length - 1) setAnimating(false)
      }, DUREE_PALIER * (i + 1))
      minuteries.current.push(t)
    })

    return () => {
      minuteries.current.forEach(clearTimeout)
    }
  }, [ferme])

  const pourcentage = PALIERS[etape]
  const largeurCourante = Math.round((largeur * pourcentage) / 100)

  // une bande de « pli » apparaît sur le bord droit, sauf quand c'est ouvert
  const pliVisible = etape > 0 && etape < PALIERS.length - 1

  return (
    <div
      className={`registre${animating ? ' registre--anime' : ''}${ferme ? ' registre--ferme' : ''} ${className}`.trim()}
      style={{
        '--registre-largeur': `${largeurCourante}px`,
        '--registre-palier': etape,
      }}
      aria-hidden={ferme ? 'true' : undefined}
    >
      {/* le contenu garde TOUJOURS sa largeur pleine : il est rogné, jamais
          comprimé. C'est ce qui garde les libellés nets. */}
      <div className="registre-contenu" style={{ width: `${largeur}px` }}>
        {children}
      </div>

      {pliVisible && (
        <span className="registre-pli" aria-hidden="true">
          {[0, 1, 2].map((i) => <i key={i} />)}
        </span>
      )}
    </div>
  )
}
