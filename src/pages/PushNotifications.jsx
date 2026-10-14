// src/pages/PushNotifications.jsx
// ═══════════════════════════════════════════════════════════
// 📢 GESTION NOTIFICATIONS PUSH MANUELLES (SUPERADMIN)
// ═══════════════════════════════════════════════════════════

import { useCallback, useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { 
  Send, Users, Building2, User, AlertTriangle, Info, Bell, Mail,
  CheckCircle2, XCircle, ArrowLeft, Trash2, Volume2, VolumeX,
  Calendar, Clock, Target, Sparkles, TrendingUp, Filter, X
} from 'lucide-react'
import toast from 'react-hot-toast'
import { useNavigate } from 'react-router-dom'
import EmailDeliveryMonitor from '../components/EmailDeliveryMonitor'

export default function PushNotifications() {
  const navigate = useNavigate()
  const [admin, setAdmin] = useState(null)
  const [loading, setLoading] = useState(false)
  const [soundEnabled, setSoundEnabled] = useState(true)
  const [initialLoading, setInitialLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('push')

  // Form state
  const [targetType, setTargetType] = useState('all')
  const [targetId, setTargetId] = useState('')
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [severity, setSeverity] = useState('info')
  const [requireInteraction, setRequireInteraction] = useState(false)

  // Lists
  const [enterprises, setEnterprises] = useState([])
  const [admins, setAdmins] = useState([])
  const [employees, setEmployees] = useState([])

  // Logs
  const [logs, setLogs] = useState([])
  const [loadingLogs, setLoadingLogs] = useState(false)
  const [filterSeverity, setFilterSeverity] = useState('all')
  const [filterTarget, setFilterTarget] = useState('all')

  // Stats
  const [stats, setStats] = useState({
    total: 0,
    today: 0,
    success_rate: 0,
    by_severity: { info: 0, warning: 0, critical: 0 }
  })

  const fetchLists = useCallback(async () => {
    const [ents, adms, emps] = await Promise.all([
      supabase.from('enterprises').select('id, name, logo_url').eq('is_active', true).order('name'),
      supabase.from('admins').select('id, first_name, last_name, email, enterprise_id').eq('is_active', true).order('first_name'),
      supabase.from('employees').select('id, first_name, last_name, email, enterprise_id').eq('is_active', true).order('first_name'),
    ])

    setEnterprises(ents.data || [])
    setAdmins(adms.data || [])
    setEmployees(emps.data || [])
  }, [])

  const fetchLogs = useCallback(async () => {
    setLoadingLogs(true)
    let query = supabase
      .from('push_logs')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(100)

    if (filterSeverity !== 'all') {
      query = query.eq('payload->severity', filterSeverity)
    }

    if (filterTarget !== 'all') {
      query = query.eq('target_type', filterTarget)
    }

    const { data } = await query
    setLogs(data || [])
    setLoadingLogs(false)
  }, [filterSeverity, filterTarget])

  const loadStats = useCallback(async () => {
    const today = new Date().toISOString().split('T')[0]
    const startOfDay = `${today}T00:00:00`
    const endOfDay = `${today}T23:59:59`

    const { data: allLogs } = await supabase
      .from('push_logs')
      .select('*')

    const { data: todayLogs } = await supabase
      .from('push_logs')
      .select('*')
      .gte('created_at', startOfDay)
      .lte('created_at', endOfDay)

    const total = allLogs?.length || 0
    const today_count = todayLogs?.length || 0

    const totalSent = allLogs?.reduce((sum, log) => sum + (log.success_count || 0), 0) || 0
    const totalFailed = allLogs?.reduce((sum, log) => sum + (log.failed_count || 0), 0) || 0
    const success_rate = totalSent + totalFailed > 0
      ? Math.round((totalSent / (totalSent + totalFailed)) * 100)
      : 0

    const by_severity = {
      info: allLogs?.filter(l => l.payload?.severity === 'info').length || 0,
      warning: allLogs?.filter(l => l.payload?.severity === 'warning').length || 0,
      critical: allLogs?.filter(l => l.payload?.severity === 'critical').length || 0,
    }

    setStats({ total, today: today_count, success_rate, by_severity })
  }, [])

  useEffect(() => {
    let active = true
    let soundTimer
    const initPage = async () => {
      let adminData = {}
      try { adminData = JSON.parse(localStorage.getItem('admin') || '{}') } catch { /* session invalide */ }
      if (adminData.role !== 'super_admin') {
        toast.error('Accès réservé aux super admins')
        navigate('/dashboard')
        return
      }
      if (!active) return
      setAdmin(adminData)

      await Promise.all([fetchLists(), loadStats()])
      if (!active) return

      const soundPref = localStorage.getItem('push_sound_enabled')
      if (soundPref !== null) setSoundEnabled(soundPref === 'true')
      soundTimer = window.setTimeout(() => setInitialLoading(false), 800)
    }

    initPage()
    return () => {
      active = false
      if (soundTimer) window.clearTimeout(soundTimer)
    }
  }, [navigate, fetchLists, loadStats])

  useEffect(() => {
    const timer = window.setTimeout(() => { fetchLogs() }, 0)
    return () => window.clearTimeout(timer)
  }, [fetchLogs])

  const handleSend = async (e) => {
    e.preventDefault()

    if (!title.trim() || !body.trim()) {
      toast.error('Titre et message requis')
      return
    }

    setLoading(true)

    try {
      const payload = {
        user_type: targetType === 'admins' ? 'admin' : targetType === 'employees' ? 'employee' : null,
        enterprise_id: targetType === 'enterprise' ? targetId : null,
        user_ids: (targetType === 'admin' || targetType === 'employee') && targetId ? [targetId] : null,
        title,
        body,
        url: '/',
        tag: 'manual-push',
        severity,
        requireInteraction,
        vibrate: severity === 'critical' ? [250, 100, 250, 100, 250] : severity === 'warning' ? [200, 80, 200] : [200, 100, 200],
      }

      const { data: session } = await supabase.auth.getSession()
      if (!session.session) {
        toast.error('Session expirée')
        setLoading(false)
        return
      }

      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/send-push`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.session.access_token}`,
        },
        body: JSON.stringify(payload),
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || 'Erreur envoi')
      }

      // Jouer un son si activé
      if (soundEnabled) {
        const audio = new Audio('/sounds/success.mp3')
        audio.volume = 0.5
        audio.play().catch(() => {})
      }

      toast.success(`✅ ${result.sent} notification(s) envoyée(s)`, {
        duration: 4000,
        icon: '🔔',
      })
      
      // Reset form
      setTitle('')
      setBody('')
      setSeverity('info')
      setRequireInteraction(false)
      setTargetType('all')
      setTargetId('')

      fetchLogs()
      loadStats()
    } catch (err) {
      console.error(err)
      toast.error(err.message || 'Erreur envoi')
    } finally {
      setLoading(false)
    }
  }

  const deleteLog = async (logId) => {
    if (!confirm('Supprimer cette entrée de l\'historique ?')) return

    const { error } = await supabase.from('push_logs').delete().eq('id', logId)
    if (error) {
      toast.error('Erreur suppression')
      return
    }

    toast.success('Entrée supprimée')
    fetchLogs()
    loadStats()
  }

  const clearAllLogs = async () => {
    if (!confirm('⚠️ Supprimer TOUT l\'historique des notifications push ?\n\nCette action est irréversible.')) return

    const { error } = await supabase.from('push_logs').delete().neq('id', '00000000-0000-0000-0000-000000000000')
    if (error) {
      toast.error('Erreur suppression')
      return
    }

    toast.success('Historique vidé')
    setLogs([])
    loadStats()
  }

  const toggleSound = () => {
    const newValue = !soundEnabled
    setSoundEnabled(newValue)
    localStorage.setItem('push_sound_enabled', newValue.toString())
    toast.success(newValue ? '🔊 Sons activés' : '🔇 Sons désactivés', { duration: 2000 })
  }

  // Loading Screen
  if (initialLoading) {
    return (
      <>
        <style>{`
          @keyframes spin { to { transform: rotate(360deg); } }
          @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.5; } }
          @keyframes float { 0%, 100% { transform: translateY(0px); } 50% { transform: translateY(-10px); } }
          @keyframes ripple {
            0% { transform: scale(1); opacity: 0.6; }
            100% { transform: scale(1.5); opacity: 0; }
          }
        `}</style>
        <div style={styles.loadingScreen}>
          <div style={styles.loadingContent}>
            <div style={styles.loadingIconWrapper}>
              <div style={styles.ripple1} />
              <div style={styles.ripple2} />
              <div style={styles.ripple3} />
              <div style={styles.loadingIcon}>
                <Bell size={40} color="#F59E0B" style={{ animation: 'float 2s ease-in-out infinite' }} />
              </div>
            </div>
            <h2 style={styles.loadingTitle}>Notifications Push</h2>
            <p style={styles.loadingText}>Chargement des données...</p>
            <div style={styles.loadingBar}>
              <div style={styles.loadingBarFill} />
            </div>
          </div>
        </div>
      </>
    )
  }

  if (!admin) return null

  return (
    <>
      <style>{`
        @keyframes slideIn { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.5; } }
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes spin { to { transform: rotate(360deg); } }
        .push-card { animation: slideIn 0.4s ease forwards; }
        .push-stat-card:hover { transform: translateY(-4px); box-shadow: 0 12px 40px rgba(245,158,11,0.2); }
        .push-log-item:hover { background: rgba(245,158,11,0.06) !important; border-color: rgba(245,158,11,0.3) !important; }
        .delete-btn:hover { background: rgba(239,68,68,0.2) !important; color: #EF4444 !important; }
      `}</style>

      <div style={styles.pageShell}>
        <div style={styles.page}>
        {/* HEADER */}
        <div style={styles.header}>
          <div style={styles.headerLeft}>
            <button onClick={() => navigate('/dashboard')} style={styles.backBtn}>
              <ArrowLeft size={20} />
            </button>
            <div style={styles.iconWrap}>
              <Bell size={24} color="#F59E0B" />
            </div>
            <div>
              <h1 style={styles.title}>Notifications</h1>
              <p style={styles.subtitle}>Push et suivi de tous les e-mails d’alerte</p>
            </div>
          </div>
          <div style={styles.headerRight}>
            {activeTab === 'push' && (
              <button onClick={toggleSound} style={styles.soundBtn} title={soundEnabled ? 'Désactiver les sons' : 'Activer les sons'}>
                {soundEnabled ? <Volume2 size={18} color="#10B981" /> : <VolumeX size={18} color="#666" />}
              </button>
            )}
          </div>
        </div>

        <div style={styles.channelTabs} role="tablist" aria-label="Canal de notification">
          <button type="button" role="tab" aria-selected={activeTab === 'push'} onClick={() => setActiveTab('push')} style={{ ...styles.channelTab, ...(activeTab === 'push' ? styles.channelTabActive : {}) }}>
            <Bell size={16} /> Notifications Push
          </button>
          <button type="button" role="tab" aria-selected={activeTab === 'email'} onClick={() => setActiveTab('email')} style={{ ...styles.channelTab, ...(activeTab === 'email' ? styles.channelTabActive : {}) }}>
            <Mail size={16} /> E-mails automatiques
          </button>
        </div>

        {activeTab === 'push' ? (
          <>
        {/* STATS */}
        <div style={styles.statsGrid}>
          <div className="push-stat-card" style={{ ...styles.statCard, borderColor: 'rgba(51,65,85,.68)' }}>
            <div style={{ ...styles.statIcon, background: 'rgba(245,158,11,0.15)' }}>
              <Send size={20} color="#F59E0B" />
            </div>
            <div>
              <span style={styles.statValue}>{stats.total}</span>
              <span style={styles.statLabel}>Total envoyé</span>
            </div>
          </div>

          <div className="push-stat-card" style={{ ...styles.statCard, borderColor: 'rgba(51,65,85,.68)' }}>
            <div style={{ ...styles.statIcon, background: 'rgba(16,185,129,0.15)' }}>
              <Calendar size={20} color="#10B981" />
            </div>
            <div>
              <span style={styles.statValue}>{stats.today}</span>
              <span style={styles.statLabel}>Aujourd'hui</span>
            </div>
          </div>

          <div className="push-stat-card" style={{ ...styles.statCard, borderColor: 'rgba(51,65,85,.68)' }}>
            <div style={{ ...styles.statIcon, background: 'rgba(99,102,241,0.15)' }}>
              <TrendingUp size={20} color="#6366F1" />
            </div>
            <div>
              <span style={styles.statValue}>{stats.success_rate}%</span>
              <span style={styles.statLabel}>Taux de succès</span>
            </div>
          </div>

          <div className="push-stat-card" style={{ ...styles.statCard, borderColor: 'rgba(51,65,85,.68)' }}>
            <div style={{ ...styles.statIcon, background: 'rgba(139,92,246,0.15)' }}>
              <Target size={20} color="#8B5CF6" />
            </div>
            <div>
              <span style={styles.statValue}>{stats.by_severity.critical}</span>
              <span style={styles.statLabel}>Critiques</span>
            </div>
          </div>
        </div>

        <div style={styles.content}>
          {/* FORM */}
          <div className="push-card" style={styles.card}>
            <div style={styles.cardHeader}>
              <div style={styles.cardHeaderLeft}>
                <Sparkles size={20} color="#F59E0B" />
                <h2 style={styles.cardTitle}>Composer une notification</h2>
              </div>
            </div>

            <form onSubmit={handleSend} style={styles.form}>
              {/* Target Type */}
              <div style={styles.field}>
                <label style={styles.label}>
                  <Target size={14} />
                  Destinataires
                </label>
                <select 
                  value={targetType} 
                  onChange={(e) => { setTargetType(e.target.value); setTargetId('') }} 
                  style={styles.select}
                  disabled={loading}
                >
                  <option value="all">📢 Tous (admins + employés)</option>
                  <option value="admins">👔 Tous les admins</option>
                  <option value="employees">👷 Tous les employés</option>
                  <option value="enterprise">🏢 Une entreprise</option>
                  <option value="admin">👤 Un admin</option>
                  <option value="employee">👤 Un employé</option>
                </select>
              </div>

              {/* Target ID */}
              {targetType === 'enterprise' && (
                <div style={styles.field}>
                  <label style={styles.label}>
                    <Building2 size={14} />
                    Entreprise
                  </label>
                  <select value={targetId} onChange={(e) => setTargetId(e.target.value)} style={styles.select} required disabled={loading}>
                    <option value="">-- Sélectionner --</option>
                    {enterprises.map(e => (
                      <option key={e.id} value={e.id}>{e.name}</option>
                    ))}
                  </select>
                </div>
              )}

              {targetType === 'admin' && (
                <div style={styles.field}>
                  <label style={styles.label}>
                    <User size={14} />
                    Admin
                  </label>
                  <select value={targetId} onChange={(e) => setTargetId(e.target.value)} style={styles.select} required disabled={loading}>
                    <option value="">-- Sélectionner --</option>
                    {admins.map(a => (
                      <option key={a.id} value={a.id}>{a.first_name} {a.last_name} ({a.email})</option>
                    ))}
                  </select>
                </div>
              )}

              {targetType === 'employee' && (
                <div style={styles.field}>
                  <label style={styles.label}>
                    <Users size={14} />
                    Employé
                  </label>
                  <select value={targetId} onChange={(e) => setTargetId(e.target.value)} style={styles.select} required disabled={loading}>
                    <option value="">-- Sélectionner --</option>
                    {employees.map(e => (
                      <option key={e.id} value={e.id}>{e.first_name} {e.last_name} ({e.email})</option>
                    ))}
                  </select>
                </div>
              )}

              {/* Title */}
              <div style={styles.field}>
                <label style={styles.label}>
                  <Bell size={14} />
                  Titre
                </label>
                <input 
                  type="text" 
                  value={title} 
                  onChange={(e) => setTitle(e.target.value)} 
                  placeholder="Ex: Maintenance planifiée" 
                  style={styles.input} 
                  required 
                  maxLength={200}
                  disabled={loading}
                />
                <span style={styles.charCount}>{title.length}/200</span>
              </div>

              {/* Body */}
              <div style={styles.field}>
                <label style={styles.label}>
                  <AlertTriangle size={14} />
                  Message
                </label>
                <textarea 
                  value={body} 
                  onChange={(e) => setBody(e.target.value)} 
                  placeholder="Contenu de la notification..." 
                  style={styles.textarea} 
                  required 
                  maxLength={500} 
                  rows={4}
                  disabled={loading}
                />
                <span style={styles.charCount}>{body.length}/500</span>
              </div>

              {/* Severity */}
              <div style={styles.field}>
                <label style={styles.label}>
                  <Info size={14} />
                  Priorité
                </label>
                <div style={styles.radioGroup}>
                  <label style={{ ...styles.radio, ...(severity === 'info' ? styles.radioActive : {}) }}>
                    <input type="radio" value="info" checked={severity === 'info'} onChange={(e) => setSeverity(e.target.value)} disabled={loading} />
                    <Info size={16} color="#3B82F6" />
                    <span>Info</span>
                  </label>
                  <label style={{ ...styles.radio, ...(severity === 'warning' ? styles.radioActive : {}) }}>
                    <input type="radio" value="warning" checked={severity === 'warning'} onChange={(e) => setSeverity(e.target.value)} disabled={loading} />
                    <AlertTriangle size={16} color="#F59E0B" />
                    <span>Alerte</span>
                  </label>
                  <label style={{ ...styles.radio, ...(severity === 'critical' ? styles.radioActive : {}) }}>
                    <input type="radio" value="critical" checked={severity === 'critical'} onChange={(e) => setSeverity(e.target.value)} disabled={loading} />
                    <AlertTriangle size={16} color="#EF4444" />
                    <span>Critique</span>
                  </label>
                </div>
              </div>

              {/* Require Interaction */}
              <label style={styles.checkbox}>
                <input type="checkbox" checked={requireInteraction} onChange={(e) => setRequireInteraction(e.target.checked)} disabled={loading} />
                <span>Nécessite une action de l'utilisateur</span>
              </label>

              <button type="submit" disabled={loading} style={styles.submitBtn}>
                {loading ? (
                  <>
                    <div style={styles.spinner} />
                    Envoi en cours...
                  </>
                ) : (
                  <>
                    <Send size={18} />
                    Envoyer la notification
                  </>
                )}
              </button>
            </form>
          </div>

          {/* LOGS */}
          <div className="push-card" style={{ ...styles.card, animationDelay: '0.1s' }}>
            <div style={styles.cardHeader}>
              <div style={styles.cardHeaderLeft}>
                <Clock size={20} color="#F59E0B" />
                <h2 style={styles.cardTitle}>Historique des envois</h2>
                <span style={styles.badge}>{logs.length}</span>
              </div>
              <div style={styles.cardHeaderRight}>
                {logs.length > 0 && (
                  <button onClick={clearAllLogs} style={styles.clearBtn} title="Vider l'historique">
                    <Trash2 size={16} />
                    Tout supprimer
                  </button>
                )}
              </div>
            </div>

            {/* Filters */}
            <div style={styles.filters}>
              <div style={styles.filterGroup}>
                <Filter size={14} color="#888" />
                <select value={filterSeverity} onChange={(e) => setFilterSeverity(e.target.value)} style={styles.filterSelect}>
                  <option value="all">Toutes priorités</option>
                  <option value="info">Info</option>
                  <option value="warning">Alerte</option>
                  <option value="critical">Critique</option>
                </select>
              </div>

              <div style={styles.filterGroup}>
                <Target size={14} color="#888" />
                <select value={filterTarget} onChange={(e) => setFilterTarget(e.target.value)} style={styles.filterSelect}>
                  <option value="all">Tous types</option>
                  <option value="all">Broadcast</option>
                  <option value="admins">Admins</option>
                  <option value="employees">Employés</option>
                  <option value="enterprise">Entreprise</option>
                  <option value="individual">Individuel</option>
                </select>
              </div>
            </div>

            {loadingLogs ? (
              <p style={{ color: '#888', textAlign: 'center', padding: '40px 20px' }}>Chargement...</p>
            ) : logs.length === 0 ? (
              <div style={styles.empty}>
                <Bell size={48} color="#333" />
                <p style={styles.emptyText}>Aucun envoi pour le moment</p>
                <p style={styles.emptySub}>Les notifications envoyées apparaîtront ici</p>
              </div>
            ) : (
              <div style={styles.logsList}>
                {logs.map(log => {
                  const severityConfig = {
                    info: { color: '#3B82F6', icon: Info },
                    warning: { color: '#F59E0B', icon: AlertTriangle },
                    critical: { color: '#EF4444', icon: AlertTriangle },
                  }
                  
                  const config = severityConfig[log.payload?.severity] || severityConfig.info
                  const Icon = config.icon

                  return (
                    <div key={log.id} className="push-log-item" style={styles.logItem}>
                      <div style={styles.logLeft}>
                        <div style={{ ...styles.logIcon, background: `${config.color}15`, borderColor: `${config.color}30` }}>
                          <Icon size={16} color={config.color} />
                        </div>
                        <div style={styles.logContent}>
                          <div style={styles.logHeader}>
                            <strong style={{ color: '#FFF', fontSize: '14px' }}>{log.title}</strong>
                            <span style={styles.logDate}>
                              {new Date(log.created_at).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                            </span>
                          </div>
                          <p style={styles.logBody}>{log.body}</p>
                          <div style={styles.logStats}>
                            <span style={styles.logStat}>
                              <CheckCircle2 size={14} color="#10B981" />
                              {log.success_count} envoyé{log.success_count > 1 ? 's' : ''}
                            </span>
                            {log.failed_count > 0 && (
                              <span style={{ ...styles.logStat, color: '#EF4444' }}>
                                <XCircle size={14} color="#EF4444" />
                                {log.failed_count} échoué{log.failed_count > 1 ? 's' : ''}
                              </span>
                            )}
                            <span style={{ color: '#555', fontSize: '11px' }}>
                              {log.target_type === 'all' ? '📢 Broadcast' : 
                               log.target_type === 'admins' ? '👔 Admins' : 
                               log.target_type === 'employees' ? '👷 Employés' : 
                               log.target_type === 'enterprise' ? '🏢 Entreprise' : 
                               '👤 Individuel'}
                            </span>
                          </div>
                        </div>
                      </div>
                      <button onClick={() => deleteLog(log.id)} className="delete-btn" style={styles.deleteBtn} title="Supprimer">
                        <Trash2 size={16} />
                      </button>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>
          </>
        ) : (
          <EmailDeliveryMonitor />
        )}
        </div>
      </div>
    </>
  )
}

const styles = {
  channelTabs: { display: 'flex', gap: '8px', padding: '5px', width: 'fit-content', maxWidth: '100%', overflowX: 'auto', borderRadius: '13px', background: 'rgba(15,23,42,.55)', border: '1px solid rgba(51,65,85,.7)', marginBottom: '18px' },
  channelTab: { display: 'inline-flex', alignItems: 'center', gap: '8px', border: '1px solid transparent', borderRadius: '10px', padding: '10px 14px', background: 'transparent', color: '#94A3B8', cursor: 'pointer', fontWeight: 650, fontFamily: 'inherit', whiteSpace: 'nowrap' },
  channelTabActive: { color: '#F8FAFC', background: 'rgba(245,158,11,0.12)', borderColor: 'rgba(245,158,11,0.25)' },
  // Loading Screen
  loadingScreen: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    background: 'linear-gradient(135deg, #0A0A0F 0%, #1a1a2e 100%)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 9999,
  },
  
  loadingContent: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '24px',
  },
  
  loadingIconWrapper: {
    position: 'relative',
    width: '120px',
    height: '120px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  
  loadingIcon: {
    width: '80px',
    height: '80px',
    background: 'rgba(245,158,11,0.1)',
    border: '2px solid rgba(245,158,11,0.3)',
    borderRadius: '20px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    zIndex: 2,
  },
  
  ripple1: {
    position: 'absolute',
    width: '100%',
    height: '100%',
    borderRadius: '50%',
    border: '2px solid rgba(245,158,11,0.4)',
    animation: 'ripple 2s infinite',
    animationDelay: '0s',
  },
  
  ripple2: {
    position: 'absolute',
    width: '100%',
    height: '100%',
    borderRadius: '50%',
    border: '2px solid rgba(245,158,11,0.4)',
    animation: 'ripple 2s infinite',
    animationDelay: '0.5s',
  },
  
  ripple3: {
    position: 'absolute',
    width: '100%',
    height: '100%',
    borderRadius: '50%',
    border: '2px solid rgba(245,158,11,0.4)',
    animation: 'ripple 2s infinite',
    animationDelay: '1s',
  },
  
  loadingTitle: {
    color: '#FFF',
    fontSize: '28px',
    fontWeight: '700',
    margin: 0,
    letterSpacing: '-0.5px',
  },
  
  loadingText: {
    color: '#888',
    fontSize: '14px',
    margin: 0,
    animation: 'pulse 1.5s ease-in-out infinite',
  },
  
  loadingBar: {
    width: '200px',
    height: '4px',
    background: 'rgba(255,255,255,0.1)',
    borderRadius: '10px',
    overflow: 'hidden',
    marginTop: '8px',
  },
  
  loadingBarFill: {
    height: '100%',
    background: 'linear-gradient(90deg, #F59E0B, #D97706)',
    borderRadius: '10px',
    animation: 'loading 1.5s ease-in-out infinite',
  },

  // The shell paints the full viewport so wide displays never reveal a light gutter.
  pageShell: { width: '100%', minHeight: '100vh', background: '#0A0A0F', color: '#E5E7EB', overflowX: 'hidden' },
  page: { width: '100%', maxWidth: '1440px', minHeight: '100vh', boxSizing: 'border-box', padding: '24px clamp(16px, 2.5vw, 36px)', margin: '0 auto', background: 'transparent' },
  
  header: { 
    display: 'flex', 
    alignItems: 'center', 
    justifyContent: 'space-between', 
    marginBottom: '24px',
    flexWrap: 'wrap',
    gap: '16px',
  },
  headerLeft: { display: 'flex', alignItems: 'center', gap: '16px', flex: 1 },
  headerRight: { display: 'flex', alignItems: 'center', gap: '12px' },
  
  backBtn: {
    width: '40px',
    height: '40px',
    borderRadius: '12px',
    background: 'rgba(245,158,11,0.1)',
    border: '1px solid rgba(245,158,11,0.2)',
    color: '#F59E0B',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
    transition: 'all 0.2s ease',
  },
  
  soundBtn: {
    width: '40px',
    height: '40px',
    borderRadius: '12px',
    background: 'rgba(255,255,255,0.04)',
    border: '1px solid rgba(51,65,85,0.68)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
    transition: 'all 0.2s ease',
  },
  
  iconWrap: { 
    width: '48px', 
    height: '48px', 
    borderRadius: '14px', 
    background: 'rgba(245,158,11,0.1)', 
    border: '1px solid rgba(245,158,11,0.2)', 
    display: 'flex', 
    alignItems: 'center', 
    justifyContent: 'center' 
  },
  
  title: { color: '#FFF', fontSize: '26px', fontWeight: '700', margin: 0 },
  subtitle: { color: '#888', fontSize: '13px', margin: '4px 0 0' },
  
  statsGrid: { 
    display: 'grid', 
    gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', 
    gap: '16px', 
    marginBottom: '24px' 
  },
  
  statCard: { 
    display: 'flex', 
    alignItems: 'center', 
    gap: '16px', 
    padding: '20px', 
    background: 'rgba(20,20,30,0.6)', 
    border: '1px solid rgba(51,65,85,0.68)',
    borderRadius: '16px',
    transition: 'all 0.3s ease',
  },
  
  statIcon: { 
    width: '44px', 
    height: '44px', 
    borderRadius: '12px', 
    display: 'flex', 
    alignItems: 'center', 
    justifyContent: 'center',
    border: '1px solid',
  },
  
  statValue: { display: 'block', color: '#FFF', fontSize: '24px', fontWeight: '700', lineHeight: 1 },
  statLabel: { display: 'block', color: '#888', fontSize: '12px', marginTop: '4px' },
  
  content: { 
    display: 'grid', 
    gridTemplateColumns: '1fr 1fr', 
    gap: '20px',
    '@media (max-width: 1024px)': { gridTemplateColumns: '1fr' },
  },
  
  card: { 
    background: 'rgba(15,23,42,0.72)',
    border: '1px solid rgba(51,65,85,0.7)',
    borderRadius: '18px', 
    padding: '24px',
    backdropFilter: 'blur(10px)',
    boxShadow: '0 12px 32px rgba(0,0,0,.18)',
  },
  
  cardHeader: { 
    display: 'flex', 
    justifyContent: 'space-between', 
    alignItems: 'center', 
    marginBottom: '20px',
    flexWrap: 'wrap',
    gap: '12px',
  },
  
  cardHeaderLeft: { display: 'flex', alignItems: 'center', gap: '12px' },
  cardHeaderRight: { display: 'flex', alignItems: 'center', gap: '8px' },
  
  cardTitle: { color: '#FFF', fontSize: '18px', fontWeight: '700', margin: 0 },
  
  badge: {
    background: 'rgba(245,158,11,0.15)',
    color: '#F59E0B',
    padding: '4px 12px',
    borderRadius: '12px',
    fontSize: '12px',
    fontWeight: '700',
  },
  
  clearBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    padding: '8px 16px',
    background: 'rgba(239,68,68,0.1)',
    border: '1px solid rgba(239,68,68,0.2)',
    borderRadius: '10px',
    color: '#EF4444',
    fontSize: '13px',
    fontWeight: '600',
    cursor: 'pointer',
    fontFamily: 'inherit',
    transition: 'all 0.2s ease',
  },
  
  filters: {
    display: 'flex',
    gap: '12px',
    marginBottom: '16px',
    flexWrap: 'wrap',
  },
  
  filterGroup: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    flex: 1,
    minWidth: '160px',
  },
  
  filterSelect: {
    flex: 1,
    padding: '8px 12px',
    background: 'rgba(255,255,255,0.04)',
    border: '1px solid rgba(51,65,85,0.78)',
    borderRadius: '10px',
    color: '#FFF',
    fontSize: '13px',
    fontFamily: 'inherit',
    outline: 'none',
  },
  
  form: { display: 'flex', flexDirection: 'column', gap: '16px' },
  
  field: { display: 'flex', flexDirection: 'column', gap: '8px', position: 'relative' },
  
  label: { 
    display: 'flex', 
    alignItems: 'center', 
    gap: '8px', 
    color: '#AAA', 
    fontSize: '12px', 
    fontWeight: '600', 
    textTransform: 'uppercase', 
    letterSpacing: '0.5px' 
  },
  
  input: { 
    padding: '12px 14px', 
    background: 'rgba(255,255,255,0.04)', 
    border: '1px solid rgba(51,65,85,0.78)',
    borderRadius: '10px', 
    color: '#FFF', 
    fontSize: '14px', 
    fontFamily: 'inherit', 
    outline: 'none',
    transition: 'all 0.2s ease',
  },
  
  textarea: { 
    padding: '12px 14px', 
    background: 'rgba(255,255,255,0.04)', 
    border: '1px solid rgba(51,65,85,0.78)',
    borderRadius: '10px', 
    color: '#FFF', 
    fontSize: '14px', 
    fontFamily: 'inherit', 
    outline: 'none', 
    resize: 'vertical',
    transition: 'all 0.2s ease',
  },
  
  select: { 
    padding: '12px 14px', 
    background: 'rgba(255,255,255,0.04)', 
    border: '1px solid rgba(51,65,85,0.78)',
    borderRadius: '10px', 
    color: '#FFF', 
    fontSize: '14px', 
    fontFamily: 'inherit', 
    outline: 'none',
    transition: 'all 0.2s ease',
  },
  
  charCount: {
    position: 'absolute',
    right: '12px',
    bottom: '12px',
    color: '#555',
    fontSize: '11px',
    fontWeight: '500',
  },
  
  radioGroup: { display: 'flex', gap: '12px', flexWrap: 'wrap' },
  
  radio: { 
    display: 'flex', 
    alignItems: 'center', 
    gap: '8px', 
    padding: '10px 14px', 
    background: 'rgba(255,255,255,0.04)', 
    border: '1px solid rgba(51,65,85,0.68)',
    borderRadius: '10px', 
    cursor: 'pointer', 
    color: '#CCC', 
    fontSize: '13px',
    fontWeight: '500',
    transition: 'all 0.2s ease',
  },
  
  radioActive: {
    background: 'rgba(245,158,11,0.1)',
    borderColor: 'rgba(245,158,11,0.3)',
    color: '#F59E0B',
  },
  
  checkbox: { 
    display: 'flex', 
    alignItems: 'center', 
    gap: '10px', 
    color: '#CCC', 
    fontSize: '13px', 
    cursor: 'pointer',
    fontWeight: '500',
  },
  
  submitBtn: { 
    display: 'flex', 
    alignItems: 'center', 
    justifyContent: 'center', 
    gap: '10px', 
    padding: '14px', 
    background: 'linear-gradient(135deg, #F59E0B, #D97706)', 
    color: '#000', 
    borderRadius: '12px', 
    fontSize: '14px', 
    fontWeight: '700', 
    border: 'none', 
    cursor: 'pointer', 
    marginTop: '10px', 
    fontFamily: 'inherit',
    transition: 'all 0.3s ease',
  },
  
  spinner: { 
    width: '16px', 
    height: '16px', 
    border: '2px solid rgba(0,0,0,0.2)', 
    borderTopColor: '#000', 
    borderRadius: '50%', 
    animation: 'spin 0.6s linear infinite' 
  },
  
  logsList: { 
    display: 'flex', 
    flexDirection: 'column', 
    gap: '12px', 
    maxHeight: '600px', 
    overflowY: 'auto',
    paddingRight: '4px',
  },
  
  logItem: { 
    display: 'flex', 
    alignItems: 'flex-start', 
    justifyContent: 'space-between',
    gap: '12px',
    background: 'rgba(255,255,255,0.03)', 
    border: '1px solid rgba(51,65,85,0.55)',
    borderRadius: '12px', 
    padding: '14px',
    transition: 'all 0.2s ease',
  },
  
  logLeft: { display: 'flex', alignItems: 'flex-start', gap: '12px', flex: 1, minWidth: 0 },
  
  logIcon: {
    width: '36px',
    height: '36px',
    borderRadius: '10px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    border: '1px solid',
    flexShrink: 0,
  },
  
  logContent: { flex: 1, minWidth: 0 },
  
  logHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px', gap: '12px', flexWrap: 'wrap' },
  
  logDate: { color: '#555', fontSize: '11px', whiteSpace: 'nowrap' },
  
  logBody: { color: '#AAA', fontSize: '13px', margin: '8px 0', lineHeight: '1.5' },
  
  logStats: { display: 'flex', gap: '16px', alignItems: 'center', marginTop: '10px', flexWrap: 'wrap' },
  
  logStat: { display: 'flex', alignItems: 'center', gap: '6px', color: '#10B981', fontSize: '12px', fontWeight: '600' },
  
  deleteBtn: {
    width: '32px',
    height: '32px',
    borderRadius: '8px',
    background: 'rgba(255,255,255,0.04)',
    border: '1px solid rgba(51,65,85,0.55)',
    color: '#666',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
    transition: 'all 0.2s ease',
    flexShrink: 0,
  },
  
  empty: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '60px 20px',
    gap: '12px',
  },
  
  emptyText: { color: '#888', fontSize: '16px', fontWeight: '600', margin: 0 },
  emptySub: { color: '#555', fontSize: '13px', margin: 0 },
}
