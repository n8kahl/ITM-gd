const STATIC_CACHE_NAME = 'tradeitm-static-v5'
const RUNTIME_CACHE_NAME = 'tradeitm-runtime-v5'
const API_CACHE_NAME = 'tradeitm-api-v2'
const JOURNAL_MUTATION_DB_NAME = 'tradeitm-offline-journal'
const JOURNAL_MUTATION_STORE_NAME = 'mutations'
const JOURNAL_MUTATION_SYNC_TAG = 'journal-mutation-sync-v1'

const STATIC_ASSETS = [
  '/',
  '/members/journal',
  '/manifest.json',
  '/favicon.png',
  '/hero-logo.png',
  '/apple-touch-icon.png',
]

const CACHED_FILE_PATTERN = /\.(?:png|jpg|jpeg|gif|svg|webp|ico|woff2?|ttf)$/
const RETRYABLE_HTTP_STATUSES = new Set([408, 425, 429])

function buildOfflineQueueId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
}

function headersToRecord(headers) {
  const record = {}
  for (const [key, value] of headers.entries()) {
    if (key.toLowerCase() === 'content-type') {
      record[key] = value
    }
  }
  return record
}

function openJournalMutationDb() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(JOURNAL_MUTATION_DB_NAME, 1)

    request.onupgradeneeded = () => {
      const db = request.result
      if (!db.objectStoreNames.contains(JOURNAL_MUTATION_STORE_NAME)) {
        db.createObjectStore(JOURNAL_MUTATION_STORE_NAME, { keyPath: 'id' })
      }
    }

    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error || new Error('Failed to open journal queue database'))
  })
}

async function withMutationStore(mode, run) {
  const db = await openJournalMutationDb()

  return new Promise((resolve, reject) => {
    const transaction = db.transaction(JOURNAL_MUTATION_STORE_NAME, mode)
    const store = transaction.objectStore(JOURNAL_MUTATION_STORE_NAME)
    const request = run(store)

    if (!request) {
      reject(new Error('Invalid queue request'))
      return
    }

    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error || new Error('Queue operation failed'))
    transaction.oncomplete = () => db.close()
    transaction.onerror = () => reject(transaction.error || new Error('Queue transaction failed'))
  })
}

async function enqueueJournalMutation(request) {
  const body = request.method === 'DELETE'
    ? null
    : await request.clone().text()

  const payload = {
    id: buildOfflineQueueId(),
    url: request.url,
    method: request.method,
    headers: headersToRecord(request.headers),
    body,
    createdAt: Date.now(),
  }

  await withMutationStore('readwrite', (store) => store.put(payload))

  if (self.registration.sync) {
    try {
      await self.registration.sync.register(JOURNAL_MUTATION_SYNC_TAG)
    } catch (error) {
      // Sync can fail silently if not supported by the browser/OS.
      console.warn('Failed to register journal sync task:', error)
    }
  }
}

async function listJournalMutations() {
  const items = await withMutationStore('readonly', (store) => store.getAll())
  return (items || []).sort((a, b) => a.createdAt - b.createdAt)
}

async function removeJournalMutation(id) {
  await withMutationStore('readwrite', (store) => store.delete(id))
}

async function flushJournalMutationQueue() {
  const queuedMutations = await listJournalMutations()
  if (queuedMutations.length === 0) return

  for (const mutation of queuedMutations) {
    try {
      const response = await fetch(mutation.url, {
        method: mutation.method,
        headers: mutation.headers,
        body: mutation.body || undefined,
        credentials: 'include',
      })

      if (response.ok) {
        await removeJournalMutation(mutation.id)
        continue
      }

      const isRetryableStatus = (
        response.status >= 500
        || RETRYABLE_HTTP_STATUSES.has(response.status)
      )

      if (!isRetryableStatus) {
        // Drop permanently invalid mutations (4xx non-retryable).
        await removeJournalMutation(mutation.id)
        continue
      }

      throw new Error(`Retryable mutation replay response: ${response.status}`)
    } catch (error) {
      console.warn('Failed to replay queued journal mutation:', error)
      break
    }
  }
}

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

async function handleJournalMutation(request) {
  try {
    return await fetch(request.clone())
  } catch (error) {
    console.warn('Queueing journal mutation for background sync:', error)

    try {
      await enqueueJournalMutation(request)
    } catch (queueError) {
      console.error('Failed to queue journal mutation:', queueError)
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Failed to queue journal mutation while offline',
        }),
        {
          status: 503,
          headers: { 'Content-Type': 'application/json' },
        },
      )
    }

    return new Response(
      JSON.stringify({
        success: true,
        data: null,
        meta: {
          queued: true,
          offline: true,
        },
      }),
      {
        status: 202,
        headers: { 'Content-Type': 'application/json' },
      },
    )
  }
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
            API_CACHE_NAME,
          ].includes(cacheName))
          .map((cacheName) => caches.delete(cacheName)),
      ))
      .then(() => flushJournalMutationQueue())
      .then(() => self.clients.claim()),
  )
})

self.addEventListener('fetch', (event) => {
  const { request } = event
  const requestUrl = new URL(request.url)

  if (requestUrl.origin !== self.location.origin) return

  if (
    requestUrl.pathname === '/api/members/journal'
    && ['POST', 'PATCH', 'DELETE'].includes(request.method)
  ) {
    event.respondWith(handleJournalMutation(request))
    return
  }

  if (request.method !== 'GET') return

  // Never cache Next.js build assets in SW.
  // Mixing old/new chunks across deploys can crash hydration/runtime.
  if (requestUrl.pathname.startsWith('/_next/')) {
    event.respondWith(fetch(request))
    return
  }

  if (requestUrl.pathname.startsWith('/api/')) {
    event.respondWith(networkFirst(request, API_CACHE_NAME))
    return
  }

  if (request.mode === 'navigate') {
    event.respondWith(networkFirst(request, RUNTIME_CACHE_NAME))
    return
  }

  if (CACHED_FILE_PATTERN.test(requestUrl.pathname)) {
    event.respondWith(cacheFirst(request, STATIC_CACHE_NAME))
    return
  }

  event.respondWith(staleWhileRevalidate(request, RUNTIME_CACHE_NAME))
})

self.addEventListener('sync', (event) => {
  if (event.tag === JOURNAL_MUTATION_SYNC_TAG) {
    event.waitUntil(flushJournalMutationQueue())
  }
})

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting()
    return
  }

  if (event.data && event.data.type === 'JOURNAL_SYNC_NOW') {
    event.waitUntil(flushJournalMutationQueue())
  }
})

self.addEventListener('push', (event) => {
  const payload = event.data ? event.data.json() : {}
  const title = payload.title || 'TradeITM Alert'
  const body = payload.body || 'You have a new journal update.'
  const icon = payload.icon || '/hero-logo.png'
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
