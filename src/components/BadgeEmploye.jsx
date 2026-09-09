// ═══════════════════════════════════════════════════════════
// 🎫 COMPOSANT BADGE EMPLOYÉ - AFROFUTURISTE (QR SCANNABLE)
// ═══════════════════════════════════════════════════════════

import { useRef, useState } from 'react'
import { QRCodeSVG } from 'qrcode.react'
import { X, Download, Share2, Footprints, Sparkles, CheckCircle2 } from 'lucide-react'
import html2canvas from 'html2canvas'

export default function BadgeEmploye({ 
  employee, 
  entrepriseName, 
  entrepriseLogo, 
  primaryColor = '#D4AF37', 
  onClose 
}) {
  const badgeRef = useRef(null)
  const [downloading, setDownloading] = useState(false)
  const [downloadSuccess, setDownloadSuccess] = useState(false)

  const badgeColor = primaryColor || '#D4AF37'

  // ═══════════════════════════════════════════════════════════
  // 📥 TÉLÉCHARGER LE BADGE EN IMAGE PNG
  // ═══════════════════════════════════════════════════════════
  const downloadBadge = async () => {
    if (!badgeRef.current) return
    setDownloading(true)

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

      setDownloadSuccess(true)
      setTimeout(() => setDownloadSuccess(false), 2000)
    } catch (error) {
      console.error('Erreur téléchargement:', error)
      alert('Erreur lors du téléchargement')
    }
    setDownloading(false)
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
    <>
      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes slideUp {
          from { opacity: 0; transform: translateY(30px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
        .badge-overlay {
          animation: fadeIn 0.3s ease;
        }
        .badge-modal {
          animation: slideUp 0.4s ease;
        }
        .badge-download-btn:hover:not(:disabled) {
          transform: translateY(-2px);
          box-shadow: 0 8px 25px rgba(0,0,0,0.4);
        }
        .badge-share-btn:hover:not(:disabled) {
          transform: translateY(-2px);
          box-shadow: 0 8px 25px rgba(245, 158, 11, 0.4);
        }
        .badge-close-btn:hover {
          background: rgba(239, 68, 68, 0.15);
          color: #EF4444;
        }
      `}</style>

      <div className="badge-overlay" style={styles.overlay}>
        {/* Background particles */}
        <div style={styles.bgParticle1}></div>
        <div style={styles.bgParticle2}></div>

        <div className="badge-modal" style={styles.modal}>
          {/* Header */}
          <div style={styles.header}>
            <div style={styles.headerLeft}>
              <div style={{
                ...styles.headerIcon,
                background: `${badgeColor}15`,
                borderColor: `${badgeColor}30`,
              }}>
                <Sparkles size={18} color={badgeColor} />
              </div>
              <div>
                <h2 style={styles.headerTitle}>Badge Employé</h2>
                <span style={styles.headerSub}>Aperçu et téléchargement</span>
              </div>
            </div>
            <button onClick={onClose} className="badge-close-btn" style={styles.closeBtn}>
              <X size={20} />
            </button>
          </div>

          {/* Zone de prévisualisation */}
          <div style={styles.previewArea}>
            {/* Glow effect */}
            <div style={{
              ...styles.previewGlow,
              background: `radial-gradient(ellipse, ${badgeColor}20, transparent 70%)`,
            }}></div>

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

                {/* QR Code - IDENTIQUE À L'ORIGINAL */}
                <div style={{
                  ...styles.qrWrapper,
                  borderColor: badgeColor
                }}>
                    {/* ⭐ LIVRAISON 11 — le QR porte désormais le JETON du badge
                        (qr_token), et non le matricule. Le matricule n'est pas un
                        secret : il est écrit en clair sur le badge, alors qu'un jeton
                        peut être remplacé. S'il manque, on retombe sur le matricule —
                        mais l'application exigera alors le PIN, car un identifiant
                        seul n'authentifie personne. */}
                    <QRCodeSVG 
                      value={employee.qr_token || employee.matricule} 
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
            <span style={styles.colorLabel}>Couleur entreprise</span>
            <span style={styles.colorHex}>{badgeColor}</span>
          </div>

          {/* Boutons d'action */}
          <div style={styles.actions}>
            <button 
              onClick={downloadBadge} 
              className="badge-download-btn"
              style={styles.downloadBtn}
              disabled={downloading}
            >
              {downloading ? (
                <div style={styles.spinner}></div>
              ) : downloadSuccess ? (
                <CheckCircle2 size={18} color="#10B981" />
              ) : (
                <Download size={18} />
              )}
              <span>
                {downloading ? 'Génération...' : downloadSuccess ? 'Téléchargé !' : 'Télécharger'}
              </span>
            </button>
            <button 
              onClick={shareBadge} 
              className="badge-share-btn"
              style={{
                ...styles.shareBtn,
                backgroundColor: badgeColor
              }}
            >
              <Share2 size={18} />
              <span>Partager</span>
            </button>
          </div>

          {/* Footer tip */}
          <p style={styles.footerTip}>
            💡 Export haute résolution (3x)
          </p>
        </div>
      </div>
    </>
  )
}

const styles = {
  // ═══ OVERLAY ═══
  overlay: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(6, 6, 12, 0.95)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 2000,
    padding: '20px',
  },
  bgParticle1: {
    position: 'absolute',
    top: '20%',
    left: '15%',
    width: '300px',
    height: '300px',
    borderRadius: '50%',
    background: 'radial-gradient(circle, rgba(245, 158, 11, 0.06), transparent 70%)',
    pointerEvents: 'none',
  },
  bgParticle2: {
    position: 'absolute',
    bottom: '15%',
    right: '20%',
    width: '250px',
    height: '250px',
    borderRadius: '50%',
    background: 'radial-gradient(circle, rgba(99, 102, 241, 0.04), transparent 70%)',
    pointerEvents: 'none',
  },

  // ═══ MODAL ═══
  modal: {
    backgroundColor: '#0F0F18',
    borderRadius: '24px',
    border: '1px solid rgba(255, 255, 255, 0.08)',
    padding: '24px',
    maxWidth: '420px',
    width: '100%',
    boxShadow: '0 30px 80px rgba(0,0,0,0.5)',
    position: 'relative',
    zIndex: 1,
  },

  // ═══ HEADER ═══
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '24px',
  },
  headerLeft: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
  },
  headerIcon: {
    width: '42px',
    height: '42px',
    borderRadius: '12px',
    border: '1px solid',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: '18px',
    fontWeight: '700',
    color: '#FFFFFF',
    margin: 0,
  },
  headerSub: {
    fontSize: '12px',
    color: '#666',
  },
  closeBtn: {
    background: 'rgba(255, 255, 255, 0.05)',
    border: '1px solid rgba(255, 255, 255, 0.1)',
    borderRadius: '10px',
    padding: '10px',
    cursor: 'pointer',
    color: '#888',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    transition: 'all 0.2s ease',
  },

  // ═══ PREVIEW AREA ═══
  previewArea: {
    display: 'flex',
    justifyContent: 'center',
    marginBottom: '20px',
    position: 'relative',
    padding: '16px 0',
  },
  previewGlow: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    transform: 'translate(-50%, -50%)',
    width: '320px',
    height: '500px',
    borderRadius: '30px',
    pointerEvents: 'none',
  },

  // ═══ BADGE CONTENT (IDENTIQUE À L'ORIGINAL) ═══
  badgeContent: {
    width: '280px',
    height: '480px',
    borderRadius: '20px',
    position: 'relative',
    overflow: 'hidden',
    boxShadow: '0 20px 60px rgba(0,0,0,0.4)',
  },
  footprintsWatermark: {
    position: 'absolute',
    top: '-20px',
    right: '-30px',
    transform: 'rotate(25deg)',
    zIndex: 0,
  },
  footprintsDecor: {
    position: 'absolute',
    bottom: '60px',
    right: '10px',
    transform: 'rotate(-15deg)',
    zIndex: 0,
  },
  badgeInner: {
    position: 'relative',
    zIndex: 1,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    paddingTop: '12px',
    height: '100%',
  },
  badgeHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    marginBottom: '8px',
  },
  enCheckText: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: '10px',
    fontWeight: '600',
    letterSpacing: '2px',
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
    padding: '0 15px',
  },
  photoWrapper: {
    marginBottom: '12px',
  },
  photoCircle: {
    width: '95px',
    height: '95px',
    borderRadius: '50%',
    backgroundColor: '#FFFFFF',
    padding: '3px',
    boxShadow: '0 6px 20px rgba(0,0,0,0.2)',
    overflow: 'hidden',
  },
  photo: {
    width: '100%',
    height: '100%',
    borderRadius: '50%',
    objectFit: 'cover',
  },
  initials: {
    width: '100%',
    height: '100%',
    borderRadius: '50%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '30px',
    fontWeight: '700',
  },
  employeeName: {
    fontSize: '18px',
    fontWeight: '800',
    color: '#3D2B1F',
    margin: '5px 0 8px 0',
    textAlign: 'center',
  },
  positionBadge: {
    color: '#FFFFFF',
    fontSize: '10px',
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: '1px',
    padding: '5px 14px',
    borderRadius: '20px',
    marginBottom: '4px',
  },
  department: {
    fontSize: '11px',
    color: '#888888',
    margin: '0 0 12px 0',
  },
  qrWrapper: {
    backgroundColor: '#FFFFFF',
    padding: '8px',
    borderRadius: '12px',
    boxShadow: '0 2px 10px rgba(0,0,0,0.08)',
    borderWidth: '2px',
    borderStyle: 'solid',
  },
  matricule: {
    fontFamily: 'monospace',
    fontSize: '13px',
    fontWeight: '700',
    letterSpacing: '2px',
    marginTop: '8px',
  },
  badgeFooter: {
    position: 'absolute',
    bottom: '12px',
    left: '0',
    right: '0',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '0 15px',
  },
  entrepriseLogo: {
    width: '35px',
    height: '35px',
    objectFit: 'contain',
    opacity: 0.6,
  },
  footerSpacer: {
    width: '35px',
  },
  enCheckSignature: {
    display: 'flex',
    alignItems: 'center',
    gap: '4px',
  },
  poweredBy: {
    fontSize: '9px',
    color: '#CCCCCC',
    fontWeight: '500',
    letterSpacing: '0.5px',
  },

  // ═══ COLOR INFO ═══
  colorInfo: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '10px',
    marginBottom: '20px',
    padding: '12px 16px',
    background: 'rgba(255, 255, 255, 0.03)',
    borderRadius: '12px',
    border: '1px solid rgba(255, 255, 255, 0.05)',
  },
  colorDot: {
    width: '16px',
    height: '16px',
    borderRadius: '50%',
    border: '2px solid rgba(255, 255, 255, 0.2)',
  },
  colorLabel: {
    fontSize: '13px',
    color: '#666',
  },
  colorHex: {
    fontSize: '12px',
    color: '#888',
    fontFamily: 'monospace',
    background: 'rgba(255, 255, 255, 0.05)',
    padding: '3px 8px',
    borderRadius: '6px',
  },

  // ═══ ACTIONS ═══
  actions: {
    display: 'flex',
    gap: '12px',
    justifyContent: 'center',
  },
  downloadBtn: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '8px',
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    border: '1px solid rgba(255, 255, 255, 0.12)',
    color: '#FFFFFF',
    padding: '14px 24px',
    borderRadius: '12px',
    fontSize: '14px',
    fontWeight: '600',
    cursor: 'pointer',
    transition: 'all 0.2s ease',
    flex: 1,
  },
  shareBtn: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '8px',
    color: '#FFFFFF',
    border: 'none',
    padding: '14px 24px',
    borderRadius: '12px',
    fontSize: '14px',
    fontWeight: '600',
    cursor: 'pointer',
    transition: 'all 0.2s ease',
    flex: 1,
  },
  spinner: {
    width: '18px',
    height: '18px',
    border: '2px solid rgba(255, 255, 255, 0.2)',
    borderTopColor: '#FFFFFF',
    borderRadius: '50%',
    animation: 'spin 0.8s linear infinite',
  },

  // ═══ FOOTER TIP ═══
  footerTip: {
    textAlign: 'center',
    color: '#555',
    fontSize: '12px',
    marginTop: '16px',
    marginBottom: 0,
  },
}