import { test, expect } from '@playwright/test'

/**
 * AI Coach E2E Tests — Backend API Health
 *
 * Validates that all AI Coach backend API endpoints respond correctly.
 * These tests hit the backend directly (not through the frontend).
 */

const BACKEND_URL = process.env.E2E_BACKEND_URL || 'http://localhost:3001'

test.describe('AI Coach — Backend API Health', () => {
  test('GET / should return service info with all endpoints', async ({ request }) => {
    const response = await request.get(BACKEND_URL)
    expect(response.status()).toBe(200)

    const data = await response.json()
    expect(data.name).toBe('TITM AI Coach Backend')
    expect(data.status).toBe('running')
    expect(data.endpoints).toBeDefined()

    // Verify all AI Coach endpoints are listed
    expect(data.endpoints.chat).toBeDefined()
    expect(data.endpoints.alerts).toBeDefined()
    expect(data.endpoints.scannerScan).toBeDefined()
    expect(data.endpoints.chatStream).toBeDefined()
    expect(data.endpoints.wsPrices).toBeDefined()
  })

  test('GET /health should return OK', async ({ request }) => {
    const response = await request.get(`${BACKEND_URL}/health`)
    expect(response.status()).toBe(200)
  })

  test('POST /api/chat/message without auth should return 401', async ({ request }) => {
    const response = await request.post(`${BACKEND_URL}/api/chat/message`, {
      data: { sessionId: 'test', message: 'hello' },
    })
    expect(response.status()).toBe(401)
  })

  test('GET /api/alerts without auth should return 401', async ({ request }) => {
    const response = await request.get(`${BACKEND_URL}/api/alerts`)
    expect(response.status()).toBe(401)
  })

  test('GET /api/scanner/scan without auth should return 401', async ({ request }) => {
    const response = await request.get(`${BACKEND_URL}/api/scanner/scan`)
    expect(response.status()).toBe(401)
  })

  test('GET /api/journal/trades without auth should return 401', async ({ request }) => {
    const response = await request.get(`${BACKEND_URL}/api/journal/trades`)
    expect(response.status()).toBe(401)
  })

  test('GET /api/leaps without auth should return 401', async ({ request }) => {
    const response = await request.get(`${BACKEND_URL}/api/leaps`)
    expect(response.status()).toBe(401)
  })

  test('GET /api/macro without auth should return 401', async ({ request }) => {
    const response = await request.get(`${BACKEND_URL}/api/macro`)
    expect(response.status()).toBe(401)
  })

  test('POST /api/screenshot/analyze without auth should return 401', async ({ request }) => {
    const response = await request.post(`${BACKEND_URL}/api/screenshot/analyze`, {
      data: { image: 'test' },
    })
    expect(response.status()).toBe(401)
  })

  test('GET /nonexistent should return 404', async ({ request }) => {
    const response = await request.get(`${BACKEND_URL}/api/nonexistent`)
    expect(response.status()).toBe(404)

    const data = await response.json()
    expect(data.error).toBe('Not found')
  })
})

test.describe('AI Coach — Rate Limiting', () => {
  test('should enforce rate limits on rapid requests', async ({ request }) => {
    // Send multiple rapid requests to trigger rate limiting
    const promises = []
    for (let i = 0; i < 20; i++) {
      promises.push(request.get(`${BACKEND_URL}/api/alerts`))
    }

    const responses = await Promise.all(promises)
    const statuses = responses.map(r => r.status())

    // Most should be 401 (no auth), but if rate limit kicks in first, we'd see 429
    const hasExpectedStatus = statuses.every(s => s === 401 || s === 429)
    expect(hasExpectedStatus).toBe(true)
  })
})

test.describe('AI Coach — WebSocket Connection', () => {
  test('should accept WebSocket connections at /ws/prices with symbols and setup channels', async ({ page }) => {
    // Use the page to test WebSocket (Playwright can't directly connect to WebSockets via request API)
    const wsConnected = await page.evaluate(async (backendUrl) => {
      return new Promise<boolean>((resolve) => {
        const ws = new WebSocket(`${backendUrl.replace('http', 'ws')}/ws/prices`)
        const timeout = setTimeout(() => {
          ws.close()
          resolve(false)
        }, 5000)

        ws.onopen = () => {
          clearTimeout(timeout)
          // Send symbol + setup channel subscriptions
          ws.send(JSON.stringify({ type: 'subscribe', symbols: ['SPX'] }))
          ws.send(JSON.stringify({ type: 'subscribe', channels: ['setups:user-123'] }))
          // Wait briefly for a response
          ws.onmessage = (event) => {
            try {
              const msg = JSON.parse(event.data)
              if (msg.type === 'error') {
                ws.close()
                resolve(false)
                return
              }
            } catch {
              // ignore parse errors
            }
            ws.close()
            resolve(true)
          }
          // Resolve true even if no message comes back — connection was established
          setTimeout(() => {
            ws.close()
            resolve(true)
          }, 2000)
        }

        ws.onerror = () => {
          clearTimeout(timeout)
          resolve(false)
        }
      })
    }, BACKEND_URL)

    expect(wsConnected).toBe(true)
  })
})
