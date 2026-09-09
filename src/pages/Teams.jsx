// src/pages/Teams.jsx
import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Users, Plus, Search, Edit3, Trash2, UserPlus, UserMinus,
  Crown, MoreVertical, X, Check, AlertTriangle, Loader2,
  ChevronDown, ChevronRight, TrendingUp,
  RefreshCw, Activity, Sparkles,
  Target, Shield, List, LayoutGrid, Columns3,
  History, Heart, AlertCircle, UserX,
  Clock, Lightbulb, GripVertical,
  CheckSquare, Square, HelpCircle, MapPin, Briefcase,
  ChevronUp
} from 'lucide-react'
import toast from 'react-hot-toast'

import { supabase } from '../lib/supabase'
import FeatureService, { FEATURES } from '../services/featureService'
import {
  getTeams, createTeam, updateTeam, deleteTeam,
  addTeamMembers, removeTeamMember, changeTeamLeader,
  getAvailableEmployeesForTeam,
  getOrphanEmployees, getTeamHealthMetrics, getTeamAlerts,
  detectPotentialTeams, predictStaffingNeeds, getTeamHistory,
  getTeamUsageMetrics, logTeamAction
} from '../services/teamService'

const TEAM_COLORS = [
  '#F59E0B', '#10B981', '#3B82F6', '#8B5CF6', '#EC4899',
  '#F97316', '#06B6D4', '#84CC16', '#EF4444', '#6366F1',
]
const VIEW_MODES = { GRID: 'grid', LIST: 'list', KANBAN: 'kanban' }
const SORT_OPTIONS = [
  { key: 'name_asc', label: 'Nom (A-Z)', field: 'name', dir: 'asc' },
  { key: 'name_desc', label: 'Nom (Z-A)', field: 'name', dir: 'desc' },
  { key: 'members_desc', label: 'Plus de membres', field: 'member_count', dir: 'desc' },
  { key: 'members_asc', label: 'Moins de membres', field: 'member_count', dir: 'asc' },
  { key: 'health_asc', label: 'Critiques d\'abord', field: 'health_score', dir: 'asc' },
]
const FILTER_PRESETS = [
  { key: 'all', label: 'Toutes' },
  { key: 'with_leader', label: 'Avec leader' },
  { key: 'without_leader', label: 'Sans leader' },
  { key: 'active', label: 'Actives' },
  { key: 'empty', label: 'Vides' },
  { key: 'critical', label: '🔴 Critiques' },
  { key: 'warning', label: '🟡 À surveiller' },
]

/* ═══════════════ PETITS COMPOSANTS ═══════════════ */

function SkeletonCard() {
  return (
    <div style={S.skeletonCard}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{ ...S.skeletonCircle, width: 38, height: 38 }} />
        <div style={{ flex: 1 }}>
          <div style={{ ...S.skeletonLine, width: '55%', marginBottom: 6 }} />
          <div style={{ ...S.skeletonLine, width: '35%', height: 10 }} />
        </div>
      </div>
    </div>
  )
}

function StatBadge({ icon: Icon, value, label, color = '#F59E0B' }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '3px 7px', borderRadius: 6, background: `${color}10`, border: `1px solid ${color}20` }}>
      <Icon size={12} color={color} />
      <span style={{ fontSize: 12, fontWeight: 700, color }}>{value}</span>
      {label && <span style={{ fontSize: 10, color: '#888' }}>{label}</span>}
    </div>
  )
}

function HealthBadge({ status, score }) {
  const c = { healthy: { color: '#10B981', icon: Heart }, warning: { color: '#F59E0B', icon: AlertTriangle }, critical: { color: '#EF4444', icon: AlertCircle } }[status] || { color: '#10B981', icon: Heart }
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 3, padding: '2px 7px', borderRadius: 10, background: `${c.color}15`, border: `1px solid ${c.color}25` }}>
      <c.icon size={10} color={c.color} />
      <span style={{ color: c.color, fontSize: 10, fontWeight: 700 }}>{score}%</span>
    </div>
  )
}

function SeverityBadge({ severity }) {
  const m = { critical: { color: '#EF4444', label: 'Critique' }, warning: { color: '#F59E0B', label: 'Attention' }, info: { color: '#6366F1', label: 'Info' }, high: { color: '#EF4444', label: 'Urgent' }, low: { color: '#10B981', label: 'Faible' } }
  const it = m[severity] || m.info
  return <span style={{ padding: '2px 7px', borderRadius: 8, fontSize: 10, fontWeight: 700, color: it.color, background: `${it.color}15`, border: `1px solid ${it.color}25` }}>{it.label}</span>
}

function EmployeeAvatar({ employee, size = 32, showName = false, isLeader = false }) {
  const ini = `${employee?.first_name?.[0] || ''}${employee?.last_name?.[0] || ''}`.toUpperCase()
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
      <div style={{ width: size, height: size, borderRadius: size > 28 ? 10 : 7, background: 'linear-gradient(135deg, rgba(245,158,11,0.2), rgba(245,158,11,0.05))', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#F59E0B', fontWeight: 700, fontSize: size * 0.38, position: 'relative', flexShrink: 0, border: isLeader ? '2px solid #F59E0B' : '2px solid rgba(255,255,255,0.08)' }}>
        {employee?.photo_url ? <img src={employee.photo_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: 'inherit' }} /> : ini}
        {isLeader && <div style={{ position: 'absolute', bottom: -2, right: -2, width: 13, height: 13, borderRadius: '50%', background: '#F59E0B', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '2px solid #0A0A0F' }}><Crown size={6} color="#000" /></div>}
      </div>
      {showName && (
        <div style={{ minWidth: 0 }}>
          <p style={{ fontSize: 12, fontWeight: 600, color: '#FFF', margin: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{employee?.first_name} {employee?.last_name}</p>
          {employee?.position && <p style={{ fontSize: 10, color: '#888', margin: 0 }}>{employee.position}</p>}
        </div>
      )}
    </div>
  )
}

/* ═══════════════ INSIGHTS BANNER (horizontal, intégré) ═══════════════ */

function InsightsBanner({ orphans, alerts, suggestions, staffingNeeds, healthGlobal, onAddOrphanToTeam, onCreateSuggestedTeam, loading, hasPredictions }) {
  const [activeTab, setActiveTab] = useState('alerts')
  const [expanded, setExpanded] = useState(false)

  const totalIssues = (alerts?.length || 0) + (orphans?.length || 0)

  if (!hasPredictions) {
    return (
      <div style={S.insightsBannerLocked}>
        <Shield size={16} color="#F59E0B" />
        <span style={{ color: '#FFF', fontSize: 12, fontWeight: 600 }}>Module Prédictions</span>
        <span style={{ color: '#888', fontSize: 11 }}>Activez pour les insights IA</span>
      </div>
    )
  }

  const tabs = [
    { key: 'alerts', label: 'Alertes', icon: AlertTriangle, count: alerts?.length || 0, color: '#F59E0B' },
    { key: 'orphans', label: 'Orphelins', icon: UserX, count: orphans?.length || 0, color: '#8B5CF6' },
    { key: 'suggestions', label: 'Suggestions', icon: Lightbulb, count: suggestions?.length || 0, color: '#10B981' },
    { key: 'staffing', label: 'Recrutement', icon: TrendingUp, count: staffingNeeds?.length || 0, color: '#3B82F6' },
  ]

  return (
    <div style={S.insightsBanner}>
      {/* Ligne résumé — toujours visible */}
      <div style={S.insightsBannerTop} onClick={() => setExpanded(!expanded)}>
        <div style={S.insightsBannerLeft}>
          <Sparkles size={14} color="#F59E0B" />
          <span style={{ color: '#FFF', fontSize: 13, fontWeight: 700 }}>Insights IA</span>

          {healthGlobal && (
            <div style={S.healthPill}>
              <span style={{ color: '#F59E0B', fontSize: 13, fontWeight: 700 }}>{healthGlobal.avg_health_score}%</span>
              <div style={S.healthDots}>
                <span style={{ color: '#10B981', fontSize: 11 }}>●{healthGlobal.healthy_teams}</span>
                <span style={{ color: '#F59E0B', fontSize: 11 }}>●{healthGlobal.warning_teams}</span>
                <span style={{ color: '#EF4444', fontSize: 11 }}>●{healthGlobal.critical_teams}</span>
              </div>
            </div>
          )}
        </div>

        <div style={S.insightsBannerRight}>
          {/* Mini badges résumé */}
          {tabs.filter(t => t.count > 0).map(t => (
            <div key={t.key} style={{ display: 'flex', alignItems: 'center', gap: 3, padding: '2px 8px', borderRadius: 10, background: `${t.color}12`, border: `1px solid ${t.color}20` }}>
              <t.icon size={10} color={t.color} />
              <span style={{ fontSize: 11, fontWeight: 700, color: t.color }}>{t.count}</span>
            </div>
          ))}
          <button style={S.expandToggle}>
            {expanded ? <ChevronUp size={14} color="#888" /> : <ChevronDown size={14} color="#888" />}
          </button>
        </div>
      </div>

      {/* Contenu expandable */}
      {expanded && (
        <div style={S.insightsBannerBody}>
          <div style={S.insightsTabs}>
            {tabs.map(tab => (
              <button key={tab.key} onClick={() => setActiveTab(tab.key)} style={{ ...S.insightsTab, borderBottomColor: activeTab === tab.key ? tab.color : 'transparent', color: activeTab === tab.key ? tab.color : '#666' }}>
                <tab.icon size={11} />
                <span style={S.tabLabel}>{tab.label}</span>
                {tab.count > 0 && <span style={{ padding: '1px 5px', borderRadius: 6, fontSize: 9, fontWeight: 700, background: `${tab.color}20`, color: tab.color }}>{tab.count}</span>}
              </button>
            ))}
          </div>

          <div style={S.insightsGrid}>
            {loading ? (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24, gap: 8 }}>
                <Loader2 size={16} color="#F59E0B" className="spin" />
                <span style={{ color: '#888', fontSize: 11 }}>Analyse...</span>
              </div>
            ) : (
              <>
                {activeTab === 'alerts' && (
                  alerts?.length === 0 ? (
                    <div style={S.insightsEmpty}><Check size={16} color="#10B981" /><span>Tout va bien !</span></div>
                  ) : (
                    <div style={S.insightsHScroll}>
                      {alerts?.slice(0, 6).map(a => (
                        <div key={a.id} style={{ ...S.insightCard, borderLeftColor: a.severity === 'critical' ? '#EF4444' : a.severity === 'warning' ? '#F59E0B' : '#6366F1' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 3 }}>
                            <SeverityBadge severity={a.severity} />
                            {a.team_name && <span style={{ fontSize: 10, color: a.team_color || '#888' }}>{a.team_name}</span>}
                          </div>
                          <p style={{ margin: 0, color: '#ccc', fontSize: 11, lineHeight: 1.3 }}>{a.message}</p>
                        </div>
                      ))}
                    </div>
                  )
                )}

                {activeTab === 'orphans' && (
                  orphans?.length === 0 ? (
                    <div style={S.insightsEmpty}><Check size={16} color="#10B981" /><span>Tous assignés</span></div>
                  ) : (
                    <div style={S.insightsHScroll}>
                      {orphans?.slice(0, 6).map(o => (
                        <div key={o.id} style={S.insightCard}>
                          <EmployeeAvatar employee={o} size={26} showName />
                          {o.suggested_teams?.length > 0 && (
                            <div style={{ display: 'flex', gap: 3, marginTop: 4, flexWrap: 'wrap' }}>
                              {o.suggested_teams.map(t => (
                                <button key={t.id} onClick={() => onAddOrphanToTeam(o.id, t.id)} style={{ display: 'flex', alignItems: 'center', gap: 3, padding: '2px 6px', background: 'transparent', border: `1px solid ${t.color}`, borderRadius: 8, color: '#ccc', fontSize: 9, cursor: 'pointer' }}>
                                  <div style={{ width: 5, height: 5, borderRadius: 2, background: t.color }} />
                                  {t.name}
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )
                )}

                {activeTab === 'suggestions' && (
                  suggestions?.length === 0 ? (
                    <div style={S.insightsEmpty}><Sparkles size={16} color="#F59E0B" /><span>Aucune suggestion</span></div>
                  ) : (
                    <div style={S.insightsHScroll}>
                      {suggestions?.slice(0, 5).map(s => (
                        <div key={s.id} style={S.insightCard}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3 }}>
                            {s.type === 'department' ? <Briefcase size={11} color={s.suggested_color} /> : s.type === 'geolocation' ? <MapPin size={11} color={s.suggested_color} /> : <Users size={11} color={s.suggested_color} />}
                            <span style={{ color: '#FFF', fontSize: 11, fontWeight: 600, flex: 1 }}>{s.name}</span>
                            <span style={{ background: 'rgba(16,185,129,0.15)', color: '#10B981', padding: '1px 5px', borderRadius: 6, fontSize: 9, fontWeight: 700 }}>{s.confidence}%</span>
                          </div>
                          <p style={{ margin: '0 0 5px', color: '#888', fontSize: 10 }}>{s.reason}</p>
                          <button onClick={() => onCreateSuggestedTeam(s)} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 3, padding: '4px 8px', width: '100%', background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.25)', borderRadius: 5, color: '#10B981', fontSize: 10, fontWeight: 600, cursor: 'pointer' }}>
                            <Plus size={10} /> Créer
                          </button>
                        </div>
                      ))}
                    </div>
                  )
                )}

                {activeTab === 'staffing' && (
                  staffingNeeds?.length === 0 ? (
                    <div style={S.insightsEmpty}><Check size={16} color="#10B981" /><span>Effectifs OK</span></div>
                  ) : (
                    <div style={S.insightsHScroll}>
                      {staffingNeeds?.slice(0, 5).map(n => (
                        <div key={n.team_id} style={S.insightCard}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 3 }}>
                            <div style={{ width: 6, height: 6, borderRadius: 2, background: n.team_color }} />
                            <span style={{ color: '#FFF', fontSize: 11, fontWeight: 600, flex: 1 }}>{n.team_name}</span>
                            <SeverityBadge severity={n.urgency} />
                          </div>
                          <div style={{ display: 'flex', gap: 6 }}>
                            <div style={{ textAlign: 'center', padding: '4px 8px', background: 'rgba(255,255,255,0.03)', borderRadius: 5, flex: 1 }}>
                              <div style={{ color: '#FFF', fontSize: 14, fontWeight: 700 }}>+{n.suggested_hires}</div>
                              <div style={{ color: '#888', fontSize: 8 }}>suggérés</div>
                            </div>
                            <div style={{ textAlign: 'center', padding: '4px 8px', background: 'rgba(255,255,255,0.03)', borderRadius: 5, flex: 1 }}>
                              <div style={{ color: '#FFF', fontSize: 14, fontWeight: 700 }}>{n.current_size}</div>
                              <div style={{ color: '#888', fontSize: 8 }}>actuels</div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )
                )}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

/* ═══════════════ TEAM CARD ═══════════════ */

function TeamCard({ team, onEdit, onDelete, onManageMembers, onChangeLeader, expanded, onToggle, selected, onSelect, viewMode, onDrop }) {
  const [showMenu, setShowMenu] = useState(false)
  const mc = team.member_count || team.members?.length || 0
  const health = team.health || {}

  const dOver = (e) => { e.preventDefault(); e.currentTarget.style.borderColor = 'rgba(245,158,11,0.5)' }
  const dLeave = (e) => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.06)' }
  const dDrop = (e) => { e.preventDefault(); e.currentTarget.style.borderColor = 'rgba(255,255,255,0.06)'; try { const d = JSON.parse(e.dataTransfer.getData('application/json')); if (d.sourceTeamId !== team.id) onDrop?.(team.id, d) } catch {} }

  if (viewMode === VIEW_MODES.LIST) {
    return (
      <div className="team-row" style={S.teamRow} onDragOver={dOver} onDragLeave={dLeave} onDrop={dDrop}>
        <div style={{ cursor: 'pointer' }} onClick={() => onSelect(team.id)}>{selected ? <CheckSquare size={15} color="#F59E0B" /> : <Square size={15} color="#555" />}</div>
        <div style={{ width: 7, height: 7, borderRadius: 3, background: team.color || '#F59E0B', flexShrink: 0 }} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <span style={{ color: '#FFF', fontSize: 13, fontWeight: 600 }}>{team.name}</span>
          {team.description && <span style={{ color: '#888', fontSize: 11, marginLeft: 8 }}>{team.description}</span>}
        </div>
        <StatBadge icon={Users} value={mc} />
        {health.health_score !== undefined && <HealthBadge status={health.status} score={health.health_score} />}
        {team.leader && <EmployeeAvatar employee={team.leader} size={24} isLeader />}
        <div style={{ display: 'flex', gap: 3 }}>
          <button onClick={() => onEdit(team)} style={S.iconBtn}><Edit3 size={13} /></button>
          <button onClick={() => onManageMembers(team)} style={S.iconBtn}><UserPlus size={13} /></button>
          <button onClick={() => onDelete(team)} style={{ ...S.iconBtn, color: '#EF4444' }}><Trash2 size={13} /></button>
        </div>
      </div>
    )
  }

  return (
    <div className="team-card" style={{ ...S.teamCard, borderColor: expanded ? 'rgba(245,158,11,0.2)' : selected ? 'rgba(245,158,11,0.3)' : 'rgba(255,255,255,0.06)' }} onDragOver={dOver} onDragLeave={dLeave} onDrop={dDrop}>
      <div style={S.cardAccent} />
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8, marginBottom: 8 }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, flex: 1, minWidth: 0 }}>
          <div style={{ cursor: 'pointer', padding: 2 }} onClick={() => onSelect(team.id)}>{selected ? <CheckSquare size={14} color="#F59E0B" /> : <Square size={14} color="#555" />}</div>
          <div style={{ width: 32, height: 32, borderRadius: 8, background: `${team.color || '#F59E0B'}15`, border: `1px solid ${team.color || '#F59E0B'}30`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <Users size={15} color={team.color || '#F59E0B'} />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
              <h3 style={{ margin: 0, color: '#FFF', fontSize: 13, fontWeight: 700 }}>{team.name}</h3>
              {health.health_score !== undefined && <HealthBadge status={health.status} score={health.health_score} />}
            </div>
            {team.description && <p style={{ margin: '2px 0 0', color: '#888', fontSize: 10, lineHeight: 1.3 }}>{team.description}</p>}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 4 }}>
          <button onClick={() => onToggle(team.id)} style={S.expandBtn}>{expanded ? <ChevronDown size={13} /> : <ChevronRight size={13} />}</button>
          <div style={{ position: 'relative' }}>
            <button onClick={() => setShowMenu(!showMenu)} style={S.moreBtn}><MoreVertical size={13} /></button>
            {showMenu && (
              <>
                <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 99 }} onClick={() => setShowMenu(false)} />
                <div style={S.dropdown}>
                  <button onClick={() => { onEdit(team); setShowMenu(false) }} style={S.ddItem}><Edit3 size={13} /><span>Modifier</span></button>
                  <button onClick={() => { onManageMembers(team); setShowMenu(false) }} style={S.ddItem}><UserPlus size={13} /><span>Membres</span></button>
                  <button onClick={() => { onChangeLeader(team); setShowMenu(false) }} style={S.ddItem}><Crown size={13} color="#F59E0B" /><span>Leader</span></button>
                  <div style={{ height: 1, background: 'rgba(255,255,255,0.06)', margin: '3px 0' }} />
                  <button onClick={() => { onDelete(team); setShowMenu(false) }} style={{ ...S.ddItem, color: '#EF4444' }}><Trash2 size={13} /><span>Supprimer</span></button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', marginBottom: 6 }}>
        <StatBadge icon={Users} value={mc} label="membres" />
        {health.metrics?.overdue_tasks > 0 && <StatBadge icon={Clock} value={health.metrics.overdue_tasks} label="retard" color="#EF4444" />}
      </div>

      {team.leader && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '5px 8px', background: 'rgba(245,158,11,0.04)', border: '1px solid rgba(245,158,11,0.1)', borderRadius: 7, marginBottom: 5 }}>
          <Crown size={11} color="#F59E0B" />
          <span style={{ fontSize: 9, color: '#888', fontWeight: 700, textTransform: 'uppercase' }}>Leader</span>
          <div style={{ width: 1, height: 11, background: 'rgba(245,158,11,0.2)' }} />
          <EmployeeAvatar employee={team.leader} size={22} showName isLeader />
        </div>
      )}

      {health.alerts?.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 3, marginBottom: 5 }}>
          {health.alerts.slice(0, 2).map((a, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '3px 6px', borderRadius: 5, fontSize: 9, color: a.type === 'critical' ? '#EF4444' : '#F59E0B', background: a.type === 'critical' ? 'rgba(239,68,68,0.1)' : 'rgba(245,158,11,0.1)' }}>
              <AlertTriangle size={9} /><span>{a.message}</span>
            </div>
          ))}
        </div>
      )}

      {expanded && team.members?.length > 0 && (
        <div style={{ borderTop: '1px solid rgba(255,255,255,0.04)', paddingTop: 7 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 9, color: '#888', fontWeight: 700, textTransform: 'uppercase', marginBottom: 5 }}><Users size={10} color="#F59E0B" /><span>Membres ({team.members.length})</span></div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            {team.members.map(m => (
              <div key={m.id} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '4px 6px', background: 'rgba(255,255,255,0.02)', borderRadius: 6, border: '1px solid rgba(255,255,255,0.04)' }}
                draggable onDragStart={e => e.dataTransfer.setData('application/json', JSON.stringify({ employeeId: m.employee?.id, employeeName: `${m.employee?.first_name} ${m.employee?.last_name}`, sourceTeamId: team.id }))}>
                <GripVertical size={11} color="#444" style={{ cursor: 'grab', flexShrink: 0 }} />
                <EmployeeAvatar employee={m.employee} size={24} showName isLeader={m.employee?.id === team.leader_employee_id} />
                {m.employee?.id !== team.leader_employee_id && (
                  <button onClick={() => onManageMembers(team, 'remove', m.employee?.id)} style={{ marginLeft: 'auto', width: 20, height: 20, borderRadius: 5, background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.15)', color: '#EF4444', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><UserMinus size={10} /></button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {expanded && (!team.members || team.members.length === 0) && (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5, padding: 12, textAlign: 'center', borderTop: '1px solid rgba(255,255,255,0.04)' }}>
          <Users size={18} color="#F59E0B" />
          <span style={{ color: '#888', fontSize: 11 }}>Aucun membre</span>
          <button onClick={() => onManageMembers(team)} style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '4px 10px', background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.25)', borderRadius: 5, color: '#F59E0B', fontSize: 10, fontWeight: 600, cursor: 'pointer' }}><UserPlus size={11} /><span>Ajouter</span></button>
        </div>
      )}
    </div>
  )
}

/* ═══════════════ KANBAN ═══════════════ */

function KanbanView({ teams, onDrop }) {
  const columns = useMemo(() => {
    const c = { healthy: [], warning: [], critical: [], unknown: [] }
    teams.forEach(t => { const s = t.health?.status || 'unknown'; if (c[s]) c[s].push(t) })
    return c
  }, [teams])
  const cfg = { healthy: { label: '🟢 Saines', color: '#10B981' }, warning: { label: '🟡 À surveiller', color: '#F59E0B' }, critical: { label: '🔴 Critiques', color: '#EF4444' }, unknown: { label: '⚪ Non évaluées', color: '#888' } }

  return (
    <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 6 }}>
      {Object.entries(columns).map(([st, ts]) => (
        <div key={st} style={{ minWidth: 220, flex: 1, background: 'rgba(20,20,35,0.6)', borderRadius: 10, border: '1px solid rgba(255,255,255,0.06)' }}>
          <div style={{ padding: '8px 10px', borderBottom: '1px solid rgba(255,255,255,0.06)', borderLeft: `3px solid ${cfg[st].color}`, display: 'flex', justifyContent: 'space-between', fontSize: 11, color: '#ccc' }}><span>{cfg[st].label}</span><span style={{ background: 'rgba(255,255,255,0.1)', padding: '1px 6px', borderRadius: 8, fontSize: 10, color: '#888' }}>{ts.length}</span></div>
          <div style={{ padding: 6, display: 'flex', flexDirection: 'column', gap: 5, maxHeight: 400, overflowY: 'auto' }}>
            {ts.map(t => (
              <div key={t.id} style={{ padding: 7, background: 'rgba(20,20,35,0.8)', borderRadius: 7, border: '1px solid rgba(255,255,255,0.06)' }}
                onDragOver={e => e.preventDefault()} onDrop={e => { e.preventDefault(); try { const d = JSON.parse(e.dataTransfer.getData('application/json')); if (d.sourceTeamId !== t.id) onDrop(t.id, d) } catch {} }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 5 }}>
                  <div style={{ width: 6, height: 6, borderRadius: 2, background: t.color || '#F59E0B' }} />
                  <span style={{ color: '#FFF', fontSize: 12, fontWeight: 600 }}>{t.name}</span>
                </div>
                <div style={{ display: 'flex', gap: 5, alignItems: 'center', flexWrap: 'wrap' }}>
                  <StatBadge icon={Users} value={t.member_count || 0} />
                  {t.leader && <EmployeeAvatar employee={t.leader} size={18} isLeader />}
                </div>
              </div>
            ))}
            {ts.length === 0 && <div style={{ padding: 16, textAlign: 'center', color: '#666', fontSize: 11 }}>Aucune</div>}
          </div>
        </div>
      ))}
    </div>
  )
}

/* ═══════════════ MODALS ═══════════════ */

function TeamModal({ isOpen, onClose, team, employees, onSave, loading }) {
  const [form, setForm] = useState({ name: '', description: '', color: '#F59E0B', leader_employee_id: '' })
  useEffect(() => { if (isOpen) setForm({ name: team?.name || '', description: team?.description || '', color: team?.color || '#F59E0B', leader_employee_id: team?.leader_employee_id || '' }) }, [team, isOpen])
  if (!isOpen) return null
  const submit = e => { e.preventDefault(); if (!form.name.trim()) { toast.error('Nom requis'); return }; onSave(form) }
  return (
    <div style={S.overlay} onClick={onClose}>
      <div style={S.modal} onClick={e => e.stopPropagation()}>
        <div style={S.modalHead}><h2 style={S.modalTitle}>{team ? 'Modifier' : 'Nouvelle équipe'}</h2><button onClick={onClose} style={S.modalX}><X size={16} /></button></div>
        <form onSubmit={submit} style={S.modalBody}>
          <div style={S.field}><label style={S.label}>Nom *</label><input type="text" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} style={S.input} placeholder="Ex: Équipe Maintenance" required /></div>
          <div style={S.field}><label style={S.label}>Description</label><textarea value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} style={{ ...S.input, minHeight: 60, resize: 'vertical' }} placeholder="Description..." /></div>
          <div style={S.field}><label style={S.label}>Couleur</label><div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>{TEAM_COLORS.map(c => <button key={c} type="button" onClick={() => setForm({ ...form, color: c })} style={{ width: 28, height: 28, borderRadius: 7, background: c, cursor: 'pointer', border: form.color === c ? '3px solid #FFF' : '3px solid transparent', boxShadow: form.color === c ? `0 0 0 2px ${c}` : 'none' }} />)}</div></div>
          <div style={S.field}><label style={S.label}><Crown size={11} color="#F59E0B" /> Leader</label><select value={form.leader_employee_id} onChange={e => setForm({ ...form, leader_employee_id: e.target.value })} style={S.select}><option value="">Aucun</option>{employees.map(e => <option key={e.id} value={e.id}>{e.first_name} {e.last_name}{e.position ? ` - ${e.position}` : ''}</option>)}</select></div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 14 }}>
            <button type="button" onClick={onClose} style={S.btnSec} disabled={loading}>Annuler</button>
            <button type="submit" style={S.btnPri} disabled={loading}>{loading ? <><Loader2 size={14} className="spin" /> Sauvegarde...</> : <><Check size={14} /> {team ? 'Enregistrer' : 'Créer'}</>}</button>
          </div>
        </form>
      </div>
    </div>
  )
}

function MembersModal({ isOpen, onClose, team, availableEmployees, onAddMembers, onRemoveMember, loading }) {
  const [sel, setSel] = useState([])
  const [search, setSearch] = useState('')
  useEffect(() => { if (isOpen) { setSel([]); setSearch('') } }, [isOpen])
  if (!isOpen || !team) return null
  const filtered = availableEmployees.filter(e => `${e.first_name} ${e.last_name} ${e.position || ''}`.toLowerCase().includes(search.toLowerCase()))
  const toggle = id => setSel(p => p.includes(id) ? p.filter(x => x !== id) : [...p, id])
  const add = () => { if (!sel.length) { toast.error('Sélectionnez au moins un'); return }; onAddMembers(sel) }
  return (
    <div style={S.overlay} onClick={onClose}>
      <div style={{ ...S.modal, maxWidth: 460 }} onClick={e => e.stopPropagation()}>
        <div style={S.modalHead}><div><h2 style={S.modalTitle}>Gérer les membres</h2><p style={{ margin: '1px 0 0', fontSize: 12, color: '#F59E0B' }}>{team.name}</p></div><button onClick={onClose} style={S.modalX}><X size={16} /></button></div>
        <div style={S.modalBody}>
          {team.members?.length > 0 && (
            <div style={{ marginBottom: 12 }}>
              <label style={S.label}><Users size={11} color="#F59E0B" /> Actuels ({team.members.length})</label>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
                {team.members.map(m => (
                  <div key={m.id} style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '3px 8px', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 12, fontSize: 10, color: '#ccc' }}>
                    <EmployeeAvatar employee={m.employee} size={18} isLeader={m.employee?.id === team.leader_employee_id} />
                    <span>{m.employee?.first_name} {m.employee?.last_name}</span>
                    {m.employee?.id !== team.leader_employee_id && <button onClick={() => onRemoveMember(m.employee?.id)} disabled={loading} style={{ background: 'transparent', border: 'none', padding: 1, color: '#EF4444', cursor: 'pointer', display: 'flex' }}><X size={9} /></button>}
                  </div>
                ))}
              </div>
            </div>
          )}
          <label style={S.label}><UserPlus size={11} color="#10B981" /> Ajouter</label>
          <div style={{ display: 'flex', alignItems: 'center', gap: 7, background: 'rgba(20,20,35,0.8)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 8, padding: '7px 10px', marginBottom: 8 }}>
            <Search size={13} color="#F59E0B" />
            <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="Rechercher..." style={{ flex: 1, background: 'transparent', border: 'none', outline: 'none', color: '#FFF', fontSize: 12 }} />
          </div>
          {filtered.length === 0 ? <div style={{ textAlign: 'center', padding: 20, color: '#888', fontSize: 12 }}>Aucun disponible</div> : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4, maxHeight: 220, overflowY: 'auto' }}>
              {filtered.map(e => (
                <div key={e.id} onClick={() => toggle(e.id)} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, padding: 8, borderRadius: 8, border: `1px solid ${sel.includes(e.id) ? 'rgba(245,158,11,0.3)' : 'rgba(255,255,255,0.06)'}`, background: sel.includes(e.id) ? 'rgba(245,158,11,0.08)' : 'rgba(255,255,255,0.02)', cursor: 'pointer', transition: 'all 0.15s' }}>
                  <EmployeeAvatar employee={e} size={28} showName />
                  <div style={{ width: 18, height: 18, borderRadius: 5, border: sel.includes(e.id) ? '2px solid #F59E0B' : '2px solid rgba(255,255,255,0.15)', background: sel.includes(e.id) ? 'rgba(245,158,11,0.15)' : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{sel.includes(e.id) && <Check size={10} color="#F59E0B" />}</div>
                </div>
              ))}
            </div>
          )}
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, padding: '10px 14px', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
          <button onClick={onClose} style={S.btnSec} disabled={loading}>Fermer</button>
          {sel.length > 0 && <button onClick={add} style={S.btnPri} disabled={loading}>{loading ? <Loader2 size={13} className="spin" /> : <UserPlus size={13} />} Ajouter {sel.length}</button>}
        </div>
      </div>
    </div>
  )
}

function DeleteModal({ open, onClose, onConfirm, teamName, loading }) {
  if (!open) return null
  return (
    <div style={S.overlay} onClick={onClose}>
      <div style={{ ...S.modal, maxWidth: 380 }} onClick={e => e.stopPropagation()}>
        <div style={{ padding: 24, textAlign: 'center' }}>
          <div style={{ width: 50, height: 50, borderRadius: 13, background: 'rgba(239,68,68,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 14px' }}><AlertTriangle size={24} color="#EF4444" /></div>
          <h3 style={{ color: '#FFF', fontSize: 16, margin: '0 0 8px' }}>Supprimer l'équipe</h3>
          <p style={{ color: '#888', fontSize: 13, margin: '0 0 20px', lineHeight: 1.5 }}>Supprimer <strong style={{ color: '#F59E0B' }}>"{teamName}"</strong> ?</p>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={onClose} style={{ ...S.btnSec, flex: 1 }} disabled={loading}>Annuler</button>
            <button onClick={onConfirm} style={{ ...S.btnDanger, flex: 1 }} disabled={loading}>{loading ? <Loader2 size={13} className="spin" /> : <Trash2 size={13} />} Supprimer</button>
          </div>
        </div>
      </div>
    </div>
  )
}

function HistoryModal({ open, onClose, history, loading }) {
  if (!open) return null
  const iconMap = { 'plus': Plus, 'edit': Edit3, 'trash': Trash2, 'user-plus': UserPlus, 'user-minus': UserMinus, 'crown': Crown, 'activity': Activity }
  return (
    <div style={S.overlay} onClick={onClose}>
      <div style={{ ...S.modal, maxWidth: 480 }} onClick={e => e.stopPropagation()}>
        <div style={S.modalHead}><div style={{ display: 'flex', alignItems: 'center', gap: 8 }}><History size={16} color="#F59E0B" /><h2 style={S.modalTitle}>Historique</h2></div><button onClick={onClose} style={S.modalX}><X size={16} /></button></div>
        <div style={{ ...S.modalBody, maxHeight: 360, overflowY: 'auto' }}>
          {loading ? <div style={{ textAlign: 'center', padding: 32 }}><Loader2 size={20} className="spin" color="#F59E0B" /></div> :
           history.length === 0 ? <div style={{ textAlign: 'center', padding: 32, color: '#888', fontSize: 12 }}>Aucun historique</div> :
           <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>{history.map(h => { const I = iconMap[h.icon] || Activity; return (
             <div key={h.id} style={{ display: 'flex', alignItems: 'flex-start', gap: 8, padding: 7, background: 'rgba(255,255,255,0.02)', borderRadius: 6 }}>
               <div style={{ width: 24, height: 24, borderRadius: 6, background: `${h.color}15`, border: `1px solid ${h.color}30`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}><I size={11} color={h.color} /></div>
               <div style={{ flex: 1, minWidth: 0 }}><p style={{ margin: 0, color: '#E5E5E5', fontSize: 12 }}>{h.description}</p><p style={{ margin: '1px 0 0', color: '#888', fontSize: 10 }}>{h.admin} • {new Date(h.timestamp).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}</p></div>
             </div>)})}</div>}
        </div>
      </div>
    </div>
  )
}

function OnboardingModal({ open, onClose, onCreateFirst }) {
  if (!open) return null
  return (
    <div style={S.overlay}>
      <div style={{ ...S.modal, maxWidth: 400 }} onClick={e => e.stopPropagation()}>
        <div style={{ padding: 28, textAlign: 'center' }}>
          <div style={{ width: 60, height: 60, borderRadius: 16, background: 'rgba(245,158,11,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}><Users size={28} color="#F59E0B" /></div>
          <h2 style={{ color: '#FFF', fontSize: 18, margin: '0 0 8px' }}>Bienvenue !</h2>
          <p style={{ color: '#888', fontSize: 13, lineHeight: 1.5, margin: '0 0 20px' }}>Regroupez vos employés en équipes et suivez leurs performances.</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, textAlign: 'left', marginBottom: 20, padding: 14, background: 'rgba(245,158,11,0.05)', borderRadius: 10, border: '1px solid rgba(245,158,11,0.1)' }}>
            {['Créez une équipe', 'Ajoutez des membres', 'Désignez un leader'].map((t, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{ width: 22, height: 22, borderRadius: 5, background: i === 0 ? '#F59E0B' : 'rgba(245,158,11,0.2)', color: i === 0 ? '#000' : '#F59E0B', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700 }}>{i + 1}</div>
                <span style={{ color: i === 0 ? '#E5E5E5' : '#888', fontSize: 12 }}>{t}</span>
              </div>
            ))}
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={onClose} style={{ ...S.btnSec, flex: 1 }}>Plus tard</button>
            <button onClick={onCreateFirst} style={{ ...S.btnPri, flex: 1 }}><Plus size={14} /> Créer</button>
          </div>
        </div>
      </div>
    </div>
  )
}

function ShortcutsModal({ open, onClose }) {
  if (!open) return null
  return (
    <div style={S.overlay} onClick={onClose}>
      <div style={{ ...S.modal, maxWidth: 300 }} onClick={e => e.stopPropagation()}>
        <div style={S.modalHead}><h2 style={S.modalTitle}>Raccourcis</h2><button onClick={onClose} style={S.modalX}><X size={16} /></button></div>
        <div style={S.modalBody}>
          {[['N', 'Nouvelle équipe'], ['/', 'Rechercher'], ['R', 'Rafraîchir'], ['G', 'Grille'], ['L', 'Liste'], ['K', 'Kanban'], ['Esc', 'Fermer'], ['?', 'Raccourcis']].map(([k, a]) => (
            <div key={k} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 0', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
              <kbd style={{ padding: '3px 8px', background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.25)', borderRadius: 4, color: '#F59E0B', fontSize: 11, fontWeight: 700, fontFamily: 'monospace' }}>{k}</kbd>
              <span style={{ color: '#ccc', fontSize: 12 }}>{a}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

/* ═══════════════ COMPOSANT PRINCIPAL ═══════════════ */

export default function Teams() {
  const navigate = useNavigate()
  const [admin, setAdmin] = useState(null)
  const [enterpriseId, setEnterpriseId] = useState(null)
  const [hasFeature, setHasFeature] = useState(false)
  const [hasPredictions, setHasPredictions] = useState(false)
  const [teams, setTeams] = useState([])
  const [employees, setEmployees] = useState([])
  const [healthGlobal, setHealthGlobal] = useState(null)
  const [alerts, setAlerts] = useState([])
  const [orphans, setOrphans] = useState([])
  const [suggestions, setSuggestions] = useState([])
  const [staffingNeeds, setStaffingNeeds] = useState([])
  const [history, setHistory] = useState([])
  const [loading, setLoading] = useState(true)
  const [loadingAnalytics, setLoadingAnalytics] = useState(false)
  const [saving, setSaving] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [viewMode, setViewMode] = useState(VIEW_MODES.GRID)
  const [sortKey, setSortKey] = useState('name_asc')
  const [filterKey, setFilterKey] = useState('all')
  const [expandedTeamId, setExpandedTeamId] = useState(null)
  const [selectedTeams, setSelectedTeams] = useState([])
  const [showTeamModal, setShowTeamModal] = useState(false)
  const [showMembersModal, setShowMembersModal] = useState(false)
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [showHistoryModal, setShowHistoryModal] = useState(false)
  const [showOnboarding, setShowOnboarding] = useState(false)
  const [showShortcuts, setShowShortcuts] = useState(false)
  const [selectedTeam, setSelectedTeam] = useState(null)
  const [availableEmployees, setAvailableEmployees] = useState([])
  const [deleteTarget, setDeleteTarget] = useState(null)
  const searchRef = useRef(null)

  useEffect(() => {
    const init = async () => {
      try {
        const ad = JSON.parse(localStorage.getItem('admin') || '{}')
        setAdmin(ad)
        const eid = ad.selectedEnterprise?.id || ad.enterprise_id
        setEnterpriseId(eid)
        if (!eid) { toast.error('Aucune entreprise'); navigate('/dashboard'); return }
        const [ht, hp] = await Promise.all([FeatureService.hasFeature(eid, FEATURES.GESTION_EQUIPES), FeatureService.hasFeature(eid, FEATURES.PREDICTIONS)])
        setHasFeature(ht); setHasPredictions(hp)
        if (!ht && ad.role !== 'super_admin') { toast.error("Module non activé"); navigate('/dashboard'); return }
        await loadData(eid)
        const seen = localStorage.getItem(`teams_onboarding_${eid}`)
        if (!seen) { const { data: ex } = await getTeams(eid, {}); if (!ex?.length) setShowOnboarding(true); localStorage.setItem(`teams_onboarding_${eid}`, 'true') }
      } catch (e) { console.error(e); toast.error('Erreur') }
    }
    init()
  }, [navigate])

  useEffect(() => {
    const h = (e) => {
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement?.tagName)) return
      switch (e.key.toLowerCase()) {
        case 'n': e.preventDefault(); handleCreateTeam(); break
        case '/': e.preventDefault(); searchRef.current?.focus(); break
        case 'r': e.preventDefault(); refresh(); break
        case 'g': e.preventDefault(); setViewMode(VIEW_MODES.GRID); break
        case 'l': e.preventDefault(); setViewMode(VIEW_MODES.LIST); break
        case 'k': e.preventDefault(); setViewMode(VIEW_MODES.KANBAN); break
        case 'escape': setShowTeamModal(false); setShowMembersModal(false); setShowDeleteModal(false); setShowHistoryModal(false); setShowShortcuts(false); setShowOnboarding(false); break
        case '?': e.preventDefault(); setShowShortcuts(true); break
      }
    }
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [])

  const loadData = useCallback(async (eid) => {
    setLoading(true)
    try {
      const [tr, er] = await Promise.all([getTeams(eid, { includeMembers: true, includeStats: true }), supabase.from('employees').select('id, first_name, last_name, photo_url, position, department, hire_date').eq('enterprise_id', eid).eq('is_active', true).order('first_name')])
      if (tr.error) throw tr.error
      let td = tr.data || []; setEmployees(er.data || [])
      if (await FeatureService.hasFeature(eid, FEATURES.PREDICTIONS)) {
        setLoadingAnalytics(true)
        const [hr, ar, or, sr, str] = await Promise.all([getTeamHealthMetrics(eid), getTeamAlerts(eid), getOrphanEmployees(eid), detectPotentialTeams(eid), predictStaffingNeeds(eid)])
        setHealthGlobal(hr.global); setAlerts(ar.data || []); setOrphans(or.data || []); setSuggestions(sr.data || []); setStaffingNeeds(str.data || [])
        if (hr.data) { const hm = new Map(hr.data.map(h => [h.team_id, h])); td = td.map(t => ({ ...t, health: hm.get(t.id) || null })) }
        setLoadingAnalytics(false)
      }
      setTeams(td)
    } catch (e) { console.error(e); toast.error('Erreur') } finally { setLoading(false) }
  }, [])

  const refresh = useCallback(() => { if (enterpriseId) loadData(enterpriseId) }, [enterpriseId, loadData])
  const loadHistory = useCallback(async () => { if (!enterpriseId) return; const { data } = await getTeamHistory(enterpriseId); setHistory(data || []) }, [enterpriseId])
  const handleCreateTeam = useCallback(() => { setSelectedTeam(null); setShowTeamModal(true); setShowOnboarding(false) }, [])
  const handleEditTeam = useCallback(t => { setSelectedTeam(t); setShowTeamModal(true) }, [])

  const handleSaveTeam = useCallback(async (fd) => {
    setSaving(true)
    try {
      if (selectedTeam) { const { error } = await updateTeam(selectedTeam.id, fd, admin.id); if (error) throw error; await logTeamAction(enterpriseId, admin.id, 'update_team', selectedTeam.id, { team_name: fd.name }); toast.success('Modifiée') }
      else { const { data, error } = await createTeam({ ...fd, enterprise_id: enterpriseId }, admin.id); if (error) throw error; await logTeamAction(enterpriseId, admin.id, 'create_team', data?.id, { team_name: fd.name }); toast.success('Créée') }
      setShowTeamModal(false); await loadData(enterpriseId)
    } catch (e) { toast.error(e.message || 'Erreur') } finally { setSaving(false) }
  }, [selectedTeam, admin, enterpriseId, loadData])

  const handleDeleteTeam = useCallback(async () => {
    if (!deleteTarget) return; setSaving(true)
    try { const { success, error } = await deleteTeam(deleteTarget.id, admin.id); if (!success) throw error; await logTeamAction(enterpriseId, admin.id, 'delete_team', deleteTarget.id, { team_name: deleteTarget.name }); toast.success('Supprimée'); setDeleteTarget(null); setShowDeleteModal(false); await loadData(enterpriseId) }
    catch (e) { toast.error(e.message || 'Erreur') } finally { setSaving(false) }
  }, [deleteTarget, admin, enterpriseId, loadData])

  const confirmDelete = useCallback(t => { setDeleteTarget(t); setShowDeleteModal(true) }, [])

  const handleManageMembers = useCallback(async (team, action = 'open', empId = null) => {
    if (action === 'remove' && empId) {
      setSaving(true)
      try { const { success, error } = await removeTeamMember(team.id, empId); if (!success) throw error; const e = employees.find(x => x.id === empId); await logTeamAction(enterpriseId, admin.id, 'remove_team_member', team.id, { team_name: team.name, member_name: e ? `${e.first_name} ${e.last_name}` : '' }); toast.success('Retiré'); await loadData(enterpriseId) }
      catch (e) { toast.error(e.message || 'Erreur') } finally { setSaving(false) }
      return
    }
    setSelectedTeam(team); const { data } = await getAvailableEmployeesForTeam(enterpriseId, team.id); setAvailableEmployees(data || []); setShowMembersModal(true)
  }, [enterpriseId, employees, admin, loadData])

  const handleAddMembers = useCallback(async (ids) => {
    setSaving(true)
    try { const { error } = await addTeamMembers(selectedTeam.id, ids); if (error) throw error; for (const id of ids) { const e = employees.find(x => x.id === id); await logTeamAction(enterpriseId, admin.id, 'add_team_member', selectedTeam.id, { team_name: selectedTeam.name, member_name: e ? `${e.first_name} ${e.last_name}` : '', employee_id: id }) }; toast.success(`${ids.length} ajouté(s)`); setShowMembersModal(false); await loadData(enterpriseId) }
    catch (e) { toast.error(e.message || 'Erreur') } finally { setSaving(false) }
  }, [selectedTeam, employees, admin, enterpriseId, loadData])

  const handleRemoveMemberFromModal = useCallback(async (empId) => {
    await handleManageMembers(selectedTeam, 'remove', empId)
    const { data } = await getAvailableEmployeesForTeam(enterpriseId, selectedTeam.id); setAvailableEmployees(data || [])
    const { data: ut } = await getTeams(enterpriseId, { includeMembers: true }); const u = ut?.find(t => t.id === selectedTeam.id); if (u) setSelectedTeam(u)
  }, [selectedTeam, enterpriseId, handleManageMembers])

  const handleChangeLeader = useCallback(t => { setSelectedTeam(t); setShowTeamModal(true) }, [])

  const handleDrop = useCallback(async (tid, data) => {
    const { employeeId, employeeName, sourceTeamId } = data; if (!employeeId || tid === sourceTeamId) return
    setSaving(true)
    try { if (sourceTeamId) await removeTeamMember(sourceTeamId, employeeId); await addTeamMembers(tid, [employeeId]); const tt = teams.find(t => t.id === tid); const st = teams.find(t => t.id === sourceTeamId); toast.success(`${employeeName} → ${tt?.name}`); await logTeamAction(enterpriseId, admin.id, 'move_team_member', tid, { member_name: employeeName, from_team: st?.name, to_team: tt?.name }); await loadData(enterpriseId) }
    catch { toast.error('Erreur déplacement') } finally { setSaving(false) }
  }, [teams, admin, enterpriseId, loadData])

  const toggleSel = useCallback(id => setSelectedTeams(p => p.includes(id) ? p.filter(x => x !== id) : [...p, id]), [])
  const selAll = useCallback(() => setSelectedTeams(filteredTeams.map(t => t.id)), [])
  const clearSel = useCallback(() => setSelectedTeams([]), [])
  const bulkDel = useCallback(async () => {
    if (!selectedTeams.length || !confirm(`Supprimer ${selectedTeams.length} équipe(s) ?`)) return
    setSaving(true); try { for (const id of selectedTeams) await deleteTeam(id, admin.id); toast.success(`${selectedTeams.length} supprimée(s)`); setSelectedTeams([]); await loadData(enterpriseId) } catch { toast.error('Erreur') } finally { setSaving(false) }
  }, [selectedTeams, admin, enterpriseId, loadData])

  const handleAddOrphanToTeam = useCallback(async (eid, tid) => {
    setSaving(true); try { await addTeamMembers(tid, [eid]); const e = orphans.find(o => o.id === eid); const t = teams.find(x => x.id === tid); toast.success(`${e?.first_name} → ${t?.name}`); await loadData(enterpriseId) } catch { toast.error('Erreur') } finally { setSaving(false) }
  }, [orphans, teams, enterpriseId, loadData])

  const handleCreateSuggestedTeam = useCallback(async (s) => {
    setSaving(true); try { const { error } = await createTeam({ enterprise_id: enterpriseId, name: s.name, color: s.suggested_color, initial_members: s.employee_ids || [] }, admin.id); if (error) throw error; toast.success(`"${s.name}" créée`); await loadData(enterpriseId) } catch (e) { toast.error(e.message || 'Erreur') } finally { setSaving(false) }
  }, [enterpriseId, admin, loadData])

  const filteredTeams = useMemo(() => {
    let r = [...teams]
    if (searchTerm) { const t = searchTerm.toLowerCase(); r = r.filter(x => x.name.toLowerCase().includes(t) || x.description?.toLowerCase().includes(t)) }
    switch (filterKey) {
      case 'with_leader': r = r.filter(t => t.leader_employee_id); break
      case 'without_leader': r = r.filter(t => !t.leader_employee_id); break
      case 'active': r = r.filter(t => (t.member_count || 0) > 0); break
      case 'empty': r = r.filter(t => (t.member_count || 0) === 0); break
      case 'critical': r = r.filter(t => t.health?.status === 'critical'); break
      case 'warning': r = r.filter(t => t.health?.status === 'warning'); break
    }
    const so = SORT_OPTIONS.find(s => s.key === sortKey)
    if (so) r.sort((a, b) => { let va = so.field === 'health_score' ? (a.health?.health_score ?? 100) : a[so.field], vb = so.field === 'health_score' ? (b.health?.health_score ?? 100) : b[so.field]; return typeof va === 'string' ? (so.dir === 'asc' ? va.localeCompare(vb) : vb.localeCompare(va)) : (so.dir === 'asc' ? va - vb : vb - va) })
    return r
  }, [teams, searchTerm, filterKey, sortKey])

  const totalMembers = useMemo(() => teams.reduce((s, t) => s + (t.member_count || 0), 0), [teams])

  if (loading) return (
    <div style={S.container}><div style={S.bgPattern} /><main style={S.main}>
      <div style={S.headerSection}><div style={{ display: 'flex', alignItems: 'center', gap: 10 }}><div style={S.titleIcon}><Users size={20} color="#F59E0B" /></div><div><h1 style={S.pageTitle}>Gestion des Équipes</h1><p style={S.pageSub}>Chargement...</p></div></div></div>
      <SkeletonCard /><SkeletonCard /><SkeletonCard />
    </main></div>
  )

  return (
    <>
      <style>{`
        @keyframes fadeInUp{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:translateY(0)}}
        @keyframes shimmer{0%{background-position:-200% 0}100%{background-position:200% 0}}
        @keyframes spin{from{transform:rotate(0)}to{transform:rotate(360deg)}}
        .spin{animation:spin 1s linear infinite}
        .team-card{transition:all .2s ease !important}
        .team-card:hover{transform:translateY(-2px) !important;box-shadow:0 8px 28px rgba(0,0,0,.35) !important}
        .team-row{transition:all .15s ease !important}
        .team-row:hover{background:rgba(245,158,11,.04) !important}
        ::-webkit-scrollbar{width:4px;height:4px}
        ::-webkit-scrollbar-track{background:#0A0A0F}
        ::-webkit-scrollbar-thumb{background:#F59E0B;border-radius:2px}
        @media(max-width:700px){
          .teams-grid-wrap{grid-template-columns:1fr !important}
          .header-row{flex-wrap:wrap !important;gap:6px !important}
          .stats-strip{overflow-x:auto !important;flex-wrap:nowrap !important}
          .stats-strip>div{flex-shrink:0 !important}
          .toolbar-row{flex-direction:column !important;gap:6px !important}
          .toolbar-row .search-wrap{max-width:none !important;width:100% !important}
          .tab-label{display:none !important}
          .insights-hscroll{flex-direction:column !important}
        }
        @media(max-width:480px){
          .header-extras{display:none !important}
          .btn-label{display:none !important}
        }
      `}</style>

      <div style={S.container}>
        <div style={S.bgPattern} />
        <main style={S.main}>

          {/* ── HEADER ── */}
          <div className="header-row" style={S.headerSection}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={S.titleIcon}><Users size={20} color="#F59E0B" /></div>
              <div>
                <h1 style={S.pageTitle}>Gestion des Équipes</h1>
                <p style={S.pageSub}>{teams.length} équipe{teams.length > 1 ? 's' : ''} • {totalMembers} membres</p>
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
              <div className="header-extras" style={S.liveBadge}><Activity size={10} /> En direct</div>
              <button onClick={() => { loadHistory(); setShowHistoryModal(true) }} style={S.iconBtnH} title="Historique"><History size={14} /></button>
              <button onClick={() => setShowShortcuts(true)} style={S.iconBtnH} title="?"><HelpCircle size={14} /></button>
              <button onClick={refresh} style={S.iconBtnH} title="R"><RefreshCw size={14} /></button>
              <button onClick={handleCreateTeam} style={S.btnPri}><Plus size={14} /> <span className="btn-label">Nouvelle équipe</span></button>
            </div>
          </div>

          {/* ── STATS STRIP ── */}
          <div className="stats-strip" style={S.statsStrip}>
            {[
              { icon: Users, val: teams.length, lbl: 'Équipes', col: '#F59E0B' },
              { icon: Target, val: totalMembers, lbl: 'Membres', col: '#6366F1' },
              { icon: Crown, val: teams.filter(t => t.leader_employee_id).length, lbl: 'Leaders', col: '#F97316' },
              ...(healthGlobal ? [{ icon: Heart, val: `${healthGlobal.avg_health_score}%`, lbl: 'Santé', col: '#10B981' }] : [])
            ].map((s, i) => (
              <div key={i} style={S.statChip}>
                <s.icon size={14} color={s.col} />
                <span style={{ color: '#FFF', fontSize: 14, fontWeight: 700 }}>{s.val}</span>
                <span style={{ color: '#888', fontSize: 9, textTransform: 'uppercase', letterSpacing: .5 }}>{s.lbl}</span>
              </div>
            ))}
          </div>

          {/* ── INSIGHTS BANNER (intégré, pas en sidebar) ── */}
          <InsightsBanner
            orphans={orphans} alerts={alerts} suggestions={suggestions}
            staffingNeeds={staffingNeeds} healthGlobal={healthGlobal}
            onAddOrphanToTeam={handleAddOrphanToTeam}
            onCreateSuggestedTeam={handleCreateSuggestedTeam}
            loading={loadingAnalytics} hasPredictions={hasPredictions}
          />

          {/* ── TOOLBAR ── */}
          <div className="toolbar-row" style={S.toolbar}>
            <div className="search-wrap" style={S.searchBox}>
              <Search size={13} color="#F59E0B" />
              <input ref={searchRef} type="text" placeholder="Rechercher... (/)" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} style={S.searchInput} />
              {searchTerm && <button onClick={() => setSearchTerm('')} style={{ background: 'rgba(255,255,255,0.1)', border: 'none', borderRadius: '50%', width: 16, height: 16, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#888', cursor: 'pointer' }}><X size={10} /></button>}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 5, flexWrap: 'wrap' }}>
              <select value={filterKey} onChange={e => setFilterKey(e.target.value)} style={S.sel}>{FILTER_PRESETS.map(f => <option key={f.key} value={f.key}>{f.label}</option>)}</select>
              <select value={sortKey} onChange={e => setSortKey(e.target.value)} style={S.sel}>{SORT_OPTIONS.map(s => <option key={s.key} value={s.key}>{s.label}</option>)}</select>
              <div style={S.viewToggle}>
                {[{ m: VIEW_MODES.GRID, i: LayoutGrid }, { m: VIEW_MODES.LIST, i: List }, { m: VIEW_MODES.KANBAN, i: Columns3 }].map(v => (
                  <button key={v.m} onClick={() => setViewMode(v.m)} style={{ ...S.viewBtn, ...(viewMode === v.m ? S.viewBtnActive : {}) }}><v.i size={13} /></button>
                ))}
              </div>
            </div>
          </div>

          {/* ── BULK BAR ── */}
          {selectedTeams.length > 0 && (
            <div style={S.bulkBar}>
              <span style={{ color: '#F59E0B', fontWeight: 600, fontSize: 12 }}>{selectedTeams.length} sélect.</span>
              <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
                <button onClick={selAll} style={S.bulkBtn}>Tout</button>
                <button onClick={clearSel} style={S.bulkBtn}>Désélect.</button>
                <button onClick={bulkDel} style={{ ...S.bulkBtn, color: '#EF4444', borderColor: 'rgba(239,68,68,.3)' }}><Trash2 size={11} /> Supprimer</button>
              </div>
            </div>
          )}

          {/* ── TEAMS CONTENT (pleine largeur) ── */}
          <div>
            {filteredTeams.length === 0 ? (
              <div style={S.emptyState}>
                <div style={{ width: 50, height: 50, borderRadius: 14, background: 'rgba(245,158,11,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 10px' }}><Users size={28} color="#F59E0B" /></div>
                <h3 style={{ color: '#FFF', fontSize: 14, margin: '0 0 5px' }}>{searchTerm ? 'Aucun résultat' : 'Aucune équipe'}</h3>
                <p style={{ color: '#888', fontSize: 11, margin: '0 0 12px' }}>{searchTerm ? 'Essayez une autre recherche' : 'Créez votre première équipe'}</p>
                {!searchTerm && <button onClick={handleCreateTeam} style={S.btnPri}><Plus size={13} /> Créer</button>}
              </div>
            ) : viewMode === VIEW_MODES.KANBAN ? (
              <KanbanView teams={filteredTeams} onDrop={handleDrop} />
            ) : viewMode === VIEW_MODES.LIST ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                {filteredTeams.map((t, i) => <div key={t.id} style={{ animation: `fadeInUp .25s ease ${i * .03}s forwards`, opacity: 0 }}><TeamCard team={t} viewMode={viewMode} onEdit={handleEditTeam} onDelete={confirmDelete} onManageMembers={handleManageMembers} onChangeLeader={handleChangeLeader} expanded={expandedTeamId === t.id} onToggle={id => setExpandedTeamId(expandedTeamId === id ? null : id)} selected={selectedTeams.includes(t.id)} onSelect={toggleSel} onDrop={handleDrop} /></div>)}
              </div>
            ) : (
              <div className="teams-grid-wrap" style={S.teamsGrid}>
                {filteredTeams.map((t, i) => <div key={t.id} style={{ animation: `fadeInUp .25s ease ${i * .04}s forwards`, opacity: 0 }}><TeamCard team={t} viewMode={viewMode} onEdit={handleEditTeam} onDelete={confirmDelete} onManageMembers={handleManageMembers} onChangeLeader={handleChangeLeader} expanded={expandedTeamId === t.id} onToggle={id => setExpandedTeamId(expandedTeamId === id ? null : id)} selected={selectedTeams.includes(t.id)} onSelect={toggleSel} onDrop={handleDrop} /></div>)}
              </div>
            )}
          </div>
        </main>
      </div>

      <TeamModal isOpen={showTeamModal} onClose={() => setShowTeamModal(false)} team={selectedTeam} employees={employees} onSave={handleSaveTeam} loading={saving} />
      <MembersModal isOpen={showMembersModal} onClose={() => setShowMembersModal(false)} team={selectedTeam} availableEmployees={availableEmployees} onAddMembers={handleAddMembers} onRemoveMember={handleRemoveMemberFromModal} loading={saving} />
      <DeleteModal open={showDeleteModal} onClose={() => { setShowDeleteModal(false); setDeleteTarget(null) }} onConfirm={handleDeleteTeam} teamName={deleteTarget?.name || ''} loading={saving} />
      <HistoryModal open={showHistoryModal} onClose={() => setShowHistoryModal(false)} history={history} loading={false} />
      <OnboardingModal open={showOnboarding} onClose={() => setShowOnboarding(false)} onCreateFirst={handleCreateTeam} />
      <ShortcutsModal open={showShortcuts} onClose={() => setShowShortcuts(false)} />
    </>
  )
}

/* ═══════════════ STYLES ═══════════════ */

const S = {
  container: { minHeight: '100vh', background: '#0A0A0F', position: 'relative' },
  bgPattern: { position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, pointerEvents: 'none', zIndex: 0, backgroundImage: 'radial-gradient(circle at 15% 50%, rgba(245,158,11,0.03) 0%, transparent 50%), radial-gradient(circle at 85% 20%, rgba(99,102,241,0.03) 0%, transparent 50%)' },
  main: { padding: 'clamp(10px, 2.5vw, 20px)', maxWidth: 1280, margin: '0 auto', position: 'relative', zIndex: 1, display: 'flex', flexDirection: 'column', gap: 10 },

  headerSection: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10 },
  titleIcon: { width: 38, height: 38, borderRadius: 10, background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center' },
  pageTitle: { color: '#FFF', fontSize: 'clamp(16px, 2.5vw, 20px)', fontWeight: 700, margin: 0 },
  pageSub: { color: '#888', fontSize: 11, margin: '1px 0 0' },
  liveBadge: { display: 'flex', alignItems: 'center', gap: 4, background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.25)', color: '#10B981', padding: '3px 9px', borderRadius: 12, fontSize: 10, fontWeight: 600 },
  iconBtnH: { width: 32, height: 32, borderRadius: 8, border: '1px solid rgba(255,255,255,0.08)', background: 'rgba(255,255,255,0.04)', color: '#aaa', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' },

  statsStrip: { display: 'flex', gap: 6, flexWrap: 'wrap' },
  statChip: { display: 'flex', alignItems: 'center', gap: 7, padding: '8px 12px', background: 'rgba(20,20,35,0.8)', borderRadius: 9, border: '1px solid rgba(255,255,255,0.06)' },

  // Insights banner — horizontal intégré
  insightsBanner: { background: 'rgba(20,20,35,0.8)', borderRadius: 10, border: '1px solid rgba(255,255,255,0.06)', overflow: 'hidden' },
  insightsBannerLocked: { display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px', background: 'rgba(20,20,35,0.8)', borderRadius: 10, border: '1px solid rgba(255,255,255,0.06)' },
  insightsBannerTop: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '9px 12px', cursor: 'pointer', gap: 8, flexWrap: 'wrap' },
  insightsBannerLeft: { display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' },
  insightsBannerRight: { display: 'flex', alignItems: 'center', gap: 5, flexWrap: 'wrap' },
  healthPill: { display: 'flex', alignItems: 'center', gap: 8, padding: '3px 10px', background: 'rgba(245,158,11,0.06)', borderRadius: 8, border: '1px solid rgba(245,158,11,0.12)' },
  healthDots: { display: 'flex', gap: 6 },
  expandToggle: { width: 24, height: 24, borderRadius: 6, background: 'transparent', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' },
  insightsBannerBody: { borderTop: '1px solid rgba(255,255,255,0.06)' },
  insightsTabs: { display: 'flex', borderBottom: '1px solid rgba(255,255,255,0.06)' },
  insightsTab: { flex: 1, padding: '7px 4px', background: 'transparent', border: 'none', borderBottom: '2px solid transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4, fontSize: 10, cursor: 'pointer' },
  tabLabel: {},
  insightsGrid: { padding: 10 },
  insightsHScroll: { display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 4 },
  insightCard: { minWidth: 200, maxWidth: 280, flex: '0 0 auto', padding: 8, background: 'rgba(255,255,255,0.02)', borderRadius: 7, borderLeft: '3px solid rgba(245,158,11,0.3)', border: '1px solid rgba(255,255,255,0.06)' },
  insightsEmpty: { display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, padding: 16, color: '#888', fontSize: 11 },

  toolbar: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 },
  searchBox: { display: 'flex', alignItems: 'center', gap: 7, background: 'rgba(20,20,35,0.8)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 8, padding: '8px 10px', flex: 1, maxWidth: 320, minWidth: 160 },
  searchInput: { flex: 1, background: 'transparent', border: 'none', outline: 'none', color: '#FFF', fontSize: 12 },
  sel: { background: 'rgba(20,20,35,0.8)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 6, padding: '6px 8px', color: '#E5E5E5', fontSize: 11, cursor: 'pointer', outline: 'none' },
  viewToggle: { display: 'flex', background: 'rgba(20,20,35,0.8)', borderRadius: 6, border: '1px solid rgba(255,255,255,0.06)', overflow: 'hidden' },
  viewBtn: { padding: '6px 8px', background: 'transparent', border: 'none', color: '#666', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' },
  viewBtnActive: { background: 'rgba(245,158,11,0.15)', color: '#F59E0B' },

  bulkBar: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '7px 12px', background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.2)', borderRadius: 8, flexWrap: 'wrap', gap: 6 },
  bulkBtn: { display: 'flex', alignItems: 'center', gap: 3, padding: '4px 8px', background: 'transparent', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 5, color: '#ccc', fontSize: 10, cursor: 'pointer' },

  teamsGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 8 },

  teamCard: { background: 'rgba(20,20,35,0.8)', backdropFilter: 'blur(8px)', borderRadius: 10, border: '1px solid rgba(255,255,255,0.06)', padding: 10, position: 'relative', overflow: 'hidden' },
  cardAccent: { position: 'absolute', top: 0, left: 0, right: 0, height: 2, background: 'linear-gradient(90deg, transparent, rgba(245,158,11,0.4), transparent)' },
  expandBtn: { width: 24, height: 24, borderRadius: 5, background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.15)', color: '#F59E0B', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' },
  moreBtn: { width: 24, height: 24, borderRadius: 5, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', color: '#888', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' },
  dropdown: { position: 'absolute', top: '100%', right: 0, marginTop: 3, background: '#141420', border: '1px solid rgba(245,158,11,0.15)', borderRadius: 8, padding: 3, minWidth: 140, zIndex: 100, boxShadow: '0 10px 35px rgba(0,0,0,.5)' },
  ddItem: { display: 'flex', alignItems: 'center', gap: 7, width: '100%', padding: '6px 8px', background: 'transparent', border: 'none', borderRadius: 5, color: '#ccc', fontSize: 11, cursor: 'pointer', textAlign: 'left' },

  teamRow: { display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px', background: 'rgba(20,20,35,0.8)', borderRadius: 8, border: '1px solid rgba(255,255,255,0.06)' },
  iconBtn: { width: 24, height: 24, borderRadius: 5, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', color: '#888', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' },

  emptyState: { textAlign: 'center', padding: '36px 14px', background: 'rgba(20,20,35,0.6)', borderRadius: 12, border: '1px solid rgba(255,255,255,0.06)' },

  // Modals
  overlay: { position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,.8)', backdropFilter: 'blur(5px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 14, zIndex: 1000 },
  modal: { width: '100%', maxWidth: 440, background: '#141420', border: '1px solid rgba(245,158,11,0.15)', borderRadius: 14, overflow: 'hidden', boxShadow: '0 20px 70px rgba(0,0,0,.6)', maxHeight: '90vh', display: 'flex', flexDirection: 'column' },
  modalHead: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 14px', borderBottom: '1px solid rgba(255,255,255,0.06)' },
  modalTitle: { margin: 0, color: '#FFF', fontSize: 14, fontWeight: 700 },
  modalX: { width: 28, height: 28, borderRadius: 7, border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.04)', color: '#888', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' },
  modalBody: { padding: 14, overflowY: 'auto', flex: 1 },
  field: { marginBottom: 12 },
  label: { display: 'flex', alignItems: 'center', gap: 4, fontSize: 10, fontWeight: 700, color: '#888', textTransform: 'uppercase', letterSpacing: .5, marginBottom: 4 },
  input: { width: '100%', boxSizing: 'border-box', padding: '8px 10px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.08)', background: 'rgba(255,255,255,0.04)', color: '#FFF', outline: 'none', fontSize: 12, fontFamily: 'inherit' },
  select: { width: '100%', boxSizing: 'border-box', padding: '8px 10px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.08)', background: 'rgba(255,255,255,0.04)', color: '#FFF', outline: 'none', fontSize: 12, fontFamily: 'inherit', cursor: 'pointer' },

  btnPri: { display: 'inline-flex', alignItems: 'center', gap: 5, padding: '8px 14px', borderRadius: 8, border: 'none', background: 'linear-gradient(135deg, #F59E0B, #D97706)', color: '#000', fontWeight: 700, fontSize: 12, cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap' },
  btnSec: { display: 'inline-flex', alignItems: 'center', gap: 5, padding: '8px 12px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.08)', background: 'rgba(255,255,255,0.04)', color: '#ccc', fontWeight: 600, fontSize: 12, cursor: 'pointer', fontFamily: 'inherit' },
  btnDanger: { display: 'inline-flex', alignItems: 'center', gap: 5, padding: '8px 14px', borderRadius: 8, border: 'none', background: 'linear-gradient(135deg, #EF4444, #B91C1C)', color: '#FFF', fontWeight: 700, fontSize: 12, cursor: 'pointer', fontFamily: 'inherit' },

  skeletonCard: { background: 'rgba(20,20,35,0.8)', borderRadius: 10, border: '1px solid rgba(255,255,255,0.06)', padding: 12, marginBottom: 8 },
  skeletonCircle: { borderRadius: 8, background: 'linear-gradient(90deg, rgba(255,255,255,0.04) 25%, rgba(255,255,255,0.08) 50%, rgba(255,255,255,0.04) 75%)', backgroundSize: '200% 100%', animation: 'shimmer 1.5s infinite' },
  skeletonLine: { height: 12, borderRadius: 5, background: 'linear-gradient(90deg, rgba(255,255,255,0.04) 25%, rgba(255,255,255,0.08) 50%, rgba(255,255,255,0.04) 75%)', backgroundSize: '200% 100%', animation: 'shimmer 1.5s infinite' },

  leaderBadgeIcon: { position: 'absolute', bottom: -2, right: -2, width: 13, height: 13, borderRadius: '50%', background: '#F59E0B', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '2px solid #0A0A0F' },
}