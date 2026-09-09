// ═══════════════════════════════════════════════════════════
// 📢 BANDEAU MESSAGES SYSTÈME - AFROFUTURISTE
// ═══════════════════════════════════════════════════════════

import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { AlertTriangle, Info, Wrench, X, Zap, Bell, Megaphone } from 'lucide-react'
import { estDansPlageHoraire } from '../utils/timezoneUtils'

export default function SystemMessageBanner({ userType = 'admins' }) {
  const [messages, setMessages] = useState([])
  const [dismissedIds, setDismissedIds] = useState([])

  useEffect(() => {
    // Charger les messages déjà fermés de cette session
    const dismissed = sessionStorage.getItem('dismissed_messages')
    if (dismissed) {
      setDismissedIds(JSON.parse(dismissed))
    }
    
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
    let query = supabase
      .from('messages_systeme')
      .select('*')
      .eq('is_active', true)

    if (userType === 'admins') {
      query = query.in('cible', ['tous', 'admins'])
    } else {
      query = query.in('cible', ['tous', 'employes'])
    }

    const { data } = await query.order('priorite', { ascending: false })
    
    if (data) {
      const filtered = data.filter(msg => 
        estDansPlageHoraire(msg.date_debut, msg.date_fin)
      )
      setMessages(filtered)
    }
  }

  const dismissMessage = (id) => {
    const newDismissed = [...dismissedIds, id]
    setDismissedIds(newDismissed)
    sessionStorage.setItem('dismissed_messages', JSON.stringify(newDismissed))
  }

  const visibleMessages = messages.filter(msg => !dismissedIds.includes(msg.id))

  if (visibleMessages.length === 0) return null

  const getIcon = (type) => {
    switch(type) {
      case 'maintenance': return <Wrench size={18} />
      case 'mise_a_jour': return <Zap size={18} />
      case 'info': return <Info size={18} />
      case 'alert': return <AlertTriangle size={18} />
      default: return <Bell size={18} />
    }
  }

  const getConfig = (priorite, type) => {
    // Haute priorité : Rouge/Orange vif
    if (priorite === 'haute') {
      return {
        bg: 'rgba(239, 68, 68, 0.08)',
        border: 'rgba(239, 68, 68, 0.25)',
        glow: 'rgba(239, 68, 68, 0.15)',
        iconBg: 'rgba(239, 68, 68, 0.15)',
        iconColor: '#EF4444',
        textColor: '#FCA5A5',
        titleColor: '#FECACA',
        accentLine: '#EF4444',
      }
    }
    
    // Maintenance : Ambre
    if (type === 'maintenance') {
      return {
        bg: 'rgba(245, 158, 11, 0.06)',
        border: 'rgba(245, 158, 11, 0.2)',
        glow: 'rgba(245, 158, 11, 0.1)',
        iconBg: 'rgba(245, 158, 11, 0.12)',
        iconColor: '#F59E0B',
        textColor: '#FCD34D',
        titleColor: '#FDE68A',
        accentLine: '#F59E0B',
      }
    }
    
    // Mise à jour : Vert
    if (type === 'mise_a_jour') {
      return {
        bg: 'rgba(16, 185, 129, 0.06)',
        border: 'rgba(16, 185, 129, 0.2)',
        glow: 'rgba(16, 185, 129, 0.1)',
        iconBg: 'rgba(16, 185, 129, 0.12)',
        iconColor: '#10B981',
        textColor: '#6EE7B7',
        titleColor: '#A7F3D0',
        accentLine: '#10B981',
      }
    }
    
    // Default / Info : Bleu
    return {
      bg: 'rgba(99, 102, 241, 0.06)',
      border: 'rgba(99, 102, 241, 0.2)',
      glow: 'rgba(99, 102, 241, 0.1)',
      iconBg: 'rgba(99, 102, 241, 0.12)',
      iconColor: '#6366F1',
      textColor: '#A5B4FC',
      titleColor: '#C7D2FE',
      accentLine: '#6366F1',
    }
  }

  return (
    <>
      <style>{`
        @keyframes slideInDown {
          from {
            opacity: 0;
            transform: translateY(-20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        @keyframes pulseGlow {
          0%, 100% {
            box-shadow: 0 0 20px var(--glow-color);
          }
          50% {
            box-shadow: 0 0 30px var(--glow-color);
          }
        }
        .system-message {
          animation: slideInDown 0.4s ease forwards;
        }
        .system-message.priority-haute {
          animation: slideInDown 0.4s ease forwards, pulseGlow 3s ease-in-out infinite;
        }
        .system-message-dismiss:hover {
          background: rgba(255, 255, 255, 0.1) !important;
          color: #FFFFFF !important;
        }
        .system-message-icon {
          animation: none;
        }
        .system-message.priority-haute .system-message-icon {
          animation: pulse 2s ease-in-out infinite;
        }
        @keyframes pulse {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.1); }
        }
      `}</style>

      <div style={styles.container}>
        {visibleMessages.map((msg, index) => {
          const config = getConfig(msg.priorite, msg.type)
          
          return (
            <div 
              key={msg.id}
              className={`system-message ${msg.priorite === 'haute' ? 'priority-haute' : ''}`}
              style={{
                ...styles.message,
                '--glow-color': config.glow,
                background: config.bg,
                border: `1px solid ${config.border}`,
                animationDelay: `${index * 0.1}s`,
              }}
            >
              {/* Accent line */}
              <div style={{
                ...styles.accentLine,
                background: config.accentLine,
              }}></div>

              {/* Icon */}
              <div 
                className="system-message-icon"
                style={{
                  ...styles.iconWrap,
                  background: config.iconBg,
                  color: config.iconColor,
                }}
              >
                {getIcon(msg.type)}
              </div>

              {/* Content */}
              <div style={styles.content}>
                <div style={styles.header}>
                  <strong style={{
                    ...styles.titre,
                    color: config.titleColor,
                  }}>
                    {msg.titre}
                  </strong>
                  {msg.priorite === 'haute' && (
                    <span style={styles.urgentBadge}>
                      <AlertTriangle size={10} />
                      Urgent
                    </span>
                  )}
                </div>
                <p style={{
                  ...styles.texte,
                  color: config.textColor,
                }}>
                  {msg.message}
                </p>
              </div>

              {/* Dismiss button */}
              {msg.priorite !== 'haute' && (
                <button
                  className="system-message-dismiss"
                  onClick={() => dismissMessage(msg.id)}
                  style={styles.dismissBtn}
                  title="Fermer"
                >
                  <X size={16} />
                </button>
              )}
            </div>
          )
        })}
      </div>
    </>
  )
}

// ═══════════════════════════════════════════════════════════
// 🎨 STYLES AFROFUTURISTES
// ═══════════════════════════════════════════════════════════

const styles = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    gap: '10px',
    marginBottom: '20px',
  },
  message: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: '14px',
    padding: '16px 18px',
    borderRadius: '16px',
    position: 'relative',
    overflow: 'hidden',
    backdropFilter: 'blur(10px)',
  },
  accentLine: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: '3px',
    borderRadius: '0 2px 2px 0',
  },
  iconWrap: {
    width: '38px',
    height: '38px',
    borderRadius: '12px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  content: {
    flex: 1,
    minWidth: 0,
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    marginBottom: '4px',
    flexWrap: 'wrap',
  },
  titre: {
    display: 'block',
    fontSize: '15px',
    fontWeight: '700',
    letterSpacing: '0.3px',
  },
  urgentBadge: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '4px',
    background: 'rgba(239, 68, 68, 0.2)',
    color: '#EF4444',
    fontSize: '10px',
    fontWeight: '700',
    padding: '3px 8px',
    borderRadius: '6px',
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
  },
  texte: {
    fontSize: '13px',
    margin: 0,
    lineHeight: '1.6',
    opacity: 0.9,
  },
  dismissBtn: {
    background: 'rgba(255, 255, 255, 0.05)',
    border: '1px solid rgba(255, 255, 255, 0.1)',
    borderRadius: '8px',
    padding: '6px',
    color: '#666',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    transition: 'all 0.2s ease',
  },
}