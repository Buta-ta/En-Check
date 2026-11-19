import { useEffect, useRef, useState } from 'react'
import {
  BadgeCheck, CalendarClock, Clock3, Hash, Key, Mail, MessageCircle, MoreVertical,
  Nfc, Phone, Plus, Share2, Trash2, UserCog,
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

// Un bouton « E-mail » doit ouvrir un vrai service de messagerie.
// Sur un ordinateur comme sur un téléphone, `mailto:` ouvre le client
// local — et sur beaucoup de postes, il n'y en a aucun : le clic ne fait
// rien. On propose donc Gmail et Outlook, qui marchent partout, dès que
// l'adresse n'est pas une adresse interne au portail.
const GMAIL = 'https://mail.google.com/mail/?view=cm&fs=1&tf=1'
const OUTLOOK = 'https://outlook.live.com/mail/0/deeplink/compose'

const estAdresseInterne = (adresse) => /@[^@]*\.local$/i.test(adresse || '')
  || /@espace\.encheck\./i.test(adresse || '')

const lienGmail = (adresse) =>
  `${GMAIL}&to=${encodeURIComponent(adresse)}`

const lienOutlook = (adresse) =>
  `${OUTLOOK}?to=${encodeURIComponent(adresse)}`

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
  const boutonRef = useRef(null)
  const [positionMenu, setPositionMenu] = useState(null)

  // Le menu sort de la carte : `position: fixed` calculé sur le bouton.
  // Sinon `overflow: hidden` le rogne et on ne voit rien — son symptôme
  // exact du 20/11 : « ça s'ouvre dans la carte, on ne voit rien ».
  const placerMenu = () => {
    const bouton = boutonRef.current
    if (!bouton) return
    const r = bouton.getBoundingClientRect()
    const largeur = 214

    // On ouvre TOUJOURS à côté du bouton qui l'a demandé.
    // Vers le haut si le bas de l'écran est trop court.
    const placeDessous = window.innerHeight - r.bottom > 330
    const top = placeDessous
      ? r.bottom + 6
      : Math.max(8, r.top - 6 - 300)

    setPositionMenu({
      top,
      left: Math.max(8, Math.min(window.innerWidth - largeur - 8, r.right - largeur)),
      largeur,
      dessous: placeDessous,
    })
  }

  // Un redimensionnement peut rendre la position fausse : on la revérifie.
  useEffect(() => {
    if (!menu) return undefined
    const recalculer = () => placerMenu()
    window.addEventListener('resize', recalculer)
    window.addEventListener('scroll', recalculer, true)
    return () => {
      window.removeEventListener('resize', recalculer)
      window.removeEventListener('scroll', recalculer, true)
    }
  }, [menu])

  const basculerMenu = () => {
    if (menu) { setMenu(false); return }
    placerMenu()
    setMenu(true)
  }

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
    if (concept === 'retard') {
      const total = Math.max(0, Math.round(Number(retardMinutes) || 0))
      const h = Math.floor(total / 60)
      const m = total % 60
      const duree = h === 0 ? `${m} min` : (m === 0 ? `${h} h` : `${h} h ${String(m).padStart(2, '0')}`)
      return `Retard · ${duree}`
    }
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

  const aUnePhoto = Boolean(employee.photo_url)

  return (
    <article
      className="empv3-fiche empv3-fiche--portrait empv3-pro"
      data-presence={concept}
      tabIndex={0}
      onClick={() => ouvrirFiche()}
      onKeyDown={(e) => { if (e.key === 'Enter') ouvrirFiche() }}
    >
      {/* ── LE PANNEAU BOGOLAN ──────────────────────────────
          Sa maquette du 20/11 : le motif est une COLONNE pleine à
          gauche, 78 px, sur toute la hauteur — la vraie image du
          dépôt, tournée verticalement. La photo est posée dessus.
          Le reste de la carte est du papier : rien derrière le
          texte, jamais. */}
      <div className="empv3-d">
        <aside className="empv3-d-panneau" aria-hidden="true">
          <span className="empv3-d-tissu" />
        </aside>

        {/* La photo est POSÉE sur le tissu, comme sur la maquette. Elle reste
            un bouton : hors de l'aside décoratif, elle garde son nom accessible. */}
        <button
          type="button"
          className={`empv3-d-avatar${aUnePhoto ? '' : ' empv3-d-avatar--vide'}`}
          aria-label={aUnePhoto
            ? `Changer la photo de ${nomComplet(employee)}`
            : `Ajouter une photo pour ${nomComplet(employee)}`}
          onClick={(e) => {
            e.stopPropagation()
            if (onOuvrirPage || onOuvrirFiche) (onOuvrirPage || onOuvrirFiche)(employee)
            else ouvrirFiche()
          }}
        >
          {aUnePhoto ? <img src={employee.photo_url} alt="" /> : <Plus size={20} aria-hidden="true" />}
        </button>

        <div className="empv3-d-corps">
          <header className="empv3-d-tete">
            <strong className="empv3-d-nom">{nomComplet(employee)}</strong>
            <span className="empv3-d-poste">
              {poste || 'Fiche à compléter : ni poste, ni service.'}
            </span>
          </header>

          <div className="empv3-d-etat">
            <span className={`${badgeForme} ${classeStatut}`} data-concept={concept}>
              {badgeForme === 'ch-badge-pilule' && <i className="ch-badge-point" aria-hidden="true" />}
              {badgeMot}
            </span>
          </div>

          <div className="empv3-d-chips">
            <span className="empv3-d-chip empv3-d-chip--contrat">
              {contractLabel || 'contrat à compléter'}
            </span>
            <span className={`empv3-d-chip${employee.matricule ? '' : ' empv3-d-chip--vide'}`}>
              {employee.matricule ? `# ${employee.matricule}` : 'matricule à compléter'}
            </span>
            <span className={`empv3-d-chip${employee.hire_date ? '' : ' empv3-d-chip--vide'}`}>
              {employee.hire_date ? `Depuis ${new Date(employee.hire_date).getFullYear()}` : 'depuis à compléter'}
            </span>
            <span className={`empv3-d-chip${aCompte ? ' empv3-d-chip--actif' : ''}`}>
              {aCompte ? 'Portail actif' : 'Sans compte'}
            </span>
          </div>

          <div className="empv3-d-contacts">
            {telephone ? (
              <a
                className="empv3-d-action empv3-d-action--appel"
                href={`tel:${String(telephone).replace(/[^\d+]/g, '')}`}
                onClick={(e) => e.stopPropagation()}
                aria-label={`Appeler ${nomComplet(employee)} au ${telephone}`}
              >
                <Phone size={13} aria-hidden="true" />
                Appeler
                <span className="empv3-d-action-tel">{telephone}</span>
              </a>
            ) : null}
            {telephone ? (
              <a
                className="empv3-d-action empv3-d-action--mail"
                href={`https://wa.me/${String(telephone).replace(/[^\d]/g, '')}`}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => e.stopPropagation()}
                aria-label={`Écrire sur WhatsApp à ${nomComplet(employee)}`}
              >
                <MessageCircle size={13} aria-hidden="true" />
                WhatsApp
              </a>
            ) : null}
            {courriel && !estAdresseInterne(courriel) ? (
              <>
                <a
                  className="empv3-d-action empv3-d-action--mail"
                  href={lienGmail(courriel)}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={(e) => e.stopPropagation()}
                  aria-label={`Écrire à ${nomComplet(employee)} depuis Gmail`}
                >
                  <Mail size={13} aria-hidden="true" />
                  Gmail
                </a>
                <a
                  className="empv3-d-action empv3-d-action--mail"
                  href={lienOutlook(courriel)}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={(e) => e.stopPropagation()}
                  aria-label={`Écrire à ${nomComplet(employee)} depuis Outlook`}
                >
                  <Mail size={13} aria-hidden="true" />
                  Outlook
                </a>
              </>
            ) : null}
            {/* une adresse interne au portail ne part pas : on le dit, sans bouton mort */}
            {courriel && estAdresseInterne(courriel) ? (
              <span className="empv3-d-contact--vide" title={courriel}>
                <Mail size={13} aria-hidden="true" />
                Adresse interne au portail
              </span>
            ) : null}
            {!telephone && !courriel ? (
              <span className="empv3-d-contact--vide">
                <Mail size={13} aria-hidden="true" />
                Aucun contact renseigné
              </span>
            ) : null}
          </div>
        </div>
      </div>

      <footer className="empv3-fiche-pied" onClick={(e) => e.stopPropagation()} onKeyDown={(e) => e.stopPropagation()}>
        <span className="empv3-fiche-pied-mot">Actions</span>

        <span className="empv2-ligne-menu-wrap" ref={menuRef}>
          <button
            type="button"
            className="empv2-ligne-menu"
            aria-label={`Autres actions pour ${nomComplet(employee)}`}
            aria-expanded={menu}
            ref={boutonRef}
            onClick={basculerMenu}
          >
            <MoreVertical size={14} />
          </button>
          {menu && (
            <span
              className="empv2-menu empv2-menu--flottant"
              role="group"
              aria-label={`Autres actions pour ${nomComplet(employee)}`}
              style={positionMenu ? {
                top: `${positionMenu.top}px`,
                left: `${positionMenu.left}px`,
                width: `${positionMenu.largeur}px`,
              } : undefined}
            >
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
