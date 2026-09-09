// src/services/notificationService.js

import { db } from '../lib/db'

class NotificationService {
  constructor() {
    this.channels = new Map()
    this.soundCache = new Map()
  }

  async requestPermission() {
    if (!('Notification' in window)) {
      console.warn('Notifications non supportées')
      return false
    }

    if (Notification.permission === 'granted') return true
    if (Notification.permission === 'denied') return false

    const result = await Notification.requestPermission()
    return result === 'granted'
  }

  canNotify() {
    return 'Notification' in window && Notification.permission === 'granted'
  }

  show(title, options = {}) {
    if (!this.canNotify()) return null

    const notification = new Notification(title, {
      icon: '/pwa-192x192.png',
      badge: '/pwa-192x192.png',
      tag: options.tag || 'encheck',
      renotify: options.renotify || false,
      requireInteraction: options.requireInteraction || false,
      body: options.body || '',
      data: options.data || null,
    })

    if (options.vibrate && 'vibrate' in navigator) {
      navigator.vibrate(options.vibrate)
    }

    if (options.sound) {
      this.playSound(options.sound)
    }

    if (options.onClick) {
      notification.onclick = (e) => {
        e.preventDefault()
        window.focus()
        options.onClick()
        notification.close()
      }
    }

    if (options.autoClose && !options.requireInteraction) {
      setTimeout(() => notification.close(), options.autoClose)
    }

    return notification
  }

  playSound(soundFile) {
    try {
      let audio = this.soundCache.get(soundFile)

      if (!audio) {
        audio = new Audio(`/sounds/${soundFile}`)
        audio.volume = 0.6
        this.soundCache.set(soundFile, audio)
      }

      audio.currentTime = 0
      audio.play().catch((err) => {
        console.warn('Lecture audio bloquée:', err?.message)
      })
    } catch (err) {
      console.warn('Erreur son notification:', err)
    }
  }

  listenToTable(tableName, config = {}, callback) {
    const { filter = null, event = '*' } = config
    const channelName = `${tableName}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`

    const channel = db()
      .channel(channelName)
      .on(
        'postgres_changes',
        {
          event,
          schema: 'public',
          table: tableName,
          ...(filter ? { filter } : {}),
        },
        callback
      )
      .subscribe((status) => {
        console.log(`[Realtime:${tableName}]`, status)
      })

    this.channels.set(channelName, channel)

    return () => {
      db().removeChannel(channel)
      this.channels.delete(channelName)
    }
  }

  cleanup() {
    this.channels.forEach((channel) => {
      db().removeChannel(channel)
    })
    this.channels.clear()
  }
}

export default new NotificationService()