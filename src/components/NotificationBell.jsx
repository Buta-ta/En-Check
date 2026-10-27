// ═══════════════════════════════════════════════════════════
// LA CLOCHE — chaque notification porte l'icône de sa page
//
// Refonte : plus un seul style en ligne, plus une seule couleur
// sombre en dur. Le panneau suit le thème de la page, et le
// médaillon d'une notification reprend l'icône de la barre
// latérale : une sortie manquante montre l'horloge de Pointages,
// une demande de congé le calendrier d'Absences. La puce nomme la
// page pour qu'on sache où le clic mène avant de cliquer.
// ═══════════════════════════════════════════════════════════

import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  AlertTriangle, Bell, Building2, CalendarDays, CalendarOff, Check,
  CheckCheck, ChevronRight, Clock, Coffee, FileText, MapPin, Megaphone,
  ScanFace, ShieldCheck, Sparkles, Timer, TrendingUp, Users, Wallet, X,
} from 'lucide-react'
import './NotificationBell.css'

// La page visée par une notification, avec SON icône et SON nom.
const PAGES = {
  '/dashboard': { libelle: 'Vue d’ensemble', Icone: Bell },
  '/pointages': { libelle: 'Pointages', Icone: Clock },
  '/retards': { libelle: 'Retards', Icone: Timer },
  '/pauses': { libelle: 'Pauses', Icone: Coffee },
  '/absences': { libelle: 'Absences', Icone: CalendarOff },
  '/planning': { libelle: 'Planning', Icone: CalendarDays },
  '/employes': { libelle: 'Équipe', Icone: Users },
  '/jours-feries': { libelle: 'Jours fériés', Icone: CalendarDays },
  '/heures-supplementaires': { libelle: 'Heures supplémentaires', Icone: Clock },
  '/rapports': { libelle: 'Rapports', Icone: FileText },
  '/paie': { libelle: 'Paie & fiscalité', Icone: ShieldCheck },
  '/remunerations': { libelle: 'Rémunérations', Icone: Wallet },
  '/prospection': { libelle: 'Prospection', Icone: TrendingUp },
  '/entreprises': { libelle: 'Entreprises', Icone: Building2 },
  '/admins': { libelle: 'Administrateurs', Icone: ShieldCheck },
  '/system-messages': { libelle: 'Messages système', Icone: Megaphone },
  '/analytics': { libelle: 'Analytics du site', Icone: TrendingUp },
  '/geopointage': { libelle: 'Géopointage', Icone: MapPin },
  '/reconnaissance-faciale': { libelle: 'Reconnaissance faciale', Icone: ScanFace },
  '/predictions': { libelle: 'Prédictions', Icone: Sparkles },
  '/configuration-pointeuse': { libelle: 'Configuration pointeuse', Icone: ScanFace },
}

// Les anciennes notifications ne portent qu'une clé d'icône : on la garde
// comme secours, mais la page reste la source de vérité.
const ICONES_DE_SECOURS = {
  shield: ShieldCheck,
  alert: AlertTriangle,
  clock: Clock,
  calendar: CalendarDays,
  calendarOff: CalendarOff,
  trending: TrendingUp,
  file: FileText,
  scan: ScanFace,
  megaphone: Megaphone,
}

const CATEGORIES = {
  all: 'Tout',
  pointages: 'Pointages',
  planning: 'Planning',
  rh: 'RH',
  commercial: 'Commercial',
  system: 'Système',
}

function instantPresent() {
  return Date.now()
}

function cheminSeul(chemin) {
  return String(chemin || '').split('?')[0].split('#')[0]
}

/** La page d'une notification : son nom, son icône, sa teinte. */
function pageDeNotification(notification) {
  const chemin = cheminSeul(notification?.path)
  const page = PAGES[chemin]
  return {
    chemin: page ? chemin : null,
    libelle: page?.libelle || null,
    Icone: page?.Icone || ICONES_DE_SECOURS[notification?.icon] || Bell,
  }
}

export default function NotificationBell({
  notifications = [],
  unreadCount = 0,
  hasHighPriority = false,
  markAsRead,
  markAllAsRead,
  onNavigate,
}) {
  const [ouvert, setOuvert] = useState(false)
  const [categorieActive, setCategorieActive] = useState('all')
  const [detailOuvert, setDetailOuvert] = useState(false)
  const [selection, setSelection] = useState(null)
  const panneauRef = useRef(null)
  const clocheRef = useRef(null)
  const navigate = useNavigate()

  const urgente = hasHighPriority || unreadCount >= 3

  useEffect(() => {
    if (!ouvert) return undefined
    const surClic = (evenement) => {
      if (panneauRef.current && !panneauRef.current.contains(evenement.target)
        && clocheRef.current && !clocheRef.current.contains(evenement.target)) {
        setOuvert(false)
      }
    }
    const surTouche = (evenement) => { if (evenement.key === 'Escape') setOuvert(false) }
    document.addEventListener('mousedown', surClic)
    document.addEventListener('keydown', surTouche)
    return () => {
      document.removeEventListener('mousedown', surClic)
      document.removeEventListener('keydown', surTouche)
    }
  }, [ouvert])

  const filtrees = categorieActive === 'all'
    ? notifications
    : notifications.filter((notification) => notification.category === categorieActive)

  const compteurs = notifications.reduce((accumulateur, notification) => {
    if (!notification.read) {
      accumulateur[notification.category] = (accumulateur[notification.category] || 0) + 1
    }
    return accumulateur
  }, {})

  const ouvrirNotification = (notification) => {
    if (markAsRead) markAsRead(notification.key)
    if (notification.category === 'assiduite') {
      setSelection(notification)
      setDetailOuvert(true)
      return
    }
    setOuvert(false)
    if (notification.path) {
      if (onNavigate) onNavigate()
      navigate(notification.path)
    }
  }

  const quitterLeDetailVers = (notification) => {
    setDetailOuvert(false)
    if (!notification?.path) return
    setOuvert(false)
    if (onNavigate) onNavigate()
    navigate(notification.path)
  }

  const temps = (horodatage) => {
    if (!horodatage) return ''
    const date = new Date(horodatage)
    const minutes = Math.floor((instantPresent() - date.getTime()) / 60000)
    if (minutes < 1) return 'à l’instant'
    if (minutes < 60) return `il y a ${minutes} min`
    const heures = Math.floor(minutes / 60)
    if (heures < 24) return `il y a ${heures} h`
    return date.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' })
  }

  return (
    <div className="notification-bell">
      <button
        ref={clocheRef}
        type="button"
        className={`cloche-bouton${ouvert ? ' est-ouvert' : ''}${unreadCount > 0 ? ' a-des-non-lues' : ''}${urgente ? ' est-urgente' : ''}`}
        aria-label={unreadCount > 0 ? `Notifications, ${unreadCount} non lues` : 'Notifications'}
        aria-expanded={ouvert}
        aria-haspopup="dialog"
        onClick={() => setOuvert((valeur) => !valeur)}
      >
        <Bell size={20} aria-hidden="true" />
        {unreadCount > 0 && (
          <span className={`cloche-pastille${urgente ? ' est-urgente' : ''}`} aria-hidden="true">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {ouvert && (
        <div className="cloche-panneau" ref={panneauRef} role="dialog" aria-label="Notifications">
          <header className="cloche-tete">
            <span className="cloche-tete-icone" aria-hidden="true"><Bell size={17} /></span>
            <div className="cloche-tete-texte">
              <h2>Notifications</h2>
              <p>
                {unreadCount > 0
                  ? `${unreadCount} non lue${unreadCount > 1 ? 's' : ''}`
                  : 'Tout est lu'}
              </p>
            </div>
            <div className="cloche-tete-actions">
              {unreadCount > 0 && markAllAsRead && (
                <button type="button" className="cloche-tout-lu" onClick={markAllAsRead}>
                  <CheckCheck size={13} aria-hidden="true" />
                  <span>Tout lire</span>
                </button>
              )}
              <button type="button" className="cloche-fermer" onClick={() => setOuvert(false)} aria-label="Fermer les notifications">
                <X size={15} aria-hidden="true" />
              </button>
            </div>
          </header>

          <div className="cloche-onglets">
            {Object.entries(CATEGORIES).map(([cle, libelle]) => {
              const nombre = cle === 'all' ? unreadCount : (compteurs[cle] || 0)
              return (
                <button
                  key={cle}
                  type="button"
                  className={`cloche-onglet${categorieActive === cle ? ' est-actif' : ''}`}
                  aria-pressed={categorieActive === cle}
                  onClick={() => setCategorieActive(cle)}
                >
                  {libelle}
                  {nombre > 0 && <span className="cloche-onglet-nombre">{nombre}</span>}
                </button>
              )
            })}
          </div>

          <div className="cloche-liste">
            {filtrees.length === 0 ? (
              <div className="cloche-vide">
                <span className="cloche-vide-icone" aria-hidden="true"><Check size={24} /></span>
                <p>Aucune notification</p>
                <span>{categorieActive === 'all' ? 'Tout est en ordre.' : 'Dans cette catégorie.'}</span>
              </div>
            ) : (
              filtrees.map((notification) => {
                const { libelle, Icone } = pageDeNotification(notification)
                return (
                  <button
                    key={notification.key}
                    type="button"
                    className={`cloche-item${notification.read ? '' : ' est-non-lue'}`}
                    style={{ '--notif-teinte': notification.color || '#c1743c' }}
                    onClick={() => ouvrirNotification(notification)}
                  >
                    <span className="cloche-item-medaillon" aria-hidden="true"><Icone size={18} /></span>
                    <span className="cloche-item-corps">
                      <span className="cloche-item-titre">{notification.title}</span>
                      <span className="cloche-item-texte">{notification.subtitle}</span>
                      <span className="cloche-item-pied">
                        {libelle && (
                          <span className="cloche-page">
                            <span className="cloche-page-point" aria-hidden="true" />
                            {libelle}
                          </span>
                        )}
                        <span className="cloche-item-temps">{temps(notification.timestamp)}</span>
                      </span>
                    </span>
                    <ChevronRight size={15} className="cloche-item-chevron" aria-hidden="true" />
                  </button>
                )
              })
            )}
          </div>

          <footer className="cloche-pied">
            {notifications.length} notification{notifications.length > 1 ? 's' : ''}
            {notifications.length > 0 ? ' · actualisation auto' : ''}
          </footer>
        </div>
      )}

      {detailOuvert && selection && (
        <div
          className="cloche-voile"
          onMouseDown={(evenement) => { if (evenement.target === evenement.currentTarget) setDetailOuvert(false) }}
        >
          <div className="cloche-fenetre" role="dialog" aria-modal="true" aria-labelledby="cloche-detail-titre">
            <header className="cloche-fenetre-tete">
              <span className="cloche-fenetre-icone" aria-hidden="true">
                {(() => { const { Icone } = pageDeNotification(selection); return <Icone size={17} /> })()}
              </span>
              <div>
                <p className="cloche-eyebrow">Signal d’assiduité</p>
                <h2 id="cloche-detail-titre">Détail du signal</h2>
              </div>
              <button type="button" className="cloche-fermer" onClick={() => setDetailOuvert(false)} aria-label="Fermer le détail">
                <X size={15} aria-hidden="true" />
              </button>
            </header>
            <div className="cloche-fenetre-corps">
              <strong>{selection.title}</strong>
              <p>{selection.subtitle}</p>
            </div>
            <footer className="cloche-fenetre-pied">
              <button type="button" className="cloche-bouton-creux" onClick={() => setDetailOuvert(false)}>
                Fermer
              </button>
              {selection.path && (
                <button type="button" className="cloche-bouton-plein" onClick={() => quitterLeDetailVers(selection)}>
                  Ouvrir la page
                </button>
              )}
            </footer>
          </div>
        </div>
      )}
    </div>
  )
}
