import type { Page, Route } from '@playwright/test'
import { authenticateAsMember } from '../../helpers/member-auth'

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

export const E2E_USER_ID = '00000000-0000-4000-8000-000000000001'
export const AI_COACH_URL = '/members/ai-coach'
export const ONBOARDING_KEY = 'ai-coach-onboarding-complete'
export const PREFERENCES_KEY = 'ai-coach-preferences-v2'
export const SESSION_KEY = 'ai-coach-current-session'

// ---------------------------------------------------------------------------
// Auth & Shell Setup
// ---------------------------------------------------------------------------

export async function enableBypass(page: Page): Promise<void> {
  await authenticateAsMember(page, { bypassMiddleware: true })
  await page.context().addCookies([
    { name: 'e2e_bypass_auth', value: '1', domain: '127.0.0.1', path: '/' },
    { name: 'e2e_bypass_auth', value: '1', domain: 'localhost', path: '/' },
  ])
}

export async function setupOnboarding(
  page: Page,
  options: { complete?: boolean } = {},
): Promise<void> {
  const { complete = true } = options
  await page.addInitScript(
    ({ onboardingKey, preferencesKey, isComplete }) => {
      localStorage.removeItem(preferencesKey)
      if (isComplete) {
        localStorage.setItem(onboardingKey, 'true')
      } else {
        localStorage.removeItem(onboardingKey)
      }
    },
    { onboardingKey: ONBOARDING_KEY, preferencesKey: PREFERENCES_KEY, isComplete: complete },
  )
}

// ---------------------------------------------------------------------------
// Shell Mocks (config/roles, config/tabs, member profile, discord sync)
// ---------------------------------------------------------------------------

export async function setupShellMocks(page: Page): Promise<void> {
  await page.route('**/api/config/roles*', async (route: Route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: '{}' })
  })

  await page.route('**/api/config/tabs*', async (route: Route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        success: true,
        data: [
          { tab_id: 'dashboard', required_tier: 'core', is_active: true, is_required: true, mobile_visible: true, sort_order: 0, label: 'Dashboard', icon: 'LayoutDashboard', path: '/members' },
          { tab_id: 'journal', required_tier: 'core', is_active: true, is_required: false, mobile_visible: true, sort_order: 1, label: 'Journal', icon: 'BookOpen', path: '/members/journal' },
          { tab_id: 'ai-coach', required_tier: 'pro', is_active: true, is_required: false, mobile_visible: true, sort_order: 4, label: 'AI Coach', icon: 'Bot', path: '/members/ai-coach' },
          { tab_id: 'spx-command-center', required_tier: 'pro', is_active: true, is_required: false, mobile_visible: true, sort_order: 3, label: 'SPX', icon: 'Target', path: '/members/spx-command-center' },
          { tab_id: 'library', required_tier: 'core', is_active: true, is_required: false, mobile_visible: false, sort_order: 5, label: 'Academy', icon: 'GraduationCap', path: '/members/academy' },
          { tab_id: 'social', required_tier: 'core', is_active: true, is_required: false, mobile_visible: true, sort_order: 6, label: 'Social', icon: 'Users', path: '/members/social' },
          { tab_id: 'profile', required_tier: 'core', is_active: true, is_required: true, mobile_visible: true, sort_order: 99, label: 'Profile', icon: 'UserCircle', path: '/members/profile' },
        ],
      }),
    })
  })

  await page.route('**/api/members/profile*', async (route: Route) => {
    if (route.request().method() !== 'GET') {
      await route.fallback()
      return
    }
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        success: true,
        data: {
          id: E2E_USER_ID,
          discord_username: 'E2ETrader',
          email: 'e2e@example.com',
          membership_tier: 'pro',
          discord_roles: ['role-core-sniper', 'role-pro'],
          discord_avatar: null,
          created_at: '2026-01-01T00:00:00.000Z',
        },
      }),
    })
  })
}

// ---------------------------------------------------------------------------
// Mock Data Factories
// ---------------------------------------------------------------------------

export interface MockChatSession {
  id: string
  title: string
  created_at: string
  updated_at: string
  message_count: number
}

export interface MockChatMessage {
  id: string
  session_id: string
  role: 'user' | 'assistant'
  content: string
  created_at: string
  function_calls?: MockFunctionCall[]
}

export interface MockFunctionCall {
  name: string
  arguments: Record<string, unknown>
  result: Record<string, unknown>
}

export interface MockChartBar {
  time: number
  open: number
  high: number
  low: number
  close: number
  volume: number
}

export interface MockOptionsContract {
  strike: number
  expiry: string
  type: 'call' | 'put'
  last: number
  bid: number
  ask: number
  volume: number
  openInterest: number
  iv: number
  delta: number
  gamma: number
  theta: number
  vega: number
}

export function createMockSession(overrides?: Partial<MockChatSession>): MockChatSession {
  return {
    id: 'session-001',
    title: 'SPX Analysis',
    created_at: '2026-02-27T10:00:00.000Z',
    updated_at: '2026-02-27T10:30:00.000Z',
    message_count: 4,
    ...overrides,
  }
}

export function createMockSessions(count: number): MockChatSession[] {
  return Array.from({ length: count }, (_, i) => createMockSession({
    id: `session-${String(i + 1).padStart(3, '0')}`,
    title: `Session ${i + 1}`,
    created_at: new Date(Date.now() - (count - i) * 3600000).toISOString(),
    updated_at: new Date(Date.now() - (count - i) * 1800000).toISOString(),
    message_count: 2 + i,
  }))
}

export function createMockMessage(overrides?: Partial<MockChatMessage>): MockChatMessage {
  return {
    id: 'msg-001',
    session_id: 'session-001',
    role: 'assistant',
    content: 'SPX is testing resistance near 5950.',
    created_at: '2026-02-27T10:00:00.000Z',
    ...overrides,
  }
}

export function createMockConversation(sessionId = 'session-001'): MockChatMessage[] {
  return [
    createMockMessage({ id: 'msg-001', session_id: sessionId, role: 'user', content: 'Analyze SPX', created_at: '2026-02-27T10:00:00.000Z' }),
    createMockMessage({ id: 'msg-002', session_id: sessionId, role: 'assistant', content: 'SPX is testing resistance near 5950. PDH tested 3x today with 100% hold rate.', created_at: '2026-02-27T10:00:05.000Z' }),
    createMockMessage({ id: 'msg-003', session_id: sessionId, role: 'user', content: 'What about key levels?', created_at: '2026-02-27T10:05:00.000Z' }),
    createMockMessage({
      id: 'msg-004',
      session_id: sessionId,
      role: 'assistant',
      content: 'Here are the key levels for SPX:',
      created_at: '2026-02-27T10:05:05.000Z',
      function_calls: [{
        name: 'get_key_levels',
        arguments: { symbol: 'SPX' },
        result: {
          resistance: [{ name: 'PDH', price: 5960 }, { name: 'R1', price: 5975 }],
          support: [{ name: 'VWAP', price: 5940 }, { name: 'PDL', price: 5920 }],
        },
      }],
    }),
  ]
}

export function createMockWidgetResponse(): MockChatMessage {
  return createMockMessage({
    id: 'msg-widget',
    role: 'assistant',
    content: 'Here is your SPX analysis:',
    function_calls: [
      {
        name: 'get_key_levels',
        arguments: { symbol: 'SPX' },
        result: {
          resistance: [{ name: 'PDH', price: 5960 }],
          support: [{ name: 'VWAP', price: 5940 }],
        },
      },
      {
        name: 'get_current_price',
        arguments: { symbol: 'SPX' },
        result: { symbol: 'SPX', price: 5948.50, change: 12.30, changePercent: 0.21 },
      },
      {
        name: 'analyze_position',
        arguments: { symbol: 'NVDA', type: 'call', strike: 140, expiry: '2026-03-07' },
        result: { symbol: 'NVDA', type: 'CALL', strike: 140, pnl: 245, pnlPercent: 18.5 },
      },
      {
        name: 'scan_opportunities',
        arguments: { criteria: 'breakout' },
        result: { setups: [{ symbol: 'SPX', setup: 'breakout', direction: 'long' }] },
      },
    ],
  })
}

export function createMockChartBars(count = 100, basePrice = 5940): MockChartBar[] {
  const bars: MockChartBar[] = []
  let price = basePrice
  const now = Math.floor(Date.now() / 1000)
  const interval = 60 // 1-minute bars

  for (let i = 0; i < count; i++) {
    const change = (Math.random() - 0.5) * 5
    const open = price
    const close = price + change
    const high = Math.max(open, close) + Math.random() * 2
    const low = Math.min(open, close) - Math.random() * 2
    price = close

    bars.push({
      time: now - (count - i) * interval,
      open: Math.round(open * 100) / 100,
      high: Math.round(high * 100) / 100,
      low: Math.round(low * 100) / 100,
      close: Math.round(close * 100) / 100,
      volume: Math.floor(Math.random() * 50000) + 10000,
    })
  }
  return bars
}

export function createMockOptionsChain(
  baseStrike = 5940,
  type: 'call' | 'put' = 'call',
  count = 10,
): MockOptionsContract[] {
  return Array.from({ length: count }, (_, i) => {
    const strike = baseStrike - (count / 2 - i) * 5
    const distance = Math.abs(strike - baseStrike)
    const baseIV = 0.20 + distance * 0.001
    return {
      strike,
      expiry: '2026-03-07',
      type,
      last: Math.max(0.50, 20 - distance * 0.3 + Math.random() * 2),
      bid: Math.max(0.40, 19 - distance * 0.3),
      ask: Math.max(0.60, 21 - distance * 0.3),
      volume: Math.floor(Math.random() * 5000) + 100,
      openInterest: Math.floor(Math.random() * 20000) + 500,
      iv: Math.round(baseIV * 10000) / 10000,
      delta: type === 'call' ? Math.max(0.05, 0.50 - distance * 0.01) : Math.min(-0.05, -0.50 + distance * 0.01),
      gamma: Math.max(0.001, 0.05 - distance * 0.001),
      theta: -(Math.random() * 0.5 + 0.1),
      vega: Math.max(0.01, 0.30 - distance * 0.005),
    }
  })
}

export function createMockExpirations(): string[] {
  const base = new Date('2026-03-07')
  return Array.from({ length: 6 }, (_, i) => {
    const d = new Date(base)
    d.setDate(d.getDate() + i * 7)
    return d.toISOString().split('T')[0]
  })
}

// ---------------------------------------------------------------------------
// AI Coach API Mocks
// ---------------------------------------------------------------------------

export async function setupChatMocks(
  page: Page,
  options: {
    sessions?: MockChatSession[]
    messages?: MockChatMessage[]
    streamEnabled?: boolean
    responseOverride?: string
    functionCalls?: MockFunctionCall[]
  } = {},
): Promise<void> {
  const {
    sessions = [],
    messages = [],
    streamEnabled = false,
    responseOverride,
    functionCalls,
  } = options

  // Sessions list
  await page.route('**/api/chat/sessions', async (route: Route) => {
    const method = route.request().method()
    if (method === 'GET') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ sessions, count: sessions.length }),
      })
    } else if (method === 'DELETE') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true }),
      })
    } else {
      await route.fallback()
    }
  })

  // Session messages
  await page.route('**/api/chat/sessions/*', async (route: Route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ messages, total: messages.length, hasMore: false }),
    })
  })

  // Stream endpoint
  await page.route('**/api/chat/stream', async (route: Route) => {
    if (!streamEnabled) {
      await route.fulfill({
        status: 503,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'Streaming disabled for testing' }),
      })
      return
    }
    // SSE streaming mock
    const content = responseOverride || 'This is a streamed response from AI Coach.'
    const chunks = content.split(' ')
    let sseBody = ''
    for (const chunk of chunks) {
      sseBody += `data: ${JSON.stringify({ type: 'content', content: chunk + ' ' })}\n\n`
    }
    sseBody += `data: ${JSON.stringify({ type: 'done', session_id: 'session-stream-001' })}\n\n`
    await route.fulfill({
      status: 200,
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
      body: sseBody,
    })
  })

  // Non-streaming message endpoint
  await page.route('**/api/chat/message', async (route: Route) => {
    const response: Record<string, unknown> = {
      reply: responseOverride || 'SPX is testing resistance near 5950. Key level at PDH.',
      session_id: 'session-001',
      message_id: `msg-${Date.now()}`,
    }
    if (functionCalls && functionCalls.length > 0) {
      response.function_calls = functionCalls
    }
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(response),
    })
  })
}

export async function setupChartMocks(page: Page): Promise<void> {
  await page.route('**/api/chart/**', async (route: Route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        bars: createMockChartBars(),
        symbol: 'SPX',
        timeframe: '1D',
      }),
    })
  })

  await page.route('**/api/levels/**', async (route: Route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        levels: {
          resistance: [{ name: 'PDH', price: 5960, type: 'PDH', strength: 'strong' }],
          support: [{ name: 'VWAP', price: 5940, type: 'VWAP', strength: 'dynamic' }],
        },
      }),
    })
  })
}

export async function setupOptionsMocks(page: Page): Promise<void> {
  await page.route('**/api/options/**/chain**', async (route: Route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        calls: createMockOptionsChain(5940, 'call'),
        puts: createMockOptionsChain(5940, 'put'),
        underlying_price: 5948.50,
        expiry: '2026-03-07',
      }),
    })
  })

  await page.route('**/api/options/**/expirations**', async (route: Route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ expirations: createMockExpirations() }),
    })
  })

  await page.route('**/api/options/**/gex**', async (route: Route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        gex: Array.from({ length: 20 }, (_, i) => ({
          strike: 5900 + i * 5,
          callGex: Math.random() * 1000000,
          putGex: -Math.random() * 800000,
          totalGex: Math.random() * 500000 - 250000,
        })),
      }),
    })
  })
}

export async function setupPositionsMocks(page: Page): Promise<void> {
  await page.route('**/api/positions/live', async (route: Route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ positions: [], count: 0 }),
    })
  })

  await page.route('**/api/positions/advice**', async (route: Route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ advice: [], count: 0 }),
    })
  })
}

export async function setupScreenshotMocks(page: Page): Promise<void> {
  await page.route('**/api/screenshot/analyze', async (route: Route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        success: true,
        intent: 'position_analysis',
        positions: [
          { symbol: 'SPX', type: 'PUT', strike: 5920, expiry: '2026-03-07', quantity: 2, avgPrice: 8.50 },
        ],
        suggested_actions: [
          { id: 'analyze_position', label: 'Analyze Position', icon: 'BarChart' },
          { id: 'add_to_journal', label: 'Add to Journal', icon: 'BookOpen' },
        ],
        summary: 'Detected 1 SPX PUT position at 5920 strike.',
      }),
    })
  })
}

// ---------------------------------------------------------------------------
// Misc API Mocks (brief, macro, earnings, journal)
// ---------------------------------------------------------------------------

export async function setupMiscMocks(page: Page): Promise<void> {
  await page.route('**/api/brief/**', async (route: Route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ brief: 'Markets opened higher with SPX up 0.3%.' }),
    })
  })

  await page.route('**/api/macro**', async (route: Route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ indicators: [] }),
    })
  })

  await page.route('**/api/earnings/**', async (route: Route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ events: [] }),
    })
  })

  await page.route('**/api/journal/**', async (route: Route) => {
    if (route.request().method() === 'GET') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ data: [], count: 0 }),
      })
    } else {
      await route.fallback()
    }
  })
}

// ---------------------------------------------------------------------------
// Bundle Setup: All Mocks
// ---------------------------------------------------------------------------

export async function setupAllAICoachMocks(
  page: Page,
  chatOptions?: Parameters<typeof setupChatMocks>[1],
): Promise<void> {
  await setupShellMocks(page)
  await setupChatMocks(page, chatOptions)
  await setupChartMocks(page)
  await setupOptionsMocks(page)
  await setupPositionsMocks(page)
  await setupScreenshotMocks(page)
  await setupMiscMocks(page)
}

// ---------------------------------------------------------------------------
// Navigation Helpers
// ---------------------------------------------------------------------------

export async function navigateToAICoach(page: Page): Promise<void> {
  await page.goto(AI_COACH_URL, { waitUntil: 'domcontentloaded' })
}

export async function waitForChatReady(page: Page, timeout = 15000): Promise<void> {
  // Wait for either chat input or welcome view to be visible
  const chatInput = page.locator('textarea, input[type="text"]').first()
  await chatInput.waitFor({ state: 'visible', timeout })
}

export async function sendChatMessage(page: Page, text: string): Promise<void> {
  const input = page.locator('textarea, input[type="text"]').first()
  await input.fill(text)
  const sendButton = page.getByRole('button', { name: /send/i })
  await sendButton.click()
}

export async function waitForAssistantResponse(page: Page, timeout = 15000): Promise<void> {
  // Wait for a message bubble from the assistant to appear
  await page.locator('[data-role="assistant"], .message-bubble-assistant, [class*="assistant"]').first().waitFor({ state: 'visible', timeout })
}

export async function switchToView(page: Page, view: 'Chart' | 'Options' | 'Journal'): Promise<void> {
  const tab = page.getByRole('tab', { name: view })
  if (await tab.isVisible()) {
    await tab.click()
  } else {
    // Try button fallback (welcome view cards)
    const button = page.getByRole('button', { name: new RegExp(view, 'i') }).first()
    if (await button.isVisible()) {
      await button.click()
    }
  }
}
