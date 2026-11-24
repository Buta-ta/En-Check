// ═══════════════════════════════════════════════════════════════════════════
// 🗂️ LA TUILE D'ÉTAT — le papier scotché de la maquette B

// Ce qui a été repris de la maquette, TRAIT POUR TRAIT, après un premier essai
// raté (voir `identite/maquettes/section-tuiles-B.png`) :
//
//   1. LA BANDE DE SCOTCH, en haut, à cheval sur le bord.
//      Mon premier jet l'avait oubliée. C'est pourtant ce qui fait dire
//      « posé à la main » plutôt que « posé au gabarit ».
//
//   2. LE BORD BAS DÉCHIRÉ.
//      Mon premier jet avait des bords nets. Une feuille arrachée n'a pas de
//      bord droit : le sien ondule. Peint en `linear-gradient` répété, jamais
//      en `clip-path` (il rognerait l'ombre).
//
//   3. L'APPLIQUÉ BRODÉ, avec un MOTIF.
//      Mon premier jet posait un carré marron uni, illisible. La maquette
//      montre un vrai morceau de tissu, avec son motif et son surjet blanc.
//
//   4. LES CHIFFRES ESPACÉS.
//      « 2 / 2 » et « 0 · 0 », pas « 0/2 » collé et « 00 » soudés.
//
//   5. LA POLICE IBM PLEX SANS, y compris sur les chiffres.
//      Mon premier jet tombait sur la serif par défaut du navigateur.
// ═══════════════════════════════════════════════════════════════════════════
import './TuileEtat.css'

const TISSUS = ['indigo', 'ocre', 'brique']

/**
 * @param {string}  libelle   le libellé en capitales
 * @param {Array}   chiffres  [{ valeur, apres }] — « 2 / 2 », « 0 · 0 »
 * @param {string}  pied      UN mot facultatif sous le chiffre, jamais une phrase
 * @param {number}  jauge     0..1 — 8 tirets cousus, `null` pour rien
 * @param {string}  tissu     'indigo' | 'ocre' | 'brique'
 * @param {boolean} alerte    passe le chiffre en couleur d'alerte
 * @param {number}  rang      alterne l'inclinaison des papiers
 */
export default function TuileEtat({
  libelle,
  chiffres = [],
  pied,
  jauge = null,
  tissu = 'indigo',
  alerte = false,
  rang = 0,
}) {
  return (
    <article
      className={`tue tue--${TISSUS.includes(tissu) ? tissu : 'indigo'}${alerte ? ' tue--alerte' : ''}`}
      style={{ '--tue-inclinaison': rang % 2 === 0 ? '-0.5deg' : '0.45deg' }}
    >
      {/*  LA BANDE DE SCOTCH — à cheval sur le bord haut, légèrement de
          travers. Elle est peinte, pas dessinée : deux bords plus sombres et
          un cœur translucide, c'est ce qui distingue le Scotch du papier. */}
      <span className="tue-scotch" aria-hidden="true" />

      {/*  LE BORD DÉCHIRÉ — un liseré de la couleur du fond, qui ondule sur
          toute la largeur du bas. Il rogne 7 px du papier : la boîte de texte
          réserve déjà bien plus que ça. */}
      <span className="tue-dechire" aria-hidden="true" />

      {/*  LA DÉCOUPE DU COIN bas-droit : un triangle du fond de page, posé
          hors du contour pour rogner l'ombre avec le papier. */}
      <span className="tue-decoupe" aria-hidden="true" />

      {/*  L'APPLIQUÉ BRODÉ — un carré de tissu cousu, avec son surjet blanc,
          dans le coin haut droit. Il ne peut pas atteindre le texte : la boîte
          de texte réserve sa largeur exacte (voir `.tue-corps`). */}
      <span className="tue-applique" aria-hidden="true">
        <span className="tue-applique-motif" />
        <span className="tue-applique-surjet" />
      </span>

      <div className="tue-corps">
        <h3 className="tue-libelle">{libelle}</h3>

        {chiffres.length > 0 && (
          <p className="tue-chiffres">
            {chiffres.map((c, i) => (
              <span className="tue-chiffre-paquet" key={i}>
                <strong className="tue-chiffre">{c.valeur}</strong>
                {c.apres != null && <span className="tue-apres">{c.apres}</span>}
              </span>
            ))}
          </p>
        )}

        {jauge != null && (
          <span
            className="tue-jauge"
            role="img"
            aria-label={`${Math.round(jauge * 8)} places sur 8 utilisées`}
          >
            {Array.from({ length: 8 }, (_, i) => (
              <span
                key={i}
                className={`tue-point${i < Math.round(jauge * 8) ? ' est-prise' : ''}`}
              />
            ))}
          </span>
        )}

        {pied && <p className="tue-pied">{pied}</p>}
      </div>
    </article>
  )
}
