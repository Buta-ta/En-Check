import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Sparkles,
  RefreshCw,
  AlertTriangle,
  Users,
  Users2,
  Clock,
  TrendingUp,
  ClipboardList,
  CalendarDays,
  ShieldAlert,
  Activity,
  ArrowRight,
  Building2,
  Filter,
  Zap,
  Target,
  BarChart3,
  Eye,
} from 'lucide-react'
import toast from 'react-hot-toast'

import FeatureService, { FEATURES } from '../services/featureService'
import { getPredictionDashboard } from '../services/predictionService'

// Fonction helper pour formater les heures
function formatHours(hours) {
  if (hours == null || isNaN(hours) || hours <= 0) return '0 min'

  const totalMinutes = Math.round(hours * 60)

  if (totalMinutes < 60) {
    return `${totalMinutes} min`
  }

  const h = Math.floor(totalMinutes / 60)
  const m = totalMinutes % 60

  if (m === 0) return `${h}h`
  return `${h}h ${m}min`
}



function StatCard({ icon: Icon, color, bg, value, label, delay = 0 }) {
  return (
    <div className="afro-stat-card" style={{
      ...styles.statCard,
      animationDelay: `${delay}s`,
      animation: 'fadeInUp 0.5s ease forwards',
      opacity: 0,
    }}>
      <div style={{ ...styles.statIconWrap, background: bg }}>
        <Icon size={22} color={color} />
      </div>
      <div style={styles.statContent}>
        <span style={styles.statNumber}>{value}</span>
        <span style={styles.statLabel}>{label}</span>
      </div>
    </div>
  )
}

function SeverityBadge({ severity }) {
  const map = {
    critical: { color: '#EF4444', bg: 'rgba(239,68,68,0.12)', label: '⚠ Critique' },
    warning: { color: '#F59E0B', bg: 'rgba(245,158,11,0.12)', label: '⚡ Attention' },
    info: { color: '#6366F1', bg: 'rgba(99,102,241,0.12)', label: 'ℹ Info' },
  }
  const item = map[severity] || map.info
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: '4px',
      padding: '4px 10px', borderRadius: '20px', fontSize: '11px', fontWeight: '700',
      color: item.color, background: item.bg, border: `1px solid ${item.color}25`,
      whiteSpace: 'nowrap', letterSpacing: '0.3px',
    }}>
      {item.label}
    </span>
  )
}

function SectionCard({ title, icon: Icon, color = '#F59E0B', children, action = null }) {
  return (
    <section style={styles.sectionCard}>
      <div style={styles.sectionHeader}>
        <div style={styles.sectionTitleWrap}>
          <div style={{ ...styles.sectionIcon, background: `${color}15`, border: `1px solid ${color}25` }}>
            <Icon size={16} color={color} />
          </div>
          <h3 style={styles.sectionTitle}>{title}</h3>
        </div>
        {action}
      </div>
      {children}
    </section>
  )
}

function EmptyMini({ text }) {
  return (
    <div style={styles.emptyMini}>
      <div style={{ width: '48px', height: '48px', borderRadius: '14px', background: 'rgba(245,158,11,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Sparkles size={22} color="#F59E0B" />
      </div>
      <span style={styles.emptyMiniText}>{text}</span>
    </div>
  )
}

export default function Predictions() {
  const navigate = useNavigate()

  const [admin, setAdmin] = useState(null)
  const [enterpriseId, setEnterpriseId] = useState(null)
  const [loading, setLoading] = useState(true)

  const [data, setData] = useState({
    summary: {
      critical_alerts: 0, warning_alerts: 0, overloaded_employees: 0,
      risky_teams: 0, impactful_absences: 0, staffing_needs: 0, avg_duration_variance_percent: 0,
    },
    alerts: [], durations: [], employee_workloads: [],
    team_workloads: [], absence_impact: [], staffing_needs: [],
  })

  const [severityFilter, setSeverityFilter] = useState('')
  const [viewFilter, setViewFilter] = useState('all')

  useEffect(() => {
    const init = async () => {
      try {
        const adminData = JSON.parse(localStorage.getItem('admin') || '{}')
        setAdmin(adminData)
        const entId = adminData.selectedEnterprise?.id || adminData.enterprise_id
        setEnterpriseId(entId)
        if (!entId && adminData.role !== 'super_admin') { toast.error('Aucune entreprise sélectionnée'); navigate('/dashboard'); return }
        if (adminData.role !== 'super_admin') {
          const hasAccess = await FeatureService.hasFeature(entId, FEATURES.PREDICTIONS)
          if (!hasAccess) { toast.error("Le module Prédictions n'est pas activé"); navigate('/dashboard'); return }
        }
        await loadPredictions(entId)
      } catch (error) { console.error(error); toast.error('Erreur de chargement des prédictions'); navigate('/dashboard') }
    }
    init()
  }, [navigate])

  const loadPredictions = async (entId = enterpriseId) => {
    if (!entId && admin?.role !== 'super_admin') return
    setLoading(true)
    try {
      const targetEnterpriseId = entId || admin?.selectedEnterprise?.id || admin?.enterprise_id
      const { data: predictionData, error } = await getPredictionDashboard(targetEnterpriseId)
      if (error) throw error
      setData(predictionData)
    } catch (error) { console.error('Erreur loadPredictions:', error); toast.error('Impossible de charger les prédictions') } finally { setLoading(false) }
  }

  const filteredAlerts = useMemo(() => {
    let list = data.alerts || []
    if (severityFilter) list = list.filter(a => a.severity === severityFilter)
    if (viewFilter !== 'all') {
      if (viewFilter === 'employees') list = list.filter(a => a.target_type === 'employee')
      else if (viewFilter === 'teams') list = list.filter(a => a.target_type === 'team')
      else if (viewFilter === 'staffing') list = list.filter(a => a.prediction_type === 'staffing_need')
      else if (viewFilter === 'absence') list = list.filter(a => a.prediction_type === 'absence_impact')
    }
    return list
  }, [data.alerts, severityFilter, viewFilter])

  if (loading) {
    return (
      <div style={styles.loadingContainer}>
        <div style={styles.bgPattern}></div>
        <div style={styles.bgOrb1}></div>
        <div style={styles.bgOrb2}></div>
        <div style={styles.loadingContent}>
          <div style={styles.loadingPulse}><Sparkles size={50} color="#F59E0B" /></div>
          <p style={styles.loadingText}>Analyse prédictive en cours...</p>
          <div style={styles.loadingBar}><div style={styles.loadingBarFill}></div></div>
          <div style={styles.loadingDots}>
            <div style={{ ...styles.loadingDot, animationDelay: '0s' }}></div>
            <div style={{ ...styles.loadingDot, animationDelay: '0.2s' }}></div>
            <div style={{ ...styles.loadingDot, animationDelay: '0.4s' }}></div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <>
      <style>{`
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes fadeInUp { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes shimmer { 0% { background-position: -200% 0; } 100% { background-position: 200% 0; } }
        @keyframes float { 0%, 100% { transform: translateY(0px); } 50% { transform: translateY(-10px); } }
        @keyframes dotPulse { 0%, 100% { opacity: 0.3; transform: scale(0.8); } 50% { opacity: 1; transform: scale(1.2); } }
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        .spin { animation: spin 1s linear infinite; }

        .afro-stat-card { transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1) !important; }
        .afro-stat-card:hover { transform: translateY(-6px) scale(1.02) !important; box-shadow: 0 16px 50px rgba(0,0,0,0.4) !important; }
        .afro-alert-card { transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1) !important; }
        .afro-alert-card:hover { transform: translateY(-2px) !important; box-shadow: 0 12px 40px rgba(0,0,0,0.35) !important; border-color: rgba(245, 158, 11, 0.25) !important; }
        .afro-table-row { transition: all 0.2s ease !important; }
        .afro-table-row:hover { background: rgba(245, 158, 11, 0.04) !important; border-color: rgba(245, 158, 11, 0.15) !important; }
        .afro-filter-select:focus { border-color: #F59E0B !important; box-shadow: 0 0 0 2px rgba(245, 158, 11, 0.2) !important; }
        .afro-section-card { transition: all 0.3s ease !important; }

        @media (max-width: 768px) {
          .header-wrap { flex-direction: column !important; align-items: flex-start !important; gap: 14px !important; }
          .actions-wrap { width: 100% !important; }
          .two-cols-responsive { grid-template-columns: 1fr !important; }
          .table-responsive { overflow-x: auto !important; }
          .table-grid-4 { min-width: 500px !important; }
          .table-grid-5 { min-width: 650px !important; }
          .team-metrics-responsive { grid-template-columns: 1fr !important; }
          .staffing-body-responsive { 
  grid-template-columns: repeat(2, 1fr) !important; 
}
          .filters-responsive { flex-direction: column !important; }
          .filters-responsive > * { width: 100% !important; min-width: 0 !important; }
        }

        @media (max-width: 480px) {
          .stats-grid-responsive { grid-template-columns: repeat(2, 1fr) !important; }
        }

        ::-webkit-scrollbar { width: 6px; }
        ::-webkit-scrollbar-track { background: #0A0A0F; }
        ::-webkit-scrollbar-thumb { background: #F59E0B; border-radius: 3px; }
      `}</style>

      <div style={styles.container}>
        <div style={styles.bgPattern}></div>
        <div style={styles.bgOrb1}></div>
        <div style={styles.bgOrb2}></div>

        <main style={styles.main}>
          <div className="header-wrap" style={styles.headerSection}>
            <div style={styles.headerLeft}>
              <div style={styles.titleIcon}>
                <Sparkles size={24} color="#F59E0B" />
              </div>
              <div>
                <h1 style={styles.pageTitle}>Prédictions</h1>
                <p style={styles.pageSubtitle}>Analyse intelligente des charges, besoins et tendances</p>
              </div>
            </div>
            <div className="actions-wrap" style={styles.headerActions}>
              <div style={styles.liveBadge}><Activity size={14} /><span>IA Active</span></div>
              <button onClick={() => navigate('/dashboard')} style={styles.btnSecondary}>
                <Building2 size={16} /><span>Dashboard</span>
              </button>
              <button onClick={() => loadPredictions()} style={styles.btnPrimary}>
                <RefreshCw size={16} /><span>Rafraîchir</span>
              </button>
            </div>
          </div>

          <div className="stats-grid-responsive" style={styles.statsGrid}>
            <StatCard icon={ShieldAlert} color="#EF4444" bg="rgba(239,68,68,0.12)" value={data.summary.critical_alerts} label="Alertes critiques" delay={0} />
            <StatCard icon={AlertTriangle} color="#F59E0B" bg="rgba(245,158,11,0.12)" value={data.summary.warning_alerts} label="Alertes attention" delay={0.08} />
            <StatCard icon={Users} color="#F97316" bg="rgba(249,115,22,0.12)" value={data.summary.overloaded_employees} label="Surchargés" delay={0.16} />
            <StatCard icon={Users2} color="#6366F1" bg="rgba(99,102,241,0.12)" value={data.summary.risky_teams} label="Équipes à risque" delay={0.24} />
            <StatCard icon={CalendarDays} color="#8B5CF6" bg="rgba(139,92,246,0.12)" value={data.summary.impactful_absences} label="Absences impact" delay={0.32} />
            <StatCard icon={TrendingUp} color="#10B981" bg="rgba(16,185,129,0.12)" value={`${data.summary.avg_duration_variance_percent}%`} label="Écart moyen" delay={0.40} />
          </div>

          <SectionCard title="Alertes intelligentes" icon={AlertTriangle} color="#F59E0B">
            <div className="filters-responsive" style={styles.filtersRow}>
              <div style={styles.filterGroup}>
                <ShieldAlert size={14} color="#F59E0B" />
                <select className="afro-filter-select" value={severityFilter} onChange={(e) => setSeverityFilter(e.target.value)} style={styles.filterSelect}>
                  <option value="">Toutes sévérités</option>
                  <option value="critical">⚠ Critique</option>
                  <option value="warning">⚡ Attention</option>
                  <option value="info">ℹ Info</option>
                </select>
              </div>
              <div style={styles.filterGroup}>
                <Filter size={14} color="#6366F1" />
                <select className="afro-filter-select" value={viewFilter} onChange={(e) => setViewFilter(e.target.value)} style={styles.filterSelect}>
                  <option value="all">Toutes les alertes</option>
                  <option value="employees">Employés</option>
                  <option value="teams">Équipes</option>
                  <option value="absence">Absences</option>
                  <option value="staffing">Renfort</option>
                </select>
              </div>
            </div>

            {filteredAlerts.length === 0 ? (
              <EmptyMini text="Aucune alerte correspondant aux filtres." />
            ) : (
              <div style={styles.alertsList}>
                {filteredAlerts.map((alert, index) => (
                  <div
                    key={`${alert.prediction_type}-${alert.target_id || index}`}
                    className="afro-alert-card"
                    style={{
                      ...styles.alertCard,
                      animationDelay: `${index * 0.05}s`,
                      animation: 'fadeInUp 0.4s ease forwards',
                      opacity: 0,
                      borderColor: alert.severity === 'critical' ? 'rgba(239,68,68,0.15)' : alert.severity === 'warning' ? 'rgba(245,158,11,0.15)' : 'rgba(99,102,241,0.15)',
                    }}
                  >
                    <div style={styles.alertTop}>
                      <div style={styles.alertMeta}>
                        <SeverityBadge severity={alert.severity} />
                        <span style={styles.alertType}>{alert.title}</span>
                      </div>
                    </div>
                    <p style={styles.alertMessage}>{alert.message}</p>
                  </div>
                ))}
              </div>
            )}
          </SectionCard>

          <div className="two-cols-responsive" style={styles.twoCols}>
            <SectionCard title="Durées réelles vs prévues" icon={Clock} color="#6366F1">
              {(data.durations || []).length === 0 ? (
                <EmptyMini text="Pas assez d'historique pour analyser les durées." />
              ) : (
                <div className="table-responsive" style={{ overflowX: 'auto' }}>
                  <div className="table-grid-4" style={styles.tableHeader}>
                    <span>Catégorie</span><span>Prévu</span><span>Réel</span><span>Écart</span>
                  </div>
                  {data.durations.slice(0, 8).map((row, i) => (
                    <div key={row.category_id} className="afro-table-row table-grid-4" style={{
                      ...styles.tableRow,
                      animationDelay: `${i * 0.05}s`,
                      animation: 'fadeInUp 0.3s ease forwards',
                      opacity: 0,
                    }}>
                      <div>
                        <div style={styles.rowTitle}>{row.category_name}</div>
                        <div style={styles.rowSub}>{row.completed_count} tâche(s)</div>
                      </div>
                      <div style={styles.rowValue}>{row.expected_avg_minutes || 0} min</div>
                      <div style={styles.rowValue}>{row.actual_avg_minutes || 0} min</div>
                      <div style={{
                        ...styles.rowValueHighlight,
                        color: row.variance_percent > 0 ? '#EF4444' : '#10B981',
                      }}>
                        {row.variance_percent > 0 ? '+' : ''}{row.variance_percent}%
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </SectionCard>

            <SectionCard title="Besoins de renfort" icon={TrendingUp} color="#8B5CF6">
              {(data.staffing_needs || []).length === 0 ? (
                <EmptyMini text="Aucun besoin de renfort détecté pour le moment." />
              ) : (
                <div style={styles.alertsList}>
                  {data.staffing_needs.slice(0, 6).map((item, i) => (
                    <div key={item.team_id} className="afro-alert-card" style={{
                      ...styles.staffingCard,
                      animationDelay: `${i * 0.05}s`,
                      animation: 'fadeInUp 0.3s ease forwards',
                      opacity: 0,
                    }}>
                      <div style={styles.staffingTop}>
                        <div>
                          <div style={styles.rowTitle}>{item.team_name}</div>
                          <div style={styles.rowSub}>Charge/membre : {formatHours(item.load_per_member_hours)}</div>
                        </div>
                        <SeverityBadge severity={item.severity} />
                      </div>
                      <div className="staffing-body-responsive" style={styles.staffingBody}>
                        <div style={styles.staffingMetric}>
                          <span style={styles.staffingMetricLabel}>Tâches ouvertes</span>
                          <span style={styles.staffingMetricValue}>{item.open_tasks}</span>
                        </div>
                        <div style={styles.staffingMetric}>
                          <span style={styles.staffingMetricLabel}>Renfort estimé</span>
                          <span style={styles.staffingMetricValue}>{item.estimated_additional_people}</span>
                        </div>
                        <div style={styles.staffingMetric}>
                          <span style={styles.staffingMetricLabel}>Retards</span>
                          <span style={styles.staffingMetricValue}>{item.overdue_tasks}</span>
                        </div>
                        <div style={styles.staffingMetric}>
                          <span style={styles.staffingMetricLabel}>Complétion</span>
                          <span style={styles.staffingMetricValue}>{item.completion_rate}%</span>
                        </div>
                      </div>
                      <p style={styles.staffingRecommendation}>{item.recommendation}</p>
                    </div>
                  ))}
                </div>
              )}
            </SectionCard>
          </div>

          <SectionCard title="Charge par employé" icon={Users} color="#F97316">
            {(data.employee_workloads || []).length === 0 ? (
              <EmptyMini text="Aucune charge employé à analyser." />
            ) : (
              <div className="table-responsive" style={{ overflowX: 'auto' }}>
                <div className="table-grid-5" style={styles.tableHeaderEmployee}>
                  <span>Employé</span><span>Tâches</span><span>Prévu</span><span>Estimé réel</span><span>Risque</span>
                </div>
                {data.employee_workloads.slice(0, 10).map((row, i) => (
                  <div key={row.employee_id} className="afro-table-row table-grid-5" style={{
                    ...styles.tableRowEmployee,
                    animationDelay: `${i * 0.04}s`,
                    animation: 'fadeInUp 0.3s ease forwards',
                    opacity: 0,
                  }}>
                    <div>
                      <div style={styles.rowTitle}>{row.employee_name}</div>
                      <div style={styles.rowSub}>{row.position || row.department || 'Employé'}</div>
                    </div>
                    <div style={styles.rowValue}>{row.open_tasks}</div>
                    <div style={styles.rowValue}>{row.planned_minutes} min</div>
                    <div style={styles.rowValue}>{formatHours(row.predicted_real_hours)}</div>
                    <div><SeverityBadge severity={row.severity} /></div>
                  </div>
                ))}
              </div>
            )}
          </SectionCard>

          <div className="two-cols-responsive" style={styles.twoCols}>
            <SectionCard title="Charge par équipe" icon={Users2} color="#10B981">
              {(data.team_workloads || []).length === 0 ? (
                <EmptyMini text="Aucune charge équipe à analyser." />
              ) : (
                <div style={styles.alertsList}>
                  {data.team_workloads.slice(0, 8).map((team, i) => (
                    <div key={team.team_id} className="afro-alert-card" style={{
                      ...styles.teamCard,
                      animationDelay: `${i * 0.05}s`,
                      animation: 'fadeInUp 0.3s ease forwards',
                      opacity: 0,
                    }}>
                      <div style={styles.teamTop}>
                        <div>
                          <div style={styles.rowTitle}>{team.team_name}</div>
                          <div style={styles.rowSub}>{team.member_count} membre(s)</div>
                        </div>
                        <SeverityBadge severity={team.severity} />
                      </div>
                      <div className="team-metrics-responsive" style={styles.teamMetrics}>
                        <div style={styles.teamMetricBox}>
                          <span style={styles.teamMetricLabel}>Tâches ouvertes</span>
                          <span style={styles.teamMetricValue}>{team.open_tasks}</span>
                        </div>
                        <div style={styles.teamMetricBox}>
                          <span style={styles.teamMetricLabel}>Charge/membre</span>
                          <span style={styles.teamMetricValue}>{formatHours(team.load_per_member_hours)}</span>
                        </div>
                        <div style={styles.teamMetricBox}>
                          <span style={styles.teamMetricLabel}>Complétion</span>
                          <span style={{ ...styles.teamMetricValue, color: '#10B981' }}>{team.completion_rate}%</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </SectionCard>

            <SectionCard title="Absences à impact" icon={CalendarDays} color="#8B5CF6">
              {(data.absence_impact || []).length === 0 ? (
                <EmptyMini text="Aucune absence impactante prévue." />
              ) : (
                <div style={styles.alertsList}>
                  {data.absence_impact.slice(0, 8).map((item, i) => (
                    <div key={item.team_id} className="afro-alert-card" style={{
                      ...styles.absenceCard,
                      animationDelay: `${i * 0.05}s`,
                      animation: 'fadeInUp 0.3s ease forwards',
                      opacity: 0,
                    }}>
                      <div style={styles.teamTop}>
                        <div>
                          <div style={styles.rowTitle}>{item.team_name}</div>
                          <div style={styles.rowSub}>{item.absent_count} absence(s) prévue(s)</div>
                        </div>
                        <SeverityBadge severity={item.severity} />
                      </div>
                      <div style={styles.absenceMetrics}>
                        <div style={styles.absenceMetricChip}>
                          <Target size={12} color="#F59E0B" />
                          <span>Tâches impactées : <strong style={{ color: '#FFFFFF' }}>{item.impacted_tasks}</strong></span>
                        </div>
                        <div style={styles.absenceMetricChip}>
                          <ClipboardList size={12} color="#6366F1" />
                          <span>Tâches directes : <strong style={{ color: '#FFFFFF' }}>{item.direct_tasks}</strong></span>
                        </div>
                      </div>
                      <p style={styles.absenceMessage}>{item.message}</p>
                    </div>
                  ))}
                </div>
              )}
            </SectionCard>
          </div>
        </main>
      </div>
    </>
  )
}

const styles = {
  container: { minHeight: '100vh', background: '#0A0A0F', position: 'relative', overflow: 'hidden' },
  bgPattern: { position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundImage: `radial-gradient(circle at 15% 50%, rgba(245, 158, 11, 0.03) 0%, transparent 50%), radial-gradient(circle at 85% 20%, rgba(99, 102, 241, 0.03) 0%, transparent 50%), radial-gradient(circle at 50% 80%, rgba(16, 185, 129, 0.02) 0%, transparent 50%)`, pointerEvents: 'none', zIndex: 0 },
  bgOrb1: { position: 'fixed', top: '-15%', right: '-10%', width: '500px', height: '500px', borderRadius: '50%', background: 'radial-gradient(circle, rgba(245, 158, 11, 0.04) 0%, transparent 70%)', pointerEvents: 'none', zIndex: 0 },
  bgOrb2: { position: 'fixed', bottom: '-25%', left: '-10%', width: '600px', height: '600px', borderRadius: '50%', background: 'radial-gradient(circle, rgba(99, 102, 241, 0.03) 0%, transparent 70%)', pointerEvents: 'none', zIndex: 0 },

  loadingContainer: { minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: '#0A0A0F', position: 'relative', overflow: 'hidden' },
  loadingContent: { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '24px', zIndex: 1 },
  loadingPulse: { animation: 'float 2s ease-in-out infinite' },
  loadingText: { color: '#888', fontSize: '16px', letterSpacing: '2px', fontWeight: '500' },
  loadingBar: { width: '220px', height: '2px', background: 'rgba(245,158,11,0.1)', borderRadius: '2px', overflow: 'hidden' },
  loadingBarFill: { width: '40%', height: '100%', background: 'linear-gradient(90deg, #F59E0B, #D97706)', borderRadius: '2px', animation: 'shimmer 1.5s infinite', backgroundSize: '200% 100%' },
  loadingDots: { display: 'flex', gap: '8px' },
  loadingDot: { width: '8px', height: '8px', borderRadius: '50%', background: '#F59E0B', animation: 'dotPulse 1.2s ease-in-out infinite' },

  main: { padding: 'clamp(16px, 3vw, 24px)', maxWidth: '1450px', margin: '0 auto', position: 'relative', zIndex: 1 },

  headerSection: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '28px', gap: '16px', flexWrap: 'wrap' },
  headerLeft: { display: 'flex', alignItems: 'center', gap: '14px' },
  titleIcon: { width: '48px', height: '48px', borderRadius: '14px', background: 'rgba(245, 158, 11, 0.1)', border: '1px solid rgba(245, 158, 11, 0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center' },
  pageTitle: { color: '#FFFFFF', fontSize: 'clamp(20px, 3.5vw, 28px)', fontWeight: '700', margin: 0, letterSpacing: '0.5px' },
  pageSubtitle: { color: '#888', fontSize: '13px', margin: '2px 0 0 0' },
  headerActions: { display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' },
  liveBadge: { display: 'flex', alignItems: 'center', gap: '6px', background: 'rgba(16, 185, 129, 0.1)', border: '1px solid rgba(16, 185, 129, 0.25)', color: '#10B981', padding: '6px 14px', borderRadius: '20px', fontSize: '12px', fontWeight: '600', letterSpacing: '0.5px' },

  btnPrimary: { display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '12px 20px', borderRadius: '12px', border: 'none', background: 'linear-gradient(135deg, #F59E0B, #D97706)', color: '#000', fontWeight: '700', fontSize: '14px', cursor: 'pointer', transition: 'all 0.3s ease', letterSpacing: '0.3px', fontFamily: 'inherit' },
  btnSecondary: { display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '12px 18px', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.08)', background: 'rgba(255,255,255,0.04)', color: '#ddd', fontWeight: '600', fontSize: '14px', cursor: 'pointer', transition: 'all 0.2s ease', fontFamily: 'inherit' },

  statsGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 180px), 1fr))', gap: '12px', marginBottom: '28px' },
  statCard: { background: 'rgba(20, 20, 35, 0.8)', backdropFilter: 'blur(10px)', borderRadius: '16px', padding: 'clamp(14px, 2.5vw, 20px)', display: 'flex', alignItems: 'center', gap: '12px', border: '1px solid rgba(255,255,255,0.06)', cursor: 'default' },
  statIconWrap: { width: '44px', height: '44px', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  statContent: { display: 'flex', flexDirection: 'column' },
  statNumber: { fontSize: 'clamp(22px, 3.5vw, 30px)', fontWeight: '700', color: '#FFFFFF', lineHeight: '1', marginBottom: '3px' },
  statLabel: { fontSize: '11px', color: '#888', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.5px' },

  sectionCard: { background: 'rgba(20, 20, 35, 0.6)', backdropFilter: 'blur(10px)', borderRadius: '20px', border: '1px solid rgba(255,255,255,0.06)', padding: 'clamp(16px, 3vw, 22px)', marginBottom: '18px' },
  sectionHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '10px', marginBottom: '18px', flexWrap: 'wrap' },
  sectionTitleWrap: { display: 'flex', alignItems: 'center', gap: '12px' },
  sectionIcon: { width: '36px', height: '36px', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center' },
  sectionTitle: { margin: 0, color: '#FFFFFF', fontSize: '16px', fontWeight: '700' },

  filtersRow: { display: 'flex', gap: '10px', flexWrap: 'wrap', marginBottom: '16px' },
  filterGroup: { display: 'flex', alignItems: 'center', gap: '10px', background: 'rgba(20, 20, 35, 0.8)', backdropFilter: 'blur(10px)', border: '1px solid rgba(255,255,255,0.06)', padding: '10px 14px', borderRadius: '12px', flex: '1 1 180px', transition: 'border-color 0.2s ease' },
  filterSelect: { border: 'none', background: 'transparent', fontSize: '13px', color: '#E5E5E5', cursor: 'pointer', outline: 'none', width: '100%', fontFamily: 'inherit' },

  alertsList: { display: 'flex', flexDirection: 'column', gap: '10px' },
  alertCard: { padding: 'clamp(12px, 2.5vw, 16px)', borderRadius: '14px', background: 'rgba(20, 20, 35, 0.5)', border: '1px solid rgba(255,255,255,0.06)', cursor: 'default' },
  alertTop: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '10px', marginBottom: '8px', flexWrap: 'wrap' },
  alertMeta: { display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' },
  alertType: { color: '#FFFFFF', fontSize: '13px', fontWeight: '700' },
  alertMessage: { margin: 0, color: '#999', fontSize: '13px', lineHeight: '1.6' },

  twoCols: { display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '18px', marginBottom: '4px' },

  tableHeader: { display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr', gap: '10px', padding: '0 12px 10px 12px', color: '#888', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.8px', fontWeight: '700' },
  tableRow: { display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr', gap: '10px', alignItems: 'center', padding: '12px', borderRadius: '12px', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.04)' },
  tableHeaderEmployee: { display: 'grid', gridTemplateColumns: '2fr .7fr 1fr 1fr 1fr', gap: '10px', padding: '0 12px 10px 12px', color: '#888', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.8px', fontWeight: '700' },
  tableRowEmployee: { display: 'grid', gridTemplateColumns: '2fr .7fr 1fr 1fr 1fr', gap: '10px', alignItems: 'center', padding: '12px', borderRadius: '12px', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.04)' },

  rowTitle: { color: '#FFFFFF', fontSize: '13px', fontWeight: '700' },
  rowSub: { color: '#888', fontSize: '11px', marginTop: '2px' },
  rowValue: { color: '#ccc', fontSize: '13px', fontFamily: "'SF Mono', 'Fira Code', monospace" },
  rowValueHighlight: { fontSize: '13px', fontWeight: '800', fontFamily: "'SF Mono', 'Fira Code', monospace" },

  staffingCard: { padding: 'clamp(12px, 2.5vw, 16px)', borderRadius: '14px', background: 'rgba(20, 20, 35, 0.5)', border: '1px solid rgba(255,255,255,0.06)' },
  staffingTop: { display: 'flex', justifyContent: 'space-between', gap: '10px', alignItems: 'center', flexWrap: 'wrap', marginBottom: '12px' },
  staffingBody: { display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '8px', marginBottom: '12px' },
  staffingMetric: { display: 'flex', flexDirection: 'column', gap: '4px', padding: '12px', borderRadius: '10px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.04)' },
  staffingMetricLabel: { color: '#888', fontSize: '10px', textTransform: 'uppercase', fontWeight: '700', letterSpacing: '0.5px' },
  staffingMetricValue: { color: '#FFFFFF', fontSize: '20px', fontWeight: '800' },
  staffingRecommendation: { margin: 0, color: '#999', fontSize: '12px', lineHeight: '1.6' },

  teamCard: { padding: 'clamp(12px, 2.5vw, 16px)', borderRadius: '14px', background: 'rgba(20, 20, 35, 0.5)', border: '1px solid rgba(255,255,255,0.06)' },
  teamTop: { display: 'flex', justifyContent: 'space-between', gap: '10px', alignItems: 'center', flexWrap: 'wrap', marginBottom: '12px' },
  teamMetrics: { display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: '8px' },
  teamMetricBox: { padding: '10px', borderRadius: '10px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.04)', display: 'flex', flexDirection: 'column', gap: '4px' },
  teamMetricLabel: { color: '#888', fontSize: '10px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.5px' },
  teamMetricValue: { color: '#FFFFFF', fontSize: '18px', fontWeight: '800' },

  absenceCard: { padding: 'clamp(12px, 2.5vw, 16px)', borderRadius: '14px', background: 'rgba(20, 20, 35, 0.5)', border: '1px solid rgba(255,255,255,0.06)' },
  absenceMetrics: { display: 'flex', flexDirection: 'column', gap: '6px', marginBottom: '10px' },
  absenceMetricChip: { display: 'flex', alignItems: 'center', gap: '8px', color: '#999', fontSize: '12px', padding: '6px 10px', background: 'rgba(255,255,255,0.02)', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.04)' },
  absenceMessage: { margin: 0, color: '#888', fontSize: '12px', lineHeight: '1.6' },

  emptyMini: { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px', padding: '32px 20px' },
  emptyMiniText: { fontSize: '13px', color: '#888', textAlign: 'center' },
}