import { useEffect, useRef, useState } from 'react'
import {
  BadgeCheck, CalendarClock, Clock3, Key, Mail, MessageCircle, MoreVertical,
  Nfc, Share2, Trash2, UserCog,
} from 'lucide-react'

// ───────────────────────────────────────────────────────────
// 🪪 LA CARTE D'UN EMPLOYÉ
//
// L'annuaire ne se lit plus en lignes de tableau mais en cartes :
// un visage (les initiales), un nom, un poste, un contrat, deux
// moyens de le joindre, et son état du jour.
//
// Ce que la carte ne fait jamais :
//  · elle n'affiche pas un numéro ou un email vide — la ligne
//    disparaît, et si les deux manquent, un mot le dit ;
//  · elle ne peint pas un état sans le mot qui va avec (C7) ;
//  · elle ne cache pas les gestes secondaires : ils sont dans ⋮.
// ───────────────────────────────────────────────────────────

const initiales = (personne) =>
  `${personne?.first_name?.[0] || ''}${personne?.last_name?.[0] || ''}`.toUpperCase()

const nomComplet = (personne) =>
  [personne?.first_name, personne?.last_name].filter(Boolean).join(' ') || 'Sans nom'

const conceptDe = (presence, retardMinutes) => {
  if (presence === 'en_poste') return 'en_poste'
  if (presence === 'en_pause') return 'en_pause'
  if (presence === 'en_conge') return 'absent'
  if (presence === 'termine') return 'termine'
  if (retardMinutes != null) return 'retard'
  return 'non_pointe'
}

function heureDe(valeur) {
  if (!valeur) return null
  const date = new Date(valeur)
  if (Number.isNaN(date.getTime())) return String(valeur)
  return date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
}

export default function CarteEmploye({
  employee,
  liveStatus,
  contractLabel,
  portalEnabled,
  planningEnabled,
  aCompte,
  onOuvrirFiche,
  onOuvrirPage,
  onBadge,
  onHoraires,
  onPartagerHoraires,
  onPointages,
  onMotDePasse,
  onBasulerPortail,
  onSupprimer,
}) {
  const presence = liveStatus?.state || 'non_pointe'
  const retardMinutes = liveStatus?.retardMinutes ?? null
  const concept = conceptDe(presence, retardMinutes)
  const [menu, setMenu] = useState(false)
  const menuRef = useRef(null)

  // Le menu se referme dès qu’on clique ailleurs ou qu’on appuie sur Échap.
  useEffect(() => {
    if (!menu) return undefined
    const clic = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) setMenu(false)
    }
    const touche = (e) => { if (e.key === 'Escape') setMenu(false) }
    document.addEventListener('mousedown', clic)
    document.addEventListener('keydown', touche)
    return () => {
      document.removeEventListener('mousedown', clic)
      document.removeEventListener('keydown', touche)
    }
  }, [menu])

  const ouvrirFiche = () => (onOuvrirPage || onOuvrirFiche)(employee)

  const badgeMot = (() => {
    if (concept === 'en_poste') {
      return liveStatus?.entryHHMM ? `En poste · ${liveStatus.entryHHMM}` : 'En poste'
    }
    if (concept === 'en_pause') return 'En pause'
    if (concept === 'absent') return 'Absent'
    if (concept === 'termine') {
      const debut = heureDe(liveStatus?.entryTime) || liveStatus?.entryHHMM || null
      const fin = heureDe(liveStatus?.exitTime) || liveStatus?.exitHHMM || null
      return debut && fin ? `Terminé · ${debut} → ${fin}` : 'Terminé'
    }
    if (concept === 'retard') return `Retard · ${retardMinutes} min`
    return 'Non pointé'
  })()

  const classeStatut =
    concept === 'en_poste' ? 'ch-statut-present'
    : concept === 'en_pause' ? 'ch-statut-cours'
    : concept === 'absent' ? 'ch-statut-absent'
    : concept === 'retard' ? 'ch-statut-retard'
    : ''

  // Le badge tampon (contour 2 px) est réservé au statut figé du jour.
  const badgeForme = concept === 'termine' ? 'ch-badge-tampon' : 'ch-badge-pilule'

  const poste = [employee.position, employee.department].filter(Boolean).join(' · ')
  const telephone = employee.phone ? String(employee.phone).trim() : ''
  const courriel = employee.email ? String(employee.email).trim() : ''

  return (
    <article
      className="empv3-fiche"
      data-presence={concept}
      tabIndex={0}
      onClick={() => ouvrirFiche()}
      onKeyDown={(e) => { if (e.key === 'Enter') ouvrirFiche() }}
    >
      <header className="empv3-fiche-tete">
        <span className="empv3-fiche-avatar" aria-hidden="true">
          {employee.photo_url
            ? <img src={employee.photo_url} alt="" />
            : initiales(employee)}
          <i className={`empv3-fiche-pastille empv3-fiche-pastille--${concept}`} />
        </span>
        <span className="empv3-fiche-identite">
          <strong className="empv3-fiche-nom">{nomComplet(employee)}</strong>
          <span className="empv3-fiche-poste">
            {poste || 'Fiche à compléter : ni poste, ni service.'}
          </span>
        </span>
      </header>

      <span className="empv3-fiche-contrat">{contractLabel || 'contrat non renseigné'}</span>

      <div className="empv3-fiche-contacts">
        {telephone ? (
          <span className="empv3-fiche-contact">
            <MessageCircle size={13} aria-hidden="true" />
            <span>{telephone}</span>
          </span>
        ) : null}
        {courriel ? (
          <span className="empv3-fiche-contact">
            <Mail size={13} aria-hidden="true" />
            <span>{courriel}</span>
          </span>
        ) : null}
        {!telephone && !courriel ? (
          <span className="empv3-fiche-contact empv3-fiche-contact--vide">
            Aucun contact renseigné
          </span>
        ) : null}
      </div>

      <footer className="empv3-fiche-pied" onClick={(e) => e.stopPropagation()} onKeyDown={(e) => e.stopPropagation()}>
        <span className={`${badgeForme} ${classeStatut}`} data-concept={concept}>
          {badgeForme === 'ch-badge-pilule' && <i className="ch-badge-point" aria-hidden="true" />}
          {badgeMot}
        </span>

        <span className="empv2-ligne-menu-wrap" ref={menuRef}>
          <button
            type="button"
            className="empv2-ligne-menu"
            aria-label={`Autres actions pour ${nomComplet(employee)}`}
            aria-expanded={menu}
            onClick={() => setMenu((v) => !v)}
          >
            <MoreVertical size={14} />
          </button>
          {menu && (
            <span className="empv2-menu" role="group" aria-label={`Autres actions pour ${nomComplet(employee)}`}>
              <button type="button" onClick={() => { setMenu(false); onOuvrirFiche(employee) }}>
                <UserCog size={13} /> Modifier la fiche
              </button>
              <button type="button" onClick={() => { setMenu(false); onBadge(employee) }}>
                <BadgeCheck size={13} /> Badge QR
              </button>
              {planningEnabled && (
                <>
                  <button type="button" onClick={() => { setMenu(false); onHoraires(employee) }}>
                    <CalendarClock size={13} /> Horaires
                  </button>
                  <button type="button" onClick={() => { setMenu(false); onPartagerHoraires(employee) }}>
                    <Share2 size={13} /> Envoyer les horaires
                  </button>
                </>
              )}
              <button type="button" onClick={() => { setMenu(false); onPointages(employee) }}>
                <Clock3 size={13} /> Voir les pointages
              </button>
              {portalEnabled && (
                <button type="button" onClick={() => { setMenu(false); onMotDePasse(employee) }}>
                  <Key size={13} /> {aCompte ? 'Mot de passe' : 'Créer l’accès portail'}
                </button>
              )}
              {aCompte && (
                <button type="button" onClick={() => { setMenu(false); onBasulerPortail(employee, !portalEnabled) }}>
                  <Nfc size={13} /> {portalEnabled ? 'Fermer le portail' : 'Ouvrir le portail'}
                </button>
              )}
              <span className="empv2-menu-sep" aria-hidden="true" />
              <button type="button" data-danger="oui" onClick={() => { setMenu(false); onSupprimer(employee) }}>
                <Trash2 size={13} /> Supprimer la fiche
              </button>
            </span>
          )}
        </span>
      </footer>
    </article>
  )
}
