import { describe, expect, it } from 'vitest'
import {
  AI_COACH_PROXY_BASE,
  AI_COACH_PROXY_ROUTES,
  AI_COACH_PROXY_PATTERNS,
  AI_COACH_CONTRACT_FIXTURES,
} from '@/e2e/specs/ai-coach/ai-coach-proxy-contract-fixtures'

describe('ai-coach proxy contract fixtures', () => {
  it('uses the ai-coach proxy base for route construction', () => {
    expect(AI_COACH_PROXY_BASE).toBe('/api/ai-coach-proxy')
    expect(AI_COACH_PROXY_ROUTES.chatMessage).toBe('/api/ai-coach-proxy/chat/message')
    expect(AI_COACH_PROXY_ROUTES.chatStream).toBe('/api/ai-coach-proxy/chat/stream')
  })

  it('exposes wildcard patterns that target proxy endpoints', () => {
    expect(AI_COACH_PROXY_PATTERNS.chatSessions).toContain('/api/ai-coach-proxy/chat/sessions')
    expect(AI_COACH_PROXY_PATTERNS.optionsChain).toContain('/api/ai-coach-proxy/options')
    expect(AI_COACH_PROXY_PATTERNS.chart).toContain('/api/ai-coach-proxy/chart')
  })

  it('models current chat response shape with camelCase ids', () => {
    expect(AI_COACH_CONTRACT_FIXTURES.chatMessageResponse).toMatchObject({
      sessionId: expect.any(String),
      messageId: expect.any(String),
      role: 'assistant',
      content: expect.any(String),
      tokensUsed: expect.any(Number),
      responseTime: expect.any(Number),
    })
  })

  it('models current options chain shape with nested options.calls/puts', () => {
    expect(AI_COACH_CONTRACT_FIXTURES.optionsChainResponse).toMatchObject({
      symbol: 'SPX',
      currentPrice: expect.any(Number),
      options: {
        calls: expect.any(Array),
        puts: expect.any(Array),
      },
    })
    expect(AI_COACH_CONTRACT_FIXTURES.optionsChainResponse.options.calls[0]).toHaveProperty('impliedVolatility')
  })
})

