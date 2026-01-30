// Service Worker for Push Notifications
self.addEventListener('push', function(event) {
  if (event.data) {
    const data = event.data.json()

    const options = {
      body: data.body || 'New chat escalation',
      icon: '/icon-192x192.png',
      badge: '/badge-72x72.png',
      tag: data.conversationId || 'chat-notification',
      data: {
        url: data.url || '/admin/chat',
        conversationId: data.conversationId
      },
      requireInteraction: true,
      vibrate: [200, 100, 200],
      actions: [
        {
          action: 'open',
          title: 'Open Chat'
        },
        {
          action: 'close',
          title: 'Dismiss'
        }
      ]
    }

    event.waitUntil(
      self.registration.showNotification(data.title || 'TradeITM Chat', options)
    )
  }
})

self.addEventListener('notificationclick', function(event) {
  event.notification.close()

  if (event.action === 'open' || !event.action) {
    const urlToOpen = event.notification.data.url || '/admin/chat'

    event.waitUntil(
      clients.matchAll({ type: 'window', includeUncontrolled: true })
        .then(function(clientList) {
          // Check if there's already a window open
          for (let i = 0; i < clientList.length; i++) {
            const client = clientList[i]
            if (client.url.includes('/admin') && 'focus' in client) {
              return client.focus().then(() => client.navigate(urlToOpen))
            }
          }
          // If not, open a new window
          if (clients.openWindow) {
            return clients.openWindow(urlToOpen)
          }
        })
    )
  }
})

self.addEventListener('install', function(event) {
  self.skipWaiting()
})

self.addEventListener('activate', function(event) {
  event.waitUntil(clients.claim())
})
