// src/hooks/useNotifications.js

import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { supabase } from '../lib/supabase'
import { loadNotificationRetardContext } from '../services/notificationRetardContext'
import { getHeuresMinutesLocales, isValidTimezone } from '../utils/timezoneUtils'

const POLLING_INTERVAL = 60000
const DEFAULT_TITLE = 'En-Check | Administration'
const DEBUG_NOTIFS = import.meta.env.DEV

// ─────────────────────────────────────────────────────────────
// LE CENTRE D'ACTION — P1
//
// Règle : la cloche ne doit pas être une archive, c'est un comptoir.
//  — agrégée : une ligne par niveau de gravité, pas une ligne par
//    alerte (cinq lignes valent mieux que cinquante) ;
//  — plafonnée : rien au-delà de LIMITE_LIGNE_CLOCHE à l'écran ;
//  — le compteur = les éléments NON RÉSOLUS (actionnable), pas les
//    « non lues » : une alerte lue est une alerte qui a été vue,
//    un conflit reste un conflit tant qu'il est `pending` en base ;
//  — une action par ligne : chaque ligne mène à SA page, un clic.
// ─────────────────────────────────────────────────────────────
const LIMITE_LIGNE_CLOCHE = 30

/**
 * Agrège les alertes classiques par gravité : une seule ligne par
 * niveau, jamais une ligne par alerte. Les signaux d'assiduité sont
 * exclus ici (chaque signal porte une personne et un détail propre).
 * Exporté pour les tests.
 */
export function agregerAlertesParGravite(alertes = []) {
  const parGravite = {}
  for (const a of alertes) {
    if (!a || !a.id || a.lu || a.type === 'assiduite_signal') continue
    const gravite = a.gravite === 'critique' ? 'critique' : a.gravite === 'attention' ? 'attention' : 'info'
    const groupe = (parGravite[gravite] ||= { gravite, ids: [], noms: [], count: 0, quand: null })
    groupe.ids.push(a.id)
    groupe.count += 1
    if (a.employe && !groupe.noms.includes(a.employe)) groupe.noms.push(a.employe)
    if (a.quand && (!groupe.quand || new Date(a.quand) > new Date(groupe.quand))) groupe.quand = a.quand
  }
  const ordre = { critique: 0, attention: 1, info: 2 }
  return Object.values(parGravite).sort((a, b) => ordre[a.gravite] - ordre[b.gravite])
}

/** Libellé « N noms… +k » pour une ligne agrégée (2 noms max). */
export function libelleNoms(noms = [], plus = 2) {
  const visibles = noms.slice(0, plus)
  return visibles.join(', ') + (noms.length > plus ? ` … +${noms.length - plus}` : '')
}

/** Les identifiants d'alertes de base contenus dans une clé de cloche. */
function idsAlertesDeClef(key) {
  if (typeof key !== 'string') return []
  if (key.startsWith('alertes_grp_')) {
    // clé : alertes_grp_<gravite>_<id1>_<id2>…
    const reste = key.slice('alertes_grp_'.length)
    const tiret = reste.indexOf('_')
    return tiret > 0 ? reste.slice(tiret + 1).split('_').filter(Boolean) : []
  }
  if (key.startsWith('alerte_')) return [key.slice(7)]
  return []
}

export default function useNotifications(admin) {
  const [notifications, setNotifications] = useState([])
  const [loading, setLoading] = useState(true)
  const [unreadCount, setUnreadCount] = useState(0)
  const [actionCount, setActionCount] = useState(0)

  const intervalRef = useRef(null)
  const titleIntervalRef = useRef(null)
  const isFetchingRef = useRef(false)
  const lastFetchParamsRef = useRef(null)
  const abortControllerRef = useRef(null)

  const log = (...args) => {
    if (DEBUG_NOTIFS) console.log('[useNotifications]', ...args)
  }

  // ✅ Stabiliser les paramètres admin avec useMemo
  const adminParams = useMemo(() => ({
    id: admin?.id,
    role: admin?.role,
    enterprise_id: admin?.enterprise_id,
    selectedEnterpriseId: admin?.selectedEnterprise?.id
  }), [
    admin?.id,
    admin?.role,
    admin?.enterprise_id,
    admin?.selectedEnterprise?.id
  ])

  // ✅ Créer une clé stable pour la comparaison
  const paramsKey = useMemo(() => 
    JSON.stringify(adminParams),
    [adminParams]
  )

  const updateDocumentTitle = useCallback((count, hasHighPrio) => {
    if (count > 0) {
      const prefix = hasHighPrio ? '🔴 ' : '🟠 '
      document.title = `${prefix}(${count}) ${DEFAULT_TITLE}`
    } else {
      document.title = DEFAULT_TITLE
    }
  }, [])

  const startTitleBlink = useCallback((count) => {
    if (titleIntervalRef.current) clearInterval(titleIntervalRef.current)

    let isAlternate = false
    titleIntervalRef.current = setInterval(() => {
      document.title = isAlternate
        ? `🔴 (${count}) ${DEFAULT_TITLE}`
        : `⚠️ Action requise — En-Check`
      isAlternate = !isAlternate
    }, 1500)
  }, [])

  const stopTitleBlink = useCallback(() => {
    if (titleIntervalRef.current) {
      clearInterval(titleIntervalRef.current)
      titleIntervalRef.current = null
    }
  }, [])

  // ✅ getReadKeys doit être stable
  const getReadKeys = useCallback(() => {
    if (!adminParams.id) return {}
    try {
      const stored = localStorage.getItem(`notif_read_${adminParams.id}`)
      return stored ? JSON.parse(stored) : {}
    } catch {
      return {}
    }
  }, [adminParams.id])

  const markAsRead = useCallback((key) => {
    const readKeys = getReadKeys()
    readKeys[key] = Date.now()

    //  Une alerte de pointage lue ici est aussi marquée lue en base — y
    //  compris les alertes contenues dans une ligne agrégée (`alertes_grp_`).
    const idsAlertes = idsAlertesDeClef(key)
    if (idsAlertes.length > 0) {
      supabase.rpc('encheck_alertes_marquer', { p_ids: idsAlertes }).then(() => {}, () => {})
    }

    if (adminParams.id) {
      localStorage.setItem(`notif_read_${adminParams.id}`, JSON.stringify(readKeys))
    }

    setNotifications(prev => {
      const updated = prev.map(n => n.key === key ? { ...n, read: true } : n)
      const newUnreadCount = updated.filter(n => !n.read).length
      //  Marquer « lu » ne résout rien : un conflit `pending` ou une sortie
      //  présumée non validée restent dans le compteur d'action.
      const newActionCount = updated.filter(n => n.actionnable).length
      const hasHighPrio = updated.some(n => n.actionnable && n.priority === 'high')

      setUnreadCount(newUnreadCount)
      setActionCount(newActionCount)

      if (hasHighPrio && newActionCount > 0) {
        startTitleBlink(newActionCount)
      } else {
        stopTitleBlink()
        updateDocumentTitle(newActionCount, false)
      }

      return updated
    })
  }, [adminParams.id, getReadKeys, startTitleBlink, stopTitleBlink, updateDocumentTitle])

  const markAllAsRead = useCallback(() => {
    setNotifications(prev => {
      const readKeys = getReadKeys()

      //  Les alertes de pointage lues ici sont aussi marquées lues en base
      const idsAlertes = prev
        .flatMap(n => idsAlertesDeClef(n.key))
      if (idsAlertes.length > 0) {
        supabase.rpc('encheck_alertes_marquer', { p_ids: idsAlertes }).then(() => {}, () => {})
      }
      prev.forEach(n => {
        readKeys[n.key] = Date.now()
      })

      if (adminParams.id) {
        localStorage.setItem(`notif_read_${adminParams.id}`, JSON.stringify(readKeys))
      }

      const newActionCount = prev.filter(n => n.actionnable).length
      const hasHighPrio = prev.some(n => n.actionnable && n.priority === 'high')

      setUnreadCount(0)
      setActionCount(newActionCount)

      if (hasHighPrio && newActionCount > 0) {
        startTitleBlink(newActionCount)
      } else {
        stopTitleBlink()
        updateDocumentTitle(newActionCount, false)
      }

      return prev.map(n => ({ ...n, read: true }))
    })
  }, [adminParams.id, getReadKeys, startTitleBlink, stopTitleBlink, updateDocumentTitle])

  // ✅ LES ALERTES QUI COMPTENT PARTENT SUR LE TÉLÉPHONE — une seule fois par alerte.
  //    `critique` et `attention` partent ; `info` reste dans la cloche. Un patron qui
  //    reçoit quarante notifications par jour coupe tout au bout de trois jours.
  const pousserSurLeTelephone = useCallback(async (alertes, severites) => {
    const aTirer = (alertes || []).filter(a => a && a.id && !a.lu && a.gravite && a.gravite !== 'info')
    if (aTirer.length === 0) return

    //  On ne pousse jamais « toutes entreprises » : une alerte appartient à une
    //  entreprise précise, et le téléphone d'un client ne doit pas sonner pour un autre.
    const entrepriseCible = adminParams.selectedEnterpriseId || adminParams.enterprise_id
    if (!entrepriseCible) { log('⏭️ envoi téléphone : aucune entreprise sélectionnée'); return }

    const cle = `alertes_poussees_${adminParams.id || 'x'}`
    let dejaPoussees = {}
    try { dejaPoussees = JSON.parse(localStorage.getItem(cle) || '{}') || {} } catch { dejaPoussees = {} }

    const nouvelles = aTirer.filter(a => !dejaPoussees[a.id])
    if (nouvelles.length === 0) return

    let jeton = null
    try {
      const { data } = await supabase.auth.getSession()
      jeton = data?.session?.access_token || null
    } catch { jeton = null }
    if (!jeton) return

    for (const a of nouvelles) {
      try {
        const reponse = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/send-push`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${jeton}` },
          body: JSON.stringify({
            user_type: 'admin',
            enterprise_id: entrepriseCible,
            user_ids: null,
            title: a.titre || 'En-Check — anomalie de pointage',
            body: [a.employe, a.detail].filter(Boolean).join(' · ') || 'Ouvre En-Check pour voir le détail.',
            url: '/pointages',
            tag: `alerte-${a.id}`,
            severity: severites[a.gravite] || 'warning',
            requireInteraction: a.gravite === 'critique',
            vibrate: a.gravite === 'critique' ? [250, 100, 250, 100, 250] : [200, 80, 200],
          }),
        })
        if (reponse.ok) dejaPoussees[a.id] = Date.now()
      } catch (e) {
        log("⚠️ envoi de l'alerte impossible:", e?.message)
      }
    }
    try { localStorage.setItem(cle, JSON.stringify(dejaPoussees)) } catch {}
  }, [adminParams.id, adminParams.selectedEnterpriseId, adminParams.enterprise_id])

  // ✅ fetchNotifications optimisé
  const fetchNotifications = useCallback(async () => {
    if (!adminParams.id) {
      log('⚠️ Admin non défini')
      setLoading(false)
      return
    }

    // Vérifier si déjà en cours
    if (isFetchingRef.current) {
      log('⏭️ Fetch déjà en cours, skip')
      return
    }

    // Vérifier si les paramètres ont changé
    if (lastFetchParamsRef.current === paramsKey) {
      log('⏭️ Mêmes paramètres, skip')
      return
    }

    // Annuler la requête précédente si elle existe
    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
    }

    // Créer un nouveau controller
    abortControllerRef.current = new AbortController()
    const signal = abortControllerRef.current.signal

    isFetchingRef.current = true
    lastFetchParamsRef.current = paramsKey
    setLoading(true)

    try {
      const isSuperAdmin = adminParams.role === 'super_admin'
      const enterpriseId = adminParams.selectedEnterpriseId || adminParams.enterprise_id

      const today = new Date().toISOString().split('T')[0]
      const startOfDay = `${today}T00:00:00Z`
      const endOfDay = `${today}T23:59:59Z`

      const allNotifs = []

      // ═══ 0. LES ALERTES DU SERVEUR ═══
      //  Elles sont écrites en base à l'instant où l'anomalie se produit — y compris
      //  quand personne n'a l'application ouverte. On les relève, on les met dans la
      //  cloche, et on pousse sur le téléphone celles qui comptent.
      if (enterpriseId) {
        const GRAVITE_PRIORITE = { critique: 'high', attention: 'medium', info: 'low' }
        const GRAVITE_SEVERITE = { critique: 'critical', attention: 'warning', info: 'info' }
        const GRAVITE_COULEUR  = { critique: '#EF4444', attention: '#F59E0B', info: '#3B82F6' }
        try {
          // ① le balayage de la journée — au plus une fois toutes les 5 minutes
          const dernierBalayage = Number(sessionStorage.getItem('alertes_balayage') || 0)
          if (Date.now() - dernierBalayage > 5 * 60 * 1000) {
            sessionStorage.setItem('alertes_balayage', String(Date.now()))
            // Balayage des alertes de pointage.
            //  ⚠️ Nom NOUVEAU : `encheck_alertes_scan`. L'ancien appel touchait une
            //  fonction qui avait été RECOUVERTE par un monkey-patch dans une
            //  migration (deux versions de la même logique, la dernière gagnait
            //  sans que le code l'appelle). Décision §4.4 : un orchestrateur NOMMÉ,
            //  appelé explicitement. `encheck_alertes_controler` reste définie comme
            //  alias sûr (elle ne peut plus écraser de données) pour que le bundle
            //  déjà déployé sur Vercel continue de fonctionner pendant le déploiement.
            await supabase.rpc('encheck_alertes_scan', { p_enterprise: enterpriseId })
            // Balayage des signaux d'assiduité (1 par semaine par personne)
            await supabase.rpc('encheck_signaux_controler', { p_enterprise: enterpriseId })
          }

          // ② les alertes à montrer
          const { data: alertes, error: errAlertes } = await supabase.rpc('encheck_alertes_lister', {
            p_enterprise: enterpriseId,
            p_limite: 50,
          })
          if (errAlertes) throw errAlertes

          // ═══ Signaux d'assiduité — un par personne, détail propre (max 5) ═══
          ;(alertes || []).filter(a => a?.type === 'assiduite_signal' && !a.lu).slice(0, 5)
            .forEach(a => {
              allNotifs.push({
                key: `alerte_${a.id}`,
                type: 'alerte',
                priority: GRAVITE_PRIORITE[a.gravite] || 'low',
                category: 'assiduite',
                actionnable: true,
                title: a.titre,
                subtitle: a.detail || a.employe || 'Signal d\'assiduité',
                icon: 'activity',
                color: GRAVITE_COULEUR[a.gravite] || '#3B82F6',
                path: '/pointages',
                timestamp: a.quand,
              })
            })

          // ═══ Alertes classiques — UNE ligne par niveau de gravité ═══
          for (const g of agregerAlertesParGravite(alertes)) {
            const estUrgente = g.gravite === 'critique'
            allNotifs.push({
              key: `alertes_grp_${g.gravite}_${g.ids.sort().join('_')}`,
              type: 'alerte',
              priority: GRAVITE_PRIORITE[g.gravite] || 'low',
              category: 'pointages',
              actionnable: g.gravite !== 'info',
              title: estUrgente
                ? `Urgent — ${g.count} anomalie${g.count > 1 ? 's' : ''} de pointage`
                : `${g.count} anomalie${g.count > 1 ? 's' : ''} de pointage à examiner`,
              subtitle: libelleNoms(g.noms) || 'Ouvrir les pointages pour examiner',
              count: g.count,
              alerteIds: g.ids,
              icon: 'clock',
              color: GRAVITE_COULEUR[g.gravite] || '#3B82F6',
              path: '/pointages',
              timestamp: g.quand || new Date().toISOString(),
            })
          }
          log('alertes du serveur:', (alertes || []).length, '→', agregerAlertesParGravite(alertes).length, 'ligne(s) agrégée(s)')

          // ③ l'envoi sur le téléphone
          await pousserSurLeTelephone(alertes || [], GRAVITE_SEVERITE)
        } catch (e) {
          if (e?.name !== 'AbortError') log('⚠️ alertes serveur indisponibles:', e?.message)
        }
      }

      log('fetchNotifications start', {
        adminId: adminParams.id,
        role: adminParams.role,
        enterpriseId,
      })

      // ═══ 1. CONFLITS ═══
      if (!signal.aborted) {
        try {
          let query = supabase
            .from('attendance_conflicts')
            .select('id, created_at, employees(first_name, last_name), absences(reason)')
            .eq('status', 'pending')
            .order('created_at', { ascending: false })
            .limit(20)

          if (!isSuperAdmin && enterpriseId) {
            query = query.eq('enterprise_id', enterpriseId)
          } else if (isSuperAdmin && adminParams.selectedEnterpriseId) {
            query = query.eq('enterprise_id', adminParams.selectedEnterpriseId)
          }

          const { data, error } = await query
          if (error) throw error

          // ═══ UNE seule ligne, jamais une par conflit ═══
          // Le conflit reste « non résolu » tant qu'il est `pending` en
          // base : le lire ici ne le fait pas disparaître du compteur.
          if ((data || []).length > 0) {
            const noms = (data || [])
              .map(c => `${c.employees?.first_name || ''} ${c.employees?.last_name || ''}`.trim())
              .filter(Boolean)
            allNotifs.push({
              key: `conflits_grp_${(data || []).map(c => c.id).sort().join('_')}`,
              type: 'conflict',
              priority: 'high',
              category: 'pointages',
              actionnable: true,
              title: `${data.length} conflit${data.length > 1 ? 's' : ''} absence/pointage à résoudre`,
              subtitle: libelleNoms(noms) || 'Pointage effectué pendant une absence déclarée',
              count: data.length,
              icon: 'shield',
              color: '#F97316',
              path: '/pointages',
              timestamp: data[0]?.created_at,
            })
          }

          log('conflicts loaded:', (data || []).length)
        } catch (e) {
          if (e.name !== 'AbortError') {
            log('conflicts skipped:', e?.message)
          }
        }
      }

      // ═══ 2. RETARDS ═══
      if (!signal.aborted) {
        try {
          let employeesQuery = supabase
            .from('employees')
            .select('id, enterprise_id')
            .eq('is_active', true)

          if (!isSuperAdmin && enterpriseId) {
            employeesQuery = employeesQuery.eq('enterprise_id', enterpriseId)
          } else if (isSuperAdmin && adminParams.selectedEnterpriseId) {
            employeesQuery = employeesQuery.eq('enterprise_id', adminParams.selectedEnterpriseId)
          }

          const { data: candidates, error: employeeError } = await employeesQuery
          if (employeeError) throw employeeError
          const { employees, employeeSchedulesMap, defaultScheduleByEnterprise, timezones } =
            await loadNotificationRetardContext(supabase, candidates || [])
          const employeeIds = employees.map(e => e.id)

          if (employeeIds.length > 0) {
            let retardQuery = supabase
              .from('attendances')
              .select('id, employee_id, check_time, enterprise_id')
              .eq('check_type', 'in')
              .gte('check_time', startOfDay)
              .lte('check_time', endOfDay)
              .in('employee_id', employeeIds)

            if (!isSuperAdmin && enterpriseId) {
              retardQuery = retardQuery.eq('enterprise_id', enterpriseId)
            } else if (isSuperAdmin && adminParams.selectedEnterpriseId) {
              retardQuery = retardQuery.eq('enterprise_id', adminParams.selectedEnterpriseId)
            }

            const { data: retardEntries, error: entriesError } = await retardQuery
              .order('check_time', { ascending: true }).order('id', { ascending: true })
            if (entriesError) throw entriesError

            const retardsAvecNom = []

            ;(employees || []).forEach(employee => {
              if (!isValidTimezone(timezones[employee.enterprise_id])) return
              const schedulePerso = employeeSchedulesMap[employee.id]
              let heureArrivee = null
              let tolerance = 15

              if (schedulePerso) {
                if (schedulePerso.use_custom_hours && schedulePerso.custom_start_time) {
                  heureArrivee = schedulePerso.custom_start_time.slice(0, 5)
                } else if (schedulePerso.schedule_id && schedulePerso.work_schedule?.enterprise_id === employee.enterprise_id) {
                  heureArrivee = schedulePerso.work_schedule.start_time?.slice(0, 5) || null
                  tolerance = schedulePerso.work_schedule.late_tolerance_minutes ?? 15
                }
              }

              if (!heureArrivee) {
                const defaultSchedule = defaultScheduleByEnterprise[employee.enterprise_id]
                if (defaultSchedule) {
                  heureArrivee = defaultSchedule.start_time?.slice(0, 5) || null
                  tolerance = defaultSchedule.late_tolerance_minutes ?? 15
                }
              }

              if (!heureArrivee) return

              const att = (retardEntries || []).find(a => a.employee_id === employee.id)
              if (!att) return

              // ⭐ LIVRAISON 04 : heure locale de l'entreprise
              const { heures: hP, minutes: mP } = getHeuresMinutesLocales(att.check_time, timezones[employee.enterprise_id])
              const [hA, mA] = heureArrivee.split(':').map(Number)

              const minutesArriveeBase = hA * 60 + mA
              const minutesArriveeMax = minutesArriveeBase + tolerance
              const minutesPointage = hP * 60 + mP
              const retardMinutes = minutesPointage - minutesArriveeBase

              if (minutesPointage > minutesArriveeMax && retardMinutes > 0) {
                retardsAvecNom.push(employee.id)
              }
            })

            if (retardsAvecNom.length > 0) {
              allNotifs.push({
                key: `retards_${today}`,
                type: 'warning',
                priority: 'medium',
                category: 'pointages',
                // Résumé d'un fait déjà accompli — information, pas un élément
                // « non résolu » : ne compte pas dans le compteur d'action.
                actionnable: false,
                title: `${retardsAvecNom.length} retard${retardsAvecNom.length > 1 ? 's' : ''} aujourd'hui`,
                subtitle: 'Employés avec planning ayant pointé en retard',
                icon: 'alert',
                color: '#EF4444',
                path: '/retards',
                timestamp: new Date().toISOString(),
              })
            }

            log('retards loaded:', retardsAvecNom.length)
          }
        } catch (e) {
          if (e.name !== 'AbortError') {
            log('retards skipped:', e?.message)
          }
        }
      }

      // ═══ 3. OUBLIS ═══
      if (!signal.aborted) {
        try {
          //  Oublis = sorties PRÉSUMÉES qui attendent un humain. Deux filtres de
          //  plus que la version d'origine, et ils changent le sens du compteur :
          //    · `estimation_validee_le IS NULL`  → une présomption validée n'est
          //      plus une alerte, c'est un pointage comme un autre ;
          //    · `estimation_remplacee_le IS NULL` → si l'employé a badgé sa vraie
          //      sortie entre-temps, l'estimation est conservée en base (pour
          //      mesurer l'erreur) mais ne doit plus être comptée comme un oubli.
          //  Un balayage qui affiche « 3 oublis » alors que 2 ont déjà été corrigés
          //  est un balayage que l'on ignore le lendemain.
          let query = supabase
            .from('attendances')
            .select('id')
            .eq('is_auto_closed', true)
            .is('estimation_validee_le', null)
            .is('estimation_remplacee_le', null)
            .gte('check_time', startOfDay)
            .lte('check_time', endOfDay)

          if (!isSuperAdmin && enterpriseId) {
            query = query.eq('enterprise_id', enterpriseId)
          } else if (isSuperAdmin && adminParams.selectedEnterpriseId) {
            query = query.eq('enterprise_id', adminParams.selectedEnterpriseId)
          }

          const { data } = await query

          if ((data || []).length > 0) {
            allNotifs.push({
              key: `oublis_${today}`,
              type: 'warning',
              priority: 'medium',
              category: 'pointages',
              actionnable: true, // attend une validation humaine : non résolu
              title: `${data.length} sortie${data.length > 1 ? 's' : ''} présumée${data.length > 1 ? 's' : ''}`,
              //  L'ancien libellé (« auto-fermés à minuit ») était FAUX : la
              //  fermeture dépend de `auto_close_time` entreprise + des seuils, pas
              //  de minuit. Un libellé inexact fait douter de tout le reste.
              subtitle: '⏳ à valider — non comptées dans la paie',
              icon: 'clock',
              color: '#F59E0B',
              path: '/pointages',
              timestamp: new Date().toISOString(),
            })
          }

          log('oublis loaded:', (data || []).length)
        } catch (e) {
          if (e.name !== 'AbortError') {
            log('oublis skipped:', e?.message)
          }
        }
      }

      // ═══ 4. CONGÉS ═══
      if (!signal.aborted) {
        try {
          let query = supabase
            .from('absences')
            .select('id, created_at, employees(first_name, last_name)')
            .eq('status', 'en_attente')
            .order('created_at', { ascending: false })
            .limit(20)

          if (!isSuperAdmin && enterpriseId) {
            query = query.eq('enterprise_id', enterpriseId)
          } else if (isSuperAdmin && adminParams.selectedEnterpriseId) {
            query = query.eq('enterprise_id', adminParams.selectedEnterpriseId)
          }

          const { data } = await query

          if ((data || []).length > 0) {
            allNotifs.push({
              key: `conges_pending_${today}_${data.length}`,
              type: 'action',
              priority: 'medium',
              category: 'rh',
              actionnable: true, // demande en attente d'une décision : non résolue
              title: `${data.length} demande${data.length > 1 ? 's' : ''} de congé en attente`,
              subtitle:
                libelleNoms(
                  data.map(c => `${c.employees?.first_name || ''} ${c.employees?.last_name || ''}`.trim())
                    .filter(Boolean)
                ) || 'Décider dans les absences',
              icon: 'calendar',
              color: '#8B5CF6',
              path: '/absences',
              timestamp: data[0]?.created_at || new Date().toISOString(),
            })
          }

          log('congés pending loaded:', (data || []).length)
        } catch (e) {
          if (e.name !== 'AbortError') {
            log('congés skipped:', e?.message)
          }
        }
      }

      // ═══ 5. SCHEDULE REQUESTS ═══
      if (!signal.aborted) {
        try {
          let query = supabase
            .from('schedule_change_requests')
            .select('id, employee_id, enterprise_id, created_at, status')
            .eq('status', 'pending')
            .order('created_at', { ascending: false })
            .limit(20)

          if (!isSuperAdmin && enterpriseId) {
            query = query.eq('enterprise_id', enterpriseId)
          } else if (isSuperAdmin && adminParams.selectedEnterpriseId) {
            query = query.eq('enterprise_id', adminParams.selectedEnterpriseId)
          }

          const { data: scheduleRequests } = await query

          if ((scheduleRequests || []).length > 0) {
            const employeeIds = [...new Set(scheduleRequests.map(r => r.employee_id).filter(Boolean))]

            let employeesMap = {}
            if (employeeIds.length > 0) {
              const { data: employeesData } = await supabase
                .from('employees')
                .select('id, first_name, last_name')
                .in('id', employeeIds)

              ;(employeesData || []).forEach(emp => {
                employeesMap[emp.id] = emp
              })
            }

            const noms = scheduleRequests
              .map(r => {
                const emp = employeesMap[r.employee_id]
                return `${emp?.first_name || ''} ${emp?.last_name || ''}`.trim()
              })
              .filter(Boolean)

            const requestIdsKey = scheduleRequests
              .map(r => r.id)
              .sort()
              .join('_')

            allNotifs.push({
              key: `schedule_requests_pending_${requestIdsKey}`,
              type: 'action',
              priority: 'high',
              category: 'planning',
              actionnable: true, // demande en attente d'une décision : non résolue
              title: `${scheduleRequests.length} demande${scheduleRequests.length > 1 ? 's' : ''} de modification d'horaires`,
              subtitle: libelleNoms(noms) || 'Des employés souhaitent modifier leur planning',
              icon: 'calendar',
              color: '#6366F1',
              path: '/planning',
              timestamp: scheduleRequests[0]?.created_at || new Date().toISOString(),
            })
          }

          log('schedule requests loaded:', (scheduleRequests || []).length)
        } catch (e) {
          if (e.name !== 'AbortError') {
            log('schedule requests skipped:', e?.message)
          }
        }
      }

      // ═══ 6. PROSPECTS / DEVIS (SuperAdmin only) ═══
      if (isSuperAdmin && !signal.aborted) {
        try {
          const sevenDaysAgo = new Date()
          sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)

          const { data } = await supabase
            .from('prospects')
            .select('id, company_name, updated_at')
            .in('status', ['nouveau', 'contacte', 'en_discussion'])
            .lt('updated_at', sevenDaysAgo.toISOString())
            .order('updated_at', { ascending: true })
            .limit(10)

          if ((data || []).length > 0) {
            allNotifs.push({
              key: `prospects_relance_${data.length}`,
              type: 'info',
              priority: 'low',
              category: 'commercial',
              // Rappel commercial — un autre domaine que la présence : visible,
              // filtrable, mais ne gonfle pas le compteur d'action de la cloche.
              actionnable: false,
              title: `${data.length} prospect${data.length > 1 ? 's' : ''} à relancer`,
              subtitle: data.slice(0, 2).map(p => p.company_name).join(', ') + (data.length > 2 ? '...' : ''),
              icon: 'trending',
              color: '#10B981',
              path: '/prospection',
              timestamp: new Date().toISOString(),
            })
          }

          log('prospects loaded:', (data || []).length)
        } catch (e) {
          if (e.name !== 'AbortError') {
            log('prospects skipped:', e?.message)
          }
        }

        try {
          const fourteenDaysAgo = new Date()
          fourteenDaysAgo.setDate(fourteenDaysAgo.getDate() - 14)

          const { data } = await supabase
            .from('devis')
            .select('id, numero, updated_at')
            .eq('status', 'envoye')
            .lt('updated_at', fourteenDaysAgo.toISOString())
            .order('updated_at', { ascending: true })
            .limit(10)

          if ((data || []).length > 0) {
            allNotifs.push({
              key: `devis_stale_${data.length}`,
              type: 'info',
              priority: 'low',
              category: 'commercial',
              // Rappel commercial — visible, mais pas dans le compteur d'action.
              actionnable: false,
              title: `${data.length} devis sans réponse depuis 14j+`,
              subtitle: data.slice(0, 2).map(d => d.numero).join(', ') + (data.length > 2 ? '...' : ''),
              icon: 'file',
              color: '#6366F1',
              path: '/prospection?vue=devis',
              timestamp: new Date().toISOString(),
            })
          }

          log('devis loaded:', (data || []).length)
        } catch (e) {
          if (e.name !== 'AbortError') {
            log('devis skipped:', e?.message)
          }
        }
      }

      // Vérifier si annulé avant de mettre à jour l'état
      if (signal.aborted) {
        log('❌ Fetch annulé')
        return
      }

      const readKeys = getReadKeys()

      const enriched = allNotifs.map(n => ({
        ...n,
        read: !!readKeys[n.key],
      }))

      const priorityOrder = { high: 0, medium: 1, low: 2 }
      enriched.sort((a, b) => {
        const pDiff = (priorityOrder[a.priority] ?? 2) - (priorityOrder[b.priority] ?? 2)
        if (pDiff !== 0) return pDiff
        return new Date(b.timestamp) - new Date(a.timestamp)
      })

      const newUnreadCount = enriched.filter(n => !n.read).length
      // LE COMPTEUR DE LA CLOCHE = les éléments NON RÉSOLUS, pas les non lues.
      // Une ligne agrégée reste comptée tant que son objet existe en base
      // (conflit `pending`, sortie présumée non validée, demande en attente,
      // alerte non lue) — la cocher « lu » ne la fait pas disparaître.
      const newActionCount = enriched.filter(n => n.actionnable).length
      const hasHighPrio = enriched.some(n => n.actionnable && n.priority === 'high')

      log('✅ Notifications enrichies:', enriched.length)
      log('newUnreadCount:', newUnreadCount, '· newActionCount:', newActionCount)
      log('hasHighPrio:', hasHighPrio)

      // ✅ Utiliser setState avec fonction pour éviter re-renders inutiles
      setNotifications(prev => {
        const prevKeys = prev.map(n => n.key).sort().join(',')
        const newKeys = enriched.map(n => n.key).sort().join(',')
        
        if (prevKeys === newKeys) {
          log('🔄 Même contenu, skip update')
          return prev
        }
        
        return enriched
      })

      setUnreadCount(newUnreadCount)
      setActionCount(newActionCount)

      if (hasHighPrio && newActionCount > 0) {
        startTitleBlink(newActionCount)
      } else {
        stopTitleBlink()
        updateDocumentTitle(newActionCount, hasHighPrio)
      }

    } catch (error) {
      if (error.name !== 'AbortError') {
        console.error('❌ Erreur chargement notifications:', error)
      }
    } finally {
      isFetchingRef.current = false
      setLoading(false)
    }
  }, [paramsKey, adminParams, getReadKeys, startTitleBlink, stopTitleBlink, updateDocumentTitle])

  // ✅ Effect principal - dépendances minimales
  useEffect(() => {
    if (!adminParams.id) {
      log('⚠️ Pas d\'admin, skip')
      return
    }

    fetchNotifications()

    // Polling toutes les 60 secondes
    intervalRef.current = setInterval(fetchNotifications, POLLING_INTERVAL)

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
      }
      if (titleIntervalRef.current) {
        clearInterval(titleIntervalRef.current)
      }
      if (abortControllerRef.current) {
        abortControllerRef.current.abort()
      }
      document.title = DEFAULT_TITLE
    }
  }, [adminParams.id, fetchNotifications])

  // ✅ Refresh au retour de l'onglet
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && adminParams.id) {
        // Forcer un refresh
        lastFetchParamsRef.current = null
        fetchNotifications()
      }
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange)
  }, [adminParams.id, fetchNotifications])

  return {
    notifications,
    unreadCount,
    // Le compteur affiché = les éléments NON RÉSOLUS (actionnable), pas les
    // « non lues ». Une ligne reste comptée tant que son objet existe en base.
    actionCount,
    loading,
    markAsRead,
    markAllAsRead,
    refresh: useCallback(() => {
      lastFetchParamsRef.current = null
      fetchNotifications()
    }, [fetchNotifications]),
    hasHighPriority: notifications.some(n => n.actionnable && n.priority === 'high'),
  }
}
