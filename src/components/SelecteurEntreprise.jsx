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
// ═══════════════════════════════════════════════════════════

import { useEffect, useRef, useState } from 'react'
import { Check, ChevronDown, Globe } from 'lucide-react'

const initiale = (nom) => (nom || '?').trim().charAt(0).toUpperCase()

/**
 * La pastille d'une entreprise : sa PHOTO si elle en a une, sinon son
 * initiale. Sa demande du 24/11 : « affiche la photo de profil des
 * entreprises dans le selecteur ».
 * ⚠️ Si l'image ne charge pas (lien mort), on retombe sur l'initiale :
 * une pastille vide serait pire qu'une lettre.
 */
function PastilleEntreprise({ entreprise }) {
  const [cassee, setCassee] = useState(false)
  const photo = entreprise?.logo_url
  if (photo && !cassee) {
    return (
      <span className="se-rond se-rond--photo">
        <img
          src={photo}
          alt=""
          loading="lazy"
          onError={() => setCassee(true)}
        />
      </span>
    )
  }
  return <span className="se-rond">{initiale(entreprise?.name)}</span>
}

export default function SelecteurEntreprise({
  entreprises = [],
  active = null,
  multi = false,
  surChoix = () => {},
  compact = false,
}) {
  const [ouvert, setOuvert] = useState(false)
  const zone = useRef(null)

  // ⚠️ le clic dans le vide ferme la LISTE, et rien d'autre : la sidebar
  // ne doit pas se rabattre parce qu'on a fermé un menu. La sidebar a son
  // propre écouteur, qui ignore les clics à l'intérieur du rail.
  useEffect(() => {
    if (!ouvert) return undefined
    const dehors = (e) => {
      if (zone.current && !zone.current.contains(e.target)) setOuvert(false)
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
  const liste = entreprises.filter((e) => e && e.id && e.id !== active?.id)
  // ⚠️ ses mots : « les autres entreprises n'apparaîtront que si c'est le
  // superadmin ». Un admin simple ne doit pas voir une bande qui s'ouvre
  // sur une liste d'un seul élément : elle reste alors un simple titre.
  const peutChoisir = multi && (entreprises.length > 1 || Boolean(active))

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
          <span className="se-rond se-rond--bande">
            {active.logo_url
              ? <img src={active.logo_url} alt="" loading="lazy" />
              : initiale(active.name)}
          </span>
        )}
        <span className="se-bande-nom">{nomAffiche}</span>
        <ChevronDown size={13} aria-hidden="true" className="se-bande-chev" />
        {multi && entreprises.length > 1 && (
          <span className="se-bande-compte" aria-hidden="true">{entreprises.length}</span>
        )}
      </button>

      {/* ── la LISTE : elle sort du cadre, par-dessus la page ── */}
      {ouvert && (
        <div className="se-liste" role="listbox" aria-label="Entreprises">
          <p className="se-liste-titre">
            <span>Entreprise</span>
            <button type="button" className="se-fermer" onClick={() => setOuvert(false)} aria-label="Fermer la liste">
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

          {liste.map((e) => (
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
              <span className="se-rond se-rond--globe"><Globe size={14} aria-hidden="true" /></span>
              <span className="se-ligne-copy">
                <strong>Toutes les entreprises</strong>
                <em>Vue consolidée</em>
              </span>
            </button>
          )}
        </div>
      )}
    </div>
  )
}
