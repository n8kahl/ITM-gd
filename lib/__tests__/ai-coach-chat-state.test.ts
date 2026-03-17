import { describe, expect, it } from 'vitest'

import { getLatestAssistantChartRequest } from '../ai-coach-chat-state'

describe('getLatestAssistantChartRequest', () => {
  it('returns the newest assistant chart request in a session', () => {
    expect(getLatestAssistantChartRequest([
      { role: 'assistant', chartRequest: { symbol: 'SPY', timeframe: '5m' } },
      { role: 'user' },
      { role: 'assistant', chartRequest: { symbol: 'QQQ', timeframe: '15m' } },
    ])).toEqual({ symbol: 'QQQ', timeframe: '15m' })
  })

  it('returns null when a session has no assistant chart request', () => {
    expect(getLatestAssistantChartRequest([
      { role: 'user' },
      { role: 'assistant', chartRequest: null },
    ])).toBeNull()
  })
})
