// src/services/pushNotificationService.js
import { supabase } from '../lib/supabase'

const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY
const SW_URL = '/sw-push.js'

class PushNotificationService {
  isSupported() {
    return 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window
  }

  async requestPermission() {
    const permission = await Notification.requestPermission()
    if (permission !== 'granted') throw new Error('Permission notifications refusée')
    return true
  }

  async ensurePushSW() {
    try {
      // IMPORTANT: enregistre explicitement sw-push.js
      const reg = await navigator.serviceWorker.register(SW_URL, { scope: '/' })
      
      // Attendre que le SW soit prêt (max 10s)
      await Promise.race([
        navigator.serviceWorker.ready,
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('ServiceWorker timeout')), 10000)
        )
      ])
      
      return reg
    } catch (err) {
      console.error('❌ Service Worker registration failed:', err)
      throw new Error('Service Worker non disponible')
    }
  }

  async subscribe({ userType, userId, enterpriseId }) {
    if (!this.isSupported()) {
      throw new Error('Push non supporté sur ce navigateur')
    }
    
    if (!VAPID_PUBLIC_KEY) {
      throw new Error('VITE_VAPID_PUBLIC_KEY manquante')
    }

    // Vérifier les permissions AVANT d'enregistrer le SW
    if (Notification.permission !== 'granted') {
      const permission = await this.requestPermission()
      if (!permission) {
        throw new Error('Permission notifications refusée')
      }
    }

    try {
      const reg = await this.ensurePushSW()

      let subscription = await reg.pushManager.getSubscription()
      
      if (!subscription) {
        subscription = await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: this.urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
        })
      }

      const sub = subscription.toJSON()
      
      if (!sub?.endpoint || !sub?.keys?.p256dh || !sub?.keys?.auth) {
        throw new Error('Subscription invalide (keys manquantes)')
      }

      const { error } = await supabase
        .from('push_subscriptions')
        .upsert(
          {
            user_type: userType,
            user_id: userId,
            enterprise_id: enterpriseId || null,
            endpoint: sub.endpoint,
            keys_p256dh: sub.keys.p256dh,
            keys_auth: sub.keys.auth,
            user_agent: navigator.userAgent,
            is_active: true,
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'endpoint' }
        )

      if (error) throw error
      
      console.log('✅ Push subscription enregistrée:', { userType, userId })
      return subscription
      
    } catch (err) {
      console.error('❌ Push subscription error:', err)
      throw err
    }
  }

  async subscribe({ userType, userId, enterpriseId }) {
    if (!this.isSupported()) throw new Error('Push non supporté sur ce navigateur')
    if (!VAPID_PUBLIC_KEY) throw new Error('VITE_VAPID_PUBLIC_KEY manquante')

    await this.requestPermission()
    const reg = await this.ensurePushSW()

    let subscription = await reg.pushManager.getSubscription()
    if (!subscription) {
      subscription = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: this.urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
      })
    }

    const sub = subscription.toJSON()
    if (!sub?.endpoint || !sub?.keys?.p256dh || !sub?.keys?.auth) {
      throw new Error('Subscription invalide (keys manquantes)')
    }

    const { error } = await supabase
      .from('push_subscriptions')
      .upsert(
        {
          user_type: userType,                 // 'admin' | 'employee'
          user_id: userId,                     // admin => auth.users.id ; employee => employees.id
          enterprise_id: enterpriseId || null,
          endpoint: sub.endpoint,
          keys_p256dh: sub.keys.p256dh,
          keys_auth: sub.keys.auth,
          user_agent: navigator.userAgent,
          is_active: true,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'endpoint' }
      )

    if (error) throw error
    return subscription
  }

  async unsubscribeCurrent() {
    if (!this.isSupported()) return

    const reg = await navigator.serviceWorker.getRegistration('/')
    if (!reg) return

    const subscription = await reg.pushManager.getSubscription()
    if (!subscription) return

    const endpoint = subscription.endpoint
    await subscription.unsubscribe()

    await supabase
      .from('push_subscriptions')
      .update({ is_active: false, updated_at: new Date().toISOString() })
      .eq('endpoint', endpoint)
  }

  urlBase64ToUint8Array(base64String) {
    const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
    const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
    const rawData = atob(base64)
    return Uint8Array.from([...rawData].map((char) => char.charCodeAt(0)))
  }
}

export default new PushNotificationService()