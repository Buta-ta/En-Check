// ═══════════════════════════════════════════════════════════
// 🟤 LE CHARGEMENT DES RÉMUNÉRATIONS
//
// Une scène dessinée, pas une photo : la bande de craie est tendue et
// se remplit pan par pan depuis la gauche.
//
// Rien ne ment : aucun montant n'est touché pendant l'animation. En
// `prefers-reduced-motion`, la scène s'affiche terminée et fixe. Le
// bouton « Passer l'animation » fait comme sur les autres pages.
// ═══════════════════════════════════════════════════════════

import PageCulturalBand from './PageCulturalBand'
import EnCheckBrandMark from './EnCheckBrandMark'

const PANS = [0, 1, 2, 3, 4, 5]

export default function RemunerationsLoading({ darkMode = true, onSkip = null }) {
  return (
    <section
      className="rw-chargement"
      data-theme={darkMode ? 'dark' : 'light'}
      aria-busy="true"
      aria-label="Chargement des rémunérations"
    >
      <PageCulturalBand pathname="/remunerations" />

      <div className="rw-chargement-contenu">
        <EnCheckBrandMark size={54} />
        <span className="rw-chargement-eyebrow">Rémunérations</span>
        <h1>Chargement des rémunérations…</h1>
        <p role="status">Chargement des contrats et des montants déjà déclarés.</p>

        <div className="rw-tenture" aria-hidden="true">
          <svg viewBox="0 0 340 150" fill="none" focusable="false">
            <defs>
              <clipPath id="rw-pagne-clip">
                <rect x="20" y="34" width="300" height="76" rx="2" />
              </clipPath>
            </defs>

            {/* la bande de craie, tendue sur deux montants */}
            <rect x="20" y="34" width="300" height="76" rx="2" fill="#E4CC9C" />
            <rect x="20" y="34" width="300" height="76" rx="2" fill="none" stroke="#8B6A45" strokeWidth="1.2" strokeOpacity="0.55" />

            {/* la teinture qui se pose, pan par pan */}
            <g clipPath="url(#rw-pagne-clip)">
              {PANS.map((i) => (
                <g key={i} className={`rw-pan rw-pan-${i + 1}`}>
                  <rect x={20 + i * 50} y="34" width="46" height="76" fill="#2A1509" />
                  <path
                    d={`M${26 + i * 50} 46 l9 9 -9 9 9 9 -9 9`}
                    stroke="#E4CC9C"
                    strokeWidth="1.6"
                    strokeOpacity="0.75"
                    strokeLinecap="round"
                  />
                  <circle cx={47 + i * 50} cy="52" r="2" fill="#C4702F" />
                  <circle cx={47 + i * 50} cy="72" r="2" fill="#F0D8A8" fillOpacity="0.8" />
                  <circle cx={47 + i * 50} cy="92" r="2" fill="#C4702F" />
                </g>
              ))}
            </g>

            {/* le bâton de teinture, qui suit la teinture */}
            <g className="rw-baton">
              <rect x="0" y="26" width="7" height="92" rx="3.5" fill="#8B5A2B" />
              <rect x="-2" y="22" width="11" height="9" rx="2.5" fill="#B4622A" />
            </g>

            {/* les repères de trame */}
            <g className="rw-reperes" stroke="#8B6A45" strokeWidth="1" strokeOpacity="0.5">
              <path d="M20 120h300" />
              {PANS.map((i) => <path key={i} d={`M${46 + i * 50} 116v8`} />)}
            </g>
          </svg>
        </div>

        {onSkip && (
          <button type="button" className="rw-chargement-passer" onClick={onSkip}>
            Passer l’animation
          </button>
        )}

        <p className="rw-chargement-note">
          Une rémunération manquante compte zéro dans le coût salarial : c’est
          pour cela que rien n’est rempli à votre place.
        </p>
      </div>
    </section>
  )
}
