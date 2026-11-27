// ═══════════════════════════════════════════════════════════
// 🟤 LE CHARGEMENT DES RÉMUNÉRATIONS
//
// Une scène dessinée, pas une photo : la bande de craie est tendue et
// se remplit pan par pan depuis la gauche.
//
// Rien ne ment : aucun montant n'est touché pendant l'animation. En
// `prefers-reduced-motion`, la scène s'affiche terminée et fixe. Le
// bouton « Passer l'animation » fait comme sur les autres pages.
//
// Huit novembre 2026 : la scène ne peint plus ses propres couleurs. Un
// écran de chargement à qui l'on demande « es-tu sombre ? » entretient un
// second thème — il regardait la bascule de la page pendant que le rail
// décidait pour tout le back-office. Les couleurs viennent donc des
// classes de la feuille, qui ne lisent que les jetons de `tokens.css`.
// Le modèle est `OvertimeLoadingScreen` : il ne prend ni thème, ni
// palette, juste ce qu'il faut pour s'effacer.
// ═══════════════════════════════════════════════════════════

import PageCulturalBand from './PageCulturalBand'
import EnCheckBrandMark from './EnCheckBrandMark'

const PANS = [0, 1, 2, 3, 4, 5]

export default function RemunerationsLoading({ onSkip = null }) {
  return (
    <section
      className="rw-chargement"
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
          <svg className="rw-scene" viewBox="0 0 340 150" focusable="false">
            <defs>
              <clipPath id="rw-pagne-clip">
                <rect x="20" y="34" width="300" height="76" rx="2" />
              </clipPath>
            </defs>

            {/* la bande de craie, tendue sur deux montants */}
            <rect className="rw-scene-bande" x="20" y="34" width="300" height="76" rx="2" />
            <rect className="rw-scene-cadre" x="20" y="34" width="300" height="76" rx="2" strokeWidth="1.2" />

            {/* la teinture qui se pose, pan par pan */}
            <g clipPath="url(#rw-pagne-clip)">
              {PANS.map((i) => (
                <g key={i} className={`rw-pan rw-pan-${i + 1}`}>
                  <rect className="rw-scene-pan" x={20 + i * 50} y="34" width="46" height="76" />
                  <path
                    className="rw-scene-sillage"
                    d={`M${26 + i * 50} 46 l9 9 -9 9 9 9 -9 9`}
                    strokeWidth="1.6"
                    strokeLinecap="round"
                  />
                  <circle className="rw-scene-point" cx={47 + i * 50} cy="52" r="2" />
                  <circle className="rw-scene-point-clair" cx={47 + i * 50} cy="72" r="2" />
                  <circle className="rw-scene-point" cx={47 + i * 50} cy="92" r="2" />
                </g>
              ))}
            </g>

            {/* le bâton de teinture, qui suit la teinture */}
            <g className="rw-baton">
              <rect className="rw-scene-baton" x="0" y="26" width="7" height="92" rx="3.5" />
              <rect className="rw-scene-baton-tete" x="-2" y="22" width="11" height="9" rx="2.5" />
            </g>

            {/* les repères de trame */}
            <g className="rw-scene-frise" strokeWidth="1">
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
