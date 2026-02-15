import { test, expect, type Page, type Route } from '@playwright/test'
import { authenticateAsMember } from '../../helpers/member-auth'

const AI_COACH_URL = '/members/ai-coach'

const CORS_HEADERS = {
  'access-control-allow-origin': '*',
  'access-control-allow-methods': 'GET,POST,PUT,PATCH,DELETE,OPTIONS',
  'access-control-allow-headers': 'Authorization,Content-Type,x-e2e-bypass-auth',
}

async function fulfillJson(route: Route, body: unknown, status: number = 200) {
  if (route.request().method() === 'OPTIONS') {
    await route.fulfill({
      status: 204,
      headers: CORS_HEADERS,
      body: '',
    })
    return
  }

  await route.fulfill({
    status,
    headers: {
      ...CORS_HEADERS,
      'content-type': 'application/json',
    },
    body: JSON.stringify(body),
  })
}

async function setupAlertMocks(page: Page) {
  const createdPayloads: Array<Record<string, unknown>> = []
  const now = new Date().toISOString()
  let alerts: Array<Record<string, unknown>> = [
    {
      id: 'alert-seed-active',
      user_id: 'test-user-id-12345',
      symbol: 'SPX',
      alert_type: 'price_above',
      target_value: 6100,
      condition_met: false,
      notification_sent: false,
      notification_channels: ['in-app'],
      status: 'active',
      notes: 'Seeded active alert',
      created_at: now,
      triggered_at: null,
      expires_at: null,
    },
    {
      id: 'alert-seed-triggered',
      user_id: 'test-user-id-12345',
      symbol: 'NDX',
      alert_type: 'price_below',
      target_value: 21000,
      condition_met: true,
      notification_sent: true,
      notification_channels: ['in-app'],
      status: 'triggered',
      notes: 'Seeded triggered alert',
      created_at: now,
      triggered_at: now,
      expires_at: null,
    },
  ]

  await page.route('**/api/chat/sessions*', async (route) => {
    await fulfillJson(route, { sessions: [], count: 0 })
  })

  await page.route('**/api/chat/sessions/*', async (route) => {
    await fulfillJson(route, { messages: [], total: 0, hasMore: false })
  })

  await page.route('**/api/chart/**', async (route) => {
    await fulfillJson(route, {
      symbol: 'SPX',
      timeframe: '1D',
      bars: [
        { time: 1739318400, open: 6088, high: 6112, low: 6079, close: 6102, volume: 100000 },
        { time: 1739404800, open: 6102, high: 6120, low: 6090, close: 6110, volume: 120000 },
      ],
      count: 2,
      timestamp: now,
      cached: true,
    })
  })

  await page.route('**/api/options/**/chain**', async (route) => {
    await fulfillJson(route, {
      symbol: 'SPX',
      currentPrice: 6110,
      expiry: '2026-02-20',
      daysToExpiry: 5,
      ivRank: 48,
      options: { calls: [], puts: [] },
    })
  })

  await page.route('**/api/options/**/expirations**', async (route) => {
    await fulfillJson(route, {
      symbol: 'SPX',
      expirations: ['2026-02-20'],
      count: 1,
    })
  })

  await page.route('**/api/alerts/*/cancel', async (route) => {
    const id = route.request().url().split('/').slice(-2)[0]
    alerts = alerts.map((alert) => (
      alert.id === id ? { ...alert, status: 'cancelled' } : alert
    ))
    const updated = alerts.find((alert) => alert.id === id)
    await fulfillJson(route, updated ?? { error: 'Not found' }, updated ? 200 : 404)
  })

  await page.route('**/api/alerts/*', async (route) => {
    if (route.request().method() !== 'DELETE') {
      await route.fallback()
      return
    }

    const id = route.request().url().split('/').pop()
    alerts = alerts.filter((alert) => alert.id !== id)
    await fulfillJson(route, { success: true })
  })

  await page.route(/\/api\/alerts(?:\?.*)?$/, async (route) => {
    const method = route.request().method()

    if (method === 'GET') {
      const parsed = new URL(route.request().url())
      const status = parsed.searchParams.get('status')
      const symbol = parsed.searchParams.get('symbol')
      const filtered = alerts.filter((alert) => {
        if (status && alert.status !== status) return false
        if (symbol && alert.symbol !== symbol.toUpperCase()) return false
        return true
      })

      await fulfillJson(route, { alerts: filtered, total: filtered.length })
      return
    }

    if (method === 'POST') {
      const body = route.request().postDataJSON() as Record<string, unknown>
      createdPayloads.push(body)
      const created = {
        id: `alert-created-${createdPayloads.length}`,
        user_id: 'test-user-id-12345',
        symbol: String(body.symbol || 'SPX').toUpperCase(),
        alert_type: body.alert_type,
        target_value: Number(body.target_value),
        condition_met: false,
        notification_sent: false,
        notification_channels: ['in-app'],
        status: 'active',
        notes: body.notes || null,
        created_at: now,
        triggered_at: null,
        expires_at: null,
      }
      alerts = [created, ...alerts]
      await fulfillJson(route, created, 201)
      return
    }

    await fulfillJson(route, { alerts, total: alerts.length })
  })

  return { createdPayloads }
}

async function openAlertsTab(page: Page) {
  const alertsTab = page.getByRole('tab', { name: 'Alerts' })
  await alertsTab.click()
  await expect(alertsTab).toHaveAttribute('aria-selected', 'true')
  await expect(page.getByRole('heading', { name: 'Price Alerts' })).toBeVisible()
}

test.describe('AI Coach Alerts - E2E audit', () => {
  let createdPayloads: Array<Record<string, unknown>> = []

  test.beforeEach(async ({ page }) => {
    await authenticateAsMember(page)
    const mocks = await setupAlertMocks(page)
    createdPayloads = mocks.createdPayloads
    await page.addInitScript(() => {
      localStorage.setItem('ai-coach-onboarding-complete', 'true')
    })

    await page.goto(AI_COACH_URL)
    await page.waitForLoadState('networkidle')
  })

  test('loads seeded alerts and supports status filtering', async ({ page }) => {
    await openAlertsTab(page)

    await expect(page.getByText('1 active')).toBeVisible()
    await expect(page.getByText('SPX').first()).toBeVisible()
    await expect(page.getByText('Seeded active alert')).toBeVisible()

    await page.getByRole('button', { name: 'Triggered' }).click()
    await expect(page.getByText('NDX').first()).toBeVisible()
    await expect(page.getByText('Seeded triggered alert')).toBeVisible()

    await page.getByRole('button', { name: 'All' }).click()
    await expect(page.getByText('SPX').first()).toBeVisible()
    await expect(page.getByText('NDX').first()).toBeVisible()
  })

  test('creates, cancels, and deletes an alert from the panel', async ({ page }) => {
    await openAlertsTab(page)

    await page.getByRole('button', { name: /New Alert/i }).click()
    await page.locator('select').first().selectOption('NDX')
    await page.locator('input[placeholder="5900.00"]').fill('20950')
    await page.getByRole('button', { name: 'Price Below' }).click()
    await page.locator('input[placeholder="e.g. Watch for PDH rejection"]').fill('NDX washout level')
    await page.getByRole('button', { name: 'Create Alert' }).click()

    const createdCard = page.locator('div.glass-card-heavy', { hasText: 'NDX washout level' }).first()
    await expect(createdCard).toBeVisible()
    await expect(createdCard.getByText('Active')).toBeVisible()

    await createdCard.getByRole('button', { name: 'Cancel alert' }).click()
    await expect(createdCard.getByText('Cancelled')).toBeVisible()

    await createdCard.getByRole('button', { name: 'Delete alert' }).click()
    await expect(page.locator('div.glass-card-heavy', { hasText: 'NDX washout level' })).toHaveCount(0)
  })

  test('opens alerts with widget-event prefill and posts expected payload', async ({ page }) => {
    await page.evaluate(() => {
      window.dispatchEvent(new CustomEvent('ai-coach-widget-alert', {
        detail: {
          symbol: 'SPX',
          price: 6123.45,
          alertType: 'level_approach',
          notes: 'Widget handoff note',
        },
      }))
    })

    await openAlertsTab(page)

    await expect(page.locator('input[placeholder="5900.00"]')).toHaveValue('6123.45')
    await expect(page.locator('input[placeholder="e.g. Watch for PDH rejection"]')).toHaveValue('Widget handoff note')

    await page.getByRole('button', { name: 'Create Alert' }).click()
    await expect(createdPayloads.length).toBeGreaterThan(0)
    expect(createdPayloads.some((payload) => (
      payload.symbol === 'SPX'
      && payload.alert_type === 'level_approach'
      && Number(payload.target_value) === 6123.45
    ))).toBe(true)
  })
})
