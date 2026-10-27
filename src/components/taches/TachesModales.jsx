// ═══════════════════════════════════════════════════════════
// 🧩 TÂCHES — FENÊTRES DE TRAVAIL (perles zoulou)
//
// Une tâche (avec durée estimée, charge de la personne et
// suggestions), une catégorie, une suppression à confirmer, les
// raccourcis. Partagées par la vue « Tâches » de la page
// Employés : pas de coque d'écran ici, uniquement le travail.
// Les couleurs viennent des variables --zl-* de la page hôte.
// ═══════════════════════════════════════════════════════════

import { useEffect, useState } from 'react'
import { Plus, X, Loader2, Edit3, Trash2, Clock, AlertTriangle, CheckCircle2, Camera, FileText, MessageSquare, ShieldCheck, Sparkles, Tag, Check, List, Lightbulb } from 'lucide-react'
import toast from 'react-hot-toast'

import {
  predictTaskDuration, checkEmployeeWorkload, suggestAssignees,
  TASK_PRIORITY, TASK_TYPE,
} from '../../services/taskService'

const CATEGORY_COLORS = [
  '#C9772F', '#2F7F73', '#8A8F4A', '#B4553F', '#7C6AA8',
  '#A9743F', '#4C7E8F', '#6E8B5A', '#B34B37', '#5B6F8C',
]

export function CategoryModal({ open, onClose, onSave, onDelete, loading, editingCategory, categories }) {
  const [form, setForm] = useState({ name: '', description: '', color: CATEGORY_COLORS[0], icon: 'clipboard' })
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)

  useEffect(() => {
    if (open) {
      if (editingCategory) {
        setForm({
          name: editingCategory.name || '',
          description: editingCategory.description || '',
          color: editingCategory.color || CATEGORY_COLORS[0],
          icon: editingCategory.icon || 'clipboard'
        })
      } else {
        setForm({ name: '', description: '', color: CATEGORY_COLORS[0], icon: 'clipboard' })
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
            <div style={{ width: 40, height: 40, borderRadius: 12, background: 'var(--zl-cuivre-voile)', border: '1px solid var(--zl-cuivre-voile)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Tag size={18} color="var(--zl-cuivre)" />
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
                    border: form.color === color ? '3px solid var(--zl-encre)' : '3px solid transparent',
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
                  <CheckCircle2 size={14} color="var(--zl-teal)" />
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
                  background: showDeleteConfirm ? 'var(--zl-corail)' : 'rgba(239,68,68,0.1)',
                  color: showDeleteConfirm ? 'var(--zl-encre)' : 'var(--zl-corail)',
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


export function TaskModal({ 
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
            <div style={{ width: 40, height: 40, borderRadius: 12, background: 'var(--zl-cuivre-voile)', border: '1px solid var(--zl-cuivre-voile)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              {editingTask ? <Edit3 size={18} color="var(--zl-cuivre)" /> : <Plus size={18} color="var(--zl-cuivre)" />}
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
              borderColor: workloadWarning.severity === 'critical' ? 'var(--zl-corail)' : 'var(--zl-cuivre)',
              background: workloadWarning.severity === 'critical' ? 'rgba(239,68,68,0.1)' : 'var(--zl-cuivre-voile)'
            }}>
              <AlertTriangle size={16} color={workloadWarning.severity === 'critical' ? 'var(--zl-corail)' : 'var(--zl-cuivre)'} />
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
                    <Sparkles size={14} color="var(--zl-cuivre)" />
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
                            color: f.impact > 0 ? 'var(--zl-teal)' : f.impact < 0 ? 'var(--zl-corail)' : 'var(--zl-faible)'
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
                  <Sparkles size={12} color="var(--zl-cuivre)" />
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
              <ShieldCheck size={14} color="var(--zl-cuivre)" />
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
                    border: `2px solid ${form[key] ? 'var(--zl-cuivre)' : 'rgba(255,255,255,0.15)'}`,
                    background: form[key] ? 'var(--zl-cuivre-voile)' : 'transparent',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    cursor: 'pointer', flexShrink: 0,
                  }}>
                    {form[key] && <Check size={12} color="var(--zl-cuivre)" />}
                  </div>
                  <input
                    type="checkbox"
                    checked={form[key]}
                    onChange={(e) => setForm({ ...form, [key]: e.target.checked })}
                    style={{ display: 'none' }}
                  />
                  <Ic size={13} color={form[key] ? 'var(--zl-cuivre)' : 'var(--zl-faible)'} />
                  <span style={{ color: form[key] ? 'var(--zl-encre)' : 'var(--zl-faible)' }}>{label}</span>
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


export function DeleteModal({ open, onClose, onConfirm, title, loading }) {
  if (!open) return null
  return (
    <div style={styles.modalOverlay} onClick={onClose}>
      <div style={{ ...styles.modal, maxWidth: 420 }} onClick={(e) => e.stopPropagation()}>
        <div style={{ padding: '28px', textAlign: 'center' }}>
          <div style={{ width: 56, height: 56, borderRadius: 14, background: 'rgba(239,68,68,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
            <AlertTriangle size={26} color="var(--zl-corail)" />
          </div>
          <h3 style={{ color: 'var(--zl-encre)', fontSize: '18px', margin: '0 0 10px' }}>Confirmer la suppression</h3>
          <p style={{ color: 'var(--zl-faible)', fontSize: '14px', margin: '0 0 24px', lineHeight: '1.5' }}>
            Supprimer <strong style={{ color: 'var(--zl-cuivre)' }}>"{title}"</strong> ?
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


export function ShortcutsModal({ open, onClose }) {
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
              <span style={{ color: 'var(--zl-douce)', fontSize: '13px' }}>{s.action}</span>
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


const styles = {
  container: { minHeight: '100vh', background: 'var(--zl-fond)', position: 'relative' },
  bgPattern: {
    position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, pointerEvents: 'none', zIndex: 0,
    backgroundImage: `radial-gradient(circle at 15% 50%, var(--zl-cuivre-voile) 0%, transparent 50%),
                      radial-gradient(circle at 85% 20%, rgba(99,102,241,0.03) 0%, transparent 50%)`
  },
  main: { padding: 'clamp(14px, 3vw, 24px)', maxWidth: '1500px', margin: '0 auto', position: 'relative', zIndex: 1 },

  // Alerts Banner
  alertsBanner: {
    background: 'var(--zl-surface)', border: '1px solid var(--zl-cuivre-voile)',
    borderRadius: '14px', marginBottom: '16px', overflow: 'hidden'
  },
  alertsBannerCollapsed: {
    background: 'var(--zl-surface)', border: '1px solid var(--zl-cuivre-voile)',
    borderRadius: '10px', padding: '10px 14px', marginBottom: '16px', cursor: 'pointer'
  },
  alertsBannerCollapsedContent: { display: 'flex', alignItems: 'center', gap: '8px' },
  alertsBannerHeader: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    padding: '12px 16px', borderBottom: '1px solid var(--zl-trait)'
  },
  alertsCount: {
    background: 'var(--zl-cuivre-voile)', color: 'var(--zl-cuivre)',
    padding: '2px 8px', borderRadius: '10px', fontSize: '11px', fontWeight: '700'
  },
  alertsList: { padding: '10px', display: 'flex', flexDirection: 'column', gap: '6px' },
  alertItem: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px',
    padding: '8px 10px', background: 'var(--zl-creux)', borderRadius: '8px',
    borderLeft: '3px solid', flexWrap: 'wrap'
  },
  alertItemContent: { display: 'flex', alignItems: 'center', gap: '8px', flex: 1 },
  alertMessage: { color: 'var(--zl-douce)', fontSize: '12px' },
  alertActionBtn: {
    display: 'flex', alignItems: 'center', gap: '4px',
    padding: '4px 10px', background: 'var(--zl-cuivre-voile)',
    border: '1px solid var(--zl-cuivre-voile)', borderRadius: '6px',
    color: 'var(--zl-cuivre)', fontSize: '11px', fontWeight: '600', cursor: 'pointer'
  },

  // Header
  headerSection: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    marginBottom: '20px', gap: '16px', flexWrap: 'wrap'
  },
  titleIcon: {
    width: 46, height: 46, borderRadius: 12,
    background: 'var(--zl-cuivre-voile)', border: '1px solid var(--zl-cuivre-voile)',
    display: 'flex', alignItems: 'center', justifyContent: 'center'
  },
  pageTitle: { color: 'var(--zl-encre)', fontSize: 'clamp(18px, 3vw, 24px)', fontWeight: '700', margin: 0 },
  pageSubtitle: { color: 'var(--zl-faible)', fontSize: '13px', margin: '2px 0 0' },
  headerActions: { display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' },
  liveBadge: {
    display: 'flex', alignItems: 'center', gap: '5px',
    background: 'var(--zl-teal-voile)', border: '1px solid var(--zl-teal-voile)',
    color: 'var(--zl-teal)', padding: '5px 12px', borderRadius: '16px', fontSize: '11px', fontWeight: '600'
  },
  iconBtnHeader: {
    width: 36, height: 36, borderRadius: 10,
    border: '1px solid var(--zl-trait)', background: 'var(--zl-creux)',
    color: 'var(--zl-faible)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer'
  },

  // Stats
  statsGrid: {
    display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))',
    gap: '10px', marginBottom: '16px'
  },
  statCard: {
    background: 'var(--zl-surface)', borderRadius: '12px',
    padding: '14px', display: 'flex', alignItems: 'center', gap: '10px',
    border: '1px solid var(--zl-trait)'
  },
  statIconWrap: { width: 40, height: 40, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  statContent: { display: 'flex', flexDirection: 'column' },
  statNumber: { fontSize: 'clamp(18px, 3vw, 24px)', fontWeight: '700', color: 'var(--zl-encre)', lineHeight: 1, marginBottom: 2 },
  statLabel: { fontSize: '11px', color: 'var(--zl-faible)', fontWeight: '500' },

  // Toolbar
  toolbar: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    gap: '10px', marginBottom: '14px', flexWrap: 'wrap'
  },
  searchBox: {
    display: 'flex', alignItems: 'center', gap: '8px',
    background: 'var(--zl-surface)', border: '1px solid var(--zl-trait)',
    borderRadius: '10px', padding: '10px 14px', flex: 1, maxWidth: '360px', minWidth: '200px'
  },
  searchInput: { flex: 1, background: 'transparent', border: 'none', outline: 'none', color: 'var(--zl-encre)', fontSize: '13px' },
  clearBtn: {
    background: 'var(--zl-trait-fort)', border: 'none', borderRadius: '50%',
    width: 20, height: 20, display: 'flex', alignItems: 'center', justifyContent: 'center',
    color: 'var(--zl-faible)', cursor: 'pointer'
  },
  toolbarRight: { display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' },
  filterSelect: {
    background: 'var(--zl-surface)', border: '1px solid var(--zl-trait)',
    borderRadius: '8px', padding: '8px 10px', color: 'var(--zl-encre)', fontSize: '12px',
    cursor: 'pointer', outline: 'none'
  },
  viewToggle: {
    display: 'flex', background: 'var(--zl-surface)',
    borderRadius: '8px', border: '1px solid var(--zl-trait)', overflow: 'hidden'
  },
  viewBtn: {
    padding: '8px 10px', background: 'transparent', border: 'none',
    color: 'var(--zl-faible)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center'
  },
  viewBtnActive: { background: 'var(--zl-cuivre-voile)', color: 'var(--zl-cuivre)' },

  // Bulk Bar
  bulkBar: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    padding: '10px 16px', background: 'var(--zl-cuivre-voile)',
    border: '1px solid var(--zl-cuivre-voile)', borderRadius: '10px', marginBottom: '12px', flexWrap: 'wrap', gap: 8
  },
  bulkBtn: {
    display: 'flex', alignItems: 'center', gap: '5px',
    padding: '6px 12px', background: 'transparent',
    border: '1px solid var(--zl-trait-fort)', borderRadius: '6px',
    color: 'var(--zl-douce)', fontSize: '12px', cursor: 'pointer'
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
    padding: '8px 14px', color: 'var(--zl-faible)', fontSize: '11px'
  },

  // Task Card (Grid)
  taskCard: {
    background: 'var(--zl-surface)', borderRadius: '14px',
    border: '1px solid var(--zl-trait)',
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
    margin: 0, color: 'var(--zl-encre)', fontSize: '14px', fontWeight: '700',
    display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden'
  },
  taskDescription: {
    margin: '3px 0 0', color: 'var(--zl-faible)', fontSize: '11px', lineHeight: '1.4',
    display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden'
  },
  taskMeta: { display: 'flex', gap: '5px', flexWrap: 'wrap' },
  infoSection: {
    display: 'flex', flexDirection: 'column', gap: '6px',
    background: 'var(--zl-creux)', borderRadius: '10px', padding: '8px 10px'
  },
  infoRow: { display: 'flex', alignItems: 'center', gap: '7px' },
  infoText: { fontSize: '12px', color: 'var(--zl-douce)' },
  deadlineBox: {
    display: 'flex', alignItems: 'center', gap: '6px',
    padding: '6px 10px', borderRadius: '8px', border: '1px solid'
  },
  cardActionsRow: {
    display: 'flex', gap: '6px',
    borderTop: '1px solid var(--zl-creux)', paddingTop: '10px'
  },
  cardActionBtn: {
    flex: 1, display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '5px',
    padding: '8px', borderRadius: '8px', border: '1px solid var(--zl-trait)',
    background: 'var(--zl-creux)', color: 'var(--zl-douce)', cursor: 'pointer',
    fontWeight: '600', fontSize: '12px', fontFamily: 'inherit'
  },

  // Task Row (List)
  taskRow: {
    display: 'flex', alignItems: 'center', gap: '10px',
    padding: '10px 14px', background: 'var(--zl-surface)',
    borderRadius: '10px', border: '1px solid var(--zl-trait)'
  },
  rowCheck: { cursor: 'pointer', flexShrink: 0 },
  priorityDot: { width: 8, height: 8, borderRadius: 3, flexShrink: 0 },
  rowMain: { flex: 1, minWidth: 0 },
  rowTitle: { color: 'var(--zl-encre)', fontSize: '13px', fontWeight: '600' },
  rowMeta: { display: 'flex', alignItems: 'center', gap: '8px', marginTop: '3px' },
  rowActions: { display: 'flex', gap: '4px' },
  iconBtn: {
    width: 28, height: 28, borderRadius: 6,
    background: 'var(--zl-creux)', border: '1px solid var(--zl-trait)',
    color: 'var(--zl-faible)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center'
  },

  // Kanban
  kanbanContainer: { display: 'flex', gap: '10px', overflowX: 'auto', paddingBottom: '8px' },
  kanbanColumn: {
    minWidth: '240px', flex: 1, background: 'var(--zl-surface)',
    borderRadius: '12px', border: '1px solid var(--zl-trait)', transition: 'border-color 0.2s'
  },
  kanbanHeader: {
    padding: '12px', borderBottom: '1px solid var(--zl-trait)',
    borderLeft: '3px solid', display: 'flex', justifyContent: 'space-between', alignItems: 'center'
  },
  kanbanTitle: { color: 'var(--zl-encre)', fontSize: '13px', fontWeight: '700' },
  kanbanCount: {
    background: 'var(--zl-trait-fort)', padding: '2px 8px',
    borderRadius: '10px', fontSize: '11px', color: 'var(--zl-faible)'
  },
  kanbanCards: { padding: '8px', display: 'flex', flexDirection: 'column', gap: '6px', maxHeight: '500px', overflowY: 'auto' },
  kanbanCard: {
    padding: '10px', background: 'var(--zl-surface)',
    borderRadius: '10px', border: '1px solid var(--zl-trait)', cursor: 'grab'
  },
  kanbanCardHeader: { display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' },
  kanbanCardTitle: { color: 'var(--zl-encre)', fontSize: '12px', fontWeight: '600', flex: 1 },
  kanbanCardMeta: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '4px' },
  kanbanAssignee: { display: 'flex', alignItems: 'center', gap: '4px', fontSize: '11px', color: 'var(--zl-douce)' },
  kanbanCardActions: { display: 'flex', gap: '4px', marginTop: '8px' },
  kanbanActionBtn: {
    width: 24, height: 24, borderRadius: 6,
    background: 'var(--zl-trait)', border: '1px solid var(--zl-trait)',
    color: 'var(--zl-faible)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center'
  },
  kanbanEmpty: { padding: '20px', textAlign: 'center', color: 'var(--zl-faible)', fontSize: '12px' },

  // Categories Panel
  categoriesPanel: {
    background: 'var(--zl-surface)', borderRadius: '12px',
    border: '1px solid var(--zl-trait)', overflow: 'hidden'
  },
  categoriesPanelCollapsed: {
    display: 'flex', alignItems: 'center', gap: '8px',
    padding: '10px 12px', background: 'var(--zl-surface)',
    borderRadius: '12px', border: '1px solid var(--zl-trait)', cursor: 'pointer'
  },
  categoriesPanelHeader: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    padding: '12px', borderBottom: '1px solid var(--zl-trait)'
  },
  addCategoryBtn: {
    width: 24, height: 24, borderRadius: 6, background: 'var(--zl-cuivre-voile)',
    border: '1px solid var(--zl-cuivre-voile)', color: 'var(--zl-cuivre)', cursor: 'pointer',
    display: 'flex', alignItems: 'center', justifyContent: 'center'
  },
  collapseBtn: {
    width: 24, height: 24, borderRadius: 6, background: 'transparent',
    border: 'none', color: 'var(--zl-faible)', cursor: 'pointer',
    display: 'flex', alignItems: 'center', justifyContent: 'center'
  },
  categoriesList: { padding: '8px', display: 'flex', flexDirection: 'column', gap: '4px' },
  categoryItem: {
    display: 'flex', alignItems: 'center', gap: '8px',
    padding: '8px 10px', borderRadius: '8px', border: '1px solid',
    cursor: 'pointer', transition: 'all 0.15s ease'
  },
  editCategoryBtn: {
    background: 'transparent', border: 'none', color: 'var(--zl-faible)',
    cursor: 'pointer', padding: '2px', borderRadius: '4px',
    display: 'flex', alignItems: 'center', justifyContent: 'center'
  },

  // Empty State
  emptyState: {
    textAlign: 'center', padding: '48px 20px',
    background: 'var(--zl-surface)', borderRadius: '16px',
    border: '1px solid var(--zl-trait)'
  },
  emptyIcon: {
    width: 64, height: 64, borderRadius: 16,
    background: 'var(--zl-cuivre-voile)', display: 'flex', alignItems: 'center', justifyContent: 'center',
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
    width: '100%', maxWidth: '520px', background: 'var(--zl-fond-2)',
    border: '1px solid var(--zl-cuivre-voile)', borderRadius: '18px',
    overflow: 'hidden', boxShadow: '0 24px 80px rgba(0,0,0,0.6)',
    maxHeight: '90vh', display: 'flex', flexDirection: 'column'
  },
  modalHeader: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    padding: '16px 18px', borderBottom: '1px solid var(--zl-trait)'
  },
  modalTitle: { margin: 0, color: 'var(--zl-encre)', fontSize: '16px', fontWeight: '700' },
  modalCloseBtn: {
    width: 32, height: 32, borderRadius: 8,
    border: '1px solid var(--zl-trait-fort)', background: 'var(--zl-creux)',
    color: 'var(--zl-faible)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center'
  },
  modalBody: { padding: '18px', overflowY: 'auto', flex: 1 },
  modalActions: { display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: '10px', marginTop: '20px' },

  // Form
  formGrid: { display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '14px' },
  formGroup: { display: 'flex', flexDirection: 'column', gap: '6px' },
  label: {
    display: 'flex', alignItems: 'center', gap: '6px',
    fontSize: '11px', fontWeight: '700', color: 'var(--zl-faible)',
    textTransform: 'uppercase', letterSpacing: '0.5px'
  },
  input: {
    width: '100%', boxSizing: 'border-box', padding: '10px 12px', borderRadius: '10px',
    border: '1px solid var(--zl-trait)', background: 'var(--zl-creux)',
    color: 'var(--zl-encre)', outline: 'none', fontSize: '13px', fontFamily: 'inherit'
  },
  select: {
    width: '100%', boxSizing: 'border-box', padding: '10px 12px', borderRadius: '10px',
    border: '1px solid var(--zl-trait)', background: 'var(--zl-creux)',
    color: 'var(--zl-encre)', outline: 'none', fontSize: '13px', fontFamily: 'inherit', cursor: 'pointer'
  },
  colorPicker: { display: 'flex', gap: '8px', flexWrap: 'wrap' },
  categoryStats: {
    display: 'flex', flexDirection: 'column', gap: '8px',
    padding: '12px', background: 'var(--zl-creux)',
    borderRadius: '10px', border: '1px solid var(--zl-trait)', marginTop: '4px'
  },
  categoryStatItem: { display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: 'var(--zl-douce)' },

  // Task Modal spécifiques
  workloadAlert: {
    display: 'flex', alignItems: 'flex-start', gap: '10px',
    padding: '12px', borderRadius: '10px', border: '1px solid',
    marginBottom: '14px'
  },
  workloadAlertContent: { flex: 1 },
  workloadWarningItem: { color: 'var(--zl-douce)', fontSize: '12px', lineHeight: '1.5' },
  suggestBtn: {
    display: 'flex', alignItems: 'center', gap: '4px',
    padding: '3px 8px', background: 'var(--zl-cuivre-voile)',
    border: '1px solid var(--zl-cuivre-voile)', borderRadius: '6px',
    color: 'var(--zl-cuivre)', fontSize: '10px', fontWeight: '600', cursor: 'pointer',
    marginLeft: '8px'
  },
  suggestionsDropdown: {
    marginTop: '6px', background: 'var(--zl-fond-2)', border: '1px solid var(--zl-cuivre-voile)',
    borderRadius: '10px', overflow: 'hidden', boxShadow: '0 8px 30px rgba(0,0,0,0.4)'
  },
  suggestionsHeader: {
    display: 'flex', alignItems: 'center', gap: '8px',
    padding: '8px 12px', borderBottom: '1px solid var(--zl-trait)',
    fontSize: '12px', color: 'var(--zl-cuivre)', fontWeight: '700'
  },
  closeSuggestBtn: {
    marginLeft: 'auto', background: 'transparent', border: 'none',
    color: 'var(--zl-faible)', cursor: 'pointer', display: 'flex', alignItems: 'center'
  },
  suggestionItem: {
    padding: '10px 12px', cursor: 'pointer', borderBottom: '1px solid var(--zl-creux)',
    transition: 'background 0.15s'
  },
  suggestionMain: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' },
  suggestionName: { color: 'var(--zl-encre)', fontSize: '13px', fontWeight: '600' },
  suggestionScore: {
    background: 'var(--zl-teal-voile)', color: 'var(--zl-teal)',
    padding: '2px 8px', borderRadius: '8px', fontSize: '11px', fontWeight: '700'
  },
  suggestionFactors: { display: 'flex', gap: '4px', flexWrap: 'wrap' },
  factorChip: {
    padding: '2px 6px', background: 'var(--zl-trait)',
    borderRadius: '6px', fontSize: '10px'
  },
  predictionHint: {
    display: 'flex', alignItems: 'center', gap: '6px',
    marginTop: '6px', padding: '6px 10px', background: 'var(--zl-cuivre-voile)',
    border: '1px solid var(--zl-cuivre-voile)', borderRadius: '8px',
    fontSize: '11px', color: 'var(--zl-douce)', flexWrap: 'wrap'
  },
  applyPredictionBtn: {
    marginLeft: 'auto', padding: '3px 8px', background: 'var(--zl-cuivre-voile)',
    border: '1px solid var(--zl-cuivre-voile)', borderRadius: '6px',
    color: 'var(--zl-cuivre)', fontSize: '10px', fontWeight: '600', cursor: 'pointer'
  },
  settingsBox: {
    marginTop: '16px', padding: '14px', borderRadius: '12px',
    background: 'var(--zl-cuivre-voile)', border: '1px solid var(--zl-cuivre-voile)'
  },
  sectionTitle: {
    margin: '0 0 12px', color: 'var(--zl-encre)', fontSize: '12px', fontWeight: '700',
    display: 'flex', alignItems: 'center', gap: '6px'
  },
  checkboxGrid: { display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '8px' },
  checkboxItem: {
    display: 'flex', alignItems: 'center', gap: '8px',
    color: 'var(--zl-douce)', fontSize: '12px', cursor: 'pointer',
    padding: '7px 10px', borderRadius: '8px',
    background: 'var(--zl-creux)', border: '1px solid var(--zl-creux)'
  },

  // Shortcuts
  shortcutRow: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    padding: '8px 0', borderBottom: '1px solid var(--zl-creux)'
  },
  kbd: {
    padding: '4px 10px', background: 'var(--zl-cuivre-voile)',
    border: '1px solid var(--zl-cuivre-voile)', borderRadius: '6px',
    color: 'var(--zl-cuivre)', fontSize: '12px', fontWeight: '700', fontFamily: 'monospace'
  },

  // Skeleton
  skeletonCard: {
    background: 'var(--zl-surface)', borderRadius: '14px',
    border: '1px solid var(--zl-trait)', padding: '14px'
  },
  skeletonHeader: { display: 'flex', alignItems: 'center', gap: '10px' },
  skeletonCircle: {
    borderRadius: '10px',
    background: 'linear-gradient(90deg, var(--zl-creux) 25%, var(--zl-trait) 50%, var(--zl-creux) 75%)',
    backgroundSize: '200% 100%', animation: 'shimmer 1.5s infinite'
  },
  skeletonLine: {
    height: 14, borderRadius: '6px',
    background: 'linear-gradient(90deg, var(--zl-creux) 25%, var(--zl-trait) 50%, var(--zl-creux) 75%)',
    backgroundSize: '200% 100%', animation: 'shimmer 1.5s infinite'
  },

  // Buttons
  btnPrimary: {
    display: 'inline-flex', alignItems: 'center', gap: '6px',
    padding: '10px 18px', borderRadius: '10px', border: 'none',
    background: 'linear-gradient(135deg, var(--zl-cuivre), var(--zl-cuivre-fort))',
    color: 'var(--zl-sur-cuivre)', fontWeight: '700', fontSize: '13px', cursor: 'pointer', fontFamily: 'inherit'
  },
  btnSecondary: {
    display: 'inline-flex', alignItems: 'center', gap: '6px',
    padding: '10px 16px', borderRadius: '10px',
    border: '1px solid var(--zl-trait)', background: 'var(--zl-creux)',
    color: 'var(--zl-douce)', fontWeight: '600', fontSize: '13px', cursor: 'pointer', fontFamily: 'inherit'
  },
  btnDanger: {
    display: 'inline-flex', alignItems: 'center', gap: '6px',
    padding: '10px 18px', borderRadius: '10px', border: 'none',
    background: 'linear-gradient(135deg, var(--zl-corail), var(--zl-corail-fort))',
    color: 'var(--zl-encre)', fontWeight: '700', fontSize: '13px', cursor: 'pointer', fontFamily: 'inherit'
  },
}
