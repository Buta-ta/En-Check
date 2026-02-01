// ═══════════════════════════════════════════════════════════
// 🎫 COMPOSANT BADGE EMPLOYÉ (Avec logo En-Check subtil)
// ═══════════════════════════════════════════════════════════

import { useRef } from 'react'
import { QRCodeSVG } from 'qrcode.react'
import { X, Download, Share2, Footprints } from 'lucide-react'
import html2canvas from 'html2canvas'

export default function BadgeEmploye({ 
  employee, 
  entrepriseName, 
  entrepriseLogo, 
  primaryColor = '#D4AF37', 
  onClose 
}) {
  const badgeRef = useRef(null)

  // Couleur de l'entreprise
  const badgeColor = primaryColor || '#D4AF37'

  // ═══════════════════════════════════════════════════════════
  // 📥 TÉLÉCHARGER LE BADGE EN IMAGE PNG
  // ═══════════════════════════════════════════════════════════
  const downloadBadge = async () => {
    if (!badgeRef.current) return

    try {
      const canvas = await html2canvas(badgeRef.current, {
        scale: 3,
        backgroundColor: null,
        useCORS: true,
        allowTaint: true,
        logging: false
      })

      const link = document.createElement('a')
      link.download = `badge-${employee.matricule}.png`
      link.href = canvas.toDataURL('image/png', 1.0)
      link.click()
    } catch (error) {
      console.error('Erreur téléchargement:', error)
      alert('Erreur lors du téléchargement')
    }
  }

  // ═══════════════════════════════════════════════════════════
  // 📤 PARTAGER LE BADGE
  // ═══════════════════════════════════════════════════════════
  const shareBadge = async () => {
    if (!badgeRef.current) return

    try {
      const canvas = await html2canvas(badgeRef.current, {
        scale: 3,
        backgroundColor: null,
        useCORS: true,
        allowTaint: true,
        logging: false
      })

      canvas.toBlob(async (blob) => {
        if (!blob) {
          alert('Erreur lors de la génération')
          return
        }

        const file = new File([blob], `badge-${employee.matricule}.png`, { 
          type: 'image/png' 
        })

        if (navigator.share && navigator.canShare({ files: [file] })) {
          try {
            await navigator.share({
              title: `Badge - ${employee.first_name} ${employee.last_name}`,
              text: `Badge employé ${employee.matricule}`,
              files: [file]
            })
          } catch (err) {
            if (err.name !== 'AbortError') {
              downloadBadge()
            }
          }
        } else {
          downloadBadge()
          alert('Partage non supporté. Le badge a été téléchargé.')
        }
      }, 'image/png', 1.0)
    } catch (error) {
      console.error('Erreur partage:', error)
      downloadBadge()
    }
  }

  return (
    <div style={styles.overlay}>
      <div style={styles.modal}>
        {/* Header */}
        <div style={styles.header}>
          <h2 style={styles.headerTitle}>Aperçu du Badge</h2>
          <button onClick={onClose} style={styles.closeBtn}>
            <X size={24} />
          </button>
        </div>

        {/* Zone de prévisualisation */}
        <div style={styles.previewArea}>
          <div 
            ref={badgeRef}
            style={{
              ...styles.badgeContent,
              background: `linear-gradient(180deg, ${badgeColor} 0%, ${badgeColor} 32%, #FFFFFF 32%, #FFFFFF 100%)`
            }}
          >
            {/* Empreintes En-Check en filigrane dans le header */}
            <div style={styles.footprintsWatermark}>
              <Footprints size={120} color="rgba(255,255,255,0.1)" />
            </div>

            {/* Contenu du badge */}
            <div style={styles.badgeInner}>
              
              {/* Header avec logo En-Check */}
              <div style={styles.badgeHeader}>
                <Footprints size={18} color="rgba(255,255,255,0.8)" />
                <span style={styles.enCheckText}>EN-CHECK</span>
              </div>

              {/* Nom de l'entreprise */}
              <div style={styles.entrepriseName}>
                {entrepriseName}
              </div>

              {/* Photo */}
              <div style={styles.photoWrapper}>
                <div style={{
                  ...styles.photoCircle,
                  border: `4px solid ${badgeColor}`
                }}>
                  {employee.photo_url ? (
                    <img 
                      src={employee.photo_url} 
                      alt={employee.first_name}
                      style={styles.photo}
                      crossOrigin="anonymous"
                    />
                  ) : (
                    <div style={{
                      ...styles.initials,
                      backgroundColor: badgeColor,
                      color: '#FFFFFF'
                    }}>
                      {employee.first_name?.[0]}{employee.last_name?.[0]}
                    </div>
                  )}
                </div>
              </div>

              {/* Nom de l'employé */}
              <h3 style={styles.employeeName}>
                {employee.first_name} {employee.last_name}
              </h3>

              {/* Poste - avec fond coloré */}
              <div style={{
                ...styles.positionBadge,
                backgroundColor: badgeColor
              }}>
                {employee.position || 'Employé'}
              </div>

              {/* Département si présent */}
              {employee.department && (
                <p style={styles.department}>
                  {employee.department}
                </p>
              )}

              {/* QR Code */}
              <div style={{
                ...styles.qrWrapper,
                borderColor: badgeColor
              }}>
                <QRCodeSVG 
                  value={employee.matricule} 
                  size={75} 
                  level="H"
                  fgColor="#3D2B1F"
                  bgColor="#FFFFFF"
                />
              </div>

              {/* Matricule */}
              <p style={{
                ...styles.matricule,
                color: badgeColor
              }}>
                {employee.matricule}
              </p>

              {/* Footer avec logo entreprise + En-Check */}
              <div style={styles.badgeFooter}>
                {entrepriseLogo ? (
                  <img 
                    src={entrepriseLogo} 
                    alt=""
                    style={styles.entrepriseLogo}
                    crossOrigin="anonymous"
                  />
                ) : (
                  <div style={styles.footerSpacer} />
                )}
                
                {/* Signature En-Check */}
                <div style={styles.enCheckSignature}>
                  <Footprints size={12} color="#CCCCCC" />
                  <span style={styles.poweredBy}>En-Check</span>
                </div>
              </div>
            </div>

            {/* Empreintes décoratives en bas à droite */}
            <div style={styles.footprintsDecor}>
              <Footprints size={50} color="rgba(0,0,0,0.03)" />
            </div>
          </div>
        </div>

        {/* Indication de la couleur */}
        <div style={styles.colorInfo}>
          <span style={{
            ...styles.colorDot,
            backgroundColor: badgeColor
          }} />
          <span style={styles.colorText}>Couleur: {badgeColor}</span>
        </div>

        {/* Boutons d'action */}
        <div style={styles.actions}>
          <button onClick={downloadBadge} style={styles.downloadBtn}>
            <Download size={20} />
            Télécharger
          </button>
          <button onClick={shareBadge} style={{
            ...styles.shareBtn,
            backgroundColor: badgeColor
          }}>
            <Share2 size={20} />
            Partager
          </button>
        </div>
      </div>
    </div>
  )
}

const styles = {
  overlay: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.85)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 2000,
    padding: '20px'
  },
  modal: {
    backgroundColor: '#FFFBF5',
    borderRadius: '20px',
    padding: '24px',
    maxWidth: '420px',
    width: '100%',
    boxShadow: '0 20px 60px rgba(0,0,0,0.3)'
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '20px'
  },
  headerTitle: {
    fontSize: '20px',
    fontWeight: '600',
    color: '#3D2B1F',
    margin: 0
  },
  closeBtn: {
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    color: '#9E9E9E',
    padding: '4px'
  },
  previewArea: {
    display: 'flex',
    justifyContent: 'center',
    marginBottom: '16px'
  },
  badgeContent: {
    width: '280px',
    height: '480px',
    borderRadius: '20px',
    position: 'relative',
    overflow: 'hidden',
    boxShadow: '0 10px 40px rgba(0,0,0,0.25)'
  },
  footprintsWatermark: {
    position: 'absolute',
    top: '-20px',
    right: '-30px',
    transform: 'rotate(25deg)',
    zIndex: 0
  },
  footprintsDecor: {
    position: 'absolute',
    bottom: '60px',
    right: '10px',
    transform: 'rotate(-15deg)',
    zIndex: 0
  },
  badgeInner: {
    position: 'relative',
    zIndex: 1,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    paddingTop: '12px',
    height: '100%'
  },
  badgeHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    marginBottom: '8px'
  },
  enCheckText: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: '10px',
    fontWeight: '600',
    letterSpacing: '2px'
  },
  entrepriseName: {
    color: '#FFFFFF',
    fontSize: '15px',
    fontWeight: '700',
    textTransform: 'uppercase',
    textAlign: 'center',
    letterSpacing: '1.5px',
    marginBottom: '18px',
    textShadow: '0 2px 4px rgba(0,0,0,0.2)',
    padding: '0 15px'
  },
  photoWrapper: {
    marginBottom: '12px'
  },
  photoCircle: {
    width: '95px',
    height: '95px',
    borderRadius: '50%',
    backgroundColor: '#FFFFFF',
    padding: '3px',
    boxShadow: '0 6px 20px rgba(0,0,0,0.2)',
    overflow: 'hidden'
  },
  photo: {
    width: '100%',
    height: '100%',
    borderRadius: '50%',
    objectFit: 'cover'
  },
  initials: {
    width: '100%',
    height: '100%',
    borderRadius: '50%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '30px',
    fontWeight: '700'
  },
  employeeName: {
    fontSize: '18px',
    fontWeight: '800',
    color: '#3D2B1F',
    margin: '5px 0 8px 0',
    textAlign: 'center'
  },
  positionBadge: {
    color: '#FFFFFF',
    fontSize: '10px',
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: '1px',
    padding: '5px 14px',
    borderRadius: '20px',
    marginBottom: '4px'
  },
  department: {
    fontSize: '11px',
    color: '#888888',
    margin: '0 0 12px 0'
  },
  qrWrapper: {
    backgroundColor: '#FFFFFF',
    padding: '8px',
    borderRadius: '12px',
    boxShadow: '0 2px 10px rgba(0,0,0,0.08)',
    borderWidth: '2px',
    borderStyle: 'solid'
  },
  matricule: {
    fontFamily: 'monospace',
    fontSize: '13px',
    fontWeight: '700',
    letterSpacing: '2px',
    marginTop: '8px'
  },
  badgeFooter: {
    position: 'absolute',
    bottom: '12px',
    left: '0',
    right: '0',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '0 15px'
  },
  entrepriseLogo: {
    width: '35px',
    height: '35px',
    objectFit: 'contain',
    opacity: 0.6
  },
  footerSpacer: {
    width: '35px'
  },
  enCheckSignature: {
    display: 'flex',
    alignItems: 'center',
    gap: '4px'
  },
  poweredBy: {
    fontSize: '9px',
    color: '#CCCCCC',
    fontWeight: '500',
    letterSpacing: '0.5px'
  },
  colorInfo: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '8px',
    marginBottom: '16px'
  },
  colorDot: {
    width: '16px',
    height: '16px',
    borderRadius: '50%',
    border: '2px solid #E5D4C0'
  },
  colorText: {
    fontSize: '13px',
    color: '#9E9E9E'
  },
  actions: {
    display: 'flex',
    gap: '12px',
    justifyContent: 'center'
  },
  downloadBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    backgroundColor: '#3D2B1F',
    color: '#FFFFFF',
    border: 'none',
    padding: '14px 24px',
    borderRadius: '12px',
    fontSize: '14px',
    fontWeight: '600',
    cursor: 'pointer'
  },
  shareBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    color: '#FFFFFF',
    border: 'none',
    padding: '14px 24px',
    borderRadius: '12px',
    fontSize: '14px',
    fontWeight: '600',
    cursor: 'pointer'
  }
}