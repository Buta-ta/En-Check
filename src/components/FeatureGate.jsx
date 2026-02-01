// ═══════════════════════════════════════════════════════════
// 🔒 COMPOSANT FEATUREGATE - Protection features payantes
// ═══════════════════════════════════════════════════════════

import { useState, useEffect } from 'react'
import { Lock, X, Sparkles } from 'lucide-react'
import FeatureService from '../services/featureService'

/**
 * Composant qui affiche son contenu uniquement si la feature est active
 * Sinon, affiche un message "Passer à Premium"
 */
export default function FeatureGate({ 
  featureCode, 
  enterpriseId, 
  children,
  fallback = null,
  showUpgradeModal = true 
}) {
  const [hasAccess, setHasAccess] = useState(null) // null = loading
  const [showModal, setShowModal] = useState(false)

  useEffect(() => {
    checkAccess()
  }, [enterpriseId, featureCode])

  const checkAccess = async () => {
    if (!enterpriseId || !featureCode) {
      setHasAccess(false)
      return
    }

    const access = await FeatureService.hasFeature(enterpriseId, featureCode)
    setHasAccess(access)
  }

  // Loading
  if (hasAccess === null) {
    return (
      <div style={styles.loading}>
        <div style={styles.spinner}></div>
      </div>
    )
  }

  // A accès : afficher le contenu
  if (hasAccess) {
    return <>{children}</>
  }

  // Pas d'accès : afficher fallback ou bouton upgrade
  if (fallback) {
    return fallback
  }

  return (
    <>
      <div style={styles.lockedContainer}>
        <Lock size={32} color="#8B6914" />
        <p style={styles.lockedText}>
          Cette fonctionnalité nécessite un plan Premium
        </p>
        {showUpgradeModal && (
          <button 
            style={styles.upgradeBtn}
            onClick={() => setShowModal(true)}
          >
            <Sparkles size={18} />
            Passer à Premium
          </button>
        )}
      </div>

      {/* Modal Upgrade */}
      {showModal && (
        <UpgradeModal 
          featureCode={featureCode}
          onClose={() => setShowModal(false)} 
        />
      )}
    </>
  )
}

/**
 * Modal qui explique la feature et invite à contacter le superadmin
 */
function UpgradeModal({ featureCode, onClose }) {
  const featureNames = {
    modification_pointages: 'Modification des Pointages',
    multi_entreprises: 'Gestion Multi-Entreprises',
    notifications_push: 'Notifications Push',
    gestion_conges: 'Gestion des Congés',
    heures_supplementaires: 'Calcul Heures Supplémentaires',
    photo_pointage: 'Photo lors du Pointage',
    support_ia: 'Support IA',
  }

  const featureDescriptions = {
    modification_pointages: 'Modifiez les heures de pointage avec traçabilité complète',
    multi_entreprises: 'Gérez jusqu\'à 3 entreprises avec un seul compte',
    notifications_push: 'Recevez des alertes en temps réel (présences, retards, etc.)',
    gestion_conges: 'Système complet de demandes et validations de congés',
    heures_supplementaires: 'Calcul automatique avec majorations paramétrables',
    photo_pointage: 'Capture automatique lors du pointage pour sécurité maximale',
    support_ia: 'Assistance IA disponible 24/7 via Telegram',
  }

  return (
    <div style={styles.modalOverlay} onClick={onClose}>
      <div style={styles.modalContent} onClick={(e) => e.stopPropagation()}>
        <button style={styles.closeBtn} onClick={onClose}>
          <X size={24} />
        </button>

        <div style={styles.modalHeader}>
          <Sparkles size={48} color="#8B6914" />
          <h2 style={styles.modalTitle}>
            {featureNames[featureCode] || 'Fonctionnalité Premium'}
          </h2>
          <p style={styles.modalDescription}>
            {featureDescriptions[featureCode]}
          </p>
        </div>

        <div style={styles.modalBody}>
          <div style={styles.planCard}>
            <h3 style={styles.planName}>Plan Pro</h3>
            <ul style={styles.planFeatures}>
              <li>✓ Modification des pointages</li>
              <li>✓ Multi-entreprises (jusqu'à 3)</li>
              <li>✓ Heures supplémentaires</li>
              <li>✓ Support prioritaire</li>
            </ul>
          </div>

          <div style={styles.planCard}>
            <h3 style={styles.planName}>Plan Entreprise</h3>
            <ul style={styles.planFeatures}>
              <li>✓ Toutes les fonctionnalités Pro</li>
              <li>✓ Notifications Push illimitées</li>
              <li>✓ Gestion congés avancée</li>
              <li>✓ Photo pointage</li>
              <li>✓ Support IA 24/7</li>
              <li>✓ Entreprises illimitées</li>
            </ul>
          </div>
        </div>

        <div style={styles.modalFooter}>
          <p style={styles.contactText}>
            Contactez votre administrateur système pour activer cette fonctionnalité
          </p>
          <button style={styles.okBtn} onClick={onClose}>
            J'ai compris
          </button>
        </div>
      </div>
    </div>
  )
}

const styles = {
  loading: {
    display: 'flex',
    justifyContent: 'center',
    padding: '40px',
  },
  spinner: {
    width: '40px',
    height: '40px',
    border: '4px solid #E5D4C0',
    borderTop: '4px solid #8B6914',
    borderRadius: '50%',
    animation: 'spin 1s linear infinite',
  },
  lockedContainer: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '60px 20px',
    background: '#FFFBF5',
    borderRadius: '16px',
    border: '2px dashed #C4A574',
  },
  lockedText: {
    marginTop: '16px',
    color: '#8B6914',
    fontSize: '16px',
    fontWeight: '500',
    textAlign: 'center',
  },
  upgradeBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    marginTop: '20px',
    padding: '12px 24px',
    background: '#8B6914',
    color: '#FFFBF5',
    border: 'none',
    borderRadius: '10px',
    fontSize: '16px',
    fontWeight: '600',
    cursor: 'pointer',
  },
  modalOverlay: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    background: 'rgba(0, 0, 0, 0.5)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000,
    padding: '20px',
  },
  modalContent: {
    background: '#FFFBF5',
    borderRadius: '20px',
    maxWidth: '700px',
    width: '100%',
    maxHeight: '90vh',
    overflow: 'auto',
    position: 'relative',
  },
  closeBtn: {
    position: 'absolute',
    top: '16px',
    right: '16px',
    background: 'rgba(61, 43, 31, 0.1)',
    border: 'none',
    borderRadius: '50%',
    width: '40px',
    height: '40px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
    color: '#3D2B1F',
  },
  modalHeader: {
    textAlign: 'center',
    padding: '40px 40px 20px',
    borderBottom: '1px solid #E5D4C0',
  },
  modalTitle: {
    fontSize: '28px',
    color: '#3D2B1F',
    marginTop: '16px',
    marginBottom: '8px',
  },
  modalDescription: {
    fontSize: '16px',
    color: '#8B6914',
    marginTop: '8px',
  },
  modalBody: {
    padding: '30px 40px',
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
    gap: '20px',
  },
  planCard: {
    background: 'linear-gradient(135deg, #E5D4C0 0%, #C4A574 100%)',
    padding: '24px',
    borderRadius: '16px',
  },
  planName: {
    fontSize: '20px',
    fontWeight: '600',
    color: '#3D2B1F',
    marginBottom: '16px',
  },
  planFeatures: {
    listStyle: 'none',
    padding: 0,
    margin: 0,
  },
  modalFooter: {
    padding: '20px 40px 40px',
    textAlign: 'center',
    borderTop: '1px solid #E5D4C0',
  },
  contactText: {
    fontSize: '14px',
    color: '#8B6914',
    marginBottom: '16px',
  },
  okBtn: {
    padding: '12px 32px',
    background: '#8B6914',
    color: '#FFFBF5',
    border: 'none',
    borderRadius: '10px',
    fontSize: '16px',
    fontWeight: '600',
    cursor: 'pointer',
  },
}

// Animation spinner (ajoutez dans un fichier CSS global ou inline)
const styleSheet = document.styleSheets[0]
styleSheet.insertRule(`
  @keyframes spin {
    0% { transform: rotate(0deg); }
    100% { transform: rotate(360deg); }
  }
`, styleSheet.cssRules.length)