// src/components/InstallModal.jsx

import { X, Chrome, Smartphone, Download, Share, MoreVertical, Tablet } from 'lucide-react'
import { useEffect } from 'react'

export default function InstallModal({ isOpen, onClose, browserName }) {
  // Bloquer le scroll du body quand le modal est ouvert
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => {
      document.body.style.overflow = ''
    }
  }, [isOpen])

  if (!isOpen) return null

  // Instructions selon le navigateur
  const getInstructions = () => {
    switch (browserName) {
      case 'Chrome':
        return {
          icon: <Chrome size={32} color="#10B981" />,
          steps: [
            { emoji: '1️⃣', text: 'Cliquez sur le menu ⋮ (3 points verticaux) en haut à droite' },
            { emoji: '2️⃣', text: 'Sélectionnez "Installer En-Check" ou "Ajouter à l\'écran d\'accueil"' },
            { emoji: '3️⃣', text: 'Confirmez l\'installation dans la popup' },
            { emoji: '✅', text: 'L\'application apparaîtra sur votre bureau/écran d\'accueil' },
          ]
        }
      
      case 'Safari':
        return {
          icon: <Smartphone size={32} color="#F59E0B" />,
          steps: [
            { emoji: '1️⃣', text: 'Appuyez sur le bouton Partager ⎙ (en bas de l\'écran)' },
            { emoji: '2️⃣', text: 'Faites défiler et sélectionnez "Sur l\'écran d\'accueil"' },
            { emoji: '3️⃣', text: 'Donnez un nom (ou gardez "En-Check")' },
            { emoji: '✅', text: 'Appuyez sur "Ajouter" en haut à droite' },
          ]
        }
      
      case 'Edge':
        return {
          icon: <Chrome size={32} color="#6366F1" />,
          steps: [
            { emoji: '1️⃣', text: 'Cliquez sur le menu ⋯ (3 points) en haut à droite' },
            { emoji: '2️⃣', text: 'Sélectionnez "Applications" → "Installer En-Check"' },
            { emoji: '3️⃣', text: 'Confirmez l\'installation' },
            { emoji: '✅', text: 'L\'app sera disponible dans votre menu Démarrer' },
          ]
        }
      
      case 'Firefox':
        return {
          icon: <Download size={32} color="#EC4899" />,
          steps: [
            { emoji: '1️⃣', text: 'Cliquez sur le menu ☰ (3 lignes) en haut à droite' },
            { emoji: '2️⃣', text: 'Sélectionnez "Installer"' },
            { emoji: '3️⃣', text: 'Confirmez dans la fenêtre qui s\'ouvre' },
            { emoji: '✅', text: 'L\'application sera installée' },
          ]
        }
      
      default:
        return {
          icon: <Tablet size={32} color="#8B5CF6" />,
          steps: [
            { emoji: '1️⃣', text: 'Ouvrez le menu de votre navigateur' },
            { emoji: '2️⃣', text: 'Cherchez "Installer", "Ajouter à l\'écran d\'accueil" ou "Installer l\'application"' },
            { emoji: '3️⃣', text: 'Suivez les instructions affichées' },
            { emoji: '✅', text: 'L\'app sera disponible comme une application native' },
          ]
        }
    }
  }

  const instructions = getInstructions()

  return (
    <>
      {/* Overlay */}
      <div 
        style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0, 0, 0, 0.85)',
          backdropFilter: 'blur(8px)',
          zIndex: 20000,
          animation: 'fadeIn 0.2s ease',
        }}
        onClick={onClose}
      />

      {/* Modal */}
      <div
        style={{
          position: 'fixed',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          zIndex: 20001,
          background: '#141423',
          border: '1px solid rgba(245,158,11,0.2)',
          borderRadius: '24px',
          width: 'min(90vw, 520px)',
          maxHeight: '90vh',
          overflow: 'auto',
          boxShadow: '0 20px 60px rgba(0,0,0,0.5)',
          animation: 'slideUp 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{
          padding: '24px',
          borderBottom: '1px solid rgba(255,255,255,0.06)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
            <div style={{
              width: '50px',
              height: '50px',
              borderRadius: '14px',
              background: 'linear-gradient(135deg, #F59E0B, #D97706)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}>
              {instructions.icon}
            </div>
            <div>
              <h2 style={{ color: '#FFF', fontSize: '20px', fontWeight: '700', margin: 0 }}>
                Installer EN-CHECK
              </h2>
              <p style={{ color: '#888', fontSize: '13px', margin: '4px 0 0 0' }}>
                Application Web Progressive (PWA)
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            style={{
              width: '40px',
              height: '40px',
              borderRadius: '12px',
              background: 'rgba(255,255,255,0.05)',
              border: '1px solid rgba(255,255,255,0.1)',
              color: '#888',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'all 0.2s ease',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'rgba(239,68,68,0.1)'
              e.currentTarget.style.borderColor = 'rgba(239,68,68,0.3)'
              e.currentTarget.style.color = '#EF4444'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'rgba(255,255,255,0.05)'
              e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)'
              e.currentTarget.style.color = '#888'
            }}
          >
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div style={{ padding: '24px' }}>
          {/* Browser badge */}
          <div style={{
            padding: '12px 16px',
            background: 'rgba(245,158,11,0.1)',
            border: '1px solid rgba(245,158,11,0.2)',
            borderRadius: '14px',
            marginBottom: '24px',
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
          }}>
            <Smartphone size={18} color="#F59E0B" />
            <span style={{ color: '#F59E0B', fontSize: '14px', fontWeight: '600' }}>
              Navigateur détecté : {browserName}
            </span>
          </div>

          {/* Steps */}
          <h3 style={{ color: '#FFF', fontSize: '16px', fontWeight: '600', margin: '0 0 16px 0' }}>
            📖 Instructions :
          </h3>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {instructions.steps.map((step, index) => (
              <div
                key={index}
                style={{
                  padding: '14px 16px',
                  background: 'rgba(255,255,255,0.03)',
                  border: '1px solid rgba(255,255,255,0.06)',
                  borderRadius: '12px',
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '12px',
                }}
              >
                <span style={{ fontSize: '20px', flexShrink: 0 }}>{step.emoji}</span>
                <p style={{ color: '#E5E5E5', fontSize: '14px', margin: 0, lineHeight: '1.6' }}>
                  {step.text}
                </p>
              </div>
            ))}
          </div>

          {/* Benefits */}
          <div style={{
            marginTop: '24px',
            padding: '16px',
            background: 'rgba(16,185,129,0.1)',
            border: '1px solid rgba(16,185,129,0.2)',
            borderRadius: '14px',
          }}>
            <h4 style={{ color: '#10B981', fontSize: '14px', fontWeight: '700', margin: '0 0 12px 0' }}>
              ✨ Avantages de l'installation :
            </h4>
            <ul style={{ color: '#AAA', fontSize: '13px', margin: 0, paddingLeft: '20px', lineHeight: '1.8' }}>
              <li>Accès ultra-rapide depuis votre bureau/écran d'accueil</li>
              <li>Fonctionne hors-ligne (mode avion)</li>
              <li>Notifications push en temps réel</li>
              <li>Aucune mise à jour manuelle requise</li>
              <li>Interface plein écran sans barre de navigation</li>
            </ul>
          </div>
        </div>

        {/* Footer */}
        <div style={{
          padding: '20px 24px',
          borderTop: '1px solid rgba(255,255,255,0.06)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '12px',
        }}>
          <span style={{ color: '#666', fontSize: '12px' }}>
            💡 Astuce : Cherchez l'icône d'installation dans la barre d'adresse
          </span>

          <button
            onClick={onClose}
            style={{
              padding: '10px 20px',
              background: 'rgba(245,158,11,0.15)',
              border: '1px solid rgba(245,158,11,0.3)',
              borderRadius: '10px',
              color: '#F59E0B',
              fontSize: '14px',
              fontWeight: '700',
              cursor: 'pointer',
              transition: 'all 0.2s ease',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'rgba(245,158,11,0.25)'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'rgba(245,158,11,0.15)'
            }}
          >
            Compris
          </button>
        </div>
      </div>

      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes slideUp {
          from {
            opacity: 0;
            transform: translate(-50%, -45%) scale(0.95);
          }
          to {
            opacity: 1;
            transform: translate(-50%, -50%) scale(1);
          }
        }
      `}</style>
    </>
  )
}