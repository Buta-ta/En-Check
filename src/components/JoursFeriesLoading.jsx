// ═══════════════════════════════════════════════════════════
// 🧶 LE CHARGEMENT DES JOURS FÉRIÉS
//
// Une scène dessinée, pas une photo : le métier à tisser la couverture
// du Lesotho. La navette passe, la trame monte depuis le bas, et les
// losanges apparaissent un à un sur le champ de crème.
//
// Rien ne ment : aucune date n'est modifiée pendant l'animation, et
// le bouton « Passer l'animation » est là comme sur les autres pages.
// En `prefers-reduced-motion`, la scène s'affiche terminée et fixe.
// ═══════════════════════════════════════════════════════════

import PageCulturalBand from './PageCulturalBand'
import EnCheckBrandMark from './EnCheckBrandMark'

export default function JoursFeriesLoading({ darkMode = true, onSkip = null }) {
  return (
    <section
      className="jf-chargement"
      data-theme={darkMode ? 'dark' : 'light'}
      aria-busy="true"
      aria-label="Chargement des jours fériés"
    >
      <PageCulturalBand pathname="/jours-feries" />

      <div className="jf-chargement-contenu">
        <EnCheckBrandMark size={54} />
        <span className="jf-chargement-eyebrow">Le calendrier tissé</span>
        <h1>On dresse la trame de l’année…</h1>
        <p role="status">Chargement des jours fériés du pays et de ceux de votre entreprise.</p>

        <div className="jf-metier" aria-hidden="true">
          <svg viewBox="0 0 320 176" fill="none" focusable="false">
            <defs>
              <clipPath id="jf-tissu-clip">
                <rect x="52" y="66" width="216" height="86" rx="1" />
              </clipPath>
            </defs>

            {/* la chaîne : les fils tendus entre les deux montants */}
            <g className="jf-metier-chaine" stroke="#d8cbb2" strokeWidth="1" strokeOpacity="0.55">
              {Array.from({ length: 22 }, (_, i) => (
                <path key={i} d={`M${64 + i * 9} 30V152`} />
              ))}
            </g>

            {/* le tissu déjà fait, qui monte depuis le bas */}
            <g clipPath="url(#jf-tissu-clip)">
              <g className="jf-metier-trame">
                <rect x="52" y="66" width="216" height="86" fill="#efe7d7" />
                {/* les deux lisières indigo */}
                <rect x="52" y="66" width="216" height="14" fill="#14263c" />
                <rect x="52" y="138" width="216" height="14" fill="#14263c" />
                <g stroke="#efe7d7" strokeWidth="1" strokeOpacity="0.55">
                  <path d="M56 72l4 3-4 3M64 72l4 3-4 3M72 72l4 3-4 3M80 72l4 3-4 3M88 72l4 3-4 3M96 72l4 3-4 3M104 72l4 3-4 3M112 72l4 3-4 3M120 72l4 3-4 3M128 72l4 3-4 3M136 72l4 3-4 3M144 72l4 3-4 3M152 72l4 3-4 3M160 72l4 3-4 3M168 72l4 3-4 3M176 72l4 3-4 3M184 72l4 3-4 3M192 72l4 3-4 3M200 72l4 3-4 3M208 72l4 3-4 3M216 72l4 3-4 3M224 72l4 3-4 3M232 72l4 3-4 3M240 72l4 3-4 3M248 72l4 3-4 3M256 72l4 3-4 3" />
                  <path d="M56 144l4 3-4 3M64 144l4 3-4 3M72 144l4 3-4 3M80 144l4 3-4 3M88 144l4 3-4 3M96 144l4 3-4 3M104 144l4 3-4 3M112 144l4 3-4 3M120 144l4 3-4 3M128 144l4 3-4 3M136 144l4 3-4 3M144 144l4 3-4 3M152 144l4 3-4 3M160 144l4 3-4 3M168 144l4 3-4 3M176 144l4 3-4 3M184 144l4 3-4 3M192 144l4 3-4 3M200 144l4 3-4 3M208 144l4 3-4 3M216 144l4 3-4 3M224 144l4 3-4 3M232 144l4 3-4 3M240 144l4 3-4 3M248 144l4 3-4 3M256 144l4 3-4 3" />
                </g>
                {/* le liseré de terre cuite */}
                <rect x="52" y="84" width="216" height="3" fill="#8b3e1d" />
                <rect x="52" y="131" width="216" height="3" fill="#8b3e1d" />

                {/* les losanges brodés sur le champ */}
                <g className="jf-metier-losanges">
                  <path className="jf-losange jf-losange-1" d="M86 108 97 96l11 12-11 12Z" fill="#14263c" />
                  <path className="jf-losange jf-losange-2" d="M126 108 137 96l11 12-11 12Z" fill="#b4622a" />
                  <path className="jf-losange jf-losange-3" d="M166 108 177 96l11 12-11 12Z" fill="#14263c" />
                  <path className="jf-losange jf-losange-4" d="M206 108 217 96l11 12-11 12Z" fill="#b4622a" />
                  <path className="jf-losange jf-losange-5" d="M246 108 257 96l11 12-11 12Z" fill="#14263c" />
                </g>
              </g>
            </g>

            {/* le cadre du métier */}
            <path d="M44 24h232" stroke="#8b5a3c" strokeWidth="7" strokeLinecap="round" />
            <path d="M44 158h232" stroke="#8b5a3c" strokeWidth="7" strokeLinecap="round" />
            <path d="M52 24v134M268 24v134" stroke="#6b4830" strokeWidth="6" strokeLinecap="round" />

            {/* la navette qui passe la trame */}
            {/* la navette : elle glisse juste au-dessus du tissu, à la lisière */}
            <g className="jf-metier-navette">
              <path d="M0 0h34l-5 5 5 5H0l-5-5Z" fill="#b4622a" transform="translate(136 58)" />
              <path d="M166 63h-30" stroke="#b4622a" strokeWidth="1.2" strokeOpacity="0.55" />
            </g>
          </svg>
        </div>

        {onSkip && (
          <button type="button" className="jf-chargement-passer" onClick={onSkip}>
            Passer l’animation
          </button>
        )}

        <details className="jf-chargement-note">
          <summary>À propos de cette animation</summary>
          <p>
            Le temps de lire les jours fériés de votre entreprise. Aucune date n’est
            créée, modifiée ou supprimée pendant ce chargement.
          </p>
        </details>
      </div>

      <PageCulturalBand pathname="/jours-feries" placement="bottom" />
    </section>
  )
}
