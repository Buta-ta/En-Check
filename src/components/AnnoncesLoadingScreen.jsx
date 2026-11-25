// ═══════════════════════════════════════════════════════════
// 📺 LE CHARGEMENT DES ANNONCES — la tablette sur la table
//
// Sa demande du 27/11 : « je veux une scène où on voit une tablette
// sur une table et dans la tablette défile les phrases "Pub",
// "Annonces etc". le tout dans le style brut adouci, double feutrée. »
//
// Maquette A retenue (`identite/maquettes/chargement-annonces-A.png`) :
// la tablette vue de dessus, posée sur le sable, entourée de ce qui
// traîne sur une table de travail — un crayon, un carnet, une tasse,
// trois post-it. Rien de décoratif : c'est ce qui donne l'échelle.
//
// TROIS RÈGLES DE LA MAISON, TENUES ICI
// ────────────────────────────────────────────────────────────────────────
// 1. LE DOUBLE FEUTRE. Deux traits d'encre de 2 px (celui de la coque,
//    celui de la dalle) et une ombre dure de 3 px, zéro flou (D-016).
//    Aucun dégradé, aucun `filter`, aucune ombre douce.
// 2. RIEN N'EST INVENTÉ SUR LES DONNÉES. Les mots qui défilent sont les
//    types de média que la page sait publier (Publicité, Annonce,
//    Promotion) — pas un titre d'annonce qu'on ferait semblant d'avoir
//    déjà lu. La légende sous la scène dit ce que la page fait vraiment.
// 3. LE MOUVEMENT S'ÉTEINT. Sous `prefers-reduced-motion`, la liste
//    s'immobilise sur ses trois mots : aucune information ne passe par
//    l'animation seule.
//
// Ce composant est PUR : pas de requête, pas d'horloge. La page décide
// quand il disparaît, et elle peut le faire disparaître plus tôt si
// l'administrateur clique « Passer ».
// ═══════════════════════════════════════════════════════════
import { useEffect, useRef } from 'react'
import { ArrowRight } from 'lucide-react'
import './AnnoncesLoadingScreen.css'

/*  LES MOTS QUI DÉFILENT.
    Trois, pas cinq. Ce sont les trois familles que le formulaire de la
    page propose (`typeMedia`), écrites en capitales comme sur la
    maquette. Le quatrième mot de la maquette — « OUVERTURE 5 H » —
    ressemblait à une annonce réelle : pendant un chargement, on ne
    montre pas un contenu qu'on n'a pas encore lu.
    ⚠ Le fichier n'exporte QUE le composant : un module qui exporte aussi
    des constantes casse le rafraîchissement à chaud (règle du dépôt,
    `react-refresh/only-export-components`). */
const MOTS_DEFILANTS = ['PUB', 'ANNONCES', 'PROMO']

export default function AnnoncesLoadingScreen({
  // Le thème de l'application. Le chargement vit sur le sable, comme la
  // page ; en sombre, il prend les jetons sombres de la charte.
  darkMode = false,
  // « Passer » : la page coupe la scène et montre ce qu'elle a déjà.
  onSkip = null,
  // La légende sous la scène. Réglable pour que la page dise ce qu'elle
  // charge à cet instant précis (comptes, entreprises, annonces).
  legende = 'Lecture des annonces et des médias de l’entreprise…',
  // Le nom de l'entreprise dès qu'il est connu : la scène le reprend.
  nomEntreprise = '',
}) {
  const racine = useRef(null)

  /*  Le focus va sur « Passer » à l'ouverture.
      Ce n'est pas une politesse : c'est le seul geste de la scène, et
      une scène plein écran qui capture le clavier sans offrir de sortie
      est un piège. On ne force pas non plus : `preventScroll` pour que
      la page ne saute pas sous la coque. */
  useEffect(() => {
    const bouton = racine.current?.querySelector('.anl-passer')
    if (bouton && typeof bouton.focus === 'function') {
      bouton.focus({ preventScroll: true })
    }
  }, [])

  return (
    <section
      ref={racine}
      className={`anl${darkMode ? ' anl--sombre' : ''}`}
      data-theme={darkMode ? 'dark' : 'light'}
      role="status"
      aria-live="polite"
      aria-busy="true"
      aria-label="Chargement des annonces d’accueil"
    >
      {/* ═══ LA TABLE ═══
          Une seule surface de sable, et les objets posés dessus. Rien
          n'est dans un cadre : la scène EST la page. */}
      {/*  TOUTE LA TABLE EST DÉCORATIVE.
          Les mots qui défilent répètent ce que la légende dit déjà, et un
          lecteur d'écran qui annoncerait « PUB ANNONCES PROMO » à chaque
          chargement serait du bruit. Un seul texte porte le sens : la
          légende, en bas, et elle est visible. */}
      <div className="anl-table" aria-hidden="true">
        {/* ── les objets de la table ──
            Ils ne disent rien que la légende ne dise déjà. Leur seule
            fonction est de donner l'échelle — un écran seul ne dit pas
            qu'il est une tablette. La table entière est `aria-hidden`. */}
        <div className="anl-traine">
          {/* le carnet ouvert, en haut à gauche */}
          <span className="anl-carnet">
            <span className="anl-carnet-ligne" />
            <span className="anl-carnet-ligne" />
            <span className="anl-carnet-ligne est-courte" />
          </span>
          {/* le crayon, posé en travers */}
          <span className="anl-crayon">
            <span className="anl-crayon-mine" />
          </span>
          {/* la tasse : le rond plein et l'anse */}
          <span className="anl-tasse">
            <span className="anl-tasse-anse" />
          </span>
          {/* trois post-it, deux tons */}
          <span className="anl-postit anl-postit--1" />
          <span className="anl-postit anl-postit--2" />
          <span className="anl-postit anl-postit--3" />
        </div>

        {/* ═══ LA TABLETTE ═══ */}
        <div className="anl-appareil">
          {/* la caméra et la touche : ce qui fait lire « tablette » */}
          <span className="anl-camera" />
          <span className="anl-touche" />

          {/* la dalle : c'est elle qui porte la liste. `overflow: hidden`
              appartient à la dalle — c'est ce qui coupe le mot qui sort
              par le bas, exactement comme sur la maquette. */}
          <div className="anl-dalle">
            <div className="anl-entete">
              <span className="anl-marque">
                {nomEntreprise ? `EN-CHECK · ${nomEntreprise}` : 'EN-CHECK'}
              </span>
              <span className="anl-charge">
                <span className="anl-charge-point" />
                En chargement
              </span>
            </div>

            {/* ═══ LA LISTE QUI DÉFILE ═══
                Deux copies de la même suite de mots : la seconde prend
                le relais quand la première est sortie. La boucle est
                alors sans couture — pas de saut au raccord. */}
            <div className="anl-registre">
              <span className="anl-file" aria-hidden="true">
                <span className="anl-pointille" />
              </span>
              <div className="anl-piste">
                <ul className="anl-mots">
                  {MOTS_DEFILANTS.map((mot, i) => (
                    <li
                      key={mot}
                      className={`anl-mot${i === 1 ? ' est-argile' : ''}`}
                      style={{ '--anl-rang': i }}
                    >
                      {mot}
                    </li>
                  ))}
                </ul>
                {/* la copie muette : elle assure la boucle, et ne se lit
                    pas deux fois (le premier `ul` porte déjà les mots
                    pour un lecteur d'écran éventuel — mais la scène
                    entière est décorative, la légende porte le sens). */}
                <ul className="anl-mots anl-mots--copie" aria-hidden="true">
                  {MOTS_DEFILANTS.map((mot, i) => (
                    <li
                      key={`${mot}-bis`}
                      className={`anl-mot${i === 1 ? ' est-argile' : ''}`}
                      style={{ '--anl-rang': i }}
                    >
                      {mot}
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            {/* la barre d'accueil de la tablette */}
            <span className="anl-accueil" />
          </div>
        </div>

        {/* l'ombre au sol, sous l'appareil : elle le pose sur la table.
            Une ombre dure, décalée, jamais floue (D-016). */}
        <span className="anl-sol" />
      </div>

      {/* ═══ CE QUE LA SCÈNE DIT ═══
          Hors de la tablette, en bas : la légende en clair, et le seul
          geste. Le texte reste lisible même si l'animation ne tourne
          pas (C7 : le mot est la donnée). */}
      <div className="anl-bas">
        <p className="anl-legende">
          <span className="anl-legende-point" aria-hidden="true" />
          {legende}
        </p>
        {onSkip ? (
          <button type="button" className="anl-passer" onClick={onSkip}>
            Passer l’animation
            <ArrowRight size={13} aria-hidden="true" />
          </button>
        ) : null}
      </div>
    </section>
  )
}
