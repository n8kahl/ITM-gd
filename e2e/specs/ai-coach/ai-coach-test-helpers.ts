import type { Page, Route } from '@playwright/test'
import { authenticateAsMember } from '../../helpers/member-auth'
import {
  AI_COACH_PROXY_BASE,
  AI_COACH_PROXY_PATTERNS,
  AI_COACH_CONTRACT_FIXTURES,
} from './ai-coach-proxy-contract-fixtures'

const DEFAULT_CONTRACT_SESSION = AI_COACH_CONTRACT_FIXTURES.chatSessionsResponse.sessions[0]
const DEFAULT_CHAT_RESPONSE = AI_COACH_CONTRACT_FIXTURES.chatMessageResponse
const DEFAULT_OPTIONS_CONTRACT = AI_COACH_CONTRACT_FIXTURES.optionsChainResponse

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

export const E2E_USER_ID = '00000000-0000-4000-8000-000000000001'
export const AI_COACH_URL = '/members/ai-coach'
export const ONBOARDING_KEY = 'ai-coach-onboarding-complete'
export const PREFERENCES_KEY = 'ai-coach-preferences-v2'
export const SESSION_KEY = 'ai-coach-current-session-id'
export const AI_COACH_USER_MESSAGE_SELECTOR = '[data-testid="ai-coach-message-user"]:visible, [data-message-role="user"]:visible, [data-role="user"]:visible'
export const AI_COACH_ASSISTANT_MESSAGE_SELECTOR = '[data-testid="ai-coach-message-assistant"]:visible, [data-message-role="assistant"]:visible, [data-role="assistant"]:visible, .message-bubble-assistant:visible'

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
  sessionId: string
  role: 'user' | 'assistant'
  content: string
  timestamp: string
  functionCalls?: MockFunctionCall[]
  /**
   * Legacy aliases kept for compatibility with older tests.
   * These should be removed once all specs use camelCase fields.
   */
  session_id?: string
  created_at?: string
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
  last: number
  bid: number
  ask: number
  volume: number
  openInterest: number
  impliedVolatility: number
  delta: number | null
  gamma: number | null
  theta: number | null
  vega: number | null
  rho: number | null
  inTheMoney: boolean
  intrinsicValue: number
  extrinsicValue: number
}

export function createMockSession(overrides?: Partial<MockChatSession>): MockChatSession {
  return {
    id: DEFAULT_CONTRACT_SESSION.id,
    title: DEFAULT_CONTRACT_SESSION.title,
    created_at: DEFAULT_CONTRACT_SESSION.created_at,
    updated_at: DEFAULT_CONTRACT_SESSION.updated_at,
    message_count: DEFAULT_CONTRACT_SESSION.message_count,
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
  const base: MockChatMessage = {
    id: DEFAULT_CHAT_RESPONSE.messageId,
    sessionId: DEFAULT_CHAT_RESPONSE.sessionId,
    role: 'assistant',
    content: DEFAULT_CHAT_RESPONSE.content,
    timestamp: '2026-03-20T10:00:00.000Z',
    session_id: DEFAULT_CHAT_RESPONSE.sessionId,
    created_at: '2026-03-20T10:00:00.000Z',
    ...overrides,
  }
  base.session_id = base.sessionId
  base.created_at = base.timestamp
  if (base.functionCalls) {
    base.function_calls = base.functionCalls
  } else if (base.function_calls) {
    base.functionCalls = base.function_calls
  }
  return base
}

export function createMockConversation(sessionId = 'session-001'): MockChatMessage[] {
  return [
    createMockMessage({ id: 'msg-001', sessionId, role: 'user', content: 'Analyze SPX', timestamp: '2026-02-27T10:00:00.000Z' }),
    createMockMessage({ id: 'msg-002', sessionId, role: 'assistant', content: 'SPX is testing resistance near 5950. PDH tested 3x today with 100% hold rate.', timestamp: '2026-02-27T10:00:05.000Z' }),
    createMockMessage({ id: 'msg-003', sessionId, role: 'user', content: 'What about key levels?', timestamp: '2026-02-27T10:05:00.000Z' }),
    createMockMessage({
      id: 'msg-004',
      sessionId,
      role: 'assistant',
      content: 'Here are the key levels for SPX:',
      timestamp: '2026-02-27T10:05:05.000Z',
      functionCalls: [{
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
  const message = createMockMessage({
    id: 'msg-widget',
    role: 'assistant',
    content: 'Here is your SPX analysis:',
    functionCalls: [
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
  message.function_calls = message.functionCalls
  return message
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
  const currentPrice = 5948.5
  return Array.from({ length: count }, (_, i) => {
    const strike = baseStrike - (count / 2 - i) * 5
    const distance = Math.abs(strike - baseStrike)
    const impliedVolatility = Math.round((0.2 + distance * 0.001) * 10000) / 10000
    const intrinsicValue = type === 'call'
      ? Math.max(currentPrice - strike, 0)
      : Math.max(strike - currentPrice, 0)
    const extrinsicValue = Math.max(0.25, 20 - distance * 0.3 + Math.random() * 2)
    const last = Math.round((intrinsicValue + extrinsicValue) * 100) / 100
    const inTheMoney = type === 'call' ? strike <= currentPrice : strike >= currentPrice

    return {
      strike,
      last,
      bid: Math.max(0.40, 19 - distance * 0.3),
      ask: Math.max(0.60, 21 - distance * 0.3),
      volume: Math.floor(Math.random() * 5000) + 100,
      openInterest: Math.floor(Math.random() * 20000) + 500,
      impliedVolatility,
      delta: type === 'call' ? Math.max(0.05, 0.50 - distance * 0.01) : Math.min(-0.05, -0.50 + distance * 0.01),
      gamma: Math.max(0.001, 0.05 - distance * 0.001),
      theta: -(Math.random() * 0.5 + 0.1),
      vega: Math.max(0.01, 0.30 - distance * 0.005),
      rho: type === 'call' ? 0.02 : -0.02,
      inTheMoney,
      intrinsicValue: Math.round(intrinsicValue * 100) / 100,
      extrinsicValue: Math.round((last - intrinsicValue) * 100) / 100,
    }
  })
}

export function createMockExpirations(): string[] {
  const base = new Date(DEFAULT_OPTIONS_CONTRACT.expiry)
  return Array.from({ length: 6 }, (_, i) => {
    const d = new Date(base)
    d.setDate(d.getDate() + i * 7)
    return d.toISOString().split('T')[0]
  })
}

// ---------------------------------------------------------------------------
// AI Coach API Mocks
// ---------------------------------------------------------------------------

type ContractFunctionCall = {
  function: string
  arguments: Record<string, unknown>
  result: unknown
}

function toContractFunctionCalls(functionCalls?: MockFunctionCall[]): ContractFunctionCall[] | undefined {
  if (!functionCalls || functionCalls.length === 0) return undefined
  return functionCalls.map((call) => ({
    function: call.name,
    arguments: call.arguments,
    result: call.result,
  }))
}

function extractSessionIdFromMessagesUrl(url: string): string | null {
  const pathname = new URL(url).pathname
  const match = pathname.match(/\/chat\/sessions\/([^/]+)\/messages/)
  if (!match) return null
  return decodeURIComponent(match[1])
}

function toSessionMessages(messages: MockChatMessage[]): Array<{
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: string
  functionCalls?: ContractFunctionCall[]
}> {
  return messages.map((message) => ({
    id: message.id,
    role: message.role,
    content: message.content,
    timestamp: message.timestamp || message.created_at || new Date().toISOString(),
    ...(toContractFunctionCalls(message.functionCalls || message.function_calls)
      ? { functionCalls: toContractFunctionCalls(message.functionCalls || message.function_calls) }
      : {}),
  }))
}

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

  // Session messages
  await page.route(AI_COACH_PROXY_PATTERNS.chatSessionMessages, async (route: Route) => {
    const requestedSessionId = extractSessionIdFromMessagesUrl(route.request().url())
    const filteredMessages = requestedSessionId
      ? messages.filter((message) => (
        (message.sessionId || message.session_id || '').toLowerCase() === requestedSessionId.toLowerCase()
      ))
      : messages
    const normalizedMessages = toSessionMessages(filteredMessages)

    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        messages: normalizedMessages,
        total: normalizedMessages.length,
        hasMore: false,
      }),
    })
  })

  // Sessions list + delete
  await page.route(AI_COACH_PROXY_PATTERNS.chatSessions, async (route: Route) => {
    const method = route.request().method()
    const pathname = new URL(route.request().url()).pathname
    const isMessagesPath = pathname.includes('/chat/sessions/') && pathname.includes('/messages')
    if (isMessagesPath) {
      await route.fallback()
      return
    }

    if (method === 'GET' && pathname.endsWith('/chat/sessions')) {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ sessions, count: sessions.length }),
      })
    } else if (method === 'DELETE' && pathname.includes('/chat/sessions/')) {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, message: 'Session deleted' }),
      })
    } else {
      await route.fallback()
    }
  })

  // Stream endpoint
  await page.route(AI_COACH_PROXY_PATTERNS.chatStream, async (route: Route) => {
    if (!streamEnabled) {
      await route.fulfill({
        status: 503,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'Streaming disabled for testing' }),
      })
      return
    }
    const content = responseOverride || 'This is a streamed response from AI Coach.'
    const sessionId = sessions[0]?.id || 'session-stream-001'
    const contractFunctionCalls = toContractFunctionCalls(functionCalls)
    const messageId = `msg-stream-${Date.now()}`

    // SSE stream with explicit event frames matching stream parser.
    const chunks = content.split(' ').filter(Boolean)
    let sseBody = ''
    sseBody += `event: session\ndata: ${JSON.stringify({ sessionId })}\n\n`
    sseBody += `event: status\ndata: ${JSON.stringify({ message: 'Analyzing context' })}\n\n`
    for (const chunk of chunks) {
      sseBody += `event: token\ndata: ${JSON.stringify({ text: `${chunk} ` })}\n\n`
    }
    sseBody += `event: done\ndata: ${JSON.stringify({
      messageId,
      content,
      functionCalls: contractFunctionCalls || [],
      tokensUsed: 132,
      responseTime: 428,
    })}\n\n`

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
  await page.route(AI_COACH_PROXY_PATTERNS.chatMessage, async (route: Route) => {
    const requestBody = route.request().postDataJSON() as {
      sessionId?: string
      message?: string
    } | null
    const sessionId = requestBody?.sessionId || sessions[0]?.id || 'session-001'

    const response: Record<string, unknown> = {
      sessionId,
      messageId: `msg-${Date.now()}`,
      role: 'assistant',
      content: responseOverride || 'SPX is testing resistance near 5950. Key level at PDH.',
      tokensUsed: 136,
      responseTime: 395,
    }

    const contractFunctionCalls = toContractFunctionCalls(functionCalls)
    if (contractFunctionCalls && contractFunctionCalls.length > 0) {
      response.functionCalls = contractFunctionCalls
    }

    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(response),
    })
  })
}

export async function setupChartMocks(page: Page): Promise<void> {
  await page.route(AI_COACH_PROXY_PATTERNS.chart, async (route: Route) => {
    const pathname = new URL(route.request().url()).pathname
    const symbolMatch = pathname.match(/\/chart\/([^/?]+)/)
    const symbol = symbolMatch ? decodeURIComponent(symbolMatch[1]).toUpperCase() : 'SPX'

    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        symbol,
        timeframe: '5m',
        bars: createMockChartBars(),
        count: 100,
        timestamp: '2026-03-20T10:35:00.000Z',
        cached: false,
      }),
    })
  })

  await page.route(AI_COACH_PROXY_PATTERNS.levels, async (route: Route) => {
    const pathname = new URL(route.request().url()).pathname
    const symbolMatch = pathname.match(/\/levels\/([^/?]+)/)
    const symbol = symbolMatch ? decodeURIComponent(symbolMatch[1]).toUpperCase() : 'SPX'

    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        symbol,
        timestamp: '2026-03-20T10:35:00.000Z',
        currentPrice: 5948.5,
        levels: {
          resistance: [{
            type: 'PDH',
            price: 5960,
            distance: 11.5,
            distancePct: 0.19,
            distanceATR: 0.34,
            strength: 'strong',
            description: 'Prior day high',
            displayLabel: 'PDH',
            side: 'resistance',
            testsToday: 3,
            holdRate: 1,
          }],
          support: [{
            type: 'VWAP',
            price: 5940,
            distance: -8.5,
            distancePct: -0.14,
            distanceATR: -0.25,
            strength: 'dynamic',
            description: 'Volume weighted average price',
            displayLabel: 'VWAP',
            side: 'support',
            testsToday: 2,
            holdRate: 0.82,
          }],
          pivots: {
            standard: { p: 5945, r1: 5960, s1: 5930 },
            camarilla: { h3: 5962, l3: 5928 },
            fibonacci: { p: 5945, r1: 5958, s1: 5932 },
          },
          indicators: {
            vwap: 5940,
            atr14: 21.7,
          },
        },
        marketContext: {
          marketStatus: 'open',
          sessionType: 'regular',
          timeSinceOpen: '2h 5m',
        },
        cached: false,
        cacheExpiresAt: null,
      }),
    })
  })
}

export async function setupOptionsMocks(page: Page): Promise<void> {
  await page.route(AI_COACH_PROXY_PATTERNS.optionsChain, async (route: Route) => {
    const pathname = new URL(route.request().url()).pathname
    const symbolMatch = pathname.match(/\/options\/([^/]+)/)
    const symbol = symbolMatch ? decodeURIComponent(symbolMatch[1]).toUpperCase() : 'SPX'

    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        symbol,
        currentPrice: DEFAULT_OPTIONS_CONTRACT.currentPrice,
        expiry: DEFAULT_OPTIONS_CONTRACT.expiry,
        daysToExpiry: DEFAULT_OPTIONS_CONTRACT.daysToExpiry,
        ivRank: DEFAULT_OPTIONS_CONTRACT.ivRank,
        options: {
          calls: createMockOptionsChain(5940, 'call'),
          puts: createMockOptionsChain(5940, 'put'),
        },
      }),
    })
  })

  await page.route(`**${AI_COACH_PROXY_BASE}/options/*/matrix*`, async (route: Route) => {
    const pathname = new URL(route.request().url()).pathname
    const symbolMatch = pathname.match(/\/options\/([^/]+)/)
    const symbol = symbolMatch ? decodeURIComponent(symbolMatch[1]).toUpperCase() : 'SPX'
    const expirations = createMockExpirations().slice(0, 3)
    const strikes = [5925, 5930, 5935, 5940, 5945, 5950, 5955]
    const calls = createMockOptionsChain(5940, 'call', strikes.length)
    const puts = createMockOptionsChain(5940, 'put', strikes.length)
    const cells = expirations.flatMap((expiry) => strikes.map((strike, idx) => {
      const call = calls[idx] || null
      const put = puts[idx] || null
      return {
        expiry,
        strike,
        call,
        put,
        metrics: {
          volume: (call?.volume || 0) + (put?.volume || 0),
          openInterest: (call?.openInterest || 0) + (put?.openInterest || 0),
          impliedVolatility: call?.impliedVolatility ?? put?.impliedVolatility ?? null,
          gex: ((call?.gamma || 0) * (call?.openInterest || 0)) - ((put?.gamma || 0) * (put?.openInterest || 0)),
        },
      }
    }))

    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        symbol,
        currentPrice: 5948.50,
        expirations,
        strikes,
        cells,
        generatedAt: '2026-03-20T10:35:00.000Z',
        cacheKey: 'e2e-options-matrix',
      }),
    })
  })

  await page.route(AI_COACH_PROXY_PATTERNS.optionsExpirations, async (route: Route) => {
    const pathname = new URL(route.request().url()).pathname
    const symbolMatch = pathname.match(/\/options\/([^/]+)/)
    const symbol = symbolMatch ? decodeURIComponent(symbolMatch[1]).toUpperCase() : 'SPX'

    const expirations = createMockExpirations()
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        symbol,
        expirations,
        count: expirations.length,
      }),
    })
  })

  await page.route(AI_COACH_PROXY_PATTERNS.optionsGex, async (route: Route) => {
    const pathname = new URL(route.request().url()).pathname
    const symbolMatch = pathname.match(/\/options\/([^/]+)/)
    const symbol = symbolMatch ? decodeURIComponent(symbolMatch[1]).toUpperCase() : 'SPX'
    const gexByStrike = Array.from({ length: 20 }, (_, i) => ({
      strike: 5900 + i * 5,
      gexValue: Math.round((Math.random() * 500000 - 250000) * 100) / 100,
      callGamma: Math.round((Math.random() * 0.09 + 0.01) * 10000) / 10000,
      putGamma: Math.round((Math.random() * 0.09 + 0.01) * 10000) / 10000,
      callOI: Math.floor(Math.random() * 9000) + 1000,
      putOI: Math.floor(Math.random() * 9000) + 1000,
    }))
    const spotPrice = 5948.5
    const maxStrike = gexByStrike.reduce((acc, cur) => (
      Math.abs(cur.gexValue) > Math.abs(acc.gexValue) ? cur : acc
    ), gexByStrike[0])

    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        symbol,
        spotPrice,
        gexByStrike,
        flipPoint: 5940,
        maxGEXStrike: maxStrike.strike,
        keyLevels: [
          { strike: 5940, gexValue: 182400, type: 'support' },
          { strike: 5960, gexValue: -143200, type: 'resistance' },
          { strike: 5950, gexValue: 216800, type: 'magnet' },
        ],
        regime: 'positive_gamma',
        implication: 'Positive gamma regime favors mean reversion around key strikes.',
        calculatedAt: '2026-03-20T10:35:00.000Z',
        expirationsAnalyzed: ['2026-03-07', '2026-03-14'],
      }),
    })
  })

  await page.route(`**${AI_COACH_PROXY_BASE}/options/*/0dte*`, async (route: Route) => {
    const pathname = new URL(route.request().url()).pathname
    const symbolMatch = pathname.match(/\/options\/([^/]+)/)
    const symbol = symbolMatch ? decodeURIComponent(symbolMatch[1]).toUpperCase() : 'SPX'

    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        symbol,
        marketDate: '2026-03-20',
        hasZeroDTE: true,
        message: '0DTE contracts available',
        expectedMove: {
          totalExpectedMove: 42.6,
          usedMove: 18.2,
          usedPct: 42.7,
          remainingMove: 24.4,
          remainingPct: 57.3,
          minutesLeft: 210,
          openPrice: 5938.1,
          currentPrice: 5948.5,
          atmStrike: 5950,
        },
        thetaClock: {
          strike: 5950,
          type: 'call',
          currentValue: 18.4,
          thetaPerDay: -8.2,
          projections: [
            { time: '12:00', estimatedValue: 16.8, thetaDecay: 1.6, pctRemaining: 91.3 },
            { time: '14:00', estimatedValue: 14.9, thetaDecay: 3.5, pctRemaining: 81.0 },
          ],
        },
        gammaProfile: {
          strike: 5950,
          type: 'call',
          currentDelta: 0.51,
          gammaPerDollar: 0.03,
          dollarDeltaChangePerPoint: 0.03,
          leverageMultiplier: 3.2,
          riskLevel: 'moderate',
        },
        topContracts: [{
          strike: 5950,
          type: 'call',
          last: 18.4,
          volume: 1200,
          openInterest: 5400,
          gamma: 0.031,
          theta: -0.88,
        }],
      }),
    })
  })

  await page.route(`**${AI_COACH_PROXY_BASE}/options/*/iv*`, async (route: Route) => {
    const pathname = new URL(route.request().url()).pathname
    const symbolMatch = pathname.match(/\/options\/([^/]+)/)
    const symbol = symbolMatch ? decodeURIComponent(symbolMatch[1]).toUpperCase() : 'SPX'

    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        symbol,
        currentPrice: 5948.5,
        asOf: '2026-03-20T10:35:00.000Z',
        ivRank: {
          currentIV: 0.22,
          ivRank: 42,
          ivPercentile: 47,
          iv52wkHigh: 0.39,
          iv52wkLow: 0.12,
          ivTrend: 'stable',
        },
        skew: {
          skew25delta: -0.04,
          skew10delta: -0.08,
          skewDirection: 'put_heavy',
          interpretation: 'Moderate downside protection demand.',
        },
        termStructure: {
          expirations: createMockExpirations().slice(0, 4).map((date, idx) => ({
            date,
            dte: (idx + 1) * 7,
            atmIV: Math.round((0.2 + idx * 0.01) * 1000) / 1000,
          })),
          shape: 'contango',
        },
      }),
    })
  })
}

export async function setupPositionsMocks(page: Page): Promise<void> {
  await page.route(`**${AI_COACH_PROXY_BASE}/positions/live*`, async (route: Route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        positions: [],
        count: 0,
        timestamp: '2026-03-20T10:35:00.000Z',
      }),
    })
  })

  await page.route(`**${AI_COACH_PROXY_BASE}/positions/advice*`, async (route: Route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        advice: [],
        count: 0,
        generatedAt: '2026-03-20T10:35:00.000Z',
      }),
    })
  })
}

export async function setupScreenshotMocks(page: Page): Promise<void> {
  await page.route(`**${AI_COACH_PROXY_BASE}/screenshot/analyze*`, async (route: Route) => {
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
  await page.route(`**${AI_COACH_PROXY_BASE}/brief/**`, async (route: Route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ brief: 'Markets opened higher with SPX up 0.3%.' }),
    })
  })

  await page.route(`**${AI_COACH_PROXY_BASE}/macro*`, async (route: Route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ indicators: [] }),
    })
  })

  await page.route(`**${AI_COACH_PROXY_BASE}/earnings/**`, async (route: Route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ events: [] }),
    })
  })

  await page.route(`**${AI_COACH_PROXY_BASE}/journal/**`, async (route: Route) => {
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

export async function replaceChatMocks(
  page: Page,
  options?: Parameters<typeof setupChatMocks>[1],
): Promise<void> {
  await page.unroute(AI_COACH_PROXY_PATTERNS.chatSessionMessages)
  await page.unroute(AI_COACH_PROXY_PATTERNS.chatSessions)
  await page.unroute(AI_COACH_PROXY_PATTERNS.chatStream)
  await page.unroute(AI_COACH_PROXY_PATTERNS.chatMessage)
  await setupChatMocks(page, options)
}

// ---------------------------------------------------------------------------
// Navigation Helpers
// ---------------------------------------------------------------------------

export async function navigateToAICoach(page: Page): Promise<void> {
  await page.goto(AI_COACH_URL, { waitUntil: 'domcontentloaded' })
}

export async function waitForChatReady(page: Page, timeout = 15000): Promise<void> {
  const chatInput = page.locator('[data-testid="ai-coach-chat-input"]:visible, [aria-label="Message the AI coach"]:visible').first()
  await chatInput.waitFor({ state: 'visible', timeout })
}

export async function sendChatMessage(page: Page, text: string): Promise<void> {
  const input = page.locator('[data-testid="ai-coach-chat-input"]:visible, [aria-label="Message the AI coach"]:visible').first()
  await input.fill(text)
  const sendButton = page.getByRole('button', { name: /send/i })
  await sendButton.click()
}

export function getUserMessages(page: Page) {
  return page.locator(AI_COACH_USER_MESSAGE_SELECTOR)
}

export function getAssistantMessages(page: Page) {
  return page.locator(AI_COACH_ASSISTANT_MESSAGE_SELECTOR)
}

export async function waitForAssistantResponse(page: Page, timeout = 15000): Promise<void> {
  // Wait for a message bubble from the assistant to appear
  await getAssistantMessages(page).first().waitFor({ state: 'visible', timeout })
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
