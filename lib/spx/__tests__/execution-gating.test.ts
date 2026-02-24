import { describe, expect, it } from 'vitest'

import { resolveExecutionEntryGate } from '@/lib/spx/execution-gating'

describe('execution entry gating', () => {
  it('blocks when feed trust is blocked', () => {
    const result = resolveExecutionEntryGate({
      blockTradeEntryByFeedTrust: true,
      dataHealthMessage: 'Tick stream lag detected.',
      feedFallbackReasonCode: 'tick_source_stale',
      feedFallbackStage: 'snapshot_fallback',
      brokerConnected: true,
      executionMode: 'manual',
      brokerErrorMessage: null,
    })

    expect(result.blocked).toBe(true)
    expect(result.feedBlocked).toBe(true)
    expect(result.message).toContain('Tick stream lag')
  })

  it('blocks when broker is disconnected', () => {
    const result = resolveExecutionEntryGate({
      blockTradeEntryByFeedTrust: false,
      dataHealthMessage: null,
      feedFallbackReasonCode: 'none',
      feedFallbackStage: 'live_stream',
      brokerConnected: false,
      executionMode: 'off',
      brokerErrorMessage: null,
    })

    expect(result.blocked).toBe(true)
    expect(result.brokerBlocked).toBe(true)
    expect(result.message).toBe('Broker disconnected.')
  })

  it('passes when feed and broker are healthy', () => {
    const result = resolveExecutionEntryGate({
      blockTradeEntryByFeedTrust: false,
      dataHealthMessage: null,
      feedFallbackReasonCode: 'none',
      feedFallbackStage: 'live_stream',
      brokerConnected: true,
      executionMode: 'manual',
      brokerErrorMessage: null,
    })

    expect(result.blocked).toBe(false)
    expect(result.message).toBeNull()
  })
})
