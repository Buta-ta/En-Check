// ═══════════════════════════════════════════════════════════════════════════
// 📺 L'ÉCRAN D'APERÇU — une tablette posée sur la page
//
// Ce n'est pas un cadre décoratif. C'est `encheck_pauses_bandeau`… non : c'est
// le carrousel de la borne, montré tel que l'employé le verra. La tablette
// n'existe que pour donner l'échelle et le contexte : sans elle, on regarde
// une image ; avec elle, on regarde un écran qu'on va croiser au travail.
//
// POURQUOI UN COMPOSANT À PART
// ────────────────────────────────────────────────────────────────────────────
// Il est pur : on lui donne les médias et un index, il dessine. Pas de
// requête, pas d'effet, pas d'horloge. C'est ce qui permet de le rendre en
// statique dans les tests — et, vérifié à la main, de comparer son HTML à
// celui de la maquette.
//
// LA BANDE DE MOTIF
// ────────────────────────────────────────────────────────────────────────────
// Le dépôt a ses deux images de bogolan (`/images/paie-bogolan-haut.webp`,
// `/images/bogolan-vertical.webp`). On ne les dessine pas en SVG : la page
// Équipes a établi la technique, on la reprend — image native, jamais
// étirée, `repeat-x`.
// ═══════════════════════════════════════════════════════════════════════════
import { ChevronLeft, ChevronRight, Film, Image as ImageIcon } from 'lucide-react'
import './EcranApercu.css'

/**
 * @param {Array} medias      les annonces en ligne, telles que renvoyées par la base
 * @param {number} index      le média affiché
 * @param {boolean} vide      vrai si la liste est vide (photo par défaut, comme sur la borne)
 * @param {string} legende    ce que la borne affiche sous le média
 */
export default function EcranApercu ({
  medias = [],
  index = 0,
  vide = false,
  legende = 'Photo par défaut',
  onPrecedent,
  onSuivant,
}) {
  const courant = medias[Math.min(index, Math.max(0, medias.length - 1))] || null
  const plusieurs = medias.length > 1
  const Compteur = courant && courant.type === 'video' ? Film : ImageIcon

  return (
    <figure className="eap" aria-label="Aperçu du carrousel de la borne">
      {/* La plaque de titre, épinglée au-dessus de l'appareil. */}
      <figcaption className="eap-plaque">
        Aperçu — ce que voient les employés
      </figcaption>

      {/* ── L'appareil ──────────────────────────────────────────────────── */}
      <div className="eap-appareil">
        <span className="eap-camera" aria-hidden="true" />
        <span className="eap-touche eap-touche--vol" aria-hidden="true" />
        <span className="eap-touche eap-touche--power" aria-hidden="true" />

        <div className="eap-dalle">
          {/* l'en-tête de la borne : sa bande, son nom */}
          <div className="eap-entete">
            <span className="eap-bande" aria-hidden="true" />
            <span className="eap-marque">Pointage</span>
          </div>

          {/* le média */}
          <div className={`eap-scene${vide || !courant ? ' est-vide' : ''}`}>
            {vide || !courant ? (
              <div className="eap-defaut">
                <ImageIcon size={26} aria-hidden="true" />
                <span>Aucune annonce en ligne</span>
                <small>La borne affiche la photo par défaut.</small>
              </div>
            ) : courant.type === 'video' ? (
              <video
                className="eap-media"
                src={courant.url}
                autoPlay
                muted
                loop
                playsInline
              />
            ) : (
              <img className="eap-media" src={courant.url} alt="" />
            )}

            {/* la légende ne s'affiche pas sur une scène vide : il n'y a
                rien à légender, et un texte sur du vide fait du bruit */}
            {!vide && courant && <span className="eap-legende">{legende}</span>}
          </div>

          {/* les points + les flèches, sous la scène comme sur la borne */}
          <div className="eap-commandes">
            {plusieurs && (
              <button
                type="button"
                className="eap-fleche"
                onClick={onPrecedent}
                aria-label="Média précédent"
              >
                <ChevronLeft size={15} aria-hidden="true" />
              </button>
            )}

            {plusieurs && (
              <span className="eap-points" aria-hidden="true">
                {medias.map((m, i) => (
                  <span key={m.id || i} className={`eap-point${i === index ? ' est-actif' : ''}`} />
                ))}
              </span>
            )}

            {courant && (
              <span className="eap-type">
                <Compteur size={12} aria-hidden="true" />
                {medias.length > 1 ? `${index + 1} / ${medias.length}` : '1 / 1'}
              </span>
            )}

            {plusieurs && (
              <button
                type="button"
                className="eap-fleche"
                onClick={onSuivant}
                aria-label="Média suivant"
              >
                <ChevronRight size={15} aria-hidden="true" />
              </button>
            )}
          </div>
        </div>

        {/* le bouton d'accueil, sur la tranche basse */}
        <span className="eap-accueil" aria-hidden="true"><i /></span>
      </div>

      {/* le socle */}
      <span className="eap-socle" aria-hidden="true" />
    </figure>
  )
}
