import { describe, expect, it } from 'vitest'

import { detectSPXSequenceGap, SPXMarketDataOrchestrator } from '@/lib/spx/market-data-orchestrator'
import type { SPXRealtimeEvent } from '@/lib/spx/event-schema'

function makeEvent(overrides: Partial<SPXRealtimeEvent>): SPXRealtimeEvent {
  return {
    kind: 'spx_setup',
    channel: 'setups:update',
    symbol: 'SPX',
    timestamp: '2026-02-21T14:30:00.000Z',
    source: null,
    feedAgeMs: null,
    sequence: null,
    receivedAtMs: 1_700_000_000_000,
    ...overrides,
  }
}

describe('market data orchestrator', () => {
  it('detects channel sequence gaps', () => {
    const orchestrator = new SPXMarketDataOrchestrator()
    orchestrator.ingest(makeEvent({ sequence: 10 }))
    orchestrator.ingest(makeEvent({ sequence: 13 }))

    const trust = orchestrator.evaluate(1_700_000_000_500, true)
    expect(trust.sequenceGapDetected).toBe(true)
  })

  it('marks heartbeat stale when event cadence halts', () => {
    const orchestrator = new SPXMarketDataOrchestrator({ heartbeatStaleMs: 5_000 })
    orchestrator.ingest(makeEvent({ kind: 'heartbeat', channel: 'price:spx', receivedAtMs: 1_000 }))

    const trust = orchestrator.evaluate(7_100, true)
    expect(trust.heartbeatStale).toBe(true)
  })

  it('clears sequence gap state on demand', () => {
    const orchestrator = new SPXMarketDataOrchestrator()
    orchestrator.ingest(makeEvent({ sequence: 5 }))
    orchestrator.ingest(makeEvent({ sequence: 8 }))
    orchestrator.clearSequenceGap()

    const trust = orchestrator.evaluate(1_700_000_000_500, true)
    expect(trust.sequenceGapDetected).toBe(false)
  })

  it('sequence gap helper handles null edges', () => {
    expect(detectSPXSequenceGap(null, 4)).toBe(false)
    expect(detectSPXSequenceGap(4, null)).toBe(false)
    expect(detectSPXSequenceGap(4, 5)).toBe(false)
    expect(detectSPXSequenceGap(4, 7)).toBe(true)
  })
})
