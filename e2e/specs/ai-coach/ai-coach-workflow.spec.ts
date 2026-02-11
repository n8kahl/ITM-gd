import { test, expect, type Page, type Route } from '@playwright/test'
import { authenticateAsMember, mockSupabaseSession } from '../../helpers/member-auth'

const AI_COACH_URL = '/members/ai-coach'

async function setupWorkflowMocks(page: Page) {
  const userId = mockSupabaseSession.user.id
  const nowIso = new Date().toISOString()
  const marketDate = '2026-02-09'

  let trackedFetchCount = 0
  let trackedSetups: Array<Record<string, unknown>> = []
  const detectedSetup: Record<string, unknown> = {
    id: 'tracked-detected-1',
    user_id: userId,
    source_opportunity_id: null,
    symbol: 'NDX',
    setup_type: 'opening_drive',
    direction: 'bullish',
    status: 'active',
    opportunity_data: {
      score: 82,
      suggestedTrade: {
        entry: 18120,
        stopLoss: 18080,
        target: 18210,
        expiry: '2026-02-20',
        strikes: [18100, 18200],
      },
    },
    notes: null,
    tracked_at: nowIso,
    triggered_at: null,
    invalidated_at: null,
    created_at: nowIso,
    updated_at: nowIso,
  }

  await page.addInitScript(({ authUserId, nowIsoTimestamp, marketDateValue }: {
    authUserId: string
    nowIsoTimestamp: string
    marketDateValue: string
  }) => {
    localStorage.setItem('ai-coach-onboarding-complete', 'true')

    let trackedFetchCountInBrowser = 0
    let trackedSetupsInBrowser: Array<Record<string, unknown>> = []
    const detectedSetupInBrowser: Record<string, unknown> = {
      id: 'tracked-detected-1',
      user_id: authUserId,
      source_opportunity_id: null,
      symbol: 'NDX',
      setup_type: 'opening_drive',
      direction: 'bullish',
      status: 'active',
      opportunity_data: {
        score: 82,
        suggestedTrade: {
          entry: 18120,
          stopLoss: 18080,
          target: 18210,
          expiry: '2026-02-20',
          strikes: [18100, 18200],
        },
      },
      notes: null,
      tracked_at: nowIsoTimestamp,
      triggered_at: null,
      invalidated_at: null,
      created_at: nowIsoTimestamp,
      updated_at: nowIsoTimestamp,
    }

    const jsonResponse = (body: unknown, status = 200) => new Response(
      JSON.stringify(body),
      {
        status,
        headers: { 'Content-Type': 'application/json' },
      },
    )

    const readBodyText = async (request: Request | undefined, init?: RequestInit): Promise<string> => {
      if (typeof init?.body === 'string') return init.body
      if (request) {
        try {
          return await request.clone().text()
        } catch {
          return ''
        }
      }
      return ''
    }

    const originalFetch = window.fetch.bind(window)
    window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
      const request = input instanceof Request ? input : undefined
      const url = typeof input === 'string'
        ? input
        : input instanceof URL
          ? input.toString()
          : input.url
      const method = (init?.method || request?.method || 'GET').toUpperCase()
      const parsed = new URL(url, window.location.origin)

      if (url.includes('/api/chat/sessions/')) {
        return jsonResponse({ messages: [], total: 0, hasMore: false })
      }

      if (url.includes('/api/chat/sessions')) {
        if (method === 'GET') return jsonResponse({ sessions: [], count: 0 })
        return jsonResponse({ success: true })
      }

      if (url.includes('/api/watchlist')) {
        const watchlistPayload = {
          id: 'watchlist-1',
          user_id: authUserId,
          name: 'Default',
          symbols: ['SPX', 'NDX'],
          is_default: true,
          created_at: nowIsoTimestamp,
          updated_at: nowIsoTimestamp,
        }

        if (method === 'GET') {
          return jsonResponse({
            watchlists: [watchlistPayload],
            defaultWatchlist: watchlistPayload,
          })
        }

        return jsonResponse({
          watchlist: watchlistPayload,
          watchlists: [],
          defaultWatchlist: watchlistPayload,
        })
      }

      if (url.includes('/api/scanner/scan')) {
        return jsonResponse({
          opportunities: [{
            id: 'opp-spx-1',
            type: 'technical',
            setupType: 'gamma_squeeze',
            symbol: 'SPX',
            direction: 'bullish',
            score: 88,
            confidence: 0.82,
            currentPrice: 5272.25,
            description: 'Gamma squeeze continuation above overnight high',
            suggestedTrade: {
              strategy: 'Call debit spread',
              strikes: [5280, 5300],
              expiry: '2026-02-13',
              entry: 5274,
              stopLoss: 5259,
              target: 5304,
              maxProfit: '$1,200',
              maxLoss: '$450',
              probability: '61%',
            },
            metadata: {
              gex_regime: 'positive_gamma',
            },
            scannedAt: nowIsoTimestamp,
          }],
          symbols: ['SPX', 'NDX'],
          scanDurationMs: 92,
          scannedAt: nowIsoTimestamp,
        })
      }

      if (url.includes('/api/tracked-setups')) {
        if (method === 'POST') {
          const bodyText = await readBodyText(request, init)
          const body = bodyText ? JSON.parse(bodyText) as Record<string, unknown> : {}
          const duplicate = trackedSetupsInBrowser.some(
            (setup) => setup.source_opportunity_id === body.source_opportunity_id && setup.status === 'active',
          )

          if (duplicate) {
            return jsonResponse({ trackedSetup: null, duplicate: true })
          }

          const createdSetup: Record<string, unknown> = {
            id: 'tracked-manual-1',
            user_id: authUserId,
            source_opportunity_id: body.source_opportunity_id ?? null,
            symbol: body.symbol ?? 'SPX',
            setup_type: body.setup_type ?? 'unknown',
            direction: body.direction ?? 'neutral',
            status: 'active',
            opportunity_data: body.opportunity_data ?? {},
            notes: body.notes ?? null,
            tracked_at: nowIsoTimestamp,
            triggered_at: null,
            invalidated_at: null,
            created_at: nowIsoTimestamp,
            updated_at: nowIsoTimestamp,
          }

          trackedSetupsInBrowser = [createdSetup, ...trackedSetupsInBrowser]
          return jsonResponse({ trackedSetup: createdSetup, duplicate: false })
        }

        if (method === 'PATCH') {
          const setupId = parsed.pathname.split('/').pop() || ''
          const bodyText = await readBodyText(request, init)
          const body = bodyText ? JSON.parse(bodyText) as Record<string, unknown> : {}
          trackedSetupsInBrowser = trackedSetupsInBrowser.map((setup) => (
            setup.id === setupId
              ? { ...setup, ...body, updated_at: nowIsoTimestamp }
              : setup
          ))
          const updated = trackedSetupsInBrowser.find((setup) => setup.id === setupId) || null
          return jsonResponse({ trackedSetup: updated })
        }

        if (method === 'DELETE') {
          const setupId = parsed.pathname.split('/').pop() || ''
          trackedSetupsInBrowser = trackedSetupsInBrowser.filter((setup) => setup.id !== setupId)
          return jsonResponse({ success: true })
        }

        trackedFetchCountInBrowser += 1
        if (trackedFetchCountInBrowser >= 2 && !trackedSetupsInBrowser.some((setup) => setup.id === detectedSetupInBrowser.id)) {
          trackedSetupsInBrowser = [...trackedSetupsInBrowser, detectedSetupInBrowser]
        }

        const status = parsed.searchParams.get('status')
        const view = parsed.searchParams.get('view')
        const filtered = status
          ? trackedSetupsInBrowser.filter((setup) => setup.status === status)
          : view === 'active'
            ? trackedSetupsInBrowser.filter((setup) => setup.status === 'active' || setup.status === 'triggered')
            : view === 'history'
              ? trackedSetupsInBrowser.filter((setup) => setup.status === 'invalidated' || setup.status === 'archived')
              : trackedSetupsInBrowser.filter((setup) => setup.status !== 'invalidated')

        return jsonResponse({ trackedSetups: filtered })
      }

      if (url.includes('/api/brief/today')) {
        if (method === 'PATCH') {
          return jsonResponse({ success: true, marketDate: marketDateValue, viewed: true })
        }

        return jsonResponse({
          marketDate: marketDateValue,
          viewed: false,
          cached: true,
          brief: {
            generatedAt: nowIsoTimestamp,
            marketDate: marketDateValue,
            watchlist: ['SPX', 'NDX'],
            aiSummary: 'SPX holding overnight breakout while NDX follows through on tech strength.',
            keyLevelsToday: [
              { symbol: 'SPX', currentPrice: 5272.25, pivot: 5268.5, pdh: 5281.0, pdl: 5246.75, atr14: 48.2 },
            ],
            economicEvents: [
              { event: 'Fed Speaker', impact: 'MEDIUM', tradingImplication: 'Expect headline volatility near 10:00 ET.' },
            ],
            openPositionStatus: [
              { symbol: 'SPX', type: 'call_spread', currentPnlPct: 2.4, recommendation: 'Trail stop to breakeven on momentum fade.' },
            ],
            watchItems: ['Track SPX opening range break', 'Watch NDX relative strength at VWAP'],
            marketStatus: {
              status: 'open',
              session: 'regular',
              message: 'US equities are open',
            },
          },
        })
      }

      return originalFetch(input, init)
    }

    class MockWebSocket {
      static CONNECTING = 0
      static OPEN = 1
      static CLOSING = 2
      static CLOSED = 3

      readonly url: string
      readyState = MockWebSocket.CONNECTING
      onopen: ((event: Event) => void) | null = null
      onmessage: ((event: MessageEvent<string>) => void) | null = null
      onerror: ((event: Event) => void) | null = null
      onclose: ((event: Event) => void) | null = null

      constructor(url: string) {
        this.url = url
        window.setTimeout(() => {
          this.readyState = MockWebSocket.OPEN
          this.onopen?.(new Event('open'))
        }, 10)
      }

      send(data: string) {
        try {
          const payload = JSON.parse(data)
          if (payload?.type !== 'subscribe' || !Array.isArray(payload.channels)) return

          const subscribedChannel = payload.channels[0]
          if (subscribedChannel !== `setups:${authUserId}`) return

          window.setTimeout(() => {
            this.onmessage?.(new MessageEvent('message', {
              data: JSON.stringify({ type: 'setup_update', channel: subscribedChannel }),
            }))
          }, 25)

          window.setTimeout(() => {
            this.onmessage?.(new MessageEvent('message', {
              data: JSON.stringify({ type: 'setup_detected', channel: subscribedChannel }),
            }))
          }, 50)
        } catch {
          // Ignore malformed payloads in tests.
        }
      }

      close() {
        this.readyState = MockWebSocket.CLOSED
        this.onclose?.(new Event('close'))
      }
    }

    Object.defineProperty(window, 'WebSocket', {
      configurable: true,
      writable: true,
      value: MockWebSocket,
    })
  }, {
    authUserId: userId,
    nowIsoTimestamp: nowIso,
    marketDateValue: marketDate,
  })

  await page.route('**/api/chat/sessions*', async (route: Route) => {
    const method = route.request().method()
    if (method === 'GET') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ sessions: [], count: 0 }),
      })
      return
    }

    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ success: true }),
    })
  })

  await page.route('**/api/chat/sessions/*', async (route: Route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ messages: [], total: 0, hasMore: false }),
    })
  })

  await page.route('**/api/watchlist*', async (route: Route) => {
    const method = route.request().method()
    if (method === 'GET') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          watchlists: [{
            id: 'watchlist-1',
            user_id: userId,
            name: 'Default',
            symbols: ['SPX', 'NDX'],
            is_default: true,
            created_at: nowIso,
            updated_at: nowIso,
          }],
          defaultWatchlist: {
            id: 'watchlist-1',
            user_id: userId,
            name: 'Default',
            symbols: ['SPX', 'NDX'],
            is_default: true,
            created_at: nowIso,
            updated_at: nowIso,
          },
        }),
      })
      return
    }

    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        watchlist: {
          id: 'watchlist-1',
          user_id: userId,
          name: 'Default',
          symbols: ['SPX', 'NDX'],
          is_default: true,
          created_at: nowIso,
          updated_at: nowIso,
        },
        watchlists: [],
        defaultWatchlist: {
          id: 'watchlist-1',
          user_id: userId,
          name: 'Default',
          symbols: ['SPX', 'NDX'],
          is_default: true,
          created_at: nowIso,
          updated_at: nowIso,
        },
      }),
    })
  })

  await page.route('**/api/scanner/scan*', async (route: Route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        opportunities: [{
          id: 'opp-spx-1',
          type: 'technical',
          setupType: 'gamma_squeeze',
          symbol: 'SPX',
          direction: 'bullish',
          score: 88,
          confidence: 0.82,
          currentPrice: 5272.25,
          description: 'Gamma squeeze continuation above overnight high',
          suggestedTrade: {
            strategy: 'Call debit spread',
            strikes: [5280, 5300],
            expiry: '2026-02-13',
            entry: 5274,
            stopLoss: 5259,
            target: 5304,
            maxProfit: '$1,200',
            maxLoss: '$450',
            probability: '61%',
          },
          metadata: {
            gex_regime: 'positive_gamma',
          },
          scannedAt: nowIso,
        }],
        symbols: ['SPX', 'NDX'],
        scanDurationMs: 92,
        scannedAt: nowIso,
      }),
    })
  })

  await page.route('**/api/tracked-setups**', async (route: Route) => {
    const method = route.request().method()
    const requestUrl = new URL(route.request().url())

    if (method === 'POST') {
      const body = route.request().postDataJSON() as Record<string, unknown>
      const duplicate = trackedSetups.some(
        (setup) => setup.source_opportunity_id === body.source_opportunity_id && setup.status === 'active',
      )

      if (duplicate) {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ trackedSetup: null, duplicate: true }),
        })
        return
      }

      const createdSetup: Record<string, unknown> = {
        id: 'tracked-manual-1',
        user_id: userId,
        source_opportunity_id: body.source_opportunity_id ?? null,
        symbol: body.symbol ?? 'SPX',
        setup_type: body.setup_type ?? 'unknown',
        direction: body.direction ?? 'neutral',
        status: 'active',
        opportunity_data: body.opportunity_data ?? {},
        notes: body.notes ?? null,
        tracked_at: nowIso,
        triggered_at: null,
        invalidated_at: null,
        created_at: nowIso,
        updated_at: nowIso,
      }
      trackedSetups = [createdSetup, ...trackedSetups]

      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ trackedSetup: createdSetup, duplicate: false }),
      })
      return
    }

    if (method === 'PATCH') {
      const body = route.request().postDataJSON() as Record<string, unknown>
      const setupId = requestUrl.pathname.split('/').pop() || ''
      trackedSetups = trackedSetups.map((setup) => (
        setup.id === setupId
          ? { ...setup, ...body, updated_at: nowIso }
          : setup
      ))
      const updated = trackedSetups.find((setup) => setup.id === setupId) || null
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ trackedSetup: updated }),
      })
      return
    }

    if (method === 'DELETE') {
      const setupId = requestUrl.pathname.split('/').pop() || ''
      trackedSetups = trackedSetups.filter((setup) => setup.id !== setupId)
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true }),
      })
      return
    }

    trackedFetchCount += 1
    if (trackedFetchCount >= 2 && !trackedSetups.some((setup) => setup.id === detectedSetup.id)) {
      trackedSetups = [...trackedSetups, detectedSetup]
    }

    const status = requestUrl.searchParams.get('status')
    const view = requestUrl.searchParams.get('view')
    const filtered = status
      ? trackedSetups.filter((setup) => setup.status === status)
      : view === 'active'
        ? trackedSetups.filter((setup) => setup.status === 'active' || setup.status === 'triggered')
        : view === 'history'
          ? trackedSetups.filter((setup) => setup.status === 'invalidated' || setup.status === 'archived')
          : trackedSetups.filter((setup) => setup.status !== 'invalidated')

    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ trackedSetups: filtered }),
    })
  })

  await page.route('**/api/brief/today*', async (route: Route) => {
    const method = route.request().method()
    if (method === 'PATCH') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, marketDate, viewed: true }),
      })
      return
    }

    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        marketDate,
        viewed: false,
        cached: true,
        brief: {
          generatedAt: nowIso,
          marketDate,
          watchlist: ['SPX', 'NDX'],
          aiSummary: 'SPX holding overnight breakout while NDX follows through on tech strength.',
          keyLevelsToday: [
            { symbol: 'SPX', currentPrice: 5272.25, pivot: 5268.5, pdh: 5281.0, pdl: 5246.75, atr14: 48.2 },
          ],
          economicEvents: [
            { event: 'Fed Speaker', impact: 'MEDIUM', tradingImplication: 'Expect headline volatility near 10:00 ET.' },
          ],
          openPositionStatus: [
            { symbol: 'SPX', type: 'call_spread', currentPnlPct: 2.4, recommendation: 'Trail stop to breakeven on momentum fade.' },
          ],
          watchItems: ['Track SPX opening range break', 'Watch NDX relative strength at VWAP'],
          marketStatus: {
            status: 'open',
            session: 'regular',
            message: 'US equities are open',
          },
        },
      }),
    })
  })
}

test.describe('AI Coach — Scanner Workflow', () => {
  test('scanner -> track setup -> tracked panel live updates -> brief', async ({ page }) => {
    await authenticateAsMember(page)
    await setupWorkflowMocks(page)

    await page.goto(AI_COACH_URL)
    await page.waitForLoadState('networkidle')

    await expect(page.getByRole('heading', { name: /Ready to execute the session plan\?/i })).toBeVisible()

    await page.getByRole('button', { name: 'Scanner' }).first().click()
    await expect(page.getByText('Opportunity Scanner')).toBeVisible()

    await page.getByRole('button', { name: 'Run Scanner' }).click()
    await expect(page.getByText('Gamma squeeze continuation above overnight high').first()).toBeVisible()

    await page.getByText('Gamma squeeze continuation above overnight high').first().click()
    await page.getByRole('button', { name: 'Track This Setup' }).click()
    await page.getByRole('tab', { name: 'Tracked' }).click()
    await expect(page.getByText('Tracked Setups')).toBeVisible()
    await expect(page.getByText('SPX').first()).toBeVisible()
    await expect(page.getByText('NDX').first()).toBeVisible({ timeout: 10000 })

    await page.getByRole('tab', { name: 'Daily Brief' }).click()
    await expect(page.getByText('Morning Brief').first()).toBeVisible()
    await expect(page.getByText('What to Watch')).toBeVisible()
    await expect(page.getByText('Track SPX opening range break')).toBeVisible()
  })
})
