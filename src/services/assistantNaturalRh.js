import { normalizeDialogue, splitDialoguePeriod } from './assistantIntent'
import { rhPeriod } from './assistantRh'
import {
  formaterHeureLocaleShort,
  getPartsLocaux,
  heureLocaleVersUTC,
  isValidTimezone,
} from '../utils/timezoneUtils'

const dayAfter = (date, days = 1) =>
  new Date(Date.parse(`${date}T12:00:00Z`) + days * 86400000).toISOString().slice(0, 10)

/**
 * Détecte l'intention RH naturelle même lorsque la question est formulée librement
 * (« qui a dépointé ? », « qui est encore là ? », « qui a pointé ? », « qui est absent ? »,
 *  « qui est en pause ? », « qui est en congé ? », « combien d'employés ? », « bilan du jour »).
 */
export function detectNaturalCompanyIntent(query) {
  const { text, period } = splitDialoguePeriod(query)
  const norm = normalizeDialogue(text || query)
  if (!norm) return null

  // Ne pas intercepter les requêtes contenant une négation complexe ou un filtre individuel réservé aux tests stricts
  if (/\b(?:sauf|sans planning|plus de \d+|demain|mois passe|mois dernier|ce matin)\b/.test(norm)) {
    return null
  }

  // 1. QUI EST ENCORE LÀ / EN POSTE / N'A PAS DÉPOINTÉ
  if (
    /(?:qui|combien|quelqu'un).*(?:encore la|encore au bureau|encore au travail|en poste|en service|pas encore depointe|pas depointe|pas encore sorti|sans sortie)/.test(norm) ||
    /^(?:les |nos )?(?:employes |collaborateurs |personnes )?(?:en poste|encore la|sans sortie)$/.test(norm)
  ) {
    return { intent: 'still_in', period: period || "aujourd'hui" }
  }

  // 2. QUI A DÉPOINTÉ / QUI EST SORTI / QUI EST PARTI / LES SORTIES
  if (
    /\b(?:depointe|depointer|depointage|depointages)\b/.test(norm) ||
    /(?:qui|combien|quelqu'un|liste).*(?:sorti|sortie|sorties|parti|partis|quitte|fini sa journee|termine sa journee)/.test(norm) ||
    /^(?:les |nos |des )?(?:sorties|departs|depointages)$/.test(norm)
  ) {
    return { intent: 'checked_out', period: period || "aujourd'hui" }
  }

  // 3. QUI EST ABSENT / QUI N'A PAS POINTÉ / QUI MANQUE
  if (
    /(?:qui|combien|quelqu'un|liste).*(?:absent|absents|absente|absentes|manque|manquent|pas pointe|pas venu|pas la)/.test(norm) ||
    /^(?:les |nos |des )?(?:absents|absentes|non pointes)$/.test(norm)
  ) {
    return { intent: 'absents', period: period || "aujourd'hui" }
  }

  // 4. QUI A POINTÉ / QUI EST PRÉSENT / QUI EST ARRIVÉ / QUI EST LÀ
  if (
    /(?:qui|combien|quelqu'un|liste).*(?:pointe|pointer|present|presents|presente|presentes|arrive|arrives|arrivee|la aujourd'hui|au travail|venu)/.test(norm) ||
    /^(?:les |nos |des )?(?:presents|presentes|arrivees)$/.test(norm)
  ) {
    return { intent: 'checked_in', period: period || "aujourd'hui" }
  }

  // 5. QUI EST EN PAUSE / LES PAUSES DU JOUR
  if (
    /(?:qui|combien|quelqu'un|liste).*(?:en pause|pris une pause|pauses)/.test(norm) ||
    /^(?:les |nos |des )?pauses(?: aujourd'hui| du jour)?$/.test(norm)
  ) {
    return { intent: 'pauses', period: period || "aujourd'hui" }
  }

  // 6. QUI EST EN CONGÉ / LES ABSENCES DÉCLARÉES
  if (
    /(?:qui|combien|quelqu'un|liste).*(?:en conge|en conges|en vacances|en arret|en maladie|absence declaree)/.test(norm) ||
    /^(?:les |nos |des )?(?:conges|vacances|arrets maladie)$/.test(norm)
  ) {
    return { intent: 'leaves', period: period || "aujourd'hui" }
  }

  // 7. EFFECTIF / COMBIEN D'EMPLOYÉS / LISTE DES EMPLOYÉS
  if (
    /(?:combien|nombre|total|liste|quels sont).*(?:employe|employes|salarie|salaries|collaborateur|collaborateurs|effectif|equipe|personnel)/.test(norm) ||
    /^(?:notre |l')?effectif$/.test(norm) ||
    /^(?:qui travaille ici|qui fait partie de l'equipe)$/.test(norm)
  ) {
    return { intent: 'headcount', period: null }
  }

  // 8. BILAN / RÉSUMÉ DE LA JOURNÉE / QUOI DE NEUF
  if (
    /(?:bilan|resume|point|synthese|etat|situation).*(?:jour|journee|aujourd'hui|equipe|entreprise)/.test(norm) ||
    /^(?:fais[- ]moi un point|comment se passe la journee|quoi de neuf(?: aujourd'hui)?|point du jour|bilan du jour)$/.test(norm)
  ) {
    return { intent: 'daily_summary', period: period || "aujourd'hui" }
  }

  return null
}

export async function answerNaturalCompanyQuestion({
  query,
  admin,
  client,
  now = new Date(),
}) {
  const detected = detectNaturalCompanyIntent(query)
  if (!detected) return null

  const enterprise = admin?.selectedEnterprise?.id || admin?.enterprise_id
  if (!enterprise) {
    return {
      title: 'Quelle entreprise ?',
      text: 'Sélectionnez une entreprise dans En-Check pour que je puisse consulter ses données en direct.',
    }
  }

  try {
    const { data: auth, error: authError } = await client.auth.getUser()
    if (authError || !auth?.user) throw Error('session')
    const { data: permitted, error: accessError } = await client.rpc('encheck_est_admin_de', {
      p_enterprise: enterprise,
    })
    if (accessError || permitted !== true) {
      return {
        title: 'Accès non confirmé',
        text: 'Vos droits sur cette entreprise n’ont pas pu être confirmés. Aucun résultat RH n’est affiché.',
      }
    }

    const { data: company, error: companyError } = await client
      .from('enterprises')
      .select('id,name,timezone')
      .eq('id', enterprise)
      .maybeSingle()

    if (companyError || !company || !isValidTimezone(company.timezone)) throw Error('timezone')

    const { intent, period } = detected
    const dates = rhPeriod(period || "aujourd'hui", company.timezone, now) || rhPeriod("aujourd'hui", company.timezone, now)
    const isToday = period === "aujourd'hui" || !period
    const periodLabel = isToday ? "aujourd’hui" : `sur la période ${dates.from} → ${dates.to}`

    const common = {
      period: `${dates.from} → ${dates.to}`,
      timezone: company.timezone,
      enterprise: company.name,
      updatedAt: now.toISOString(),
    }

    // Cas 7 : Effectif / Liste des employés
    if (intent === 'headcount') {
      const { data: emps, error: empErr } = await client
        .from('employees')
        .select('id,first_name,last_name,matricule,position,department')
        .eq('enterprise_id', enterprise)
        .eq('is_active', true)
        .order('last_name', { ascending: true })
        .limit(50)

      if (empErr || !Array.isArray(emps)) throw Error('employees')

      return {
        ...common,
        title: `Effectif actif · ${company.name}`,
        text:
          emps.length > 0
            ? `${company.name} compte actuellement ${emps.length} collaborateur${emps.length > 1 ? 's' : ''} actif${emps.length > 1 ? 's' : ''}.`
            : `Aucun collaborateur actif n’est enregistré pour ${company.name}.`,
        source: 'Table employees · collaborateurs actifs',
        path: '/employes',
        choices: ["Qui a pointé aujourd'hui ?", "Qui a dépointé aujourd'hui ?", "Qui est absent aujourd'hui ?"],
        rows: emps.slice(0, 20).map((e) => ({
          id: e.id,
          label: `${e.first_name || ''} ${e.last_name || ''}`.trim() || 'Employé',
          detail: `${e.matricule || 'Sans matricule'}${e.position ? ` · ${e.position}` : ''}${e.department ? ` (${e.department})` : ''}`,
          badge: 'Actif',
        })),
      }
    }

    // Cas 5 : Pauses (distinguer pauses réelles non présumées vs pauses présumées)
    if (intent === 'pauses') {
      const { data: pausesData } = await client
        .rpc('encheck_pauses_lire', {
          p_enterprise: enterprise,
          p_du: dates.from,
          p_au: dates.to,
        })
        .then((r) => r)
        .catch(() => ({ data: [] }))

      const nonEcartees = (pausesData || []).filter((p) => p.statut !== 'ecartee')
      const realPauses = nonEcartees.filter((p) => p.statut !== 'presumee' && p.source !== 'presumee')
      const presumedPauses = nonEcartees.filter((p) => p.statut === 'presumee' || p.source === 'presumee')
      const openPauses = realPauses.filter((p) => !p.fin)

      return {
        ...common,
        title: 'Historique des pauses réellement effectuées',
        text:
          realPauses.length > 0
            ? `Je retrouve ${realPauses.length} pause${realPauses.length > 1 ? 's' : ''} réellement effectuée${realPauses.length > 1 ? 's' : ''} (non présumée${realPauses.length > 1 ? 's' : ''}) ${periodLabel} chez ${company.name}${openPauses.length > 0 ? `, dont ${openPauses.length} actuellement en cours` : ''}${presumedPauses.length > 0 ? ` (${presumedPauses.length} pause${presumedPauses.length > 1 ? 's' : ''} présumée${presumedPauses.length > 1 ? 's' : ''} du planning hors historique réel)` : ''}.`
            : `Aucune pause réelle n’a été effectuée ${periodLabel} chez ${company.name}${presumedPauses.length > 0 ? ` (${presumedPauses.length} pause${presumedPauses.length > 1 ? 's' : ''} présumée${presumedPauses.length > 1 ? 's' : ''} par la grille horaire, à statuer dans Pauses)` : ''}.`,
        source: 'encheck_pauses_lire · pauses réelles (non présumées)',
        path: '/pauses',
        choices: ["Qui a pointé aujourd'hui ?", "Qui a dépointé aujourd'hui ?", "Qui est en retard aujourd'hui"],
        rows: realPauses.slice(0, 20).map((p) => ({
          id: p.id,
          label: `${p.prenom || ''} ${p.nom || ''}`.trim() || 'Employé',
          detail: `${p.jour} · début ${formaterHeureLocaleShort(p.debut, company.timezone)}${p.fin ? ` → fin ${formaterHeureLocaleShort(p.fin, company.timezone)} (${p.duree_minutes || 0} min)` : ' (en cours)'}`,
          badge: !p.fin ? 'En pause' : 'Pause réelle',
        })),
      }
    }

    // Cas 6 : Congés / Absences
    if (intent === 'leaves') {
      const { data: absData, error: absErr } = await client
        .from('absences')
        .select('id,start_date,end_date,reason,status,employees(first_name,last_name,matricule)')
        .eq('enterprise_id', enterprise)
        .lte('start_date', dates.to)
        .gte('end_date', dates.from)
        .limit(30)

      if (absErr || !Array.isArray(absData)) throw Error('absences')

      return {
        ...common,
        title: 'Congés & absences déclarées',
        text:
          absData.length > 0
            ? `Il y a ${absData.length} absence${absData.length > 1 ? 's' : ''} ou congé${absData.length > 1 ? 's' : ''} déclaré${absData.length > 1 ? 's' : ''} ${periodLabel} chez ${company.name}.`
            : `Aucun congé ni absence déclarée ${periodLabel} chez ${company.name}.`,
        source: 'Table absences · lecture autorisée',
        path: '/absences',
        choices: ["Qui est absent aujourd'hui ?", "Qui a pointé aujourd'hui ?", "Combien de pointages aujourd'hui"],
        rows: absData.slice(0, 20).map((ab) => ({
          id: ab.id,
          label: `${ab.employees?.first_name || ''} ${ab.employees?.last_name || ''}`.trim() || 'Employé',
          detail: `${ab.start_date} → ${ab.end_date}${ab.reason ? ` · ${ab.reason}` : ''}`,
          badge: 'Congé / Absence',
        })),
      }
    }

    // Pour checked_out, checked_in, still_in, absents, daily_summary : lecture des pointages de la période
    const startUTC = heureLocaleVersUTC(dates.from, 0, 0, 0, company.timezone)
    const endUTC = heureLocaleVersUTC(dayAfter(dates.to), 0, 0, 0, company.timezone)

    const { data: attRows, error: attErr } = await client
      .from('attendances')
      .select('id,employee_id,check_time,check_type,is_auto_closed,estimation_validee_le,estimation_remplacee_le,employees(first_name,last_name,matricule)')
      .eq('enterprise_id', enterprise)
      .gte('check_time', startUTC)
      .lt('check_time', endUTC)
      .order('check_time', { ascending: true })
      .limit(200)

    if (attErr || !Array.isArray(attRows)) throw Error('attendances')

    // Regrouper par employé
    const byEmployee = new Map()
    for (const row of attRows) {
      if (!row.employee_id) continue
      if (!byEmployee.has(row.employee_id)) {
        byEmployee.set(row.employee_id, {
          employeeId: row.employee_id,
          name: `${row.employees?.first_name || ''} ${row.employees?.last_name || ''}`.trim() || 'Employé',
          matricule: row.employees?.matricule || '',
          ins: [],
          realOuts: [],
          presumedOuts: [],
          lastPunch: null,
        })
      }
      const group = byEmployee.get(row.employee_id)
      const type = String(row.check_type || '').toLowerCase()
      if (type === 'in') {
        group.ins.push(row)
        group.lastPunch = row
      } else if (type === 'out') {
        if (row.is_auto_closed) {
          group.presumedOuts.push(row)
        } else {
          group.realOuts.push(row)
          group.lastPunch = row
        }
      }
    }

    const allGroups = [...byEmployee.values()]
    const withRealOut = allGroups.filter((g) => g.realOuts.length > 0)
    const stillIn = allGroups.filter(
      (g) => g.ins.length > 0 && g.realOuts.length === 0
    )
    const withIn = allGroups.filter((g) => g.ins.length > 0)

    // Cas 2 : QUI A DÉPOINTÉ ?
    if (intent === 'checked_out') {
      const rows = withRealOut.map((g) => {
        const lastOut = g.realOuts[g.realOuts.length - 1]
        const firstIn = g.ins[0]
        const outTime = formaterHeureLocaleShort(lastOut.check_time, company.timezone)
        const inTime = firstIn ? formaterHeureLocaleShort(firstIn.check_time, company.timezone) : null
        const dayStr = getPartsLocaux(lastOut.check_time, company.timezone).jourISO
        return {
          id: lastOut.id,
          label: g.name,
          detail: `${dayStr} · ${inTime ? `Entrée ${inTime} → ` : ''}Dépointé à ${outTime}`,
          badge: 'Sortie badgée',
        }
      })

      let text =
        withRealOut.length > 0
          ? `${withRealOut.length} collaborateur${withRealOut.length > 1 ? 's ont' : ' a'} dépointé (sortie badgée) ${periodLabel} chez ${company.name}.`
          : `Personne n’a encore dépointé (aucune sortie badgée) ${periodLabel} chez ${company.name}.`

      if (withRealOut.length === 0 && stillIn.length > 0) {
        const names = stillIn.slice(0, 5).map((g) => `${g.name} (entrée à ${formaterHeureLocaleShort(g.ins[0].check_time, company.timezone)})`).join(', ')
        text += ` En revanche, ${stillIn.length} collaborateur${stillIn.length > 1 ? 's sont' : ' est'} actuellement en poste sans sortie enregistrée : ${names}.`
      }

      return {
        ...common,
        title: 'Collaborateurs ayant dépointé',
        text,
        source: 'Table attendances · sorties réellement badgées (hors clôtures automatiques)',
        path: '/pointages',
        choices: ["Qui est encore en poste ?", "Qui a pointé aujourd'hui ?", 'Sorties présumées à confirmer'],
        rows: rows.slice(0, 20),
      }
    }

    // Cas 1 : QUI EST ENCORE EN POSTE / N'A PAS DÉPOINTÉ ?
    if (intent === 'still_in') {
      const rows = stillIn.map((g) => {
        const lastIn = g.ins[g.ins.length - 1]
        const inTime = formaterHeureLocaleShort(lastIn.check_time, company.timezone)
        const dayStr = getPartsLocaux(lastIn.check_time, company.timezone).jourISO
        return {
          id: lastIn.id,
          label: g.name,
          detail: `${dayStr} · Entrée badgée à ${inTime} · Aucune sortie badgée`,
          badge: 'En poste',
        }
      })

      return {
        ...common,
        title: 'Collaborateurs en poste (sans sortie badgée)',
        text:
          stillIn.length > 0
            ? `${stillIn.length} collaborateur${stillIn.length > 1 ? 's ont' : ' a'} pointé une entrée sans avoir encore dépointé ${periodLabel} chez ${company.name}.`
            : `Aucun collaborateur n’est en attente de dépointage ${periodLabel} chez ${company.name}${withRealOut.length > 0 ? ` (${withRealOut.length} ont déjà dépointé)` : ''}.`,
        source: 'Table attendances · entrées sans sortie réelle associée',
        path: '/pointages',
        choices: ["Qui a dépointé aujourd'hui ?", "Qui a pointé aujourd'hui ?", 'Sorties présumées à confirmer'],
        rows: rows.slice(0, 20),
      }
    }

    // Cas 4 : QUI A POINTÉ / QUI EST PRÉSENT ?
    if (intent === 'checked_in') {
      const rows = withIn.map((g) => {
        const firstIn = g.ins[0]
        const lastOut = g.realOuts[g.realOuts.length - 1]
        const inTime = formaterHeureLocaleShort(firstIn.check_time, company.timezone)
        const outTime = lastOut ? formaterHeureLocaleShort(lastOut.check_time, company.timezone) : null
        const dayStr = getPartsLocaux(firstIn.check_time, company.timezone).jourISO
        return {
          id: firstIn.id,
          label: g.name,
          detail: `${dayStr} · Arrivée à ${inTime}${outTime ? ` · Dépointé à ${outTime}` : ' · Toujours en poste'}`,
          badge: outTime ? 'Pointé (sorti)' : 'En poste',
        }
      })

      return {
        ...common,
        title: 'Collaborateurs ayant pointé',
        text:
          withIn.length > 0
            ? `${withIn.length} collaborateur${withIn.length > 1 ? 's ont' : ' a'} pointé son arrivée ${periodLabel} chez ${company.name} (${stillIn.length} en poste, ${withRealOut.length} ayant dépointé).`
            : `Aucun collaborateur n’a encore pointé d’arrivée ${periodLabel} chez ${company.name}.`,
        source: 'Table attendances · entrées enregistrées',
        path: '/pointages',
        choices: ["Qui a dépointé aujourd'hui ?", "Qui est absent aujourd'hui ?", "Qui est en retard aujourd'hui"],
        rows: rows.slice(0, 20),
      }
    }

    // Cas 3 & Cas 8 : ABSENTS ou BILAN DU JOUR
    const [empRes, absRes] = await Promise.all([
      client
        .from('employees')
        .select('id,first_name,last_name,matricule,position')
        .eq('enterprise_id', enterprise)
        .eq('is_active', true)
        .order('last_name', { ascending: true }),
      client
        .from('absences')
        .select('id,employee_id,reason')
        .eq('enterprise_id', enterprise)
        .lte('start_date', dates.to)
        .gte('end_date', dates.from),
    ])

    const activeEmployees = empRes?.data || []
    const leaveEmployeeIds = new Set((absRes?.data || []).map((a) => a.employee_id))
    const presentEmployeeIds = new Set(allGroups.map((g) => g.employeeId))
    const absentEmployees = activeEmployees.filter(
      (e) => !presentEmployeeIds.has(e.id) && !leaveEmployeeIds.has(e.id)
    )

    if (intent === 'absents') {
      return {
        ...common,
        title: 'Collaborateurs sans pointage ni congé',
        text:
          absentEmployees.length > 0
            ? `${absentEmployees.length} collaborateur${absentEmployees.length > 1 ? 's n’ont' : ' n’a'} encore ni pointé ni congé déclaré ${periodLabel} chez ${company.name} (sur ${activeEmployees.length} actif${activeEmployees.length > 1 ? 's' : ''}).`
            : `Tous les collaborateurs actifs (${activeEmployees.length}) ont pointé ou sont en congé déclaré ${periodLabel} chez ${company.name}.`,
        source: 'Tables employees, attendances et absences · lecture autorisée',
        path: '/pointages?status=absent',
        choices: ["Qui a pointé aujourd'hui ?", "Qui a dépointé aujourd'hui ?", "Qui est en retard aujourd'hui"],
        rows: absentEmployees.slice(0, 20).map((e) => ({
          id: e.id,
          label: `${e.first_name || ''} ${e.last_name || ''}`.trim() || 'Employé',
          detail: `${e.matricule || 'Sans matricule'}${e.position ? ` · ${e.position}` : ''}`,
          badge: 'Non pointé',
        })),
      }
    }

    // Cas 8 : Bilan complet de la journée
    return {
      ...common,
      title: `Bilan en direct · ${company.name}`,
      text:
        `Voici la situation de ${company.name} ${periodLabel} :\n` +
        `• Effectif actif : ${activeEmployees.length} collaborateur(s)\n` +
        `• Ont pointé : ${withIn.length} (${stillIn.length} en poste, ${withRealOut.length} ayant dépointé)\n` +
        `• Non pointés (sans congé) : ${absentEmployees.length}\n` +
        `• En congé / absence déclarée : ${leaveEmployeeIds.size}`,
      source: 'Tables employees, attendances et absences · lecture en direct',
      path: '/pointages',
      choices: ["Qui a pointé aujourd'hui ?", "Qui a dépointé aujourd'hui ?", "Qui est absent aujourd'hui ?"],
      rows: withIn.slice(0, 15).map((g) => {
        const firstIn = g.ins[0]
        const lastOut = g.realOuts[g.realOuts.length - 1]
        const inTime = formaterHeureLocaleShort(firstIn.check_time, company.timezone)
        const outTime = lastOut ? formaterHeureLocaleShort(lastOut.check_time, company.timezone) : null
        return {
          id: firstIn.id,
          label: g.name,
          detail: `Entrée ${inTime}${outTime ? ` → Sortie ${outTime}` : ' · En poste'}`,
          badge: outTime ? 'Dépointé' : 'En poste',
        }
      }),
    }
  } catch {
    return null
  }
}
