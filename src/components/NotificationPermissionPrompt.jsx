// src/components/NotificationPermissionPrompt.jsx

import { useEffect, useState } from 'react'
import { Bell, X, CheckCircle2 } from 'lucide-react'
import pushNotificationService from '../services/pushNotificationService'

export default function NotificationPermissionPrompt({ userType = 'admin' }) {
  const [show, setShow] = useState(false)

  useEffect(() => {
    if (!('Notification' in window)) return
    if (Notification.permission !== 'default') return

    const dismissed = localStorage.getItem(`notif_prompt_dismissed_${userType}`)
    if (dismissed === 'true') return

    const timer = setTimeout(() => setShow(true), 2500)
    return () => clearTimeout(timer)
  }, [userType])

const handleAllow = async () => {
  const result = await Notification.requestPermission()

  if (result !== 'granted') return

  try {
    if (userType === 'admin') {
      const adminData = JSON.parse(localStorage.getItem('admin') || '{}')
      const enterpriseId = adminData.selectedEnterprise?.id || adminData.enterprise_id || null

      if (adminData?.id) {
        await pushNotificationService.subscribe({
          userType: 'admin',
          userId: adminData.id,
          enterpriseId: enterpriseId,
        })
      }
    }

    if (userType === 'employee') {
      const empData = JSON.parse(localStorage.getItem('employee') || '{}')
      if (empData?.id) {
        await pushNotificationService.subscribe({
          userType: 'employee',
          userId: empData.id,
          enterpriseId: empData.enterprise_id || null,
        })
      }
    }

    setShow(false)
  } catch (e) {
    console.error(e)
  }
}

  const handleLater = () => {
    localStorage.setItem(`notif_prompt_dismissed_${userType}`, 'true')
    setShow(false)
  }

  if (!show || !('Notification' in window) || Notification.permission !== 'default') {
    return null
  }

  const items = userType === 'employee'
    ? [
        'Nouvelles fiches de paie',
        'Validation ou refus de congé',
        'Nouvelles tâches assignées',
        'Réponse à vos demandes de planning',
      ]
    : [
        'Nouveaux pointages',
        'Conflits absence / pointage',
        'Demandes de congés',
        'Demandes planning, tâches et prédictions',
      ]

  return (
    <div style={styles.overlay}>
      <div style={styles.card}>
        <button onClick={handleLater} style={styles.closeBtn}>
          <X size={16} />
        </button>

        <div style={styles.iconWrap}>
          <Bell size={28} color="#F59E0B" />
        </div>

        <h3 style={styles.title}>Activer les notifications ?</h3>
        <p style={styles.text}>
          Recevez des alertes en temps réel directement sur votre appareil.
        </p>

        <div style={styles.list}>
          {items.map((item) => (
            <div key={item} style={styles.listItem}>
              <CheckCircle2 size={14} color="#10B981" />
              <span>{item}</span>
            </div>
          ))}
        </div>

        <div style={styles.actions}>
          <button onClick={handleLater} style={styles.secondaryBtn}>
            Plus tard
          </button>
          <button onClick={handleAllow} style={styles.primaryBtn}>
            <Bell size={14} />
            Activer
          </button>
        </div>
      </div>
    </div>
  )
}

const styles = {
  overlay: {
    position: 'fixed',
    inset: 0,
    background: 'rgba(0,0,0,0.65)',
    backdropFilter: 'blur(5px)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 9999,
    padding: 20,
  },
  card: {
    position: 'relative',
    width: '100%',
    maxWidth: 420,
    background: '#141423',
    border: '1px solid rgba(245,158,11,0.2)',
    borderRadius: 20,
    padding: 28,
    boxShadow: '0 20px 60px rgba(0,0,0,0.5)',
  },
  closeBtn: {
    position: 'absolute',
    top: 14,
    right: 14,
    width: 30,
    height: 30,
    borderRadius: 8,
    border: 'none',
    background: 'rgba(255,255,255,0.06)',
    color: '#888',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconWrap: {
    width: 60,
    height: 60,
    borderRadius: 16,
    background: 'rgba(245,158,11,0.12)',
    border: '1px solid rgba(245,158,11,0.2)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    margin: '0 auto 18px',
  },
  title: {
    color: '#FFF',
    fontSize: 20,
    fontWeight: 700,
    margin: '0 0 8px',
    textAlign: 'center',
  },
  text: {
    color: '#888',
    fontSize: 13,
    lineHeight: 1.5,
    textAlign: 'center',
    margin: '0 0 18px',
  },
  list: {
    display: 'flex',
    flexDirection: 'column',
    gap: 10,
    marginBottom: 22,
  },
  listItem: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    color: '#DDD',
    fontSize: 13,
  },
  actions: {
    display: 'flex',
    gap: 10,
  },
  secondaryBtn: {
    flex: 1,
    padding: '12px 14px',
    borderRadius: 12,
    border: '1px solid rgba(255,255,255,0.08)',
    background: 'rgba(255,255,255,0.04)',
    color: '#DDD',
    cursor: 'pointer',
    fontWeight: 600,
    fontFamily: 'inherit',
  },
  primaryBtn: {
    flex: 1,
    padding: '12px 14px',
    borderRadius: 12,
    border: 'none',
    background: 'linear-gradient(135deg, #F59E0B, #D97706)',
    color: '#000',
    cursor: 'pointer',
    fontWeight: 700,
    fontFamily: 'inherit',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
}