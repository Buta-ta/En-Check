// ═══════════════════════════════════════════════════════════
// 🏢 LE SÉLECTEUR D'ENTREPRISE — la bande qui sort du cadre
//
// Sa demande du 24/11, montrée sur sa maquette : « c'est comme ça que je
// le veux ». Le nom de l'entreprise s'écrit À LA VERTICALE dans le haut du
// rail, comme le dos d'un registre. On clique dessus : la liste des
// entreprises SORT DU CADRE et flotte sur la page. La navigation, elle,
// NE S'OUVRE PAS — c'est le point : changer d'entreprise n'est pas
// parcourir la navigation.
//
// ⚠️ Elle remplace EnterpriseSwitcher, qui n'était plus rendu nulle part
// depuis la refonte de la barre (PR #265) : le sélecteur avait disparu.
//
// ⚠️ Depuis le 08/12, « sortir du cadre » est pris au mot : la LISTE est
// portée dans `document.body` (commentaire sur `mesurer`, plus bas). Le
// dessin n'a pas bougé — c'est sa cage qui a changé.
// ═══════════════════════════════════════════════════════════

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Check, ChevronDown, Globe } from 'lucide-react'
import PhotoSignee from './PhotoSignee'

const initiale = (nom) => (nom || '?').trim().charAt(0).toUpperCase()

/** Le contenu seul : la photo, ou la lettre. On l'utilise dans le rond de
 * la liste ET dans celui de la bande, pour qu'ils se comportent pareil.
 *
 * ⚠️ Si l'image ne charge pas (lien mort), on retombe sur l'initiale :
 * une pastille vide serait pire qu'une lettre. Sa demande du 24/11 :
 * « affiche la photo de profil des entreprises dans le selecteur ».
 *
 * 26/11 — « dans la sidebar tu as oublié d'afficher l'image de profil de
 * l'entreprise ». Deux causes, et il fallait les deux :
 *   · la page ne DEMANDAIT PAS `logo_url` (voir Pauses.jsx) ;
 *   · la pastille lisait l'adresse brute, sans signature. Le logo est
 *     hébergé dans le bucket `photos` ; une adresse non signée n'y mène pas.
 * Elle passe donc par `PhotoSignee`, comme les avatars de personnes — même
 * découpe, même repli, même reprise si la photo rate. */
function PastilleInterne({ entreprise }) {
  const photo = entreprise?.logo_url
  if (photo) {
    return (
      <PhotoSignee
        url={photo}
        alt=""
        /* ni la taille ni le cadrage ne s'écrivent ici : un `objectFit` posé en
           inline ne se laisse commander par AUCUNE classe, et `cover` dans un rond
           de 30 px ne laissait d'une bannière 236 × 43 que cinq pixels de signe —
           « affiche l'image de l'entreprise ICI » (fondateur, 26/12). C'est
           `se-rond--logo`, dans la feuille de la barre, qui cadre : entier. */
        fallback={<span className="se-rond-initiale" aria-hidden="true">{initiale(entreprise?.name)}</span>}
      />
    )
  }
  return <>{initiale(entreprise?.name)}</>
}

function PastilleEntreprise({ entreprise }) {
  return (
    <span className="se-rond se-rond--photo se-rond--logo">
      <PastilleInterne entreprise={entreprise} />
    </span>
  )
}

export default function SelecteurEntreprise({
  entreprises = [],
  active = null,
  multi = false,
  surChoix = () => {},
  compact = false,
}) {
  const [ouvert, setOuvert] = useState(false)
  const [place, setPlace] = useState(null)
  const zone = useRef(null)
  const feuille = useRef(null)

  /* ⚠️ POURQUOI LA LISTE EST PORTÉE HORS DE LA BARRE, ET POSÉE À DES
     COORDONNÉES MESURÉES — la panne du 08/12/2026.
     « quand je clique sur l'entreprise, le panneau s'ouvre en dessous du bloc
     (le problème est le même que dans la page dashboard) ». La liste était un
     ENFANT du rail, en `position: absolute`, avec son `z-index: 80` écrit dans
     la feuille. Ce z-index ne pesait rien : la barre, posée dans une coque, est
     un CONTEXTE D'EMPILEMENT (`z-index` sur le `.sb` collant ; sur le tableau
     de bord, `isolation: isolate` et `overflow: hidden` sur
     `.dashboard-sidebar`), et un enfant ne dépasse jamais l'étage de son
     parent. Le bandeau du Planning, collant donc `z-index: 60`, peignait
     PAR-DESSUS : la feuille ne se voyait que là où elle ne croisait pas le
     bloc — c'est-à-dire en dessous. Et sur le dashboard, l'`overflow: hidden`
     la rognait en plus.
     Le remède n'est pas un z-index plus grand : cette course-là ne finit pas,
     et chaque page y mettrait le sien. La liste est donc rendue dans
     `document.body`, en `position: fixed`, aux coordonnées LUES sur la bande.
     Plus aucun ancêtre ne peut la coincer ni la couper, sur aucune page.
     Le dessin reste le dessin du 24/11 : la liste SORT À DROITE de la bande,
     elle flotte sur la page, la navigation ne s'ouvre pas. */
  const mesurer = useCallback(() => {
    const appui = zone.current
    const panneau = feuille.current
    if (!appui || !panneau || typeof window === 'undefined') return
    const bande = appui.getBoundingClientRect()
    const BORD = 8
    // le dessin écrit dans la feuille : `left: calc(50% + 26px)`, `top: -4px`
    let gauche = bande.left + bande.width / 2 + 26
    let haut = bande.top - 4
    // Jamais hors de l'écran : on ramène la feuille contre le bord. Et si la
    // hauteur manque au-dessous — le cas du téléphone, où la barre est une
    // rangée posée en bas — elle se cale contre le bas de l'écran au lieu de
    // déborder : c'est ce que faisait `bottom: calc(100% + 8px)`, mesuré.
    gauche = Math.min(
      Math.max(gauche, BORD),
      Math.max(BORD, window.innerWidth - panneau.offsetWidth - BORD)
    )
    if (haut + panneau.offsetHeight > window.innerHeight - BORD) {
      haut = Math.max(BORD, window.innerHeight - panneau.offsetHeight - BORD)
    }
    setPlace({ top: `${Math.round(haut)}px`, left: `${Math.round(gauche)}px` })
  }, [])

  // La page roule, la barre aussi (elle est collante) : la liste SUIT la bande,
  // elle ne reste pas clouée à l'endroit où on l'a ouverte.
  useEffect(() => {
    if (!ouvert) return undefined
    window.addEventListener('resize', mesurer)
    window.addEventListener('scroll', mesurer, true)
    return () => {
      window.removeEventListener('resize', mesurer)
      window.removeEventListener('scroll', mesurer, true)
    }
  }, [ouvert, mesurer])

  // Mesurée AVANT la peinture : sinon la liste passerait une frame en 0,0 —
  // un clignotement en haut à gauche de l'écran, à chaque clic.
  useLayoutEffect(() => {
    if (ouvert) mesurer()
  }, [ouvert, mesurer])

  // ⚠️ le clic dans le vide ferme la LISTE, et rien d'autre : la sidebar
  // ne doit pas se rabattre parce qu'on a fermé un menu. La sidebar a son
  // propre écouteur, qui ignore les clics à l'intérieur du rail.
  // Depuis que la liste vit hors du rail, elle a son propre périmètre : sans
  // la seconde vérification, la cliquer la referait AVANT que le choix parte,
  // et le geste ne passerait plus.
  useEffect(() => {
    if (!ouvert) return undefined
    const dehors = (e) => {
      const dansLaBande = zone.current && zone.current.contains(e.target)
      const dansLaListe = feuille.current && feuille.current.contains(e.target)
      if (!dansLaBande && !dansLaListe) setOuvert(false)
    }
    const echap = (e) => { if (e.key === 'Escape') setOuvert(false) }
    document.addEventListener('mousedown', dehors)
    document.addEventListener('keydown', echap)
    return () => {
      document.removeEventListener('mousedown', dehors)
      document.removeEventListener('keydown', echap)
    }
  }, [ouvert])

  const choisir = (entreprise) => {
    setOuvert(false)
    surChoix(entreprise)
  }

  const nomAffiche = active?.name || 'Toutes'
  const autres = entreprises.filter((e) => e && e.id && e.id !== active?.id)
  // ⚠️ ses mots : « les autres entreprises n'apparaîtront que si c'est le
  // superadmin ». Un admin simple ne doit pas voir une bande qui s'ouvre
  // sur une liste d'un seul élément : elle reste alors un simple titre.
  const peutChoisir = multi && (entreprises.length > 1 || Boolean(active))

  // Aucun corps de document (rendu hors navigateur) : la liste reste dans le
  // rail. Le dessin d'avant — dégradé, mais pas cassé.
  const hote = typeof document === 'undefined' ? null : document.body

  const liste = (
    <div
      ref={feuille}
      className="se-liste se-liste--flottante"
      // La géométrie vient du DOM mesuré, jamais d'un nombre recopié ici.
      // Avant la première mesure, la feuille est invisible.
      style={place ? { top: place.top, left: place.left } : { visibility: 'hidden' }}
      role="listbox"
      aria-label="Entreprises"
    >
      <p className="se-liste-titre">
        <span>Entreprise</span>
        <button
          type="button"
          className="se-fermer"
          onClick={() => setOuvert(false)}
          aria-label="Fermer la liste"
        >
          ×
        </button>
      </p>

      {/* l'entreprise active, avec sa coche */}
      {active && (
        <div className="se-ligne est-active" role="option" aria-selected="true">
          <PastilleEntreprise entreprise={active} />
          <span className="se-ligne-copy">
            <strong>{active.name}</strong>
            <em>{active.code || 'Entreprise active'}</em>
          </span>
          <Check size={15} aria-hidden="true" className="se-coche" />
        </div>
      )}

      {autres.map((e) => (
        <button
          key={e.id}
          type="button"
          className="se-ligne"
          role="option"
          aria-selected="false"
          onClick={() => choisir(e)}
        >
          <PastilleEntreprise entreprise={e} />
          <span className="se-ligne-copy">
            <strong>{e.name}</strong>
            <em>{e.code || 'Entreprise'}</em>
          </span>
        </button>
      ))}

      {/* le retour à la vue consolidée, pour un super-admin */}
      {multi && (
        <button
          type="button"
          className="se-ligne se-ligne--toutes"
          onClick={() => choisir(null)}
        >
          <span className="se-rond se-rond--globe">
            <Globe size={14} aria-hidden="true" />
          </span>
          <span className="se-ligne-copy">
            <strong>Toutes les entreprises</strong>
            <em>Vue consolidée</em>
          </span>
        </button>
      )}
    </div>
  )

  return (
    <div className={`se${ouvert ? ' est-ouvert' : ''}${compact ? ' se--compact' : ''}`} ref={zone}>
      {/* ── la BANDE : le nom à la verticale, dans le rail ── */}
      <button
        type="button"
        className="se-bande"
        aria-haspopup={peutChoisir ? 'listbox' : undefined}
        aria-expanded={peutChoisir ? ouvert : undefined}
        aria-label={peutChoisir
          ? `Entreprise active : ${nomAffiche}. Choisir une autre entreprise`
          : `Entreprise : ${nomAffiche}`}
        title={peutChoisir ? `Entreprise : ${nomAffiche}` : nomAffiche}
        onClick={() => { if (peutChoisir) setOuvert((v) => !v) }}
        disabled={!peutChoisir}
      >
        {active && (
          <span className="se-rond se-rond--bande se-rond--logo">
            <PastilleInterne entreprise={active} />
          </span>
        )}
        <span className="se-bande-nom">{nomAffiche}</span>
        <ChevronDown size={13} aria-hidden="true" className="se-bande-chev" />
        {multi && entreprises.length > 1 && (
          <span className="se-bande-compte" aria-hidden="true">{entreprises.length}</span>
        )}
      </button>

      {/* ── la LISTE : elle sort du cadre, par-dessus la page ── */}
      {ouvert && (hote ? createPortal(liste, hote) : liste)}
    </div>
  )
}
