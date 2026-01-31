// Service Worker for Push Notifications and Caching
const CACHE_NAME = 'tradeitm-admin-v1'
const STATIC_ASSETS = [
  '/admin/chat',
  '/icon-192x192.png',
  '/icon-512x512.png',
  '/badge-72x72.png',
  '/manifest.json'
]

// Cache static assets on install
self.addEventListener('install', function(event) {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(function(cache) {
        return cache.addAll(STATIC_ASSETS)
      })
      .then(function() {
        return self.skipWaiting()
      })
  )
})

// Clean old caches on activate
self.addEventListener('activate', function(event) {
  event.waitUntil(
    caches.keys().then(function(cacheNames) {
      return Promise.all(
        cacheNames.filter(function(cacheName) {
          return cacheName !== CACHE_NAME
        }).map(function(cacheName) {
          return caches.delete(cacheName)
        })
      )
    }).then(function() {
      return clients.claim()
    })
  )
})

// Network-first strategy for HTML, cache-first for assets
self.addEventListener('fetch', function(event) {
  const url = new URL(event.request.url)

  // Skip non-GET requests
  if (event.request.method !== 'GET') return

  // Skip API calls and external requests
  if (url.pathname.startsWith('/api/') || url.origin !== location.origin) return

  // For admin routes: network-first with cache fallback
  if (url.pathname.startsWith('/admin')) {
    event.respondWith(
      fetch(event.request)
        .then(function(response) {
          // Clone and cache successful responses
          if (response.ok) {
            const responseClone = response.clone()
            caches.open(CACHE_NAME).then(function(cache) {
              cache.put(event.request, responseClone)
            })
          }
          return response
        })
        .catch(function() {
          // Fallback to cache when offline
          return caches.match(event.request)
        })
    )
    return
  }

  // For static assets (images, fonts, etc.): cache-first
  if (url.pathname.match(/\.(png|jpg|jpeg|gif|svg|ico|woff2?|ttf|eot)$/)) {
    event.respondWith(
      caches.match(event.request)
        .then(function(response) {
          if (response) return response

          return fetch(event.request).then(function(response) {
            if (response.ok) {
              const responseClone = response.clone()
              caches.open(CACHE_NAME).then(function(cache) {
                cache.put(event.request, responseClone)
              })
            }
            return response
          })
        })
    )
    return
  }
})

// Push notification handling
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
