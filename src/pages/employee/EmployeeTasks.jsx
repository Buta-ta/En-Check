// src/pages/employee/EmployeeTasks.jsx
// ═══════════════════════════════════════════════════════════
// 📋 MES TÂCHES - ESPACE EMPLOYÉ
// Voir, démarrer, terminer, commenter, envoyer des preuves
// ═══════════════════════════════════════════════════════════

import { useEffect, useMemo, useRef, useState } from 'react'
import {
  ClipboardList,
  Clock,
  Calendar,
  CheckCircle2,
  Play,
  Pause,
  RotateCcw,
  MessageSquare,
  AlertTriangle,
  Camera,
  FileText,
  Users,
  User,
  RefreshCw,
  Eye,
  Timer,
  Paperclip,
  Upload,
  Image as ImageIcon,
  Send,
  X,
  Download,
} from 'lucide-react'
import toast from 'react-hot-toast'
import EmployeeLayout from '../../components/EmployeeLayout'
import EmployeeAuthService from '../../services/employeeAuthService'
import {
  getEmployeeTasks,
  markTaskAsSeen,
  startTask,
  pauseTask,
  resumeTask,
  completeTask,
  addTaskAttachment,
  uploadTaskAttachmentFile,
  formatDuration,
  getDeadlineStatus,
  getPriorityColor,
  getPriorityLabel,
  getStatusColor,
  getStatusLabel,
} from '../../services/taskService'

// ═══════════════════════════════════════════════════════════
// BADGE
// ═══════════════════════════════════════════════════════════
function Badge({ text, color, bg }) {
  return (
    <span style={{
      display: 'inline-flex',
      alignItems: 'center',
      gap: '6px',
      padding: '6px 10px',
      borderRadius: '999px',
      fontSize: '11px',
      fontWeight: '700',
      color,
      background: bg,
      border: `1px solid ${color}22`,
      letterSpacing: '0.3px',
    }}>
      {text}
    </span>
  )
}

// ═══════════════════════════════════════════════════════════
// MODAL TERMINER TÂCHE
// ═══════════════════════════════════════════════════════════
function CompleteTaskModal({ open, onClose, task, onConfirm, loading }) {
  const [comment, setComment] = useState('')
  const [documentFile, setDocumentFile] = useState(null)
  const [imageFile, setImageFile] = useState(null)
  const [cameraFile, setCameraFile] = useState(null)

  const documentInputRef = useRef(null)
  const imageInputRef = useRef(null)
  const cameraInputRef = useRef(null)

  useEffect(() => {
    if (open) {
      setComment('')
      setDocumentFile(null)
      setImageFile(null)
      setCameraFile(null)
    }
  }, [open])

  if (!open || !task) return null

  const handleSubmit = (e) => {
    e.preventDefault()
    onConfirm({
      comment: comment.trim() || null,
      documentFile,
      imageFile,
      cameraFile,
    })
  }

  const canAttachDocument = !!task.allow_document
  const canAttachImage = !!task.allow_image
  const canAttachCamera = !!task.allow_camera_photo

  return (
    <div style={styles.modalOverlay} onClick={onClose}>
      <div style={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div style={styles.modalHeader}>
          <h3 style={styles.modalTitle}>Terminer la tâche</h3>
        </div>

        <form onSubmit={handleSubmit} style={styles.modalBody}>
          <div style={styles.summaryBox}>
            <div style={styles.summaryTitle}>{task.title}</div>
            <div style={styles.summarySub}>
              {task.requires_comment
                ? 'Un commentaire est requis pour cette tâche.'
                : 'Vous pouvez ajouter un commentaire optionnel.'}
              {task.requires_proof && (
                <span style={{ display: 'block', marginTop: '6px', color: '#F59E0B', fontWeight: '700' }}>
                  Une preuve est requise avant la validation.
                </span>
              )}
            </div>
          </div>

          <div style={styles.formGroup}>
            <label style={styles.label}>
              Commentaire {task.requires_comment ? '*' : '(optionnel)'}
            </label>
            <textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              rows={5}
              style={{ ...styles.input, ...styles.textarea }}
              placeholder="Décrivez le travail effectué..."
            />
          </div>

          {(canAttachDocument || canAttachImage || canAttachCamera) && (
            <div style={styles.proofSection}>
              <div style={styles.proofTitle}>Preuves / pièces jointes</div>

              <div style={styles.uploadActions}>
                {canAttachDocument && (
                  <>
                    <button
                      type="button"
                      style={styles.uploadBtn}
                      onClick={() => documentInputRef.current?.click()}
                    >
                      <FileText size={15} />
                      <span>Document</span>
                    </button>
                    <input
                      ref={documentInputRef}
                      type="file"
                      accept=".pdf,.doc,.docx,.xls,.xlsx,.txt,.csv"
                      style={{ display: 'none' }}
                      onChange={(e) => setDocumentFile(e.target.files?.[0] || null)}
                    />
                  </>
                )}

                {canAttachImage && (
                  <>
                    <button
                      type="button"
                      style={styles.uploadBtn}
                      onClick={() => imageInputRef.current?.click()}
                    >
                      <ImageIcon size={15} />
                      <span>Image</span>
                    </button>
                    <input
                      ref={imageInputRef}
                      type="file"
                      accept="image/*"
                      style={{ display: 'none' }}
                      onChange={(e) => setImageFile(e.target.files?.[0] || null)}
                    />
                  </>
                )}

                {canAttachCamera && (
                  <>
                    <button
                      type="button"
                      style={styles.uploadBtn}
                      onClick={() => cameraInputRef.current?.click()}
                    >
                      <Camera size={15} />
                      <span>Caméra</span>
                    </button>
                    <input
                      ref={cameraInputRef}
                      type="file"
                      accept="image/*"
                      capture="environment"
                      style={{ display: 'none' }}
                      onChange={(e) => setCameraFile(e.target.files?.[0] || null)}
                    />
                  </>
                )}
              </div>

              <div style={styles.selectedFilesList}>
                {documentFile && (
                  <SelectedFileChip
                    icon={<FileText size={13} color="#6366F1" />}
                    name={documentFile.name}
                    onRemove={() => setDocumentFile(null)}
                  />
                )}
                {imageFile && (
                  <SelectedFileChip
                    icon={<ImageIcon size={13} color="#10B981" />}
                    name={imageFile.name}
                    onRemove={() => setImageFile(null)}
                  />
                )}
                {cameraFile && (
                  <SelectedFileChip
                    icon={<Camera size={13} color="#F59E0B" />}
                    name={cameraFile.name}
                    onRemove={() => setCameraFile(null)}
                  />
                )}
              </div>
            </div>
          )}

          <div style={styles.modalActions}>
            <button type="button" onClick={onClose} style={styles.btnSecondary}>
              Annuler
            </button>
            <button
              type="submit"
              style={styles.btnPrimary}
              disabled={loading}
            >
              <CheckCircle2 size={16} />
              <span>Marquer terminée</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

function SelectedFileChip({ icon, name, onRemove }) {
  return (
    <div style={styles.selectedFileChip}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', minWidth: 0 }}>
        {icon}
        <span style={styles.selectedFileName}>{name}</span>
      </div>
      <button type="button" onClick={onRemove} style={styles.removeFileBtn}>
        <X size={12} />
      </button>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════
// LOADING SCREEN
// ═══════════════════════════════════════════════════════════
function LoadingScreen() {
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
        @keyframes loading {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(400%); }
        }
      `}</style>
      <div style={styles.loadingScreen}>
        <div style={styles.loadingContent}>
          <div style={styles.loadingIconWrapper}>
            <div style={styles.ripple1} />
            <div style={styles.ripple2} />
            <div style={styles.ripple3} />
            <div style={styles.loadingIcon}>
              <ClipboardList size={40} color="#F59E0B" style={{ animation: 'float 2s ease-in-out infinite' }} />
            </div>
          </div>
          <h2 style={styles.loadingTitle}>Mes Tâches</h2>
          <p style={styles.loadingText}>Chargement de vos tâches...</p>
          <div style={styles.loadingBar}>
            <div style={styles.loadingBarFill} />
          </div>
        </div>
      </div>
    </>
  )
}

// ═══════════════════════════════════════════════════════════
// PAGE PRINCIPALE
// ═══════════════════════════════════════════════════════════
export default function EmployeeTasks() {
  const [employee, setEmployee] = useState(null)
  const [tasks, setTasks] = useState([])
  const [loading, setLoading] = useState(true)
  const [initialLoading, setInitialLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState(false)

  const [statusFilter, setStatusFilter] = useState('')
  const [selectedTask, setSelectedTask] = useState(null)
  const [showCompleteModal, setShowCompleteModal] = useState(false)

  useEffect(() => {
    const initPage = async () => {
      const emp = EmployeeAuthService.getEmployee()
      if (!emp) return

      setEmployee(emp)
      await loadTasks(emp.id)
      
      // Delay minimal pour voir l'animation
      setTimeout(() => {
        setInitialLoading(false)
      }, 800)
    }

    initPage()
  }, [])

  const loadTasks = async (employeeId = employee?.id) => {
    if (!employeeId) return

    setLoading(true)
    try {
      const { data, error } = await getEmployeeTasks(employeeId, {
        includeTeamTasks: true,
        limit: 100,
      })

      if (error) throw error
      setTasks(data || [])
    } catch (error) {
      console.error(error)
      toast.error('Impossible de charger vos tâches')
    } finally {
      setLoading(false)
    }
  }

  const [, setTicker] = useState(0)

  useEffect(() => {
    const interval = setInterval(() => {
      setTicker(prev => prev + 1)
    }, 1000)

    return () => clearInterval(interval)
  }, [])

  const filteredTasks = useMemo(() => {
    return tasks.filter(task => {
      if (!statusFilter) return true
      return task.status === statusFilter
    })
  }, [tasks, statusFilter])

  const handleSeen = async (task) => {
    try {
      await markTaskAsSeen(task.id, employee.id)
      await loadTasks()
    } catch (error) {
      console.error(error)
    }
  }

  const handleStart = async (task) => {
    setActionLoading(true)
    try {
      if (!task.seen_at) {
        await markTaskAsSeen(task.id, employee.id)
      }

      const { error } = await startTask(task.id, employee.id)
      if (error) throw error

      toast.success('Tâche démarrée')
      await loadTasks()
    } catch (error) {
      console.error(error)
      toast.error(error.message || 'Impossible de démarrer')
    } finally {
      setActionLoading(false)
    }
  }

  const handlePause = async (task) => {
    setActionLoading(true)
    try {
      const { error } = await pauseTask(task.id, employee.id)
      if (error) throw error

      toast.success('Tâche mise en pause')
      await loadTasks()
    } catch (error) {
      console.error(error)
      toast.error(error.message || 'Impossible de mettre en pause')
    } finally {
      setActionLoading(false)
    }
  }

  const handleResume = async (task) => {
    setActionLoading(true)
    try {
      const { error } = await resumeTask(task.id, employee.id)
      if (error) throw error

      toast.success('Tâche reprise')
      await loadTasks()
    } catch (error) {
      console.error(error)
      toast.error(error.message || 'Impossible de reprendre')
    } finally {
      setActionLoading(false)
    }
  }

  const handleComplete = async (payload) => {
    if (!selectedTask) return

    setActionLoading(true)
    try {
      const filesToUpload = [
        payload.documentFile ? { file: payload.documentFile, mode: 'document' } : null,
        payload.imageFile ? { file: payload.imageFile, mode: 'image' } : null,
        payload.cameraFile ? { file: payload.cameraFile, mode: 'camera' } : null,
      ].filter(Boolean)

      for (const item of filesToUpload) {
        const { data: uploaded, error: uploadError } = await uploadTaskAttachmentFile(
          item.file,
          selectedTask.id,
          employee.id,
          item.mode
        )

        if (uploadError) throw uploadError

        const { error: attachError } = await addTaskAttachment(
          selectedTask.id,
          employee.id,
          uploaded
        )

        if (attachError) throw attachError
      }

      const { error } = await completeTask(selectedTask.id, employee.id, {
        comment: payload.comment,
      })
      if (error) throw error

      toast.success('Tâche terminée')
      setShowCompleteModal(false)
      setSelectedTask(null)
      await loadTasks()
    } catch (error) {
      console.error(error)
      toast.error(error.message || 'Impossible de terminer la tâche')
    } finally {
      setActionLoading(false)
    }
  }

  const getLiveElapsed = (task) => {
    if (task.status !== 'in_progress' || !task.started_at) {
      return formatDuration(task.actual_duration_seconds || 0)
    }

    const startedAt = new Date(task.started_at).getTime()
    const now = Date.now()
    const elapsed = Math.floor((now - startedAt) / 1000)
    const total = (task.actual_duration_seconds || 0) + elapsed
    return formatDuration(total)
  }

  // Loading Screen
  if (initialLoading) {
    return <LoadingScreen />
  }

  if (!employee) return null

  return (
    <EmployeeLayout>
      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        @keyframes pulseAmber {
          0%, 100% { box-shadow: 0 0 0 0 rgba(245,158,11,0.3); }
          50% { box-shadow: 0 0 0 8px rgba(245,158,11,0); }
        }
        .spin { animation: spin 1s linear infinite; }
        .employee-task-card {
          transition: all 0.25s ease;
        }
        .employee-task-card:hover {
          transform: translateY(-3px);
          box-shadow: 0 12px 40px rgba(0,0,0,0.25);
        }
      `}</style>

      <div style={styles.container}>
        {/* HEADER */}
        <div style={styles.header}>
          <div style={styles.headerLeft}>
            <div style={styles.headerIcon}>
              <ClipboardList size={24} color="#F59E0B" />
            </div>
            <div>
              <h1 style={styles.title}>Mes tâches</h1>
              <p style={styles.subtitle}>
                {filteredTasks.length} tâche{filteredTasks.length > 1 ? 's' : ''}
              </p>
            </div>
          </div>

          <button onClick={() => loadTasks()} style={styles.refreshBtn}>
            <RefreshCw size={16} />
            <span>Rafraîchir</span>
          </button>
        </div>

        {/* FILTRES */}
        <div style={styles.filtersBar}>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            style={styles.filterSelect}
          >
            <option value="">Tous les statuts</option>
            <option value="assigned">Assignée</option>
            <option value="seen">Vue</option>
            <option value="in_progress">En cours</option>
            <option value="paused">En pause</option>
            <option value="completed">Terminée</option>
            <option value="validated">Validée</option>
            <option value="rejected">Rejetée</option>
          </select>
        </div>

        {/* LISTE */}
        {loading ? (
          <div style={styles.loadingBox}>
            <RefreshCw size={32} color="#F59E0B" className="spin" />
            <p style={{ color: '#888' }}>Chargement de vos tâches...</p>
          </div>
        ) : filteredTasks.length === 0 ? (
          <div style={styles.emptyBox}>
            <ClipboardList size={48} color="#555" />
            <h3 style={{ color: '#fff', margin: 0 }}>Aucune tâche</h3>
            <p style={{ color: '#777', margin: 0 }}>
              Vous n'avez aucune tâche pour le moment.
            </p>
          </div>
        ) : (
          <div style={styles.taskGrid}>
            {filteredTasks.map((task) => {
              const deadline = getDeadlineStatus(task.due_at)
              const statusColor = getStatusColor(task.status)
              const priorityColor = getPriorityColor(task.priority)
              const comments = task.comments || []
              const attachments = task.attachments || []
              const adminComments = comments.filter(c => c.author_type === 'admin')
              const employeeComments = comments.filter(c => c.author_type === 'employee')

              return (
                <div
                  key={task.id}
                  className="employee-task-card"
                  style={styles.taskCard}
                >
                  <div style={styles.cardTopLine} />

                  <div style={styles.taskHeader}>
                    <div style={{ flex: 1 }}>
                      <div style={styles.badgesRow}>
                        <Badge
                          text={getStatusLabel(task.status)}
                          color={statusColor}
                          bg={`${statusColor}16`}
                        />
                        <Badge
                          text={getPriorityLabel(task.priority)}
                          color={priorityColor}
                          bg={`${priorityColor}16`}
                        />
                      </div>

                      <h3 style={styles.taskTitle}>{task.title}</h3>
                      {task.description && (
                        <p style={styles.taskDescription}>{task.description}</p>
                      )}
                    </div>
                  </div>

                  <div style={styles.infoList}>
                    <div style={styles.infoRow}>
                      {task.task_type === 'team'
                        ? <Users size={14} color="#8B5CF6" />
                        : <User size={14} color="#10B981" />}
                      <span style={styles.infoText}>
                        {task.task_type === 'team'
                          ? `Équipe : ${task.team?.name || '—'}`
                          : 'Tâche individuelle'}
                      </span>
                    </div>

                    {task.category && (
                      <div style={styles.infoRow}>
                        <ClipboardList size={14} color={task.category.color || '#F59E0B'} />
                        <span style={styles.infoText}>{task.category.name}</span>
                      </div>
                    )}

                    {task.due_at && (
                      <div style={styles.infoRow}>
                        <Calendar size={14} color={deadline.overdue ? '#EF4444' : '#F59E0B'} />
                        <span style={styles.infoText}>
                          {new Date(task.due_at).toLocaleString('fr-FR')}
                        </span>
                      </div>
                    )}

                    <div style={styles.infoRow}>
                      <Clock size={14} color="#6366F1" />
                      <span style={styles.infoText}>
                        Temps : {getLiveElapsed(task)}
                      </span>
                    </div>
                  </div>

                  {(task.requires_proof || task.requires_comment || task.allow_document || task.allow_camera_photo || task.allow_image) && (
                    <div style={styles.requirementsRow}>
                      {task.requires_proof && (
                        <span style={styles.requirementChip}>
                          <Camera size={12} />
                          Preuve requise
                        </span>
                      )}
                      {task.requires_comment && (
                        <span style={styles.requirementChip}>
                          <MessageSquare size={12} />
                          Commentaire requis
                        </span>
                      )}
                      {task.allow_document && (
                        <span style={styles.requirementChip}>
                          <FileText size={12} />
                          Doc autorisé
                        </span>
                      )}
                      {task.allow_image && (
                        <span style={styles.requirementChip}>
                          <ImageIcon size={12} />
                          Image autorisée
                        </span>
                      )}
                      {task.allow_camera_photo && (
                        <span style={styles.requirementChip}>
                          <Camera size={12} />
                          Caméra autorisée
                        </span>
                      )}
                    </div>
                  )}

                  {task.due_at && (
                    <div style={{
                      ...styles.deadlineBox,
                      borderColor: deadline.overdue ? 'rgba(239,68,68,0.22)' : 'rgba(245,158,11,0.15)',
                      background: deadline.overdue ? 'rgba(239,68,68,0.08)' : 'rgba(245,158,11,0.06)',
                    }}>
                      {deadline.overdue ? (
                        <AlertTriangle size={14} color="#EF4444" />
                      ) : (
                        <Clock size={14} color="#F59E0B" />
                      )}
                      <span style={{
                        color: deadline.overdue ? '#EF4444' : '#F59E0B',
                        fontSize: '12px',
                        fontWeight: '700',
                      }}>
                        {deadline.text}
                      </span>
                    </div>
                  )}

                  {/* COMMENTAIRES ADMIN */}
                  {adminComments.length > 0 && (
                    <div style={styles.commentBlock}>
                      <div style={styles.commentBlockTitle}>
                        <MessageSquare size={13} color="#F59E0B" />
                        <span>Commentaires admin</span>
                      </div>
                      <div style={styles.commentList}>
                        {adminComments.map((comment) => (
                          <div key={comment.id} style={styles.commentItem}>
                            <div style={styles.commentMeta}>
                              <span style={styles.commentAuthorAdmin}>Admin</span>
                              <span style={styles.commentDate}>
                                {new Date(comment.created_at).toLocaleString('fr-FR')}
                              </span>
                            </div>
                            <div style={styles.commentText}>
                              {comment.comment}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* PREUVES / ATTACHMENTS */}
                  {attachments.length > 0 && (
                    <div style={styles.attachmentBlock}>
                      <div style={styles.commentBlockTitle}>
                        <Paperclip size={13} color="#10B981" />
                        <span>Mes preuves envoyées</span>
                      </div>
                      <div style={styles.attachmentList}>
                        {attachments.map((file) => (
                          <a
                            key={file.id}
                            href={file.file_url}
                            target="_blank"
                            rel="noreferrer"
                            style={styles.attachmentItem}
                          >
                            <div style={styles.attachmentIcon}>
                              {file.file_type === 'document' && <FileText size={13} color="#6366F1" />}
                              {file.file_type === 'image' && <ImageIcon size={13} color="#10B981" />}
                              {file.file_type === 'camera_photo' && <Camera size={13} color="#F59E0B" />}
                            </div>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={styles.attachmentName}>
                                {file.file_name || 'Fichier'}
                              </div>
                              <div style={styles.attachmentMeta}>
                                {new Date(file.uploaded_at).toLocaleString('fr-FR')}
                              </div>
                            </div>
                            <Download size={13} color="#888" />
                          </a>
                        ))}
                      </div>
                    </div>
                  )}

                  <div style={styles.actionsRow}>
                    {!task.seen_at && ['assigned'].includes(task.status) && (
                      <button
                        onClick={() => handleSeen(task)}
                        style={styles.secondaryBtn}
                      >
                        <Eye size={15} />
                        <span>Marquer vue</span>
                      </button>
                    )}

                    {(task.status === 'assigned' || task.status === 'seen') && (
                      <button
                        onClick={() => handleStart(task)}
                        style={styles.primaryBtn}
                        disabled={actionLoading}
                      >
                        <Play size={15} />
                        <span>Démarrer</span>
                      </button>
                    )}

                    {task.status === 'in_progress' && (
                      <>
                        <button
                          onClick={() => handlePause(task)}
                          style={styles.secondaryBtn}
                          disabled={actionLoading}
                        >
                          <Pause size={15} />
                          <span>Pause</span>
                        </button>

                        <button
                          onClick={() => {
                            setSelectedTask(task)
                            setShowCompleteModal(true)
                          }}
                          style={styles.primaryBtn}
                          disabled={actionLoading}
                        >
                          <CheckCircle2 size={15} />
                          <span>Terminer</span>
                        </button>
                      </>
                    )}

                    {task.status === 'paused' && (
                      <button
                        onClick={() => handleResume(task)}
                        style={styles.primaryBtn}
                        disabled={actionLoading}
                      >
                        <RotateCcw size={15} />
                        <span>Reprendre</span>
                      </button>
                    )}

                    {task.status === 'completed' && (
                      <div style={styles.waitingBox}>
                        En attente de validation admin
                      </div>
                    )}

                    {task.status === 'validated' && (
                      <div style={styles.successBox}>
                        Tâche validée
                      </div>
                    )}

                    {task.status === 'rejected' && (
                      <div style={styles.rejectBox}>
                        Tâche rejetée
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      <CompleteTaskModal
        open={showCompleteModal}
        onClose={() => {
          setShowCompleteModal(false)
          setSelectedTask(null)
        }}
        task={selectedTask}
        onConfirm={handleComplete}
        loading={actionLoading}
      />
    </EmployeeLayout>
  )
}

const styles = {
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

  // Existing styles
  container: {
    display: 'flex',
    flexDirection: 'column',
    gap: '20px',
  },

  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: '16px',
    flexWrap: 'wrap',
  },

  headerLeft: {
    display: 'flex',
    alignItems: 'center',
    gap: '14px',
  },

  headerIcon: {
    width: '48px',
    height: '48px',
    borderRadius: '14px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'rgba(245,158,11,0.1)',
    border: '1px solid rgba(245,158,11,0.2)',
  },

  title: {
    color: '#FFF',
    fontSize: 'clamp(22px, 4vw, 28px)',
    fontWeight: '700',
    margin: 0,
  },

  subtitle: {
    color: '#666',
    fontSize: '14px',
    margin: '4px 0 0 0',
  },

  refreshBtn: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '8px',
    padding: '12px 16px',
    borderRadius: '12px',
    border: '1px solid rgba(255,255,255,0.08)',
    background: 'rgba(255,255,255,0.04)',
    color: '#DDD',
    cursor: 'pointer',
    fontWeight: '600',
  },

  filtersBar: {
    display: 'flex',
    gap: '12px',
    flexWrap: 'wrap',
  },

  filterSelect: {
    minWidth: '220px',
    padding: '12px 14px',
    borderRadius: '12px',
    background: 'rgba(255,255,255,0.03)',
    border: '1px solid rgba(255,255,255,0.08)',
    color: '#fff',
    fontSize: '14px',
    outline: 'none',
  },

  loadingBox: {
    minHeight: '40vh',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '14px',
  },

  emptyBox: {
    minHeight: '40vh',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '14px',
    textAlign: 'center',
  },

  taskGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
    gap: '16px',
  },

  taskCard: {
    position: 'relative',
    background: 'rgba(20, 20, 35, 0.7)',
    backdropFilter: 'blur(10px)',
    border: '1px solid rgba(255,255,255,0.06)',
    borderRadius: '18px',
    padding: '18px',
    overflow: 'hidden',
  },

  cardTopLine: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: '2px',
    background: 'linear-gradient(90deg, transparent, rgba(245,158,11,0.45), transparent)',
  },

  taskHeader: {
    marginBottom: '14px',
  },

  badgesRow: {
    display: 'flex',
    gap: '8px',
    flexWrap: 'wrap',
    marginBottom: '10px',
  },

  taskTitle: {
    color: '#FFF',
    fontSize: '18px',
    fontWeight: '700',
    margin: '0 0 8px 0',
  },

  taskDescription: {
    color: '#888',
    fontSize: '13px',
    lineHeight: '1.6',
    margin: 0,
  },

  infoList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '10px',
    marginBottom: '14px',
  },

  infoRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  },

  infoText: {
    color: '#CCC',
    fontSize: '13px',
  },

  requirementsRow: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '8px',
    marginBottom: '14px',
  },

  requirementChip: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '6px',
    padding: '6px 10px',
    borderRadius: '10px',
    fontSize: '11px',
    color: '#AAA',
    background: 'rgba(255,255,255,0.04)',
    border: '1px solid rgba(255,255,255,0.06)',
  },

  deadlineBox: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '8px',
    padding: '10px 12px',
    borderRadius: '12px',
    border: '1px solid',
    marginBottom: '14px',
  },

  commentBlock: {
    marginBottom: '14px',
    padding: '12px',
    borderRadius: '14px',
    background: 'rgba(245,158,11,0.05)',
    border: '1px solid rgba(245,158,11,0.12)',
  },

  attachmentBlock: {
    marginBottom: '14px',
    padding: '12px',
    borderRadius: '14px',
    background: 'rgba(16,185,129,0.05)',
    border: '1px solid rgba(16,185,129,0.12)',
  },

  commentBlockTitle: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    color: '#FFF',
    fontSize: '12px',
    fontWeight: '700',
    marginBottom: '10px',
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
  },

  commentList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
  },

  commentItem: {
    padding: '10px 12px',
    borderRadius: '12px',
    background: 'rgba(255,255,255,0.03)',
    border: '1px solid rgba(255,255,255,0.06)',
  },

  commentMeta: {
    display: 'flex',
    justifyContent: 'space-between',
    gap: '8px',
    marginBottom: '6px',
    flexWrap: 'wrap',
  },

  commentAuthorAdmin: {
    color: '#F59E0B',
    fontSize: '11px',
    fontWeight: '700',
  },

  commentDate: {
    color: '#777',
    fontSize: '11px',
  },

  commentText: {
    color: '#DDD',
    fontSize: '13px',
    lineHeight: '1.5',
    whiteSpace: 'pre-wrap',
  },

  attachmentList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
  },

  attachmentItem: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    padding: '10px 12px',
    borderRadius: '12px',
    background: 'rgba(255,255,255,0.03)',
    border: '1px solid rgba(255,255,255,0.06)',
    textDecoration: 'none',
  },

  attachmentIcon: {
    width: '32px',
    height: '32px',
    borderRadius: '10px',
    background: 'rgba(255,255,255,0.04)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },

  attachmentName: {
    color: '#E5E5E5',
    fontSize: '12px',
    fontWeight: '600',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },

  attachmentMeta: {
    color: '#777',
    fontSize: '11px',
    marginTop: '3px',
  },

  actionsRow: {
    display: 'flex',
    gap: '10px',
    flexWrap: 'wrap',
    marginTop: '8px',
  },

  primaryBtn: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '8px',
    padding: '12px 16px',
    borderRadius: '12px',
    border: 'none',
    background: 'linear-gradient(135deg, #F59E0B, #D97706)',
    color: '#000',
    fontWeight: '700',
    cursor: 'pointer',
  },

  secondaryBtn: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '8px',
    padding: '12px 16px',
    borderRadius: '12px',
    border: '1px solid rgba(255,255,255,0.08)',
    background: 'rgba(255,255,255,0.04)',
    color: '#DDD',
    fontWeight: '600',
    cursor: 'pointer',
  },

  waitingBox: {
    padding: '12px 14px',
    borderRadius: '12px',
    background: 'rgba(59,130,246,0.12)',
    border: '1px solid rgba(59,130,246,0.18)',
    color: '#60A5FA',
    fontSize: '12px',
    fontWeight: '700',
  },

  successBox: {
    padding: '12px 14px',
    borderRadius: '12px',
    background: 'rgba(16,185,129,0.12)',
    border: '1px solid rgba(16,185,129,0.18)',
    color: '#10B981',
    fontSize: '12px',
    fontWeight: '700',
  },

  rejectBox: {
    padding: '12px 14px',
    borderRadius: '12px',
    background: 'rgba(239,68,68,0.12)',
    border: '1px solid rgba(239,68,68,0.18)',
    color: '#EF4444',
    fontSize: '12px',
    fontWeight: '700',
  },

  modalOverlay: {
    position: 'fixed',
    inset: 0,
    background: 'rgba(0,0,0,0.78)',
    backdropFilter: 'blur(5px)',
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 2000,
    padding: '20px',
  },

  modal: {
    width: '100%',
    maxWidth: '560px',
    background: 'rgba(15,15,25,0.98)',
    border: '1px solid rgba(245,158,11,0.16)',
    borderRadius: '22px',
    overflow: 'hidden',
    boxShadow: '0 30px 90px rgba(0,0,0,0.6)',
  },

  modalHeader: {
    padding: '18px 22px',
    borderBottom: '1px solid rgba(255,255,255,0.08)',
  },

  modalTitle: {
    margin: 0,
    color: '#fff',
    fontSize: '18px',
    fontWeight: '700',
  },

  modalBody: {
    padding: '22px',
  },

  summaryBox: {
    padding: '14px',
    borderRadius: '14px',
    background: 'rgba(255,255,255,0.03)',
    border: '1px solid rgba(255,255,255,0.06)',
    marginBottom: '16px',
  },

  summaryTitle: {
    color: '#FFF',
    fontWeight: '700',
    marginBottom: '6px',
  },

  summarySub: {
    color: '#888',
    fontSize: '13px',
    lineHeight: '1.5',
  },

  formGroup: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
  },

  label: {
    fontSize: '12px',
    fontWeight: '700',
    color: '#888',
    textTransform: 'uppercase',
    letterSpacing: '0.7px',
  },

  input: {
    width: '100%',
    boxSizing: 'border-box',
    padding: '12px 14px',
    borderRadius: '12px',
    border: '1px solid rgba(255,255,255,0.08)',
    background: 'rgba(255,255,255,0.04)',
    color: '#fff',
    outline: 'none',
    fontSize: '14px',
  },

  textarea: {
    resize: 'vertical',
    minHeight: '100px',
  },

  proofSection: {
    marginTop: '16px',
    padding: '14px',
    borderRadius: '14px',
    background: 'rgba(255,255,255,0.03)',
    border: '1px solid rgba(255,255,255,0.06)',
  },

  proofTitle: {
    color: '#FFF',
    fontSize: '13px',
    fontWeight: '700',
    marginBottom: '12px',
  },

  uploadActions: {
    display: 'flex',
    gap: '10px',
    flexWrap: 'wrap',
    marginBottom: '12px',
  },

  uploadBtn: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '8px',
    padding: '10px 14px',
    borderRadius: '12px',
    border: '1px solid rgba(255,255,255,0.08)',
    background: 'rgba(255,255,255,0.04)',
    color: '#DDD',
    cursor: 'pointer',
    fontWeight: '600',
  },

  selectedFilesList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
  },

  selectedFileChip: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '10px',
    padding: '10px 12px',
    borderRadius: '10px',
    background: 'rgba(255,255,255,0.04)',
    border: '1px solid rgba(255,255,255,0.06)',
  },

  selectedFileName: {
    color: '#DDD',
    fontSize: '12px',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },

  removeFileBtn: {
    width: '24px',
    height: '24px',
    borderRadius: '7px',
    border: 'none',
    background: 'rgba(239,68,68,0.12)',
    color: '#EF4444',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },

  modalActions: {
    display: 'flex',
    justifyContent: 'flex-end',
    gap: '12px',
    marginTop: '18px',
  },

  btnPrimary: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '8px',
    padding: '12px 18px',
    borderRadius: '12px',
    border: 'none',
    background: 'linear-gradient(135deg, #F59E0B, #D97706)',
    color: '#000',
    fontWeight: '700',
    cursor: 'pointer',
  },

  btnSecondary: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '8px',
    padding: '12px 18px',
    borderRadius: '12px',
    border: '1px solid rgba(255,255,255,0.08)',
    background: 'rgba(255,255,255,0.04)',
    color: '#ddd',
    fontWeight: '600',
    cursor: 'pointer',
  },
}