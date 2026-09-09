// src/hooks/useNotifications.js

import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { supabase } from '../lib/supabase'
import { getHeuresMinutesLocales } from '../utils/timezoneUtils'

const POLLING_INTERVAL = 60000
const DEFAULT_TITLE = 'En-Check | Administration'
const DEBUG_NOTIFS = import.meta.env.DEV

export default function useNotifications(admin) {
  const [notifications, setNotifications] = useState([])
  const [loading, setLoading] = useState(true)
  const [unreadCount, setUnreadCount] = useState(0)

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

    //  Une alerte de pointage lue ici est aussi marquée lue en base
    if (typeof key === 'string' && key.startsWith('alerte_')) {
      supabase.rpc('encheck_alertes_marquer', { p_ids: [key.slice(7)] }).then(() => {}, () => {})
    }
    
    if (adminParams.id) {
      localStorage.setItem(`notif_read_${adminParams.id}`, JSON.stringify(readKeys))
    }

    setNotifications(prev => {
      const updated = prev.map(n => n.key === key ? { ...n, read: true } : n)
      const newUnreadCount = updated.filter(n => !n.read).length
      const hasHighPrio = updated.some(n => !n.read && n.priority === 'high')

      setUnreadCount(newUnreadCount)

      if (hasHighPrio && newUnreadCount > 0) {
        startTitleBlink(newUnreadCount)
      } else {
        stopTitleBlink()
        updateDocumentTitle(newUnreadCount, false)
      }

      return updated
    })
  }, [adminParams.id, getReadKeys, startTitleBlink, stopTitleBlink, updateDocumentTitle])

  const markAllAsRead = useCallback(() => {
    setNotifications(prev => {
      const readKeys = getReadKeys()

      //  Les alertes de pointage lues ici sont aussi marquées lues en base
      const idsAlertes = prev
        .filter(n => typeof n.key === 'string' && n.key.startsWith('alerte_'))
        .map(n => n.key.slice(7))
      if (idsAlertes.length > 0) {
        supabase.rpc('encheck_alertes_marquer', { p_ids: idsAlertes }).then(() => {}, () => {})
      }
      prev.forEach(n => {
        readKeys[n.key] = Date.now()
      })
      
      if (adminParams.id) {
        localStorage.setItem(`notif_read_${adminParams.id}`, JSON.stringify(readKeys))
      }

      setUnreadCount(0)
      stopTitleBlink()
      updateDocumentTitle(0, false)

      return prev.map(n => ({ ...n, read: true }))
    })
  }, [adminParams.id, getReadKeys, stopTitleBlink, updateDocumentTitle])

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
            // Balayage des alertes de pointage
            await supabase.rpc('encheck_alertes_controler', { p_enterprise: enterpriseId })
            // Balayage des signaux d'assiduité (1 par semaine par personne)
            await supabase.rpc('encheck_signaux_controler', { p_enterprise: enterpriseId })
          }

          // ② les alertes à montrer
          const { data: alertes, error: errAlertes } = await supabase.rpc('encheck_alertes_lister', {
            p_enterprise: enterpriseId,
            p_limite: 50,
          })
          if (errAlertes) throw errAlertes

          ;(alertes || []).forEach(a => {
            // ═══ Signaux d'assiduité ═══
            if (a.type === 'assiduite_signal') {
              allNotifs.push({
                key: `alerte_${a.id}`,
                type: 'alerte',
                priority: GRAVITE_PRIORITE[a.gravite] || 'low',
                category: 'assiduite',
                title: a.titre,
                subtitle: a.detail || a.employe || 'Signal d\'assiduité',
                icon: 'activity',
                color: GRAVITE_COULEUR[a.gravite] || '#3B82F6',
                path: '/pointages',
                timestamp: a.quand,
              })
            }
            // ═══ Alertes classiques ═══
            else {
              allNotifs.push({
                key: `alerte_${a.id}`,
                type: 'alerte',
                priority: GRAVITE_PRIORITE[a.gravite] || 'low',
                category: 'pointages',
                title: a.titre,
                subtitle: [a.employe, a.appareil, a.detail].filter(Boolean).join(' · ') || 'Pointage',
                icon: 'clock',
                color: GRAVITE_COULEUR[a.gravite] || '#3B82F6',
                path: '/pointages',
                timestamp: a.quand,
              })
            }
          })
          log('alertes du serveur:', (alertes || []).length)

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

          ;(data || []).forEach(c => {
            allNotifs.push({
              key: `conflict_${c.id}`,
              type: 'conflict',
              priority: 'high',
              category: 'pointages',
              title: 'Conflit absence/pointage',
              subtitle: `${c.employees?.first_name || ''} ${c.employees?.last_name || ''} — ${c.absences?.reason || 'absence'}`,
              icon: 'shield',
              color: '#F97316',
              path: '/pointages',
              timestamp: c.created_at,
            })
          })

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

          const { data: employees } = await employeesQuery
          const employeeIds = (employees || []).map(e => e.id)

          if (employeeIds.length > 0) {
            // Simplifier la logique des retards
            const { data: employeeSchedules } = await supabase
              .from('employee_schedules')
              .select('employee_id, use_custom_hours, custom_start_time, schedule_id')
              .in('employee_id', employeeIds)

            const scheduleIds = [...new Set((employeeSchedules || []).map(s => s.schedule_id).filter(Boolean))]

            let workSchedulesById = {}
            if (scheduleIds.length > 0) {
              const { data: linkedSchedules } = await supabase
                .from('work_schedules')
                .select('id, start_time, late_tolerance_minutes')
                .in('id', scheduleIds)

              ;(linkedSchedules || []).forEach(ws => {
                workSchedulesById[ws.id] = ws
              })
            }

            const employeeSchedulesMap = {}
            ;(employeeSchedules || []).forEach(s => {
              employeeSchedulesMap[s.employee_id] = {
                ...s,
                work_schedule: s.schedule_id ? workSchedulesById[s.schedule_id] || null : null,
              }
            })

            const enterpriseIds = [...new Set((employees || []).map(e => e.enterprise_id).filter(Boolean))]

            let defaultScheduleByEnterprise = {}
            if (enterpriseIds.length > 0) {
              const { data: defaultSchedules } = await supabase
                .from('work_schedules')
                .select('enterprise_id, start_time, late_tolerance_minutes')
                .in('enterprise_id', enterpriseIds)
                .eq('is_default', true)
                .eq('is_active', true)

              ;(defaultSchedules || []).forEach(s => {
                if (!defaultScheduleByEnterprise[s.enterprise_id]) {
                  defaultScheduleByEnterprise[s.enterprise_id] = s
                }
              })
            }

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

            const { data: retardEntries } = await retardQuery

            const retardsAvecNom = []

            ;(employees || []).forEach(employee => {
              const schedulePerso = employeeSchedulesMap[employee.id]
              let heureArrivee = null
              let tolerance = 15

              if (schedulePerso) {
                if (schedulePerso.use_custom_hours && schedulePerso.custom_start_time) {
                  heureArrivee = schedulePerso.custom_start_time.slice(0, 5)
                } else if (schedulePerso.schedule_id && schedulePerso.work_schedule) {
                  heureArrivee = schedulePerso.work_schedule.start_time?.slice(0, 5) || null
                  tolerance = schedulePerso.work_schedule.late_tolerance_minutes || 15
                }
              }

              if (!heureArrivee) {
                const defaultSchedule = defaultScheduleByEnterprise[employee.enterprise_id]
                if (defaultSchedule) {
                  heureArrivee = defaultSchedule.start_time?.slice(0, 5) || null
                  tolerance = defaultSchedule.late_tolerance_minutes || 15
                }
              }

              if (!heureArrivee) return

              const att = (retardEntries || []).find(a => a.employee_id === employee.id)
              if (!att) return

              // ⭐ LIVRAISON 04 : heure locale de l'entreprise
              const { heures: hP, minutes: mP } = getHeuresMinutesLocales(att.check_time)
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
          let query = supabase
            .from('attendances')
            .select('id')
            .eq('is_auto_closed', true)
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
              title: `${data.length} oubli${data.length > 1 ? 's de sortie' : ' de sortie'}`,
              subtitle: 'Pointages auto-fermés à minuit',
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
              title: `${data.length} demande${data.length > 1 ? 's' : ''} de congé en attente`,
              subtitle:
                data.slice(0, 2)
                  .map(c => `${c.employees?.first_name || ''} ${c.employees?.last_name || ''}`)
                  .join(', ') + (data.length > 2 ? ` ... +${data.length - 2}` : ''),
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

            const subtitle =
              scheduleRequests
                .slice(0, 2)
                .map(r => {
                  const emp = employeesMap[r.employee_id]
                  return `${emp?.first_name || ''} ${emp?.last_name || ''}`.trim()
                })
                .filter(Boolean)
                .join(', ') +
              (scheduleRequests.length > 2 ? ` ... +${scheduleRequests.length - 2}` : '')

            const requestIdsKey = scheduleRequests
              .map(r => r.id)
              .sort()
              .join('_')

            allNotifs.push({
              key: `schedule_requests_pending_${requestIdsKey}`,
              type: 'action',
              priority: 'high',
              category: 'planning',
              title: `${scheduleRequests.length} demande${scheduleRequests.length > 1 ? 's' : ''} de modification d'horaires`,
              subtitle: subtitle || 'Des employés souhaitent modifier leur planning',
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
              title: `${data.length} devis sans réponse depuis 14j+`,
              subtitle: data.slice(0, 2).map(d => d.numero).join(', ') + (data.length > 2 ? '...' : ''),
              icon: 'file',
              color: '#6366F1',
              path: '/devis',
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
      const hasHighPrio = enriched.some(n => !n.read && n.priority === 'high')

      log('✅ Notifications enrichies:', enriched.length)
      log('newUnreadCount:', newUnreadCount)
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

      if (hasHighPrio && newUnreadCount > 0) {
        startTitleBlink(newUnreadCount)
      } else {
        stopTitleBlink()
        updateDocumentTitle(newUnreadCount, hasHighPrio)
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
    loading,
    markAsRead,
    markAllAsRead,
    refresh: useCallback(() => {
      lastFetchParamsRef.current = null
      fetchNotifications()
    }, [fetchNotifications]),
    hasHighPriority: notifications.some(n => !n.read && n.priority === 'high'),
  }
}
