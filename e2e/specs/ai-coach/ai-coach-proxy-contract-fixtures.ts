/**
 * AI Coach proxy contract fixtures.
 *
 * Purpose:
 * - Provide a single source of truth for current frontend proxy routes.
 * - Provide typed mock payloads that mirror current `/api/ai-coach-proxy/*`
 *   response contracts used by `lib/api/ai-coach.ts`.
 *
 * This module is intentionally framework-agnostic so both Playwright helpers
 * and unit tests can consume it.
 */

export const AI_COACH_PROXY_BASE = '/api/ai-coach-proxy'

export const AI_COACH_PROXY_ROUTES = {
  chatMessage: `${AI_COACH_PROXY_BASE}/chat/message`,
  chatStream: `${AI_COACH_PROXY_BASE}/chat/stream`,
  chatSessions: `${AI_COACH_PROXY_BASE}/chat/sessions`,
  chatSessionMessages: (sessionId: string) => `${AI_COACH_PROXY_BASE}/chat/sessions/${sessionId}/messages`,
  chart: (symbol: string) => `${AI_COACH_PROXY_BASE}/chart/${encodeURIComponent(symbol)}`,
  levels: (symbol: string) => `${AI_COACH_PROXY_BASE}/levels/${encodeURIComponent(symbol)}`,
  optionsChain: (symbol: string) => `${AI_COACH_PROXY_BASE}/options/${encodeURIComponent(symbol)}/chain`,
  optionsExpirations: (symbol: string) => `${AI_COACH_PROXY_BASE}/options/${encodeURIComponent(symbol)}/expirations`,
  optionsGex: (symbol: string) => `${AI_COACH_PROXY_BASE}/options/${encodeURIComponent(symbol)}/gex`,
} as const

export const AI_COACH_PROXY_PATTERNS = {
  chatMessage: `**${AI_COACH_PROXY_ROUTES.chatMessage}`,
  chatStream: `**${AI_COACH_PROXY_ROUTES.chatStream}`,
  chatSessions: `**${AI_COACH_PROXY_ROUTES.chatSessions}**`,
  chatSessionMessages: `**${AI_COACH_PROXY_BASE}/chat/sessions/*/messages*`,
  chart: `**${AI_COACH_PROXY_BASE}/chart/*`,
  levels: `**${AI_COACH_PROXY_BASE}/levels/*`,
  optionsChain: `**${AI_COACH_PROXY_BASE}/options/*/chain*`,
  optionsExpirations: `**${AI_COACH_PROXY_BASE}/options/*/expirations*`,
  optionsGex: `**${AI_COACH_PROXY_BASE}/options/*/gex*`,
} as const

export const AI_COACH_CONTRACT_FIXTURES = {
  chatMessageResponse: {
    sessionId: 'session-001',
    messageId: 'msg-001',
    role: 'assistant' as const,
    content: 'SPX is testing resistance near 5950.',
    functionCalls: [],
    tokensUsed: 128,
    responseTime: 412,
  },
  chatSessionsResponse: {
    sessions: [
      {
        id: 'session-001',
        title: 'SPX Analysis',
        message_count: 4,
        created_at: '2026-03-20T10:00:00.000Z',
        updated_at: '2026-03-20T10:30:00.000Z',
      },
    ],
    count: 1,
  },
  sessionMessagesResponse: {
    messages: [
      {
        id: 'msg-user-001',
        role: 'user' as const,
        content: 'Analyze SPX setup',
        timestamp: '2026-03-20T10:00:00.000Z',
      },
      {
        id: 'msg-assistant-001',
        role: 'assistant' as const,
        content: 'SPX is near PDH with rejection risk.',
        timestamp: '2026-03-20T10:00:03.000Z',
        functionCalls: [],
      },
    ],
    total: 2,
    hasMore: false,
  },
  optionsChainResponse: {
    symbol: 'SPX',
    currentPrice: 5948.5,
    expiry: '2026-03-27',
    daysToExpiry: 7,
    ivRank: 42,
    options: {
      calls: [
        {
          strike: 5950,
          last: 18.4,
          bid: 18.2,
          ask: 18.6,
          volume: 1200,
          openInterest: 5400,
          impliedVolatility: 0.22,
          delta: 0.51,
          gamma: 0.031,
          theta: -0.88,
          vega: 0.14,
          rho: 0.02,
          inTheMoney: false,
          intrinsicValue: 0,
          extrinsicValue: 18.4,
        },
      ],
      puts: [
        {
          strike: 5950,
          last: 20.1,
          bid: 19.9,
          ask: 20.3,
          volume: 930,
          openInterest: 4700,
          impliedVolatility: 0.23,
          delta: -0.49,
          gamma: 0.029,
          theta: -0.91,
          vega: 0.15,
          rho: -0.02,
          inTheMoney: true,
          intrinsicValue: 1.5,
          extrinsicValue: 18.6,
        },
      ],
    },
  },
  expirationsResponse: {
    symbol: 'SPX',
    expirations: ['2026-03-27', '2026-04-03', '2026-04-10'],
    count: 3,
  },
  chartResponse: {
    symbol: 'SPX',
    timeframe: '5m' as const,
    bars: [
      {
        time: 1773991800,
        open: 5944.2,
        high: 5949.8,
        low: 5942.1,
        close: 5948.5,
        volume: 11234,
      },
    ],
    count: 1,
    timestamp: '2026-03-20T10:35:00.000Z',
    cached: false,
  },
} as const
