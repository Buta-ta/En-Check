// ═══════════════════════════════════════════════════════════
// 🕗 LA BORNE DE POINTAGE — minuscule, posée sur le chemin
//
// Sa demande : « tu peux dessiner une borne de pointage », petite.
// Un écran, une empreinte digitale, une tige, un socle.
// Dessinée en SVG : nette à toute taille, aucun fichier.
// ═══════════════════════════════════════════════════════════

export default function BornePointage({ taille = 56, className = '' }) {
  return (
    <div className={`borne ${className}`.trim()} style={{ '--borne-taille': `${taille}px` }} aria-hidden="true">
      <svg viewBox="0 0 100 150" focusable="false">
        {/* l'écran */}
        <rect x="18" y="4" width="64" height="74" rx="8" fill="#FBF4E9" stroke="#2A1708" strokeWidth="4" />
        {/* l'empreinte digitale */}
        <g stroke="#A26537" strokeWidth="3.4" fill="none" strokeLinecap="round">
          <path d="M38 58 C38 44 44 36 50 36 C56 36 62 44 62 58" />
          <path d="M43 60 C43 49 46 43 50 43 C54 43 57 49 57 60" />
          <path d="M48 62 C48 55 49 51 50 51 C51 51 52 55 52 62" />
        </g>
        {/* la tige et le socle */}
        <rect x="46" y="78" width="8" height="52" fill="#2A1708" />
        <rect x="26" y="128" width="48" height="9" rx="4" fill="#2A1708" />
        <ellipse cx="50" cy="141" rx="34" ry="6" fill="#A26537" opacity="0.25" />
      </svg>
      <span className="borne-mot">Borne de pointage</span>
    </div>
  )
}
