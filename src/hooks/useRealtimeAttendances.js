// ═══════════════════════════════════════════════════════════
// ⚡ HOOK TEMPS RÉEL POUR LES POINTAGES (OPTIMISÉ)
// ═══════════════════════════════════════════════════════════

import { useEffect, useRef, useState, useCallback } from 'react'
import { supabase } from '../lib/supabase'

const useRealtimeAttendances = (enterpriseId, onNewAttendance) => {
  const [isSubscribed, setIsSubscribed] = useState(false)
  const channelRef = useRef(null)
  const callbackRef = useRef(onNewAttendance)

  // ✅ Toujours avoir la dernière version du callback sans déclencher useEffect
  useEffect(() => {
    callbackRef.current = onNewAttendance
  }, [onNewAttendance])

  useEffect(() => {
    if (!enterpriseId) {
      console.warn('⚠️ useRealtimeAttendances: enterpriseId manquant')
      return
    }

    // ✅ Éviter les doublons si déjà connecté
    if (channelRef.current) {
      console.log('⏭️ Canal déjà actif, skip')
      return
    }

    console.log('📡 Connexion Realtime pour:', enterpriseId)

    // Channel pour écouter les nouveaux pointages
    const channel = supabase
      .channel(`attendances_${enterpriseId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'attendances',
          filter: `enterprise_id=eq.${enterpriseId}`
        },
        (payload) => {
          console.log('🔔 Nouveau pointage détecté:', payload.new)
          // ✅ Utilise la ref pour éviter les dépendances
          callbackRef.current?.(payload.new)
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'attendances',
          filter: `enterprise_id=eq.${enterpriseId}`
        },
        (payload) => {
          console.log('🔄 Pointage mis à jour:', payload.new)
          if (payload.new.is_auto_closed && !payload.old.is_auto_closed) {
            callbackRef.current?.(payload.new, 'auto_closed')
          }
          //  Réconciliation (§5) : quand une VRAIE sortie arrive après une
          //  estimation, le moteur SQL marque la présomption « remplacée » (il ne
          //  la supprime jamais) et recalcule la journée. Sans ce signal, l'écran
          //  restait figé sur l'heure inventée jusqu'au prochain rafraîchissement
          //  manuel — l'écart le plus trompeur pour un manager en direct.
          if (payload.new.estimation_remplacee_le && !payload.old?.estimation_remplacee_le) {
            callbackRef.current?.(payload.new, 'estimation_remplacee')
          }
          //  Validation humaine : la ligne devient payable, il faut redessiner.
          if (payload.new.estimation_validee_le && !payload.old?.estimation_validee_le) {
            callbackRef.current?.(payload.new, 'estimation_validee')
          }
        }
      )
      .subscribe((status) => {
        console.log('📡 Subscription status:', status)
        setIsSubscribed(status === 'SUBSCRIBED')
      })

    channelRef.current = channel

    // ✅ Cleanup propre
    return () => {
      if (channelRef.current) {
        console.log('🔌 Déconnexion temps réel pointages')
        supabase.removeChannel(channelRef.current)
        channelRef.current = null
        setIsSubscribed(false)
      }
    }
  }, [enterpriseId]) // ⚠️ Uniquement enterpriseId, PAS onNewAttendance

  return { isSubscribed }
}

export default useRealtimeAttendances