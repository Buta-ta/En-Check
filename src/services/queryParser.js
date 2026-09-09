// src/services/queryParser.js
// (MAJ)
// - "fiche de paie <nom|matricule>" => PAYSLIP_SEARCH + employeeTerm
// - commandes naturelles absents/retards/stats
// - évite le bug "tout devient EMPLOYEE_SEARCH"

export function parseQuery(query, admin) {
  const original = String(query || '').trim()
  const q = original.toLowerCase().trim()

  if (!q) return { type: 'GLOBAL_SEARCH', searchTerm: '', filters: {} }

  // commandes slash
  if (q.startsWith('/')) return parseSlashCommand(q)

  // commandes naturelles
  if (q.startsWith('absent') || q.startsWith('absents')) return { type: 'COMMAND', command: 'absents', args: [] }
  if (q.startsWith('retard') || q.startsWith('retards')) return { type: 'COMMAND', command: 'retards', args: [] }
  if (q.includes('stats')) return { type: 'COMMAND', command: 'stats', args: [] }

  // heures
  if (detectHoursQuery(q)) return parseHoursQuery(original)

  // tâches
  if (detectTaskQuery(q)) return parseTaskQuery(q)

  // pointages
  if (detectAttendanceQuery(q)) return parseAttendanceQuery(q)

  // absences “congé/maladie/demandes”
  if (detectAbsenceQuery(q)) return parseAbsenceQuery(q)

  // paie
  if (detectPayslipQuery(q)) return parsePayslipQuery(original)

  // employé (si c’est juste un nom/matricule)
  if (detectEmployeeQuery(q)) return parseEmployeeQuery(original)

  return { type: 'GLOBAL_SEARCH', searchTerm: original, filters: {} }
}

function parseSlashCommand(q) {
  const parts = q.slice(1).split(' ').filter(Boolean)
  return { type: 'COMMAND', command: parts[0] || '', args: parts.slice(1) }
}

function parseHoursQuery(original) {
  const lower = original.toLowerCase()
  return {
    type: 'EMPLOYEE_HOURS',
    employeeSearchTerm: cleanupHoursQueryToEmployeeTerm(lower) || null,
    employeeMatricule: extractMatricule(original),
    period: extractPeriod(lower),
    filters: {},
  }
}

function cleanupHoursQueryToEmployeeTerm(lowerQuery) {
  let s = lowerQuery
  s = s.replace(/\b(heures?|heure|temps|travaill[ée]s?|travail)\b/g, ' ')
  s = s.replace(/\b(de|du|des|pour|chez|sur|d’|d')\b/g, ' ')
  s = s.replace(/\b(aujourd['’]?hui|hier|cette semaine|semaine|ce mois|mois|cette ann[eé]e|ann[eé]e)\b/g, ' ')
  s = s.replace(/\b(janvier|février|fevrier|mars|avril|mai|juin|juillet|août|aout|septembre|octobre|novembre|décembre|decembre)\b/g, ' ')
  s = s.replace(/\b(20\d{2})\b/g, ' ')
  s = s.replace(/\s+/g, ' ').trim()
  return s
}

function parseTaskQuery(q) {
  const teamMatch = q.match(/équipe\s+([a-z0-9_\-àâäéèêëïîôùûüç]+)/i)
  return {
    type: 'TASK_SEARCH',
    filters: {
      priority: extractPriority(q),
      status: extractTaskStatus(q),
      teamName: teamMatch ? teamMatch[1] : null,
    },
  }
}

function parseAttendanceQuery(q) {
  const type = q.includes('entrée') || q.includes('entree') ? 'in' : q.includes('sortie') ? 'out' : null
  return {
    type: 'ATTENDANCE_SEARCH',
    period: extractPeriod(q),
    filters: { type, method: extractMethod(q) },
  }
}

function parseAbsenceQuery(q) {
  return {
    type: 'ABSENCE_SEARCH',
    period: extractPeriod(q),
    filters: {
      status: extractStatus(q, ['en_attente', 'approuve', 'rejete']),
      reason: extractAbsenceReason(q),
    },
  }
}

// ✅ PAYSLIPS : "fiche de paie sara" => employeeTerm = "sara"
function parsePayslipQuery(original) {
  const lower = original.toLowerCase()

  let employeeTerm = String(original || '')
  employeeTerm = employeeTerm
    .replace(/fiche(s)?\s+de\s+paie/ig, ' ')
    .replace(/bulletin(s)?\s+de\s+paie/ig, ' ')
    .replace(/\b(fiche|bulletin|paie|salaire)\b/ig, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  return {
    type: 'PAYSLIP_SEARCH',
    period: extractPeriod(lower),
    employeeTerm: employeeTerm || null,
    filters: {},
  }
}

function parseEmployeeQuery(original) {
  const lower = original.toLowerCase()
  return {
    type: 'EMPLOYEE_SEARCH',
    searchTerm: original,
    filters: { matricule: extractMatricule(original), department: extractDepartment(lower) },
  }
}

// Detecteurs
function detectHoursQuery(q) { return /\b(heures?|heure|temps|travaill[ée]s?)\b/.test(q) }
function detectTaskQuery(q) { return q.includes('tâche') || q.includes('tache') || q.includes('urgent') || q.includes('tâches') || q.includes('taches') }
function detectAttendanceQuery(q) { return q.includes('pointage') || q.includes('entrée') || q.includes('entree') || q.includes('sortie') }
function detectAbsenceQuery(q) { return q.includes('congé') || q.includes('conge') || q.includes('maladie') || q.includes('absence') }
function detectPayslipQuery(q) { return q.includes('paie') || q.includes('fiche') || q.includes('bulletin') || q.includes('salaire') }

function detectEmployeeQuery(q) {
  if (/[A-Z]{2,6}[-_ ]?\d{2,}/i.test(q)) return true
  const parts = q.split(' ').filter(Boolean)
  if (parts.length >= 2) return true
  if (parts.length === 1 && parts[0].length >= 3) return true
  return false
}

// Extracteurs
function extractMatricule(query) {
  const s = String(query || '')
  const match = s.match(/([A-Z]{2,6}[-_ ]?\d{2,})/i)
  return match ? match[1] : null
}

function extractPeriod(q) {
  if (q.includes("aujourd'hui") || q.includes('aujourdhui')) return 'today'
  if (q.includes('hier')) return 'yesterday'
  if (q.includes('semaine')) return 'week'
  if (q.includes('mois')) return 'month'
  if (q.includes('année') || q.includes('annee')) return 'year'
  return 'today'
}

function extractMethod(q) {
  if (q.includes('qr')) return 'qr_code'
  if (q.includes('pin')) return 'pin'
  if (q.includes('face')) return 'face'
  if (q.includes('photo')) return 'pin_photo'
  return null
}

function extractPriority(q) {
  if (q.includes('urgent')) return 'urgent'
  if (q.includes('high') || q.includes('haute')) return 'high'
  if (q.includes('medium') || q.includes('moyenne')) return 'medium'
  if (q.includes('low') || q.includes('basse')) return 'low'
  return null
}

function extractTaskStatus(q) {
  if (q.includes('en cours')) return 'in_progress'
  if (q.includes('termin') || q.includes('complét') || q.includes('complete')) return 'completed'
  if (q.includes('retard')) return 'overdue'
  if (q.includes('valid')) return 'validated'
  return null
}

function extractStatus(q, valid) {
  for (const s of valid) if (q.includes(s)) return s
  if (q.includes('en attente')) return 'en_attente'
  if (q.includes('approuv')) return 'approuve'
  if (q.includes('rejet')) return 'rejete'
  return null
}

function extractAbsenceReason(q) {
  if (q.includes('maladie')) return 'maladie'
  if (q.includes('matern')) return 'maternite'
  if (q.includes('formation')) return 'formation'
  return null
}

function extractDepartment(q) {
  const match = q.match(/département\s+([a-zàâäéèêëïîôùûüç]+)/i)
  return match ? match[1] : null
}