// src/pages/Tasks.jsx
// ═══════════════════════════════════════════════════════════════════
// 🎯 PAGE COMPLÈTE DE GESTION DES TÂCHES
// Features: CRUD complet, Catégories, Prédictions, Kanban, Bulk actions
// ═══════════════════════════════════════════════════════════════════

import { useEffect, useMemo, useState, useCallback, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  ClipboardList, Plus, Search, X, Loader2, Edit3, Trash2,
  Calendar, Clock, Users, User, AlertTriangle, CheckCircle2,
  Camera, FileText, MessageSquare, ShieldCheck, RefreshCw,
  Activity, Filter, ChevronDown, ChevronRight, Eye, Sparkles,
  Timer, Tag, Target, Zap, MoreVertical, Check, Crown,
  Columns3, LayoutGrid, List, GripVertical, AlertCircle,
  Lightbulb, TrendingUp, UserX, ArrowRight, HelpCircle,
  CheckSquare, Square, Play, Pause, ChevronUp, Info, Brain
} from 'lucide-react'
import toast from 'react-hot-toast'

import { supabase } from '../lib/supabase'
import FeatureService, { FEATURES } from '../services/featureService'
import {
  getTasks, createTask, updateTask, deleteTask,
  getTaskCategories, createTaskCategory, updateTaskCategory, deleteTaskCategory,
  getStatusColor, getStatusLabel, getPriorityColor, getPriorityLabel,
  getDeadlineStatus, TASK_PRIORITY, TASK_TYPE, TASK_STATUS,
  // Nouvelles fonctions de prédiction
  predictTaskDuration, checkEmployeeWorkload, getTaskAlerts, suggestAssignees
} from '../services/taskService'
import { getTeams } from '../services/teamService'

// ═══════════════════════════════════════════════════════════════════
// CONSTANTES
// ═══════════════════════════════════════════════════════════════════

const VIEW_MODES = { GRID: 'grid', LIST: 'list', KANBAN: 'kanban' }

const SORT_OPTIONS = [
  { key: 'created_desc', label: 'Plus récent', field: 'created_at', dir: 'desc' },
  { key: 'created_asc', label: 'Plus ancien', field: 'created_at', dir: 'asc' },
  { key: 'due_asc', label: 'Deadline proche', field: 'due_at', dir: 'asc' },
  { key: 'priority_desc', label: 'Priorité haute', field: 'priority', dir: 'desc' },
  { key: 'title_asc', label: 'Titre (A-Z)', field: 'title', dir: 'asc' },
]

const KANBAN_COLUMNS = [
  { key: 'assigned', label: 'Assignées', color: '#6B7280', statuses: ['assigned', 'seen'] },
  { key: 'in_progress', label: 'En cours', color: '#F59E0B', statuses: ['in_progress', 'paused'] },
  { key: 'completed', label: 'Terminées', color: '#3B82F6', statuses: ['completed'] },
  { key: 'validated', label: 'Validées', color: '#10B981', statuses: ['validated'] },
]

const CATEGORY_COLORS = [
  '#F59E0B', '#10B981', '#3B82F6', '#8B5CF6', '#EC4899',
  '#F97316', '#06B6D4', '#84CC16', '#EF4444', '#6366F1',
]

// ═══════════════════════════════════════════════════════════════════
// COMPOSANTS UTILITAIRES
// ═══════════════════════════════════════════════════════════════════

function SkeletonCard() {
  return (
    <div style={styles.skeletonCard}>
      <div style={styles.skeletonHeader}>
        <div style={{ ...styles.skeletonCircle, width: 40, height: 40 }} />
        <div style={{ flex: 1 }}>
          <div style={{ ...styles.skeletonLine, width: '70%', marginBottom: 8 }} />
          <div style={{ ...styles.skeletonLine, width: '50%', height: 10 }} />
        </div>
      </div>
      <div style={{ display: 'flex', gap: 6, marginTop: 12 }}>
        <div style={{ ...styles.skeletonLine, width: 60, height: 24, borderRadius: 12 }} />
        <div style={{ ...styles.skeletonLine, width: 60, height: 24, borderRadius: 12 }} />
      </div>
    </div>
  )
}

function Badge({ text, color, bg, icon: Icon }) {
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: '5px',
      padding: '4px 10px', borderRadius: '20px', fontSize: '11px', fontWeight: '700',
      color, background: bg || `${color}15`, border: `1px solid ${color}25`,
      letterSpacing: '0.3px', whiteSpace: 'nowrap',
    }}>
      {Icon && <Icon size={11} />}
      {text}
    </span>
  )
}

function SeverityBadge({ severity }) {
  const map = {
    critical: { color: '#EF4444', label: 'Critique' },
    warning: { color: '#F59E0B', label: 'Attention' },
    info: { color: '#6366F1', label: 'Info' },
    ok: { color: '#10B981', label: 'OK' }
  }
  const item = map[severity] || map.info
  return (
    <span style={{
      padding: '3px 8px', borderRadius: '10px', fontSize: '10px', fontWeight: '700',
      color: item.color, background: `${item.color}15`, border: `1px solid ${item.color}25`
    }}>
      {item.label}
    </span>
  )
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
        <Icon size={20} color={color} />
      </div>
      <div style={styles.statContent}>
        <span style={styles.statNumber}>{value}</span>
        <span style={styles.statLabel}>{label}</span>
      </div>
    </div>
  )
}

function EmployeeAvatar({ employee, size = 28 }) {
  const initials = `${employee?.first_name?.[0] || ''}${employee?.last_name?.[0] || ''}`.toUpperCase()
  return (
    <div style={{
      width: size, height: size, borderRadius: size > 24 ? 10 : 6,
      background: 'linear-gradient(135deg, rgba(245,158,11,0.2), rgba(245,158,11,0.05))',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      color: '#F59E0B', fontWeight: '700', fontSize: size * 0.4,
      border: '1px solid rgba(245,158,11,0.2)', flexShrink: 0,
    }}>
      {employee?.photo_url ? (
        <img src={employee.photo_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: 'inherit' }} />
      ) : initials}
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════
// BANDEAU D'ALERTES PRÉDICTIVES
// ═══════════════════════════════════════════════════════════════════

function AlertsBanner({ alerts, onDismiss, onViewTask, collapsed, onToggle }) {
  const criticalAlerts = alerts.filter(a => a.severity === 'critical')
  const warningAlerts = alerts.filter(a => a.severity === 'warning')

  if (alerts.length === 0) return null

  if (collapsed) {
    return (
      <div style={styles.alertsBannerCollapsed} onClick={onToggle}>
        <div style={styles.alertsBannerCollapsedContent}>
          <Sparkles size={16} color="#F59E0B" />
          <span style={{ color: '#F59E0B', fontWeight: '600', fontSize: '13px' }}>
            {criticalAlerts.length > 0 && <span style={{ color: '#EF4444' }}>{criticalAlerts.length} critique(s)</span>}
            {criticalAlerts.length > 0 && warningAlerts.length > 0 && ' • '}
            {warningAlerts.length > 0 && <span style={{ color: '#F59E0B' }}>{warningAlerts.length} attention</span>}
          </span>
          <ChevronDown size={14} color="#888" />
        </div>
      </div>
    )
  }

  return (
    <div style={styles.alertsBanner}>
      <div style={styles.alertsBannerHeader}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <Brain size={18} color="#F59E0B" />
          <span style={{ color: '#FFF', fontWeight: '700', fontSize: '14px' }}>Alertes Prédictives</span>
          <span style={styles.alertsCount}>{alerts.length}</span>
        </div>
        <button onClick={onToggle} style={styles.collapseBtn}>
          <ChevronUp size={16} />
        </button>
      </div>
      <div style={styles.alertsList}>
        {alerts.slice(0, 5).map((alert) => (
          <div key={alert.id} style={{
            ...styles.alertItem,
            borderLeftColor: alert.severity === 'critical' ? '#EF4444' : alert.severity === 'warning' ? '#F59E0B' : '#6366F1'
          }}>
            <div style={styles.alertItemContent}>
              <SeverityBadge severity={alert.severity} />
              <span style={styles.alertMessage}>{alert.message}</span>
            </div>
            {alert.task_id && (
              <button onClick={() => onViewTask(alert.task_id)} style={styles.alertActionBtn}>
                Voir <ArrowRight size={12} />
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════
// MODAL CATÉGORIE (Créer, Modifier, Supprimer)
// ═══════════════════════════════════════════════════════════════════

function CategoryModal({ open, onClose, onSave, onDelete, loading, editingCategory, categories }) {
  const [form, setForm] = useState({ name: '', description: '', color: '#F59E0B', icon: 'clipboard' })
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)

  useEffect(() => {
    if (open) {
      if (editingCategory) {
        setForm({
          name: editingCategory.name || '',
          description: editingCategory.description || '',
          color: editingCategory.color || '#F59E0B',
          icon: editingCategory.icon || 'clipboard'
        })
      } else {
        setForm({ name: '', description: '', color: '#F59E0B', icon: 'clipboard' })
      }
      setShowDeleteConfirm(false)
    }
  }, [open, editingCategory])

  if (!open) return null

  const handleSubmit = (e) => {
    e.preventDefault()
    if (!form.name.trim()) { toast.error('Le nom est requis'); return }
    onSave(form, editingCategory?.id)
  }

  const handleDelete = () => {
    if (showDeleteConfirm) {
      onDelete(editingCategory.id)
    } else {
      setShowDeleteConfirm(true)
    }
  }

  return (
    <div style={styles.modalOverlay} onClick={onClose}>
      <div style={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div style={styles.modalHeader}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ width: 40, height: 40, borderRadius: 12, background: 'rgba(245,158,11,0.12)', border: '1px solid rgba(245,158,11,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Tag size={18} color="#F59E0B" />
            </div>
            <h3 style={styles.modalTitle}>{editingCategory ? 'Modifier la catégorie' : 'Nouvelle catégorie'}</h3>
          </div>
          <button onClick={onClose} style={styles.modalCloseBtn}><X size={18} /></button>
        </div>
        
        <form onSubmit={handleSubmit} style={styles.modalBody}>
          <div style={styles.formGroup}>
            <label style={styles.label}>Nom *</label>
            <input
              type="text"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              style={styles.input}
              placeholder="Ex: Maintenance"
            />
          </div>
          
          <div style={styles.formGroup}>
            <label style={styles.label}>Description</label>
            <textarea
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              style={{ ...styles.input, minHeight: 70, resize: 'vertical' }}
              rows={3}
              placeholder="Description optionnelle..."
            />
          </div>
          
          <div style={styles.formGroup}>
            <label style={styles.label}>Couleur</label>
            <div style={styles.colorPicker}>
              {CATEGORY_COLORS.map((color) => (
                <button
                  key={color}
                  type="button"
                  onClick={() => setForm({ ...form, color })}
                  style={{
                    width: 32, height: 32, borderRadius: 8, background: color, cursor: 'pointer',
                    border: form.color === color ? '3px solid #FFF' : '3px solid transparent',
                    boxShadow: form.color === color ? `0 0 0 2px ${color}` : 'none',
                  }}
                />
              ))}
            </div>
          </div>

          {/* Stats de la catégorie si édition */}
          {editingCategory && editingCategory.avg_duration_minutes && (
            <div style={styles.categoryStats}>
              <div style={styles.categoryStatItem}>
                <Clock size={14} color="#6366F1" />
                <span>Durée moyenne: <strong>{editingCategory.avg_duration_minutes} min</strong></span>
              </div>
              {editingCategory.total_tasks_completed > 0 && (
                <div style={styles.categoryStatItem}>
                  <CheckCircle2 size={14} color="#10B981" />
                  <span>Tâches complétées: <strong>{editingCategory.total_tasks_completed}</strong></span>
                </div>
              )}
            </div>
          )}
          
          <div style={styles.modalActions}>
            {editingCategory && (
              <button
                type="button"
                onClick={handleDelete}
                style={{
                  ...styles.btnDanger,
                  marginRight: 'auto',
                  background: showDeleteConfirm ? '#EF4444' : 'rgba(239,68,68,0.1)',
                  color: showDeleteConfirm ? '#FFF' : '#EF4444',
                }}
                disabled={loading}
              >
                <Trash2 size={14} />
                {showDeleteConfirm ? 'Confirmer' : 'Supprimer'}
              </button>
            )}
            <button type="button" onClick={onClose} style={styles.btnSecondary}>Annuler</button>
            <button type="submit" style={styles.btnPrimary} disabled={loading}>
              {loading ? <Loader2 size={15} className="spin" /> : <Check size={15} />}
              <span>{editingCategory ? 'Enregistrer' : 'Créer'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════
// MODAL TÂCHE (Avec prédictions intégrées)
// ═══════════════════════════════════════════════════════════════════

function TaskModal({ 
  open, onClose, onSave, loading, editingTask, 
  employees, teams, categories, enterpriseId 
}) {
  const [form, setForm] = useState({
    title: '', description: '', task_type: TASK_TYPE.INDIVIDUAL,
    assigned_employee_id: '', team_id: '', category_id: '',
    priority: TASK_PRIORITY.MEDIUM, difficulty: 'medium',
    due_at: '', expected_duration_minutes: '',
    requires_proof: false, requires_comment: false,
    allow_image: true, allow_document: true, allow_camera_photo: true,
  })
  
  const [durationPrediction, setDurationPrediction] = useState(null)
  const [workloadWarning, setWorkloadWarning] = useState(null)
  const [suggestions, setSuggestions] = useState(null)
  const [loadingPrediction, setLoadingPrediction] = useState(false)
  const [showSuggestions, setShowSuggestions] = useState(false)

  useEffect(() => {
    if (!open) return
    if (editingTask) {
      setForm({
        title: editingTask.title || '',
        description: editingTask.description || '',
        task_type: editingTask.task_type || TASK_TYPE.INDIVIDUAL,
        assigned_employee_id: editingTask.assigned_employee_id || '',
        team_id: editingTask.team_id || '',
        category_id: editingTask.category_id || '',
        priority: editingTask.priority || TASK_PRIORITY.MEDIUM,
        difficulty: editingTask.difficulty || 'medium',
        due_at: editingTask.due_at ? editingTask.due_at.slice(0, 16) : '',
        expected_duration_minutes: editingTask.expected_duration_minutes || '',
        requires_proof: editingTask.requires_proof || false,
        requires_comment: editingTask.requires_comment || false,
        allow_image: editingTask.allow_image ?? true,
        allow_document: editingTask.allow_document ?? true,
        allow_camera_photo: editingTask.allow_camera_photo ?? true,
      })
    } else {
      setForm({
        title: '', description: '', task_type: TASK_TYPE.INDIVIDUAL,
        assigned_employee_id: '', team_id: '', category_id: '',
        priority: TASK_PRIORITY.MEDIUM, difficulty: 'medium',
        due_at: '', expected_duration_minutes: '',
        requires_proof: false, requires_comment: false,
        allow_image: true, allow_document: true, allow_camera_photo: true,
      })
    }
    setDurationPrediction(null)
    setWorkloadWarning(null)
    setSuggestions(null)
  }, [editingTask, open])

  // Prédiction de durée quand catégorie/employé/difficulté change
  useEffect(() => {
    if (!open || !enterpriseId) return
    if (!form.category_id && !form.assigned_employee_id) return

    const fetchPrediction = async () => {
      setLoadingPrediction(true)
      try {
        const { data } = await predictTaskDuration(enterpriseId, {
          category_id: form.category_id || null,
          employee_id: form.assigned_employee_id || null,
          team_id: form.team_id || null,
          difficulty: form.difficulty
        })
        setDurationPrediction(data)
        
        // Auto-remplir si pas de valeur
        if (data && !form.expected_duration_minutes && !editingTask) {
          setForm(prev => ({ ...prev, expected_duration_minutes: data.predicted_minutes }))
        }
      } catch (err) {
        console.error('Erreur prédiction:', err)
      } finally {
        setLoadingPrediction(false)
      }
    }

    const timeout = setTimeout(fetchPrediction, 500)
    return () => clearTimeout(timeout)
  }, [form.category_id, form.assigned_employee_id, form.difficulty, enterpriseId, open])

  // Vérification de charge quand employé change
  useEffect(() => {
    if (!open || !enterpriseId || !form.assigned_employee_id) {
      setWorkloadWarning(null)
      return
    }

    const checkWorkload = async () => {
      try {
        const { data } = await checkEmployeeWorkload(form.assigned_employee_id, enterpriseId, {
          newTaskDuration: Number(form.expected_duration_minutes) || 30,
          newTaskDueAt: form.due_at || null
        })
        setWorkloadWarning(data)
      } catch (err) {
        console.error('Erreur workload:', err)
      }
    }

    const timeout = setTimeout(checkWorkload, 300)
    return () => clearTimeout(timeout)
  }, [form.assigned_employee_id, form.expected_duration_minutes, form.due_at, enterpriseId, open])

  // Charger les suggestions
  const loadSuggestions = async () => {
    if (!enterpriseId) return
    setLoadingPrediction(true)
    try {
      const { data } = await suggestAssignees(enterpriseId, {
        category_id: form.category_id || null,
        due_at: form.due_at || null,
        priority: form.priority,
        task_type: form.task_type
      })
      setSuggestions(data)
      setShowSuggestions(true)
    } catch (err) {
      console.error('Erreur suggestions:', err)
    } finally {
      setLoadingPrediction(false)
    }
  }

  const applySuggestion = (suggestion) => {
    if (form.task_type === TASK_TYPE.INDIVIDUAL) {
      setForm(prev => ({ ...prev, assigned_employee_id: suggestion.employee_id }))
    } else {
      setForm(prev => ({ ...prev, team_id: suggestion.team_id }))
    }
    setShowSuggestions(false)
  }

  if (!open) return null

  const handleSubmit = (e) => {
    e.preventDefault()
    if (!form.title.trim()) { toast.error('Le titre est requis'); return }
    if (form.task_type === TASK_TYPE.INDIVIDUAL && !form.assigned_employee_id) { 
      toast.error('Choisissez un employé'); return 
    }
    if (form.task_type === TASK_TYPE.TEAM && !form.team_id) { 
      toast.error('Choisissez une équipe'); return 
    }
    
    onSave({
      ...form,
      assigned_employee_id: form.task_type === TASK_TYPE.INDIVIDUAL ? form.assigned_employee_id : null,
      team_id: form.task_type === TASK_TYPE.TEAM ? form.team_id : null,
      category_id: form.category_id || null,
      due_at: form.due_at || null,
      expected_duration_minutes: form.expected_duration_minutes ? Number(form.expected_duration_minutes) : null,
    })
  }

  return (
    <div style={styles.modalOverlay} onClick={onClose}>
      <div style={{ ...styles.modal, maxWidth: '800px' }} onClick={(e) => e.stopPropagation()}>
        <div style={styles.modalHeader}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ width: 40, height: 40, borderRadius: 12, background: 'rgba(245,158,11,0.12)', border: '1px solid rgba(245,158,11,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              {editingTask ? <Edit3 size={18} color="#F59E0B" /> : <Plus size={18} color="#F59E0B" />}
            </div>
            <h3 style={styles.modalTitle}>{editingTask ? 'Modifier la tâche' : 'Nouvelle tâche'}</h3>
          </div>
          <button onClick={onClose} style={styles.modalCloseBtn}><X size={18} /></button>
        </div>
        
        <form onSubmit={handleSubmit} style={styles.modalBody}>
          {/* Alerte de charge si warning */}
          {workloadWarning && workloadWarning.severity !== 'ok' && (
            <div style={{
              ...styles.workloadAlert,
              borderColor: workloadWarning.severity === 'critical' ? '#EF4444' : '#F59E0B',
              background: workloadWarning.severity === 'critical' ? 'rgba(239,68,68,0.1)' : 'rgba(245,158,11,0.1)'
            }}>
              <AlertTriangle size={16} color={workloadWarning.severity === 'critical' ? '#EF4444' : '#F59E0B'} />
              <div style={styles.workloadAlertContent}>
                {workloadWarning.warnings.map((w, i) => (
                  <div key={i} style={styles.workloadWarningItem}>{w.message}</div>
                ))}
              </div>
            </div>
          )}

          <div style={styles.formGrid}>
            {/* Titre */}
            <div style={{ ...styles.formGroup, gridColumn: '1 / -1' }}>
              <label style={styles.label}>Titre *</label>
              <input
                type="text"
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                style={styles.input}
                placeholder="Ex: Vérifier les extincteurs"
              />
            </div>

            {/* Description */}
            <div style={{ ...styles.formGroup, gridColumn: '1 / -1' }}>
              <label style={styles.label}>Description</label>
              <textarea
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                style={{ ...styles.input, minHeight: 80, resize: 'vertical' }}
                rows={3}
                placeholder="Décrivez la tâche..."
              />
            </div>

            {/* Type de tâche */}
            <div style={styles.formGroup}>
              <label style={styles.label}>Type</label>
              <select
                value={form.task_type}
                onChange={(e) => setForm({ ...form, task_type: e.target.value, assigned_employee_id: '', team_id: '' })}
                style={styles.select}
              >
                <option value={TASK_TYPE.INDIVIDUAL}>Individuelle</option>
                <option value={TASK_TYPE.TEAM}>Équipe</option>
              </select>
            </div>

            {/* Assignation avec bouton IA */}
            <div style={styles.formGroup}>
              <label style={styles.label}>
                {form.task_type === TASK_TYPE.INDIVIDUAL ? 'Employé *' : 'Équipe *'}
                <button
                  type="button"
                  onClick={loadSuggestions}
                  style={styles.suggestBtn}
                  disabled={loadingPrediction}
                >
                  <Lightbulb size={12} />
                  Suggérer
                </button>
              </label>
              {form.task_type === TASK_TYPE.INDIVIDUAL ? (
                <select
                  value={form.assigned_employee_id}
                  onChange={(e) => setForm({ ...form, assigned_employee_id: e.target.value })}
                  style={styles.select}
                >
                  <option value="">Choisir un employé</option>
                  {employees.map(emp => (
                    <option key={emp.id} value={emp.id}>{emp.first_name} {emp.last_name}</option>
                  ))}
                </select>
              ) : (
                <select
                  value={form.team_id}
                  onChange={(e) => setForm({ ...form, team_id: e.target.value })}
                  style={styles.select}
                >
                  <option value="">Choisir une équipe</option>
                  {teams.map(team => (
                    <option key={team.id} value={team.id}>{team.name}</option>
                  ))}
                </select>
              )}

              {/* Suggestions IA */}
              {showSuggestions && suggestions && (
                <div style={styles.suggestionsDropdown}>
                  <div style={styles.suggestionsHeader}>
                    <Sparkles size={14} color="#F59E0B" />
                    <span>Suggestions IA</span>
                    <button onClick={() => setShowSuggestions(false)} style={styles.closeSuggestBtn}>
                      <X size={12} />
                    </button>
                  </div>
                  {suggestions.suggestions?.slice(0, 3).map((s, i) => (
                    <div
                      key={i}
                      style={styles.suggestionItem}
                      onClick={() => applySuggestion(s)}
                    >
                      <div style={styles.suggestionMain}>
                        <span style={styles.suggestionName}>
                          {s.employee_name || s.team_name}
                        </span>
                        <span style={styles.suggestionScore}>{s.score}%</span>
                      </div>
                      <div style={styles.suggestionFactors}>
                        {s.factors?.slice(0, 2).map((f, j) => (
                          <span key={j} style={{
                            ...styles.factorChip,
                            color: f.impact > 0 ? '#10B981' : f.impact < 0 ? '#EF4444' : '#888'
                          }}>
                            {f.label}
                          </span>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Catégorie */}
            <div style={styles.formGroup}>
              <label style={styles.label}>Catégorie</label>
              <select
                value={form.category_id}
                onChange={(e) => setForm({ ...form, category_id: e.target.value })}
                style={styles.select}
              >
                <option value="">Aucune catégorie</option>
                {categories.map(cat => (
                  <option key={cat.id} value={cat.id}>{cat.name}</option>
                ))}
              </select>
            </div>

            {/* Priorité */}
            <div style={styles.formGroup}>
              <label style={styles.label}>Priorité</label>
              <select
                value={form.priority}
                onChange={(e) => setForm({ ...form, priority: e.target.value })}
                style={styles.select}
              >
                <option value="low">Basse</option>
                <option value="medium">Moyenne</option>
                <option value="high">Haute</option>
                <option value="critical">Critique</option>
              </select>
            </div>

            {/* Difficulté */}
            <div style={styles.formGroup}>
              <label style={styles.label}>Difficulté</label>
              <select
                value={form.difficulty}
                onChange={(e) => setForm({ ...form, difficulty: e.target.value })}
                style={styles.select}
              >
                <option value="easy">Facile</option>
                <option value="medium">Moyenne</option>
                <option value="hard">Difficile</option>
                <option value="critical">Critique</option>
              </select>
            </div>

            {/* Deadline */}
            <div style={styles.formGroup}>
              <label style={styles.label}>Date limite</label>
              <input
                type="datetime-local"
                value={form.due_at}
                onChange={(e) => setForm({ ...form, due_at: e.target.value })}
                style={styles.input}
              />
            </div>

            {/* Durée prévue avec prédiction */}
            <div style={styles.formGroup}>
              <label style={styles.label}>
                Durée prévue (min)
                {loadingPrediction && <Loader2 size={12} className="spin" style={{ marginLeft: 6 }} />}
              </label>
              <input
                type="number"
                min="1"
                value={form.expected_duration_minutes}
                onChange={(e) => setForm({ ...form, expected_duration_minutes: e.target.value })}
                style={styles.input}
                placeholder="Ex: 45"
              />
              {durationPrediction && (
                <div style={styles.predictionHint}>
                  <Sparkles size={12} color="#F59E0B" />
                  <span>{durationPrediction.message}</span>
                  {durationPrediction.predicted_minutes !== Number(form.expected_duration_minutes) && (
                    <button
                      type="button"
                      onClick={() => setForm(prev => ({ 
                        ...prev, 
                        expected_duration_minutes: durationPrediction.predicted_minutes 
                      }))}
                      style={styles.applyPredictionBtn}
                    >
                      Appliquer
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Exigences de validation */}
          <div style={styles.settingsBox}>
            <h4 style={styles.sectionTitle}>
              <ShieldCheck size={14} color="#F59E0B" />
              <span>Exigences de validation</span>
            </h4>
            <div style={styles.checkboxGrid}>
              {[
                { key: 'requires_proof', label: 'Preuve requise', icon: Camera },
                { key: 'requires_comment', label: 'Commentaire requis', icon: MessageSquare },
                { key: 'allow_image', label: 'Autoriser image', icon: Camera },
                { key: 'allow_document', label: 'Autoriser document', icon: FileText },
                { key: 'allow_camera_photo', label: 'Photo caméra', icon: Camera },
              ].map(({ key, label, icon: Ic }) => (
                <label key={key} style={styles.checkboxItem}>
                  <div style={{
                    width: 20, height: 20, borderRadius: 6,
                    border: `2px solid ${form[key] ? '#F59E0B' : 'rgba(255,255,255,0.15)'}`,
                    background: form[key] ? 'rgba(245,158,11,0.15)' : 'transparent',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    cursor: 'pointer', flexShrink: 0,
                  }}>
                    {form[key] && <Check size={12} color="#F59E0B" />}
                  </div>
                  <input
                    type="checkbox"
                    checked={form[key]}
                    onChange={(e) => setForm({ ...form, [key]: e.target.checked })}
                    style={{ display: 'none' }}
                  />
                  <Ic size={13} color={form[key] ? '#F59E0B' : '#666'} />
                  <span style={{ color: form[key] ? '#E5E5E5' : '#888' }}>{label}</span>
                </label>
              ))}
            </div>
          </div>

          <div style={styles.modalActions}>
            <button type="button" onClick={onClose} style={styles.btnSecondary}>Annuler</button>
            <button type="submit" style={styles.btnPrimary} disabled={loading}>
              {loading ? <Loader2 size={15} className="spin" /> : <CheckCircle2 size={15} />}
              <span>{editingTask ? 'Enregistrer' : 'Créer la tâche'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════
// MODAL SUPPRESSION
// ═══════════════════════════════════════════════════════════════════

function DeleteModal({ open, onClose, onConfirm, title, loading }) {
  if (!open) return null
  return (
    <div style={styles.modalOverlay} onClick={onClose}>
      <div style={{ ...styles.modal, maxWidth: 420 }} onClick={(e) => e.stopPropagation()}>
        <div style={{ padding: '28px', textAlign: 'center' }}>
          <div style={{ width: 56, height: 56, borderRadius: 14, background: 'rgba(239,68,68,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
            <AlertTriangle size={26} color="#EF4444" />
          </div>
          <h3 style={{ color: '#FFF', fontSize: '18px', margin: '0 0 10px' }}>Confirmer la suppression</h3>
          <p style={{ color: '#888', fontSize: '14px', margin: '0 0 24px', lineHeight: '1.5' }}>
            Supprimer <strong style={{ color: '#F59E0B' }}>"{title}"</strong> ?
          </p>
          <div style={{ display: 'flex', gap: '10px' }}>
            <button onClick={onClose} style={{ ...styles.btnSecondary, flex: 1 }} disabled={loading}>Annuler</button>
            <button onClick={onConfirm} style={{ ...styles.btnDanger, flex: 1 }} disabled={loading}>
              {loading ? <Loader2 size={14} className="spin" /> : <Trash2 size={14} />}
              Supprimer
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════
// MODAL RACCOURCIS CLAVIER
// ═══════════════════════════════════════════════════════════════════

function ShortcutsModal({ open, onClose }) {
  if (!open) return null
  const shortcuts = [
    { key: 'N', action: 'Nouvelle tâche' },
    { key: 'C', action: 'Nouvelle catégorie' },
    { key: '/', action: 'Rechercher' },
    { key: 'R', action: 'Rafraîchir' },
    { key: 'G', action: 'Vue grille' },
    { key: 'L', action: 'Vue liste' },
    { key: 'K', action: 'Vue Kanban' },
    { key: 'Esc', action: 'Fermer modal' },
  ]
  return (
    <div style={styles.modalOverlay} onClick={onClose}>
      <div style={{ ...styles.modal, maxWidth: 340 }} onClick={(e) => e.stopPropagation()}>
        <div style={styles.modalHeader}>
          <h3 style={styles.modalTitle}>Raccourcis clavier</h3>
          <button onClick={onClose} style={styles.modalCloseBtn}><X size={18} /></button>
        </div>
        <div style={styles.modalBody}>
          {shortcuts.map((s) => (
            <div key={s.key} style={styles.shortcutRow}>
              <kbd style={styles.kbd}>{s.key}</kbd>
              <span style={{ color: '#ccc', fontSize: '13px' }}>{s.action}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════
// CARTE DE TÂCHE
// ═══════════════════════════════════════════════════════════════════

function TaskCard({ task, onEdit, onDelete, onView, viewMode, selected, onSelect, onDragStart }) {
  const deadline = getDeadlineStatus(task.due_at)
  const statusColor = getStatusColor(task.status)
  const priorityColor = getPriorityColor(task.priority)

  // Vue Liste
  if (viewMode === VIEW_MODES.LIST) {
    return (
      <div className="afro-task-row" style={styles.taskRow}>
        <div style={styles.rowCheck} onClick={() => onSelect(task.id)}>
          {selected ? <CheckSquare size={16} color="#F59E0B" /> : <Square size={16} color="#555" />}
        </div>
        <div style={{ ...styles.priorityDot, background: priorityColor }} />
        <div style={styles.rowMain}>
          <span style={styles.rowTitle}>{task.title}</span>
          <div style={styles.rowMeta}>
            <Badge text={getStatusLabel(task.status)} color={statusColor} />
            <span style={{ color: '#888', fontSize: '11px' }}>
              {task.task_type === 'team' ? task.team?.name : 
               task.assigned_employee ? `${task.assigned_employee.first_name} ${task.assigned_employee.last_name}` : 'Non assigné'}
            </span>
            {task.due_at && (
              <span style={{ color: deadline.overdue ? '#EF4444' : '#888', fontSize: '11px' }}>
                {deadline.text}
              </span>
            )}
          </div>
        </div>
        <div style={styles.rowActions}>
          <button onClick={() => onView(task.id)} style={styles.iconBtn}><Eye size={14} /></button>
          <button onClick={() => onEdit(task)} style={styles.iconBtn}><Edit3 size={14} /></button>
          <button onClick={() => onDelete(task)} style={{ ...styles.iconBtn, color: '#EF4444' }}><Trash2 size={14} /></button>
        </div>
      </div>
    )
  }

  // Vue Grille (défaut)
  return (
    <div
      className="afro-task-card"
      style={{
        ...styles.taskCard,
        borderColor: task.priority === 'critical' ? 'rgba(239,68,68,0.2)' :
                     task.priority === 'high' ? 'rgba(249,115,22,0.15)' : 'rgba(255,255,255,0.06)',
      }}
      draggable
      onDragStart={(e) => onDragStart?.(e, task)}
    >
      <div style={{ ...styles.cardAccent, background: `linear-gradient(90deg, transparent, ${priorityColor}40, transparent)` }} />

      <div style={styles.cardTopRow}>
        <div style={styles.cardCheck} onClick={() => onSelect(task.id)}>
          {selected ? <CheckSquare size={15} color="#F59E0B" /> : <Square size={15} color="#555" />}
        </div>
        <div style={{ ...styles.taskIconWrap, background: `${statusColor}15`, border: `1px solid ${statusColor}30` }}>
          <ClipboardList size={16} color={statusColor} />
        </div>
        <div style={styles.taskInfo}>
          <h3 style={styles.taskTitle}>{task.title}</h3>
          {task.description && (
            <p style={styles.taskDescription}>
              {task.description.length > 70 ? task.description.slice(0, 70) + '…' : task.description}
            </p>
          )}
        </div>
        <Badge text={getStatusLabel(task.status)} color={statusColor} />
      </div>

      <div style={styles.taskMeta}>
        <Badge text={getPriorityLabel(task.priority)} color={priorityColor} icon={Zap} />
        <Badge
          text={task.task_type === 'team' ? 'Équipe' : 'Individuelle'}
          color={task.task_type === 'team' ? '#8B5CF6' : '#10B981'}
          icon={task.task_type === 'team' ? Users : User}
        />
        {task.category && (
          <Badge text={task.category.name} color={task.category.color || '#F59E0B'} icon={Tag} />
        )}
      </div>

      <div style={styles.infoSection}>
        <div style={styles.infoRow}>
          {task.task_type === 'team' ? <Users size={13} color="#8B5CF6" /> : <User size={13} color="#10B981" />}
          <span style={styles.infoText}>
            {task.task_type === 'team' ? task.team?.name || 'Équipe' :
             task.assigned_employee ? `${task.assigned_employee.first_name} ${task.assigned_employee.last_name}` : 'Non assigné'}
          </span>
        </div>
        {task.due_at && (
          <div style={styles.infoRow}>
            <Calendar size={13} color={deadline.overdue ? '#EF4444' : '#F59E0B'} />
            <span style={{ ...styles.infoText, color: deadline.overdue ? '#EF4444' : '#ccc' }}>
              {new Date(task.due_at).toLocaleString('fr-FR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
            </span>
          </div>
        )}
        {task.expected_duration_minutes && (
          <div style={styles.infoRow}>
            <Clock size={13} color="#6366F1" />
            <span style={styles.infoText}>{task.expected_duration_minutes} min prévues</span>
          </div>
        )}
      </div>

      {task.due_at && (
        <div style={{
          ...styles.deadlineBox,
          borderColor: deadline.overdue ? 'rgba(239,68,68,0.2)' : 'rgba(245,158,11,0.12)',
          background: deadline.overdue ? 'rgba(239,68,68,0.06)' : 'rgba(245,158,11,0.04)',
        }}>
          {deadline.overdue ? <AlertTriangle size={12} color="#EF4444" /> : <Clock size={12} color="#F59E0B" />}
          <span style={{ color: deadline.overdue ? '#EF4444' : '#F59E0B', fontSize: '11px', fontWeight: '700' }}>
            {deadline.text}
          </span>
        </div>
      )}

      <div style={styles.cardActionsRow}>
        <button onClick={() => onView(task.id)} style={{ ...styles.cardActionBtn, color: '#6366F1' }}>
          <Eye size={14} /> Voir
        </button>
        <button onClick={() => onEdit(task)} style={styles.cardActionBtn}>
          <Edit3 size={14} /> Modifier
        </button>
        <button onClick={() => onDelete(task)} style={{ ...styles.cardActionBtn, color: '#EF4444' }}>
          <Trash2 size={14} />
        </button>
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════
// VUE KANBAN
// ═══════════════════════════════════════════════════════════════════

function KanbanView({ tasks, onEdit, onDelete, onView, onStatusChange }) {
  const [draggedTask, setDraggedTask] = useState(null)
  const [dragOverColumn, setDragOverColumn] = useState(null)

  const tasksByColumn = useMemo(() => {
    const result = {}
    KANBAN_COLUMNS.forEach(col => {
      result[col.key] = tasks.filter(t => col.statuses.includes(t.status))
    })
    return result
  }, [tasks])

  const handleDragStart = (e, task) => {
    setDraggedTask(task)
    e.dataTransfer.effectAllowed = 'move'
  }

  const handleDragOver = (e, columnKey) => {
    e.preventDefault()
    setDragOverColumn(columnKey)
  }

  const handleDragLeave = () => {
    setDragOverColumn(null)
  }

  const handleDrop = async (e, column) => {
    e.preventDefault()
    setDragOverColumn(null)

    if (!draggedTask) return

    // Déterminer le nouveau statut
    const newStatus = column.statuses[0] // Premier statut de la colonne
    if (draggedTask.status !== newStatus) {
      onStatusChange(draggedTask.id, newStatus)
    }

    setDraggedTask(null)
  }

  return (
    <div style={styles.kanbanContainer}>
      {KANBAN_COLUMNS.map((column) => (
        <div
          key={column.key}
          style={{
            ...styles.kanbanColumn,
            borderColor: dragOverColumn === column.key ? column.color : 'rgba(255,255,255,0.06)'
          }}
          onDragOver={(e) => handleDragOver(e, column.key)}
          onDragLeave={handleDragLeave}
          onDrop={(e) => handleDrop(e, column)}
        >
          <div style={{ ...styles.kanbanHeader, borderLeftColor: column.color }}>
            <span style={styles.kanbanTitle}>{column.label}</span>
            <span style={styles.kanbanCount}>{tasksByColumn[column.key]?.length || 0}</span>
          </div>
          <div style={styles.kanbanCards}>
            {tasksByColumn[column.key]?.map((task) => (
              <div
                key={task.id}
                style={styles.kanbanCard}
                draggable
                onDragStart={(e) => handleDragStart(e, task)}
              >
                <div style={styles.kanbanCardHeader}>
                  <div style={{ ...styles.priorityDot, background: getPriorityColor(task.priority) }} />
                  <span style={styles.kanbanCardTitle}>{task.title}</span>
                </div>
                <div style={styles.kanbanCardMeta}>
                  {task.task_type === 'team' ? (
                    <span style={styles.kanbanAssignee}>
                      <Users size={11} color="#8B5CF6" />
                      {task.team?.name || 'Équipe'}
                    </span>
                  ) : task.assigned_employee && (
                    <span style={styles.kanbanAssignee}>
                      <EmployeeAvatar employee={task.assigned_employee} size={18} />
                      {task.assigned_employee.first_name}
                    </span>
                  )}
                  {task.due_at && (
                    <span style={{
                      fontSize: '10px',
                      color: getDeadlineStatus(task.due_at).overdue ? '#EF4444' : '#888'
                    }}>
                      {getDeadlineStatus(task.due_at).text}
                    </span>
                  )}
                </div>
                <div style={styles.kanbanCardActions}>
                  <button onClick={() => onView(task.id)} style={styles.kanbanActionBtn}><Eye size={12} /></button>
                  <button onClick={() => onEdit(task)} style={styles.kanbanActionBtn}><Edit3 size={12} /></button>
                </div>
              </div>
            ))}
            {tasksByColumn[column.key]?.length === 0 && (
              <div style={styles.kanbanEmpty}>Aucune tâche</div>
            )}
          </div>
        </div>
      ))}
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════
// PANNEAU CATÉGORIES
// ═══════════════════════════════════════════════════════════════════

function CategoriesPanel({ categories, onEdit, onCreate, selectedCategory, onSelect, collapsed, onToggle }) {
  if (collapsed) {
    return (
      <div style={styles.categoriesPanelCollapsed} onClick={onToggle}>
        <Tag size={16} color="#F59E0B" />
        <span style={{ color: '#888', fontSize: '12px' }}>{categories.length}</span>
        <ChevronRight size={14} color="#888" />
      </div>
    )
  }

  return (
    <div style={styles.categoriesPanel}>
      <div style={styles.categoriesPanelHeader}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Tag size={16} color="#F59E0B" />
          <span style={{ color: '#FFF', fontSize: '14px', fontWeight: '700' }}>Catégories</span>
        </div>
        <div style={{ display: 'flex', gap: '6px' }}>
          <button onClick={onCreate} style={styles.addCategoryBtn}><Plus size={14} /></button>
          <button onClick={onToggle} style={styles.collapseBtn}><ChevronDown size={14} /></button>
        </div>
      </div>
      <div style={styles.categoriesList}>
        <div
          style={{
            ...styles.categoryItem,
            background: !selectedCategory ? 'rgba(245,158,11,0.1)' : 'transparent',
            borderColor: !selectedCategory ? 'rgba(245,158,11,0.2)' : 'rgba(255,255,255,0.04)'
          }}
          onClick={() => onSelect(null)}
        >
          <div style={{ width: 8, height: 8, borderRadius: 3, background: '#888' }} />
          <span style={{ color: !selectedCategory ? '#F59E0B' : '#ccc', flex: 1 }}>Toutes</span>
        </div>
        {categories.map((cat) => (
          <div
            key={cat.id}
            style={{
              ...styles.categoryItem,
              background: selectedCategory === cat.id ? `${cat.color}15` : 'transparent',
              borderColor: selectedCategory === cat.id ? `${cat.color}30` : 'rgba(255,255,255,0.04)'
            }}
            onClick={() => onSelect(cat.id)}
          >
            <div style={{ width: 8, height: 8, borderRadius: 3, background: cat.color }} />
            <span style={{ color: selectedCategory === cat.id ? cat.color : '#ccc', flex: 1, fontSize: '13px' }}>
              {cat.name}
            </span>
            <button
              onClick={(e) => { e.stopPropagation(); onEdit(cat) }}
              style={styles.editCategoryBtn}
            >
              <Edit3 size={11} />
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════
// COMPOSANT PRINCIPAL
// ═══════════════════════════════════════════════════════════════════

export default function Tasks() {
  const navigate = useNavigate()

  // Auth & config
  const [admin, setAdmin] = useState(null)
  const [enterpriseId, setEnterpriseId] = useState(null)
  const [hasAccess, setHasAccess] = useState(false)
  const [hasPredictions, setHasPredictions] = useState(false)

  // Data
  const [tasks, setTasks] = useState([])
  const [employees, setEmployees] = useState([])
  const [teams, setTeamsData] = useState([])
  const [categories, setCategories] = useState([])
  const [alerts, setAlerts] = useState([])

  // UI State
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [priorityFilter, setPriorityFilter] = useState('')
  const [typeFilter, setTypeFilter] = useState('')
  const [categoryFilter, setCategoryFilter] = useState(null)
  const [viewMode, setViewMode] = useState(VIEW_MODES.GRID)
  const [sortKey, setSortKey] = useState('created_desc')
  const [selectedTasks, setSelectedTasks] = useState([])
  const [alertsCollapsed, setAlertsCollapsed] = useState(true)
  const [categoriesCollapsed, setCategoriesCollapsed] = useState(false)

  // Modals
  const [showTaskModal, setShowTaskModal] = useState(false)
  const [showCategoryModal, setShowCategoryModal] = useState(false)
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [showShortcuts, setShowShortcuts] = useState(false)
  const [editingTask, setEditingTask] = useState(null)
  const [editingCategory, setEditingCategory] = useState(null)
  const [deleteTarget, setDeleteTarget] = useState(null)

  // Refs
  const searchRef = useRef(null)

  // ─────────────────────────────────────────────────────────────
  // INIT
  // ─────────────────────────────────────────────────────────────

  useEffect(() => {
    const init = async () => {
      try {
        const adminData = JSON.parse(localStorage.getItem('admin') || '{}')
        setAdmin(adminData)
        const entId = adminData.selectedEnterprise?.id || adminData.enterprise_id
        setEnterpriseId(entId)

        if (!entId) { toast.error('Aucune entreprise sélectionnée'); navigate('/dashboard'); return }

        const [access, predictions] = await Promise.all([
          FeatureService.hasFeature(entId, FEATURES.GESTION_TACHES),
          FeatureService.hasFeature(entId, FEATURES.PREDICTIONS)
        ])

        setHasAccess(access)
        setHasPredictions(predictions)

        if (!access && adminData.role !== 'super_admin') {
          toast.error("Module non activé"); navigate('/dashboard'); return
        }

        await loadAll(entId)
      } catch (error) {
        console.error(error)
        toast.error('Erreur de chargement')
      }
    }
    init()
  }, [navigate])

  // Raccourcis clavier
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement?.tagName)) return

      switch (e.key.toLowerCase()) {
        case 'n': e.preventDefault(); handleCreateTask(); break
        case 'c': e.preventDefault(); handleCreateCategory(); break
        case '/': e.preventDefault(); searchRef.current?.focus(); break
        case 'r': e.preventDefault(); loadAll(); break
        case 'g': e.preventDefault(); setViewMode(VIEW_MODES.GRID); break
        case 'l': e.preventDefault(); setViewMode(VIEW_MODES.LIST); break
        case 'k': e.preventDefault(); setViewMode(VIEW_MODES.KANBAN); break
        case 'escape':
          setShowTaskModal(false); setShowCategoryModal(false);
          setShowDeleteModal(false); setShowShortcuts(false); break
        case '?': e.preventDefault(); setShowShortcuts(true); break
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  // ─────────────────────────────────────────────────────────────
  // DATA LOADING
  // ─────────────────────────────────────────────────────────────

  const loadAll = useCallback(async (entId = enterpriseId) => {
    if (!entId) return
    setLoading(true)
    try {
      const [tasksRes, employeesRes, teamsRes, categoriesRes] = await Promise.all([
        getTasks(entId, { includeSubtasks: false, limit: 200 }),
        supabase.from('employees').select('id, first_name, last_name, position, photo_url').eq('enterprise_id', entId).eq('is_active', true).order('first_name'),
        getTeams(entId),
        getTaskCategories(entId),
      ])

      if (tasksRes.error) throw tasksRes.error

      setTasks(tasksRes.data || [])
      setEmployees(employeesRes.data || [])
      setTeamsData(teamsRes.data || [])
      setCategories(categoriesRes.data || [])

      // Charger les alertes si feature active
      if (await FeatureService.hasFeature(entId, FEATURES.PREDICTIONS)) {
        const { data: alertsData } = await getTaskAlerts(entId)
        setAlerts(alertsData || [])
      }
    } catch (error) {
      console.error('Erreur loadAll:', error)
      toast.error('Erreur de chargement')
    } finally {
      setLoading(false)
    }
  }, [enterpriseId])

  // ─────────────────────────────────────────────────────────────
  // TASK HANDLERS
  // ─────────────────────────────────────────────────────────────

  const handleCreateTask = useCallback(() => {
    setEditingTask(null)
    setShowTaskModal(true)
  }, [])

  const handleEditTask = useCallback((task) => {
    setEditingTask(task)
    setShowTaskModal(true)
  }, [])

  const handleSaveTask = useCallback(async (formData) => {
    setSaving(true)
    try {
      if (editingTask) {
        const { error } = await updateTask(editingTask.id, formData, admin.id)
        if (error) throw error
        toast.success('Tâche modifiée')
      } else {
        const { error } = await createTask({ ...formData, enterprise_id: enterpriseId }, admin.id)
        if (error) throw error
        toast.success('Tâche créée')
      }
      setShowTaskModal(false)
      await loadAll()
    } catch (error) {
      console.error(error)
      toast.error(error.message || 'Erreur')
    } finally {
      setSaving(false)
    }
  }, [editingTask, admin, enterpriseId, loadAll])

  const handleDeleteTask = useCallback(async () => {
    if (!deleteTarget) return
    setSaving(true)
    try {
      const { success, error } = await deleteTask(deleteTarget.id, admin.id)
      if (!success) throw error
      toast.success('Tâche supprimée')
      setDeleteTarget(null)
      setShowDeleteModal(false)
      await loadAll()
    } catch (error) {
      console.error(error)
      toast.error(error.message || 'Erreur')
    } finally {
      setSaving(false)
    }
  }, [deleteTarget, admin, loadAll])

  const confirmDeleteTask = useCallback((task) => {
    setDeleteTarget(task)
    setShowDeleteModal(true)
  }, [])

  const handleViewTask = useCallback((taskId) => {
    navigate(`/taches/${taskId}`)
  }, [navigate])

  const handleStatusChange = useCallback(async (taskId, newStatus) => {
    try {
      await updateTask(taskId, { status: newStatus }, admin.id)
      toast.success('Statut mis à jour')
      await loadAll()
    } catch (error) {
      toast.error('Erreur de mise à jour')
    }
  }, [admin, loadAll])

  // ─────────────────────────────────────────────────────────────
  // CATEGORY HANDLERS
  // ─────────────────────────────────────────────────────────────

  const handleCreateCategory = useCallback(() => {
    setEditingCategory(null)
    setShowCategoryModal(true)
  }, [])

  const handleEditCategory = useCallback((category) => {
    setEditingCategory(category)
    setShowCategoryModal(true)
  }, [])

  const handleSaveCategory = useCallback(async (formData, categoryId) => {
    setSaving(true)
    try {
      if (categoryId) {
        const { error } = await updateTaskCategory(categoryId, formData)
        if (error) throw error
        toast.success('Catégorie modifiée')
      } else {
        const { error } = await createTaskCategory({ ...formData, enterprise_id: enterpriseId }, admin.id)
        if (error) throw error
        toast.success('Catégorie créée')
      }
      setShowCategoryModal(false)
      await loadAll()
    } catch (error) {
      console.error(error)
      toast.error(error.message || 'Erreur')
    } finally {
      setSaving(false)
    }
  }, [admin, enterpriseId, loadAll])

  const handleDeleteCategory = useCallback(async (categoryId) => {
    setSaving(true)
    try {
      const { success, error } = await deleteTaskCategory(categoryId, admin.id)
      if (!success) throw error
      toast.success('Catégorie supprimée')
      setShowCategoryModal(false)
      if (categoryFilter === categoryId) setCategoryFilter(null)
      await loadAll()
    } catch (error) {
      console.error(error)
      toast.error(error.message || 'Erreur')
    } finally {
      setSaving(false)
    }
  }, [admin, categoryFilter, loadAll])

  // ─────────────────────────────────────────────────────────────
  // BULK ACTIONS
  // ─────────────────────────────────────────────────────────────

  const toggleTaskSelection = useCallback((taskId) => {
    setSelectedTasks(prev =>
      prev.includes(taskId) ? prev.filter(id => id !== taskId) : [...prev, taskId]
    )
  }, [])

  const selectAllTasks = useCallback(() => {
    setSelectedTasks(filteredTasks.map(t => t.id))
  }, [])

  const clearSelection = useCallback(() => {
    setSelectedTasks([])
  }, [])

  const handleBulkDelete = useCallback(async () => {
    if (selectedTasks.length === 0) return
    if (!confirm(`Supprimer ${selectedTasks.length} tâche(s) ?`)) return

    setSaving(true)
    try {
      for (const taskId of selectedTasks) {
        await deleteTask(taskId, admin.id)
      }
      toast.success(`${selectedTasks.length} tâche(s) supprimée(s)`)
      setSelectedTasks([])
      await loadAll()
    } catch (error) {
      toast.error('Erreur')
    } finally {
      setSaving(false)
    }
  }, [selectedTasks, admin, loadAll])

  // ─────────────────────────────────────────────────────────────
  // FILTERING & SORTING
  // ─────────────────────────────────────────────────────────────

  const filteredTasks = useMemo(() => {
    let result = [...tasks]

    // Search
    if (search) {
      const term = search.toLowerCase()
      result = result.filter(t =>
        t.title?.toLowerCase().includes(term) ||
        t.description?.toLowerCase().includes(term)
      )
    }

    // Status filter
    if (statusFilter) {
      result = result.filter(t => t.status === statusFilter)
    }

    // Priority filter
    if (priorityFilter) {
      result = result.filter(t => t.priority === priorityFilter)
    }

    // Type filter
    if (typeFilter) {
      result = result.filter(t => t.task_type === typeFilter)
    }

    // Category filter
    if (categoryFilter) {
      result = result.filter(t => t.category_id === categoryFilter)
    }

    // Sorting
    const sortOpt = SORT_OPTIONS.find(s => s.key === sortKey)
    if (sortOpt) {
      result.sort((a, b) => {
        let valA = a[sortOpt.field]
        let valB = b[sortOpt.field]

        if (sortOpt.field === 'priority') {
          const order = { critical: 0, high: 1, medium: 2, low: 3 }
          valA = order[valA] ?? 2
          valB = order[valB] ?? 2
        }

        if (valA === null || valA === undefined) return 1
        if (valB === null || valB === undefined) return -1

        if (typeof valA === 'string') {
          return sortOpt.dir === 'asc' ? valA.localeCompare(valB) : valB.localeCompare(valA)
        }

        return sortOpt.dir === 'asc' ? valA - valB : valB - valA
      })
    }

    return result
  }, [tasks, search, statusFilter, priorityFilter, typeFilter, categoryFilter, sortKey])

  const stats = useMemo(() => ({
    total: tasks.length,
    assigned: tasks.filter(t => t.status === 'assigned' || t.status === 'seen').length,
    inProgress: tasks.filter(t => t.status === 'in_progress' || t.status === 'paused').length,
    completed: tasks.filter(t => ['completed', 'validated'].includes(t.status)).length,
    overdue: tasks.filter(t => getDeadlineStatus(t.due_at).overdue).length,
    critical: tasks.filter(t => t.priority === 'critical' || t.priority === 'high').length,
  }), [tasks])

  // ─────────────────────────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div style={styles.container}>
        <div style={styles.bgPattern} />
        <main style={styles.main}>
          <div style={styles.headerSection}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
              <div style={styles.titleIcon}><ClipboardList size={24} color="#F59E0B" /></div>
              <div>
                <h1 style={styles.pageTitle}>Gestion des Tâches</h1>
                <p style={styles.pageSubtitle}>Chargement...</p>
              </div>
            </div>
          </div>
          <div style={styles.taskGrid}>
            <SkeletonCard /><SkeletonCard /><SkeletonCard />
            <SkeletonCard /><SkeletonCard /><SkeletonCard />
          </div>
        </main>
      </div>
    )
  }

  return (
    <>
      <style>{`
        @keyframes fadeInUp { from { opacity: 0; transform: translateY(15px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes shimmer { 0% { background-position: -200% 0; } 100% { background-position: 200% 0; } }
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        .spin { animation: spin 1s linear infinite; }
        .afro-task-card { transition: all 0.25s ease !important; }
        .afro-task-card:hover { transform: translateY(-3px) !important; box-shadow: 0 12px 40px rgba(0,0,0,0.4) !important; }
        .afro-task-row { transition: all 0.2s ease !important; }
        .afro-task-row:hover { background: rgba(245,158,11,0.04) !important; }
        .afro-stat-card { transition: all 0.3s ease !important; }
        .afro-stat-card:hover { transform: translateY(-4px) !important; }
        ::-webkit-scrollbar { width: 6px; height: 6px; }
        ::-webkit-scrollbar-track { background: #0A0A0F; }
        ::-webkit-scrollbar-thumb { background: #F59E0B; border-radius: 3px; }
        @media (max-width: 900px) {
          .tasks-layout { flex-direction: column !important; }
          .categories-sidebar { width: 100% !important; }
        }
        @media (max-width: 640px) {
          .task-grid { grid-template-columns: 1fr !important; }
        }
      `}</style>

      <div style={styles.container}>
        <div style={styles.bgPattern} />

        <main style={styles.main}>
          {/* Alertes prédictives */}
          {hasPredictions && alerts.length > 0 && (
            <AlertsBanner
              alerts={alerts}
              collapsed={alertsCollapsed}
              onToggle={() => setAlertsCollapsed(!alertsCollapsed)}
              onViewTask={handleViewTask}
            />
          )}

          {/* Header */}
          <div style={styles.headerSection}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
              <div style={styles.titleIcon}><ClipboardList size={24} color="#F59E0B" /></div>
              <div>
                <h1 style={styles.pageTitle}>Gestion des Tâches</h1>
                <p style={styles.pageSubtitle}>{filteredTasks.length} tâche{filteredTasks.length > 1 ? 's' : ''}</p>
              </div>
            </div>
            <div style={styles.headerActions}>
              <div style={styles.liveBadge}><Activity size={12} /> En direct</div>
              <button onClick={() => setShowShortcuts(true)} style={styles.iconBtnHeader} title="Raccourcis (?)">
                <HelpCircle size={16} />
              </button>
                            <button onClick={() => loadAll()} style={styles.iconBtnHeader} title="Rafraîchir (R)">
                <RefreshCw size={16} />
              </button>
              <button onClick={handleCreateCategory} style={styles.btnSecondary}>
                <Tag size={15} /><span>Catégorie</span>
              </button>
              <button onClick={handleCreateTask} style={styles.btnPrimary}>
                <Plus size={16} /><span>Nouvelle tâche</span>
              </button>
            </div>
          </div>

          {/* Stats */}
          <div style={styles.statsGrid}>
            <StatCard icon={ClipboardList} color="#F59E0B" bg="rgba(245,158,11,0.15)" value={stats.total} label="Total" delay={0} />
            <StatCard icon={Target} color="#6366F1" bg="rgba(99,102,241,0.15)" value={stats.assigned} label="Assignées" delay={0.06} />
            <StatCard icon={Timer} color="#8B5CF6" bg="rgba(139,92,246,0.15)" value={stats.inProgress} label="En cours" delay={0.12} />
            <StatCard icon={CheckCircle2} color="#10B981" bg="rgba(16,185,129,0.15)" value={stats.completed} label="Terminées" delay={0.18} />
            <StatCard icon={AlertTriangle} color="#EF4444" bg="rgba(239,68,68,0.15)" value={stats.overdue} label="En retard" delay={0.24} />
            <StatCard icon={Zap} color="#F97316" bg="rgba(249,115,22,0.15)" value={stats.critical} label="Prioritaires" delay={0.30} />
          </div>

          {/* Toolbar */}
          <div style={styles.toolbar}>
            <div style={styles.searchBox}>
              <Search size={14} color="#F59E0B" />
              <input
                ref={searchRef}
                type="text"
                placeholder="Rechercher... (/)"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                style={styles.searchInput}
              />
              {search && (
                <button onClick={() => setSearch('')} style={styles.clearBtn}><X size={12} /></button>
              )}
            </div>

            <div style={styles.toolbarRight}>
              <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} style={styles.filterSelect}>
                <option value="">Tous statuts</option>
                <option value="assigned">Assignée</option>
                <option value="seen">Vue</option>
                <option value="in_progress">En cours</option>
                <option value="paused">En pause</option>
                <option value="completed">Terminée</option>
                <option value="validated">Validée</option>
                <option value="rejected">Rejetée</option>
                <option value="cancelled">Annulée</option>
              </select>

              <select value={priorityFilter} onChange={(e) => setPriorityFilter(e.target.value)} style={styles.filterSelect}>
                <option value="">Toutes priorités</option>
                <option value="low">Basse</option>
                <option value="medium">Moyenne</option>
                <option value="high">Haute</option>
                <option value="critical">Critique</option>
              </select>

              <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)} style={styles.filterSelect}>
                <option value="">Tous types</option>
                <option value="individual">Individuelle</option>
                <option value="team">Équipe</option>
              </select>

              <select value={sortKey} onChange={(e) => setSortKey(e.target.value)} style={styles.filterSelect}>
                {SORT_OPTIONS.map(s => (
                  <option key={s.key} value={s.key}>{s.label}</option>
                ))}
              </select>

              {/* Toggle vues */}
              <div style={styles.viewToggle}>
                <button
                  onClick={() => setViewMode(VIEW_MODES.GRID)}
                  style={{ ...styles.viewBtn, ...(viewMode === VIEW_MODES.GRID ? styles.viewBtnActive : {}) }}
                  title="Grille (G)"
                >
                  <LayoutGrid size={14} />
                </button>
                <button
                  onClick={() => setViewMode(VIEW_MODES.LIST)}
                  style={{ ...styles.viewBtn, ...(viewMode === VIEW_MODES.LIST ? styles.viewBtnActive : {}) }}
                  title="Liste (L)"
                >
                  <List size={14} />
                </button>
                <button
                  onClick={() => setViewMode(VIEW_MODES.KANBAN)}
                  style={{ ...styles.viewBtn, ...(viewMode === VIEW_MODES.KANBAN ? styles.viewBtnActive : {}) }}
                  title="Kanban (K)"
                >
                  <Columns3 size={14} />
                </button>
              </div>
            </div>
          </div>

          {/* Bulk Actions Bar */}
          {selectedTasks.length > 0 && (
            <div style={styles.bulkBar}>
              <span style={{ color: '#F59E0B', fontWeight: '600', fontSize: '13px' }}>
                {selectedTasks.length} sélectionnée(s)
              </span>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button onClick={selectAllTasks} style={styles.bulkBtn}>Tout sélectionner</button>
                <button onClick={clearSelection} style={styles.bulkBtn}>Désélectionner</button>
                <button
                  onClick={handleBulkDelete}
                  style={{ ...styles.bulkBtn, color: '#EF4444', borderColor: 'rgba(239,68,68,0.3)' }}
                >
                  <Trash2 size={13} /> Supprimer ({selectedTasks.length})
                </button>
              </div>
            </div>
          )}

          {/* Layout Principal */}
          <div className="tasks-layout" style={styles.tasksLayout}>

            {/* Sidebar Catégories */}
            <div className="categories-sidebar" style={styles.categoriesSidebar}>
              <CategoriesPanel
                categories={categories}
                onEdit={handleEditCategory}
                onCreate={handleCreateCategory}
                selectedCategory={categoryFilter}
                onSelect={setCategoryFilter}
                collapsed={categoriesCollapsed}
                onToggle={() => setCategoriesCollapsed(!categoriesCollapsed)}
              />
            </div>

            {/* Contenu Principal */}
            <div style={styles.tasksMain}>
              {filteredTasks.length === 0 ? (
                <div style={styles.emptyState}>
                  <div style={styles.emptyIcon}><ClipboardList size={40} color="#F59E0B" /></div>
                  <h3 style={{ color: '#FFF', fontSize: '16px', margin: '0 0 8px' }}>
                    {search || statusFilter || priorityFilter || typeFilter || categoryFilter
                      ? 'Aucune tâche trouvée'
                      : 'Aucune tâche'}
                  </h3>
                  <p style={{ color: '#888', fontSize: '13px', margin: '0 0 16px' }}>
                    {search || statusFilter || priorityFilter || typeFilter || categoryFilter
                      ? 'Essayez de modifier vos filtres'
                      : 'Créez votre première tâche'}
                  </p>
                  {!search && !statusFilter && !priorityFilter && !typeFilter && !categoryFilter && (
                    <button onClick={handleCreateTask} style={styles.btnPrimary}>
                      <Plus size={15} /> Créer une tâche
                    </button>
                  )}
                </div>
              ) : viewMode === VIEW_MODES.KANBAN ? (
                <KanbanView
                  tasks={filteredTasks}
                  onEdit={handleEditTask}
                  onDelete={confirmDeleteTask}
                  onView={handleViewTask}
                  onStatusChange={handleStatusChange}
                />
              ) : viewMode === VIEW_MODES.LIST ? (
                <div style={styles.tasksList}>
                  {/* Header liste */}
                  <div style={styles.listHeader}>
                    <div style={styles.rowCheck} onClick={selectAllTasks}>
                      <Square size={16} color="#555" />
                    </div>
                    <span style={{ color: '#888', fontSize: '11px', fontWeight: '700', textTransform: 'uppercase', flex: 1 }}>Tâche</span>
                    <span style={{ color: '#888', fontSize: '11px', fontWeight: '700', textTransform: 'uppercase', width: 120 }}>Statut</span>
                    <span style={{ color: '#888', fontSize: '11px', fontWeight: '700', textTransform: 'uppercase', width: 100 }}>Actions</span>
                  </div>
                  {filteredTasks.map((task, i) => (
                    <div key={task.id} style={{ animation: `fadeInUp 0.3s ease ${i * 0.02}s forwards`, opacity: 0 }}>
                      <TaskCard
                        task={task}
                        viewMode={VIEW_MODES.LIST}
                        selected={selectedTasks.includes(task.id)}
                        onSelect={toggleTaskSelection}
                        onEdit={handleEditTask}
                        onDelete={confirmDeleteTask}
                        onView={handleViewTask}
                      />
                    </div>
                  ))}
                </div>
              ) : (
                <div className="task-grid" style={styles.taskGrid}>
                  {filteredTasks.map((task, i) => (
                    <div key={task.id} style={{ animation: `fadeInUp 0.3s ease ${i * 0.04}s forwards`, opacity: 0 }}>
                      <TaskCard
                        task={task}
                        viewMode={VIEW_MODES.GRID}
                        selected={selectedTasks.includes(task.id)}
                        onSelect={toggleTaskSelection}
                        onEdit={handleEditTask}
                        onDelete={confirmDeleteTask}
                        onView={handleViewTask}
                      />
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </main>
      </div>

      {/* Modals */}
      <TaskModal
        open={showTaskModal}
        onClose={() => setShowTaskModal(false)}
        onSave={handleSaveTask}
        loading={saving}
        editingTask={editingTask}
        employees={employees}
        teams={teams}
        categories={categories}
        enterpriseId={enterpriseId}
      />
      <CategoryModal
        open={showCategoryModal}
        onClose={() => setShowCategoryModal(false)}
        onSave={handleSaveCategory}
        onDelete={handleDeleteCategory}
        loading={saving}
        editingCategory={editingCategory}
        categories={categories}
      />
      <DeleteModal
        open={showDeleteModal}
        onClose={() => { setShowDeleteModal(false); setDeleteTarget(null) }}
        onConfirm={handleDeleteTask}
        title={deleteTarget?.title || ''}
        loading={saving}
      />
      <ShortcutsModal
        open={showShortcuts}
        onClose={() => setShowShortcuts(false)}
      />
    </>
  )
}

// ═══════════════════════════════════════════════════════════════════
// STYLES
// ═══════════════════════════════════════════════════════════════════

const styles = {
  container: { minHeight: '100vh', background: '#0A0A0F', position: 'relative' },
  bgPattern: {
    position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, pointerEvents: 'none', zIndex: 0,
    backgroundImage: `radial-gradient(circle at 15% 50%, rgba(245,158,11,0.03) 0%, transparent 50%),
                      radial-gradient(circle at 85% 20%, rgba(99,102,241,0.03) 0%, transparent 50%)`
  },
  main: { padding: 'clamp(14px, 3vw, 24px)', maxWidth: '1500px', margin: '0 auto', position: 'relative', zIndex: 1 },

  // Alerts Banner
  alertsBanner: {
    background: 'rgba(20,20,35,0.9)', border: '1px solid rgba(245,158,11,0.2)',
    borderRadius: '14px', marginBottom: '16px', overflow: 'hidden'
  },
  alertsBannerCollapsed: {
    background: 'rgba(20,20,35,0.8)', border: '1px solid rgba(245,158,11,0.15)',
    borderRadius: '10px', padding: '10px 14px', marginBottom: '16px', cursor: 'pointer'
  },
  alertsBannerCollapsedContent: { display: 'flex', alignItems: 'center', gap: '8px' },
  alertsBannerHeader: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    padding: '12px 16px', borderBottom: '1px solid rgba(255,255,255,0.06)'
  },
  alertsCount: {
    background: 'rgba(245,158,11,0.2)', color: '#F59E0B',
    padding: '2px 8px', borderRadius: '10px', fontSize: '11px', fontWeight: '700'
  },
  alertsList: { padding: '10px', display: 'flex', flexDirection: 'column', gap: '6px' },
  alertItem: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px',
    padding: '8px 10px', background: 'rgba(255,255,255,0.02)', borderRadius: '8px',
    borderLeft: '3px solid', flexWrap: 'wrap'
  },
  alertItemContent: { display: 'flex', alignItems: 'center', gap: '8px', flex: 1 },
  alertMessage: { color: '#ccc', fontSize: '12px' },
  alertActionBtn: {
    display: 'flex', alignItems: 'center', gap: '4px',
    padding: '4px 10px', background: 'rgba(245,158,11,0.1)',
    border: '1px solid rgba(245,158,11,0.2)', borderRadius: '6px',
    color: '#F59E0B', fontSize: '11px', fontWeight: '600', cursor: 'pointer'
  },

  // Header
  headerSection: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    marginBottom: '20px', gap: '16px', flexWrap: 'wrap'
  },
  titleIcon: {
    width: 46, height: 46, borderRadius: 12,
    background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.2)',
    display: 'flex', alignItems: 'center', justifyContent: 'center'
  },
  pageTitle: { color: '#FFF', fontSize: 'clamp(18px, 3vw, 24px)', fontWeight: '700', margin: 0 },
  pageSubtitle: { color: '#888', fontSize: '13px', margin: '2px 0 0' },
  headerActions: { display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' },
  liveBadge: {
    display: 'flex', alignItems: 'center', gap: '5px',
    background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.25)',
    color: '#10B981', padding: '5px 12px', borderRadius: '16px', fontSize: '11px', fontWeight: '600'
  },
  iconBtnHeader: {
    width: 36, height: 36, borderRadius: 10,
    border: '1px solid rgba(255,255,255,0.08)', background: 'rgba(255,255,255,0.04)',
    color: '#aaa', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer'
  },

  // Stats
  statsGrid: {
    display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))',
    gap: '10px', marginBottom: '16px'
  },
  statCard: {
    background: 'rgba(20,20,35,0.8)', borderRadius: '12px',
    padding: '14px', display: 'flex', alignItems: 'center', gap: '10px',
    border: '1px solid rgba(255,255,255,0.06)'
  },
  statIconWrap: { width: 40, height: 40, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  statContent: { display: 'flex', flexDirection: 'column' },
  statNumber: { fontSize: 'clamp(18px, 3vw, 24px)', fontWeight: '700', color: '#FFF', lineHeight: 1, marginBottom: 2 },
  statLabel: { fontSize: '11px', color: '#888', fontWeight: '500' },

  // Toolbar
  toolbar: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    gap: '10px', marginBottom: '14px', flexWrap: 'wrap'
  },
  searchBox: {
    display: 'flex', alignItems: 'center', gap: '8px',
    background: 'rgba(20,20,35,0.8)', border: '1px solid rgba(255,255,255,0.06)',
    borderRadius: '10px', padding: '10px 14px', flex: 1, maxWidth: '360px', minWidth: '200px'
  },
  searchInput: { flex: 1, background: 'transparent', border: 'none', outline: 'none', color: '#FFF', fontSize: '13px' },
  clearBtn: {
    background: 'rgba(255,255,255,0.1)', border: 'none', borderRadius: '50%',
    width: 20, height: 20, display: 'flex', alignItems: 'center', justifyContent: 'center',
    color: '#888', cursor: 'pointer'
  },
  toolbarRight: { display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' },
  filterSelect: {
    background: 'rgba(20,20,35,0.8)', border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: '8px', padding: '8px 10px', color: '#E5E5E5', fontSize: '12px',
    cursor: 'pointer', outline: 'none'
  },
  viewToggle: {
    display: 'flex', background: 'rgba(20,20,35,0.8)',
    borderRadius: '8px', border: '1px solid rgba(255,255,255,0.06)', overflow: 'hidden'
  },
  viewBtn: {
    padding: '8px 10px', background: 'transparent', border: 'none',
    color: '#666', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center'
  },
  viewBtnActive: { background: 'rgba(245,158,11,0.15)', color: '#F59E0B' },

  // Bulk Bar
  bulkBar: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    padding: '10px 16px', background: 'rgba(245,158,11,0.08)',
    border: '1px solid rgba(245,158,11,0.2)', borderRadius: '10px', marginBottom: '12px', flexWrap: 'wrap', gap: 8
  },
  bulkBtn: {
    display: 'flex', alignItems: 'center', gap: '5px',
    padding: '6px 12px', background: 'transparent',
    border: '1px solid rgba(255,255,255,0.1)', borderRadius: '6px',
    color: '#ccc', fontSize: '12px', cursor: 'pointer'
  },

  // Layout
  tasksLayout: { display: 'flex', gap: '14px', alignItems: 'flex-start' },
  categoriesSidebar: { width: '200px', flexShrink: 0 },
  tasksMain: { flex: 1, minWidth: 0 },

  // Task Grid / List
  taskGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: '12px' },
  tasksList: { display: 'flex', flexDirection: 'column', gap: '6px' },
  listHeader: {
    display: 'flex', alignItems: 'center', gap: '12px',
    padding: '8px 14px', color: '#888', fontSize: '11px'
  },

  // Task Card (Grid)
  taskCard: {
    background: 'rgba(20,20,35,0.8)', borderRadius: '14px',
    border: '1px solid rgba(255,255,255,0.06)',
    padding: '14px', display: 'flex', flexDirection: 'column', gap: '10px',
    position: 'relative', overflow: 'hidden', cursor: 'grab'
  },
  cardAccent: { position: 'absolute', top: 0, left: 0, right: 0, height: '2px' },
  cardTopRow: { display: 'flex', alignItems: 'flex-start', gap: '10px' },
  cardCheck: { cursor: 'pointer', paddingTop: '2px', flexShrink: 0 },
  taskIconWrap: {
    width: 36, height: 36, borderRadius: 10,
    display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0
  },
  taskInfo: { flex: 1, minWidth: 0 },
  taskTitle: {
    margin: 0, color: '#FFF', fontSize: '14px', fontWeight: '700',
    display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden'
  },
  taskDescription: {
    margin: '3px 0 0', color: '#888', fontSize: '11px', lineHeight: '1.4',
    display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden'
  },
  taskMeta: { display: 'flex', gap: '5px', flexWrap: 'wrap' },
  infoSection: {
    display: 'flex', flexDirection: 'column', gap: '6px',
    background: 'rgba(255,255,255,0.02)', borderRadius: '10px', padding: '8px 10px'
  },
  infoRow: { display: 'flex', alignItems: 'center', gap: '7px' },
  infoText: { fontSize: '12px', color: '#ccc' },
  deadlineBox: {
    display: 'flex', alignItems: 'center', gap: '6px',
    padding: '6px 10px', borderRadius: '8px', border: '1px solid'
  },
  cardActionsRow: {
    display: 'flex', gap: '6px',
    borderTop: '1px solid rgba(255,255,255,0.04)', paddingTop: '10px'
  },
  cardActionBtn: {
    flex: 1, display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '5px',
    padding: '8px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.08)',
    background: 'rgba(255,255,255,0.03)', color: '#ccc', cursor: 'pointer',
    fontWeight: '600', fontSize: '12px', fontFamily: 'inherit'
  },

  // Task Row (List)
  taskRow: {
    display: 'flex', alignItems: 'center', gap: '10px',
    padding: '10px 14px', background: 'rgba(20,20,35,0.8)',
    borderRadius: '10px', border: '1px solid rgba(255,255,255,0.06)'
  },
  rowCheck: { cursor: 'pointer', flexShrink: 0 },
  priorityDot: { width: 8, height: 8, borderRadius: 3, flexShrink: 0 },
  rowMain: { flex: 1, minWidth: 0 },
  rowTitle: { color: '#FFF', fontSize: '13px', fontWeight: '600' },
  rowMeta: { display: 'flex', alignItems: 'center', gap: '8px', marginTop: '3px' },
  rowActions: { display: 'flex', gap: '4px' },
  iconBtn: {
    width: 28, height: 28, borderRadius: 6,
    background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)',
    color: '#888', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center'
  },

  // Kanban
  kanbanContainer: { display: 'flex', gap: '10px', overflowX: 'auto', paddingBottom: '8px' },
  kanbanColumn: {
    minWidth: '240px', flex: 1, background: 'rgba(20,20,35,0.6)',
    borderRadius: '12px', border: '1px solid rgba(255,255,255,0.06)', transition: 'border-color 0.2s'
  },
  kanbanHeader: {
    padding: '12px', borderBottom: '1px solid rgba(255,255,255,0.06)',
    borderLeft: '3px solid', display: 'flex', justifyContent: 'space-between', alignItems: 'center'
  },
  kanbanTitle: { color: '#FFF', fontSize: '13px', fontWeight: '700' },
  kanbanCount: {
    background: 'rgba(255,255,255,0.1)', padding: '2px 8px',
    borderRadius: '10px', fontSize: '11px', color: '#888'
  },
  kanbanCards: { padding: '8px', display: 'flex', flexDirection: 'column', gap: '6px', maxHeight: '500px', overflowY: 'auto' },
  kanbanCard: {
    padding: '10px', background: 'rgba(20,20,35,0.8)',
    borderRadius: '10px', border: '1px solid rgba(255,255,255,0.06)', cursor: 'grab'
  },
  kanbanCardHeader: { display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' },
  kanbanCardTitle: { color: '#FFF', fontSize: '12px', fontWeight: '600', flex: 1 },
  kanbanCardMeta: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '4px' },
  kanbanAssignee: { display: 'flex', alignItems: 'center', gap: '4px', fontSize: '11px', color: '#ccc' },
  kanbanCardActions: { display: 'flex', gap: '4px', marginTop: '8px' },
  kanbanActionBtn: {
    width: 24, height: 24, borderRadius: 6,
    background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.08)',
    color: '#888', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center'
  },
  kanbanEmpty: { padding: '20px', textAlign: 'center', color: '#666', fontSize: '12px' },

  // Categories Panel
  categoriesPanel: {
    background: 'rgba(20,20,35,0.8)', borderRadius: '12px',
    border: '1px solid rgba(255,255,255,0.06)', overflow: 'hidden'
  },
  categoriesPanelCollapsed: {
    display: 'flex', alignItems: 'center', gap: '8px',
    padding: '10px 12px', background: 'rgba(20,20,35,0.8)',
    borderRadius: '12px', border: '1px solid rgba(255,255,255,0.06)', cursor: 'pointer'
  },
  categoriesPanelHeader: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    padding: '12px', borderBottom: '1px solid rgba(255,255,255,0.06)'
  },
  addCategoryBtn: {
    width: 24, height: 24, borderRadius: 6, background: 'rgba(245,158,11,0.1)',
    border: '1px solid rgba(245,158,11,0.2)', color: '#F59E0B', cursor: 'pointer',
    display: 'flex', alignItems: 'center', justifyContent: 'center'
  },
  collapseBtn: {
    width: 24, height: 24, borderRadius: 6, background: 'transparent',
    border: 'none', color: '#888', cursor: 'pointer',
    display: 'flex', alignItems: 'center', justifyContent: 'center'
  },
  categoriesList: { padding: '8px', display: 'flex', flexDirection: 'column', gap: '4px' },
  categoryItem: {
    display: 'flex', alignItems: 'center', gap: '8px',
    padding: '8px 10px', borderRadius: '8px', border: '1px solid',
    cursor: 'pointer', transition: 'all 0.15s ease'
  },
  editCategoryBtn: {
    background: 'transparent', border: 'none', color: '#666',
    cursor: 'pointer', padding: '2px', borderRadius: '4px',
    display: 'flex', alignItems: 'center', justifyContent: 'center'
  },

  // Empty State
  emptyState: {
    textAlign: 'center', padding: '48px 20px',
    background: 'rgba(20,20,35,0.6)', borderRadius: '16px',
    border: '1px solid rgba(255,255,255,0.06)'
  },
  emptyIcon: {
    width: 64, height: 64, borderRadius: 16,
    background: 'rgba(245,158,11,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center',
    margin: '0 auto 16px'
  },

  // Modals
  modalOverlay: {
    position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
    background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(6px)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    padding: '16px', zIndex: 1000
  },
  modal: {
    width: '100%', maxWidth: '520px', background: '#141420',
    border: '1px solid rgba(245,158,11,0.15)', borderRadius: '18px',
    overflow: 'hidden', boxShadow: '0 24px 80px rgba(0,0,0,0.6)',
    maxHeight: '90vh', display: 'flex', flexDirection: 'column'
  },
  modalHeader: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    padding: '16px 18px', borderBottom: '1px solid rgba(255,255,255,0.06)'
  },
  modalTitle: { margin: 0, color: '#FFF', fontSize: '16px', fontWeight: '700' },
  modalCloseBtn: {
    width: 32, height: 32, borderRadius: 8,
    border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.04)',
    color: '#888', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center'
  },
  modalBody: { padding: '18px', overflowY: 'auto', flex: 1 },
  modalActions: { display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: '10px', marginTop: '20px' },

  // Form
  formGrid: { display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '14px' },
  formGroup: { display: 'flex', flexDirection: 'column', gap: '6px' },
  label: {
    display: 'flex', alignItems: 'center', gap: '6px',
    fontSize: '11px', fontWeight: '700', color: '#888',
    textTransform: 'uppercase', letterSpacing: '0.5px'
  },
  input: {
    width: '100%', boxSizing: 'border-box', padding: '10px 12px', borderRadius: '10px',
    border: '1px solid rgba(255,255,255,0.08)', background: 'rgba(255,255,255,0.04)',
    color: '#FFF', outline: 'none', fontSize: '13px', fontFamily: 'inherit'
  },
  select: {
    width: '100%', boxSizing: 'border-box', padding: '10px 12px', borderRadius: '10px',
    border: '1px solid rgba(255,255,255,0.08)', background: 'rgba(255,255,255,0.04)',
    color: '#FFF', outline: 'none', fontSize: '13px', fontFamily: 'inherit', cursor: 'pointer'
  },
  colorPicker: { display: 'flex', gap: '8px', flexWrap: 'wrap' },
  categoryStats: {
    display: 'flex', flexDirection: 'column', gap: '8px',
    padding: '12px', background: 'rgba(255,255,255,0.02)',
    borderRadius: '10px', border: '1px solid rgba(255,255,255,0.06)', marginTop: '4px'
  },
  categoryStatItem: { display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: '#ccc' },

  // Task Modal spécifiques
  workloadAlert: {
    display: 'flex', alignItems: 'flex-start', gap: '10px',
    padding: '12px', borderRadius: '10px', border: '1px solid',
    marginBottom: '14px'
  },
  workloadAlertContent: { flex: 1 },
  workloadWarningItem: { color: '#ccc', fontSize: '12px', lineHeight: '1.5' },
  suggestBtn: {
    display: 'flex', alignItems: 'center', gap: '4px',
    padding: '3px 8px', background: 'rgba(245,158,11,0.1)',
    border: '1px solid rgba(245,158,11,0.2)', borderRadius: '6px',
    color: '#F59E0B', fontSize: '10px', fontWeight: '600', cursor: 'pointer',
    marginLeft: '8px'
  },
  suggestionsDropdown: {
    marginTop: '6px', background: '#141420', border: '1px solid rgba(245,158,11,0.2)',
    borderRadius: '10px', overflow: 'hidden', boxShadow: '0 8px 30px rgba(0,0,0,0.4)'
  },
  suggestionsHeader: {
    display: 'flex', alignItems: 'center', gap: '8px',
    padding: '8px 12px', borderBottom: '1px solid rgba(255,255,255,0.06)',
    fontSize: '12px', color: '#F59E0B', fontWeight: '700'
  },
  closeSuggestBtn: {
    marginLeft: 'auto', background: 'transparent', border: 'none',
    color: '#888', cursor: 'pointer', display: 'flex', alignItems: 'center'
  },
  suggestionItem: {
    padding: '10px 12px', cursor: 'pointer', borderBottom: '1px solid rgba(255,255,255,0.04)',
    transition: 'background 0.15s'
  },
  suggestionMain: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' },
  suggestionName: { color: '#FFF', fontSize: '13px', fontWeight: '600' },
  suggestionScore: {
    background: 'rgba(16,185,129,0.15)', color: '#10B981',
    padding: '2px 8px', borderRadius: '8px', fontSize: '11px', fontWeight: '700'
  },
  suggestionFactors: { display: 'flex', gap: '4px', flexWrap: 'wrap' },
  factorChip: {
    padding: '2px 6px', background: 'rgba(255,255,255,0.06)',
    borderRadius: '6px', fontSize: '10px'
  },
  predictionHint: {
    display: 'flex', alignItems: 'center', gap: '6px',
    marginTop: '6px', padding: '6px 10px', background: 'rgba(245,158,11,0.08)',
    border: '1px solid rgba(245,158,11,0.15)', borderRadius: '8px',
    fontSize: '11px', color: '#ccc', flexWrap: 'wrap'
  },
  applyPredictionBtn: {
    marginLeft: 'auto', padding: '3px 8px', background: 'rgba(245,158,11,0.15)',
    border: '1px solid rgba(245,158,11,0.25)', borderRadius: '6px',
    color: '#F59E0B', fontSize: '10px', fontWeight: '600', cursor: 'pointer'
  },
  settingsBox: {
    marginTop: '16px', padding: '14px', borderRadius: '12px',
    background: 'rgba(245,158,11,0.04)', border: '1px solid rgba(245,158,11,0.12)'
  },
  sectionTitle: {
    margin: '0 0 12px', color: '#FFF', fontSize: '12px', fontWeight: '700',
    display: 'flex', alignItems: 'center', gap: '6px'
  },
  checkboxGrid: { display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '8px' },
  checkboxItem: {
    display: 'flex', alignItems: 'center', gap: '8px',
    color: '#ccc', fontSize: '12px', cursor: 'pointer',
    padding: '7px 10px', borderRadius: '8px',
    background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.04)'
  },

  // Shortcuts
  shortcutRow: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    padding: '8px 0', borderBottom: '1px solid rgba(255,255,255,0.04)'
  },
  kbd: {
    padding: '4px 10px', background: 'rgba(245,158,11,0.1)',
    border: '1px solid rgba(245,158,11,0.25)', borderRadius: '6px',
    color: '#F59E0B', fontSize: '12px', fontWeight: '700', fontFamily: 'monospace'
  },

  // Skeleton
  skeletonCard: {
    background: 'rgba(20,20,35,0.8)', borderRadius: '14px',
    border: '1px solid rgba(255,255,255,0.06)', padding: '14px'
  },
  skeletonHeader: { display: 'flex', alignItems: 'center', gap: '10px' },
  skeletonCircle: {
    borderRadius: '10px',
    background: 'linear-gradient(90deg, rgba(255,255,255,0.04) 25%, rgba(255,255,255,0.08) 50%, rgba(255,255,255,0.04) 75%)',
    backgroundSize: '200% 100%', animation: 'shimmer 1.5s infinite'
  },
  skeletonLine: {
    height: 14, borderRadius: '6px',
    background: 'linear-gradient(90deg, rgba(255,255,255,0.04) 25%, rgba(255,255,255,0.08) 50%, rgba(255,255,255,0.04) 75%)',
    backgroundSize: '200% 100%', animation: 'shimmer 1.5s infinite'
  },

  // Buttons
  btnPrimary: {
    display: 'inline-flex', alignItems: 'center', gap: '6px',
    padding: '10px 18px', borderRadius: '10px', border: 'none',
    background: 'linear-gradient(135deg, #F59E0B, #D97706)',
    color: '#000', fontWeight: '700', fontSize: '13px', cursor: 'pointer', fontFamily: 'inherit'
  },
  btnSecondary: {
    display: 'inline-flex', alignItems: 'center', gap: '6px',
    padding: '10px 16px', borderRadius: '10px',
    border: '1px solid rgba(255,255,255,0.08)', background: 'rgba(255,255,255,0.04)',
    color: '#ccc', fontWeight: '600', fontSize: '13px', cursor: 'pointer', fontFamily: 'inherit'
  },
  btnDanger: {
    display: 'inline-flex', alignItems: 'center', gap: '6px',
    padding: '10px 18px', borderRadius: '10px', border: 'none',
    background: 'linear-gradient(135deg, #EF4444, #B91C1C)',
    color: '#FFF', fontWeight: '700', fontSize: '13px', cursor: 'pointer', fontFamily: 'inherit'
  },
}