// ═══════════════════════════════════════════════════════════
// 📇 L'ANNUAIRE — une carte par personne (refonte bento 17/11)
//
// La carte, sur une seule ligne, dans l'ordre de la maquette :
//   · la photo (ou les initiales), à gauche ;
//   · le badge d'état du jour (en poste, en pause, retard, absent) ;
//   · le nom en serif, le matricule · contrat, le poste · service ;
//   · le pied : le numéro pour la joindre, le statut du portail,
//     et « Fiche → ».
//
// Tout le reste vit dans le menu (⋮) : modifier, badge QR,
// horaires, pointages, portail, suppression.
//
// Aucune donnée n'est inventée : un champ absent disparaît,
// un pointage absent s'écrit « Non pointé ».
// ═══════════════════════════════════════════════════════════

import { useEffect, useRef, useState } from 'react'
import {
  BadgeCheck, CalendarClock, Clock3, Key, MoreVertical,
  Nfc, Phone, Share2, Trash2, UserCog,
} from 'lucide-react'

const initiales = (personne) =>
  `${personne?.first_name?.[0] || ''}${personne?.last_name?.[0] || ''}`.toUpperCase()

const nomComplet = (personne) =>
  [personne?.first_name, personne?.last_name].filter(Boolean).join(' ') || 'Sans nom'

// Le mot du badge, et sa couleur, selon ce que le jour a montré.
// L'absence déclarée du jour s'écrit « Absent » ; le retard est
// remplacé par « En poste » dès que la personne pointe.
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

export default function EntreeEmploye({
  employee,
  liveStatus,
  contractLabel,
  portalEnabled,
  planningEnabled,
  aCompte,
  ancienSysteme,
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
  const [menu, setMenu] = useState(false)
  const actionsRef = useRef(null)

  const presence = liveStatus?.state || 'non_pointe'
  const retardMinutes = liveStatus?.retardMinutes ?? null
  const concept = conceptDe(presence, retardMinutes)

  const badgeLibelle = (() => {
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

  // Le menu se referme dès qu'on clique ailleurs ou qu'on appuie
  // sur Échap : sinon il reste posé sur la carte suivante.
  useEffect(() => {
    if (!menu) return undefined
    const surPointeur = (evenement) => {
      if (!actionsRef.current?.contains(evenement.target)) setMenu(false)
    }
    const surTouche = (evenement) => {
      if (evenement.key === 'Escape') setMenu(false)
    }
    document.addEventListener('pointerdown', surPointeur)
    document.addEventListener('keydown', surTouche)
    return () => {
      document.removeEventListener('pointerdown', surPointeur)
      document.removeEventListener('keydown', surTouche)
    }
  }, [menu])

  const ouvrirFiche = () => (onOuvrirPage || onOuvrirFiche)(employee)

  const portailEtat = !aCompte
    ? 'aucun'
    : ancienSysteme ? 'migrer'
      : portalEnabled ? 'ouvert' : 'ferme'

  return (
    <article className="empv2-entree" data-presence={concept} data-menu={menu ? 'ouvert' : undefined}>
      <div className="empv2-entree-photo">
        {employee.photo_url
          ? <img src={employee.photo_url} alt="" />
          : <span className="empv2-entree-initiales" aria-hidden="true">{initiales(employee)}</span>}
      </div>

      <div className="empv2-entree-corps">
        <div className="empv2-entree-tete">
          <span className={`empv2-entree-badge empv2-entree-badge--${concept}`}>
            <i aria-hidden="true" />
            {badgeLibelle}
          </span>
          <div className="empv2-entree-menu-wrap" ref={actionsRef}>
            <button
              type="button"
              className="empv2-entree-plus"
              aria-label={`Autres actions pour ${nomComplet(employee)}`}
              aria-expanded={menu}
              aria-haspopup="true"
              onClick={() => setMenu((v) => !v)}
            >
              <MoreVertical size={14} />
            </button>

            {menu && (
              <div className="empv2-menu" role="group" aria-label={`Autres actions pour ${nomComplet(employee)}`}>
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
                <button type="button" className="is-danger" onClick={() => { setMenu(false); onSupprimer(employee) }}>
                  <Trash2 size={13} /> Supprimer la fiche
                </button>
              </div>
            )}
          </div>
        </div>

        <h4 className="empv2-entree-nom">
          <button type="button" onClick={ouvrirFiche} title="Ouvrir la fiche">{nomComplet(employee)}</button>
        </h4>
        <p className="empv2-entree-sous">
          {employee.matricule && <span className="empv2-entree-matricule">{employee.matricule}</span>}
          {contractLabel && <span>{contractLabel}</span>}
        </p>
        <p className="empv2-entree-poste">
          {[employee.position, employee.department].filter(Boolean).join(' · ')
            || 'Fiche à compléter : ni poste, ni service.'}
        </p>

        <div className="empv2-entree-pied">
          <span className="empv2-entree-contact">
            {employee.phone
              ? <><Phone size={12} aria-hidden="true" />{employee.phone}</>
              : <span className="empv2-muet">Sans numéro</span>}
          </span>
          <span className="empv2-entree-portail" data-etat={portailEtat}>
            {portailEtat === 'ouvert' ? 'Portail' : portailEtat === 'ferme' ? 'Portail fermé' : portailEtat === 'migrer' ? 'À migrer' : 'Sans compte'}
          </span>
          <button type="button" className="empv2-btn-fiche" onClick={ouvrirFiche}>
            Fiche →
          </button>
        </div>
      </div>

    </article>
  )
}
