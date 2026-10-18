// ═══════════════════════════════════════════════════════════
// 🌍 EN-CHECK — LANDING PAGE V5.1
// - Bouton de connexion ajouté (navbar + mobile)
// ═══════════════════════════════════════════════════════════

import { useEffect, useRef, useState } from 'react'
import { Play, LogIn, User } from 'lucide-react'
import EnCheckBrandMark from '../components/EnCheckBrandMark'
import { useNavigate } from 'react-router-dom'
import { analytics } from '../services/analyticsService'

const WHATSAPP_NUMBER = '2290151295927'
const PHONE_DISPLAY = '+2290151295927'
const EMAIL = 'en.check.contact@gmail.com'

const DEMO_VIDEO_EMBED_URL = ''

const openWhatsApp = (message = '') => {
  const ctaLabel = message
    ? message.substring(0, 60)
    : 'whatsapp_general'
  analytics.trackCTA(ctaLabel)

  const text = encodeURIComponent(
    message ||
      'Bonjour En-Check ! Je souhaite en savoir plus sur votre solution de pointage.'
  )
  window.open(`https://wa.me/${WHATSAPP_NUMBER}?text=${text}`, '_blank')
}

function useInView(threshold = 0.15) {
  const ref = useRef(null)
  const [inView, setInView] = useState(false)

  useEffect(() => {
    const obs = new IntersectionObserver(
      ([e]) => {
        if (e.isIntersecting) {
          setInView(true)
          obs.disconnect()
        }
      },
      { threshold }
    )
    if (ref.current) obs.observe(ref.current)
    return () => obs.disconnect()
  }, [threshold])

  return [ref, inView]
}

// ═══════════════════════════════════════════════════════════
// ICÔNES SVG
// ═══════════════════════════════════════════════════════════
const FacebookIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
    <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
  </svg>
)

const InstagramIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
    <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z" />
  </svg>
)

const TikTokIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
    <path d="M19.59 6.69a4.83 4.83 0 01-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 01-2.88 2.5 2.89 2.89 0 01-2.89-2.89 2.89 2.89 0 012.89-2.89c.28 0 .54.04.79.1V9.01a6.27 6.27 0 00-.79-.05 6.34 6.34 0 00-6.34 6.34 6.34 6.34 0 006.34 6.34 6.34 6.34 0 006.33-6.34V8.69a8.18 8.18 0 004.78 1.52V6.78a4.85 4.85 0 01-1.02-.09z" />
  </svg>
)

const TelegramIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
    <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z" />
  </svg>
)

const WhatsAppIcon = () => (
  <svg width="28" height="28" viewBox="0 0 24 24" fill="currentColor">
    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
  </svg>
)

const DownloadIcon = () => (
  <svg
    width="24"
    height="24"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2.5"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
    <polyline points="7 10 12 15 17 10" />
    <line x1="12" y1="15" x2="12" y2="3" />
  </svg>
)

const MobileIcon = () => (
  <svg
    width="18"
    height="18"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <rect x="5" y="2" width="14" height="20" rx="2" ry="2" />
    <line x1="12" y1="18" x2="12.01" y2="18" />
  </svg>
)

const DesktopIcon = () => (
  <svg
    width="18"
    height="18"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <rect x="2" y="3" width="20" height="14" rx="2" ry="2" />
    <line x1="8" y1="21" x2="16" y2="21" />
    <line x1="12" y1="17" x2="12" y2="21" />
  </svg>
)

// ═══════════════════════════════════════════════════════════
// DONNÉES
// ═══════════════════════════════════════════════════════════

const SOCIALS = [
  {
    name: 'Facebook',
    Icon: FacebookIcon,
    color: '#1877F2',
    bg: 'rgba(24,119,242,0.15)',
    href: 'https://www.facebook.com/profile.php?id=61574350441998',
  },
  {
    name: 'Instagram',
    Icon: InstagramIcon,
    color: '#E1306C',
    bg: 'rgba(225,48,108,0.15)',
    href: 'https://www.instagram.com/en.check/',
  },
  { name: 'TikTok', Icon: TikTokIcon, color: '#ffffff', bg: 'rgba(255,255,255,0.1)', href: '#' },
  { name: 'Telegram', Icon: TelegramIcon, color: '#2AABEE', bg: 'rgba(42,171,238,0.15)', href: '#' },
]

const FEATURES = [
  {
    icon: '📱',
    color: '#F59E0B',
    bg: 'rgba(245,158,11,0.12)',
    title: 'Pointage PIN & QR Code',
    desc: "Vos employés pointent en 3 secondes depuis n'importe quel téléphone. Pas d'application à installer.",
  },
  {
    icon: '👤',
    color: '#6366F1',
    bg: 'rgba(99,102,241,0.12)',
    title: 'Reconnaissance Faciale',
    desc: 'Pointage biométrique par visage. 100% sur-appareil. Anti-fraude. Mode tablette partagée inclus.',
    tag: 'NOUVEAU',
    tagColor: '#6366F1',
  },
  {
    icon: '📸',
    color: '#10B981',
    bg: 'rgba(16,185,129,0.12)',
    title: 'Photo de Pointage',
    desc: 'Une photo est prise automatiquement à chaque pointage. Fini les pointages frauduleux.',
  },
  {
    icon: '🌍',
    color: '#10B981',
    bg: 'rgba(16,185,129,0.12)',
    title: 'Geofencing GPS',
    desc: "Définissez des zones autorisées. Le pointage hors zone est bloqué ou signalé (configurable).",
    tag: 'NOUVEAU',
    tagColor: '#10B981',
  },
  {
    icon: '🗺️',
    color: '#F97316',
    bg: 'rgba(249,115,22,0.12)',
    title: 'Carte Temps Réel',
    desc: 'Visualisez en direct où pointent vos employés sur une carte interactive. Idéal pour le terrain.',
    tag: 'NOUVEAU',
    tagColor: '#F97316',
  },
  {
    icon: '🔔',
    color: '#8B5CF6',
    bg: 'rgba(139,92,246,0.12)',
    title: 'Notifications',
    desc: "Notifications à chaque pointage • Réception des fiches de paie dans l'espace employé • Notifications lors des demandes de congés.",
    tag: 'NOUVEAU',
    tagColor: '#8B5CF6',
  },
  {
    icon: '👥',
    color: '#EC4899',
    bg: 'rgba(236,72,153,0.12)',
    title: 'Gestion des tâches & des équipes',
    desc: "Création d'équipes, gestion des tâches, et prédictions de performance sur les tâches à accomplir.",
    tag: 'PREMIUM',
    tagColor: '#F59E0B',
  },
  {
    icon: '🎌',
    color: '#8B5CF6',
    bg: 'rgba(139,92,246,0.12)',
    title: 'Jours fériés',
    desc: 'Calendrier par pays. Activez/désactivez chaque férié. Impact automatique sur retards, absences et heures sup.',
    tag: 'GRATUIT',
    tagColor: '#10B981',
  },
  {
    icon: '💰',
    color: '#F59E0B',
    bg: 'rgba(245,158,11,0.12)',
    title: 'Fiches de paie',
    desc: "Générez des bulletins automatiquement depuis les pointages. PDF + publication dans l'espace employé.",
    tag: 'PREMIUM',
    tagColor: '#F59E0B',
  },
  {
    icon: '📅',
    color: '#A78BFA',
    bg: 'rgba(167,139,250,0.12)',
    title: 'Planning & horaires',
    desc: "Définissez les horaires, plannings et règles par site ou par employé.",
  },
  {
    icon: '⏰',
    color: '#EF4444',
    bg: 'rgba(239,68,68,0.12)',
    title: 'Retards & absences',
    desc: 'Suivi automatique des retards, gestion des congés et absences avec justificatifs.',
  },
  {
    icon: '📊',
    color: '#EC4899',
    bg: 'rgba(236,72,153,0.12)',
    title: 'Heures supplémentaires',
    desc: 'Calcul automatique des heures sup avec taux de majoration configurables.',
  },
  {
    icon: '🏢',
    color: '#F97316',
    bg: 'rgba(249,115,22,0.12)',
    title: 'Multi-sites',
    desc: 'Gérez plusieurs sites depuis un seul tableau de bord.',
  },
]

const STEPS = [
  { num: '01', color: '#F59E0B', title: 'Créez votre compte', desc: "Renseignez votre entreprise et vos employés. Import Excel possible.", icon: '🚀' },
  { num: '02', color: '#10B981', title: 'Configurez vos sites', desc: "Horaires, zones GPS, modules et règles. Simple et guidé.", icon: '⚙️' },
  { num: '03', color: '#6366F1', title: 'Vos équipes pointent', desc: 'PIN, QR Code, reconnaissance faciale, GPS… tout est prêt.', icon: '✅' },
]

const TEMOIGNAGES = [
  { nom: 'Amadou Diallo', poste: 'DRH', entreprise: 'Groupe Soleil Distribution', pays: '🇸🇳 Sénégal', texte: "En-Check a transformé notre gestion RH. On a réduit le temps de traitement des présences de 3 heures à 10 minutes par semaine.", initiales: 'AD', color: '#F59E0B' },
  { nom: 'Marie-Claire Mbeki', poste: 'Directrice Générale', entreprise: 'ConstructPro SARL', pays: '🇨🇬 Congo', texte: "Avec 4 chantiers simultanés, le geofencing nous permet de voir en temps réel si nos équipes sont sur place. Révolutionnaire.", initiales: 'MM', color: '#10B981' },
  { nom: 'Kofi Asante', poste: 'Responsable Admin', entreprise: 'BankFirst CI', pays: "🇨🇮 Côte d'Ivoire", texte: "La reconnaissance faciale a mis fin aux fraudes. Nos 200 employés pointent sur des tablettes partagées sans friction.", initiales: 'KA', color: '#6366F1' },
]

const PLANS = [
  {
    name: 'STARTER',
    icon: '⚡',
    color: '#10B981',
    border: 'rgba(16,185,129,0.3)',
    bg: 'rgba(16,185,129,0.06)',
    desc: 'Idéal pour les petites équipes',
    features: [
      '1 site', 
      'Jusqu\'à 20 employés', // ✅ Apostrophe échappée
      'Pointage PIN / QR Code', 
      'Tableau de bord', 
      'Jours fériés 🎌 inclus', 
      'Notifications de base 🔔'
    ],
    cta: 'Demander un devis',
    waMsg: 'Bonjour En-Check ! Je suis intéressé par la formule STARTER. Pouvez-vous me faire un devis ?',
  },
  {
    name: 'PRO',
    icon: '🔥',
    color: '#F59E0B',
    border: 'rgba(245,158,11,0.5)',
    bg: 'rgba(245,158,11,0.06)',
    desc: 'Pour les PME en croissance',
    popular: true,
    features: [
      'Jusqu\'à 5 sites', // ✅ Apostrophe échappée
      'Employés illimités', 
      'Photo de pointage', 
      'Geofencing GPS 🌍', 
      'Carte temps réel 🗺️', 
      'Notifications avancées 🔔', 
      'Fiches de paie 💰', 
      'Espace employé'
    ],
    cta: 'Demander un devis',
    waMsg: 'Bonjour En-Check ! Je suis intéressé par la formule PRO. Pouvez-vous me faire un devis personnalisé ?',
  },
  {
    name: 'ENTERPRISE',
    icon: '🏆',
    color: '#6366F1',
    border: 'rgba(99,102,241,0.3)',
    bg: 'rgba(99,102,241,0.06)',
    desc: 'Pour les grandes organisations',
    features: [
      'Sites illimités',
      'Employés illimités',
      'Reconnaissance faciale 👤',
      'Mode tablette partagée',
      'Geofencing + Carte live',
      'Notifications complètes 🔔',
      'Gestion des tâches & équipes 👥',
      'Prédictions performance 📊',
      'Fiches de paie avancées 💰',
      'Support prioritaire + SLA',
    ],
    cta: 'Nous contacter',
    waMsg: 'Bonjour En-Check ! Nous souhaitons discuter de la formule ENTERPRISE.',
  },
]

// ═══════════════════════════════════════════════════════════
// LOGO
// ═══════════════════════════════════════════════════════════
function Logo({ size = 32 }) {
  return <EnCheckBrandMark size={size} />
}

// ═══════════════════════════════════════════════════════════
// PWA INSTALL BUTTON
// ═══════════════════════════════════════════════════════════
function PWAInstallButton() {
  const [deferredPrompt, setDeferredPrompt] = useState(null)
  const [showButton, setShowButton] = useState(false)
  const [isMobile, setIsMobile] = useState(false)

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(/Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent))
    }
    checkMobile()

    const handler = (e) => {
      e.preventDefault()
      setDeferredPrompt(e)
      setShowButton(true)
    }

    window.addEventListener('beforeinstallprompt', handler)

    if (window.matchMedia('(display-mode: standalone)').matches) {
      setShowButton(false)
    }

    return () => window.removeEventListener('beforeinstallprompt', handler)
  }, [])

  const handleInstall = async () => {
    if (!deferredPrompt) return
    deferredPrompt.prompt()
    const { outcome } = await deferredPrompt.userChoice
    if (outcome === 'accepted') setShowButton(false)
    setDeferredPrompt(null)
  }

  if (!showButton) return null

  return (
    <div
      style={{
        position: 'fixed',
        bottom: isMobile ? 100 : 24,
        left: 24,
        zIndex: 9998,
        animation: 'slideInLeft 0.6s ease-out',
      }}
    >
      <div
        style={{
          background: 'linear-gradient(135deg, #6366F1 0%, #4F46E5 100%)',
          borderRadius: 16,
          padding: '16px 20px',
          boxShadow: '0 12px 40px rgba(99, 102, 241, 0.35), 0 0 0 1px rgba(99, 102, 241, 0.1)',
          maxWidth: 320,
          backdropFilter: 'blur(10px)',
          border: '1px solid rgba(255, 255, 255, 0.1)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14 }}>
          <div
            style={{
              width: 48,
              height: 48,
              borderRadius: 12,
              background: 'rgba(255, 255, 255, 0.15)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
              border: '1px solid rgba(255, 255, 255, 0.2)',
            }}
          >
            <Logo size={32} />
          </div>

          <div style={{ flex: 1 }}>
            <div style={{ color: '#FFF', fontWeight: 800, fontSize: 15, marginBottom: 4, letterSpacing: 0.3 }}>
              Installer En-Check
            </div>
            <div style={{ color: 'rgba(255, 255, 255, 0.85)', fontSize: 12, lineHeight: 1.5, marginBottom: 12 }}>
              Accédez rapidement à l'app depuis votre {isMobile ? "écran d'accueil" : 'bureau'}.
            </div>

            <div style={{ display: 'flex', gap: 8 }}>
              <button
                onClick={handleInstall}
                style={{
                  flex: 1,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 6,
                  background: '#FFF',
                  color: '#4F46E5',
                  border: 'none',
                  borderRadius: 10,
                  padding: '10px 14px',
                  fontWeight: 800,
                  fontSize: 13,
                  cursor: 'pointer',
                  fontFamily: 'inherit',
                }}
              >
                <DownloadIcon />
                Installer
              </button>

              <button
                onClick={() => setShowButton(false)}
                style={{
                  background: 'rgba(255, 255, 255, 0.15)',
                  color: '#FFF',
                  border: '1px solid rgba(255, 255, 255, 0.2)',
                  borderRadius: 10,
                  padding: '10px 14px',
                  fontWeight: 600,
                  fontSize: 13,
                  cursor: 'pointer',
                  fontFamily: 'inherit',
                }}
              >
                Plus tard
              </button>
            </div>

            <div style={{ marginTop: 10, display: 'flex', alignItems: 'center', gap: 8, color: 'rgba(255, 255, 255, 0.7)', fontSize: 11 }}>
              {isMobile ? <MobileIcon /> : <DesktopIcon />}
              <span>Compatible {isMobile ? 'Mobile' : 'Desktop'}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════
// NAVBAR (AVEC BOUTON CONNEXION)
// ═══════════════════════════════════════════════════════════
function Navbar({ activeSection }) {
  const navigate = useNavigate()
  const [scrolled, setScrolled] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 40)
    window.addEventListener('scroll', handleScroll, { passive: true })
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  const scrollTo = (id) => {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' })
    setMenuOpen(false)
  }

  const navLinks = [
    { id: 'features', label: 'Fonctionnalités' },
    { id: 'demo', label: 'Démo' },
    { id: 'how', label: 'Comment ça marche' },
    { id: 'pricing', label: 'Tarifs' },
    { id: 'contact', label: 'Contact' },
  ]

  return (
    <nav
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        zIndex: 1000,
        background: scrolled ? 'rgba(10,10,15,0.97)' : 'transparent',
        backdropFilter: scrolled ? 'blur(20px)' : 'none',
        borderBottom: scrolled ? '1px solid rgba(245,158,11,0.1)' : 'none',
        transition: 'all 0.3s ease',
      }}
    >
      <div
        style={{
          maxWidth: 1200,
          margin: '0 auto',
          padding: '0 24px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          height: 70,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }} onClick={() => scrollTo('hero')}>
          <Logo size={36} />
          <span style={{ color: '#FFF', fontWeight: 900, fontSize: 20, letterSpacing: 2 }}>EN-CHECK</span>
        </div>

       
<div className="nav-desktop" style={{ display: 'flex', gap: 32, alignItems: 'center' }}>
  {navLinks.map((link) => (
    <button
      key={link.id}
      onClick={() => scrollTo(link.id)}
      style={{
        background: 'none',
        border: 'none',
        color: activeSection === link.id ? '#F59E0B' : '#AAA',
        fontSize: 14,
        fontWeight: activeSection === link.id ? 700 : 500,
        cursor: 'pointer',
        fontFamily: 'inherit',
        transition: 'color 0.2s',
        borderBottom: `2px solid ${activeSection === link.id ? '#F59E0B' : 'transparent'}`,
        paddingBottom: 2,
      }}
    >
      {link.label}
    </button>
  ))}
  
  {/* ✅ NOUVEAU : Bouton Connexion Admin */}
  <button
    onClick={() => navigate('/login')}
    style={{
      display: 'flex',
      alignItems: 'center',
      gap: 8,
      background: 'rgba(99,102,241,0.12)',
      color: '#818CF8',
      border: '1px solid rgba(99,102,241,0.3)',
      borderRadius: 10,
      padding: '10px 18px',
      fontWeight: 700,
      fontSize: 14,
      cursor: 'pointer',
      fontFamily: 'inherit',
      transition: 'all 0.2s',
    }}
    onMouseEnter={(e) => {
      e.currentTarget.style.background = 'rgba(99,102,241,0.2)'
      e.currentTarget.style.borderColor = 'rgba(99,102,241,0.5)'
    }}
    onMouseLeave={(e) => {
      e.currentTarget.style.background = 'rgba(99,102,241,0.12)'
      e.currentTarget.style.borderColor = 'rgba(99,102,241,0.3)'
    }}
  >
    <LogIn size={16} />
    Admin
  </button>

  {/* ✅ NOUVEAU : Bouton Connexion Employé */}
  <button
    onClick={() => navigate('/employee/login')}
    style={{
      display: 'flex',
      alignItems: 'center',
      gap: 8,
      background: 'rgba(16,185,129,0.12)',
      color: '#10B981',
      border: '1px solid rgba(16,185,129,0.3)',
      borderRadius: 10,
      padding: '10px 18px',
      fontWeight: 700,
      fontSize: 14,
      cursor: 'pointer',
      fontFamily: 'inherit',
      transition: 'all 0.2s',
    }}
    onMouseEnter={(e) => {
      e.currentTarget.style.background = 'rgba(16,185,129,0.2)'
      e.currentTarget.style.borderColor = 'rgba(16,185,129,0.5)'
    }}
    onMouseLeave={(e) => {
      e.currentTarget.style.background = 'rgba(16,185,129,0.12)'
      e.currentTarget.style.borderColor = 'rgba(16,185,129,0.3)'
    }}
  >
    <User size={16} />
    Employé
  </button>
  
  <button
    onClick={() => openWhatsApp('Bonjour En-Check ! Je souhaite une démonstration gratuite.')}
    style={{
      background: 'linear-gradient(135deg,#F59E0B,#D97706)',
      color: '#000',
      border: 'none',
      borderRadius: 10,
      padding: '10px 20px',
      fontWeight: 700,
      fontSize: 14,
      cursor: 'pointer',
      fontFamily: 'inherit',
    }}
  >
    Démo gratuite
  </button>
</div>

        <button
          onClick={() => setMenuOpen(!menuOpen)}
          className="nav-mobile-btn"
          style={{
            background: 'rgba(255,255,255,0.06)',
            border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: 8,
            width: 40,
            height: 40,
            display: 'none',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#FFF',
            cursor: 'pointer',
            fontSize: 18,
          }}
        >
          {menuOpen ? '✕' : '☰'}
        </button>
      </div>

     {menuOpen && (
  <div
    style={{
      background: 'rgba(10,10,15,0.99)',
      borderTop: '1px solid rgba(255,255,255,0.06)',
      padding: '20px 24px',
      display: 'flex',
      flexDirection: 'column',
      gap: 4,
    }}
  >
    {navLinks.map((link) => (
      <button
        key={link.id}
        onClick={() => scrollTo(link.id)}
        style={{
          background: 'none',
          border: 'none',
          borderBottom: '1px solid rgba(255,255,255,0.06)',
          color: '#E5E5E5',
          fontSize: 16,
          fontWeight: 500,
          cursor: 'pointer',
          fontFamily: 'inherit',
          textAlign: 'left',
          padding: '14px 0',
        }}
      >
        {link.label}
      </button>
    ))}
    
    {/* ✅ NOUVEAU : Boutons de connexion en mobile */}
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 16 }}>
      <button
        onClick={() => {
          navigate('/login')
          setMenuOpen(false)
        }}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 10,
          background: 'rgba(99,102,241,0.15)',
          color: '#818CF8',
          border: '1px solid rgba(99,102,241,0.3)',
          borderRadius: 10,
          padding: '14px',
          fontWeight: 700,
          fontSize: 15,
          cursor: 'pointer',
          fontFamily: 'inherit',
        }}
      >
        <LogIn size={18} />
        Connexion Admin
      </button>

      <button
        onClick={() => {
          navigate('/employee/login')
          setMenuOpen(false)
        }}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 10,
          background: 'rgba(16,185,129,0.15)',
          color: '#10B981',
          border: '1px solid rgba(16,185,129,0.3)',
          borderRadius: 10,
          padding: '14px',
          fontWeight: 700,
          fontSize: 15,
          cursor: 'pointer',
          fontFamily: 'inherit',
        }}
      >
        <User size={18} />
        Connexion Employé
      </button>
    </div>
    
    <button
      onClick={() => {
        openWhatsApp('Bonjour En-Check ! Je souhaite une démonstration gratuite.')
        setMenuOpen(false)
      }}
      style={{
        marginTop: 4,
        background: 'linear-gradient(135deg,#F59E0B,#D97706)',
        color: '#000',
        border: 'none',
        borderRadius: 10,
        padding: '14px',
        fontWeight: 700,
        fontSize: 15,
        cursor: 'pointer',
        fontFamily: 'inherit',
      }}
    >
      Démo gratuite — WhatsApp
    </button>
  </div>
)}
    </nav>
  )
}

// ═══════════════════════════════════════════════════════════
// HERO
// ═══════════════════════════════════════════════════════════
function Hero() {
  const [ref, inView] = useInView(0.05)

  return (
    <section
      id="hero"
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        position: 'relative',
        overflow: 'hidden',
        paddingTop: 80,
        background:
          'radial-gradient(ellipse at 20% 50%, rgba(245,158,11,0.06) 0%, transparent 60%), radial-gradient(ellipse at 80% 30%, rgba(99,102,241,0.05) 0%, transparent 60%)',
      }}
    >
      <div
        ref={ref}
        style={{
          maxWidth: 1200,
          margin: '0 auto',
          padding: '60px 24px',
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: 60,
          alignItems: 'center',
          width: '100%',
        }}
      >
        <div style={{ opacity: inView ? 1 : 0, transform: inView ? 'none' : 'translateY(30px)', transition: 'all 0.7s ease' }}>
          <h1 style={{ color: '#FFF', fontSize: 'clamp(34px, 4.5vw, 58px)', fontWeight: 900, lineHeight: 1.1, margin: '0 0 24px 0' }}>
            Gérez la présence{' '}
            <span style={{ background: 'linear-gradient(135deg,#F59E0B,#FCD34D)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
              de vos équipes
            </span>{' '}
            sans paperasse.
          </h1>

          <p style={{ color: '#AAA', fontSize: 'clamp(15px, 1.8vw, 19px)', lineHeight: 1.7, margin: '0 0 28px 0' }}>
            PIN, QR Code, <strong style={{ color: '#6366F1' }}>reconnaissance faciale</strong>,{' '}
            <strong style={{ color: '#10B981' }}>géolocalisation</strong> et plus. En-Check digitalise votre pointage en moins de 24h.
          </p>

          <div style={{ display: 'flex', gap: 8, marginBottom: 28, flexWrap: 'wrap' }}>
            {[
              { icon: '👤', label: 'Reco Faciale', color: '#6366F1' },
              { icon: '🌍', label: 'Geofencing', color: '#10B981' },
              { icon: '🔔', label: 'Notifications', color: '#8B5CF6' },
              { icon: '👥', label: 'Tâches/Équipes', color: '#EC4899' },
              { icon: '💰', label: 'Fiches de paie', color: '#F59E0B' },
            ].map((b, i) => (
              <div key={i} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: `${b.color}15`, border: `1px solid ${b.color}35`, borderRadius: 999, padding: '6px 12px' }}>
                <span style={{ fontSize: 14 }}>{b.icon}</span>
                <span style={{ color: b.color, fontSize: 11, fontWeight: 800 }}>{b.label}</span>
              </div>
            ))}
          </div>

          <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap' }}>
            <button
              onClick={() => openWhatsApp('Bonjour En-Check ! Je souhaite une démonstration gratuite de votre solution.')}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                background: 'linear-gradient(135deg,#F59E0B,#D97706)',
                color: '#000',
                border: 'none',
                borderRadius: 14,
                padding: '15px 26px',
                fontWeight: 900,
                fontSize: 16,
                cursor: 'pointer',
                fontFamily: 'inherit',
                boxShadow: '0 8px 30px rgba(245,158,11,0.3)',
              }}
            >
              <WhatsAppIcon /> Demander une démo
            </button>

            <button
              onClick={() => document.getElementById('demo')?.scrollIntoView({ behavior: 'smooth' })}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                background: 'transparent',
                color: '#FFF',
                border: '1px solid rgba(255,255,255,0.2)',
                borderRadius: 14,
                padding: '15px 26px',
                fontWeight: 700,
                fontSize: 16,
                cursor: 'pointer',
                fontFamily: 'inherit',
              }}
            >
              <Play size={20} /> Voir la démo vidéo
            </button>
          </div>

          <div style={{ display: 'flex', gap: 36, marginTop: 44, flexWrap: 'wrap' }}>
            {[
              { value: '50+', label: 'entreprises' },
              { value: '2000+', label: 'employés gérés' },
              { value: '5 min', label: 'pour démarrer' },
            ].map((s, i) => (
              <div key={i}>
                <div style={{ color: '#F59E0B', fontSize: 26, fontWeight: 900 }}>{s.value}</div>
                <div style={{ color: '#888', fontSize: 12, textTransform: 'uppercase', letterSpacing: 1 }}>{s.label}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Mockup (léger) */}
        <div style={{ opacity: inView ? 1 : 0, transform: inView ? 'none' : 'translateY(30px)', transition: 'all 0.7s ease 0.15s' }}>
          <div style={{ background: 'rgba(20,20,35,0.95)', border: '1px solid rgba(245,158,11,0.2)', borderRadius: 24, padding: 22, boxShadow: '0 30px 80px rgba(0,0,0,0.5)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <Logo size={28} />
                <div>
                  <div style={{ color: '#FFF', fontWeight: 900, fontSize: 12, letterSpacing: 1 }}>EN-CHECK</div>
                  <div style={{ color: '#888', fontSize: 10 }}>Tableau de bord</div>
                </div>
              </div>
              <div style={{ background: 'rgba(16,185,129,0.12)', border: '1px solid rgba(16,185,129,0.3)', borderRadius: 999, padding: '4px 10px', color: '#10B981', fontSize: 10, fontWeight: 800 }}>
                EN DIRECT
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 12 }}>
              {[
                { label: 'Présents', value: '24', color: '#10B981' },
                { label: 'Retards', value: '3', color: '#EF4444' },
                { label: 'Notifs', value: '7', color: '#8B5CF6' },
                { label: 'Tâches', value: '12', color: '#EC4899' },
              ].map((s, i) => (
                <div key={i} style={{ background: 'rgba(255,255,255,0.03)', borderRadius: 12, padding: 12 }}>
                  <div style={{ color: s.color, fontWeight: 900, fontSize: 22, lineHeight: 1 }}>{s.value}</div>
                  <div style={{ color: '#777', fontSize: 10 }}>{s.label}</div>
                </div>
              ))}
            </div>

            <div style={{ background: 'rgba(139,92,246,0.06)', border: '1px solid rgba(139,92,246,0.15)', borderRadius: 12, padding: 12 }}>
              <div style={{ color: '#A78BFA', fontWeight: 900, fontSize: 11, marginBottom: 8 }}>🔔 Notifications</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {['✓ Pointage reçu (07h58)', '📄 Fiches de paie publiées', '🏖️ Demande de congés'].map((t, i) => (
                  <div key={i} style={{ color: '#CCC', fontSize: 12, background: 'rgba(255,255,255,0.02)', borderRadius: 10, padding: '8px 10px' }}>
                    {t}
                  </div>
                ))}
              </div>
            </div>

            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 12 }}>
              {[
                { icon: '🔔', label: 'Notifs', color: '#8B5CF6' },
                { icon: '👥', label: 'Équipes', color: '#EC4899' },
                { icon: '💰', label: 'Paie', color: '#F59E0B' },
              ].map((b, i) => (
                <div key={i} style={{ padding: '6px 10px', borderRadius: 12, background: `${b.color}12`, border: `1px solid ${b.color}25`, color: b.color, fontSize: 11, fontWeight: 800, display: 'flex', gap: 6, alignItems: 'center' }}>
                  <span>{b.icon}</span>
                  <span>{b.label}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

// ═══════════════════════════════════════════════════════════
// PROBLÈME
// ═══════════════════════════════════════════════════════════
function Problem() {
  const [ref, inView] = useInView()
  const problems = [
    { icon: '📄', title: 'Feuilles papier', desc: 'Perdues, falsifiées, illisibles. Vous ne savez jamais qui était présent.' },
    { icon: '🧮', title: 'Calculs manuels', desc: 'Des heures chaque mois à calculer présences, retards et heures sup.' },
    { icon: '🏗️', title: 'Multi-sites difficile', desc: 'Impossible de superviser plusieurs agences / chantiers sans outil.' },
    { icon: '💸', title: 'Coût des fraudes', desc: "Pointages bidon, retards non détectés… vous payez des heures non travaillées." },
  ]

  return (
    <section style={{ padding: '100px 24px', background: 'rgba(15,15,25,0.5)' }}>
      <div ref={ref} style={{ maxWidth: 1100, margin: '0 auto', opacity: inView ? 1 : 0, transition: 'opacity 0.8s ease' }}>
        <div style={{ textAlign: 'center', marginBottom: 56 }}>
          <span style={{ color: '#EF4444', fontWeight: 800, fontSize: 13, textTransform: 'uppercase', letterSpacing: 2 }}>Le problème</span>
          <h2 style={{ color: '#FFF', fontSize: 'clamp(26px, 4vw, 42px)', fontWeight: 900, margin: '12px 0 16px', lineHeight: 1.2 }}>
            {"Vous perdez combien d'heures par mois à gérer les présences ?"}
          </h2>
          <p style={{ color: '#888', fontSize: 17, maxWidth: 560, margin: '0 auto' }}>
            La gestion manuelle coûte cher. En temps, en argent et en stress.
          </p>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 18 }}>
          {problems.map((p, i) => (
            <div
              key={i}
              style={{
                background: 'rgba(239,68,68,0.05)',
                border: '1px solid rgba(239,68,68,0.12)',
                borderRadius: 16,
                padding: 26,
                opacity: inView ? 1 : 0,
                transform: inView ? 'none' : 'translateY(20px)',
                transition: `all 0.5s ease ${i * 0.1}s`,
              }}
            >
              <span style={{ fontSize: 32, display: 'block', marginBottom: 14 }}>{p.icon}</span>
              <h3 style={{ color: '#FFF', fontSize: 17, fontWeight: 800, margin: '0 0 10px 0' }}>{p.title}</h3>
              <p style={{ color: '#AAA', fontSize: 14, lineHeight: 1.6, margin: 0 }}>{p.desc}</p>
            </div>
          ))}
        </div>

        <div style={{ textAlign: 'center', marginTop: 48 }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 12, background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.2)', borderRadius: 14, padding: '18px 28px' }}>
            <span style={{ fontSize: 24 }}>💡</span>
            <span style={{ color: '#F59E0B', fontSize: 17, fontWeight: 900 }}>{"En-Check résout tout ça, dès aujourd'hui."}</span>
          </div>
        </div>
      </div>
    </section>
  )
}

// ═══════════════════════════════════════════════════════════
// FEATURES
// ═══════════════════════════════════════════════════════════
function Features() {
  const [ref, inView] = useInView()
  return (
    <section id="features" style={{ padding: '100px 24px' }}>
      <div ref={ref} style={{ maxWidth: 1200, margin: '0 auto' }}>
        <div style={{ textAlign: 'center', marginBottom: 56, opacity: inView ? 1 : 0, transition: 'opacity 0.7s ease' }}>
          <span style={{ color: '#F59E0B', fontWeight: 800, fontSize: 13, textTransform: 'uppercase', letterSpacing: 2 }}>Fonctionnalités</span>
          <h2 style={{ color: '#FFF', fontSize: 'clamp(26px, 4vw, 42px)', fontWeight: 900, margin: '12px 0 16px' }}>
            Tout ce dont vous avez besoin,{' '}
            <span style={{ background: 'linear-gradient(135deg,#F59E0B,#FCD34D)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
              rien de superflu
            </span>
          </h2>
          <p style={{ color: '#888', fontSize: 17, maxWidth: 520, margin: '0 auto' }}>
            Des modules activables selon vos besoins.
          </p>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: 14 }}>
          {FEATURES.map((f, i) => (
            <div
              key={i}
              style={{
                background: 'rgba(20,20,35,0.8)',
                border: `1px solid ${f.tag ? f.tagColor + '30' : 'rgba(255,255,255,0.06)'}`,
                borderRadius: 16,
                padding: 22,
                opacity: inView ? 1 : 0,
                transform: inView ? 'none' : 'translateY(20px)',
                transition: `all 0.5s ease ${i * 0.04}s`,
                position: 'relative',
              }}
            >
              {f.tag && (
                <div
                  style={{
                    position: 'absolute',
                    top: 12,
                    right: 12,
                    background: f.tagColor,
                    color: f.tag === 'GRATUIT' ? '#FFF' : '#000',
                    borderRadius: 6,
                    padding: '3px 8px',
                    fontSize: 9,
                    fontWeight: 900,
                    letterSpacing: 0.5,
                  }}
                >
                  {f.tag}
                </div>
              )}
              <div style={{ width: 48, height: 48, borderRadius: 12, background: f.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24, marginBottom: 14 }}>
                {f.icon}
              </div>
              <h3 style={{ color: '#FFF', fontSize: 15, fontWeight: 800, margin: '0 0 8px 0' }}>{f.title}</h3>
              <p style={{ color: '#888', fontSize: 13, lineHeight: 1.6, margin: 0 }}>{f.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

// ═══════════════════════════════════════════════════════════
// DÉMO VIDÉO
// ═══════════════════════════════════════════════════════════
function DemoVideo() {
  const [ref, inView] = useInView()
  const [open, setOpen] = useState(false)

  return (
    <section id="demo" style={{ padding: '100px 24px', background: 'rgba(15,15,25,0.5)' }}>
      <div ref={ref} style={{ maxWidth: 1100, margin: '0 auto' }}>
        <div style={{ textAlign: 'center', marginBottom: 56, opacity: inView ? 1 : 0, transition: 'opacity 0.7s ease' }}>
          <span style={{ color: '#EC4899', fontWeight: 800, fontSize: 13, textTransform: 'uppercase', letterSpacing: 2 }}>Démo vidéo</span>
          <h2 style={{ color: '#FFF', fontSize: 'clamp(26px, 4vw, 42px)', fontWeight: 900, margin: '12px 0 16px' }}>
            Démo en 30 secondes
          </h2>
          <p style={{ color: '#888', fontSize: 17, maxWidth: 620, margin: '0 auto' }}>
            Un aperçu rapide du produit (mockup cliquable). Ajoutez votre lien YouTube/Vimeo quand prêt.
          </p>
        </div>

        <div
          style={{
            maxWidth: 900,
            margin: '0 auto',
            opacity: inView ? 1 : 0,
            transform: inView ? 'none' : 'translateY(24px)',
            transition: 'all 0.7s ease 0.15s',
          }}
        >
          <div
            role="button"
            tabIndex={0}
            onClick={() => setOpen(true)}
            onKeyDown={(e) => e.key === 'Enter' && setOpen(true)}
            style={{
              position: 'relative',
              borderRadius: 24,
              overflow: 'hidden',
              aspectRatio: '16 / 9',
              border: '1px solid rgba(236,72,153,0.25)',
              background: 'linear-gradient(135deg, rgba(236,72,153,0.12), rgba(99,102,241,0.10))',
              cursor: 'pointer',
            }}
          >
            <div style={{ position: 'absolute', inset: 0, background: 'rgba(10,10,15,0.35)' }} />

            <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <div
                style={{
                  width: 82,
                  height: 82,
                  borderRadius: '50%',
                  background: 'linear-gradient(135deg,#EC4899,#F59E0B)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  boxShadow: '0 20px 60px rgba(236,72,153,0.45)',
                }}
              >
                <Play size={34} color="#fff" fill="#fff" style={{ marginLeft: 3 }} />
              </div>
            </div>

            <div style={{ position: 'absolute', bottom: 16, right: 16, background: 'rgba(0,0,0,0.65)', color: '#FFF', fontWeight: 800, fontSize: 13, padding: '6px 10px', borderRadius: 10 }}>
              0:30
            </div>

            <div style={{ position: 'absolute', top: 16, left: 16, display: 'flex', alignItems: 'center', gap: 10 }}>
              <Logo size={28} />
              <div style={{ color: '#FFF', fontWeight: 900, letterSpacing: 1 }}>EN-CHECK</div>
            </div>

            <div style={{ position: 'absolute', bottom: 16, left: 16, color: 'rgba(255,255,255,0.9)', fontSize: 13, fontWeight: 700 }}>
              Cliquer pour ouvrir
            </div>
          </div>

          {open && (
            <div style={{ marginTop: 14, background: 'rgba(20,20,35,0.9)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 16, padding: 16 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, marginBottom: 10 }}>
                <div style={{ color: '#FFF', fontWeight: 900 }}>Lecteur vidéo</div>
                <button
                  onClick={() => setOpen(false)}
                  style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.12)', color: '#FFF', borderRadius: 10, padding: '8px 12px', cursor: 'pointer', fontFamily: 'inherit', fontWeight: 700 }}
                >
                  Fermer
                </button>
              </div>

              {DEMO_VIDEO_EMBED_URL ? (
                <div style={{ aspectRatio: '16 / 9', width: '100%', borderRadius: 12, overflow: 'hidden' }}>
                  <iframe
                    src={DEMO_VIDEO_EMBED_URL}
                    title="Démo En-Check"
                    style={{ width: '100%', height: '100%', border: 0 }}
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                  />
                </div>
              ) : (
                <div style={{ color: '#AAA', fontSize: 14, lineHeight: 1.6 }}>
                  <div style={{ marginBottom: 8, color: '#FFF', fontWeight: 800 }}>Placeholder</div>
                  <div>Ajoutez votre lien embed YouTube/Vimeo dans <code>DEMO_VIDEO_EMBED_URL</code>.</div>
                </div>
              )}

              <div style={{ marginTop: 12, display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                <button
                  onClick={() => openWhatsApp("Bonjour En-Check ! Je souhaite une démo complète après avoir vu la vidéo.")}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: 'linear-gradient(135deg,#F59E0B,#D97706)', border: 'none', borderRadius: 12, padding: '11px 14px', fontWeight: 900, cursor: 'pointer', fontFamily: 'inherit' }}
                >
                  <WhatsAppIcon /> Demander une démo complète
                </button>
                <button
                  onClick={() => document.getElementById('pricing')?.scrollIntoView({ behavior: 'smooth' })}
                  style={{ background: 'transparent', border: '1px solid rgba(255,255,255,0.18)', color: '#FFF', borderRadius: 12, padding: '11px 14px', fontWeight: 800, cursor: 'pointer', fontFamily: 'inherit' }}
                >
                  Voir les tarifs →
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </section>
  )
}

// ═══════════════════════════════════════════════════════════
// NEW FEATURES (sécurité)
// ═══════════════════════════════════════════════════════════
function NewFeatures() {
  const [ref, inView] = useInView()

  const nouvelles = [
    {
      icon: '👤',
      color: '#6366F1',
      bg: 'rgba(99,102,241,0.08)',
      border: 'rgba(99,102,241,0.2)',
      title: 'Reconnaissance faciale biométrique',
      subtitle: "Pointage par visage — 100% sur-appareil",
      points: [
        '🔒 Données biométriques jamais envoyées sur internet',
        "⚡ Reconnaissance en moins d'1 seconde",
        '📱 Compatible téléphone et tablette partagée',
        '🛡️ Anti-fraude',
      ],
      waMsg: 'Bonjour En-Check ! Je suis intéressé par la reconnaissance faciale.',
    },
    {
      icon: '🌍',
      color: '#10B981',
      bg: 'rgba(16,185,129,0.08)',
      border: 'rgba(16,185,129,0.2)',
      title: 'Geofencing GPS',
      subtitle: 'Pointage uniquement dans les zones autorisées',
      points: [
        '📍 Zones configurables par site',
        '🚫 Blocage ou signalement hors zone',
        '🏗️ Parfait pour terrain / chantiers',
        '🔍 Détection anti-faux GPS',
      ],
      waMsg: 'Bonjour En-Check ! Je souhaite en savoir plus sur le geofencing GPS.',
    },
    {
      icon: '🗺️',
      color: '#F97316',
      bg: 'rgba(249,115,22,0.08)',
      border: 'rgba(249,115,22,0.2)',
      title: 'Carte temps réel',
      subtitle: 'Visualisez vos équipes terrain en direct',
      points: [
        '🔴 Marqueurs temps réel',
        '✅ Statut dans la zone / hors zone',
        '🔍 Filtres par site, employé, date',
        "🌐 Accessible depuis n'importe quel navigateur",
      ],
      waMsg: 'Bonjour En-Check ! Je veux voir une démo de la carte temps réel.',
    },
  ]

  return (
    <section style={{ padding: '100px 24px', background: 'rgba(15,15,25,0.8)' }}>
      <div ref={ref} style={{ maxWidth: 1100, margin: '0 auto' }}>
        <div style={{ textAlign: 'center', marginBottom: 56, opacity: inView ? 1 : 0, transition: 'opacity 0.7s ease' }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 10, background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.2)', borderRadius: 999, padding: '6px 16px', marginBottom: 16 }}>
            <span>✨</span>
            <span style={{ color: '#F59E0B', fontSize: 13, fontWeight: 900 }}>Nouvelles fonctionnalités</span>
          </div>
          <h2 style={{ color: '#FFF', fontSize: 'clamp(26px, 4vw, 42px)', fontWeight: 900, margin: '0 0 14px 0' }}>Sécurité & contrôle</h2>
          <p style={{ color: '#888', fontSize: 17, maxWidth: 560, margin: '0 auto' }}>
            Biométrie, géolocalisation et supervision en temps réel.
          </p>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          {nouvelles.map((n, i) => (
            <div
              key={i}
              className="nouvelles-grid"
              style={{
                background: n.bg,
                border: `1px solid ${n.border}`,
                borderRadius: 20,
                padding: 28,
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                gap: 24,
                alignItems: 'center',
                opacity: inView ? 1 : 0,
                transform: inView ? 'none' : 'translateY(18px)',
                transition: `all 0.6s ease ${i * 0.12}s`,
              }}
            >
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 10 }}>
                  <div style={{ width: 54, height: 54, borderRadius: 14, background: `${n.color}18`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 26 }}>
                    {n.icon}
                  </div>
                  <div>
                    <div style={{ display: 'inline-block', background: n.color, color: '#000', borderRadius: 6, padding: '2px 8px', fontSize: 9, fontWeight: 900, marginBottom: 6 }}>NOUVEAU</div>
                    <div style={{ color: '#FFF', fontSize: 18, fontWeight: 900 }}>{n.title}</div>
                  </div>
                </div>
                <div style={{ color: n.color, fontWeight: 800, marginBottom: 14 }}>{n.subtitle}</div>

                <button
                  onClick={() => openWhatsApp(n.waMsg)}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 8,
                    background: `${n.color}20`,
                    border: `1px solid ${n.color}40`,
                    color: n.color,
                    borderRadius: 12,
                    padding: '10px 14px',
                    fontWeight: 900,
                    cursor: 'pointer',
                    fontFamily: 'inherit',
                  }}
                >
                  <WhatsAppIcon /> Demander une démo
                </button>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {n.points.map((point, j) => (
                  <div key={j} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, background: 'rgba(255,255,255,0.03)', borderRadius: 12, padding: '10px 12px' }}>
                    <span style={{ fontSize: 14, flexShrink: 0 }}>{point.split(' ')[0]}</span>
                    <span style={{ color: '#CCC', fontSize: 13, lineHeight: 1.5 }}>{point.split(' ').slice(1).join(' ')}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

// ═══════════════════════════════════════════════════════════
// TASK MANAGEMENT (premium)
// ═══════════════════════════════════════════════════════════
function TaskManagement() {
  const [ref, inView] = useInView()

  const items = [
    { icon: '👥', title: "Création d'équipes", desc: 'Organisez vos employés par équipe, site ou projet.' },
    { icon: '✅', title: 'Gestion des tâches', desc: 'Assignez, suivez et contrôlez les tâches à accomplir.' },
    { icon: '📊', title: 'Prédictions performance', desc: 'Anticipez retards et charge sur les tâches à accomplir.' },
  ]

  return (
    <section style={{ padding: '100px 24px', background: 'linear-gradient(135deg, rgba(236,72,153,0.04), rgba(245,158,11,0.06))' }}>
      <div ref={ref} style={{ maxWidth: 1100, margin: '0 auto' }}>
        <div style={{ textAlign: 'center', marginBottom: 46, opacity: inView ? 1 : 0, transition: 'opacity 0.7s ease' }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 10, background: 'rgba(236,72,153,0.10)', border: '1px solid rgba(236,72,153,0.25)', borderRadius: 999, padding: '6px 16px', marginBottom: 16 }}>
            <span>💎</span>
            <span style={{ color: '#EC4899', fontSize: 13, fontWeight: 900 }}>Nouveauté Premium</span>
          </div>
          <h2 style={{ color: '#FFF', fontSize: 'clamp(26px, 4vw, 42px)', fontWeight: 900, margin: '0 0 12px 0' }}>
            Gestion des tâches & des équipes
          </h2>
          <p style={{ color: '#888', fontSize: 17, maxWidth: 680, margin: '0 auto' }}>
            Pour piloter l’exécution sur le terrain et au bureau : équipes, tâches, et prédictions.
          </p>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 22 }} className="task-grid">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {items.map((it, i) => (
              <div
                key={i}
                style={{
                  background: 'rgba(20,20,35,0.75)',
                  border: '1px solid rgba(236,72,153,0.12)',
                  borderRadius: 16,
                  padding: 16,
                  opacity: inView ? 1 : 0,
                  transform: inView ? 'none' : 'translateY(12px)',
                  transition: `all 0.5s ease ${i * 0.08}s`,
                  display: 'flex',
                  gap: 12,
                  alignItems: 'flex-start',
                }}
              >
                <div style={{ width: 42, height: 42, borderRadius: 12, background: 'rgba(236,72,153,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, flexShrink: 0 }}>
                  {it.icon}
                </div>
                <div>
                  <div style={{ color: '#FFF', fontWeight: 900, marginBottom: 4 }}>{it.title}</div>
                  <div style={{ color: '#888', fontSize: 13, lineHeight: 1.5 }}>{it.desc}</div>
                </div>
              </div>
            ))}

            <button
              onClick={() => openWhatsApp("Bonjour En-Check ! Je suis intéressé par le module Gestion des tâches & équipes (premium).")}
              style={{
                marginTop: 6,
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 10,
                background: 'linear-gradient(135deg,#EC4899,#F59E0B)',
                border: 'none',
                color: '#FFF',
                borderRadius: 14,
                padding: '13px 16px',
                fontWeight: 900,
                cursor: 'pointer',
                fontFamily: 'inherit',
              }}
            >
              <WhatsAppIcon /> Demander une démo (tâches/équipes)
            </button>
          </div>

          {/* mini mockup */}
          <div style={{ background: 'rgba(20,20,35,0.88)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 18, padding: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
              <div style={{ color: '#FFF', fontWeight: 900 }}>📋 Dashboard Tâches</div>
              <div style={{ background: 'rgba(16,185,129,0.12)', border: '1px solid rgba(16,185,129,0.20)', color: '#10B981', fontWeight: 900, fontSize: 11, borderRadius: 999, padding: '4px 10px' }}>
                + Prédictions
              </div>
            </div>

            {[
              { name: 'Inventaire site A', team: 'Équipe Terrain', p: 70, status: 'OK', pred: 'Dans les temps', c: '#10B981' },
              { name: 'Rapport mensuel', team: 'Admin', p: 45, status: 'Risque', pred: 'Risque de retard', c: '#EF4444' },
              { name: 'Déploiement planning', team: 'RH', p: 90, status: 'Final', pred: 'Avance', c: '#F59E0B' },
            ].map((t, i) => (
              <div key={i} style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 14, padding: 12, marginBottom: 10 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10 }}>
                  <div>
                    <div style={{ color: '#FFF', fontWeight: 800, fontSize: 13 }}>{t.name}</div>
                    <div style={{ color: '#777', fontSize: 11 }}>{t.team}</div>
                  </div>
                  <div style={{ background: `${t.c}22`, border: `1px solid ${t.c}35`, color: t.c, fontWeight: 900, fontSize: 10, borderRadius: 10, padding: '4px 8px', height: 'fit-content' }}>
                    {t.status}
                  </div>
                </div>

                <div style={{ marginTop: 10, background: 'rgba(255,255,255,0.06)', height: 6, borderRadius: 999, overflow: 'hidden' }}>
                  <div style={{ width: `${t.p}%`, height: '100%', background: t.c }} />
                </div>

                <div style={{ marginTop: 8, color: '#AAA', fontSize: 11 }}>
                  🤖 Prédiction : <span style={{ color: t.c, fontWeight: 800 }}>{t.pred}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}

// ═══════════════════════════════════════════════════════════
// PAYROLL + HOLIDAYS (tabs)
// ═══════════════════════════════════════════════════════════
function PayrollAndHolidays() {
  const [ref, inView] = useInView()
  const [activeTab, setActiveTab] = useState('payroll')

  const payrollPoints = [
    'Calcul automatique depuis vos pointages',
    'Heures supplémentaires intégrées',
    'Absences et congés déduits automatiquement',
    'PDF téléchargeable',
    "Publication dans l'espace employé",
  ]

  const holidayPoints = [
    'Calendrier par pays',
    'Activation/désactivation par entreprise',
    'Impact automatique sur retards, absences et heures sup',
    'Majoration configurable si travaillé',
  ]

  return (
    <section style={{ padding: '100px 24px', background: '#0A0A0F' }}>
      <div ref={ref} style={{ maxWidth: 1100, margin: '0 auto' }}>
        <div style={{ textAlign: 'center', marginBottom: 44, opacity: inView ? 1 : 0, transition: 'opacity 0.7s ease' }}>
          <span style={{ color: '#F59E0B', fontWeight: 900, fontSize: 13, textTransform: 'uppercase', letterSpacing: 2 }}>
            RH complète
          </span>
          <h2 style={{ color: '#FFF', fontSize: 'clamp(26px, 4vw, 42px)', fontWeight: 900, margin: '12px 0 16px' }}>
            Du pointage au bulletin de paie
          </h2>
          <p style={{ color: '#888', fontSize: 17, maxWidth: 620, margin: '0 auto' }}>
            Automatisez la paie et sécurisez vos calculs avec des règles fiables.
          </p>
        </div>

        <div style={{ display: 'flex', gap: 10, justifyContent: 'center', marginBottom: 26 }}>
          <button
            onClick={() => setActiveTab('payroll')}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 10,
              padding: '12px 18px',
              borderRadius: 14,
              cursor: 'pointer',
              fontFamily: 'inherit',
              fontWeight: 900,
              border: activeTab === 'payroll' ? '1px solid rgba(245,158,11,0.45)' : '1px solid rgba(255,255,255,0.10)',
              background: activeTab === 'payroll' ? 'rgba(245,158,11,0.12)' : 'rgba(20,20,35,0.8)',
              color: activeTab === 'payroll' ? '#F59E0B' : '#AAA',
            }}
          >
            💰 Fiches de paie <span style={{ background: '#F59E0B', color: '#000', borderRadius: 6, padding: '2px 8px', fontSize: 10 }}>PREMIUM</span>
          </button>

          <button
            onClick={() => setActiveTab('holidays')}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 10,
              padding: '12px 18px',
              borderRadius: 14,
              cursor: 'pointer',
              fontFamily: 'inherit',
              fontWeight: 900,
              border: activeTab === 'holidays' ? '1px solid rgba(16,185,129,0.45)' : '1px solid rgba(255,255,255,0.10)',
              background: activeTab === 'holidays' ? 'rgba(16,185,129,0.10)' : 'rgba(20,20,35,0.8)',
              color: activeTab === 'holidays' ? '#10B981' : '#AAA',
            }}
          >
            🎌 Jours fériés <span style={{ background: '#10B981', color: '#FFF', borderRadius: 6, padding: '2px 8px', fontSize: 10 }}>GRATUIT</span>
          </button>
        </div>

        <div className="payroll-holiday-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 18 }}>
          <div
            style={{
              background: 'rgba(20,20,35,0.8)',
              border: '1px solid rgba(255,255,255,0.08)',
              borderRadius: 18,
              padding: 18,
              opacity: inView ? 1 : 0,
              transform: inView ? 'none' : 'translateY(16px)',
              transition: 'all 0.6s ease',
            }}
          >
            <div style={{ color: '#FFF', fontWeight: 900, marginBottom: 10 }}>
              {activeTab === 'payroll' ? '💰 Points clés paie' : '🎌 Points clés jours fériés'}
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {(activeTab === 'payroll' ? payrollPoints : holidayPoints).map((t, i) => (
                <div key={i} style={{ background: 'rgba(255,255,255,0.03)', borderRadius: 12, padding: '10px 12px', color: '#CCC', fontSize: 13, lineHeight: 1.5 }}>
                  ✓ {t}
                </div>
              ))}
            </div>

            <button
              onClick={() =>
                openWhatsApp(
                  activeTab === 'payroll'
                    ? 'Bonjour En-Check ! Je souhaite une démo du module fiches de paie.'
                    : 'Bonjour En-Check ! Je souhaite en savoir plus sur les jours fériés.'
                )
              }
              style={{
                marginTop: 14,
                width: '100%',
                border: 'none',
                borderRadius: 14,
                padding: '12px 14px',
                fontWeight: 900,
                cursor: 'pointer',
                fontFamily: 'inherit',
                background: activeTab === 'payroll' ? 'linear-gradient(135deg,#F59E0B,#D97706)' : 'rgba(16,185,129,0.16)',
                color: activeTab === 'payroll' ? '#000' : '#A7F3D0',
                borderTop: activeTab === 'holidays' ? '1px solid rgba(16,185,129,0.25)' : 'none',
              }}
            >
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 10, justifyContent: 'center' }}>
                <WhatsAppIcon /> {activeTab === 'payroll' ? 'Voir une démo paie' : 'En savoir plus'}
              </span>
            </button>
          </div>

          <div
            style={{
              background: 'rgba(20,20,35,0.9)',
              border: '1px solid rgba(255,255,255,0.08)',
              borderRadius: 18,
              padding: 18,
              opacity: inView ? 1 : 0,
              transform: inView ? 'none' : 'translateY(16px)',
              transition: 'all 0.6s ease 0.1s',
            }}
          >
            <div style={{ color: '#FFF', fontWeight: 900, marginBottom: 10 }}>Aperçu</div>

            {activeTab === 'payroll' ? (
              <div style={{ background: 'rgba(245,158,11,0.06)', border: '1px solid rgba(245,158,11,0.16)', borderRadius: 14, padding: 14 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10 }}>
                  <div>
                    <div style={{ color: '#F59E0B', fontWeight: 900, fontSize: 12 }}>BULLETIN DE PAIE</div>
                    <div style={{ color: '#777', fontSize: 11 }}>Période : 01 → 30</div>
                  </div>
                  <div style={{ background: 'rgba(16,185,129,0.12)', border: '1px solid rgba(16,185,129,0.25)', color: '#10B981', fontWeight: 900, fontSize: 10, borderRadius: 999, padding: '4px 10px', height: 'fit-content' }}>
                    ✓ Auto
                  </div>
                </div>

                {[
                  { k: 'Salaire base', v: '350 000' },
                  { k: 'Heures sup', v: '22 580', hl: true },
                  { k: 'Absences', v: '-31 818', neg: true },
                  { k: 'Net à payer', v: '378 022', net: true },
                ].map((l, i) => (
                  <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: i < 3 ? '1px solid rgba(255,255,255,0.06)' : 'none' }}>
                    <div style={{ color: '#BBB', fontSize: 12 }}>{l.k}</div>
                    <div style={{ color: l.net ? '#10B981' : l.neg ? '#EF4444' : l.hl ? '#F59E0B' : '#FFF', fontWeight: 900, fontSize: 12 }}>
                      {l.v}
                    </div>
                  </div>
                ))}

                <div style={{ marginTop: 10, display: 'flex', gap: 10 }}>
                  <div style={{ flex: 1, background: 'rgba(99,102,241,0.12)', border: '1px solid rgba(99,102,241,0.2)', borderRadius: 12, padding: '10px 12px', color: '#818CF8', fontWeight: 900, fontSize: 11, textAlign: 'center' }}>
                    PDF
                  </div>
                  <div style={{ flex: 1, background: 'rgba(16,185,129,0.12)', border: '1px solid rgba(16,185,129,0.2)', borderRadius: 12, padding: '10px 12px', color: '#10B981', fontWeight: 900, fontSize: 11, textAlign: 'center' }}>
                    Espace employé
                  </div>
                </div>
              </div>
            ) : (
              <div style={{ background: 'rgba(16,185,129,0.06)', border: '1px solid rgba(16,185,129,0.16)', borderRadius: 14, padding: 14 }}>
                {[
                  { d: '1 janv.', n: "Jour de l'An", on: true },
                  { d: '1 mai', n: 'Fête du Travail', on: true },
                  { d: '15 août', n: 'Assomption', on: false },
                ].map((h, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 0', borderBottom: i < 2 ? '1px solid rgba(255,255,255,0.06)' : 'none', opacity: h.on ? 1 : 0.5 }}>
                    <div>
                      <div style={{ color: '#10B981', fontWeight: 900, fontSize: 11 }}>{h.d}</div>
                      <div style={{ color: '#FFF', fontWeight: 800, fontSize: 12 }}>{h.n}</div>
                    </div>
                    <div style={{ width: 34, height: 18, borderRadius: 999, background: h.on ? '#10B981' : '#333', padding: 2, display: 'flex', justifyContent: h.on ? 'flex-end' : 'flex-start' }}>
                      <div style={{ width: 14, height: 14, borderRadius: '50%', background: '#FFF' }} />
                    </div>
                  </div>
                ))}

                <div style={{ marginTop: 10, color: '#A7F3D0', fontWeight: 900, fontSize: 11 }}>
                  Impact automatique : Retards • Absences • Heures sup • Paie
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  )
}

// ═══════════════════════════════════════════════════════════
// HOW IT WORKS
// ═══════════════════════════════════════════════════════════
function HowItWorks() {
  const [ref, inView] = useInView()
  return (
    <section id="how" style={{ padding: '100px 24px', background: 'rgba(15,15,25,0.5)' }}>
      <div ref={ref} style={{ maxWidth: 1000, margin: '0 auto' }}>
        <div style={{ textAlign: 'center', marginBottom: 64, opacity: inView ? 1 : 0, transition: 'opacity 0.7s ease' }}>
          <span style={{ color: '#10B981', fontWeight: 900, fontSize: 13, textTransform: 'uppercase', letterSpacing: 2 }}>Simple & rapide</span>
          <h2 style={{ color: '#FFF', fontSize: 'clamp(26px, 4vw, 42px)', fontWeight: 900, margin: '12px 0 16px' }}>Opérationnel en 3 étapes</h2>
          <p style={{ color: '#888', fontSize: 17 }}>{"Pas de matériel, pas d'installation. Juste votre téléphone."}</p>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 24 }}>
          {STEPS.map((step, i) => (
            <div
              key={i}
              style={{
                background: 'rgba(20,20,35,0.9)',
                border: `1px solid ${step.color}25`,
                borderRadius: 20,
                padding: 28,
                opacity: inView ? 1 : 0,
                transform: inView ? 'none' : 'translateY(28px)',
                transition: `all 0.6s ease ${i * 0.15}s`,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 18 }}>
                <div style={{ background: `${step.color}18`, border: `2px solid ${step.color}`, borderRadius: 10, padding: '5px 12px', color: step.color, fontWeight: 900, fontSize: 16 }}>
                  {step.num}
                </div>
                <span style={{ fontSize: 24 }}>{step.icon}</span>
              </div>
              <h3 style={{ color: '#FFF', fontSize: 19, fontWeight: 900, margin: '0 0 12px 0' }}>{step.title}</h3>
              <p style={{ color: '#AAA', fontSize: 14, lineHeight: 1.7, margin: 0 }}>{step.desc}</p>
            </div>
          ))}
        </div>

        <div style={{ textAlign: 'center', marginTop: 56, opacity: inView ? 1 : 0, transition: 'opacity 1s ease 0.4s' }}>
          <button
            onClick={() => openWhatsApp('Bonjour En-Check ! Je veux démarrer maintenant.')}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 10,
              background: 'linear-gradient(135deg,#10B981,#059669)',
              color: '#FFF',
              border: 'none',
              borderRadius: 14,
              padding: '16px 32px',
              fontWeight: 900,
              fontSize: 16,
              cursor: 'pointer',
              fontFamily: 'inherit',
              boxShadow: '0 8px 28px rgba(16,185,129,0.28)',
            }}
          >
            {"🚀 Démarrer maintenant — c'est gratuit"}
          </button>
        </div>
      </div>
    </section>
  )
}

// ═══════════════════════════════════════════════════════════
// STATS
// ═══════════════════════════════════════════════════════════
function Stats() {
  const [ref, inView] = useInView()
  const items = [
    { value: '50+', label: 'Entreprises clientes', color: '#F59E0B' },
    { value: '2 000+', label: 'Employés gérés', color: '#10B981' },
    { value: '5 min', label: 'Pour démarrer', color: '#6366F1' },
    { value: '98%', label: 'Satisfaction client', color: '#EC4899' },
  ]
  return (
    <section style={{ padding: '80px 24px', background: 'linear-gradient(135deg, rgba(245,158,11,0.06), rgba(99,102,241,0.04))' }}>
      <div ref={ref} style={{ maxWidth: 1000, margin: '0 auto', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 20 }}>
        {items.map((s, i) => (
          <div key={i} style={{ textAlign: 'center', opacity: inView ? 1 : 0, transform: inView ? 'none' : 'translateY(20px)', transition: `all 0.5s ease ${i * 0.1}s` }}>
            <div style={{ fontSize: 'clamp(38px, 5vw, 54px)', fontWeight: 900, color: s.color, lineHeight: 1 }}>{s.value}</div>
            <div style={{ color: '#888', fontSize: 14, marginTop: 8, fontWeight: 600 }}>{s.label}</div>
          </div>
        ))}
      </div>
    </section>
  )
}

// ═══════════════════════════════════════════════════════════
// TÉMOIGNAGES
// ═══════════════════════════════════════════════════════════
function Temoignages() {
  const [ref, inView] = useInView()
  return (
    <section style={{ padding: '100px 24px' }}>
      <div ref={ref} style={{ maxWidth: 1100, margin: '0 auto' }}>
        <div style={{ textAlign: 'center', marginBottom: 56, opacity: inView ? 1 : 0, transition: 'opacity 0.7s ease' }}>
          <span style={{ color: '#EC4899', fontWeight: 900, fontSize: 13, textTransform: 'uppercase', letterSpacing: 2 }}>Témoignages</span>
          <h2 style={{ color: '#FFF', fontSize: 'clamp(26px, 4vw, 42px)', fontWeight: 900, margin: '12px 0 16px' }}>Ils nous font confiance</h2>
          <p style={{ color: '#888', fontSize: 17 }}>Des entreprises qui ont transformé leur gestion RH</p>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 18 }}>
          {TEMOIGNAGES.map((t, i) => (
            <div key={i} style={{ background: 'rgba(20,20,35,0.8)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 18, padding: 26, opacity: inView ? 1 : 0, transform: inView ? 'none' : 'translateY(20px)', transition: `all 0.6s ease ${i * 0.12}s` }}>
              <div style={{ fontSize: 32, color: t.color, marginBottom: 14, lineHeight: 1 }}>"</div>
              <p style={{ color: '#CCC', fontSize: 14, lineHeight: 1.7, margin: '0 0 22px 0', fontStyle: 'italic' }}>{t.texte}</p>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, paddingTop: 18, borderTop: '1px solid rgba(255,255,255,0.06)' }}>
                <div style={{ width: 42, height: 42, borderRadius: 11, background: `${t.color}18`, border: `2px solid ${t.color}35`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: t.color, fontWeight: 900, fontSize: 13 }}>
                  {t.initiales}
                </div>
                <div>
                  <div style={{ color: '#FFF', fontWeight: 900, fontSize: 14 }}>{t.nom}</div>
                  <div style={{ color: '#888', fontSize: 12 }}>{t.poste} · {t.entreprise}</div>
                  <div style={{ color: '#666', fontSize: 11, marginTop: 2 }}>{t.pays}</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

// ═══════════════════════════════════════════════════════════
// PRICING
// ═══════════════════════════════════════════════════════════
function Pricing() {
  const [ref, inView] = useInView()
  return (
    <section id="pricing" style={{ padding: '100px 24px', background: 'rgba(15,15,25,0.5)' }}>
      <div ref={ref} style={{ maxWidth: 1100, margin: '0 auto' }}>
        <div style={{ textAlign: 'center', marginBottom: 56, opacity: inView ? 1 : 0, transition: 'opacity 0.7s ease' }}>
          <span style={{ color: '#6366F1', fontWeight: 900, fontSize: 13, textTransform: 'uppercase', letterSpacing: 2 }}>Tarifs</span>
          <h2 style={{ color: '#FFF', fontSize: 'clamp(26px, 4vw, 42px)', fontWeight: 900, margin: '12px 0 16px' }}>Un prix adapté à votre entreprise</h2>
          <p style={{ color: '#888', fontSize: 17, maxWidth: 620, margin: '0 auto' }}>
            Devis personnalisé selon modules, employés et sites.
          </p>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.2)', borderRadius: 999, padding: '6px 16px', marginTop: 16 }}>
            <span style={{ fontSize: 14 }}>🎌</span>
            <span style={{ color: '#10B981', fontSize: 13, fontWeight: 900 }}>Les jours fériés sont inclus gratuitement</span>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(290px, 1fr))', gap: 20, alignItems: 'start' }}>
          {PLANS.map((plan, i) => (
            <div
              key={i}
              style={{
                background: plan.bg,
                border: `1px solid ${plan.border}`,
                borderRadius: 20,
                padding: 26,
                position: 'relative',
                opacity: inView ? 1 : 0,
                transform: inView ? 'none' : 'translateY(28px)',
                transition: `all 0.6s ease ${i * 0.12}s`,
                boxShadow: plan.popular ? `0 20px 60px ${plan.color}18` : 'none',
              }}
            >
              {plan.popular && (
                <div style={{ position: 'absolute', top: -13, left: '50%', transform: 'translateX(-50%)', background: `linear-gradient(135deg,${plan.color},#D97706)`, color: '#000', borderRadius: 999, padding: '5px 16px', fontSize: 11, fontWeight: 900, whiteSpace: 'nowrap' }}>
                  ★ LE PLUS POPULAIRE
                </div>
              )}

              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
                <span style={{ fontSize: 26 }}>{plan.icon}</span>
                <h3 style={{ color: plan.color, fontSize: 20, fontWeight: 900, margin: 0, letterSpacing: 1 }}>{plan.name}</h3>
              </div>

              <p style={{ color: '#888', fontSize: 13, margin: '0 0 16px 0' }}>{plan.desc}</p>

              <div style={{ background: 'rgba(255,255,255,0.04)', borderRadius: 12, padding: '12px 14px', marginBottom: 18, textAlign: 'center' }}>
                <div style={{ color: plan.color, fontWeight: 900, fontSize: 16 }}>Sur devis personnalisé</div>
                <div style={{ color: '#666', fontSize: 12, marginTop: 3 }}>Selon modules & volume</div>
              </div>

              <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 18px 0', display: 'flex', flexDirection: 'column', gap: 9 }}>
                {plan.features.map((f, j) => (
                  <li key={j} style={{ display: 'flex', gap: 10, color: '#CCC', fontSize: 13 }}>
                    <span style={{ color: plan.color, fontWeight: 900 }}>✓</span>
                    <span>{f}</span>
                  </li>
                ))}
              </ul>

              <button
                onClick={() => openWhatsApp(plan.waMsg)}
                style={{
                  width: '100%',
                  padding: '13px',
                  background: plan.popular ? `linear-gradient(135deg,${plan.color},#D97706)` : 'transparent',
                  border: `2px solid ${plan.color}`,
                  borderRadius: 12,
                  color: plan.popular ? '#000' : plan.color,
                  fontWeight: 900,
                  fontSize: 14,
                  cursor: 'pointer',
                  fontFamily: 'inherit',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 10,
                }}
              >
                <WhatsAppIcon /> {plan.cta}
              </button>
            </div>
          ))}
        </div>

        <div style={{ textAlign: 'center', marginTop: 40, padding: 24, background: 'rgba(245,158,11,0.05)', border: '1px solid rgba(245,158,11,0.12)', borderRadius: 14 }}>
          <div style={{ color: '#CCC', fontSize: 15, fontWeight: 800, marginBottom: 6 }}>
            Besoin d’une offre sur mesure ?
          </div>
          <div style={{ color: '#888', fontSize: 13, marginBottom: 14 }}>
            Réponse rapide sur WhatsApp
          </div>
          <button
            onClick={() => openWhatsApp('Bonjour En-Check ! J’aimerais un devis personnalisé pour mon entreprise.')}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 10,
              background: 'linear-gradient(135deg,#F59E0B,#D97706)',
              color: '#000',
              border: 'none',
              borderRadius: 12,
              padding: '13px 22px',
              fontWeight: 900,
              cursor: 'pointer',
              fontFamily: 'inherit',
            }}
          >
            <WhatsAppIcon /> Obtenir mon devis
          </button>
        </div>
      </div>
    </section>
  )
}

// ═══════════════════════════════════════════════════════════
// CONTACT
// ═══════════════════════════════════════════════════════════
function Contact() {
  const [ref, inView] = useInView()
  const [form, setForm] = useState({ nom: '', entreprise: '', telephone: '', employes: '', message: '' })
  const [sent, setSent] = useState(false)

  const handleSubmit = (e) => {
    e.preventDefault()
    const msg =
      `Bonjour En-Check !%0A%0A` +
      `Nom : ${encodeURIComponent(form.nom)}%0A` +
      `Entreprise : ${encodeURIComponent(form.entreprise)}%0A` +
      `Telephone : ${encodeURIComponent(form.telephone)}%0A` +
      `Nb employes : ${encodeURIComponent(form.employes)}%0A%0A` +
      `Message : ${encodeURIComponent(form.message)}`
    window.open(`https://wa.me/${WHATSAPP_NUMBER}?text=${msg}`, '_blank')
    setSent(true)
    setTimeout(() => setSent(false), 5000)
  }

  const inputStyle = {
    width: '100%',
    padding: '12px 14px',
    background: 'rgba(255,255,255,0.04)',
    border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: 10,
    color: '#FFF',
    fontSize: 14,
    fontFamily: 'inherit',
    outline: 'none',
    boxSizing: 'border-box',
    transition: 'border-color 0.2s',
  }

  const labelStyle = {
    color: '#888',
    fontSize: 12,
    fontWeight: 800,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    display: 'block',
    marginBottom: 6,
  }

  return (
    <section id="contact" style={{ padding: '100px 24px' }}>
      <div ref={ref} style={{ maxWidth: 1000, margin: '0 auto' }}>
        <div style={{ textAlign: 'center', marginBottom: 56, opacity: inView ? 1 : 0, transition: 'opacity 0.7s ease' }}>
          <span style={{ color: '#10B981', fontWeight: 900, fontSize: 13, textTransform: 'uppercase', letterSpacing: 2 }}>Contact</span>
          <h2 style={{ color: '#FFF', fontSize: 'clamp(26px, 4vw, 42px)', fontWeight: 900, margin: '12px 0 16px' }}>Parlons de votre projet</h2>
          <p style={{ color: '#888', fontSize: 17 }}>Réponse rapide sur WhatsApp</p>
        </div>

        <div className="contact-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 36, alignItems: 'start', opacity: inView ? 1 : 0, transform: inView ? 'none' : 'translateY(20px)', transition: 'all 0.7s ease' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={{ background: 'rgba(37,211,102,0.07)', border: '1px solid rgba(37,211,102,0.2)', borderRadius: 16, padding: 24, cursor: 'pointer' }} onClick={() => openWhatsApp()}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
                <div style={{ width: 48, height: 48, borderRadius: 12, background: 'rgba(37,211,102,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#25D366' }}>
                  <WhatsAppIcon />
                </div>
                <div>
                  <div style={{ color: '#25D366', fontWeight: 900, fontSize: 17 }}>WhatsApp</div>
                  <div style={{ color: '#888', fontSize: 12 }}>Canal principal</div>
                </div>
              </div>
              <div style={{ color: '#25D366', fontWeight: 900, fontSize: 18, marginBottom: 6 }}>{PHONE_DISPLAY}</div>
              <div style={{ background: '#25D366', color: '#000', borderRadius: 12, padding: '10px', textAlign: 'center', fontWeight: 900 }}>
                Ouvrir WhatsApp →
              </div>
            </div>

            <div style={{ background: 'rgba(20,20,35,0.8)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 14, padding: 20 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                <span style={{ fontSize: 20 }}>✉️</span>
                <div style={{ color: '#FFF', fontWeight: 900 }}>Email</div>
              </div>
              <a href={`mailto:${EMAIL}`} style={{ color: '#F59E0B', fontSize: 14, fontWeight: 800, textDecoration: 'none' }}>
                {EMAIL}
              </a>
            </div>

            <div style={{ background: 'rgba(20,20,35,0.8)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 14, padding: 20 }}>
              <div style={{ color: '#888', fontSize: 12, fontWeight: 900, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 14 }}>
                Réseaux
              </div>
              <div style={{ display: 'flex', gap: 10 }}>
                {SOCIALS.map((s, i) => (
                  <a
                    key={i}
                    href={s.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{
                      width: 46,
                      height: 46,
                      borderRadius: 12,
                      background: s.bg,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: s.color,
                      textDecoration: 'none',
                      border: `1px solid ${s.color}25`,
                    }}
                  >
                    <s.Icon />
                  </a>
                ))}
              </div>
            </div>
          </div>

          <form onSubmit={handleSubmit} style={{ background: 'rgba(20,20,35,0.8)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 18, padding: 26, display: 'flex', flexDirection: 'column', gap: 14 }}>
            <h3 style={{ color: '#FFF', fontSize: 17, fontWeight: 900, margin: 0 }}>Envoyez-nous un message</h3>
            <p style={{ color: '#888', fontSize: 13, margin: 0 }}>On vous répond sur WhatsApp</p>

            <div>
              <label style={labelStyle}>Votre nom *</label>
              <input value={form.nom} onChange={(e) => setForm({ ...form, nom: e.target.value })} required placeholder="Jean" style={inputStyle} />
            </div>

            <div>
              <label style={labelStyle}>Entreprise *</label>
              <input value={form.entreprise} onChange={(e) => setForm({ ...form, entreprise: e.target.value })} required placeholder="Ma société" style={inputStyle} />
            </div>

            <div>
              <label style={labelStyle}>Téléphone *</label>
              <input value={form.telephone} onChange={(e) => setForm({ ...form, telephone: e.target.value })} required placeholder={PHONE_DISPLAY} style={inputStyle} />
            </div>

            <div>
              <label style={labelStyle}>{"Nombre d'employés"}</label>
              <select value={form.employes} onChange={(e) => setForm({ ...form, employes: e.target.value })} style={{ ...inputStyle, cursor: 'pointer' }}>
                <option value="">Sélectionnez...</option>
                <option value="1-10">1 à 10</option>
                <option value="11-50">11 à 50</option>
                <option value="51-200">51 à 200</option>
                <option value="200+">200+</option>
              </select>
            </div>

            <div>
              <label style={labelStyle}>Message</label>
              <textarea
                value={form.message}
                onChange={(e) => setForm({ ...form, message: e.target.value })}
                rows={3}
                placeholder="Dites-nous ce que vous voulez activer (paie, notifications, tâches, GPS...)"
                style={{ ...inputStyle, resize: 'vertical' }}
              />
            </div>

            <button type="submit" style={{ background: 'linear-gradient(135deg,#25D366,#128C7E)', color: '#FFF', border: 'none', borderRadius: 12, padding: '13px', fontWeight: 900, fontSize: 15, cursor: 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10 }}>
              {sent ? 'Message envoyé !' : (
                <>
                  <WhatsAppIcon /> Envoyer via WhatsApp
                </>
              )}
            </button>
          </form>
        </div>
      </div>
    </section>
  )
}

// ═══════════════════════════════════════════════════════════
// CTA FINAL
// ═══════════════════════════════════════════════════════════
function CTAFinal() {
  const [ref, inView] = useInView()
  return (
    <section style={{ padding: '100px 24px', background: 'linear-gradient(135deg, rgba(245,158,11,0.08), rgba(99,102,241,0.06))', borderTop: '1px solid rgba(245,158,11,0.1)' }}>
      <div ref={ref} style={{ maxWidth: 720, margin: '0 auto', textAlign: 'center', opacity: inView ? 1 : 0, transform: inView ? 'none' : 'translateY(20px)', transition: 'all 0.7s ease' }}>
        <div style={{ width: 70, height: 70, borderRadius: 20, background: 'rgba(245,158,11,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 24px', fontSize: 34 }}>
          🚀
        </div>
        <h2 style={{ color: '#FFF', fontSize: 'clamp(26px, 4.5vw, 46px)', fontWeight: 900, margin: '0 0 18px 0', lineHeight: 1.2 }}>
          Prêt à transformer votre gestion RH ?
        </h2>
        <p style={{ color: '#AAA', fontSize: 17, lineHeight: 1.7, margin: '0 0 30px 0' }}>
          Pointage, notifications, fiches de paie, jours fériés, reconnaissance faciale, géolocalisation, tâches/équipes…
        </p>
        <div style={{ display: 'flex', gap: 14, justifyContent: 'center', flexWrap: 'wrap' }}>
          <button onClick={() => openWhatsApp('Bonjour En-Check ! Je veux démarrer avec votre solution.')} style={{ display: 'flex', alignItems: 'center', gap: 10, background: 'linear-gradient(135deg,#F59E0B,#D97706)', color: '#000', border: 'none', borderRadius: 14, padding: '16px 30px', fontWeight: 900, fontSize: 17, cursor: 'pointer', fontFamily: 'inherit' }}>
            <WhatsAppIcon /> Commencer maintenant
          </button>
          <button onClick={() => openWhatsApp("Bonjour En-Check ! J'ai des questions avant de commencer.")} style={{ display: 'flex', alignItems: 'center', gap: 10, background: 'transparent', color: '#FFF', border: '2px solid rgba(255,255,255,0.2)', borderRadius: 14, padding: '16px 30px', fontWeight: 900, fontSize: 17, cursor: 'pointer', fontFamily: 'inherit' }}>
            Poser une question
          </button>
        </div>
        <p style={{ color: '#555', fontSize: 13, marginTop: 18 }}>
          Réponse rapide • {PHONE_DISPLAY}
        </p>
      </div>
    </section>
  )
}

// ═══════════════════════════════════════════════════════════
// FOOTER
// ═══════════════════════════════════════════════════════════
function Footer() {
  const scrollTo = (id) => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' })
  return (
    <footer style={{ background: '#050508', borderTop: '1px solid rgba(255,255,255,0.05)', padding: '56px 24px 28px' }}>
      <div style={{ maxWidth: 1200, margin: '0 auto' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: 36, marginBottom: 44 }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
              <Logo size={34} />
              <span style={{ color: '#FFF', fontWeight: 900, fontSize: 17, letterSpacing: 2 }}>EN-CHECK</span>
            </div>
            <p style={{ color: '#555', fontSize: 13, lineHeight: 1.7, margin: '0 0 18px 0' }}>
              Pointage intelligent + paie + notifications + tâches/équipes.
            </p>
            <div style={{ display: 'flex', gap: 8 }}>
              {SOCIALS.map((s, i) => (
                <a key={i} href={s.href} target="_blank" rel="noopener noreferrer" style={{ width: 36, height: 36, borderRadius: 9, background: s.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', color: s.color, textDecoration: 'none', border: `1px solid ${s.color}20` }}>
                  <s.Icon />
                </a>
              ))}
            </div>
          </div>

          <div>
            <h4 style={{ color: '#FFF', fontWeight: 900, fontSize: 14, margin: '0 0 14px 0' }}>Fonctionnalités</h4>
            {[
              'Pointage PIN & QR Code',
              'Reconnaissance faciale',
              'Geofencing GPS',
              'Carte temps réel',
              'Notifications',
              'Tâches & équipes (premium)',
              'Fiches de paie (premium)',
              'Jours fériés (gratuit)',
            ].map((l, i) => (
              <div key={i} style={{ color: '#666', fontSize: 13, padding: '4px 0', lineHeight: 1.6 }}>
                {l}
              </div>
            ))}
          </div>

          <div>
            <h4 style={{ color: '#FFF', fontWeight: 900, fontSize: 14, margin: '0 0 14px 0' }}>Produit</h4>
            {[
              { id: 'features', label: 'Fonctionnalités' },
              { id: 'demo', label: 'Démo vidéo' },
              { id: 'how', label: 'Comment ça marche' },
              { id: 'pricing', label: 'Tarifs' },
              { id: 'contact', label: 'Contact' },
            ].map((l, i) => (
              <button
                key={i}
                onClick={() => scrollTo(l.id)}
                style={{ display: 'block', background: 'none', border: 'none', color: '#666', fontSize: 13, cursor: 'pointer', fontFamily: 'inherit', padding: '4px 0', textAlign: 'left' }}
              >
                {l.label}
              </button>
            ))}
          </div>

          <div>
            <h4 style={{ color: '#FFF', fontWeight: 900, fontSize: 14, margin: '0 0 14px 0' }}>Contact</h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16 }}>
              <a href={`https://wa.me/${WHATSAPP_NUMBER}`} target="_blank" rel="noopener noreferrer" style={{ color: '#25D366', textDecoration: 'none', fontWeight: 800, fontSize: 13, display: 'flex', alignItems: 'center', gap: 8 }}>
                <WhatsAppIcon /> {PHONE_DISPLAY}
              </a>
              <a href={`mailto:${EMAIL}`} style={{ color: '#888', textDecoration: 'none', fontSize: 13 }}>
                ✉️ {EMAIL}
              </a>
              <span style={{ color: '#666', fontSize: 13 }}>📍 Afrique</span>
            </div>
            <button onClick={() => openWhatsApp('Bonjour En-Check ! Je souhaite une démonstration gratuite.')} style={{ display: 'flex', alignItems: 'center', gap: 10, background: 'linear-gradient(135deg,#F59E0B,#D97706)', color: '#000', border: 'none', borderRadius: 12, padding: '12px 14px', fontWeight: 900, cursor: 'pointer', fontFamily: 'inherit', width: '100%', justifyContent: 'center' }}>
              <WhatsAppIcon /> Demander une démo
            </button>
          </div>
        </div>

        <div style={{ borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: 22, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
          <span style={{ color: '#444', fontSize: 13 }}>© {new Date().getFullYear()} En-Check. Tous droits réservés.</span>
          <span style={{ color: '#444', fontSize: 13 }}>EN-CHECK</span>
        </div>
      </div>
    </footer>
  )
}

// ═══════════════════════════════════════════════════════════
// WHATSAPP FLOATING BUTTON
// ═══════════════════════════════════════════════════════════
function WhatsAppFloating() {
  const [visible, setVisible] = useState(false)
  const [showBubble, setShowBubble] = useState(false)

  useEffect(() => {
    const t1 = setTimeout(() => setVisible(true), 1200)
    const t2 = setTimeout(() => setShowBubble(true), 2500)
    const t3 = setTimeout(() => setShowBubble(false), 8000)
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3) }
  }, [])

  return (
    <div style={{ position: 'fixed', bottom: 24, right: 24, zIndex: 9999, opacity: visible ? 1 : 0, transition: 'opacity 0.5s ease', display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 10 }}>
      {showBubble && (
        <div style={{ background: 'rgba(20,20,35,0.97)', border: '1px solid rgba(37,211,102,0.25)', borderRadius: 14, padding: '12px 16px', maxWidth: 240, boxShadow: '0 8px 28px rgba(0,0,0,0.4)' }}>
          <p style={{ color: '#FFF', fontSize: 13, fontWeight: 900, margin: '0 0 6px 0' }}>Bonjour !</p>
          <p style={{ color: '#AAA', fontSize: 12, margin: '0 0 10px 0' }}>Besoin d’un devis ou d’une démo ?</p>
          <button onClick={() => openWhatsApp()} style={{ width: '100%', background: '#25D366', color: '#FFF', border: 'none', borderRadius: 10, padding: '9px 10px', fontWeight: 900, fontSize: 12, cursor: 'pointer', fontFamily: 'inherit' }}>
            Démarrer →
          </button>
        </div>
      )}
      <button onClick={() => openWhatsApp()} style={{ width: 60, height: 60, borderRadius: '50%', background: 'linear-gradient(135deg,#25D366,#128C7E)', color: '#FFF', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 6px 24px rgba(37,211,102,0.45)' }}>
        <WhatsAppIcon />
      </button>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════
// APP
// ═══════════════════════════════════════════════════════════
export default function LandingPage() {
  const [activeSection, setActiveSection] = useState('hero')

  // ✅ Init analytics au montage
  useEffect(() => {
    analytics.init()

    const handleBeforeUnload = () => analytics.finalize()
    const handleVisibilityChange = () => {
      if (document.hidden) analytics.finalize()
    }

    window.addEventListener('beforeunload', handleBeforeUnload)
    document.addEventListener('visibilitychange', handleVisibilityChange)

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload)
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [])

  // ✅ Tracking des sections + activeSection
  useEffect(() => {
    const sections = ['hero', 'features', 'demo', 'how', 'pricing', 'contact']
    const observers = sections.map((id) => {
      const el = document.getElementById(id)
      if (!el) return null
      const obs = new IntersectionObserver(
        ([e]) => {
          if (e.isIntersecting) {
            setActiveSection(id)
            analytics.trackSection(id)
          }
        },
        { threshold: 0.3 }
      )
      obs.observe(el)
      return obs
    })
    return () => observers.forEach((obs) => obs?.disconnect())
  }, [])

  return (
    <>
      <style>{`
        * { margin: 0; padding: 0; box-sizing: border-box; }
        html { scroll-behavior: smooth; }
        body { background: #0A0A0F; font-family: 'Inter', 'Segoe UI', system-ui, sans-serif; color: #FFF; overflow-x: hidden; }
        input:focus, select:focus, textarea:focus { border-color: rgba(245,158,11,0.5) !important; box-shadow: 0 0 0 3px rgba(245,158,11,0.08) !important; }
        ::-webkit-scrollbar { width: 6px; }
        ::-webkit-scrollbar-track { background: #0A0A0F; }
        ::-webkit-scrollbar-thumb { background: #F59E0B; border-radius: 3px; }
        select option { background: #141423; color: #E5E5E5; }
        @keyframes slideInLeft {
          from { transform: translateX(-100px); opacity: 0; }
          to { transform: translateX(0); opacity: 1; }
        }
        @media (max-width: 900px) {
          .nav-desktop { display: none !important; }
          .nav-mobile-btn { display: flex !important; }
        }
        @media (max-width: 900px) {
          #hero > div { grid-template-columns: 1fr !important; }
        }
        @media (max-width: 768px) {
          .contact-grid { grid-template-columns: 1fr !important; }
          .nouvelles-grid { grid-template-columns: 1fr !important; }
          .payroll-holiday-grid { grid-template-columns: 1fr !important; }
          .task-grid { grid-template-columns: 1fr !important; }
        }
      `}</style>

      <div style={{ background: '#0A0A0F', minHeight: '100vh' }}>
        <Navbar activeSection={activeSection} />
        <Hero />
        <Problem />
        <Features />
        <DemoVideo />
        <NewFeatures />
        <TaskManagement />
        <PayrollAndHolidays />
        <HowItWorks />
        <Stats />
        <Temoignages />
        <Pricing />
        <Contact />
        <CTAFinal />
        <Footer />
        <WhatsAppFloating />
        <PWAInstallButton />
      </div>
    </>
  )
}