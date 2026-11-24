// ═══════════════════════════════════════════════════════════════════════════
// 🗂️ LA TUILE D'ÉTAT — un morceau de papier, pas un rectangle

// Ce que la maquette B a établi, et que l'ancienne tuile ratait :
//
//   1. LE DÉCOR NE TOUCHE JAMAIS LE TEXTE.
//      L'ancienne tuile posait deux appliqués Abomey dans les coins — un en
//      haut à gauche, un en bas à droite — par-dessus le libellé « En ligne ».
//      Sur la capture du fondateur, le triangle bleu mange la moitié du E.
//      Ici, la seule pièce rapportée est un CARRÉ BRODÉ dans le coin haut
//      droit, et la boîte de texte a une marge à droite égale à sa largeur :
//      même si le carré grandit, il ne peut pas atteindre un mot.
//
//   2. UNE TUILE CONTIENT UN CHIFFRE ET UN LIBELLÉ, PAS UNE PHRASE.
//      D014, « Une tuile qui contient une phrase n'est plus une tuile : c'est
//      une carte mal réglée. » Les anciens pieds disaient « Photo par défaut
//      affichée », « Rien à venir, rien de périmé » : des phrases. Ici le pied
//      est UN MOT, et il est facultatif.
//
//   3. LE DOUBLE FEUTRE SE VOIT.
//      « Je veux voir ces formes là bien double feutrés » : contour 2 px, PLUS
//      un second trait à l'intérieur, PLUS l'ombre dure. Trois passes, zéro
//      flou. C'est la recette de `FicheEmployeModal.css` et d'`EquipesVue.css`,
//      reprise telle quelle — on n'invente pas une variante.
//
//   4. LE PAPIER EST ARRACHÉ, PAS COUPÉ.
//      Le bord bas est irrégulier : une suite de petits décalages verticaux
//      peinte en `linear-gradient`, pas un `clip-path` (il rognerait l'ombre,
//      et la règle du post-it l'interdit explicitement).
// ═══════════════════════════════════════════════════════════════════════════
import './TuileEtat.css'

// Les trois morceaux de textile : c'est l'ordre de lecture des tuiles, et il
// ne change pas — la première tuile parle de ce qui est en ligne.
const TISSUS = ['indigo', 'ocre', 'brique']

/**
 * @param {string}  libelle   le libellé en capitales, UNE ligne
 * @param {Array}   chiffres  [{ valeur, apres }] — « 2 / 2 », « 0 · 0 »
 * @param {string}  pied      UN mot facultatif sous le chiffre, jamais une phrase
 * @param {number}  jauge     0..1 — dessine 8 tirets cousus, `null` pour rien
 * @param {string}  tissu     'indigo' | 'ocre' | 'brique'
 * @param {boolean} alerte    passe le chiffre en couleur d'alerte
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
  const vide = chiffres.length === 0

  return (
    <article
      className={`tue tue--${TISSUS.includes(tissu) ? tissu : 'indigo'}${alerte ? ' tue--alerte' : ''}`}
      /* l'inclinaison alterne : c'est ce qui fait « posé à la main » plutôt
         que « posé au gabarit ». Deux valeurs, pas trois — au-delà, ça danse. */
      style={{ '--tue-inclinaison': rang % 2 === 0 ? '-0.6deg' : '0.5deg' }}
    >
      {/* la bande de colle : peinte par le CSS en haut du papier */}
      <span className="tue-colle" aria-hidden="true" />
      {/* la découpe du coin bas-droit, à la couleur du fond de page */}
      <span className="tue-decoupe" aria-hidden="true" />

      {/* LA PIÈCE RAPPORTÉE — le carré brodé, dans le coin haut droit.
          `aria-hidden` : c'est du textile, pas de l'information. */}
      <span className="tue-applique" aria-hidden="true">
        <span className="tue-applique-motif" />
      </span>

      <div className="tue-corps">
        <h3 className="tue-libelle">{libelle}</h3>

        {!vide && (
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
          /*  8 tirets cousus, pas une barre continue : la maquette montre des
              points de couture, et un tiret dit « une place » là où une barre
              dit « un pourcentage ». On peut les compter. */
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
