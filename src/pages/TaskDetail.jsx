// src/pages/TaskDetail.jsx
// ═══════════════════════════════════════════════════════════
// 📋 DÉTAIL D'UNE TÂCHE - ADMIN
// UX refonte + fond sombre cohérent + skeleton loading
// + commentaires visibles côté employé
// + pièces jointes catégorisées
// ═══════════════════════════════════════════════════════════

import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import {
  ArrowLeft,
  ClipboardList,
  Calendar,
  Clock,
  User,
  Users,
  ShieldCheck,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  RefreshCw,
  MessageSquare,
  Paperclip,
  FileText,
  Image as ImageIcon,
  Camera,
  History,
  TimerReset,
  Edit3,
  X,
  Loader2,
  Eye,
  Play,
  Flag,
  Zap,
  ChevronDown,
  ChevronUp,
  Send,
  Download,
} from 'lucide-react'
import toast from 'react-hot-toast'

import {
  getTaskById,
  validateTask,
  rejectTask,
  reassignRejectedTask,
  addTaskComment,
  formatDuration,
  getStatusColor,
  getStatusLabel,
  getPriorityColor,
  getPriorityLabel,
  getDeadlineStatus,
} from '../services/taskService'

// ═══════════════════════════════════════════════════════════
// SKELETON
// ═══════════════════════════════════════════════════════════
function TaskDetailSkeleton() {
  const shimmer = {
    background:
      'linear-gradient(90deg, rgba(255,255,255,0.03) 25%, rgba(255,255,255,0.06) 50%, rgba(255,255,255,0.03) 75%)',
    backgroundSize: '200% 100%',
    animation: 'shimmer 1.5s infinite',
    borderRadius: 8,
  }

  return (
    <div style={S.page}>
      <div style={S.bgPattern} />
      <div style={S.container}>
        <div style={S.topBar}>
          <div style={{ ...shimmer, width: 110, height: 36 }} />
          <div style={{ display: 'flex', gap: 6 }}>
            <div style={{ ...shimmer, width: 36, height: 36 }} />
            <div style={{ ...shimmer, width: 36, height: 36 }} />
          </div>
        </div>

        <div style={S.heroCard}>
          <div style={{ display: 'flex', gap: 14, alignItems: 'flex-start' }}>
            <div style={{ ...shimmer, width: 42, height: 42, borderRadius: 12 }} />
            <div style={{ flex: 1 }}>
              <div style={{ display: 'flex', gap: 6, marginBottom: 10, flexWrap: 'wrap' }}>
                <div style={{ ...shimmer, width: 70, height: 22, borderRadius: 12 }} />
                <div style={{ ...shimmer, width: 62, height: 22, borderRadius: 12 }} />
                <div style={{ ...shimmer, width: 84, height: 22, borderRadius: 12 }} />
              </div>
              <div style={{ ...shimmer, width: '72%', height: 24, marginBottom: 8 }} />
              <div style={{ ...shimmer, width: '52%', height: 14 }} />
            </div>
          </div>
        </div>

        <div style={S.grid}>
          <div style={S.mainCol}>
            <div style={{ ...S.card, padding: 16 }}>
              <div style={{ ...shimmer, width: 150, height: 16, marginBottom: 14 }} />
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                {[...Array(6)].map((_, i) => (
                  <div key={i} style={{ ...shimmer, height: 58, borderRadius: 10 }} />
                ))}
              </div>
            </div>

            <div style={{ ...S.card, padding: 16 }}>
              <div style={{ ...shimmer, width: 120, height: 16, marginBottom: 14 }} />
              <div style={{ ...shimmer, height: 62, marginBottom: 10 }} />
              <div style={{ ...shimmer, height: 46 }} />
            </div>
          </div>

          <div style={S.sideCol}>
            {[...Array(3)].map((_, i) => (
              <div key={i} style={{ ...S.card, padding: 16 }}>
                <div style={{ ...shimmer, width: 110, height: 14, marginBottom: 12 }} />
                <div style={{ ...shimmer, height: 42 }} />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════
// PETITS COMPOSANTS
// ═══════════════════════════════════════════════════════════
function Badge({ text, color, bg }) {
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 4,
        padding: '4px 9px',
        borderRadius: 999,
        fontSize: 10,
        fontWeight: 700,
        color,
        background: bg,
        border: `1px solid ${color}20`,
        letterSpacing: '0.3px',
      }}
    >
      {text}
    </span>
  )
}

function PersonMini({ person, fallbackColor = '#F59E0B' }) {
  if (!person) return null

  const initials = `${person.first_name?.[0] || ''}${person.last_name?.[0] || ''}`.toUpperCase()

  return (
    <div style={S.personMini}>
      <div
        style={{
          ...S.avatar,
          borderColor: `${fallbackColor}35`,
          color: fallbackColor,
        }}
      >
        {person.photo_url ? (
          <img src={person.photo_url} alt="" style={S.avatarImg} />
        ) : (
          <span>{initials || '?'}</span>
        )}
      </div>
      <div>
        <div style={S.personName}>
          {person.first_name} {person.last_name}
        </div>
        {person.position && <div style={S.personSub}>{person.position}</div>}
      </div>
    </div>
  )
}

function InfoCell({ icon: Icon, label, value, color = '#888' }) {
  return (
    <div style={S.infoCell}>
      <div style={S.infoCellLabel}>
        <Icon size={12} color={color} />
        <span>{label}</span>
      </div>
      <div style={S.infoCellValue}>{value || '—'}</div>
    </div>
  )
}

function SectionCard({ title, icon: Icon, children, accent, collapsed: defaultCollapsed = false }) {
  const [collapsed, setCollapsed] = useState(defaultCollapsed)

  return (
    <div
      style={{
        ...S.card,
        ...(accent
          ? {
              borderColor: `${accent}20`,
              background: `${accent}08`,
            }
          : {}),
      }}
    >
      <div style={S.cardHead} onClick={() => setCollapsed(!collapsed)}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
          {Icon && <Icon size={14} color={accent || '#F59E0B'} />}
          <h3 style={{ ...S.cardTitle, ...(accent ? { color: accent } : {}) }}>{title}</h3>
        </div>
        <button style={S.collapseBtn}>
          {collapsed ? <ChevronDown size={14} /> : <ChevronUp size={14} />}
        </button>
      </div>

      {!collapsed && <div style={S.cardBody}>{children}</div>}
    </div>
  )
}

// ═══════════════════════════════════════════════════════════
// MODAL REJET
// ═══════════════════════════════════════════════════════════
function RejectModal({ open, onClose, onConfirm, loading }) {
  const [reason, setReason] = useState('')

  useEffect(() => {
    if (open) setReason('')
  }, [open])

  if (!open) return null

  const handleSubmit = (e) => {
    e.preventDefault()
    if (!reason.trim()) {
      toast.error('Le motif de rejet est requis')
      return
    }
    onConfirm(reason.trim())
  }

  return (
    <div style={S.overlay} onClick={onClose}>
      <div style={S.modal} onClick={(e) => e.stopPropagation()}>
        <div style={S.modalHead}>
          <h3 style={S.modalTitle}>Rejeter la tâche</h3>
          <button onClick={onClose} style={S.modalX}>
            <X size={16} />
          </button>
        </div>

        <form onSubmit={handleSubmit} style={S.modalBody}>
          <div style={S.field}>
            <label style={S.label}>Motif du rejet *</label>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={4}
              style={S.textarea}
              placeholder="Expliquez pourquoi la tâche est rejetée..."
            />
          </div>

          <div style={S.modalActions}>
            <button type="button" onClick={onClose} style={S.btnSec}>
              Annuler
            </button>
            <button type="submit" style={S.btnDanger} disabled={loading}>
              {loading ? <Loader2 size={14} className="spin" /> : <XCircle size={14} />}
              <span>Rejeter</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════
// MODAL RÉASSIGNATION
// ═══════════════════════════════════════════════════════════
function ReassignModal({ open, onClose, onConfirm, loading, employees = [] }) {
  const [employeeId, setEmployeeId] = useState('')
  const [dueAt, setDueAt] = useState('')
  const [comment, setComment] = useState('')

  useEffect(() => {
    if (open) {
      setEmployeeId('')
      setDueAt('')
      setComment('')
    }
  }, [open])

  if (!open) return null

  const handleSubmit = (e) => {
    e.preventDefault()
    onConfirm({
      new_employee_id: employeeId || null,
      new_due_at: dueAt || null,
      comment: comment || null,
    })
  }

  return (
    <div style={S.overlay} onClick={onClose}>
      <div style={S.modal} onClick={(e) => e.stopPropagation()}>
        <div style={S.modalHead}>
          <h3 style={S.modalTitle}>Réassigner la tâche</h3>
          <button onClick={onClose} style={S.modalX}>
            <X size={16} />
          </button>
        </div>

        <form onSubmit={handleSubmit} style={S.modalBody}>
          <div style={S.field}>
            <label style={S.label}>Nouvel employé</label>
            <select value={employeeId} onChange={(e) => setEmployeeId(e.target.value)} style={S.select}>
              <option value="">Garder l’employé actuel</option>
              {employees.map((emp) => (
                <option key={emp.id} value={emp.id}>
                  {emp.first_name} {emp.last_name}
                </option>
              ))}
            </select>
          </div>

          <div style={S.field}>
            <label style={S.label}>Nouvelle deadline</label>
            <input type="datetime-local" value={dueAt} onChange={(e) => setDueAt(e.target.value)} style={S.input} />
          </div>

          <div style={S.field}>
            <label style={S.label}>Commentaire admin</label>
            <textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              rows={3}
              style={S.textarea}
              placeholder="Message de réassignation..."
            />
          </div>

          <div style={S.modalActions}>
            <button type="button" onClick={onClose} style={S.btnSec}>
              Annuler
            </button>
            <button type="submit" style={S.btnPri} disabled={loading}>
              {loading ? <Loader2 size={14} className="spin" /> : <TimerReset size={14} />}
              <span>Réassigner</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════
// PAGE PRINCIPALE
// ═══════════════════════════════════════════════════════════
export default function TaskDetail() {
  const { taskId } = useParams()
  const navigate = useNavigate()

  const [task, setTask] = useState(null)
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState(false)
  const [commentText, setCommentText] = useState('')
  const [showRejectModal, setShowRejectModal] = useState(false)
  const [showReassignModal, setShowReassignModal] = useState(false)
  const [employees, setEmployees] = useState([])

  const admin = useMemo(() => {
    try {
      return JSON.parse(localStorage.getItem('admin') || '{}')
    } catch {
      return {}
    }
  }, [])

  const loadTask = async () => {
    setLoading(true)
    try {
      const { data, error } = await getTaskById(taskId)
      if (error) throw error
      setTask(data)
    } catch (error) {
      console.error(error)
      toast.error('Impossible de charger la tâche')
      navigate('/taches')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadTask()
  }, [taskId])

  useEffect(() => {
    const loadEmployees = async () => {
      try {
        if (!task?.enterprise_id) return
        const { supabase } = await import('../lib/supabase')
        const { data } = await supabase
          .from('employees')
          .select('id, first_name, last_name')
          .eq('enterprise_id', task.enterprise_id)
          .eq('is_active', true)
          .order('first_name')

        setEmployees(data || [])
      } catch (error) {
        console.error(error)
      }
    }

    loadEmployees()
  }, [task?.enterprise_id])

  const deadline = useMemo(() => {
    if (!task?.due_at) return null
    return getDeadlineStatus(task.due_at)
  }, [task])

  const formatDate = (value) =>
    value
      ? new Date(value).toLocaleString('fr-FR', {
          day: '2-digit',
          month: 'short',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
        })
      : null

  const handleValidate = async () => {
    setActionLoading(true)
    try {
      const { error } = await validateTask(task.id, admin.id, '✅ Tâche validée par l’administrateur')
      if (error) throw error
      toast.success('Tâche validée')
      await loadTask()
    } catch (error) {
      console.error(error)
      toast.error(error.message || 'Erreur de validation')
    } finally {
      setActionLoading(false)
    }
  }

  const handleReject = async (reason) => {
    setActionLoading(true)
    try {
      const { error } = await rejectTask(task.id, admin.id, reason)
      if (error) throw error
      toast.success('Tâche rejetée')
      setShowRejectModal(false)
      await loadTask()
    } catch (error) {
      console.error(error)
      toast.error(error.message || 'Erreur de rejet')
    } finally {
      setActionLoading(false)
    }
  }

  const handleReassign = async (payload) => {
    setActionLoading(true)
    try {
      const { error } = await reassignRejectedTask(task.id, admin.id, payload)
      if (error) throw error
      toast.success('Tâche réassignée')
      setShowReassignModal(false)
      await loadTask()
    } catch (error) {
      console.error(error)
      toast.error(error.message || 'Erreur de réassignation')
    } finally {
      setActionLoading(false)
    }
  }

  const handleAddComment = async () => {
    if (!commentText.trim()) {
      toast.error('Le commentaire est vide')
      return
    }

    setActionLoading(true)
    try {
      const { error } = await addTaskComment(task.id, admin.id, 'admin', commentText.trim())
      if (error) throw error
      toast.success('Commentaire ajouté')
      setCommentText('')
      await loadTask()
    } catch (error) {
      console.error(error)
      toast.error(error.message || 'Erreur lors de l’ajout du commentaire')
    } finally {
      setActionLoading(false)
    }
  }

  if (loading) {
    return (
      <>
        <style>{`
          @keyframes shimmer {
            0% { background-position: -200% 0; }
            100% { background-position: 200% 0; }
          }
        `}</style>
        <TaskDetailSkeleton />
      </>
    )
  }

  if (!task) return null

  const statusColor = getStatusColor(task.status)
  const priorityColor = getPriorityColor(task.priority)

  const adminComments = (task.comments || []).filter(c => c.author_type === 'admin')
  const employeeComments = (task.comments || []).filter(c => c.author_type === 'employee')

  return (
    <>
      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        .spin { animation: spin 1s linear infinite; }

        @media (max-width: 900px) {
          .task-grid {
            grid-template-columns: 1fr !important;
          }
        }

        @media (max-width: 600px) {
          .task-container {
            padding: 10px !important;
          }

          .hero-actions-row {
            flex-direction: column !important;
          }

          .hero-actions-row button {
            width: 100% !important;
            justify-content: center !important;
          }

          .info-grid-2 {
            grid-template-columns: 1fr !important;
          }

          .comment-composer {
            flex-direction: column !important;
          }

          .comment-composer button {
            width: 100% !important;
            justify-content: center !important;
          }
        }
      `}</style>

      <div style={S.page}>
        <div style={S.bgPattern} />

        <div className="task-container" style={S.container}>
          {/* TOP BAR */}
          <div style={S.topBar}>
            <button onClick={() => navigate('/taches')} style={S.backBtn}>
              <ArrowLeft size={16} />
              <span>Retour</span>
            </button>

            <div style={{ display: 'flex', gap: 6 }}>
              <button onClick={loadTask} style={S.iconBtnH} title="Rafraîchir">
                <RefreshCw size={14} />
              </button>
              <button onClick={() => navigate(`/taches?edit=${task.id}`)} style={S.iconBtnH} title="Modifier">
                <Edit3 size={14} />
              </button>
            </div>
          </div>

          {/* HERO */}
          <div style={S.heroCard}>
            <div style={S.heroTop}>
              <div style={S.heroLeft}>
                <div style={S.heroIcon}>
                  <ClipboardList size={20} color="#F59E0B" />
                </div>

                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={S.heroBadges}>
                    <Badge text={getStatusLabel(task.status)} color={statusColor} bg={`${statusColor}16`} />
                    <Badge text={getPriorityLabel(task.priority)} color={priorityColor} bg={`${priorityColor}16`} />
                    <Badge
                      text={task.task_type === 'team' ? 'Équipe' : 'Individuelle'}
                      color={task.task_type === 'team' ? '#8B5CF6' : '#10B981'}
                      bg={task.task_type === 'team' ? 'rgba(139,92,246,0.12)' : 'rgba(16,185,129,0.12)'}
                    />
                  </div>

                  <h1 style={S.taskTitle}>{task.title}</h1>
                  {task.description && <p style={S.taskDescription}>{task.description}</p>}
                </div>
              </div>

              <div className="hero-actions-row" style={S.heroActions}>
                {task.status === 'completed' && (
                  <>
                    <button onClick={handleValidate} style={S.validateBtn} disabled={actionLoading}>
                      {actionLoading ? <Loader2 size={14} className="spin" /> : <CheckCircle2 size={14} />}
                      <span>Valider</span>
                    </button>

                    <button onClick={() => setShowRejectModal(true)} style={S.rejectBtn} disabled={actionLoading}>
                      <XCircle size={14} />
                      <span>Rejeter</span>
                    </button>
                  </>
                )}

                {task.status === 'rejected' && (
                  <button onClick={() => setShowReassignModal(true)} style={S.reassignBtn} disabled={actionLoading}>
                    <TimerReset size={14} />
                    <span>Réassigner</span>
                  </button>
                )}
              </div>
            </div>

            {deadline && (
              <div
                style={{
                  ...S.deadlineBanner,
                  borderColor: deadline.overdue ? 'rgba(239,68,68,0.22)' : 'rgba(245,158,11,0.16)',
                  background: deadline.overdue ? 'rgba(239,68,68,0.08)' : 'rgba(245,158,11,0.08)',
                }}
              >
                {deadline.overdue ? <AlertTriangle size={13} color="#EF4444" /> : <Clock size={13} color="#F59E0B" />}
                <span
                  style={{
                    color: deadline.overdue ? '#EF4444' : '#F59E0B',
                    fontWeight: 700,
                    fontSize: 12,
                  }}
                >
                  {deadline.text}
                </span>
              </div>
            )}

            <div style={S.heroMetaRow}>
              {task.task_type === 'individual' ? (
                task.assigned_employee ? (
                  <div style={S.metaChip}>
                    <User size={11} color="#10B981" />
                    <PersonMini person={task.assigned_employee} fallbackColor="#10B981" />
                  </div>
                ) : (
                  <div style={S.metaChip}>
                    <User size={11} color="#888" />
                    <span style={{ color: '#888', fontSize: 12 }}>Aucun employé assigné</span>
                  </div>
                )
              ) : (
                <div style={S.metaChip}>
                  <Users size={11} color="#8B5CF6" />
                  <span style={{ color: '#FFF', fontSize: 12, fontWeight: 600 }}>{task.team?.name || 'Équipe'}</span>
                </div>
              )}

              {task.created_by_admin && (
                <div style={S.metaChip}>
                  <ShieldCheck size={11} color="#F59E0B" />
                  <span style={{ color: '#888', fontSize: 11 }}>Créée par</span>
                  <span style={{ color: '#FFF', fontSize: 12, fontWeight: 600 }}>
                    {task.created_by_admin.first_name} {task.created_by_admin.last_name}
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* GRID */}
          <div className="task-grid" style={S.grid}>
            {/* MAIN */}
            <div style={S.mainCol}>
              <SectionCard title="Informations" icon={ClipboardList}>
                <div className="info-grid-2" style={S.infoGrid}>
                  <InfoCell icon={Calendar} label="Deadline" value={formatDate(task.due_at)} color="#F59E0B" />
                  <InfoCell
                    icon={Clock}
                    label="Durée prévue"
                    value={task.expected_duration_minutes ? `${task.expected_duration_minutes} min` : null}
                    color="#6366F1"
                  />
                  <InfoCell
                    icon={Clock}
                    label="Durée réelle"
                    value={formatDuration(task.actual_duration_seconds)}
                    color="#10B981"
                  />
                  <InfoCell
                    icon={Zap}
                    label="Performance"
                    value={task.performance_score != null ? `${task.performance_score}%` : null}
                    color="#F59E0B"
                  />
                  <InfoCell icon={Eye} label="Vue le" value={formatDate(task.seen_at)} />
                  <InfoCell icon={Play} label="Démarrée le" value={formatDate(task.started_at)} />
                  <InfoCell icon={CheckCircle2} label="Terminée le" value={formatDate(task.completed_at)} color="#10B981" />
                  <InfoCell icon={Calendar} label="Créée le" value={formatDate(task.created_at)} />
                </div>
              </SectionCard>

              {task.rejection_reason && (
                <SectionCard title="Motif de rejet" icon={XCircle} accent="#EF4444">
                  <p style={{ margin: 0, color: '#f1b0b0', lineHeight: 1.5, fontSize: 13 }}>
                    {task.rejection_reason}
                  </p>
                </SectionCard>
              )}

              <SectionCard
                title={`Commentaires${task.comments?.length ? ` (${task.comments.length})` : ''}`}
                icon={MessageSquare}
              >
                <div className="comment-composer" style={S.commentComposer}>
                  <textarea
                    value={commentText}
                    onChange={(e) => setCommentText(e.target.value)}
                    rows={2}
                    style={S.textarea}
                    placeholder="Ajouter un commentaire admin..."
                  />
                  <button onClick={handleAddComment} style={S.sendBtn} disabled={actionLoading || !commentText.trim()}>
                    {actionLoading ? <Loader2 size={13} className="spin" /> : <Send size={13} />}
                    <span>Envoyer</span>
                  </button>
                </div>

                <div style={S.commentSectionTitle}>Commentaires admin</div>
                <div style={S.commentList}>
                  {adminComments.length ? (
                    adminComments.map((comment) => (
                      <div key={comment.id} style={S.commentItemAdmin}>
                        <div style={S.commentHead}>
                          <Badge
                            text="Admin"
                            color="#F59E0B"
                            bg="rgba(245,158,11,0.12)"
                          />
                          <span style={S.commentDate}>
                            {new Date(comment.created_at).toLocaleString('fr-FR', {
                              day: '2-digit',
                              month: 'short',
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </span>
                        </div>
                        <p style={S.commentText}>{comment.comment}</p>
                      </div>
                    ))
                  ) : (
                    <div style={S.emptyBox}>Aucun commentaire admin</div>
                  )}
                </div>

                <div style={{ ...S.commentSectionTitle, marginTop: 14 }}>Commentaires employé</div>
                <div style={S.commentList}>
                  {employeeComments.length ? (
                    employeeComments.map((comment) => (
                      <div key={comment.id} style={S.commentItemEmployee}>
                        <div style={S.commentHead}>
                          <Badge
                            text="Employé"
                            color="#10B981"
                            bg="rgba(16,185,129,0.12)"
                          />
                          <span style={S.commentDate}>
                            {new Date(comment.created_at).toLocaleString('fr-FR', {
                              day: '2-digit',
                              month: 'short',
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </span>
                        </div>
                        <p style={S.commentText}>{comment.comment}</p>
                      </div>
                    ))
                  ) : (
                    <div style={S.emptyBox}>Aucun commentaire employé</div>
                  )}
                </div>
              </SectionCard>

              <SectionCard title="Historique" icon={History} collapsed={true}>
                <div style={S.timeline}>
                  {task.activity_logs?.length ? (
                    task.activity_logs.map((log) => (
                      <div key={log.id} style={S.timelineItem}>
                        <div style={S.timelineDot} />
                        <div style={S.timelineContent}>
                          <div style={S.timelineAction}>{log.action}</div>
                          <div style={S.timelineMeta}>
                            {log.actor_type} •{' '}
                            {new Date(log.created_at).toLocaleString('fr-FR', {
                              day: '2-digit',
                              month: 'short',
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </div>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div style={S.emptyBox}>Aucune activité enregistrée</div>
                  )}
                </div>
              </SectionCard>
            </div>

            {/* SIDE */}
            <div style={S.sideCol}>
              {task.validated_by_admin && (
                <SectionCard title="Traitement" icon={ShieldCheck}>
                  <PersonMini person={task.validated_by_admin} fallbackColor="#6366F1" />
                </SectionCard>
              )}

              <SectionCard
                title={`Pièces jointes${task.attachments?.length ? ` (${task.attachments.length})` : ''}`}
                icon={Paperclip}
              >
                <div style={S.attachmentList}>
                  {task.attachments?.length ? (
                    task.attachments.map((file) => (
                      <a
                        key={file.id}
                        href={file.file_url}
                        target="_blank"
                        rel="noreferrer"
                        style={S.attachmentItem}
                      >
                        <div style={S.attachmentIcon}>
                          {file.file_type === 'image' && <ImageIcon size={14} color="#10B981" />}
                          {file.file_type === 'camera_photo' && <Camera size={14} color="#F59E0B" />}
                          {file.file_type === 'document' && <FileText size={14} color="#6366F1" />}
                          {!['image', 'camera_photo', 'document'].includes(file.file_type) && (
                            <Paperclip size={14} color="#888" />
                          )}
                        </div>

                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={S.attachmentName}>{file.file_name || 'Fichier'}</div>
                          <div style={S.attachmentMeta}>
                            {file.file_type === 'camera_photo'
                              ? 'Photo caméra'
                              : file.file_type === 'image'
                                ? 'Image'
                                : file.file_type === 'document'
                                  ? 'Document'
                                  : file.file_type}
                            {' • '}
                            {new Date(file.uploaded_at).toLocaleString('fr-FR', {
                              day: '2-digit',
                              month: 'short',
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </div>
                        </div>

                        <Download size={14} color="#888" />
                      </a>
                    ))
                  ) : (
                    <div style={S.emptyBox}>Aucune pièce jointe</div>
                  )}
                </div>
              </SectionCard>

              <SectionCard title="Exigences" icon={Flag} collapsed={true}>
                <div style={S.requirementsList}>
                  <div style={S.requirementRow}>
                    <span style={S.smallLabelInline}>Preuve requise</span>
                    <span style={S.booleanValue(task.requires_proof)}>{task.requires_proof ? 'Oui' : 'Non'}</span>
                  </div>

                  <div style={S.requirementRow}>
                    <span style={S.smallLabelInline}>Commentaire requis</span>
                    <span style={S.booleanValue(task.requires_comment)}>{task.requires_comment ? 'Oui' : 'Non'}</span>
                  </div>

                  <div style={S.requirementRow}>
                    <span style={S.smallLabelInline}>Image autorisée</span>
                    <span style={S.booleanValue(task.allow_image)}>{task.allow_image ? 'Oui' : 'Non'}</span>
                  </div>

                  <div style={S.requirementRow}>
                    <span style={S.smallLabelInline}>Document autorisé</span>
                    <span style={S.booleanValue(task.allow_document)}>{task.allow_document ? 'Oui' : 'Non'}</span>
                  </div>

                  <div style={S.requirementRow}>
                    <span style={S.smallLabelInline}>Photo caméra</span>
                    <span style={S.booleanValue(task.allow_camera_photo)}>
                      {task.allow_camera_photo ? 'Oui' : 'Non'}
                    </span>
                  </div>
                </div>
              </SectionCard>
            </div>
          </div>
        </div>
      </div>

      <RejectModal
        open={showRejectModal}
        onClose={() => setShowRejectModal(false)}
        onConfirm={handleReject}
        loading={actionLoading}
      />

      <ReassignModal
        open={showReassignModal}
        onClose={() => setShowReassignModal(false)}
        onConfirm={handleReassign}
        loading={actionLoading}
        employees={employees}
      />
    </>
  )
}

// ═══════════════════════════════════════════════════════════
// STYLES
// ═══════════════════════════════════════════════════════════
const S = {
  page: {
    minHeight: '100vh',
    background: '#0A0A0F',
    position: 'relative',
  },

  bgPattern: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    pointerEvents: 'none',
    zIndex: 0,
    backgroundImage: `
      radial-gradient(circle at 15% 50%, rgba(245,158,11,0.03) 0%, transparent 50%),
      radial-gradient(circle at 85% 20%, rgba(99,102,241,0.03) 0%, transparent 50%)
    `,
  },

  container: {
    padding: 'clamp(12px, 2.5vw, 22px)',
    maxWidth: 1200,
    margin: '0 auto',
    display: 'flex',
    flexDirection: 'column',
    gap: 10,
    position: 'relative',
    zIndex: 1,
  },

  topBar: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 8,
  },

  backBtn: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
    padding: '8px 12px',
    borderRadius: 9,
    border: '1px solid rgba(255,255,255,0.08)',
    background: 'rgba(255,255,255,0.04)',
    color: '#ccc',
    cursor: 'pointer',
    fontWeight: 600,
    fontSize: 12,
    fontFamily: 'inherit',
  },

  iconBtnH: {
    width: 34,
    height: 34,
    borderRadius: 9,
    border: '1px solid rgba(255,255,255,0.08)',
    background: 'rgba(255,255,255,0.04)',
    color: '#aaa',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
  },

  heroCard: {
    background: 'rgba(15,15,25,0.85)',
    border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: 14,
    padding: 'clamp(12px, 2vw, 18px)',
    display: 'flex',
    flexDirection: 'column',
    gap: 10,
  },

  heroTop: {
    display: 'flex',
    justifyContent: 'space-between',
    gap: 14,
    flexWrap: 'wrap',
    alignItems: 'flex-start',
  },

  heroLeft: {
    display: 'flex',
    gap: 12,
    flex: 1,
    minWidth: 240,
  },

  heroIcon: {
    width: 42,
    height: 42,
    borderRadius: 12,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'rgba(245,158,11,0.1)',
    border: '1px solid rgba(245,158,11,0.2)',
    flexShrink: 0,
  },

  heroBadges: {
    display: 'flex',
    gap: 5,
    flexWrap: 'wrap',
    marginBottom: 7,
  },

  taskTitle: {
    margin: 0,
    color: '#FFF',
    fontSize: 'clamp(17px, 2.5vw, 22px)',
    fontWeight: 800,
    lineHeight: 1.2,
  },

  taskDescription: {
    margin: '4px 0 0',
    color: '#999',
    fontSize: 13,
    lineHeight: 1.5,
  },

  heroActions: {
    display: 'flex',
    gap: 6,
    flexWrap: 'wrap',
    alignItems: 'flex-start',
  },

  validateBtn: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
    padding: '8px 14px',
    borderRadius: 9,
    border: 'none',
    background: 'linear-gradient(135deg, #10B981, #059669)',
    color: '#FFF',
    fontWeight: 700,
    fontSize: 12,
    cursor: 'pointer',
    fontFamily: 'inherit',
  },

  rejectBtn: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
    padding: '8px 14px',
    borderRadius: 9,
    border: 'none',
    background: 'linear-gradient(135deg, #EF4444, #DC2626)',
    color: '#FFF',
    fontWeight: 700,
    fontSize: 12,
    cursor: 'pointer',
    fontFamily: 'inherit',
  },

  reassignBtn: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
    padding: '8px 14px',
    borderRadius: 9,
    border: 'none',
    background: 'linear-gradient(135deg, #6366F1, #4F46E5)',
    color: '#FFF',
    fontWeight: 700,
    fontSize: 12,
    cursor: 'pointer',
    fontFamily: 'inherit',
  },

  deadlineBanner: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 7,
    padding: '7px 12px',
    borderRadius: 9,
    border: '1px solid',
    alignSelf: 'flex-start',
  },

  heroMetaRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    flexWrap: 'wrap',
    paddingTop: 8,
    borderTop: '1px solid rgba(255,255,255,0.06)',
  },

  metaChip: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    padding: '4px 10px',
    borderRadius: 8,
    background: 'rgba(255,255,255,0.03)',
    border: '1px solid rgba(255,255,255,0.06)',
  },

  grid: {
    display: 'grid',
    gridTemplateColumns: '1fr 300px',
    gap: 10,
    alignItems: 'start',
  },

  mainCol: {
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
  },

  sideCol: {
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
  },

  card: {
    background: 'rgba(15,15,25,0.82)',
    border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: 12,
    overflow: 'hidden',
  },

  cardHead: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '10px 14px',
    borderBottom: '1px solid rgba(255,255,255,0.05)',
    cursor: 'pointer',
    userSelect: 'none',
  },

  cardTitle: {
    margin: 0,
    color: '#FFF',
    fontSize: 13,
    fontWeight: 700,
  },

  collapseBtn: {
    width: 22,
    height: 22,
    borderRadius: 5,
    background: 'transparent',
    border: 'none',
    color: '#888',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },

  cardBody: {
    padding: '10px 14px 14px',
  },

  infoGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(2, 1fr)',
    gap: 6,
  },

  infoCell: {
    padding: '10px 12px',
    borderRadius: 9,
    background: 'rgba(255,255,255,0.025)',
    border: '1px solid rgba(255,255,255,0.04)',
  },

  infoCellLabel: {
    display: 'flex',
    alignItems: 'center',
    gap: 5,
    color: '#777',
    fontSize: 10,
    fontWeight: 700,
    textTransform: 'uppercase',
    letterSpacing: '0.4px',
    marginBottom: 5,
  },

  infoCellValue: {
    color: '#E5E5E5',
    fontSize: 13,
    lineHeight: 1.3,
  },

  personMini: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
  },

  avatar: {
    width: 36,
    height: 36,
    borderRadius: 10,
    border: '2px solid',
    background: 'rgba(255,255,255,0.03)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontWeight: 700,
    overflow: 'hidden',
    flexShrink: 0,
    fontSize: 13,
  },

  avatarImg: {
    width: '100%',
    height: '100%',
    objectFit: 'cover',
  },

  personName: {
    color: '#FFF',
    fontSize: 13,
    fontWeight: 600,
  },

  personSub: {
    color: '#888',
    fontSize: 11,
    marginTop: 1,
  },

  commentComposer: {
    display: 'flex',
    gap: 6,
    marginBottom: 10,
    alignItems: 'flex-end',
  },

  sendBtn: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 5,
    padding: '8px 12px',
    borderRadius: 8,
    border: 'none',
    background: 'linear-gradient(135deg, #F59E0B, #D97706)',
    color: '#000',
    fontWeight: 700,
    fontSize: 11,
    cursor: 'pointer',
    fontFamily: 'inherit',
    flexShrink: 0,
    alignSelf: 'flex-end',
  },

  commentSectionTitle: {
    color: '#888',
    fontSize: 11,
    fontWeight: 700,
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
    marginBottom: 8,
  },

  commentList: {
    display: 'flex',
    flexDirection: 'column',
    gap: 6,
  },

  commentItemAdmin: {
    padding: '8px 10px',
    borderRadius: 8,
    background: 'rgba(245,158,11,0.05)',
    border: '1px solid rgba(245,158,11,0.08)',
  },

  commentItemEmployee: {
    padding: '8px 10px',
    borderRadius: 8,
    background: 'rgba(16,185,129,0.05)',
    border: '1px solid rgba(16,185,129,0.08)',
  },

  commentHead: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
    marginBottom: 5,
  },

  commentDate: {
    color: '#666',
    fontSize: 10,
  },

  commentText: {
    margin: 0,
    color: '#ddd',
    fontSize: 12,
    lineHeight: 1.5,
    whiteSpace: 'pre-wrap',
  },

  timeline: {
    display: 'flex',
    flexDirection: 'column',
    gap: 6,
  },

  timelineItem: {
    display: 'flex',
    gap: 8,
    alignItems: 'flex-start',
  },

  timelineDot: {
    width: 8,
    height: 8,
    borderRadius: '50%',
    background: '#F59E0B',
    marginTop: 4,
    flexShrink: 0,
    boxShadow: '0 0 0 4px rgba(245,158,11,0.08)',
  },

  timelineContent: {
    flex: 1,
    paddingBottom: 8,
    borderBottom: '1px solid rgba(255,255,255,0.04)',
  },

  timelineAction: {
    color: '#FFF',
    fontSize: 12,
    fontWeight: 600,
    marginBottom: 2,
  },

  timelineMeta: {
    color: '#666',
    fontSize: 10,
  },

  attachmentList: {
    display: 'flex',
    flexDirection: 'column',
    gap: 5,
  },

  attachmentItem: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    padding: '8px 10px',
    borderRadius: 8,
    textDecoration: 'none',
    background: 'rgba(255,255,255,0.025)',
    border: '1px solid rgba(255,255,255,0.04)',
  },

  attachmentIcon: {
    width: 32,
    height: 32,
    borderRadius: 8,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'rgba(255,255,255,0.04)',
    flexShrink: 0,
  },

  attachmentName: {
    color: '#E5E5E5',
    fontSize: 12,
    fontWeight: 600,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },

  attachmentMeta: {
    color: '#666',
    fontSize: 10,
    marginTop: 1,
  },

  requirementsList: {
    display: 'flex',
    flexDirection: 'column',
    gap: 0,
  },

  requirementRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
    padding: '8px 0',
    borderBottom: '1px solid rgba(255,255,255,0.04)',
  },

  smallLabelInline: {
    color: '#888',
    fontSize: 11,
  },

  booleanValue: (value) => ({
    color: value ? '#10B981' : '#EF4444',
    fontWeight: 700,
    fontSize: 11,
  }),

  emptyBox: {
    padding: 14,
    borderRadius: 8,
    background: 'rgba(255,255,255,0.025)',
    border: '1px solid rgba(255,255,255,0.04)',
    color: '#666',
    fontSize: 12,
    textAlign: 'center',
  },

  overlay: {
    position: 'fixed',
    inset: 0,
    background: 'rgba(0,0,0,0.8)',
    backdropFilter: 'blur(5px)',
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 2000,
    padding: 16,
  },

  modal: {
    width: '100%',
    maxWidth: 440,
    background: '#141420',
    border: '1px solid rgba(245,158,11,0.15)',
    borderRadius: 14,
    overflow: 'hidden',
    boxShadow: '0 24px 70px rgba(0,0,0,0.6)',
    maxHeight: '90vh',
    display: 'flex',
    flexDirection: 'column',
  },

  modalHead: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '12px 16px',
    borderBottom: '1px solid rgba(255,255,255,0.06)',
  },

  modalTitle: {
    margin: 0,
    color: '#FFF',
    fontSize: 14,
    fontWeight: 700,
  },

  modalX: {
    width: 28,
    height: 28,
    borderRadius: 7,
    border: '1px solid rgba(255,255,255,0.1)',
    background: 'rgba(255,255,255,0.04)',
    color: '#888',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },

  modalBody: {
    padding: 16,
    overflowY: 'auto',
    flex: 1,
  },

  modalActions: {
    display: 'flex',
    justifyContent: 'flex-end',
    gap: 8,
    marginTop: 14,
  },

  field: {
    marginBottom: 12,
  },

  label: {
    display: 'block',
    fontSize: 10,
    fontWeight: 700,
    color: '#888',
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
    marginBottom: 5,
  },

  input: {
    width: '100%',
    boxSizing: 'border-box',
    padding: '9px 11px',
    borderRadius: 9,
    border: '1px solid rgba(255,255,255,0.08)',
    background: 'rgba(255,255,255,0.04)',
    color: '#FFF',
    outline: 'none',
    fontSize: 13,
    fontFamily: 'inherit',
  },

  textarea: {
    width: '100%',
    boxSizing: 'border-box',
    padding: '9px 11px',
    borderRadius: 9,
    border: '1px solid rgba(255,255,255,0.08)',
    background: 'rgba(255,255,255,0.04)',
    color: '#FFF',
    outline: 'none',
    fontSize: 13,
    fontFamily: 'inherit',
    resize: 'vertical',
    minHeight: 60,
    flex: 1,
  },

  select: {
    width: '100%',
    boxSizing: 'border-box',
    padding: '9px 11px',
    borderRadius: 9,
    border: '1px solid rgba(255,255,255,0.08)',
    background: 'rgba(255,255,255,0.04)',
    color: '#FFF',
    outline: 'none',
    fontSize: 13,
    fontFamily: 'inherit',
    cursor: 'pointer',
  },

  btnPri: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 5,
    padding: '8px 14px',
    borderRadius: 9,
    border: 'none',
    background: 'linear-gradient(135deg, #F59E0B, #D97706)',
    color: '#000',
    fontWeight: 700,
    fontSize: 12,
    cursor: 'pointer',
    fontFamily: 'inherit',
  },

  btnSec: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 5,
    padding: '8px 12px',
    borderRadius: 9,
    border: '1px solid rgba(255,255,255,0.08)',
    background: 'rgba(255,255,255,0.04)',
    color: '#ccc',
    fontWeight: 600,
    fontSize: 12,
    cursor: 'pointer',
    fontFamily: 'inherit',
  },

  btnDanger: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 5,
    padding: '8px 14px',
    borderRadius: 9,
    border: 'none',
    background: 'linear-gradient(135deg, #EF4444, #DC2626)',
    color: '#FFF',
    fontWeight: 700,
    fontSize: 12,
    cursor: 'pointer',
    fontFamily: 'inherit',
  },
}