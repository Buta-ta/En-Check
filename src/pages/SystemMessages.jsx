// ═══════════════════════════════════════════════════════════
// 📢 PAGE MESSAGES SYSTÈME - STYLE DASHBOARD
// ═══════════════════════════════════════════════════════════

import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useNavigate } from 'react-router-dom'
import { 
  Footprints,
  ArrowLeft,
  AlertTriangle, 
  Info, 
  Wrench, 
  Trash2, 
  Eye, 
  EyeOff,
  Send,
  MessageSquare,
  Calendar,
  Users,
  Zap,
  Bell
} from 'lucide-react'
import toast from 'react-hot-toast'

export default function SystemMessages() {
  const [admin, setAdmin] = useState(null)
  const [messages, setMessages] = useState([])
  const [loading, setLoading] = useState(true)
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [messageToDelete, setMessageToDelete] = useState(null)
  const [formData, setFormData] = useState({
    type: 'info',
    titre: '',
    message: '',
    date_debut: '',
    date_fin: '',
    priorite: 'normale',
    cible: 'tous'
  })

  const navigate = useNavigate()

  useEffect(() => {
    const adminData = localStorage.getItem('admin')
    if (!adminData) {
      navigate('/login')
      return
    }

    const parsedAdmin = JSON.parse(adminData)

    if (parsedAdmin.role !== 'super_admin') {
      toast.error('Accès réservé au Super Admin')
      navigate('/dashboard')
      return
    }

    setAdmin(parsedAdmin)
    fetchMessages()
  }, [navigate])

  const fetchMessages = async () => {
    setLoading(true)
    const { data, error } = await supabase
      .from('messages_systeme')
      .select('*')
      .order('created_at', { ascending: false })

    if (data) setMessages(data)
    setLoading(false)
  }

  const handleSubmit = async (e) => {
    e.preventDefault()

    if (!formData.titre || !formData.message) {
      toast.error('Titre et message obligatoires')
      return
    }

    const formatDateTimeLocal = (localDateTime) => {
      if (!localDateTime) return null
      const [datePart, timePart] = localDateTime.split('T')
      return `${datePart} ${timePart}:00+00:00`
    }

    const dataToInsert = {
      type: formData.type,
      titre: formData.titre,
      message: formData.message,
      date_debut: formatDateTimeLocal(formData.date_debut),
      date_fin: formatDateTimeLocal(formData.date_fin),
      priorite: formData.priorite,
      cible: formData.cible,
      created_by: admin.id,
      is_active: true
    }

    const { error } = await supabase
      .from('messages_systeme')
      .insert([dataToInsert])

    if (error) {
      toast.error('Erreur création message')
      console.error(error)
      return
    }

    toast.success('Message créé avec succès !')
    fetchMessages()

    setFormData({
      type: 'info',
      titre: '',
      message: '',
      date_debut: '',
      date_fin: '',
      priorite: 'normale',
      cible: 'tous'
    })
  }

  const toggleActive = async (id, currentStatus) => {
    const { error } = await supabase
      .from('messages_systeme')
      .update({ is_active: !currentStatus })
      .eq('id', id)

    if (error) {
      toast.error('Erreur mise à jour')
      return
    }

    toast.success(currentStatus ? 'Message désactivé' : 'Message activé')
    fetchMessages()
  }

  const initiateDelete = (msg) => {
    setMessageToDelete(msg)
    setShowDeleteModal(true)
  }

  const confirmDelete = async () => {
    if (!messageToDelete) return

    const { error } = await supabase
      .from('messages_systeme')
      .delete()
      .eq('id', messageToDelete.id)

    if (error) {
      toast.error('Erreur suppression')
      return
    }

    toast.success('Message supprimé')
    setShowDeleteModal(false)
    setMessageToDelete(null)
    fetchMessages()
  }

  const getIcon = (type) => {
    switch (type) {
      case 'maintenance': return <Wrench size={18} color="#F59E0B" />
      case 'mise_a_jour': return <Zap size={18} color="#6366F1" />
      default: return <Info size={18} color="#10B981" />
    }
  }

  const getPriorityStyle = (priorite) => {
    switch (priorite) {
      case 'haute': return { bg: 'rgba(239, 68, 68, 0.15)', color: '#EF4444', border: 'rgba(239, 68, 68, 0.3)' }
      case 'normale': return { bg: 'rgba(245, 158, 11, 0.15)', color: '#F59E0B', border: 'rgba(245, 158, 11, 0.3)' }
      case 'basse': return { bg: 'rgba(16, 185, 129, 0.15)', color: '#10B981', border: 'rgba(16, 185, 129, 0.3)' }
      default: return { bg: 'rgba(245, 158, 11, 0.15)', color: '#F59E0B', border: 'rgba(245, 158, 11, 0.3)' }
    }
  }

  const getTypeStyle = (type) => {
    switch (type) {
      case 'maintenance': return { bg: 'rgba(245, 158, 11, 0.15)', color: '#F59E0B' }
      case 'mise_a_jour': return { bg: 'rgba(99, 102, 241, 0.15)', color: '#818CF8' }
      default: return { bg: 'rgba(16, 185, 129, 0.15)', color: '#10B981' }
    }
  }

  if (loading) {
    return (
      <div style={styles.loadingContainer}>
        <div style={styles.loadingPulse}>
          <Footprints size={50} color="#F59E0B" />
        </div>
        <p style={styles.loadingText}>Chargement des messages...</p>
        <div style={styles.loadingBar}>
          <div style={styles.loadingBarFill}></div>
        </div>
      </div>
    )
  }

  return (
    <>
      <style>{`
        @keyframes fadeInUp {
          from { opacity: 0; transform: translateY(30px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes shimmer {
          0% { background-position: -200% 0; }
          100% { background-position: 200% 0; }
        }
        @keyframes float {
          0%, 100% { transform: translateY(0px); }
          50% { transform: translateY(-10px); }
        }
        .afro-card {
          animation: fadeInUp 0.5s ease forwards;
        }
        .afro-message-card:hover {
          background: rgba(245, 158, 11, 0.05) !important;
          border-color: rgba(245, 158, 11, 0.2) !important;
        }
        .afro-action-btn:hover {
          transform: scale(1.1) !important;
        }
        .afro-submit-btn:hover {
          transform: translateY(-2px) !important;
          box-shadow: 0 8px 25px rgba(245, 158, 11, 0.3) !important;
        }
        ::-webkit-scrollbar { width: 8px; }
        ::-webkit-scrollbar-track { background: #0A0A0F; }
        ::-webkit-scrollbar-thumb { background: #F59E0B; border-radius: 4px; }
      `}</style>

      <div style={styles.container}>
        {/* Background Elements */}
        <div style={styles.bgPattern}></div>
        <div style={styles.bgOrb1}></div>
        <div style={styles.bgOrb2}></div>

        {/* ═══ HEADER ═══ */}
        <header style={styles.header}>
          <div style={styles.headerInner}>
            <div style={styles.headerLeft}>
              <button onClick={() => navigate('/dashboard')} style={styles.backBtn}>
                <ArrowLeft size={20} />
              </button>
              <div style={styles.logoContainer}>
                <Bell size={24} color="#F59E0B" />
              </div>
              <div style={styles.headerTitleWrap}>
                <h1 style={styles.headerTitle}>MESSAGES SYSTÈME</h1>
                <span style={styles.headerSubtitle}>Notifications & alertes</span>
              </div>
            </div>

            <div style={styles.headerRight}>
              <div style={styles.statBadge}>
                <MessageSquare size={16} color="#F59E0B" />
                <span>{messages.length}</span>
              </div>
            </div>
          </div>
        </header>

        {/* ═══ MAIN CONTENT ═══ */}
        <main style={styles.main}>
          {/* Formulaire */}
          <div className="afro-card" style={styles.formCard}>
            <div style={styles.cardHeader}>
              <div style={styles.cardIconWrap}>
                <Send size={22} color="#F59E0B" />
              </div>
              <div>
                <h2 style={styles.cardTitle}>Nouveau Message</h2>
                <p style={styles.cardSubtitle}>Publiez une notification système</p>
              </div>
            </div>

            <form onSubmit={handleSubmit} style={styles.form}>
              <div style={styles.formRow}>
                <div style={styles.formGroup}>
                  <label style={styles.label}>Type</label>
                  <select
                    value={formData.type}
                    onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                    style={styles.select}
                  >
                    <option value="info">Information</option>
                    <option value="maintenance">Maintenance</option>
                    <option value="mise_a_jour">Mise à jour</option>
                  </select>
                </div>

                <div style={styles.formGroup}>
                  <label style={styles.label}>Priorité</label>
                  <select
                    value={formData.priorite}
                    onChange={(e) => setFormData({ ...formData, priorite: e.target.value })}
                    style={styles.select}
                  >
                    <option value="basse">Basse</option>
                    <option value="normale">Normale</option>
                    <option value="haute">Haute</option>
                  </select>
                </div>

                <div style={styles.formGroup}>
                  <label style={styles.label}>Cible</label>
                  <select
                    value={formData.cible}
                    onChange={(e) => setFormData({ ...formData, cible: e.target.value })}
                    style={styles.select}
                  >
                    <option value="tous">Tous</option>
                    <option value="admins">Admins uniquement</option>
                    <option value="employes">Employés uniquement</option>
                  </select>
                </div>
              </div>

              <div style={styles.formGroup}>
                <label style={styles.label}>Titre *</label>
                <input
                  type="text"
                  value={formData.titre}
                  onChange={(e) => setFormData({ ...formData, titre: e.target.value })}
                  placeholder="Ex: Maintenance prévue le 25 janvier"
                  style={styles.input}
                  required
                />
              </div>

              <div style={styles.formGroup}>
                <label style={styles.label}>Message *</label>
                <textarea
                  value={formData.message}
                  onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                  placeholder="Détails du message..."
                  style={styles.textarea}
                  rows="4"
                  required
                />
              </div>

              <div style={styles.formRow}>
                <div style={styles.formGroup}>
                  <label style={styles.label}>
                    <Calendar size={14} />
                    Date début (optionnel)
                  </label>
                  <input
                    type="datetime-local"
                    value={formData.date_debut}
                    onChange={(e) => setFormData({ ...formData, date_debut: e.target.value })}
                    style={styles.input}
                  />
                </div>

                <div style={styles.formGroup}>
                  <label style={styles.label}>
                    <Calendar size={14} />
                    Date fin (optionnel)
                  </label>
                  <input
                    type="datetime-local"
                    value={formData.date_fin}
                    onChange={(e) => setFormData({ ...formData, date_fin: e.target.value })}
                    style={styles.input}
                  />
                </div>
              </div>

              <button type="submit" className="afro-submit-btn" style={styles.submitBtn}>
                <Send size={18} />
                Publier le message
              </button>
            </form>
          </div>

          {/* Liste messages */}
          <div className="afro-card" style={{...styles.listCard, animationDelay: '0.1s'}}>
            <div style={styles.cardHeader}>
              <div style={styles.cardIconWrap}>
                <MessageSquare size={22} color="#F59E0B" />
              </div>
              <div>
                <h2 style={styles.cardTitle}>Messages existants</h2>
                <p style={styles.cardSubtitle}>{messages.length} message(s)</p>
              </div>
            </div>

            {messages.length === 0 ? (
              <div style={styles.emptyState}>
                <div style={styles.emptyIcon}>
                  <MessageSquare size={40} color="#F59E0B" />
                </div>
                <p style={styles.emptyText}>Aucun message créé</p>
              </div>
            ) : (
              <div style={styles.messagesList}>
                {messages.map((msg, index) => (
                  <div
                    key={msg.id}
                    className="afro-message-card"
                    style={{
                      ...styles.messageCard,
                      borderLeftColor: getPriorityStyle(msg.priorite).color,
                      animationDelay: `${index * 0.05}s`
                    }}
                  >
                    <div style={styles.messageHeader}>
                      <div style={styles.messageHeaderLeft}>
                        {getIcon(msg.type)}
                        <span style={styles.messageTitle}>{msg.titre}</span>
                      </div>
                      <div style={styles.badges}>
                        <span style={{
                          ...styles.badge,
                          background: getTypeStyle(msg.type).bg,
                          color: getTypeStyle(msg.type).color
                        }}>
                          {msg.type}
                        </span>
                        <span style={{
                          ...styles.badge,
                          background: 'rgba(99, 102, 241, 0.15)',
                          color: '#818CF8'
                        }}>
                          {msg.cible}
                        </span>
                        <span style={{
                          ...styles.badge,
                          background: msg.is_active ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                          color: msg.is_active ? '#10B981' : '#EF4444'
                        }}>
                          {msg.is_active ? '● Actif' : '○ Inactif'}
                        </span>
                      </div>
                    </div>

                    <p style={styles.messageText}>{msg.message}</p>

                    {(msg.date_debut || msg.date_fin) && (
                      <p style={styles.messageDates}>
                        <Calendar size={12} />
                        {msg.date_debut && `Du ${new Date(msg.date_debut).toLocaleString('fr-FR', { timeZone: 'UTC' })}`}
                        {msg.date_fin && ` au ${new Date(msg.date_fin).toLocaleString('fr-FR', { timeZone: 'UTC' })}`}
                      </p>
                    )}

                    <div style={styles.messageActions}>
                      <button
                        className="afro-action-btn"
                        onClick={() => toggleActive(msg.id, msg.is_active)}
                        style={{
                          ...styles.actionBtn,
                          background: msg.is_active ? 'rgba(239, 68, 68, 0.15)' : 'rgba(16, 185, 129, 0.15)',
                          color: msg.is_active ? '#EF4444' : '#10B981'
                        }}
                        title={msg.is_active ? 'Désactiver' : 'Activer'}
                      >
                        {msg.is_active ? <EyeOff size={16} /> : <Eye size={16} />}
                      </button>
                      <button
                        className="afro-action-btn"
                        onClick={() => initiateDelete(msg)}
                        style={{...styles.actionBtn, background: 'rgba(239, 68, 68, 0.15)', color: '#EF4444'}}
                        title="Supprimer"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Footer */}
          <div style={styles.footer}>
            <div style={styles.footerLine}></div>
            <p style={styles.footerText}>
              <Footprints size={14} color="#F59E0B" />
              EN-CHECK • Messages Système
            </p>
          </div>
        </main>

        {/* ═══ MODAL SUPPRESSION ═══ */}
        {showDeleteModal && messageToDelete && (
          <div style={styles.modalOverlay} onClick={() => setShowDeleteModal(false)}>
            <div style={styles.confirmModal} onClick={e => e.stopPropagation()}>
              <div style={styles.confirmIconWrap}>
                <AlertTriangle size={32} color="#EF4444" />
              </div>
              <h3 style={styles.confirmTitle}>Supprimer ce message ?</h3>
              <p style={styles.confirmText}>
                <strong>"{messageToDelete.titre}"</strong>
                <br />Cette action est irréversible.
              </p>
              <div style={styles.confirmActions}>
                <button onClick={() => setShowDeleteModal(false)} style={styles.cancelBtn}>
                  Annuler
                </button>
                <button onClick={confirmDelete} style={styles.deleteBtn}>
                  Supprimer
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  )
}

// ═══════════════════════════════════════════════════════════
// 🎨 STYLES (MÊME THÈME QUE DASHBOARD)
// ═══════════════════════════════════════════════════════════

const styles = {
  // Container & Background
  container: {
    minHeight: '100vh',
    background: '#0A0A0F',
    position: 'relative',
    overflow: 'hidden',
  },
  bgPattern: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundImage: `
      radial-gradient(circle at 20% 50%, rgba(245, 158, 11, 0.03) 0%, transparent 50%),
      radial-gradient(circle at 80% 20%, rgba(99, 102, 241, 0.03) 0%, transparent 50%),
      radial-gradient(circle at 50% 80%, rgba(16, 185, 129, 0.03) 0%, transparent 50%)
    `,
    pointerEvents: 'none',
    zIndex: 0,
  },
  bgOrb1: {
    position: 'fixed',
    top: '-20%',
    right: '-10%',
    width: '600px',
    height: '600px',
    borderRadius: '50%',
    background: 'radial-gradient(circle, rgba(245, 158, 11, 0.04) 0%, transparent 70%)',
    pointerEvents: 'none',
    zIndex: 0,
  },
  bgOrb2: {
    position: 'fixed',
    bottom: '-30%',
    left: '-15%',
    width: '800px',
    height: '800px',
    borderRadius: '50%',
    background: 'radial-gradient(circle, rgba(99, 102, 241, 0.03) 0%, transparent 70%)',
    pointerEvents: 'none',
    zIndex: 0,
  },

  // Loading
  loadingContainer: {
    minHeight: '100vh',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '24px',
    background: '#0A0A0F',
  },
  loadingPulse: {
    animation: 'float 2s ease-in-out infinite',
  },
  loadingText: {
    color: '#888',
    fontSize: '16px',
    letterSpacing: '2px',
  },
  loadingBar: {
    width: '200px',
    height: '2px',
    background: 'rgba(245,158,11,0.1)',
    borderRadius: '2px',
    overflow: 'hidden',
  },
  loadingBarFill: {
    width: '40%',
    height: '100%',
    background: 'linear-gradient(90deg, #F59E0B, #D97706)',
    borderRadius: '2px',
    animation: 'shimmer 1.5s infinite',
    backgroundSize: '200% 100%',
  },

  // Header
  header: {
    background: 'rgba(15, 15, 25, 0.95)',
    backdropFilter: 'blur(20px)',
    borderBottom: '1px solid rgba(245, 158, 11, 0.15)',
    position: 'sticky',
    top: 0,
    zIndex: 100,
  },
  headerInner: {
    maxWidth: '1200px',
    margin: '0 auto',
    padding: '12px 20px',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: '12px',
  },
  headerLeft: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
  },
  backBtn: {
    width: '40px',
    height: '40px',
    borderRadius: '10px',
    background: 'rgba(245, 158, 11, 0.1)',
    border: '1px solid rgba(245, 158, 11, 0.2)',
    color: '#F59E0B',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
    transition: 'all 0.2s ease',
  },
  logoContainer: {
    width: '42px',
    height: '42px',
    borderRadius: '12px',
    background: 'rgba(245, 158, 11, 0.1)',
    border: '1px solid rgba(245, 158, 11, 0.2)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitleWrap: {
    display: 'flex',
    flexDirection: 'column',
  },
  headerTitle: {
    color: '#FFFFFF',
    fontSize: 'clamp(14px, 3vw, 18px)',
    fontWeight: '700',
    letterSpacing: '2px',
    margin: 0,
    lineHeight: '1.2',
  },
  headerSubtitle: {
    color: '#F59E0B',
    fontSize: '10px',
    letterSpacing: '3px',
    textTransform: 'uppercase',
    fontWeight: '500',
  },
  headerRight: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
  },
  statBadge: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    background: 'rgba(245, 158, 11, 0.1)',
    border: '1px solid rgba(245, 158, 11, 0.2)',
    padding: '8px 16px',
    borderRadius: '10px',
    color: '#F59E0B',
    fontSize: '14px',
    fontWeight: '600',
  },

  // Main
  main: {
    padding: '24px 20px',
    maxWidth: '1000px',
    margin: '0 auto',
    position: 'relative',
    zIndex: 1,
  },

  // Cards
  formCard: {
    background: 'rgba(20, 20, 35, 0.8)',
    backdropFilter: 'blur(10px)',
    border: '1px solid rgba(255,255,255,0.06)',
    borderRadius: '20px',
    padding: '24px',
    marginBottom: '24px',
  },
  listCard: {
    background: 'rgba(20, 20, 35, 0.6)',
    backdropFilter: 'blur(10px)',
    border: '1px solid rgba(255,255,255,0.06)',
    borderRadius: '20px',
    padding: '24px',
  },
  cardHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: '16px',
    marginBottom: '24px',
  },
  cardIconWrap: {
    width: '50px',
    height: '50px',
    borderRadius: '14px',
    background: 'rgba(245, 158, 11, 0.15)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardTitle: {
    color: '#FFFFFF',
    fontSize: '18px',
    fontWeight: '600',
    margin: 0,
  },
  cardSubtitle: {
    color: '#888',
    fontSize: '13px',
    margin: '4px 0 0 0',
  },

  // Form
  form: {
    display: 'flex',
    flexDirection: 'column',
    gap: '16px',
  },
  formRow: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
    gap: '12px',
  },
  formGroup: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
  },
  label: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    fontSize: '13px',
    fontWeight: '500',
    color: '#888',
  },
  input: {
    width: '100%',
    padding: '14px 16px',
    background: 'rgba(255,255,255,0.05)',
    border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: '12px',
    color: '#FFFFFF',
    fontSize: '15px',
    outline: 'none',
    boxSizing: 'border-box',
    transition: 'all 0.3s ease',
  },
  select: {
    width: '100%',
    padding: '14px 16px',
    background: 'rgba(255,255,255,0.05)',
    border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: '12px',
    color: '#FFFFFF',
    fontSize: '15px',
    outline: 'none',
    cursor: 'pointer',
    boxSizing: 'border-box',
  },
  textarea: {
    width: '100%',
    padding: '14px 16px',
    background: 'rgba(255,255,255,0.05)',
    border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: '12px',
    color: '#FFFFFF',
    fontSize: '15px',
    outline: 'none',
    resize: 'vertical',
    boxSizing: 'border-box',
    minHeight: '100px',
  },
  submitBtn: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '10px',
    padding: '16px',
    background: 'linear-gradient(135deg, #F59E0B, #D97706)',
    color: '#000',
    border: 'none',
    borderRadius: '14px',
    fontSize: '16px',
    fontWeight: '700',
    cursor: 'pointer',
    marginTop: '8px',
    transition: 'all 0.3s ease',
  },

  // Empty State
  emptyState: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    padding: '40px 20px',
  },
  emptyIcon: {
    width: '80px',
    height: '80px',
    borderRadius: '50%',
    background: 'rgba(245, 158, 11, 0.1)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: '16px',
  },
  emptyText: {
    color: '#666',
    fontSize: '14px',
  },

  // Messages List
  messagesList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
  },
  messageCard: {
    background: 'rgba(255,255,255,0.03)',
    border: '1px solid rgba(255,255,255,0.06)',
    borderLeft: '4px solid',
    borderRadius: '14px',
    padding: '16px',
    animation: 'fadeInUp 0.5s ease forwards',
    transition: 'all 0.3s ease',
  },
  messageHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: '12px',
    flexWrap: 'wrap',
    gap: '10px',
  },
  messageHeaderLeft: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
  },
  messageTitle: {
    fontWeight: '600',
    color: '#FFFFFF',
    fontSize: '15px',
  },
  badges: {
    display: 'flex',
    gap: '6px',
    flexWrap: 'wrap',
  },
  badge: {
    padding: '4px 10px',
    borderRadius: '20px',
    fontSize: '11px',
    fontWeight: '600',
  },
  messageText: {
    color: '#AAA',
    fontSize: '14px',
    marginBottom: '10px',
    lineHeight: '1.5',
  },
  messageDates: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    fontSize: '12px',
    color: '#666',
    marginBottom: '12px',
  },
  messageActions: {
    display: 'flex',
    gap: '8px',
  },
  actionBtn: {
    width: '36px',
    height: '36px',
    borderRadius: '10px',
    border: 'none',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
    transition: 'all 0.2s ease',
  },

  // Footer
  footer: {
    marginTop: '48px',
    paddingBottom: '24px',
  },
  footerLine: {
    height: '1px',
    background: 'linear-gradient(90deg, transparent, rgba(245, 158, 11, 0.2), transparent)',
    marginBottom: '20px',
  },
  footerText: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '8px',
    color: '#555',
    fontSize: '12px',
    letterSpacing: '2px',
  },

  // Modal
  modalOverlay: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    background: 'rgba(0,0,0,0.8)',
    backdropFilter: 'blur(10px)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '16px',
    zIndex: 200,
  },
  confirmModal: {
    background: '#0F0F19',
    border: '1px solid rgba(239, 68, 68, 0.2)',
    borderRadius: '20px',
    width: '100%',
    maxWidth: '400px',
    padding: '30px',
    textAlign: 'center',
  },
  confirmIconWrap: {
    width: '70px',
    height: '70px',
    borderRadius: '50%',
    background: 'rgba(239, 68, 68, 0.15)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    margin: '0 auto 20px auto',
  },
  confirmTitle: {
    color: '#FFFFFF',
    fontSize: '20px',
    fontWeight: '600',
    margin: '0 0 12px 0',
  },
  confirmText: {
    color: '#888',
    fontSize: '14px',
    lineHeight: '1.6',
    marginBottom: '24px',
  },
  confirmActions: {
    display: 'flex',
    gap: '12px',
  },
  cancelBtn: {
    flex: 1,
    padding: '14px',
    background: 'rgba(255,255,255,0.1)',
    border: '1px solid rgba(255,255,255,0.15)',
    borderRadius: '12px',
    color: '#FFFFFF',
    fontSize: '15px',
    fontWeight: '500',
    cursor: 'pointer',
  },
  deleteBtn: {
    flex: 1,
    padding: '14px',
    background: '#EF4444',
    border: 'none',
    borderRadius: '12px',
    color: '#FFFFFF',
    fontSize: '15px',
    fontWeight: '700',
    cursor: 'pointer',
  },
}