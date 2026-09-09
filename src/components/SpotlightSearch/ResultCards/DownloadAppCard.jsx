// src/components/SpotlightSearch/ResultCards/DownloadAppCard.jsx

import { Download, Smartphone, CheckCircle, Chrome, AlertCircle, Globe } from 'lucide-react'
import { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'

export default function DownloadAppCard({ result, isSelected, onClick }) {
  const [deferredPrompt, setDeferredPrompt] = useState(null)
  const [isInstalled, setIsInstalled] = useState(false)
  const [browserInfo, setBrowserInfo] = useState({ name: '', canInstall: false })
  const [showModal, setShowModal] = useState(false)

  // ═══ DÉTECTER LE NAVIGATEUR ═══
  useEffect(() => {
    const ua = navigator.userAgent.toLowerCase()
    let name = 'Navigateur'
    let canInstall = false

    if (ua.includes('chrome') && !ua.includes('edg')) {
      name = 'Chrome'
      canInstall = true
    } else if (ua.includes('safari') && !ua.includes('chrome')) {
      name = 'Safari'
      canInstall = true
    } else if (ua.includes('firefox')) {
      name = 'Firefox'
      canInstall = true
    } else if (ua.includes('edg')) {
      name = 'Edge'
      canInstall = true
    }

    setBrowserInfo({ name, canInstall })

    // Vérifier si déjà installé
    if (window.matchMedia('(display-mode: standalone)').matches) {
      setIsInstalled(true)
    }
  }, [])

  // ═══ CAPTURER L'ÉVÉNEMENT beforeinstallprompt ═══
  useEffect(() => {
    const handler = (e) => {
      console.log('✅ beforeinstallprompt capturé !')
      e.preventDefault()
      setDeferredPrompt(e)
    }

    window.addEventListener('beforeinstallprompt', handler)

    return () => {
      window.removeEventListener('beforeinstallprompt', handler)
    }
  }, [])

  // ═══ DÉCLENCHER L'INSTALLATION ═══
  const handleInstall = async () => {
    console.log('🔵 handleInstall appelé')
    console.log('🔍 deferredPrompt:', deferredPrompt)

    if (deferredPrompt) {
      // CAS 1 : Installation native disponible
      try {
        console.log('📱 Affichage du prompt natif...')
        deferredPrompt.prompt()
        const { outcome } = await deferredPrompt.userChoice

        console.log('📊 Résultat:', outcome)

        if (outcome === 'accepted') {
          console.log('✅ Installation acceptée')
          setIsInstalled(true)
        } else {
          console.log('❌ Installation refusée')
        }

        setDeferredPrompt(null)
      } catch (error) {
        console.error('❌ Erreur prompt:', error)
        setShowModal(true)
      }
    } else {
      // CAS 2 : Pas de prompt natif → Afficher instructions manuelles
      console.log('⚠️ Pas de prompt natif → Modal d\'instructions')
      setShowModal(true)
    }
  }

  // ═══ ICÔNE NAVIGATEUR ═══
  const getBrowserIcon = () => {
    if (browserInfo.name === 'Chrome') return <Chrome size={16} color="#10B981" />
    if (browserInfo.name === 'Safari') return <Globe size={16} color="#F59E0B" />
    if (browserInfo.canInstall) return <CheckCircle size={16} color="#10B981" />
    return <AlertCircle size={16} color="#F59E0B" />
  }

  return (
    <>
      <div
        className={`spotlight-result-card spotlight-result-download ${isSelected ? 'spotlight-result-card--selected' : ''}`}
        onClick={onClick}
        style={{
          background: isSelected 
            ? 'linear-gradient(135deg, rgba(245,158,11,0.15), rgba(217,119,6,0.15))' 
            : 'rgba(20,20,35,0.6)',
          border: `1px solid ${isSelected ? 'rgba(245,158,11,0.4)' : 'rgba(255,255,255,0.06)'}`,
          borderRadius: '16px',
          padding: '20px',
          cursor: 'pointer',
          transition: 'all 0.3s ease',
          backdropFilter: 'blur(10px)',
        }}
      >
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '16px', marginBottom: '16px' }}>
          <div style={{
            width: '56px',
            height: '56px',
            borderRadius: '14px',
            background: 'linear-gradient(135deg, #F59E0B, #D97706)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
            boxShadow: '0 8px 24px rgba(245,158,11,0.3)',
          }}>
            {isInstalled ? (
              <CheckCircle size={28} color="#000" />
            ) : (
              <Download size={28} color="#000" />
            )}
          </div>

          <div style={{ flex: 1 }}>
            <h3 style={{
              color: '#FFFFFF',
              fontSize: '18px',
              fontWeight: '700',
              margin: '0 0 6px 0',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
            }}>
              {isInstalled ? 'Application déjà installée' : 'Télécharger EN-CHECK Administration'}
              <Smartphone size={18} color="#F59E0B" />
            </h3>

            <p style={{
              color: '#888',
              fontSize: '14px',
              margin: 0,
              lineHeight: '1.5',
            }}>
              {isInstalled 
                ? 'L\'application est déjà installée sur cet appareil' 
                : 'Installez l\'application pour un accès hors-ligne et des performances optimales'
              }
            </p>
          </div>
        </div>

        {/* Features */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
          gap: '10px',
          marginBottom: '16px',
        }}>
          {[
            { icon: '⚡', label: 'Accès rapide' },
            { icon: '📴', label: 'Mode hors-ligne' },
            { icon: '🔔', label: 'Notifications' },
            { icon: '📱', label: 'Comme une app' },
          ].map((feature, i) => (
            <div key={i} style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '8px 12px',
              background: 'rgba(255,255,255,0.03)',
              borderRadius: '10px',
              fontSize: '13px',
              color: '#E5E5E5',
            }}>
              <span style={{ fontSize: '16px' }}>{feature.icon}</span>
              <span>{feature.label}</span>
            </div>
          ))}
        </div>

        {/* Browser info */}
        {!isInstalled && (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '10px 12px',
            background: browserInfo.canInstall 
              ? 'rgba(16,185,129,0.1)' 
              : 'rgba(245,158,11,0.1)',
            border: `1px solid ${browserInfo.canInstall ? 'rgba(16,185,129,0.2)' : 'rgba(245,158,11,0.2)'}`,
            borderRadius: '10px',
            marginBottom: '16px',
          }}>
            {getBrowserIcon()}
            
            <span style={{
              color: browserInfo.canInstall ? '#10B981' : '#F59E0B',
              fontSize: '12px',
              fontWeight: '600',
            }}>
              {browserInfo.canInstall 
                ? `✓ Compatible avec ${browserInfo.name}` 
                : `Installation manuelle requise sur ${browserInfo.name}`
              }
            </span>
          </div>
        )}

       {/* Install button */}
<button
  onClick={(e) => {
    e.preventDefault()
    e.stopPropagation()
    
    if (!isInstalled) {
      handleInstall()
    }
  }}
  style={{
    width: '100%',
    padding: '14px 20px',
    background: isInstalled 
      ? 'rgba(16,185,129,0.15)' 
      : 'linear-gradient(135deg, #F59E0B, #D97706)',
    border: `1px solid ${isInstalled ? 'rgba(16,185,129,0.3)' : 'transparent'}`,
    borderRadius: '12px',
    color: isInstalled ? '#10B981' : '#000',
    fontSize: '15px',
    fontWeight: '700',
    cursor: isInstalled ? 'default' : 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '10px',
    transition: 'all 0.3s ease',
    fontFamily: 'inherit',
  }}
  disabled={isInstalled}
>
  {isInstalled ? (
    <>
      <CheckCircle size={20} />
      <span>Application installée</span>
    </>
  ) : (
    <>
      <Download size={20} />
      <span>Installer maintenant</span>
    </>
  )}
</button>

        {/* Version info */}
        <div style={{
          marginTop: '12px',
          textAlign: 'center',
          color: '#555',
          fontSize: '11px',
          letterSpacing: '0.5px',
        }}>
          Version 2.0 • PWA • {new Date().getFullYear()}
        </div>
      </div>

      {/* Modal avec portail */}
      {showModal && createPortal(
        <InstallModalInline 
          onClose={() => setShowModal(false)}
          browserName={browserInfo.name}
        />,
        document.body
      )}
    </>
  )
}

// ═══════════════════════════════════════════════════════════
// 🎭 MODAL D'INSTRUCTIONS (VERSION INLINE)
// ═══════════════════════════════════════════════════════════

function InstallModalInline({ onClose, browserName }) {
  useEffect(() => {
    console.log('🎭 Modal d\'installation affiché')
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = ''
    }
  }, [])

  const getInstructions = () => {
    switch (browserName) {
      case 'Chrome':
        return [
          '1️⃣ Cliquez sur le menu ⋮ (3 points) en haut à droite',
          '2️⃣ Sélectionnez "Installer En-Check"',
          '3️⃣ Confirmez l\'installation',
          '✅ L\'app apparaîtra sur votre bureau',
        ]
      
      case 'Safari':
        return [
          '1️⃣ Appuyez sur le bouton Partager ⎙',
          '2️⃣ Sélectionnez "Sur l\'écran d\'accueil"',
          '3️⃣ Donnez un nom et validez',
          '✅ L\'app sera sur votre écran d\'accueil',
        ]
      
      case 'Edge':
        return [
          '1️⃣ Cliquez sur le menu ⋯ en haut à droite',
          '2️⃣ Sélectionnez "Applications" → "Installer"',
          '3️⃣ Confirmez l\'installation',
          '✅ L\'app sera dans votre menu Démarrer',
        ]
      
      default:
        return [
          '1️⃣ Ouvrez le menu de votre navigateur',
          '2️⃣ Cherchez "Installer" ou "Ajouter à l\'écran"',
          '3️⃣ Suivez les instructions',
          '✅ L\'app sera installée',
        ]
    }
  }

  return (
    <>
      {/* Overlay */}
      <div 
        onClick={onClose}
        style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0, 0, 0, 0.9)',
          backdropFilter: 'blur(8px)',
          zIndex: 999999,
        }}
      />

      {/* Modal */}
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          position: 'fixed',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          zIndex: 1000000,
          background: '#141423',
          border: '1px solid rgba(245,158,11,0.3)',
          borderRadius: '24px',
          width: 'min(90vw, 500px)',
          maxHeight: '90vh',
          overflow: 'auto',
          boxShadow: '0 20px 60px rgba(0,0,0,0.8)',
          padding: '32px',
        }}
      >
        <h2 style={{ 
          color: '#F59E0B', 
          fontSize: '24px', 
          fontWeight: '700', 
          margin: '0 0 24px 0',
          textAlign: 'center'
        }}>
          📱 Comment installer EN-CHECK
        </h2>

        <div style={{
          background: 'rgba(245,158,11,0.1)',
          border: '1px solid rgba(245,158,11,0.2)',
          borderRadius: '12px',
          padding: '16px',
          marginBottom: '24px',
          textAlign: 'center',
        }}>
          <p style={{ color: '#F59E0B', fontSize: '14px', fontWeight: '600', margin: 0 }}>
            Navigateur : {browserName}
          </p>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '24px' }}>
          {getInstructions().map((step, i) => (
            <div
              key={i}
              style={{
                padding: '14px',
                background: 'rgba(255,255,255,0.03)',
                border: '1px solid rgba(255,255,255,0.06)',
                borderRadius: '12px',
                color: '#E5E5E5',
                fontSize: '14px',
                lineHeight: '1.6',
              }}
            >
              {step}
            </div>
          ))}
        </div>

        <button
          onClick={onClose}
          style={{
            width: '100%',
            padding: '14px',
            background: 'linear-gradient(135deg, #F59E0B, #D97706)',
            border: 'none',
            borderRadius: '12px',
            color: '#000',
            fontSize: '15px',
            fontWeight: '700',
            cursor: 'pointer',
          }}
        >
          J'ai compris
        </button>
      </div>
    </>
  )
}