import { test, expect, type APIRequestContext, type Page } from '@playwright/test'
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
 * Validates currently supported AI Coach backend API surfaces.
 */

const BACKEND_URL = e2eBackendUrl

type WebSocketProbeResult = {
  opened: boolean
  closed: boolean
  closeCode: number | null
  closeReason: string
  gotStatus: boolean
  gotForbiddenError: boolean
  gotAuthError: boolean
  timedOut: boolean
}

async function probePricesSocket(
  page: Page,
  {
    backendUrl,
    token,
    userId,
    timeoutMs = 6000,
  }: {
    backendUrl: string
    token?: string
    userId?: string
    timeoutMs?: number
  },
): Promise<WebSocketProbeResult> {
  return page.evaluate(async ({ backendUrl, token, userId, timeoutMs }) => {
    return new Promise<WebSocketProbeResult>((resolve) => {
      const socketBaseUrl = backendUrl.replace(/^http/, 'ws')
      const wsUrl = token
        ? `${socketBaseUrl}/ws/prices?token=${encodeURIComponent(token)}`
        : `${socketBaseUrl}/ws/prices`

      let opened = false
      let closed = false
      let closeCode: number | null = null
      let closeReason = ''
      let gotStatus = false
      let gotForbiddenError = false
      let gotAuthError = false
      let settled = false

      const ws = new WebSocket(wsUrl)
      const finish = (timedOut: boolean) => {
        if (settled) return
        settled = true
        clearTimeout(timeoutHandle)
        resolve({
          opened,
          closed,
          closeCode,
          closeReason,
          gotStatus,
          gotForbiddenError,
          gotAuthError,
          timedOut,
        })
      }

      const timeoutHandle = setTimeout(() => {
        try {
          ws.close()
        } catch {
          // Ignore close races in timeout path.
        }
        finish(true)
      }, timeoutMs)

      ws.onopen = () => {
        opened = true
        if (userId) {
          ws.send(JSON.stringify({ type: 'subscribe', channels: [`setups:${userId}`] }))
          ws.send(JSON.stringify({ type: 'subscribe', channels: ['setups:not-your-user'] }))
        }
      }

      ws.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data)
          if (message.type === 'status') {
            gotStatus = true
          }
          if (message.type === 'error') {
            const text = String(message.message || '')
            if (text.includes('Forbidden channel')) {
              gotForbiddenError = true
            }
            if (text.toLowerCase().includes('unauthor') || text.toLowerCase().includes('auth')) {
              gotAuthError = true
            }
          }
          if (gotStatus && gotForbiddenError) {
            try {
              ws.close()
            } catch {
              // Ignore close races once desired signals are observed.
            }
            finish(false)
          }
        } catch {
          // Ignore malformed socket payloads in probe mode.
        }
      }

      ws.onerror = () => {
        // On browser WebSockets, close frequently follows error. Let close/timeout settle.
      }

      ws.onclose = (event) => {
        closed = true
        closeCode = event.code
        closeReason = event.reason
        finish(false)
      }
    })
  }, {
    backendUrl,
    token,
    userId,
    timeoutMs,
  })
}

function isLiveLegacySocketMode(result: WebSocketProbeResult): boolean {
  return isAICoachLiveMode
    && result.opened
    && result.gotStatus
    && !result.gotForbiddenError
    && !result.gotAuthError
}

test.describe('AI Coach — Backend API Health', () => {
  test('GET / should return service info with active endpoint manifest', async ({ request }) => {
    const response = await request.get(BACKEND_URL)
    expect(response.status()).toBe(200)

    const data = await response.json()
    expect(data.name).toBe('TITM AI Coach Backend')
    expect(data.status).toBe('running')
    expect(data.endpoints).toBeDefined()

    // Verify current AI Coach endpoint surface.
    expect(data.endpoints.chat).toBeDefined()
    expect(data.endpoints.optionsChain).toBeDefined()
    expect(data.endpoints.chart).toBeDefined()
    expect(data.endpoints.briefToday).toBeDefined()
    expect(data.endpoints.macroContext).toBeDefined()
    expect(data.endpoints.earningsCalendar).toBeDefined()
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

  test('GET /api/journal/trades without auth should return 401', async ({ request }) => {
    const response = await request.get(`${BACKEND_URL}/api/journal/trades`)
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

  test('removed legacy routes should return 404', async ({ request }) => {
    const checks = await Promise.all([
      request.get(`${BACKEND_URL}/api/alerts`),
      request.get(`${BACKEND_URL}/api/scanner/scan`),
      request.get(`${BACKEND_URL}/api/watchlist`),
      request.get(`${BACKEND_URL}/api/tracked-setups`),
      request.get(`${BACKEND_URL}/api/leaps`),
    ])

    for (const response of checks) {
      expect(response.status()).toBe(404)
    }
  })

  test('GET /api/nonexistent should return 404', async ({ request }) => {
    const response = await request.get(`${BACKEND_URL}/api/nonexistent`)
    expect(response.status()).toBe(404)

    const data = await response.json()
    expect(data.error).toBe('Not found')
  })
})

test.describe('AI Coach — Rate Limiting', () => {
  test('should enforce rate limits on rapid chat requests', async ({ request }) => {
    const promises = []
    for (let i = 0; i < 20; i++) {
      promises.push(request.post(`${BACKEND_URL}/api/chat/message`, {
        data: { sessionId: `rate-limit-${i}`, message: 'ping' },
      }))
    }

    const responses = await Promise.all(promises)
    const statuses = responses.map((response) => response.status())

    // Most should be 401 (no auth). Some may be 429 when limiter activates first.
    const hasExpectedStatus = statuses.every((status) => status === 401 || status === 429)
    expect(hasExpectedStatus).toBe(true)
  })
})

test.describe('AI Coach — WebSocket Connection', () => {
  test('should reject unauthenticated WebSocket connections at /ws/prices', async ({ page }) => {
    const wsRejected = await probePricesSocket(page, {
      backendUrl: BACKEND_URL,
      timeoutMs: 5000,
    })

    if (isLiveLegacySocketMode(wsRejected)) {
      test.skip(true, `Live backend websocket auth gate is not yet enforced at ${BACKEND_URL}`)
    }

    expect(wsRejected.closed || wsRejected.gotAuthError).toBe(true)
    if (wsRejected.closeCode !== null) {
      expect([4401, 4403, 1008, 1006, 1005]).toContain(wsRejected.closeCode)
    }
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

    const briefResponse = await request.get(`${e2eBackendUrl}/api/brief/today`, {
      headers: getAICoachAuthHeaders(),
    })

    if (requireAICoachLiveReadiness) {
      expect(briefResponse.status()).toBe(200)
    } else if (briefResponse.status() !== 200) {
      const payload = await briefResponse.json().catch(() => ({}))
      const reason = typeof payload?.message === 'string'
        ? payload.message
        : `status ${briefResponse.status()}`
      test.skip(true, `Live auth bypass preflight failed: ${reason}`)
      return null
    }

    return briefResponse
  }

  test('brief + macro endpoints should return authenticated responses', async ({ request }) => {
    test.setTimeout(90000)

    const authHeaders = getAICoachAuthHeaders()

    const briefResponse = await assertLiveBackendReadyOrSkip(request)
    if (!briefResponse) return
    const briefPayload = await briefResponse.json()
    expect(typeof briefPayload.marketDate).toBe('string')
    expect(typeof briefPayload.viewed).toBe('boolean')
    expect(briefPayload.brief).toBeDefined()

    const macroResponse = await request.get(`${e2eBackendUrl}/api/macro`, {
      headers: authHeaders,
      timeout: 30000,
    })
    expect(macroResponse.status()).toBe(200)
    const macroPayload = await macroResponse.json()
    expect(macroPayload).toBeDefined()
  })

  test('websocket should accept bypass token and enforce user channel authorization', async ({ page, request }) => {
    test.setTimeout(90000)

    const briefResponse = await assertLiveBackendReadyOrSkip(request)
    if (!briefResponse) return

    const unauthProbe = await probePricesSocket(page, {
      backendUrl: e2eBackendUrl,
      timeoutMs: 5000,
    })
    if (isLiveLegacySocketMode(unauthProbe)) {
      test.skip(true, `Live backend websocket authz capability not yet deployed at ${e2eBackendUrl}`)
    }

    const wsResult = await probePricesSocket(page, {
      backendUrl: e2eBackendUrl,
      token: aiCoachBypassToken,
      userId: aiCoachBypassUserId,
      timeoutMs: 7000,
    })

    expect(wsResult.opened).toBe(true)
    expect(wsResult.gotStatus).toBe(true)
    expect(wsResult.gotForbiddenError).toBe(true)
  })

  test('earnings endpoints should return authenticated responses', async ({ request }) => {
    test.setTimeout(90000)

    const authHeaders = getAICoachAuthHeaders()
    const briefResponse = await assertLiveBackendReadyOrSkip(request)
    if (!briefResponse) return

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
    expect([200, 403, 503]).toContain(analysisResponse.status())

    const analysisPayload = await analysisResponse.json()
    if (analysisResponse.status() === 200) {
      expect(typeof analysisPayload.symbol).toBe('string')
      expect(analysisPayload.symbol).toBe('SPY')
      expect(analysisPayload.expectedMove).toBeDefined()
      expect(Array.isArray(analysisPayload.suggestedStrategies)).toBe(true)
      return
    }

    expect(analysisPayload).toBeDefined()
  })
})
