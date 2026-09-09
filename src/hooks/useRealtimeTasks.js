// ═══════════════════════════════════════════════════════════
// ⚡ HOOK TEMPS RÉEL POUR LES TÂCHES
// ═══════════════════════════════════════════════════════════

import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

const useRealtimeTasks = (enterpriseId, onTaskChange) => {
  const [isSubscribed, setIsSubscribed] = useState(false)

  useEffect(() => {
    if (!enterpriseId || !onTaskChange) return

    const channel = supabase
      .channel(`tasks_${enterpriseId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'tasks',
          filter: `enterprise_id=eq.${enterpriseId}`
        },
        (payload) => {
          console.log('✨ Nouvelle tâche créée:', payload.new)
          onTaskChange(payload.new, 'INSERT')
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'tasks',
          filter: `enterprise_id=eq.${enterpriseId}`
        },
        (payload) => {
          console.log('🔄 Tâche mise à jour:', payload.new)
          
          // Détecter les changements importants
          if (payload.new.status === 'completed' && payload.old.status !== 'completed') {
            onTaskChange(payload.new, 'COMPLETED')
          } else if (payload.new.status === 'overdue' && payload.old.status !== 'overdue') {
            onTaskChange(payload.new, 'OVERDUE')
          } else {
            onTaskChange(payload.new, 'UPDATE')
          }
        }
      )
      .subscribe((status) => {
        setIsSubscribed(status === 'SUBSCRIBED')
      })

    return () => {
      supabase.removeChannel(channel)
      setIsSubscribed(false)
    }
  }, [enterpriseId, onTaskChange])

  return { isSubscribed }
}

export default useRealtimeTasks