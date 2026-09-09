import { db } from '../lib/db'

// ============================================================
// CONSTANTES
// ============================================================

export const TASK_STATUS = {
  ASSIGNED: 'assigned',
  SEEN: 'seen',
  IN_PROGRESS: 'in_progress',
  PAUSED: 'paused',
  COMPLETED: 'completed',
  VALIDATED: 'validated',
  REJECTED: 'rejected',
  CANCELLED: 'cancelled',
}

export const TASK_PRIORITY = {
  LOW: 'low',
  MEDIUM: 'medium',
  HIGH: 'high',
  CRITICAL: 'critical',
}

export const TASK_DIFFICULTY = {
  EASY: 'easy',
  MEDIUM: 'medium',
  HARD: 'hard',
  CRITICAL: 'critical',
}

export const TASK_TYPE = {
  INDIVIDUAL: 'individual',
  TEAM: 'team',
}

// ============================================================
// HELPERS STORAGE
// ============================================================

function sanitizeFileName(name = 'file') {
  return name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9._-]/g, '_')
}

function getAttachmentBucketAndType(file, mode = 'document') {
  const mime = file?.type || ''

  if (mode === 'camera') {
    return {
      bucket: 'photos',
      fileType: 'camera_photo',
    }
  }

  if (mime.startsWith('image/')) {
    return {
      bucket: 'photos',
      fileType: 'image',
    }
  }

  return {
    bucket: 'documents',
    fileType: 'document',
  }
}

/**
 * Upload un fichier de preuve vers Supabase Storage puis retourne les métadonnées prêtes pour task_attachments
 * @param {File} file
 * @param {string} taskId
 * @param {string} employeeId
 * @param {'document'|'image'|'camera'} mode
 * @returns {Promise<{data: object|null, error: Error|null}>}
 */
export async function uploadTaskAttachmentFile(file, taskId, employeeId, mode = 'document') {
  try {
    if (!file) {
      return { data: null, error: new Error('Aucun fichier fourni') }
    }

    const { bucket, fileType } = getAttachmentBucketAndType(file, mode)
    const extension = file.name?.split('.').pop() || 'bin'
    const safeName = sanitizeFileName(file.name || `preuve.${extension}`)
    const filePath = `tasks/${taskId}/${employeeId}/${Date.now()}-${safeName}`

    const { error: uploadError } = await db().storage
      .from(bucket)
      .upload(filePath, file, {
        cacheControl: '3600',
        upsert: false,
      })

    if (uploadError) {
      console.error('Erreur uploadTaskAttachmentFile:', uploadError)
      return { data: null, error: uploadError }
    }

    const { data: publicUrlData } = db().storage.from(bucket).getPublicUrl(filePath)

    return {
      data: {
        file_url: publicUrlData?.publicUrl,
        file_name: file.name || safeName,
        file_type: fileType,
        mime_type: file.type || null,
        bucket,
        file_path: filePath,
      },
      error: null,
    }
  } catch (error) {
    console.error('Erreur uploadTaskAttachmentFile:', error)
    return { data: null, error }
  }
}

// ============================================================
// TÂCHES - CRUD
// ============================================================

export async function getTasks(enterpriseId, options = {}) {
  const {
    status = null,
    priority = null,
    taskType = null,
    teamId = null,
    employeeId = null,
    categoryId = null,
    search = '',
    dueBefore = null,
    dueAfter = null,
    includeSubtasks = false,
    includeDeleted = false,
    parentTaskId = null,
    orderBy = 'created_at',
    orderAsc = false,
    limit = 100,
    offset = 0,
  } = options

  let query = db()
    .from('tasks')
    .select(`
      *,
      assigned_employee:assigned_employee_id (
        id, first_name, last_name, photo_url, position
      ),
      team:team_id (
        id, name, color
      ),
      category:category_id (
        id, name, color, icon, avg_duration_minutes
      ),
      created_by_admin:created_by_admin_id (
        id, first_name, last_name
      ),
      validated_by_admin:validated_by (
        id, first_name, last_name
      ),
      parent_task:parent_task_id (
        id, title
      ),
      depends_on:depends_on_task_id (
        id, title, status
      )
    `)
    .eq('enterprise_id', enterpriseId)

  if (!includeDeleted) {
    query = query.is('deleted_at', null)
  }

  if (!includeSubtasks && !parentTaskId) {
    query = query.is('parent_task_id', null)
  }

  if (parentTaskId) {
    query = query.eq('parent_task_id', parentTaskId)
  }

  if (status) {
    if (Array.isArray(status)) query = query.in('status', status)
    else query = query.eq('status', status)
  }

  if (priority) {
    if (Array.isArray(priority)) query = query.in('priority', priority)
    else query = query.eq('priority', priority)
  }

  if (taskType === 'individual') {
    query = query.not('assigned_employee_id', 'is', null)
    query = query.is('team_id', null)
  } else if (taskType === 'team') {
    query = query.not('team_id', 'is', null)
  }

  if (teamId) query = query.eq('team_id', teamId)
  if (employeeId) query = query.eq('assigned_employee_id', employeeId)
  if (categoryId) query = query.eq('category_id', categoryId)

  if (search) {
    query = query.or(`title.ilike.%${search}%,description.ilike.%${search}%`)
  }

  if (dueBefore) query = query.lte('due_at', dueBefore)
  if (dueAfter) query = query.gte('due_at', dueAfter)

  query = query.order(orderBy, { ascending: orderAsc })
  query = query.range(offset, offset + limit - 1)

  const { data, error } = await query

  if (error) {
    console.error('Erreur getTasks:', error)
    return { data: null, error }
  }

  return { data, error: null }
}

export async function getTaskById(taskId) {
  const { data: task, error } = await db()
    .from('tasks')
    .select(`
      *,
      assigned_employee:assigned_employee_id (
        id, first_name, last_name, photo_url, position, email, phone
      ),
      team:team_id (
        id, name, color, description
      ),
      category:category_id (
        id, name, color, icon, avg_duration_minutes
      ),
      created_by_admin:created_by_admin_id (
        id, first_name, last_name, photo_url
      ),
      validated_by_admin:validated_by (
        id, first_name, last_name
      ),
      updated_by_admin:updated_by (
        id, first_name, last_name
      ),
      parent_task:parent_task_id (
        id, title, status
      ),
      depends_on:depends_on_task_id (
        id, title, status
      ),
      recurrence:recurrence_id (
        id, frequency, days_of_week, time_of_day, is_active
      )
    `)
    .eq('id', taskId)
    .single()

  if (error) {
    console.error('Erreur getTaskById:', error)
    return { data: null, error }
  }

  const { data: subtasks } = await db()
    .from('tasks')
    .select(`
      id, title, status, priority, due_at,
      assigned_employee:assigned_employee_id (id, first_name, last_name, photo_url),
      actual_duration_seconds, expected_duration_minutes, performance_score,
      sort_order
    `)
    .eq('parent_task_id', taskId)
    .is('deleted_at', null)
    .order('sort_order', { ascending: true })

  task.subtasks = subtasks || []

  const { data: attachments } = await db()
    .from('task_attachments')
    .select('*')
    .eq('task_id', taskId)
    .is('deleted_at', null)
    .order('uploaded_at', { ascending: false })

  task.attachments = attachments || []

  const { data: comments } = await db()
    .from('task_comments')
    .select(`
      *
    `)
    .eq('task_id', taskId)
    .is('deleted_at', null)
    .order('created_at', { ascending: true })

  task.comments = comments || []

  const { data: activityLogs } = await db()
    .from('task_activity_logs')
    .select('*')
    .eq('task_id', taskId)
    .order('created_at', { ascending: false })
    .limit(50)

  task.activity_logs = activityLogs || []

  return { data: task, error: null }
}

export async function createTask(taskData, adminId) {
  const {
    enterprise_id,
    title,
    description = null,
    task_type = 'individual',
    assigned_employee_id = null,
    team_id = null,
    category_id = null,
    priority = 'medium',
    difficulty = 'medium',
    due_at = null,
    expected_duration_minutes = null,
    requires_proof = false,
    requires_comment = false,
    allow_image = true,
    allow_document = true,
    allow_camera_photo = true,
    parent_task_id = null,
    depends_on_task_id = null,
    sort_order = 0,
  } = taskData

  if (!enterprise_id || !title?.trim()) {
    return { data: null, error: new Error('enterprise_id et title sont requis') }
  }

  if (task_type === 'individual' && !assigned_employee_id) {
    return {
      data: null,
      error: new Error('Une tâche individuelle nécessite un employé assigné'),
    }
  }

  if (task_type === 'team' && !team_id) {
    return {
      data: null,
      error: new Error('Une tâche d’équipe nécessite une équipe assignée'),
    }
  }

  if (depends_on_task_id) {
    const { data: dependsOnTask } = await db()
      .from('tasks')
      .select('id, status')
      .eq('id', depends_on_task_id)
      .single()

    if (!dependsOnTask) {
      return {
        data: null,
        error: new Error('La tâche de dépendance n’existe pas'),
      }
    }
  }

  const { data: task, error } = await db()
    .from('tasks')
    .insert({
      enterprise_id,
      created_by_admin_id: adminId,
      title: title.trim(),
      description,
      task_type,
      assigned_employee_id: task_type === 'individual' ? assigned_employee_id : null,
      team_id: task_type === 'team' ? team_id : null,
      category_id,
      priority,
      difficulty,
      due_at,
      expected_duration_minutes,
      requires_proof,
      requires_comment,
      allow_image,
      allow_document,
      allow_camera_photo,
      parent_task_id,
      depends_on_task_id,
      sort_order,
      status: TASK_STATUS.ASSIGNED,
      is_auto_generated: false,
    })
    .select()
    .single()

  if (error) {
    console.error('Erreur createTask:', error)
    return { data: null, error }
  }

  await logTaskActivity(task.id, 'admin', adminId, 'created', {
    title: task.title,
    assigned_to: task_type === 'individual' ? assigned_employee_id : team_id,
    task_type,
  })

  return getTaskById(task.id)
}

export async function updateTask(taskId, updates, adminId) {
  const allowedFields = [
    'title', 'description', 'priority', 'difficulty', 'due_at',
    'expected_duration_minutes', 'category_id', 'requires_proof',
    'requires_comment', 'allow_image', 'allow_document', 'allow_camera_photo',
    'assigned_employee_id', 'team_id', 'task_type', 'depends_on_task_id',
    'sort_order',
  ]

  const sanitizedUpdates = Object.keys(updates)
    .filter(key => allowedFields.includes(key))
    .reduce((obj, key) => {
      obj[key] = updates[key]
      return obj
    }, {})

  if (updates.task_type === 'individual') {
    sanitizedUpdates.team_id = null
  } else if (updates.task_type === 'team') {
    sanitizedUpdates.assigned_employee_id = null
  }

  sanitizedUpdates.updated_by = adminId
  sanitizedUpdates.updated_at = new Date().toISOString()

  const { data, error } = await db()
    .from('tasks')
    .update(sanitizedUpdates)
    .eq('id', taskId)
    .is('deleted_at', null)
    .select()
    .single()

  if (error) {
    console.error('Erreur updateTask:', error)
    return { data: null, error }
  }

  await logTaskActivity(taskId, 'admin', adminId, 'updated', {
    fields_changed: Object.keys(sanitizedUpdates),
  })

  return getTaskById(taskId)
}

export async function deleteTask(taskId, adminId) {
  const { data: subtasks } = await db()
    .from('tasks')
    .select('id')
    .eq('parent_task_id', taskId)
    .is('deleted_at', null)
    .limit(1)

  if (subtasks?.length > 0) {
    return {
      success: false,
      error: new Error('Impossible de supprimer : cette tâche a des sous-tâches actives'),
    }
  }

  const { error } = await db()
    .from('tasks')
    .update({
      deleted_at: new Date().toISOString(),
      deleted_by: adminId,
      status: TASK_STATUS.CANCELLED,
    })
    .eq('id', taskId)

  if (error) {
    console.error('Erreur deleteTask:', error)
    return { success: false, error }
  }

  await logTaskActivity(taskId, 'admin', adminId, 'deleted', {})
  return { success: true, error: null }
}

// ============================================================
// CYCLE DE VIE DES TÂCHES (Actions employé)
// ============================================================

export async function markTaskAsSeen(taskId, employeeId) {
  const { data: task } = await db()
    .from('tasks')
    .select('status, seen_at')
    .eq('id', taskId)
    .single()

  if (task?.seen_at) {
    return { data: task, error: null }
  }

  const { data, error } = await db()
    .from('tasks')
    .update({
      seen_at: new Date().toISOString(),
      status: task?.status === TASK_STATUS.ASSIGNED ? TASK_STATUS.SEEN : task?.status,
    })
    .eq('id', taskId)
    .select()
    .single()

  if (error) {
    console.error('Erreur markTaskAsSeen:', error)
    return { data: null, error }
  }

  await logTaskActivity(taskId, 'employee', employeeId, 'seen', {})
  return { data, error: null }
}

export async function startTask(taskId, employeeId) {
  const { data: task } = await db()
    .from('tasks')
    .select('status, started_at, depends_on_task_id, seen_at')
    .eq('id', taskId)
    .single()

  if (!task) {
    return { data: null, error: new Error('Tâche introuvable') }
  }

  if (task.started_at && task.status === TASK_STATUS.IN_PROGRESS) {
    return { data: null, error: new Error('Cette tâche est déjà en cours') }
  }

  if (task.depends_on_task_id) {
    const { data: dependsOn } = await db()
      .from('tasks')
      .select('status')
      .eq('id', task.depends_on_task_id)
      .single()

    if (dependsOn && ![TASK_STATUS.COMPLETED, TASK_STATUS.VALIDATED].includes(dependsOn.status)) {
      return {
        data: null,
        error: new Error('La tâche dont celle-ci dépend n’est pas encore terminée'),
      }
    }
  }

  const { data, error } = await db()
    .from('tasks')
    .update({
      started_at: new Date().toISOString(),
      status: TASK_STATUS.IN_PROGRESS,
      seen_at: task.seen_at || new Date().toISOString(),
    })
    .eq('id', taskId)
    .select()
    .single()

  if (error) {
    console.error('Erreur startTask:', error)
    return { data: null, error }
  }

  await logTaskActivity(taskId, 'employee', employeeId, 'started', {
    started_at: data.started_at,
  })

  return { data, error: null }
}

export async function pauseTask(taskId, employeeId) {
  const { data: task } = await db()
    .from('tasks')
    .select('status, started_at, actual_duration_seconds')
    .eq('id', taskId)
    .single()

  if (task?.status !== TASK_STATUS.IN_PROGRESS) {
    return { data: null, error: new Error('Seule une tâche en cours peut être mise en pause') }
  }

  const startedAt = new Date(task.started_at)
  const now = new Date()
  const elapsedSeconds = Math.floor((now - startedAt) / 1000)
  const totalSeconds = (task.actual_duration_seconds || 0) + elapsedSeconds

  const { data, error } = await db()
    .from('tasks')
    .update({
      status: TASK_STATUS.PAUSED,
      actual_duration_seconds: totalSeconds,
    })
    .eq('id', taskId)
    .select()
    .single()

  if (error) {
    console.error('Erreur pauseTask:', error)
    return { data: null, error }
  }

  await logTaskActivity(taskId, 'employee', employeeId, 'paused', {
    duration_so_far: totalSeconds,
  })

  return { data, error: null }
}

export async function resumeTask(taskId, employeeId) {
  const { data: task } = await db()
    .from('tasks')
    .select('status')
    .eq('id', taskId)
    .single()

  if (task?.status !== TASK_STATUS.PAUSED) {
    return { data: null, error: new Error('Seule une tâche en pause peut être reprise') }
  }

  const { data, error } = await db()
    .from('tasks')
    .update({
      status: TASK_STATUS.IN_PROGRESS,
      started_at: new Date().toISOString(),
    })
    .eq('id', taskId)
    .select()
    .single()

  if (error) {
    console.error('Erreur resumeTask:', error)
    return { data: null, error }
  }

  await logTaskActivity(taskId, 'employee', employeeId, 'resumed', {})
  return { data, error: null }
}

export async function completeTask(taskId, employeeId, completionData = {}) {
  const { comment = null } = completionData

  const { data: task } = await db()
    .from('tasks')
    .select('status, started_at, actual_duration_seconds, requires_proof, requires_comment')
    .eq('id', taskId)
    .single()

  if (!task) {
    return { data: null, error: new Error('Tâche introuvable') }
  }

  if (task.requires_proof) {
    const { data: attachments } = await db()
      .from('task_attachments')
      .select('id')
      .eq('task_id', taskId)
      .eq('employee_id', employeeId)
      .is('deleted_at', null)
      .limit(1)

    if (!attachments?.length) {
      return {
        data: null,
        error: new Error('Une preuve (photo ou document) est requise pour terminer cette tâche'),
      }
    }
  }

  if (task.requires_comment && !comment) {
    const { data: comments } = await db()
      .from('task_comments')
      .select('id')
      .eq('task_id', taskId)
      .eq('author_id', employeeId)
      .eq('author_type', 'employee')
      .is('deleted_at', null)
      .limit(1)

    if (!comments?.length) {
      return { data: null, error: new Error('Un commentaire est requis pour terminer cette tâche') }
    }
  }

  let totalDurationSeconds = task.actual_duration_seconds || 0

  if (task.status === TASK_STATUS.IN_PROGRESS && task.started_at) {
    const startedAt = new Date(task.started_at)
    const now = new Date()
    const elapsedSeconds = Math.floor((now - startedAt) / 1000)
    totalDurationSeconds += elapsedSeconds
  }

  const { data, error } = await db()
    .from('tasks')
    .update({
      status: TASK_STATUS.COMPLETED,
      completed_at: new Date().toISOString(),
      actual_duration_seconds: totalDurationSeconds,
    })
    .eq('id', taskId)
    .select()
    .single()

  if (error) {
    console.error('Erreur completeTask:', error)
    return { data: null, error }
  }

  if (comment) {
    await addTaskComment(taskId, employeeId, 'employee', comment)
  }

  await logTaskActivity(taskId, 'employee', employeeId, 'completed', {
    total_duration_seconds: totalDurationSeconds,
  })

  return getTaskById(taskId)
}

// ============================================================
// VALIDATION ADMIN
// ============================================================

export async function validateTask(taskId, adminId, comment = null) {
  const { data: task } = await db()
    .from('tasks')
    .select('status')
    .eq('id', taskId)
    .single()

  if (task?.status !== TASK_STATUS.COMPLETED) {
    return { data: null, error: new Error('Seule une tâche terminée peut être validée') }
  }

  const { data, error } = await db()
    .from('tasks')
    .update({
      status: TASK_STATUS.VALIDATED,
      validated_by: adminId,
      validated_at: new Date().toISOString(),
      updated_by: adminId,
      updated_at: new Date().toISOString(),
    })
    .eq('id', taskId)
    .select()
    .single()

  if (error) {
    console.error('Erreur validateTask:', error)
    return { data: null, error }
  }

  if (comment) {
    await addTaskComment(taskId, adminId, 'admin', comment)
  }

  await logTaskActivity(taskId, 'admin', adminId, 'validated', {})
  return getTaskById(taskId)
}

export async function rejectTask(taskId, adminId, reason) {
  if (!reason?.trim()) {
    return { data: null, error: new Error('Un motif de rejet est obligatoire') }
  }

  const { data: task } = await db()
    .from('tasks')
    .select('status')
    .eq('id', taskId)
    .single()

  if (task?.status !== TASK_STATUS.COMPLETED) {
    return { data: null, error: new Error('Seule une tâche terminée peut être rejetée') }
  }

  const { data, error } = await db()
    .from('tasks')
    .update({
      status: TASK_STATUS.REJECTED,
      rejection_reason: reason.trim(),
      validated_by: adminId,
      validated_at: new Date().toISOString(),
      updated_by: adminId,
      updated_at: new Date().toISOString(),
    })
    .eq('id', taskId)
    .select()
    .single()

  if (error) {
    console.error('Erreur rejectTask:', error)
    return { data: null, error }
  }

  await addTaskComment(taskId, adminId, 'admin', `❌ Rejetée: ${reason.trim()}`)
  await logTaskActivity(taskId, 'admin', adminId, 'rejected', { reason: reason.trim() })

  return getTaskById(taskId)
}

export async function reassignRejectedTask(taskId, adminId, options = {}) {
  const { new_employee_id = null, new_due_at = null, comment = null } = options

  const { data: task } = await db()
    .from('tasks')
    .select('status')
    .eq('id', taskId)
    .single()

  if (task?.status !== TASK_STATUS.REJECTED) {
    return { data: null, error: new Error('Seule une tâche rejetée peut être réassignée') }
  }

  const updates = {
    status: TASK_STATUS.ASSIGNED,
    started_at: null,
    completed_at: null,
    actual_duration_seconds: 0,
    seen_at: null,
    validated_by: null,
    validated_at: null,
    rejection_reason: null,
    updated_by: adminId,
    updated_at: new Date().toISOString(),
  }

  if (new_employee_id) updates.assigned_employee_id = new_employee_id
  if (new_due_at) updates.due_at = new_due_at

  const { data, error } = await db()
    .from('tasks')
    .update(updates)
    .eq('id', taskId)
    .select()
    .single()

  if (error) {
    console.error('Erreur reassignRejectedTask:', error)
    return { data: null, error }
  }

  if (comment) {
    await addTaskComment(taskId, adminId, 'admin', comment)
  }

  await logTaskActivity(taskId, 'admin', adminId, 'reassigned', {
    new_employee_id,
    new_due_at,
  })

  return getTaskById(taskId)
}

// ============================================================
// PIÈCES JOINTES
// ============================================================

export async function addTaskAttachment(taskId, employeeId, fileData) {
  const {
    file_url,
    file_name,
    file_type, // image | document | camera_photo
    mime_type = null,
  } = fileData

  if (!file_url) {
    return { data: null, error: new Error('URL du fichier requise') }
  }

  const { data: task } = await db()
    .from('tasks')
    .select('allow_image, allow_document, allow_camera_photo')
    .eq('id', taskId)
    .single()

  if (task) {
    if (file_type === 'image' && !task.allow_image) {
      return { data: null, error: new Error('Les images ne sont pas autorisées pour cette tâche') }
    }
    if (file_type === 'document' && !task.allow_document) {
      return { data: null, error: new Error('Les documents ne sont pas autorisés pour cette tâche') }
    }
    if (file_type === 'camera_photo' && !task.allow_camera_photo) {
      return { data: null, error: new Error('Les photos caméra ne sont pas autorisées pour cette tâche') }
    }
  }

  const { data, error } = await db()
    .from('task_attachments')
    .insert({
      task_id: taskId,
      employee_id: employeeId,
      file_url,
      file_name: file_name || 'Sans nom',
      file_type,
      mime_type,
    })
    .select()
    .single()

  if (error) {
    console.error('Erreur addTaskAttachment:', error)
    return { data: null, error }
  }

  await logTaskActivity(taskId, 'employee', employeeId, 'attachment_added', {
    file_name,
    file_type,
  })

  return { data, error: null }
}

export async function deleteTaskAttachment(attachmentId, actorId) {
  const { error } = await db()
    .from('task_attachments')
    .update({
      deleted_at: new Date().toISOString(),
      deleted_by: actorId,
    })
    .eq('id', attachmentId)

  if (error) {
    console.error('Erreur deleteTaskAttachment:', error)
    return { success: false, error }
  }

  return { success: true, error: null }
}

// ============================================================
// COMMENTAIRES
// ============================================================

export async function addTaskComment(taskId, authorId, authorType, comment) {
  if (!comment?.trim()) {
    return { data: null, error: new Error('Le commentaire ne peut pas être vide') }
  }

  const { data, error } = await db()
    .from('task_comments')
    .insert({
      task_id: taskId,
      author_id: authorId,
      author_type: authorType,
      comment: comment.trim(),
    })
    .select()
    .single()

  if (error) {
    console.error('Erreur addTaskComment:', error)
    return { data: null, error }
  }

  await logTaskActivity(taskId, authorType, authorId, 'comment_added', {
    comment_preview: comment.trim().substring(0, 50),
  })

  return { data, error: null }
}

export async function getTaskComments(taskId) {
  const { data, error } = await db()
    .from('task_comments')
    .select('*')
    .eq('task_id', taskId)
    .is('deleted_at', null)
    .order('created_at', { ascending: true })

  if (error) {
    console.error('Erreur getTaskComments:', error)
    return { data: null, error }
  }

  return { data, error: null }
}

// ============================================================
// LOGS D'ACTIVITÉ
// ============================================================

async function logTaskActivity(taskId, actorType, actorId, action, meta = {}) {
  try {
    await db().from('task_activity_logs').insert({
      task_id: taskId,
      actor_type: actorType,
      actor_id: actorId,
      action,
      meta,
    })
  } catch (error) {
    console.error('Erreur logTaskActivity:', error)
  }
}

// ============================================================
// CATÉGORIES
// ============================================================

export async function getTaskCategories(enterpriseId) {
  const { data, error } = await db()
    .from('task_categories')
    .select('*')
    .eq('enterprise_id', enterpriseId)
    .eq('is_active', true)
    .is('deleted_at', null)
    .order('name', { ascending: true })

  if (error) {
    console.error('Erreur getTaskCategories:', error)
    return { data: null, error }
  }

  return { data, error: null }
}

export async function createTaskCategory(categoryData, adminId) {
  const {
    enterprise_id,
    name,
    description = null,
    color = '#6B7280',
    icon = 'clipboard',
  } = categoryData

  if (!enterprise_id || !name?.trim()) {
    return { data: null, error: new Error('enterprise_id et name sont requis') }
  }

  const { data: existing } = await db()
    .from('task_categories')
    .select('id')
    .eq('enterprise_id', enterprise_id)
    .ilike('name', name.trim())
    .is('deleted_at', null)
    .single()

  if (existing) {
    return { data: null, error: new Error('Une catégorie avec ce nom existe déjà') }
  }

  const { data, error } = await db()
    .from('task_categories')
    .insert({
      enterprise_id,
      name: name.trim(),
      description,
      color,
      icon,
      created_by: adminId,
    })
    .select()
    .single()

  if (error) {
    console.error('Erreur createTaskCategory:', error)
    return { data: null, error }
  }

  return { data, error: null }
}

export async function updateTaskCategory(categoryId, updates) {
  const allowedFields = ['name', 'description', 'color', 'icon', 'is_active']

  const sanitizedUpdates = Object.keys(updates)
    .filter(key => allowedFields.includes(key))
    .reduce((obj, key) => {
      obj[key] = updates[key]
      return obj
    }, {})

  sanitizedUpdates.updated_at = new Date().toISOString()

  const { data, error } = await db()
    .from('task_categories')
    .update(sanitizedUpdates)
    .eq('id', categoryId)
    .select()
    .single()

  if (error) {
    console.error('Erreur updateTaskCategory:', error)
    return { data: null, error }
  }

  return { data, error: null }
}

export async function deleteTaskCategory(categoryId, adminId) {
  const { data: tasks } = await db()
    .from('tasks')
    .select('id')
    .eq('category_id', categoryId)
    .is('deleted_at', null)
    .limit(1)

  if (tasks?.length > 0) {
    await db()
      .from('tasks')
      .update({ category_id: null })
      .eq('category_id', categoryId)
  }

  const { error } = await db()
    .from('task_categories')
    .update({
      deleted_at: new Date().toISOString(),
      deleted_by: adminId,
      is_active: false,
    })
    .eq('id', categoryId)

  if (error) {
    console.error('Erreur deleteTaskCategory:', error)
    return { success: false, error }
  }

  return { success: true, error: null }
}

// ============================================================
// STATISTIQUES & ANALYTICS
// ============================================================

export async function getTaskStats(enterpriseId, options = {}) {
  const { dateFrom = null, dateTo = null, teamId = null, employeeId = null } = options

  try {
    let query = db()
      .from('tasks')
      .select('id, status, priority, actual_duration_seconds, expected_duration_minutes, performance_score, created_at, completed_at, due_at, task_type, team_id, assigned_employee_id')
      .eq('enterprise_id', enterpriseId)
      .is('deleted_at', null)
      .is('parent_task_id', null)

    if (dateFrom) query = query.gte('created_at', dateFrom)
    if (dateTo) query = query.lte('created_at', dateTo)
    if (teamId) query = query.eq('team_id', teamId)
    if (employeeId) query = query.eq('assigned_employee_id', employeeId)

    const { data: tasks, error } = await query
    if (error) throw error

    const total = tasks?.length || 0
    const byStatus = {
      assigned: tasks?.filter(t => t.status === TASK_STATUS.ASSIGNED).length || 0,
      seen: tasks?.filter(t => t.status === TASK_STATUS.SEEN).length || 0,
      in_progress: tasks?.filter(t => t.status === TASK_STATUS.IN_PROGRESS).length || 0,
      paused: tasks?.filter(t => t.status === TASK_STATUS.PAUSED).length || 0,
      completed: tasks?.filter(t => t.status === TASK_STATUS.COMPLETED).length || 0,
      validated: tasks?.filter(t => t.status === TASK_STATUS.VALIDATED).length || 0,
      rejected: tasks?.filter(t => t.status === TASK_STATUS.REJECTED).length || 0,
      cancelled: tasks?.filter(t => t.status === TASK_STATUS.CANCELLED).length || 0,
    }

    const byPriority = {
      low: tasks?.filter(t => t.priority === 'low').length || 0,
      medium: tasks?.filter(t => t.priority === 'medium').length || 0,
      high: tasks?.filter(t => t.priority === 'high').length || 0,
      critical: tasks?.filter(t => t.priority === 'critical').length || 0,
    }

    const completable = total - byStatus.cancelled
    const completed = byStatus.completed + byStatus.validated
    const completionRate = completable > 0 ? Math.round((completed / completable) * 100) : 0
    const rejectionRate = completed > 0
      ? Math.round((byStatus.rejected / (completed + byStatus.rejected)) * 100)
      : 0

    const scoredTasks = tasks?.filter(t => t.performance_score != null) || []
    const avgPerformance = scoredTasks.length > 0
      ? Math.round(scoredTasks.reduce((sum, t) => sum + t.performance_score, 0) / scoredTasks.length)
      : null

    const completedWithDuration = tasks?.filter(t =>
      [TASK_STATUS.COMPLETED, TASK_STATUS.VALIDATED].includes(t.status) &&
      t.actual_duration_seconds > 0
    ) || []

    const avgDurationSeconds = completedWithDuration.length > 0
      ? Math.round(completedWithDuration.reduce((sum, t) => sum + t.actual_duration_seconds, 0) / completedWithDuration.length)
      : 0

    const now = new Date()
    const overdue = tasks?.filter(t =>
      t.due_at &&
      new Date(t.due_at) < now &&
      ![TASK_STATUS.COMPLETED, TASK_STATUS.VALIDATED, TASK_STATUS.CANCELLED].includes(t.status)
    ).length || 0

    const byType = {
      individual: tasks?.filter(t => t.task_type === 'individual').length || 0,
      team: tasks?.filter(t => t.task_type === 'team').length || 0,
    }

    return {
      data: {
        total,
        byStatus,
        byPriority,
        byType,
        completionRate,
        rejectionRate,
        avgPerformance,
        avgDurationSeconds,
        overdue,
        pending: byStatus.assigned + byStatus.seen + byStatus.in_progress + byStatus.paused,
      },
      error: null,
    }
  } catch (error) {
    console.error('Erreur getTaskStats:', error)
    return { data: null, error }
  }
}

export async function getTaskStatsByEmployee(enterpriseId) {
  try {
    const { data: tasks, error } = await db()
      .from('tasks')
      .select(`
        id, status, actual_duration_seconds, performance_score,
        assigned_employee:assigned_employee_id (id, first_name, last_name, photo_url)
      `)
      .eq('enterprise_id', enterpriseId)
      .eq('task_type', 'individual')
      .not('assigned_employee_id', 'is', null)
      .is('deleted_at', null)
      .is('parent_task_id', null)

    if (error) throw error

    const byEmployee = {}

    tasks?.forEach(task => {
      const empId = task.assigned_employee?.id
      if (!empId) return

      if (!byEmployee[empId]) {
        byEmployee[empId] = {
          employee: task.assigned_employee,
          total: 0,
          completed: 0,
          in_progress: 0,
          rejected: 0,
          totalDurationSeconds: 0,
          totalPerformanceScore: 0,
          scoredCount: 0,
        }
      }

      byEmployee[empId].total++

      if ([TASK_STATUS.COMPLETED, TASK_STATUS.VALIDATED].includes(task.status)) {
        byEmployee[empId].completed++
        if (task.actual_duration_seconds) {
          byEmployee[empId].totalDurationSeconds += task.actual_duration_seconds
        }
      }

      if (task.status === TASK_STATUS.IN_PROGRESS) byEmployee[empId].in_progress++
      if (task.status === TASK_STATUS.REJECTED) byEmployee[empId].rejected++

      if (task.performance_score != null) {
        byEmployee[empId].totalPerformanceScore += task.performance_score
        byEmployee[empId].scoredCount++
      }
    })

    const result = Object.values(byEmployee).map(emp => ({
      employee: emp.employee,
      total: emp.total,
      completed: emp.completed,
      in_progress: emp.in_progress,
      rejected: emp.rejected,
      completionRate: emp.total > 0 ? Math.round((emp.completed / emp.total) * 100) : 0,
      avgDurationSeconds: emp.completed > 0 ? Math.round(emp.totalDurationSeconds / emp.completed) : 0,
      avgPerformance: emp.scoredCount > 0 ? Math.round(emp.totalPerformanceScore / emp.scoredCount) : null,
    }))

    result.sort((a, b) => b.completed - a.completed)
    return { data: result, error: null }
  } catch (error) {
    console.error('Erreur getTaskStatsByEmployee:', error)
    return { data: null, error }
  }
}

// ============================================================
// ESPACE EMPLOYÉ
// ============================================================

export async function getEmployeeTasks(employeeId, options = {}) {
  const {
    status = null,
    includeTeamTasks = true,
    limit = 50,
  } = options

  try {
    let individualQuery = db()
      .from('tasks')
      .select(`
        *,
        category:category_id (id, name, color, icon),
        created_by_admin:created_by_admin_id (id, first_name, last_name)
      `)
      .eq('assigned_employee_id', employeeId)
      .is('deleted_at', null)
      .is('parent_task_id', null)

    if (status) {
      if (Array.isArray(status)) individualQuery = individualQuery.in('status', status)
      else individualQuery = individualQuery.eq('status', status)
    }

    const { data: individualTasks, error: individualError } = await individualQuery
      .order('due_at', { ascending: true, nullsFirst: false })
      .limit(limit)

    if (individualError) throw individualError

    let allTasks = individualTasks || []

    if (includeTeamTasks) {
      const { data: teamMemberships } = await db()
        .from('team_members')
        .select('team_id')
        .eq('employee_id', employeeId)
        .eq('is_active', true)

      const teamIds = teamMemberships?.map(tm => tm.team_id) || []

      if (teamIds.length > 0) {
        let teamQuery = db()
          .from('tasks')
          .select(`
            *,
            team:team_id (id, name, color),
            category:category_id (id, name, color, icon),
            created_by_admin:created_by_admin_id (id, first_name, last_name)
          `)
          .in('team_id', teamIds)
          .is('deleted_at', null)
          .is('parent_task_id', null)

        if (status) {
          if (Array.isArray(status)) teamQuery = teamQuery.in('status', status)
          else teamQuery = teamQuery.eq('status', status)
        }

        const { data: teamTasks, error: teamError } = await teamQuery
          .order('due_at', { ascending: true, nullsFirst: false })
          .limit(limit)

        if (!teamError && teamTasks) {
          allTasks = [...allTasks, ...teamTasks]
        }
      }
    }

    const uniqueTasksMap = new Map()
    allTasks.forEach(task => {
      if (!uniqueTasksMap.has(task.id)) uniqueTasksMap.set(task.id, task)
    })
    allTasks = Array.from(uniqueTasksMap.values())

    const taskIds = allTasks.map(t => t.id)

    if (taskIds.length > 0) {
      const { data: comments } = await db()
        .from('task_comments')
        .select('*')
        .in('task_id', taskIds)
        .is('deleted_at', null)
        .order('created_at', { ascending: true })

      const { data: attachments } = await db()
        .from('task_attachments')
        .select('*')
        .in('task_id', taskIds)
        .is('deleted_at', null)
        .order('uploaded_at', { ascending: false })

      const commentsByTask = {}
      ;(comments || []).forEach(comment => {
        if (!commentsByTask[comment.task_id]) commentsByTask[comment.task_id] = []
        commentsByTask[comment.task_id].push(comment)
      })

      const attachmentsByTask = {}
      ;(attachments || []).forEach(att => {
        if (!attachmentsByTask[att.task_id]) attachmentsByTask[att.task_id] = []
        attachmentsByTask[att.task_id].push(att)
      })

      allTasks = allTasks.map(task => ({
        ...task,
        comments: commentsByTask[task.id] || [],
        attachments: attachmentsByTask[task.id] || [],
      }))
    }

    const priorityOrder = { critical: 0, high: 1, medium: 2, low: 3 }
    allTasks.sort((a, b) => {
      if (a.due_at && b.due_at) {
        const diff = new Date(a.due_at) - new Date(b.due_at)
        if (diff !== 0) return diff
      } else if (a.due_at) return -1
      else if (b.due_at) return 1

      return (priorityOrder[a.priority] || 2) - (priorityOrder[b.priority] || 2)
    })

    return { data: allTasks.slice(0, limit), error: null }
  } catch (error) {
    console.error('Erreur getEmployeeTasks:', error)
    return { data: null, error }
  }
}

// ============================================================
// HELPERS
// ============================================================

export function formatDuration(seconds) {
  if (!seconds || seconds <= 0) return '—'

  const hours = Math.floor(seconds / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  const secs = seconds % 60

  if (hours > 0) return `${hours}h ${minutes.toString().padStart(2, '0')}min`
  if (minutes > 0) return `${minutes}min ${secs.toString().padStart(2, '0')}s`
  return `${secs}s`
}

export function getDeadlineStatus(dueAt) {
  if (!dueAt) return { overdue: false, text: 'Sans deadline', urgency: 'none' }

  const now = new Date()
  const deadline = new Date(dueAt)
  const diff = deadline - now
  const diffHours = diff / (1000 * 60 * 60)
  const diffDays = diff / (1000 * 60 * 60 * 24)

  if (diff < 0) {
    const overdueDays = Math.abs(Math.floor(diffDays))
    const overdueHours = Math.abs(Math.floor(diffHours))

    if (overdueDays >= 1) {
      return { overdue: true, text: `En retard de ${overdueDays}j`, urgency: 'critical' }
    }
    return { overdue: true, text: `En retard de ${overdueHours}h`, urgency: 'critical' }
  }

  if (diffHours < 2) return { overdue: false, text: 'Moins de 2h', urgency: 'critical' }
  if (diffHours < 24) return { overdue: false, text: `${Math.floor(diffHours)}h restantes`, urgency: 'high' }
  if (diffDays < 3) return { overdue: false, text: `${Math.floor(diffDays)}j restants`, urgency: 'medium' }
  if (diffDays < 7) return { overdue: false, text: `${Math.floor(diffDays)} jours`, urgency: 'low' }

  return { overdue: false, text: `${Math.floor(diffDays)} jours`, urgency: 'none' }
}

export function getStatusColor(status) {
  const colors = {
    [TASK_STATUS.ASSIGNED]: '#6B7280',
    [TASK_STATUS.SEEN]: '#8B5CF6',
    [TASK_STATUS.IN_PROGRESS]: '#F59E0B',
    [TASK_STATUS.PAUSED]: '#6366F1',
    [TASK_STATUS.COMPLETED]: '#3B82F6',
    [TASK_STATUS.VALIDATED]: '#10B981',
    [TASK_STATUS.REJECTED]: '#EF4444',
    [TASK_STATUS.CANCELLED]: '#9CA3AF',
  }
  return colors[status] || '#6B7280'
}

export function getStatusLabel(status) {
  const labels = {
    [TASK_STATUS.ASSIGNED]: 'Assignée',
    [TASK_STATUS.SEEN]: 'Vue',
    [TASK_STATUS.IN_PROGRESS]: 'En cours',
    [TASK_STATUS.PAUSED]: 'En pause',
    [TASK_STATUS.COMPLETED]: 'Terminée',
    [TASK_STATUS.VALIDATED]: 'Validée',
    [TASK_STATUS.REJECTED]: 'Rejetée',
    [TASK_STATUS.CANCELLED]: 'Annulée',
  }
  return labels[status] || status
}

export function getPriorityColor(priority) {
  const colors = {
    low: '#10B981',
    medium: '#F59E0B',
    high: '#F97316',
    critical: '#EF4444',
  }
  return colors[priority] || '#6B7280'
}

export function getPriorityLabel(priority) {
  const labels = {
    low: 'Basse',
    medium: 'Moyenne',
    high: 'Haute',
    critical: 'Critique',
  }
  return labels[priority] || priority
}

// ============================================================
// EXPORT PAR DÉFAUT
// ============================================================

export default {
  TASK_STATUS,
  TASK_PRIORITY,
  TASK_DIFFICULTY,
  TASK_TYPE,

  getTasks,
  getTaskById,
  createTask,
  updateTask,
  deleteTask,

  markTaskAsSeen,
  startTask,
  pauseTask,
  resumeTask,
  completeTask,

  validateTask,
  rejectTask,
  reassignRejectedTask,

  addTaskAttachment,
  deleteTaskAttachment,
  uploadTaskAttachmentFile,

  addTaskComment,
  getTaskComments,

  getTaskCategories,
  createTaskCategory,
  updateTaskCategory,
  deleteTaskCategory,

  getTaskStats,
  getTaskStatsByEmployee,
  getEmployeeTasks,

  formatDuration,
  getDeadlineStatus,
  getStatusColor,
  getStatusLabel,
  getPriorityColor,
  getPriorityLabel,
}


// ============================================================
// 🆕 PRÉDICTIONS & ANALYTICS POUR LA PAGE TASKS
// ============================================================

export async function predictTaskDuration(enterpriseId, params = {}) {
  const { category_id = null, employee_id = null, team_id = null, difficulty = 'medium' } = params

  try {
    let baseDuration = 60
    let confidence = 'low'
    let factors = []

    if (category_id) {
      const { data: category } = await db()
        .from('task_categories')
        .select('avg_duration_minutes, name')
        .eq('id', category_id)
        .single()

      if (category?.avg_duration_minutes) {
        baseDuration = category.avg_duration_minutes
        confidence = 'medium'
        factors.push({ type: 'category', name: category.name, value: category.avg_duration_minutes })
      } else {
        const { data: categoryTasks } = await db()
          .from('tasks')
          .select('actual_duration_seconds, expected_duration_minutes')
          .eq('category_id', category_id)
          .eq('enterprise_id', enterpriseId)
          .in('status', ['completed', 'validated'])
          .is('deleted_at', null)

        if (categoryTasks && categoryTasks.length >= 3) {
          const actualMinutes = categoryTasks
            .filter(t => t.actual_duration_seconds > 0)
            .map(t => t.actual_duration_seconds / 60)

          if (actualMinutes.length > 0) {
            baseDuration = Math.round(actualMinutes.reduce((a, b) => a + b, 0) / actualMinutes.length)
            confidence = 'medium'
            factors.push({ type: 'category_history', count: actualMinutes.length, value: baseDuration })
          }
        }
      }
    }

    let employeeFactor = 1.0
    if (employee_id) {
      const { data: employeeTasks } = await db()
        .from('tasks')
        .select('actual_duration_seconds, expected_duration_minutes')
        .eq('assigned_employee_id', employee_id)
        .in('status', ['completed', 'validated'])
        .is('deleted_at', null)
        .not('actual_duration_seconds', 'is', null)
        .not('expected_duration_minutes', 'is', null)
        .limit(50)

      if (employeeTasks && employeeTasks.length >= 5) {
        const ratios = employeeTasks
          .filter(t => t.expected_duration_minutes > 0 && t.actual_duration_seconds > 0)
          .map(t => (t.actual_duration_seconds / 60) / t.expected_duration_minutes)

        if (ratios.length > 0) {
          employeeFactor = ratios.reduce((a, b) => a + b, 0) / ratios.length
          confidence = 'high'

          const label = employeeFactor <= 0.9 ? 'rapide' : employeeFactor <= 1.1 ? 'normal' : 'lent'
          factors.push({
            type: 'employee_productivity',
            factor: Math.round(employeeFactor * 100) / 100,
            label,
            sample_size: ratios.length
          })
        }
      }
    }

    const difficultyFactors = {
      easy: 0.7,
      medium: 1.0,
      hard: 1.4,
      critical: 1.8
    }
    const difficultyFactor = difficultyFactors[difficulty] || 1.0
    factors.push({ type: 'difficulty', value: difficulty, factor: difficultyFactor })

    const predictedMinutes = Math.round(baseDuration * employeeFactor * difficultyFactor)

    return {
      data: {
        predicted_minutes: predictedMinutes,
        base_duration: baseDuration,
        employee_factor: Math.round(employeeFactor * 100) / 100,
        difficulty_factor: difficultyFactor,
        confidence,
        factors,
        message:
          confidence === 'high'
            ? `Durée suggérée : ${predictedMinutes} min`
            : confidence === 'medium'
              ? `Estimation : ${predictedMinutes} min`
              : `Estimation par défaut : ${predictedMinutes} min`
      },
      error: null
    }
  } catch (error) {
    console.error('Erreur predictTaskDuration:', error)
    return { data: null, error }
  }
}

export async function checkEmployeeWorkload(employeeId, enterpriseId, options = {}) {
  const { newTaskDuration = 0, newTaskDueAt = null } = options

  try {
    const { data: activeTasks } = await db()
      .from('tasks')
      .select('id, title, status, due_at, expected_duration_minutes, priority')
      .eq('assigned_employee_id', employeeId)
      .eq('enterprise_id', enterpriseId)
      .in('status', ['assigned', 'seen', 'in_progress', 'paused'])
      .is('deleted_at', null)

    const currentTasks = activeTasks || []
    const totalMinutes = currentTasks.reduce((sum, t) => sum + (t.expected_duration_minutes || 30), 0)
    const totalHours = Math.round((totalMinutes / 60) * 10) / 10
    const newTotalHours = Math.round(((totalMinutes + newTaskDuration) / 60) * 10) / 10

    const now = new Date()
    const overdueTasks = currentTasks.filter(t => t.due_at && new Date(t.due_at) < now)
    const criticalTasks = currentTasks.filter(t => t.priority === 'critical' || t.priority === 'high')

    let leaveConflict = null

    if (newTaskDueAt) {
      const dueDate = new Date(newTaskDueAt).toISOString().split('T')[0]

      const { data: absences } = await db()
        .from('absences')
        .select('start_date, end_date, reason')
        .eq('employee_id', employeeId)
        .lte('start_date', dueDate)
        .gte('end_date', dueDate)

      if (absences && absences.length > 0) {
        leaveConflict = {
          start_date: absences[0].start_date,
          end_date: absences[0].end_date,
          reason: absences[0].reason,
          message: `Absent du ${new Date(absences[0].start_date).toLocaleDateString('fr-FR')} au ${new Date(absences[0].end_date).toLocaleDateString('fr-FR')}`
        }
      }
    }

    let deadlineConflicts = []
    if (newTaskDueAt) {
      const newDueDate = new Date(newTaskDueAt).toISOString().split('T')[0]
      deadlineConflicts = currentTasks.filter(t => {
        if (!t.due_at) return false
        const taskDueDate = new Date(t.due_at).toISOString().split('T')[0]
        return taskDueDate === newDueDate
      })
    }

    let severity = 'ok'
    let warnings = []

    if (leaveConflict) {
      severity = 'critical'
      warnings.push({ type: 'leave_conflict', message: leaveConflict.message, data: leaveConflict })
    }

    if (overdueTasks.length > 0) {
      severity = severity === 'critical' ? 'critical' : 'warning'
      warnings.push({
        type: 'overdue_tasks',
        message: `${overdueTasks.length} tâche(s) en retard`,
        count: overdueTasks.length
      })
    }

    if (newTotalHours >= 10) {
      severity = 'critical'
      warnings.push({ type: 'overload', message: `Charge totale: ${newTotalHours}h` })
    } else if (newTotalHours >= 6) {
      severity = severity === 'critical' ? 'critical' : 'warning'
      warnings.push({ type: 'high_load', message: `Charge totale: ${newTotalHours}h` })
    }

    if (deadlineConflicts.length >= 2) {
      severity = severity === 'critical' ? 'critical' : 'warning'
      warnings.push({
        type: 'deadline_conflict',
        message: `${deadlineConflicts.length} autres tâches dues le même jour`,
        tasks: deadlineConflicts.map(t => ({ id: t.id, title: t.title }))
      })
    }

    if (criticalTasks.length >= 3) {
      warnings.push({
        type: 'critical_tasks',
        message: `${criticalTasks.length} tâches prioritaires en cours`
      })
    }

    return {
      data: {
        current_tasks_count: currentTasks.length,
        current_hours: totalHours,
        new_total_hours: newTotalHours,
        overdue_count: overdueTasks.length,
        critical_count: criticalTasks.length,
        severity,
        warnings,
        leave_conflict: leaveConflict,
        deadline_conflicts: deadlineConflicts,
        can_assign: severity !== 'critical' || warnings.every(w => w.type !== 'leave_conflict')
      },
      error: null
    }
  } catch (error) {
    console.error('Erreur checkEmployeeWorkload:', error)
    return { data: null, error }
  }
}

export async function getTaskAlerts(enterpriseId) {
  try {
    const alerts = []
    const now = new Date()

    const { data: inProgressTasks } = await db()
      .from('tasks')
      .select(`
        id, title, status, started_at, expected_duration_minutes, due_at, priority,
        assigned_employee:assigned_employee_id (first_name, last_name),
        team:team_id (name)
      `)
      .eq('enterprise_id', enterpriseId)
      .eq('status', 'in_progress')
      .is('deleted_at', null)
      .not('started_at', 'is', null)

    inProgressTasks?.forEach(task => {
      if (!task.started_at || !task.expected_duration_minutes) return

      const startedAt = new Date(task.started_at)
      const elapsedMinutes = (now - startedAt) / (1000 * 60)
      const expectedMinutes = task.expected_duration_minutes
      const ratio = elapsedMinutes / expectedMinutes

      if (ratio >= 1.5) {
        alerts.push({
          id: `overrun-${task.id}`,
          type: 'time_overrun',
          severity: 'critical',
          task_id: task.id,
          task_title: task.title,
          message: `"${task.title}" dépasse le temps prévu`,
        })
      } else if (ratio >= 0.8) {
        alerts.push({
          id: `risk-${task.id}`,
          type: 'delay_risk',
          severity: 'warning',
          task_id: task.id,
          task_title: task.title,
          message: `"${task.title}" approche du temps limite`,
        })
      }
    })

    const severityOrder = { critical: 0, warning: 1, info: 2 }
    alerts.sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity])

    return {
      data: alerts,
      count: alerts.length,
      by_severity: {
        critical: alerts.filter(a => a.severity === 'critical').length,
        warning: alerts.filter(a => a.severity === 'warning').length,
        info: alerts.filter(a => a.severity === 'info').length
      },
      error: null
    }
  } catch (error) {
    console.error('Erreur getTaskAlerts:', error)
    return { data: [], count: 0, error }
  }
}

export async function suggestAssignees(enterpriseId, taskParams = {}) {
  const { task_type = 'individual' } = taskParams

  try {
    if (task_type === 'individual') {
      const { data: employees } = await db()
        .from('employees')
        .select('id, first_name, last_name, position, department')
        .eq('enterprise_id', enterpriseId)
        .eq('is_active', true)

      const suggestions = (employees || []).map(emp => ({
        employee_id: emp.id,
        employee_name: `${emp.first_name} ${emp.last_name}`,
        position: emp.position,
        department: emp.department,
        score: 50,
        factors: [],
        workload_hours: 0,
        is_available: true
      }))

      return {
        data: {
          type: 'individual',
          suggestions: suggestions.slice(0, 5),
          best_match: suggestions[0] || null
        },
        error: null
      }
    }

    const { data: teams } = await db()
      .from('teams')
      .select('id, name, color')
      .eq('enterprise_id', enterpriseId)
      .eq('is_active', true)
      .is('deleted_at', null)

    const suggestions = (teams || []).map(team => ({
      team_id: team.id,
      team_name: team.name,
      team_color: team.color,
      member_count: 0,
      score: 50,
      factors: [],
      completion_rate: 0
    }))

    return {
      data: {
        type: 'team',
        suggestions: suggestions.slice(0, 5),
        best_match: suggestions[0] || null
      },
      error: null
    }
  } catch (error) {
    console.error('Erreur suggestAssignees:', error)
    return { data: null, error }
  }
}

export async function updateCategoryStats(categoryId) {
  try {
    const { data: tasks } = await db()
      .from('tasks')
      .select('actual_duration_seconds')
      .eq('category_id', categoryId)
      .in('status', ['completed', 'validated'])
      .is('deleted_at', null)
      .not('actual_duration_seconds', 'is', null)

    if (tasks && tasks.length > 0) {
      const avgMinutes = Math.round(
        tasks.reduce((sum, t) => sum + (t.actual_duration_seconds / 60), 0) / tasks.length
      )

      await db()
        .from('task_categories')
        .update({
          avg_duration_minutes: avgMinutes,
          total_tasks_completed: tasks.length,
          updated_at: new Date().toISOString()
        })
        .eq('id', categoryId)
    }
  } catch (error) {
    console.error('Erreur updateCategoryStats:', error)
  }
}