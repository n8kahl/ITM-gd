const STATIC_CACHE_NAME = 'tradeitm-static-v3'
const RUNTIME_CACHE_NAME = 'tradeitm-runtime-v3'
const JOURNAL_API_CACHE_NAME = 'tradeitm-journal-api-v1'

const STATIC_ASSETS = [
  '/',
  '/members/journal',
  '/manifest.json',
  '/favicon.png',
  '/logo.png',
  '/apple-touch-icon.png',
]

const CACHED_FILE_PATTERN = /\.(?:js|css|png|jpg|jpeg|gif|svg|webp|ico|woff2?|ttf)$/

async function networkFirst(request, cacheName) {
  try {
    const networkResponse = await fetch(request)
    if (networkResponse && networkResponse.ok) {
      const cache = await caches.open(cacheName)
      cache.put(request, networkResponse.clone())
    }
    return networkResponse
  } catch (error) {
    const cachedResponse = await caches.match(request)
    if (cachedResponse) return cachedResponse
    throw error
  }
}

async function cacheFirst(request, cacheName) {
  const cachedResponse = await caches.match(request)
  if (cachedResponse) return cachedResponse

  const response = await fetch(request)
  if (response && response.ok) {
    const cache = await caches.open(cacheName)
    cache.put(request, response.clone())
  }
  return response
}

async function staleWhileRevalidate(request, cacheName) {
  const cache = await caches.open(cacheName)
  const cachedResponse = await cache.match(request)

  const networkPromise = fetch(request)
    .then((response) => {
      if (response && response.ok) {
        cache.put(request, response.clone())
      }
      return response
    })
    .catch(() => null)

  return cachedResponse || networkPromise || fetch(request)
}

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE_NAME)
      .then((cache) => Promise.allSettled(STATIC_ASSETS.map((asset) => cache.add(asset))))
      .then(() => self.skipWaiting()),
  )
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((cacheNames) => Promise.all(
        cacheNames
          .filter((cacheName) => ![
            STATIC_CACHE_NAME,
            RUNTIME_CACHE_NAME,
            JOURNAL_API_CACHE_NAME,
          ].includes(cacheName))
          .map((cacheName) => caches.delete(cacheName)),
      ))
      .then(() => self.clients.claim()),
  )
})

self.addEventListener('fetch', (event) => {
  const { request } = event
  if (request.method !== 'GET') return

  const requestUrl = new URL(request.url)
  if (requestUrl.origin !== self.location.origin) return

  if (requestUrl.pathname.startsWith('/api/members/journal')) {
    event.respondWith(networkFirst(request, JOURNAL_API_CACHE_NAME))
    return
  }

  if (request.mode === 'navigate') {
    event.respondWith(networkFirst(request, RUNTIME_CACHE_NAME))
    return
  }

  if (CACHED_FILE_PATTERN.test(requestUrl.pathname)) {
    event.respondWith(cacheFirst(request, RUNTIME_CACHE_NAME))
    return
  }

  event.respondWith(staleWhileRevalidate(request, RUNTIME_CACHE_NAME))
})

self.addEventListener('push', (event) => {
  const payload = event.data ? event.data.json() : {}
  const title = payload.title || 'TradeITM Alert'
  const body = payload.body || 'You have a new journal update.'
  const icon = payload.icon || '/logo.png'
  const badge = payload.badge || '/favicon.png'
  const url = payload.url || '/members/journal'

  const options = {
    body,
    icon,
    badge,
    tag: payload.tag || 'tradeitm-notification',
    data: { url },
    requireInteraction: payload.requireInteraction === true,
    actions: [
      { action: 'open', title: 'Open' },
      { action: 'dismiss', title: 'Dismiss' },
    ],
  }

  event.waitUntil(self.registration.showNotification(title, options))
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  if (event.action === 'dismiss') return

  const urlToOpen = event.notification?.data?.url || '/members/journal'

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true })
      .then((clientList) => {
        for (const client of clientList) {
          if (client.url.startsWith(self.location.origin) && 'focus' in client) {
            return client.focus().then(() => client.navigate(urlToOpen))
          }
        }

        if (self.clients.openWindow) {
          return self.clients.openWindow(urlToOpen)
        }

        return undefined
      }),
  )
})
