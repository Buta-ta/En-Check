import { getPartsLocaux, heureLocaleVersUTC, isValidTimezone, formaterHeureLocaleShort } from '../utils/timezoneUtils'
import { construireRetards } from './retardsService'

export const RH_QUESTIONS = {
  pointages: 'Combien de pointages',
  retards: 'Qui est en retard',
  confirmations: 'Sorties présumées à confirmer',
}
const normalized = value => String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[’]/g, "'").replace(/[?!.,]/g, '').trim().replace(/\s+/g, ' ')
const dayAfter = (date, days = 1) => new Date(Date.parse(`${date}T12:00:00Z`) + days * 86400000).toISOString().slice(0, 10)
const choices = intent => ["aujourd'hui", 'les 7 derniers jours', 'la semaine précédente'].map(period => `${RH_QUESTIONS[intent]} ${period}`)

export function parseRhQuestion(query, previous) {
  let text = normalized(query).replace(/^(bonjour|bonsoir|salut)\s+/, '').replace(/\s+s'il te plait$/, '').replace(/\bde (?:la|cette) semaine$/, 'cette semaine')
  let period = null
  const match = text.match(/(?:^|\s)(aujourd'hui|hier|cette semaine|les 7 derniers jours|la semaine precedente|\d{4}-\d{2}-\d{2})$/)
  if (match) { period = match[1]; text = text.slice(0, match.index).trim() }
  if ((!text || text === 'et') && period && previous?.intent && RH_QUESTIONS[previous.intent]) return { intent: previous.intent, period }
  if ((!text || text === 'et') && period) return { unsupported: true }
  const intent = /^(combien de pointages|pointages|montre les pointages|montre-moi les pointages|montre moi les pointages|affiche les pointages|les pointages)$/.test(text) ? 'pointages'
    : /^(qui est en retard|quels sont les retards|retards|montre les retards)$/.test(text) ? 'retards'
      : /^(sorties presumees a confirmer|quelles sorties restent a confirmer|montre les sorties presumees a confirmer)$/.test(text) ? 'confirmations' : null
  if (intent) return { intent, period }
  // Do not silently discard a person's name, an unsupported date or extra filter.
  if (/pointage|retard|sortie.*confirm|presumee/.test(text)) return { unsupported: true }
  return null
}

export function rhPeriod(period, timezone, now) {
  const today = getPartsLocaux(now, timezone).jourISO
  if (period === "aujourd'hui") return { from: today, to: today }
  if (period === 'hier') return { from: dayAfter(today, -1), to: dayAfter(today, -1) }
  if (period === 'les 7 derniers jours') return { from: dayAfter(today, -6), to: today }
  if (period === 'la semaine precedente') {
    const weekday = new Date(`${today}T12:00:00Z`).getUTCDay()
    const monday = dayAfter(today, -(weekday === 0 ? 6 : weekday - 1))
    return { from: dayAfter(monday, -7), to: dayAfter(monday, -1) }
  }
  if (period === 'cette semaine') {
    const weekday = new Date(`${today}T12:00:00Z`).getUTCDay()
    return { from: dayAfter(today, -(weekday === 0 ? 6 : weekday - 1)), to: today }
  }
  if (/^\d{4}-\d{2}-\d{2}$/.test(period || '') && Number.isFinite(Date.parse(`${period}T12:00:00Z`)) &&
      new Date(`${period}T12:00:00Z`).toISOString().slice(0, 10) === period && period <= today) return { from: period, to: period }
  return null
}

export async function answerRhQuestion({ query, admin, client, previous, now = new Date(), loadHolidays }) {
  const enterprise = admin?.selectedEnterprise?.id || admin?.enterprise_id
  const parsed = parseRhQuestion(query, previous?.enterprise === enterprise ? previous : null)
  if (!parsed) return null
  if (parsed.unsupported) return { title: 'Précisons votre question', text: 'Je ne peux pas encore appliquer tous les critères de cette demande. Choisissez une question prise en charge, sans filtre individuel implicite.', choices: Object.values(RH_QUESTIONS) }
  const { intent, period } = parsed
  const context = { intent, enterprise }
  if (!enterprise) return { title: 'Quelle entreprise ?', text: 'Sélectionnez une entreprise dans En-Check, puis posez votre question.' }
  if (!period) return { title: 'Pour quelle période ?', text: 'Choisissez une période ou indiquez une date au format AAAA-MM-JJ. « Cette semaine » signifie du lundi à aujourd’hui.', choices: choices(intent), context }
  try {
    const { data: auth, error: authError } = await client.auth.getUser()
    if (authError || !auth?.user) throw Error('session')
    const { data: permitted, error: accessError } = await client.rpc('encheck_est_admin_de', { p_enterprise: enterprise })
    if (accessError || permitted !== true) return { title: 'Accès non confirmé', text: 'Vos droits sur cette entreprise n’ont pas pu être confirmés. Aucun résultat RH n’est affiché.' }
    const { data: company, error: companyError } = await client.from('enterprises').select('id,name,timezone').eq('id', enterprise).maybeSingle()
    if (companyError || !company || !isValidTimezone(company.timezone)) throw Error('timezone')
    const dates = rhPeriod(period, company.timezone, now)
    if (!dates) return { title: 'Date à préciser', text: 'Choisissez une date valide, non future, ou une période proposée.', choices: choices(intent), context }
    const common = { context, period: `${dates.from} → ${dates.to}`, timezone: company.timezone,
      enterprise: company.name, periodHint: period === 'cette semaine' ? (dates.from === dates.to ? 'Nous sommes lundi : depuis le début de cette semaine, la période couvre aujourd’hui uniquement.' : 'Cette période couvre le début de la semaine jusqu’à aujourd’hui.') : null, updatedAt: now.toISOString(), choices: choices(intent) }
    if (intent === 'retards') {
      // Keep the same SQL source and presentation/holiday rules as the Retards page.
      const holidays = await loadHolidays(enterprise, dates.from, dates.to)
      const { data, error } = await client.rpc('encheck_retards_plage', { p_enterprise: enterprise, p_du: dates.from, p_au: dates.to }).range(0, 500)
      if (error || !Array.isArray(data)) throw Error('retards')
      if (data.some(row => row.enterprise_id !== enterprise)) throw Error('scope')
      const partial = data.length >= 501
      const subset = data.slice(0, 500)
      const { retards, stats } = construireRetards(subset, { [enterprise]: new Set(holidays.filter(h => !h.is_worked).map(h => h.date)) })
      return { ...common, title: 'Retards signalés', source: 'encheck_retards_plage + règles de présentation Retards + jours fériés',
        text: `Je retrouve ${stats.totalRetards} retard${stats.totalRetards > 1 ? 's' : ''} concernant ${stats.employesEnRetard} personne${stats.employesEnRetard > 1 ? 's' : ''} dans ${partial ? 'l’échantillon consulté' : 'les données consultées'}.`,
        warning: partial ? 'Résultat partiel : les totaux complets ne sont pas disponibles.' : stats.employesSansPlanningIgnores ? 'Certaines personnes ne peuvent pas être évaluées faute de planning exploitable.' : null,
        notes: [partial ? 'Lecture limitée à 500 lignes du moteur : aucun total global garanti.' : 'Résultats limités aux données accessibles et renvoyées par le serveur.',
          `${stats.employesSansPlanningIgnores} personne(s) sans grille/planning exploitable dans ces données : ne pas les considérer comme ponctuelles.`,
          'Aucune cause de retard n’est déduite. Aucune décision disciplinaire ou de paie n’est prise.'],
        resultHint: retards.length > 20 ? `Les 20 premiers retards sont affichés sur ${retards.length} dans les données consultées.` : null,
        path: '/retards', rows: retards.slice(0, 20).map(row => ({ id: row.id || `${row.employee.id}-${row.date}`, label: `${row.employee.first_name || ''} ${row.employee.last_name || ''}`.trim(), detail: `${row.date} · ${row.retardMinutes} min de retard` })) }
    }
    let request = client.from('attendances').select('id,check_time,check_type,is_auto_closed,employees(first_name,last_name)', { count: 'exact' })
      .eq('enterprise_id', enterprise)
      .gte('check_time', heureLocaleVersUTC(dates.from, 0, 0, 0, company.timezone))
      .lt('check_time', heureLocaleVersUTC(dayAfter(dates.to), 0, 0, 0, company.timezone))
    if (intent === 'confirmations') request = request.eq('check_type', 'out').eq('is_auto_closed', true)
      .is('estimation_validee_le', null).is('estimation_remplacee_le', null)
    const { data, count, error } = await request.order('check_time', { ascending: false }).order('id', { ascending: true }).limit(20)
    if (error || !Array.isArray(data) || !Number.isSafeInteger(count) || count < 0) throw Error('attendance')
    return { ...common, title: intent === 'confirmations' ? 'Sorties présumées enregistrées à confirmer' : 'Pointages enregistrés', source: 'Table attendances · lecture autorisée · date locale de chaque ligne',
      text: intent === 'confirmations' ? `Je retrouve ${count} sortie${count > 1 ? 's' : ''} présumée${count > 1 ? 's' : ''} enregistrée${count > 1 ? 's' : ''} à confirmer sur cette période.`
        : `Je retrouve ${count} enregistrement${count > 1 ? 's' : ''} de pointage pour ${company.name} sur cette période.`,
      warning: intent === 'confirmations' ? 'Les propositions virtuelles ne sont pas incluses : ce résultat ne garantit pas que tout est confirmé.' : null,
      notes: [intent === 'confirmations' ? 'Les propositions virtuelles calculées à l’ouverture de Pointages ne sont pas incluses. Même un résultat à zéro ne signifie pas que tout est confirmé.'
        : 'Ce n’est ni un nombre d’employés présents ni un total d’heures travaillées. Entrées, sorties et éventuelles estimations enregistrées sont comptées comme des lignes distinctes. Le rattachement des nuits au jour travaillé n’est pas recalculé ici.',
        'Au maximum 20 lignes affichées. Les heures présumées ne deviennent pas des heures validées par cette consultation.'],
      resultHint: count > 20 ? `Les 20 derniers enregistrements sont affichés sur ${count}.` : null,
      path: '/pointages', rows: data.map(row => ({ id: row.id, label: `${row.employees?.first_name || ''} ${row.employees?.last_name || ''}`.trim() || 'Employé non visible',
        badge: row.is_auto_closed ? 'Estimation' : row.check_type === 'in' ? 'Entrée' : 'Sortie',
        detail: row.check_time && Number.isFinite(Date.parse(row.check_time)) ? `${getPartsLocaux(row.check_time, company.timezone).jourISO} · ${formaterHeureLocaleShort(row.check_time, company.timezone)}` : 'Heure indisponible' })) }
  } catch {
    return { title: 'Réponse RH indisponible', text: 'La session, les droits, le fuseau ou une source de données n’ont pas pu être vérifiés. Aucun chiffre de remplacement n’est inventé.', path: intent === 'retards' ? '/retards' : '/pointages' }
  }
}
