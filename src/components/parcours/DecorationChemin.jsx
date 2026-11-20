// ═══════════════════════════════════════════════════════════
// 🌾 LES BORDS DU CHEMIN — herbes, touffes, arbustes
//
// Sa demande du 21/11 : « si tu peux mettre quelques herbes ou
// arbres sur le chemin c'est encore mieux ».
// Dessinés en SVG, nets à toute taille, aucun fichier.
// ═══════════════════════════════════════════════════════════

import useProximite from '../../hooks/useProximite'

const VERT = '#3F6B4C'

function Touffe({ variante = 0 }) {
  if (variante === 0) {
    return (
      <g fill="none" stroke={VERT} strokeWidth="1.6" strokeLinecap="round">
        <path d="M10 20 C10 12 8 7 4 3" />
        <path d="M10 20 C10 13 10 8 10 2" />
        <path d="M10 20 C11 13 13 8 16 4" />
      </g>
    )
  }
  if (variante === 1) {
    return (
      <g>
        <g fill="none" stroke={VERT} strokeWidth="1.5" strokeLinecap="round">
          <path d="M11 22 C11 15 9 10 5 6" />
          <path d="M11 22 C11 14 11 9 11 4" />
          <path d="M11 22 C12 15 14 10 17 6" />
        </g>
        <circle cx="5" cy="6" r="1.7" fill={VERT} />
        <circle cx="17" cy="6" r="1.7" fill={VERT} />
      </g>
    )
  }
  // un petit arbre
  return (
    <g>
      <rect x="12" y="16" width="2.4" height="14" rx="1" fill="#6B4A32" />
      <circle cx="13.2" cy="12" r="7.5" fill={VERT} opacity="0.9" />
      <circle cx="8" cy="15" r="4.6" fill={VERT} opacity="0.75" />
      <circle cx="18.4" cy="15" r="4.2" fill={VERT} opacity="0.75" />
    </g>
  )
}

/** posée le long du chemin ; `decalage` = écart au centre de la page, en px */
export default function DecorationChemin({ haut, decalage = 0, variante = 0, taille = 22 }) {
  // 🧲 l'herbe se penche quand le curseur passe à côté
  const { ref, actif } = useProximite()

  return (
    <span
      ref={ref}
      className={`empv3-herbe${actif ? ' est-proche' : ''}`}
      style={{
        top: `${haut}%`,
        left: `calc(50% + ${decalage}px)`,
        width: `${taille}px`,
      }}
      aria-hidden="true"
    >
      <svg viewBox="0 0 26 34" width={taille} height={taille * 1.3} focusable="false">
        <Touffe variante={variante} />
      </svg>
    </span>
  )
}
