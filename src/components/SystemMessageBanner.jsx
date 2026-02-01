// ═══════════════════════════════════════════════════════════
// 📢 BANDEAU MESSAGES SYSTÈME
// ═══════════════════════════════════════════════════════════

import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { AlertTriangle, Info, Wrench } from 'lucide-react'
import { estDansPlageHoraire } from '../utils/timezoneUtils'

export default function SystemMessageBanner({ userType = 'admins' }) {
  const [messages, setMessages] = useState([])

  useEffect(() => {
    fetchActiveMessages()
    
    // Real-time subscription
    const channel = supabase
      .channel('system_messages')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'messages_systeme'
      }, () => {
        fetchActiveMessages()
      })
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [userType])

  const fetchActiveMessages = async () => {
    console.log('🔍 Récupération messages, userType:', userType)
    const now = new Date().toISOString()
    
    let query = supabase
      .from('messages_systeme')
      .select('*')
      .eq('is_active', true)

    // Filtrer par cible
    if (userType === 'admins') {
      query = query.in('cible', ['tous', 'admins'])
    } else {
      query = query.in('cible', ['tous', 'employes'])
    }

    const { data } = await query.order('priorite', { ascending: false })
     console.log('📦 Data reçue de Supabase:', data)
if (data) {
  // Filtrer par dates en heure locale
  const filtered = data.filter(msg => 
    estDansPlageHoraire(msg.date_debut, msg.date_fin)
  )
  
  console.log('✅ Messages filtrés:', filtered)
  setMessages(filtered)
}
  }

  if (messages.length === 0) return null

  const getIcon = (type) => {
    switch(type) {
      case 'maintenance': return <Wrench size={18} />
      case 'mise_a_jour': return <Info size={18} />
      default: return <Info size={18} />
    }
  }

  const getColors = (priorite) => {
    switch(priorite) {
      case 'haute':
        return { bg: '#FEE2E2', border: '#9B2C2C', text: '#9B2C2C' }
      case 'normale':
        return { bg: '#FEF3C7', border: '#92400E', text: '#92400E' }
      case 'basse':
        return { bg: '#DBEAFE', border: '#1E40AF', text: '#1E40AF' }
      default:
        return { bg: '#FEF3C7', border: '#92400E', text: '#92400E' }
    }
  }

  return (
    <div style={styles.container}>
      {messages.map(msg => {
        const colors = getColors(msg.priorite)
        
        return (
          <div 
            key={msg.id} 
            style={{
              ...styles.message,
              background: colors.bg,
              borderLeft: `4px solid ${colors.border}`,
              color: colors.text
            }}
          >
            <div style={styles.icon}>
              {getIcon(msg.type)}
            </div>
            <div style={styles.content}>
              <strong style={styles.titre}>{msg.titre}</strong>
              <p style={styles.texte}>{msg.message}</p>
            </div>
          </div>
        )
      })}
    </div>
  )
}

const styles = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
    margin: '0 24px 20px 24px',
  },
  message: {
    display: 'flex',
    alignItems: 'start',
    gap: '12px',
    padding: '16px',
    borderRadius: '12px',
    boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
  },
  icon: {
    flexShrink: 0,
    marginTop: '2px',
  },
  content: {
    flex: 1,
  },
  titre: {
    display: 'block',
    fontSize: '15px',
    fontWeight: '600',
    marginBottom: '4px',
  },
  texte: {
    fontSize: '14px',
    margin: 0,
    lineHeight: '1.5',
  },
}