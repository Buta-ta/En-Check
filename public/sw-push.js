// public/sw-push.js
self.addEventListener('install', () => self.skipWaiting())

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim())
})

self.addEventListener('push', (event) => {
  let data = { title: 'En-Check', body: 'Nouvelle notification', url: '/' }
  try {
    if (event.data) data = event.data.json()
  } catch (_) {}

  const options = {
    body: data.body || '',
    icon: '/pwa-192x192.png',
    badge: '/pwa-192x192.png',
    tag: data.tag || 'encheck-push',
    renotify: true,
    requireInteraction: !!data.requireInteraction,
    vibrate: data.vibrate || [200, 100, 200],
    data: { url: data.url || '/', ...(data.data || {}) },
    // ✅ AJOUT SON
    silent: false,  // Important : ne pas mettre en mode silencieux
  }

  event.waitUntil(
    self.registration.showNotification(data.title || 'En-Check', options)
  )
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const url = event.notification.data?.url || '/'

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if ('focus' in client) {
          client.navigate(url)
          return client.focus()
        }
      }
      return self.clients.openWindow(url)
    })
  )
})