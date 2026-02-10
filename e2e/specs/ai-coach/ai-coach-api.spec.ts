import { test, expect, type APIRequestContext } from '@playwright/test'
import {
  aiCoachBypassToken,
  aiCoachBypassUserId,
  e2eBackendUrl,
  getAICoachAuthHeaders,
  isAICoachLiveMode,
  requireAICoachLiveReadiness,
} from '../../helpers/ai-coach-live'

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
  test('should reject unauthenticated WebSocket connections at /ws/prices', async ({ page }) => {
    // Use the page to test WebSocket (Playwright can't directly connect to WebSockets via request API)
    const wsRejected = await page.evaluate(async (backendUrl) => {
      return new Promise<{ closed: boolean; code: number | null; reason: string }>((resolve) => {
        const ws = new WebSocket(`${backendUrl.replace('http', 'ws')}/ws/prices`)
        const timeout = setTimeout(() => {
          ws.close()
          resolve({ closed: false, code: null, reason: 'timeout' })
        }, 5000)

        ws.onclose = (event) => {
          clearTimeout(timeout)
          resolve({
            closed: true,
            code: event.code,
            reason: event.reason,
          })
        }

        ws.onerror = () => {
          // close handler performs final assertion payload
        }
      })
    }, BACKEND_URL)

    expect(wsRejected.closed).toBe(true)
    expect(wsRejected.code).toBe(4401)
  })
})

test.describe('AI Coach — Backend API Live Authenticated', () => {
  test.skip(!isAICoachLiveMode, 'Set E2E_AI_COACH_MODE=live to run backend-integrated AI Coach API checks')

  async function assertLiveBackendReadyOrSkip(request: APIRequestContext) {
    const healthResponse = await request.get(`${e2eBackendUrl}/health/detailed`)
    if (requireAICoachLiveReadiness) {
      expect(healthResponse.ok()).toBe(true)
    } else if (!healthResponse.ok()) {
      test.skip(true, `Live backend not healthy at ${e2eBackendUrl}`)
      return null
    }

    const healthPayload = await healthResponse.json().catch(() => null)
    if (requireAICoachLiveReadiness) {
      expect(healthPayload?.services?.database).not.toBe(false)
    } else if (healthPayload?.services?.database === false) {
      test.skip(true, 'Live backend database/service-role prerequisites are not ready for authenticated E2E')
      return null
    }

    const watchlistResponse = await request.get(`${e2eBackendUrl}/api/watchlist`, {
      headers: getAICoachAuthHeaders(),
    })

    if (requireAICoachLiveReadiness) {
      expect(watchlistResponse.status()).toBe(200)
    } else if (watchlistResponse.status() !== 200) {
      const payload = await watchlistResponse.json().catch(() => ({}))
      const reason = typeof payload?.message === 'string'
        ? payload.message
        : `status ${watchlistResponse.status()}`
      test.skip(true, `Live auth bypass preflight failed: ${reason}`)
      return null
    }

    return watchlistResponse
  }

  test('watchlist + scanner + brief endpoints should return authenticated responses', async ({ request }) => {
    test.setTimeout(90000)

    const authHeaders = getAICoachAuthHeaders()

    const watchlistResponse = await assertLiveBackendReadyOrSkip(request)
    if (!watchlistResponse) return
    const watchlistPayload = await watchlistResponse.json()
    expect(Array.isArray(watchlistPayload.watchlists)).toBe(true)

    const scanUrl = `${e2eBackendUrl}/api/scanner/scan?symbols=SPY&include_options=false`
    let scanResponse
    try {
      scanResponse = await request.get(scanUrl, {
        headers: authHeaders,
        timeout: 25000,
      })
    } catch {
      // Retry once for transient upstream latency in live staging providers.
      scanResponse = await request.get(scanUrl, {
        headers: authHeaders,
        timeout: 25000,
      })
    }
    expect(scanResponse.status()).toBe(200)
    const scanPayload = await scanResponse.json()
    expect(Array.isArray(scanPayload.opportunities)).toBe(true)
    expect(Array.isArray(scanPayload.symbols)).toBe(true)

    const briefResponse = await request.get(`${e2eBackendUrl}/api/brief/today`, {
      headers: authHeaders,
      timeout: 30000,
    })
    expect(briefResponse.status()).toBe(200)
    const briefPayload = await briefResponse.json()
    expect(typeof briefPayload.marketDate).toBe('string')
    expect(typeof briefPayload.viewed).toBe('boolean')
    expect(briefPayload.brief).toBeDefined()
  })

  test('websocket should accept bypass token and enforce user channel authorization', async ({ page, request }) => {
    test.setTimeout(90000)

    const watchlistResponse = await assertLiveBackendReadyOrSkip(request)
    if (!watchlistResponse) return

    const wsResult = await page.evaluate(async ({ backendUrl, token, userId }) => {
      return new Promise<{ opened: boolean; gotStatus: boolean; gotForbiddenError: boolean }>((resolve) => {
        const wsUrl = `${backendUrl.replace('http', 'ws')}/ws/prices?token=${encodeURIComponent(token)}`
        const ws = new WebSocket(wsUrl)
        let gotStatus = false
        let gotForbiddenError = false

        const timeout = setTimeout(() => {
          ws.close()
          resolve({ opened: false, gotStatus, gotForbiddenError })
        }, 6000)

        ws.onopen = () => {
          ws.send(JSON.stringify({ type: 'subscribe', channels: [`setups:${userId}`] }))
          ws.send(JSON.stringify({ type: 'subscribe', channels: ['setups:not-your-user'] }))
        }

        ws.onmessage = (event) => {
          try {
            const msg = JSON.parse(event.data)
            if (msg.type === 'status') {
              gotStatus = true
            }
            if (msg.type === 'error' && String(msg.message || '').includes('Forbidden channel')) {
              gotForbiddenError = true
            }
            if (gotStatus && gotForbiddenError) {
              clearTimeout(timeout)
              ws.close()
              resolve({ opened: true, gotStatus, gotForbiddenError })
            }
          } catch {
            // Ignore malformed socket payloads for this gate.
          }
        }

        ws.onerror = () => {
          clearTimeout(timeout)
          resolve({ opened: false, gotStatus, gotForbiddenError })
        }

        ws.onclose = () => {
          // Fallback resolution if closed before both signals are observed.
          clearTimeout(timeout)
          resolve({ opened: gotStatus, gotStatus, gotForbiddenError })
        }
      })
    }, {
      backendUrl: e2eBackendUrl,
      token: aiCoachBypassToken,
      userId: aiCoachBypassUserId,
    })

    expect(wsResult.opened).toBe(true)
    expect(wsResult.gotStatus).toBe(true)
    expect(wsResult.gotForbiddenError).toBe(true)
  })

  test('earnings endpoints should return authenticated responses', async ({ request }) => {
    test.setTimeout(90000)

    const authHeaders = getAICoachAuthHeaders()
    const watchlistResponse = await assertLiveBackendReadyOrSkip(request)
    if (!watchlistResponse) return

    const calendarResponse = await request.get(
      `${e2eBackendUrl}/api/earnings/calendar?watchlist=SPY,QQQ,AAPL&days=14`,
      {
        headers: authHeaders,
        timeout: 30000,
      },
    )
    expect(calendarResponse.status()).toBe(200)
    const calendarPayload = await calendarResponse.json()
    expect(Array.isArray(calendarPayload.watchlist)).toBe(true)
    expect(Array.isArray(calendarPayload.events)).toBe(true)
    expect(typeof calendarPayload.daysAhead).toBe('number')

    const analysisResponse = await request.get(`${e2eBackendUrl}/api/earnings/SPY/analysis`, {
      headers: authHeaders,
      timeout: 30000,
    })
    expect([200, 503]).toContain(analysisResponse.status())

    const analysisPayload = await analysisResponse.json()
    if (analysisResponse.status() === 200) {
      expect(typeof analysisPayload.symbol).toBe('string')
      expect(analysisPayload.symbol).toBe('SPY')
      expect(analysisPayload.expectedMove).toBeDefined()
      expect(Array.isArray(analysisPayload.suggestedStrategies)).toBe(true)
      return
    }

    expect(typeof analysisPayload.error).toBe('string')
    expect(typeof analysisPayload.message).toBe('string')
  })

  test('tracked setup lifecycle should support create -> update -> delete', async ({ request }) => {
    const authHeaders = getAICoachAuthHeaders()
    const sourceOpportunityId = `e2e-live-${Date.now()}`

    const watchlistResponse = await assertLiveBackendReadyOrSkip(request)
    if (!watchlistResponse) return

    const createResponse = await request.post(`${e2eBackendUrl}/api/tracked-setups`, {
      headers: authHeaders,
      data: {
        source_opportunity_id: sourceOpportunityId,
        symbol: 'SPX',
        setup_type: 'gamma_squeeze',
        direction: 'bullish',
        opportunity_data: {
          score: 70,
          suggestedTrade: {
            entry: 5200,
            stopLoss: 5180,
            target: 5235,
            strikes: [5200, 5225],
            expiry: '2026-02-20',
          },
        },
        notes: 'E2E live test seed',
      },
    })
    expect([200, 201]).toContain(createResponse.status())
    const createPayload = await createResponse.json()
    const trackedSetupId = createPayload?.trackedSetup?.id as string
    expect(typeof trackedSetupId).toBe('string')

    const updateResponse = await request.patch(`${e2eBackendUrl}/api/tracked-setups/${trackedSetupId}`, {
      headers: authHeaders,
      data: { status: 'triggered' },
    })
    expect(updateResponse.status()).toBe(200)
    const updatePayload = await updateResponse.json()
    expect(updatePayload?.trackedSetup?.status).toBe('triggered')

    const deleteResponse = await request.delete(`${e2eBackendUrl}/api/tracked-setups/${trackedSetupId}`, {
      headers: authHeaders,
    })
    expect(deleteResponse.status()).toBe(200)
    const deletePayload = await deleteResponse.json()
    expect(deletePayload.success).toBe(true)
  })

  test('detector simulation endpoint should auto-track and broadcast-ready payloads', async ({ request }) => {
    const authHeaders = getAICoachAuthHeaders()
    const simulationNote = `E2E detector simulation API ${Date.now()}`

    const watchlistResponse = await assertLiveBackendReadyOrSkip(request)
    if (!watchlistResponse) return

    const simulateResponse = await request.post(`${e2eBackendUrl}/api/tracked-setups/e2e/simulate-detected`, {
      headers: authHeaders,
      data: {
        symbol: 'SPX',
        setup_type: 'gamma_squeeze',
        direction: 'bullish',
        confidence: 77,
        notes: simulationNote,
      },
    })
    expect(simulateResponse.status()).toBe(201)
    const simulatePayload = await simulateResponse.json()
    expect(simulatePayload?.detectedSetup?.id).toBeTruthy()
    expect(simulatePayload?.trackedSetup?.id).toBeTruthy()
    expect(simulatePayload?.trackedSetup?.notes).toContain('E2E detector simulation')

    const trackedSetupId = simulatePayload?.trackedSetup?.id as string
    const deleteResponse = await request.delete(`${e2eBackendUrl}/api/tracked-setups/${trackedSetupId}`, {
      headers: authHeaders,
    })
    expect(deleteResponse.status()).toBe(200)
  })
})
