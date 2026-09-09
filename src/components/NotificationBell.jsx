// src/components/NotificationBell.jsx

import { useState, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Bell, X, Check, CheckCheck, ShieldCheck, AlertTriangle,
  Clock, CalendarOff, TrendingUp, FileText, ScanFace,
  Megaphone, ChevronRight, CalendarDays,
} from 'lucide-react'

const ICON_MAP = {
  shield: ShieldCheck,
  alert: AlertTriangle,
  clock: Clock,
  calendar: CalendarDays,
  calendarOff: CalendarOff,
  trending: TrendingUp,
  file: FileText,
  scan: ScanFace,
  megaphone: Megaphone,
}

const CATEGORY_LABELS = {
  all: { label: 'Tout', icon: Bell },
  pointages: { label: 'Pointages', icon: Clock },
  planning: { label: 'Planning', icon: CalendarDays },
  rh: { label: 'RH', icon: CalendarOff },
  commercial: { label: 'Commercial', icon: TrendingUp },
  system: { label: 'Système', icon: Megaphone },
}

export default function NotificationBell({ 
  notifications = [], 
  unreadCount = 0, 
  hasHighPriority = false, 
  markAsRead, 
  markAllAsRead, 
  onNavigate 
}) {
  const [isOpen, setIsOpen] = useState(false)
  const [activeCategory, setActiveCategory] = useState('all')
  const [detailModalOpen, setDetailModalOpen] = useState(false)
  const [selectedNotif, setSelectedNotif] = useState(null)
  const panelRef = useRef(null)
  const bellRef = useRef(null)
  const navigate = useNavigate()

  // ═══ ANIMATION : Cloche s'anime si unreadCount > 0 ═══
  const shouldAnimate = unreadCount > 0
  const isUrgent = hasHighPriority || unreadCount >= 3  // Urgent si high priority OU 3+ notifications

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (
        panelRef.current && !panelRef.current.contains(e.target) &&
        bellRef.current && !bellRef.current.contains(e.target)
      ) {
        setIsOpen(false)
      }
    }
    if (isOpen) document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [isOpen])

  const filteredNotifs = activeCategory === 'all'
    ? notifications
    : notifications.filter(n => n.category === activeCategory)

  const categoryCounts = notifications.reduce((acc, n) => {
    if (!n.read) {
      acc[n.category] = (acc[n.category] || 0) + 1
    }
    return acc
  }, {})

  const handleNotifClick = (notif) => {
    if (markAsRead) markAsRead(notif.key)
    
    // ═══ Si c'est un signal d'assiduité, afficher le détail dans une modale ═══
    if (notif.category === 'assiduite') {
      setSelectedNotif(notif)
      setDetailModalOpen(true)
      return
    }
    
    // ═══ Navigation classique pour les autres alertes ═══
    setIsOpen(false)
    if (notif.path) {
      if (onNavigate) onNavigate()
      navigate(notif.path)
    }
  }

  const formatTime = (timestamp) => {
    if (!timestamp) return ''
    const d = new Date(timestamp)
    const now = new Date()
    const diffMs = now - d
    const diffMin = Math.floor(diffMs / 60000)
    const diffH = Math.floor(diffMs / 3600000)

    if (diffMin < 1) return 'À l\'instant'
    if (diffMin < 60) return `il y a ${diffMin}min`
    if (diffH < 24) return `il y a ${diffH}h`
    return d.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' })
  }

  const getPriorityDot = (priority) => {
    if (priority === 'high') return '#EF4444'
    if (priority === 'medium') return '#F59E0B'
    return '#6B7280'
  }

  return (
    <div style={{ position: 'relative' }}>
      <style>{`
        @keyframes bellShake {
          0%, 100% { transform: rotate(0deg); }
          10% { transform: rotate(14deg); }
          20% { transform: rotate(-12deg); }
          30% { transform: rotate(10deg); }
          40% { transform: rotate(-8deg); }
          50% { transform: rotate(6deg); }
          60% { transform: rotate(-4deg); }
          70% { transform: rotate(2deg); }
          80% { transform: rotate(-1deg); }
          90% { transform: rotate(1deg); }
        }
        @keyframes bellPulse {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.1); }
        }
        @keyframes pulseBadge {
          0%, 100% { transform: scale(1); box-shadow: 0 0 0 0 rgba(245,158,11,0.4); }
          50% { transform: scale(1.15); box-shadow: 0 0 0 8px rgba(245,158,11,0); }
        }
        @keyframes urgentPulse {
          0%, 100% { transform: scale(1); box-shadow: 0 0 0 0 rgba(239,68,68,0.5); }
          50% { transform: scale(1.2); box-shadow: 0 0 0 10px rgba(239,68,68,0); }
        }
        @keyframes glowPulse {
          0%, 100% { box-shadow: 0 0 5px rgba(245,158,11,0.3), inset 0 0 5px rgba(245,158,11,0.1); }
          50% { box-shadow: 0 0 20px rgba(245,158,11,0.5), inset 0 0 10px rgba(245,158,11,0.2); }
        }
        @keyframes notifSlideIn {
          from { opacity: 0; transform: translateY(-8px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes panelFadeIn {
          from { opacity: 0; transform: translateY(-10px) scale(0.98); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }
        .notif-item:hover {
          background: rgba(245,158,11,0.08) !important;
          border-color: rgba(245,158,11,0.2) !important;
        }
        .notif-cat-btn:hover {
          background: rgba(245,158,11,0.1) !important;
        }
        .bell-container-active {
          animation: glowPulse 2s ease-in-out infinite;
        }
      `}</style>

      {/* ═══ BELL BUTTON ═══ */}
      <button
        ref={bellRef}
        onClick={() => setIsOpen(!isOpen)}
        className={shouldAnimate ? 'bell-container-active' : ''}
        style={{
          position: 'relative',
          width: '44px',
          height: '44px',
          borderRadius: '12px',
          background: isOpen 
            ? 'rgba(245,158,11,0.2)' 
            : shouldAnimate 
              ? 'rgba(245,158,11,0.12)' 
              : 'rgba(245,158,11,0.08)',
          border: `1.5px solid ${
            isOpen 
              ? 'rgba(245,158,11,0.4)' 
              : shouldAnimate 
                ? 'rgba(245,158,11,0.3)' 
                : 'rgba(245,158,11,0.15)'
          }`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: 'pointer',
          transition: 'all 0.3s ease',
        }}
      >
        <Bell
          size={21}
          color="#F59E0B"
          style={{
            animation: shouldAnimate 
              ? isUrgent 
                ? 'bellShake 0.8s ease-in-out infinite' 
                : 'bellPulse 1.5s ease-in-out infinite'
              : 'none',
            filter: shouldAnimate ? 'drop-shadow(0 0 4px rgba(245,158,11,0.5))' : 'none',
          }}
        />

        {/* ═══ BADGE ═══ */}
        {unreadCount > 0 && (
          <span style={{
            position: 'absolute',
            top: '-7px',
            right: '-7px',
            minWidth: '22px',
            height: '22px',
            borderRadius: '11px',
            background: isUrgent
              ? 'linear-gradient(135deg, #EF4444, #DC2626)'
              : 'linear-gradient(135deg, #F59E0B, #D97706)',
            color: '#FFF',
            fontSize: '11px',
            fontWeight: '800',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '0 6px',
            border: '2.5px solid #0F0F19',
            animation: isUrgent ? 'urgentPulse 1.2s infinite' : 'pulseBadge 2s infinite',
            zIndex: 10,
          }}>
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {/* ═══ DROPDOWN PANEL ═══ */}
      {isOpen && (
        <div
          ref={panelRef}
          style={{
            position: 'absolute',
            top: 'calc(100% + 10px)',
            right: 0,
            width: 'min(420px, calc(100vw - 32px))',
            maxHeight: '75vh',
            background: 'linear-gradient(180deg, #161628 0%, #0F0F1A 100%)',
            border: '1px solid rgba(245,158,11,0.2)',
            borderRadius: '20px',
            boxShadow: '0 25px 80px rgba(0,0,0,0.7), 0 0 60px rgba(245,158,11,0.08)',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            animation: 'panelFadeIn 0.25s ease forwards',
            zIndex: 1000,
          }}
        >
          {/* Header */}
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: '18px 20px',
            borderBottom: '1px solid rgba(255,255,255,0.06)',
            background: 'rgba(245,158,11,0.03)',
            flexShrink: 0,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div style={{
                width: '36px', height: '36px', borderRadius: '11px',
                background: unreadCount > 0 
                  ? 'linear-gradient(135deg, rgba(245,158,11,0.2), rgba(245,158,11,0.1))' 
                  : 'rgba(245,158,11,0.1)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                border: '1px solid rgba(245,158,11,0.2)',
              }}>
                <Bell size={18} color="#F59E0B" />
              </div>
              <div>
                <h3 style={{ color: '#FFF', fontSize: '16px', fontWeight: '700', margin: 0 }}>
                  Notifications
                </h3>
                <span style={{ 
                  color: unreadCount > 0 ? '#F59E0B' : '#666', 
                  fontSize: '12px',
                  fontWeight: unreadCount > 0 ? '600' : '400',
                }}>
                  {unreadCount > 0 ? `${unreadCount} non lue${unreadCount > 1 ? 's' : ''}` : 'Tout est lu ✓'}
                </span>
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              {unreadCount > 0 && markAllAsRead && (
                <button
                  onClick={markAllAsRead}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '6px',
                    background: 'rgba(16,185,129,0.12)',
                    border: '1px solid rgba(16,185,129,0.25)',
                    color: '#10B981',
                    padding: '7px 14px',
                    borderRadius: '9px',
                    fontSize: '12px',
                    fontWeight: '700',
                    cursor: 'pointer',
                    fontFamily: 'inherit',
                    transition: 'all 0.2s ease',
                  }}
                >
                  <CheckCheck size={14} /> Tout lu
                </button>
              )}
              <button
                onClick={() => setIsOpen(false)}
                style={{
                  width: '32px', height: '32px', borderRadius: '9px',
                  background: 'rgba(255,255,255,0.05)',
                  border: '1px solid rgba(255,255,255,0.1)',
                  color: '#888', cursor: 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  transition: 'all 0.2s ease',
                }}
              >
                <X size={16} />
              </button>
            </div>
          </div>

          {/* Category tabs */}
          <div style={{
            display: 'flex',
            gap: '6px',
            padding: '12px 16px',
            borderBottom: '1px solid rgba(255,255,255,0.04)',
            overflowX: 'auto',
            flexShrink: 0,
            background: 'rgba(0,0,0,0.15)',
          }}>
            {Object.entries(CATEGORY_LABELS).map(([key, { label }]) => {
              const count = key === 'all' ? unreadCount : (categoryCounts[key] || 0)
              const isActive = activeCategory === key
              return (
                <button
                  key={key}
                  className="notif-cat-btn"
                  onClick={() => setActiveCategory(key)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '6px',
                    padding: '7px 14px',
                    borderRadius: '9px',
                    border: `1px solid ${isActive ? 'rgba(245,158,11,0.35)' : 'rgba(255,255,255,0.08)'}`,
                    background: isActive ? 'rgba(245,158,11,0.15)' : 'transparent',
                    color: isActive ? '#F59E0B' : '#888',
                    fontSize: '12px',
                    fontWeight: isActive ? '700' : '500',
                    cursor: 'pointer',
                    fontFamily: 'inherit',
                    whiteSpace: 'nowrap',
                    flexShrink: 0,
                    transition: 'all 0.2s ease',
                  }}
                >
                  {label}
                  {count > 0 && (
                    <span style={{
                      minWidth: '18px', height: '18px',
                      borderRadius: '9px',
                      background: isActive ? '#F59E0B' : 'rgba(255,255,255,0.12)',
                      color: isActive ? '#000' : '#AAA',
                      fontSize: '10px',
                      fontWeight: '800',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      padding: '0 5px',
                    }}>
                      {count}
                    </span>
                  )}
                </button>
              )
            })}
          </div>

          {/* Notifications list */}
          <div style={{
            flex: 1,
            overflowY: 'auto',
            padding: '10px 14px',
          }}>
            {filteredNotifs.length === 0 ? (
              <div style={{
                display: 'flex', flexDirection: 'column',
                alignItems: 'center', justifyContent: 'center',
                padding: '50px 20px', gap: '14px',
              }}>
                <div style={{
                  width: '60px', height: '60px', borderRadius: '18px',
                  background: 'rgba(16,185,129,0.1)',
                  border: '1px solid rgba(16,185,129,0.2)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <Check size={28} color="#10B981" />
                </div>
                <p style={{ color: '#AAA', fontSize: '15px', fontWeight: '600', margin: 0 }}>
                  Aucune notification
                </p>
                <p style={{ color: '#555', fontSize: '13px', margin: 0, textAlign: 'center' }}>
                  {activeCategory !== 'all' ? 'Dans cette catégorie' : 'Tout est en ordre !'}
                </p>
              </div>
            ) : (
              filteredNotifs.map((notif, i) => {
                const IconComponent = ICON_MAP[notif.icon] || Bell
                return (
                  <button
                    key={notif.key}
                    className="notif-item"
                    onClick={() => handleNotifClick(notif)}
                    style={{
                      width: '100%',
                      display: 'flex',
                      alignItems: 'flex-start',
                      gap: '14px',
                      padding: '14px 16px',
                      borderRadius: '14px',
                      border: `1px solid ${!notif.read ? `${notif.color}30` : 'rgba(255,255,255,0.05)'}`,
                      background: !notif.read ? `${notif.color}0A` : 'transparent',
                      cursor: 'pointer',
                      textAlign: 'left',
                      fontFamily: 'inherit',
                      marginBottom: '6px',
                      transition: 'all 0.2s ease',
                      animation: `notifSlideIn 0.25s ease ${i * 0.04}s both`,
                      position: 'relative',
                    }}
                  >
                    {/* Priority dot */}
                    {!notif.read && (
                      <div style={{
                        position: 'absolute',
                        top: '16px',
                        left: '8px',
                        width: '8px',
                        height: '8px',
                        borderRadius: '50%',
                        background: getPriorityDot(notif.priority),
                        boxShadow: `0 0 10px ${getPriorityDot(notif.priority)}90`,
                      }} />
                    )}

                    {/* Icon */}
                    <div style={{
                      width: '42px', height: '42px', borderRadius: '12px',
                      background: `${notif.color}18`,
                      border: `1px solid ${notif.color}25`,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      flexShrink: 0,
                      marginLeft: !notif.read ? '12px' : '0',
                    }}>
                      <IconComponent size={20} color={notif.color} />
                    </div>

                    {/* Content */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{
                        color: notif.read ? '#AAA' : '#FFF',
                        fontSize: '14px',
                        fontWeight: notif.read ? '500' : '600',
                        margin: '0 0 4px 0',
                        lineHeight: '1.35',
                      }}>
                        {notif.title}
                      </p>
                      <p style={{
                        color: notif.read ? '#666' : '#999',
                        fontSize: '12px',
                        margin: '0 0 6px 0',
                        lineHeight: '1.45',
                        display: '-webkit-box',
                        WebkitLineClamp: 2,
                        WebkitBoxOrient: 'vertical',
                        overflow: 'hidden',
                      }}>
                        {notif.subtitle}
                      </p>
                      <span style={{
                        color: '#555',
                        fontSize: '11px',
                        fontWeight: '500',
                      }}>
                        {formatTime(notif.timestamp)}
                      </span>
                    </div>

                    {/* Arrow */}
                    <ChevronRight size={16} color="#555" style={{ flexShrink: 0, marginTop: '4px' }} />
                  </button>
                )
              })
            )}
          </div>

          {/* Footer */}
          {notifications.length > 0 && (
            <div style={{
              padding: '14px 18px',
              borderTop: '1px solid rgba(255,255,255,0.06)',
              display: 'flex',
              justifyContent: 'center',
              background: 'rgba(0,0,0,0.1)',
              flexShrink: 0,
            }}>
              <span style={{
                color: '#555',
                fontSize: '11px',
                fontWeight: '500',
              }}>
                {notifications.length} notification{notifications.length > 1 ? 's' : ''} · Actualisation auto 60s
              </span>
            </div>
          )}
        </div>
      )}

      {/* ═══ MODALE DE DÉTAIL POUR LES SIGNAUX D'ASSIDUITÉ ═══ */}
      {detailModalOpen && selectedNotif && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0,0,0,0.6)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 9999,
          backdropFilter: 'blur(4px)',
        }} onClick={() => setDetailModalOpen(false)}>
          <div style={{
            background: 'white',
            borderRadius: '20px',
            padding: '32px',
            maxWidth: '500px',
            width: '90%',
            maxHeight: '80vh',
            overflow: 'auto',
            boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)',
          }} onClick={e => e.stopPropagation()}>
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: '20px',
            }}>
              <h3 style={{
                margin: 0,
                color: '#111',
                fontSize: '18px',
                fontWeight: '700',
              }}>
                Signal d'assiduité
              </h3>
              <button onClick={() => setDetailModalOpen(false)} style={{
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                padding: '8px',
                borderRadius: '8px',
              }}>
                <X size={20} color="#666" />
              </button>
            </div>
            
            <div style={{
              color: '#333',
              fontSize: '15px',
              lineHeight: '1.6',
              marginBottom: '20px',
            }}>
              <p style={{ fontWeight: '600', marginBottom: '8px' }}>
                {selectedNotif.title}
              </p>
              <p style={{ color: '#555', whiteSpace: 'pre-wrap' }}>
                {selectedNotif.subtitle}
              </p>
            </div>
            
            <div style={{
              display: 'flex',
              gap: '12px',
              justifyContent: 'flex-end',
            }}>
              <button onClick={() => setDetailModalOpen(false)} style={{
                padding: '10px 24px',
                borderRadius: '10px',
                border: '1px solid #ddd',
                background: 'white',
                color: '#666',
                cursor: 'pointer',
                fontSize: '14px',
                fontWeight: '600',
              }}>
                Fermer
              </button>
              <button onClick={() => {
                setDetailModalOpen(false)
                if (selectedNotif.path) {
                  if (onNavigate) onNavigate()
                  navigate(selectedNotif.path)
                }
              }} style={{
                padding: '10px 24px',
                borderRadius: '10px',
                border: 'none',
                background: '#F59E0B',
                color: 'white',
                cursor: 'pointer',
                fontSize: '14px',
                fontWeight: '600',
              }}>
                Voir les pointages
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}