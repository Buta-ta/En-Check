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

  return (
    <div className={`se${ouvert ? ' est-ouvert' : ''}${compact ? ' se--compact' : ''}`} ref={zone}>
      {/* ── la BANDE : le nom à la verticale, dans le rail ── */}
      <button
        type="button"
        className="se-bande"
        aria-haspopup="listbox"
        aria-expanded={ouvert}
        aria-label={`Entreprise active : ${nomAffiche}. Choisir une autre entreprise`}
        title={`Entreprise : ${nomAffiche}`}
        onClick={() => setOuvert((v) => !v)}
      >
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
              <span className="se-rond">{initiale(active.name)}</span>
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
              <span className="se-rond">{initiale(e.name)}</span>
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
