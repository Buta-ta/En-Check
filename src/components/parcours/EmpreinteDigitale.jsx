// ═══════════════════════════════════════════════════════════
// ☝️ L'EMPREINTE DIGITALE — une VRAIE image, pas un dessin
//
// Son verdict du 23/11 : « raté l'empreinte (utilise une image
// d'empreinte digitale sinon) ». Il a raison, et j'ai arrêté d'insister :
// mes arcs étaient un arc-en-ciel, pas une empreinte.
//
// `public/images/empreinte-digitale.webp` est une empreinte réelle
// (crêtes, boucle centrale, dissymétrie), détourée et teintée au brun
// de la charte. Rien n'est dessiné ici.
// ═══════════════════════════════════════════════════════════

export default function EmpreinteDigitale({ className = '', alt = '' }) {
  return (
    <img
      className={className}
      src="/images/empreinte-digitale.webp"
      alt={alt}
      width={400}
      height={400}
      loading="lazy"
      decoding="async"
      aria-hidden={alt ? undefined : 'true'}
    />
  )
}
